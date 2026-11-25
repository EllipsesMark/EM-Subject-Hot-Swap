"""Validate RefMod load rows and annotate the prompt for the editor."""

from .assemble import assign, build_prompt, migrate_state

MAX_VISUALS = 8
MAX_AUDIOS = 3


def visual_slots(data):
    """Enabled visual mods as (subject, video, refmod, strength)."""
    data = migrate_state(data if isinstance(data, dict) else {})
    slots = []
    for item in assign(data.get("mods") or []):
        if item["kind"] != "visual":
            continue
        slots.append((item["subject"], item["video"], item["refmod"], item["strength"]))
    return slots


def audio_slots(data):
    """Enabled voice refs as (audio number, name, voice_refmod)."""
    data = migrate_state(data if isinstance(data, dict) else {})
    slots = []
    for item in assign(data.get("mods") or []):
        if item.get("voice"):
            name = str(item["row"].get("who") or item["refmod"] or "subject").strip() or "subject"
            slots.append((item["voice"], name + " voice", item.get("voice_refmod") or ""))
        elif item["kind"] == "audio":
            name = str(item["row"].get("who") or item.get("refmod") or "voice").strip() or "voice"
            slots.append((item["audio"], name, item.get("refmod") or ""))
    return slots


def annotate(data):
    """Prompt plus a map that names each RefMod."""
    data = migrate_state(data if isinstance(data, dict) else {})
    result = build_prompt(data)
    for row in data.get("mods") or []:
        if not isinstance(row, dict) or row.get("enabled") is False:
            continue
        concept = str(row.get("concept") or "identity").strip().lower()
        visual = str(row.get("refmod") or "").strip()
        voice = str(row.get("voice_refmod") or "").strip()
        if concept == "voice":
            if not (voice or visual):
                result["error"] = "These checked rows have no RefMod."
                return result
        elif not visual:
            result["error"] = "These checked rows have no RefMod."
            return result
    visuals = visual_slots(data)
    audios = audio_slots(data)
    if len(visuals) > MAX_VISUALS:
        result["error"] = f"At most {MAX_VISUALS} visual RefMods can be loaded."
        return result
    if len(audios) > MAX_AUDIOS:
        result["error"] = f"At most {MAX_AUDIOS} voice RefMods can be loaded."
        return result
    for number, name, refmod in audios:
        if not refmod:
            result["error"] = f"Audio {number} ({name}) has no voice RefMod."
            return result
    result["error"] = ""
    return result
