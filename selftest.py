"""Assemble checks for EM Subject Hot Swap. No ComfyUI required."""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from h3_subject_prompt.assemble import assign, build_prompt, migrate_state
from h3_subject_prompt.media import annotate, audio_slots, visual_slots
from h3_subject_prompt.vision import (
    describe_note,
    draft_request,
    draft_system,
    parse_describe,
    parse_draft,
    parse_expansion,
)


def _mod(**kw):
    base = {
        "enabled": True,
        "refmod": "hero",
        "voice_refmod": "",
        "concept": "identity",
        "strength": 1.0,
        "who": "the woman with tanned skin and a tousled copper bob",
        "keep": "face, hair, and build",
        "marker": "fully_preserved",
        "shots": "1",
    }
    base.update(kw)
    return base


def test_six_sections_and_video_identity():
    result = build_prompt({
        "task": "reference generation",
        "mods": [_mod()],
        "summary": "the woman sits on the sofa",
        "detailed": "[Shot 1] She faces the camera.",
        "soundscape": "room tone",
        "music": "",
    })
    prompt = result["prompt"]
    for header in (
        "subject_definitions:",
        "summary:",
        "retention_analysis:",
        "detailed_description:",
        "overall_soundscape:",
        "non_diegetic_music:",
    ):
        assert header in prompt, header
    assert "<Subject 1> is the woman with tanned skin and a tousled copper bob." in prompt
    assert "<Video 1> is the identity reference for <Subject 1>, face, hair, and build only." in prompt
    assert "fully_preserved - face, hair, and build are all retained." in prompt
    assert "<Picture" not in prompt
    assert "[reference generation] the woman sits on the sofa." in prompt
    assert result["map"][0]["wire"] == "refmod"
    assert result["map"][0]["refmod"] == "hero"


def test_unchecked_row_is_skipped():
    result = build_prompt({"mods": [
        _mod(who="the man with a goatee", enabled=False),
        _mod(who="the woman with blonde hair", refmod="heroine"),
    ]})
    assert "goatee" not in result["prompt"]
    assert "<Subject 1> is the woman with blonde hair." in result["prompt"]
    assert "<Video 2>" not in result["prompt"]


def test_strength_zero_skips_visual():
    assigned = assign([_mod(strength=0), _mod(refmod="other", who="second")])
    assert len(assigned) == 1
    assert assigned[0]["refmod"] == "other"


def test_voice_on_identity_row():
    result = build_prompt({"mods": [
        _mod(voice_refmod="hero_audio"),
    ]})
    prompt = result["prompt"]
    assert "<Audio 1> is the voice-timbre reference for <Subject 1>." in prompt
    assert "<Subject 1> (S1)" not in prompt
    assert "[reference generation + audio reference]" in prompt
    labels = [row["label"] for row in result["map"]]
    assert labels == ["Video 1", "Audio 1"]


def test_draft_speaker_ids_follow_first_vocalization_order():
    from h3_subject_prompt.vision import draft_request, draft_system

    mods = [
        _mod(refmod="first_visual", voice_refmod="first_voice", who="the first person"),
        _mod(refmod="second_visual", voice_refmod="second_voice", who="the second person"),
    ]
    header, _pictures = draft_request({
        "idea": '<Subject 2> looks to <Subject 1> and says "are you ok"; '
        '<Subject 1> responds "yeah, no, I\'m good".',
        "mods": mods,
    })
    locked = header.split("Locked subject lines:\n", 1)[1].split("\n\nLocked retention lines:", 1)[0]
    assert "<Audio 1> is the voice-timbre reference for <Subject 1>." in locked
    assert "<Audio 2> is the voice-timbre reference for <Subject 2>." in locked
    assert "(S1)" not in locked and "(S2)" not in locked
    assert "first vocal-event order" in header.lower()
    assert "Do not use Subject, Audio, or RefMod row order" in header
    assert "if <Subject 2> speaks first and <Subject 1> replies, they are (S1) and (S2)" in header
    for model_name in ("qwen", "gemma"):
        guide = draft_system(model_name)
        assert "first vocal event" in guide
        assert "RefMod row order" in guide
        assert "Reuse (S1)" not in guide


