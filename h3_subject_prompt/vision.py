"""Two short asks for the H3 Prompt Writer's in-process GGUF.

Describe reads one still and returns the two card lines (who, what stays).
Draft reads the checked stills plus the card lines as they are right now,
and returns only the shot section. The card lines are rebuilt here on every
call, so a swapped character is what the model sees next time.
"""

import os
import re
import threading

from .assemble import (
    _CONCEPT_KEEP,
    _concept,
    assign,
    definition_lines,
    migrate_state,
    retention_lines,
)

_TAG = re.compile(r"<\s*/?\s*(?:picture|subject|video|audio)\b[^>]*>", re.I)
_MARKER = re.compile(
    r"^(?:fully_preserved|partially_preserved|attribute_transfer|weak_reference|"
    r"fully_copy|partially_copy|reference)\s*[-:]\s*",
    re.I,
)
_LOCK = threading.Lock()

_DESCRIBE_SYSTEM = """You fill two lines for one RefMod identity from one still when a still is attached, or from the file description when no still is attached.
Reply with exactly two lines and nothing else:
who: <one noun phrase>
keep: <the same features, ending with "are retained">

The card turns your lines into:
<Subject 1> is {who}.
<Video 1> is the identity reference for <Subject 1>, face, hair, and build only.
fully_preserved - {keep} are all retained.

A person / identity RefMod: who is the person, then visible face, hair, skin, and build. No clothing, no pose, no room, no Video tag.
A wardrobe RefMod: who is the clothing set in plain pieces. No face.
A place / background RefMod: who is the room and fixed furniture. No person body.
keep repeats those same features and ends with "are retained". Do not start keep with a marker name."""

_DRAFT_SYSTEM = """You expand the draft into four parts of a MiniMax H3 reference prompt.
The subject lines and the retention lines in the user message are already decided.
Use those <Subject N> and <Video N> / <Audio N> labels exactly. Do not invent a different person or place.
The locked lines are the look. The summary names each <Subject N> and what happens. It does not copy hair, skin, build, or clothes.
The opening is style and light only. It does not name a subject, a room, or the framing.
On the first appearance of a person, write <Subject N> then where they are and what they do. Do not paste who-line looks (hair, skin, build, clothes) — Subject reinforce adds those at assemble time.
On a place, <Subject N> is the room. Keep furniture named in the draft. Do not sit on the place subject.
On a clothing set, <Subject N> is the outfit. The person wears that subject. The set has no face.
Do not cite <Picture N> or <Video N> in the summary, the opening, or the shots. Video tags stay in the locked subject lines only.
Once a person is established, she, he, her, and him are fine.
Later shots start again with the same <Subject N>. Do not restate who they are.
A stacked RefMod is face, hair, and build only. It is not a motion to copy.
Voice-reference bindings supplied in the user message are authoritative. On a subject's first vocalization, cite only the Audio tag explicitly mapped to that subject; never guess, omit, or substitute another subject's Audio tag.
Assign speaker IDs to vocalizing subjects once by the order of their first actual vocal event in the target video: the first distinct speaker is (S1), the next new speaker is (S2), and so on, including subjects without voice references. For example, if <Subject 2> speaks first and <Subject 1> replies, they are (S1) and (S2), respectively. Audio numbers do not determine speaker order. Do not derive S IDs from Subject numbers, Audio numbers, or RefMod row order. Reuse each speaker's ID for later vocalizations and shots. A subject who never vocalizes gets no speaker ID. For a paired voice reference, put the assigned (Sx) on that subject's first vocalization; final prompt assembly reuses that same ID in the matching <Audio N> definition and does not assign a new ID there. Write a referenced first vocalization as <Subject N> (Sx), using the voice timbre referenced from that subject's mapped <Audio N>, says <d>[English] exact words</d>; without a paired reference, use <Subject N> (Sx) says <d>[English] exact words</d>. Never write <Subject N> <Audio N> or <Subject N> (<Audio N>). Spoken words go only inside the <d> tag. A moan or breath is not dialogue and stays outside it.
Write a repeated action as one continuous steady rhythm.
overall_soundscape is the diegetic bed only: room tone plus fabric, breath, or contact that fits the action. No subject names. No score.
Do not write subject definitions, retention, or music."""

