"""EM Subject Hot Swap — one studio node, four jobs (Stills / RefMods / Mix / I2V).

Reuses the pack's existing writers and HTTP routes. Active tab only runs on queue.
"""

from __future__ import annotations

import json

from .duration import actual_seconds, frames_from_seconds
from .resolution import ASPECT_RATIOS, DEFAULT_ASPECT, DEFAULT_MEGAPIXELS, select_resolution

MODES = ("stills", "refmods", "mix", "i2v")
_DEFAULT_MODE = "mix"

_EMPTY_STILLS = {
    "task": "reference generation",
    "subjects": [],
    "summary": "",
    "opening": "",
    "detailed": "",
    "soundscape": "",
    "music": "",
    "idea": "",
    "pass": "develop",
    "subject_reinforced": True,
}
_EMPTY_REFMODS = {
    "task": "reference generation",
    "mods": [],
    "summary": "",
    "opening": "",
    "detailed": "",
    "soundscape": "",
    "music": "",
    "idea": "",
    "pass": "develop",
    "style_mode": "amateur",
    "shot_size": "medium close-up",
    "motion": {"weight": False, "contact": False, "follow": False, "settle": False},
    "subject_reinforced": True,
}
_EMPTY_MIX = {
    "task": "reference generation",
    "mods": [],
    "summary": "",
    "opening": "",
    "detailed": "",
    "soundscape": "",
    "music": "",
    "idea": "",
    "pass": "develop",
    "style_mode": "amateur",
    "shot_size": "medium close-up",
    "motion": {"weight": False, "contact": False, "follow": False, "settle": False},
    "subject_reinforced": True,
}
_EMPTY_I2V = {
    "idea": "",
    "prompt": "",
    "style_mode": "cinematic",
    "shot_size": "medium shot",
    "subject": "subject",
    "pass": "stay",
    "first_file": "",
    "last_file": "",
    "motion": {"weight": False, "contact": False, "follow": False, "settle": False},
}


def default_envelope():
    return {
        "mode": _DEFAULT_MODE,
        "stills": dict(_EMPTY_STILLS),
        "refmods": dict(_EMPTY_REFMODS),
        "mix": dict(_EMPTY_MIX),
        "i2v": dict(_EMPTY_I2V),
    }


def parse_envelope(raw):
    try:
        data = json.loads(raw or "{}")
        if not isinstance(data, dict):
            data = {}
    except (json.JSONDecodeError, TypeError):
        data = {}

    if "mode" not in data and ("mods" in data or "subjects" in data or "prompt" in data):
        env = default_envelope()
        if "subjects" in data:
            env["mode"] = "stills"
            env["stills"] = data
        elif "prompt" in data and "mods" not in data and "subjects" not in data:
            env["mode"] = "i2v"
            env["i2v"] = data
        else:
            env["mode"] = "mix"
            env["mix"] = data
        return env

    env = default_envelope()
    mode = str(data.get("mode") or _DEFAULT_MODE).strip().lower()
    if mode not in MODES:
        mode = _DEFAULT_MODE
    env["mode"] = mode
    for key, blank in (
        ("stills", _EMPTY_STILLS),
        ("refmods", _EMPTY_REFMODS),
        ("mix", _EMPTY_MIX),
        ("i2v", _EMPTY_I2V),
    ):
        blob = data.get(key)
        if isinstance(blob, dict):
            merged = dict(blank)
            merged.update(blob)
            env[key] = merged
    return env


class H3SubjectHotSwap:
    """Tabbed studio: Stills, RefMods, Mix, or I2V — one encode path per queue."""

    CATEGORY = "EM Subject Hot Swap"
    FUNCTION = "build"
    RETURN_TYPES = ("CONDITIONING", "LATENT", "STRING", "STRING")
    RETURN_NAMES = ("positive", "latent", "prompt", "report")
    DESCRIPTION = (
        "EM Subject Hot Swap — Ref Images / RefMods / Mix / I2V in one node. "
        "Pictures, videos, audio, and I2V frames are picked inside the panel. "
        "Only the active tab runs. Same routes and encode paths as the "
        "dedicated writers in this pack."
    )

    @classmethod
    def INPUT_TYPES(cls):
        ratios = list(ASPECT_RATIOS)
        return {
            "required": {
                "clip": ("CLIP",),
                "aspect_ratio": (ratios, {
                    "default": DEFAULT_ASPECT,
                    "tooltip": "Aspect ratio for width × height.",
                }),
                "megapixels": ("FLOAT", {
                    "default": DEFAULT_MEGAPIXELS, "min": 0.1, "max": 16.0, "step": 0.01, "round": 0.01,
                    "tooltip": "Target total megapixels. 1.0 MP is about 1024×1024 for a square.",
                }),
                "seconds": ("FLOAT", {
                    "default": 5.0, "min": 0.2, "max": 149.5, "step": 0.1, "round": 0.01,
                    "tooltip": "Clip length in seconds. Snapped up to H3's 17n+5 frame grid at 24 fps "
                    "(Duration Pixaroma recipe): 5.0 s is 124 frames, 5.17 s played.",
                }),
                "ref_image_size": (["match", "max"], {"default": "match"}),
                "state": ("STRING", {
                    "multiline": False,
                    "default": json.dumps(default_envelope(), separators=(",", ":")),
                    "tooltip": "Hot Swap envelope: mode + stills/refmods/mix/i2v blobs.",
                }),
            },
            "optional": {
                "vae": ("VAE", {"tooltip": "H3 video VAE (Mix pictures, RefMod previews, I2V, video refs)."}),
                "audio_vae": ("VAE", {"tooltip": "H3 audio VAE for audio refs and video soundtracks."}),
                "llm": ("H3_LLM", {"tooltip": "LLM (GGUF) - Loader for Describe / Draft; supports GGUF or HTTP."}),
            },
        }

    def build(
        self,
        clip,
        aspect_ratio,
        megapixels,
        seconds,
        ref_image_size,
        state,
        vae=None,
        audio_vae=None,
        llm=None,
    ):
        # Pictures, videos, audio, and I2V frames are all picked inside the
        # panel and loaded from the input folder by the writers. No media wires.
        from ..h3_i2v.node import H3ImageToVideo
        from ..h3_ref2va.ref_node import H3SubjectPromptRef
        from .hybrid_node import H3SubjectPromptHybrid
        from .ref_node import H3SubjectPromptRefMod

        width, height = select_resolution(aspect_ratio, megapixels)
        length = frames_from_seconds(seconds)
        env = parse_envelope(state)
        mode = env["mode"]
        blob = json.dumps(env.get(mode) or {})

        if mode == "stills":
            out = H3SubjectPromptRef().build(
                clip, width, height, length, ref_image_size, blob,
                vae=vae, audio_vae=audio_vae, llm=llm,
            )
        elif mode == "refmods":
            out = H3SubjectPromptRefMod().build(
                clip, width, height, length, blob, vae=vae, llm=llm,
            )
        elif mode == "mix":
            out = H3SubjectPromptHybrid().build(
                clip, width, height, length, ref_image_size, blob,
                vae=vae, audio_vae=audio_vae, llm=llm,
            )
        else:
            if vae is None:
                raise ValueError("I2V tab needs the MiniMax H3 video VAE on vae.")
            out = H3ImageToVideo().build(clip, vae, width, height, length, blob, llm=llm)

        positive, latent, prompt, report = out
        head = f"hot swap: {mode} · {width}×{height} · {length} frames ({actual_seconds(length):.2f} s)"
        return (positive, latent, prompt, f"{head}\n{report}")
