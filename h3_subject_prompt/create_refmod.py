"""One-shot RefMod create: images / folder / path list + optional audio.

Encodes through the pack's vendored RefMod library (looks + v5 bundle when
multi-still or audio). Replaces the FolderLoader → Create Master → Save chain.
"""

from __future__ import annotations

import gc
import os
import re

from .refmods import htc

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v"}
TAG = "H3CreateRefMod"

# Defaults for identity still packs (H3 encodes up to ~2K). Callers may override.
QUALITY = {
    "step_curve": "full",
    "layout": "separate_pictures",
    "pack": "single",
    "fit_mode": "crop",
    "short_edge": 2048,
    "max_edge": 2048,
    "max_items": 32,
    "max_frames": 48,
    "max_tokens": 0,
    "recursive": False,
    "save": True,
}

# Choices exposed in Create UI / API (values match create_refmod kwargs).
ENCODE_CHOICES = {
    "layout": [
        ("separate_pictures", "Separate stills — each photo is its own member (Inspect shows one at a time)"),
        ("stacked_video", "Stacked video — all photos on one time axis (Inspect-as-video shows them all)"),
    ],
    "pack": [
        ("single", "One RefMod file"),
        ("per_file", "One RefMod per media file"),
    ],
    "fit_mode": [
        ("crop", "Crop — fill canvas, center crop"),
        ("pad", "Pad — fit inside, letterbox"),
        ("stretch", "Stretch — force canvas size"),
    ],
    "step_curve": [
        ("full", "full"),
        ("early_lock", "early_lock"),
        ("late_detail", "late_detail"),
        ("fade", "fade"),
        ("mid_peak", "mid_peak"),
    ],
}


def encode_settings_from(data=None, **overrides):
    """Merge QUALITY defaults with a payload / kwargs. Unknown keys ignored."""
    out = dict(QUALITY)
    src = {}
    if isinstance(data, dict):
        src.update(data)
    src.update(overrides)

    def _pick(key, *aliases):
        for name in (key, *aliases):
            if name in src and src[name] is not None and str(src[name]).strip() != "":
                return src[name]
        return None

    layout = _pick("layout")
    if layout is not None:
        layout = str(layout).strip().lower()
        if layout in ("separate", "separate_pictures", "pictures"):
            out["layout"] = "separate_pictures"
        elif layout in ("stack", "stacked", "stacked_video", "video"):
            out["layout"] = "stacked_video"
        else:
            out["layout"] = str(QUALITY["layout"])

    pack = _pick("pack")
    if pack is not None:
        pack = str(pack).strip().lower()
        out["pack"] = pack if pack in ("single", "per_file") else QUALITY["pack"]

    fit = _pick("fit_mode", "fit")
    if fit is not None:
        fit = str(fit).strip().lower()
        out["fit_mode"] = fit if fit in ("crop", "pad", "stretch") else QUALITY["fit_mode"]

    curve = _pick("step_curve")
    if curve is not None:
        curve = str(curve).strip().lower()
        allowed = {c[0] for c in ENCODE_CHOICES["step_curve"]}
        out["step_curve"] = curve if curve in allowed else QUALITY["step_curve"]

    for key, cast, lo, hi in (
        ("short_edge", int, 256, 2048),
        ("max_edge", int, 256, 4096),
        ("max_items", int, 1, 256),
        ("max_frames", int, 2, 4800),
        ("max_tokens", int, 0, 2147483647),
    ):
        raw = _pick(key)
        if raw is None:
            continue
        try:
            value = cast(raw)
        except (TypeError, ValueError):
            continue
        out[key] = max(lo, min(hi, value))

    recursive = _pick("recursive")
    if recursive is not None:
        if isinstance(recursive, str):
            out["recursive"] = recursive.strip().lower() in ("1", "true", "yes", "on")
        else:
            out["recursive"] = bool(recursive)

    save = _pick("save")
    if save is not None:
        if isinstance(save, str):
            out["save"] = save.strip().lower() not in ("0", "false", "no", "off")
        else:
            out["save"] = bool(save)

    return out


def encode_options_payload():
    """JSON for the Create dialog: defaults + labeled choices."""
    return {
        "defaults": dict(QUALITY),
        "choices": {
            key: [{"value": v, "label": label} for v, label in pairs]
            for key, pairs in ENCODE_CHOICES.items()
        },
    }


