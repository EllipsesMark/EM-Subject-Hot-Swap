"""EM Subject Hot Swap's RefMod writer implementation.

Stills Ref2VA baggage is not here. Each row is a finished RefMod with a
strength. The DiT gets the stored latent. CLIP sees baked looks only when
the file has them.
"""

import asyncio
import json

import node_helpers

from .media import annotate


class H3SubjectPromptRefMod:
    CATEGORY = "H3 Prompt"
    FUNCTION = "build"
    RETURN_TYPES = ("CONDITIONING", "LATENT", "STRING", "STRING")
    RETURN_NAMES = ("positive", "latent", "prompt", "report")
    DESCRIPTION = (
        "Load finished RefMods with a strength each, write the six-section "
        "shot prompt, and attach the stored latents to the conditioning. "
        "Optional H3 video VAE: missing picker thumbs bake from looks or a "
        "first-frame decode (sidecar only — queue still does not live-decode "
        "for CLIP)."
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clip": ("CLIP",),
                "width": ("INT", {"default": 1344, "min": 32, "max": 16384, "step": 32}),
                "height": ("INT", {"default": 768, "min": 32, "max": 16384, "step": 32}),
                "length": ("INT", {"default": 124, "min": 5, "max": 3600, "step": 17}),
                "state": ("STRING", {
                    "multiline": False,
                    "default": "{}",
                    "tooltip": "Editor state. The panel writes this JSON.",
                }),
            },
            "optional": {
                "vae": ("VAE", {"tooltip":
                    "MiniMax H3 video VAE. Optional. Lets on-pick / on-queue "
                    "write .preview.jpg for RefMods that have no looks."}),
                "llm": ("H3_LLM", {"tooltip":
                    "LLM (GGUF) - Loader. Describe and Draft use this connection. "
                    "Queue does not run the writer."}),
                "instructions": ("H3_DRAFT_INSTRUCTIONS", {"tooltip":
                    "H3 Draft Instructions. Empty override fields keep the "
                    "built-in guide for that model. Queue does not run Draft."}),
            },
        }

    def build(self, clip, width, height, length, state,
              vae=None, llm=None, instructions=None, **_legacy):
        del llm, instructions, _legacy
        try:
            data = json.loads(state or "{}")
            if not isinstance(data, dict):
                data = {}
        except (json.JSONDecodeError, TypeError):
            data = {}
        info = annotate(data)
        if info.get("error"):
            raise ValueError(info["error"])

        from comfy_extras.nodes_minimax_h3 import _empty_av_latent
        from .assemble import assign, migrate_state
        from .bake_previews import ensure_preview, set_preview_vae
        from .refmods import audio_block_for, load_visual, push_visual_refs

        if vae is not None:
            set_preview_vae(vae)

        data = migrate_state(data)
        latent, _frame_count = _empty_av_latent(width, height, length)
        ref_items = []
        ref_blocks = []
        notes = []
        for item in assign(data.get("mods") or []):
            if item["kind"] == "visual":
                if vae is not None:
                    baked = ensure_preview(item["refmod"], vae=vae)
                    if baked.get("source") in ("looks", "vae"):
                        notes.append(
                            f"{item['refmod']}: preview from {baked['source']}."
                        )
                loaded = load_visual(item["refmod"], item["strength"])
                if not push_visual_refs(ref_items, ref_blocks, loaded):
                    notes.append(
                        f"{item['refmod']}: no baked looks. DiT uses the stored latent; "
                        "CLIP sees the prompt only."
                    )
                n_mem = int(loaded.get("member_count") or 1)
                if n_mem > 1:
                    notes.append(f"{item['refmod']}: {n_mem} visual members applied.")
                if item.get("voice"):
                    ref_items.append({"type": "audio"})
                    ref_blocks.append(audio_block_for(item["voice_refmod"], 1.0))
            else:
                ref_items.append({"type": "audio"})
                ref_blocks.append(audio_block_for(item["refmod"], item["strength"]))

        tokens = clip.tokenize(info["prompt"], minimax_ref_items=ref_items)
        cond = clip.encode_from_tokens_scheduled(tokens)
        if ref_blocks:
            cond = node_helpers.conditioning_set_values(cond, {"minimax_refs": ref_blocks})
        report = info["report"]
        if notes:
            report = report + "\n" + "\n".join(dict.fromkeys(notes))
        return (cond, latent, info["prompt"], report)


