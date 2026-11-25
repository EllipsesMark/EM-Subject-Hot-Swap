"""Seconds -> MiniMax H3 frame count.

Copied recipe from Duration Pixaroma (ComfyUI-Pixaroma, nodes/_duration_helpers.py):

    frames = round(seconds * fps)          at 24 fps
    frames = max(frames, 5)                H3's floor
    frames = snap UP to 17*n + 5           the shape the H3 sampler demands

5.0 s -> 120 -> 124 frames, which plays as 5.17 s. The true length is what the
panel shows, because snapping moves the clip and anything timed to it drifts.
"""

FPS = 24
STEP = 17
PLUS = 5
MIN_FRAMES = 5
MAX_SECONDS = 149.5  # snaps to 3592 frames, under the writers' 3600 ceiling


def snap_frames(raw, step=STEP, plus=PLUS):
    """Round raw UP to the next value of the form step*n + plus."""
    raw = int(raw)
    if step <= 1:
        return raw
    remainder = (raw - plus) % step
    if remainder:
        raw += step - remainder
    return raw


def frames_from_seconds(seconds, fps=FPS):
    """Frame count H3 accepts for a length in seconds."""
    try:
        seconds = float(seconds)
    except (TypeError, ValueError):
        seconds = 5.0
    if seconds != seconds or seconds < 0:
        seconds = 5.0
    seconds = min(MAX_SECONDS, seconds)
    raw = int(round(seconds * fps))
    if raw < MIN_FRAMES:
        raw = MIN_FRAMES
    return snap_frames(raw)


def actual_seconds(frames, fps=FPS):
    return float(frames) / fps if fps > 0 else 0.0
