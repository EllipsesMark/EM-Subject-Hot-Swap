"""Stamp the mode-owned prompt skeleton; keep only the LLM's continuation."""

import re

from . import guides, validate

_SHOT1 = re.compile(r"\[Shot 1\]")
_IMD = re.compile(r"^integrated_multimodal_description:\s*", re.MULTILINE)
_SOUND = re.compile(r"^overall_soundscape:\s*", re.MULTILINE)
_MUSIC = re.compile(r"^non_diegetic_music:\s*", re.MULTILINE)


def split_llm_prompt(text):
    """Return (shot_blob, soundscape_body, music_body)."""
    text = validate.strip_fences(text or "")
    sound = music = ""
    desc = text
    m_sound = _SOUND.search(text)
    m_music = _MUSIC.search(text)
    if m_sound and m_music and m_music.start() > m_sound.start():
        desc = text[:m_sound.start()].strip()
        sound = text[m_sound.end():m_music.start()].strip()
        music = text[m_music.end():].strip()
    elif m_sound:
        desc = text[:m_sound.start()].strip()
        sound = text[m_sound.end():].strip()
    elif m_music:
        desc = text[:m_music.start()].strip()
        music = text[m_music.end():].strip()
    desc = _IMD.sub("", desc, count=1).strip()
    idx = _SHOT1.search(desc)
    shot = desc[idx.start():].strip() if idx else desc
    return shot, sound, music


def continuation_after_opener(shot_blob, opener):
    """Keep only the words after the stamped Shot 1 opener."""
    blob = (shot_blob or "").strip()
    opener = (opener or "").strip()
    blob = _IMD.sub("", blob, count=1).strip()
    if blob.startswith(opener):
        return blob[len(opener):].lstrip(" ,")
    if blob.startswith("[Shot 1]"):
        rest = blob[len("[Shot 1]"):].strip()
        tail = opener[len("[Shot 1]"):].strip() if opener.startswith("[Shot 1]") else opener
        low, tlow = rest.lower(), tail.lower()
        if tlow and tlow in low:
            return rest[low.index(tlow) + len(tail):].lstrip(" ,")
        rlow = rest.lower()
        stripped = False
        for style in sorted(guides.STYLE_OPENINGS.values(), key=len,
                            reverse=True):
            s = style.lower()
            if rlow.startswith(s):
                rest = rest[len(style):].lstrip(" ,")
                stripped = True
                break
        if not stripped:
            rest = re.sub(
                r"^(?:live-action|2D-animated|3D CG|vintage film|"
                r"realistic studio)(?:,\s*[^,]{1,80})*,\s*",
                "", rest, flags=re.IGNORECASE)
        rest = re.sub(r"^a\s+[\w\s-]+frames\s+", "", rest, flags=re.IGNORECASE)
        rest = re.sub(
            r"^the\s+.+\s+shown in <Picture 1>\s+remains\s+",
            "", rest, flags=re.IGNORECASE)
        rest = re.sub(
            r"^.+?begins in the position and framing established by Picture 1,?\s*",
            "", rest, flags=re.IGNORECASE)
        return rest.lstrip(" ,")
    return blob


def assemble_base_prompt(mode, duration, style_mode, shot_size, llm_text,
                         subject_label="subject"):
    """Force alignment + Shot 1 opener; keep LLM action, sound, and music."""
    opener = guides.stamped_shot1(mode, style_mode, shot_size, subject_label)
    shot, sound, music = split_llm_prompt(llm_text)
    cont = continuation_after_opener(shot, opener)
    if not sound:
        sound = "N/A"
    if not music:
        music = "N/A"
    desc = f"integrated_multimodal_description: {opener}"
    if cont:
        desc = f"{desc} {cont}"
    parts = []
    align = guides.alignment_line(mode, duration)
    if align:
        parts.extend([align, ""])
    parts.extend([
        desc,
        "",
        f"overall_soundscape: {sound}",
        "",
        f"non_diegetic_music: {music}",
    ])
    return "\n".join(parts)