class H3BakeRefModPreviews:
    """Offline first-frame previews for the RefMod picker.

    Connect the H3 video VAE, queue once. Writes Name.preview.jpg beside each
    RefMod (looks when present, otherwise Inspect-style T=1 decode). The
    Subject Prompt RefMod node only reads those JPEGs — it does not decode.
    """

    CATEGORY = "H3 Prompt"
    FUNCTION = "bake"
    RETURN_TYPES = ("STRING", "IMAGE")
    RETURN_NAMES = ("report", "last_preview")
    OUTPUT_NODE = True
    DESCRIPTION = (
        "Bake .preview.jpg sidecars for RefMods so the picker can show faces. "
        "Uses stored looks when available; otherwise decodes the first latent "
        "frame with the connected H3 video VAE. Start with a small limit."
    )

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "vae": ("VAE", {
                    "tooltip": "MiniMax H3 video VAE. Needed for latent-only RefMods.",
                }),
                "missing_only": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "Skip RefMods that already have a .preview.jpg.",
                }),
                "limit": ("INT", {
                    "default": 20, "min": 0, "max": 100000, "step": 1,
                    "tooltip": "0 = all matching. Use 10–20 first to confirm VRAM is fine.",
                }),
                "name_filter": ("STRING", {
                    "default": "",
                    "tooltip": "Optional substring filter on the RefMod path/name.",
                }),
            },
            "optional": {
                "prefer_looks": ("BOOLEAN", {
                    "default": True,
                    "tooltip": "If the file already stores looks, bake from those and skip VAE.",
                }),
                "all_looks": ("BOOLEAN", {
                    "default": False,
                    "tooltip": (
                        "Latent-only RefMods (older v4 files) keep one picture per latent token. "
                        "Also decode every token into models/refmods/.h3looks so the Looks gallery "
                        "shows all of them, not just the first. Otherwise this happens the first "
                        "time Looks is opened for that RefMod."
                    ),
                }),
            },
        }

    def bake(self, vae, missing_only=True, limit=20, name_filter="", prefer_looks=True, all_looks=False):
        import torch
        from .bake_previews import bake_previews, set_preview_vae

        set_preview_vae(vae)
        report, last_image, _stats = bake_previews(
            vae=vae,
            missing_only=bool(missing_only),
            name_filter=name_filter,
            limit=int(limit or 0),
            prefer_looks=bool(prefer_looks),
            all_looks=bool(all_looks),
        )
        if last_image is None:
            last_image = torch.zeros(1, 64, 64, 3)
        return (report, last_image)


class H3DraftInstructions:
    """Per-model draft guides. Empty boxes keep the built-in text."""

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
                    "tooltip": "Appended to the guide for the connected model.",
                }),
            },
            "optional": {
                "override_gemma": ("STRING", {
                    "multiline": True, "default": "",
                    "tooltip": "Replaces the built-in draft guide when the GGUF name contains Gemma.",
                }),
                "override_qwen": ("STRING", {
                    "multiline": True, "default": "",
                    "tooltip": "Replaces the built-in draft guide for other GGUFs including Qwen 27B.",
                }),
            },
        }

    def configure(self, extra_instructions, override_gemma="", override_qwen=""):
        from .vision import draft_system
        packet = {
            "extra": str(extra_instructions or ""),
            "override_gemma": str(override_gemma or ""),
            "override_qwen": str(override_qwen or ""),
        }
        return (packet, draft_system("gemma"), draft_system("qwen"))


