// Internal RefMods panel for EM Subject Hot Swap, using shared Ref styling.
// with LoRA-style RefMod rows instead of picture cards.

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
  "The target video is photoreal 35mm cinema with one practical light and fine film grain.",
  "The target video is live-action glamour with warm key light and shallow portrait focus.",
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
const SCENE_DIR = "h3subjectrefmod/scenes";

const CSS = `
.h3m-root { box-sizing:border-box; width:100%; height:100%; min-height:0;
  display:flex; flex-direction:column; gap:6px; padding:8px; overflow:auto;
  background:#1a1a1a; color:#ddd; border:1px solid #555; border-radius:8px;
  font:12px/1.4 sans-serif; }
.h3m-root *, .h3m-root *::before, .h3m-root *::after { box-sizing:border-box; }
.h3m-bar { display:flex; align-items:center; gap:6px; min-width:0; }
.h3m-title { color:#46b4e6; font-weight:700; font-size:13px; white-space:nowrap; }
.h3m-hint { color:#888; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-left:auto; max-width:55%; }
.h3m-hint.alert { color:#e7b15a; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2;
  white-space:normal; overflow:hidden; text-overflow:ellipsis; }
.h3m-note { color:#e7b15a; white-space:pre-wrap; word-break:break-word; }
.h3m-btn { background:#333; border:1px solid #555; border-radius:4px; color:#bbb;
  font:11px sans-serif; cursor:pointer; padding:2px 8px; line-height:16px; white-space:nowrap; }
.h3m-btn:hover { border-color:#46b4e6; color:#fff; }
.h3m-btn.on { border-color:#46b4e6; color:#46b4e6; background:#2a3a42; }
.h3m-btn:disabled { opacity:.55; cursor:wait; }
.h3m-btn.busy, .h3m-btn.busy:disabled { background:#3a2a12; border-color:#e7b15a; color:#e7b15a; opacity:1; cursor:wait; }
.h3m-btn.accept { background:#1e3d2a; border-color:#3d9a5f; color:#7dcea0; }
.h3m-btn.accept:hover { background:#265238; border-color:#4cba72; color:#b6f0c9; }
.h3m-btn.discard { background:#3d1e1e; border-color:#a33; color:#f0a0a0; }
.h3m-btn.discard:hover { background:#a33; border-color:#a33; color:#fff; }
.h3m-create { position:fixed; z-index:10050; width:min(480px, calc(100vw - 24px));
  max-height:min(90vh, 720px); overflow:auto; background:#1e1e1e; border:1px solid #555;
  border-radius:8px; padding:10px; box-shadow:0 12px 40px rgba(0,0,0,.55);
  display:flex; flex-direction:column; gap:6px; font:12px/1.4 sans-serif; color:#ddd; }
.h3m-create input[type=text], .h3m-create input[type=number], .h3m-create textarea, .h3m-create select {
  background:#2a2a2a; border:1px solid #555; border-radius:4px; color:#ddd;
  font:12px sans-serif; padding:4px 6px; width:100%; }
.h3m-create textarea { resize:vertical; min-height:52px; }
.h3m-create-adv { display:none; gap:6px; flex-direction:column; }
.h3m-create-adv.open { display:flex; }
.h3m-create-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.h3m-create-status { color:#888; white-space:pre-wrap; word-break:break-word; min-height:1.2em; }
.h3m-create-status.alert { color:#e7b15a; }
.h3m-create-status.ok { color:#7dcea0; }
.h3m-create-drop { border:1px dashed #555; border-radius:6px; padding:14px 10px; text-align:center;
  color:#888; cursor:pointer; background:#171717; white-space:pre-line; }
.h3m-create-drop:hover, .h3m-create-drop.drag { border-color:#46b4e6; color:#46b4e6; background:#1a2830; }
.h3m-create-thumbs { display:flex; flex-wrap:wrap; gap:6px; min-height:0; }
.h3m-create-thumb { position:relative; width:64px; height:80px; border-radius:4px; overflow:hidden;
  border:1px solid #444; background:#111; flex:0 0 auto; }
.h3m-create-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.h3m-create-thumb .h3m-create-x { position:absolute; top:2px; right:2px; width:18px; height:18px;
  padding:0; line-height:16px; font-size:12px; background:#3d1e1e; border-color:#a33; color:#f0a0a0; }
.h3m-create-audio-row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.h3m-create-audio-name { color:#aaa; font:11px sans-serif; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; }
.h3m-create-wavebox { background:#1d1d1d; border:1px solid #444; border-radius:4px; padding:6px; display:flex; flex-direction:column; gap:4px; }
.h3m-create-wave { width:100%; height:64px; display:block; cursor:ew-resize; touch-action:none; }
.h3m-create-times { display:flex; align-items:center; justify-content:space-between; gap:6px; font:10px sans-serif; color:#888; }
.h3m-create-times .sel { color:#46b4e6; }
.h3m-create-path-block { display:none; flex-direction:column; gap:4px; }
.h3m-create-path-block.open { display:flex; }
.h3m-looks { position:fixed; z-index:10060; inset:0; background:rgba(0,0,0,.78);
  display:flex; align-items:center; justify-content:center; padding:16px; }
.h3m-looks-panel { background:#1a1a1a; border:1px solid #555; border-radius:10px;
  width:min(960px, 96vw); max-height:92vh; overflow:auto; padding:12px;
  display:flex; flex-direction:column; gap:10px; box-shadow:0 16px 48px rgba(0,0,0,.55); }
.h3m-looks-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px; }
.h3m-looks-card { background:#111; border:1px solid #444; border-radius:6px; overflow:hidden;
  display:flex; flex-direction:column; min-height:0; }
.h3m-looks-card img { width:100%; aspect-ratio:3/4; object-fit:contain; background:#0a0a0a; display:block; }
.h3m-looks-card span { color:#aaa; font:11px sans-serif; padding:4px 6px; }
.h3m-looks-card.cover { border-color:#e7b15a; box-shadow:0 0 0 1px #e7b15a inset; }
.h3m-looks-foot { display:flex; align-items:center; justify-content:space-between; gap:6px; padding:2px 4px 4px 0; }
.h3m-looks-foot .h3m-btn { padding:1px 7px; font-size:10px; }
.h3m-looks-empty { color:#e7b15a; padding:20px; text-align:center; }
.h3m-looks-note { color:#888; font:11px sans-serif; padding:8px 2px 0; }
.h3m-live { color:#e7b15a; font:11px sans-serif; white-space:nowrap; }
.h3m-drop:hover { background:#a33; border-color:#a33; color:#fff; }
.h3m-preview.draft-ready {
  border-color:#e7b15a; box-shadow:0 0 0 1px #e7b15a, 0 0 18px rgba(231,177,90,.22);
  background:#2a2418; animation:h3m-draft-flash .9s ease-out 1;
}
@keyframes h3m-draft-flash {
  0% { box-shadow:0 0 0 1px #e7b15a, 0 0 28px rgba(231,177,90,.55); }
  100% { box-shadow:0 0 0 1px #e7b15a, 0 0 18px rgba(231,177,90,.22); }
}
.h3m-list { display:flex; flex-direction:column; gap:4px; padding-right:2px; }
.h3m-empty { color:#888; padding:8px; }
.h3m-band { display:flex; flex-direction:column; gap:4px; }
.h3m-band-label, .h3m-band-head { display:flex; align-items:center; gap:6px; width:100%;
  background:transparent; border:0; border-bottom:1px solid #333; border-radius:0;
  color:#46b4e6; font:600 11px monospace; padding:4px 0; text-align:left; }
.h3m-band-head { cursor:pointer; }
.h3m-band-head:hover { color:#7ec8ea; }
.h3m-band-head .h3m-band-meta { margin-left:auto; color:#666; font:11px sans-serif; font-weight:400; }
.h3m-band-body { display:flex; flex-direction:column; gap:6px; }
.h3m-row { background:#262626; border-radius:4px; padding:5px 8px; display:flex; flex-direction:column; gap:5px; }
.h3m-row.compact { padding:4px 8px; gap:2px; }
.h3m-row.active { box-shadow:inset 0 0 0 1px #46b4e6; }
.h3m-row.off { opacity:.45; }
.h3m-row.dragging { opacity:.4; }
.h3m-who-snip { color:#888; font:11px/1.3 sans-serif; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-left:42px; }
.h3m-grip { cursor:grab; color:#888; user-select:none; flex:0 0 auto; letter-spacing:-1px; }
.h3m-num { font:bold 11px monospace; color:#888; width:18px; flex:0 0 auto; }
.h3m-tag { color:#46b4e6; font:11px monospace; flex:0 0 auto; }
.h3m-line { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.h3m-line input[type=text], .h3m-line input[type=number], .h3m-line select, .h3m-root select, .h3m-root textarea {
  background:#1d1d1d; border:1px solid #444; border-radius:4px; color:#ddd;
  font:13px monospace; padding:4px 6px; }
.h3m-line input[type=text]:focus, .h3m-line input[type=number]:focus, .h3m-root textarea:focus, .h3m-root select:focus {
  border-color:#46b4e6; outline:none; }
.h3m-grow { flex:1 1 160px; min-width:0; }
.h3m-str { width:64px; flex:0 0 auto; }
.h3m-file { flex:1 1 220px; min-width:160px; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.h3m-root textarea { width:100%; resize:vertical; min-height:36px; }
.h3m-lbl { color:#46b4e6; font:600 11px monospace; margin-top:4px; }
.h3m-mini { color:#888; font:11px sans-serif; flex:0 0 auto; }
.h3m-sec { display:flex; flex-direction:column; gap:3px; }
.h3m-map { color:#888; font:11px/1.4 monospace; white-space:pre-wrap; }
.h3m-preview { background:#1d1d1d; border:1px solid #444; border-radius:4px; margin:0;
  padding:8px; color:#bbb; font:12px/1.45 monospace;
  white-space:pre-wrap; word-break:break-word; }
.h3m-menu { position:fixed; z-index:10000; background:#262626; border:1px solid #555;
  border-radius:6px; padding:4px; box-shadow:0 6px 20px rgba(0,0,0,.55);
  font:12px sans-serif; color:#ddd; max-height:60vh; overflow:auto; min-width:220px; max-width:360px; }
.h3m-mitem { display:flex; align-items:center; gap:6px; padding:3px 5px; border-radius:4px; }
.h3m-mitem:hover { background:#333; }
.h3m-mname { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
.h3m-mhdr { color:#888; padding:2px 6px 4px; }
.h3m-picker { position:fixed; z-index:10001; display:flex; flex-direction:column; width:min(920px, calc(100vw - 16px));
  height:min(640px, calc(100vh - 16px)); background:#1a1a1a; color:#ddd; border:1px solid #555;
  border-radius:8px; box-shadow:0 10px 28px rgba(0,0,0,.6); overflow:hidden; font:12px/1.3 sans-serif; }
.h3m-pick-search { display:flex; gap:6px; align-items:center; padding:8px; border-bottom:1px solid #333; }
.h3m-pick-search input { flex:1; background:#141414; border:1px solid #444; border-radius:4px; color:#ddd; padding:5px 8px; font:12px sans-serif; }
.h3m-pick-search input:focus { border-color:#46b4e6; outline:none; }
.h3m-pick-sort { flex:0 0 auto; width:140px; background:#141414; border:1px solid #444; border-radius:4px;
  color:#ddd; padding:4px 6px; font:11px sans-serif; }
.h3m-pick-split { flex:1; min-height:0; display:flex; }
.h3m-pick-folders { width:148px; flex:none; overflow:auto; background:#141414; border-right:1px solid #333;
  display:flex; flex-direction:column; }
.h3m-pick-folder-list { flex:1; min-height:0; overflow:auto; }
.h3m-pick-folder { display:flex; justify-content:space-between; gap:6px; padding:7px 8px; cursor:pointer; color:#aaa; }
.h3m-pick-folder:hover { background:#2a2a2a; }
.h3m-pick-folder.on { background:#1d3340; color:#46b4e6; }
.h3m-pick-folder span:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.h3m-pick-folder-actions { display:flex; gap:4px; padding:6px; border-top:1px solid #333; }
.h3m-pick-move { position:absolute; bottom:6px; left:6px; z-index:2; font-size:10px; padding:1px 6px; }
.h3m-pick-count { color:#777; font-size:10px; }
.h3m-pick-pane { flex:1; min-width:0; overflow:auto; padding:8px; display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:8px; align-content:start; }
.h3m-pick-card { position:relative; display:flex; flex-direction:column; gap:4px; cursor:pointer; border-radius:4px; padding:3px; border:1px solid transparent; }
.h3m-pick-card:hover { background:#262626; }
.h3m-pick-card.on { border-color:#46b4e6; background:#1d3340; }
.h3m-pick-card img { width:100%; height:160px; object-fit:contain; border-radius:3px; background:#111; }
.h3m-pick-name { font-size:10px; color:#bbb; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.h3m-pick-desc { font-size:10px; color:#888; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
.h3m-pick-meta { font-size:10px; color:#46b4e6; }
.h3m-pick-del { position:absolute; top:6px; right:6px; z-index:2; background:#3a1a1a; border:1px solid #a33;
  color:#f0a0a0; border-radius:4px; font:10px sans-serif; padding:1px 6px; cursor:pointer; opacity:0; }
.h3m-pick-card:hover .h3m-pick-del { opacity:1; }
.h3m-pick-del:hover { background:#a33; color:#fff; border-color:#a33; }
.h3m-pick-empty { grid-column:1 / -1; color:#888; padding:12px; }
.h3m-pick-foot { display:flex; align-items:center; gap:8px; padding:6px 8px; border-top:1px solid #333; color:#888; }
.h3m-pick-blanket { position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.35); }
.h3m-thumb { width:168px; height:220px; object-fit:contain; border-radius:4px; background:#111; flex:0 0 auto; }
`;

