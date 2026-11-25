"""Draft a base-guide prompt with the pack's connected LLM loader.

Queue does not call this. The panel posts here, the button shows a clock,
and Accept copies the reply into the prompt that the encoder will see.
There is no Describe call. The base guide has no card to fill.
"""

import os
import re
import threading

from .prompt import detect_mode, duration_of, finish_prompt, load_writer

_LOCK = threading.Lock()

_PASS_STAY = (
    "Stay with the typed draft. Turn it into the three fields. "
    "Do not add events the draft did not ask for. "
    "Output the complete prompt, starting with the stamped prefix."
)
_PASS_EXPAND = (
    "The typed draft is the spine. Walk it across the clip: how it starts, "
    "what changes in the middle, and how it ends. "
    "Do not add a person or an event the draft did not ask for. "
    "Output the complete prompt, starting with the stamped prefix."
)


def clean_filename(value):
    text = str(value or "").strip()
    text = re.sub(r"\s*\[(input|output|temp)\]\s*$", "", text, flags=re.I).strip()
    text = text.replace("\\", "/").lstrip("/")
    if not text or any(part == ".." for part in text.split("/")):
        return ""
    return text


def _stay(data):
    return str((data or {}).get("pass") or "stay").lower() != "expand"


def draft_system(mode, duration, instructions=None, stay=True):
    """Sliced base guide for this mode, unless an override replaces it.

    Stay / Expand is added here, so an override cannot drop that pass.
    """
    guides, _assemble, _validate = load_writer()
    notes = instructions if isinstance(instructions, dict) else {}
    override = str(notes.get("override") or "").strip()
    body = override if override else guides.base_system(mode, duration)
    body += "\n\n" + (_PASS_STAY if stay else _PASS_EXPAND)
    extra = str(notes.get("extra") or "").strip()
    if extra:
        body += (
            "\n\nAdditional directives. Where they conflict with the above, these win. "
            "Still output only the three-field prompt.\n"
            + extra
        )
    return body


def builtin_guide():
    """I2VA slice at the default length, so an override box can start from it."""
    guides, _assemble, _validate = load_writer()
    return guides.base_system("i2va", 124 / 24.0)


_NO_FILE = (
    "{slot} is set, but Draft can only see a still with a filename. Pick the frame in the "
    "panel, or wire a Load Image node. Queue still encodes a generated frame."
)


def _image_specs(mode, first_file, last_file, first_linked, last_linked):
    """Which stills the writer should see. Raises when a frame has no filename."""
    specs = []
    if mode == "t2va":
        return specs
    if mode in ("i2va", "fl2va"):
        if not first_linked:
            raise ValueError("Pick or wire the first frame.")
        if not first_file:
            raise ValueError(_NO_FILE.format(slot="The first frame"))
        specs.append(("This image is <Picture 1>, the FIRST frame of the video.", first_file))
    if mode == "fl2va":
        if not last_linked:
            raise ValueError("Pick or wire the last frame.")
        if not last_file:
            raise ValueError(_NO_FILE.format(slot="The last frame"))
        specs.append(("This image is <Picture 2>, the LAST frame of the video.", last_file))
    if mode == "l2va":
        if not last_linked:
            raise ValueError("Pick or wire the last frame.")
        if not last_file:
            raise ValueError(_NO_FILE.format(slot="The last frame"))
        specs.append(("This image is <Picture 1>, the LAST frame of the video.", last_file))
    return specs


_MOTION = (
    ("weight", "Show the start, the carry, and the landing of the lead motion. Do not add a second motion."),
    ("contact", "Name both sides of each contact and the sound it makes. The reaction stays on that cycle."),
    ("follow", "Hair, breasts, soft tissue, and loose cloth answer the lead motion, and they move less than it. They are not a second action."),
    ("settle", "End on breathing or the body coming to rest. Do not add a new motion."),
)


def _motion_lines(data):
    chosen = data.get("motion") if isinstance(data.get("motion"), dict) else {}
    return [text for key, text in _MOTION if chosen.get(key)]


def plan_draft(data):
    """Build the chat messages except the JPEG bytes.

    Returns (messages_without_images, specs, meta). The user message is a list
    whose first part is the text. answer() appends the stills.
    """
    if not isinstance(data, dict):
        data = {}
    idea = str(data.get("idea") or "").strip()
    if not idea:
        raise ValueError("Write the draft first.")
    mode = detect_mode(bool(data.get("first_linked")), bool(data.get("last_linked")))
    duration, frames = duration_of(data.get("length"))
    style = str(data.get("style_mode") or "cinematic").strip() or "cinematic"
    shot = str(data.get("shot_size") or "medium shot").strip() or "medium shot"
    subject = str(data.get("subject") or "subject").strip() or "subject"
    stay = _stay(data)
    first_file = clean_filename(data.get("first_file"))
    last_file = clean_filename(data.get("last_file"))
    specs = _image_specs(
        mode, first_file, last_file,
        bool(data.get("first_linked")), bool(data.get("last_linked")),
    )
    guides, _assemble, _validate = load_writer()
    prefix = guides.stamped_prefix(mode, duration, style, shot, subject)
    motion = _motion_lines(data)
    header = (
        f"Task mode: {mode.upper()}\n"
        f"Video duration: {duration:.2f} seconds ({frames} frames at 24 fps).\n"
        f"{guides.style_mode_block(style)}\n"
        "STAMPED PREFIX — start your output with this exact text, then continue:\n"
        f"<<<\n{prefix}\n>>>\n\n"
        f"User intent:\n{idea}\n\n"
        + (_PASS_STAY if stay else _PASS_EXPAND)
    )
    if motion:
        header += "\n\nMotion to write into the shot:\n" + "\n".join(motion)
    system = draft_system(mode, duration, data.get("instructions"), stay)
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": [{"type": "text", "text": header}]},
    ]
    meta = {
        "mode": mode,
        "duration": duration,
        "frames": frames,
        "style": style,
        "shot": shot,
        "subject": subject,
    }
    return messages, specs, meta


