"""Clothing catalogue for Hybrid / Create.

Shipped sets live in this pack under ``data/wardrobe`` + ``data/wardrobe.json``.
Add-clothing writes into pack ``data/wardrobe/custom/``. Self-contained —
no other clothing pack required.

A pick stores ``wardrobe:<photo>`` on the image row. Nothing is copied into
ComfyUI's input folder.
"""

from __future__ import annotations

import json
import os
import re

PREFIX = "wardrobe:"
_PREAMBLE = re.compile(r"^(?:the|this)\s+outfit\s+consists\s+of\s+", re.I)


def pieces_of(desc):
    text = " ".join(str(desc or "").split()).strip().rstrip(".!?")
    return _PREAMBLE.sub("", text).strip()


def _pack_dir():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _pack_data():
    return os.path.join(_pack_dir(), "data")


def _photo_roots():
    """Pack-local wardrobe only (shipped + in-node custom adds)."""
    shipped = os.path.join(_pack_data(), "wardrobe")
    return [shipped] if os.path.isdir(shipped) else []


def _json_paths():
    pack_json = os.path.join(_pack_data(), "wardrobe.json")
    return [pack_json] if os.path.isfile(pack_json) else []


def _contained(root, rel):
    rel = str(rel or "").replace("\\", "/").lstrip("/")
    parts = [part for part in rel.split("/") if part not in ("", ".")]
    if not rel or not parts or any(part == ".." for part in parts):
        return ""
    root_real = os.path.realpath(root)
    path = os.path.realpath(os.path.join(root_real, *parts))
    try:
        inside = os.path.commonpath([root_real, path]) == root_real
    except ValueError:
        inside = False
    if not inside or not os.path.isfile(path):
        return ""
    return path


def resolve_image(filename):
    """``wardrobe:`` stays in the catalogue; anything else is an input file."""
    name = str(filename or "").strip()
    if name.lower().startswith(PREFIX):
        rel = name[len(PREFIX):]
        if not rel or ".." in rel.replace("\\", "/").split("/"):
            raise ValueError(f"Clothing set image not found: {rel}")
        for root in _photo_roots():
            path = _contained(root, rel)
            if path:
                return path
        raise ValueError(f"Clothing set image not found: {rel}")
    import folder_paths
    return folder_paths.get_annotated_filepath(name)


def _read_json(path):
    try:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


def list_catalogue():
    """Pack clothing sets only (shipped + custom adds)."""
    categories = []
    seen_cats = set()
    items = []
    seen_photos = set()

    def add_cat(cat):
        if not isinstance(cat, dict) or not cat.get("id"):
            return
        cid = str(cat["id"])
        if cid in seen_cats:
            return
        seen_cats.add(cid)
        categories.append({"id": cid, "label": str(cat.get("label") or cid)})

    def add_item(item):
        if not isinstance(item, dict):
            return
        photo = str(item.get("photo") or "").replace("\\", "/").lstrip("/")
        if not photo or photo in seen_photos:
            return
        if not any(_contained(root, photo) for root in _photo_roots()):
            return
        seen_photos.add(photo)
        items.append({
            "id": str(item.get("id") or photo),
            "cat": str(item.get("cat") or "custom"),
            "name": str(item.get("name") or "Clothing set"),
            "desc": str(item.get("desc") or ""),
            "photo": photo,
        })

    for path in _json_paths():
        shipped = _read_json(path)
        for cat in shipped.get("categories") or []:
            add_cat(cat)
        for item in shipped.get("items") or []:
            add_item(item)

    return {"categories": categories, "items": items, "roots": _photo_roots()}


def _pack_json_path():
    return os.path.join(_pack_data(), "wardrobe.json")


def _ensure_pack_store():
    path = _pack_json_path()
    os.makedirs(_pack_data(), exist_ok=True)
    os.makedirs(os.path.join(_pack_data(), "wardrobe"), exist_ok=True)
    data = _read_json(path) if os.path.isfile(path) else {}
    if not isinstance(data.get("categories"), list):
        data["categories"] = [{"id": "custom", "label": "Yours"}]
    if not isinstance(data.get("items"), list):
        data["items"] = []
    if "v" not in data:
        data["v"] = 1
    # Ensure custom category exists
    if not any(str(c.get("id")) == "custom" for c in data["categories"] if isinstance(c, dict)):
        data["categories"].append({"id": "custom", "label": "Yours"})
    return path, data


