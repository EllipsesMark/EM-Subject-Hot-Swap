"""Mode, duration, and alignment for the H3 image-to-video prompt."""

import re

from .prompt_writer import assemble, guides, validate

FPS = 24

_SHOT = re.compile(r"\[Shot\s+(\d+)\]", re.I)
_DURATION_MARK = re.compile(r"\d+\.\d{2}(?=-second mark)")
_FL2VA_PICTURE_2 = re.compile(r"Picture 2 \(from \[?Shot \d+\]?\)")
_L2VA_PICTURE = re.compile(r"<Picture 1> \(from \[?Shot \d+\]?\)")


def align_frame_count(n):
    """Snap up to the model's 17k+5 grid. Same rule as MiniMaxH3ImageToVideo."""
    n = int(n)
    if n < 5:
        n = 5
    while n % 17 != 5:
        n += 1
    return n


def duration_of(length):
    """Return (seconds, snapped frame count) for a length widget."""
    try:
        raw = int(length)
    except (TypeError, ValueError):
        raw = 124
    frames = align_frame_count(raw)
    return frames / float(FPS), frames


def detect_mode(has_first, has_last):
    """Wires select the mode. Neither wire is T2VA, video with audio."""
    if has_first and has_last:
        return "fl2va"
    if has_first:
        return "i2va"
    if has_last:
        return "l2va"
    return "t2va"


def load_writer():
    """Return the prompt-guide helpers bundled with this pack."""
    return guides, assemble, validate


def last_shot_index(text):
    nums = [int(match.group(1)) for match in _SHOT.finditer(text or "")]
    return max(nums) if nums else 1


def _split_first(text):
    if "\n" in text:
        first, rest = text.split("\n", 1)
        return first, rest
    return text, ""


def _join_first(first, rest):
    if not rest:
        return first
    return first + "\n" + rest


def align_prompt(text, mode, duration):
    """Make the opening line name the real duration and the last shot.

    Returns (prompt, notes). Notes are empty when the line was already right.
    """
    text = str(text or "").strip()
    notes = []
    if not text or mode not in ("fl2va", "l2va"):
        return text, notes
    dur = f"{float(duration):.2f}"
    first, rest = _split_first(text)
    updated, changed = _rewrite_duration(first, mode, dur)
    if changed:
        notes.append(f"duration mark set to {dur}")
        first = updated
    last = last_shot_index(_join_first(first, rest))
    updated, changed = _rewrite_shot(first, mode, last)
    if changed:
        notes.append(f"alignment shot set to Shot {last}")
        first = updated
    return _join_first(first, rest).strip(), notes


def _rewrite_duration(first, mode, dur):
    marks = list(_DURATION_MARK.finditer(first))
    if not marks:
        return first, False
    if mode == "fl2va" and len(marks) < 2:
        return first, False
    target = marks[-1]
    if target.group(0) == dur:
        return first, False
    if mode == "fl2va" and target.group(0) == "0.00":
        return first, False
    updated = first[:target.start()] + dur + first[target.end():]
    return updated, True


def _rewrite_shot(first, mode, last):
    if mode == "fl2va":
        updated, count = _FL2VA_PICTURE_2.subn(
            f"Picture 2 (from Shot {last})", first, count=1,
        )
        return updated, bool(count) and updated != first
    updated, count = _L2VA_PICTURE.subn(
        f"<Picture 1> (from [Shot {last}])", first, count=1,
    )
    return updated, bool(count) and updated != first


def finish_prompt(text, mode, duration):
    """Align the opening line, then check it against the base-guide rules."""
    text = str(text or "").strip()
    if not text:
        return {
            "prompt": "",
            "notes": [],
            "issues": ["Write the prompt, or accept a draft, before queuing."],
        }
    text, notes = align_prompt(text, mode, duration)
    _guides, _assemble, validate = load_writer()
    issues = validate.validate_base(text, mode, duration)
    return {"prompt": text, "notes": notes, "issues": issues}


def prepare(prompt, length, has_first, has_last):
    """What queue will encode, plus the mode the wires selected."""
    mode = detect_mode(has_first, has_last)
    duration, frames = duration_of(length)
    finished = finish_prompt(prompt, mode, duration)
    finished["mode"] = mode
    finished["duration"] = duration
    finished["frames"] = frames
    return finished
