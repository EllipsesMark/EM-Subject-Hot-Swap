"""Deterministic format validation for generated H3 prompts."""

import json
import re

BASE_FIELDS = ["integrated_multimodal_description:", "overall_soundscape:",
               "non_diegetic_music:"]
REF_SECTIONS = ["subject_definitions:", "summary:", "retention_analysis:",
                "detailed_description:", "overall_soundscape:",
                "non_diegetic_music:"]
TASK_TYPES = {"keyframe completion", "reference generation", "video editing",
              "video continuation", "audio reuse", "audio reference"}
VISUAL_MARKERS = {"fully_preserved", "partially_preserved",
                  "attribute_transfer", "weak_reference"}
AUDIO_MARKERS = {"fully_copy", "partially_copy", "reference", "weak_reference"}

from .guides import I2VA_LINE


def strip_fences(text):
    """LLMs love wrapping output in ``` fences; remove them if present."""
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\s*\n?", "", t)
        t = re.sub(r"\n?```\s*$", "", t)
    return t.strip()


def _check_shared(text, duration, issues):
    if text.count("<d>") != text.count("</d>"):
        issues.append("Unbalanced <d>/</d> dialogue tags.")
    for m in re.finditer(r"At (\d{2}):(\d{2})\.(\d{3})", text):
        t = int(m.group(1)) * 60 + int(m.group(2)) + int(m.group(3)) / 1000.0
        if t >= duration:
            issues.append(
                f"Shot cut time {m.group(0)} is not within the "
                f"{duration:.2f}s video duration.")
    if re.search(r"\[(?:Push in|Pull out|Pan left|Pan right|Zoom in|Zoom out|"
                 r"Truck left|Truck right|Tilt up|Tilt down|Pedestal up|"
                 r"Pedestal down|Static shot|Tracking shot|Shake)[^\]]*\]",
                 text, re.IGNORECASE):
        issues.append("Bracketed camera commands found; camera motion must be "
                      "written as natural prose (that syntax is for the old "
                      "Hailuo API, not H3).")


def _fields_in_order(text, fields, issues):
    pos = -1
    for f in fields:
        p = text.find("\n" + f) if not text.startswith(f) else 0
        if p == -1 and not text.startswith(f):
            issues.append(f"Missing required section `{f}`.")
            continue
        p = text.find(f)
        if p < pos:
            issues.append(f"Section `{f}` is out of order.")
        pos = p


def validate_base(text, mode, duration):
    """mode: t2va | i2va | fl2va | l2va. Returns list of issue strings."""
    issues = []
    dur = f"{duration:.2f}"
    first_line = text.split("\n", 1)[0].strip()

    if mode == "t2va":
        if "reference pictures" in first_line or first_line.startswith(
                "For the target video"):
            issues.append("T2VA must not contain an image-alignment "
                          "instruction line.")
        if not first_line.startswith("integrated_multimodal_description:"):
            issues.append("T2VA must begin directly with "
                          "`integrated_multimodal_description:`.")
    elif mode == "i2va":
        if first_line != I2VA_LINE:
            issues.append("First line must be exactly: " + I2VA_LINE)
    elif mode == "fl2va":
        if not first_line.startswith(
                "How the reference pictures align with the target video"):
            issues.append("FL2VA must begin with the two-picture alignment "
                          "instruction line.")
        if f"{dur}-second mark" not in first_line:
            issues.append(f"Picture 2 must align with the {dur}-second mark "
                          "(the exact video duration, two decimals).")
        if "0.00-second mark" not in first_line:
            issues.append("Picture 1 must align with the 0.00-second mark.")
    elif mode == "l2va":
        if not first_line.startswith(
                "How the reference pictures align with the target video"):
            issues.append("L2VA must begin with the last-frame alignment "
                          "instruction line.")
        if f"{dur}-second mark" not in first_line:
            issues.append(f"<Picture 1> must align with the {dur}-second "
                          "mark (the exact video duration, two decimals).")

    _fields_in_order(text, BASE_FIELDS, issues)
    if "[Shot 1]" not in text:
        issues.append("Missing `[Shot 1]` opening shot marker.")
    if mode == "t2va" and "<Picture" in text:
        issues.append("T2VA must not mention <Picture>.")
    if mode == "i2va" and "Picture 2" in text:
        issues.append("I2VA must not mention Picture 2.")
    _check_shared(text, duration, issues)
    return issues


def validate_ref(text, duration, expected_labels=()):
    """expected_labels: iterable like ('<Picture 1>', '<Video 1>', ...)."""
    issues = []
    _fields_in_order(text, REF_SECTIONS, issues)

    m = re.search(r"^summary:\s*\n?\s*\[([^\]]+)\]", text, re.MULTILINE)
    if not m:
        issues.append("`summary:` must start with a bracketed task-type "
                      "prefix like `[reference generation]`.")
    else:
        for t in (s.strip() for s in m.group(1).split("+")):
            if t not in TASK_TYPES:
                issues.append(f"Unknown task type `{t}` in summary prefix. "
                              f"Allowed: {sorted(TASK_TYPES)}.")

    ra = re.search(r"retention_analysis:\s*\n(.*?)(?=\ndetailed_description:)",
                   text, re.DOTALL)
    if ra:
        for line in filter(None, (l.strip() for l in ra.group(1).splitlines())):
            marker = re.search(r":\s*([a-z_]+)\s*-", line)
            if marker and marker.group(1) not in VISUAL_MARKERS | AUDIO_MARKERS:
                issues.append(f"Unknown retention marker `{marker.group(1)}` "
                              f"in line: {line[:80]}")

    for label in expected_labels:
        if label not in text:
            issues.append(f"Connected reference {label} is never mentioned "
                          "in the prompt.")

    if "[Shot 1]" not in text:
        issues.append("Missing `[Shot 1]` opening shot marker.")
    _check_shared(text, duration, issues)
    return issues