def _write_pack_store(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=1, ensure_ascii=False)
        handle.write("\n")
    os.replace(tmp, path)


def _safe_stem(text):
    text = re.sub(r"[^\w.\-]+", "_", str(text or "").strip()).strip("._")
    return text or "outfit"


_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}


def _append_pack_item(dest_rel, name, desc, cat="custom"):
    path, data = _ensure_pack_store()
    rel = str(dest_rel or "").replace("\\", "/").lstrip("/")
    title = str(name or "").strip() or os.path.splitext(os.path.basename(rel))[0] or "Clothing set"
    item = {
        "id": rel.replace("/", "_"),
        "cat": str(cat or "custom").strip() or "custom",
        "name": title,
        "desc": str(desc or "").strip(),
        "photo": rel,
    }
    data["items"].append(item)
    _write_pack_store(path, data)
    return item


def _unique_custom_dest(title, ext):
    ext = (ext or ".png").lower()
    if ext not in _IMAGE_EXTS:
        raise ValueError(f"Not an image extension: {ext}")
    stem = _safe_stem(title)
    dest_dir = os.path.join(_pack_data(), "wardrobe", "custom")
    os.makedirs(dest_dir, exist_ok=True)
    rel = f"custom/{stem}{ext}"
    dest = os.path.join(dest_dir, stem + ext)
    n = 2
    while os.path.isfile(dest):
        rel = f"custom/{stem}_{n}{ext}"
        dest = os.path.join(dest_dir, f"{stem}_{n}{ext}")
        n += 1
    return rel, dest


def add_set_bytes(raw, filename="", name="", desc="", cat="custom"):
    """Write pasted/dropped image bytes straight into pack data/wardrobe."""
    if not raw:
        raise ValueError("No image bytes")
    fname = str(filename or "paste.png")
    ext = os.path.splitext(fname)[1].lower() or ".png"
    if ext not in _IMAGE_EXTS:
        # Clipboard pastes often arrive as image/png with a blank name.
        ext = ".png"
    title = str(name or "").strip() or os.path.splitext(os.path.basename(fname))[0] or "pasted outfit"
    rel, dest = _unique_custom_dest(title, ext)
    with open(dest, "wb") as handle:
        handle.write(raw)
    return _append_pack_item(rel, title, desc, cat=cat)


def add_set(photo_path, name="", desc="", cat="custom"):
    """Copy an input (or absolute) photo into pack data/wardrobe and append JSON."""
    import folder_paths
    import shutil

    raw = str(photo_path or "").strip()
    if not raw:
        raise ValueError("photo_path is empty")
    if os.path.isfile(raw):
        src = raw
    else:
        try:
            src = folder_paths.get_annotated_filepath(raw)
        except Exception:
            src = ""
        if not src or not os.path.isfile(src):
            raise ValueError(f"Image not found: {photo_path}")

    ext = os.path.splitext(src)[1].lower() or ".png"
    if ext not in _IMAGE_EXTS:
        raise ValueError(f"Not an image: {src}")

    title = str(name or "").strip() or os.path.splitext(os.path.basename(src))[0]
    rel, dest = _unique_custom_dest(title, ext)
    shutil.copy2(src, dest)
    return _append_pack_item(rel, title, desc, cat=cat)


def update_item(photo, name=None, desc=None):
    """Update (or upsert) a catalogue entry in pack data/wardrobe.json.

    Full paragraph ``desc`` is kept intact. Entries are keyed by relative
    photo path under pack ``data/wardrobe/``.
    """
    rel = str(photo or "").replace("\\", "/").lstrip("/")
    if rel.lower().startswith(PREFIX):
        rel = rel[len(PREFIX):].lstrip("/")
    if not rel or ".." in rel.split("/"):
        raise ValueError(f"Bad wardrobe photo: {photo}")

    path, data = _ensure_pack_store()
    found = None
    for item in data["items"]:
        if not isinstance(item, dict):
            continue
        if str(item.get("photo") or "").replace("\\", "/").lstrip("/") == rel:
            found = item
            break
    if found is None:
        found = {
            "id": rel.replace("/", "_"),
            "cat": "custom",
            "name": str(name or os.path.splitext(os.path.basename(rel))[0] or "Clothing set"),
            "desc": "",
            "photo": rel,
        }
        data["items"].append(found)
    if name is not None and str(name).strip():
        found["name"] = str(name).strip()
    if desc is not None:
        found["desc"] = str(desc).strip()
    _write_pack_store(path, data)
    return dict(found)
