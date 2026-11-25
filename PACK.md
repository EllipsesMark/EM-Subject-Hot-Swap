# EM Subject Hot Swap — package map

The end-user guide is [`README.md`](README.md). This file is the short maintainer note.

## Public ComfyUI nodes

Only these two mappings are registered:

- **EM Subject Hot Swap** (`H3SubjectHotSwap`) — Ref Images, RefMods, Mix, and I2V tabs.
- **LLM (GGUF) - Loader** (`H3PromptLLMLoader`) — emits the H3-compatible `H3_LLM` handle and supports GGUF or OpenAI-compatible HTTP chat.

The dedicated writer classes remain internal implementation details. They are imported to register the panel/API routes and are called by the active Hot Swap tab; they are intentionally not listed as separate nodes.

## Runtime notes

- Python GGUF inference and HTTP chat live in `h3_llm/local_llm.py`; the loader is adapted to H3's socket type, because EllipsesMark's original node outputs `ELLIPSESMARK_LLM`.
- I2V guide, prompt assembly, and validation helpers are bundled under `h3_i2v/prompt_writer/`; no separate PromptWriter pack is required.
- ComfyUI/MiniMax H3 supplies the model classes and `folder_paths`; the pack does not install model weights or `llama-cpp-python`. HTTP mode can avoid the latter.
- `WEB_DIRECTORY = "web"`; preserve all frontend files when packaging.
- Python caches (`__pycache__`, `*.pyc`) are ignored and must not be included in release archives.

## Data and redistribution

RefMods are user data in `ComfyUI/models/refmods/`, not pack content. The bundled wardrobe images in `data/wardrobe/` are AI-generated and the pack author has confirmed they may be redistributed; they are covered by the top-level MIT license along with original code and docs. Vendored MiniMax H3 RefMod code is separately covered by `h3_subject_prompt/THIRD_PARTY_HTC_LICENSE.txt`; preserve that notice when redistributing it. See `README.md` for user-facing license details.
