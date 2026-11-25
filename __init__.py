"""EM Subject Hot Swap: one public node plus its in-process GGUF config node.

The dedicated writer classes are imported for their HTTP routes and are called
internally by Hot Swap, but only Hot Swap and the LLM loader are registered in
ComfyUI's node menu.
"""

from .h3_subject_prompt.ref_node import (
    NODE_CLASS_MAPPINGS as _REFMOD,
    NODE_DISPLAY_NAME_MAPPINGS as _REFMOD_NAMES,
)
from .h3_ref2va.ref_node import (
    NODE_CLASS_MAPPINGS as _REF2VA,
    NODE_DISPLAY_NAME_MAPPINGS as _REF2VA_NAMES,
)
from .h3_textprompt.nodes import (
    NODE_CLASS_MAPPINGS as _TEXT,
    NODE_DISPLAY_NAME_MAPPINGS as _TEXT_NAMES,
)
from .h3_i2v.node import (
    NODE_CLASS_MAPPINGS as _I2V,
    NODE_DISPLAY_NAME_MAPPINGS as _I2V_NAMES,
)
from .h3_llm import (
    NODE_CLASS_MAPPINGS as _LLM,
    NODE_DISPLAY_NAME_MAPPINGS as _LLM_NAMES,
)

# Keep internal modules/routes loaded while exposing only the two supported
# public nodes. Hot Swap directly invokes the writer classes for the active tab.
NODE_CLASS_MAPPINGS = {
    "H3SubjectHotSwap": _REFMOD["H3SubjectHotSwap"],
    "H3PromptLLMLoader": _LLM["H3PromptLLMLoader"],
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "H3SubjectHotSwap": "EM Subject Hot Swap",
    "H3PromptLLMLoader": "LLM (GGUF) - Loader",
}

WEB_DIRECTORY = "web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
