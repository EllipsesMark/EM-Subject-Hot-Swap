// Internal Mix panel for EM Subject Hot Swap.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
const TASKS = [
  ["reference generation", "reference generation"],
  ["video editing + reference generation", "video editing + reference"],
  ["video continuation", "video continuation"],
  ["keyframe completion + reference generation", "keyframe completion"],
  ["reference generation + audio reference", "reference + audio reference"],
  ["reference generation + audio reuse", "reference + audio reuse"],
  ["none", "no task prefix"],
];
const CONCEPTS = [
  ["identity", "identity"],
  ["wardrobe", "wardrobe"],
  ["background", "background"],
  ["voice", "voice"],
];
const SOURCES = [
  ["refmod", "RefMod"],
  ["image", "Image"],
];
const PICTURE_MARKERS = ["fully_preserved", "partially_preserved", "attribute_transfer", "weak_reference"];
const KEEP_STARTERS = {
  identity: "face, hair, and build are retained",
  wardrobe: "the clothing is retained",
  background: "the environment is retained",
  voice: "timbre, rhythm, and delivery are retained",
};
const OPENING_STARTERS = [
  "The target video uses a live-action, amateur handheld camera style.",
  "The target video is a live-action cinematic scene with slight camera movement.",
  "The target video is a static locked shot in available light, with no camera movement.",
  "The target video uses a realistic style with warm indoor lighting.",
  "The target video is a cinematic music-video style with soft lighting.",
];
const STYLES = [
  ["cinematic", "cinematic"],
  ["amateur", "amateur"],
  ["smartphone", "smartphone"],
  ["studio", "studio"],
  ["documentary", "documentary"],
  ["commercial", "commercial"],
  ["music_video", "music video"],
  ["vintage_film", "vintage film"],
  ["anime", "anime"],
  ["3d_cg", "3D CG"],
];
const SHOTS = [
  "extreme close-up",
  "close-up",
  "close shot",
  "medium close-up",
  "medium shot",
  "medium-wide shot",
  "wide shot",
  "extreme wide shot",
];
const STYLE_OPENINGS = {
  cinematic: "Live-action, cinematic",
  amateur: "live-action, amateur handheld camera",
  smartphone: "live-action, smartphone, front camera, hard on-camera lamp",
  studio: "realistic studio photographic style with controlled, even lighting",
  documentary: "live-action observational documentary",
  commercial: "live-action clean commercial / advertising look",
  music_video: "live-action music-video look",
  vintage_film: "vintage film",
  anime: "2D-animated",
  "3d_cg": "3D CG",
};

const CSS = `
.h3h-root { box-sizing:border-box; width:100%; height:100%; min-height:0;
  display:flex; flex-direction:column; gap:6px; padding:8px; overflow:auto;
  background:#1a1a1a; color:#ddd; border:1px solid #555; border-radius:8px; font:12px/1.4 sans-serif; }
.h3h-root *, .h3h-root *::before, .h3h-root *::after { box-sizing:border-box; }
.h3h-bar { display:flex; align-items:center; gap:6px; min-width:0; }
.h3h-title { color:#46b4e6; font-weight:700; font-size:13px; white-space:nowrap; }
.h3h-hint { color:#888; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-left:auto; max-width:45%; }
.h3h-hint.alert { color:#e7b15a; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2;
  white-space:normal; overflow:hidden; text-overflow:ellipsis; }
.h3h-note { color:#e7b15a; white-space:pre-wrap; word-break:break-word; }
.h3h-btn { background:#333; border:1px solid #555; border-radius:4px; color:#bbb;
  font:11px sans-serif; cursor:pointer; padding:2px 8px; line-height:16px; white-space:nowrap; }
.h3h-btn:hover { border-color:#46b4e6; color:#fff; }
.h3h-btn.on { border-color:#46b4e6; color:#46b4e6; background:#2a3a42; }
.h3h-btn:disabled { opacity:.55; cursor:wait; }
.h3h-btn.busy, .h3h-btn.busy:disabled { background:#3a2a12; border-color:#e7b15a; color:#e7b15a; opacity:1; cursor:wait; }
.h3h-btn.accept { background:#1e3d2a; border-color:#3d9a5f; color:#7dcea0; }
.h3h-btn.accept:hover { background:#265238; border-color:#4cba72; color:#b6f0c9; }
.h3h-btn.discard { background:#3d1e1e; border-color:#a33; color:#f0a0a0; }
.h3h-btn.discard:hover { background:#a33; border-color:#a33; color:#fff; }
.h3h-create { position:fixed; z-index:10050; width:min(480px, calc(100vw - 24px));
  max-height:min(90vh, 720px); overflow:auto; background:#1e1e1e; border:1px solid #555;
  border-radius:8px; padding:10px; box-shadow:0 12px 40px rgba(0,0,0,.55);
  display:flex; flex-direction:column; gap:6px; font:12px/1.4 sans-serif; color:#ddd; }
.h3h-create input[type=text], .h3h-create input[type=number], .h3h-create textarea, .h3h-create select {
  background:#2a2a2a; border:1px solid #555; border-radius:4px; color:#ddd;
  font:12px sans-serif; padding:4px 6px; width:100%; }
.h3h-create textarea { resize:vertical; min-height:52px; }
.h3h-create-adv { display:none; gap:6px; flex-direction:column; }
.h3h-create-adv.open { display:flex; }
.h3h-create-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.h3h-create-status { color:#888; white-space:pre-wrap; word-break:break-word; min-height:1.2em; }
.h3h-create-status.alert { color:#e7b15a; }
.h3h-create-status.ok { color:#7dcea0; }
.h3h-create-drop { border:1px dashed #555; border-radius:6px; padding:14px 10px; text-align:center;
  color:#888; cursor:pointer; background:#171717; white-space:pre-line; }
.h3h-create-drop:hover, .h3h-create-drop.drag { border-color:#46b4e6; color:#46b4e6; background:#1a2830; }
.h3h-create-thumbs { display:flex; flex-wrap:wrap; gap:6px; min-height:0; }
.h3h-create-thumb { position:relative; width:64px; height:80px; border-radius:4px; overflow:hidden;
  border:1px solid #444; background:#111; flex:0 0 auto; }
.h3h-create-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.h3h-create-thumb .h3h-create-x { position:absolute; top:2px; right:2px; width:18px; height:18px;
  padding:0; line-height:16px; font-size:12px; background:#3d1e1e; border-color:#a33; color:#f0a0a0; }
.h3h-create-audio-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.h3h-create-audio-name { color:#aaa; font:11px sans-serif; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; }
.h3h-create-wavebox { background:#1d1d1d; border:1px solid #444; border-radius:4px; padding:6px; display:flex; flex-direction:column; gap:4px; }
.h3h-create-wave { width:100%; height:64px; display:block; cursor:ew-resize; touch-action:none; }
.h3h-create-times { display:flex; align-items:center; justify-content:space-between; gap:6px; font:10px sans-serif; color:#888; }
.h3h-create-times .sel { color:#46b4e6; }
.h3h-create-path-block { display:none; flex-direction:column; gap:4px; }
.h3h-create-path-block.open { display:flex; }
.h3h-looks { position:fixed; z-index:10060; inset:0; background:rgba(0,0,0,.78);
  display:flex; align-items:center; justify-content:center; padding:16px; }
.h3h-looks-panel { background:#1a1a1a; border:1px solid #555; border-radius:10px;
  width:min(960px, 96vw); max-height:92vh; overflow:auto; padding:12px;
  display:flex; flex-direction:column; gap:10px; box-shadow:0 16px 48px rgba(0,0,0,.55); }
.h3h-looks-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px; }
.h3h-looks-card { background:#111; border:1px solid #444; border-radius:6px; overflow:hidden;
  display:flex; flex-direction:column; min-height:0; }
.h3h-looks-card img { width:100%; aspect-ratio:3/4; object-fit:contain; background:#0a0a0a; display:block; }
.h3h-looks-card span { color:#aaa; font:11px sans-serif; padding:4px 6px; }
.h3h-looks-card.cover { border-color:#e7b15a; box-shadow:0 0 0 1px #e7b15a inset; }
.h3h-looks-foot { display:flex; align-items:center; justify-content:space-between; gap:6px; padding:2px 4px 4px 0; }
.h3h-looks-foot .h3h-btn { padding:1px 7px; font-size:10px; }
.h3h-looks-empty { color:#e7b15a; padding:20px; text-align:center; }
.h3h-looks-note { color:#888; font:11px sans-serif; padding:8px 2px 0; }
.h3h-live { color:#e7b15a; font:11px sans-serif; white-space:nowrap; }
.h3h-drop:hover { background:#a33; border-color:#a33; color:#fff; }
.h3h-preview.draft-ready {
  border-color:#e7b15a; box-shadow:0 0 0 1px #e7b15a, 0 0 18px rgba(231,177,90,.22);
  background:#2a2418; animation:h3h-draft-flash .9s ease-out 1;
}
@keyframes h3h-draft-flash {
  0% { box-shadow:0 0 0 1px #e7b15a, 0 0 28px rgba(231,177,90,.55); }
  100% { box-shadow:0 0 0 1px #e7b15a, 0 0 18px rgba(231,177,90,.22); }
}
.h3h-list { display:flex; flex-direction:column; gap:4px; }
.h3h-empty { color:#888; padding:8px; }
.h3h-band { display:flex; flex-direction:column; gap:4px; }
.h3h-band-label, .h3h-band-head { display:flex; align-items:center; gap:6px; width:100%;
  background:transparent; border:0; border-bottom:1px solid #333; color:#46b4e6;
  font:600 11px monospace; padding:4px 0; text-align:left; }
.h3h-band-head { cursor:pointer; }
.h3h-band-head:hover { color:#7ec8ea; }
.h3h-band-meta { margin-left:auto; color:#666; font:11px sans-serif; font-weight:400; }
.h3h-band-body { display:flex; flex-direction:column; gap:6px; }
.h3h-row { background:#262626; border-radius:4px; padding:5px 8px; display:flex; flex-direction:column; gap:5px; }
.h3h-row.compact { padding:4px 8px; gap:2px; }
.h3h-row.active { box-shadow:inset 0 0 0 1px #46b4e6; }
.h3h-row.off { opacity:.45; }
.h3h-row.dragging { opacity:.4; }
.h3h-grip { cursor:grab; color:#888; user-select:none; flex:0 0 auto; letter-spacing:-1px; padding:0 2px; }
.h3h-grip:active { cursor:grabbing; }
.h3h-who-snip { color:#888; font:11px/1.3 sans-serif; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-left:42px; }
.h3h-line { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.h3h-line input[type=text], .h3h-line input[type=number], .h3h-line select, .h3h-root select, .h3h-root textarea {
  background:#1d1d1d; border:1px solid #444; border-radius:4px; color:#ddd; font:13px monospace; padding:4px 6px; }
.h3h-grow { flex:1 1 160px; min-width:0; }
.h3h-str { width:64px; flex:0 0 auto; }
.h3h-file { flex:1 1 200px; min-width:140px; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.h3h-root textarea { width:100%; resize:vertical; min-height:36px; }
.h3h-lbl { color:#46b4e6; font:600 11px monospace; margin-top:4px; }
.h3h-mini { color:#888; font:11px sans-serif; flex:0 0 auto; }
.h3h-sec { display:flex; flex-direction:column; gap:3px; }
.h3h-map { color:#888; font:11px/1.4 monospace; white-space:pre-wrap; }
.h3h-preview { background:#1d1d1d; border:1px solid #444; border-radius:4px; margin:0;
  padding:8px; color:#bbb; font:12px/1.45 monospace; white-space:pre-wrap; word-break:break-word; }
.h3h-num { font:bold 11px monospace; color:#888; width:18px; flex:0 0 auto; }
.h3h-tag { color:#46b4e6; font:11px monospace; }
.h3h-picker { position:fixed; z-index:10001; display:flex; flex-direction:column; width:min(920px, calc(100vw - 16px));
  height:min(640px, calc(100vh - 16px)); background:#1a1a1a; color:#ddd; border:1px solid #555;
  border-radius:8px; box-shadow:0 10px 28px rgba(0,0,0,.6); overflow:hidden; font:12px/1.3 sans-serif; }
.h3h-pick-search { display:flex; gap:6px; align-items:center; padding:8px; border-bottom:1px solid #333; }
.h3h-pick-search input { flex:1; background:#141414; border:1px solid #444; border-radius:4px; color:#ddd; padding:5px 8px; }
.h3h-pick-sort { flex:0 0 auto; width:140px; background:#141414; border:1px solid #444; border-radius:4px;
  color:#ddd; padding:4px 6px; font:11px sans-serif; }
.h3h-pick-split { flex:1; min-height:0; display:flex; }
.h3h-pick-folders { width:148px; flex:none; overflow:auto; background:#141414; border-right:1px solid #333;
  display:flex; flex-direction:column; }
.h3h-pick-folder-list { flex:1; min-height:0; overflow:auto; }
.h3h-pick-folder-actions { display:flex; gap:4px; padding:6px; border-top:1px solid #333; }
.h3h-pick-move { position:absolute; bottom:6px; left:6px; z-index:2; font-size:10px; padding:1px 6px; }
.h3h-pick-folder { display:flex; justify-content:space-between; gap:6px; padding:7px 8px; cursor:pointer; color:#aaa; }
.h3h-pick-folder.on { background:#1d3340; color:#46b4e6; }
.h3h-pick-count { color:#777; font-size:10px; }
.h3h-pick-pane { flex:1; min-width:0; overflow:auto; padding:8px; display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:8px; align-content:start; }
.h3h-pick-pane.audio { grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); }
.h3h-pick-card { position:relative; display:flex; flex-direction:column; gap:4px; cursor:pointer; border-radius:4px; padding:3px; border:1px solid transparent; }
.h3h-pick-card:hover { background:#262626; }
.h3h-pick-card.on { border-color:#46b4e6; background:#1d3340; }
.h3h-pick-card img { width:100%; height:160px; object-fit:contain; border-radius:3px; background:#111; }
.h3h-pick-name { font-size:10px; color:#bbb; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.h3h-pick-desc { font-size:10px; color:#888; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.h3h-pick-audio { display:flex; align-items:center; gap:6px; min-width:0; }
.h3h-pick-audio audio { flex:1 1 auto; width:100%; min-width:0; height:34px; }
.h3h-pick-audio .h3h-btn { flex:0 0 auto; }
.h3h-pick-meta { font-size:10px; color:#46b4e6; }
.h3h-pick-del { position:absolute; top:6px; right:6px; z-index:2; background:#3a1a1a; border:1px solid #a33;
  color:#f0a0a0; border-radius:4px; font:10px sans-serif; padding:1px 6px; cursor:pointer; opacity:0; }
.h3h-pick-card:hover .h3h-pick-del { opacity:1; }
.h3h-pick-del:hover { background:#a33; color:#fff; border-color:#a33; }
.h3h-pick-empty { grid-column:1 / -1; color:#888; padding:12px; }
.h3h-pick-foot { padding:6px 8px; border-top:1px solid #333; color:#888; }
.h3h-pick-blanket { position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.35); }
.h3h-thumb { width:168px; height:220px; object-fit:contain; border-radius:4px; background:#111; flex:0 0 auto; }
.h3h-paste { position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:6px; min-height:180px; border:1px dashed #555; border-radius:6px; background:#141414; color:#888;
  cursor:pointer; padding:10px; outline:none; overflow:hidden; }
.h3h-paste:hover, .h3h-paste:focus { border-color:#46b4e6; color:#bbb; }
.h3h-paste.drag { border-color:#e7b15a; background:#2a2418; color:#e7b15a; }
.h3h-paste.has { border-style:solid; border-color:#46b4e6; }
.h3h-paste img { max-width:100%; max-height:220px; object-fit:contain; border-radius:4px; background:#111; }
.h3h-paste-hint { font:11px sans-serif; text-align:center; pointer-events:none; }
.h3h-paste-actions { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; }
`;

