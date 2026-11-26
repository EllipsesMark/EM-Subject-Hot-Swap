"""Build a MiniMax H3 six-section prompt from RefMod load rows.

Each enabled visual row is one Subject and one Video. A paired voice on that
row, or a voice-only row, is one Audio. No Picture tags: the DiT gets the
stored latent, not a still.
"""

import re

TASKS = [
    "reference generation",
    "video editing + reference generation",
    "video continuation",
    "keyframe completion + reference generation",
    "reference generation + audio reference",
    "reference generation + audio reuse",
    "none",
]

PICTURE_MARKERS = [
    "fully_preserved",
    "partially_preserved",
    "attribute_transfer",
    "weak_reference",
]
AUDIO_MARKERS = [
    "fully_copy",
    "partially_copy",
    "reference",
    "weak_reference",
]

_TAGS = (
    ("picture", "Picture", r"<\s*picture\s*\d*\s*>"),
    ("subject", "Subject", r"<\s*subject\s*\d*\s*>"),
    ("video", "Video", r"<\s*video\s*\d*\s*>"),
    ("audio", "Audio", r"<\s*audio\s*\d*\s*>"),
)

_CONCEPT_KEEP = {
    "identity": "face, hair, and build",
    "wardrobe": "the clothing",
    "background": "the environment",
    "voice": "timbre, rhythm, and delivery",
}

_VIDEO_LINE = {
    "identity": "face, hair, and build only",
    "wardrobe": "clothing only",
    "background": "the room and fixed furniture only",
}


def _clean(text):
    return " ".join(str(text or "").split()).strip()


def _end(text):
    text = _clean(text)
    if not text:
        return ""
    if text[-1] not in ".!?":
        text += "."
    return text


def _join(*parts):
    return " ".join(bit for bit in (_end(p) for p in parts) if bit)


def _block(text):
    return str(text or "").strip()


def _detailed(data):
    detailed = _block(data.get("detailed"))
    opening = _clean(data.get("opening"))
    if opening and opening[-1] not in ".!?":
        opening += "."
    if not opening:
        return detailed
    if detailed.lower().startswith(opening.lower()):
        return detailed
    if not detailed:
        return opening
    return opening + "\n" + detailed


def _shots(raw):
    nums = re.findall(r"\d+", str(raw or "")) or ["1"]
    return ", ".join(f"[Shot {n}]" for n in nums)


def _retag(text, tags):
    text = str(text or "")
    for key, label, pat in _TAGS:
        number = tags.get(key)
        if number:
            text = re.sub(pat, f"<{label} {number}>", text, flags=re.I)
    return text


def _concept(row):
    concept = str(row.get("concept") or row.get("role") or "identity").strip().lower()
    if concept in ("person",):
        return "identity"
    if concept in ("set", "clothing"):
        return "wardrobe"
    if concept in ("place", "scene"):
        return "background"
    if concept in _CONCEPT_KEEP:
        return concept
    return "identity"


def _marker(row):
    marker = str(row.get("marker") or "").strip()
    return marker if marker in PICTURE_MARKERS else "fully_preserved"


def _audio_marker(row):
    marker = str(row.get("audio_marker") or "").strip()
    return marker if marker in AUDIO_MARKERS else "reference"


def _strength(row):
    try:
        value = float(row.get("strength") if row.get("strength") is not None else 1.0)
    except (TypeError, ValueError):
        value = 1.0
    if value != value:
        value = 1.0
    return max(0.0, min(1.0, value))


