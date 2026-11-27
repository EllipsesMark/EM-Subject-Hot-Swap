"""EM Subject Hot Swap's H3-compatible GGUF/HTTP handle node, adapted from EllipsesMark's LLM node.

The original EllipsesMark node emits ELLIPSESMARK_LLM, which cannot connect to
Hot Swap's H3_LLM socket. This node preserves the useful GGUF/HTTP settings
while returning the type Hot Swap and its internal writers expect.
"""

from __future__ import annotations

import os

try:
    import folder_paths
    _MODELS_DIR = folder_paths.models_dir
except ImportError:
    _MODELS_DIR = None


def _gguf_files():
    """Scan ComfyUI models/llm_gguf and models/LLM recursively."""
    models, mmprojs = [], []
    if _MODELS_DIR:
        for sub in ("llm_gguf", "LLM"):
            root = os.path.join(_MODELS_DIR, sub)
            if not os.path.isdir(root):
                continue
            for dirpath, _, files in os.walk(root):
                for name in sorted(files):
                    if not name.lower().endswith(".gguf"):
                        continue
                    rel = os.path.relpath(os.path.join(dirpath, name), _MODELS_DIR)
                    (mmprojs if "mmproj" in name.lower() else models).append(rel)
    return (
        models or ["(no gguf found in models/llm_gguf or models/LLM)"],
        ["none"] + mmprojs,
    )


class H3PromptLLMLoader:
    """Configure a local GGUF or an OpenAI-compatible chat-completions API."""

    CATEGORY = "EM Subject Hot Swap"
    FUNCTION = "configure"
    RETURN_TYPES = ("H3_LLM",)
    RETURN_NAMES = ("llm",)
    DESCRIPTION = (
        "Choose a local GGUF (with matching mmproj for vision) or an "
        "OpenAI-compatible HTTP chat server for EM Subject Hot Swap Describe/Draft."
    )

    @classmethod
    def INPUT_TYPES(cls):
        models, mmprojs = _gguf_files()
        return {
            "required": {
                "backend": (["GGUF", "HTTP"], {"default": "GGUF"}),
                "model_name": (models,),
                "mmproj_name": (mmprojs, {
                    "tooltip": "For GGUF vision, choose the projector that matches "
                    "the model. 'none' is text-only. HTTP servers handle their own projector.",
                }),
                "n_ctx": ("INT", {
                    "default": 16384, "min": 4096, "max": 131072, "step": 1024,
                    "tooltip": "GGUF context size. The loader retries smaller contexts if allocation fails.",
                }),
                "n_gpu_layers": ("INT", {
                    "default": -1, "min": -1, "max": 999,
                    "tooltip": "GGUF only: -1 = all layers on GPU, 0 = CPU, intermediate = partial offload.",
                }),
                "keep_loaded": ("BOOLEAN", {
                    "default": False,
                    "tooltip": "GGUF only. Off frees the model after each request so H3 can use VRAM.",
                }),
                "base_url": ("STRING", {
                    "default": "http://localhost:1234/v1",
                    "tooltip": "HTTP only: OpenAI-compatible API base URL.",
                }),
                "model": ("STRING", {
                    "default": "local",
                    "tooltip": "HTTP only: model id expected by the server.",
                }),
                "api_key": ("STRING", {
                    "default": "none", "password": True,
                    "tooltip": "HTTP only. Use 'none' for local servers. This value is saved in workflows.",
                }),
                "diagnostics": ("BOOLEAN", {
                    "default": False,
                    "tooltip": "Write opt-in Draft/Describe diagnostics to ComfyUI/user/hot_swap_diagnostics.log.",
                }),
            },
        }

    def configure(
        self, backend, model_name, mmproj_name, n_ctx, n_gpu_layers,
        keep_loaded, base_url, model, api_key, diagnostics,
    ):
        backend = str(backend or "GGUF").strip().lower()
        if backend == "http":
            base_url = str(base_url or "").strip().rstrip("/")
            if not base_url.startswith(("http://", "https://")):
                raise ValueError("HTTP backend needs an http:// or https:// base URL.")
            return ({
                "backend": "http",
                "base_url": base_url,
                "model": str(model or "local").strip() or "local",
                "api_key": str(api_key or "none").strip() or "none",
                "keep_loaded": False,
                "model_name": "",
                "mmproj_name": "none",
                "model_path": None,
                "mmproj_path": None,
                "diagnostics": bool(diagnostics),
            },)

        if backend != "gguf":
            raise ValueError(f"Unsupported LLM backend: {backend}")
        if _MODELS_DIR is None:
            raise RuntimeError("ComfyUI folder_paths unavailable.")
        model_name = str(model_name or "").strip()
        if not model_name or model_name.startswith("("):
            raise FileNotFoundError(
                "No GGUF found. Put a chat/instruct GGUF under "
                "ComfyUI/models/llm_gguf or ComfyUI/models/LLM, then restart."
            )
        model_path = os.path.realpath(os.path.join(_MODELS_DIR, model_name))
        models_root = os.path.realpath(_MODELS_DIR)
        try:
            model_is_inside = os.path.commonpath([models_root, model_path]) == models_root
        except ValueError:
            model_is_inside = False
        if not model_is_inside or not os.path.isfile(model_path):
            raise FileNotFoundError(f"GGUF not found under ComfyUI/models: {model_name}")

        mmproj_name = str(mmproj_name or "none").strip()
        mmproj_path = None
        if mmproj_name != "none":
            mmproj_path = os.path.realpath(os.path.join(_MODELS_DIR, mmproj_name))
            try:
                mmproj_is_inside = os.path.commonpath([models_root, mmproj_path]) == models_root
            except ValueError:
                mmproj_is_inside = False
            if not mmproj_is_inside or not os.path.isfile(mmproj_path):
                raise FileNotFoundError(f"mmproj not found under ComfyUI/models: {mmproj_name}")
        return ({
            "backend": "gguf",
            "model_name": model_name,
            "mmproj_name": mmproj_name,
            "model_path": model_path,
            "mmproj_path": mmproj_path,
            "n_ctx": int(n_ctx),
            "n_gpu_layers": int(n_gpu_layers),
            "keep_loaded": bool(keep_loaded),
            "diagnostics": bool(diagnostics),
        },)


NODE_CLASS_MAPPINGS = {
    "H3PromptLLMLoader": H3PromptLLMLoader,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "H3PromptLLMLoader": "LLM (GGUF) - Loader",
}
