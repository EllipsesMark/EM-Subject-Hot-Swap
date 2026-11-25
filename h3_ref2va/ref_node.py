"""Internal Ref Images writer used by EM Subject Hot Swap.

The original external H3 Subject Prompt node is not changed.
This one calls the official MiniMax H3 Reference to Video encoder with only
the checked picture files, so an unchecked row cannot leave a hole.
"""

import asyncio
import json
import os

import numpy as np
import torch
from PIL import Image, ImageOps, ImageSequence

import folder_paths
import node_helpers

from .media import annotate, audio_slots, clip_range, picture_slots, video_slots

# H3 reference videos: 24 fps, trained range is 15 s.
VIDEO_FPS = 24
VIDEO_MAX_SECONDS = 15


def _present(prefix, values):
    found = {}
    for index, value in enumerate(values):
        if value is None:
            continue
        found[f"{prefix}{index}"] = value
    return found or None


def load_still(filename):
    """One RGB frame, float 0-1, shape [1, H, W, 3]."""
    from .wardrobe import resolve_image
    path = resolve_image(filename)
    if not path or not os.path.isfile(path):
        raise ValueError(f"Image file not found: {filename}")
    img = node_helpers.pillow(Image.open, path)
    frame = None
    for item in ImageSequence.Iterator(img):
        frame = node_helpers.pillow(ImageOps.exif_transpose, item).convert("RGB")
        break
    if frame is None:
        raise ValueError(f"Image file has no frames: {filename}")
    array = np.array(frame).astype(np.float32) / 255.0
    return torch.from_numpy(array).unsqueeze(0)


def load_audio(filename, start_s=0, end_s=0):
    """Comfy AUDIO dict, cut to the selected window when one is set."""
    path = folder_paths.get_annotated_filepath(str(filename))
    if not path or not os.path.isfile(path):
        raise ValueError(f"Audio file not found: {filename}")
    try:
        from comfy_extras.nodes_audio import load as core_load
        waveform, sample_rate = core_load(path)
    except Exception:
        import torchaudio
        waveform, sample_rate = torchaudio.load(path)
    if waveform.ndim == 2:
        waveform = waveform.unsqueeze(0)
    start, end = clip_range(waveform.shape[-1], sample_rate, start_s, end_s)
    waveform = waveform[..., start:end]
    return {"waveform": waveform, "sample_rate": int(sample_rate)}


def load_video(filename, max_seconds=VIDEO_MAX_SECONDS):
    """Video file from input/ (or 'name [output]') -> (frames [T,H,W,3], AUDIO|None).

    Same path H3 Studio uses: comfy's VideoFromFile (PyAV), resampled to 24 fps
    by frame index, capped at the trained 15 s, soundtrack kept when present.
    """
    name = str(filename or "").strip()
    if not name or not folder_paths.exists_annotated_filepath(name):
        raise ValueError(f"Video file not found: {filename}")
    from comfy_api.input_impl import VideoFromFile
    comp = VideoFromFile(folder_paths.get_annotated_filepath(name)).get_components()
    frames = comp.images
    if frames is None or frames.shape[0] == 0:
        raise ValueError(f"Video file has no frames: {filename}")
    fps = float(comp.frame_rate) if comp.frame_rate else float(VIDEO_FPS)
    duration = frames.shape[0] / max(fps, 1e-6)
    n_out = int(duration * VIDEO_FPS)
    if max_seconds and n_out > max_seconds * VIDEO_FPS:
        n_out = max_seconds * VIDEO_FPS
    if n_out < 5:
        raise ValueError(f"Video is under 0.2 s; a reference video needs at least 5 frames: {filename}")
    idx = [min(frames.shape[0] - 1, int(round(i * fps / VIDEO_FPS))) for i in range(n_out)]
    frames = frames[idx]
    audio = None
    if comp.audio is not None and comp.audio.get("waveform") is not None:
        waveform = comp.audio["waveform"]
        if waveform.ndim == 2:
            waveform = waveform.unsqueeze(0)
        rate = int(comp.audio["sample_rate"])
        keep = max_seconds * rate if max_seconds else None
        audio = {"waveform": waveform[..., :keep] if keep else waveform, "sample_rate": rate}
    return frames, audio


