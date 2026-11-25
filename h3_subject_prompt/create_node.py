"""H3 Create RefMod — folder path + name + user-settable encode options."""

from __future__ import annotations

from .create_refmod import encode_settings_from


class H3CreateRefMod:
    """Create a visual (± audio) RefMod in one node.

    Wire the H3 video VAE, paste a photos folder path (absolute, or under
    ComfyUI input/), set name/description, choose encode layout, and Queue.
    Optional image/video/audio sockets. Audio-only needs audio + audio_vae.
    """

    CATEGORY = "H3 Prompt"
    FUNCTION = "create"
    RETURN_TYPES = ("STRING", "STRING", "IMAGE")
    RETURN_NAMES = ("name", "report", "preview")
    OUTPUT_NODE = True
    DESCRIPTION = (
        "Make an identity RefMod from a photo folder (or image sockets), "
        "or an audio-only voice RefMod. Paste the folder path, pick separate "
        "stills or stacked video, encode size, and pack mode. Leave name blank "
        "to use the folder / audio file name."
    )

    @classmethod
    def INPUT_TYPES(cls):
        from .create_refmod import QUALITY
        from .refmods import htc
        # Always keep voice — HTC CONCEPT_ROLES is visual-only, but audio-only
        # creates need role=voice and Comfy validates the combo before execute.
        roles = ["identity", "wardrobe", "background", "generic", "voice"]
        try:
            for role in htc().CONCEPT_ROLES:
                if role not in roles:
                    roles.append(role)
        except Exception:
            pass
        q = QUALITY
        return {
            "required": {
                "folder": ("STRING", {
                    "default": "",
                    "tooltip": "Folder of photos/videos. Absolute path, or under ComfyUI input/. Optional for audio-only.",
                }),
                "name": ("STRING", {
                    "default": "",
                    "tooltip": "File name under models/refmods/. Blank = folder or audio name.",
                }),
                "build": (["start", "stop"], {
                    "default": "start",
                    "tooltip": "start encodes and writes. stop skips so the graph can queue safely.",
                }),
            },
            "optional": {
                "vae": ("VAE", {
                    "tooltip": "MiniMax H3 video VAE. Required when there are visuals.",
                }),
                "description": ("STRING", {
                    "default": "",
                    "multiline": True,
                    "tooltip": "Who / caption stored in the RefMod (picker + prompt).",
                }),
                "role": (roles, {
                    "default": "identity",
                    "tooltip": "Usually identity for a person, voice for audio-only.",
                }),
                "layout": (["separate_pictures", "stacked_video"], {
                    "default": q["layout"],
                    "tooltip": "separate_pictures = each still its own member. stacked_video = one time-axis latent.",
                }),
                "pack": (["single", "per_file"], {
                    "default": q["pack"],
                    "tooltip": "single = one RefMod. per_file = one RefMod per media file.",
                }),
                "fit_mode": (["crop", "pad", "stretch"], {
                    "default": q["fit_mode"],
                    "tooltip": "How each still is fit onto the encode canvas.",
                }),
                "step_curve": (["full", "early_lock", "late_detail", "fade", "mid_peak"], {
                    "default": q["step_curve"],
                    "tooltip": "Default step curve stored on the RefMod.",
                }),
                "short_edge": ("INT", {
                    "default": int(q["short_edge"]),
                    "min": 256,
                    "max": 2048,
                    "step": 64,
                    "tooltip": "Encode short edge in px (H3 up to ~2K).",
                }),
                "max_edge": ("INT", {
                    "default": int(q["max_edge"]),
                    "min": 256,
                    "max": 4096,
                    "step": 64,
                    "tooltip": "Downscale source media long edge before encode.",
                }),
                "max_items": ("INT", {
                    "default": int(q["max_items"]),
                    "min": 1,
                    "max": 256,
                    "tooltip": "Max images/videos loaded from the folder.",
                }),
                "max_frames": ("INT", {
                    "default": int(q["max_frames"]),
                    "min": 2,
                    "max": 4800,
                    "tooltip": "Max frames kept from each source video.",
                }),
                "max_tokens": ("INT", {
                    "default": int(q["max_tokens"]),
                    "min": 0,
                    "max": 2147483647,
                    "tooltip": "0 = no token budget trim on encode.",
                }),
                "recursive": ("BOOLEAN", {
                    "default": bool(q["recursive"]),
                    "tooltip": "Also scan subfolders of the photos folder.",
                }),
                "images": ("IMAGE", {
                    "tooltip": "Optional wired stills (batch ok) instead of / with the folder.",
                }),
                "video": ("IMAGE", {
                    "tooltip": "Optional multi-frame clip as one video member.",
                }),
                "audio": ("AUDIO", {
                    "tooltip": "Optional voice. Needs audio_vae. Can be alone for audio-only.",
                }),
                "audio_vae": ("VAE", {
                    "tooltip": "MiniMax H3 audio VAE for the optional audio socket.",
                }),
            },
        }

    def create(
        self,
        folder="",
        name="",
        build="start",
        vae=None,
        description="",
        role="identity",
        layout=None,
        pack=None,
        fit_mode=None,
        step_curve=None,
        short_edge=None,
        max_edge=None,
        max_items=None,
        max_frames=None,
        max_tokens=None,
        recursive=None,
        images=None,
        video=None,
        audio=None,
        audio_vae=None,
        **_ignored,
    ):
        del _ignored
        from .bake_previews import set_audio_vae, set_preview_vae
        from .create_refmod import create_refmod

        settings = encode_settings_from(
            layout=layout,
            pack=pack,
            fit_mode=fit_mode,
            step_curve=step_curve,
            short_edge=short_edge,
            max_edge=max_edge,
            max_items=max_items,
            max_frames=max_frames,
            max_tokens=max_tokens,
            recursive=recursive,
        )
        if vae is not None:
            set_preview_vae(vae)
        if audio_vae is not None:
            set_audio_vae(audio_vae)
        report, written, preview = create_refmod(
            vae,
            name,
            images=images,
            video=video,
            folder=folder,
            paths="",
            audio=audio,
            audio_vae=audio_vae,
            description=description,
            role=role,
            subfolder="",
            **settings,
            build=build,
        )
        return (written, report, preview)