def migrate_state(data):
    """Turn legacy subject cards into mod rows. Already-migrated state is left alone."""
    if not isinstance(data, dict):
        return {}
    out = dict(data)
    if isinstance(out.get("mods"), list) and out["mods"]:
        return out
    mods = []
    for row in out.get("subjects") or []:
        if not isinstance(row, dict):
            continue
        concept = _concept(row)
        kind = str(row.get("kind") or "picture").strip().lower()
        if kind == "audio" or concept == "voice":
            mods.append({
                "id": row.get("id") or "",
                "enabled": row.get("enabled") is not False,
                "refmod": "",
                "voice_refmod": str(row.get("audio_refmod") or row.get("refmod") or "").strip(),
                "concept": "voice",
                "strength": 1.0,
                "who": _clean(row.get("who") or row.get("name") or "the voice"),
                "keep": _clean(row.get("keep") or ""),
                "marker": _audio_marker(row),
                "shots": str(row.get("shots") or "1"),
            })
            continue
        mods.append({
            "id": row.get("id") or "",
            "enabled": row.get("enabled") is not False,
            "refmod": str(row.get("refmod") or "").strip(),
            "voice_refmod": str(row.get("audio_refmod") or "").strip() if row.get("audio") else "",
            "concept": concept if concept != "voice" else "identity",
            "strength": _strength(row),
            "who": _clean(row.get("who") or row.get("name") or ""),
            "keep": _clean(row.get("keep") or ""),
            "marker": _marker(row),
            "shots": str(row.get("shots") or "1"),
            "stack": str(row.get("stack") or ""),
            "description": _clean(row.get("description") or ""),
            "has_looks": bool(row.get("hasLooks") or row.get("has_looks")),
            "has_preview": bool(row.get("has_preview")),
        })
    out["mods"] = mods
    return out


def assign(mods):
    """Enabled RefMod rows, top to bottom, with Subject / Video / Audio numbers."""
    subject = video = audio = 0
    assigned = []
    for index, row in enumerate(mods or []):
        if not isinstance(row, dict) or row.get("enabled") is False:
            continue
        if _strength(row) <= 0.0 and _concept(row) != "voice":
            continue
        concept = _concept(row)
        item = {"row": row, "index": index, "concept": concept, "strength": _strength(row)}
        voice_name = str(row.get("voice_refmod") or "").strip()
        visual_name = str(row.get("refmod") or "").strip()
        if concept == "voice" or (voice_name and not visual_name):
            audio += 1
            item["kind"] = "audio"
            item["audio"] = audio
            item["refmod"] = voice_name or visual_name
            assigned.append(item)
            continue
        if not visual_name:
            continue
        subject += 1
        video += 1
        item["kind"] = "visual"
        item["subject"] = subject
        item["video"] = video
        item["refmod"] = visual_name
        if voice_name:
            audio += 1
            item["voice"] = audio
            item["voice_refmod"] = voice_name
        assigned.append(item)
    return assigned


def _tags_of(item):
    tags = {}
    for key in ("subject", "video", "audio"):
        if item.get(key):
            tags[key] = item[key]
    if item.get("voice"):
        tags["audio"] = item["voice"]
    return tags


def _who(row, tags):
    who = _retag(_clean(row.get("who") or row.get("name") or row.get("description") or "the subject"), tags)
    return who.rstrip(".!?") or "the subject"


def _reinforced(data):
    """Subject reinforce expands who into defs / retention / detailed at assemble time."""
    if not isinstance(data, dict):
        return True
    if "subject_reinforced" in data:
        return bool(data.get("subject_reinforced"))
    return True


def _who_clip(who, *, max_len=140):
    text = _clean(who).rstrip(".!?")
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    cut = text[: max_len - 1].rsplit(" ", 1)[0].rstrip(",;:")
    return (cut or text[: max_len - 1]) + "…"


def reinforce_detailed(text, assigned):
    """First ``<Subject N>`` per subject → ``<Subject N>, {who}`` (editor stays tag-clean)."""
    out = str(text or "")
    if not out:
        return out
    for item in assigned or []:
        if item.get("kind") != "visual":
            continue
        sn = int(item.get("subject") or 0)
        if sn < 1:
            continue
        who = _who_clip(_who(item["row"], _tags_of(item)))
        if not who:
            continue
        pat = re.compile(
            rf"(<\s*Subject\s+{sn}\s*>)(?!\s*,)",
            flags=re.I,
        )
        out, n = pat.subn(rf"\1, {who},", out, count=1)
        if n:
            continue
    return out


def _keep_default(concept):
    return _CONCEPT_KEEP.get(concept, _CONCEPT_KEEP["identity"])