def _under_models(name):
    import folder_paths

    rel = str(name or "").replace("\\", "/").lstrip("/")
    if not rel or rel == "none" or any(part == ".." for part in rel.split("/")):
        raise ValueError("Pick a GGUF and its matching mmproj on LLM (GGUF) - Loader.")
    root = os.path.realpath(folder_paths.models_dir)
    path = os.path.realpath(os.path.join(root, rel))
    try:
        inside = os.path.commonpath([root, path]) == root
    except ValueError:
        inside = False
    if not inside or not os.path.isfile(path):
        raise ValueError(f"GGUF not found: {rel}")
    return path


def loader_handle(loader):
    if not isinstance(loader, dict):
        raise ValueError("Connect LLM (GGUF) - Loader to the llm input and select a GGUF.")
    if str(loader.get("backend") or "gguf").lower() == "http":
        return {
            "backend": "http",
            "base_url": str(loader.get("base_url") or "").strip(),
            "model": str(loader.get("model") or "local").strip() or "local",
            "api_key": str(loader.get("api_key") or "none").strip() or "none",
        }
    model_name = str(loader.get("model_name") or "").strip()
    mmproj_name = str(loader.get("mmproj_name") or "").strip()
    if str(loader.get("backend") or "gguf").lower() == "http":
        return {
            "backend": "http",
            "base_url": str(loader.get("base_url") or "").strip(),
            "model": str(loader.get("model") or "local").strip() or "local",
            "api_key": str(loader.get("api_key") or "none").strip() or "none",
        }
    if not model_name or model_name.startswith("("):
        raise ValueError("Connect LLM (GGUF) - Loader to the llm input and select a GGUF.")
    if not mmproj_name or mmproj_name == "none":
        raise ValueError("Set the matching mmproj on LLM (GGUF) - Loader. none cannot see the still.")
    try:
        n_ctx = int(loader.get("n_ctx") or 16384)
    except (TypeError, ValueError):
        n_ctx = 16384
    try:
        n_gpu = int(-1 if loader.get("n_gpu_layers") is None else loader.get("n_gpu_layers"))
    except (TypeError, ValueError):
        n_gpu = -1
    return {
        "model_path": _under_models(model_name),
        "mmproj_path": _under_models(mmproj_name),
        "n_ctx": n_ctx,
        "n_gpu_layers": n_gpu,
        "keep_loaded": bool(loader.get("keep_loaded")),
    }


def _jpeg(filename):
    import base64
    import io

    import folder_paths
    import node_helpers
    from PIL import Image, ImageOps

    path = folder_paths.get_annotated_filepath(str(filename))
    if not path or not os.path.isfile(path):
        raise ValueError(f"Image file not found: {filename}")
    img = node_helpers.pillow(Image.open, path)
    frame = node_helpers.pillow(ImageOps.exif_transpose, img).convert("RGB")
    if max(frame.size) > 1024:
        scale = 1024 / max(frame.size)
        frame = frame.resize(
            (max(1, round(frame.width * scale)), max(1, round(frame.height * scale))),
            Image.LANCZOS,
        )
    buf = io.BytesIO()
    frame.save(buf, format="JPEG", quality=88)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _local_llm():
    from ..h3_llm import local_llm

    return local_llm


def _chat(handle, messages):
    local_llm = _local_llm()
    try:
        with _LOCK:
            return local_llm.chat(
                handle, messages, temperature=0.4 if _message_stays(messages) else 0.7,
                max_tokens=3072, seed=0 if _message_stays(messages) else -1,
            )
    except Exception as exc:
        raise ValueError(str(exc)) from exc


def _message_stays(messages):
    system = messages[0]["content"] if messages else ""
    return "Stay with the typed draft" in system


def _image_parts(specs):
    parts = []
    for label, filename in specs:
        parts.append({"type": "text", "text": label})
        parts.append({
            "type": "image_url",
            "image_url": {"url": "data:image/jpeg;base64," + _jpeg(filename)},
        })
    return parts


def _report(meta, notes, issues):
    lines = [
        f"mode: {meta['mode']}",
        f"duration: {meta['duration']:.2f}s",
        f"frames: {meta['frames']}",
        f"style: {meta['style']}",
        f"shot_size: {meta['shot']}",
    ]
    lines.extend(notes)
    if issues:
        lines.append("VALIDATION ISSUES:")
        lines.extend(f"- {item}" for item in issues)
    else:
        lines.append("validation: OK")
    return "\n".join(lines)


def answer(data):
    """Run one Draft call. data is the JSON body from the panel."""
    if not isinstance(data, dict):
        data = {}
    if str(data.get("job") or "draft") != "draft":
        raise ValueError("Unknown vision job.")
    handle = loader_handle(data.get("loader") or {})
    messages, specs, meta = plan_draft(data)
    messages[1]["content"].extend(_image_parts(specs))
    _guides, assemble, _validate = load_writer()
    raw = _chat(handle, messages)
    assembled = assemble.assemble_base_prompt(
        meta["mode"], meta["duration"], meta["style"], meta["shot"], raw, meta["subject"],
    )
    finished = finish_prompt(assembled, meta["mode"], meta["duration"])
    return {
        "prompt": finished["prompt"],
        "report": _report(meta, finished["notes"], finished["issues"]),
        "issues": finished["issues"],
    }
