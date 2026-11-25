"""H3 Delete RefMod — remove a finished file from models/refmods/."""

from __future__ import annotations


class H3DeleteRefMod:
    """Delete one RefMod (+ preview sidecar) from the RefMod folder."""

    CATEGORY = "H3 Prompt"
    FUNCTION = "delete"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("report",)
    OUTPUT_NODE = True
    DESCRIPTION = (
        "Delete a RefMod from models/refmods/. Type the name (no extension), "
        "turn Confirm on, and queue. Deletes the .safetensors and .preview.jpg."
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "name": ("STRING", {
                    "default": "",
                    "tooltip": "RefMod name under models/refmods/ (no .safetensors).",
                }),
                "confirm": ("BOOLEAN", {
                    "default": False,
                    "tooltip": "Must be on to actually delete. Off = dry run / safe queue.",
                }),
            },
        }

    def delete(self, name, confirm=False):
        from .delete_refmod import delete_refmod

        report = delete_refmod(name, confirm=bool(confirm))
        return (report,)
