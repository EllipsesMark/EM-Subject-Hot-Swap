"""Build a MiniMax H3 six-section prompt from small subject fields.

A subject stores three short pieces: who they are, what must stay, and the
wardrobe line for this run. The joined subject_definitions and
retention_analysis lines are produced here so the graph never needs the
whole paragraph typed by hand.
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


def _kind(row):
    kind = str(row.get("kind") or "picture").strip().lower()
    return kind if kind in ("picture", "video", "audio") else "picture"


def _marker(row, kind):
    marker = str(row.get("marker") or "").strip()
    choices = AUDIO_MARKERS if kind == "audio" else PICTURE_MARKERS
    if marker in choices:
        return marker
    return choices[0] if kind != "audio" else "reference"


def _audio_marker(row):
    marker = str(row.get("audio_marker") or "").strip()
    return marker if marker in AUDIO_MARKERS else "reference"


def assign(subjects):
    """Enabled rows, top to bottom, with the numbers H3 will read."""
    picture = video = audio = subject = 0
    assigned = []
    for index, row in enumerate(subjects or []):
        if not isinstance(row, dict) or row.get("enabled") is False:
            continue
        kind = _kind(row)
        item = {"kind": kind, "row": row, "index": index}
        if kind == "picture":
            picture += 1
            subject += 1
            item["picture"] = picture
            item["subject"] = subject
        elif kind == "video":
            video += 1
            item["video"] = video
        else:
            audio += 1
            item["audio"] = audio
        if kind == "picture" and row.get("audio"):
            audio += 1
            item["voice"] = audio
        assigned.append(item)
    return assigned


def _tags_of(item):
    tags = {}
    for key in ("picture", "subject", "video", "audio"):
        if item.get(key):
            tags[key] = item[key]
    if item.get("voice"):
        tags["audio"] = item["voice"]
    return tags


def _who(row, tags):
    who = _retag(_clean(row.get("who") or row.get("name") or "the subject"), tags)
    return who.rstrip(".!?") or "the subject"


def _wardrobe(row, tags):
    return _retag(row.get("wardrobe") or "", tags)


def definition_lines(item):
    row = item["row"]
    tags = _tags_of(item)
    who = _who(row, tags)
    wardrobe = _wardrobe(row, tags)
    kind = item["kind"]
    if kind == "picture":
        sn, pn = item["subject"], item["picture"]
        if re.search(r"<\s*picture\s*\d+\s*>", who, flags=re.I):
            lead = f"<Subject {sn}> is {who}"
        else:
            lead = f"<Subject {sn}> is {who}, as shown in <Picture {pn}>"
        lines = [_join(lead, wardrobe)]
        if item.get("voice"):
            lines.append(f"<Audio {item['voice']}> is the voice of <Subject {sn}>.")
        return lines
    if kind == "video":
        return [_join(f"<Video {item['video']}> is {who}", wardrobe)]
    return [_join(f"<Audio {item['audio']}> is {who}", wardrobe)]


def _retention_body(marker, keep, wardrobe):
    keep = _clean(keep)
    head = f"{marker} - {keep}" if keep else marker
    return _join(head, wardrobe)


def retention_lines(item):
    row = item["row"]
    tags = _tags_of(item)
    kind = item["kind"]
    marker = _marker(row, kind)
    keep = _retag(row.get("keep") or "", tags)
    wardrobe = _wardrobe(row, tags)
    body = _retention_body(marker, keep, wardrobe)
    shots = _shots(row.get("shots"))
    if kind == "picture":
        lines = [f"<Subject {item['subject']}> (appears in {shots}): {body}"]
        if item.get("voice"):
            voice_keep = _retag(
                row.get("audio_keep")
                or "only the timbre, rhythm, style, and delivery are referenced without copying the signal",
                tags)
            lines.append(
                f"<Audio {item['voice']}>: {_retention_body(_audio_marker(row), voice_keep, '')}")
        return lines
    if kind == "video":
        return [f"<Video {item['video']}> (appears in {shots}): {body}"]
    return [f"<Audio {item['audio']}>: {body}"]


def _summary_line(data):
    body = _clean(data.get("summary"))
    task = str(data.get("task") or "reference generation").strip()
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
        name = _clean(item["row"].get("name") or item["row"].get("who") or "subject")
        if item["kind"] == "picture":
            n = item["picture"]
            rows.append({
                "label": f"Picture {n}",
                "wire": f"ref_image_{n - 1}",
                "name": name,
                "subject": item["subject"],
            })
            if item.get("voice"):
                a = item["voice"]
                rows.append({
                    "label": f"Audio {a}",
                    "wire": f"ref_audio_{a - 1}",
                    "name": name + " voice",
                    "subject": item["subject"],
                })
        elif item["kind"] == "video":
            n = item["video"]
            rows.append({
                "label": f"Video {n}",
                "wire": f"ref_video_{n - 1}",
                "name": name,
            })
        else:
            n = item["audio"]
            rows.append({
                "label": f"Audio {n}",
                "wire": f"ref_audio_{n - 1}",
                "name": name,
            })
    return rows


def build_prompt(data):
    """Return prompt text, a short wiring report, and the reference map."""
    if not isinstance(data, dict):
        data = {}
    assigned = assign(data.get("subjects") or [])
    definitions = []
    retentions = []
    for item in assigned:
        definitions.extend(definition_lines(item))
        retentions.extend(retention_lines(item))

    summary = _summary_line(data)
    detailed = _block(data.get("detailed"))
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
        if item["kind"] == "picture":
            tag = f"Picture {item['picture']}"
        elif item["kind"] == "video":
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
    report_lines = ["Wire references in this order. Picture 1 is ref_image_0."]
    if any(item["kind"] != "picture" or item.get("voice") for item in assigned):
        report_lines.append(
            "Images are numbered first, then videos, then audio. "
            "A video soundtrack on the H3 node takes an Audio number before standalone audio.")
    if mapping:
        for row in mapping:
            report_lines.append(f"{row['label']} → {row['wire']} · {row['name']}")
    else:
        report_lines.append("No subjects are switched on.")
    report_lines.append(
        "An empty image slot in front of a later one on the H3 node pulls every picture after it forward.")

    return {
        "prompt": prompt,
        "report": "\n".join(report_lines),
        "map": mapping,
        "lines": lines,
    }
