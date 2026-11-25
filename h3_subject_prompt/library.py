"""Shared who/keep library for Ref / RefMod / Hybrid.

Stored under Comfy user data as ``h3subject/library.json`` so all three
nodes restore captions when the same image or RefMod is picked again.
Also migrates legacy ``h3subjectref/subjects/*.json`` on first read.
"""

from __future__ import annotations

import json
import os
import re


def _user_default():
    try:
        import folder_paths
        return os.path.join(folder_paths.get_user_directory(), "default")
    except Exception:
        return ""


def library_path():
    root = _user_default()
    if not root:
        return ""
    return os.path.join(root, "h3subject", "library.json")


def _legacy_subjects_dir():
    root = _user_default()
    if not root:
        return ""
    return os.path.join(root, "h3subjectref", "subjects")


def _key_for(kind, name):
    kind = str(kind or "").strip().lower()
    name = str(name or "").strip().replace("\\", "/")
    if not name:
        return ""
    if kind == "refmod":
        return "refmod:" + name
    if name.lower().startswith("wardrobe:"):
        return "wardrobe:" + name.split(":", 1)[-1].lstrip("/")
    if name.lower().startswith("image:"):
        return "image:" + name.split(":", 1)[-1].lstrip("/")
    if kind == "wardrobe" or name.startswith("wardrobe:"):
        return "wardrobe:" + name[len("wardrobe:"):] if name.startswith("wardrobe:") else "wardrobe:" + name
    return "image:" + name


def _read_json(path):
    try:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def _write_json(path, data):
    folder = os.path.dirname(path)
    os.makedirs(folder, exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    os.replace(tmp, path)


def _migrate_legacy(store):
    """Pull once from h3subjectref/subjects into the flat library."""
    folder = _legacy_subjects_dir()
    if not folder or not os.path.isdir(folder):
        return store
    entries = store.setdefault("entries", {})
    if not isinstance(entries, dict):
        entries = {}
        store["entries"] = entries
    for name in os.listdir(folder):
        if not name.lower().endswith(".json"):
            continue
        path = os.path.join(folder, name)
        data = _read_json(path)
        if not data:
            continue
        image = str(data.get("image") or "").strip()
        refmod = str(data.get("refmod") or "").strip()
        payload = {
            "who": str(data.get("who") or "").strip(),
            "keep": str(data.get("keep") or "").strip(),
            "concept": str(data.get("concept") or data.get("role") or "identity").strip(),
            "marker": str(data.get("marker") or "fully_preserved").strip(),
            "name": str(data.get("name") or name[:-5]).strip(),
        }
        if image:
            entries[_key_for("image", image)] = payload
        if refmod:
            entries[_key_for("refmod", refmod)] = payload
    store["legacy_migrated"] = True
    return store


def load_library():
    path = library_path()
    store = _read_json(path) if path else {}
    if not store.get("legacy_migrated"):
        store = _migrate_legacy(store)
        if path and store.get("entries"):
            try:
                _write_json(path, store)
            except OSError:
                pass
    if "entries" not in store or not isinstance(store["entries"], dict):
        store["entries"] = {}
    return store


def get_entry(kind, name):
    key = _key_for(kind, name)
    if not key:
        return None
    entry = load_library()["entries"].get(key)
    return dict(entry) if isinstance(entry, dict) else None


def upsert_entry(kind, name, *, who="", keep="", concept="identity", marker="fully_preserved", title=""):
    path = library_path()
    if not path:
        raise ValueError("ComfyUI user directory is not available.")
    key = _key_for(kind, name)
    if not key:
        raise ValueError("Library key is empty.")
    store = load_library()
    store["entries"][key] = {
        "who": str(who or "").strip(),
        "keep": str(keep or "").strip(),
        "concept": str(concept or "identity").strip(),
        "marker": str(marker or "fully_preserved").strip(),
        "name": str(title or "").strip(),
    }
    _write_json(path, store)
    return {"key": key, **store["entries"][key]}


def lookup_for_row(source, image="", refmod=""):
    """Best library hit for a Hybrid/RefMod row."""
    source = str(source or "").lower()
    if source == "image" and image:
        return get_entry("image", image)
    if refmod:
        return get_entry("refmod", refmod)
    if image:
        return get_entry("image", image)
    return None
