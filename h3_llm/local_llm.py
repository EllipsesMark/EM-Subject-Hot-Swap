"""In-process GGUF inference for EM Subject Hot Swap.

Loads only when Describe or Draft is requested. One model is cached at a time
and can be released after each request so VRAM returns to H3 sampling. Context
allocation retries progressively smaller settings before failing.

Gemma 4 uses Gemma4ChatHandler with thinking off. Other vision GGUFs use the
available Qwen vision handler.
"""

import gc
import json
import os
import struct
import time
import urllib.request

try:
    from ..diagnostics import log_diagnostic
except ImportError:
    from diagnostics import log_diagnostic

_CACHE = {"key": None, "llama": None, "handler": None}

_GGUF_SIZES = {0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8}
_GGUF_STRING = 8
_GGUF_ARRAY = 9
_GGML_TYPE_Q8_0 = 8


class LocalLLMError(RuntimeError):
    pass


def unload():
    if _CACHE["llama"] is not None:
        try:
            _CACHE["llama"].close()
        except Exception:
            pass
    _CACHE.update({"key": None, "llama": None, "handler": None})
    gc.collect()
    _empty_torch_cache()


def gguf_architecture(path):
    """Return general.architecture from a GGUF header, or "" if it is absent."""
    with open(path, "rb") as handle:
        magic, version = struct.unpack("<4sI", handle.read(8))
        if magic != b"GGUF":
            return ""
        count_fmt = "<II" if version == 1 else "<QQ"
        _n_tensors, n_kv = struct.unpack(count_fmt, handle.read(8 if version == 1 else 16))
        for _ in range(n_kv):
            key = _read_string(handle)
            value_type = struct.unpack("<I", handle.read(4))[0]
            if key == "general.architecture" and value_type == _GGUF_STRING:
                return _read_string(handle)
            _skip_value(handle, value_type)
    return ""


def _read_string(handle):
    length = struct.unpack("<Q", handle.read(8))[0]
    return handle.read(length).decode("utf-8", errors="replace")


def _skip_value(handle, value_type):
    if value_type in _GGUF_SIZES:
        handle.seek(_GGUF_SIZES[value_type], os.SEEK_CUR)
        return
    if value_type == _GGUF_STRING:
        length = struct.unpack("<Q", handle.read(8))[0]
        handle.seek(length, os.SEEK_CUR)
        return
    if value_type == _GGUF_ARRAY:
        element_type = struct.unpack("<I", handle.read(4))[0]
        count = struct.unpack("<Q", handle.read(8))[0]
        for _ in range(count):
            _skip_value(handle, element_type)
        return
    raise LocalLLMError(f"Unsupported GGUF value type {value_type}")


def _empty_torch_cache():
    try:
        import torch
    except Exception:
        return
    if not torch.cuda.is_available():
        return
    try:
        torch.cuda.synchronize()
        torch.cuda.empty_cache()
    except Exception:
        pass


def _free_comfy_models():
    """Drop PyTorch models ComfyUI is holding so llama.cpp can use the card."""
    try:
        import comfy.model_management as model_management
    except Exception:
        return
    try:
        model_management.unload_all_models()
        model_management.soft_empty_cache()
    except Exception:
        pass
    gc.collect()
    _empty_torch_cache()


def _vision_handler(model_path, mmproj_path):
    import llama_cpp.llama_chat_format as chat_format

    arch = gguf_architecture(model_path)
    if arch == "gemma4":
        cls = getattr(chat_format, "Gemma4ChatHandler", None)
        if cls is None:
            raise LocalLLMError(
                "This llama-cpp-python build cannot run Gemma 4 vision. "
                "ComfyUI needs llama-cpp-python 0.3.35 or newer.")
        return cls(mmproj_path=mmproj_path, enable_thinking=False, verbose=False)

    cls = getattr(chat_format, "Qwen3VLChatHandler", None) or \
        getattr(chat_format, "Qwen25VLChatHandler", None)
    if cls is None:
        raise LocalLLMError(
            "No vision chat handler in this llama-cpp-python build.")
    return cls(clip_model_path=mmproj_path, verbose=False)