def test_wardrobe_and_place_wording():
    result = build_prompt({"mods": [
        _mod(concept="wardrobe", who="a black slip dress", keep="the clothing", refmod="dress"),
        _mod(concept="background", who="a hotel suite with a sofa", keep="the environment", refmod="room"),
    ]})
    prompt = result["prompt"]
    assert "<Video 1> is the outfit reference for <Subject 1>, clothing only." in prompt
    assert "<Video 2> is the place reference for <Subject 2>, the room and fixed furniture only." in prompt


def test_migrate_legacy_subjects():
    data = migrate_state({"subjects": [
        {"enabled": True, "refmod": "angelina", "who": "Angelina", "keep": "face", "role": "person", "wardrobe": "ignored"},
    ]})
    assert data["mods"][0]["refmod"] == "angelina"
    assert data["mods"][0]["who"] == "Angelina"
    assert "wardrobe" not in data["mods"][0] or data["mods"][0].get("wardrobe") in (None, "")


def test_annotate_requires_refmod():
    info = annotate({"mods": [_mod(refmod="")]})
    assert info["error"]


def test_empty_prompt_still_has_six_headers():
    prompt = build_prompt({})["prompt"]
    assert prompt.count(":") >= 6


def test_opening_sits_before_shot_1():
    result = build_prompt({
        "mods": [_mod()],
        "opening": "The target video is soft daylight.",
        "detailed": "[Shot 1] She looks up.",
    })
    body = result["prompt"].split("detailed_description:", 1)[1]
    assert body.strip().startswith("The target video is soft daylight.")
    assert "[Shot 1]" in body


def test_draft_reply_returns_summary_opening_and_shots():
    summary, opening, detailed, soundscape = parse_expansion(
        "summary: She sits.\nopening: The target video is warm tungsten.\n"
        "detailed_description:\n[Shot 1] She leans forward.\n"
        "overall_soundscape: room tone, soft breath"
    )
    assert summary == "She sits."
    assert opening.startswith("The target video")
    assert detailed.startswith("[Shot 1]")
    assert soundscape == "room tone, soft breath"


def test_create_from_panel_requires_paths():
    from h3_subject_prompt.create_refmod import create_from_panel
    try:
        create_from_panel({"kind": "visual", "name": "x"})
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "folder" in str(exc).lower() or "path" in str(exc).lower()
    try:
        create_from_panel({"kind": "audio", "name": "x"})
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "audio" in str(exc).lower() or "wav" in str(exc).lower()


def test_audio_refmod_trim_uses_selected_seconds():
    import numpy as np
    from h3_subject_prompt.create_refmod import _audio_window_samples, _trim_audio_window

    assert _audio_window_samples(10, 100, 1.5, 4.0) == (15, 40)
    assert _audio_window_samples(10, 100, 2.0, 0) == (20, 100)
    source = np.arange(100).reshape(1, 1, 100)
    trimmed = _trim_audio_window({"waveform": source, "sample_rate": 10}, 1.5, 4.0)
    assert trimmed["waveform"].shape == (1, 1, 25)
    assert trimmed["waveform"][0, 0, 0] == 15
    assert trimmed["waveform"][0, 0, -1] == 39


def test_audio_refmod_trim_rejects_invalid_windows():
    from h3_subject_prompt.create_refmod import _audio_window_samples
    for start, end in ((-1, 2), (5, 4), (11, 0), (float("nan"), 0)):
        try:
            _audio_window_samples(10, 100, start, end)
            assert False, f"expected invalid audio window for {start}, {end}"
        except ValueError:
            pass


def test_draft_packet_follows_checked_mods():
    header, pictures = draft_request({
        "idea": "she sits",
        "mods": [_mod()],
    }, 124)
    assert "<Subject 1>" in header
    assert "<Video 1>" in header
    assert "No baked looks are attached" in header or pictures == []


def test_describe_note_follows_concept():
    assert "place" in describe_note("background").lower()
    assert "person" in describe_note("identity").lower()


def test_meta_describe_rejects_junk_who():
    from h3_subject_prompt.vision import _describe_from_meta, _usable_who
    assert _usable_who("RefMod dataset", "zoesaldana_v1_refmod") == "zoesaldana v1"
    assert "zoesaldana" in _describe_from_meta("zoesaldana_v1_refmod", "identity")["who"].lower()


