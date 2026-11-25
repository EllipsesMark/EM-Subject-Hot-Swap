"""Load input / pack wardrobe stills for the hybrid prompt node."""

from __future__ import annotations

import os

import numpy as np
import torch
from PIL import Image, ImageOps, ImageSequence

import folder_paths
import node_helpers

from .wardrobe import PREFIX as WARDROBE_PREFIX  # noqa: F401 — re-export
from .wardrobe import resolve_image as resolve_wardrobe_or_input


def resolve_image(filename):
    name = str(filename or "").strip().replace("\\", "/")
    if not name:
        return ""
    try:
        path = resolve_wardrobe_or_input(name)
    except ValueError:
        return ""
    if path and os.path.isfile(path):
        return path
    return ""


def load_still(filename):
    """One RGB frame, float 0-1, shape [1, H, W, 3]."""
    path = resolve_image(filename)
    if not path or not os.path.isfile(path):
        raise ValueError(f"Image file not found: {filename}")
    img = node_helpers.pillow(Image.open, path)
    frame = None
    for item in ImageSequence.Iterator(img):
        frame = node_helpers.pillow(ImageOps.exif_transpose, item).convert("RGB")
        break
    if frame is None:
        raise ValueError(f"Image file has no frames: {filename}")
    array = np.array(frame).astype(np.float32) / 255.0
    return torch.from_numpy(array).unsqueeze(0)


def list_input_images():
    """Flat list of image paths under the Comfy input folder."""
    root = folder_paths.get_input_directory()
    exts = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}
    files = []
    folders = set()
    if not os.path.isdir(root):
        return {"files": [], "folders": []}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [name for name in dirnames if not name.startswith(".")]
        rel_dir = os.path.relpath(dirpath, root).replace("\\", "/")
        if rel_dir == ".":
            rel_dir = ""
        else:
            folders.add(rel_dir)
        for filename in filenames:
            if os.path.splitext(filename)[1].lower() not in exts:
                continue
            rel = f"{rel_dir}/{filename}" if rel_dir else filename
            full = os.path.join(dirpath, filename)
            try:
                mtime = os.path.getmtime(full)
            except OSError:
                mtime = 0.0
            files.append({
                "path": rel.replace("\\", "/"),
                "folder": rel_dir,
                "name": filename,
                "mtime": mtime,
            })
    files.sort(key=lambda item: (-float(item.get("mtime") or 0), item["path"].lower()))
    return {"files": files, "folders": sorted(folders, key=str.lower)}