def _strip_retained(text):
    text = _clean(text).rstrip(".!?")
    text = re.sub(
        r"\s+are(?:\s+all)?\s+retained(?:\s+from\s+<\s*(?:picture|video)\s+\d+\s*>)?$",
        "",
        text,
        flags=re.I,
    )
    return text.strip(" ,")


_GLOSSARY = (
    "the defined role of the referenced content is fully preserved",
    "the referenced content is still used, but some defined characteristics are changed or only partially retained",
    "referenced characteristics are transferred to a different identifiable target subject",
    "only broad similarity in style, category, composition, or atmosphere is retained",
    "the complete source audio serves as the target video's complete final audio track",
    "only part of the timeline or selected audio layers are copied, or other sounds are added, removed, or replaced after copying",
    "the signal is not copied directly; only timbre, rhythm, music style, dialogue content, or sound texture is referenced",
    "only broad similarity in category or atmosphere is retained",
    "only the timbre, rhythm, style, and delivery are referenced without copying the signal",
)
_IDENTITY = "identity, facial features, skin tone, and hair are retained"


def _without_glossary(text):
    raw = _clean(text)
    if not raw:
        return ""
    low = raw.lower().rstrip(".")
    for gloss in _GLOSSARY:
        if low == gloss:
            return ""
        if low.startswith(gloss + " ") or low.startswith(gloss + "."):
            return raw[len(gloss):].lstrip(" .")
    return raw


def _visible_keep(keep):
    raw = _clean(keep)
    stripped = _without_glossary(keep)
    if raw and not stripped:
        return _IDENTITY
    return stripped


_AUDIO_CLAUSE = {
    "fully_copy": "the file is the complete final audio track",
    "partially_copy": "only the selected stretch is copied",
    "reference": "timbre, rhythm, and delivery are referenced without copying the signal",
    "weak_reference": "only the broad category and atmosphere are followed",
}


def _audio_keep(keep, marker):
    stripped = _without_glossary(keep)
    if stripped:
        return stripped
    return _AUDIO_CLAUSE.get(marker, _AUDIO_CLAUSE["reference"])


def _retention_body(marker, keep):
    pieces = [part for part in (_clean(keep),) if part]
    if not pieces:
        return marker
    return f"{marker} - {_join(*pieces)}"


def definition_lines(item):
    row = item["row"]
    tags = _tags_of(item)
    who = _who(row, tags)
    concept = item["concept"]
    if item["kind"] == "audio":
        return [f"<Audio {item['audio']}> is {who}."]
    sn = item["subject"]
    vn = item["video"]
    focus = _VIDEO_LINE.get(concept, _VIDEO_LINE["identity"])
    if concept == "wardrobe":
        lead = (
            f"<Subject {sn}> is {who}. <Video {vn}> is the outfit reference for "
            f"<Subject {sn}>, {focus}."
        )
    elif concept == "background":
        lead = (
            f"<Subject {sn}> is {who}. <Video {vn}> is the place reference for "
            f"<Subject {sn}>, {focus}."
        )
    else:
        lead = (
            f"<Subject {sn}> is {who}. <Video {vn}> is the identity reference for "
            f"<Subject {sn}>, {focus}."
        )
    lines = [lead]
    if item.get("voice"):
        lines.append(
            f"<Audio {item['voice']}> is the voice-timbre reference for "
            f"<Subject {sn}>."
        )
    return lines


def retention_lines(item):
    row = item["row"]
    tags = _tags_of(item)
    shots = _shots(row.get("shots"))
    if item["kind"] == "audio":
        marker = _audio_marker(row)
        keep = _audio_keep(_retag(row.get("keep") or "", tags), marker)
        return [f"<Audio {item['audio']}>: {_retention_body(marker, keep)}"]
    marker = _marker(row)
    keep = _strip_retained(_visible_keep(_retag(row.get("keep") or "", tags)))
    held = keep or _keep_default(item["concept"])
    body = f"{marker} - {held} are all retained."
    lines = [f"<Subject {item['subject']}> (appears in {shots}): {body}"]
    if item.get("voice"):
        voice_marker = _audio_marker(row)
        voice_keep = _audio_keep(_retag(row.get("audio_keep") or "", tags), voice_marker)
        lines.append(f"<Audio {item['voice']}>: {_retention_body(voice_marker, voice_keep)}")
    return lines