def _videos(data, video_wires, audio_wires):
    """Card files first. A ref_video wire fills a video row that has no file."""
    slots = video_slots(data)
    if not slots:
        return _present("ref_video_", video_wires), _present("ref_video_audio_", audio_wires)
    videos = {}
    audios = {}
    for index, (number, name, filename) in enumerate(slots):
        if filename:
            frames, audio = load_video(filename)
            videos[f"ref_video_{index}"] = frames
            if audio is not None:
                audios[f"ref_video_audio_{index}"] = audio
            continue
        wired = video_wires[index] if index < len(video_wires) else None
        if wired is None:
            raise ValueError(f"Video {number} ({name}) has no video file.")
        videos[f"ref_video_{index}"] = wired
        wired_audio = audio_wires[index] if index < len(audio_wires) else None
        if wired_audio is not None:
            audios[f"ref_video_audio_{index}"] = wired_audio
    return videos or None, audios or None


def _standalone_audios(data, wires):
    """Card files first. A ref_audio wire fills a voice line that has no file."""
    slots = audio_slots(data)
    if not slots:
        return _present("ref_audio_", wires)
    found = {}
    for index, slot in enumerate(slots):
        number, name, filename = slot[0], slot[1], slot[2]
        if filename:
            found[f"ref_audio_{index}"] = load_audio(filename, slot[3] if len(slot) > 3 else 0, slot[4] if len(slot) > 4 else 0)
            continue
        wired = wires[index] if index < len(wires) else None
        if wired is not None:
            found[f"ref_audio_{index}"] = wired
            continue
        raise ValueError(f"Audio {number} ({name}) has no audio file.")
    return found or None


_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
_AUDIO_EXTS = {".wav", ".mp3", ".flac", ".ogg", ".opus", ".m4a", ".aac", ".wma", ".aiff", ".aif"}
_VIDEO_EXTS = {".mp4", ".webm", ".mov", ".mkv", ".m4v", ".avi"}
# Same skips Load Image Pixaroma uses. These are model-preview junctions, not character folders.
_SKIP_ALWAYS = {
    "flux.1_d", "flux.1_s", "sdxl_1.0", "sd_1.5", "pony",
    "lora_sdxl_1.0", "lora_sd_1.5", "lora_pony", "lora_flux.1_d", "lora_hunyuan_video",
}
_SKIP_EMPTY = {"3d", "bjornulf"}


def _is_link(path):
    try:
        if os.path.islink(path):
            return True
        if os.name == "nt":
            return bool(os.stat(path, follow_symlinks=False).st_file_attributes & 0x400)
    except (OSError, AttributeError, ValueError):
        return False
    return False


def _file_names(directory, extensions):
    try:
        entries = os.listdir(directory)
    except OSError:
        return []
    names = []
    for name in entries:
        if name.startswith("."):
            continue
        if os.path.splitext(name)[1].lower() not in extensions:
            continue
        if os.path.isfile(os.path.join(directory, name)):
            names.append(name)
    return names


def _list_input(extensions):
    """Files in input/ and its immediate folders."""
    root = folder_paths.get_input_directory()
    files = []
    folders = []

    def add(folder_name, directory):
        for name in _file_names(directory, extensions):
            path = f"{folder_name}/{name}" if folder_name else name
            files.append({"path": path, "folder": folder_name, "name": name})

    add("", root)
    try:
        entries = sorted(os.listdir(root), key=str.lower)
    except OSError:
        entries = []
    for name in entries:
        if name.startswith("."):
            continue
        full = os.path.join(root, name)
        if not os.path.isdir(full) or _is_link(full):
            continue
        if name.lower() in _SKIP_ALWAYS:
            continue
        if name.lower() in _SKIP_EMPTY and not _file_names(full, extensions):
            continue
        folders.append(name)
        add(name, full)
    files.sort(key=lambda item: (item["folder"].lower(), item["name"].lower()))
    return {"files": files, "folders": folders}


