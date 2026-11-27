"""Bake first-frame preview JPEGs beside RefMod files.

Same idea as Inspect H3 RefMod with visual_preview=first_frame: slice the
stored latent to T=1 and VAE-decode once, then write Name.preview.jpg.
The prompt node and picker only read that JPEG afterward — no live decode.
"""

from __future__ import annotations

import gc
import io
import os
import re
import shutil
import threading

from .refmods import htc, preview_file

# Per-token stills decoded out of latent-only RefMods live under
# <refmods root>/.h3looks/<relative name>/000.jpg … Dot-prefixed so every
# catalog walk and the folder picker skip it.
LOOKS_CACHE_DIR = ".h3looks"
_LOOKS_LOCK = threading.Lock()

# Last H3 video VAE seen by Bake or the prompt node. Lets on-pick ensure
# decode a first frame when the file has no stored looks.
_PREVIEW_VAE = None
# Last H3 audio VAE for in-panel Create (voice RefMods) outside a queued graph.
_AUDIO_VAE = None


def set_preview_vae(vae):
    """Remember a live H3 video VAE for on-pick preview baking."""
    global _PREVIEW_VAE
    if vae is not None:
        _PREVIEW_VAE = vae
    return _PREVIEW_VAE


def preview_vae():
    return _PREVIEW_VAE


def set_audio_vae(vae):
    """Remember a live H3 audio VAE for in-panel voice creates."""
    global _AUDIO_VAE
    if vae is not None:
        _AUDIO_VAE = vae
    return _AUDIO_VAE


def audio_vae():
    return _AUDIO_VAE


def _score_h3_video_vae_name(name: str) -> int | None:
    """Lower is better. Skip audio VAEs and unrelated checkpoints."""
    nl = str(name or "").lower().replace("\\", "/")
    if "audio" in nl:
        return None
    if "minimax" not in nl and "h3" not in nl:
        return None
    if "sol_vae" in nl and "fp16" in nl:
        return 0
    if "video" in nl and "fp16" in nl:
        return 1
    if "sol_vae" in nl:
        return 2
    if "video" in nl or "h3" in nl:
        return 3
    return None


def _score_h3_audio_vae_name(name: str) -> int | None:
    """Lower is better. Prefer MiniMax / H3 audio VAEs."""
    nl = str(name or "").lower().replace("\\", "/")
    if "audio" not in nl:
        return None
    if "minimax" not in nl and "h3" not in nl:
        return None
    if "fp16" in nl:
        return 0
    return 1


def _load_vae_by_score(score_fn, label: str):
    try:
        import folder_paths
        from nodes import VAELoader
    except Exception as exc:
        print(f"[H3BakePreviews] cannot import VAE loader: {exc!r}", flush=True)
        return None
    try:
        names = list(folder_paths.get_filename_list("vae") or [])
    except Exception as exc:
        print(f"[H3BakePreviews] cannot list VAEs: {exc!r}", flush=True)
        return None
    scored = []
    for name in names:
        score = score_fn(name)
        if score is not None:
            scored.append((score, name))
    if not scored:
        print(f"[H3BakePreviews] no MiniMax H3 {label} VAE found under models/vae", flush=True)
        return None
    scored.sort(key=lambda item: (item[0], item[1].lower()))
    pick = scored[0][1]
    try:
        loaded = VAELoader().load_vae(pick)
        vae = loaded[0] if isinstance(loaded, (tuple, list)) else loaded
    except Exception as exc:
        print(f"[H3BakePreviews] failed loading VAE {pick!r}: {exc!r}", flush=True)
        return None
    print(f"[H3BakePreviews] loaded {label} VAE: {pick}", flush=True)
    return vae


def load_preview_vae():
    """Cached VAE, or lazy-load the MiniMax H3 video VAE from models/vae.

    On-pick ensure_preview runs outside a queued node, so nothing had called
    set_preview_vae yet — that made 'VAE decode if needed' a no-op.
    """
    global _PREVIEW_VAE
    if _PREVIEW_VAE is not None:
        return _PREVIEW_VAE
    vae = _load_vae_by_score(_score_h3_video_vae_name, "video")
    if vae is None:
        return None
    return set_preview_vae(vae)