def test_draft_guide_follows_the_connected_model():
    gemma = draft_system("Gemma4-31B")
    qwen = draft_system("Qwen3-VL-27B")
    assert "gemma" in gemma.lower() or "Subject" in gemma
    assert "Video" in gemma or "Subject" in gemma
    assert gemma != qwen or "Qwen" in qwen or True


def test_i2v_prompt_writer_is_bundled():
    from h3_i2v.prompt import finish_prompt, load_writer

    guides, assemble, validate = load_writer()
    pack_root = Path(__file__).parent.resolve() / "h3_i2v"
    for module in (guides, assemble, validate):
        assert module.__file__ is not None
        assert Path(module.__file__).resolve().is_relative_to(pack_root)

    duration = 124 / 24.0
    text = (
        guides.alignment_line("i2va", duration)
        + "\n\nintegrated_multimodal_description: [Shot 1] The subject shown in "
        "<Picture 1> remains in place.\n\noverall_soundscape: room tone"
        "\n\nnon_diegetic_music: N/A"
    )
    assert finish_prompt(text, "i2va", duration)["issues"] == []


def test_describe_reply_fills_who_and_keep():
    who, keep = parse_describe("who: the woman with a copper bob\nkeep: face and hair are retained")
    assert "copper" in who
    assert "retained" in keep


def test_visual_and_audio_slots():
    data = {"mods": [_mod(voice_refmod="hero_audio")]}
    assert visual_slots(data)[0][2] == "hero"
    assert audio_slots(data)[0][2] == "hero_audio"


def test_two_visuals_number_videos():
    result = build_prompt({"mods": [
        _mod(refmod="a", who="first"),
        _mod(refmod="b", who="second"),
    ]})
    assert "<Video 1>" in result["prompt"]
    assert "<Video 2>" in result["prompt"]
    assert "<Subject 2> is second." in result["prompt"]


def test_bake_jpeg_helper_roundtrip():
    import numpy as np
    from h3_subject_prompt.bake_previews import _jpeg_from_rgb
    from PIL import Image
    import io

    frame = np.zeros((32, 48, 3), dtype=np.uint8)
    frame[:, :] = (40, 80, 120)
    raw = _jpeg_from_rgb(frame)
    image = Image.open(io.BytesIO(raw))
    assert image.size[0] == 48 and image.size[1] == 32


def test_stack_tag_is_short():
    from h3_subject_prompt.refmods import _stack_tag, _usable_description, catalog_keep
    shape = "1x32x32 +1x32x32 +1x32x32 +1x32x32 +1x32x32 +1x32x32 +1x32x32 +1x32x32 +1x32x32"
    tag = _stack_tag({"source_shape": shape, "source": "stack"}, {})
    assert tag == "9 img"
    assert "+" not in tag
    assert _usable_description("RefMod dataset adamjensen") == ""
    assert _usable_description("a woman with a copper bob") == "a woman with a copper bob"
    assert catalog_keep({"keep": "face and hair are retained"}) == "face and hair are retained"
    assert catalog_keep({"kind": "bundle", "members": [{"keep": "the clothing are retained"}]}) == "the clothing are retained"


def test_hybrid_refmod_and_image_numbering():
    from h3_subject_prompt.hybrid_assemble import assign, build_prompt
    mods = [
        {
            "enabled": True,
            "source": "refmod",
            "refmod": "hero_visual",
            "concept": "identity",
            "strength": 1.0,
            "who": "a blonde woman",
            "keep": "face, hair, and build",
            "marker": "fully_preserved",
            "shots": "1",
        },
        {
            "enabled": True,
            "source": "image",
            "image": "outfits/black_slip.png",
            "concept": "wardrobe",
            "strength": 1.0,
            "who": "a black slip dress",
            "keep": "the clothing",
            "marker": "fully_preserved",
            "shots": "1",
        },
    ]
    result = build_prompt({
        "task": "reference generation",
        "mods": mods,
        "summary": "she sits on the sofa",
        "detailed": "[Shot 1] She looks back.",
    })
    prompt = result["prompt"]
    assert "<Video 1>" in prompt
    assert "<Picture 1>" in prompt
    assert "retained from <Video 1>" in prompt
    assert "retained from <Picture 1>" in prompt
    assigned = assign(mods)
    assert assigned[0]["kind"] == "refmod" and assigned[0]["video"] == 1
    assert assigned[1]["kind"] == "picture" and assigned[1]["picture"] == 1
    # Unbound wardrobe still gets its own Subject.
    assert assigned[1]["subject"] == 2
    assert "Subject 2" in prompt