def _summary_line(data):
    body = _clean(data.get("summary"))
    task = str(data.get("task") or "reference generation").strip()
    voices = any(
        item.get("voice") or item["kind"] == "audio"
        for item in assign((data or {}).get("mods") or [])
    )
    if voices and task == "reference generation":
        task = "reference generation + audio reference"
    if task in ("", "none"):
        return _end(body)
    if body.startswith("["):
        return body if body[-1] in ".!?" else _end(body)
    if not body:
        return f"[{task}]"
    line = f"[{task}] {body}"
    return line if line[-1] in ".!?" else line + "."


def _map_rows(assigned):
    rows = []
    for item in assigned:
        name = _clean(item["row"].get("who") or item["row"].get("description") or item.get("refmod") or "subject")
        if item["kind"] == "visual":
            rows.append({
                "label": f"Video {item['video']}",
                "wire": "refmod",
                "name": name,
                "subject": item["subject"],
                "refmod": item["refmod"],
                "strength": item["strength"],
            })
            if item.get("voice"):
                rows.append({
                    "label": f"Audio {item['voice']}",
                    "wire": "voice_refmod",
                    "name": name + " voice",
                    "subject": item["subject"],
                    "refmod": item.get("voice_refmod") or "",
                })
        else:
            rows.append({
                "label": f"Audio {item['audio']}",
                "wire": "voice_refmod",
                "name": name,
                "refmod": item.get("refmod") or "",
            })
    return rows


def build_prompt(data):
    """Return prompt text, a short wiring report, and the reference map."""
    data = migrate_state(data if isinstance(data, dict) else {})
    assigned = assign(data.get("mods") or [])
    reinforced = _reinforced(data)
    definitions = []
    retentions = []
    for item in assigned:
        definitions.extend(definition_lines(item))
        retentions.extend(retention_lines(item))

    summary = _summary_line(data)
    detailed = _detailed(data)
    # Defs + retention already carry who/keep. Reinforce only fills detailed.
    if reinforced:
        detailed = reinforce_detailed(detailed, assigned)
    sound = _clean(data.get("soundscape")) or "N/A"
    music = _clean(data.get("music")) or "N/A"

    prompt = "\n".join([
        "subject_definitions:",
        "\n".join(definitions) if definitions else "N/A",
        "",
        "summary:",
        summary,
        "",
        "retention_analysis:",
        "\n".join(retentions) if retentions else "N/A",
        "",
        "detailed_description:",
        detailed,
        "",
        f"overall_soundscape: {sound}",
        "",
        f"non_diegetic_music: {music}",
    ])

    lines = []
    for item in assigned:
        if item["kind"] == "visual":
            tag = f"Video {item['video']}"
        else:
            tag = f"Audio {item['audio']}"
        lines.append({
            "index": item["index"],
            "tag": tag,
            "definition": "\n".join(definition_lines(item)),
            "retention": "\n".join(retention_lines(item)),
        })

    mapping = _map_rows(assigned)
    report_lines = [
        "RefMods load as stored latents. Each visual row is one Video on the DiT.",
        "Strength softens a visual toward a blurred copy of itself (HTC / Apply math).",
        "Subject reinforce: ON — who expands into detailed at assemble."
        if reinforced else
        "Subject reinforce: OFF — detailed keeps bare <Subject N> tags.",
    ]
    if mapping:
        for row in mapping:
            strength = row.get("strength")
            extra = f" @ {strength:.2f}" if isinstance(strength, float) else ""
            report_lines.append(
                f"{row['label']} → {row.get('refmod') or row['name']}{extra}"
            )
    else:
        report_lines.append("No RefMods are switched on.")

    return {
        "prompt": prompt,
        "report": "\n".join(report_lines),
        "map": mapping,
        "lines": lines,
        "subject_reinforced": reinforced,
    }