def list_input_images():
    """Images in input/ and its immediate folders, the same set Load Image Pixaroma shows."""
    return _list_input(_IMAGE_EXTS)


def list_input_videos():
    """Videos in input/ and its immediate folders."""
    return _list_input(_VIDEO_EXTS)


def list_input_audio():
    """Sound files in the input folder itself, the same list Load Audio Pixaroma shows."""
    root = folder_paths.get_input_directory()
    names = sorted(_file_names(root, _AUDIO_EXTS), key=str.lower)
    return {"files": [{"path": name, "folder": "", "name": name} for name in names], "folders": []}


class H3SubjectPromptRef:
    """Six-section prompt plus the official H3 reference encoder."""

    CATEGORY = "H3 Prompt"
    FUNCTION = "build"
    RETURN_TYPES = ("CONDITIONING", "LATENT", "STRING", "STRING")
    RETURN_NAMES = ("positive", "latent", "prompt", "report")
    DESCRIPTION = (
        "Checked rows load their picture, video, and audio files and this node "
        "calls MiniMax H3 Reference to Video. Connect LLM (GGUF) - Loader to llm "
        "for Describe and Draft. The ref_* wires are optional fallbacks."
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clip": ("CLIP",),
                "width": ("INT", {"default": 1344, "min": 32, "max": 16384, "step": 32}),
                "height": ("INT", {"default": 768, "min": 32, "max": 16384, "step": 32}),
                "length": ("INT", {"default": 124, "min": 5, "max": 3600, "step": 17}),
                "ref_image_size": (["match", "max"], {"default": "match"}),
                "state": ("STRING", {
                    "multiline": False,
                    "default": "{}",
                    "tooltip": "Editor state. The panel writes this JSON. Python loads the pictures and builds the prompt.",
                }),
            },
            "optional": {
                "llm": ("H3_LLM", {"tooltip":
                    "LLM (GGUF) - Loader. Describe and Draft use this connection. "
                    "Queue does not run the writer."}),
                "instructions": ("H3_DRAFT_INSTRUCTIONS", {"tooltip":
                    "H3 Draft Instructions. Empty override fields keep the "
                    "built-in guide for that model. Queue does not run Draft."}),
                "vae": ("VAE",),
                "audio_vae": ("VAE",),
                "ref_video_0": ("IMAGE",),
                "ref_video_1": ("IMAGE",),
                "ref_video_2": ("IMAGE",),
                "ref_video_audio_0": ("AUDIO",),
                "ref_video_audio_1": ("AUDIO",),
                "ref_video_audio_2": ("AUDIO",),
                "ref_audio_0": ("AUDIO",),
                "ref_audio_1": ("AUDIO",),
                "ref_audio_2": ("AUDIO",),
            },
        }

    def build(self, clip, width, height, length, ref_image_size, state,
              vae=None, audio_vae=None,
              ref_video_0=None, ref_video_1=None, ref_video_2=None,
              ref_video_audio_0=None, ref_video_audio_1=None, ref_video_audio_2=None,
              ref_audio_0=None, ref_audio_1=None, ref_audio_2=None,
              llm=None, instructions=None):
        del llm, instructions
        try:
            data = json.loads(state or "{}")
            if not isinstance(data, dict):
                data = {}
        except (json.JSONDecodeError, TypeError):
            data = {}
        info = annotate(data)
        if info.get("error"):
            raise ValueError(info["error"])

        from comfy_extras.nodes_minimax_h3 import MiniMaxH3ReferenceToVideo

        ref_images = {}
        for index, (_number, _name, filename) in enumerate(picture_slots(data)):
            ref_images[f"ref_image_{index}"] = load_still(filename)
        ref_videos, ref_video_audios = _videos(
            data,
            [ref_video_0, ref_video_1, ref_video_2],
            [ref_video_audio_0, ref_video_audio_1, ref_video_audio_2],
        )

        output = MiniMaxH3ReferenceToVideo.execute(
            clip,
            info["prompt"],
            width,
            height,
            length,
            ref_image_size,
            vae=vae,
            audio_vae=audio_vae,
            ref_images=ref_images or None,
            ref_videos=ref_videos,
            ref_video_audios=ref_video_audios,
            ref_audios=_standalone_audios(data, [ref_audio_0, ref_audio_1, ref_audio_2]),
        )
        return (output[0], output[1], info["prompt"], info["report"])


