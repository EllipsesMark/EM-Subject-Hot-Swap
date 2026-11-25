"""Delete a finished RefMod from models/refmods/ (safetensors + preview sidecar)."""

from __future__ import annotations

import os


def _under_roots(path, roots):
    real = os.path.realpath(path)
    for root in roots:
        try:
            root_real = os.path.realpath(root)
            if os.path.commonpath([root_real, real]) == root_real:
                return True
        except ValueError:
            continue
    return False


def sidecar_paths(safetensors_path):
    """Primary file + preview JPEG next to it."""
    base = os.path.splitext(safetensors_path)[0]
    return [
        safetensors_path,
        base + ".preview.jpg",
        base + ".preview.jpeg",
        base + ".preview.png",
    ]


def delete_refmod(name, *, confirm=False):
    """Remove ``name`` from the RefMod folder.

    Returns a short report. Refuses unless ``confirm`` is true. Only deletes
    files that resolve under models/refmods/.
    """
    from .refmods import htc

    label = str(name or "").strip().replace("\\", "/")
    if not label:
        raise ValueError("RefMod name is empty")
    if not confirm:
        return f"not deleted — turn Confirm on to remove {label}"

    module = htc()
    path = module.resolve(label)
    if not path or not os.path.isfile(path):
        raise ValueError(f"RefMod not found: {label}")
    roots = list(module.roots() or [])
    if not roots or not _under_roots(path, roots):
        raise ValueError(f"Refused to delete outside RefMod roots: {path}")

    removed = []
    for candidate in sidecar_paths(path):
        if not os.path.isfile(candidate):
            continue
        os.remove(candidate)
        removed.append(os.path.basename(candidate))
    try:
        from .bake_previews import drop_token_looks
        if drop_token_looks(label, path=path):
            removed.append(".h3looks cache")
    except Exception:
        pass

    if os.path.isfile(path):
        raise ValueError(f"Failed to delete {path}")

    report = f"deleted={label}\n  " + ("\n  ".join(removed) if removed else "(nothing)")
    print(f"[H3DeleteRefMod] {report.replace(chr(10), ' | ')}", flush=True)
    return report
