"""Read / write finished RefMods via the vendored RefMod library in this pack.

RefMod I/O is vendored in this pack. Files live under models/refmods/ in the
standard MiniMax-compatible format. The video model receives the stored latent
at the row strength; Describe/Draft use baked looks when the file has them.
"""

import importlib.util
import io
import os
import re

_HTC = None
CONCEPTS = ("identity", "wardrobe", "background")


def htc():
    """Load the bundled RefMod I/O module (vendored; optional HTC fallback)."""
    global _HTC
    if _HTC is not None:
        return _HTC
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(here, "htc_refmod.py"),
        os.path.join(
            os.path.dirname(os.path.dirname(here)),
            "ComfyUI-Hand-Tie-Clips",
            "refmod.py",
        ),
    ]
    path = next((p for p in candidates if os.path.isfile(p)), "")
    if not path:
        raise ValueError(
            "RefMod library missing (expected h3_subject_prompt/htc_refmod.py in this pack)."
        )
    spec = importlib.util.spec_from_file_location("h3_htc_refmod", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _HTC = module
    return module


def _concept_of(summary, meta):
    role = str((summary or {}).get("role") or meta.get("concept_type") or "identity").strip().lower()
    if role in ("person", "generic", ""):
        return "identity"
    if role in ("set", "clothing"):
        return "wardrobe"
    if role in ("place", "scene"):
        return "background"
    if role in CONCEPTS:
        return role
    return "identity"


def _stack_tag(meta, summary):
    """Short badge only — never the raw source_shape dump (1x32x32 + …)."""
    members = int(summary.get("members_count") or meta.get("members_count") or 0)
    if not members and isinstance(meta.get("members"), list):
        members = len([m for m in (meta.get("members") or []) if isinstance(m, dict) and m.get("kind") in ("image", "video")])
    t = int(meta.get("latent_t") or summary.get("latent_t") or 1)
    source = str(meta.get("source") or "").strip().lower()
    shape = str(meta.get("source_shape") or summary.get("source_shape") or "")
    # Count stills from a stacked shape string without showing the whole string.
    if "+" in shape:
        parts = [p for p in shape.replace(" ", "").split("+") if p]
        if len(parts) >= 2:
            return f"{len(parts)} img"
    if source == "stack" or members >= 2:
        count = members if members >= 2 else max(t, 2)
        return f"{count} img"
    if t > 1:
        return f"latent_t={t}"
    return "latent"


def _usable_description(text, name=""):
    """Drop boilerplate like 'RefMod dataset foo'; prefer a real caption."""
    raw = str(text or "").strip()
    low = raw.lower()
    if not raw:
        return ""
    if low in {"refmod", "refmod dataset", "dataset", "none", "n/a"}:
        return ""
    if low.startswith("refmod dataset") or low.startswith("refmod "):
        return ""
    return raw


def catalog_description(meta, name=""):
    module = htc()
    text = ""
    try:
        text = module.description_of(meta) if meta else ""
    except Exception:
        text = module._clean_desc_text((meta or {}).get("description") or "")
    return _usable_description(text, name)


def catalog_keep(meta):
    """Retention line stashed in the RefMod header (our custom field)."""
    if not isinstance(meta, dict):
        return ""
    text = str(meta.get("keep") or "").strip()
    if text:
        return text
    # Bundles may only carry it on a member.
    if meta.get("kind") == "bundle":
        for member in meta.get("members") or []:
            if not isinstance(member, dict):
                continue
            cand = str(member.get("keep") or "").strip()
            if cand:
                return cand
    return ""


def members_of(name):
    """Header only: kind and index for each visual member. No tensors."""
    module = htc()
    path = module.resolve(name)
    if not path:
        return []
    meta = module.read_meta(path) or {}
    if meta.get("kind") == "bundle":
        out = []
        for index, member in enumerate(meta.get("members") or []):
            if not isinstance(member, dict):
                continue
            kind = str(member.get("kind") or "")
            if kind not in ("image", "video"):
                continue
            out.append({
                "kind": kind,
                "index": index,
                "has_looks": bool(int(member.get("looks") or 0)),
            })
        return out
    if meta.get("kind") == "audio":
        return []
    kind = "video" if int(meta.get("latent_t") or 1) > 1 else "image"
    summary = module._meta_summary(meta, full=path)
    return [{"kind": kind, "index": 0, "has_looks": bool(summary.get("has_looks"))}]


def list_voices():
    """RefMods that already contain a voice latent."""
    module = htc()
    items = []
    seen = set()
    for root in module.roots():
        if not os.path.isdir(root):
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [name for name in dirnames if name not in module.SKIP_DIRS and not name.startswith(".")]
            for filename in filenames:
                if not filename.lower().endswith(".safetensors"):
                    continue
                full = os.path.join(dirpath, filename)
                rel = os.path.splitext(os.path.relpath(full, root))[0].replace("\\", "/")
                if rel in seen:
                    continue
                meta = module.read_meta(full) or {}
                summary = module._meta_summary(meta, full=full)
                if summary.get("kind") != "audio" and not summary.get("has_audio_latent"):
                    continue
                try:
                    mtime = os.path.getmtime(full)
                except OSError:
                    mtime = 0.0
                seen.add(rel)
                items.append({
                    "name": rel,
                    "description": module._clean_desc_text(meta.get("description") or ""),
                    "kind": summary.get("kind") or "audio",
                    "format": summary.get("format") or "",
                    "concept": "voice",
                    "mtime": mtime,
                })
    items.sort(key=lambda item: (-float(item.get("mtime") or 0), item["name"].lower()))
    return {"items": items}


def pair_voice_name(visual_name, voice_names=None):
    """Guess a split voice file from a visual RefMod name."""
    name = str(visual_name or "").strip().replace("\\", "/")
    if not name:
        return ""
    if voice_names is None:
        try:
            voice_names = {item["name"] for item in list_voices().get("items") or []}
        except Exception:
            voice_names = set()
    stem = re.sub(r"(_refmod)?_visual$", "", name, flags=re.I)
    stem = re.sub(r"_visual$", "", stem, flags=re.I)
    candidates = [
        stem + "_refmod_audio",
        stem + "_audio",
        re.sub(r"_visual\b", "_audio", name, flags=re.I),
    ]
    for candidate in candidates:
        if candidate in voice_names:
            return candidate
    return ""


def audio_block_for(name, strength=1.0):
    """The stored voice latent, ready for minimax_refs."""
    module = htc()
    loaded = module.load_audio_latent(name)
    if not loaded:
        raise ValueError(f"{name} has no stored voice latent.")
    block = module.audio_block(loaded, float(strength))
    if not block:
        raise ValueError(f"{name} has no stored voice latent.")
    return block


def list_catalog():
    """Visual RefMods for the picker. Voice files stay on the voice list.

    Newest files float first so a just-baked Create RefMod is findable without
    scrolling past a thousand minimaxh3_* names.
    """
    module = htc()
    try:
        voice_names = {item["name"] for item in list_voices().get("items") or []}
    except Exception:
        voice_names = set()
    items = []
    seen = set()
    for root in module.roots():
        if not os.path.isdir(root):
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [name for name in dirnames if name not in module.SKIP_DIRS and not name.startswith(".")]
            for filename in filenames:
                if not filename.lower().endswith(".safetensors"):
                    continue
                full = os.path.join(dirpath, filename)
                rel = os.path.splitext(os.path.relpath(full, root))[0].replace("\\", "/")
                if rel in seen:
                    continue
                meta = module.read_meta(full) or {}
                summary = module._meta_summary(meta, full=full)
                if summary.get("kind") == "audio":
                    continue
                concept = _concept_of(summary, meta)
                try:
                    mtime = os.path.getmtime(full)
                except OSError:
                    mtime = 0.0
                seen.add(rel)
                items.append({
                    "name": rel,
                    "concept": concept,
                    "kind": summary.get("kind") or "video",
                    "format": summary.get("format") or "",
                    "members": summary.get("members_count") or 1,
                    "tokens": summary.get("tokens") or 0,
                    "stack": _stack_tag(meta, summary),
                    "has_looks": bool(summary.get("has_looks")),
                    "has_preview": os.path.isfile(os.path.splitext(full)[0] + ".preview.jpg"),
                    "description": catalog_description(meta, rel),
                    "keep": catalog_keep(meta),
                    "has_audio_latent": bool(summary.get("has_audio_latent")),
                    "paired_voice": pair_voice_name(rel, voice_names),
                    "mtime": mtime,
                })
    items.sort(key=lambda item: (-float(item.get("mtime") or 0), item["name"].lower()))
    return {"items": items}


def _jpeg_bytes(frame):
    import numpy as np
    from PIL import Image

    array = frame.detach().cpu().numpy() if hasattr(frame, "detach") else frame
    if hasattr(array, "numpy"):
        array = array.numpy()
    array = np.asarray(array)
    if array.ndim == 3 and array.shape[0] in (1, 3) and array.shape[-1] not in (1, 3):
        array = np.transpose(array, (1, 2, 0))
    if array.dtype != np.uint8:
        array = array.astype("float32")
        if array.max() <= 1.5:
            array = array * 255.0
        array = array.clip(0, 255).astype(np.uint8)
    image = Image.fromarray(array).convert("RGB")
    if max(image.size) > 1024:
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=88)
    return buf.getvalue()