def _clean_reply(text, handler):
    name = handler.__class__.__name__ if handler is not None else ""
    if name != "Gemma4ChatHandler":
        return text
    marker = "<channel|>"
    if "<|channel>thought" in text and marker in text:
        text = text.split(marker, 1)[1]
    for token in ("<turn|>", "<|turn>", "<eos>"):
        text = text.replace(token, "")
    return text.strip()


def _load_attempts(n_ctx):
    attempts = []
    ctx = max(2048, int(n_ctx))
    while True:
        attempts.append({"n_ctx": ctx})
        if ctx <= 4096:
            break
        ctx //= 2
    attempts.append({
        "n_ctx": max(2048, min(int(n_ctx), 8192)),
        "type_k": _GGML_TYPE_Q8_0,
        "type_v": _GGML_TYPE_Q8_0,
    })
    attempts.append({
        "n_ctx": 4096,
        "type_k": _GGML_TYPE_Q8_0,
        "type_v": _GGML_TYPE_Q8_0,
    })
    return attempts


def _load(model_path, mmproj_path, n_ctx, n_gpu_layers, diagnostics=False, diagnostic_id=""):
    key = (model_path, mmproj_path, n_ctx, n_gpu_layers)
    if _CACHE["key"] == key and _CACHE["llama"] is not None:
        log_diagnostic(
            diagnostics, diagnostic_id, "model.cache_hit",
            model=os.path.basename(model_path), n_ctx=n_ctx,
            n_gpu_layers=n_gpu_layers,
        )
        return _CACHE["llama"]
    unload()
    _free_comfy_models()

    try:
        from llama_cpp import Llama
    except ImportError as e:
        raise LocalLLMError(
            "llama-cpp-python is not installed in this ComfyUI environment. "
            "Install a build compatible with this ComfyUI Python and GPU, "
            "or leave the LLM input disconnected and write prompts manually.") from e

    handler = None
    if mmproj_path:
        handler = _vision_handler(model_path, mmproj_path)

    arch = gguf_architecture(model_path) if mmproj_path else ""
    label = arch or "gguf"
    errors = []
    for options in _load_attempts(n_ctx):
        ctx = options["n_ctx"]
        desc = f"n_ctx={ctx}" + (" kv=q8_0" if "type_k" in options else "")
        print(
            f"EM Subject Hot Swap LLM: loading {label} "
            f"({os.path.basename(model_path)}, {desc})",
            flush=True,
        )
        attempt_started = time.monotonic()
        log_diagnostic(
            diagnostics, diagnostic_id, "model.load.start",
            model=os.path.basename(model_path), mmproj=bool(mmproj_path),
            n_ctx=ctx, kv_type="q8_0" if "type_k" in options else "default",
            n_gpu_layers=n_gpu_layers,
        )
        try:
            llama = Llama(
                model_path=model_path,
                chat_handler=handler,
                n_gpu_layers=n_gpu_layers,
                verbose=False,
                **options,
            )
        except Exception as exc:
            errors.append(f"{desc}: {exc}")
            log_diagnostic(
                diagnostics, diagnostic_id, "model.load.error",
                model=os.path.basename(model_path), n_ctx=ctx,
                elapsed_s=f"{time.monotonic() - attempt_started:.2f}",
                error_type=type(exc).__name__, error=str(exc),
            )
            gc.collect()
            _free_comfy_models()
            continue
        if ctx != int(n_ctx):
            print(
                f"EM Subject Hot Swap LLM: loaded with {desc} "
                f"(requested n_ctx={n_ctx})",
                flush=True,
            )
        _CACHE.update({"key": key, "llama": llama, "handler": handler})
        log_diagnostic(
            diagnostics, diagnostic_id, "model.load.complete",
            model=os.path.basename(model_path), n_ctx=ctx,
            elapsed_s=f"{time.monotonic() - attempt_started:.2f}",
            n_gpu_layers=n_gpu_layers,
        )
        return llama

    raise LocalLLMError(
        f"Could not load {os.path.basename(model_path)} after trying smaller "
        "context settings. Lower n_ctx or use a smaller GGUF quant.\n"
        + "\n".join(errors)
    )