def _preview_image(looks):
    """Comfy IMAGE in 0..1 from looks (uint8 or float 0..255 / 0..1)."""
    import torch

    if looks is None or int(looks.shape[0]) < 1:
        return torch.zeros(1, 64, 64, 3)
    frame = looks[:1]
    if frame.dtype == torch.uint8:
        return frame.float() / 255.0
    frame = frame.float()
    if float(frame.max()) > 1.5:
        return (frame / 255.0).clamp(0, 1)
    return frame.clamp(0, 1)


def _input_root():
    try:
        import folder_paths
        return folder_paths.get_input_directory()
    except Exception:
        return ""


def resolve_path(raw):
    """Absolute file/folder, or a path under ComfyUI's input/ directory."""
    text = str(raw or "").strip().strip('"').strip("'")
    if not text:
        raise ValueError(f"{TAG}: empty path")
    if os.path.isabs(text) and (os.path.isfile(text) or os.path.isdir(text)):
        return os.path.normpath(text)
    root = _input_root()
    if root:
        joined = os.path.normpath(os.path.join(root, text.replace("/", os.sep)))
        if os.path.isfile(joined) or os.path.isdir(joined):
            return joined
    if os.path.isfile(text) or os.path.isdir(text):
        return os.path.normpath(os.path.abspath(text))
    raise ValueError(f"{TAG}: path not found: {text}")


def list_media(folder, *, recursive=False, max_items=64):
    """(images, videos) under folder, sorted by name."""
    images, videos = [], []
    folder = os.path.normpath(folder)
    if recursive:
        for root, _dirs, files in os.walk(folder):
            for name in sorted(files):
                path = os.path.join(root, name)
                ext = os.path.splitext(name)[1].lower()
                if ext in IMAGE_EXTS:
                    images.append(path)
                elif ext in VIDEO_EXTS:
                    videos.append(path)
    else:
        for name in sorted(os.listdir(folder)):
            path = os.path.join(folder, name)
            if not os.path.isfile(path):
                continue
            ext = os.path.splitext(name)[1].lower()
            if ext in IMAGE_EXTS:
                images.append(path)
            elif ext in VIDEO_EXTS:
                videos.append(path)
    items = images + videos
    return items[: max(1, int(max_items or 64))]


def parse_paths_text(text):
    """One path per line; blank lines and # comments ignored."""
    out = []
    for line in str(text or "").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        out.append(line)
    return out


def collect_disk_sources(folder="", paths_text="", *, recursive=False, max_items=64):
    """Ordered list of media file paths from folder + multiline paths."""
    found = []
    seen = set()

    def _add(path):
        key = os.path.normcase(os.path.abspath(path))
        if key in seen:
            return
        seen.add(key)
        found.append(path)

    for raw in parse_paths_text(paths_text):
        resolved = resolve_path(raw)
        if os.path.isdir(resolved):
            for path in list_media(resolved, recursive=recursive, max_items=max_items):
                _add(path)
                if len(found) >= max_items:
                    return found
        else:
            ext = os.path.splitext(resolved)[1].lower()
            if ext not in IMAGE_EXTS and ext not in VIDEO_EXTS:
                raise ValueError(f"{TAG}: not an image/video: {resolved}")
            _add(resolved)
            if len(found) >= max_items:
                return found

    folder = str(folder or "").strip()
    if folder:
        resolved = resolve_path(folder)
        if not os.path.isdir(resolved):
            raise ValueError(f"{TAG}: folder is not a directory: {resolved}")
        for path in list_media(resolved, recursive=recursive, max_items=max_items):
            _add(path)
            if len(found) >= max_items:
                break
    return found


def load_rgb(path, max_edge=1536):
    import numpy as np
    import torch
    from PIL import Image

    image = Image.open(path).convert("RGB")
    width, height = image.size
    long_edge = max(width, height)
    if max_edge and long_edge > max_edge:
        scale = max_edge / float(long_edge)
        image = image.resize(
            (max(1, int(width * scale)), max(1, int(height * scale))),
            Image.Resampling.LANCZOS,
        )
    array = np.asarray(image).astype("float32") / 255.0
    return torch.from_numpy(array).unsqueeze(0)