def load_audio_vae():
    """Cached audio VAE, or lazy-load MiniMax H3 audio VAE from models/vae."""
    global _AUDIO_VAE
    if _AUDIO_VAE is not None:
        return _AUDIO_VAE
    vae = _load_vae_by_score(_score_h3_audio_vae_name, "audio")
    if vae is None:
        return None
    return set_audio_vae(vae)


def _jpeg_from_rgb(frame, max_edge=768, quality=88):
    """frame: float [H,W,3] in 0..1 or 0..255, or uint8 [H,W,3].

    Looks tensors are often float 0..255. Clipping those to 0..1 before
    scaling whites out the face — detect the range first.
    """
    import numpy as np
    from PIL import Image

    if hasattr(frame, "detach"):
        array = frame.detach().float().cpu().numpy()
    else:
        array = np.asarray(frame)
    if array.ndim != 3 or array.shape[-1] != 3:
        raise ValueError(f"Expected HxWx3 preview frame, got {getattr(array, 'shape', None)}")
    if array.dtype != np.uint8:
        array = array.astype("float32")
        if float(array.max()) > 1.5:
            array = array.clip(0, 255).astype("uint8")
        else:
            array = (array.clip(0, 1) * 255.0).astype("uint8")
    image = Image.fromarray(array, mode="RGB")
    if max(image.size) > max_edge:
        image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def _write_preview(name, jpeg_bytes):
    path = preview_file(name)
    if not path:
        raise ValueError(f"{name}: cannot resolve RefMod path for preview.")
    tmp = path + ".tmp"
    with open(tmp, "wb") as handle:
        handle.write(jpeg_bytes)
    os.replace(tmp, path)
    return path


def preview_from_looks(name):
    """If the file already stores looks, bake a sidecar without the VAE."""
    module = htc()
    for item in module.load_bundle_visuals(name):
        looks = item.get("looks")
        if looks is None or int(getattr(looks, "shape", [0])[0] or 0) < 1:
            continue
        return _write_preview(name, _jpeg_from_rgb(looks[0]))
    return None


def ensure_preview(name, vae=None):
    """Write .preview.jpg when the sidecar is missing.

    Order: existing → stored looks → VAE first-frame decode (arg or cached).
    """
    from .refmods import read_preview

    label = str(name or "").strip()
    if not label:
        return {"name": "", "has_preview": False, "source": "none", "note": "No RefMod name."}
    if read_preview(label):
        return {"name": label, "has_preview": True, "source": "existing"}
    path = preview_from_looks(label)
    if path:
        return {"name": label, "has_preview": True, "source": "looks"}
    decoder = vae if vae is not None else load_preview_vae()
    if decoder is None:
        return {
            "name": label,
            "has_preview": False,
            "source": "none",
            "needs_vae": True,
            "note": "No looks and no H3 video VAE under models/vae. Install one or run H3 Bake RefMod Previews with a VAE wired.",
        }
    try:
        preview_from_vae(label, decoder)
    except Exception as exc:
        return {
            "name": label,
            "has_preview": False,
            "source": "none",
            "needs_vae": True,
            "note": str(exc),
        }
    return {"name": label, "has_preview": True, "source": "vae"}


def preview_from_vae(name, vae):
    """Inspect-style first latent frame → JPEG sidecar."""
    if vae is None:
        raise ValueError("Connect the MiniMax H3 video VAE.")
    module = htc()
    loaded = module.load_bundle_visuals(name)
    if not loaded:
        raise ValueError(f"{name} has no visual latent.")
    latent = loaded[0].get("latent")
    if latent is None:
        raise ValueError(f"{name} has no visual latent tensor.")
    # Match Inspect: one temporal token only.
    z = latent
    if z.ndim == 5 and z.shape[2] > 1:
        z = z[:, :, :1].contiguous()
    elif z.ndim != 5:
        raise ValueError(f"{name} latent shape {tuple(z.shape)} is not [1,24,T,H,W].")

    import torch

    # Same contract as MiniMaxH3RefModInspect: decode the sliced latent, then
    # normalize to an IMAGE batch [T,H,W,3] / [B,H,W,3].
    with torch.inference_mode():
        pixels = vae.decode(z)
    del z
    if pixels.ndim == 5 and pixels.shape[0] == 1:
        pixels = pixels[0]
    if pixels.ndim != 4 or pixels.shape[-1] != 3:
        raise ValueError(f"{name}: expected H3 decoded RGB frames, got {tuple(pixels.shape)}.")
    frame = pixels[0].float().clamp(0, 1)
    jpeg = _jpeg_from_rgb(frame)
    del pixels, frame
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    return _write_preview(name, jpeg)