REF_SECTION_MARKERS = (
    "subject_definitions:", "summary:", "retention_analysis:",
    "detailed_description:", "integrated_multimodal_description:",
)
CONTINUATION_HINTS = re.compile(
    r"\b(continue|continuing|previous (scene|clip|ending|pose|shot)|"
    r"from the (prior|previous)|without resetting|same pose|holding the|"
    r"unfinished|airlock|pick(s)? up where)\b",
    re.IGNORECASE)
BRIDGE_HINTS = re.compile(
    r"\b(end(s|ing)? (on|with|while|holding)|final frame|bridge|"
    r"next scene|leading into)\b",
    re.IGNORECASE)


def _shot_prompt_text(value):
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return "\n".join(str(x) for x in value).strip()
    return ""


def align_h3_frames(seconds, fps=24):
    """Snap duration up to the 17k+5 grid (same rule as H3 nodes)."""
    n = max(5, int(round(float(seconds) * fps)))
    while n % 17 != 5:
        n += 1
    return n


def parse_chain_plan(text):
    """Parse LLM output to a plan dict. Raises ValueError on bad JSON."""
    raw = strip_fences(text)
    data = json.loads(raw)
    if isinstance(data, list):
        data = {"shots": data}
    if not isinstance(data, dict):
        raise ValueError("Plan must be a JSON object or shots array.")
    return data


def format_chain_plan(data):
    """Stable JSON string for Contex Loop Plan input."""
    return json.dumps(data, ensure_ascii=False, indent=2)


def validate_chain_plan(text, scene_count, context_length=22,
                        expected_labels=(), default_duration=10.0,
                        include_seeds=False):
    """Validate Contex Loop plan JSON. Returns (issues, warnings)."""
    issues, warnings = [], []
    try:
        data = parse_chain_plan(text)
    except (json.JSONDecodeError, ValueError) as exc:
        return [f"Invalid JSON: {exc}"], warnings

    prefix = data.get("prompt_prefix", data.get("global_prompt", ""))
    if not str(prefix or "").strip():
        issues.append("Missing non-empty `prompt_prefix` (or `global_prompt`).")

    shots = data.get("shots")
    if not isinstance(shots, list) or not shots:
        issues.append("Missing non-empty `shots` array.")
        return issues, warnings
    if len(shots) != int(scene_count):
        issues.append(
            f"Expected exactly {scene_count} shots; got {len(shots)}.")

    seen_ids = set()
    for i, item in enumerate(shots, start=1):
        if isinstance(item, str):
            item = {"prompt": item}
        if not isinstance(item, dict):
            issues.append(f"Shot {i} must be an object or prompt string.")
            continue

        sid = str(item.get("id") or f"scene_{i:02d}")
        if sid in seen_ids:
            issues.append(f"Duplicate shot id `{sid}`.")
        seen_ids.add(sid)

        prompt = _shot_prompt_text(item.get("prompt", ""))
        if not prompt.strip() and not str(prefix or "").strip():
            issues.append(
                f"Shot {i} (`{sid}`) needs a prompt or shared prompt_prefix.")

        for marker in REF_SECTION_MARKERS:
            if marker in prompt.lower():
                issues.append(
                    f"Shot {i} looks like a full H3 prompt (`{marker}`). "
                    "Use scene deltas only; put globals in prompt_prefix.")
                break

        dur = float(item.get("duration_seconds",
                             (data.get("defaults") or {}).get(
                                 "duration_seconds", default_duration)))
        raw_frames = align_h3_frames(dur)
        if i > 1 and raw_frames <= int(context_length):
            issues.append(
                f"Shot {i} duration (~{raw_frames} raw frames) must exceed "
                f"context_length ({context_length}) for chained clips.")

        if i > 1 and not CONTINUATION_HINTS.search(prompt):
            warnings.append(
                f"Shot {i} (`{sid}`): no obvious continuation language — "
                "joins may jump or duplicate subjects.")
        if i < len(shots) and not BRIDGE_HINTS.search(prompt):
            warnings.append(
                f"Shot {i} (`{sid}`): weak ending bridge for the next scene.")

        if prompt.count("<d>") != prompt.count("</d>"):
            issues.append(f"Shot {i} has unbalanced <d>/</d> dialogue tags.")

        if include_seeds and "seed" not in item:
            warnings.append(f"Shot {i} (`{sid}`): seed omitted despite "
                            "include_seeds=true.")
        if not include_seeds and "seed" in item:
            warnings.append(f"Shot {i} (`{sid}`): seed present but "
                            "include_seeds=false (harmless).")

    for label in expected_labels:
        blob = str(prefix) + "\n" + "\n".join(
            _shot_prompt_text(s.get("prompt", "") if isinstance(s, dict) else s)
            for s in shots)
        if label not in blob:
            issues.append(
                f"Connected reference {label} never appears in the plan.")

    defaults = data.get("defaults")
    if defaults is not None and not isinstance(defaults, dict):
        issues.append("`defaults` must be an object when present.")

    return issues, warnings