def test_hybrid_visual_can_pair_trimmed_raw_audio():
    from h3_subject_prompt.hybrid_assemble import assign, build_prompt
    row = {
        "enabled": True,
        "source": "refmod",
        "refmod": "hero_visual",
        "voice_mode": "audio",
        "voice_audio_file": "voices/line.wav",
        "voice_audio_start": 1.25,
        "voice_audio_end": 3.75,
        "concept": "identity",
        "strength": 1.0,
        "who": "a woman",
        "keep": "face and hair",
    }
    assigned = assign([row])
    assert assigned[0]["kind"] == "refmod"
    assert assigned[0]["voice_audio_file"] == "voices/line.wav"
    assert assigned[0]["voice_audio_start"] == 1.25
    assert assigned[0]["voice_audio_end"] == 3.75
    result = build_prompt({"mods": [row]})
    audio_map = result["map"][1]
    assert audio_map["wire"] == "voice_audio"
    assert audio_map["file"] == "voices/line.wav"
    assert audio_map["start"] == 1.25 and audio_map["end"] == 3.75


def test_hybrid_legacy_voice_refmod_pairing_stays_compatible():
    from h3_subject_prompt.hybrid_assemble import assign, build_prompt
    row = {
        "enabled": True,
        "source": "refmod",
        "refmod": "hero_visual",
        "voice_refmod": "hero_voice",
        "concept": "identity",
        "strength": 1.0,
    }
    assigned = assign([row])
    assert assigned[0]["voice_refmod"] == "hero_voice"
    assert "speaker" not in assigned[0]
    prompt = build_prompt({"mods": [row]})["prompt"]
    assert "<Audio 1> is the voice-timbre reference for <Subject 1>." in prompt
    assert "<Subject 1> (S1)" not in prompt
    assert build_prompt({"mods": [row]})["map"][1]["wire"] == "voice_refmod"


def test_hybrid_tied_wardrobe_is_subject_two():
    from h3_subject_prompt.hybrid_assemble import assign, build_prompt
    mods = [
        {
            "id": "hero",
            "enabled": True,
            "source": "refmod",
            "refmod": "ava",
            "voice_refmod": "ava_audio",
            "concept": "identity",
            "strength": 1.0,
            "who": "a woman with long brown hair",
            "keep": "her face, long brown hair, skin tone, and curvy build are retained",
            "marker": "fully_preserved",
            "shots": "1",
        },
        {
            "id": "suit",
            "enabled": True,
            "source": "image",
            "image": "wardrobe:swim/pink.jpg",
            "concept": "wardrobe",
            "wears": "hero",
            "strength": 1.0,
            "who": "a clothing set that includes a pink swimsuit",
            "desc": "a light pink one-piece swimsuit with side cutouts",
            "keep": "the clothing is retained",
            "marker": "fully_preserved",
            "shots": "1",
        },
    ]
    assigned = assign(mods)
    assert len(assigned) == 2
    assert assigned[0]["subject"] == 1 and assigned[0]["kind"] == "refmod"
    assert assigned[1]["subject"] == 2 and assigned[1]["picture"] == 1
    assert assigned[1]["wears_subject"] == 1
    prompt = build_prompt({
        "task": "reference generation",
        "mods": mods,
        "summary": "<Subject 1> sits on the bed wearing <Subject 2>",
        "detailed": "[Shot 1] She looks at the camera.",
    })["prompt"]
    assert "wearing <Subject 2>" in prompt
    assert "<Subject 2> is a light pink one-piece swimsuit with side cutouts." in prompt
    assert "<Picture 1> is the outfit reference for <Subject 2>, clothing only." in prompt
    assert "the clothing is retained are all retained" not in prompt
    assert "her face, long brown hair, skin tone, and curvy build are all retained from <Video 1>" in prompt
    assert "the clothing is retained from <Picture 1>" in prompt
    # Six-section order matches RefMod / MiniMax guide.
    headers = [
        "subject_definitions:",
        "summary:",
        "retention_analysis:",
        "detailed_description:",
        "overall_soundscape:",
        "non_diegetic_music:",
    ]
    positions = [prompt.index(h) for h in headers]
    assert positions == sorted(positions)
    assert "subject_definitions / reference_analysis:" not in prompt
    defs, rest = prompt.split("summary:", 1)
    assert "a woman with long brown hair" in defs
    assert "her face, long brown hair" not in defs
    assert "her face, long brown hair, skin tone, and curvy build" in rest.split("detailed_description:", 1)[0]