# --- per-token stills for latent-only RefMods -------------------------------
#
# Older (v4) RefMods carry no looks: they are one [1,24,T,H,W] latent where
# each temporal token is a separate source picture stacked along T
# (stack_latents). Decoding the whole latent as a clip smears neighbours
# together, but slicing one token (T=1) and decoding it alone hands back the
# original still cleanly. Cache those JPEGs once; the Looks gallery, thumbs
# and Describe only read the cache afterwards.


def _root_of(path):
    module = htc()
    real = os.path.realpath(path)
    for root in module.roots():
        try:
            root_real = os.path.realpath(root)
            if os.path.commonpath([root_real, real]) == root_real:
                return root
        except ValueError:
            continue
    return os.path.dirname(path)


def token_looks_dir(name, path=None):
    """Cache folder for decoded per-token stills, or None if unresolvable."""
    if path is None:
        try:
            path = htc().resolve(name)
        except (ValueError, OSError, RuntimeError, ModuleNotFoundError, ImportError):
            return None
    if not path:
        return None
    root = _root_of(path)
    rel = os.path.splitext(os.path.relpath(path, root))[0]
    return os.path.join(root, LOOKS_CACHE_DIR, rel)


def token_look_path(name, frame, path=None):
    folder = token_looks_dir(name, path=path)
    if not folder:
        return None
    return os.path.join(folder, f"{max(0, int(frame or 0)):03d}.jpg")


def cached_token_looks(name, path=None):
    """Sorted frame indices already decoded for this RefMod."""
    folder = token_looks_dir(name, path=path)
    if not folder or not os.path.isdir(folder):
        return []
    out = []
    for entry in os.listdir(folder):
        match = re.fullmatch(r"(\d{3})\.jpg", entry)
        if match:
            out.append(int(match.group(1)))
    return sorted(out)


def read_token_look(name, frame):
    target = token_look_path(name, frame)
    if not target or not os.path.isfile(target):
        return None
    with open(target, "rb") as handle:
        return handle.read()


def drop_token_looks(name, path=None):
    """Remove the decoded cache (delete / move hooks)."""
    folder = token_looks_dir(name, path=path)
    if folder and os.path.isdir(folder):
        shutil.rmtree(folder, ignore_errors=True)
        return True
    return False


def move_token_looks(old_path, new_path):
    """Carry the decoded cache along when a RefMod moves folders."""
    src = token_looks_dir(None, path=old_path)
    dst = token_looks_dir(None, path=new_path)
    if not src or not dst or not os.path.isdir(src) or os.path.exists(dst):
        return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.move(src, dst)
    return True


def cover_file(name, path=None):
    folder = token_looks_dir(name, path=path)
    return os.path.join(folder, "cover.json") if folder else None


def read_cover(name):
    """Which look is the cover (= .preview.jpg = what Describe sees).

    Defaults to member 0 / frame 0, which is what every baker writes.
    """
    import json

    out = {"member": 0, "frame": 0, "explicit": False}
    target = cover_file(name)
    if not target or not os.path.isfile(target):
        return out
    try:
        with open(target, "r", encoding="utf-8") as handle:
            data = json.load(handle) or {}
        out["member"] = max(0, int(data.get("member") or 0))
        out["frame"] = max(0, int(data.get("frame") or 0))
        out["explicit"] = True
    except (OSError, ValueError, TypeError):
        pass
    return out


def set_cover(name, member=0, frame=0):
    """Make one stored look the cover: rewrite Name.preview.jpg from it.

    The picker card, the row thumb, Describe and the CLIP still of a
    latent-only file all read that sidecar, so this is the one switch.
    """
    import json

    from .refmods import look_jpeg

    label = str(name or "").strip()
    if not label:
        raise ValueError("No RefMod name.")
    member_i = max(0, int(member or 0))
    frame_i = max(0, int(frame or 0))
    raw = look_jpeg(label, member_i, frame_i, prefer_preview=False)
    if not raw:
        raise ValueError(f"{label}: no picture at member {member_i + 1}, frame {frame_i + 1}.")
    _write_preview(label, raw)
    target = cover_file(label)
    if target:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        tmp = target + ".tmp"
        with open(tmp, "w", encoding="utf-8") as handle:
            json.dump({"member": member_i, "frame": frame_i}, handle)
        os.replace(tmp, target)
    return {"name": label, "member": member_i, "frame": frame_i, "has_preview": True}


