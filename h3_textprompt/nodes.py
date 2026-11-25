"""Internal six-section MiniMax prompt writer for EM Subject Hot Swap."""

import json

from .assemble import TASKS, build_prompt

_STATE_TOOLTIP = (
    "Editor state. The panel on the node edits this JSON. "
    "Python builds the six-section prompt from it."
)


class H3SubjectPrompt:
    """Six H3 sections. Subjects are short fields you can add, expand, drop, save, and edit."""

    CATEGORY = "H3 Prompt"
    FUNCTION = "build"
    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("prompt", "report")
    DESCRIPTION = (
        "MiniMax H3 prompt built from six sections. Add a subject, type who they are, "
        "what must stay, and a wardrobe line. The node writes subject_definitions and "
        "retention_analysis. Summary, detailed description, soundscape, and music stay "
        "as their own boxes. Save a subject to reuse it. Drop a row or switch it off "
        "and both of its lines leave the prompt. Picture numbers follow the checked "
        "rows from the top."
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "state": ("STRING", {
                "multiline": False,
                "default": "{}",
                "tooltip": _STATE_TOOLTIP,
            }),
        }}

    def build(self, state):
        try:
            data = json.loads(state or "{}")
            if not isinstance(data, dict):
                data = {}
        except (json.JSONDecodeError, TypeError):
            data = {}
        result = build_prompt(data)
        return (result["prompt"], result["report"])


NODE_CLASS_MAPPINGS = {"H3SubjectPrompt": H3SubjectPrompt}
NODE_DISPLAY_NAME_MAPPINGS = {"H3SubjectPrompt": "EM Subject Hot Swap — Prompt"}


try:
    from aiohttp import web
    from server import PromptServer

    @PromptServer.instance.routes.post("/h3subject/assemble")
    async def _h3subject_assemble(request):
        try:
            data = await request.json()
            if not isinstance(data, dict):
                data = {}
            return web.json_response(build_prompt(data))
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.get("/h3subject/tasks")
    async def _h3subject_tasks(request):
        return web.json_response({"tasks": TASKS})
except ImportError:
    pass