def register_routes():
    from aiohttp import web
    from server import PromptServer

    @PromptServer.instance.routes.post("/h3subjectrefmod/assemble")
    async def _h3subjectrefmod_assemble(request):
        try:
            data = await request.json()
            result = await asyncio.get_running_loop().run_in_executor(
                None, lambda: annotate(data if isinstance(data, dict) else {}))
            return web.json_response(result)
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.get("/h3subjectrefmod/refmods")
    async def _h3subjectrefmod_refmods(request):
        from .refmods import list_catalog
        try:
            return web.json_response(list_catalog())
        except Exception as exc:
            return web.json_response({"error": str(exc), "items": []}, status=400)

    @PromptServer.instance.routes.get("/h3subjectrefmod/voices")
    async def _h3subjectrefmod_voices(request):
        from .refmods import list_voices
        try:
            return web.json_response(list_voices())
        except Exception as exc:
            return web.json_response({"error": str(exc), "items": []}, status=400)

    @PromptServer.instance.routes.get("/h3subjectrefmod/refmod/preview")
    async def _h3subjectrefmod_preview(request):
        from .refmods import read_preview
        raw = read_preview(request.query.get("name", ""))
        if not raw:
            return web.json_response({"error": "No preview saved beside this RefMod."}, status=404)
        return web.Response(body=raw, content_type="image/jpeg", headers={"Cache-Control": "no-store"})

    @PromptServer.instance.routes.get("/h3subjectrefmod/refmod/thumb")
    async def _h3subjectrefmod_thumb(request):
        from .refmods import look_jpeg
        name = request.query.get("name", "")
        index = int(request.query.get("index") or 0)
        frame = int(request.query.get("frame") or 0)
        # gallery=1 prefers embedded looks; falls back to .preview.jpg when absent.
        gallery = str(request.query.get("gallery") or "").strip().lower() in ("1", "true", "yes")
        raw = look_jpeg(name, index, frame, prefer_preview=not gallery)
        if not raw:
            return web.json_response({"error": "This RefMod has no stored pictures."}, status=404)
        return web.Response(body=raw, content_type="image/jpeg", headers={"Cache-Control": "no-store"})

    @PromptServer.instance.routes.get("/h3subjectrefmod/refmod/looks")
    async def _h3subjectrefmod_looks(request):
        """Contact-sheet listing: every stored still inside the RefMod.

        Latent-only files decode one still per token on first open (cached
        under .h3looks), so this runs off the event loop.
        """
        from .bake_previews import read_cover
        from .refmods import looks_gallery
        name = request.query.get("name", "")
        try:
            items = await asyncio.get_running_loop().run_in_executor(
                None, lambda: looks_gallery(name))
            decoded = any(item.get("decoded") for item in items)
            note = next((item.get("note") for item in items if item.get("note")), "")
            return web.json_response({
                "name": name,
                "items": items,
                "count": len(items),
                "decoded": decoded,
                "note": note,
                "cover": read_cover(name),
            })
        except Exception as exc:
            return web.json_response({"error": str(exc), "items": [], "count": 0}, status=400)

    @PromptServer.instance.routes.post("/h3subjectrefmod/refmod/cover")
    async def _h3subjectrefmod_cover(request):
        """Looks gallery: make one look the cover (.preview.jpg → thumb + Describe)."""
        try:
            from .bake_previews import set_cover
            data = await request.json()
            if not isinstance(data, dict):
                data = {}
            name = str(data.get("name") or "").strip()
            member = int(data.get("member") or 0)
            frame = int(data.get("frame") or 0)
            result = await asyncio.get_running_loop().run_in_executor(
                None, lambda: set_cover(name, member, frame))
            return web.json_response(result)
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.get("/h3subjectrefmod/refmod/info")
    async def _h3subjectrefmod_info(request):
        from .refmods import file_info
        info = file_info(request.query.get("name", ""))
        if not info:
            return web.json_response({"error": "RefMod not found."}, status=404)
        return web.json_response(info)

    @PromptServer.instance.routes.post("/h3subjectrefmod/refmod/ensure_preview")
    async def _h3subjectrefmod_ensure_preview(request):
        """On pick: bake .preview.jpg from looks, else first-frame VAE decode."""
        try:
            from .bake_previews import ensure_preview
            data = await request.json()
            if not isinstance(data, dict):
                data = {}
            name = str(data.get("name") or "").strip()
            result = await asyncio.get_running_loop().run_in_executor(
                None, lambda: ensure_preview(name))
            return web.json_response(result)
        except Exception as exc:
            return web.json_response({"error": str(exc), "has_preview": False}, status=400)

    @PromptServer.instance.routes.post("/h3subjectrefmod/refmod/delete")
    async def _h3subjectrefmod_delete(request):
        """Picker delete: remove .safetensors + preview from models/refmods/."""
        try:
            from .delete_refmod import delete_refmod
            data = await request.json()
            if not isinstance(data, dict):
                data = {}
            name = str(data.get("name") or "").strip()
            confirm = bool(data.get("confirm"))
            report = await asyncio.get_running_loop().run_in_executor(
                None, lambda: delete_refmod(name, confirm=confirm))
            return web.json_response({"ok": True, "report": report, "name": name})
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.get("/h3subjectrefmod/refmod/folders")
    async def _h3subjectrefmod_folders(request):
        """Immediate subfolders under models/refmods/ (includes empty)."""
        try:
            from .folder_ops import list_folders
            body = await asyncio.get_running_loop().run_in_executor(None, list_folders)
            return web.json_response(body)
        except Exception as exc:
            return web.json_response({"error": str(exc), "folders": []}, status=400)

    @PromptServer.instance.routes.post("/h3subjectrefmod/refmod/mkdir")
    async def _h3subjectrefmod_mkdir(request):
        try:
            from .folder_ops import mkdir_folder
            data = await request.json()
            if not isinstance(data, dict):
                data = {}
            result = await asyncio.get_running_loop().run_in_executor(
                None, lambda: mkdir_folder(data.get("folder") or data.get("name") or ""))
            return web.json_response(result)
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.post("/h3subjectrefmod/refmod/move")
    async def _h3subjectrefmod_move(request):
        """Move a RefMod (+ preview, optional split pair) into a subfolder or root."""
        try:
            from .folder_ops import move_refmod
            data = await request.json()
            if not isinstance(data, dict):
                data = {}
            name = str(data.get("name") or "").strip()
            folder = str(data.get("folder") or "").strip()
            move_pair = data.get("move_pair")
            if move_pair is None:
                move_pair = True
            result = await asyncio.get_running_loop().run_in_executor(
                None, lambda: move_refmod(name, folder, move_pair=bool(move_pair)))
            return web.json_response(result)
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.post("/h3subjectrefmod/refmod/create")
    async def _h3subjectrefmod_create(request):
        """In-panel Create: same encode/save path as H3 Create RefMod."""
        try:
            from .create_refmod import create_from_panel
            data = await request.json()
            if not isinstance(data, dict):
                data = {}
            result = await asyncio.get_running_loop().run_in_executor(
                None, lambda: create_from_panel(data))
            return web.json_response(result)
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.post("/h3subjectrefmod/refmod/create_files")
    async def _h3subjectrefmod_create_files(request):
        """Pick photos/audio in the panel — encode from a temp dir, never input/."""
        try:
            from .create_refmod import create_from_uploaded_files
            post = await request.post()

            def _file_pairs(keys):
                out = []
                for key in keys:
                    # getall(key) raises KeyError when the field is absent — always pass [].
                    if hasattr(post, "getall"):
                        values = post.getall(key, [])
                    else:
                        one = post.get(key)
                        values = [one] if one is not None else []
                    for field in values:
                        if field is None:
                            continue
                        raw = field.file.read() if hasattr(field, "file") else None
                        if raw is None:
                            continue
                        if hasattr(raw, "read"):
                            raw = raw.read()
                        raw = bytes(raw)
                        if not raw:
                            continue
                        name = getattr(field, "filename", None) or key
                        out.append((str(name), raw))
                return out

            photos = _file_pairs(("photo", "photos", "image", "file"))
            audio_list = _file_pairs(("audio", "voice"))
            audio = audio_list[0] if audio_list else None

            def _text(key, default=""):
                val = post.get(key)
                if val is None:
                    return default
                if hasattr(val, "file"):
                    return default
                return str(val)

            def _bool(key):
                return str(_text(key)).strip().lower() in ("1", "true", "yes", "on")

            fields = {
                "kind": _text("kind", "visual"),
                "name": _text("name"),
                "description": _text("description"),
                "role": _text("role", "identity"),
                "dest_folder": _text("dest_folder"),
                "split": _bool("split"),
                "audio_start": _text("audio_start", "0"),
                "audio_end": _text("audio_end", "0"),
                "layout": _text("layout", "separate_pictures"),
                "pack": _text("pack", "single"),
                "fit_mode": _text("fit_mode", "crop"),
                "step_curve": _text("step_curve", "full"),
                "short_edge": _text("short_edge", "2048"),
                "max_edge": _text("max_edge", "2048"),
                "max_items": _text("max_items", "32"),
                "max_frames": _text("max_frames", "48"),
                "max_tokens": _text("max_tokens", "0"),
                "recursive": False,
            }
            result = await asyncio.get_running_loop().run_in_executor(
                None,
                lambda: create_from_uploaded_files(
                    photos=photos, audio=audio, fields=fields,
                ),
            )
            return web.json_response(result)
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.post("/h3subjectrefmod/refmod/description")
    async def _h3subjectrefmod_description(request):
        try:
            from .refmods import save_description
            data = await request.json()
            if not isinstance(data, dict):
                data = {}
            keep = data.get("keep")
            result = await asyncio.get_running_loop().run_in_executor(
                None,
                lambda: save_description(
                    data.get("name") or "",
                    data.get("description") or "",
                    data.get("concept"),
                    keep=None if keep is None else str(keep),
                ),
            )
            return web.json_response(result)
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.post("/h3subjectrefmod/vision")
    async def _h3subjectref_vision(request):
        try:
            from .vision import answer
            data = await request.json()
            result = await asyncio.get_running_loop().run_in_executor(None, lambda: answer(data))
            return web.json_response(result)
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)