def load_video(path, max_frames=48, max_edge=1536):
    """Prefer MiniMaxH3Mod loader when present; else OpenCV / imageio."""
    try:
        from MiniMaxH3Mod.common import load_video_file  # type: ignore
        return load_video_file(path, max_frames=max_frames, max_edge=max_edge)
    except Exception:
        pass
    try:
        import sys
        import importlib.util
        # ComfyUI-MiniMaxH3Mod package folder name varies
        for name in ("ComfyUI-MiniMaxH3Mod", "MiniMaxH3Mod"):
            root = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                name,
            )
            common = os.path.join(root, "common.py")
            if os.path.isfile(common):
                spec = importlib.util.spec_from_file_location("h3_minmax_common", common)
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                return mod.load_video_file(path, max_frames=max_frames, max_edge=max_edge)
    except Exception:
        pass

    import numpy as np
    import torch
    from PIL import Image

    frames = []
    try:
        import cv2
        cap = cv2.VideoCapture(path)
        try:
            total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            step = max(1, total // max_frames) if total > max_frames else 1
            index = 0
            while len(frames) < max_frames:
                ok, frame = cap.read()
                if not ok:
                    break
                if total > max_frames and index % step != 0:
                    index += 1
                    continue
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                h, w = rgb.shape[:2]
                if max_edge and max(h, w) > max_edge:
                    scale = max_edge / float(max(h, w))
                    rgb = np.asarray(
                        Image.fromarray(rgb).resize(
                            (max(1, int(w * scale)), max(1, int(h * scale))),
                            Image.Resampling.BILINEAR,
                        )
                    )
                frames.append(rgb)
                index += 1
        finally:
            cap.release()
    except Exception as exc:
        raise ValueError(f"{TAG}: could not read video {path}: {exc}") from exc
    if not frames:
        raise ValueError(f"{TAG}: no frames in {path}")
    return torch.from_numpy(np.stack(frames).astype("float32") / 255.0)


def _stem_name(path):
    return re.sub(r"[^\w.\-]+", "_", os.path.splitext(os.path.basename(path))[0]).strip("._") or "still"


def _mod_stem(name, subfolder=""):
    module = htc()
    clean = module._clean_name(str(name or "").strip()) if hasattr(module, "_clean_name") else str(name or "").strip()
    if not clean:
        raise ValueError(f"{TAG}: name is empty")
    folder = str(subfolder or "").strip().replace("\\", "/").strip("/")
    if folder:
        if any(part in ("", ".", "..") for part in folder.split("/")):
            raise ValueError(f"{TAG}: bad subfolder {subfolder!r}")
        return f"{folder}/{clean}"
    return clean


def _encode_audio(audio_vae, audio, *, strict=False):
    if audio is None or audio_vae is None:
        return None
    try:
        from comfy_extras.nodes_minimax_h3 import _encode_ref_audio
        z, ref_t = _encode_ref_audio(audio_vae, audio)
        return {
            "kind": "audio",
            "latent": z,
            "ref_audio_t": ref_t,
            "sample_rate": int(getattr(audio_vae, "audio_sample_rate", 32000)),
            "name": "voice",
        }
    except Exception as exc:
        if strict:
            raise ValueError(f"{TAG}: audio encode failed: {exc}") from exc
        print(f"[{TAG}] audio encode skipped: {exc!r}", flush=True)
        return None


def _encode_tensor(vae, frames, label, *, short_edge=1024, fit_mode="crop", max_tokens=0, clip=False):
    module = htc()
    if clip:
        frames = module.snap_video_frames(frames)
    canvas = module.fit_canvas(frames, short=int(short_edge or 1024), fit_mode=fit_mode)
    latent = vae.encode(canvas)
    if latent.ndim != 5:
        raise ValueError(f"{TAG}: VAE encode of {label} returned {tuple(latent.shape)}, expected [1,24,T,H,W]")
    if max_tokens and hasattr(module, "fit_token_budget"):
        latent = module.fit_token_budget(latent, max_tokens, label)
    looks = module.looks_from(canvas, clip=bool(clip or int(latent.shape[2]) > 1))
    kind = "video" if int(latent.shape[2]) > 1 else "image"
    return {
        "kind": kind,
        "name": label,
        "latent": latent,
        "looks": looks,
        "source": "video" if kind == "video" else "image",
        "source_shape": "x".join(str(int(n)) for n in latent.shape[2:]),
    }


def _write_preview(written, looks):
    if looks is None or int(looks.shape[0]) < 1:
        return
    try:
        from .bake_previews import _jpeg_from_rgb, _write_preview
        _write_preview(written, _jpeg_from_rgb(looks[0]))
    except Exception:
        pass


def _save_members(stem, members, *, description, role, step_curve, save):
    module = htc()
    root = module.register_folder()
    if not save:
        return module._clean_name(stem) if hasattr(module, "_clean_name") else stem, None

    visual = [m for m in members if m.get("kind") != "audio"]
    audio = [m for m in members if m.get("kind") == "audio"]
    if len(visual) > 1 or audio:
        written = module.save_v5_bundle(
            root,
            stem,
            members,
            description=description,
            concept_type=role,
            default_step_curve=step_curve,
            compact_png=True,
        )
        looks = visual[0].get("looks") if visual else None
        _write_preview(written, looks)
        return written, looks

    member = visual[0]
    latent = member["latent"]
    looks = member["looks"]
    meta = module.metadata_for(
        stem,
        member["kind"],
        latent,
        "encode",
        member["source"],
        member["source_shape"],
        "encode",
        0,
        description=description,
        looks=int(looks.shape[0]),
        concept_type=role,
        default_step_curve=step_curve,
    )
    written = module.save_latent(root, stem, latent, meta, looks=looks)
    _write_preview(written, looks)
    return written, looks


def _sources_from_images(images):
    """Split a Comfy IMAGE batch into still members (one tensor each)."""
    if images is None:
        return []
    import torch
    if not isinstance(images, torch.Tensor) or images.ndim != 4:
        raise ValueError(f"{TAG}: images must be [B,H,W,C]")
    out = []
    for i in range(int(images.shape[0])):
        out.append(("image", f"image_{i + 1}", images[i : i + 1].contiguous()))
    return out


def _sources_from_video(video):
    if video is None:
        return []
    import torch
    if not isinstance(video, torch.Tensor) or video.ndim != 4:
        raise ValueError(f"{TAG}: video must be [T,H,W,C]")
    if int(video.shape[0]) < 1:
        return []
    return [("video", "video_1", video.contiguous())]


def _sources_from_disk(paths, max_edge, max_frames):
    out = []
    for path in paths:
        ext = os.path.splitext(path)[1].lower()
        label = os.path.basename(path)
        if ext in VIDEO_EXTS:
            frames = load_video(path, max_frames=max_frames, max_edge=max_edge)
            out.append(("video", label, frames))
        else:
            out.append(("image", label, load_rgb(path, max_edge=max_edge)))
    return out


def create_refmod(
    vae,
    name,
    *,
    images=None,
    video=None,
    folder="",
    paths="",
    audio=None,
    audio_vae=None,
    description="",
    role="identity",
    step_curve="full",
    subfolder="",
    layout="separate_pictures",
    pack="single",
    fit_mode="crop",
    short_edge=1024,
    max_edge=1536,
    max_frames=48,
    max_items=64,
    max_tokens=0,
    recursive=False,
    save=True,
    build="start",
):
    """Create one RefMod (or one per file). Returns (report, name_or_names, last_preview)."""
    import torch

    # Blank name → folder basename, else first disk stem, else "subject".
    name = str(name or "").strip()
    if not name:
        folder_hint = str(folder or "").strip()
        if folder_hint:
            try:
                name = os.path.basename(os.path.normpath(resolve_path(folder_hint)))
            except ValueError:
                name = os.path.basename(folder_hint.rstrip("/\\"))
        if not name:
            for raw in parse_paths_text(paths):
                try:
                    resolved = resolve_path(raw)
                except ValueError:
                    continue
                base = os.path.basename(resolved.rstrip("/\\"))
                stem = os.path.splitext(base)[0] if os.path.isfile(resolved) else base
                if stem:
                    name = stem
                    break
        name = re.sub(r"[^\w.\-]+", "_", name).strip("._") or "subject"

    if str(build or "start").strip().lower() != "start":
        shown = _mod_stem(name, subfolder)
        return f"stopped — {shown} not written", shown, torch.zeros(1, 64, 64, 3)

    disk = collect_disk_sources(
        folder, paths, recursive=bool(recursive), max_items=int(max_items or 64)
    )
    sources = []
    sources.extend(_sources_from_images(images))
    sources.extend(_sources_from_video(video))
    sources.extend(_sources_from_disk(disk, max_edge=int(max_edge or 1536), max_frames=int(max_frames or 48)))

    if not sources and audio is None:
        raise ValueError(
            f"{TAG}: provide images (socket), a video socket, a folder, path list, and/or audio."
        )
    if sources and vae is None:
        raise ValueError(f"{TAG}: visual sources need the H3 video VAE.")
    if audio is not None and audio_vae is None:
        raise ValueError(f"{TAG}: audio needs the H3 audio VAE on audio_vae.")

    # Popup / API creates should fail loudly if audio was requested.
    audio_member = _encode_audio(audio_vae, audio, strict=bool(audio is not None))
    pack_mode = str(pack or "single").strip().lower()
    layout_mode = str(layout or "separate_pictures").strip().lower()
    role = str(role or "identity").strip().lower() or "identity"
    step_curve = str(step_curve or "full").strip().lower() or "full"
    description = str(description or "").strip()

    wrote = []
    last_preview = None

    if pack_mode == "per_file":
        if audio_member is not None and len(sources) > 1:
            print(f"[{TAG}] per_file: audio attaches only to the first file", flush=True)
        base = _mod_stem(name, subfolder)
        for index, (kind, label, frames) in enumerate(sources):
            stem = base if len(sources) == 1 else f"{base}/{_stem_name(label)}"
            if len(sources) > 1 and "/" not in base:
                # name_001 style under subfolder
                stem = f"{base}_{index + 1:02d}_{_stem_name(label)}"
            member = _encode_tensor(
                vae, frames, label,
                short_edge=short_edge, fit_mode=fit_mode, max_tokens=max_tokens,
                clip=(kind == "video"),
            )
            members = [member]
            if index == 0 and audio_member is not None:
                members.append(audio_member)
            written, looks = _save_members(
                stem, members, description=description, role=role,
                step_curve=step_curve, save=save,
            )
            wrote.append(written)
            if looks is not None:
                last_preview = _preview_image(looks)
            del frames, member
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        if not sources and audio_member is not None:
            stem = _mod_stem(name, subfolder)
            written, _ = _save_members(
                stem, [audio_member], description=description, role=role,
                step_curve=step_curve, save=save,
            )
            wrote.append(written)
    else:
        stem = _mod_stem(name, subfolder)
        members = []
        if layout_mode == "stacked_video" and len(sources) >= 2:
            # Shared canvas, stack along time into one latent.
            module = htc()
            first = sources[0][2]
            tw, th = module.canvas_size(first, short=int(short_edge or 1024))
            parts, looks_parts, shapes = [], [], []
            for kind, label, frames in sources:
                if kind == "video":
                    frames = module.snap_video_frames(frames)
                canvas = module.to_canvas(frames, tw, th, fit_mode=fit_mode)
                z = vae.encode(canvas)
                if z.ndim != 5:
                    raise ValueError(f"{TAG}: bad encode {label}: {tuple(z.shape)}")
                if max_tokens and hasattr(module, "fit_token_budget"):
                    z = module.fit_token_budget(z, max_tokens, label)
                parts.append(z)
                looks_parts.append(module.looks_from(canvas[:1] if kind == "image" else canvas, clip=(kind == "video")))
                shapes.append(label)
            latent = module.stack_latents(parts, stem)
            looks = torch.cat(looks_parts, dim=0)
            members.append({
                "kind": "video" if int(latent.shape[2]) > 1 else "image",
                "name": stem,
                "latent": latent,
                "looks": looks,
                "source": "stack",
                "source_shape": "+".join(shapes),
            })
        else:
            # separate_pictures (default): each still keeps native aspect as a v5 member
            for kind, label, frames in sources:
                members.append(_encode_tensor(
                    vae, frames, label,
                    short_edge=short_edge, fit_mode=fit_mode, max_tokens=max_tokens,
                    clip=(kind == "video"),
                ))
                del frames
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
        if audio_member is not None:
            members.append(audio_member)
        if not members:
            raise ValueError(f"{TAG}: nothing to encode")
        written, looks = _save_members(
            stem, members, description=description, role=role,
            step_curve=step_curve, save=save,
        )
        wrote.append(written)
        if looks is not None:
            last_preview = _preview_image(looks)

    if last_preview is None:
        last_preview = torch.zeros(1, 64, 64, 3)

    n_vis = len(sources)
    n_aud = 1 if audio_member is not None else 0
    report = (
        f"wrote={len(wrote)} visual_sources={n_vis} audio={n_aud} "
        f"encode={int(short_edge)}px layout={layout_mode} role={role}\n"
        + "\n".join(f"  {w}" for w in wrote)
    )
    print(f"[{TAG}] {report.replace(chr(10), ' | ')}", flush=True)
    return report, wrote[0] if len(wrote) == 1 else ",".join(wrote), last_preview


AUDIO_EXTS = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac"}


def load_audio_dict(raw_path):
    """Load a disk audio file into a Comfy AUDIO dict for create_refmod."""
    path = resolve_path(raw_path)
    if not os.path.isfile(path):
        raise ValueError(f"{TAG}: audio file not found: {raw_path}")
    ext = os.path.splitext(path)[1].lower()
    if ext and ext not in AUDIO_EXTS:
        raise ValueError(f"{TAG}: unsupported audio type {ext}")
    try:
        from comfy_extras.nodes_audio import load as core_load
        waveform, sample_rate = core_load(path)
    except Exception:
        import torchaudio
        waveform, sample_rate = torchaudio.load(path)
    if hasattr(waveform, "ndim") and int(waveform.ndim) == 2:
        waveform = waveform.unsqueeze(0)
    return {"waveform": waveform, "sample_rate": int(sample_rate)}


def _panel_stem(name, folder="", paths="", audio_path=""):
    raw = str(name or "").strip()
    if raw:
        return re.sub(r"[^\w.\-]+", "_", raw).strip("._") or "subject"
    for hint in (folder, paths, audio_path):
        text = str(hint or "").strip()
        if not text:
            continue
        try:
            resolved = resolve_path(text.splitlines()[0].strip())
        except ValueError:
            resolved = text
        base = os.path.basename(resolved.rstrip("/\\"))
        stem = os.path.splitext(base)[0] if "." in base else base
        stem = re.sub(r"[^\w.\-]+", "_", stem).strip("._")
        if stem:
            return stem
    return "subject"


def create_from_uploaded_files(*, photos=None, audio=None, fields=None):
    """Encode picks from browser memory via an ephemeral temp dir (never input/).

    ``photos``: list of ``(filename, bytes)``.
    ``audio``: optional ``(filename, bytes)``.
    ``fields``: same keys as ``create_from_panel`` (kind, name, description, …).
    Temp tree is deleted after encode; only ``models/refmods/`` output remains.
    """
    import shutil
    import tempfile

    photos = list(photos or [])
    fields = dict(fields or {})
    kind = str(fields.get("kind") or "visual").strip().lower() or "visual"
    need_visual = kind in ("visual", "both")
    need_audio = kind in ("audio", "both")
    if need_visual and not photos:
        raise ValueError(f"{TAG}: add at least one photo or video.")
    if need_audio and not audio:
        raise ValueError(f"{TAG}: add a voice file for audio / both.")

    tmp = tempfile.mkdtemp(prefix="h3_refmod_")
    try:
        path_lines = []
        for index, (filename, raw) in enumerate(photos):
            name = os.path.basename(str(filename or f"still_{index + 1}.jpg"))
            name = re.sub(r"[^\w.\-]+", "_", name).strip("._") or f"still_{index + 1}.jpg"
            dest = os.path.join(tmp, f"{index:02d}_{name}")
            with open(dest, "wb") as handle:
                handle.write(raw)
            path_lines.append(dest)
        audio_path = ""
        if audio:
            aud_name, aud_raw = audio
            name = os.path.basename(str(aud_name or "voice.wav"))
            name = re.sub(r"[^\w.\-]+", "_", name).strip("._") or "voice.wav"
            audio_path = os.path.join(tmp, "audio_" + name)
            with open(audio_path, "wb") as handle:
                handle.write(aud_raw)
        payload = dict(fields)
        payload["folder"] = ""
        payload["paths"] = "\n".join(path_lines)
        payload["audio_path"] = audio_path
        if not str(payload.get("name") or "").strip() and path_lines:
            # Prefer first photo stem so blank name still reads as the character.
            base = os.path.splitext(os.path.basename(path_lines[0]))[0]
            base = re.sub(r"^\d+_", "", base)
            payload["name"] = base
        return create_from_panel(payload)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def create_from_panel(data):
    """In-node Create for RefMod / Hybrid. Reuses create_refmod; no new format.

    Payload keys: kind (visual|audio|both), folder, paths, audio_path, name,
    description, role, split (bool — Brandi-style _visual/_audio files),
    plus encode_settings_from keys.
    """
    from .bake_previews import load_audio_vae, load_preview_vae, set_preview_vae
    from .refmods import file_info

    if not isinstance(data, dict):
        data = {}
    kind = str(data.get("kind") or "visual").strip().lower() or "visual"
    if kind not in ("visual", "audio", "both"):
        raise ValueError(f"{TAG}: kind must be visual, audio, or both")

    folder = str(data.get("folder") or "").strip()
    paths = str(data.get("paths") or data.get("path") or "").strip()
    audio_path = str(data.get("audio_path") or "").strip()
    description = str(data.get("description") or "").strip()
    split = bool(data.get("split"))
    settings = encode_settings_from(data)
    stem = _panel_stem(data.get("name"), folder, paths, audio_path)
    # Optional organize destination under models/refmods/<dest_folder>/…
    dest_folder = str(data.get("dest_folder") or "").strip().replace("\\", "/").strip("/")
    if dest_folder:
        if "/" in dest_folder or dest_folder in (".", "..") or dest_folder.startswith("."):
            raise ValueError(f"{TAG}: dest_folder must be a single folder name")
        if "/" not in stem:
            stem = f"{dest_folder}/{stem}"

    need_visual = kind in ("visual", "both")
    need_audio = kind in ("audio", "both")
    if need_visual and not folder and not paths:
        raise ValueError(f"{TAG}: paste a photos folder or media path for visual.")
    if need_audio and not audio_path:
        raise ValueError(f"{TAG}: paste a wav/mp3 path for audio.")

    vae = None
    if need_visual:
        vae = load_preview_vae()
        if vae is None:
            raise ValueError(
                f"{TAG}: no MiniMax H3 video VAE under models/vae. "
                "Queue H3 Create RefMod or Bake once with the video VAE wired, then retry."
            )
        set_preview_vae(vae)

    audio = None
    audio_vae = None
    if need_audio:
        audio = load_audio_dict(audio_path)
        audio_vae = load_audio_vae()
        if audio_vae is None:
            raise ValueError(
                f"{TAG}: no MiniMax H3 audio VAE under models/vae. "
                "Install the H3 audio VAE, or queue Create once with audio_vae wired."
            )

    reports = []
    primary = ""
    voice_name = ""

    if kind == "audio":
        role = str(data.get("role") or "voice").strip().lower() or "voice"
        report, written, _preview = create_refmod(
            None,
            stem,
            audio=audio,
            audio_vae=audio_vae,
            description=description,
            role=role,
            **settings,
            build="start",
        )
        primary = str(written).split(",")[0].strip()
        reports.append(report)
    elif kind == "visual":
        role = str(data.get("role") or "identity").strip().lower() or "identity"
        report, written, _preview = create_refmod(
            vae,
            stem,
            folder=folder,
            paths=paths,
            description=description,
            role=role,
            **settings,
            build="start",
        )
        primary = str(written).split(",")[0].strip()
        reports.append(report)
    elif split:
        # Brandi-style: name_refmod_visual + name_refmod_audio (picker auto-pairs).
        vis_name = stem if stem.endswith("_visual") or stem.endswith("_refmod_visual") else f"{stem}_refmod_visual"
        aud_name = re.sub(r"(_refmod)?_visual$", "", vis_name, flags=re.I) + "_refmod_audio"
        role = str(data.get("role") or "identity").strip().lower() or "identity"
        report_v, written_v, _ = create_refmod(
            vae,
            vis_name,
            folder=folder,
            paths=paths,
            description=description,
            role=role,
            **settings,
            build="start",
        )
        report_a, written_a, _ = create_refmod(
            None,
            aud_name,
            audio=audio,
            audio_vae=audio_vae,
            description=description,
            role="voice",
            **settings,
            build="start",
        )
        primary = str(written_v).split(",")[0].strip()
        voice_name = str(written_a).split(",")[0].strip()
        reports.extend([report_v, report_a])
    else:
        # One file with visual + baked voice latent (has_audio_latent).
        role = str(data.get("role") or "identity").strip().lower() or "identity"
        report, written, _preview = create_refmod(
            vae,
            stem,
            folder=folder,
            paths=paths,
            audio=audio,
            audio_vae=audio_vae,
            description=description,
            role=role,
            **settings,
            build="start",
        )
        primary = str(written).split(",")[0].strip()
        reports.append(report)

    item = file_info(primary) or {"name": primary}
    return {
        "ok": True,
        "name": primary,
        "voice_name": voice_name,
        "report": "\n".join(reports),
        "item": item,
    }
