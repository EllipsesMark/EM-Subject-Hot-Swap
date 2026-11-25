// Internal Ref Images panel for EM Subject Hot Swap.
// The original external H3 Subject Prompt node is not changed.

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
const KINDS = [["picture", "Picture"], ["video", "Video"], ["audio", "Audio"]];
const PICTURE_MARKERS = ["fully_preserved", "partially_preserved", "attribute_transfer", "weak_reference"];
const AUDIO_MARKERS = ["fully_copy", "partially_copy", "reference", "weak_reference"];
const PICTURE_MEANING = {
  fully_preserved: "The defined role of the referenced content is fully preserved",
  partially_preserved: "The referenced content is still used, but some defined characteristics are changed or only partially retained",
  attribute_transfer: "Referenced characteristics are transferred to a different identifiable target subject",
  weak_reference: "Only broad similarity in style, category, composition, or atmosphere is retained",
};
const AUDIO_MEANING = {
  fully_copy: "The complete source audio serves as the target video's complete final audio track",
  partially_copy: "Only part of the timeline or selected audio layers are copied, or other sounds are added, removed, or replaced after copying",
  reference: "The signal is not copied directly; only timbre, rhythm, music style, dialogue content, or sound texture is referenced",
  weak_reference: "Only broad similarity in category or atmosphere is retained",
};
const STARTER_OUTFITS = [
  "she is completely nude",
  "he is completely nude",
  "she is nude from the waist up",
  "she is wearing a short dress",
  "she is wearing a t-shirt and underwear",
];
const KEEP_STARTERS = [
  "identity, facial features, skin tone, and hair are retained",
  "identity, facial features, body proportions, and skin tone are retained",
  "face, bone structure, and hairstyle carry over exactly",
  "the layout, surfaces, and light are retained",
];
const OPENING_STARTERS = [
  "The target video uses a live-action, amateur handheld camera style.",
  "The target video is a live-action cinematic scene with slight camera movement.",
  "The target video is a static locked shot in available light, with no camera movement.",
  "The target video uses a realistic style with warm indoor lighting.",
  "The target video is in a cinematic music-video style with soft lighting.",
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
const AUDIO_CLAUSE = {
  fully_copy: "the file is the complete final audio track",
  partially_copy: "only the selected stretch is copied",
  reference: "timbre, rhythm, and delivery are referenced without copying the signal",
  weak_reference: "only the broad category and atmosphere are followed",
};
const GLOSSARY = new Set([
  "the defined role of the referenced content is fully preserved",
  "the referenced content is still used, but some defined characteristics are changed or only partially retained",
  "referenced characteristics are transferred to a different identifiable target subject",
  "only broad similarity in style, category, composition, or atmosphere is retained",
  "the complete source audio serves as the target video's complete final audio track",
  "only part of the timeline or selected audio layers are copied, or other sounds are added, removed, or replaced after copying",
  "the signal is not copied directly; only timbre, rhythm, music style, dialogue content, or sound texture is referenced",
  "only broad similarity in category or atmosphere is retained",
  "only the timbre, rhythm, style, and delivery are referenced without copying the signal",
]);

function settledClause(text, fill, glossaryFallback) {
  const raw = String(text || "").trim();
  const low = raw.replace(/\.+$/, "").toLowerCase();
  if (!raw) return fill || "";
  if (GLOSSARY.has(low)) return glossaryFallback;
  for (const gloss of GLOSSARY) {
    if (low.startsWith(gloss + " ") || low.startsWith(gloss + ".")) {
      const rest = raw.slice(gloss.length).replace(/^[\s.]+/, "");
      return rest || glossaryFallback;
    }
  }
  return raw;
}
const SUBJ_DIR = "h3subjectref/subjects";
const SCENE_DIR = "h3subjectref/scenes";
const WARD_FILE = "h3subjectref/wardrobes.json";
let imageFiles = [];
let imageFolders = [];
let audioFiles = [];
let audioFolders = [];

const CSS = `
.h3sr-root { box-sizing:border-box; width:100%; height:100%; min-height:0;
  display:flex; flex-direction:column; gap:6px; padding:8px; overflow:auto;
  background:#1a1a1a; color:#ddd; border:1px solid #555; border-radius:8px;
  font:12px/1.4 sans-serif; }
.h3sr-root *, .h3sr-root *::before, .h3sr-root *::after { box-sizing:border-box; }
.h3sr-bar { display:flex; align-items:center; gap:6px; min-width:0; }
.h3sr-title { color:#46b4e6; font-weight:700; font-size:13px; white-space:nowrap; }
.h3sr-hint { color:#888; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-left:auto; }
.h3sr-hint.alert { color:#e7b15a; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2;
  white-space:normal; overflow:hidden; text-overflow:ellipsis; }
.h3sr-note { color:#e7b15a; white-space:pre-wrap; word-break:break-word; }
.h3sr-btn { background:#333; border:1px solid #555; border-radius:4px; color:#bbb;
  font:11px sans-serif; cursor:pointer; padding:2px 8px; line-height:16px; white-space:nowrap; }
.h3sr-btn:hover { border-color:#46b4e6; color:#fff; }
.h3sr-btn.on { border-color:#46b4e6; color:#46b4e6; background:#2a3a42; }
.h3sr-btn:disabled { opacity:.55; cursor:wait; }
.h3sr-btn.busy, .h3sr-btn.busy:disabled { background:#3a2a12; border-color:#e7b15a; color:#e7b15a; opacity:1; cursor:wait; }
.h3sr-btn.accept { background:#1e3d2a; border-color:#3d9a5f; color:#7dcea0; }
.h3sr-btn.accept:hover { background:#265238; border-color:#4cba72; color:#b6f0c9; }
.h3sr-btn.discard { background:#3d1e1e; border-color:#a33; color:#f0a0a0; }
.h3sr-btn.discard:hover { background:#a33; border-color:#a33; color:#fff; }
.h3sr-live { color:#e7b15a; font:11px sans-serif; white-space:nowrap; }
.h3sr-drop:hover { background:#a33; border-color:#a33; color:#fff; }
.h3sr-preview.draft-ready {
  border-color:#e7b15a; box-shadow:0 0 0 1px #e7b15a, 0 0 18px rgba(231,177,90,.22);
  background:#2a2418; animation:h3sr-draft-flash .9s ease-out 1;
}
@keyframes h3sr-draft-flash {
  0% { box-shadow:0 0 0 1px #e7b15a, 0 0 28px rgba(231,177,90,.55); }
  100% { box-shadow:0 0 0 1px #e7b15a, 0 0 18px rgba(231,177,90,.22); }
}
.h3sr-list { display:flex; flex-direction:column; gap:4px; padding-right:2px; }
.h3sr-empty { color:#888; padding:8px; }
.h3sr-band { display:flex; flex-direction:column; gap:4px; }
.h3sr-band-label, .h3sr-band-head { display:flex; align-items:center; gap:6px; width:100%;
  background:transparent; border:0; border-bottom:1px solid #333; border-radius:0;
  color:#46b4e6; font:600 11px monospace; padding:4px 0; text-align:left; }
.h3sr-band-head { cursor:pointer; }
.h3sr-band-head:hover { color:#7ec8ea; }
.h3sr-band-head .h3sr-band-meta { margin-left:auto; color:#666; font:11px sans-serif; font-weight:400; }
.h3sr-band-body { display:flex; flex-direction:column; gap:6px; }
.h3sr-row { background:#262626; border-radius:4px; padding:4px 6px; }
.h3sr-row.compact { padding:3px 6px; }
.h3sr-row.active { box-shadow:inset 0 0 0 1px #46b4e6; }
.h3sr-row.off { opacity:.45; }
.h3sr-row.dragging { opacity:.4; }
.h3sr-head { display:flex; align-items:center; gap:6px; min-width:0; }
.h3sr-grip { cursor:grab; color:#888; user-select:none; flex:0 0 auto; letter-spacing:-1px; }
.h3sr-num { font:bold 11px monospace; color:#888; width:18px; flex:0 0 auto; }
.h3sr-name { font-weight:650; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.h3sr-tag { color:#46b4e6; font:11px monospace; flex:0 0 auto; }
.h3sr-snip { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#888; }
.h3sr-body { display:flex; flex-direction:column; gap:5px; padding-top:6px; }
.h3sr-line { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.h3sr-line input[type=text], .h3sr-line select, .h3sr-root select, .h3sr-root textarea {
  background:#1d1d1d; border:1px solid #444; border-radius:4px; color:#ddd;
  font:13px monospace; padding:4px 6px; }
.h3sr-line input[type=text]:focus, .h3sr-root textarea:focus, .h3sr-root select:focus {
  border-color:#46b4e6; outline:none; }
.h3sr-grow { flex:1 1 160px; min-width:0; }
.h3sr-root textarea { width:100%; resize:vertical; min-height:36px; }
.h3sr-lbl { color:#46b4e6; font:600 11px monospace; margin-top:4px; }
.h3sr-mini { color:#888; font:11px sans-serif; }
.h3sr-joined { background:#1d1d1d; border-radius:4px; padding:5px 7px; color:#aaa;
  font:12px/1.45 monospace; white-space:pre-wrap; word-break:break-word; }
.h3sr-sec { display:flex; flex-direction:column; gap:3px; }
.h3sr-map { color:#888; font:11px/1.4 monospace; white-space:pre-wrap; }
.h3sr-preview { background:#1d1d1d; border:1px solid #444; border-radius:4px; margin:0;
  padding:8px; color:#bbb; font:12px/1.45 monospace;
  white-space:pre-wrap; word-break:break-word; }
.h3sr-menu { position:fixed; z-index:10000; background:#262626; border:1px solid #555;
  border-radius:6px; padding:4px; box-shadow:0 6px 20px rgba(0,0,0,.55);
  font:12px sans-serif; color:#ddd; max-height:60vh; overflow:auto; min-width:220px; max-width:360px; }
.h3sr-mitem { display:flex; align-items:center; gap:6px; padding:3px 5px; border-radius:4px; }
.h3sr-mitem:hover { background:#333; }
.h3sr-mname { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
.h3sr-mhdr { color:#888; padding:2px 6px 4px; }
.h3sr-thumb { width:168px; height:220px; object-fit:contain; border-radius:4px; background:#111; flex:0 0 auto; }
.h3sr-choose { flex:1 1 160px; min-width:0; text-align:left; overflow:hidden; text-overflow:ellipsis; }
.h3sr-picker { position:fixed; z-index:10001; display:flex; flex-direction:column; width:min(920px, calc(100vw - 16px));
  height:min(640px, calc(100vh - 16px)); background:#1a1a1a; color:#ddd; border:1px solid #555;
  border-radius:8px; box-shadow:0 10px 28px rgba(0,0,0,.6); overflow:hidden; font:12px/1.3 sans-serif; }
.h3sr-pick-search { display:flex; gap:6px; align-items:center; padding:8px; border-bottom:1px solid #333; }
.h3sr-pick-search input { flex:1; background:#141414; border:1px solid #444; border-radius:4px; color:#ddd; padding:5px 8px; font:12px sans-serif; }
.h3sr-pick-search input:focus { border-color:#46b4e6; outline:none; }
.h3sr-pick-split { flex:1; min-height:0; display:flex; }
.h3sr-pick-folders { width:132px; flex:none; overflow:auto; background:#141414; border-right:1px solid #333; }
.h3sr-pick-folder { display:flex; justify-content:space-between; gap:6px; padding:7px 8px; cursor:pointer; color:#aaa; }
.h3sr-pick-folder:hover { background:#2a2a2a; }
.h3sr-pick-folder.on { background:#1d3340; color:#46b4e6; }
.h3sr-pick-folder span:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.h3sr-pick-count { color:#777; font-size:10px; }
.h3sr-pick-pane { flex:1; min-width:0; overflow:auto; padding:8px; display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:8px; align-content:start; }
.h3sr-pick-card { display:flex; flex-direction:column; gap:4px; cursor:pointer; border-radius:4px; padding:3px; border:1px solid transparent; }
.h3sr-pick-card:hover { background:#262626; }
.h3sr-pick-card.on { border-color:#46b4e6; background:#1d3340; }
.h3sr-pick-card img { width:100%; height:220px; object-fit:contain; border-radius:3px; background:#111; }
.h3sr-pick-name { font-size:10px; color:#bbb; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.h3sr-pick-desc { font-size:10px; color:#888; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
.h3sr-afile { flex:1 1 140px; min-width:0; display:flex; align-items:center; justify-content:space-between; gap:6px;
  background:#1d1d1d; border:1px solid #444; border-radius:4px; padding:5px 8px; cursor:pointer; color:#ddd; }
.h3sr-afile:hover { border-color:#46b4e6; color:#fff; }
.h3sr-aname { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.h3sr-aar { color:#46b4e6; font-size:9px; flex:none; }
.h3sr-apop { position:fixed; z-index:10001; background:#232323; border:1px solid #555; border-radius:6px;
  box-shadow:0 10px 30px rgba(0,0,0,.5); overflow:auto; max-height:min(360px, 70vh); padding:3px 0;
  width:max-content; font:12px/1.35 sans-serif; }
.h3sr-apop-it { padding:5px 10px; cursor:pointer; color:#ddd; white-space:nowrap; }
.h3sr-apop-it:hover { background:#2f2f2f; }
.h3sr-apop-it.on { color:#46b4e6; }
.h3sr-apop-em { padding:6px 10px; color:#888; }
.h3sr-vprev { width:100%; max-height:150px; background:#000; border:1px solid #444; border-radius:4px; object-fit:contain; }
.h3sr-wavebox { background:#1d1d1d; border:1px solid #444; border-radius:4px; padding:6px; display:flex; flex-direction:column; gap:4px; }
.h3sr-wave { width:100%; height:64px; display:block; cursor:ew-resize; touch-action:none; }
.h3sr-times { display:flex; align-items:center; justify-content:space-between; gap:6px; font-size:10px; color:#777; }
.h3sr-times .sel { color:#46b4e6; }
.h3sr-pick-empty { grid-column:1 / -1; color:#888; padding:12px; }
.h3sr-pick-foot { display:flex; align-items:center; gap:8px; padding:6px 8px; border-top:1px solid #333; color:#888; }
`;

function ensureStyle() {
  if (document.getElementById("h3sr-style")) return;
  const s = document.createElement("style");
  s.id = "h3sr-style";
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

// The editor sits on top of the canvas, so LiteGraph never sees a middle-click
// that starts here. Pan the graph the same way KJNodes does.
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
    let el = e.target instanceof Element ? e.target : null;
    while (el && el !== element) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) return;
      el = el.parentElement;
    }
    if (element.scrollHeight <= element.clientHeight + 1) return;
    element.scrollTop += e.deltaY;
    e.preventDefault();
  }, { passive: false });
}

