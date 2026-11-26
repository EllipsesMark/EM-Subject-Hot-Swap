"""Internal Mix writer for EM Subject Hot Swap."""

from __future__ import annotations

import asyncio
import json
import math
import os

import node_helpers

from .hybrid_assemble import annotate, assign, migrate_state


class H3SubjectPromptHybrid:
    CATEGORY = "H3 Prompt"
    FUNCTION = "build"
    RETURN_TYPES = ("CONDITIONING", "LATENT", "STRING", "STRING")
    RETURN_NAMES = ("positive", "latent", "prompt", "report")
    DESCRIPTION = (
        "Mixed RefMod + still writer. RefMods become Video tags; input or "
        "wardrobe stills become Picture tags. Optional H3 video VAE encodes "
        "stills into DiT refs and warms on-pick previews."
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
                    "tooltip": "Hybrid editor JSON (RefMod + image rows).",
                }),
            },
            "optional": {
                "vae": ("VAE", {"tooltip":
                    "MiniMax H3 video VAE. Required to encode still Picture rows "
                    "into DiT refs. Also warms on-pick RefMod preview baking."}),
                "audio_vae": ("VAE", {"tooltip":
                    "MiniMax H3 audio VAE. Required when a raw audio clip is paired with a visual row."}),
                "llm": ("H3_LLM", {"tooltip":
                    "LLM (GGUF) - Loader for Describe / Draft; supports GGUF or HTTP."}),
                "instructions": ("H3_DRAFT_INSTRUCTIONS",),
            },
        }

    def build(self, clip, width, height, length, ref_image_size, state,
              vae=None, audio_vae=None, llm=None, instructions=None):
        del llm, instructions
        try:
            data = json.loads(state or "{}")
            if not isinstance(data, dict):
                data = {}
        except (json.JSONDecodeError, TypeError):
            data = {}

        from .hybrid_assemble import build_prompt
        info = build_prompt(data)
        if info.get("error"):
            raise ValueError(info["error"])

        from comfy_extras.nodes_minimax_h3 import (
            CANVAS_MULTIPLE,
            REF_IMAGE_SHORT_EDGE,
            _empty_av_latent,
            _resize,
        )
        from .bake_previews import ensure_preview, set_preview_vae
        from .hybrid_stills import load_still
        from .refmods import audio_block_for, load_visual, push_visual_refs

        def voice_audio_block(item):
            if item.get("voice_audio_file"):
                if audio_vae is None:
                    raise ValueError(
                        "Raw audio clips paired with Mix visuals need the MiniMax H3 audio VAE "
                        "connected to the audio_vae input."
                    )
                from comfy_extras.nodes_minimax_h3 import _encode_ref_audio
                from ..h3_ref2va.ref_node import load_audio
                from .htc_refmod import audio_block
                audio = load_audio(
                    item["voice_audio_file"],
                    item.get("voice_audio_start", 0),
                    item.get("voice_audio_end", 0),
                )
                try:
                    latent, _ref_t = _encode_ref_audio(audio_vae, audio)
                except Exception as exc:
                    raise ValueError(
                        f"Failed to encode raw audio clip {item['voice_audio_file']}: {exc}"
                    ) from exc
                block = audio_block({"audio_latent": latent}, 1.0)
                if not block:
                    raise ValueError(f"Could not encode raw audio clip: {item['voice_audio_file']}")
                return block
            return audio_block_for(item["voice_refmod"], 1.0)

        if vae is not None:
            set_preview_vae(vae)

        data = migrate_state(data)
        assigned = assign(data.get("mods") or [])
        if audio_vae is None and any(item.get("voice_audio_file") for item in assigned):
            raise ValueError(
                "Raw audio clips paired with Mix visuals need the MiniMax H3 audio VAE "
                "connected to the audio_vae input."
            )
        latent, _frame_count = _empty_av_latent(width, height, length)

        ref_items = []
        ref_blocks = []
        notes = []
        need_vae_for_pictures = any(item["kind"] == "picture" for item in assigned)
        if need_vae_for_pictures and vae is None:
            raise ValueError(
                "Picture rows need the MiniMax H3 video VAE on the vae input "
                "so stills can encode into DiT references."
            )

        for item in assigned:
            if item["kind"] == "audio":
                ref_items.append({"type": "audio"})
                ref_blocks.append(audio_block_for(item["refmod"], item["strength"]))
                continue

            if item["kind"] == "picture":
                image = load_still(item["image"])
                h, w = int(image.shape[1]), int(image.shape[2])
                if ref_image_size == "match":
                    scale = min(1.0, math.sqrt((width * height) / max(1, w * h)))
                else:
                    scale = min(1.0, REF_IMAGE_SHORT_EDGE / max(1, min(w, h)))
                tw = max(CANVAS_MULTIPLE, round(w * scale / CANVAS_MULTIPLE) * CANVAS_MULTIPLE)
                th = max(CANVAS_MULTIPLE, round(h * scale / CANVAS_MULTIPLE) * CANVAS_MULTIPLE)
                resized = _resize(image[:1], tw, th, "disabled")
                ref_items.append({"type": "image", "data": resized})
                z = vae.encode(resized)
                ref_blocks.append({
                    "kind": "image",
                    "latent_h": th // 16,
                    "latent_w": tw // 16,
                    "latent": z,
                })
                if item.get("voice"):
                    ref_items.append({"type": "audio"})
                    ref_blocks.append(voice_audio_block(item))
                continue

            # RefMod visual — every member in the bundle
            if vae is not None:
                baked = ensure_preview(item["refmod"], vae=vae)
                if baked.get("source") in ("looks", "vae"):
                    notes.append(f"{item['refmod']}: preview from {baked['source']}.")
            loaded = load_visual(item["refmod"], item["strength"])
            if not push_visual_refs(ref_items, ref_blocks, loaded):
                notes.append(
                    f"{item['refmod']}: no looks for CLIP; DiT still gets the stored latent."
                )
            n_mem = int(loaded.get("member_count") or 1)
            if n_mem > 1:
                notes.append(f"{item['refmod']}: {n_mem} visual members applied.")
            if item.get("voice"):
                ref_items.append({"type": "audio"})
                ref_blocks.append(voice_audio_block(item))

        tokens = clip.tokenize(info["prompt"], minimax_ref_items=ref_items)
        cond = clip.encode_from_tokens_scheduled(tokens)
        if ref_blocks:
            cond = node_helpers.conditioning_set_values(cond, {"minimax_refs": ref_blocks})
        report = info["report"]
        if notes:
            report = report + "\n" + "\n".join(dict.fromkeys(notes))
        return (cond, latent, info["prompt"], report)