function ensureStyle() {
  if (document.getElementById("h3h-style")) return;
  const s = document.createElement("style");
  s.id = "h3h-style";
  s.textContent = CSS;
  document.head.appendChild(s);
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function stop(node) {
  const block = (e) => { if (e.button === 0) e.stopPropagation(); };
  node.addEventListener("pointerdown", block);
  node.addEventListener("mousedown", block);
}

function middleClickPan(element) {
  element.addEventListener("mousedown", (e) => {
    if (e.button !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    const ds = app.canvas?.ds;
    if (!ds) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startOffsetX = ds.offset[0];
    const startOffsetY = ds.offset[1];
    const onMove = (me) => {
      const scale = ds.scale || 1;
      ds.offset[0] = startOffsetX + (me.clientX - startX) / scale;
      ds.offset[1] = startOffsetY + (me.clientY - startY) / scale;
      app.canvas.setDirty(true, true);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
  element.addEventListener("auxclick", (e) => {
    if (e.button === 1) e.preventDefault();
  });
}

function uid() {
  return "h" + Math.random().toString(36).slice(2, 10);
}

function conceptOf(row) {
  const raw = String(row?.concept || "identity").toLowerCase();
  if (raw === "person") return "identity";
  if (raw === "set" || raw === "clothing") return "wardrobe";
  if (raw === "place" || raw === "scene") return "background";
  if (["identity", "wardrobe", "background", "voice"].includes(raw)) return raw;
  return "identity";
}

function sourceOf(row) {
  const raw = String(row?.source || "").toLowerCase();
  if (raw === "image" || raw === "refmod") return raw;
  if (row?.image && !row?.refmod) return "image";
  return "refmod";
}

function keepDefault(concept) {
  return KEEP_STARTERS[concept] || KEEP_STARTERS.identity;
}

function clampStrength(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

function whoFromName(name, description) {
  const desc = String(description || "").trim();
  if (desc && !/^refmod/i.test(desc)) return desc;
  let stem = String(name || "").replace(/\\/g, "/").split("/").pop() || "";
  stem = stem.replace(/(_refmod)?(_visual|_audio)?$/i, "").replace(/[_-]+/g, " ").trim();
  return stem || "the subject";
}

function defaultUi() {
  return { promptOpen: false };
}

function defaultState() {
  return {
    task: "reference generation",
    mods: [],
    summary: "",
    opening: "",
    detailed: "",
    soundscape: "room tone",
    music: "",
    idea: "",
    pass: "develop",
    style_mode: "amateur",
    shot_size: "medium close-up",
    motion: { weight: false, contact: false, follow: false, settle: false },
    subject_reinforced: true,
    active: "",
    ui: defaultUi(),
  };
}

function ensureUi(state) {
  if (!state.ui || typeof state.ui !== "object") state.ui = defaultUi();
  if (typeof state.ui.promptOpen !== "boolean") state.ui.promptOpen = false;
  return state.ui;
}

function newMod(source) {
  return {
    id: uid(),
    enabled: true,
    source: source || "refmod",
    refmod: "",
    voice_refmod: "",
    voice_mode: "none",
    voice_audio_file: "",
    voice_audio_start: 0,
    voice_audio_end: 0,
    image: "",
    concept: source === "image" ? "wardrobe" : "identity",
    strength: 1.0,
    who: "",
    keep: keepDefault(source === "image" ? "wardrobe" : "identity"),
    marker: "fully_preserved",
    shots: "1",
    stack: "",
    format: "",
    description: "",
    desc: "",
    name: "",
    wears: "",
    setId: "",
    has_looks: false,
    has_preview: false,
  };
}

function normalizeMod(row) {
  const base = newMod();
  if (!row || typeof row !== "object") return base;
  const concept = conceptOf(row);
  const source = sourceOf(row);
  const voiceRefmod = String(row.voice_refmod || "").trim();
  const voiceAudioFile = String(row.voice_audio_file || "").trim();
  const requestedVoiceMode = String(row.voice_mode || "").trim().toLowerCase();
  const voiceMode = ["none", "refmod", "audio"].includes(requestedVoiceMode)
    ? requestedVoiceMode
    : voiceAudioFile && !voiceRefmod ? "audio" : voiceRefmod ? "refmod" : "none";
  return Object.assign(base, {
    id: row.id || base.id,
    enabled: row.enabled !== false,
    source,
    refmod: String(row.refmod || "").trim(),
    voice_refmod: voiceRefmod,
    voice_mode: voiceMode,
    voice_audio_file: voiceAudioFile,
    voice_audio_start: Math.max(0, Number(row.voice_audio_start) || 0),
    voice_audio_end: Math.max(0, Number(row.voice_audio_end) || 0),
    image: String(row.image || "").trim(),
    concept,
    strength: clampStrength(row.strength),
    who: String(row.who || "").trim(),
    keep: String(row.keep || keepDefault(concept)).trim(),
    marker: PICTURE_MARKERS.includes(row.marker) ? row.marker : "fully_preserved",
    shots: String(row.shots || "1"),
    stack: String(row.stack || ""),
    format: String(row.format || ""),
    description: String(row.description || ""),
    desc: String(row.desc || row.description || "").trim(),
    name: String(row.name || "").trim(),
    wears: String(row.wears || "").trim(),
    setId: String(row.setId || "").trim(),
    has_looks: !!row.has_looks,
    has_preview: !!row.has_preview,
  });
}

function isCharacterRow(row) {
  if (!row) return false;
  if (conceptOf(row) === "wardrobe" && sourceOf(row) === "image") return false;
  if (conceptOf(row) === "voice") return false;
  return conceptOf(row) === "identity" || sourceOf(row) === "refmod" || sourceOf(row) === "image";
}

function tiedOutfits(state, parentId) {
  return (state.mods || []).filter(
    (row) => sourceOf(row) === "image" && conceptOf(row) === "wardrobe" && row.wears === parentId,
  );
}

function migrateState(data) {
  const out = Object.assign(defaultState(), data && typeof data === "object" ? data : {});
  out.ui = Object.assign(defaultUi(), (data && data.ui) || {});
  ensureUi(out);
  out.mods = Array.isArray(out.mods) ? out.mods.map(normalizeMod) : [];
  // Empty used to show the "room tone" placeholder while assemble emitted N/A.
  if (!String(out.soundscape || "").trim()) out.soundscape = "room tone";
  return out;
}

function hideWidget(widget) {
  if (!widget) return;
  widget.hidden = true;
  widget.computeSize = () => [0, -4];
  if (widget.element) widget.element.style.display = "none";
}

function repairWidgetWidth(widget) {
  if (!widget || widget.__h3hWidthGuard) return;
  const vueMode = () => Boolean(globalThis.LiteGraph?.vueNodesMode);
  let stored = vueMode() ? widget.width : undefined;
  try {
    Object.defineProperty(widget, "width", {
      configurable: true,
      enumerable: true,
      get() { return stored; },
      set(value) { stored = vueMode() ? value : undefined; },
    });
    widget.__h3hWidthGuard = true;
  } catch (e) { /* keep */ }
}

function refmodPreview(name) {
  return api.apiURL("/h3subjectrefmod/refmod/preview?name=" + encodeURIComponent(name || ""));
}

function warmRefmodCatalog() {
  const slot = (globalThis.__h3RefmodCatalog = globalThis.__h3RefmodCatalog || {});
  if (Array.isArray(slot.items)) return Promise.resolve(slot.items);
  if (!slot.pending) {
    slot.pending = api.fetchApi("/h3subjectrefmod/refmods").then((r) => r.json()).then((body) => {
      slot.pending = null;
      slot.items = Array.isArray(body?.items) ? body.items : [];
      return slot.items;
    }).catch(() => {
      slot.pending = null;
      return [];
    });
  }
  return slot.pending;
}
function refmodThumb(name, index, frame) {
  let url = "/h3subjectrefmod/refmod/thumb?name=" + encodeURIComponent(name || "");
  if (index != null || frame != null) {
    url += "&index=" + encodeURIComponent(String(index || 0))
      + "&frame=" + encodeURIComponent(String(frame || 0))
      + "&gallery=1";
  }
  return api.apiURL(url);
}
function imageView(path) {
  const raw = String(path || "").replace(/\\/g, "/");
  if (raw.startsWith("wardrobe:")) {
    return api.apiURL(
      "/h3subjecthybrid/wardrobe/photo?file=" + encodeURIComponent(raw.slice("wardrobe:".length)),
    );
  }
  // Comfy /view wants filename + subfolder separately (same as Ref2VA).
  const parts = raw.split("/").filter(Boolean);
  const filename = parts.pop() || "";
  if (!filename) return "";
  const query = new URLSearchParams({
    filename,
    type: "input",
    subfolder: parts.join("/"),
  });
  return api.apiURL("/view?" + query.toString());
}

function imageLabel(path) {
  const raw = String(path || "");
  if (!raw) return "Choose image…";
  if (raw.startsWith("wardrobe:")) {
    const parts = raw.slice("wardrobe:".length).split("/");
    return parts[parts.length - 1] || "clothing set";
  }
  return raw;
}

function pieceText(desc) {
  return String(desc || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "")
    .replace(/^(?:the|this)\s+outfit\s+consists\s+of\s+/i, "")
    .trim();
}

function setup(node, opts = null) {
  const host = opts && opts.container ? opts : null;
  const flag = host ? "_h3hHotMounted" : "_h3hMounted";
  if (node[flag] || (!host && typeof node.addDOMWidget !== "function")) return;
  const stateWidget = host?.stateApi || node.widgets?.find((w) => w.name === "state");
  if (!stateWidget) return;
  node[flag] = true;
  ensureStyle();
  if (!host) {
    hideWidget(stateWidget);
    const socket = node.inputs?.findIndex((input) => input.name === "state");
    if (socket != null && socket !== -1) node.removeInput(socket);
  }

  let state = migrateState();
  try {
    const parsed = JSON.parse(stateWidget.value || "{}");
    if (parsed && typeof parsed === "object") state = migrateState(parsed);
  } catch (e) { /* fresh */ }

  const write = () => {
    ensureUi(state);
    node.properties = node.properties || {};
    node.properties.h3h_prompt_open = !!state.ui.promptOpen;
    const raw = JSON.stringify(state);
    stateWidget.value = raw;
    if (stateWidget.inputEl) stateWidget.inputEl.value = raw;
  };
  stateWidget.serializeValue = () => { write(); return stateWidget.value; };

  let catalogCache = null;
  let voiceCache = null;
  let imageCache = null;
  let audioCache = null;
  let mixAudioPeaks = new Map();
  let mixAudioPlayer = null;
  let mixAudioPlayButton = null;
  let visionBusy = false;
  let visionKind = "";
  let describingId = null;
  let visionStarted = 0;
  let visionTick = 0;
  let draftResult = null;
  let timer = 0;
  let preview = { prompt: "", map: [] };
  const visionNote = new Map();
  const describeDraft = new Map();

  function visionClock() {
    const secs = Math.max(0, Math.floor((Date.now() - visionStarted) / 1000));
    return Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
  }
  function paintVisionClock() {
    if (!visionBusy) return;
    const label = (visionKind === "describe" ? "Describing " : "Drafting ") + visionClock();
    if (visionKind === "describe") {
      const button = list.querySelector(`[data-describe="${describingId}"]`);
      if (button) button.textContent = label;
      const badge = list.querySelector(`[data-live="${describingId}"]`);
      if (badge) badge.textContent = label;
      return;
    }
    draftBtn.textContent = label;
    if (draftLive) draftLive.textContent = label;
  }
  function startVisionClock(kind, rowId) {
    visionKind = kind;
    describingId = rowId || null;
    visionStarted = Date.now();
    clearInterval(visionTick);
    visionTick = setInterval(paintVisionClock, 1000);
    paintVisionClock();
  }
  function finishVision() {
    visionBusy = false;
    visionKind = "";
    describingId = null;
    clearInterval(visionTick);
    visionTick = 0;
  }

  const root = el("div", "h3h-root");
  stop(root);
  middleClickPan(root);

  const bar = el("div", "h3h-bar");
  const title = el("span", "h3h-title", "EM Subject Hot Swap — Mix");
  const addRef = el("button", "h3h-btn", "Add RefMod");
  const newRef = el("button", "h3h-btn", "New…");
  newRef.title = "Create a visual or voice RefMod here (same encode path as H3 Create RefMod)";
  const addImg = el("button", "h3h-btn", "Add image");
  const addCloth = el("button", "h3h-btn", "Add clothing");
  addCloth.title = "Pick an outfit from the pack wardrobe catalogue (ships with this node).";
  const hint = el("span", "h3h-hint", "RefMods → Video · Stills → Picture · New… creates in place");
  function setHint(text, alert) {
    const full = String(text || "").replace(/\s+/g, " ").trim();
    const short = full.length > 160 ? full.slice(0, 159).replace(/\s+\S*$/, "") + "…" : full;
    hint.textContent = short;
    hint.classList.toggle("alert", !!alert);
    hint.title = full;
  }
  stop(addRef); stop(newRef); stop(addImg); stop(addCloth);
  bar.append(title, addRef, newRef, addImg, addCloth, hint);

  let wardrobeCache = null;

  const refsBand = el("div", "h3h-band");
  refsBand.appendChild(el("div", "h3h-band-label", "Refs"));
  const list = el("div", "h3h-list");
  refsBand.appendChild(list);
  const mapLine = el("div", "h3h-map", "");

  const draftBand = el("div", "h3h-band");
  draftBand.appendChild(el("div", "h3h-band-label", "Draft"));
  const draftWrap = el("div", "h3h-sec");
  const styleShotLine = el("div", "h3h-line");
  const styleSel = document.createElement("select");
  styleSel.title = "Draft input: opening style phrase + look bias";
  for (const [value, label] of STYLES) {
    const option = el("option", null, label);
    option.value = value;
    styleSel.appendChild(option);
  }
  styleSel.value = STYLES.some(([value]) => value === state.style_mode) ? state.style_mode : "amateur";
  const shotSel = document.createElement("select");
  shotSel.title = "Draft input: Shot 1 framing";
  for (const shot of SHOTS) {
    const option = el("option", null, shot);
    option.value = shot;
    shotSel.appendChild(option);
  }
  shotSel.value = SHOTS.includes(state.shot_size) ? state.shot_size : "medium close-up";
  stop(styleSel);
  stop(shotSel);
  styleShotLine.append(
    el("span", "h3h-lbl", "style"), styleSel,
    el("span", "h3h-lbl", "shot"), shotSel,
  );
  const ideaBar = el("div", "h3h-line");
  const ideaActs = el("div", "h3h-line");
  ideaActs.style.marginLeft = "auto";
  const draftBtn = el("button", "h3h-btn", "Draft");
  stop(draftBtn);
  const draftLive = el("span", "h3h-live", "");
  draftLive.style.display = "none";
  for (const [key, label] of [["close", "Close"], ["develop", "Develop"]]) {
    const button = el("button", "h3h-btn" + (state.pass === key ? " on" : ""), label);
    button.dataset.pass = key;
    stop(button);
    button.addEventListener("click", () => {
      state.pass = key;
      ideaActs.querySelectorAll("[data-pass]").forEach((item) => item.classList.toggle("on", item.dataset.pass === key));
      write();
    });
    ideaActs.appendChild(button);
  }
  ideaActs.append(draftBtn, draftLive);
  ideaBar.append(el("span", "h3h-mini", "idea"), ideaActs);
  const ideaBox = document.createElement("textarea");
  ideaBox.rows = 3;
  ideaBox.placeholder = "the action, who does what, and a cut if there is one";
  ideaBox.value = state.idea || "";
  stop(ideaBox);
  ideaBox.addEventListener("input", () => { state.idea = ideaBox.value; write(); });
  draftWrap.append(styleShotLine, ideaBar, ideaBox);
  draftBand.appendChild(draftWrap);

  // Motion guidance for the Draft LLM (same set as RefMod / Ref).
  if (!state.motion || typeof state.motion !== "object") state.motion = {};
  const motionRow = el("div", "h3h-line");
  for (const [key, label, tip] of [
    ["weight", "Weight", "The lead motion shows its start, its carry, and its landing."],
    ["contact", "Contact", "Name both sides of the contact and the sound it makes."],
    ["follow", "Follow-through", "Hair, soft tissue, and loose cloth answer the lead motion."],
    ["settle", "Settle", "The shot ends on breathing or the body coming to rest."],
  ]) {
    const button = el("button", "h3h-btn" + (state.motion[key] ? " on" : ""), label);
    button.dataset.motion = key;
    button.title = tip;
    stop(button);
    button.addEventListener("click", () => {
      state.motion[key] = !state.motion[key];
      button.classList.toggle("on", !!state.motion[key]);
      write();
    });
    motionRow.appendChild(button);
  }
  draftWrap.appendChild(motionRow);

  const draftView = el("pre", "h3h-preview", "");
  draftView.style.display = "none";
  const draftActs = el("div", "h3h-line");
  draftActs.style.display = "none";
  const acceptBtn = el("button", "h3h-btn accept", "Accept");
  const discardBtn = el("button", "h3h-btn discard", "Discard");
  stop(acceptBtn); stop(discardBtn);
  draftActs.append(acceptBtn, discardBtn);
  draftWrap.append(draftView, draftActs);
  function showDraft(text) {
    draftView.textContent = text;
    draftView.style.display = "";
    draftActs.style.display = "";
    draftView.classList.remove("draft-ready");
    void draftView.offsetWidth;
    draftView.classList.add("draft-ready");
    draftView.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function area(key, rows, placeholder) {
    const box = document.createElement("textarea");
    box.rows = rows;
    box.placeholder = placeholder;
    box.dataset.key = key;
    box.value = state[key] || "";
    stop(box);
    box.addEventListener("input", () => { state[key] = box.value; write(); schedule(); });
    return box;
  }
  function putBox(key, value) {
    state[key] = value;
    root.querySelectorAll("textarea").forEach((box) => {
      if (box.dataset.key === key) box.value = value;
    });
  }

  styleSel.addEventListener("change", () => {
    state.style_mode = styleSel.value;
    const phrase = STYLE_OPENINGS[state.style_mode] || STYLE_OPENINGS.cinematic;
    putBox("opening", "The target video is " + phrase + ".");
    commit();
  });
  shotSel.addEventListener("change", () => {
    state.shot_size = shotSel.value;
    commit();
  });

  const taskSel = document.createElement("select");
  for (const [value, label] of TASKS) {
    const option = el("option", null, label);
    option.value = value;
    taskSel.appendChild(option);
  }
  taskSel.value = state.task || "reference generation";
  stop(taskSel);
  taskSel.addEventListener("change", () => { state.task = taskSel.value; write(); schedule(); });

  const summaryWrap = el("div", "h3h-sec");
  const summaryHead = el("div", "h3h-line");
  summaryHead.append(el("span", "h3h-lbl", "summary:"), taskSel);
  summaryWrap.append(summaryHead, area("summary", 3, "the woman sits on the sofa"));

  const openingWrap = el("div", "h3h-sec");
  const openingHead = el("div", "h3h-line");
  openingHead.appendChild(el("span", "h3h-lbl", "opening"));
  const openPick = document.createElement("select");
  openPick.appendChild(el("option", null, "openings")).value = "";
  for (const line of OPENING_STARTERS) {
    const option = el("option", null, line.slice(0, 48) + "…");
    option.value = line;
    openPick.appendChild(option);
  }
  stop(openPick);
  openPick.addEventListener("change", () => {
    if (!openPick.value) return;
    putBox("opening", openPick.value);
    openPick.value = "";
    commit();
  });
  openingHead.appendChild(openPick);
  openingWrap.append(openingHead, area("opening", 2, "style and light"));

  const detailedWrap = el("div", "h3h-sec");
  const detailedHead = el("div", "h3h-line");
  detailedHead.appendChild(el("span", "h3h-lbl", "detailed_description:"));
  if (typeof state.subject_reinforced !== "boolean") state.subject_reinforced = true;
  const reinforceBtn = el(
    "button",
    "h3h-btn" + (state.subject_reinforced ? " on" : ""),
    state.subject_reinforced ? "Subject reinforce ON" : "Subject reinforce OFF",
  );
  stop(reinforceBtn);
  reinforceBtn.title = "ON: who expands into detailed at Preview/encode. OFF: bare <Subject N> in detailed. Defs/retention always carry who/keep. Editor stays tag-clean.";
  reinforceBtn.addEventListener("click", () => {
    state.subject_reinforced = !state.subject_reinforced;
    reinforceBtn.classList.toggle("on", state.subject_reinforced);
    reinforceBtn.textContent = state.subject_reinforced ? "Subject reinforce ON" : "Subject reinforce OFF";
    write();
    schedule();
  });
  detailedHead.appendChild(reinforceBtn);
  detailedWrap.append(detailedHead, area("detailed", 5, "[Shot 1] <Subject 1> does …"));
  const soundWrap = el("div", "h3h-sec");
  soundWrap.append(el("div", "h3h-lbl", "overall_soundscape:"), area("soundscape", 2, "room tone"));
  const musicWrap = el("div", "h3h-sec");
  musicWrap.append(el("div", "h3h-lbl", "non_diegetic_music:"), area("music", 2, "N/A"));

  const previewBar = el("div", "h3h-line");
  const previewBtn = el("button", "h3h-btn", "Preview");
  const copyBtn = el("button", "h3h-btn", "Copy");
  stop(previewBtn); stop(copyBtn);
  const previewBox = el("pre", "h3h-preview", "");
  previewBox.style.display = "none";
  previewBar.append(previewBtn, copyBtn);
  previewBtn.addEventListener("click", () => {
    const open = previewBox.style.display === "none";
    previewBox.style.display = open ? "" : "none";
    previewBtn.classList.toggle("on", open);
  });
  copyBtn.addEventListener("click", () => {
    navigator.clipboard?.writeText(preview.prompt || "");
    copyBtn.textContent = "Copied";
    setTimeout(() => { copyBtn.textContent = "Copy"; }, 900);
  });

  const promptBand = el("div", "h3h-band");
  const promptHead = el("button", "h3h-band-head", "");
  stop(promptHead);
  const promptMeta = el("span", "h3h-band-meta", "summary · opening · shots · sound");
  const promptBody = el("div", "h3h-band-body");
  promptBody.append(summaryWrap, openingWrap, detailedWrap, soundWrap, musicWrap, previewBar, previewBox);

  function paintPromptHead() {
    ensureUi(state);
    const open = !!state.ui.promptOpen;
    promptHead.textContent = "";
    promptHead.append(document.createTextNode(open ? "▾ Prompt" : "▸ Prompt"), promptMeta);
    promptBody.style.display = open ? "" : "none";
  }
  promptHead.addEventListener("click", () => {
    ensureUi(state).promptOpen = !state.ui.promptOpen;
    paintPromptHead();
    write();
  });
  ensureUi(state);
  if (typeof node.properties?.h3h_prompt_open === "boolean" && state.ui.promptOpen === false) {
    try {
      const raw = JSON.parse(stateWidget.value || "{}");
      if (!(raw && raw.ui && typeof raw.ui.promptOpen === "boolean")) {
        state.ui.promptOpen = !!node.properties.h3h_prompt_open;
      }
    } catch (e) { /* ignore */ }
  }
  paintPromptHead();
  promptBand.append(promptHead, promptBody);
  root.append(bar, refsBand, mapLine, draftBand, promptBand);

  function commit() { write(); schedule(); }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(assemble, 180);
  }

  function updateMap() {
    const bits = [];
    let subject = 0, picture = 0, video = 0, audio = 0;
    for (const row of state.mods) {
      if (row.enabled === false) continue;
      const concept = conceptOf(row);
      const source = sourceOf(row);
      if (concept === "voice" || (source === "refmod" && row.voice_refmod && !row.refmod && !row.image)) {
        audio += 1;
        bits.push(`Audio ${audio} → ${row.voice_refmod || row.refmod || "?"}`);
        continue;
      }
      if (source === "image") {
        if (!row.image) continue;
        subject += 1; picture += 1;
        bits.push(`Picture ${picture} / Subject ${subject} → ${row.image}`);
      } else {
        if (!row.refmod) continue;
        subject += 1; video += 1;
        bits.push(`Video ${video} / Subject ${subject} → ${row.refmod} @ ${clampStrength(row.strength).toFixed(2)}`);
      }
      const voiceMode = row.voice_mode || (row.voice_refmod ? "refmod" : row.voice_audio_file ? "audio" : "none");
      if (voiceMode === "refmod" && row.voice_refmod) {
        audio += 1;
        bits.push(`Audio ${audio} → ${row.voice_refmod}`);
      } else if (voiceMode === "audio" && row.voice_audio_file) {
        audio += 1;
        const range = Number(row.voice_audio_end) > Number(row.voice_audio_start)
          ? ` [${Number(row.voice_audio_start).toFixed(2)}–${Number(row.voice_audio_end).toFixed(2)}s]` : "";
        bits.push(`Audio ${audio} → ${row.voice_audio_file}${range}`);
      }
    }
    mapLine.textContent = bits.join("\n") || "No refs are switched on.";
  }

  async function assemble() {
    updateMap();
    try {
      const response = await api.fetchApi("/h3subjecthybrid/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const body = await response.json();
      preview = body || {};
      if (body.error) setHint(body.error, true);
      else setHint("RefMods → Video · Stills → Picture", false);
      previewBox.textContent = body.prompt || "";
    } catch (e) {
      setHint(e.message || "Assemble failed.", true);
    }
  }

  function applyClothing(item, row, parent) {
    const pieces = pieceText(item.desc) || item.name || "the clothing set";
    const target = row || newMod("image");
    target.source = "image";
    target.concept = "wardrobe";
    target.image = "wardrobe:" + item.photo;
    target.refmod = "";
    target.desc = String(item.desc || "").trim();
    target.who = "a clothing set that includes " + pieces;
    target.keep = keepDefault("wardrobe");
    target.marker = "fully_preserved";
    target.setId = item.id || "";
    target.name = item.name || "Clothing set";
    target.wears = parent ? parent.id : "";
    return target;
  }

  function insertTiedClothing(parent, item) {
    const existing = tiedOutfits(state, parent.id);
    let row = existing[0];
    if (!row) {
      row = applyClothing(item, null, parent);
      let at = state.mods.indexOf(parent);
      while (state.mods[at + 1] && state.mods[at + 1].wears === parent.id) at += 1;
      state.mods.splice(at + 1, 0, row);
    } else {
      applyClothing(item, row, parent);
    }
    // Drop extra tied outfits — one outfit per character by default
    for (const extra of existing.slice(1)) {
      state.mods = state.mods.filter((m) => m.id !== extra.id);
    }
    state.active = row.id;
    return row;
  }

  function clearTiedClothing(parent) {
    state.mods = state.mods.filter((row) => !(row.wears === parent.id && conceptOf(row) === "wardrobe"));
  }

  async function fillFromLibrary(row) {
    const kind = sourceOf(row) === "image" ? "image" : "refmod";
    const name = sourceOf(row) === "image" ? row.image : row.refmod;
    if (!name) return;
    try {
      const response = await api.fetchApi(
        `/h3subjecthybrid/library?kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(name)}`,
      );
      const body = await response.json();
      const entry = body?.entry;
      if (!entry) return;
      const whoEmpty = !String(row.who || "").trim() || row.who === whoFromName(name, "");
      if (whoEmpty && entry.who) row.who = entry.who;
      if ((!String(row.keep || "").trim() || row.keep === keepDefault(conceptOf(row))) && entry.keep) {
        row.keep = entry.keep;
      }
      if (entry.concept) row.concept = entry.concept;
      if (entry.marker) row.marker = entry.marker;
      if (entry.name && !row.name) row.name = entry.name;
      renderList();
      write();
    } catch (e) { /* ignore */ }
  }

  async function saveToLibrary(row) {
    const kind = sourceOf(row) === "image" ? "image" : "refmod";
    const name = sourceOf(row) === "image" ? row.image : row.refmod;
    if (!name || !String(row.who || "").trim()) return;
    try {
      await api.fetchApi("/h3subjecthybrid/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name,
          who: row.who,
          keep: row.keep,
          concept: conceptOf(row),
          marker: row.marker,
          title: row.name || "",
        }),
      });
      visionNote.set(row.id, "Saved who + keep to shared library.");
      renderList();
    } catch (e) {
      setHint(e.message || "Library save failed.", true);
    }
  }

  function openWardrobe(anchor, parent, targetRow) {
    // parent → tie/replace that character's outfit. targetRow → replace this wardrobe row in place.
    document.querySelectorAll(".h3h-picker, .h3h-pick-blanket").forEach((node) => node.remove());
    const blanket = el("div", "h3h-pick-blanket");
    const popup = el("div", "h3h-picker");
    stop(popup);
    const searchWrap = el("div", "h3h-pick-search");
    const search = document.createElement("input");
    search.placeholder = parent
      ? "Filter clothing for this character…"
      : "Filter clothing sets…";
    const closeBtn = el("button", "h3h-btn", "Close");
    stop(closeBtn);
    function dismiss() {
      blanket.remove();
      popup.remove();
      document.removeEventListener("pointerdown", onDoc, true);
      document.removeEventListener("keydown", onKey, true);
    }
    closeBtn.addEventListener("click", dismiss);
    blanket.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    });
    function onDoc(e) {
      if (popup.contains(e.target) || (anchor && anchor.contains(e.target))) return;
      dismiss();
    }
    function onKey(e) {
      if (e.key === "Escape") dismiss();
    }
    searchWrap.append(search, closeBtn);
    const split = el("div", "h3h-pick-split");
    const sidebar = el("div", "h3h-pick-folders");
    const pane = el("div", "h3h-pick-pane");
    split.append(sidebar, pane);
    const foot = el("div", "h3h-pick-foot");
    const footText = el("span", null, "Loading clothing sets…");
    footText.style.flex = "1";
    const addSetBtn = el("button", "h3h-btn", "Add set…");
    stop(addSetBtn);
    foot.append(footText, addSetBtn);
    popup.append(searchWrap, split, foot);
    document.body.append(blanket, popup);
    popup.style.left = "50%";
    popup.style.top = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    document.addEventListener("pointerdown", onDoc, true);
    document.addEventListener("keydown", onKey, true);

    let active = "__all";
    let query = "";
    let categories = [];
    let items = [];

    function pickItem(item) {
      dismiss();
      if (parent) {
        insertTiedClothing(parent, item);
        state.active = parent.id;
      } else if (targetRow) {
        const wearer = targetRow.wears
          ? state.mods.find((m) => m.id === targetRow.wears)
          : null;
        applyClothing(item, targetRow, wearer || null);
        state.active = targetRow.id;
      } else {
        const row = applyClothing(item);
        state.mods.push(row);
        state.active = row.id;
      }
      renderList();
      commit();
    }

    function visible() {
      const q = query.trim().toLowerCase();
      return items.filter((item) => {
        if (active !== "__all" && item.cat !== active) return false;
        if (!q) return true;
        return (item.name + " " + item.desc).toLowerCase().includes(q);
      });
    }

    function render() {
      sidebar.innerHTML = "";
      const tabs = [{ id: "__all", label: "All" }].concat(categories);
      for (const tab of tabs) {
        const count = tab.id === "__all" ? items.length : items.filter((item) => item.cat === tab.id).length;
        if (tab.id !== "__all" && !count) continue;
        const folder = el("div", "h3h-pick-folder" + (tab.id === active ? " on" : ""));
        folder.append(el("span", null, tab.label), el("span", "h3h-pick-count", String(count)));
        folder.addEventListener("click", () => { active = tab.id; render(); });
        sidebar.appendChild(folder);
      }
      pane.innerHTML = "";
      const shown = visible();
      const label = query.trim() ? "filter" : (tabs.find((tab) => tab.id === active) || {}).label || "All";
      footText.textContent = items.length
        ? shown.length + " sets · " + label
        : "No clothing catalogue in this pack yet (data/wardrobe).";
      if (!shown.length) {
        pane.appendChild(el("div", "h3h-pick-empty", items.length ? "No sets in this tab." : "No clothing sets found."));
        return;
      }
      for (const item of shown) {
        const card = el("div", "h3h-pick-card");
        const img = document.createElement("img");
        img.alt = "";
        img.src = imageView("wardrobe:" + item.photo);
        card.append(
          img,
          el("span", "h3h-pick-name", item.name),
          el("span", "h3h-pick-desc", pieceText(item.desc) || item.name),
        );
        card.title = item.desc || item.name;
        card.addEventListener("click", () => pickItem(item));
        pane.appendChild(card);
      }
    }

    addSetBtn.addEventListener("click", () => {
      dismiss();
      openAddWardrobeSet(anchor, parent);
    });

    search.addEventListener("input", () => { query = search.value; render(); });
    const ready = wardrobeCache
      ? Promise.resolve(wardrobeCache)
      : api.fetchApi("/h3subjecthybrid/wardrobe").then((response) => response.json());
    ready.then((body) => {
      wardrobeCache = body || { categories: [], items: [] };
      categories = Array.isArray(wardrobeCache.categories) ? wardrobeCache.categories : [];
      items = Array.isArray(wardrobeCache.items) ? wardrobeCache.items : [];
      if (popup.isConnected) render();
    }).catch(() => {
      footText.textContent = "Restart ComfyUI to load the clothing catalogue.";
    });
    search.focus();
  }

  function openAddWardrobeSet(anchor, parent) {
    document.querySelectorAll(".h3h-picker, .h3h-pick-blanket").forEach((node) => node.remove());
    const blanket = el("div", "h3h-pick-blanket");
    const popup = el("div", "h3h-picker");
    popup.style.height = "auto";
    popup.style.maxHeight = "min(640px, calc(100vh - 16px))";
    stop(popup);
    const head = el("div", "h3h-pick-search");
    head.append(el("span", "h3h-title", "Add clothing set"), el("button", "h3h-btn", "Close"));
    const closeBtn = head.querySelector("button");
    stop(closeBtn);
    let pasteHook = null;
    let revokePreview = null;
    function dismiss() {
      if (pasteHook) {
        document.removeEventListener("paste", pasteHook, true);
        pasteHook = null;
      }
      if (revokePreview) {
        revokePreview();
        revokePreview = null;
      }
      blanket.remove();
      popup.remove();
    }
    closeBtn.addEventListener("click", dismiss);
    blanket.addEventListener("pointerdown", (e) => { e.preventDefault(); dismiss(); });

    const body = el("div", "h3h-band-body");
    body.style.padding = "10px";
    body.style.gap = "8px";
    body.style.display = "flex";
    body.style.flexDirection = "column";

    let photoPath = "";
    let pendingFile = null;
    let previewUrl = "";
    const zone = el("div", "h3h-paste");
    zone.tabIndex = 0;
    stop(zone);
    const zoneHint = el("div", "h3h-paste-hint", "Paste (Ctrl+V), drop, or browse a photo");
    const zoneImg = document.createElement("img");
    zoneImg.alt = "";
    zoneImg.hidden = true;
    const zoneMeta = el("div", "h3h-paste-hint", "");
    zoneMeta.hidden = true;
    const actions = el("div", "h3h-paste-actions");
    const browseBtn = el("button", "h3h-btn", "Browse file…");
    const inputBtn = el("button", "h3h-btn", "From input…");
    const clearBtn = el("button", "h3h-btn", "Clear");
    stop(browseBtn);
    stop(inputBtn);
    stop(clearBtn);
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp";
    fileInput.style.display = "none";
    actions.append(browseBtn, inputBtn, clearBtn, fileInput);
    zone.append(zoneHint, zoneImg, zoneMeta, actions);

    function clearPhoto() {
      pendingFile = null;
      photoPath = "";
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = "";
      }
      zoneImg.removeAttribute("src");
      zoneImg.hidden = true;
      zoneMeta.hidden = true;
      zoneMeta.textContent = "";
      zoneHint.hidden = false;
      zone.classList.remove("has", "drag");
    }
    revokePreview = clearPhoto;

    function showPreview(fileOrUrl, label) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = "";
      }
      zoneHint.hidden = true;
      zoneImg.hidden = false;
      zoneMeta.hidden = false;
      zoneMeta.textContent = label || "";
      zone.classList.add("has");
      zone.classList.remove("drag");
      if (typeof fileOrUrl === "string") {
        zoneImg.src = fileOrUrl;
      } else {
        previewUrl = URL.createObjectURL(fileOrUrl);
        zoneImg.src = previewUrl;
      }
    }

    function stemFromName(name) {
      const base = String(name || "").replace(/^.*[\\/]/, "");
      return base.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    }

    function acceptFile(file) {
      const type = String(file && file.type || "");
      const fname = String(file && file.name || "");
      const looksImage = type.startsWith("image/")
        || !type
        || /\.(png|jpe?g|webp|gif|bmp)$/i.test(fname);
      if (!file || !looksImage) {
        window.alert("That isn't an image.");
        return;
      }
      pendingFile = file;
      photoPath = "";
      showPreview(file, file.name || "Pasted image");
      if (!nameIn.value.trim()) {
        const stem = stemFromName(file.name);
        if (stem) nameIn.value = stem;
      }
    }

    function acceptInputPath(path) {
      pendingFile = null;
      photoPath = path;
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = "";
      }
      // Comfy /view for input images: filename may include subfolder via picker path.
      const parts = String(path || "").replace(/\\/g, "/").split("/");
      const filename = parts.pop();
      const subfolder = parts.join("/");
      const qs = new URLSearchParams({ filename, type: "input" });
      if (subfolder) qs.set("subfolder", subfolder);
      showPreview(`/view?${qs}`, path);
      if (!nameIn.value.trim()) {
        const stem = stemFromName(filename);
        if (stem) nameIn.value = stem;
      }
    }

    browseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      fileInput.click();
    });
    fileInput.addEventListener("change", () => {
      const picked = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (picked) acceptFile(picked);
    });
    inputBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPicker(inputBtn, "image", photoPath, (item) => {
        acceptInputPath(item.path || item.name);
      });
    });
    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      clearPhoto();
    });
    zone.addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target === fileInput) return;
      zone.focus();
    });
    zone.addEventListener("dragenter", (e) => { e.preventDefault(); zone.classList.add("drag"); });
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag"); });
    zone.addEventListener("dragleave", (e) => {
      if (!zone.contains(e.relatedTarget)) zone.classList.remove("drag");
    });
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag");
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) acceptFile(file);
    });
    zone.addEventListener("paste", (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const item of items) {
        if (item.type && item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) acceptFile(file);
          return;
        }
      }
    });
    // Catch paste while dialog is open even if focus left the zone.
    pasteHook = (e) => {
      if (!popup.isConnected) return;
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const item of items) {
        if (item.type && item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) acceptFile(file);
          return;
        }
      }
    };
    document.addEventListener("paste", pasteHook, true);

    const nameIn = document.createElement("input");
    nameIn.type = "text";
    nameIn.placeholder = "Set name";
    nameIn.className = "h3h-grow";
    stop(nameIn);
    const descIn = document.createElement("textarea");
    descIn.rows = 5;
    descIn.placeholder = "Full outfit paragraph (kept intact in the catalogue)";
    stop(descIn);
    const saveBtn = el("button", "h3h-btn", "Save to catalogue");
    stop(saveBtn);
    saveBtn.addEventListener("click", async () => {
      if (!pendingFile && !photoPath) { window.alert("Paste, drop, or pick a photo first."); return; }
      saveBtn.disabled = true;
      try {
        let result;
        if (pendingFile) {
          const body = new FormData();
          body.append("photo", pendingFile, pendingFile.name || "paste.png");
          body.append("name", nameIn.value);
          body.append("desc", descIn.value);
          body.append("cat", "custom");
          const response = await api.fetchApi("/h3subjecthybrid/wardrobe/upload", { method: "POST", body });
          result = await response.json();
          if (!response.ok || result.error) throw new Error(result.error || "Upload failed");
        } else {
          const response = await api.fetchApi("/h3subjecthybrid/wardrobe/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo_path: photoPath, name: nameIn.value, desc: descIn.value, cat: "custom" }),
          });
          result = await response.json();
          if (!response.ok || result.error) throw new Error(result.error || "Add failed");
        }
        wardrobeCache = null;
        dismiss();
        const item = result.item;
        if (parent) insertTiedClothing(parent, item);
        else {
          const row = applyClothing(item);
          state.mods.push(row);
          state.active = row.id;
        }
        renderList();
        commit();
        setHint("Clothing set saved to pack catalogue.", false);
      } catch (e) {
        window.alert(e.message || "Could not add set.");
      } finally {
        saveBtn.disabled = false;
      }
    });
    body.append(
      el("div", "h3h-lbl", "photo"), zone,
      el("div", "h3h-lbl", "name"), nameIn,
      el("div", "h3h-lbl", "description"), descIn,
      saveBtn,
    );
    popup.append(head, body);
    document.body.append(blanket, popup);
    popup.style.left = "50%";
    popup.style.top = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    zone.focus();
  }

  function openPicker(anchor, mode, current, onPick) {
    // mode: refmod | voice | image | audio
    document.querySelectorAll(".h3h-picker, .h3h-pick-blanket").forEach((node) => node.remove());
    const blanket = el("div", "h3h-pick-blanket");
    const popup = el("div", "h3h-picker");
    stop(popup);
    const searchWrap = el("div", "h3h-pick-search");
    const search = document.createElement("input");
    search.placeholder = mode === "image" ? "Filter images…" : mode === "audio" ? "Filter audio clips…" : mode === "voice" ? "Filter voice RefMods…" : "Filter RefMods…";
    const sortSel = document.createElement("select");
    sortSel.className = "h3h-pick-sort";
    const sortOpts = [
      ["newest", "Newest first"],
      ["oldest", "Oldest first"],
      ["name_az", "Name A–Z"],
      ["name_za", "Name Z–A"],
    ];
    if (mode !== "image" && mode !== "audio") sortOpts.push(["concept", "Concept"]);
    for (const [value, label] of sortOpts) {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = label;
      sortSel.appendChild(o);
    }
    const sortKey = mode === "image" ? "h3h_image_sort" : mode === "audio" ? "h3h_audio_sort" : "h3h_refmod_sort";
    const savedSort = String(node.properties?.[sortKey] || "newest");
    sortSel.value = [...sortSel.options].some((o) => o.value === savedSort) ? savedSort : "newest";
    stop(sortSel);
    const close = el("button", "h3h-btn", "Close");
    stop(close);
    function dismiss() {
      blanket.remove();
      popup.remove();
      document.removeEventListener("pointerdown", onDoc, true);
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey, true);
    }
    close.addEventListener("click", dismiss);
    blanket.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
    });
    function onDoc(e) {
      if (popup.contains(e.target)) return;
      if (anchor.contains?.(e.target) || e.target === anchor) return;
      dismiss();
    }
    function onKey(e) { if (e.key === "Escape") dismiss(); }
    setTimeout(() => {
      document.addEventListener("pointerdown", onDoc, true);
      document.addEventListener("mousedown", onDoc, true);
      document.addEventListener("keydown", onKey, true);
    }, 0);
    if (mode === "audio") {
      const uploadAudio = el("button", "h3h-btn", "Upload audio");
      const audioInput = document.createElement("input");
      audioInput.type = "file";
      audioInput.accept = "audio/*,.wav,.mp3,.flac,.ogg,.m4a,.aac,.opus";
      audioInput.style.display = "none";
      stop(uploadAudio); stop(audioInput);
      uploadAudio.addEventListener("click", () => audioInput.click());
      audioInput.addEventListener("change", async () => {
        const picked = audioInput.files?.[0];
        audioInput.value = "";
        if (!picked) return;
        uploadAudio.disabled = true;
        const form = new FormData();
        form.append("image", picked);
        form.append("overwrite", "true");
        form.append("type", "input");
        try {
          const response = await api.fetchApi("/upload/image", { method: "POST", body: form });
          const payload = await response.json();
          if (!response.ok || !payload.name) throw new Error(payload.error || "Upload failed");
          const path = payload.subfolder ? `${payload.subfolder}/${payload.name}` : payload.name;
          onPick({ name: path, path });
          audioCache = null;
          dismiss();
          renderList();
          commit();
        } catch (error) {
          window.alert(error.message || "Couldn't upload that audio.");
          uploadAudio.disabled = false;
        }
      });
      searchWrap.append(uploadAudio, audioInput);
    }
    searchWrap.append(search, sortSel, close);
    const split = el("div", "h3h-pick-split");
    const folders = el("div", "h3h-pick-folders");
    const folderList = el("div", "h3h-pick-folder-list");
    const folderActs = el("div", "h3h-pick-folder-actions");
    const newFolderBtn = el("button", "h3h-btn", "+ Folder");
    stop(newFolderBtn);
    newFolderBtn.title = "Create a subfolder under models/refmods/";
    newFolderBtn.style.display = mode === "image" || mode === "audio" ? "none" : "";
    folderActs.appendChild(newFolderBtn);
    folders.append(folderList, folderActs);
    const pane = el("div", "h3h-pick-pane" + (mode === "audio" ? " audio" : ""));
    split.append(folders, pane);
    const foot = el("div", "h3h-pick-foot");
    foot.style.display = "flex";
    foot.style.alignItems = "center";
    foot.style.gap = "8px";
    const footText = el("span", null, mode === "image"
      ? "Still → Picture tag. Wardrobe plates work well here."
      : mode === "audio" ? "Audio clip → voice reference. Trim its range in the Mix row."
        : "RefMod → Video tag. Search by name if needed.");
    footText.style.flex = "1";
    const refreshBtn = el("button", "h3h-btn", "Refresh");
    stop(refreshBtn);
    foot.append(footText, refreshBtn);
    popup.append(searchWrap, split, foot);
    document.body.appendChild(blanket);
    document.body.appendChild(popup);
    // Near-fullscreen panel — center in the viewport so bottom rows never clip it.
    popup.style.left = "50%";
    popup.style.top = "50%";
    popup.style.transform = "translate(-50%, -50%)";

    let items = [];
    let diskFolders = [];
    let folder = "";
    function folderOf(name) {
      const parts = String(name || "").replace(/\\/g, "/").split("/");
      return parts.length > 1 ? parts[0] : "";
    }
    function remapName(oldName, newName) {
      if (!oldName || !newName || oldName === newName) return;
      for (const mod of state.mods || []) {
        if (mod.refmod === oldName) mod.refmod = newName;
        if (mod.voice_refmod === oldName) mod.voice_refmod = newName;
      }
    }
    function sortedItems(list) {
      const sortMode = sortSel.value || "newest";
      const out = list.slice();
      const label = (item) => String(item.name || item.path || "");
      const byName = (a, b) => label(a).localeCompare(label(b), undefined, { sensitivity: "base" });
      const byMtime = (a, b) => (Number(b.mtime) || 0) - (Number(a.mtime) || 0);
      if (sortMode === "oldest") out.sort((a, b) => -byMtime(a, b) || byName(a, b));
      else if (sortMode === "name_az") out.sort(byName);
      else if (sortMode === "name_za") out.sort((a, b) => -byName(a, b));
      else if (sortMode === "concept") {
        out.sort((a, b) => String(a.concept || "").localeCompare(String(b.concept || ""), undefined, { sensitivity: "base" }) || byName(a, b));
      } else {
        out.sort((a, b) => byMtime(a, b) || byName(a, b));
      }
      return out;
    }
    function render() {
      const q = search.value.trim().toLowerCase();
      const ordered = sortedItems(items);
      const counts = new Map([["", 0]]);
      for (const item of ordered) {
        const f = folderOf(item.name || item.path);
        counts.set("", (counts.get("") || 0) + 1);
        if (f) counts.set(f, (counts.get(f) || 0) + 1);
      }
      for (const name of diskFolders) {
        if (!counts.has(name)) counts.set(name, 0);
      }
      folderList.innerHTML = "";
      for (const [name, count] of [...counts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
        const button = el("div", "h3h-pick-folder" + (folder === name ? " on" : ""));
        button.append(el("span", null, name || "All"), el("span", "h3h-pick-count", String(count)));
        button.addEventListener("click", () => { folder = name; render(); });
        folderList.appendChild(button);
      }
      pane.innerHTML = "";
      const shown = ordered.filter((item) => {
        const name = item.name || item.path || "";
        if (folder && folderOf(name) !== folder) return false;
        if (!q) return true;
        return (name + " " + (item.description || "")).toLowerCase().includes(q);
      });
      if (!shown.length) {
        pane.appendChild(el("div", "h3h-pick-empty", items.length ? "No matches." : "Nothing found."));
        return;
      }
      for (const item of shown) {
        const name = (mode === "image" || mode === "audio") ? (item.path || item.name) : (item.name || item.path);
        const card = el("div", "h3h-pick-card" + (current === name ? " on" : ""));
        if (mode === "image") {
          const img = document.createElement("img");
          img.alt = "";
          img.src = imageView(item.path);
          img.addEventListener("error", () => img.remove());
          card.appendChild(img);
        } else if (mode === "audio") {
          const audioRow = el("div", "h3h-pick-audio");
          const player = document.createElement("audio");
          player.controls = true;
          player.preload = "none";
          player.src = imageView(name);
          player.addEventListener("click", (event) => event.stopPropagation());
          player.addEventListener("pointerdown", (event) => event.stopPropagation());
          const use = el("button", "h3h-btn", current === name ? "Selected" : "Use");
          use.title = "Load this audio clip into the Mix row";
          stop(use);
          use.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            onPick(item);
            dismiss();
            renderList();
            commit();
          });
          audioRow.append(player, use);
          card.appendChild(audioRow);
        } else if (item.has_looks || item.has_preview) {
          const img = document.createElement("img");
          img.alt = "";
          img.src = (item.has_preview ? refmodPreview(name) : refmodThumb(name)) + "&t=1";
          img.addEventListener("error", () => img.remove());
          card.appendChild(img);
        }
        card.appendChild(el("div", "h3h-pick-name", name));
        if (item.format || item.concept || item.stack) {
          card.appendChild(el("div", "h3h-pick-meta", [item.format, item.concept, item.stack].filter(Boolean).join(" · ")));
        }
        if (item.description) card.appendChild(el("div", "h3h-pick-desc", item.description));
        if (mode === "refmod" || mode === "voice") {
          card.style.position = "relative";
          const moveBtn = el("button", "h3h-btn h3h-pick-move", "Move");
          stop(moveBtn);
          moveBtn.title = "Move into a folder under models/refmods/";
          moveBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const choices = ["(root / All)", ...[...new Set([...diskFolders, ...[...counts.keys()].filter(Boolean)])].sort((a, b) => a.localeCompare(b))];
            const pick = window.prompt(
              `Move "${name}" to folder:\n` + choices.map((c, i) => `${i}: ${c}`).join("\n") + "\n\nType folder name or index:",
              folder || "",
            );
            if (pick == null) return;
            let dest = String(pick).trim();
            if (/^\d+$/.test(dest)) {
              const n = Number(dest);
              dest = n === 0 ? "" : String(choices[n] || "").replace(/^\(root.*/, "");
            }
            if (dest === "(root / All)") dest = "";
            moveBtn.disabled = true;
            try {
              const response = await api.fetchApi("/h3subjectrefmod/refmod/move", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, folder: dest, move_pair: true }),
              });
              const body = await response.json();
              if (!response.ok || body.error) throw new Error(body.error || "Move failed");
              remapName(body.old_name || name, body.name);
              for (const pair of body.pairs || []) {
                if (pair.ok && pair.old_name && pair.name) remapName(pair.old_name, pair.name);
              }
              catalogCache = null;
              voiceCache = null;
              setHint(`Moved → ${body.name}`, false);
              await loadList({ force: true });
              await loadFolders();
              renderList();
              commit();
            } catch (err) {
              window.alert(err.message || "Could not move.");
              moveBtn.disabled = false;
            }
          });
          card.appendChild(moveBtn);
          const del = el("button", "h3h-pick-del", "Delete");
          stop(del);
          del.title = "Delete from models/refmods";
          del.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!window.confirm(`Delete RefMod "${name}" from models/refmods?\nThis removes the .safetensors and preview.`)) return;
            del.disabled = true;
            try {
              const response = await api.fetchApi("/h3subjectrefmod/refmod/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, confirm: true }),
              });
              const body = await response.json();
              if (!response.ok || body.error) throw new Error(body.error || "Delete failed");
              items = items.filter((row) => (row.name || row.path) !== name);
              if (mode === "voice" && voiceCache?.items) {
                voiceCache.items = voiceCache.items.filter((row) => row.name !== name);
              } else if (catalogCache?.items) {
                catalogCache.items = catalogCache.items.filter((row) => row.name !== name);
              }
              if (typeof hint !== "undefined" && hint) setHint(`Deleted ${name}`, false);
              render();
            } catch (err) {
              window.alert(err.message || "Could not delete.");
              del.disabled = false;
            }
          });
          card.appendChild(del);
        }
        card.addEventListener("click", () => {
          const finish = () => { onPick(item); dismiss(); renderList(); commit(); };
          if (mode === "refmod" && !item.has_preview) {
            api.fetchApi("/h3subjectrefmod/refmod/ensure_preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            }).then(async (r) => {
              try {
                const body = await r.json();
                if (body.has_preview) item.has_preview = true;
              } catch (e) { /* ignore */ }
            }).finally(finish);
            return;
          }
          finish();
        });
        pane.appendChild(card);
      }
    }
    search.addEventListener("input", render);
    sortSel.addEventListener("change", () => {
      node.properties = node.properties || {};
      node.properties[sortKey] = sortSel.value;
      render();
    });
    const url = mode === "image"
      ? "/h3subjecthybrid/images"
      : mode === "audio"
        ? "/h3subjectref/audio"
        : mode === "voice"
          ? "/h3subjectrefmod/voices"
          : "/h3subjectrefmod/refmods";

    function applyBody(body) {
      if (mode === "image") {
        imageCache = body || { files: [] };
        items = (imageCache.files || []).map((f) => ({
          name: f.path,
          path: f.path,
          description: "",
          mtime: f.mtime || 0,
        }));
      } else if (mode === "audio") {
        audioCache = body || { files: [] };
        items = (audioCache.files || []).map((f) => ({
          name: f.name || f.path,
          path: f.path || f.name,
          description: "",
          mtime: f.mtime || 0,
        }));
      } else if (mode === "voice") {
        voiceCache = body || { items: [] };
        items = voiceCache.items || [];
      } else {
        const listed = Array.isArray(body?.items) ? body.items : [];
        const slot = (globalThis.__h3RefmodCatalog = globalThis.__h3RefmodCatalog || {});
        slot.items = listed;
        catalogCache = { items: listed };
        items = listed;
      }
      render();
    }

    function loadList({ force = false } = {}) {
      const cached = mode === "image" ? imageCache : mode === "audio" ? audioCache : mode === "voice" ? voiceCache : catalogCache;
      if (cached && !force) applyBody(cached);
      footText.textContent = cached && !force
        ? "Refreshing list…"
        : (mode === "image"
          ? "Still → Picture tag. Wardrobe plates work well here."
          : mode === "audio" ? "Audio clip → voice reference. Trim its range in the Mix row."
            : "RefMod → Video tag. Search by name if needed.");
      refreshBtn.disabled = true;
      return api.fetchApi(url).then((r) => r.json()).then((body) => {
        applyBody(body);
        footText.textContent = mode === "image"
          ? "Still → Picture tag. Wardrobe plates work well here."
          : mode === "audio" ? "Audio clip → voice reference. Trim its range in the Mix row."
            : "RefMod → Video tag. Search by name if needed.";
      }).catch((e) => {
        if (!items.length) pane.appendChild(el("div", "h3h-pick-empty", e.message || "Could not list."));
        footText.textContent = e.message || "Could not refresh list.";
      }).finally(() => {
        refreshBtn.disabled = false;
      });
    }

    async function loadFolders() {
      if (mode === "image" || mode === "audio") {
        diskFolders = [];
        render();
        return;
      }
      try {
        const response = await api.fetchApi("/h3subjectrefmod/refmod/folders");
        const body = await response.json();
        diskFolders = Array.isArray(body.folders) ? body.folders : [];
      } catch (e) {
        diskFolders = [];
      }
      render();
    }
    newFolderBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const name = window.prompt("New folder name under models/refmods/:");
      if (name == null || !String(name).trim()) return;
      newFolderBtn.disabled = true;
      try {
        const response = await api.fetchApi("/h3subjectrefmod/refmod/mkdir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folder: String(name).trim() }),
        });
        const body = await response.json();
        if (!response.ok || body.error) throw new Error(body.error || "Could not create folder");
        folder = body.folder || String(name).trim();
        await loadFolders();
        setHint(`Folder ready: ${folder}`, false);
      } catch (err) {
        window.alert(err.message || "Could not create folder.");
      } finally {
        newFolderBtn.disabled = false;
      }
    });
    refreshBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      loadList({ force: true });
      loadFolders();
    });
    Promise.all([loadList({ force: true }), loadFolders()]).finally(() => search.focus());
  }

  function renderList() {
    list.innerHTML = "";
    if (!state.mods.length) {
      list.appendChild(el("div", "h3h-empty", "Add a RefMod (identity) or Image (wardrobe plate / guest)."));
      updateMap();
      return;
    }
    state.mods.forEach((row, index) => list.appendChild(renderRow(row, index)));
    updateMap();
  }

  async function loadMixAudioWave(file) {
    if (mixAudioPeaks.has(file)) return mixAudioPeaks.get(file);
    const promise = (async () => {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) throw new Error("Web Audio is unavailable");
      const response = await api.fetchApi(imageView(file));
      if (!response.ok) throw new Error("Could not load audio preview");
      const bytes = await response.arrayBuffer();
      const context = new AudioContextCtor();
      try {
        const buffer = await context.decodeAudioData(bytes.slice(0));
        const count = 180;
        const perBucket = Math.max(1, Math.floor(buffer.length / count));
        const peaks = new Array(count).fill(0);
        for (let i = 0; i < count; i += 1) {
          const from = i * perBucket;
          const to = Math.min(buffer.length, from + perBucket);
          let peak = 0;
          for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
            const samples = buffer.getChannelData(channel);
            for (let j = from; j < to; j += 1) peak = Math.max(peak, Math.abs(samples[j]));
          }
          peaks[i] = peak;
        }
        return { duration: buffer.duration, peaks };
      } finally {
        await context.close();
      }
    })();
    mixAudioPeaks.set(file, promise);
    try {
      const info = await promise;
      mixAudioPeaks.set(file, info);
      return info;
    } catch (error) {
      mixAudioPeaks.delete(file);
      throw error;
    }
  }

  function mixAudioWindow(row, duration) {
    const start = Math.max(0, Math.min(duration, Number(row.voice_audio_start) || 0));
    let end = Number(row.voice_audio_end) > 0 ? Math.min(duration, Number(row.voice_audio_end)) : duration;
    if (end <= start) end = duration;
    return { start, end };
  }

  function mixAudioWave(row) {
    const box = el("div", "h3h-create-wavebox");
    const canvas = document.createElement("canvas");
    canvas.className = "h3h-create-wave";
    canvas.title = "Drag either edge to trim, or drag the selection to move it.";
    const times = el("div", "h3h-create-times");
    const startLabel = el("span");
    const selectedLabel = el("span", "sel");
    const play = el("button", "h3h-btn", "Play");
    const endLabel = el("span");
    stop(canvas); stop(play);
    times.append(play, startLabel, selectedLabel, endLabel);
    box.append(canvas, times);

    let info = null;
    let localPlayer = null;
    let raf = 0;
    const fmt = (value) => {
      const seconds = Math.max(0, Number(value) || 0);
      return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}.${String(Math.floor((seconds % 1) * 10))}`;
    };
    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      const width = rect.width;
      const height = rect.height;
      const duration = info?.duration || 1;
      const win = mixAudioWindow(row, duration);
      const x0 = (win.start / duration) * width;
      const x1 = (win.end / duration) * width;
      ctx.fillStyle = "#101010";
      ctx.fillRect(0, 0, width, height);
      if (info?.peaks) {
        const mid = height / 2;
        const step = width / info.peaks.length;
        info.peaks.forEach((peak, index) => {
          const x = index * step;
          const selected = x >= x0 && x <= x1;
          const h = Math.max(2, peak * (height * 0.86));
          ctx.fillStyle = selected ? "#46b4e6" : "#555";
          ctx.fillRect(x, mid - h / 2, Math.max(1, step * 0.65), h);
        });
      }
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0, 0, x0, height);
      ctx.fillRect(x1, 0, Math.max(0, width - x1), height);
      ctx.strokeStyle = "#d5f2ff";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, height); ctx.moveTo(x1, 0); ctx.lineTo(x1, height); ctx.stroke();
      if (localPlayer?.duration && mixAudioPlayer === localPlayer) {
        const x = (localPlayer.currentTime / localPlayer.duration) * width;
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      startLabel.textContent = fmt(win.start);
      selectedLabel.textContent = fmt(Math.max(0, win.end - win.start));
      endLabel.textContent = fmt(info ? win.end : 0);
    };
    loadMixAudioWave(row.voice_audio_file).then((loaded) => {
      if (!box.isConnected) return;
      info = loaded;
      paint();
    }).catch((error) => {
      if (box.isConnected) selectedLabel.textContent = error.message || "Audio preview unavailable";
    });
    paint();

    play.addEventListener("click", () => {
      if (mixAudioPlayer && !mixAudioPlayer.paused) {
        mixAudioPlayer.pause();
        mixAudioPlayer = null;
        if (mixAudioPlayButton) mixAudioPlayButton.textContent = "Play";
        mixAudioPlayButton = null;
        cancelAnimationFrame(raf);
        paint();
        return;
      }
      if (!info) return;
      if (mixAudioPlayer) mixAudioPlayer.pause();
      if (mixAudioPlayButton) mixAudioPlayButton.textContent = "Play";
      const player = new Audio(imageView(row.voice_audio_file));
      localPlayer = player;
      mixAudioPlayer = player;
      mixAudioPlayButton = play;
      const tick = () => {
        if (mixAudioPlayer !== player) return;
        const win = mixAudioWindow(row, player.duration || info.duration);
        if (!box.isConnected || player.currentTime >= win.end - 0.03) {
          player.pause(); mixAudioPlayer = null; mixAudioPlayButton = null; play.textContent = "Play"; paint(); return;
        }
        paint(); raf = requestAnimationFrame(tick);
      };
      player.addEventListener("loadedmetadata", () => {
        const win = mixAudioWindow(row, player.duration || info.duration);
        player.currentTime = win.start;
        player.play().then(() => { play.textContent = "Stop"; raf = requestAnimationFrame(tick); }).catch(() => {});
      }, { once: true });
      player.addEventListener("ended", () => {
        if (mixAudioPlayer === player) { mixAudioPlayer = null; mixAudioPlayButton = null; play.textContent = "Play"; }
      }, { once: true });
    });

    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !info) return;
      event.preventDefault();
      const bounds = canvas.getBoundingClientRect();
      const duration = info.duration;
      const xOf = (clientX) => Math.max(0, Math.min(duration, ((clientX - bounds.left) / bounds.width) * duration));
      let win = mixAudioWindow(row, duration);
      const x = xOf(event.clientX);
      const edge = duration * (8 / bounds.width);
      const zone = Math.abs(x - win.start) <= edge ? "start"
        : Math.abs(x - win.end) <= edge ? "end"
          : x > win.start && x < win.end ? "move" : "jump";
      const origin = x, originStart = win.start, originEnd = win.end;
      const move = (ev) => {
        const at = xOf(ev.clientX);
        if (zone === "start") win.start = Math.min(at, win.end - 0.1);
        else if (zone === "end") win.end = Math.max(at, win.start + 0.1);
        else if (zone === "move") {
          const span = originEnd - originStart;
          win.start = Math.max(0, Math.min(duration - span, originStart + at - origin));
          win.end = win.start + span;
        } else {
          const span = Math.max(0.1, originEnd - originStart);
          win.start = Math.max(0, Math.min(duration - span, at - span / 2));
          win.end = win.start + span;
        }
        row.voice_audio_start = Math.round(win.start * 100) / 100;
        row.voice_audio_end = Math.round(win.end * 100) / 100;
        paint();
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        commit();
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
    return box;
  }

  function renderRow(row, index) {
    const expanded = row.id === state.active;
    const source = sourceOf(row);
    const concept = conceptOf(row);
    const view = el("div", "h3h-row" + (expanded ? " active" : " compact") + (row.enabled === false ? " off" : ""));
    view.dataset.id = row.id;
    view.dataset.index = String(index);
    const top = el("div", "h3h-line");

    const grip = el("span", "h3h-grip", "⋮⋮");
    grip.title = "Drag to reorder (prompt order)";
    const fold = el("button", "h3h-btn" + (expanded ? " on" : ""), expanded ? "▾" : "▸");
    fold.title = expanded ? "Collapse who / keep / media" : "Expand who / keep / media";
    stop(fold);
    fold.addEventListener("click", () => {
      state.active = expanded ? "" : row.id;
      write();
      renderList();
    });
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = row.enabled !== false;
    stop(check);
    check.addEventListener("change", () => {
      row.enabled = check.checked;
      renderList();
      commit();
    });
    const num = el("span", "h3h-num", String(index + 1).padStart(2, "0"));
    const src = document.createElement("select");
    for (const [value, label] of SOURCES) {
      const option = el("option", null, label);
      option.value = value;
      src.appendChild(option);
    }
    src.value = source;
    stop(src);
    src.addEventListener("change", () => {
      row.source = src.value;
      if (row.source === "image" && conceptOf(row) === "identity") {
        row.concept = "wardrobe";
        row.keep = keepDefault("wardrobe");
      }
      state.active = row.id;
      renderList();
      commit();
    });

    const choose = el(
      "button",
      "h3h-btn h3h-file",
      source === "image"
        ? (row.name && String(row.image || "").startsWith("wardrobe:") ? row.name : imageLabel(row.image))
        : (row.refmod || row.voice_refmod || "Choose RefMod…"),
    );
    stop(choose);
    choose.addEventListener("click", () => {
      state.active = row.id;
      if (source === "image" && concept === "wardrobe") {
        // Wardrobe rows use the clothing catalogue — not Comfy input images.
        const parent = row.wears ? state.mods.find((m) => m.id === row.wears) : null;
        openWardrobe(choose, parent || null, parent ? null : row);
      } else if (source === "image") {
        openPicker(choose, "image", row.image, (item) => {
          row.image = item.path || item.name;
          row.refmod = "";
          if (!row.who) row.who = whoFromName(row.image, "");
          fillFromLibrary(row);
        });
      } else if (concept === "voice") {
        openPicker(choose, "voice", row.voice_refmod, (item) => {
          row.voice_refmod = item.name;
          row.refmod = "";
          row.format = item.format || "";
          row.who = whoFromName(item.name, item.description);
          row.keep = keepDefault("voice");
          fillFromLibrary(row);
        });
      } else {
        openPicker(choose, "refmod", row.refmod, (item) => {
          row.refmod = item.name;
          row.image = "";
          row.concept = item.concept || row.concept;
          row.stack = item.stack || "";
          row.format = item.format || "";
          row.description = item.description || "";
          row.has_looks = !!item.has_looks;
          row.has_preview = !!item.has_preview;
          row.who = whoFromName(item.name, item.description);
          row.keep = String(item.keep || "").trim() || keepDefault(conceptOf(row));
          // Keep an explicitly selected clip; otherwise preserve the legacy auto-pair behavior.
          if (row.voice_mode !== "audio") {
            if (item.has_audio_latent) {
              row.voice_refmod = item.name;
              row.voice_mode = "refmod";
            } else if (item.paired_voice) {
              row.voice_refmod = item.paired_voice;
              row.voice_mode = "refmod";
            } else {
              row.voice_refmod = "";
              if (row.voice_mode === "refmod") row.voice_mode = "none";
            }
          }
          fillFromLibrary(row);
        });
      }
    });

    const strength = document.createElement("input");
    strength.type = "number";
    strength.className = "h3h-str";
    strength.min = "0"; strength.max = "1"; strength.step = "0.05";
    strength.value = String(clampStrength(row.strength));
    strength.disabled = source === "image";
    stop(strength);
    strength.addEventListener("change", () => {
      row.strength = clampStrength(strength.value);
      commit();
    });

    const conceptSel = document.createElement("select");
    for (const [value, label] of CONCEPTS) {
      const option = el("option", null, label);
      option.value = value;
      conceptSel.appendChild(option);
    }
    conceptSel.value = concept;
    stop(conceptSel);
    conceptSel.addEventListener("change", () => {
      row.concept = conceptSel.value;
      row.keep = keepDefault(row.concept);
      state.active = row.id;
      renderList();
      commit();
    });

    const drop = el("button", "h3h-btn h3h-drop", "Drop");
    stop(drop);
    drop.addEventListener("click", () => {
      const id = row.id;
      state.mods = state.mods.filter((item) => item.id !== id && item.wears !== id);
      if (state.active === id) state.active = "";
      renderList();
      commit();
    });

    // Ref2VA-style: grip left, expand caret on the right before Drop
    top.append(grip, check, num, src, choose);
    if (source === "refmod") top.append(el("span", "h3h-mini", "str"), strength);
    top.append(conceptSel);
    const fmt = String(row.format || (globalThis.__h3RefmodCatalog?.items || []).find((item) => item.name === (row.refmod || row.voice_refmod))?.format || "");
    if (source === "refmod" && fmt) top.appendChild(el("span", "h3h-tag", fmt));
    if (row.stack) top.appendChild(el("span", "h3h-tag", row.stack));
    if (visionBusy && visionKind === "describe" && describingId === row.id) {
      const badge = el("span", "h3h-live", "Describing " + visionClock());
      badge.dataset.live = row.id;
      top.appendChild(badge);
    }
    top.append(fold, drop);
    view.appendChild(top);

    if (!expanded) {
      const snipBits = [];
      if (row.who) snipBits.push(row.who);
      const tied = tiedOutfits(state, row.id);
      if (tied.length) snipBits.push("outfit: " + (tied[0].name || tied[0].who || "set"));
      if (snipBits.length) view.appendChild(el("div", "h3h-who-snip", snipBits.join(" · ")));
      if (isCharacterRow(row) && concept !== "wardrobe" && tied.length) {
        const quick = el("div", "h3h-line");
        const change = el("button", "h3h-btn", "Change outfit");
        stop(change);
        change.title = "Pick another clothing set for this character";
        change.addEventListener("click", () => {
          state.active = row.id;
          openWardrobe(change, row);
        });
        quick.appendChild(change);
        view.appendChild(quick);
      }
    } else {
      if (source === "image" && row.image) {
        const media = el("div", "h3h-line");
        const thumb = document.createElement("img");
        thumb.className = "h3h-thumb";
        thumb.alt = "";
        thumb.loading = "lazy";
        thumb.src = imageView(row.image);
        thumb.style.cursor = concept === "wardrobe" ? "pointer" : "";
        thumb.title = concept === "wardrobe" ? "Click to change outfit" : "";
        thumb.addEventListener("error", () => {
          thumb.replaceWith(el("div", "h3h-note", "Preview failed: " + row.image));
        });
        if (concept === "wardrobe") {
          thumb.addEventListener("click", () => {
            const parent = row.wears ? state.mods.find((m) => m.id === row.wears) : null;
            openWardrobe(thumb, parent || null, parent ? null : row);
          });
        }
        media.appendChild(thumb);
        view.appendChild(media);
      } else if (source === "refmod" && row.refmod && concept !== "voice") {
        const media = el("div", "h3h-line");
        const thumb = document.createElement("img");
        thumb.className = "h3h-thumb";
        thumb.alt = "";
        const primary = row.has_preview ? refmodPreview(row.refmod) : refmodThumb(row.refmod);
        const fallback = row.has_preview ? refmodThumb(row.refmod) : refmodPreview(row.refmod);
        thumb.src = primary + "&t=" + Date.now();
        thumb.addEventListener("error", () => {
          if (thumb.dataset.fell) { thumb.remove(); return; }
          thumb.dataset.fell = "1";
          thumb.src = fallback + "&t=" + Date.now();
        });
        media.appendChild(thumb);
        view.appendChild(media);
        if (!row.has_preview) {
          api.fetchApi("/h3subjectrefmod/refmod/ensure_preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: row.refmod }),
          }).then(async (response) => {
            let body = {};
            try { body = await response.json(); } catch (e) { body = {}; }
            if (!body.has_preview || !view.isConnected) return;
            row.has_preview = true;
            thumb.src = refmodPreview(row.refmod) + "&t=" + Date.now();
            write();
          }).catch(() => {});
        }
      }

      const acts = el("div", "h3h-line");
      const canDescribe = (source === "refmod" && row.refmod) || (source === "image" && row.image);
      if (canDescribe) {
        const describing = visionBusy && visionKind === "describe" && describingId === row.id;
        const describe = el(
          "button",
          "h3h-btn" + (describing ? " busy" : ""),
          describing ? "Describing " + visionClock() : "Describe",
        );
        describe.dataset.describe = row.id;
        stop(describe);
        describe.disabled = visionBusy;
        describe.addEventListener("click", () => describeRow(row));
        acts.appendChild(describe);
      }
      if (source === "refmod" && row.refmod) {
        const looksBtn = el("button", "h3h-btn", "Looks");
        looksBtn.title = "Show every stored still in this RefMod";
        stop(looksBtn);
        looksBtn.addEventListener("click", () => openLooksGallery(row.refmod));
        acts.appendChild(looksBtn);
        const saveMeta = el("button", "h3h-btn", "Save to RefMod");
        stop(saveMeta);
        saveMeta.title = "Write who + keep. Voice stays a separate pick — not written into the file.";
        saveMeta.disabled = !row.refmod || !String(row.who || "").trim();
        saveMeta.addEventListener("click", () => saveRow(row));
        acts.appendChild(saveMeta);
      }
      if (source === "image" && row.image) {
        const saveLib = el("button", "h3h-btn", "Save who/keep");
        stop(saveLib);
        saveLib.disabled = !String(row.who || "").trim();
        saveLib.addEventListener("click", () => saveToLibrary(row));
        acts.appendChild(saveLib);
      }
      if (concept === "wardrobe" && source === "image" && row.image) {
        const saveList = el("button", "h3h-btn", "Save to list");
        stop(saveList);
        saveList.title = "Write the outfit paragraph into the pack wardrobe catalogue";
        saveList.disabled = !String(row.desc || row.who || "").trim();
        saveList.addEventListener("click", () => saveWardrobeToList(row));
        acts.appendChild(saveList);
      }
      if (isCharacterRow(row) && concept !== "wardrobe") {
        const tied = tiedOutfits(state, row.id);
        const clothBtn = el("button", "h3h-btn", tied.length ? "Change outfit" : "Add clothing");
        stop(clothBtn);
        clothBtn.title = tied.length
          ? "Pick another clothing set for this character"
          : "Tie a wardrobe set to this character";
        clothBtn.addEventListener("click", () => openWardrobe(clothBtn, row));
        acts.appendChild(clothBtn);
        if (tied.length) {
          const clearCloth = el("button", "h3h-btn", "Clear clothing");
          stop(clearCloth);
          clearCloth.addEventListener("click", () => {
            clearTiedClothing(row);
            renderList();
            commit();
          });
          acts.appendChild(clearCloth);
        }
      }
      if (acts.childNodes.length) view.appendChild(acts);

      const draft = describeDraft.get(row.id);
      if (draft) {
        const draftBox = el("div", "h3h-sec");
        draftBox.appendChild(el("div", "h3h-lbl", "describe draft"));
        const pre = el("pre", "h3h-preview", [draft.who, draft.keep].filter(Boolean).join("\n"));
        const draftActs = el("div", "h3h-line");
        const approve = el("button", "h3h-btn", "Approve");
        const discard = el("button", "h3h-btn", "Discard");
        stop(approve); stop(discard);
        approve.addEventListener("click", () => {
          row.who = draft.who || row.who;
          row.keep = draft.keep || row.keep;
          if (concept === "wardrobe") {
            row.desc = draft.desc || draft.who || row.desc;
          }
          describeDraft.delete(row.id);
          visionNote.set(row.id, "Approved describe. Use Save to list to update the catalogue.");
          saveToLibrary(row);
          renderList();
          commit();
        });
        discard.addEventListener("click", () => {
          describeDraft.delete(row.id);
          renderList();
        });
        draftActs.append(approve, discard);
        draftBox.append(pre, draftActs);
        view.appendChild(draftBox);
      }

      const tied = tiedOutfits(state, row.id);
      if (tied.length && isCharacterRow(row)) {
        const outfitLine = el("div", "h3h-line");
        outfitLine.appendChild(el("span", "h3h-mini", "outfit"));
        outfitLine.appendChild(el("span", "h3h-tag", tied[0].name || tied[0].who || "set"));
        const changeOutfit = el("button", "h3h-btn", "Change");
        stop(changeOutfit);
        changeOutfit.title = "Pick another clothing set";
        changeOutfit.addEventListener("click", () => openWardrobe(changeOutfit, row));
        outfitLine.appendChild(changeOutfit);
        view.appendChild(outfitLine);
      }

      const whoLine = el("div", "h3h-line");
      whoLine.appendChild(el("span", "h3h-mini", "who"));
      const who = document.createElement("input");
      who.type = "text";
      who.className = "h3h-grow";
      who.value = row.who || "";
      stop(who);
      who.addEventListener("input", () => { row.who = who.value; write(); schedule(); });
      whoLine.appendChild(who);
      view.appendChild(whoLine);

      if (concept === "wardrobe") {
        const descLine = el("div", "h3h-sec");
        descLine.appendChild(el("div", "h3h-lbl", "outfit paragraph"));
        const descBox = document.createElement("textarea");
        descBox.rows = 3;
        descBox.placeholder = "Full clothing paragraph saved to the catalogue list";
        descBox.value = row.desc || "";
        stop(descBox);
        descBox.addEventListener("input", () => { row.desc = descBox.value; write(); });
        descLine.appendChild(descBox);
        view.appendChild(descLine);
      }

      const keepLine = el("div", "h3h-line");
      keepLine.appendChild(el("span", "h3h-mini", "keep"));
      const keep = document.createElement("input");
      keep.type = "text";
      keep.className = "h3h-grow";
      keep.value = row.keep || "";
      stop(keep);
      keep.addEventListener("input", () => { row.keep = keep.value; write(); schedule(); });
      const marker = document.createElement("select");
      for (const value of PICTURE_MARKERS) {
        const option = el("option", null, value);
        option.value = value;
        marker.appendChild(option);
      }
      marker.value = row.marker || "fully_preserved";
      stop(marker);
      marker.addEventListener("change", () => { row.marker = marker.value; commit(); });
      keepLine.append(keep, marker);
      view.appendChild(keepLine);

      if (concept !== "voice") {
        const voiceMode = row.voice_mode || (row.voice_refmod ? "refmod" : row.voice_audio_file ? "audio" : "none");
        const voiceLine = el("div", "h3h-line");
        voiceLine.appendChild(el("span", "h3h-mini", "voice source"));
        const voiceModeSel = document.createElement("select");
        for (const [value, label] of [["none", "None"], ["refmod", "Voice RefMod"], ["audio", "Audio clip"]]) {
          const option = el("option", null, label);
          option.value = value;
          voiceModeSel.appendChild(option);
        }
        voiceModeSel.value = voiceMode;
        stop(voiceModeSel);
        voiceModeSel.addEventListener("change", () => {
          row.voice_mode = voiceModeSel.value;
          row.voice_refmod = "";
          row.voice_audio_file = "";
          row.voice_audio_start = 0;
          row.voice_audio_end = 0;
          renderList();
          commit();
        });
        voiceLine.appendChild(voiceModeSel);
        if (voiceMode === "refmod") {
          const voiceBtn = el("button", "h3h-btn h3h-file", row.voice_refmod || "Choose voice RefMod…");
          stop(voiceBtn);
          voiceBtn.addEventListener("click", () => {
            openPicker(voiceBtn, "voice", row.voice_refmod, (item) => {
              row.voice_refmod = item.name;
              row.voice_mode = "refmod";
              row.voice_audio_file = "";
            });
          });
          const clearVoice = el("button", "h3h-btn", "Clear");
          stop(clearVoice);
          clearVoice.addEventListener("click", () => {
            row.voice_refmod = "";
            row.voice_mode = "none";
            renderList();
            commit();
          });
          voiceLine.append(voiceBtn, clearVoice);
        } else if (voiceMode === "audio") {
          const audioLine = el("div", "h3h-line");
          const audioBtn = el("button", "h3h-btn h3h-file", row.voice_audio_file || "Choose audio clip…");
          const uploadBtn = el("button", "h3h-btn", "Upload");
          const upload = document.createElement("input");
          upload.type = "file";
          upload.accept = "audio/*,.wav,.mp3,.flac,.ogg,.m4a,.aac,.opus";
          upload.style.display = "none";
          stop(audioBtn); stop(uploadBtn); stop(upload);
          audioBtn.addEventListener("click", () => {
            openPicker(audioBtn, "audio", row.voice_audio_file, (item) => {
              row.voice_audio_file = item.path || item.name;
              row.voice_audio_start = 0;
              row.voice_audio_end = 0;
              row.voice_mode = "audio";
            });
          });
          uploadBtn.addEventListener("click", () => upload.click());
          upload.addEventListener("change", async () => {
            const picked = upload.files?.[0];
            upload.value = "";
            if (!picked) return;
            const form = new FormData();
            form.append("image", picked);
            form.append("overwrite", "true");
            form.append("type", "input");
            uploadBtn.disabled = true;
            try {
              const response = await api.fetchApi("/upload/image", { method: "POST", body: form });
              const payload = await response.json();
              if (!response.ok || !payload.name) throw new Error(payload.error || "Upload failed");
              row.voice_audio_file = payload.subfolder ? `${payload.subfolder}/${payload.name}` : payload.name;
              row.voice_audio_start = 0;
              row.voice_audio_end = 0;
              row.voice_mode = "audio";
              mixAudioPeaks.delete(row.voice_audio_file);
              audioCache = null;
              renderList();
              commit();
            } catch (error) {
              window.alert(error.message || "Couldn't upload that audio.");
              uploadBtn.disabled = false;
            }
          });
          audioLine.append(audioBtn, uploadBtn, upload);
          const clearAudio = el("button", "h3h-btn", "Clear");
          stop(clearAudio);
          clearAudio.addEventListener("click", () => {
            row.voice_audio_file = "";
            row.voice_audio_start = 0;
            row.voice_audio_end = 0;
            row.voice_mode = "none";
            renderList();
            commit();
          });
          audioLine.appendChild(clearAudio);
          view.appendChild(voiceLine);
          view.appendChild(audioLine);
          if (row.voice_audio_file) view.appendChild(mixAudioWave(row));
        } else {
          voiceLine.appendChild(el("span", "h3h-mini", "No voice reference attached."));
        }
        if (voiceMode !== "audio") view.appendChild(voiceLine);
      }
      const note = visionNote.get(row.id);
      if (note) view.appendChild(el("div", "h3h-note", note));
    }

    view.addEventListener("pointerdown", (e) => {
      if (e.target.closest("input, select, button, textarea, .h3h-grip")) return;
      if (state.active === row.id) return;
      state.active = row.id;
      write();
      renderList();
    });

    let dragFrom = null;
    grip.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      dragFrom = index;
      view.classList.add("dragging");
      const onMove = (me) => {
        const over = document.elementFromPoint(me.clientX, me.clientY)?.closest?.(".h3h-row");
        if (!over || over === view) return;
        const to = Number(over.dataset.index);
        if (!Number.isFinite(to) || to === dragFrom) return;
        const [moved] = state.mods.splice(dragFrom, 1);
        state.mods.splice(to, 0, moved);
        dragFrom = to;
        renderList();
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        view.classList.remove("dragging");
        commit();
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });

    return view;
  }

  function loaderSettings() {
    const index = node.inputs?.findIndex((input) => input && input.name === "llm");
    if (index == null || index < 0) return null;
    const linkId = node.inputs[index].link;
    const links = app.graph?.links;
    const link = links && (typeof links.get === "function" ? links.get(linkId) : links[linkId]);
    const origin = link && (Array.isArray(link) ? link[1] : link.origin_id);
    const source = origin == null ? null : app.graph.getNodeById(origin);
    if (!source) return null;
    const widget = (name) => source.widgets?.find((item) => item.name === name);
    const backend = String(widget("backend")?.value || "GGUF").toLowerCase();
    const model = widget("model_name");
    if (backend !== "http" && !model?.value) return null;
    return {
      backend,
      model_name: model?.value || "",
      mmproj_name: widget("mmproj_name")?.value || "none",
      n_ctx: Number(widget("n_ctx")?.value) || 16384,
      n_gpu_layers: widget("n_gpu_layers") ? Number(widget("n_gpu_layers").value) : -1,
      keep_loaded: !!widget("keep_loaded")?.value,
      diagnostics: !!widget("diagnostics")?.value,
      base_url: widget("base_url")?.value || "http://localhost:1234/v1",
      model: widget("model")?.value || "local",
      api_key: widget("api_key")?.value || "none",
    };
  }

  async function askVision(payload) {
    const loader = loaderSettings();
    if (!loader) throw new Error("Connect LLM (GGUF) - Loader to the llm input.");
    const diagnosticId = loader.diagnostics
      ? (globalThis.crypto?.randomUUID?.() || `hs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)
      : "";
    const request = Object.assign({ loader }, payload);
    if (diagnosticId) request.diagnostic_id = diagnosticId;
    try {
      const response = await api.fetchApi("/h3subjecthybrid/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      let body = {};
      try { body = await response.json(); } catch (e) { body = {}; }
      if (!response.ok || body.error) throw new Error(body.error || "Writer failed.");
      return body;
    } catch (error) {
      const message = error?.message || "Writer failed.";
      if (diagnosticId && !message.includes(diagnosticId)) {
        throw new Error(`${message} (Hot Swap diagnostic ID: ${diagnosticId})`);
      }
      throw error;
    }
  }

  async function describeRow(row) {
    const source = sourceOf(row);
    const imageRef = source === "image"
      ? row.image
      : (row.refmod ? "refmod:" + row.refmod : "");
    if (visionBusy || !imageRef) return;
    visionBusy = true;
    startVisionClock("describe", row.id);
    setHint("Describing…", true);
    renderList();
    try {
      const body = await askVision({
        job: "describe",
        image: imageRef,
        concept: conceptOf(row),
      });
      describeDraft.set(row.id, {
        who: body.who || "",
        keep: body.keep || "",
        desc: body.desc || body.who || "",
        note: body.note || "",
      });
      visionNote.set(row.id, body.note || "Describe ready — Approve to apply.");
      setHint("Describe ready — Approve to apply.", false);
    } catch (e) {
      visionNote.set(row.id, e.message || "Describe failed.");
      setHint(e.message || "Describe failed.", true);
    } finally {
      finishVision();
      renderList();
    }
  }

  async function saveWardrobeToList(row) {
    const raw = String(row.image || "");
    if (!raw.startsWith("wardrobe:")) {
      setHint("Save to list needs a wardrobe: catalogue image (use + Clothing / Add set).", true);
      return;
    }
    const photo = raw.slice("wardrobe:".length);
    const desc = String(row.desc || row.who || "").trim();
    if (!desc) return;
    try {
      const response = await api.fetchApi("/h3subjecthybrid/wardrobe/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo, name: row.name || "", desc }),
      });
      const body = await response.json();
      if (!response.ok || body.error) throw new Error(body.error || "Update failed");
      wardrobeCache = null;
      if (body.item?.desc) row.desc = body.item.desc;
      visionNote.set(row.id, "Outfit paragraph saved to the clothing catalogue.");
      setHint("Saved to clothing list.", false);
      renderList();
      write();
    } catch (e) {
      setHint(e.message || "Save to list failed.", true);
    }
  }

  async function saveRow(row) {
    const who = String(row.who || "").trim();
    if (!row.refmod || !who) return;
    try {
      const body = await askVision({
        job: "save_description",
        name: row.refmod,
        description: who,
        keep: String(row.keep || "").trim(),
        concept: conceptOf(row),
      });
      if (body.keep) row.keep = body.keep;
      const note = "Saved who + keep into the RefMod file.";
      visionNote.set(row.id, note);
      setHint(note, false);
      catalogCache = null;
      renderList();
      write();
    } catch (e) {
      setHint(e.message || "Save failed.", true);
    }
  }

  function closeDraft() {
    draftResult = null;
    draftView.style.display = "none";
    draftActs.style.display = "none";
    draftView.classList.remove("draft-ready");
    draftView.textContent = "";
  }
  discardBtn.addEventListener("click", closeDraft);
  acceptBtn.addEventListener("click", () => {
    if (!draftResult?.detailed) return;
    putBox("summary", draftResult.summary || "");
    putBox("opening", draftResult.opening || "");
    putBox("detailed", draftResult.detailed || "");
    putBox("soundscape", draftResult.soundscape || "room tone");
    closeDraft();
    ensureUi(state).promptOpen = true;
    paintPromptHead();
    commit();
  });
  draftBtn.addEventListener("click", async () => {
    if (visionBusy) return;
    if (!String(state.idea || "").trim()) {
      setHint("Write the draft first.", true);
      return;
    }
    if (!loaderSettings()) {
      setHint("Connect LLM (GGUF) - Loader to llm.", true);
      return;
    }
    visionBusy = true;
    draftBtn.disabled = true;
    draftBtn.classList.add("busy");
    draftLive.style.display = "";
    startVisionClock("draft");
    setHint("Drafting…", true);
    closeDraft();
    try {
      const body = await askVision({
        job: "draft",
        state,
        length: Number(node._h3hsFrames) || Number(node.widgets?.find((w) => w.name === "length")?.value) || 124,
      });
      draftResult = body;
      showDraft([
        "summary:", body.summary || "", "",
        "opening:", body.opening || "", "",
        "detailed:", body.detailed || "", "",
        "overall_soundscape:", body.soundscape || "room tone",
      ].join("\n"));
      setHint("Draft ready. Accept or discard.", false);
    } catch (e) {
      setHint(e.message || "Draft failed.", true);
    } finally {
      finishVision();
      draftBtn.disabled = false;
      draftBtn.classList.remove("busy");
      draftBtn.textContent = "Draft";
      draftLive.textContent = "";
      draftLive.style.display = "none";
    }
  });

  async function openLooksGallery(name) {
    const clean = String(name || "").trim();
    if (!clean) {
      setHint("Pick a RefMod first.", true);
      return;
    }
    document.querySelectorAll(".h3h-looks").forEach((node) => node.remove());
    const shell = el("div", "h3h-looks");
    const panel = el("div", "h3h-looks-panel");
    stop(panel);
    const head = el("div", "h3h-line");
    head.appendChild(el("span", "h3h-lbl", "Looks · " + clean));
    const close = el("button", "h3h-btn", "Close");
    stop(close);
    head.appendChild(close);
    const grid = el("div", "h3h-looks-grid");
    const status = el("div", "h3h-looks-empty", "Loading pictures… older RefMods decode once from the latent, then cache.");
    panel.append(head, status, grid);
    shell.appendChild(panel);
    document.body.appendChild(shell);
    function dismiss() {
      shell.remove();
      document.removeEventListener("keydown", onKey, true);
    }
    function onKey(e) {
      if (e.key === "Escape") dismiss();
    }
    close.addEventListener("click", dismiss);
    shell.addEventListener("pointerdown", (e) => {
      if (e.target === shell) dismiss();
    });
    document.addEventListener("keydown", onKey, true);
    try {
      const response = await api.fetchApi(
        "/h3subjectrefmod/refmod/looks?name=" + encodeURIComponent(clean),
      );
      const body = await response.json();
      if (!response.ok || body.error) throw new Error(body.error || "Could not list looks.");
      const items = body.items || [];
      status.remove();
      if (!items.length) {
        panel.appendChild(el("div", "h3h-looks-empty", body.note || "No stored pictures in this RefMod."));
        return;
      }
      let cover = body.cover || { member: 0, frame: 0 };
      const cards = [];
      function paintCover() {
        for (const entry of cards) {
          const isCover = Number(entry.item.member) === Number(cover.member)
            && Number(entry.item.frame) === Number(cover.frame);
          entry.card.classList.toggle("cover", isCover);
          entry.btn.textContent = isCover ? "Cover ✓" : "Set cover";
          entry.btn.disabled = isCover;
        }
      }
      async function chooseCover(item, btn) {
        btn.disabled = true;
        btn.textContent = "Saving…";
        try {
          const res = await api.fetchApi("/h3subjectrefmod/refmod/cover", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: clean, member: item.member, frame: item.frame }),
          });
          const out = await res.json();
          if (!res.ok || out.error) throw new Error(out.error || "Could not set cover.");
          cover = { member: out.member, frame: out.frame };
          paintCover();
          // The row thumb and picker card read .preview.jpg — repaint so they pick it up.
          for (const mod of state.mods || []) {
            if (mod.refmod === clean) mod.has_preview = true;
          }
          if (catalogCache?.items) {
            for (const row of catalogCache.items) {
              if (row.name === clean) row.has_preview = true;
            }
          }
          renderList();
          setHint(`Cover for ${clean} set to look ${item.label}. Describe reads this picture.`);
        } catch (e) {
          btn.disabled = false;
          btn.textContent = "Set cover";
          setHint(e.message || "Could not set cover.", true);
        }
      }
      for (const item of items) {
        const card = el("div", "h3h-looks-card");
        const img = document.createElement("img");
        img.alt = item.label || "";
        img.loading = "lazy";
        img.src = refmodThumb(clean, item.member, item.frame) + "&t=" + Date.now();
        img.addEventListener("error", () => {
          img.replaceWith(el("div", "h3h-looks-empty", "missing"));
        });
        img.addEventListener("click", () => {
          window.open(img.src, "_blank");
        });
        const foot = el("div", "h3h-looks-foot");
        const btn = el("button", "h3h-btn", "Set cover");
        btn.title = "Use this look as the thumbnail and the picture Describe sees";
        stop(btn);
        btn.addEventListener("click", () => chooseCover(item, btn));
        foot.append(el("span", null, item.label || ""), btn);
        card.append(img, foot);
        cards.push({ item, card, btn });
        grid.appendChild(card);
      }
      paintCover();
      if (body.decoded) {
        const note = el("div", "h3h-looks-note",
          `${items.length} picture${items.length === 1 ? "" : "s"} decoded from the stored latent (older RefMod) — cached under models/refmods/.h3looks.`);
        if (body.note) note.textContent += " " + body.note;
        panel.appendChild(note);
      }
    } catch (e) {
      status.textContent = e.message || "Could not load looks.";
    }
  }

  function openCreatePanel(targetRow) {
    document.querySelectorAll(".h3h-create, .h3h-pick-blanket").forEach((node) => node.remove());
    const blanket = el("div", "h3h-pick-blanket");
    const panel = el("div", "h3h-create");
    stop(panel);
    const head = el("div", "h3h-line");
    head.appendChild(el("span", "h3h-lbl", "Create RefMod"));
    const close = el("button", "h3h-btn", "Close");
    stop(close);
    head.appendChild(close);

    let kind = "visual";
    let photoFiles = [];
    let audioFile = null;
    const kindLine = el("div", "h3h-line");
    const kindBtns = {};
    for (const [key, label] of [["visual", "Visual"], ["audio", "Audio"], ["both", "Both"]]) {
      const button = el("button", "h3h-btn" + (key === kind ? " on" : ""), label);
      button.dataset.kind = key;
      stop(button);
      button.addEventListener("click", () => {
        kind = key;
        Object.values(kindBtns).forEach((b) => b.classList.toggle("on", b.dataset.kind === kind));
        paintKind();
      });
      kindBtns[key] = button;
      kindLine.appendChild(button);
    }

    const isMedia = (file) => /\.(png|jpe?g|webp|bmp|gif|mp4|webm|mov|mkv|avi|m4v)$/i.test(file.name || "")
      || (file.type || "").startsWith("image/") || (file.type || "").startsWith("video/");
    const isAudio = (file) => /\.(wav|mp3|flac|ogg|m4a|aac)$/i.test(file.name || "")
      || (file.type || "").startsWith("audio/");

    const photoInput = document.createElement("input");
    photoInput.type = "file";
    photoInput.accept = "image/*,video/*,.png,.jpg,.jpeg,.webp,.bmp,.gif,.mp4,.webm,.mov,.mkv,.avi,.m4v";
    photoInput.multiple = true;
    photoInput.style.display = "none";
    const audioFileInput = document.createElement("input");
    audioFileInput.type = "file";
    audioFileInput.accept = "audio/*,.wav,.mp3,.flac,.ogg,.m4a,.aac";
    audioFileInput.style.display = "none";

    const drop = el("div", "h3h-create-drop", "Drop photos here, or click to multi-select\n(~4 angles — not a dozen)");
    stop(drop);
    const thumbs = el("div", "h3h-create-thumbs");
    const photoCount = el("div", "h3h-mini", "");
    const photoLab = el("div", "h3h-lbl", "photos");
    const photoBlock = el("div", null);
    photoBlock.append(photoLab, drop, thumbs, photoCount);

    const audioLab = el("div", "h3h-lbl", "voice");
    const audioRow = el("div", "h3h-create-audio-row");
    const audioPick = el("button", "h3h-btn", "Add voice…");
    stop(audioPick);
    const audioName = el("span", "h3h-create-audio-name", "No voice file");
    const audioClear = el("button", "h3h-btn", "Clear");
    stop(audioClear);
    audioClear.style.display = "none";
    audioRow.append(audioPick, audioName, audioClear);
    const audioBlock = el("div", null);
    audioBlock.append(audioLab, audioRow);
    const audioWaveBox = el("div", "h3h-create-wavebox");
    audioWaveBox.style.display = "none";
    const audioWave = document.createElement("canvas");
    audioWave.className = "h3h-create-wave";
    audioWave.title = "Drag either edge to trim. Drag the middle to slide the selection.";
    stop(audioWave);
    const audioTimes = el("div", "h3h-create-times");
    const audioStartLabel = el("span", null, "0:00.0");
    const audioSelectionLabel = el("span", "sel", "0:00.0 selected");
    const audioPlay = el("button", "h3h-btn", "Play");
    stop(audioPlay);
    const audioEndLabel = el("span", null, "0:00.0");
    audioTimes.append(audioPlay, audioStartLabel, audioSelectionLabel, audioEndLabel);
    audioWaveBox.append(audioWave, audioTimes);
    audioBlock.appendChild(audioWaveBox);

    let audioPreviewUrl = "";
    let audioDuration = 0;
    let audioPeaks = null;
    let audioStart = 0;
    let audioEnd = 0;
    let audioPreviewPlayer = null;
    let audioPreviewFrame = 0;
    let audioDecodeGeneration = 0;

    function createAudioWindow() {
      const duration = audioDuration || 1;
      const start = Math.max(0, Number(audioStart) || 0);
      let end = Number(audioEnd) || 0;
      if (!(end > start)) end = duration;
      end = Math.min(duration, Math.max(start, end));
      return { start: Math.min(start, Math.max(0, end - 0.05)), end };
    }

    function formatCreateAudioTime(seconds) {
      const value = Math.max(0, Number(seconds) || 0);
      const minutes = Math.floor(value / 60);
      return minutes + ":" + (value - minutes * 60).toFixed(1).padStart(4, "0");
    }

    function paintCreateAudioWave() {
      const cssWidth = audioWave.clientWidth || 1;
      const cssHeight = audioWave.clientHeight || 64;
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(cssWidth * dpr));
      const height = Math.max(1, Math.round(cssHeight * dpr));
      if (audioWave.width !== width) audioWave.width = width;
      if (audioWave.height !== height) audioWave.height = height;
      const ctx = audioWave.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      const win = createAudioWindow();
      const from = audioDuration ? win.start / audioDuration : 0;
      const to = audioDuration ? win.end / audioDuration : 1;
      const x0 = from * cssWidth;
      const x1 = to * cssWidth;
      if (audioPeaks) {
        ctx.fillStyle = "rgba(70,180,230,0.12)";
        ctx.fillRect(x0, 0, Math.max(0, x1 - x0), cssHeight);
        const bandWidth = cssWidth / audioPeaks.length;
        const mid = cssHeight / 2;
        for (let i = 0; i < audioPeaks.length; i++) {
          const x = i * bandWidth;
          const selected = x + bandWidth / 2 >= x0 && x + bandWidth / 2 <= x1;
          ctx.fillStyle = selected ? "#46b4e6" : "#5a5a5a";
          const barHeight = Math.max(1, audioPeaks[i] * (cssHeight - 6));
          ctx.fillRect(x + bandWidth * 0.15, mid - barHeight / 2, Math.max(0.7, bandWidth * 0.7), barHeight);
        }
      }
      for (const x of [x0, x1]) {
        ctx.fillStyle = "#46b4e6";
        ctx.fillRect(Math.max(0, Math.min(cssWidth - 3, x - 1.5)), 0, 3, cssHeight);
        ctx.fillStyle = "#fff";
        ctx.fillRect(Math.max(0, Math.min(cssWidth - 5, x - 2.5)), cssHeight * 0.36, 5, cssHeight * 0.28);
      }
      if (audioPreviewPlayer && audioDuration) {
        const playAt = audioPreviewPlayer.currentTime / audioDuration;
        const playX = playAt * cssWidth;
        ctx.fillStyle = "#fff";
        ctx.fillRect(Math.max(0, Math.min(cssWidth - 2, playX - 1)), 0, 2, cssHeight);
      }
      audioStartLabel.textContent = formatCreateAudioTime(win.start);
      audioSelectionLabel.textContent = formatCreateAudioTime(Math.max(0, win.end - win.start)) + " selected";
      audioEndLabel.textContent = formatCreateAudioTime(audioDuration ? win.end : 0);
    }

    function stopCreateAudioPreview() {
      if (audioPreviewFrame) {
        cancelAnimationFrame(audioPreviewFrame);
        audioPreviewFrame = 0;
      }
      if (audioPreviewPlayer) {
        try { audioPreviewPlayer.pause(); } catch (e) { /* already stopped */ }
        audioPreviewPlayer = null;
      }
      audioPlay.textContent = "Play";
      paintCreateAudioWave();
    }

    function clearAudioPreview() {
      audioDecodeGeneration += 1;
      stopCreateAudioPreview();
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      audioPreviewUrl = "";
      audioDuration = 0;
      audioPeaks = null;
      audioStart = 0;
      audioEnd = 0;
      audioWaveBox.style.display = "none";
      paintCreateAudioWave();
    }

    async function loadCreateAudioWave(file) {
      const generation = ++audioDecodeGeneration;
      audioWaveBox.style.display = "";
      audioPeaks = null;
      audioDuration = 0;
      paintCreateAudioWave();
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      let context;
      try {
        context = new AudioContextCtor();
        const buffer = await context.decodeAudioData(await file.arrayBuffer());
        if (generation !== audioDecodeGeneration || !audioWaveBox.isConnected) return;
        audioDuration = buffer.duration || 0;
        const buckets = 240;
        const peaks = new Float32Array(buckets);
        const channels = Math.min(buffer.numberOfChannels, 2);
        const perBucket = buffer.length / buckets;
        for (let channel = 0; channel < channels; channel++) {
          const samples = buffer.getChannelData(channel);
          for (let i = 0; i < buckets; i++) {
            const from = Math.floor(i * perBucket);
            const to = Math.min(samples.length, Math.floor((i + 1) * perBucket));
            const stride = Math.max(1, Math.floor((to - from) / 400));
            let peak = 0;
            for (let j = from; j < to; j += stride) peak = Math.max(peak, Math.abs(samples[j]));
            peaks[i] = Math.max(peaks[i], peak);
          }
        }
        let max = 0;
        for (const peak of peaks) max = Math.max(max, peak);
        if (max > 0.0001) for (let i = 0; i < buckets; i++) peaks[i] /= max;
        audioPeaks = peaks;
        paintCreateAudioWave();
      } catch (e) {
        status.textContent = "Waveform preview unavailable; the full file can still be encoded.";
      } finally {
        try { await context?.close(); } catch (e) { /* decoded buffer is independent */ }
      }
    }

    audioPlay.addEventListener("click", () => {
      if (audioPreviewPlayer && !audioPreviewPlayer.paused) {
        stopCreateAudioPreview();
        return;
      }
      if (!audioPreviewUrl) return;
      stopCreateAudioPreview();
      const player = new Audio(audioPreviewUrl);
      audioPreviewPlayer = player;
      const tick = () => {
        if (audioPreviewPlayer !== player) return;
        const win = createAudioWindow();
        if (!audioWaveBox.isConnected || player.currentTime >= win.end - 0.03) {
          stopCreateAudioPreview();
          return;
        }
        paintCreateAudioWave();
        audioPreviewFrame = requestAnimationFrame(tick);
      };
      player.addEventListener("loadedmetadata", () => {
        if (audioPreviewPlayer !== player) return;
        const win = createAudioWindow();
        try { player.currentTime = win.start; } catch (e) { /* not seekable yet */ }
        player.play().then(() => {
          if (audioPreviewPlayer !== player) return;
          audioPlay.textContent = "Stop";
          audioPreviewFrame = requestAnimationFrame(tick);
        }).catch(() => stopCreateAudioPreview());
      }, { once: true });
      player.addEventListener("ended", () => {
        if (audioPreviewPlayer === player) stopCreateAudioPreview();
      }, { once: true });
    });

    audioWave.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !audioDuration) return;
      e.preventDefault();
      e.stopPropagation();
      const bounds = audioWave.getBoundingClientRect();
      const xOf = (clientX) => Math.max(0, Math.min(audioDuration, ((clientX - bounds.left) / bounds.width) * audioDuration));
      let win = createAudioWindow();
      const x = xOf(e.clientX);
      let zone = "jump";
      if (Math.abs(x - win.start) <= audioDuration * (8 / bounds.width)) zone = "start";
      else if (Math.abs(x - win.end) <= audioDuration * (8 / bounds.width)) zone = "end";
      else if (x > win.start && x < win.end) zone = "move";
      const origin = x;
      const originStart = win.start;
      const originEnd = win.end;
      const move = (ev) => {
        ev.preventDefault();
        const at = xOf(ev.clientX);
        if (zone === "start") win.start = Math.min(at, win.end - 0.1);
        else if (zone === "end") win.end = Math.max(at, win.start + 0.1);
        else if (zone === "move") {
          const span = originEnd - originStart;
          win.start = Math.max(0, Math.min(audioDuration - span, originStart + at - origin));
          win.end = win.start + span;
        } else {
          const span = Math.max(0.1, originEnd - originStart);
          win.start = Math.max(0, Math.min(audioDuration - span, at - span / 2));
          win.end = win.start + span;
        }
        audioStart = Math.round(win.start * 100) / 100;
        audioEnd = Math.round(win.end * 100) / 100;
        paintCreateAudioWave();
      };
      const up = () => {
        audioWave.releasePointerCapture?.(e.pointerId);
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
      };
      audioWave.setPointerCapture?.(e.pointerId);
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });

    function revokePhotos() {
      for (const entry of photoFiles) {
        if (entry.url) URL.revokeObjectURL(entry.url);
      }
    }
    function renderThumbs() {
      thumbs.innerHTML = "";
      photoCount.textContent = photoFiles.length ? photoFiles.length + " selected" : "";
      for (let i = 0; i < photoFiles.length; i++) {
        const entry = photoFiles[i];
        const card = el("div", "h3h-create-thumb");
        if ((entry.file.type || "").startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif)$/i.test(entry.file.name || "")) {
          const img = document.createElement("img");
          img.src = entry.url;
          img.alt = entry.file.name || "";
          card.appendChild(img);
        } else {
          card.appendChild(el("span", "h3h-mini", "video"));
          card.style.display = "flex";
          card.style.alignItems = "center";
          card.style.justifyContent = "center";
        }
        const x = el("button", "h3h-btn h3h-create-x", "×");
        stop(x);
        x.title = "Remove";
        x.addEventListener("click", (e) => {
          e.stopPropagation();
          if (entry.url) URL.revokeObjectURL(entry.url);
          photoFiles.splice(i, 1);
          renderThumbs();
        });
        card.appendChild(x);
        thumbs.appendChild(card);
      }
    }
    function addPhotos(list) {
      for (const file of list) {
        if (!isMedia(file)) continue;
        photoFiles.push({ file, url: URL.createObjectURL(file) });
      }
      renderThumbs();
      if (!nameIn.value.trim() && photoFiles[0]) {
        const stem = String(photoFiles[0].file.name || "").replace(/\.[^.]+$/, "");
        if (stem) nameIn.placeholder = stem;
      }
    }
    function setAudio(file) {
      clearAudioPreview();
      audioFile = file && isAudio(file) ? file : null;
      if (file && !isAudio(file)) {
        status.className = "h3h-create-status alert";
        status.textContent = "That isn’t an audio file.";
      }
      audioName.textContent = audioFile ? audioFile.name : "No voice file";
      audioClear.style.display = audioFile ? "" : "none";
      if (audioFile) {
        audioPreviewUrl = URL.createObjectURL(audioFile);
        loadCreateAudioWave(audioFile);
      }
    }

    drop.addEventListener("click", () => photoInput.click());
    photoInput.addEventListener("change", () => {
      addPhotos(photoInput.files || []);
      photoInput.value = "";
    });
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("drag");
      addPhotos(e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files : []);
    });
    audioPick.addEventListener("click", () => audioFileInput.click());
    audioFileInput.addEventListener("change", () => {
      const f = audioFileInput.files && audioFileInput.files[0];
      audioFileInput.value = "";
      if (f) setAudio(f);
    });
    audioClear.addEventListener("click", () => setAudio(null));

    const pathToggle = el("button", "h3h-btn", "Or paste a folder path ▾");
    stop(pathToggle);
    const pathBlock = el("div", "h3h-create-path-block");
    const pathIn = document.createElement("input");
    pathIn.type = "text";
    pathIn.placeholder = "G:\\photos\\character   or   input/stills/hero";
    stop(pathIn);
    const audioIn = document.createElement("input");
    audioIn.type = "text";
    audioIn.placeholder = "G:\\voice\\line.wav (path mode)";
    stop(audioIn);
    pathBlock.append(
      el("div", "h3h-lbl", "photos folder / media path"),
      pathIn,
      el("div", "h3h-lbl", "audio path"),
      audioIn,
    );
    pathToggle.addEventListener("click", () => {
      const open = !pathBlock.classList.contains("open");
      pathBlock.classList.toggle("open", open);
      pathToggle.textContent = open ? "Or paste a folder path ▴" : "Or paste a folder path ▾";
    });

    const nameIn = document.createElement("input");
    nameIn.type = "text";
    nameIn.placeholder = "blank = first file name";
    stop(nameIn);
    const destSel = document.createElement("select");
    destSel.appendChild(el("option", null, "(root)")).value = "";
    stop(destSel);
    api.fetchApi("/h3subjectrefmod/refmod/folders").then(async (r) => {
      const body = await r.json();
      for (const name of body.folders || []) {
        const opt = el("option", null, name);
        opt.value = name;
        destSel.appendChild(opt);
      }
    }).catch(() => {});
    const descIn = document.createElement("textarea");
    descIn.rows = 3;
    descIn.placeholder = "Who / caption stored on the RefMod";
    stop(descIn);
    const roleSel = document.createElement("select");
    for (const role of ["identity", "wardrobe", "background", "generic", "voice"]) {
      const option = el("option", null, role);
      option.value = role;
      roleSel.appendChild(option);
    }
    roleSel.value = "identity";
    stop(roleSel);
    const splitBox = document.createElement("input");
    splitBox.type = "checkbox";
    stop(splitBox);
    const splitLabel = el("label", "h3h-line");
    splitLabel.style.gap = "6px";
    splitLabel.append(splitBox, document.createTextNode("Split into _refmod_visual + _refmod_audio (Both only)"));

    const advToggle = el("button", "h3h-btn", "Encode ▾");
    stop(advToggle);
    const adv = el("div", "h3h-create-adv");
    const mkSel = (values, current) => {
      const sel = document.createElement("select");
      for (const v of values) {
        const option = el("option", null, v);
        option.value = v;
        sel.appendChild(option);
      }
      sel.value = current;
      stop(sel);
      return sel;
    };
    const layout = mkSel(["separate_pictures", "stacked_video"], "separate_pictures");
    const pack = mkSel(["single", "per_file"], "single");
    const fit = mkSel(["crop", "pad", "stretch"], "crop");
    const curve = mkSel(["full", "early_lock", "late_detail", "fade", "mid_peak"], "full");
    const num = (fallback) => {
      const input = document.createElement("input");
      input.type = "number";
      input.value = String(fallback);
      stop(input);
      return input;
    };
    const shortEdge = num(2048);
    const maxEdge = num(2048);
    const maxItems = num(32);
    const maxFrames = num(48);
    const maxTokens = num(0);
    const recursive = document.createElement("input");
    recursive.type = "checkbox";
    stop(recursive);
    const cell = (label, field) => {
      const wrap = el("div", null);
      wrap.append(el("div", "h3h-lbl", label), field);
      return wrap;
    };
    const grid = el("div", "h3h-create-grid");
    grid.append(
      cell("layout", layout), cell("pack", pack),
      cell("fit", fit), cell("step curve", curve),
      cell("short edge", shortEdge), cell("max edge", maxEdge),
      cell("max items", maxItems), cell("max frames", maxFrames),
      cell("max tokens", maxTokens),
    );
    const recLabel = el("label", "h3h-line");
    recLabel.append(recursive, document.createTextNode(" Scan subfolders (path mode)"));
    adv.append(grid, recLabel);
    advToggle.addEventListener("click", () => {
      const open = !adv.classList.contains("open");
      adv.classList.toggle("open", open);
      advToggle.textContent = open ? "Encode ▴" : "Encode ▾";
    });

    const status = el("div", "h3h-create-status", "Pick files here — nothing is copied into Comfy input/.");
    const go = el("button", "h3h-btn accept", "Create");
    stop(go);
    const acts = el("div", "h3h-line");
    acts.append(go, close);

    function paintKind() {
      const showVis = kind === "visual" || kind === "both";
      const showAud = kind === "audio" || kind === "both";
      photoBlock.style.display = showVis ? "" : "none";
      audioBlock.style.display = showAud ? "" : "none";
      splitLabel.style.display = kind === "both" ? "" : "none";
      if (kind === "audio") roleSel.value = "voice";
      else if (roleSel.value === "voice") roleSel.value = "identity";
      roleSel.disabled = kind === "audio";
    }
    paintKind();

    let encoding = false;
    function dismiss() {
      if (encoding) return;
      revokePhotos();
      clearAudioPreview();
      blanket.remove();
      panel.remove();
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("paste", onPaste, true);
    }
    function onKey(e) {
      if (e.key === "Escape") {
        if (encoding) {
          e.preventDefault();
          return;
        }
        dismiss();
      }
    }
    function onPaste(e) {
      if (!panel.isConnected || encoding) return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      const files = [];
      for (const item of items) {
        if (item.type && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length) {
        e.preventDefault();
        addPhotos(files);
      }
    }
    close.addEventListener("click", () => {
      if (encoding) {
        status.className = "h3h-create-status alert";
        status.textContent = "Encoding in progress — stay put until it finishes.";
        return;
      }
      dismiss();
    });
    blanket.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (encoding) {
        status.className = "h3h-create-status alert";
        status.textContent = "Encoding in progress — stay put until it finishes.";
        return;
      }
      dismiss();
    });
    setTimeout(() => {
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("paste", onPaste, true);
    }, 0);

    function applyResult(body) {
      catalogCache = null;
      let row = targetRow && sourceOf(targetRow) === "refmod" ? targetRow : null;
      if (!row) {
        row = newMod("refmod");
        state.mods.push(row);
      }
      state.active = row.id;
      const item = body.item || { name: body.name };
      if (kind === "audio") {
        row.source = "refmod";
        row.refmod = "";
        row.image = "";
        row.voice_refmod = body.name || item.name || "";
        row.concept = "voice";
        row.who = whoFromName(row.voice_refmod, item.description || "");
        row.keep = String(item.keep || "").trim() || keepDefault("voice");
        row.description = item.description || "";
        row.has_looks = false;
        row.has_preview = !!item.has_preview;
      } else {
        row.source = "refmod";
        row.refmod = item.name || body.name || "";
        row.image = "";
        row.concept = item.concept || "identity";
        row.stack = item.stack || "";
        row.format = item.format || "";
        row.description = item.description || "";
        row.has_looks = !!item.has_looks;
        row.has_preview = !!item.has_preview;
        row.who = whoFromName(row.refmod, item.description || "");
        row.keep = String(item.keep || "").trim() || keepDefault(conceptOf(row));
        if (item.has_audio_latent) row.voice_refmod = row.refmod;
        else if (body.voice_name) row.voice_refmod = body.voice_name;
        else if (item.paired_voice) row.voice_refmod = item.paired_voice;
        else row.voice_refmod = "";
      }
      status.className = "h3h-create-status ok";
      status.textContent = body.report || ("Wrote " + (body.name || ""));
      setHint("Created " + (body.name || "RefMod"), false);
      renderList();
      commit();
      setTimeout(dismiss, 700);
    }

    go.addEventListener("click", async () => {
      if (go.disabled) return;
      const useFiles = photoFiles.length > 0 || !!audioFile;
      const pathMode = !useFiles && (pathIn.value.trim() || audioIn.value.trim());
      if (!useFiles && !pathMode) {
        status.className = "h3h-create-status alert";
        status.textContent = kind === "audio"
          ? "Add a voice file (or paste an audio path)."
          : "Add photos, or paste a folder path.";
        return;
      }
      if ((kind === "visual" || kind === "both") && useFiles && !photoFiles.length) {
        status.className = "h3h-create-status alert";
        status.textContent = "Add at least one photo.";
        return;
      }
      if ((kind === "audio" || kind === "both") && useFiles && !audioFile) {
        status.className = "h3h-create-status alert";
        status.textContent = "Add a voice file for Both / Audio.";
        return;
      }
      go.disabled = true;
      close.disabled = true;
      go.classList.add("busy");
      go.textContent = "Creating…";
      encoding = true;
      status.className = "h3h-create-status alert";
      status.textContent = "Encoding — leave this window open until it finishes…";
      try {
        let response;
        if (useFiles) {
          const form = new FormData();
          form.append("kind", kind);
          form.append("name", nameIn.value.trim());
          form.append("description", descIn.value.trim());
          form.append("role", roleSel.value);
          form.append("dest_folder", destSel.value || "");
          form.append("split", kind === "both" && splitBox.checked ? "1" : "0");
          form.append("audio_start", String(audioStart));
          form.append("audio_end", String(audioEnd));
          form.append("layout", layout.value);
          form.append("pack", pack.value);
          form.append("fit_mode", fit.value);
          form.append("step_curve", curve.value);
          form.append("short_edge", String(Number(shortEdge.value) || 2048));
          form.append("max_edge", String(Number(maxEdge.value) || 2048));
          form.append("max_items", String(Number(maxItems.value) || 32));
          form.append("max_frames", String(Number(maxFrames.value) || 48));
          form.append("max_tokens", String(Number(maxTokens.value) || 0));
          for (const entry of photoFiles) {
            form.append("photo", entry.file, entry.file.name || "still.jpg");
          }
          if (audioFile) form.append("audio", audioFile, audioFile.name || "voice.wav");
          response = await api.fetchApi("/h3subjectrefmod/refmod/create_files", {
            method: "POST",
            body: form,
          });
        } else {
          const payload = {
            kind,
            folder: pathIn.value.trim(),
            paths: "",
            audio_path: audioIn.value.trim(),
            audio_start: audioStart,
            audio_end: audioEnd,
            name: nameIn.value.trim(),
            description: descIn.value.trim(),
            role: roleSel.value,
            dest_folder: destSel.value || "",
            split: kind === "both" && !!splitBox.checked,
            layout: layout.value,
            pack: pack.value,
            fit_mode: fit.value,
            step_curve: curve.value,
            short_edge: Number(shortEdge.value) || 2048,
            max_edge: Number(maxEdge.value) || 2048,
            max_items: Number(maxItems.value) || 32,
            max_frames: Number(maxFrames.value) || 48,
            max_tokens: Number(maxTokens.value) || 0,
            recursive: !!recursive.checked,
          };
          const media = payload.folder;
          if (media && /\.(png|jpe?g|webp|bmp|gif|mp4|webm|mov|mkv|avi|m4v)$/i.test(media)) {
            payload.paths = media;
            payload.folder = "";
          }
          response = await api.fetchApi("/h3subjectrefmod/refmod/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }
        const body = await response.json();
        if (!response.ok || body.error) throw new Error(body.error || "Create failed.");
        encoding = false;
        close.disabled = false;
        applyResult(body);
      } catch (e) {
        encoding = false;
        close.disabled = false;
        status.className = "h3h-create-status alert";
        status.textContent = e.message || "Create failed.";
        setHint(e.message || "Create failed.", true);
      } finally {
        encoding = false;
        close.disabled = false;
        go.disabled = false;
        go.classList.remove("busy");
        go.textContent = "Create";
      }
    });

    const roleLine = el("div", "h3h-line");
    roleLine.append(el("span", "h3h-lbl", "role"), roleSel, advToggle);
    panel.append(
      head, kindLine,
      photoBlock, audioBlock,
      pathToggle, pathBlock,
      el("div", "h3h-lbl", "name"), nameIn,
      el("div", "h3h-lbl", "save into folder"), destSel,
      el("div", "h3h-lbl", "description"), descIn,
      roleLine, splitLabel, adv, status, acts,
      photoInput, audioFileInput,
    );
    document.body.appendChild(blanket);
    document.body.appendChild(panel);
    panel.style.left = "50%";
    panel.style.top = "50%";
    panel.style.transform = "translate(-50%, -50%)";
  }

  addRef.addEventListener("click", () => {
    const row = newMod("refmod");
    state.mods.push(row);
    state.active = row.id;
    renderList();
    commit();
  });
  newRef.addEventListener("click", () => {
    const active = state.mods.find((row) => row.id === state.active);
    openCreatePanel(active && sourceOf(active) === "refmod" ? active : null);
  });
  addImg.addEventListener("click", () => {
    const row = newMod("image");
    state.mods.push(row);
    state.active = row.id;
    renderList();
    commit();
  });
  addCloth.addEventListener("click", () => openWardrobe(addCloth, null));

  if (host) {
    host.container.appendChild(root);
  } else {
    const domWidget = node.addDOMWidget("h3hybrid_ui", "h3-hybrid", root, {
      serialize: false,
      hideOnZoom: false,
      getMinHeight: () => 160,
    });
    repairWidgetWidth(domWidget);
  }

  const previousConfigure = node.onConfigure;
  node.onConfigure = function () {
    if (!host) node._h3hConfigured = true;
    previousConfigure?.apply(this, arguments);
    if (host && node._h3hsMode && node._h3hsMode !== "mix") return;
    try {
      const parsed = JSON.parse(stateWidget.value || "{}");
      if (parsed && typeof parsed === "object") state = migrateState(parsed);
    } catch (e) { /* keep */ }
    ideaBox.value = state.idea || "";
    taskSel.value = state.task || "reference generation";
    styleSel.value = STYLES.some(([value]) => value === state.style_mode) ? state.style_mode : "amateur";
    shotSel.value = SHOTS.includes(state.shot_size) ? state.shot_size : "medium close-up";
    root.querySelectorAll("textarea[data-key]").forEach((box) => {
      box.value = state[box.dataset.key] || "";
    });
    if (!state.motion || typeof state.motion !== "object") state.motion = {};
    draftWrap.querySelectorAll("[data-motion]").forEach((button) => {
      button.classList.toggle("on", !!state.motion[button.dataset.motion]);
    });
    ideaActs.querySelectorAll("[data-pass]").forEach((button) => {
      button.classList.toggle("on", button.dataset.pass === state.pass);
    });
    paintPromptHead();
    write();
    renderList();
    assemble();
  };

  const previousRemoved = node.onRemoved;
  node.onRemoved = function () {
    previousRemoved?.apply(this, arguments);
    document.querySelectorAll(".h3h-picker, .h3h-pick-blanket, .h3h-create").forEach((node) => node.remove());
  };

  write();
  renderList();
  assemble();
  warmRefmodCatalog().then((items) => {
    if (!items.length || !root.isConnected) return;
    catalogCache = { items };
    renderList();
  });
  if (!host) {
    setTimeout(() => {
      if (node._h3hConfigured) return;
      node.setSize?.([
        Math.max(Number(node.size?.[0]) || 560, 560),
        Math.max(Number(node.size?.[1]) || 420, 420),
      ]);
    }, 0);
  }
}

globalThis.H3SubjectPanels = globalThis.H3SubjectPanels || {};
globalThis.H3SubjectPanels.mix = setup;

app.registerExtension({
  name: "h3subject.prompt.hybrid",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "H3SubjectPromptHybrid") return;
    if (nodeType.prototype._h3hPatched) return;
    nodeType.prototype._h3hPatched = true;
    const previous = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      previous?.apply(this, arguments);
      setup(this);
    };
  },
});
