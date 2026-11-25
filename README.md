# EM Subject Hot Swap

EM Subject Hot Swap is a ComfyUI custom-node pack for MiniMax H3 prompt preparation. The pack exposes **two nodes**:

1. **EM Subject Hot Swap** — a four-tab prompt studio: Ref Images, RefMods, Mix, and I2V.
2. **LLM (GGUF) - Loader** — selects a local GGUF and optional vision projector, or an HTTP chat endpoint, then provides the H3-compatible `llm` connection used by Describe and Draft.

The separate `ComfyUI-H3-Subject-Hot-Swap` folder is an obsolete stub. Do not install that folder. This unified pack is the current implementation; its ComfyUI folder name is `ComfyUI-EM-Subject-Hot-Swap`.

## Quick install

1. Install/update ComfyUI with MiniMax H3 support.
2. Put this repository folder in `ComfyUI/custom_nodes/ComfyUI-EM-Subject-Hot-Swap` (or install this repository by URL through ComfyUI Manager).
3. Restart ComfyUI completely, then hard-refresh the browser tab.
4. Search the node menu for **EM Subject Hot Swap** and **LLM (GGUF) - Loader**.

Manual Git install:

```powershell
cd C:\ComfyUI\custom_nodes
git clone https://github.com/EllipsesMark/EM-Subject-Hot-Swap.git ComfyUI-EM-Subject-Hot-Swap
```

Use the Python environment that launches ComfyUI for any Python package installation. There is no `requirements.txt`: ComfyUI supplies the normal node runtime dependencies (including PyTorch, NumPy, and Pillow). **Do not install a generic `llama-cpp-python` wheel into a different Python environment.** Its binary must match the ComfyUI Python version and the user's CPU/CUDA setup.

### Required models and runtime

- MiniMax H3 support in ComfyUI and a compatible H3 `CLIP` input.
- H3 video VAE for RefMod previews, picture/video references, Mix, and I2V.
- H3 audio VAE for audio references or voice RefMods.
- For GGUF Describe/Draft: `llama-cpp-python` installed in the same Python environment ComfyUI uses, a compatible `.gguf` model, and (for image understanding) that model's matching vision `mmproj` GGUF. Alternatively, select the loader's HTTP backend and use an OpenAI-compatible chat-completions server.
- The I2V guide, prompt assembly, and validation helpers are bundled in this pack. No separate PromptWriter node pack is required. I2V Draft uses the connected LLM loader; queueing the prompt does not call the LLM.

No separate RefMod library pack or EllipsesMark resolution-selector pack is required. RefMod I/O, the GGUF config node, and the resolution/duration controls are included here. Models themselves are not bundled.

## First graph

1. Add **EM Subject Hot Swap**.
2. Connect the H3 model's `CLIP` output to the node's `clip` input.
3. Connect the H3 video VAE to `vae`. Connect the audio VAE to `audio_vae` when the selected mode uses audio.
4. Add **LLM (GGUF) - Loader** if you want Describe or Draft. Connect its `llm` output to Hot Swap's `llm` input.
5. Choose a tab, fill its panel, and queue the workflow.

The node returns `positive`, `latent`, `prompt`, and `report`. Connect `positive` and `latent` to the downstream H3 sampling workflow as appropriate. The node does not load a diffusion model or generate a video by itself.

Pictures, videos, audio, and I2V frames are selected in the panel; they are not separate graph sockets. Uploaded panel media is staged for the operation and is not meant to become a permanent copy of the source file in the pack.

## Example workflow

[`examples/EllipsesMark_H3_Ref2V.json`](examples/EllipsesMark_H3_Ref2V.json) is the MiniMax H3 Ref2V example workflow and includes the **EM Subject Hot Swap** node. Its Markdown note lists the selected model files and required custom-node repositories. The EM pack must be installed for the node to load; its repository link will work after publication.

The shared example has its API key field cleared. Configure your own backend credentials locally if needed, and never publish a workflow containing a secret.

## The Hot Swap node

The node keeps all four tabs' state in the workflow. Changing tabs changes the active mode but does not erase the other tabs. **Only the selected tab runs when the graph is queued.** The panel and hidden state are serialized with the ComfyUI workflow, so save the workflow to preserve edits.

### Shared size and duration controls

The band at the top controls the output canvas and clip length:

- **Aspect ratio** and **megapixels** determine width and height. Dimensions are rounded to H3's 32-pixel grid; the live readout shows the actual size.
- **Seconds** is converted at 24 fps and snapped up to H3's `17n + 5` frame grid. For example, 5.0 seconds becomes 124 frames (about 5.17 seconds of frames).
- **Reference image size** controls how picture references are scaled (`match` or `max`).