def chat_local(handle, messages, temperature=0.4, max_tokens=3072, seed=-1):
    """handle: dict from the loader node. messages: OpenAI-style messages
    (image_url data-URI parts supported when an mmproj is loaded)."""
    has_images = any(
        isinstance(m.get("content"), list)
        and any(p.get("type") == "image_url" for p in m["content"])
        for m in messages)
    if has_images and not handle.get("mmproj_path"):
        raise LocalLLMError(
            "This prompt includes reference images but the loaded GGUF has no "
            "mmproj (vision projector). Pick a VLM + its mmproj in the "
            "LLM (GGUF) - Loader.")

    diagnostics = bool(handle.get("diagnostics"))
    diagnostic_id = handle.get("diagnostic_id") or ""
    llama = _load(
        handle["model_path"], handle.get("mmproj_path"),
        handle.get("n_ctx", 16384), handle.get("n_gpu_layers", -1),
        diagnostics=diagnostics, diagnostic_id=diagnostic_id,
    )
    kwargs = {"messages": messages, "temperature": temperature,
              "max_tokens": max_tokens}
    if seed >= 0:
        kwargs["seed"] = seed
    inference_started = time.monotonic()
    log_diagnostic(
        diagnostics, diagnostic_id, "inference.start",
        model=os.path.basename(handle["model_path"]),
        max_tokens=max_tokens, has_images=has_images,
    )
    try:
        out = llama.create_chat_completion(**kwargs)
    except Exception as exc:
        log_diagnostic(
            diagnostics, diagnostic_id, "inference.error",
            elapsed_s=f"{time.monotonic() - inference_started:.2f}",
            error_type=type(exc).__name__, error=str(exc),
        )
        raise
    else:
        log_diagnostic(
            diagnostics, diagnostic_id, "inference.complete",
            elapsed_s=f"{time.monotonic() - inference_started:.2f}",
        )
    finally:
        handler = _CACHE["handler"]
        if not handle.get("keep_loaded", False):
            unload()
    content = out["choices"][0]["message"]["content"] or ""
    if not isinstance(content, str):
        content = str(content)
    return _clean_reply(content.strip(), handler)


def chat_http(handle, messages, temperature=0.4, max_tokens=3072, seed=-1):
    base_url = str(handle.get("base_url") or "").strip().rstrip("/")
    if not base_url.startswith(("http://", "https://")):
        raise LocalLLMError("HTTP LLM needs an http:// or https:// base URL.")
    body = {
        "model": str(handle.get("model") or "local"),
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    if seed >= 0:
        body["seed"] = seed
    headers = {"Content-Type": "application/json"}
    api_key = str(handle.get("api_key") or "none").strip()
    if api_key.lower() != "none":
        headers["Authorization"] = f"Bearer {api_key}"
    request = urllib.request.Request(
        base_url + "/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
    )
    diagnostics = bool(handle.get("diagnostics"))
    diagnostic_id = handle.get("diagnostic_id") or ""
    request_started = time.monotonic()
    log_diagnostic(
        diagnostics, diagnostic_id, "http_llm.start",
        model=body["model"], max_tokens=max_tokens,
    )
    try:
        with urllib.request.urlopen(request, timeout=600) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        log_diagnostic(
            diagnostics, diagnostic_id, "http_llm.error",
            elapsed_s=f"{time.monotonic() - request_started:.2f}",
            error_type=type(exc).__name__, error=str(exc),
        )
        raise LocalLLMError(f"HTTP LLM request failed: {exc}") from exc
    log_diagnostic(
        diagnostics, diagnostic_id, "http_llm.complete",
        elapsed_s=f"{time.monotonic() - request_started:.2f}",
    )
    try:
        content = payload["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError) as exc:
        raise LocalLLMError("HTTP LLM response did not contain choices[0].message.content.") from exc
    return content if isinstance(content, str) else str(content)


def chat(handle, messages, temperature=0.4, max_tokens=3072, seed=-1):
    """Dispatch a loader handle to its GGUF or OpenAI-compatible HTTP backend."""
    if str(handle.get("backend") or "gguf").lower() == "http":
        return chat_http(handle, messages, temperature, max_tokens, seed)
    return chat_local(handle, messages, temperature, max_tokens, seed)