_REPLY_CONTRACT = """Reply with four parts and nothing else. Do not copy these orders into the answer.
summary: one or two sentences of what the video shows. No [task] prefix.
opening: one or two sentences of style and light. Start with "The target video". No subject, no room, no framing, no shot marker.
detailed_description:
[Shot 1] The action, written out. Composition, where <Subject N> is in the frame, the action from its start through its finish, the camera, the light, and the sound. Several sentences. Not a label and not one clause.
overall_soundscape: short diegetic bed (e.g. room tone, fabric rustle, soft breath). No music. No subject names.

Start [Shot 1] with no timestamp. A later shot is [Shot N] At MM:SS.mmm."""

_GEMMA_NOTE = (
    "Write each <Subject N> once in a shot, then use she or he. "
    "Do not cite <Video N> or <Picture N> in the shot. "
    "Assign S IDs to vocalizing subjects by first vocal-event order, including those without voice references; "
    "do not use Subject, Audio, or RefMod row order. Reuse each ID across later vocalizations. "
    "For a paired voice reference, cite its matching Audio N on the subject's first vocalization. "
    "Never write <Subject N> <Audio N> or <Subject N> (<Audio N>). "
    "Spoken words go in <d>[English] words</d>, not in quotes. "
    "On the first appearance of a person, write <Subject N> then the action — no who-line looks. "
    "A place is the room. A clothing set is the outfit a person wears."
)
_QWEN_NOTE = (
    "Write the action in concrete physical detail. On the first appearance of a person, write <Subject N> then the action — no who-line looks. "
    "A place is the room. A clothing set is the outfit a person wears."
)
_PASS_DEVELOP = (
    "The typed draft is the spine, not the finished shot. "
    "Walk that spine across the whole clip: how it starts, what changes in the middle, and how it ends. "
    "Add the contact, the sound, the camera, and the breath this action needs. "
    "Do not add a new person, a new event, or a look."
)
_PASS_CLOSE = (
    "Stay close to the typed draft. Turn it into the summary, the opening, and the shot. Do not add events."
)