class H3DraftInstructions:
    """Per-model draft guides. Empty boxes keep the built-in text.

    Override replaces the guide for that model. Extra is appended and wins
    where it conflicts. Close, Develop, and the three-part reply shape are
    still added in Python.
    """

    CATEGORY = "H3 Prompt"
    FUNCTION = "configure"
    RETURN_TYPES = ("H3_DRAFT_INSTRUCTIONS", "STRING", "STRING")
    RETURN_NAMES = ("instructions", "gemma_draft_guide", "qwen_draft_guide")
    DESCRIPTION = (
        "Leave the override boxes empty to keep the built-in draft guide. "
        "Paste a replacement to override Gemma or the Qwen 27B. Extra is "
        "appended to whichever model is connected."
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "extra_instructions": ("STRING", {
                    "multiline": True, "default": "",
                    "tooltip": "Appended to the guide for the connected model. "
                    "Where it conflicts, this text wins. The three-part reply "
                    "shape still applies.",
                }),
            },
            "optional": {
                "override_gemma": ("STRING", {
                    "multiline": True, "default": "",
                    "tooltip": "Replaces the built-in draft guide when the "
                    "connected GGUF name contains Gemma. Empty keeps the "
                    "built-in guide. Copy gemma_draft_guide to start from it.",
                }),
                "override_qwen": ("STRING", {
                    "multiline": True, "default": "",
                    "tooltip": "Replaces the built-in draft guide for any "
                    "other connected GGUF, including the Qwen 27B. Empty "
                    "keeps the built-in guide.",
                }),
            },
        }

    def configure(self, extra_instructions, override_gemma="", override_qwen=""):
        from .vision import guide_for
        return (
            {
                "extra": extra_instructions,
                "override_gemma": override_gemma,
                "override_qwen": override_qwen,
            },
            guide_for("gemma"),
            guide_for("qwen"),
        )


# Draft Instructions lives once in h3_subject_prompt (shared by Ref + RefMod).
NODE_CLASS_MAPPINGS = {
    "H3SubjectPromptRef": H3SubjectPromptRef,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "H3SubjectPromptRef": "EM Subject Hot Swap — Ref Images",
}


try:
    from aiohttp import web
    from server import PromptServer

    @PromptServer.instance.routes.post("/h3subjectref/assemble")
    async def _h3subjectref_assemble(request):
        try:
            data = await request.json()
            if not isinstance(data, dict):
                data = {}
            return web.json_response(annotate(data))
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.get("/h3subjectref/images")
    async def _h3subjectref_images(request):
        return web.json_response(list_input_images())

    @PromptServer.instance.routes.get("/h3subjectref/audio")
    async def _h3subjectref_audio(request):
        return web.json_response(list_input_audio())

    @PromptServer.instance.routes.get("/h3subjectref/videos")
    async def _h3subjectref_videos(request):
        return web.json_response(list_input_videos())

    @PromptServer.instance.routes.get("/h3subjectref/wardrobe")
    async def _h3subjectref_wardrobe(request):
        from .wardrobe import list_catalogue
        return web.json_response(list_catalogue())

    @PromptServer.instance.routes.get("/h3subjectref/wardrobe/photo")
    async def _h3subjectref_wardrobe_photo(request):
        from .wardrobe import _contained, _photo_roots
        rel = request.query.get("file", "")
        for root in _photo_roots():
            path = _contained(root, rel)
            if path:
                return web.FileResponse(path)
        return web.json_response({"error": "Clothing set image not found."}, status=404)

    @PromptServer.instance.routes.post("/h3subjectref/vision")
    async def _h3subjectref_vision(request):
        try:
            from .vision import answer
            data = await request.json()
            result = await asyncio.get_running_loop().run_in_executor(None, lambda: answer(data))
            return web.json_response(result)
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)
except ImportError:
    pass
