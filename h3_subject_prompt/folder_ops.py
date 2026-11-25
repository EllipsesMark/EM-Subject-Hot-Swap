"""Organize RefMods into real subfolders under models/refmods/."""

from __future__ import annotations

import os
import re
import shutil

from .delete_refmod import _under_roots, sidecar_paths

TAG = "H3RefModFolders"
_FOLDER_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._\- ]{0,62}$")


def _primary_root(module):
    roots = list(module.roots() or [])
    if not roots:
        raise ValueError(f"{TAG}: no models/refmods root")
    return roots[0]


def _clean_folder(raw):
    """One path segment, or empty for root. Nested paths not supported yet."""
    text = str(raw or "").strip().replace("\\", "/").strip("/")
    if not text:
        return ""
    if "/" in text:
        raise ValueError(f"{TAG}: nested folders not supported yet — use one segment")
    if text in (".", "..") or text.startswith("."):
        raise ValueError(f"{TAG}: invalid folder name")
    if not _FOLDER_RE.match(text):
        raise ValueError(
            f"{TAG}: folder names are letters, numbers, space, . _ - (got {text!r})"
        )
    return text


def list_folders():
    """Immediate subfolders under every refmods root (includes empty ones)."""
    from .refmods import htc

    module = htc()
    names = set()
    for root in module.roots() or []:
        if not os.path.isdir(root):
            continue
        try:
            for entry in os.listdir(root):
                full = os.path.join(root, entry)
                if not os.path.isdir(full):
                    continue
                if entry in getattr(module, "SKIP_DIRS", set()) or entry.startswith("."):
                    continue
                names.add(entry)
        except OSError:
            continue
    return {"folders": sorted(names, key=lambda s: s.lower())}


def mkdir_folder(name):
    """Create an empty folder under the primary models/refmods root."""
    from .refmods import htc

    folder = _clean_folder(name)
    if not folder:
        raise ValueError(f"{TAG}: folder name is empty")
    module = htc()
    root = _primary_root(module)
    dest = os.path.join(root, folder)
    if os.path.isdir(dest):
        return {"ok": True, "folder": folder, "created": False, "path": dest}
    if os.path.exists(dest):
        raise ValueError(f"{TAG}: {folder!r} exists and is not a folder")
    os.makedirs(dest, exist_ok=False)
    print(f"[{TAG}] mkdir {dest}", flush=True)
    return {"ok": True, "folder": folder, "created": True, "path": dest}


def _basename_stem(name):
    rel = str(name or "").strip().replace("\\", "/").strip("/")
    return rel.split("/")[-1] if rel else ""


def _pair_candidates(stem):
    """Likely voice / visual companions when moving a Brandi-style split pair."""
    stem = str(stem or "")
    out = []
    if re.search(r"_refmod_visual$", stem, flags=re.I):
        base = re.sub(r"(_refmod)?_visual$", "", stem, flags=re.I)
        out.extend([base + "_refmod_audio", base + "_audio"])
    elif re.search(r"_refmod_audio$", stem, flags=re.I):
        base = re.sub(r"(_refmod)?_audio$", "", stem, flags=re.I)
        out.extend([base + "_refmod_visual", base + "_visual"])
    elif re.search(r"_visual$", stem, flags=re.I):
        base = re.sub(r"_visual$", "", stem, flags=re.I)
        out.append(base + "_audio")
    elif re.search(r"_audio$", stem, flags=re.I):
        base = re.sub(r"_audio$", "", stem, flags=re.I)
        out.append(base + "_visual")
    return out


def move_refmod(name, folder="", *, move_pair=True):
    """Move a RefMod (+ preview sidecars) into ``folder`` (empty = root).

    When ``move_pair`` is true, also moves a matching split voice/visual sibling
    if it sits beside the source. Returns old/new names for UI remaps.
    """
    from .refmods import htc

    label = str(name or "").strip().replace("\\", "/")
    if not label:
        raise ValueError(f"{TAG}: RefMod name is empty")
    dest_folder = _clean_folder(folder)
    module = htc()
    path = module.resolve(label)
    if not path or not os.path.isfile(path):
        raise ValueError(f"{TAG}: RefMod not found: {label}")
    roots = list(module.roots() or [])
    if not roots or not _under_roots(path, roots):
        raise ValueError(f"{TAG}: refused to move outside RefMod roots: {path}")

    stem = _basename_stem(label)
    if not stem:
        raise ValueError(f"{TAG}: bad RefMod name")
    # Prefer the root that currently holds the file.
    src_root = None
    for root in roots:
        try:
            if os.path.commonpath([os.path.realpath(root), os.path.realpath(path)]) == os.path.realpath(root):
                src_root = root
                break
        except ValueError:
            continue
    if not src_root:
        src_root = roots[0]

    dest_dir = os.path.join(src_root, dest_folder) if dest_folder else src_root
    os.makedirs(dest_dir, exist_ok=True)
    new_rel = f"{dest_folder}/{stem}" if dest_folder else stem
    if new_rel.replace("\\", "/") == label:
        return {
            "ok": True,
            "name": label,
            "old_name": label,
            "moved": [],
            "unchanged": True,
        }

    dest_path = os.path.join(dest_dir, stem + ".safetensors")
    if os.path.exists(dest_path):
        raise ValueError(f"{TAG}: destination already has {new_rel}")

    moved = []
    for candidate in sidecar_paths(path):
        if not os.path.isfile(candidate):
            continue
        base = os.path.basename(candidate)
        target = os.path.join(dest_dir, base)
        if os.path.exists(target):
            raise ValueError(f"{TAG}: destination already has {base}")
        shutil.move(candidate, target)
        moved.append(base)
    try:
        from .bake_previews import move_token_looks
        if move_token_looks(path, dest_path):
            moved.append(".h3looks cache")
    except Exception:
        pass

    # Invalidate any header cache keyed by old path.
    if hasattr(module, "_invalidate_header_cache"):
        try:
            module._invalidate_header_cache(path)
        except Exception:
            pass

    pairs = []
    if move_pair:
        # Old relative dir of the source (so we look for siblings next to it).
        old_dir = "/".join(label.split("/")[:-1])
        for cand_stem in _pair_candidates(stem):
            cand_name = f"{old_dir}/{cand_stem}" if old_dir else cand_stem
            if module.resolve(cand_name):
                pairs.append(cand_name)

    pair_results = []
    for pair_name in pairs:
        try:
            pair_results.append(
                move_refmod(pair_name, dest_folder, move_pair=False)
            )
        except Exception as exc:
            pair_results.append({"ok": False, "old_name": pair_name, "error": str(exc)})

    print(f"[{TAG}] move {label} → {new_rel}", flush=True)
    return {
        "ok": True,
        "name": new_rel,
        "old_name": label,
        "moved": moved,
        "unchanged": False,
        "pairs": pair_results,
    }
