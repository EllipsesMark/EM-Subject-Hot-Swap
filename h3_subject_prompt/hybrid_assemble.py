"""Six-section prompt for mixed RefMod + still rows.

RefMod visuals are <Video N>. Still images are <Picture N>. Both get a Subject
and retention that points at the matching tag when CLIP can see that slot.
"""

from __future__ import annotations

import re

from .assemble import speaker_ids_by_subject

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

_FOCUS = {
    "identity": "face, hair, and build only",
    "wardrobe": "clothing only",
    "background": "the room and fixed furniture only",
}

MAX_PICTURES = 9


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


def _source(row):
    raw = str(row.get("source") or "").strip().lower()
    if raw in ("refmod", "image"):
        return raw
    if str(row.get("image") or "").strip() and not str(row.get("refmod") or "").strip():
        return "image"
    if _concept(row) == "voice":
        return "refmod"
    return "refmod"


def migrate_state(data):
    if not isinstance(data, dict):
        return {}
    out = dict(data)
    if not isinstance(out.get("mods"), list):
        out["mods"] = []
    for row in out["mods"]:
        if not isinstance(row, dict):
            continue
        row["source"] = _source(row)
        row["concept"] = _concept(row)
    if not isinstance(out.get("ui"), dict):
        out["ui"] = {"promptOpen": False}
    return out


def _row_id(row):
    return str((row or {}).get("id") or "").strip()


def _wears_id(row):
    return str((row or {}).get("wears") or "").strip()


def assign(mods):
    """Mixed rows → each visual is its own Subject.

    RefMod identity → Subject + Video.
    Input/wardrobe still → Subject + Picture (a clothing set is Subject 2, etc.).
    ``wears`` only controls order (outfit sits under the character) and the
    ``wearing <Subject N>`` cross-link — it does not merge Subjects.
    """
    subject = picture = video = audio = 0
    assigned = []
    subject_by_row_id = {}
    pending_tied = []

    for index, row in enumerate(mods or []):
        if not isinstance(row, dict) or row.get("enabled") is False:
            continue
        concept = _concept(row)
        source = _source(row)
        strength = _strength(row)
        if strength <= 0.0 and concept != "voice":
            continue
        item = {
            "row": row,
            "index": index,
            "concept": concept,
            "source": source,
            "strength": strength,
            "wears_subject": 0,
        }
        voice_name = str(row.get("voice_refmod") or "").strip()
        voice_audio_file = str(row.get("voice_audio_file") or "").strip()
        voice_mode = str(row.get("voice_mode") or "").strip().lower()
        if voice_mode not in ("none", "refmod", "audio"):
            voice_mode = "audio" if voice_audio_file and not voice_name else "refmod" if voice_name else "none"
        refmod_name = str(row.get("refmod") or "").strip()
        image_name = str(row.get("image") or "").strip()

        if concept == "voice" or (source == "refmod" and voice_name and not refmod_name and not image_name):
            audio += 1
            item["kind"] = "audio"
            item["audio"] = audio
            item["refmod"] = voice_name or refmod_name
            assigned.append(item)
            continue

        # Defer tied wardrobe so it lands right after its character.
        if source == "image" and concept == "wardrobe" and _wears_id(row):
            if not image_name:
                continue
            pending_tied.append(item)
            continue

        if source == "image":
            if not image_name:
                continue
            subject += 1
            picture += 1
            item["kind"] = "picture"
            item["subject"] = subject
            item["picture"] = picture
            item["image"] = image_name
        else:
            if not refmod_name:
                continue
            subject += 1
            video += 1
            item["kind"] = "refmod"
            item["subject"] = subject
            item["video"] = video
            item["refmod"] = refmod_name

        rid = _row_id(row)
        if rid:
            subject_by_row_id[rid] = subject

        if voice_mode == "refmod" and voice_name:
            audio += 1
            item["voice"] = audio
            item["voice_refmod"] = voice_name
        elif voice_mode == "audio" and voice_audio_file:
            audio += 1
            item["voice"] = audio
            item["voice_audio_file"] = voice_audio_file
            item["voice_audio_start"] = row.get("voice_audio_start", 0)
            item["voice_audio_end"] = row.get("voice_audio_end", 0)
        assigned.append(item)

    for item in pending_tied:
        row = item["row"]
        image_name = str(row.get("image") or "").strip()
        if not image_name:
            continue
        parent_id = _wears_id(row)
        parent_subject = subject_by_row_id.get(parent_id) or 0
        subject += 1
        picture += 1
        item["kind"] = "picture"
        item["subject"] = subject
        item["picture"] = picture
        item["image"] = image_name
        item["wears_subject"] = parent_subject
        rid = _row_id(row)
        if rid:
            subject_by_row_id[rid] = subject
        voice_name = str(row.get("voice_refmod") or "").strip()
        voice_audio_file = str(row.get("voice_audio_file") or "").strip()
        voice_mode = str(row.get("voice_mode") or "").strip().lower()
        if voice_mode not in ("none", "refmod", "audio"):
            voice_mode = "audio" if voice_audio_file and not voice_name else "refmod" if voice_name else "none"
        if voice_mode == "refmod" and voice_name:
            audio += 1
            item["voice"] = audio
            item["voice_refmod"] = voice_name
        elif voice_mode == "audio" and voice_audio_file:
            audio += 1
            item["voice"] = audio
            item["voice_audio_file"] = voice_audio_file
            item["voice_audio_start"] = row.get("voice_audio_start", 0)
            item["voice_audio_end"] = row.get("voice_audio_end", 0)
        if parent_subject:
            insert_at = len(assigned)
            for i, other in enumerate(assigned):
                if other.get("subject") == parent_subject or other.get("wears_subject") == parent_subject:
                    insert_at = i + 1
            assigned.insert(insert_at, item)
        else:
            assigned.append(item)
    return assigned