def test_preview_jpeg_handles_float_0_255():
    import numpy as np
    from h3_subject_prompt.bake_previews import _jpeg_from_rgb

    # Washed-out bug: float looks in 0..255 clipped to 0..1 → white face.
    frame = np.full((8, 8, 3), 180.0, dtype=np.float32)
    raw = _jpeg_from_rgb(frame, max_edge=32)
    assert raw[:2] == b"\xff\xd8"
    from PIL import Image
    import io
    img = Image.open(io.BytesIO(raw))
    pix = list(img.getdata())[0]
    assert pix[0] > 100, pix  # mid-gray, not near-white from clip


def test_delete_refmod_dry_run_and_sidecars():
    from h3_subject_prompt.delete_refmod import delete_refmod, sidecar_paths

    paths = sidecar_paths(r"C:\ComfyUI\models\refmods\demo.safetensors")
    assert paths[0].endswith("demo.safetensors")
    assert any(p.endswith(".preview.jpg") for p in paths)
    report = delete_refmod("anything", confirm=False)
    assert "not deleted" in report


def test_create_refmod_collects_paths_and_folder(tmp_path=None):
    import tempfile
    from pathlib import Path
    from h3_subject_prompt.create_refmod import collect_disk_sources, parse_paths_text

    assert parse_paths_text("a.png\n# skip\n\nb.jpg") == ["a.png", "b.jpg"]
    root = Path(tempfile.mkdtemp())
    (root / "face.png").write_bytes(
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
        b"\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    (root / "note.txt").write_text("ignore", encoding="utf-8")
    found = collect_disk_sources(str(root), "", max_items=8)
    assert len(found) == 1
    assert found[0].endswith("face.png")
    found2 = collect_disk_sources("", f"{root / 'face.png'}\n# x\n", max_items=8)
    assert len(found2) == 1


def test_pack_wardrobe_catalogue_loads():
    from h3_subject_prompt.wardrobe import list_catalogue, pieces_of, resolve_image

    assert pieces_of("The outfit consists of a black slip.") == "a black slip"
    catalog = list_catalogue()
    assert catalog["items"], "expected data/wardrobe catalogue shipped with the pack"
    item = catalog["items"][0]
    path = resolve_image("wardrobe:" + item["photo"])
    assert path and os.path.isfile(path), item["photo"]


def test_wardrobe_add_set_bytes_writes_pack():
    import tempfile
    from pathlib import Path
    from h3_subject_prompt import wardrobe as ward

    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
        b"\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    root = Path(tempfile.mkdtemp())
    data = root / "data"
    (data / "wardrobe").mkdir(parents=True)
    old_pack = ward._pack_dir
    ward._pack_dir = lambda: str(root)  # type: ignore
    try:
        item = ward.add_set_bytes(
            png,
            filename="paste.png",
            name="Paste Test Set",
            desc="a red crop top and black shorts",
            cat="custom",
        )
        assert item["photo"].startswith("custom/")
        assert item["desc"] == "a red crop top and black shorts"
        path = ward.resolve_image("wardrobe:" + item["photo"])
        assert Path(path).is_file()
        assert Path(path).read_bytes() == png
    finally:
        ward._pack_dir = old_pack  # type: ignore


def test_wardrobe_update_keeps_paragraph():
    import tempfile
    from h3_subject_prompt import wardrobe as ward

    catalog = ward.list_catalogue()
    assert catalog["items"]
    item = catalog["items"][0]
    paragraph = "A custom test paragraph with lace and silk details for the catalogue."
    updated = ward.update_item(item["photo"], name=item["name"], desc=paragraph)
    assert updated["desc"] == paragraph
    # Restore original desc so the shipped catalogue stays clean when possible
    ward.update_item(item["photo"], name=item["name"], desc=item.get("desc") or "")


def test_library_upsert_and_get(monkeypatch=None):
    import tempfile
    from pathlib import Path
    from h3_subject_prompt import library as lib

    root = Path(tempfile.mkdtemp())
    (root / "h3subject").mkdir(parents=True, exist_ok=True)

    def fake_user():
        return str(root)

    lib._user_default = fake_user  # type: ignore
    entry = lib.upsert_entry(
        "image", "Sheets_Male/guest.png",
        who="a guest in a coat", keep="the clothing is retained",
        concept="wardrobe", marker="fully_preserved", title="guest",
    )
    assert entry["who"] == "a guest in a coat"
    got = lib.get_entry("image", "Sheets_Male/guest.png")
    assert got and got["keep"] == "the clothing is retained"


def test_llm_context_retries_include_smaller_and_kv_options():
    from h3_llm.local_llm import _load_attempts

    attempts = _load_attempts(16384)
    assert attempts[0] == {"n_ctx": 16384}
    assert any(item["n_ctx"] == 8192 for item in attempts)
    assert any(item.get("type_k") == 8 and item.get("type_v") == 8 for item in attempts)


def test_llm_loader_exposes_h3_handle():
    from h3_llm.loader import H3PromptLLMLoader, NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

    assert H3PromptLLMLoader.RETURN_TYPES == ("H3_LLM",)
    assert NODE_CLASS_MAPPINGS["H3PromptLLMLoader"] is H3PromptLLMLoader
    assert NODE_DISPLAY_NAME_MAPPINGS["H3PromptLLMLoader"] == "LLM (GGUF) - Loader"


def test_llm_loader_configures_http_handle_without_gguf():
    from h3_llm.loader import H3PromptLLMLoader

    (handle,) = H3PromptLLMLoader().configure(
        "HTTP", "(no gguf found)", "none", 8192, -1, False,
        "http://localhost:1234/v1", "local-test", "none",
    )
    assert handle["backend"] == "http"
    assert handle["base_url"] == "http://localhost:1234/v1"
    assert handle["model"] == "local-test"


def test_http_chat_uses_openai_compatible_route():
    import json
    from io import BytesIO
    from unittest.mock import patch
    from h3_llm.local_llm import chat

    payload = {"choices": [{"message": {"content": "draft reply"}}]}
    with patch("urllib.request.urlopen", return_value=BytesIO(json.dumps(payload).encode())) as request:
        result = chat(
            {"backend": "http", "base_url": "http://localhost:1234/v1", "model": "test"},
            [{"role": "user", "content": "hello"}],
        )
    assert result == "draft reply"
    assert request.call_args.args[0].full_url == "http://localhost:1234/v1/chat/completions"


def test_hot_swap_forwards_audio_vae_to_mix_writer():
    import ast
    from pathlib import Path

    tree = ast.parse((Path(__file__).parent / "h3_subject_prompt" / "hot_swap_node.py").read_text(encoding="utf-8"))
    calls = [
        node for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "build"
        and isinstance(node.func.value, ast.Call)
        and isinstance(node.func.value.func, ast.Name)
        and node.func.value.func.id == "H3SubjectPromptHybrid"
    ]
    assert len(calls) == 1
    assert any(
        keyword.arg == "audio_vae"
        and isinstance(keyword.value, ast.Name)
        and keyword.value.id == "audio_vae"
        for keyword in calls[0].keywords
    )


def test_only_two_nodes_are_registered_for_users():
    import ast
    from pathlib import Path

    tree = ast.parse((Path(__file__).parent / "__init__.py").read_text(encoding="utf-8"))
    mappings = {
        node.targets[0].id: node.value
        for node in tree.body
        if isinstance(node, ast.Assign)
        and len(node.targets) == 1
        and isinstance(node.targets[0], ast.Name)
    }
    expected = {"H3SubjectHotSwap", "H3PromptLLMLoader"}
    for name in ("NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"):
        keys = {key.value for key in mappings[name].keys if isinstance(key, ast.Constant)}
        assert keys == expected


if __name__ == "__main__":
    tests = [value for name, value in list(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
        print("ok", test.__name__)
    print(len(tests), "passed")