from .create_node import H3CreateRefMod
from .delete_node import H3DeleteRefMod
from .hot_swap_node import H3SubjectHotSwap
from .hybrid_node import H3SubjectPromptHybrid, register_hybrid_routes

NODE_CLASS_MAPPINGS = {
    "H3SubjectHotSwap": H3SubjectHotSwap,
    "H3SubjectPromptRefMod": H3SubjectPromptRefMod,
    "H3SubjectPromptHybrid": H3SubjectPromptHybrid,
    "H3CreateRefMod": H3CreateRefMod,
    "H3DeleteRefMod": H3DeleteRefMod,
    "H3BakeRefModPreviews": H3BakeRefModPreviews,
    "H3DraftInstructions": H3DraftInstructions,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "H3SubjectHotSwap": "EM Subject Hot Swap",
    "H3SubjectPromptRefMod": "EM Subject Hot Swap — RefMods",
    "H3SubjectPromptHybrid": "EM Subject Hot Swap — Mix",
    "H3CreateRefMod": "H3 Create RefMod",
    "H3DeleteRefMod": "H3 Delete RefMod",
    "H3BakeRefModPreviews": "H3 Bake RefMod Previews",
    "H3DraftInstructions": "H3 Draft Instructions",
}

try:
    register_routes()
except Exception:
    pass
try:
    register_hybrid_routes()
except Exception:
    pass
