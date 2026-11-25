"""Pack-owned prompt templates and framing rules for the I2V Draft tab."""

STYLE_MODES = {
    "cinematic": "Use a polished live-action film look and purposeful camera movement.",
    "amateur": "Use an everyday handheld look, available light, and natural pacing.",
    "smartphone": "Use a front-camera phone capture, close framing, and practical phone lighting.",
    "studio": "Use clean studio photography, controlled light, and uncluttered framing.",
    "documentary": "Use observational framing, natural light, and restrained movement.",
    "commercial": "Use clear product or lifestyle framing, controlled highlights, and concise movement.",
    "music_video": "Use rhythmic framing, expressive light, and movement that follows the beat.",
    "vintage_film": "Use a vintage film image with visible grain and softer contrast.",
    "anime": "Use a consistent 2D animated style and clearly described animated motion.",
    "3d_cg": "Use a consistent 3D-rendered look, clean geometry, and CG lighting.",
}

STYLE_OPENINGS = {
    "cinematic": "Live-action, cinematic",
    "amateur": "live-action, amateur handheld camera",
    "smartphone": "live-action, smartphone, front camera, hard on-camera lamp",
    "studio": "realistic studio photographic style with controlled, even lighting",
    "documentary": "live-action observational documentary",
    "commercial": "live-action clean commercial / advertising look",
    "music_video": "live-action music-video look",
    "vintage_film": "vintage film",
    "anime": "2D-animated",
    "3d_cg": "3D CG",
}

DEFAULT_SHOT_SIZE = {
    "t2va": "medium-wide shot",
    "i2va": "medium close-up",
    "fl2va": "medium shot",
    "l2va": "close shot",
}

I2VA_LINE = (
    "For the target video, at 0.00 seconds into the target video, "
    "<Picture 1> (from [Shot 1]) is fully referenced."
)


def _mode(mode):
    key = (mode or "t2va").strip().lower()
    return key if key in DEFAULT_SHOT_SIZE else "t2va"


def style_opening(mode):
    key = (mode or "cinematic").strip().lower()
    return STYLE_OPENINGS.get(key, STYLE_OPENINGS["cinematic"])


def style_mode_block(mode):
    key = (mode or "cinematic").strip().lower()
    if key not in STYLE_MODES:
        key = "cinematic"
    return f"Visual style: {key}. {STYLE_MODES[key]}"


def alignment_line(mode, duration):
    """Return the mode's opening alignment instruction, if it uses one."""
    key = _mode(mode)
    seconds = f"{float(duration):.2f}"
    if key == "i2va":
        return I2VA_LINE
    if key == "fl2va":
        return (
            "How the reference pictures align with the target video — "
            "Picture 1 (from Shot 1) aligns with the 0.00-second mark of the "
            f"target video; Picture 2 (from Shot 1) aligns with the "
            f"{seconds}-second mark of the target video."
        )
    if key == "l2va":
        return (
            "How the reference pictures align with the target video — "
            "<Picture 1> (from [Shot 1]) aligns with the "
            f"{seconds}-second mark of the target video."
        )
    return None


def stamped_shot1(mode, style_mode, shot_size, subject_label="subject"):
    """Build the pack-owned opening text the LLM must continue from."""
    key = _mode(mode)
    style = style_opening(style_mode)
    shot = (shot_size or DEFAULT_SHOT_SIZE[key]).strip()
    subject = (subject_label or "subject").strip() or "subject"
    if key == "i2va":
        return (
            f"[Shot 1] {style}, a {shot} frames the {subject} shown in "
            "<Picture 1> remains"
        )
    if key == "fl2va":
        return (
            f"[Shot 1] {style}, the {subject} begins in the position and "
            "framing established by Picture 1"
        )
    if key == "l2va":
        return f"[Shot 1] {style}, a {shot} begins with"
    return f"[Shot 1] {style}, a {shot} frames"


def stamped_prefix(mode, duration, style_mode, shot_size, subject_label="subject"):
    description = (
        "integrated_multimodal_description: "
        + stamped_shot1(mode, style_mode, shot_size, subject_label)
    )
    alignment = alignment_line(mode, duration)
    return f"{alignment}\n\n{description}" if alignment else description


def base_system(mode=None, duration=None):
    """Return a self-contained drafting guide for the selected H3 I2V mode."""
    key = _mode(mode)
    seconds = float(duration if duration is not None else 8.0)
    mode_rules = {
        "t2va": (
            "There is no reference image. Develop the requested scene from the "
            "user's intent; do not mention Picture 1 or Picture 2."
        ),
        "i2va": (
            "Picture 1 is the opening frame at 0.00 seconds. Ground the opening "
            "appearance, clothing, objects, and composition in that image, "
            "then describe the requested motion forward. Do not mention Picture 2."
        ),
        "fl2va": (
            "Picture 1 is the opening frame and Picture 2 is the ending frame. "
            "Describe a plausible visual path between them and land on the "
            "ending composition by the stated duration."
        ),
        "l2va": (
            "Picture 1 is the ending frame. Describe a plausible earlier state "
            "and motion that arrives at the still's visible composition by the "
            "stated duration."
        ),
    }[key]
    alignment = alignment_line(key, seconds)
    opening = f"Begin with this exact first line: {alignment}\n" if alignment else ""
    return (
        "Write one structured MiniMax H3 video prompt from the supplied intent "
        "and any connected reference frames.\n\n"
        f"Mode: {key.upper()}. Duration: {seconds:.2f} seconds.\n"
        f"{mode_rules}\n\n"
        f"{opening}Continue with an integrated_multimodal_description section "
        "containing [Shot 1] and a coherent sequence of visible actions. Keep "
        "later cut times inside the clip duration and use increasing shot numbers. "
        "Describe observable visuals and camera movement as natural prose. Do not "
        "add details that contradict a connected frame.\n\n"
        "Then include overall_soundscape and non_diegetic_music as separate "
        "sections. Keep soundscape to audible ambience and physical sounds; use "
        "N/A when no score is requested. Preserve user-provided dialogue verbatim.\n\n"
        "Output the complete prompt only, without Markdown fences or commentary. "
        "Use the exact stamped prefix supplied in the user message."
    )