def _still_from_jpeg(raw):
    import numpy as np
    from PIL import Image
    import torch

    image = Image.open(io.BytesIO(raw)).convert("RGB")
    array = np.asarray(image).astype("float32") / 255.0
    return torch.from_numpy(array).unsqueeze(0)


def preview_file(name):
    try:
        module = htc()
        path = module.resolve(name)
    except (ValueError, OSError, RuntimeError, ModuleNotFoundError, ImportError):
        return None
    if not path:
        return None
    return os.path.splitext(path)[0] + ".preview.jpg"


def read_preview(name):
    path = preview_file(name)
    if not path or not os.path.isfile(path):
        return None
    with open(path, "rb") as handle:
        return handle.read()


def look_jpeg(name, index=0, frame=0, *, prefer_preview=True):
    """A picture from inside the RefMod (or the sidecar preview for member 0).

    Gallery mode prefers embedded looks so multi-member sheets stay honest, then
    falls back to the decoded per-token cache (older latent-only files, one
    picture per latent token) and finally ``.preview.jpg``.
    """
    try:
        member = int(index or 0)
        frame_i = max(0, int(frame or 0))
        if prefer_preview and member == 0 and frame_i == 0:
            saved = read_preview(name)
            if saved:
                return saved
        if member == 0:
            # Cheap path first: a decoded token still never needs the tensors.
            from .bake_previews import read_token_look
            cached = read_token_look(name, frame_i)
            if cached:
                return cached
        module = htc()
        for item in module.load_bundle_visuals(name):
            if int(item.get("member_index") or 0) != member:
                continue
            looks = item.get("looks")
            if looks is not None and int(getattr(looks, "shape", [0])[0] or 0) >= 1:
                last = int(looks.shape[0]) - 1
                pick = min(frame_i, last)
                return _jpeg_bytes(looks[pick])
            break
        # Latent-only / looks-less RefMod: still show the baked sidecar.
        if member == 0 and frame_i == 0:
            return read_preview(name)
    except (ValueError, OSError, RuntimeError, ModuleNotFoundError, ImportError):
        return None
    return None


