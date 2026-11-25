"""Picture files for the test reference node.

Checked picture rows load in list order. An unchecked row does not take a
Picture number and does not need a file. The prompt text still comes from
assemble.build_prompt.
"""

from .assemble import assign, build_prompt

MAX_PICTURES = 9
MAX_AUDIOS = 3


def picture_slots(data):
    """Enabled picture rows as (picture number, name, filename)."""
    slots = []
    for item in assign((data or {}).get("subjects") or []):
        if item["kind"] != "picture":
            continue
        row = item["row"]
        name = str(row.get("name") or row.get("who") or "subject").strip() or "subject"
        filename = str(row.get("image") or "").strip()
        slots.append((item["picture"], name, filename))
    return slots


def _name(row):
    return str(row.get("name") or row.get("who") or "subject").strip() or "subject"


def video_slots(data):
    """Enabled video rows as (video number, name, filename). Empty filename = wire."""
    slots = []
    for item in assign((data or {}).get("subjects") or []):
        if item["kind"] != "video":
            continue
        row = item["row"]
        filename = str(row.get("video_file") or "").strip()
        slots.append((item["video"], _name(row), filename))
    return slots


def audio_slots(data):
    """Enabled voice and audio rows as (audio number, name, filename)."""
    slots = []
    for item in assign((data or {}).get("subjects") or []):
        row = item["row"]
        filename = str(row.get("audio_file") or "").strip()
        start = row.get("audio_start") or 0
        end = row.get("audio_end") or 0
        if item.get("voice"):
            slots.append((item["voice"], _name(row) + " voice", filename, start, end))
        elif item["kind"] == "audio":
            slots.append((item["audio"], _name(row), filename, start, end))
    return slots


def clip_range(total_samples, sample_rate, start_s, end_s):
    """Sample range for a dragged window. A blank end means through the end of the file."""
    total = max(0, int(total_samples or 0))
    try:
        rate = int(sample_rate or 0)
    except (TypeError, ValueError):
        rate = 0
    if rate <= 0 or total <= 0:
        return 0, total
    try:
        start_s = float(start_s or 0)
    except (TypeError, ValueError):
        start_s = 0.0
    try:
        end_s = float(end_s or 0)
    except (TypeError, ValueError):
        end_s = 0.0
    if start_s < 0 or start_s != start_s:
        start_s = 0.0
    start = min(total, max(0, int(round(start_s * rate))))
    if end_s <= 0 or end_s != end_s:
        end = total
    else:
        end = min(total, max(0, int(round(end_s * rate))))
    if end <= start:
        end = total
    return start, end


def annotate(data):
    """Prompt plus a map that names the file each Picture number will load."""
    if not isinstance(data, dict):
        data = {}
    result = build_prompt(data)
    slots = picture_slots(data)
    by_picture = {number: filename for number, _name, filename in slots}
    for row in result["map"]:
        label = row.get("label") or ""
        if not label.startswith("Picture "):
            continue
        number = int(label.split()[1])
        row["file"] = by_picture.get(number, "")
        row["wire"] = "loaded"

    voices = audio_slots(data)
    by_audio = {slot[0]: slot[2] for slot in voices}
    for row in result["map"]:
        label = row.get("label") or ""
        if not label.startswith("Audio "):
            continue
        number = int(label.split()[1])
        row["file"] = by_audio.get(number, "")

    error = ""
    if len(slots) > MAX_PICTURES:
        error = f"MiniMax H3 takes at most {MAX_PICTURES} reference images. {len(slots)} pictures are checked."
    elif len(voices) > MAX_AUDIOS:
        error = f"MiniMax H3 takes at most {MAX_AUDIOS} standalone audio clips. {len(voices)} are checked."
    else:
        missing = [f"Picture {number} ({name})" for number, name, filename in slots if not filename]
        if missing:
            error = "These checked pictures have no image file: " + ", ".join(missing)

    lines = ["Checked pictures load inside this node. Picture 1 is the first checked picture."]
    if slots:
        for number, name, filename in slots:
            lines.append(f"Picture {number} · {name} · {filename or 'no file'}")
    else:
        lines.append("No pictures are switched on.")
    if voices:
        for slot in voices:
            number, name, filename = slot[0], slot[1], slot[2]
            lines.append(f"Audio {number} · {name} · {filename or 'no file'}")
    videos = video_slots(data)
    for number, name, filename in videos:
        lines.append(f"Video {number} · {name} · {filename or 'wire'}")
    for row in result["map"]:
        label = str(row.get("label") or "")
        if label.startswith(("Picture ", "Audio ", "Video ")):
            continue
        lines.append(f"{label} → {row['wire']} · {row['name']}")
    if videos:
        lines.append(
            "A video file loads inside this node (24 fps, first 15 s, soundtrack included). "
            "A soundtrack on that video takes an Audio number before the audio files."
        )
    result["report"] = "\n".join(lines)
    if error:
        result["error"] = error
    return result