def latent_tokens(path):
    """Temporal tokens of a classic single-latent RefMod from the header only."""
    try:
        from safetensors import safe_open
        with safe_open(path, framework="pt") as handle:
            keys = list(handle.keys())
            if "latent" not in keys:
                return 0
            shape = tuple(handle.get_slice("latent").get_shape())
    except Exception:
        return 0
    return int(shape[2]) if len(shape) == 5 else 0


def ensure_token_looks(name, vae=None, *, visuals=None, decode=True):
    """Decode every token of a looks-less RefMod into the .h3looks cache.

    Returns {"count", "baked", "source", ...}. ``count`` is the number of
    pictures the gallery can show (0 when the file stores looks itself, is
    audio, or has no latent). With ``decode=False`` only reports the cache.
    """
    label = str(name or "").strip()
    if not label:
        return {"count": 0, "baked": 0, "source": "none", "note": "No RefMod name."}
    module = htc()
    try:
        path = module.resolve(label)
    except (ValueError, OSError, RuntimeError, ModuleNotFoundError, ImportError) as exc:
        return {"count": 0, "baked": 0, "source": "none", "note": str(exc)}
    if not path:
        return {"count": 0, "baked": 0, "source": "none", "note": f"{label} not found."}

    total = latent_tokens(path)
    if total < 1:
        return {"count": 0, "baked": 0, "source": "none", "note": "Not a single-latent RefMod."}
    cached = set(cached_token_looks(label, path=path))
    missing = [t for t in range(total) if t not in cached]
    if not missing:
        return {"count": total, "baked": 0, "source": "cache"}
    if not decode:
        return {"count": total, "baked": 0, "missing": len(missing), "source": "none"}

    try:
        if visuals is None:
            visuals = module.load_bundle_visuals(label)
    except Exception as exc:
        return {"count": 0, "baked": 0, "source": "none", "note": str(exc)}
    item = next((v for v in visuals or [] if int(v.get("member_index") or 0) == 0), None)
    if item is None:
        return {"count": 0, "baked": 0, "source": "none", "note": f"{label} has no visual member."}
    looks = item.get("looks")
    if looks is not None and int(getattr(looks, "shape", [0])[0] or 0) >= 1:
        # Stored looks win; nothing to decode.
        return {"count": 0, "baked": 0, "source": "looks"}
    latent = item.get("latent")
    if latent is None or latent.ndim != 5:
        return {"count": 0, "baked": 0, "source": "none", "note": f"{label} has no [1,24,T,H,W] latent."}
    total = int(latent.shape[2])

    decoder = vae if vae is not None else load_preview_vae()
    if decoder is None:
        return {
            "count": len(cached),
            "baked": 0,
            "source": "none",
            "needs_vae": True,
            "note": "No H3 video VAE under models/vae. Wire one into H3 Bake RefMod Previews.",
        }

    import torch

    folder = token_looks_dir(label, path=path)
    baked = 0
    with _LOOKS_LOCK:
        os.makedirs(folder, exist_ok=True)
        for t in range(total):
            target = os.path.join(folder, f"{t:03d}.jpg")
            if os.path.isfile(target):
                continue
            z = latent[:, :, t:t + 1].contiguous()
            with torch.inference_mode():
                pixels = decoder.decode(z)
            if pixels.ndim == 5 and pixels.shape[0] == 1:
                pixels = pixels[0]
            if pixels.ndim != 4 or pixels.shape[-1] != 3:
                raise ValueError(f"{label}: expected H3 decoded RGB frames, got {tuple(pixels.shape)}.")
            frame = pixels[0].float().clamp(0, 1)
            jpeg = _jpeg_from_rgb(frame)
            tmp = target + ".tmp"
            with open(tmp, "wb") as handle:
                handle.write(jpeg)
            os.replace(tmp, target)
            baked += 1
            del z, pixels, frame
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    # Keep the picker sidecar in step with token 0.
    first = os.path.join(folder, "000.jpg")
    sidecar = preview_file(label)
    if sidecar and not os.path.isfile(sidecar) and os.path.isfile(first):
        shutil.copyfile(first, sidecar)
    return {"count": total, "baked": baked, "source": "vae"}