def looks_gallery(name, *, decode=True):
    """Every stored still as {member, frame, label} for a contact-sheet UI.

    Older latent-only RefMods stack one picture per latent token; those are
    decoded once into the .h3looks cache (``decode=True``) so the gallery
    shows each of them like a v5 file's looks.
    """
    name = str(name or "").strip()
    if not name:
        return []
    out = []
    preview = read_preview(name)
    try:
        module = htc()
        visuals = list(module.load_bundle_visuals(name) or [])
    except (ValueError, OSError, RuntimeError, ModuleNotFoundError, ImportError):
        visuals = []
    if not visuals:
        # Header-only / unloadable: show the sidecar if we have one.
        if preview:
            out.append({
                "member": 0,
                "frame": 0,
                "label": "preview",
                "kind": "image",
            })
        return out
    for item in visuals:
        member = int(item.get("member_index") or 0)
        kind = str(item.get("kind") or "image")
        looks = item.get("looks")
        n = int(getattr(looks, "shape", [0])[0] or 0) if looks is not None else 0
        if n < 1:
            if member != 0:
                continue
            # Old v2/v4 with latent only — decode each token into its own still.
            from .bake_previews import ensure_token_looks
            info = ensure_token_looks(name, visuals=visuals, decode=decode)
            total = int(info.get("count") or 0)
            if total >= 1:
                for frame in range(total):
                    out.append({
                        "member": member,
                        "frame": frame,
                        "label": str(frame + 1) if total > 1 else "1",
                        "kind": "image",
                        "decoded": True,
                    })
                if info.get("note") and info.get("needs_vae"):
                    out[-1]["note"] = info["note"]
            elif preview:
                out.append({
                    "member": member,
                    "frame": 0,
                    "label": "preview",
                    "kind": kind,
                    "note": info.get("note") or "",
                })
            continue
        for frame in range(n):
            label = f"{member + 1}.{frame + 1}" if n > 1 else str(member + 1)
            out.append({
                "member": member,
                "frame": frame,
                "label": label,
                "kind": kind,
            })
    return out