def _outfits_for(item, assigned):
    """Wardrobe Subjects that wear this character Subject."""
    sn = item.get("subject")
    if not sn:
        return []
    return [
        other for other in assigned
        if other.get("wears_subject") == sn and other.get("concept") == "wardrobe"
    ]


def _tags_of(item):
    tags = {}
    for key in ("subject", "picture", "video", "audio"):
        if item.get(key):
            tags[key] = item[key]
    if item.get("voice"):
        tags["audio"] = item["voice"]
    return tags


def _who(row, tags):
    who = _retag(_clean(row.get("who") or row.get("name") or row.get("description") or "the subject"), tags)
    return who.rstrip(".!?") or "the subject"


_OUTFIT_LEAD = re.compile(
    r"^(?:a\s+clothing\s+set\s+that\s+includes\s+|the\s+outfit\s+consists\s+of\s+)",
    re.I,
)


def _outfit_label(row, tags=None):
    """Name the garments from wardrobe who/desc — what Subject N is wearing."""
    raw = _clean(
        row.get("desc")
        or row.get("who")
        or row.get("name")
        or row.get("description")
        or ""
    )
    raw = _OUTFIT_LEAD.sub("", raw).strip()
    if tags:
        raw = _retag(raw, tags)
    raw = _strip_retained(raw).rstrip(".!?")
    return raw or "the clothing"


def _keep_default(concept):
    return _CONCEPT_KEEP.get(concept, _CONCEPT_KEEP["identity"])


def _strip_retained(text):
    text = _clean(text).rstrip(".!?")
    text = re.sub(
        r"\s+(?:is|are)(?:\s+all)?\s+retained(?:\s+from\s+<\s*(?:picture|video)\s+\d+\s*>)?$",
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


def definition_lines(item, outfits=None, speaker_ids=None):
    """subject_definitions: who only here; keep stays in retention.

    Identity: ``<Subject 1> is {who}, wearing <Subject 2>. <Video 1>…``
    Clothing set (input image): ``<Subject 2> is {outfit paragraph}. <Picture 1>…``
    """
    outfits = [o for o in (outfits or []) if o.get("kind") == "picture"]
    row = item["row"]
    tags = _tags_of(item)
    who = _who(row, tags)
    concept = item["concept"]
    focus = _FOCUS.get(concept, _FOCUS["identity"])

    if item["kind"] == "audio":
        return [f"<Audio {item['audio']}> is {who}."]

    sn = item["subject"]
    wearing = ""
    if outfits:
        wearing = ", wearing " + ", and ".join(f"<Subject {o['subject']}>" for o in outfits)

    if item["kind"] == "picture":
        pn = item["picture"]
        if concept == "wardrobe":
            outfit = _outfit_label(row, tags)
            lead = (
                f"<Subject {sn}> is {outfit}. "
                f"<Picture {pn}> is the outfit reference for <Subject {sn}>, {focus}."
            )
        elif concept == "background":
            lead = (
                f"<Subject {sn}> is {who}. <Picture {pn}> is the place reference for "
                f"<Subject {sn}>, {focus}."
            )
        else:
            lead = (
                f"<Subject {sn}> is {who}{wearing}, as shown in <Picture {pn}>. "
                f"<Picture {pn}> is the identity reference for <Subject {sn}>, {focus}."
            )
        lines = [lead]
    else:
        vn = item["video"]
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
                f"<Subject {sn}> is {who}{wearing}. "
                f"<Video {vn}> is the identity reference for <Subject {sn}>, {focus}."
            )
        lines = [lead]

    if item.get("voice"):
        speaker_id = (speaker_ids or {}).get(sn)
        speaker = f" ({speaker_id})" if speaker_id else ""
        lines.append(
            f"<Audio {item['voice']}> is the voice-timbre reference for "
            f"<Subject {sn}>{speaker}."
        )
    return lines