def register_hybrid_routes():
    from aiohttp import web
    from server import PromptServer

    @PromptServer.instance.routes.post("/h3subjecthybrid/assemble")
    async def _hybrid_assemble(request):
        try:
            data = await request.json()
            result = await asyncio.get_running_loop().run_in_executor(
                None, lambda: annotate(data if isinstance(data, dict) else {}))
            return web.json_response(result)
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.get("/h3subjecthybrid/images")
    async def _hybrid_images(_request):
        from .hybrid_stills import list_input_images
        try:
            return web.json_response(list_input_images())
        except Exception as exc:
            return web.json_response({"error": str(exc), "files": [], "folders": []}, status=400)

    @PromptServer.instance.routes.get("/h3subjecthybrid/wardrobe")
    async def _hybrid_wardrobe(_request):
        from .wardrobe import list_catalogue
        try:
            return web.json_response(list_catalogue())
        except Exception as exc:
            return web.json_response(
                {"error": str(exc), "categories": [], "items": []}, status=400)

    @PromptServer.instance.routes.get("/h3subjecthybrid/wardrobe/photo")
    async def _hybrid_wardrobe_photo(request):
        from .wardrobe import _contained, _photo_roots
        rel = str(request.rel_url.query.get("file") or "").replace("\\", "/").lstrip("/")
        path = ""
        for root in _photo_roots():
            path = _contained(root, rel)
            if path:
                break
        if not path:
            return web.Response(status=404, text="not found")
        try:
            with open(path, "rb") as handle:
                raw = handle.read()
        except OSError as exc:
            return web.Response(status=404, text=str(exc))
        ext = os.path.splitext(path)[1].lower()
        ctype = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".bmp": "image/bmp",
        }.get(ext, "application/octet-stream")
        return web.Response(body=raw, content_type=ctype, headers={"Cache-Control": "no-store"})

    @PromptServer.instance.routes.post("/h3subjecthybrid/wardrobe/add")
    async def _hybrid_wardrobe_add(request):
        try:
            from .wardrobe import add_set
            data = await request.json()
            item = await asyncio.get_running_loop().run_in_executor(
                None,
                lambda: add_set(
                    data.get("photo_path") or data.get("path") or "",
                    name=data.get("name") or "",
                    desc=data.get("desc") or "",
                    cat=data.get("cat") or "custom",
                ),
            )
            return web.json_response({"ok": True, "item": item})
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.post("/h3subjecthybrid/wardrobe/upload")
    async def _hybrid_wardrobe_upload(request):
        """Paste / drop / file-pick → pack wardrobe (no Comfy input folder)."""
        try:
            from .wardrobe import add_set_bytes
            post = await request.post()
            field = post.get("photo") or post.get("image") or post.get("file")
            if field is None:
                return web.json_response({"error": "No photo field"}, status=400)
            raw = field.file.read() if hasattr(field, "file") else bytes(field)
            filename = getattr(field, "filename", None) or "paste.png"
            name = str(post.get("name") or "")
            desc = str(post.get("desc") or "")
            cat = str(post.get("cat") or "custom")
            item = await asyncio.get_running_loop().run_in_executor(
                None,
                lambda: add_set_bytes(raw, filename=filename, name=name, desc=desc, cat=cat),
            )
            return web.json_response({"ok": True, "item": item})
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.post("/h3subjecthybrid/wardrobe/update")
    async def _hybrid_wardrobe_update(request):
        try:
            from .wardrobe import update_item
            data = await request.json()
            item = await asyncio.get_running_loop().run_in_executor(
                None,
                lambda: update_item(
                    data.get("photo") or data.get("image") or "",
                    name=data.get("name"),
                    desc=data.get("desc"),
                ),
            )
            return web.json_response({"ok": True, "item": item})
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.get("/h3subjecthybrid/library")
    async def _hybrid_library_get(request):
        from .library import get_entry
        kind = str(request.rel_url.query.get("kind") or "image")
        name = str(request.rel_url.query.get("name") or "")
        try:
            entry = get_entry(kind, name)
            return web.json_response({"entry": entry})
        except Exception as exc:
            return web.json_response({"error": str(exc), "entry": None}, status=400)

    @PromptServer.instance.routes.post("/h3subjecthybrid/library")
    async def _hybrid_library_put(request):
        try:
            from .library import upsert_entry
            data = await request.json()
            entry = await asyncio.get_running_loop().run_in_executor(
                None,
                lambda: upsert_entry(
                    data.get("kind") or "image",
                    data.get("name") or data.get("image") or data.get("refmod") or "",
                    who=data.get("who") or "",
                    keep=data.get("keep") or "",
                    concept=data.get("concept") or "identity",
                    marker=data.get("marker") or "fully_preserved",
                    title=data.get("title") or data.get("label") or "",
                ),
            )
            return web.json_response({"ok": True, "entry": entry})
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @PromptServer.instance.routes.post("/h3subjecthybrid/vision")
    async def _hybrid_vision(request):
        try:
            from .vision import answer
            data = await request.json()
            result = await asyncio.get_running_loop().run_in_executor(None, lambda: answer(data))
            return web.json_response(result)
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)