def file_info(name):
    """Header fields for a picker row or Describe fallback."""
    fallback = {
        "name": name,
        "concept": "identity",
        "description": str(name or "").replace("_", " ").replace("/", " "),
        "keep": "",
        "stack": "",
        "format": "",
        "has_looks": False,
        "has_preview": False,
        "kind": "video",
        "has_audio_latent": False,
        "paired_voice": pair_voice_name(name),
    }
    try:
        module = htc()
        path = module.resolve(name)
    except (ValueError, OSError, RuntimeError, ModuleNotFoundError, ImportError):
        return fallback
    if not path:
        return None
    meta = module.read_meta(path) or {}
    summary = module._meta_summary(meta, full=path)
    return {
        "name": name,
        "concept": _concept_of(summary, meta),
        "description": catalog_description(meta, name),
        "keep": catalog_keep(meta),
        "stack": _stack_tag(meta, summary),
        "format": summary.get("format") or "",
        "has_looks": bool(summary.get("has_looks")),
        "has_preview": os.path.isfile(os.path.splitext(path)[0] + ".preview.jpg"),
        "kind": summary.get("kind") or "video",
        "has_audio_latent": bool(summary.get("has_audio_latent")),
        "paired_voice": pair_voice_name(name),
    }


def _patch_keep_fallback(module, name, keep):
    """Write keep when Hand-Tie-Clips update_meta is too old to accept it."""
    import json
    import tempfile

    from safetensors import safe_open
    from safetensors.torch import save_file

    path = module.resolve(name)
    if not path:
        raise ValueError(f"{name} not found.")
    meta_keys = (
        getattr(module, "META_KEY", "refmod_meta"),
        getattr(module, "AUDIO_META_KEY", "audio_refmod_meta"),
    ) + tuple(getattr(module, "REFLORA_META_KEYS", ("h3_refmod_meta", "minimax_h3_refmod_meta")))
    with safe_open(path, framework="pt", device="cpu") as fh:
        raw_hdr = dict(fh.metadata() or {})
        tensors = {key: fh.get_tensor(key).clone() for key in fh.keys()}
    meta_key = next((key for key in meta_keys if raw_hdr.get(key)), None)
    if meta_key is None:
        raise ValueError(f"{name} has no RefMod header.")
    meta = json.loads(raw_hdr[meta_key])
    if not isinstance(meta, dict):
        meta = {}
    text = str(keep or "").strip()
    if text:
        meta["keep"] = text
    else:
        meta.pop("keep", None)
    raw_hdr[meta_key] = json.dumps(meta)
    fd, temporary = tempfile.mkstemp(prefix=".refmod-", suffix=".tmp", dir=os.path.dirname(path) or ".")
    os.close(fd)
    try:
        save_file(tensors, temporary, metadata=raw_hdr)
        os.replace(temporary, path)
        invalidate = getattr(module, "_invalidate_header_cache", None)
        if callable(invalidate):
            invalidate(path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return meta


def save_description(name, description, concept=None, keep=None, voice=None):
    """Write who (+ optional keep) into the RefMod header.

    ``voice`` is ignored — character voice stays a separate RefMod pick
    (e.g. brandi_love_refmod_visual + brandi_love_refmod_audio), not baked in.
    """
    del voice  # kept for older API callers; never embed
    module = htc()
    path = module.resolve(name)
    if not path:
        raise ValueError(f"{name} not found.")
    text = str(description or "").strip()
    if not text:
        raise ValueError("Nothing to save — add a who line.")

    keep_text = None if keep is None else str(keep).strip()
    patch = {"description": text}
    if keep_text is not None:
        patch["keep"] = keep_text
    if concept:
        role = str(concept).strip().lower()
        if role in ("person",):
            role = "identity"
        elif role in ("set", "clothing"):
            role = "wardrobe"
        elif role in ("place", "scene"):
            role = "background"
        if role in ("identity", "wardrobe", "background", "generic", "style", "bodyshape", "helper", "pose_motion", "voice"):
            patch["concept_type"] = role
    meta = module.update_meta(name, patch)
    if keep_text is not None and catalog_keep(meta) != keep_text:
        meta = _patch_keep_fallback(module, name, keep_text)

    return {
        "name": name,
        "description": catalog_description(meta, name) or text,
        "keep": catalog_keep(meta) if keep_text is None else (catalog_keep(meta) or keep_text),
        "concept": _concept_of(module._meta_summary(meta, full=path), meta),
        "has_audio_latent": bool((module._meta_summary(meta, full=path) or {}).get("has_audio_latent")),
    }


def _still_from_member(item, name=None):
    """CLIP still(s) from a loaded visual member. Returns [T,H,W,C] float 0..1 or None."""
    looks = item.get("looks")
    if looks is not None and int(looks.shape[0]) > 0:
        frames = looks.detach().float().cpu()
        if float(frames.max()) > 1.5:
            frames = frames / 255.0
        return frames
    if name and int(item.get("member_index") or 0) == 0:
        saved = read_preview(name)
        if saved:
            return _still_from_jpeg(saved)
    return None


def load_visual(name, strength=1.0):
    """All visual members → DiT blocks + CLIP stills.

    Multi-still v5 bundles inject every member (not just the first). Strength
    applies per member. ``block`` / ``still`` remain the first member for
    older callers; prefer ``blocks`` / ``members``.
    """
    module = htc()
    loaded = module.load_bundle_visuals(name)
    if not loaded:
        raise ValueError(f"{name} has no visual latent.")

    blocks = []
    members = []
    for item in loaded:
        member_blocks = module.visual_blocks(item, float(strength))
        if not member_blocks:
            continue
        blocks.extend(member_blocks)
        kind = str(member_blocks[0].get("kind") or item.get("kind") or "image")
        members.append({
            "kind": kind,
            "still": _still_from_member(item, name),
            "member_index": int(item.get("member_index") or 0),
        })

    if not blocks:
        raise ValueError(f"{name} dropped at strength {strength}.")

    first = members[0]
    return {
        "kind": first["kind"],
        "block": blocks[0],
        "still": first["still"],
        "blocks": blocks,
        "members": members,
        "has_looks": any(m.get("still") is not None for m in members),
        "member_count": len(members),
    }


def push_visual_refs(ref_items, ref_blocks, loaded):
    """Append every member from ``load_visual`` into CLIP items + DiT blocks."""
    members = list(loaded.get("members") or [])
    if not members and loaded.get("block") is not None:
        members = [{"kind": loaded.get("kind") or "image", "still": loaded.get("still")}]

    any_looks = False
    for entry in members:
        still = entry.get("still")
        kind = str(entry.get("kind") or "image")
        if still is None:
            continue
        any_looks = True
        frames = still if still.ndim == 4 else still.unsqueeze(0)
        # Multi-frame → video for CLIP (tokenizer builds 2fps timestamps itself).
        # Single frame always as image — never pass timestamps=[0.0] alone.
        if int(frames.shape[0]) > 1:
            ref_items.append({"type": "video", "data": frames})
        else:
            ref_items.append({"type": "image", "data": frames[:1]})

    for block in loaded.get("blocks") or ([loaded["block"]] if loaded.get("block") is not None else []):
        ref_blocks.append(block)
    return any_looks