function uid() {
  return "s" + Math.random().toString(36).slice(2, 10);
}

function safeName(value) {
  return String(value || "").replace(/[\/\\:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
}

function newSubject() {
  return {
    id: uid(),
    enabled: true,
    name: "",
    kind: "picture",
    role: "person",
    who: "",
    keep: KEEP_STARTERS[0],
    wardrobe: "",
    marker: "fully_preserved",
    shots: "1",
    audio: false,
    audio_marker: "reference",
    audio_keep: "",
    image: "",
    audio_file: "",
    video_file: "",
    audio_start: 0,
    audio_end: 0,
    expanded: true,
  };
}

function defaultUi() {
  return { promptOpen: false };
}

function defaultState() {
  return {
    task: "reference generation",
    subjects: [],
    summary: "",
    opening: "",
    idea: "",
    detailed: "",
    soundscape: "",
    music: "",
    pass: "develop",
    style_mode: "amateur",
    shot_size: "medium close-up",
    motion: { weight: false, contact: false, follow: false, settle: false },
    subject_reinforced: true,
    wardrobes: [],
    active: "",
    ui: defaultUi(),
  };
}

function ensureUi(state) {
  if (!state.ui || typeof state.ui !== "object") state.ui = defaultUi();
  if (typeof state.ui.promptOpen !== "boolean") state.ui.promptOpen = false;
  return state.ui;
}

function markersFor(kind) {
  return kind === "audio" ? AUDIO_MARKERS : PICTURE_MARKERS;
}

function roleOf(row) {
  if (row && (row.role === "place" || row.role === "set")) return row.role;
  return "person";
}

function pieceText(desc) {
  return String(desc || "").replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "")
    .replace(/^(?:the|this)\s+outfit\s+consists\s+of\s+/i, "");
}

function pack(row) {
  return {
    name: row.name || "",
    kind: row.kind || "picture",
    role: roleOf(row),
    wears: row.wears || "",
    setId: row.setId || "",
    who: row.who || "",
    keep: row.keep || "",
    marker: row.marker || "fully_preserved",
    shots: row.shots || "1",
    audio: !!row.audio,
    audio_marker: row.audio_marker || "reference",
    audio_keep: row.audio_keep || "",
    image: row.image || "",
    audio_file: row.audio_file || "",
    video_file: row.video_file || "",
    audio_start: Number(row.audio_start) || 0,
    audio_end: Number(row.audio_end) || 0,
  };
}

function hideWidget(widget) {
  if (!widget) return;
  widget.hidden = true;
  widget.computeSize = () => [0, -4];
}

function repairWidgetWidth(widget) {
  if (!widget || widget.__h3sWidthGuard) return;
  const vueMode = () => Boolean(globalThis.LiteGraph?.vueNodesMode);
  let stored = vueMode() ? widget.width : undefined;
  try {
    Object.defineProperty(widget, "width", {
      configurable: true,
      enumerable: true,
      get() { return stored; },
      set(value) { stored = vueMode() ? value : undefined; },
    });
    widget.__h3sWidthGuard = true;
  } catch (e) { /* a frozen widget keeps Comfy's own width */ }
}

async function readUser(path) {
  try {
    const response = await api.getUserData(path);
    if (response.status !== 200) return null;
    return await response.text();
  } catch (e) {
    return null;
  }
}

async function writeUser(path, text) {
  await api.storeUserData(path, text, { overwrite: true, stringify: false, throwOnError: true });
}

function viewUrl(stored) {
  const raw = String(stored || "");
  if (raw.startsWith("wardrobe:")) {
    return api.apiURL("/h3subjectref/wardrobe/photo?file=" + encodeURIComponent(raw.slice("wardrobe:".length)));
  }
  const parts = raw.split(/[\\/]/).filter(Boolean);
  const filename = parts.pop() || "";
  if (!filename) return "";
  const subfolder = parts.join("/");
  const query = new URLSearchParams({ filename, type: "input", subfolder });
  return api.apiURL("/view?" + query.toString());
}

async function refreshImages() {
  try {
    const response = await api.fetchApi("/h3subjectref/images");
    const body = await response.json();
    const files = Array.isArray(body.files) ? body.files : [];
    imageFiles = files.map((item) => {
      if (typeof item === "string") return { path: item, folder: "", name: item };
      return {
        path: item.path || "",
        folder: item.folder || "",
        name: item.name || item.path || "",
      };
    }).filter((item) => item.path);
    imageFolders = Array.isArray(body.folders) ? body.folders : [];
  } catch (e) {
    imageFiles = [];
    imageFolders = [];
  }
}

function openImagePicker(anchor, current, onPick) {
  document.querySelectorAll(".h3sr-picker").forEach((node) => node.remove());
  const popup = el("div", "h3sr-picker");
  stop(popup);
  popup.addEventListener("mousedown", (e) => {
    if (e.button === 1) e.preventDefault();
  });
  popup.addEventListener("wheel", (e) => {
    e.stopPropagation();
    const scroller = e.target?.closest?.(".h3sr-pick-pane, .h3sr-pick-folders");
    if (scroller) scroller.scrollTop += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  const searchRow = el("div", "h3sr-pick-search");
  const search = document.createElement("input");
  search.type = "text";
  search.placeholder = "Filter images…";
  stop(search);
  searchRow.appendChild(search);
  const split = el("div", "h3sr-pick-split");
  const sidebar = el("div", "h3sr-pick-folders");
  const pane = el("div", "h3sr-pick-pane");
  split.append(sidebar, pane);
  const foot = el("div", "h3sr-pick-foot");
  const footText = el("span", null, "");
  footText.style.flex = "1";
  const upload = document.createElement("input");
  upload.type = "file";
  upload.accept = "image/*";
  upload.style.display = "none";
  const uploadBtn = el("button", "h3sr-btn", "Upload");
  stop(uploadBtn);
  stop(upload);
  foot.append(footText, uploadBtn, upload);
  popup.append(searchRow, split, foot);

  const currentFolder = (current || "").includes("/") ? current.split("/").slice(0, -1).join("/") : (current ? "" : "__all");
  let active = currentFolder;
  let query = "";

  function folderName(key) {
    return key === "" ? "root" : key;
  }

  function counts() {
    const map = new Map();
    map.set("", 0);
    for (const name of imageFolders) map.set(name, 0);
    for (const item of imageFiles) map.set(item.folder || "", (map.get(item.folder || "") || 0) + 1);
    return map;
  }

  function visibleFiles() {
    const q = query.trim().toLowerCase();
    return imageFiles.filter((item) => {
      if (q) return (item.name || "").toLowerCase().includes(q) || (item.path || "").toLowerCase().includes(q);
      if (active === "__all") return true;
      return (item.folder || "") === active;
    });
  }

  function renderSidebar() {
    sidebar.innerHTML = "";
    const map = counts();
    const keys = ["__all", "", ...imageFolders.filter((name) => name)];
    const seen = new Set();
    for (const key of keys) {
      if (seen.has(key)) continue;
      seen.add(key);
      const count = key === "__all" ? imageFiles.length : (map.get(key) || 0);
      const item = el("div", "h3sr-pick-folder" + (key === active && !query ? " on" : ""));
      item.append(el("span", null, key === "__all" ? "All" : folderName(key)), el("span", "h3sr-pick-count", String(count)));
      item.addEventListener("click", () => {
        active = key;
        query = "";
        search.value = "";
        render();
      });
      sidebar.appendChild(item);
    }
  }

  function renderPane() {
    pane.innerHTML = "";
    const files = visibleFiles();
    const label = query ? `filter “${query.trim()}”` : (active === "__all" ? "All" : folderName(active));
    footText.textContent = `${files.length} images · ${label}`;
    if (!files.length) {
      pane.appendChild(el("div", "h3sr-pick-empty", "No images in this folder."));
      return;
    }
    for (const item of files) {
      const card = el("div", "h3sr-pick-card" + (item.path === current ? " on" : ""));
      const img = document.createElement("img");
      img.alt = "";
      img.src = viewUrl(item.path);
      card.append(img, el("span", "h3sr-pick-name", item.name));
      card.title = item.path;
      card.addEventListener("click", () => {
        close();
        onPick(item.path);
      });
      pane.appendChild(card);
    }
  }

  function render() {
    renderSidebar();
    renderPane();
  }

  function close() {
    popup.remove();
    document.removeEventListener("pointerdown", onDoc, true);
    document.removeEventListener("keydown", onKey, true);
  }
  function onDoc(e) {
    if (popup.contains(e.target) || anchor.contains(e.target)) return;
    close();
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }

  search.addEventListener("input", () => {
    query = search.value;
    renderPane();
    renderSidebar();
  });
  uploadBtn.addEventListener("click", () => upload.click());
  upload.addEventListener("change", async () => {
    const picked = upload.files && upload.files[0];
    upload.value = "";
    if (!picked) return;
    const dest = active === "__all" ? "" : active;
    const body = new FormData();
    body.append("image", picked);
    body.append("overwrite", "true");
    body.append("type", "input");
    if (dest) body.append("subfolder", dest);
    try {
      const response = await api.fetchApi("/upload/image", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok || !payload.name) throw new Error("upload failed");
      const stored = payload.subfolder ? payload.subfolder + "/" + payload.name : payload.name;
      await refreshImages();
      close();
      onPick(stored);
    } catch (e) {
      window.alert("Couldn't upload that image.");
    }
  });

  document.body.appendChild(popup);
  // Near-fullscreen panel — center so bottom-of-node opens never clip.
  popup.style.left = "50%";
  popup.style.top = "50%";
  popup.style.transform = "translate(-50%, -50%)";
  document.addEventListener("pointerdown", onDoc, true);
  document.addEventListener("keydown", onKey, true);
  render();
  refreshImages().then(() => { if (popup.isConnected) render(); });
  search.focus();
}

async function refreshAudio() {
  try {
    const response = await api.fetchApi("/h3subjectref/audio");
    const body = await response.json();
    const files = Array.isArray(body.files) ? body.files : [];
    audioFiles = files.map((item) => {
      if (typeof item === "string") return { path: item, folder: "", name: item };
      return { path: item.path || "", folder: item.folder || "", name: item.name || item.path || "" };
    }).filter((item) => item.path);
    audioFolders = Array.isArray(body.folders) ? body.folders : [];
  } catch (e) {
    audioFiles = [];
    audioFolders = [];
  }
}

let videoFiles = [];

async function refreshVideos() {
  try {
    const response = await api.fetchApi("/h3subjectref/videos");
    const body = await response.json();
    const files = Array.isArray(body.files) ? body.files : [];
    videoFiles = files.map((item) => {
      if (typeof item === "string") return { path: item, folder: "", name: item };
      return { path: item.path || "", folder: item.folder || "", name: item.name || item.path || "" };
    }).filter((item) => item.path);
  } catch (e) {
    videoFiles = [];
  }
}

function openAudioPicker(anchor, current, onPick) {
  openListPicker(anchor, current, onPick, {
    load: async () => { await refreshAudio(); return audioFiles.filter((item) => !item.folder); },
    empty: "no sound files in ComfyUI's input folder",
  });
}

function openVideoPicker(anchor, current, onPick) {
  openListPicker(anchor, current, onPick, {
    load: async () => { await refreshVideos(); return videoFiles; },
    empty: "no video files in ComfyUI's input folder",
    label: (item) => (item.folder ? item.folder + "/" : "") + item.name,
  });
}

function openListPicker(anchor, current, onPick, { load, empty, label }) {
  document.querySelectorAll(".h3sr-apop").forEach((node) => node.remove());
  const popup = el("div", "h3sr-apop");
  popup.appendChild(el("div", "h3sr-apop-em", "reading the input folder..."));
  document.body.appendChild(popup);
  function place() {
    const margin = 8;
    const rect = anchor.getBoundingClientRect();
    const maxW = Math.max(180, Math.round(window.innerWidth - margin * 2));
    popup.style.maxWidth = maxW + "px";
    popup.style.width = "max-content";
    popup.style.minWidth = Math.min(maxW, Math.max(rect.width, 180)) + "px";
    const used = popup.offsetWidth;
    let left = Math.round(rect.left);
    if (left + used > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - margin - used);
    }
    popup.style.left = left + "px";
    const h = popup.offsetHeight;
    const below = window.innerHeight - rect.bottom;
    popup.style.top = (below < h + margin && rect.top > h + margin)
      ? Math.round(rect.top - h - 4) + "px"
      : Math.round(rect.bottom + 4) + "px";
  }
  place();

  function close() {
    popup.remove();
    document.removeEventListener("pointerdown", onDoc, true);
    document.removeEventListener("wheel", onWheel, true);
    document.removeEventListener("keydown", onKey, true);
  }
  function onDoc(e) {
    if (popup.contains(e.target) || anchor.contains(e.target)) return;
    close();
  }
  function onWheel(e) {
    if (!popup.contains(e.target)) close();
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }
  document.addEventListener("pointerdown", onDoc, true);
  document.addEventListener("wheel", onWheel, true);
  document.addEventListener("keydown", onKey, true);

  load().then((listed) => {
    if (!popup.isConnected) return;
    popup.textContent = "";
    const files = listed.slice();
    if (current && !files.some((item) => item.path === current)) {
      files.unshift({ path: current, folder: "", name: current.split(/[\\/]/).pop() });
    }
    if (!files.length) {
      popup.appendChild(el("div", "h3sr-apop-em", empty));
      place();
      return;
    }
    for (const item of files) {
      const text = label ? label(item) : item.name;
      const row = el("div", "h3sr-apop-it" + (item.path === current ? " on" : ""), text);
      row.title = text;
      row.addEventListener("click", () => { close(); onPick(item.path); });
      popup.appendChild(row);
    }
    place();
  });
}

const peakCache = new Map();
let audioPlayer = null;
let playRaf = 0;
let playButton = null;
let playPaint = null;

function stopAudio() {
  if (playRaf) {
    cancelAnimationFrame(playRaf);
    playRaf = 0;
  }
  if (audioPlayer) {
    try { audioPlayer.pause(); } catch (e) { /* already stopped */ }
    audioPlayer = null;
  }
  const btn = playButton;
  const paint = playPaint;
  playButton = null;
  playPaint = null;
  if (btn) btn.textContent = "Play";
  if (paint) paint();
}

function fmtAudio(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const rest = (s - m * 60).toFixed(1).padStart(4, "0");
  return m + ":" + rest;
}

function windowOf(row, duration) {
  const start = Math.max(0, Number(row.audio_start) || 0);
  let end = Number(row.audio_end) || 0;
  if (!(end > start)) end = duration;
  end = Math.min(duration, Math.max(start, end));
  return { start: Math.min(start, Math.max(0, end - 0.05)), end };
}

function loadPeaks(name) {
  if (!name) return Promise.resolve(null);
  if (peakCache.has(name)) return peakCache.get(name);
  const job = (async () => {
    const response = await fetch(viewUrl(name));
    if (!response.ok) throw new Error(String(response.status));
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error("no audio");
    const ctx = new Ctx();
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
    const buckets = 240;
    const peaks = new Float32Array(buckets);
    const channels = Math.min(buffer.numberOfChannels, 2);
    const per = buffer.length / buckets;
    for (let c = 0; c < channels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < buckets; i++) {
        const from = Math.floor(i * per);
        const to = Math.min(data.length, Math.floor((i + 1) * per));
        let peak = 0;
        const stride = Math.max(1, Math.floor((to - from) / 400));
        for (let j = from; j < to; j += stride) {
          const v = Math.abs(data[j]);
          if (v > peak) peak = v;
        }
        if (peak > peaks[i]) peaks[i] = peak;
      }
    }
    let max = 0;
    for (let i = 0; i < buckets; i++) if (peaks[i] > max) max = peaks[i];
    if (max > 0.0001) for (let i = 0; i < buckets; i++) peaks[i] /= max;
    try { ctx.close(); } catch (e) { /* the buffer is already decoded */ }
    return { peaks, duration: buffer.duration };
  })().catch(() => null);
  peakCache.set(name, job);
  return job;
}

function drawWave(canvas, peaks, from, to, playAt) {
  if (!canvas) return;
  const cssW = canvas.clientWidth || 1;
  const cssH = canvas.clientHeight || 64;
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  if (!peaks) return;
  const x0 = from * cssW;
  const x1 = to * cssW;
  ctx.fillStyle = "rgba(70,180,230,0.12)";
  ctx.fillRect(x0, 0, Math.max(0, x1 - x0), cssH);
  const n = peaks.length;
  const bw = cssW / n;
  const mid = cssH / 2;
  for (let i = 0; i < n; i++) {
    const x = i * bw;
    const inside = x + bw / 2 >= x0 && x + bw / 2 <= x1;
    ctx.fillStyle = inside ? "#46b4e6" : "#5a5a5a";
    const bh = Math.max(1, peaks[i] * (cssH - 6));
    ctx.fillRect(x + bw * 0.15, mid - bh / 2, Math.max(0.7, bw * 0.7), bh);
  }
  for (const x of [x0, x1]) {
    ctx.fillStyle = "#46b4e6";
    ctx.fillRect(Math.max(0, Math.min(cssW - 3, x - 1.5)), 0, 3, cssH);
    ctx.fillStyle = "#fff";
    ctx.fillRect(Math.max(0, Math.min(cssW - 5, x - 2.5)), cssH * 0.36, 5, cssH * 0.28);
  }
  if (playAt != null && playAt >= 0 && playAt <= 1) {
    const px = playAt * cssW;
    ctx.fillStyle = "#fff";
    ctx.fillRect(Math.max(0, Math.min(cssW - 2, px - 1)), 0, 2, cssH);
  }
}

function setup(node, opts = null) {
  const host = opts && opts.container ? opts : null;
  const flag = host ? "_h3srHotMounted" : "_h3sMounted";
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

  const state = defaultState();
  try {
    const parsed = JSON.parse(stateWidget.value || "{}");
    if (parsed && typeof parsed === "object") Object.assign(state, parsed);
  } catch (e) { /* a fresh node starts empty */ }
  if (!Array.isArray(state.subjects)) state.subjects = [];
  if (!Array.isArray(state.wardrobes)) state.wardrobes = [];
  ensureUi(state);
  hideOpenCards();
  keepMotion();

  function hideOpenCards() {
    for (const row of state.subjects || []) {
      if (row && typeof row === "object") row.expanded = false;
    }
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

  function persistChrome() {
    ensureUi(state);
    node.properties = node.properties || {};
    node.properties.h3sr_prompt_open = !!state.ui.promptOpen;
  }

  const write = () => {
    // Closed cards are what get saved. Prompt open/closed does persist.
    ensureUi(state);
    persistChrome();
    const raw = JSON.stringify(state, (key, value) => key === "expanded" ? false : value);
    stateWidget.value = raw;
    if (stateWidget.inputEl) stateWidget.inputEl.value = raw;
  };
  stateWidget.serializeValue = () => {
    write();
    return stateWidget.value;
  };

  let preview = { prompt: "", report: "", map: [], lines: [] };
  let timer = 0;
  let visionBusy = false;
  let visionKind = "";
  let describingId = null;
  let visionStarted = 0;
  let visionTick = 0;
  const visionNote = new Map();

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

  const root = el("div", "h3sr-root");
  stop(root);
  middleClickPan(root);
  wheelPassthrough(root);

  const bar = el("div", "h3sr-bar");
  const title = el("span", "h3sr-title", "EM Subject Hot Swap — Ref Images");
  const addBtn = el("button", "h3sr-btn", "Add subject");
  addBtn.title = "Add a subject row";
  const savedBtn = el("button", "h3sr-btn", "Saved ▾");
  savedBtn.title = "Save, edit, or drop a stored subject";
  const hint = el("span", "h3sr-hint", "Checked pictures load in order");
  function setHint(text, alert) {
    const full = String(text || "").replace(/\s+/g, " ").trim();
    const short = full.length > 160 ? full.slice(0, 159).replace(/\s+\S*$/, "") + "…" : full;
    hint.textContent = short;
    hint.classList.toggle("alert", !!alert);
    hint.title = full;
  }
  stop(addBtn);
  stop(savedBtn);
  bar.append(title, addBtn, savedBtn, hint);

  const refsBand = el("div", "h3sr-band");
  refsBand.appendChild(el("div", "h3sr-band-label", "Refs"));
  const list = el("div", "h3sr-list");
  refsBand.appendChild(list);
  const mapLine = el("div", "h3sr-map", "");

  function field(label, child) {
    const wrap = el("div", "h3sr-sec");
    const row = el("div", "h3sr-line");
    row.appendChild(el("span", "h3sr-lbl", label));
    if (child) row.appendChild(child);
    wrap.appendChild(row);
    return wrap;
  }

  function area(key, rows, placeholder) {
    const box = document.createElement("textarea");
    box.rows = rows;
    box.placeholder = placeholder;
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

  const draftWrap = el("div", "h3sr-sec");
  const styleShotLine = el("div", "h3sr-line");
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
    el("span", "h3sr-lbl", "style"), styleSel,
    el("span", "h3sr-lbl", "shot"), shotSel,
  );
  const ideaBar = el("div", "h3sr-line");
  const ideaActs = el("div", "h3sr-line");
  ideaActs.style.marginLeft = "auto";
  const draftBtn = el("button", "h3sr-btn", "Draft");
  draftBtn.title = "Write the summary, the opening, and the shots from the draft.";
  stop(draftBtn);
  const scenesBtn = el("button", "h3sr-btn", "Scenes ▾");
  scenesBtn.title = "Save or insert a scene. The character cards stay as they are.";
  stop(scenesBtn);
  for (const [key, label, title] of [
    ["close", "Close", "Stay close to the typed draft. Do not add events."],
    ["develop", "Develop", "Walk the typed draft across the whole clip."],
  ]) {
    const button = el("button", "h3sr-btn" + (state.pass === key ? " on" : ""), label);
    button.dataset.pass = key;
    button.title = title;
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
  ideaActs.append(draftBtn, scenesBtn);
  ideaBar.append(el("span", "h3sr-mini", "idea"), ideaActs);
  const ideaBox = document.createElement("textarea");
  ideaBox.rows = 3;
  ideaBox.placeholder = "the action, who does what, and a cut if there is one";
  ideaBox.title = "Write the action here, then Draft. The checked characters are who it expands.";
  ideaBox.value = state.idea || "";
  stop(ideaBox);
  ideaBox.addEventListener("input", () => {
    state.idea = ideaBox.value;
    write();
  });
  scenesBtn.addEventListener("click", () => openSceneMenu());
  const draftBand = el("div", "h3sr-band");
  draftBand.appendChild(el("div", "h3sr-band-label", "Draft"));
  draftWrap.append(styleShotLine, ideaBar, ideaBox);
  draftBand.appendChild(draftWrap);
  const motionRow = el("div", "h3sr-line");
  for (const [key, label, title] of [
    ["weight", "Weight", "The lead motion shows its start, its carry, and its landing."],
    ["contact", "Contact", "Name both sides of the contact and the sound it makes. The reaction stays on that cycle."],
    ["follow", "Follow-through", "Hair, breasts, soft tissue, and loose cloth answer the lead motion, and they move less than it."],
    ["settle", "Settle", "The shot ends on breathing or the body coming to rest."],
  ]) {
    const button = el("button", "h3sr-btn" + (state.motion[key] ? " on" : ""), label);
    button.dataset.motion = key;
    button.title = title;
    stop(button);
    button.addEventListener("click", () => {
      state.motion[key] = !state.motion[key];
      button.classList.toggle("on", state.motion[key]);
      write();
    });
    motionRow.appendChild(button);
  }
  draftWrap.appendChild(motionRow);
  const summaryWrap = field("summary:", taskSel);
  const summaryBox = area("summary", 3, "the woman sits on the sofa and looks at the camera");
  summaryWrap.appendChild(summaryBox);
  const openingWrap = clausePicker(state, "opening", "opening, before [Shot 1]", OPENING_STARTERS, "one or two sentences of style and light", "openings");
  const openingBox = openingWrap.querySelector("textarea");
  styleSel.addEventListener("change", () => {
    state.style_mode = styleSel.value;
    const phrase = STYLE_OPENINGS[state.style_mode] || STYLE_OPENINGS.cinematic;
    state.opening = "The target video is " + phrase + ".";
    if (openingBox) openingBox.value = state.opening;
    write();
  });
  shotSel.addEventListener("change", () => {
    state.shot_size = shotSel.value;
    write();
  });
  const detailedWrap = el("div", "h3sr-sec");
  const detailedHead = el("div", "h3sr-line");
  detailedHead.appendChild(el("span", "h3sr-lbl", "detailed_description:"));
  if (typeof state.subject_reinforced !== "boolean") state.subject_reinforced = true;
  const reinforceBtn = el(
    "button",
    "h3sr-btn" + (state.subject_reinforced ? " on" : ""),
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
  const draftView = el("pre", "h3sr-preview", "");
  draftView.style.display = "none";
  const draftActs = el("div", "h3sr-line");
  draftActs.style.display = "none";
  const acceptBtn = el("button", "h3sr-btn accept", "Accept");
  const discardBtn = el("button", "h3sr-btn discard", "Discard");
  stop(acceptBtn);
  stop(discardBtn);
  draftActs.append(acceptBtn, discardBtn);
  draftWrap.append(draftView, draftActs);
  let draftResult = null;
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
      const pick = box.parentElement?.querySelector("select");
      if (!pick) return;
      pick.value = [...pick.options].some((option) => option.value === value) ? value : "";
    });
  }
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
  const soundWrap = el("div", "h3sr-sec");
  soundWrap.appendChild(el("div", "h3sr-lbl", "overall_soundscape:"));
  soundWrap.appendChild(area("soundscape", 2, "room tone, fabric, breath"));
  const musicWrap = el("div", "h3sr-sec");
  musicWrap.appendChild(el("div", "h3sr-lbl", "non_diegetic_music:"));
  musicWrap.appendChild(area("music", 2, "leave empty for N/A"));

  const previewBar = el("div", "h3sr-line");
  const previewBtn = el("button", "h3sr-btn", "Preview");
  const copyBtn = el("button", "h3sr-btn", "Copy");
  stop(previewBtn);
  stop(copyBtn);
  const previewBox = el("pre", "h3sr-preview", "");
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

  const promptBand = el("div", "h3sr-band");
  const promptHead = el("button", "h3sr-band-head", "");
  stop(promptHead);
  const promptMeta = el("span", "h3sr-band-meta", "summary · opening · shots · sound");
  const promptBody = el("div", "h3sr-band-body");
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
  if (!dataHadUiPrompt() && typeof node.properties?.h3sr_prompt_open === "boolean") {
    ensureUi(state).promptOpen = !!node.properties.h3sr_prompt_open;
  }
  paintPromptHead();
  persistChrome();
  promptBand.append(promptHead, promptBody);

  root.append(bar, refsBand, mapLine, draftBand, promptBand);

  function activeRow() {
    return state.subjects.find((row) => row.id === state.active) || state.subjects.find((row) => row.expanded) || state.subjects[0];
  }

  function outfits() {
    const seen = new Set();
    const all = [];
    for (const line of [...STARTER_OUTFITS, ...state.wardrobes]) {
      const text = String(line || "").trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      all.push(text);
    }
    return all;
  }

  function applyPreview() {
    const byIndex = new Map((preview.lines || []).map((line) => [line.index, line]));
    list.querySelectorAll(".h3sr-row").forEach((view) => {
      const index = Number(view.dataset.index);
      const line = byIndex.get(index);
      const row = state.subjects[index];
      const tag = view.querySelector(".h3sr-tag");
      if (tag) tag.textContent = row && row.enabled === false ? "off" : (line?.tag || "");
      const joined = view.querySelector(".h3sr-joined");
      if (joined) {
        joined.textContent = line
          ? line.definition + "\n" + line.retention
          : "";
      }
    });
    const bits = [];
    if (preview.error) bits.push(preview.error);
    if (preview.map?.length) {
      bits.push(preview.map.map((row) => {
        if (row.file != null) return `${row.label} · ${row.name} · ${row.file || "no file"}`;
        return `${row.label} → ${row.wire} · ${row.name}`;
      }).join("\n"));
    }
    mapLine.textContent = bits.join("\n") || "No subjects are switched on.";
    previewBox.textContent = preview.prompt || "";
    const words = (preview.prompt || "").split(/\s+/).filter(Boolean).length;
    if (!visionBusy && visionNote.size === 0) {
      setHint(words ? `${words} words` : "Checked pictures load in order", false);
    }
    app.graph?.setDirtyCanvas(true, true);
  }

  async function assemble() {
    try {
      const response = await api.fetchApi("/h3subjectref/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const body = await response.json();
      if (!response.ok) {
        preview = { error: body.error || "preview failed", prompt: "", map: [], lines: [] };
      } else {
        preview = body;
      }
    } catch (e) {
      preview = { error: "Restart ComfyUI to load this node.", prompt: "", map: [], lines: [] };
    }
    applyPreview();
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(assemble, 120);
  }

  function commit() {
    write();
    schedule();
  }

  let clauseSeeded = false;

  let wardrobeCache = null;

  function applySet(person, item) {
    const pieces = pieceText(item.desc) || item.name || "the clothing set";
    person.wardrobe = "";
    let set = state.subjects.find((row) => row.role === "set" && row.wears === person.id && row.setId === item.id);
    if (!set) {
      set = newSubject();
      set.expanded = false;
      let at = state.subjects.indexOf(person);
      while (state.subjects[at + 1] && state.subjects[at + 1].role === "set" && state.subjects[at + 1].wears === person.id) at += 1;
      state.subjects.splice(at + 1, 0, set);
    }
    set.role = "set";
    set.wears = person.id;
    set.setId = item.id;
    set.enabled = person.enabled !== false;
    set.kind = "picture";
    set.name = item.name || "Clothing set";
    set.who = "a clothing set that includes " + pieces;
    set.keep = pieces;
    set.wardrobe = "";
    set.image = "wardrobe:" + item.photo;
    set.marker = "fully_preserved";
  }

  function openWardrobe(anchor, person) {
    document.querySelectorAll(".h3sr-picker").forEach((node) => node.remove());
    const popup = el("div", "h3sr-picker");
    stop(popup);
    popup.addEventListener("wheel", (e) => {
      e.stopPropagation();
      const scroller = e.target?.closest?.(".h3sr-pick-pane, .h3sr-pick-folders");
      if (scroller) scroller.scrollTop += e.deltaY;
      e.preventDefault();
    }, { passive: false });
    const searchRow = el("div", "h3sr-pick-search");
    const search = document.createElement("input");
    search.type = "text";
    search.placeholder = "Filter clothing sets…";
    stop(search);
    searchRow.appendChild(search);
    const split = el("div", "h3sr-pick-split");
    const sidebar = el("div", "h3sr-pick-folders");
    const pane = el("div", "h3sr-pick-pane");
    split.append(sidebar, pane);
    const foot = el("div", "h3sr-pick-foot");
    const footText = el("span", null, "Loading clothing sets…");
    footText.style.flex = "1";
    foot.appendChild(footText);
    popup.append(searchRow, split, foot);
    let active = "__all";
    let query = "";
    let categories = [];
    let items = [];

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
        const folder = el("div", "h3sr-pick-folder" + (tab.id === active ? " on" : ""));
        folder.append(el("span", null, tab.label), el("span", "h3sr-pick-count", String(count)));
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
        pane.appendChild(el("div", "h3sr-pick-empty", items.length ? "No sets in this tab." : "No clothing sets found."));
        return;
      }
      for (const item of shown) {
        const card = el("div", "h3sr-pick-card");
        const img = document.createElement("img");
        img.alt = "";
        img.src = viewUrl("wardrobe:" + item.photo);
        card.append(img, el("span", "h3sr-pick-name", item.name), el("span", "h3sr-pick-desc", pieceText(item.desc) || item.name));
        card.title = item.desc || item.name;
        card.addEventListener("click", () => {
          close();
          applySet(person, item);
          renderList();
          commit();
        });
        pane.appendChild(card);
      }
    }

    function close() {
      popup.remove();
      document.removeEventListener("pointerdown", onDoc, true);
      document.removeEventListener("keydown", onKey, true);
    }
    function onDoc(e) {
      if (popup.contains(e.target) || anchor.contains(e.target)) return;
      close();
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    search.addEventListener("input", () => { query = search.value; render(); });
    document.body.appendChild(popup);
    // Near-fullscreen panel — center so bottom-of-node opens never clip.
    popup.style.left = "50%";
    popup.style.top = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    document.addEventListener("pointerdown", onDoc, true);
    document.addEventListener("keydown", onKey, true);
    const ready = wardrobeCache ? Promise.resolve(wardrobeCache) : api.fetchApi("/h3subjectref/wardrobe").then((response) => response.json());
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

  function tiedSets(personId) {
    return state.subjects.filter((row) => row.role === "set" && row.wears === personId);
  }

  function clothingSection(row, snipEl) {
    if (roleOf(row) !== "person" || (row.kind || "picture") !== "picture") return null;
    const wrap = el("div", "h3sr-sec");
    wrap.appendChild(el("div", "h3sr-lbl", "clothing"));
    const tied = tiedSets(row.id);
    if (tied.length) {
      const setLine = el("div", "h3sr-line");
      setLine.appendChild(el("span", "h3sr-tag", tied[0].name || tied[0].who || "set"));
      const change = el("button", "h3sr-btn", "Change outfit");
      change.title = "Pick another clothing set for this character";
      stop(change);
      change.addEventListener("click", () => openWardrobe(change, row));
      const clear = el("button", "h3sr-btn", "Clear clothing");
      stop(clear);
      clear.addEventListener("click", () => {
        const ids = new Set(tied.map((item) => item.id));
        state.subjects = state.subjects.filter((item) => !ids.has(item.id));
        renderList();
        commit();
      });
      setLine.append(change, clear);
      wrap.appendChild(setLine);
      return wrap;
    }
    const line = el("div", "h3sr-line");
    const who = row.name || row.who || "subject";
    const wear = document.createElement("input");
    wear.type = "text";
    wear.className = "h3sr-grow";
    wear.placeholder = "a red bra";
    wear.title = who;
    wear.value = row.wardrobe || "";
    stop(wear);
    const outfit = document.createElement("select");
    const custom = el("option", null, "outfits");
    custom.value = "";
    outfit.appendChild(custom);
    for (const saved of outfits()) {
      const option = el("option", null, saved);
      option.value = saved;
      outfit.appendChild(option);
    }
    const more = el("option", null, "More...");
    more.value = "__more__";
    outfit.appendChild(more);
    outfit.value = outfits().includes(row.wardrobe) ? row.wardrobe : "";
    stop(outfit);
    const paint = () => {
      if (snipEl) snipEl.textContent = row.wardrobe || row.who || "";
    };
    outfit.addEventListener("change", () => {
      if (outfit.value === "__more__") {
        outfit.value = outfits().includes(row.wardrobe) ? row.wardrobe : "";
        openWardrobe(outfit, row);
        return;
      }
      if (!outfit.value) return;
      row.wardrobe = outfit.value;
      wear.value = outfit.value;
      paint();
      commit();
    });
    wear.addEventListener("input", () => {
      row.wardrobe = wear.value;
      outfit.value = outfits().includes(wear.value) ? wear.value : "";
      paint();
      commit();
    });
    const saveOutfit = el("button", "h3sr-btn", "Save outfit");
    saveOutfit.title = "Keep this phrase in the outfit list";
    stop(saveOutfit);
    saveOutfit.addEventListener("click", () => storeOutfit(wear.value));
    line.append(wear, outfit, saveOutfit);
    wrap.appendChild(line);
    return wrap;
  }

  function renderList() {
    clauseSeeded = false;
    list.innerHTML = "";
    if (!state.subjects.length) {
      list.appendChild(el("div", "h3sr-empty", "No subjects yet. Add one, or open Saved."));
      applyPreview();
      return;
    }
    state.subjects.forEach((row, index) => list.appendChild(renderRow(row, index)));
    applyPreview();
    if (clauseSeeded) commit();
  }

  function renderRow(row, index) {
    const expanded = !!row.expanded;
    const view = el(
      "div",
      "h3sr-row" + (expanded ? " active" : " compact") + (row.id === state.active ? " active" : "") + (row.enabled === false ? " off" : ""),
    );
    view.dataset.id = row.id;
    view.dataset.index = String(index);
    const head = el("div", "h3sr-head");
    const grip = el("span", "h3sr-grip", "⋮⋮");
    grip.title = "Drag to reorder";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = row.enabled !== false;
    check.title = "Switch this subject on or off";
    stop(check);
    const num = el("span", "h3sr-num", String(index + 1).padStart(2, "0"));
    const name = el("span", "h3sr-name", row.name || "subject");
    const tag = el("span", "h3sr-tag", row.enabled === false ? "off" : (row.role === "set" ? "set" : ""));
    const tiedFirst = roleOf(row) === "person" ? tiedSets(row.id)[0] : null;
    const snip = el("span", "h3sr-snip", row.wardrobe || tiedFirst?.name || tiedFirst?.who || row.who || "");
    const expand = el("button", "h3sr-btn" + (expanded ? " on" : ""), expanded ? "▾" : "▸");
    expand.title = expanded ? "Collapse who / keep / media" : "Expand who / keep / media";
    const save = el("button", "h3sr-btn", "Save");
    save.title = "Save this subject for other workflows";
    const drop = el("button", "h3sr-btn h3sr-drop", "Drop");
    drop.title = "Drop this subject from the prompt";
    for (const button of [expand, save, drop]) stop(button);
    head.append(grip, expand, check, num, name, tag, snip);
    if (visionBusy && visionKind === "describe" && describingId === row.id) {
      const badge = el("span", "h3sr-live", "Describing " + visionClock());
      badge.dataset.live = row.id;
      head.appendChild(badge);
    }
    head.append(expand, save, drop);
    view.appendChild(head);

    check.addEventListener("change", () => {
      row.enabled = check.checked;
      if (row.role !== "set") {
        for (const other of state.subjects) {
          if (other.role === "set" && other.wears === row.id) other.enabled = check.checked;
        }
      }
      renderList();
      commit();
    });
    expand.addEventListener("click", () => {
      row.expanded = !row.expanded;
      state.active = row.id;
      renderList();
      applyPreview();
      write();
    });
    save.addEventListener("click", () => saveSubject(row));
    drop.addEventListener("click", () => {
      const ids = new Set([row.id]);
      if (row.role !== "set") {
        for (const other of state.subjects) {
          if (other.role === "set" && other.wears === row.id) ids.add(other.id);
        }
      }
      state.subjects = state.subjects.filter((item) => !ids.has(item.id));
      if (ids.has(state.active)) state.active = "";
      renderList();
      commit();
    });
    head.addEventListener("pointerdown", () => { state.active = row.id; });

    grip.addEventListener("pointerdown", (e) => startDrag(e, view));

    if (row.expanded) {
      view.appendChild(renderBody(row, name, snip));
    } else {
      const cloth = clothingSection(row, snip);
      if (cloth) view.appendChild(cloth);
    }
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
    if (!loader) throw new Error("Connect LLM (GGUF) - Loader to the llm input.");
    const response = await api.fetchApi("/h3subjectref/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ loader, instructions: instructionSettings() }, payload)),
    });
    let body = {};
    try { body = await response.json(); } catch (e) { body = {}; }
    if (!response.ok || body.error) throw new Error(body.error || "The writer did not answer.");
    return body;
  }

  async function describeRow(row) {
    if (visionBusy) return;
    if (!row.image) {
      setHint("Choose an image first.", true);
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
        image: row.image,
        role: row.role === "place" ? "place" : "person",
      });
      visionNote.delete(row.id);
      row.who = body.who || row.who;
      row.keep = body.keep || row.keep;
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

  async function runDraft() {
    if (visionBusy) return;
    if (!String(state.idea || "").trim()) {
      setHint("Write the draft first.", true);
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

  function imageRow(row) {
    const wrap = el("div", "h3sr-sec");
    wrap.appendChild(el("div", "h3sr-lbl", "image"));
    const line = el("div", "h3sr-line");
    if (row.image) {
      const thumb = document.createElement("img");
      thumb.className = "h3sr-thumb";
      thumb.alt = "";
      thumb.src = viewUrl(row.image);
      line.appendChild(thumb);
    }
    const choose = el("button", "h3sr-btn h3sr-choose", String(row.image || "").startsWith("wardrobe:") ? (row.name || "clothing set") : (row.image || "Choose image"));
    choose.title = "Pick an image from the input folders";
    stop(choose);
    choose.addEventListener("click", () => {
      openImagePicker(choose, row.image || "", (path) => {
        row.image = path;
        renderList();
        commit();
      });
    });
    const live = visionBusy && visionKind === "describe" && describingId === row.id;
    const describe = el("button", "h3sr-btn" + (live ? " busy" : ""), live ? "Describing " + visionClock() : "Describe");
    describe.dataset.describe = row.id;
    describe.disabled = visionBusy;
    describe.title = row.role === "place"
      ? "Fill the place and what stays from this still."
      : "Fill who they are and what stays from this still. The outfit stays yours.";
    stop(describe);
    describe.addEventListener("click", () => describeRow(row));
    line.append(choose);
    if (row.role !== "set") line.append(describe);
    wrap.appendChild(line);
    const note = visionNote.get(row.id);
    if (note) wrap.appendChild(el("div", "h3sr-note", note));
    return wrap;
  }

  function videoFileRow(row) {
    const wrap = el("div", "h3sr-sec");
    wrap.appendChild(el("div", "h3sr-lbl", "video"));
    const line = el("div", "h3sr-line");
    const file = el("div", "h3sr-afile");
    const name = row.video_file ? row.video_file.split(/[\\/]/).pop() : "no video";
    file.append(el("span", "h3sr-aname", name), el("span", "h3sr-aar", "▼"));
    file.title = row.video_file
      ? row.video_file + " — loads at 24 fps, first 15 s, soundtrack included"
      : "Choose a video from ComfyUI's input folder (mp4, webm, mov, mkv)";
    stop(file);
    file.addEventListener("click", () => {
      openVideoPicker(file, row.video_file || "", (path) => {
        row.video_file = path;
        renderList();
        commit();
      });
    });
    const upload = document.createElement("input");
    upload.type = "file";
    upload.accept = "video/*,.mp4,.webm,.mov,.mkv,.m4v";
    upload.style.display = "none";
    const uploadBtn = el("button", "h3sr-btn", "Upload");
    uploadBtn.title = "Copy a video into ComfyUI's input folder";
    stop(uploadBtn);
    stop(upload);
    uploadBtn.addEventListener("click", () => upload.click());
    upload.addEventListener("change", async () => {
      const picked = upload.files && upload.files[0];
      upload.value = "";
      if (!picked) return;
      const body = new FormData();
      body.append("image", picked);
      body.append("overwrite", "true");
      body.append("type", "input");
      try {
        const response = await api.fetchApi("/upload/image", { method: "POST", body });
        const payload = await response.json();
        if (!response.ok || !payload.name) throw new Error("upload failed");
        row.video_file = payload.name;
        await refreshVideos();
        renderList();
        commit();
      } catch (e) {
        window.alert("Couldn't upload that video.");
      }
    });
    line.append(file, uploadBtn, upload);
    wrap.appendChild(line);
    if (row.video_file) {
      const video = document.createElement("video");
      video.className = "h3sr-vprev";
      video.src = viewUrl(row.video_file);
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.title = "Hover to play";
      stop(video);
      video.addEventListener("mouseenter", () => { video.play().catch(() => {}); });
      video.addEventListener("mouseleave", () => { video.pause(); });
      wrap.appendChild(video);
    }
    return wrap;
  }

  function audioFileRow(row) {
    const wrap = el("div", "h3sr-sec");
    wrap.appendChild(el("div", "h3sr-lbl", "audio"));
    const line = el("div", "h3sr-line");
    const file = el("div", "h3sr-afile");
    const name = row.audio_file ? row.audio_file.split(/[\\/]/).pop() : "no audio";
    file.append(el("span", "h3sr-aname", name), el("span", "h3sr-aar", "▼"));
    file.title = row.audio_file ? name : "Choose a sound file from ComfyUI's input folder";
    stop(file);
    file.addEventListener("click", () => {
      openAudioPicker(file, row.audio_file || "", (path) => {
        row.audio_file = path;
        row.audio_start = 0;
        row.audio_end = 0;
        renderList();
        commit();
      });
    });
    const upload = document.createElement("input");
    upload.type = "file";
    upload.accept = "audio/*,.wav,.mp3,.flac,.ogg,.opus,.m4a,.aac,.aiff";
    upload.style.display = "none";
    const uploadBtn = el("button", "h3sr-btn", "Upload");
    uploadBtn.title = "Copy a sound file into ComfyUI's input folder";
    stop(uploadBtn);
    stop(upload);
    uploadBtn.addEventListener("click", () => upload.click());
    upload.addEventListener("change", async () => {
      const picked = upload.files && upload.files[0];
      upload.value = "";
      if (!picked) return;
      const body = new FormData();
      body.append("image", picked);
      body.append("overwrite", "true");
      body.append("type", "input");
      try {
        const response = await api.fetchApi("/upload/image", { method: "POST", body });
        const payload = await response.json();
        if (!response.ok || !payload.name) throw new Error("upload failed");
        row.audio_file = payload.name;
        row.audio_start = 0;
        row.audio_end = 0;
        peakCache.delete(payload.name);
        await refreshAudio();
        renderList();
        commit();
      } catch (e) {
        window.alert("Couldn't upload that audio.");
      }
    });
    line.append(file, uploadBtn, upload);
    wrap.appendChild(line);
    if (row.audio_file) wrap.appendChild(audioWindow(row));
    return wrap;
  }

  function audioWindow(row) {
    const box = el("div", "h3sr-wavebox");
    const canvas = document.createElement("canvas");
    canvas.className = "h3sr-wave";
    canvas.title = "Drag either edge to trim. Drag the middle to slide the selection.";
    const times = el("div", "h3sr-times");
    const startLabel = el("span", null, "");
    const selLabel = el("span", "sel", "");
    const endLabel = el("span", null, "");
    const play = el("button", "h3sr-btn", "Play");
    stop(play);
    times.append(startLabel, selLabel, play, endLabel);
    box.append(canvas, times);
    stop(canvas);

    let duration = 0;
    let peaks = null;
    let mine = null;
    const paint = () => {
      const win = windowOf(row, duration || 1);
      const from = duration ? win.start / duration : 0;
      const to = duration ? win.end / duration : 1;
      let playAt = null;
      if (mine && audioPlayer === mine && mine.duration) {
        playAt = mine.currentTime / mine.duration;
      }
      drawWave(canvas, peaks, from, to, playAt);
      startLabel.textContent = fmtAudio(win.start);
      selLabel.textContent = fmtAudio(Math.max(0, win.end - win.start));
      endLabel.textContent = fmtAudio(duration ? win.end : 0);
    };
    loadPeaks(row.audio_file).then((info) => {
      if (!info || !box.isConnected) return;
      peaks = info.peaks;
      duration = info.duration || 0;
      paint();
    });
    paint();

    play.addEventListener("click", () => {
      if (mine && audioPlayer === mine && !audioPlayer.paused) {
        stopAudio();
        return;
      }
      stopAudio();
      const player = new Audio(viewUrl(row.audio_file));
      mine = player;
      audioPlayer = player;
      playButton = play;
      playPaint = paint;
      const tick = () => {
        if (audioPlayer !== player) return;
        const length = player.duration || duration;
        const use = windowOf(row, length || 0);
        if (!box.isConnected || (length && player.currentTime >= use.end - 0.03)) {
          stopAudio();
          return;
        }
        paint();
        playRaf = requestAnimationFrame(tick);
      };
      player.addEventListener("loadedmetadata", () => {
        if (audioPlayer !== player) return;
        const length = player.duration || duration;
        const use = windowOf(row, length);
        try { player.currentTime = use.start; } catch (e) { /* not seekable yet */ }
        player.play().then(() => {
          if (audioPlayer !== player) return;
          play.textContent = "Stop";
          playRaf = requestAnimationFrame(tick);
        }).catch(() => {
          if (audioPlayer === player) stopAudio();
        });
      });
      player.addEventListener("ended", () => {
        if (audioPlayer === player) stopAudio();
      });
    });

    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !duration) return;
      e.preventDefault();
      const bounds = canvas.getBoundingClientRect();
      const xOf = (clientX) => Math.max(0, Math.min(duration, ((clientX - bounds.left) / bounds.width) * duration));
      let win = windowOf(row, duration);
      const x = xOf(e.clientX);
      let zone = "jump";
      if (Math.abs(x - win.start) <= duration * (8 / bounds.width)) zone = "start";
      else if (Math.abs(x - win.end) <= duration * (8 / bounds.width)) zone = "end";
      else if (x > win.start && x < win.end) zone = "move";
      const origin = x;
      const originStart = win.start;
      const originEnd = win.end;
      const move = (ev) => {
        const at = xOf(ev.clientX);
        if (zone === "start") {
          win.start = Math.min(at, win.end - 0.1);
        } else if (zone === "end") {
          win.end = Math.max(at, win.start + 0.1);
        } else if (zone === "move") {
          const span = originEnd - originStart;
          let next = originStart + (at - origin);
          next = Math.max(0, Math.min(duration - span, next));
          win.start = next;
          win.end = next + span;
        } else {
          const span = Math.max(0.1, originEnd - originStart);
          win.start = Math.max(0, Math.min(duration - span, at - span / 2));
          win.end = win.start + span;
        }
        row.audio_start = Math.round(win.start * 100) / 100;
        row.audio_end = Math.round(win.end * 100) / 100;
        paint();
      };
      const up = () => {
        canvas.releasePointerCapture?.(e.pointerId);
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        commit();
      };
      canvas.setPointerCapture?.(e.pointerId);
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    });
    return box;
  }

  function renderBody(row, nameEl, snipEl) {
    const body = el("div", "h3sr-body");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "name, for the library";
    nameInput.value = row.name || "";
    nameInput.className = "h3sr-grow";
    stop(nameInput);
    nameInput.addEventListener("input", () => {
      row.name = nameInput.value;
      nameEl.textContent = row.name || "subject";
      commit();
    });

    const kind = document.createElement("select");
    for (const [value, label] of KINDS) {
      const option = el("option", null, label);
      option.value = value;
      kind.appendChild(option);
    }
    kind.value = row.kind || "picture";
    stop(kind);
    kind.addEventListener("change", () => {
      row.kind = kind.value;
      const allowed = markersFor(row.kind);
      if (!allowed.includes(row.marker)) row.marker = row.kind === "audio" ? "reference" : "fully_preserved";
      const stock = new Set([...KEEP_STARTERS, ...Object.values(AUDIO_CLAUSE)]);
      const current = String(row.keep || "").trim();
      if (!current || stock.has(current)) {
        row.keep = row.kind === "audio"
          ? (AUDIO_CLAUSE[row.marker] || AUDIO_CLAUSE.reference)
          : KEEP_STARTERS[0];
      }
      state.active = row.id;
      renderList();
      commit();
    });
    const role = document.createElement("select");
    const roleChoices = row.role === "set"
      ? [["set", "Set"], ["person", "Person"], ["place", "Place"]]
      : [["person", "Person"], ["place", "Place"]];
    for (const [value, label] of roleChoices) {
      const option = el("option", null, label);
      option.value = value;
      role.appendChild(option);
    }
    role.value = roleOf(row);
    role.title = "A place is the room. A set is the clothing. A person can be sat on or straddled.";
    role.style.display = (row.kind || "picture") === "picture" ? "" : "none";
    stop(role);
    role.addEventListener("change", () => {
      row.role = role.value;
      if (row.role !== "set") {
        row.wears = "";
        row.setId = "";
      }
      const placeKeep = "the layout, surfaces, and light are retained";
      const personKeep = KEEP_STARTERS[0];
      const current = String(row.keep || "").trim();
      if (row.role === "place" && (!current || current === personKeep)) row.keep = placeKeep;
      if (row.role === "person" && current === placeKeep) row.keep = personKeep;
      renderList();
      commit();
    });
    const top = el("div", "h3sr-line");
    top.append(nameInput, kind, role);
    body.appendChild(top);
    if ((row.kind || "picture") === "picture") body.appendChild(imageRow(row));
    if ((row.kind || "picture") === "video") body.appendChild(videoFileRow(row));
    if ((row.kind || "picture") === "audio") body.appendChild(audioFileRow(row));

    const markerMeanings = (row.kind || "picture") === "audio" ? AUDIO_MEANING : PICTURE_MEANING;
    const markerValue = markersFor(row.kind).includes(row.marker) ? row.marker : markersFor(row.kind)[0];
    const keepFallback = (row.kind || "picture") === "audio"
      ? (AUDIO_CLAUSE[markerValue] || AUDIO_CLAUSE.reference)
      : KEEP_STARTERS[0];
    const keepFill = (row.kind || "picture") === "audio" ? keepFallback : "";
    const nextKeep = settledClause(row.keep, keepFill, keepFallback);
    if (nextKeep !== String(row.keep || "").trim()) {
      row.keep = nextKeep;
      clauseSeeded = true;
    }
    body.appendChild(labeledArea(
      "who",
      row,
      row.role === "place" ? "the place" : (row.role === "set" ? "the set" : "who they are"),
      row.role === "place" ? "the living room with the sofa and the window" : (row.role === "set" ? "a clothing set that includes a black lace bra and thigh-high stockings" : "the woman with tanned skin and a copper bob"),
      2
    ));
    body.appendChild(clausePicker(row, "keep", "what stays", (row.kind || "picture") === "audio" ? Object.values(AUDIO_CLAUSE) : KEEP_STARTERS, "add to this line"));
    const cloth = clothingSection(row, snipEl);
    if (cloth) body.appendChild(cloth);

    const marker = document.createElement("select");
    for (const value of markersFor(row.kind)) {
      const option = el("option", null, value);
      option.value = value;
      option.title = markerMeanings[value] || "";
      marker.appendChild(option);
    }
    marker.value = markerValue;
    marker.title = markerMeanings[marker.value] || "";
    stop(marker);
    marker.addEventListener("change", () => {
      row.marker = marker.value;
      marker.title = markerMeanings[marker.value] || "";
      commit();
    });
    const shots = document.createElement("input");
    shots.type = "text";
    shots.placeholder = "shots: 1";
    shots.value = row.shots || "1";
    shots.style.width = "88px";
    stop(shots);
    shots.addEventListener("input", () => { row.shots = shots.value; commit(); });
    const markRow = el("div", "h3sr-line");
    markRow.append(el("span", "h3sr-mini", "retention"), marker, el("span", "h3sr-mini", "shots"), shots);
    body.appendChild(markRow);

    if (row.kind === "picture") {
      const audio = document.createElement("input");
      audio.type = "checkbox";
      audio.checked = !!row.audio;
      stop(audio);
      const audioLabel = el("label", "h3sr-mini");
      audioLabel.style.display = "flex";
      audioLabel.style.gap = "4px";
      audioLabel.style.cursor = "pointer";
      audioLabel.append(audio, document.createTextNode("also write an Audio line for their voice"));
      audio.addEventListener("change", () => {
        row.audio = audio.checked;
        state.active = row.id;
        renderList();
        commit();
      });
      body.appendChild(audioLabel);
      if (row.audio) {
        body.appendChild(audioFileRow(row));
        const audioMarker = document.createElement("select");
        for (const value of AUDIO_MARKERS) {
          const option = el("option", null, value);
          option.value = value;
          option.title = AUDIO_MEANING[value] || "";
          audioMarker.appendChild(option);
        }
        audioMarker.value = AUDIO_MARKERS.includes(row.audio_marker) ? row.audio_marker : "reference";
        audioMarker.title = AUDIO_MEANING[audioMarker.value] || "";
        stop(audioMarker);
        audioMarker.addEventListener("change", () => {
          const current = String(row.audio_keep || "").trim();
          const stock = new Set(Object.values(AUDIO_CLAUSE));
          if (!current || stock.has(current) || GLOSSARY.has(current.replace(/\.+$/, "").toLowerCase())) {
            row.audio_keep = AUDIO_CLAUSE[audioMarker.value] || AUDIO_CLAUSE.reference;
          }
          row.audio_marker = audioMarker.value;
          audioMarker.title = AUDIO_MEANING[audioMarker.value] || "";
          renderList();
          commit();
        });
        const audioMark = el("div", "h3sr-sec");
        audioMark.append(el("div", "h3sr-lbl", "audio retention"), audioMarker);
        body.appendChild(audioMark);
        const voiceNext = settledClause(row.audio_keep, AUDIO_CLAUSE[audioMarker.value] || AUDIO_CLAUSE.reference, AUDIO_CLAUSE[audioMarker.value] || AUDIO_CLAUSE.reference);
        if (voiceNext !== String(row.audio_keep || "").trim()) {
          row.audio_keep = voiceNext;
          clauseSeeded = true;
        }
        body.appendChild(clausePicker(row, "audio_keep", "voice retention", Object.values(AUDIO_CLAUSE), "add to this line"));
      }
    }

    const joined = el("div", "h3sr-joined", "");
    body.appendChild(joined);
    return body;
  }

  function clausePicker(row, key, label, starters, placeholder, menuLabel) {
    const wrap = el("div", "h3sr-sec");
    wrap.appendChild(el("div", "h3sr-lbl", label));
    const line = el("div", "h3sr-line");
    const box = document.createElement("textarea");
    box.rows = 2;
    box.className = "h3sr-grow";
    box.placeholder = placeholder;
    box.value = row[key] || "";
    stop(box);
    const pick = document.createElement("select");
    const blank = el("option", null, menuLabel || "clauses");
    blank.value = "";
    pick.appendChild(blank);
    for (const text of starters) {
      const option = el("option", null, text);
      option.value = text;
      pick.appendChild(option);
    }
    pick.value = starters.includes(row[key]) ? row[key] : "";
    stop(pick);
    pick.addEventListener("change", () => {
      if (!pick.value) return;
      row[key] = pick.value;
      box.value = pick.value;
      commit();
    });
    box.addEventListener("input", () => {
      row[key] = box.value;
      pick.value = starters.includes(box.value) ? box.value : "";
      commit();
    });
    line.append(box, pick);
    wrap.appendChild(line);
    return wrap;
  }

  function labeledArea(key, row, label, placeholder, rows, display) {
    const wrap = el("div", "h3sr-sec");
    wrap.appendChild(el("div", "h3sr-lbl", label));
    const box = document.createElement("textarea");
    box.rows = rows;
    box.placeholder = placeholder;
    box.value = display == null ? (row[key] || "") : display;
    stop(box);
    box.addEventListener("input", () => {
      row[key] = box.value;
      commit();
    });
    wrap.appendChild(box);
    return wrap;
  }

  function startDrag(e, view) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    let dragging = false;
    const move = (me) => {
      if (!dragging && Math.abs(me.clientY - startY) < 4) return;
      dragging = true;
      view.classList.add("dragging");
      for (const other of list.querySelectorAll(".h3sr-row")) {
        if (other === view) continue;
        const rect = other.getBoundingClientRect();
        if (me.clientY < rect.top || me.clientY > rect.bottom) continue;
        const before = me.clientY < rect.top + rect.height / 2;
        list.insertBefore(view, before ? other : other.nextSibling);
        break;
      }
    };
    const up = () => {
      view.classList.remove("dragging");
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      if (!dragging) return;
      const ids = [...list.querySelectorAll(".h3sr-row")].map((item) => item.dataset.id);
      const byId = new Map(state.subjects.map((row) => [row.id, row]));
      state.subjects = ids.map((id) => byId.get(id)).filter(Boolean);
      renderList();
      commit();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }

  async function storeOutfit(text) {
    const line = String(text || "").trim();
    if (!line) return;
    if (!state.wardrobes.includes(line) && !STARTER_OUTFITS.includes(line)) {
      state.wardrobes.push(line);
    }
    try {
      await writeUser(WARD_FILE, JSON.stringify(state.wardrobes));
    } catch (e) {
      window.alert("Couldn't save the outfit list.");
    }
    commit();
    renderList();
  }

  async function saveSubject(row) {
    const suggested = safeName(row.name) || "subject";
    const name = safeName(window.prompt("Save subject as:", suggested) || "");
    if (!name) return;
    row.name = row.name || name;
    state.active = row.id;
    try {
      const existing = await listSubjectNames();
      if (existing.includes(name) && !window.confirm(`Overwrite saved subject "${name}"?`)) return;
      await writeUser(`${SUBJ_DIR}/${name}.json`, JSON.stringify(pack(row)));
    } catch (e) {
      window.alert("Couldn't save that subject.");
      return;
    }
    commit();
    renderList();
  }

  async function listSubjectNames() {
    try {
      const items = await api.listUserDataFullInfo(SUBJ_DIR);
      return items.map((item) => (item.path || "").split(/[\\/]/).pop() || "")
        .filter((file) => /\.json$/i.test(file))
        .map((file) => file.replace(/\.json$/i, ""))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    } catch (e) {
      return [];
    }
  }

  async function listSceneNames() {
    try {
      const items = await api.listUserDataFullInfo(SCENE_DIR);
      return items.map((item) => (item.path || "").split(/[\\/]/).pop() || "")
        .filter((file) => /\.json$/i.test(file))
        .map((file) => file.replace(/\.json$/i, ""))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    } catch (e) {
      return [];
    }
  }

  const sceneMenu = el("div", "h3sr-menu");
  sceneMenu.style.display = "none";
  document.body.appendChild(sceneMenu);

  function closeSceneMenu() { sceneMenu.style.display = "none"; }

  async function saveScene() {
    const detailed = String(state.detailed || "").trim();
    if (!detailed) {
      window.alert("Accept a draft or write the shots first.");
      return;
    }
    const suggested = safeName(state.idea).slice(0, 48) || "scene";
    const name = safeName(window.prompt("Save scene as:", suggested) || "");
    if (!name) return;
    try {
      const existing = await listSceneNames();
      if (existing.includes(name) && !window.confirm(`Overwrite saved scene "${name}"?`)) return;
      await writeUser(`${SCENE_DIR}/${name}.json`, JSON.stringify({
        name,
        idea: String(state.idea || "").trim(),
        summary: String(state.summary || "").trim(),
        opening: String(state.opening || "").trim(),
        detailed,
      }));
    } catch (e) {
      window.alert("Couldn't save that scene.");
    }
  }

  async function loadScene(name) {
    const text = await readUser(`${SCENE_DIR}/${name}.json`);
    if (!text) { window.alert("That saved scene is missing."); return null; }
    try { return JSON.parse(text); }
    catch (e) { window.alert("That saved scene isn't valid."); return null; }
  }

  async function insertScene(name) {
    const data = await loadScene(name);
    closeSceneMenu();
    if (!data) return;
    closeDraft();
    state.idea = String(data.idea || "");
    ideaBox.value = state.idea;
    if ("summary" in data) putBox("summary", String(data.summary || ""));
    if ("opening" in data) putBox("opening", String(data.opening || ""));
    putBox("detailed", String(data.detailed || ""));
    commit();
  }

  async function openSceneMenu() {
    if (sceneMenu.style.display !== "none") { closeSceneMenu(); return; }
    closeMenu();
    sceneMenu.innerHTML = "";
    const saveAs = el("button", "h3sr-btn", "+ Save this scene…");
    stop(saveAs);
    saveAs.addEventListener("click", async () => {
      closeSceneMenu();
      await saveScene();
    });
    const saveRow = el("div", "h3sr-mitem");
    saveRow.appendChild(saveAs);
    sceneMenu.appendChild(saveRow);
    const names = await listSceneNames();
    if (!names.length) sceneMenu.appendChild(el("div", "h3sr-mhdr", "No saved scenes yet."));
    for (const name of names) {
      let idea = "";
      try {
        const parsed = JSON.parse(await readUser(`${SCENE_DIR}/${name}.json`) || "{}");
        idea = String(parsed.idea || "");
      } catch (e) { /* the name still inserts or drops */ }
      const item = el("div", "h3sr-mitem");
      const label = el("span", "h3sr-mname", name);
      label.title = idea || ("Insert " + name);
      const del = el("button", "h3sr-btn h3sr-drop", "Drop");
      del.title = "Delete the saved scene";
      stop(del);
      item.append(label, del);
      sceneMenu.appendChild(item);
      label.addEventListener("click", () => insertScene(name));
      del.addEventListener("click", async () => {
        if (!window.confirm(`Drop saved scene "${name}"?`)) return;
        try { await api.deleteUserData(`${SCENE_DIR}/${name}.json`); } catch (e) {}
        sceneMenu.style.display = "none";
        openSceneMenu();
      });
    }
    sceneMenu.style.display = "";
    const rect = scenesBtn.getBoundingClientRect();
    sceneMenu.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - sceneMenu.offsetWidth - 4)) + "px";
    sceneMenu.style.top = Math.min(rect.bottom + 4, window.innerHeight - 8) + "px";
  }

  const menu = el("div", "h3sr-menu");
  menu.style.display = "none";
  document.body.appendChild(menu);
  node._h3sMenu = menu;

  function closeMenu() { menu.style.display = "none"; }

  async function openSavedMenu() {
    if (menu.style.display !== "none") { closeMenu(); return; }
    closeSceneMenu();
    await fillSavedMenu();
    menu.style.display = "";
    const rect = savedBtn.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 4)) + "px";
    menu.style.top = Math.min(rect.bottom + 4, window.innerHeight - 8) + "px";
  }

  async function fillSavedMenu() {
    menu.innerHTML = "";
    const saveAs = el("button", "h3sr-btn", "+ Save active…");
    stop(saveAs);
    saveAs.addEventListener("click", async () => {
      const row = activeRow();
      closeMenu();
      if (!row) { window.alert("Add a subject first."); return; }
      await saveSubject(row);
    });
    const saveRow = el("div", "h3sr-mitem");
    saveRow.appendChild(saveAs);
    menu.appendChild(saveRow);
    const names = await listSubjectNames();
    if (!names.length) menu.appendChild(el("div", "h3sr-mhdr", "No saved subjects yet."));
    for (const name of names) {
      const item = el("div", "h3sr-mitem");
      const label = el("span", "h3sr-mname", name);
      label.title = "Insert " + name + " as a new row";
      const edit = el("button", "h3sr-btn", "Edit");
      edit.title = "Load this into the active row";
      const del = el("button", "h3sr-btn h3sr-drop", "Drop");
      del.title = "Delete the saved subject";
      stop(edit);
      stop(del);
      item.append(label, edit, del);
      menu.appendChild(item);
      label.addEventListener("click", () => insertSaved(name));
      edit.addEventListener("click", () => editSaved(name));
      del.addEventListener("click", async () => {
        if (!window.confirm(`Drop saved subject "${name}"?`)) return;
        try { await api.deleteUserData(`${SUBJ_DIR}/${name}.json`); } catch (e) {}
        fillSavedMenu();
      });
    }
  }

  async function loadSaved(name) {
    const text = await readUser(`${SUBJ_DIR}/${name}.json`);
    if (!text) { window.alert("That saved subject is missing."); return null; }
    try { return JSON.parse(text); }
    catch (e) { window.alert("That saved subject isn't valid."); return null; }
  }

  async function insertSaved(name) {
    const data = await loadSaved(name);
    closeMenu();
    if (!data) return;
    const row = Object.assign(newSubject(), pack(data), { name: data.name || name, expanded: true });
    state.subjects.push(row);
    state.active = row.id;
    renderList();
    commit();
  }

  async function editSaved(name) {
    const data = await loadSaved(name);
    closeMenu();
    if (!data) return;
    const row = activeRow();
    if (!row) {
      await insertSaved(name);
      return;
    }
    Object.assign(row, pack(data), { name: data.name || name, expanded: true });
    state.active = row.id;
    renderList();
    commit();
  }

  addBtn.addEventListener("click", () => {
    const row = newSubject();
    state.subjects.push(row);
    state.active = row.id;
    renderList();
    commit();
  });
  savedBtn.addEventListener("click", () => openSavedMenu());
  // Capture phase: the panel root stops pointerdown bubbling, so a bubble
  // listener never saw clicks inside the node and the menus stayed open.
  document.addEventListener("pointerdown", (e) => {
    if (menu.style.display !== "none" && !menu.contains(e.target) && !savedBtn.contains(e.target)) closeMenu();
    if (sceneMenu.style.display !== "none" && !sceneMenu.contains(e.target) && !scenesBtn.contains(e.target)) closeSceneMenu();
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
    if (host && node._h3hsMode && node._h3hsMode !== "stills") return;
    try {
      const parsed = JSON.parse(stateWidget.value || "{}");
      if (parsed && typeof parsed === "object") {
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, defaultState(), parsed);
      }
    } catch (e) { /* keep the editor state */ }
    if (!Array.isArray(state.subjects)) state.subjects = [];
    if (!Array.isArray(state.wardrobes)) state.wardrobes = [];
    ensureUi(state);
    hideOpenCards();
    keepMotion();
    if (!dataHadUiPrompt() && typeof node.properties?.h3sr_prompt_open === "boolean") {
      ensureUi(state).promptOpen = !!node.properties.h3sr_prompt_open;
    }
    paintPromptHead();
    persistChrome();
    draftWrap.querySelectorAll("[data-motion]").forEach((button) => {
      button.classList.toggle("on", !!state.motion[button.dataset.motion]);
    });
    draftWrap.querySelectorAll("[data-pass]").forEach((button) => {
      button.classList.toggle("on", button.dataset.pass === state.pass);
    });
    write();
    taskSel.value = state.task || "reference generation";
    ideaBox.value = state.idea || "";
    styleSel.value = STYLES.some(([value]) => value === state.style_mode) ? state.style_mode : "amateur";
    shotSel.value = SHOTS.includes(state.shot_size) ? state.shot_size : "medium close-up";
    if (openingBox) openingBox.value = state.opening || "";
    root.querySelectorAll("textarea").forEach((box) => {
      const key = box.dataset.key;
      if (key) box.value = state[key] || "";
    });
    renderList();
    assemble();
  };

  // The section boxes are not inside the row list, so tag them for reload.
  root.querySelectorAll("textarea").forEach((box) => {
    if (box.placeholder.startsWith("the woman sits")) box.dataset.key = "summary";
    else if (box.placeholder.startsWith("one or two sentences")) box.dataset.key = "opening";
    else if (box.placeholder.startsWith("[Shot 1]")) box.dataset.key = "detailed";
    else if (box.placeholder.startsWith("room tone")) box.dataset.key = "soundscape";
    else if (box.placeholder.startsWith("leave empty")) box.dataset.key = "music";
  });

  const previousRemoved = node.onRemoved;
  node.onRemoved = function () {
    previousRemoved?.apply(this, arguments);
    closeMenu();
    closeSceneMenu();
    finishVision();
    menu.remove();
    sceneMenu.remove();
  };

  readUser(WARD_FILE).then((text) => {
    if (!text) return;
    try {
      const extra = JSON.parse(text);
      if (!Array.isArray(extra)) return;
      for (const line of extra) {
        const clean = String(line || "").trim();
        if (clean && !state.wardrobes.includes(clean)) state.wardrobes.push(clean);
      }
    } catch (e) { /* ignore a broken outfit file */ }
  });

  renderList();
  assemble();
  refreshImages().then(() => renderList());
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
globalThis.H3SubjectPanels.stills = setup;

app.registerExtension({
  name: "h3subject.prompt.ref",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "H3SubjectPromptRef") return;
    if (nodeType.prototype._h3srPatched) return;
    nodeType.prototype._h3srPatched = true;
    const previous = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      previous?.apply(this, arguments);
      setup(this);
    };
  },
});