function ensureStyle() {
  if (document.getElementById("h3m-style")) return;
  const s = document.createElement("style");
  s.id = "h3m-style";
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

function wheelPassthrough(element) {
  element.addEventListener("wheel", (e) => {
    let cur = e.target instanceof Element ? e.target : null;
    while (cur && cur !== element) {
      const oy = getComputedStyle(cur).overflowY;
      if ((oy === "auto" || oy === "scroll") && cur.scrollHeight > cur.clientHeight + 1) return;
      cur = cur.parentElement;
    }
    if (element.scrollHeight <= element.clientHeight + 1) return;
    element.scrollTop += e.deltaY;
    e.preventDefault();
  }, { passive: false });
}

function uid() {
  return "m" + Math.random().toString(36).slice(2, 10);
}

function safeName(value) {
  return String(value || "").replace(/[\/\\:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
}

function conceptOf(row) {
  const raw = String(row?.concept || row?.role || "identity").toLowerCase();
  if (raw === "person") return "identity";
  if (raw === "set" || raw === "clothing") return "wardrobe";
  if (raw === "place" || raw === "scene") return "background";
  if (["identity", "wardrobe", "background", "voice"].includes(raw)) return raw;
  return "identity";
}

function keepDefault(concept) {
  return KEEP_STARTERS[concept] || KEEP_STARTERS.identity;
}

function whoFromRefmod(name, description) {
  const desc = String(description || "").trim();
  const low = desc.toLowerCase();
  const junk = !desc
    || low === "refmod"
    || low === "refmod dataset"
    || low === "dataset"
    || low === "none"
    || low === "n/a"
    || low.startsWith("refmod ")
    || low.includes("refmod dataset");
  if (!junk) return desc;
  let stem = String(name || "").replace(/\\/g, "/").split("/").pop() || "";
  stem = stem.replace(/(_refmod)?(_visual|_audio)?$/i, "");
  stem = stem.replace(/[_-]+/g, " ").trim();
  return stem || "the subject";
}

function clampStrength(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

function newMod() {
  return {
    id: uid(),
    enabled: true,
    refmod: "",
    voice_refmod: "",
    concept: "identity",
    strength: 1.0,
    who: "",
    keep: keepDefault("identity"),
    marker: "fully_preserved",
    shots: "1",
    stack: "",
    format: "",
    description: "",
    has_looks: false,
    has_preview: false,
  };
}

function normalizeMod(row) {
  const base = newMod();
  if (!row || typeof row !== "object") return base;
  const concept = conceptOf(row);
  const who = String(row.who || "").trim();
  return Object.assign(base, {
    id: row.id || base.id,
    enabled: row.enabled !== false,
    refmod: String(row.refmod || "").trim(),
    voice_refmod: String(row.voice_refmod || row.audio_refmod || "").trim(),
    concept,
    strength: clampStrength(row.strength),
    who: whoFromRefmod(row.refmod || row.voice_refmod || "", who || row.description || ""),
    keep: String(row.keep || keepDefault(concept)).trim(),
    marker: PICTURE_MARKERS.includes(row.marker) ? row.marker : "fully_preserved",
    shots: String(row.shots || "1"),
    stack: String(row.stack || ""),
    format: String(row.format || ""),
    description: String(row.description || ""),
    has_looks: !!(row.has_looks || row.hasLooks),
    has_preview: !!row.has_preview,
  });
}

function migrateMods(data) {
  if (!data || typeof data !== "object") return defaultState();
  const out = Object.assign(defaultState(), data);
  out.ui = Object.assign(defaultUi(), (data && data.ui) || {});
  ensureUi(out);
  if (Array.isArray(out.mods) && out.mods.length) {
    out.mods = out.mods.map((row) => normalizeMod(row));
    return out;
  }
  const mods = [];
  for (const row of out.subjects || []) {
    if (!row || typeof row !== "object") continue;
    const concept = conceptOf(row);
    const kind = String(row.kind || "picture").toLowerCase();
    if (kind === "audio" || concept === "voice") {
      mods.push(normalizeMod({
        id: row.id,
        enabled: row.enabled !== false,
        voice_refmod: row.audio_refmod || row.refmod || "",
        concept: "voice",
        who: row.who || row.name || "",
        keep: row.keep || keepDefault("voice"),
        marker: row.audio_marker || "reference",
        shots: row.shots || "1",
      }));
      continue;
    }
    mods.push(normalizeMod({
      id: row.id,
      enabled: row.enabled !== false,
      refmod: row.refmod || "",
      voice_refmod: row.audio ? (row.audio_refmod || "") : "",
      concept: concept === "voice" ? "identity" : concept,
      strength: row.strength != null ? row.strength : 1,
      who: row.who || row.name || "",
      keep: row.keep || keepDefault(concept),
      marker: row.marker || "fully_preserved",
      shots: row.shots || "1",
      stack: row.stack || "",
      description: row.description || "",
      has_looks: !!(row.hasLooks || row.has_looks),
      has_preview: !!row.has_preview,
    }));
  }
  out.mods = mods;
  delete out.subjects;
  delete out.wardrobes;
  return out;
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
    soundscape: "",
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

function hideWidget(widget) {
  if (!widget) return;
  widget.hidden = true;
  widget.computeSize = () => [0, -4];
  if (widget.element) widget.element.style.display = "none";
}

function repairWidgetWidth(widget) {
  if (!widget || widget.__h3mWidthGuard) return;
  const vueMode = () => Boolean(globalThis.LiteGraph?.vueNodesMode);
  let stored = vueMode() ? widget.width : undefined;
  try {
    Object.defineProperty(widget, "width", {
      configurable: true,
      enumerable: true,
      get() { return stored; },
      set(value) { stored = vueMode() ? value : undefined; },
    });
    widget.__h3mWidthGuard = true;
  } catch (e) { /* keep Comfy's width */ }
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

function refmodPreview(name) {
  return api.apiURL("/h3subjectrefmod/refmod/preview?name=" + encodeURIComponent(name || ""));
}

function refmodCatalogSlot() {
  return (globalThis.__h3RefmodCatalog = globalThis.__h3RefmodCatalog || {});
}

function rememberRefmodCatalog(body) {
  const slot = refmodCatalogSlot();
  slot.items = Array.isArray(body?.items) ? body.items : [];
  return slot.items;
}

function warmRefmodCatalog() {
  const slot = refmodCatalogSlot();
  if (Array.isArray(slot.items)) return Promise.resolve(slot.items);
  if (!slot.pending) {
    slot.pending = api.fetchApi("/h3subjectrefmod/refmods").then((r) => r.json()).then((body) => {
      slot.pending = null;
      return rememberRefmodCatalog(body);
    }).catch(() => {
      slot.pending = null;
      return [];
    });
  }
  return slot.pending;
}

function catalogFormat(name) {
  const clean = String(name || "").trim();
  if (!clean) return "";
  const items = refmodCatalogSlot().items;
  if (!Array.isArray(items)) return "";
  const hit = items.find((item) => item.name === clean);
  return hit && hit.format ? String(hit.format) : "";
}

async function readUser(path) {
  try {
    const response = await api.fetchApi(`/userdata/${encodeURIComponent(path)}?full_info=true`);
    if (!response.ok) return null;
    return await response.text();
  } catch (e) {
    return null;
  }
}

async function writeUser(path, text) {
  await api.fetchApi(`/userdata/${encodeURIComponent(path)}?overwrite=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: text,
  });
}

async function listUser(dir) {
  try {
    const response = await api.fetchApi(`/userdata?dir=${encodeURIComponent(dir)}`);
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body) ? body : [];
  } catch (e) {
    return [];
  }
}

function setup(node, opts = null) {
  const host = opts && opts.container ? opts : null;
  const flag = host ? "_h3mHotMounted" : "_h3mMounted";
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

  let state = migrateMods(defaultState());
  try {
    const parsed = JSON.parse(stateWidget.value || "{}");
    if (parsed && typeof parsed === "object") state = migrateMods(parsed);
  } catch (e) { /* fresh node */ }
  if (!Array.isArray(state.mods)) state.mods = [];

  const write = () => {
    ensureUi(state);
    persistChrome();
    const raw = JSON.stringify(state);
    stateWidget.value = raw;
    if (stateWidget.inputEl) stateWidget.inputEl.value = raw;
  };
  stateWidget.serializeValue = () => {
    write();
    return stateWidget.value;
  };

  let catalogCache = null;
  let voiceCache = null;
  let visionBusy = false;
  let visionKind = "";
  let describingId = null;
  let visionStarted = 0;
  let visionTick = 0;
  const visionNote = new Map();
  let draftResult = null;
  let timer = 0;
  let preview = { prompt: "", map: [] };

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
      return;
    }
    draftBtn.textContent = label;
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

  function keepMotion() {
    const saved = state.motion && typeof state.motion === "object" ? state.motion : {};
    state.motion = {
      weight: !!saved.weight,
      contact: !!saved.contact,
      follow: !!saved.follow,
      settle: !!saved.settle,
    };
    if (state.pass !== "close" && state.pass !== "develop") state.pass = "develop";
    ensureUi(state);
  }
  keepMotion();

  function persistChrome() {
    ensureUi(state);
    node.properties = node.properties || {};
    node.properties.h3m_prompt_open = !!state.ui.promptOpen;
  }

  const root = el("div", "h3m-root");
  stop(root);
  middleClickPan(root);
  wheelPassthrough(root);

  const bar = el("div", "h3m-bar");
  const title = el("span", "h3m-title", "EM Subject Hot Swap — RefMods");
  const addBtn = el("button", "h3m-btn", "Add RefMod");
  addBtn.title = "Add a RefMod row";
  const newBtn = el("button", "h3m-btn", "New…");
  newBtn.title = "Create a visual or voice RefMod here (same encode path as H3 Create RefMod)";
  const scenesBtn = el("button", "h3m-btn", "Scenes ▾");
  scenesBtn.title = "Save or insert the prompt. The RefMod rows stay as they are.";
  const hint = el("span", "h3m-hint", "Checked RefMods load in order · New… creates in place");
  function setHint(text, alert) {
    const full = String(text || "").replace(/\s+/g, " ").trim();
    const short = full.length > 160 ? full.slice(0, 159).replace(/\s+\S*$/, "") + "…" : full;
    hint.textContent = short;
    hint.classList.toggle("alert", !!alert);
    hint.title = full;
  }
  stop(addBtn);
  stop(newBtn);
  stop(scenesBtn);
  bar.append(title, addBtn, newBtn, scenesBtn, hint);

  const refsBand = el("div", "h3m-band");
  refsBand.appendChild(el("div", "h3m-band-label", "Refs"));
  const list = el("div", "h3m-list");
  refsBand.appendChild(list);
  const mapLine = el("div", "h3m-map", "");

  function field(label, child) {
    const wrap = el("div", "h3m-sec");
    const row = el("div", "h3m-line");
    row.appendChild(el("span", "h3m-lbl", label));
    if (child) row.appendChild(child);
    wrap.appendChild(row);
    return wrap;
  }

  function area(key, rows, placeholder) {
    const box = document.createElement("textarea");
    box.rows = rows;
    box.placeholder = placeholder;
    box.dataset.key = key;
    box.value = state[key] || "";
    stop(box);
    box.addEventListener("input", () => {
      state[key] = box.value;
      write();
      schedule();
    });
    return box;
  }

  const taskSel = document.createElement("select");
  for (const [value, label] of TASKS) {
    const option = el("option", null, label);
    option.value = value;
    taskSel.appendChild(option);
  }
  taskSel.value = state.task || "reference generation";
  stop(taskSel);
  taskSel.addEventListener("change", () => {
    state.task = taskSel.value;
    write();
    schedule();
  });

  const draftWrap = el("div", "h3m-sec");
  const styleShotLine = el("div", "h3m-line");
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
    el("span", "h3m-lbl", "style"), styleSel,
    el("span", "h3m-lbl", "shot"), shotSel,
  );

  const ideaBar = el("div", "h3m-line");
  const ideaActs = el("div", "h3m-line");
  ideaActs.style.marginLeft = "auto";
  const draftBtn = el("button", "h3m-btn", "Draft");
  draftBtn.title = "Write the summary, the opening, and the shots from the draft.";
  stop(draftBtn);
  for (const [key, label, tip] of [
    ["close", "Close", "Stay close to the typed draft. Do not add events."],
    ["develop", "Develop", "Walk the typed draft across the whole clip."],
  ]) {
    const button = el("button", "h3m-btn" + (state.pass === key ? " on" : ""), label);
    button.dataset.pass = key;
    button.title = tip;
    stop(button);
    button.addEventListener("click", () => {
      state.pass = key;
      ideaActs.querySelectorAll("[data-pass]").forEach((item) => {
        item.classList.toggle("on", item.dataset.pass === key);
      });
      write();
    });
    ideaActs.appendChild(button);
  }
  ideaActs.appendChild(draftBtn);
  ideaBar.append(el("span", "h3m-mini", "idea"), ideaActs);
  const ideaBox = document.createElement("textarea");
  ideaBox.rows = 3;
  ideaBox.placeholder = "the action, who does what, and a cut if there is one";
  ideaBox.title = "Write the action here, then Draft. Checked RefMods are who it expands.";
  ideaBox.value = state.idea || "";
  stop(ideaBox);
  ideaBox.addEventListener("input", () => {
    state.idea = ideaBox.value;
    write();
  });
  const draftBand = el("div", "h3m-band");
  draftBand.appendChild(el("div", "h3m-band-label", "Draft"));
  draftWrap.append(styleShotLine, ideaBar, ideaBox);
  draftBand.appendChild(draftWrap);

  const motionRow = el("div", "h3m-line");
  for (const [key, label, tip] of [
    ["weight", "Weight", "The lead motion shows its start, its carry, and its landing."],
    ["contact", "Contact", "Name both sides of the contact and the sound it makes."],
    ["follow", "Follow-through", "Hair, soft tissue, and loose cloth answer the lead motion."],
    ["settle", "Settle", "The shot ends on breathing or the body coming to rest."],
  ]) {
    const button = el("button", "h3m-btn" + (state.motion[key] ? " on" : ""), label);
    button.dataset.motion = key;
    button.title = tip;
    stop(button);
    button.addEventListener("click", () => {
      state.motion[key] = !state.motion[key];
      button.classList.toggle("on", state.motion[key]);
      write();
    });
    motionRow.appendChild(button);
  }
  draftWrap.appendChild(motionRow);

  const draftView = el("pre", "h3m-preview", "");
  draftView.style.display = "none";
  const draftActs = el("div", "h3m-line");
  draftActs.style.display = "none";
  const acceptBtn = el("button", "h3m-btn accept", "Accept");
  const discardBtn = el("button", "h3m-btn discard", "Discard");
  stop(acceptBtn);
  stop(discardBtn);
  draftActs.append(acceptBtn, discardBtn);
  draftWrap.append(draftView, draftActs);

  function closeDraft() {
    draftResult = null;
    draftView.style.display = "none";
    draftActs.style.display = "none";
    draftView.classList.remove("draft-ready");
    draftView.textContent = "";
  }
  function showDraft(text) {
    draftView.textContent = text;
    draftView.style.display = "";
    draftActs.style.display = "";
    draftView.classList.remove("draft-ready");
    void draftView.offsetWidth;
    draftView.classList.add("draft-ready");
    draftView.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function putBox(key, value) {
    state[key] = value;
    root.querySelectorAll("textarea").forEach((box) => {
      if (box.dataset.key !== key) return;
      box.value = value;
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

  discardBtn.addEventListener("click", closeDraft);
  acceptBtn.addEventListener("click", () => {
    if (!draftResult || !draftResult.detailed) return;
    putBox("summary", draftResult.summary || "");
    putBox("opening", draftResult.opening || "");
    putBox("detailed", draftResult.detailed || "");
    putBox("soundscape", draftResult.soundscape || "room tone");
    closeDraft();
    ensureUi(state).promptOpen = true;
    paintPromptHead();
    persistChrome();
    commit();
  });
  draftBtn.addEventListener("click", () => { runDraft(); });

  const summaryWrap = field("summary:", taskSel);
  summaryWrap.appendChild(area("summary", 3, "the woman sits on the sofa and looks at the camera"));

  const openingWrap = el("div", "h3m-sec");
  const openingHead = el("div", "h3m-line");
  openingHead.appendChild(el("span", "h3m-lbl", "opening, before [Shot 1]"));
  const openPick = document.createElement("select");
  const blank = el("option", null, "openings");
  blank.value = "";
  openPick.appendChild(blank);
  for (const line of OPENING_STARTERS) {
    const option = el("option", null, line.slice(0, 52) + (line.length > 52 ? "…" : ""));
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
  openingWrap.append(openingHead, area("opening", 2, "one or two sentences of style and light"));

  const detailedWrap = el("div", "h3m-sec");
  const detailedHead = el("div", "h3m-line");
  detailedHead.appendChild(el("span", "h3m-lbl", "detailed_description:"));
  if (typeof state.subject_reinforced !== "boolean") state.subject_reinforced = true;
  const reinforceBtn = el(
    "button",
    "h3m-btn" + (state.subject_reinforced ? " on" : ""),
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

  const soundWrap = el("div", "h3m-sec");
  soundWrap.appendChild(el("div", "h3m-lbl", "overall_soundscape:"));
  soundWrap.appendChild(area("soundscape", 2, "room tone, fabric, breath"));

  const musicWrap = el("div", "h3m-sec");
  musicWrap.appendChild(el("div", "h3m-lbl", "non_diegetic_music:"));
  musicWrap.appendChild(area("music", 2, "leave empty for N/A"));

  const previewBar = el("div", "h3m-line");
  const previewBtn = el("button", "h3m-btn", "Preview");
  const copyBtn = el("button", "h3m-btn", "Copy");
  stop(previewBtn);
  stop(copyBtn);
  const previewBox = el("pre", "h3m-preview", "");
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

  const promptBand = el("div", "h3m-band");
  const promptHead = el("button", "h3m-band-head", "");
  stop(promptHead);
  const promptMeta = el("span", "h3m-band-meta", "summary · opening · shots · sound");
  const promptBody = el("div", "h3m-band-body");
  promptBody.append(summaryWrap, openingWrap, detailedWrap, soundWrap, musicWrap, previewBar, previewBox);

  function paintPromptHead() {
    ensureUi(state);
    const open = !!state.ui.promptOpen;
    promptHead.textContent = "";
    promptHead.append(document.createTextNode((open ? "▾ Prompt" : "▸ Prompt")), promptMeta);
    promptBody.style.display = open ? "" : "none";
  }
  promptHead.addEventListener("click", () => {
    ensureUi(state).promptOpen = !state.ui.promptOpen;
    paintPromptHead();
    persistChrome();
    write();
  });
  function dataHadUiPrompt() {
    try {
      const raw = JSON.parse(stateWidget.value || "{}");
      return !!(raw && raw.ui && typeof raw.ui.promptOpen === "boolean");
    } catch (e) {
      return false;
    }
  }
  if (!dataHadUiPrompt() && typeof node.properties?.h3m_prompt_open === "boolean") {
    ensureUi(state).promptOpen = !!node.properties.h3m_prompt_open;
  }
  paintPromptHead();
  persistChrome();
  promptBand.append(promptHead, promptBody);

  root.append(bar, refsBand, mapLine, draftBand, promptBand);

  const sceneMenu = el("div", "h3m-menu");
  sceneMenu.style.display = "none";
  document.body.appendChild(sceneMenu);

  function commit() {
    write();
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(assemble, 180);
  }

  function updateMap() {
    const bits = [];
    let subject = 0;
    let video = 0;
    let audio = 0;
    for (const row of state.mods) {
      if (row.enabled === false) continue;
      if (clampStrength(row.strength) <= 0 && conceptOf(row) !== "voice") continue;
      const concept = conceptOf(row);
      if (concept === "voice" || (row.voice_refmod && !row.refmod)) {
        audio += 1;
        bits.push(`Audio ${audio} → ${row.voice_refmod || row.refmod || "?"}`);
        continue;
      }
      if (!row.refmod) continue;
      subject += 1;
      video += 1;
      bits.push(`Video ${video} / Subject ${subject} → ${row.refmod} @ ${clampStrength(row.strength).toFixed(2)}`);
      if (row.voice_refmod) {
        audio += 1;
        bits.push(`Audio ${audio} → ${row.voice_refmod}`);
      }
    }
    mapLine.textContent = bits.join("\n") || "No RefMods are switched on.";
  }

  async function assemble() {
    updateMap();
    try {
      const response = await api.fetchApi("/h3subjectrefmod/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const body = await response.json();
      preview = body || {};
      if (body.error) setHint(body.error, true);
      else setHint("Checked RefMods load in order", false);
      previewBox.textContent = body.prompt || "";
    } catch (e) {
      setHint(e.message || "Assemble failed.", true);
    }
  }

  function fillFromCatalog(row, item) {
    row.refmod = item.name || "";
    row.concept = item.concept || conceptOf(row);
    row.stack = item.stack || "";
    row.format = item.format || "";
    row.description = item.description || "";
    row.has_looks = !!item.has_looks;
    row.has_preview = !!item.has_preview;
    row.has_audio_latent = !!item.has_audio_latent;
    // Prefer stashed who/keep from the file; otherwise stem + role default.
    row.who = whoFromRefmod(item.name, item.description);
    const stashed = String(item.keep || "").trim();
    row.keep = stashed || keepDefault(row.concept);
    // Always re-pair voice to this visual — don't keep a previous character's audio.
    if (item.has_audio_latent) row.voice_refmod = item.name;
    else if (item.paired_voice) row.voice_refmod = item.paired_voice;
    else row.voice_refmod = "";
  }

  async function openLooksGallery(name) {
    const clean = String(name || "").trim();
    if (!clean) {
      setHint("Pick a RefMod first.", true);
      return;
    }
    document.querySelectorAll(".h3m-looks").forEach((node) => node.remove());
    const shell = el("div", "h3m-looks");
    const panel = el("div", "h3m-looks-panel");
    stop(panel);
    const head = el("div", "h3m-line");
    head.appendChild(el("span", "h3m-lbl", "Looks · " + clean));
    const close = el("button", "h3m-btn", "Close");
    stop(close);
    head.appendChild(close);
    const grid = el("div", "h3m-looks-grid");
    const status = el("div", "h3m-looks-empty", "Loading pictures… older RefMods decode once from the latent, then cache.");
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
        panel.appendChild(el("div", "h3m-looks-empty", body.note || "No stored pictures in this RefMod."));
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
        const card = el("div", "h3m-looks-card");
        const img = document.createElement("img");
        img.alt = item.label || "";
        img.loading = "lazy";
        img.src = refmodThumb(clean, item.member, item.frame) + "&t=" + Date.now();
        img.addEventListener("error", () => {
          img.replaceWith(el("div", "h3m-looks-empty", "missing"));
        });
        img.addEventListener("click", () => {
          window.open(img.src, "_blank");
        });
        const foot = el("div", "h3m-looks-foot");
        const btn = el("button", "h3m-btn", "Set cover");
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
        const note = el("div", "h3m-looks-note",
          `${items.length} picture${items.length === 1 ? "" : "s"} decoded from the stored latent (older RefMod) — cached under models/refmods/.h3looks.`);
        if (body.note) note.textContent += " " + body.note;
        panel.appendChild(note);
      }
    } catch (e) {
      status.textContent = e.message || "Could not load looks.";
    }
  }

  function openCreatePanel(targetRow) {
    document.querySelectorAll(".h3m-create, .h3m-pick-blanket").forEach((node) => node.remove());
    const blanket = el("div", "h3m-pick-blanket");
    const panel = el("div", "h3m-create");
    stop(panel);
    const head = el("div", "h3m-line");
    head.appendChild(el("span", "h3m-lbl", "Create RefMod"));
    const close = el("button", "h3m-btn", "Close");
    stop(close);
    head.appendChild(close);

    let kind = "visual";
    /** @type {{ file: File, url: string }[]} */
    let photoFiles = [];
    /** @type {File | null} */
    let audioFile = null;
    const kindLine = el("div", "h3m-line");
    const kindBtns = {};
    for (const [key, label] of [["visual", "Visual"], ["audio", "Audio"], ["both", "Both"]]) {
      const button = el("button", "h3m-btn" + (key === kind ? " on" : ""), label);
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

    const drop = el("div", "h3m-create-drop", "Drop photos here, or click to multi-select\n(~4 angles — not a dozen)");
    stop(drop);
    const thumbs = el("div", "h3m-create-thumbs");
    const photoCount = el("div", "h3m-mini", "");
    const photoLab = el("div", "h3m-lbl", "photos");
    const photoBlock = el("div", null);
    photoBlock.append(photoLab, drop, thumbs, photoCount);

    const audioLab = el("div", "h3m-lbl", "voice");
    const audioRow = el("div", "h3m-create-audio-row");
    const audioPick = el("button", "h3m-btn", "Add voice…");
    stop(audioPick);
    const audioName = el("span", "h3m-create-audio-name", "No voice file");
    const audioClear = el("button", "h3m-btn", "Clear");
    stop(audioClear);
    audioClear.style.display = "none";
    audioRow.append(audioPick, audioName, audioClear);
    const audioBlock = el("div", null);
    audioBlock.append(audioLab, audioRow);
    const audioWaveBox = el("div", "h3m-create-wavebox");
    audioWaveBox.style.display = "none";
    const audioWave = document.createElement("canvas");
    audioWave.className = "h3m-create-wave";
    audioWave.title = "Drag either edge to trim. Drag the middle to slide the selection.";
    stop(audioWave);
    const audioTimes = el("div", "h3m-create-times");
    const audioStartLabel = el("span", null, "0:00.0");
    const audioSelectionLabel = el("span", "sel", "0:00.0 selected");
    const audioPlay = el("button", "h3m-btn", "Play");
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
        const playX = (audioPreviewPlayer.currentTime / audioDuration) * cssWidth;
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
      photoCount.textContent = photoFiles.length
        ? photoFiles.length + " selected"
        : "";
      for (let i = 0; i < photoFiles.length; i++) {
        const entry = photoFiles[i];
        const card = el("div", "h3m-create-thumb");
        if ((entry.file.type || "").startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif)$/i.test(entry.file.name || "")) {
          const img = document.createElement("img");
          img.src = entry.url;
          img.alt = entry.file.name || "";
          card.appendChild(img);
        } else {
          card.appendChild(el("span", "h3m-mini", "video"));
          card.style.display = "flex";
          card.style.alignItems = "center";
          card.style.justifyContent = "center";
        }
        const x = el("button", "h3m-btn h3m-create-x", "×");
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
      if (file && !audioFile) {
        status.className = "h3m-create-status alert";
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
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("drag");
    });
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

    const pathToggle = el("button", "h3m-btn", "Or paste a folder path ▾");
    stop(pathToggle);
    const pathBlock = el("div", "h3m-create-path-block");
    const pathIn = document.createElement("input");
    pathIn.type = "text";
    pathIn.placeholder = "G:\\photos\\character   or   input/stills/hero";
    stop(pathIn);
    const audioIn = document.createElement("input");
    audioIn.type = "text";
    audioIn.placeholder = "G:\\voice\\line.wav (path mode)";
    stop(audioIn);
    pathBlock.append(
      el("div", "h3m-lbl", "photos folder / media path"),
      pathIn,
      el("div", "h3m-lbl", "audio path"),
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
      roleSel.appendChild(el("option", null, role)).value = role;
    }
    roleSel.value = "identity";
    stop(roleSel);
    const splitBox = document.createElement("input");
    splitBox.type = "checkbox";
    stop(splitBox);
    const splitLabel = el("label", "h3m-line");
    splitLabel.style.gap = "6px";
    splitLabel.append(splitBox, document.createTextNode("Split into _refmod_visual + _refmod_audio (Both only)"));

    const advToggle = el("button", "h3m-btn", "Encode ▾");
    stop(advToggle);
    const adv = el("div", "h3m-create-adv");
    const layout = document.createElement("select");
    for (const v of ["separate_pictures", "stacked_video"]) layout.appendChild(el("option", null, v)).value = v;
    layout.value = "separate_pictures";
    stop(layout);
    const pack = document.createElement("select");
    for (const v of ["single", "per_file"]) pack.appendChild(el("option", null, v)).value = v;
    stop(pack);
    const fit = document.createElement("select");
    for (const v of ["crop", "pad", "stretch"]) fit.appendChild(el("option", null, v)).value = v;
    stop(fit);
    const curve = document.createElement("select");
    for (const v of ["full", "early_lock", "late_detail", "fade", "mid_peak"]) {
      curve.appendChild(el("option", null, v)).value = v;
    }
    stop(curve);
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
      wrap.append(el("div", "h3m-lbl", label), field);
      return wrap;
    };
    const grid = el("div", "h3m-create-grid");
    grid.append(
      cell("layout", layout), cell("pack", pack),
      cell("fit", fit), cell("step curve", curve),
      cell("short edge", shortEdge), cell("max edge", maxEdge),
      cell("max items", maxItems), cell("max frames", maxFrames),
      cell("max tokens", maxTokens),
    );
    const recLabel = el("label", "h3m-line");
    recLabel.append(recursive, document.createTextNode(" Scan subfolders (path mode)"));
    adv.append(grid, recLabel);
    advToggle.addEventListener("click", () => {
      const open = !adv.classList.contains("open");
      adv.classList.toggle("open", open);
      advToggle.textContent = open ? "Encode ▴" : "Encode ▾";
    });

    const status = el("div", "h3m-create-status", "Pick files here — nothing is copied into Comfy input/.");
    const go = el("button", "h3m-btn accept", "Create");
    stop(go);
    const acts = el("div", "h3m-line");
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
        status.className = "h3m-create-status alert";
        status.textContent = "Encoding in progress — stay put until it finishes.";
        return;
      }
      dismiss();
    });
    blanket.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (encoding) {
        status.className = "h3m-create-status alert";
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
      let row = targetRow;
      if (!row) {
        row = newMod();
        state.mods.push(row);
      }
      state.active = row.id;
      const item = body.item || { name: body.name };
      if (kind === "audio") {
        row.refmod = "";
        row.voice_refmod = body.name || item.name || "";
        row.concept = "voice";
        row.who = whoFromRefmod(row.voice_refmod, item.description || "");
        row.keep = String(item.keep || "").trim() || keepDefault("voice");
        row.description = item.description || "";
        row.has_looks = false;
        row.has_preview = !!item.has_preview;
        row.has_audio_latent = true;
      } else {
        fillFromCatalog(row, item);
        if (body.voice_name) row.voice_refmod = body.voice_name;
        else if (item.has_audio_latent) row.voice_refmod = item.name || body.name || "";
      }
      status.className = "h3m-create-status ok";
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
        status.className = "h3m-create-status alert";
        status.textContent = kind === "audio"
          ? "Add a voice file (or paste an audio path)."
          : "Add photos, or paste a folder path.";
        return;
      }
      if ((kind === "visual" || kind === "both") && useFiles && !photoFiles.length && !pathIn.value.trim()) {
        status.className = "h3m-create-status alert";
        status.textContent = "Add at least one photo.";
        return;
      }
      if ((kind === "audio" || kind === "both") && useFiles && !audioFile && !audioIn.value.trim()) {
        status.className = "h3m-create-status alert";
        status.textContent = "Add a voice file for Both / Audio.";
        return;
      }
      go.disabled = true;
      close.disabled = true;
      go.classList.add("busy");
      go.textContent = "Creating…";
      encoding = true;
      status.className = "h3m-create-status alert";
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
        status.className = "h3m-create-status alert";
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

    const roleLine = el("div", "h3m-line");
    roleLine.append(el("span", "h3m-lbl", "role"), roleSel, advToggle);
    panel.append(
      head, kindLine,
      photoBlock, audioBlock,
      pathToggle, pathBlock,
      el("div", "h3m-lbl", "name"), nameIn,
      el("div", "h3m-lbl", "save into folder"), destSel,
      el("div", "h3m-lbl", "description"), descIn,
      roleLine, splitLabel, adv, status, acts,
      photoInput, audioFileInput,
    );
    document.body.appendChild(blanket);
    document.body.appendChild(panel);
    panel.style.left = "50%";
    panel.style.top = "50%";
    panel.style.transform = "translate(-50%, -50%)";
  }

  function openPicker(anchor, row, voiceOnly, onPick) {
    document.querySelectorAll(".h3m-picker, .h3m-pick-blanket").forEach((node) => node.remove());
    const blanket = el("div", "h3m-pick-blanket");
    const popup = el("div", "h3m-picker");
    stop(popup);
    const searchWrap = el("div", "h3m-pick-search");
    const search = document.createElement("input");
    search.placeholder = voiceOnly ? "Filter voice RefMods…" : "Filter RefMods…";
    const sortSel = document.createElement("select");
    sortSel.className = "h3m-pick-sort";
    for (const [value, label] of [
      ["newest", "Newest first"],
      ["oldest", "Oldest first"],
      ["name_az", "Name A–Z"],
      ["name_za", "Name Z–A"],
      ["concept", "Concept"],
    ]) {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = label;
      sortSel.appendChild(o);
    }
    const savedSort = String(node.properties?.h3m_refmod_sort || "newest");
    sortSel.value = [...sortSel.options].some((o) => o.value === savedSort) ? savedSort : "newest";
    stop(sortSel);
    const close = el("button", "h3m-btn", "Close");
    stop(close);
    function dismissPicker() {
      blanket.remove();
      popup.remove();
      document.removeEventListener("pointerdown", onDocDown, true);
      document.removeEventListener("mousedown", onDocDown, true);
      document.removeEventListener("keydown", onKey, true);
    }
    close.addEventListener("click", dismissPicker);
    blanket.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dismissPicker();
    });
    function onDocDown(e) {
      if (popup.contains(e.target)) return;
      if (anchor.contains?.(e.target) || e.target === anchor) return;
      dismissPicker();
    }
    function onKey(e) {
      if (e.key === "Escape") dismissPicker();
    }
    // Next tick so the opening click does not immediately close.
    setTimeout(() => {
      document.addEventListener("pointerdown", onDocDown, true);
      document.addEventListener("mousedown", onDocDown, true);
      document.addEventListener("keydown", onKey, true);
    }, 0);
    searchWrap.append(search, sortSel, close);
    const split = el("div", "h3m-pick-split");
    const folders = el("div", "h3m-pick-folders");
    const folderList = el("div", "h3m-pick-folder-list");
    const folderActs = el("div", "h3m-pick-folder-actions");
    const newFolderBtn = el("button", "h3m-btn", "+ Folder");
    stop(newFolderBtn);
    newFolderBtn.title = "Create a subfolder under models/refmods/";
    folderActs.appendChild(newFolderBtn);
    folders.append(folderList, folderActs);
    const pane = el("div", "h3m-pick-pane");
    split.append(folders, pane);
    const foot = el("div", "h3m-pick-foot");
    foot.style.display = "flex";
    foot.style.alignItems = "center";
    foot.style.gap = "8px";
    const footText = el("span", null, "Pick a finished RefMod.");
    footText.style.flex = "1";
    const refreshBtn = el("button", "h3m-btn", "Refresh");
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
      const caches = [catalogCache, voiceCache];
      for (const cache of caches) {
        if (!cache?.items) continue;
        for (const row of cache.items) {
          if (row.name === oldName) row.name = newName;
          if (row.paired_voice === oldName) row.paired_voice = newName;
        }
      }
    }
    function sortedItems(list) {
      const mode = sortSel.value || "newest";
      const out = list.slice();
      const byName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
      const byMtime = (a, b) => (Number(b.mtime) || 0) - (Number(a.mtime) || 0);
      if (mode === "oldest") out.sort((a, b) => -byMtime(a, b) || byName(a, b));
      else if (mode === "name_az") out.sort(byName);
      else if (mode === "name_za") out.sort((a, b) => -byName(a, b));
      else if (mode === "concept") {
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
        const f = folderOf(item.name);
        counts.set("", (counts.get("") || 0) + 1);
        if (f) counts.set(f, (counts.get(f) || 0) + 1);
      }
      for (const name of diskFolders) {
        if (!counts.has(name)) counts.set(name, 0);
      }
      folderList.innerHTML = "";
      for (const [name, count] of [...counts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
        const button = el("div", "h3m-pick-folder" + (folder === name ? " on" : ""));
        button.append(el("span", null, name || "All"), el("span", "h3m-pick-count", String(count)));
        button.addEventListener("click", () => { folder = name; render(); });
        folderList.appendChild(button);
      }
      pane.innerHTML = "";
      const shown = ordered.filter((item) => {
        if (folder && folderOf(item.name) !== folder) return false;
        if (!q) return true;
        return (item.name + " " + (item.description || "") + " " + (item.concept || "")).toLowerCase().includes(q);
      });
      if (!shown.length) {
        pane.appendChild(el("div", "h3m-pick-empty", items.length ? "No matches." : "No RefMods found under models/refmods."));
        return;
      }
      for (const item of shown) {
        const card = el("div", "h3m-pick-card" + ((voiceOnly ? row.voice_refmod : row.refmod) === item.name ? " on" : ""));
        card.style.position = "relative";
        if (item.has_looks || item.has_preview) {
          const img = document.createElement("img");
          img.alt = "";
          img.src = (item.has_preview ? refmodPreview(item.name) : refmodThumb(item.name)) + "&t=1";
          img.addEventListener("error", () => { img.remove(); });
          card.appendChild(img);
        }
        card.appendChild(el("div", "h3m-pick-name", item.name));
        const badge = [item.format, item.concept, item.stack].filter(Boolean).join(" · ");
        if (badge && badge.length < 40) card.appendChild(el("div", "h3m-pick-meta", badge));
        if (item.description) card.appendChild(el("div", "h3m-pick-desc", item.description));
        const moveBtn = el("button", "h3m-btn h3m-pick-move", "Move");
        stop(moveBtn);
        moveBtn.title = "Move into a folder under models/refmods/";
        moveBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const choices = ["(root / All)", ...[...new Set([...diskFolders, ...[...counts.keys()].filter(Boolean)])].sort((a, b) => a.localeCompare(b))];
          const pick = window.prompt(
            `Move "${item.name}" to folder:\n` + choices.map((c, i) => `${i}: ${c}`).join("\n") + "\n\nType folder name or index:",
            folder || "",
          );
          if (pick == null) return;
          let dest = String(pick).trim();
          if (/^\d+$/.test(dest)) {
            const idx = Number(dest);
            dest = idx === 0 ? "" : String(choices[idx] || "").replace(/^\(root.*/, "");
          }
          if (dest === "(root / All)") dest = "";
          moveBtn.disabled = true;
          try {
            const response = await api.fetchApi("/h3subjectrefmod/refmod/move", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: item.name, folder: dest, move_pair: true }),
            });
            const body = await response.json();
            if (!response.ok || body.error) throw new Error(body.error || "Move failed");
            remapName(body.old_name || item.name, body.name);
            for (const pair of body.pairs || []) {
              if (pair.ok && pair.old_name && pair.name) remapName(pair.old_name, pair.name);
            }
            catalogCache = null;
            voiceCache = null;
            if (hint) setHint(`Moved → ${body.name}`, false);
            await loadList({ force: true });
            await loadFolders();
            render();
            renderList();
            commit();
          } catch (err) {
            window.alert(err.message || "Could not move.");
            moveBtn.disabled = false;
          }
        });
        card.appendChild(moveBtn);
        const del = el("button", "h3m-pick-del", "Delete");
        stop(del);
        del.title = "Delete from models/refmods";
        del.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!window.confirm(`Delete RefMod "${item.name}" from models/refmods?\nThis removes the .safetensors and preview.`)) return;
          del.disabled = true;
          try {
            const response = await api.fetchApi("/h3subjectrefmod/refmod/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: item.name, confirm: true }),
            });
            const body = await response.json();
            if (!response.ok || body.error) throw new Error(body.error || "Delete failed");
            items = items.filter((row) => row.name !== item.name);
            if (voiceOnly && voiceCache?.items) {
              voiceCache.items = voiceCache.items.filter((row) => row.name !== item.name);
            } else if (catalogCache?.items) {
              catalogCache.items = catalogCache.items.filter((row) => row.name !== item.name);
            }
            if (hint) setHint(`Deleted ${item.name}`, false);
            render();
          } catch (err) {
            window.alert(err.message || "Could not delete.");
            del.disabled = false;
          }
        });
        card.appendChild(del);
        card.addEventListener("click", () => {
          const finish = (note) => {
            onPick(item);
            dismissPicker();
            renderList();
            commit();
            if (note) setHint(note, false);
          };
          // Missing sidecar → looks first, else cached H3 VAE first-frame decode.
          if (!voiceOnly && !item.has_preview) {
            api.fetchApi("/h3subjectrefmod/refmod/ensure_preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: item.name }),
            }).then(async (response) => {
              let body = {};
              try { body = await response.json(); } catch (e) { body = {}; }
              if (body.has_preview) {
                item.has_preview = true;
                const hit = (catalogCache?.items || []).find((row) => row.name === item.name);
                if (hit) hit.has_preview = true;
                finish(body.source === "vae" ? "Preview baked from first latent frame." : "");
                return;
              }
              finish(body.note || (body.needs_vae
                ? "No looks and no H3 video VAE found under models/vae."
                : ""));
            }).catch(() => { finish(); });
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
      node.properties.h3m_refmod_sort = sortSel.value;
      render();
    });
    function applyBody(body) {
      if (voiceOnly) voiceCache = body || { items: [] };
      else catalogCache = { items: rememberRefmodCatalog(body) };
      const pack = voiceOnly ? voiceCache : catalogCache;
      items = Array.isArray(pack.items) ? pack.items : [];
      render();
    }
    async function loadFolders() {
      try {
        const response = await api.fetchApi("/h3subjectrefmod/refmod/folders");
        const body = await response.json();
        diskFolders = Array.isArray(body.folders) ? body.folders : [];
      } catch (e) {
        diskFolders = [];
      }
      render();
    }
    function loadList({ force = false } = {}) {
      const cached = voiceOnly ? voiceCache : catalogCache;
      if (cached && !force) applyBody(cached);
      const url = voiceOnly ? "/h3subjectrefmod/voices" : "/h3subjectrefmod/refmods";
      footText.textContent = cached && !force ? "Refreshing list…" : "Pick a finished RefMod.";
      refreshBtn.disabled = true;
      return api.fetchApi(url).then((r) => r.json()).then((body) => {
        applyBody(body);
        footText.textContent = "Pick a finished RefMod.";
      }).catch((e) => {
        if (!items.length) pane.appendChild(el("div", "h3m-pick-empty", e.message || "Could not list RefMods."));
        footText.textContent = e.message || "Could not refresh list.";
      }).finally(() => {
        refreshBtn.disabled = false;
      });
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
        if (hint) setHint(`Folder ready: ${folder}`, false);
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
      list.appendChild(el("div", "h3m-empty", "No RefMods yet. Press Add, then choose a file."));
      updateMap();
      return;
    }
    state.mods.forEach((row, index) => list.appendChild(renderRow(row, index)));
    updateMap();
  }

  function renderRow(row, index) {
    if (row.refmod && (!row.who || /refmod\s*dataset/i.test(row.who))) {
      row.who = whoFromRefmod(row.refmod, row.description);
    }

    const expanded = row.id === state.active;
    const view = el(
      "div",
      "h3m-row" + (expanded ? " active" : " compact") + (row.enabled === false ? " off" : ""),
    );
    view.dataset.id = row.id;
    view.dataset.index = String(index);

    const top = el("div", "h3m-line");
    const grip = el("span", "h3m-grip", "⋮⋮");
    grip.title = "Drag to reorder";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = row.enabled !== false;
    check.title = "Switch this RefMod on or off";
    stop(check);
    const num = el("span", "h3m-num", String(index + 1).padStart(2, "0"));

    const fold = el("button", "h3m-btn", expanded ? "▾" : "▸");
    fold.title = expanded ? "Collapse who / keep / voice" : "Expand who / keep / voice";
    stop(fold);
    fold.addEventListener("click", () => {
      state.active = expanded ? "" : row.id;
      write();
      renderList();
    });

    const choose = el(
      "button",
      "h3m-btn h3m-file",
      row.refmod || row.voice_refmod || (conceptOf(row) === "voice" ? "Choose voice RefMod…" : "Choose RefMod…"),
    );
    choose.title = row.refmod || row.voice_refmod || "Pick a finished RefMod";
    stop(choose);
    choose.addEventListener("click", () => {
      state.active = row.id;
      const voiceOnly = conceptOf(row) === "voice";
      openPicker(choose, row, voiceOnly, (item) => {
        if (voiceOnly) {
          row.voice_refmod = item.name;
          row.refmod = "";
          row.format = item.format || "";
          row.concept = "voice";
          row.who = whoFromRefmod(item.name, item.description);
          const stashed = String(item.keep || "").trim();
          row.keep = stashed || keepDefault("voice");
        } else {
          fillFromCatalog(row, item);
        }
      });
    });

    const strength = document.createElement("input");
    strength.type = "number";
    strength.className = "h3m-str";
    strength.min = "0";
    strength.max = "1";
    strength.step = "0.05";
    strength.value = String(clampStrength(row.strength));
    strength.title = "Strength 0–1";
    stop(strength);
    strength.addEventListener("change", () => {
      row.strength = clampStrength(strength.value);
      strength.value = String(row.strength);
      commit();
    });

    const concept = document.createElement("select");
    for (const [value, label] of CONCEPTS) {
      const option = el("option", null, label);
      option.value = value;
      concept.appendChild(option);
    }
    concept.value = conceptOf(row);
    concept.title = "From file meta; change only if wrong";
    stop(concept);
    concept.addEventListener("change", () => {
      row.concept = concept.value;
      row.keep = keepDefault(row.concept);
      state.active = row.id;
      renderList();
      commit();
    });

    const drop = el("button", "h3m-btn h3m-drop", "Drop");
    drop.title = "Drop this RefMod from the prompt";
    stop(drop);
    drop.addEventListener("click", () => {
      state.mods = state.mods.filter((item) => item.id !== row.id);
      if (state.active === row.id) state.active = "";
      renderList();
      commit();
    });

    // Ref2VA-style: grip left, expand caret on the right before Drop
    top.append(grip, check, num, choose, el("span", "h3m-mini", "str"), strength, concept);
    const fmt = String(row.format || catalogFormat(row.refmod || row.voice_refmod) || "");
    if (fmt) top.appendChild(el("span", "h3m-tag", fmt));
    if (row.stack && String(row.stack).length < 24) top.appendChild(el("span", "h3m-tag", row.stack));
    top.append(fold, drop);
    view.appendChild(top);

    if (!expanded) {
      if (row.who) view.appendChild(el("div", "h3m-who-snip", row.who));
      else if (row.voice_refmod && conceptOf(row) !== "voice") {
        view.appendChild(el("div", "h3m-who-snip", "voice · " + row.voice_refmod));
      }
    } else {
      const mediaName = conceptOf(row) === "voice"
        ? (row.voice_refmod || row.refmod)
        : row.refmod;
      if (mediaName && conceptOf(row) !== "voice") {
        const media = el("div", "h3m-line");
        const thumb = document.createElement("img");
        thumb.className = "h3m-thumb";
        thumb.alt = "";
        const primary = row.has_preview ? refmodPreview(mediaName) : refmodThumb(mediaName);
        const fallback = row.has_preview ? refmodThumb(mediaName) : refmodPreview(mediaName);
        thumb.src = primary + "&t=" + Date.now();
        thumb.addEventListener("error", () => {
          if (thumb.dataset.fell) {
            thumb.remove();
            return;
          }
          thumb.dataset.fell = "1";
          thumb.src = fallback + "&t=" + Date.now();
        });
        media.appendChild(thumb);
        view.appendChild(media);
        if (!row.has_preview) {
          api.fetchApi("/h3subjectrefmod/refmod/ensure_preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: mediaName }),
          }).then(async (response) => {
            let body = {};
            try { body = await response.json(); } catch (e) { body = {}; }
            if (!body.has_preview || !view.isConnected) return;
            row.has_preview = true;
            thumb.dataset.fell = "";
            thumb.src = refmodPreview(mediaName) + "&t=" + Date.now();
            write();
          }).catch(() => {});
        }
      }

      const acts = el("div", "h3m-line");
      const looksBtn = el("button", "h3m-btn", "Looks");
      looksBtn.title = "Show every stored still in this RefMod";
      looksBtn.disabled = !mediaName;
      stop(looksBtn);
      looksBtn.addEventListener("click", () => openLooksGallery(mediaName));
      const describe = el("button", "h3m-btn", "Describe");
      describe.dataset.describe = row.id;
      describe.title = "Fill who / keep from looks or file meta";
      describe.disabled = visionBusy;
      stop(describe);
      describe.addEventListener("click", () => describeRow(row));
      const saveMeta = el("button", "h3m-btn", "Save to RefMod");
      saveMeta.title = "Write who + keep into this RefMod. Voice stays a separate pick — not written into the file.";
      saveMeta.disabled = !row.refmod || !String(row.who || "").trim();
      stop(saveMeta);
      saveMeta.addEventListener("click", () => saveRowToRefmod(row));
      if (visionBusy && visionKind === "describe" && describingId === row.id) {
        describe.textContent = "Describing " + visionClock();
        describe.classList.add("busy");
      }
      acts.append(looksBtn, describe, saveMeta);
      view.appendChild(acts);

      const whoLine = el("div", "h3m-line");
      whoLine.appendChild(el("span", "h3m-mini", "who"));
      const who = document.createElement("input");
      who.type = "text";
      who.className = "h3m-grow";
      who.value = row.who || "";
      who.placeholder = "the woman with…";
      stop(who);
      who.addEventListener("input", () => {
        row.who = who.value;
        write();
        schedule();
      });
      whoLine.appendChild(who);
      view.appendChild(whoLine);

      const keepLine = el("div", "h3m-line");
      keepLine.appendChild(el("span", "h3m-mini", "keep"));
      const keep = document.createElement("input");
      keep.type = "text";
      keep.className = "h3m-grow";
      keep.value = row.keep || "";
      keep.placeholder = keepDefault(conceptOf(row));
      stop(keep);
      keep.addEventListener("input", () => {
        row.keep = keep.value;
        write();
        schedule();
      });
      const marker = document.createElement("select");
      for (const value of PICTURE_MARKERS) {
        const option = el("option", null, value);
        option.value = value;
        marker.appendChild(option);
      }
      marker.value = row.marker || "fully_preserved";
      stop(marker);
      marker.addEventListener("change", () => {
        row.marker = marker.value;
        commit();
      });
      keepLine.append(keep, marker);
      view.appendChild(keepLine);

      if (conceptOf(row) !== "voice") {
        const voiceLine = el("div", "h3m-line");
        voiceLine.appendChild(el("span", "h3m-mini", "voice"));
        const voiceBtn = el("button", "h3m-btn h3m-file", row.voice_refmod || "Optional voice RefMod…");
        voiceBtn.title = row.voice_refmod || "Pair a voice RefMod";
        stop(voiceBtn);
        voiceBtn.addEventListener("click", () => {
          openPicker(voiceBtn, row, true, (item) => {
            row.voice_refmod = item.name;
          });
        });
        const clearVoice = el("button", "h3m-btn", "Clear");
        stop(clearVoice);
        clearVoice.addEventListener("click", () => {
          row.voice_refmod = "";
          renderList();
          commit();
        });
        voiceLine.append(voiceBtn, clearVoice);
        view.appendChild(voiceLine);
      }

      const note = visionNote.get(row.id);
      if (note) view.appendChild(el("div", "h3m-note", note));
    }

    check.addEventListener("change", () => {
      row.enabled = check.checked;
      renderList();
      commit();
    });
    view.addEventListener("pointerdown", (e) => {
      if (e.target.closest("input, select, button, textarea, .h3m-grip")) return;
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
        const over = document.elementFromPoint(me.clientX, me.clientY)?.closest?.(".h3m-row");
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

  function graphLink(linkId) {
    const links = app.graph?.links;
    if (!links || linkId == null) return null;
    if (typeof links.get === "function") return links.get(linkId) || links.get(String(linkId)) || null;
    return links[linkId] || null;
  }

  function loaderSettings() {
    const index = node.inputs?.findIndex((input) => input && input.name === "llm");
    if (index == null || index < 0) return null;
    const link = graphLink(node.inputs[index].link);
    const origin = link && (Array.isArray(link) ? link[1] : link.origin_id);
    const source = origin == null ? null : app.graph.getNodeById(origin);
    if (!source) return null;
    const widget = (name) => source.widgets?.find((item) => item.name === name);
    const backend = String(widget("backend")?.value || "GGUF").toLowerCase();
    const model = widget("model_name");
    if (backend !== "http" && (!model || !model.value)) return null;
    const mmproj = widget("mmproj_name");
    const gpu = widget("n_gpu_layers");
    return {
      backend,
      model_name: model?.value || "",
      mmproj_name: mmproj ? mmproj.value : "none",
      n_ctx: Number(widget("n_ctx")?.value) || 16384,
      n_gpu_layers: gpu ? Number(gpu.value) : -1,
      keep_loaded: !!widget("keep_loaded")?.value,
      base_url: widget("base_url")?.value || "http://localhost:1234/v1",
      model: widget("model")?.value || "local",
      api_key: widget("api_key")?.value || "none",
    };
  }

  function instructionSettings() {
    const index = node.inputs?.findIndex((input) => input && input.name === "instructions");
    if (index == null || index < 0) return null;
    const link = graphLink(node.inputs[index].link);
    const origin = link && (Array.isArray(link) ? link[1] : link.origin_id);
    const source = origin == null ? null : app.graph.getNodeById(origin);
    if (!source) return null;
    const widget = (name) => source.widgets?.find((item) => item.name === name);
    return {
      extra: widget("extra_instructions")?.value || "",
      override_gemma: widget("override_gemma")?.value || "",
      override_qwen: widget("override_qwen")?.value || "",
    };
  }

  async function askVision(payload) {
    const loader = loaderSettings();
    const response = await api.fetchApi("/h3subjectrefmod/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({
        loader: loader || {},
        instructions: instructionSettings(),
      }, payload)),
    });
    let body = {};
    try { body = await response.json(); } catch (e) { body = {}; }
    if (!response.ok || body.error) throw new Error(body.error || "The writer did not answer.");
    return body;
  }

  async function describeRow(row) {
    if (visionBusy) return;
    const name = conceptOf(row) === "voice" ? (row.voice_refmod || row.refmod) : row.refmod;
    if (!name) {
      setHint("Choose a RefMod first.", true);
      return;
    }
    visionBusy = true;
    startVisionClock("describe", row.id);
    setHint("Describing…", true);
    renderList();
    let wrote = false;
    try {
      const body = await askVision({
        job: "describe",
        image: "refmod:" + name,
        concept: conceptOf(row),
      });
      visionNote.delete(row.id);
      row.who = body.who || row.who;
      row.keep = body.keep || row.keep;
      if (body.note) visionNote.set(row.id, body.note);
      wrote = true;
    } catch (e) {
      const message = e.message || "Describe failed.";
      visionNote.set(row.id, message);
      setHint(message, true);
    } finally {
      finishVision();
      renderList();
      if (wrote) commit();
    }
  }

  async function saveRowToRefmod(row) {
    const name = row.refmod;
    const who = String(row.who || "").trim();
    if (!name) {
      setHint("Choose a RefMod first.", true);
      return;
    }
    if (!who) {
      setHint("Add a who line, then Save.", true);
      return;
    }
    try {
      // Same working POST as Describe/Draft — avoids a separate route that
      // may not be registered until a full Comfy restart.
      const body = await askVision({
        job: "save_description",
        name,
        description: who,
        keep: String(row.keep || "").trim(),
        concept: conceptOf(row),
      });
      row.description = body.description || who || row.description;
      if (body.keep) row.keep = body.keep;
      catalogCache = null;
      const note = "Saved who + keep into the RefMod file.";
      visionNote.set(row.id, note);
      setHint(note, false);
      renderList();
      write();
    } catch (e) {
      setHint(e.message || "Save failed.", true);
    }
  }

  async function runDraft() {
    if (visionBusy) return;
    if (!String(state.idea || "").trim()) {
      setHint("Write the draft first.", true);
      return;
    }
    if (!loaderSettings()) {
      setHint("Connect LLM (GGUF) - Loader to the llm input.", true);
      return;
    }
    visionBusy = true;
    draftBtn.disabled = true;
    draftBtn.classList.add("busy");
    startVisionClock("draft");
    setHint("Drafting the summary, opening, and shots…", true);
    closeDraft();
    try {
      const lengthWidget = node.widgets?.find((item) => item.name === "length");
      const body = await askVision({
        job: "draft",
        state,
        length: Number(node._h3hsFrames) || Number(lengthWidget?.value) || 124,
      });
      draftResult = body;
      showDraft([
        "summary:",
        body.summary || "",
        "",
        "opening:",
        body.opening || "",
        "",
        "detailed_description:",
        body.detailed || "",
        "",
        "overall_soundscape:",
        body.soundscape || "room tone",
      ].join("\n"));
      setHint("Draft ready. Accept or discard.", false);
    } catch (e) {
      setHint(e.message || "Draft failed.", true);
    } finally {
      finishVision();
      draftBtn.disabled = false;
      draftBtn.classList.remove("busy");
      draftBtn.textContent = "Draft";
    }
  }

  function closeSceneMenu() {
    sceneMenu.style.display = "none";
    sceneMenu.innerHTML = "";
  }

  const SCENE_KEYS = ["idea", "summary", "opening", "detailed", "soundscape", "music"];

  async function listSceneNames() {
    return (await listUser(SCENE_DIR))
      .map((item) => (typeof item === "string" ? item : item?.name || ""))
      .filter(Boolean)
      .map((name) => name.replace(/^.*[\\/]/, "").replace(/\.json$/i, ""))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  async function saveScene() {
    const detailed = String(state.detailed || "").trim();
    if (!detailed) {
      setHint("Accept a draft or write the shots first.", true);
      return;
    }
    const suggested = safeName(state.idea).slice(0, 48) || "scene";
    const name = safeName(window.prompt("Save scene as:", suggested) || "");
    if (!name) return;
    const existing = await listSceneNames();
    if (existing.includes(name) && !window.confirm(`Overwrite saved scene "${name}"?`)) return;
    const payload = { name };
    for (const key of SCENE_KEYS) payload[key] = String(state[key] || "").trim();
    try {
      await writeUser(`${SCENE_DIR}/${name}.json`, JSON.stringify(payload));
      setHint("Scene saved. RefMod rows were left out of it.", false);
    } catch (e) {
      setHint("Couldn't save that scene.", true);
    }
  }

  function insertScene(data) {
    if ("idea" in data) {
      state.idea = String(data.idea || "");
      ideaBox.value = state.idea;
    }
    for (const key of SCENE_KEYS) {
      if (key === "idea" || !(key in data)) continue;
      putBox(key, String(data[key] || ""));
    }
    commit();
  }

  async function openSceneMenu() {
    if (sceneMenu.style.display !== "none") { closeSceneMenu(); return; }
    sceneMenu.innerHTML = "";
    const save = el("div", "h3m-mitem");
    const saveAs = el("span", "h3m-mname", "+ Save this scene…");
    save.appendChild(saveAs);
    saveAs.addEventListener("click", async () => {
      closeSceneMenu();
      await saveScene();
    });
    sceneMenu.appendChild(save);
    const names = await listSceneNames();
    if (!names.length) sceneMenu.appendChild(el("div", "h3m-mhdr", "No saved scenes yet."));
    for (const name of names) {
      let idea = "";
      try {
        idea = String(JSON.parse(await readUser(`${SCENE_DIR}/${name}.json`) || "{}").idea || "");
      } catch (e) { /* the name still inserts or drops */ }
      const item = el("div", "h3m-mitem");
      const label = el("span", "h3m-mname", name);
      label.title = idea || ("Insert " + name);
      const del = el("button", "h3m-btn h3m-drop", "Drop");
      del.title = "Delete the saved scene";
      stop(del);
      item.append(label, del);
      sceneMenu.appendChild(item);
      label.addEventListener("click", async () => {
        const text = await readUser(`${SCENE_DIR}/${name}.json`);
        closeSceneMenu();
        if (!text) { setHint("That saved scene is missing.", true); return; }
        try {
          insertScene(JSON.parse(text));
          setHint(`Inserted “${name}”. RefMod rows stayed as they are.`, false);
        } catch (e) {
          setHint("Could not load that scene.", true);
        }
      });
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!window.confirm(`Drop saved scene "${name}"?`)) return;
        try { await api.deleteUserData(`${SCENE_DIR}/${name}.json`); } catch (err) {}
        closeSceneMenu();
        openSceneMenu();
      });
    }
    const rect = scenesBtn.getBoundingClientRect();
    sceneMenu.style.display = "";
    sceneMenu.style.left = Math.min(rect.left, window.innerWidth - 240) + "px";
    sceneMenu.style.top = (rect.bottom + 4) + "px";
  }

  function syncFromState() {
    keepMotion();
    taskSel.value = state.task || "reference generation";
    ideaBox.value = state.idea || "";
    styleSel.value = STYLES.some(([value]) => value === state.style_mode) ? state.style_mode : "amateur";
    shotSel.value = SHOTS.includes(state.shot_size) ? state.shot_size : "medium close-up";
    draftWrap.querySelectorAll("[data-pass]").forEach((button) => {
      button.classList.toggle("on", button.dataset.pass === state.pass);
    });
    draftWrap.querySelectorAll("[data-motion]").forEach((button) => {
      button.classList.toggle("on", !!state.motion[button.dataset.motion]);
    });
    root.querySelectorAll("textarea[data-key]").forEach((box) => {
      box.value = state[box.dataset.key] || "";
    });
    paintPromptHead();
    persistChrome();
  }

  addBtn.addEventListener("click", () => {
    const row = newMod();
    state.mods.push(row);
    state.active = row.id;
    renderList();
    commit();
  });
  newBtn.addEventListener("click", () => {
    const active = state.mods.find((row) => row.id === state.active);
    openCreatePanel(active || null);
  });
  scenesBtn.addEventListener("click", () => openSceneMenu());
  // Capture phase: the panel root stops pointerdown bubbling, so a bubble
  // listener never saw clicks inside the node and the menu stayed open.
  document.addEventListener("pointerdown", (e) => {
    if (sceneMenu.style.display !== "none" && !sceneMenu.contains(e.target) && !scenesBtn.contains(e.target)) {
      closeSceneMenu();
    }
  }, true);

  if (host) {
    host.container.appendChild(root);
  } else {
    const domWidget = node.addDOMWidget("h3subject_ui", "h3-subject", root, {
      serialize: false,
      hideOnZoom: false,
      getMinHeight: () => 160,
    });
    repairWidgetWidth(domWidget);
  }

  const previousConfigure = node.onConfigure;
  node.onConfigure = function () {
    if (!host) node._h3sConfigured = true;
    previousConfigure?.apply(this, arguments);
    if (host && node._h3hsMode && node._h3hsMode !== "refmods") return;
    try {
      const parsed = JSON.parse(stateWidget.value || "{}");
      if (parsed && typeof parsed === "object") state = migrateMods(parsed);
    } catch (e) { /* keep editor */ }
    if (!Array.isArray(state.mods)) state.mods = [];
    syncFromState();
    write();
    renderList();
    assemble();
  };

  const previousRemoved = node.onRemoved;
  node.onRemoved = function () {
    previousRemoved?.apply(this, arguments);
    closeSceneMenu();
    finishVision();
    document.querySelectorAll(".h3m-picker, .h3m-pick-blanket, .h3m-create").forEach((node) => node.remove());
    sceneMenu.remove();
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
      if (node._h3sConfigured) return;
      node.setSize?.([
        Math.max(Number(node.size?.[0]) || 560, 560),
        Math.max(Number(node.size?.[1]) || 420, 420),
      ]);
    }, 0);
  }
}

globalThis.H3SubjectPanels = globalThis.H3SubjectPanels || {};
globalThis.H3SubjectPanels.refmods = setup;

app.registerExtension({
  name: "h3subject.prompt.refmod",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "H3SubjectPromptRefMod") return;
    if (nodeType.prototype._h3mPatched) return;
    nodeType.prototype._h3mPatched = true;
    const previous = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      previous?.apply(this, arguments);
      setup(this);
    };
  },
});