def retention_lines(item, outfits=None):
    """Retention holds keep only — identity from Video, clothing from Picture."""
    del outfits  # each Subject retains from its own media tag
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
    if item["kind"] == "picture":
        from_tag = f"<Picture {item['picture']}>"
    else:
        from_tag = f"<Video {item['video']}>"
    if held.lower() in ("the clothing", "clothing"):
        body = f"{marker} - the clothing is retained from {from_tag}."
    else:
        body = f"{marker} - {held} are all retained from {from_tag}."
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
        name = _clean(
            item["row"].get("who")
            or item["row"].get("description")
            or item.get("refmod")
            or item.get("image")
            or "subject"
        )
        if item["kind"] == "picture":
            rows.append({
                "label": f"Picture {item['picture']}",
                "wire": "image",
                "name": name,
                "subject": item["subject"],
                "image": item.get("image") or "",
            })
        elif item["kind"] == "refmod":
            rows.append({
                "label": f"Video {item['video']}",
                "wire": "refmod",
                "name": name,
                "subject": item["subject"],
                "refmod": item.get("refmod") or "",
                "strength": item["strength"],
            })
        else:
            rows.append({
                "label": f"Audio {item['audio']}",
                "wire": "voice_refmod",
                "name": name,
                "refmod": item.get("refmod") or "",
            })
        if item.get("voice"):
            audio_row = {
                "label": f"Audio {item['voice']}",
                "wire": "voice_audio" if item.get("voice_audio_file") else "voice_refmod",
                "name": name + " voice",
                "subject": item.get("subject"),
            }
            if item.get("voice_audio_file"):
                audio_row.update({
                    "file": item["voice_audio_file"],
                    "start": item.get("voice_audio_start", 0),
                    "end": item.get("voice_audio_end", 0),
                })
            else:
                audio_row["refmod"] = item.get("voice_refmod") or ""
            rows.append(audio_row)
    return rows


def build_prompt(data):
    data = migrate_state(data if isinstance(data, dict) else {})
    assigned = assign(data.get("mods") or [])
    detailed = _detailed(data)
    speaker_ids = speaker_ids_by_subject(detailed)
    definitions = []
    retentions = []
    for item in assigned:
        outfits = _outfits_for(item, assigned)
        definitions.extend(definition_lines(item, outfits, speaker_ids))
        retentions.extend(retention_lines(item, outfits))

    # Same six MiniMax sections / order as RefMod assemble — only the
    # Subject/Picture/Video wording differs for hybrid stills.
    sound = _clean(data.get("soundscape")) or "room tone"
    music = _clean(data.get("music")) or "N/A"
    prompt = "\n".join([
        "subject_definitions:",
        "\n".join(definitions) if definitions else "N/A",
        "",
        "summary:",
        _summary_line(data),
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

    pictures = sum(1 for item in assigned if item["kind"] == "picture")
    report_lines = [
        "Hybrid: RefMods are Video tags; stills are Picture tags.",
        f"pictures={pictures} refmods={sum(1 for i in assigned if i['kind']=='refmod')}",
    ]
    error = ""
    if pictures > MAX_PICTURES:
        error = f"MiniMax H3 takes at most {MAX_PICTURES} reference images. {pictures} picture rows are on."
    else:
        missing_img = [
            f"Picture {item['picture']}"
            for item in assigned
            if item["kind"] == "picture" and not str(item.get("image") or "").strip()
        ]
        missing_mod = [
            f"Video {item['video']}"
            for item in assigned
            if item["kind"] == "refmod" and not str(item.get("refmod") or "").strip()
        ]
        if missing_img:
            error = "These picture rows have no image: " + ", ".join(missing_img)
        elif missing_mod:
            error = "These RefMod rows have no file: " + ", ".join(missing_mod)

    return {
        "prompt": prompt,
        "report": "\n".join(report_lines),
        "map": _map_rows(assigned),
        "error": error,
        "assigned": assigned,
    }


def annotate(data):
    result = build_prompt(data if isinstance(data, dict) else {})
    result.pop("assigned", None)
    return result