### Tab: Ref Images

Use this when the references are ordinary pictures, clips, or audio—not saved RefMods.

- Add picture rows for people, places, clothing, or other visual references. A row's description/role and marker tell the writer what the reference represents and what should be retained.
- Video and audio references can be added from the panel's media pickers. Video references use the supported H3 reference-video path; audio references can provide a voice/timbre reference.
- Use **Describe** to ask the connected LLM to fill the row's `who` and `keep` text. Review and edit those fields; descriptions are not a substitute for checking the image.
- Write the idea and prompt sections, or use **Draft** to get an editable proposal. Accepting a draft copies it into the prompt fields; it does not run the video generation.
- Queueing this tab encodes the selected reference inputs and assembles the H3 conditioning. It does not modify the source pictures.

### Tab: RefMods

Use this when you already have encoded `.safetensors` RefMods under `ComfyUI/models/refmods/`.

- Add/select RefMod rows, then choose each row's concept (for example identity, wardrobe, background, or voice), strength, and shot assignment. Checked rows are used in their displayed order; unchecked rows are ignored.
- A visual RefMod represents reusable encoded visual information. An audio RefMod is a reusable voice reference. A paired visual/audio set can be created as separate paired files or in the same file, depending on the Create options.
- **Looks** opens the available stills/previews for a RefMod. **Set cover** selects the canonical preview used by the picker and Describe. Older latent-only RefMods may need a one-time VAE decode before their looks appear.
- **Describe** fills the row's `who`/`keep` description from its selected cover and the connected LLM. Review before use.
- **Save to RefMod** writes the row's description (`who`), `keep`, and concept metadata into the selected existing RefMod file. It does **not** encode another RefMod and does not replace the latent. Choose the target RefMod first; a non-empty `who` line is required.
- Draft is a proposal for the prompt text. Accept or edit it before queueing.

### Tab: Mix

Use this when the prompt needs both reusable RefMods and ordinary still pictures.

- Add RefMod rows for identity, wardrobe, background, voice, or other reusable concepts.
- Add picture rows for one-off image references. The panel can also choose items from the bundled wardrobe catalogue; you can add clothing images to that catalogue from the panel.
- The generated prompt numbers and describes RefMods and pictures as separate reference types. Use the row's concept, `who`/`keep`, strength, and shot assignment to control how each one is described.
- **Create** is available from the panel's New/Create workflow to encode new RefMods; it is separate from adding an existing RefMod or a still row.
- The H3 video VAE is required when picture rows must be encoded into H3 reference latents. A workflow with only RefMods may not need it for the Mix encode itself, though the VAE is needed for preview baking.

### Tab: I2V

Use this for image-to-video prompts with an optional opening and/or ending frame. Pick the frame files in the panel. The frame selection determines the mode: no frame is text-to-video, a first frame is image-to-video, and first plus last frames constrain both ends.

Write a prompt directly or use **Draft** for an editable base-guide draft. The I2V guide, prompt assembly, and validator are bundled with this pack and check duration and frame alignment before encoding. This tab uses the H3 video VAE. Queueing does not call the LLM; the bundled loader is used only when you explicitly request Draft.

## Create: make a new RefMod