# Same style / shot vocabulary as H3 Image to Video + PromptWriter.
_STYLE_OPENINGS = {
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
_STYLE_BIAS = {
    "cinematic": "filmic lighting, deliberate camera motion, polished pacing",
    "amateur": "natural/available light, ordinary room tone; do NOT write cinematic",
    "smartphone": "phone / selfie / UGC capture; hard on-camera lamp; do NOT write cinematic",
    "studio": "controlled even light, clean set; do NOT write cinematic unless asked",
    "documentary": "naturalistic light, unobtrusive camera; do NOT write cinematic",
    "commercial": "crisp advertising look, controlled highlights, tidy sound",
    "music_video": "rhythmic energy, stylized lighting, punchier motion",
    "vintage_film": "visible grain, softer contrast, period optical feel",
    "anime": "2D anime/illustration language; do NOT write live-action or cinematic",
    "3d_cg": "rendered CGI look; do NOT write live-action or cinematic unless asked",
}


def _style_shot_notes(data):
    """Style + shot dropdowns → draft directives (same vocabulary as I2V)."""
    if not isinstance(data, dict):
        data = {}
    style = str(data.get("style_mode") or "cinematic").strip().lower() or "cinematic"
    if style not in _STYLE_OPENINGS:
        style = "cinematic"
    shot = str(data.get("shot_size") or "medium shot").strip() or "medium shot"
    opening = _STYLE_OPENINGS[style]
    bias = _STYLE_BIAS.get(style, _STYLE_BIAS["cinematic"])
    return [
        f"Visual style mode: {style}. Bias: {bias}.",
        f"Opening must use this style phrase: The target video is {opening}.",
        f"Shot 1 framing: {shot}. Start [Shot 1] with that framing (e.g. A {shot} …).",
        "Do not invent a different style or shot size.",
    ]


def _is_gemma(model_name):
    return "gemma" in str(model_name or "").lower()


def _developing(data):
    if not isinstance(data, dict):
        return True
    return str(data.get("pass") or "develop").lower() != "close"


def draft_system(model_name, instructions=None, develop=True):
    """Built-in guide for the connected model, unless an override replaces it.

    Python still adds the pass mode and the four-part reply shape, so Close
    and Develop keep working and the parser still receives summary, opening,
    detailed_description, and overall_soundscape.
    """
    notes = instructions if isinstance(instructions, dict) else {}
    key = "override_gemma" if _is_gemma(model_name) else "override_qwen"
    override = str(notes.get(key) or "").strip()
    if override:
        body = override
    else:
        note = _GEMMA_NOTE if _is_gemma(model_name) else _QWEN_NOTE
        body = _DRAFT_SYSTEM.rstrip() + "\n" + note
    body += "\n\n" + (_PASS_DEVELOP if develop else _PASS_CLOSE)
    body += "\n\n" + _REPLY_CONTRACT
    extra = str(notes.get("extra") or "").strip()
    if extra:
        body += (
            "\n\nAdditional directives. Where they conflict with the above, these win. "
            "Still reply with only summary, opening, detailed_description, and overall_soundscape.\n"
            + extra
        )
    return body


def guide_for(model_name):
    """The replaceable portion, so an override box can start from the built-in text."""
    note = _GEMMA_NOTE if _is_gemma(model_name) else _QWEN_NOTE
    return _DRAFT_SYSTEM.rstrip() + "\n" + note


def _line(text):
    return " ".join(str(text or "").split()).strip()


def _draft_text(text):
    """Keep the draft's line breaks. Collapse the spaces inside each line."""
    lines = [" ".join(line.split()) for line in str(text or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    out = []
    blank = False
    for line in lines:
        if not line:
            if out and not blank:
                out.append("")
            blank = True
            continue
        blank = False
        out.append(line)
    return "\n".join(out).strip()


def _strip_fences(text):
    text = str(text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z0-9]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _who_phrase(text):
    text = _TAG.sub(" ", _line(text))
    text = re.sub(r"\b(?:in|from|as shown in)\b(?=\s+(?:with|and)\b)", "", text, flags=re.I)
    text = _line(text).strip(" \"'`").rstrip(".!?")
    text = _line(text)
    if not text:
        raise ValueError("The who line came back empty. Try Describe again.")
    return text[:600]


def _keep_clause(text):
    text = _MARKER.sub("", _line(text)).strip(" \"'`")
    text = _line(text).rstrip(".")
    if not text:
        raise ValueError("The keep line came back empty. Try Describe again.")
    return text[:600]


def parse_describe(text):
    """Pull who and keep out of a two-line reply."""
    raw = _strip_fences(text)
    who = keep = ""
    for line in raw.splitlines():
        item = line.strip().lstrip("-*").strip()
        low = item.lower()
        if low.startswith("who:"):
            who = item.split(":", 1)[1].strip()
        elif low.startswith("keep:"):
            keep = item.split(":", 1)[1].strip()
    if not who or not keep:
        snippet = _line(raw)[:180]
        raise ValueError(
            "The model did not return who and keep lines."
            + (f" It said: {snippet}" if snippet else " Try Describe again.")
        )
    return _who_phrase(who), _keep_clause(keep)


def parse_draft(text):
    """Keep the shot body. Drop any other section the model added."""
    raw = _strip_fences(text).strip()
    low = raw.lower()
    marker = "detailed_description:"
    if marker in low:
        raw = raw[low.index(marker) + len(marker):].strip()
        low = raw.lower()
    for header in ("overall_soundscape:", "non_diegetic_music:", "subject_definitions:", "retention_analysis:", "summary:"):
        if header in low:
            raw = raw[:low.index(header)].strip()
            low = raw.lower()
    shot = low.find("[shot")
    if shot > 0:
        raw = raw[shot:].strip()
    if "[shot" not in raw.lower():
        raise ValueError("The draft did not include [Shot 1]. Try Draft again.")
    return raw.strip()


_SECTION = re.compile(
    r"(?im)^(summary|opening|style|detailed_description|detailed|subject_definitions|retention_analysis|overall_soundscape|non_diegetic_music)\s*:"
)
_TASK_PREFIX = re.compile(r"^\[[^\]]+\]\s*")


def _labeled_block(text, label):
    match = re.search(rf"(?im)^{label}\s*:\s*", text)
    if not match:
        return ""
    rest = text[match.end():]
    stop = _SECTION.search(rest)
    if stop:
        rest = rest[:stop.start()]
    return rest.strip()


def _target_opening(text):
    """The guide's opening starts with 'The target video'."""
    text = _line(text)
    if not text:
        return ""
    low = text.lower()
    if low.startswith("the target video"):
        return text
    if low.startswith("uses ") or low.startswith("is "):
        return "The target video " + text[0].lower() + text[1:]
    body = text[0].lower() + text[1:]
    if body.startswith("a "):
        return "The target video is in " + body
    return "The target video is in a " + body


def _stub(text):
    low = _line(text).lower().strip(" .")
    return low in {
        "1-2 sentences",
        "one or two sentences",
        "the target video is in a framing and light",
        "paragraph",
        "[shot 1] paragraph",
    } or low.startswith("[shot 1] paragraph")


def parse_expansion(text):
    """Pull summary, opening, shots, and soundscape out of a draft reply."""
    raw = _strip_fences(text).strip()
    summary = _line(_TASK_PREFIX.sub("", _labeled_block(raw, "summary")))
    opening = _line(_labeled_block(raw, "opening") or _labeled_block(raw, "style"))
    soundscape = _line(_labeled_block(raw, "overall_soundscape"))
    block = _labeled_block(raw, "detailed_description") or _labeled_block(raw, "detailed") or raw
    shot_at = block.lower().find("[shot")
    if shot_at > 0 and not opening:
        opening = _line(block[:shot_at])
    if "[shot" in opening.lower():
        opening = _line(opening[:opening.lower().find("[shot")])
    opening = _target_opening(opening)
    detailed = parse_draft(block)
    if not summary or not opening:
        raise ValueError("The draft did not return a summary and an opening. Try Draft again.")
    if _stub(summary) or _stub(opening) or _stub(detailed):
        raise ValueError("The draft copied the instructions instead of writing the scene. Try Draft again.")
    if not soundscape or soundscape.upper() == "N/A":
        soundscape = "room tone"
    return summary, opening, detailed, soundscape


_MOTION = (
    ("weight", "Show the start, the carry, and the landing of the lead motion. Do not add a second motion."),
    ("contact", "Name both sides of the contact and the sound of that meeting. The reaction stays on that same cycle."),
    ("follow", "Hair, breasts, soft tissue, and loose cloth answer the lead motion, and they move less than it. They are not a second action."),
    ("settle", "End on breathing or the body coming to rest. Do not add a new motion."),
)


def _motion_lines(data):
    chosen = data.get("motion") if isinstance(data.get("motion"), dict) else {}
    return [text for key, text in _MOTION if chosen.get(key)]


def _cast_line(mods):
    people = []
    places = []
    sets = []
    for item in assign(mods):
        if item["kind"] != "visual":
            continue
        label = f"<Subject {item['subject']}>"
        if item["concept"] == "background":
            places.append(label)
        elif item["concept"] == "wardrobe":
            sets.append(label)
        else:
            people.append(label)
    return (
        "People: " + (", ".join(people) if people else "none")
        + ". Places: " + (", ".join(places) if places else "none")
        + ". Sets: " + (", ".join(sets) if sets else "none")
        + "."
    )


def _hybrid_state(data):
    for row in (data or {}).get("mods") or []:
        if not isinstance(row, dict):
            continue
        if str(row.get("source") or "").lower() == "image":
            return True
        if str(row.get("image") or "").strip() and not str(row.get("refmod") or "").strip():
            return True
    return False


def draft_request(data, length=124):
    """Locked subject lines plus optional looks / stills for vision.

    Returns (header, [(label, attachment), ...]). Attachments may be empty when
    no RefMod has baked looks; Draft then runs text-only.
    """
    from .refmods import look_jpeg

    hybrid = _hybrid_state(data)
    if hybrid:
        from . import hybrid_assemble as ha
        data = ha.migrate_state(data if isinstance(data, dict) else {})
        assign_fn = ha.assign
        def_lines = ha.definition_lines
        ret_lines = ha.retention_lines
    else:
        data = migrate_state(data if isinstance(data, dict) else {})
        assign_fn = assign
        def_lines = definition_lines
        ret_lines = retention_lines

    assigned = assign_fn(data.get("mods") or [])
    definitions = []
    retentions = []
    pictures = []
    voice_bindings = []
    for item in assigned:
        definitions.extend(def_lines(item))
        retentions.extend(ret_lines(item))
        if item.get("subject") and item.get("voice") and item["kind"] != "audio":
            voice_bindings.append(
                f"<Subject {item['subject']}> -> <Audio {item['voice']}>"
            )
        if item["kind"] == "picture":
            pictures.append((f"<Picture {item['picture']}>", {"image": item.get("image") or ""}))
            continue
        if item["kind"] not in ("visual", "refmod"):
            continue
        refmod = item.get("refmod") or ""
        if refmod and look_jpeg(refmod, 0):
            label = f"<Video {item['video']}>" if item.get("video") else "<Video>"
            pictures.append((label, {"refmod": refmod, "index": 0}))
    if not definitions:
        raise ValueError("Check a RefMod or image row before drafting.")

    try:
        frames = max(5, int(length))
    except (TypeError, ValueError):
        frames = 124
    idea = _draft_text(data.get("idea"))
    if not idea:
        raise ValueError("Write the draft first.")
    develop = _developing(data)
    motion = _motion_lines(data)
    parts = [
        f"Duration: {frames / 24.0:.1f} seconds.",
        "Draft to expand into the summary, the opening, and the shots:" if develop else "Draft to turn into the summary, the opening, and the shots:",
        idea,
        "",
        _PASS_DEVELOP if develop else _PASS_CLOSE,
        "",
    ]
    if motion:
        parts.extend(["Motion to write into the shots:", *motion, ""])
    parts.extend([*_style_shot_notes(data), ""])
    parts.extend([
        "Locked subject lines:",
        "\n".join(definitions) if definitions else "(none)",
        "",
        "Locked retention lines:",
        "\n".join(retentions) if retentions else "(none)",
        "",
        _cast_line(data.get("mods") or []),
        "The locked lines are the look. The summary names each <Subject N> and what happens. It does not copy hair, skin, build, or clothes.",
        "The opening is style and light only — follow the Visual style mode above.",
        "On the first appearance of a person, <Subject N> plus one short phrase from the locked who line, then she or he.",
        "Do not cite <Video N> or <Picture N> in the summary, the opening, or the shots.",
        "A stacked RefMod is face, hair, and build only. It is not a motion to copy.",
        "Put spoken words from the draft inside <d>[English] exact words</d>.",
    ])
    if voice_bindings:
        parts.extend([
            "Voice-reference bindings (authoritative; do not change):",
            *voice_bindings,
            "",
        ])
    if pictures:
        parts.append(
            "Stills are attached in this order: "
            + ", ".join(label for label, _name in pictures)
            + ". One stored look per reference when the file has looks."
        )
    else:
        parts.append(
            "No baked looks are attached. Write from the locked subject lines and the draft only."
        )
    if any(item.get("voice") or item["kind"] == "audio" for item in assigned):
        parts.append(
            "Assign S IDs to vocalizing subjects by first vocal-event order in the target video, including subjects "
            "without voice references: first distinct speaker is (S1), next new speaker is (S2), and so on. "
            "Do not use Subject, Audio, or RefMod row order; reuse each ID for later vocalizations. "
            "For example, if <Subject 2> speaks first and <Subject 1> replies, they are (S1) and (S2). "
            "A subject who never vocalizes gets no speaker ID. Audio numbers do not determine S-ID order. "
            "For a subject listed in the voice-reference bindings, cite exactly its mapped Audio tag on "
            "its first vocalization and put its assigned (Sx) there; final prompt assembly copies that "
            "same ID into the matching Audio definition. Never omit the mapped tag or use another "
            "subject's Audio tag. Never write <Subject N> <Audio N> or <Subject N> (<Audio N>)."
        )
    return "\n".join(parts), pictures


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


def loader_handle(loader, require_mmproj=True):
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
    if require_mmproj and (not mmproj_name or mmproj_name == "none"):
        raise ValueError("Set the matching mmproj on LLM (GGUF) - Loader. none cannot see the still.")
    try:
        n_ctx = int(loader.get("n_ctx") or 16384)
    except (TypeError, ValueError):
        n_ctx = 16384
    try:
        n_gpu = int(-1 if loader.get("n_gpu_layers") is None else loader.get("n_gpu_layers"))
    except (TypeError, ValueError):
        n_gpu = -1
    mmproj_path = None
    if mmproj_name and mmproj_name != "none":
        mmproj_path = _under_models(mmproj_name)
    elif require_mmproj:
        raise ValueError("Set the matching mmproj on LLM (GGUF) - Loader. none cannot see the still.")
    return {
        "model_path": _under_models(model_name),
        "mmproj_path": mmproj_path,
        "n_ctx": n_ctx,
        "n_gpu_layers": n_gpu,
        "keep_loaded": bool(loader.get("keep_loaded")),
    }


def _still_jpeg_b64(image_ref):
    """Encode an input / wardrobe: still as JPEG base64 for the vision LLM."""
    import base64
    import io

    from PIL import Image

    from .hybrid_stills import resolve_image

    path = resolve_image(image_ref)
    if not path or not os.path.isfile(path):
        raise ValueError(f"Image file not found: {image_ref}")
    with Image.open(path) as img:
        rgb = img.convert("RGB")
        buf = io.BytesIO()
        rgb.save(buf, format="JPEG", quality=88)
        return base64.b64encode(buf.getvalue()).decode("ascii")


def _jpeg(filename):
    import base64

    from .refmods import look_jpeg

    if isinstance(filename, dict):
        image = str(filename.get("image") or "").strip()
        if image:
            return _still_jpeg_b64(image)
        name = str(filename.get("refmod") or "")
        index = int(filename.get("index") or 0)
    else:
        name = str(filename or "")
        index = 0
        if name.startswith("refmod:"):
            name = name[len("refmod:"):]
        elif name.startswith("wardrobe:") or ("/" in name or "\\" in name) or name.lower().endswith(
            (".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif")
        ):
            # Plain input path or wardrobe: catalogue still.
            return _still_jpeg_b64(name)
    raw = look_jpeg(name, index) if name else None
    if not raw:
        raise ValueError(f"{name or 'This RefMod'} has no stored pictures. Describe and Draft cannot see it.")
    return base64.b64encode(raw).decode("ascii")


def _local_llm():
    from ..h3_llm import local_llm

    return local_llm


def _chat(handle, messages, max_tokens, seed, temperature):
    local_llm = _local_llm()
    try:
        with _LOCK:
            return local_llm.chat(
                handle, messages, temperature=temperature, max_tokens=max_tokens, seed=seed,
            )
    except Exception as exc:
        raise ValueError(str(exc)) from exc


def _image_parts(pairs):
    parts = []
    for label, filename in pairs:
        parts.append({"type": "text", "text": f"This is {label}."})
        parts.append({"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + _jpeg(filename)}})
    return parts


def describe_note(concept):
    """Tell Describe which concept the RefMod is."""
    concept = str(concept or "identity").lower()
    if concept in ("place", "background"):
        return "This RefMod is a place. Describe the room. Do not describe a person."
    if concept in ("set", "wardrobe"):
        return "This RefMod is a clothing set. Describe the garments. Do not describe a face."
    return "This RefMod is an identity. Describe the person. Do not describe the room."


def _who_from_name(name):
    stem = str(name or "").replace("\\", "/").rsplit("/", 1)[-1]
    stem = re.sub(r"(_refmod)?(_visual|_audio)?$", "", stem, flags=re.I)
    stem = stem.replace("_", " ").replace("-", " ").strip()
    return _line(stem) or "the subject"


def _usable_who(text, name=""):
    who = _line(text)
    low = who.lower()
    if not who:
        return _who_from_name(name)
    if low in {"refmod", "refmod dataset", "dataset", "none", "n/a", "na"}:
        return _who_from_name(name)
    if "refmod dataset" in low or low.startswith("refmod "):
        return _who_from_name(name)
    return who


def _describe_from_meta(name, concept):
    from .refmods import file_info
    info = file_info(name) or {}
    who = _usable_who(info.get("description") or "", name)
    keep = _CONCEPT_KEEP.get(_concept({"concept": concept}), _CONCEPT_KEEP["identity"]) + " are retained"
    note = "Filled from the file name. No baked looks and no usable description."
    if _line(info.get("description") or "") and who == _line(info.get("description") or ""):
        note = "Filled from the RefMod description. No baked looks to describe."
    return {"who": who[:600], "keep": keep, "note": note}


def answer(data):
    """Run one Describe or Draft call. data is the JSON body from the panel."""
    if not isinstance(data, dict):
        data = {}
    job = str(data.get("job") or "")
    if job == "describe":
        filename = str(data.get("image") or "").strip()
        if not filename:
            raise ValueError("Choose a RefMod or image first.")
        concept = data.get("concept") or data.get("role") or "identity"
        is_still = (
            filename.startswith("wardrobe:")
            or (not filename.startswith("refmod:") and (
                "/" in filename or "\\" in filename
                or filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"))
            ))
        )
        if is_still:
            handle = loader_handle(data.get("loader") or {}, require_mmproj=True)
            still_ref = filename
            messages = [
                {"role": "system", "content": _DESCRIBE_SYSTEM},
                {"role": "user", "content": [
                    {"type": "text", "text": describe_note(concept)},
                    *_image_parts([("the still", {"image": still_ref})]),
                ]},
            ]
            who, keep = parse_describe(_chat(handle, messages, 512, 0, 0.2))
            return {"who": who, "keep": keep, "desc": who}
        if filename.startswith("refmod:"):
            filename = filename[len("refmod:"):]
        from .refmods import look_jpeg
        if not look_jpeg(filename, 0):
            return _describe_from_meta(filename, concept)
        handle = loader_handle(data.get("loader") or {})
        messages = [
            {"role": "system", "content": _DESCRIBE_SYSTEM},
            {"role": "user", "content": [
                {"type": "text", "text": describe_note(concept)},
                *_image_parts([("the still", "refmod:" + filename)]),
            ]},
        ]
        who, keep = parse_describe(_chat(handle, messages, 512, 0, 0.2))
        return {"who": who, "keep": keep}
    if job == "draft":
        state = migrate_state(data.get("state") or {})
        develop = _developing(state)
        header, pictures = draft_request(state, data.get("length"))
        handle = loader_handle(data.get("loader") or {}, require_mmproj=bool(pictures))
        content = [{"type": "text", "text": header}]
        if pictures:
            content.extend(_image_parts(pictures))
        messages = [
            {"role": "system", "content": draft_system(
                handle.get("model_path"), data.get("instructions"), develop,
            )},
            {"role": "user", "content": content},
        ]
        summary, opening, detailed, soundscape = parse_expansion(
            _chat(handle, messages, 3072, -1, 0.7 if develop else 0.4)
        )
        return {
            "summary": summary,
            "opening": opening,
            "detailed": detailed,
            "soundscape": soundscape,
        }
    if job == "save_description":
        from .refmods import save_description
        name = str(data.get("name") or data.get("image") or "").strip()
        if name.startswith("refmod:"):
            name = name[len("refmod:"):]
        keep = data.get("keep")
        return save_description(
            name,
            data.get("description") or data.get("who") or "",
            data.get("concept") or data.get("role"),
            keep=None if keep is None else str(keep),
        )
    raise ValueError("Unknown vision job.")
