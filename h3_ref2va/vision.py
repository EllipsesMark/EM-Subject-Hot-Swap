"""Two short asks for the H3 Prompt Writer's in-process GGUF.

Describe reads one still and returns the two card lines (who, what stays).
Draft reads the checked stills plus the card lines as they are right now,
and returns only the shot section. The card lines are rebuilt here on every
call, so a swapped character is what the model sees next time.
"""

import os
import re
import threading

from .assemble import assign, definition_lines, retention_lines

_TAG = re.compile(r"<\s*/?\s*(?:picture|subject|video|audio)\b[^>]*>", re.I)
_MARKER = re.compile(
    r"^(?:fully_preserved|partially_preserved|attribute_transfer|weak_reference|"
    r"fully_copy|partially_copy|reference)\s*[-:]\s*",
    re.I,
)
_LOCK = threading.Lock()

_DESCRIBE_SYSTEM = """You fill two lines of one card from one still. The user message says whether the card is a person or a place. Follow that. Do not decide from whoever happens to be standing in the frame.
Reply with exactly two lines and nothing else:
who: <one noun phrase>
keep: <the same features, ending with "are retained">

The card turns your lines into:
<Subject 1> is {who}, as shown in <Picture 1>.
fully_preserved - {keep} are all retained from <Picture 1>.

If the still is a sheet, it is one subject. Use the traits that agree across the views. Do not describe the grid, the panels, the borders, or any text on the sheet.
Name only what this still shows. Do not invent a feature. Do not copy a sample person.

A person card describes the person, even when a room is behind them.
who is one noun phrase: the person, then the visible face, hair, skin, build, and anatomy. Include eyes, nose, lips, jaw, hair color and length, skin tone, breasts, waist, hips, and a mole, scar, or tattoo when they are visible. Be specific to this still. Describe anatomy plainly. Do not euphemize it and do not skip it.
No clothing, no the word nude, no pose, no room, no camera, no Picture tag. The outfit is added later.
keep repeats those same features and ends with "are retained". Do not answer with only "identity, facial features, skin tone, and hair are retained". Do not mention clothes. Do not start keep with a marker name.

A place card describes the room, even when a person is in it. Do not describe that person's body.
who is one noun phrase: the room, then the fixed parts that are visible, such as the bed, the sofa, the window, the walls, and the light.
keep repeats those same parts and ends with "are retained". No person, no body, no clothes. Do not start keep with a marker name."""