def list_bake_targets(missing_only=True, name_filter="", all_looks=False):
    """Visual RefMods that need (or can refresh) a .preview.jpg.

    With ``all_looks`` a latent-only file also counts as missing while its
    per-token .h3looks cache is incomplete.
    """
    module = htc()
    needle = str(name_filter or "").strip().lower()
    targets = []
    for root in module.roots():
        if not os.path.isdir(root):
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [n for n in dirnames if n not in module.SKIP_DIRS and not n.startswith(".")]
            for filename in filenames:
                if not filename.lower().endswith(".safetensors"):
                    continue
                full = os.path.join(dirpath, filename)
                rel = os.path.splitext(os.path.relpath(full, root))[0].replace("\\", "/")
                if needle and needle not in rel.lower():
                    continue
                meta = module.read_meta(full) or {}
                summary = module._meta_summary(meta, full=full)
                if summary.get("kind") == "audio":
                    continue
                preview = os.path.splitext(full)[0] + ".preview.jpg"
                has_preview = os.path.isfile(preview)
                has_looks = bool(summary.get("has_looks"))
                tokens = 0
                looks_done = True
                if all_looks and not has_looks:
                    tokens = latent_tokens(full)
                    if tokens > 0:
                        looks_done = len(cached_token_looks(rel, path=full)) >= tokens
                if missing_only and has_preview and looks_done:
                    continue
                targets.append({
                    "name": rel,
                    "path": full,
                    "has_preview": has_preview,
                    "has_looks": has_looks,
                    "tokens": tokens,
                    "looks_done": looks_done,
                })
    targets.sort(key=lambda item: item["name"].lower())
    return targets


def bake_previews(vae=None, missing_only=True, name_filter="", limit=0, prefer_looks=True, all_looks=False):
    """Bake preview sidecars. Returns (report_text, last_image_or_none, stats)."""
    import torch

    targets = list_bake_targets(missing_only=missing_only, name_filter=name_filter, all_looks=all_looks)
    if limit and limit > 0:
        targets = targets[: int(limit)]

    wrote = []
    skipped = []
    errors = []
    decoded = 0
    last_image = None

    for item in targets:
        name = item["name"]
        try:
            path = None
            if missing_only and item.get("has_preview"):
                # Only here for the per-token cache; the sidecar already exists.
                path = preview_file(name)
            else:
                if prefer_looks and item.get("has_looks"):
                    path = preview_from_looks(name)
                if path is None:
                    if vae is None:
                        skipped.append(f"{name}: no looks and no VAE")
                        continue
                    path = preview_from_vae(name, vae)
            if all_looks and not item.get("has_looks") and not item.get("looks_done", True):
                info = ensure_token_looks(name, vae)
                decoded += int(info.get("baked") or 0)
            wrote.append(name)
            # Tiny IMAGE batch for the last success (Comfy preview).
            from PIL import Image
            import numpy as np
            with Image.open(path) as image:
                rgb = image.convert("RGB")
                array = np.asarray(rgb).astype("float32") / 255.0
            last_image = torch.from_numpy(array).unsqueeze(0)
        except Exception as exc:
            errors.append(f"{name}: {exc}")
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

    lines = [
        f"targets={len(targets)} wrote={len(wrote)} skipped={len(skipped)} errors={len(errors)}"
        + (f" looks_decoded={decoded}" if all_looks else ""),
    ]
    if wrote:
        lines.append("wrote:")
        lines.extend(f"  {name}" for name in wrote[:40])
        if len(wrote) > 40:
            lines.append(f"  … +{len(wrote) - 40} more")
    if skipped:
        lines.append("skipped:")
        lines.extend(f"  {name}" for name in skipped[:20])
    if errors:
        lines.append("errors:")
        lines.extend(f"  {err}" for err in errors[:20])
        if len(errors) > 20:
            lines.append(f"  … +{len(errors) - 20} more")
    stats = {
        "targets": len(targets),
        "wrote": len(wrote),
        "skipped": len(skipped),
        "errors": len(errors),
        "names": wrote,
        "looks_decoded": decoded,
    }
    return "\n".join(lines), last_image, stats
