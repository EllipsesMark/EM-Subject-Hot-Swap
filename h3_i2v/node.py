"""One node in front of MiniMax H3 Image to Video.

Connected frames select the mode. The prompt has to match those frames.
Draft uses the base guide through the local GGUF. Queue only encodes.
"""

import asyncio
import json

from .prompt import prepare


def _load_frame(filename, label):
    """One still from the input folder as [1, H, W, 3] float."""
    from ..h3_ref2va.ref_node import load_still
    try:
        return load_still(str(filename).strip())
    except ValueError as exc:
        raise ValueError(f"{label}: {exc}") from exc


class H3ImageToVideo:
    """Base-guide prompt plus the official H3 image-to-video encoder."""

    CATEGORY = "H3 Prompt"
    FUNCTION = "build"
    RETURN_TYPES = ("CONDITIONING", "LATENT", "STRING", "STRING")
    RETURN_NAMES = ("positive", "latent", "prompt", "report")
    DESCRIPTION = (
        "Pick the first frame, the last frame, or both inside the panel "
        "(or wire them). Neither frame is T2VA, video with audio. This node calls "
        "MiniMax H3 Image to Video. Connect LLM (GGUF) - Loader to llm "
        "for Draft. Queue does not run the writer."
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clip": ("CLIP", {"tooltip": "H3 minimax text encoder."}),
                "vae": ("VAE", {"tooltip": "H3 video VAE. The encoder requires it."}),
                "width": ("INT", {"default": 1344, "min": 32, "max": 16384, "step": 32}),
                "height": ("INT", {"default": 768, "min": 32, "max": 16384, "step": 32}),
                "length": ("INT", {
                    "default": 124, "min": 5, "max": 3600, "step": 17,
                    "tooltip": "Frame count at 24 fps, snapped up to the 17k+5 grid. 124 is 5.17 seconds.",
                }),
                "state": ("STRING", {
                    "multiline": False,
                    "default": "{}",
                    "tooltip": "Editor state. The panel writes this JSON. Queue reads the prompt from it.",
                }),
            },
            "optional": {
                "llm": ("H3_LLM", {"tooltip":
                    "LLM (GGUF) - Loader. Draft uses this connection. Queue does not run the writer. "
                    "Gemma needs n_ctx 8192 or 4096."}),
                "instructions": ("H3_I2V_INSTRUCTIONS", {"tooltip":
                    "H3 I2V Draft Instructions. An empty override keeps the base guide "
                    "for the mode the frames select. Queue does not run Draft."}),
                "first_frame": ("IMAGE", {"tooltip":
                    "Optional wire for the opening frame; the panel's picker is the usual way. "
                    "Alone, the run is I2VA. With a last frame, it is FL2VA."}),
                "last_frame": ("IMAGE", {"tooltip":
                    "Optional wire for the ending frame. With a first frame, the run is FL2VA. "
                    "Alone, it is L2VA. With neither frame, the run is T2VA."}),
            },
        }

    def build(self, clip, vae, width, height, length, state,
              llm=None, instructions=None, first_frame=None, last_frame=None):
        del llm, instructions
        try:
            data = json.loads(state or "{}")
            if not isinstance(data, dict):
                data = {}
        except (json.JSONDecodeError, TypeError):
            data = {}
        # Frames picked inside the panel load here. A connected socket wins.
        if first_frame is None and str(data.get("first_file") or "").strip():
            first_frame = _load_frame(data["first_file"], "first frame")
        if last_frame is None and str(data.get("last_file") or "").strip():
            last_frame = _load_frame(data["last_file"], "last frame")
        finished = prepare(
            data.get("prompt"), length,
            first_frame is not None, last_frame is not None,
        )
        if finished["issues"]:
            raise ValueError(
                "Prompt does not match the connected frames.\n"
                + "\n".join(f"- {item}" for item in finished["issues"])
            )
        from comfy_extras.nodes_minimax_h3 import MiniMaxH3ImageToVideo

        output = MiniMaxH3ImageToVideo.execute(
            clip, vae, finished["prompt"], width, height, length,
            first_frame=first_frame, last_frame=last_frame,
        )
        report = [
            f"mode: {finished['mode']}",
            f"duration: {finished['duration']:.2f}s",
            f"frames: {finished['frames']}",
        ]
        report.extend(finished["notes"])
        report.append("validation: OK")
        return (output[0], output[1], finished["prompt"], "\n".join(report))


class H3I2VDraftInstructions:
    """Replace or extend the base-guide draft text.

    Empty override keeps the sliced guide for whichever mode the frames
    select. Extra is appended and wins where it conflicts. Stay / Expand
    is still added in Python.
    """

    CATEGORY = "H3 Prompt"
    FUNCTION = "configure"
    RETURN_TYPES = ("H3_I2V_INSTRUCTIONS", "STRING")
    RETURN_NAMES = ("instructions", "built_in_guide")
    DESCRIPTION = (
        "Leave the override empty to keep the base guide for the connected frames. "
        "built_in_guide shows the I2VA slice so you can copy it. "
        "Stay / Expand is still added when you draft."
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "extra_instructions": ("STRING", {
                    "multiline": True, "default": "",
                    "tooltip": "Appended to the guide. Where it conflicts, this text wins. "
                    "The reply is still the three-field prompt.",
                }),
            },
            "optional": {
                "override_guide": ("STRING", {
                    "multiline": True, "default": "",
                    "tooltip": "Replaces the sliced base guide. Empty keeps the guide "
                    "for the mode the frames select. Copy built_in_guide to start from the I2VA slice.",
                }),
            },
        }

    def configure(self, extra_instructions, override_guide=""):
        from .vision import builtin_guide
        try:
            guide = builtin_guide()
        except Exception as exc:
            guide = str(exc)
        return (
            {"extra": extra_instructions, "override": override_guide},
            guide,
        )


NODE_CLASS_MAPPINGS = {
    "H3ImageToVideo": H3ImageToVideo,
    "H3I2VDraftInstructions": H3I2VDraftInstructions,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "H3ImageToVideo": "H3 Image to Video",
    "H3I2VDraftInstructions": "H3 I2V Draft Instructions",
}


try:
    from aiohttp import web
    from server import PromptServer

    @PromptServer.instance.routes.post("/h3i2v/vision")
    async def _h3i2v_vision(request):
        try:
            from .vision import answer
            data = await request.json()
            result = await asyncio.get_running_loop().run_in_executor(None, lambda: answer(data))
            return web.json_response(result)
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)
except ImportError:
    pass