_DRAFT_SYSTEM = """You expand the draft into four parts of a MiniMax H3 reference prompt.
The subject lines and the retention lines in the user message are already decided.
Use those <Subject N> labels exactly. Do not invent a different person or a different place. Leave <Picture N> in the locked subject lines.
The locked lines are the look. The summary names each <Subject N> and what happens, including a place, a voice, and a clothing set when the locked lines have them. It does not copy hair, skin, build, clothes, or a list of furniture.
The opening is style and light only. It does not name a subject, a room, or the framing.
On the first appearance of a person, write <Subject N> then where they are and what they do. Do not paste who-line looks (hair, skin, build, clothes) — Subject reinforce adds those at assemble time. A person wears a clothing set by its <Subject N>. A person may sit on, straddle, or lie with another person subject.
On the first appearance of a place, <Subject N> is the room. Keep the furniture named in the draft and write that furniture in the place. Do not sit on, straddle, or lie on the place subject. Do not paste the whole who line.
On a clothing set, <Subject N> is the outfit. The person wears that subject. The set has no face and does not take the action. Do not paste its piece list into the shot.
Do not cite <Picture N> in the summary, the opening, or the shots. Do not repeat a person's phrase later in the shot or in a later shot.
Once a person is established, she, he, her, and him are fine.
Later shots start again with the same <Subject N>. Do not restate who they are. Do write how the body moves.
Name a body part only when the action moves it or it meets something.
Write a camera move as its motion type. Add amplitude or speed only when it matters. Prefer a camera move over a new shot when only the distance or the angle changes.
Do not invent Picture, Audio, or speaker numbers that are not in the locked lines.
When a locked line gives a subject a voice-timbre reference, the first time that person vocalizes write <Subject N> (S1), using the speaker id from that locked line, and say they are using the voice timbre referenced from that audio. Never write <Subject N> <Audio N> or <Subject N> (<Audio N>). Reuse both after that. Put only spoken words from the draft inside <d>[English] exact words</d>. The delivery stays outside the tag. If the draft names a language, use that name inside the brackets. Otherwise use English. Do not invent words. Do not put speech in quotation marks. A moan or a breath is not dialogue and stays outside the tag. The example is the shape, not a line to copy: <Subject 1> (S1), using the voice timbre referenced from <Audio 1>, says <d>[English] exact words</d>.

Write a repeated action as one continuous steady rhythm. Name the part that drives each cycle, the part it meets, and the sound of that meeting. When the draft keeps one body inside the other, say that it remains there through every cycle. Do not turn the cycle into a withdrawal, a wiggle, or a separate motion of the whole body. On each cycle the other body gives at the point of contact. Hands, breath, and voice may answer that same cycle. Hair, breasts, soft tissue, and cloth may move with the cycle, and they move less than the driving part. Do not write the body shaking, wiggling, rippling, or moving everywhere at once.
When the user lists motion to write, show that motion inside the lead action. Do not add it when it is not listed.
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
    "Do not cite <Picture N> in the shot. "
    "A voice is <Subject N> (S1), never <Subject N> <Audio N>. "
    "Spoken words go in <d>[English] words</d>, not in quotes. "
    "On the first appearance of a person, write <Subject N> then the action — no who-line looks. Do not copy clothes. "
    "A place is the room. Keep the furniture from the draft in that subject. "
    "A clothing set is the outfit a person wears. It has no face and does not take the action."
)
_QWEN_NOTE = (
    "Write the action in concrete physical detail. On the first appearance of a person, write <Subject N> then the action — no who-line looks. Clothes stay on the card. A place is the room. "
    "A clothing set is the outfit a person wears. It has no face and does not take the action."
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


def _cast_line(subjects):
    people = []
    places = []
    sets = []
    for item in assign(subjects):
        if item["kind"] != "picture":
            continue
        label = f"<Subject {item['subject']}>"
        role = str(item["row"].get("role") or "").lower()
        if role == "place":
            places.append(label)
        elif role == "set":
            sets.append(label)
        else:
            people.append(label)
    return (
        "People: " + (", ".join(people) if people else "none")
        + ". Places: " + (", ".join(places) if places else "none")
        + ". Sets: " + (", ".join(sets) if sets else "none")
        + "."
    )


def draft_request(data, length=124):
    """Locked card text plus the checked stills, in encoder order.

    Returns (header, [(label, filename), ...]).
    """
    if not isinstance(data, dict):
        data = {}
    definitions = []
    retentions = []
    pictures = []
    for item in assign(data.get("subjects") or []):
        definitions.extend(definition_lines(item))
        retentions.extend(retention_lines(item))
        if item["kind"] != "picture":
            continue
        filename = str(item["row"].get("image") or "").strip()
        if not filename:
            raise ValueError(f"Picture {item['picture']} has no image file.")
        pictures.append((f"<Picture {item['picture']}>", filename))
    if not pictures:
        raise ValueError("Check a picture before drafting. The writer needs a still to look at.")

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
        "Stills are attached in this order: " + ", ".join(label for label, _name in pictures) + ".",
        "Write the action as one continuous steady rhythm. Name what meets on each cycle and the sound of that meeting. When the draft keeps one body inside the other, it remains there through every cycle. Other motion stays smaller than that cycle.",
        _cast_line(data.get("subjects") or []),
        "The locked lines are the look. The summary names each <Subject N> and what happens, including a place, a voice, and a clothing set when the locked lines have them. It does not copy hair, skin, build, clothes, or a list of furniture.",
        "The opening is style and light only — follow the Visual style mode above. It does not name a subject, a room, or the framing.",
        "On the first appearance of a person, write <Subject N> then where they are and what they do. Do not paste who-line looks (hair, skin, build, clothes) — Subject reinforce adds those at assemble time. A person wears a clothing set by its <Subject N>. A person may sit on, straddle, or lie with another person subject. Once a person is established, she, he, her, and him are fine.",
        "On the first appearance of a place, <Subject N> is the room. Keep the furniture named in the draft and write that furniture in the place. Do not sit on, straddle, or lie on the place subject.",
        "On a clothing set, <Subject N> is the outfit. The person wears that subject. The set has no face and does not take the action. Do not paste its piece list into the shot.",
        "Do not cite <Picture N> in the summary, the opening, or the shots. Name a body part only when the action moves it or it meets something.",
        "Write a camera move as its motion type. Add amplitude or speed only when it matters. Prefer a camera move over a new shot when only the distance or the angle changes.",
        "Video and audio are not attached. Use the locked lines for them.",
        "Put spoken words from the draft inside <d>[English] exact words</d>. The delivery stays outside the tag. If the draft names a language, use that name inside the brackets. Otherwise use English. Do not invent words. Do not put speech in quotation marks. A moan or a breath stays outside the tag.",
    ])
    if any(item.get("voice") for item in assign(data.get("subjects") or [])):
        parts.append(
            "When a locked line gives a subject a voice-timbre reference, the first time that person vocalizes write <Subject N> (S1), using the speaker id from that locked line, and say they are using the voice timbre referenced from that audio. "
            "Never write <Subject N> <Audio N> or <Subject N> (<Audio N>). Reuse both after that. The spoken words go inside <d>[English] exact words</d>. The example is the shape, not a line to copy: <Subject 1> (S1), using the voice timbre referenced from <Audio 1>, says <d>[English] exact words</d>."
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

    import node_helpers
    from PIL import Image, ImageOps

    from .wardrobe import resolve_image
    path = resolve_image(filename)
    if not path or not os.path.isfile(path):
        raise ValueError(f"Image file not found: {filename}")
    img = node_helpers.pillow(Image.open, path)
    frame = node_helpers.pillow(ImageOps.exif_transpose, img).convert("RGB")
    if max(frame.size) > 1024:
        scale = 1024 / max(frame.size)
        frame = frame.resize((max(1, round(frame.width * scale)), max(1, round(frame.height * scale))), Image.LANCZOS)
    buf = io.BytesIO()
    frame.save(buf, format="JPEG", quality=88)
    return base64.b64encode(buf.getvalue()).decode("ascii")


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


def describe_note(role):
    """Tell Describe which card switch is on, so a room is not written as a body."""
    if str(role or "").lower() == "place":
        return "This card is a place. Describe the room. Do not describe a person."
    return "This card is a person. Describe the person. Do not describe the room."


def answer(data):
    """Run one Describe or Draft call. data is the JSON body from the panel."""
    if not isinstance(data, dict):
        data = {}
    handle = loader_handle(data.get("loader") or {})
    job = str(data.get("job") or "")
    if job == "describe":
        filename = str(data.get("image") or "").strip()
        if not filename:
            raise ValueError("Choose an image first.")
        messages = [
            {"role": "system", "content": _DESCRIBE_SYSTEM},
            {"role": "user", "content": [
                {"type": "text", "text": describe_note(data.get("role"))},
                *_image_parts([("the still", filename)]),
            ]},
        ]
        who, keep = parse_describe(_chat(handle, messages, 512, 0, 0.2))
        return {"who": who, "keep": keep}
    if job == "draft":
        state = data.get("state") or {}
        develop = _developing(state)
        header, pictures = draft_request(state, data.get("length"))
        messages = [
            {"role": "system", "content": draft_system(
                handle.get("model_path"), data.get("instructions"), develop,
            )},
            {"role": "user", "content": [{"type": "text", "text": header}, *_image_parts(pictures)]},
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
    raise ValueError("Unknown vision job.")