**Create** (opened through the panel's **New…** / **Create** controls) encodes source media into a reusable RefMod. It is not the same as **Save to RefMod**.

1. Choose **Visual**, **Audio**, or **Both**.
2. For Visual, select/drop one or more images or videos, or provide a folder/media path. For Audio, select a voice file or provide an audio path. Use only media you have permission to process.
3. Enter a name, optional description, role, and optional destination folder under `models/refmods/`.
4. Choose the encoding options if needed. Defaults suit the normal flow; advanced settings control how image sets/videos are sampled and packed.
5. Click **Create** and wait for the report. Visual encoding requires the H3 video VAE; audio encoding requires the H3 audio VAE.

The result is a new `.safetensors` RefMod under `ComfyUI/models/refmods/`, plus a preview/metadata sidecar as appropriate. **Create does not modify an existing RefMod.** The temporary upload/source staging files are cleaned up after encoding; your original files remain where they were. `Both` can save a visual and audio pair, or combine them in one file according to the split option.

## LLM (GGUF) - Loader

This is the pack's bundled, H3-compatible port of the EllipsesMark LLM configuration node—not ComfyUI's diffusion GGUF loader. EllipsesMark's original node emits `ELLIPSESMARK_LLM`, which cannot connect to Hot Swap's `H3_LLM` socket; this adapted node emits the compatible `H3_LLM` type. Connect its `llm` output to Hot Swap's `llm` input. The loader scans recursively for `.gguf` files in:

- `ComfyUI/models/llm_gguf/`
- `ComfyUI/models/LLM/`

Files whose names contain `mmproj` are listed as vision projectors. Keep the model and matching projector in one of these folders. The projector must match the selected model family; a mismatched mmproj commonly fails at inference time.

Choose **GGUF** or **HTTP** in `backend`:

- **GGUF**: select the chat/instruct `model_name`. For image-based Describe, choose the model's matching `mmproj_name`; `none` is text-only. Start `n_ctx` at 16384. The bundled loader tries progressively smaller contexts and a quantized KV-cache fallback if allocation fails; the actual fallback is written to the ComfyUI console. Smaller context supports less input text/image context. `n_gpu_layers=-1` attempts all layers on GPU, `0` uses CPU, and intermediate values partially offload. **Keep loaded** is off by default so the GGUF is freed after each Describe/Draft operation and H3 can use VRAM.
- **HTTP**: connect to an OpenAI-compatible `/chat/completions` server, for example LM Studio, llama.cpp server, Ollama's OpenAI-compatible endpoint, or a compatible service. Set the base URL and model id. The server must support image inputs for vision-based Describe; it handles its own model/projector. Prompt text and any selected images are sent to that server. Use `none` for a local server API key. **API keys are saved in workflow JSON**, so do not save/share a workflow containing a secret.

The model is loaded or contacted only when you click Describe or Draft; queueing the H3 prompt/conditioning does not invoke the LLM. A graph can still be used without an LLM connection by entering prompt text manually. `llama-cpp-python` is needed only for GGUF mode and must be importable by ComfyUI. This pack cannot install a universal wheel because llama.cpp builds are Python-, platform-, and GPU-specific. HTTP mode avoids that local binary requirement.

## What is saved, and where

- Workflow tab state and prompt fields: saved in the ComfyUI workflow JSON.
- RefMods: `ComfyUI/models/refmods/` (including subfolders); generated previews are sidecars.
- Legacy latent-only RefMod look caches and chosen covers: `models/refmods/.h3looks/`.
- Who/keep memory used by Describe and picker rows: `ComfyUI/user/default/h3subject/library.json`.
- One-off source pictures/audio: picked from ComfyUI's input/media paths or uploaded temporarily for Create; originals are not copied into this repository.
- Wardrobe catalogue and its bundled images: `data/wardrobe.json` and `data/wardrobe/` inside this pack. Custom catalogue additions are written there, so back up this folder before replacing/updating the node pack.

**Save to RefMod** updates metadata in an existing `.safetensors` RefMod. It is different from the library memory above, which is a convenience record and can be rebuilt; it is also different from **Create**, which writes a new encoded RefMod.

## Troubleshooting

- **Node is missing:** check startup logs for import errors, restart ComfyUI, then hard-refresh the browser. Install this unified pack, not the deprecated standalone stub.
- **Panel says a tab is not ready:** hard-refresh after restart so every bundled `web/` script is reloaded.
- **No GGUF in the model dropdown:** put the file in one of the two model directories above and restart ComfyUI. You can use HTTP mode without a local GGUF.
- **`llama-cpp-python` import/load error:** install a compatible build into the exact Python environment that launches ComfyUI. Do not use a random system-Python wheel. Or select HTTP mode. Check the ComfyUI console for the first failing loader attempt.
- **GGUF runs out of memory:** lower context, set fewer GPU layers (or `0` for CPU), use a smaller quant, and leave **Keep loaded** off. The loader retries smaller contexts, but that cannot make an oversized model fit.
- **Describe cannot see a picture:** for GGUF, select a vision-capable model and matching mmproj; for HTTP, make sure the server supports vision input. In either case make sure the image is available to ComfyUI.
- **Create reports a missing VAE:** install/select the MiniMax H3 video VAE and/or audio VAE according to the Create mode.
- **RefMod looks are blank:** connect the H3 video VAE and allow the first decode to finish; older latent-only files need this cache bake.
- **I2V validation fails:** confirm the EM pack's `h3_i2v/prompt_writer/` files are present, update the pack, and restart ComfyUI.

## License and bundled media

EM Subject Hot Swap is released under the MIT License in `LICENSE`: you may use, modify, copy, publish, and redistribute it, including commercially, as long as you retain the copyright and license notices. This applies to the source code, documentation, and bundled AI-generated wardrobe images in `data/wardrobe/`; the pack author has confirmed those images may be redistributed. The vendored MiniMax H3 RefMod implementation has its own MIT notice at `h3_subject_prompt/THIRD_PARTY_HTC_LICENSE.txt`; retain that notice when redistributing the vendored code. Model files and user-added media are not included and remain subject to their own terms.
