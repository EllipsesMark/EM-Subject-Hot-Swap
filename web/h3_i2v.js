// H3 Image to Video. Frames are picked in the panel (wires still win). Draft writes the base-guide prompt.

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

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

const CSS = `
.h3v-root { box-sizing:border-box; width:100%; height:100%; min-height:0;
  display:flex; flex-direction:column; gap:6px; padding:8px; overflow:auto;
  background:#1a1a1a; color:#ddd; border:1px solid #555; border-radius:8px;
  font:12px/1.4 sans-serif; }
.h3v-root *, .h3v-root *::before, .h3v-root *::after { box-sizing:border-box; }
.h3v-bar, .h3v-line { display:flex; align-items:center; gap:6px; min-width:0; flex-wrap:wrap; }
.h3v-title { color:#46b4e6; font-weight:700; font-size:13px; white-space:nowrap; }
.h3v-mode { color:#888; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.h3v-hint { color:#888; white-space:pre-wrap; word-break:break-word; }
.h3v-btn { background:#333; border:1px solid #555; border-radius:4px; color:#bbb;
  font:11px sans-serif; cursor:pointer; padding:2px 8px; line-height:16px; white-space:nowrap; }
.h3v-btn:hover { border-color:#46b4e6; color:#fff; }
.h3v-btn.on { border-color:#46b4e6; color:#46b4e6; background:#2a3a42; }
.h3v-btn:disabled { opacity:.55; cursor:wait; }
.h3v-btn.busy, .h3v-btn.busy:disabled { background:#3a2a12; border-color:#e7b15a; color:#e7b15a; opacity:1; cursor:wait; }
.h3v-lbl { color:#46b4e6; font:600 11px monospace; }
.h3v-grow { flex:1 1 120px; min-width:0; }
.h3v-root textarea, .h3v-root select, .h3v-root input[type=text] {
  background:#1d1d1d; border:1px solid #444; border-radius:4px; color:#ddd;
  font:13px monospace; padding:4px 6px; }
.h3v-root textarea { width:100%; resize:vertical; min-height:36px; }
.h3v-root textarea:focus, .h3v-root select:focus, .h3v-root input[type=text]:focus {
  border-color:#46b4e6; outline:none; }
.h3v-sec { display:flex; flex-direction:column; gap:3px; }
.h3v-preview { background:#1d1d1d; border:1px solid #444; border-radius:4px; margin:0;
  padding:8px; color:#bbb; font:12px/1.45 monospace;
  white-space:pre-wrap; word-break:break-word; }
.h3v-frames { display:flex; gap:8px; flex-wrap:wrap; }
.h3v-frame { flex:1 1 200px; min-width:0; display:flex; flex-direction:column; gap:4px;
  background:#1d1d1d; border:1px solid #444; border-radius:4px; padding:6px; }
.h3v-frame-head { display:flex; align-items:center; gap:6px; }
.h3v-frame-name { flex:1; min-width:0; color:#bbb; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.h3v-frame-thumb { width:100%; height:110px; object-fit:contain; background:#000; border-radius:3px; cursor:pointer; }
.h3v-frame-empty { height:110px; display:flex; align-items:center; justify-content:center;
  color:#666; border:1px dashed #444; border-radius:3px; cursor:pointer; }
.h3v-warn { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:6px 8px;
  background:#3a2a12; border:1px solid #e7b15a; border-radius:4px; color:#e7b15a; }
.h3v-warn span { flex:1 1 240px; min-width:0; }
.h3v-btn.warn { background:#3d1e1e; border-color:#a33; color:#f0a0a0; }
.h3v-btn.warn:hover { background:#a33; border-color:#a33; color:#fff; }
.h3v-frame { outline:none; }
.h3v-frame.armed { border-color:#46b4e6; box-shadow:0 0 0 1px #46b4e6; }
.h3v-frame.drop { border-color:#e7b15a; box-shadow:0 0 0 1px #e7b15a; background:#2a2418; }
.h3v-frame-empty { user-select:none; }
.h3v-menu { min-width:160px; padding:4px 0; }
.h3v-pop { position:fixed; z-index:10050; background:#222; border:1px solid #555; border-radius:6px;
  box-shadow:0 8px 24px rgba(0,0,0,.55); font:12px sans-serif; color:#ddd; }
.h3v-pop.h3v-menu { max-height:320px; overflow:auto; min-width:160px; padding:4px 0; }
.h3v-pop-it { padding:5px 10px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:420px; }
.h3v-pop-it:hover, .h3v-pop-it.on { background:#2a3a42; color:#46b4e6; }
.h3v-pop-em { padding:10px; color:#888; }
/* Thumbnail Choose picker — same shape as the Ref Images picker. */
.h3v-picker { position:fixed; z-index:10050; display:flex; flex-direction:column;
  width:min(920px, calc(100vw - 16px)); height:min(560px, calc(100vh - 24px));
  background:#1a1a1a; border:1px solid #555; border-radius:8px;
  box-shadow:0 12px 36px rgba(0,0,0,.65); font:12px sans-serif; color:#ddd; overflow:hidden; }
.h3v-pick-search { display:flex; gap:6px; align-items:center; padding:8px; border-bottom:1px solid #333; }
.h3v-pick-search input { flex:1; background:#141414; border:1px solid #444; border-radius:4px; color:#ddd; padding:5px 8px; font:12px sans-serif; }
.h3v-pick-search input:focus { border-color:#46b4e6; outline:none; }
.h3v-pick-split { flex:1; min-height:0; display:flex; }
.h3v-pick-folders { width:140px; flex:none; overflow:auto; background:#141414; border-right:1px solid #333; }
.h3v-pick-folder { display:flex; justify-content:space-between; gap:6px; padding:7px 8px; cursor:pointer; color:#aaa; }
.h3v-pick-folder:hover { background:#2a2a2a; }
.h3v-pick-folder.on { background:#1d3340; color:#46b4e6; }
.h3v-pick-folder span:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.h3v-pick-count { color:#777; font-size:10px; }
.h3v-pick-pane { flex:1; min-width:0; overflow:auto; padding:8px;
  display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:8px; align-content:start; }
.h3v-pick-card { display:flex; flex-direction:column; gap:4px; cursor:pointer; border-radius:4px;
  padding:3px; border:1px solid transparent; }
.h3v-pick-card:hover { background:#262626; }
.h3v-pick-card.on { border-color:#46b4e6; background:#1d3340; }
.h3v-pick-card img { width:100%; height:120px; object-fit:contain; border-radius:3px; background:#111; }
.h3v-pick-name { font-size:10px; color:#bbb; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.h3v-pick-empty { grid-column:1 / -1; color:#888; padding:12px; }
.h3v-pick-foot { display:flex; align-items:center; gap:8px; padding:6px 8px; border-top:1px solid #333; color:#888; }
.h3v-stamp-note { color:#888; font:11px sans-serif; }
`;

function viewUrl(stored) {
  const raw = String(stored || "");
  const parts = raw.split(/[\\/]/).filter(Boolean);
  const filename = parts.pop() || "";
  if (!filename) return "";
  const query = new URLSearchParams({ filename, type: "input", subfolder: parts.join("/") });
  return api.apiURL("/view?" + query.toString());
}

let inputImages = [];
let inputFolders = [];

async function refreshInputImages() {
  try {
    const response = await api.fetchApi("/h3subjectref/images");
    const body = await response.json();
    const files = Array.isArray(body.files) ? body.files : [];
    inputImages = files.map((item) => (typeof item === "string"
      ? { path: item, folder: "", name: item }
      : { path: item.path || "", folder: item.folder || "", name: item.name || item.path || "" }
    )).filter((item) => item.path);
    inputFolders = Array.isArray(body.folders) ? body.folders : [];
  } catch (e) {
    inputImages = [];
    inputFolders = [];
  }
}

function openImageList(anchor, current, onPick) {
  // Thumbnail Choose picker: folder sidebar + image grid (same idea as Ref Images).
  document.querySelectorAll(".h3v-picker, .h3v-pop").forEach((node) => node.remove());
  const popup = el("div", "h3v-picker");
  stop(popup);
  popup.addEventListener("wheel", (e) => {
    e.stopPropagation();
    const scroller = e.target?.closest?.(".h3v-pick-pane, .h3v-pick-folders");
    if (scroller) scroller.scrollTop += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  const searchRow = el("div", "h3v-pick-search");
  const search = document.createElement("input");
  search.type = "text";
  search.placeholder = "Filter images…";
  stop(search);
  searchRow.appendChild(search);
  const split = el("div", "h3v-pick-split");
  const sidebar = el("div", "h3v-pick-folders");
  const pane = el("div", "h3v-pick-pane");
  split.append(sidebar, pane);
  const foot = el("div", "h3v-pick-foot");
  const footText = el("span", null, "reading the input folder…");
  footText.style.flex = "1";
  foot.appendChild(footText);
  popup.append(searchRow, split, foot);
  document.body.appendChild(popup);

  const startFolder = (current || "").includes("/")
    ? current.split("/").slice(0, -1).join("/")
    : (current ? "" : "__all");
  let active = startFolder;
  let query = "";

  function place() {
    const margin = 8;
    const rect = anchor.getBoundingClientRect();
    let left = Math.round(rect.left);
    if (left + popup.offsetWidth > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - margin - popup.offsetWidth);
    }
    popup.style.left = left + "px";
    const h = popup.offsetHeight;
    const below = window.innerHeight - rect.bottom;
    popup.style.top = (below < h + margin && rect.top > h + margin)
      ? Math.round(Math.max(margin, rect.top - h - 4)) + "px"
      : Math.round(Math.min(rect.bottom + 4, window.innerHeight - margin - h)) + "px";
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
  function onKey(e) { if (e.key === "Escape") close(); }

  function visibleFiles() {
    const q = query.trim().toLowerCase();
    return inputImages.filter((item) => {
      if (q) return (item.name || "").toLowerCase().includes(q) || (item.path || "").toLowerCase().includes(q);
      if (active === "__all") return true;
      return (item.folder || "") === active;
    });
  }

  function renderSidebar() {
    sidebar.textContent = "";
    const counts = new Map([["", 0]]);
    for (const name of inputFolders) counts.set(name, 0);
    for (const item of inputImages) counts.set(item.folder || "", (counts.get(item.folder || "") || 0) + 1);
    for (const key of ["__all", "", ...inputFolders.filter(Boolean)]) {
      const count = key === "__all" ? inputImages.length : (counts.get(key) || 0);
      const row = el("div", "h3v-pick-folder" + (key === active && !query ? " on" : ""));
      row.append(
        el("span", null, key === "__all" ? "All" : (key || "root")),
        el("span", "h3v-pick-count", String(count)),
      );
      row.addEventListener("click", () => {
        active = key;
        query = "";
        search.value = "";
        render();
      });
      sidebar.appendChild(row);
    }
  }

  function renderPane() {
    pane.textContent = "";
    const files = visibleFiles();
    const label = query ? `filter “${query.trim()}”` : (active === "__all" ? "All" : (active || "root"));
    footText.textContent = `${files.length} images · ${label}`;
    if (!files.length) {
      pane.appendChild(el("div", "h3v-pick-empty", query ? "No match." : "No images in this folder."));
      return;
    }
    for (const item of files.slice(0, 600)) {
      const card = el("div", "h3v-pick-card" + (item.path === current ? " on" : ""));
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.src = viewUrl(item.path);
      img.title = item.path;
      const name = el("div", "h3v-pick-name", item.name || item.path);
      name.title = item.path;
      card.append(img, name);
      card.addEventListener("click", () => { close(); onPick(item.path); });
      pane.appendChild(card);
    }
  }

  function render() {
    renderSidebar();
    renderPane();
    place();
  }

  search.addEventListener("input", () => {
    query = search.value;
    renderPane();
  });
  place();
  document.addEventListener("pointerdown", onDoc, true);
  document.addEventListener("keydown", onKey, true);
  refreshInputImages().then(() => {
    if (!popup.isConnected) return;
    render();
    search.focus();
  });
}

function ensureStyle() {
  if (document.getElementById("h3v-style")) return;
  const style = document.createElement("style");
  style.id = "h3v-style";
  style.textContent = CSS;
  document.head.appendChild(style);
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function stop(node) {
  node.addEventListener("pointerdown", (event) => {
    if (event.button === 0) event.stopPropagation();
  });
  node.addEventListener("mousedown", (event) => {
    if (event.button === 0) event.stopPropagation();
  });
}

function middleClickPan(element) {
  element.addEventListener("mousedown", (event) => {
    if (event.button !== 1) return;
    event.preventDefault();
    event.stopPropagation();
    const ds = app.canvas?.ds;
    if (!ds) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const startOffsetX = ds.offset[0];
    const startOffsetY = ds.offset[1];
    const onMove = (move) => {
      const scale = ds.scale || 1;
      ds.offset[0] = startOffsetX + (move.clientX - startX) / scale;
      ds.offset[1] = startOffsetY + (move.clientY - startY) / scale;
      app.canvas.setDirty(true, true);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
  element.addEventListener("auxclick", (event) => {
    if (event.button === 1) event.preventDefault();
  });
}

function wheelPassthrough(element) {
  element.addEventListener("wheel", (event) => {
    let target = event.target instanceof Element ? event.target : null;
    while (target && target !== element) {
      const overflow = getComputedStyle(target).overflowY;
      if ((overflow === "auto" || overflow === "scroll") && target.scrollHeight > target.clientHeight + 1) return;
      target = target.parentElement;
    }
    if (element.scrollHeight <= element.clientHeight + 1) return;
    element.scrollTop += event.deltaY;
    event.preventDefault();
  }, { passive: false });
}

function hideWidget(widget) {
  if (!widget) return;
  widget.hidden = true;
  widget.computeSize = () => [0, -4];
}

function repairWidgetWidth(widget) {
  if (!widget || widget.__h3vWidthGuard) return;
  const vueMode = () => Boolean(globalThis.LiteGraph?.vueNodesMode);
  let stored = vueMode() ? widget.width : undefined;
  try {
    Object.defineProperty(widget, "width", {
      configurable: true,
      enumerable: true,
      get() { return stored; },
      set(value) { stored = vueMode() ? value : undefined; },
    });
    widget.__h3vWidthGuard = true;
  } catch (e) { /* a frozen widget keeps Comfy's own width */ }
}

function defaultState() {
  return {
    idea: "",
    prompt: "",
    style_mode: "cinematic",
    shot_size: "medium shot",
    subject: "subject",
    pass: "stay",
    first_file: "",
    last_file: "",
    motion: { weight: false, contact: false, follow: false, settle: false },
  };
}

function motionOf(state) {
  const saved = state.motion && typeof state.motion === "object" ? state.motion : {};
  return {
    weight: !!saved.weight,
    contact: !!saved.contact,
    follow: !!saved.follow,
    settle: !!saved.settle,
  };
}

function snapped(length) {
  let frames = Math.max(5, Math.round(Number(length) || 124));
  while (frames % 17 !== 5) frames += 1;
  return { frames, seconds: (frames / 24).toFixed(2) };
}

function alignmentLine(mode, seconds) {
  if (mode === "i2va") {
    return "For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.";
  }
  if (mode === "fl2va") {
    return "How the reference pictures align with the target video \u2014 Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot 1) aligns with the " + seconds + "-second mark of the target video.";
  }
  if (mode === "l2va") {
    return "How the reference pictures align with the target video \u2014 <Picture 1> (from [Shot 1]) aligns with the " + seconds + "-second mark of the target video.";
  }
  return "";
}

function setup(node, opts = null) {
  const host = opts && opts.container ? opts : null;
  const flag = host ? "_h3vHotMounted" : "_h3vMounted";
  if (node[flag] || (!host && typeof node.addDOMWidget !== "function")) return;
  const stateWidget = host?.stateApi || node.widgets?.find((widget) => widget.name === "state");
  if (!stateWidget) return;
  node[flag] = true;
  ensureStyle();
  if (!host) {
    hideWidget(stateWidget);
    const socketIndex = node.inputs?.findIndex((input) => input && input.name === "state");
    if (socketIndex != null && socketIndex !== -1) node.removeInput(socketIndex);
  }

  const state = defaultState();
  try {
    const parsed = JSON.parse(stateWidget.value || "{}");
    if (parsed && typeof parsed === "object") Object.assign(state, parsed);
  } catch (e) { /* a fresh node starts empty */ }
  if (state.pass !== "stay" && state.pass !== "expand") state.pass = "stay";

  function write() {
    const raw = JSON.stringify({
      idea: state.idea || "",
      prompt: state.prompt || "",
      style_mode: state.style_mode || "cinematic",
      shot_size: state.shot_size || "medium shot",
      subject: state.subject || "subject",
      pass: state.pass === "expand" ? "expand" : "stay",
      first_file: state.first_file || "",
      last_file: state.last_file || "",
      motion: motionOf(state),
    });
    stateWidget.value = raw;
    if (stateWidget.inputEl) stateWidget.inputEl.value = raw;
  }
  stateWidget.serializeValue = () => {
    write();
    return stateWidget.value;
  };

  let draftResult = null;
  let visionBusy = false;
  let visionStarted = 0;
  let visionTick = 0;

  const root = el("div", "h3v-root");
  stop(root);
  middleClickPan(root);
  wheelPassthrough(root);

  const bar = el("div", "h3v-bar");
  bar.append(el("span", "h3v-title", "H3 Image to Video"));
  const modeLine = el("span", "h3v-mode", "");
  bar.appendChild(modeLine);

  const controls = el("div", "h3v-line");
  const styleSel = document.createElement("select");
  styleSel.title = "Shot 1 style. On a keyframe run, keep it consistent with the still.";
  for (const [value, label] of STYLES) {
    const option = el("option", null, label);
    option.value = value;
    styleSel.appendChild(option);
  }
  styleSel.value = STYLES.some(([value]) => value === state.style_mode) ? state.style_mode : "cinematic";
  const shotSel = document.createElement("select");
  shotSel.title = "Shot 1 framing.";
  for (const name of SHOTS) {
    const option = el("option", null, name);
    option.value = name;
    shotSel.appendChild(option);
  }
  shotSel.value = SHOTS.includes(state.shot_size) ? state.shot_size : "medium shot";
  const subjectBox = document.createElement("input");
  subjectBox.type = "text";
  subjectBox.className = "h3v-grow";
  subjectBox.placeholder = "subject";
  subjectBox.title = "The noun in the Shot 1 opener. woman, man, the car.";
  subjectBox.value = state.subject || "subject";
  stop(styleSel);
  stop(shotSel);
  stop(subjectBox);
  controls.append(el("span", "h3v-lbl", "style"), styleSel, el("span", "h3v-lbl", "shot"), shotSel, subjectBox);

  const draftBar = el("div", "h3v-line");
  const stayBtn = el("button", "h3v-btn" + (state.pass !== "expand" ? " on" : ""), "Stay with draft");
  const expandBtn = el("button", "h3v-btn" + (state.pass === "expand" ? " on" : ""), "Expand the draft");
  stayBtn.title = "Turn the typed draft into the three fields. Do not add events.";
  expandBtn.title = "Walk the typed draft across the clip. Do not add a new event.";
  const draftBtn = el("button", "h3v-btn", "Draft");
  draftBtn.title = "Write the three-field prompt from the draft and the wired stills.";
  stop(stayBtn);
  stop(expandBtn);
  stop(draftBtn);
  draftBar.append(stayBtn, expandBtn, draftBtn);

  const ideaBox = document.createElement("textarea");
  ideaBox.rows = 4;
  ideaBox.placeholder = "what happens, any dialogue verbatim, and a cut only if you want one";
  ideaBox.value = state.idea || "";
  stop(ideaBox);

  // Motion guidance for the Draft LLM (same set as the subject writers).
  state.motion = motionOf(state);
  const motionRow = el("div", "h3v-line");
  for (const [key, label, tip] of [
    ["weight", "Weight", "The lead motion shows its start, its carry, and its landing."],
    ["contact", "Contact", "Name both sides of the contact and the sound it makes."],
    ["follow", "Follow-through", "Hair, soft tissue, and loose cloth answer the lead motion."],
    ["settle", "Settle", "The shot ends on breathing or the body coming to rest."],
  ]) {
    const button = el("button", "h3v-btn" + (state.motion[key] ? " on" : ""), label);
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

  const preview = el("pre", "h3v-preview", "");
  preview.style.display = "none";
  const draftActs = el("div", "h3v-line");
  draftActs.style.display = "none";
  const acceptBtn = el("button", "h3v-btn", "Accept");
  const discardBtn = el("button", "h3v-btn", "Discard");
  stop(acceptBtn);
  stop(discardBtn);
  draftActs.append(acceptBtn, discardBtn);

  // Stamp lives with the prompt, not the draft bar — it clears this field for hand writing.
  const promptWrap = el("div", "h3v-sec");
  promptWrap.appendChild(el("div", "h3v-lbl", "prompt"));
  const stampRow = el("div", "h3v-line");
  const stampBtn = el("button", "h3v-btn", "Stamp");
  stampBtn.title = "Clear the prompt and start it with the alignment line for the picked frames plus the three empty fields. Best for prompts you write by hand.";
  stop(stampBtn);
  const stampNote = el("span", "h3v-stamp-note", "best for manual prompts — clears the field below");
  stampRow.append(stampBtn, stampNote);
  const stampWarn = el("div", "h3v-warn");
  stampWarn.style.display = "none";
  const stampWarnText = el("span", null,
    "Stamp will clear the prompt field and replace it with the alignment line plus empty fields. "
    + "Use Stamp for prompts you write by hand. Use Draft above to keep working from the idea.");
  const stampGo = el("button", "h3v-btn warn", "Stamp anyway");
  const stampNo = el("button", "h3v-btn", "Cancel");
  stop(stampGo); stop(stampNo);
  stampWarn.append(stampWarnText, stampGo, stampNo);
  promptWrap.append(stampRow, stampWarn);
  const promptBox = document.createElement("textarea");
  promptBox.rows = 10;
  promptBox.placeholder = "The three fields that get encoded. Draft fills this, or write it yourself.";
  promptBox.value = state.prompt || "";
  stop(promptBox);
  promptWrap.appendChild(promptBox);
  const hint = el("div", "h3v-hint", "Pick a first frame, a last frame, or both. Neither is T2VA.");

  // Frame slots. The file loads inside the node; a wired socket still wins.
  const frames = el("div", "h3v-frames");
  const frameSlots = {};
  function frameSlot(key, label) {
    const box = el("div", "h3v-frame");
    const head = el("div", "h3v-frame-head");
    const name = el("span", "h3v-frame-name", "");
    const chooseBtn = el("button", "h3v-btn", "Choose ▾");
    chooseBtn.title = "Pick a still from ComfyUI's input folder";
    const uploadBtn = el("button", "h3v-btn", "Upload");
    uploadBtn.title = "Copy a still into ComfyUI's input folder";
    const clearBtn = el("button", "h3v-btn", "×");
    clearBtn.title = "Clear this frame";
    const upload = document.createElement("input");
    upload.type = "file";
    upload.accept = "image/*";
    upload.style.display = "none";
    stop(chooseBtn); stop(uploadBtn); stop(clearBtn); stop(upload);
    head.append(el("span", "h3v-lbl", label), name, chooseBtn, uploadBtn, clearBtn, upload);
    const body = el("div");
    box.append(head, body);

    function set(path) {
      state[key] = path || "";
      write();
      paintFrames();
      paintMode();
    }
    function isWired() {
      return !!(socket(key === "first_file" ? "first_frame" : "last_frame")?.link != null);
    }

    // Upload a File/Blob into input/h3i2v/ and take it. Pasted blobs get a name.
    async function takeFile(file, origin) {
      if (!file || !/^image\//.test(file.type || "")) {
        hint.textContent = "That is not an image.";
        return;
      }
      if (isWired()) {
        hint.textContent = "This frame is wired; disconnect the socket to use a picked image.";
        return;
      }
      let blob = file;
      if (!(file instanceof File) || !file.name || /^image\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
        const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
        const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
        blob = new File([file], `${label}-${stamp}.${ext}`, { type: file.type });
      }
      const form = new FormData();
      form.append("image", blob);
      form.append("overwrite", "true");
      form.append("type", "input");
      if (origin !== "upload") form.append("subfolder", "h3i2v");
      hint.textContent = origin === "paste" ? "Pasting…" : "Uploading…";
      try {
        const response = await api.fetchApi("/upload/image", { method: "POST", body: form });
        const payload = await response.json();
        if (!response.ok || !payload.name) throw new Error("upload failed");
        set(payload.subfolder ? payload.subfolder + "/" + payload.name : payload.name);
        hint.textContent = (label === "first" ? "First" : "Last") + " frame set.";
      } catch (e) {
        hint.textContent = "Couldn't upload that image.";
      }
    }

    function imageFromClipboardData(data) {
      const items = data?.items ? Array.from(data.items) : [];
      const hit = items.find((item) => item.kind === "file" && /^image\//.test(item.type));
      return hit ? hit.getAsFile() : null;
    }

    async function pasteFromClipboardApi() {
      // Right-click → Paste. Needs the async clipboard API (Chromium / Electron).
      if (!navigator.clipboard?.read) {
        hint.textContent = "Click the frame, then press Ctrl+V.";
        return;
      }
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const type = item.types.find((t) => /^image\//.test(t));
          if (!type) continue;
          const blob = await item.getType(type);
          await takeFile(new File([blob], "image.png", { type }), "paste");
          return;
        }
        hint.textContent = "No image on the clipboard.";
      } catch (e) {
        hint.textContent = "Clipboard blocked — click the frame, then press Ctrl+V.";
      }
    }

    chooseBtn.addEventListener("click", () => openImageList(chooseBtn, state[key] || "", set));
    uploadBtn.addEventListener("click", () => upload.click());
    clearBtn.addEventListener("click", () => set(""));
    upload.addEventListener("change", () => {
      const picked = upload.files && upload.files[0];
      upload.value = "";
      if (picked) takeFile(picked, "upload");
    });

    // Click once arms the slot (focus) so Ctrl+V lands here and nowhere else.
    box.tabIndex = 0;
    box.title = "Click, then Ctrl+V · right-click for Paste · double-click to upload · or drop an image";
    box.addEventListener("focus", () => box.classList.add("armed"));
    box.addEventListener("blur", () => box.classList.remove("armed"));
    box.addEventListener("pointerdown", (e) => {
      if (e.button === 0 && !(e.target instanceof HTMLButtonElement)) box.focus();
    });
    box.addEventListener("paste", (e) => {
      const file = imageFromClipboardData(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      takeFile(file, "paste");
    });
    box.addEventListener("keydown", (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && document.activeElement === box) {
        e.preventDefault();
        e.stopPropagation();
        set("");
      }
    });
    box.addEventListener("dblclick", (e) => {
      if (e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      e.stopPropagation();
      upload.click();
    });

    // Drag & drop onto the slot. Stop Comfy's canvas drop (new Load Image node).
    box.addEventListener("dragover", (e) => {
      if (!e.dataTransfer) return;
      const types = Array.from(e.dataTransfer.types || []);
      if (!types.includes("Files") && !types.includes("text/uri-list")) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
      box.classList.add("drop");
    });
    box.addEventListener("dragleave", () => box.classList.remove("drop"));
    box.addEventListener("drop", async (e) => {
      box.classList.remove("drop");
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer?.files?.[0];
      if (file) { takeFile(file, "drop"); return; }
      // An image dragged out of another browser tab arrives as a URL.
      const url = e.dataTransfer?.getData("text/uri-list") || e.dataTransfer?.getData("text/plain");
      if (!url) return;
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        takeFile(new File([blob], "image.png", { type: blob.type || "image/png" }), "drop");
      } catch (err) {
        hint.textContent = "Couldn't fetch that image. Save it and drop the file instead.";
      }
    });

    // Right-click menu.
    box.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSlotMenu(e.clientX, e.clientY, [
        ["Paste image", pasteFromClipboardApi],
        ["Choose from input…", () => openImageList(box, state[key] || "", set)],
        ["Upload…", () => upload.click()],
        state[key] ? ["Clear", () => set("")] : null,
      ].filter(Boolean));
    });

    frameSlots[key] = {
      paint() {
        const file = state[key] || "";
        body.textContent = "";
        if (isWired()) {
          name.textContent = "from wire";
          name.title = "A connected socket overrides the picked file.";
          body.appendChild(el("div", "h3v-frame-empty", "wired"));
          return;
        }
        name.textContent = file ? file.split(/[\\/]/).pop() : "";
        name.title = file;
        if (!file) {
          body.appendChild(el("div", "h3v-frame-empty", "click · Ctrl+V · drop · double-click"));
          return;
        }
        const img = document.createElement("img");
        img.className = "h3v-frame-thumb";
        img.src = viewUrl(file);
        img.alt = file;
        img.title = file;
        img.draggable = false;
        body.appendChild(img);
      },
    };
    return box;
  }

  function openSlotMenu(x, y, items) {
    document.querySelectorAll(".h3v-pop").forEach((node) => node.remove());
    const popup = el("div", "h3v-pop h3v-menu");
    stop(popup);
    for (const [text, run] of items) {
      const row = el("div", "h3v-pop-it", text);
      row.addEventListener("click", () => { close(); run(); });
      popup.appendChild(row);
    }
    document.body.appendChild(popup);
    popup.style.left = Math.min(x, window.innerWidth - popup.offsetWidth - 8) + "px";
    popup.style.top = Math.min(y, window.innerHeight - popup.offsetHeight - 8) + "px";
    function close() {
      popup.remove();
      document.removeEventListener("pointerdown", onDoc, true);
      document.removeEventListener("keydown", onKey, true);
    }
    function onDoc(e) { if (!popup.contains(e.target)) close(); }
    function onKey(e) { if (e.key === "Escape") close(); }
    setTimeout(() => {
      document.addEventListener("pointerdown", onDoc, true);
      document.addEventListener("keydown", onKey, true);
    }, 0);
  }
  frames.append(frameSlot("first_file", "first"), frameSlot("last_file", "last"));
  function paintFrames() {
    for (const slot of Object.values(frameSlots)) slot.paint();
  }

  root.append(bar, frames, controls, draftBar, ideaBox, motionRow, preview, draftActs, promptWrap, hint);

  function graphLink(linkId) {
    const links = app.graph?.links;
    if (!links || linkId == null) return null;
    if (typeof links.get === "function") return links.get(linkId) || links.get(String(linkId)) || null;
    return links[linkId] || null;
  }

  function fileFromLink(linkId, depth) {
    if (depth > 8) return "";
    const link = graphLink(linkId);
    const origin = link && (Array.isArray(link) ? link[1] : link.origin_id);
    const source = origin == null ? null : app.graph?.getNodeById(origin);
    if (!source) return "";
    const type = String(source.type || source.comfyClass || "");
    if (/reroute/i.test(type)) {
      const input = (source.inputs || []).find((item) => item && item.link != null);
      return input ? fileFromLink(input.link, depth + 1) : "";
    }
    for (const name of ["image", "file", "filename"]) {
      const widget = (source.widgets || []).find((item) => item && item.name === name);
      if (!widget) continue;
      let raw = widget.value;
      if (raw && typeof raw === "object") raw = raw.content || raw.image || raw.value || "";
      const text = String(raw || "").replace(/\s*\[(input|output|temp)\]\s*$/i, "").trim();
      if (text) return text;
    }
    return "";
  }

  function socket(name) {
    return (node.inputs || []).find((input) => input && input.name === name) || null;
  }

  function clipFrames() {
    // Hot Swap hosts publish the snapped count; the dedicated node has a length widget.
    if (Number(node._h3hsFrames) > 0) return Number(node._h3hsFrames);
    const lengthWidget = node.widgets?.find((item) => item.name === "length");
    return lengthWidget ? lengthWidget.value : 124;
  }

  function frameInfo() {
    const snap = snapped(clipFrames());
    const first = socket("first_frame");
    const last = socket("last_frame");
    const firstWired = !!(first && first.link != null);
    const lastWired = !!(last && last.link != null);
    const firstPicked = String(state.first_file || "").trim();
    const lastPicked = String(state.last_file || "").trim();
    const firstLinked = firstWired || !!firstPicked;
    const lastLinked = lastWired || !!lastPicked;
    let mode = "t2va";
    if (firstLinked && lastLinked) mode = "fl2va";
    else if (firstLinked) mode = "i2va";
    else if (lastLinked) mode = "l2va";
    return {
      mode,
      seconds: snap.seconds,
      frames: snap.frames,
      firstLinked,
      lastLinked,
      firstFile: firstWired ? fileFromLink(first.link, 0) : firstPicked,
      lastFile: lastWired ? fileFromLink(last.link, 0) : lastPicked,
    };
  }

  function paintMode() {
    const info = frameInfo();
    const bits = [info.mode.toUpperCase() + " \u00b7 " + info.seconds + "s"];
    if (info.mode === "t2va") bits.push("no frames");
    if (info.firstLinked) bits.push(info.firstFile ? "first " + info.firstFile.split(/[\\/]/).pop() : "first frame has no filename");
    if (info.lastLinked) bits.push(info.lastFile ? "last " + info.lastFile.split(/[\\/]/).pop() : "last frame has no filename");
    modeLine.textContent = bits.join(" \u00b7 ");
    modeLine.title = modeLine.textContent;
  }

  function closeDraft() {
    draftResult = null;
    preview.style.display = "none";
    draftActs.style.display = "none";
    preview.textContent = "";
  }

  function stampPrompt() {
    // Stamp is the manual-prompt starter: wipe the field, write the alignment
    // line for the picked frames, then the three empty fields.
    hideStampWarn();
    const info = frameInfo();
    const line = alignmentLine(info.mode, info.seconds);
    const skeleton = "integrated_multimodal_description: [Shot 1] \n\noverall_soundscape: \n\nnon_diegetic_music: N/A";
    state.prompt = line ? line + "\n\n" + skeleton : skeleton;
    promptBox.value = state.prompt;
    write();
    hint.textContent = line
      ? "Stamped for " + info.mode.toUpperCase() + ". Write the shot after [Shot 1]."
      : "T2VA has no alignment line. Write the three fields.";
    promptBox.focus();
  }

  function askStamp() {
    if (!String(state.prompt || "").trim()) {
      stampPrompt();
      return;
    }
    const open = stampWarn.style.display === "none";
    stampWarn.style.display = open ? "" : "none";
    stampBtn.classList.toggle("on", open);
  }

  function hideStampWarn() {
    stampWarn.style.display = "none";
    stampBtn.classList.remove("on");
  }

  function graphOrigin(linkId) {
    const link = graphLink(linkId);
    const origin = link && (Array.isArray(link) ? link[1] : link.origin_id);
    return origin == null ? null : app.graph?.getNodeById(origin);
  }

  function loaderSettings() {
    const index = node.inputs?.findIndex((input) => input && input.name === "llm");
    if (index == null || index < 0) return null;
    const source = graphOrigin(node.inputs[index].link);
    if (!source) return null;
    const widget = (name) => source.widgets?.find((item) => item.name === name);
    const backend = String(widget("backend")?.value || "GGUF").toLowerCase();
    const model = widget("model_name");
    if (backend !== "http" && (!model || !model.value)) return null;
    const gpu = widget("n_gpu_layers");
    return {
      backend,
      model_name: model?.value || "",
      mmproj_name: widget("mmproj_name") ? widget("mmproj_name").value : "none",
      n_ctx: Number(widget("n_ctx")?.value) || 16384,
      n_gpu_layers: gpu ? Number(gpu.value) : -1,
      keep_loaded: !!widget("keep_loaded")?.value,
      diagnostics: !!widget("diagnostics")?.value,
      base_url: widget("base_url")?.value || "http://localhost:1234/v1",
      model: widget("model")?.value || "local",
      api_key: widget("api_key")?.value || "none",
    };
  }

  function instructionSettings() {
    const index = node.inputs?.findIndex((input) => input && input.name === "instructions");
    if (index == null || index < 0) return null;
    const source = graphOrigin(node.inputs[index].link);
    if (!source) return null;
    const widget = (name) => source.widgets?.find((item) => item.name === name);
    return {
      extra: widget("extra_instructions")?.value || "",
      override: widget("override_guide")?.value || "",
    };
  }

  function visionClock() {
    const secs = Math.max(0, Math.floor((Date.now() - visionStarted) / 1000));
    return Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
  }

  function startClock() {
    visionStarted = Date.now();
    clearInterval(visionTick);
    const paint = () => { draftBtn.textContent = "Drafting " + visionClock(); };
    visionTick = setInterval(paint, 1000);
    paint();
  }

  function finishClock() {
    visionBusy = false;
    clearInterval(visionTick);
    visionTick = 0;
    draftBtn.disabled = false;
    draftBtn.classList.remove("busy");
    draftBtn.textContent = "Draft";
  }

  async function runDraft() {
    if (visionBusy) return;
    if (!String(state.idea || "").trim()) {
      hint.textContent = "Write the draft first.";
      return;
    }
    const loader = loaderSettings();
    if (!loader) {
      hint.textContent = "Connect LLM (GGUF) - Loader to the llm input.";
      return;
    }
    const info = frameInfo();
    const diagnosticId = loader.diagnostics
      ? (globalThis.crypto?.randomUUID?.() || `hs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)
      : "";
    const request = {
      job: "draft",
      loader,
      instructions: instructionSettings(),
      idea: state.idea,
      style_mode: state.style_mode,
      shot_size: state.shot_size,
      subject: state.subject,
      pass: state.pass,
      motion: motionOf(state),
      length: info.frames,
      first_linked: info.firstLinked,
      last_linked: info.lastLinked,
      first_file: info.firstFile,
      last_file: info.lastFile,
    };
    if (diagnosticId) request.diagnostic_id = diagnosticId;
    visionBusy = true;
    draftBtn.disabled = true;
    draftBtn.classList.add("busy");
    startClock();
    hint.textContent = "Drafting the three fields\u2026";
    closeDraft();
    try {
      const response = await api.fetchApi("/h3i2v/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      let body = {};
      try { body = await response.json(); } catch (e) { body = {}; }
      if (!response.ok || body.error) throw new Error(body.error || "The writer did not answer.");
      draftResult = body;
      preview.textContent = body.prompt || "";
      preview.style.display = "";
      draftActs.style.display = "";
      const count = Array.isArray(body.issues) ? body.issues.length : 0;
      hint.textContent = count
        ? "Draft ready. " + count + " format issue" + (count === 1 ? "" : "s") + ". Accept to edit, or discard.\n" + body.issues.join("\n")
        : "Draft ready. Accept or discard.";
    } catch (e) {
      let message = e.message || "Draft failed.";
      if (diagnosticId && !message.includes(diagnosticId)) {
        message += ` (Hot Swap diagnostic ID: ${diagnosticId})`;
      }
      hint.textContent = message;
    } finally {
      finishClock();
    }
  }

  styleSel.addEventListener("change", () => { state.style_mode = styleSel.value; write(); });
  shotSel.addEventListener("change", () => { state.shot_size = shotSel.value; write(); });
  subjectBox.addEventListener("input", () => { state.subject = subjectBox.value; write(); });
  ideaBox.addEventListener("input", () => { state.idea = ideaBox.value; write(); });
  promptBox.addEventListener("input", () => { state.prompt = promptBox.value; write(); });
  stayBtn.addEventListener("click", () => {
    state.pass = "stay";
    stayBtn.classList.add("on");
    expandBtn.classList.remove("on");
    write();
  });
  expandBtn.addEventListener("click", () => {
    state.pass = "expand";
    expandBtn.classList.add("on");
    stayBtn.classList.remove("on");
    write();
  });
  stampBtn.addEventListener("click", askStamp);
  stampGo.addEventListener("click", stampPrompt);
  stampNo.addEventListener("click", hideStampWarn);
  promptBox.addEventListener("focus", hideStampWarn);
  draftBtn.addEventListener("click", () => { runDraft(); });
  discardBtn.addEventListener("click", closeDraft);
  acceptBtn.addEventListener("click", () => {
    if (!draftResult || !draftResult.prompt) return;
    state.prompt = draftResult.prompt;
    promptBox.value = state.prompt;
    closeDraft();
    hideStampWarn();
    write();
    hint.textContent = "Draft accepted.";
  });

  const lengthWidget = node.widgets?.find((item) => item.name === "length");
  if (lengthWidget) {
    const previous = lengthWidget.callback;
    lengthWidget.callback = function () {
      previous?.apply(this, arguments);
      paintMode();
    };
  }
  const previousConnections = node.onConnectionsChange;
  node.onConnectionsChange = function () {
    previousConnections?.apply(this, arguments);
    paintFrames();
    paintMode();
  };

  if (host) {
    host.container.appendChild(root);
    host.container.addEventListener("h3hs-frames", () => paintMode());
  } else {
    const domWidget = node.addDOMWidget("h3i2v_ui", "h3-i2v", root, {
      serialize: false,
      hideOnZoom: false,
      getMinHeight: () => 440,
    });
    repairWidgetWidth(domWidget);
  }

  function applyState() {
    styleSel.value = STYLES.some(([value]) => value === state.style_mode) ? state.style_mode : "cinematic";
    shotSel.value = SHOTS.includes(state.shot_size) ? state.shot_size : "medium shot";
    subjectBox.value = state.subject || "subject";
    ideaBox.value = state.idea || "";
    promptBox.value = state.prompt || "";
    stayBtn.classList.toggle("on", state.pass !== "expand");
    expandBtn.classList.toggle("on", state.pass === "expand");
    state.motion = motionOf(state);
    motionRow.querySelectorAll("[data-motion]").forEach((button) => {
      button.classList.toggle("on", !!state.motion[button.dataset.motion]);
    });
    write();
    paintFrames();
    paintMode();
  }

  const previousConfigure = node.onConfigure;
  node.onConfigure = function () {
    if (!host) node._h3vConfigured = true;
    previousConfigure?.apply(this, arguments);
    if (host && node._h3hsMode && node._h3hsMode !== "i2v") return;
    try {
      const parsed = JSON.parse(stateWidget.value || "{}");
      if (parsed && typeof parsed === "object") {
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, defaultState(), parsed);
      }
    } catch (e) { /* keep the editor state */ }
    if (state.pass !== "stay" && state.pass !== "expand") state.pass = "stay";
    applyState();
  };

  const previousRemoved = node.onRemoved;
  node.onRemoved = function () {
    previousRemoved?.apply(this, arguments);
    finishClock();
  };

  applyState();
  if (!host) {
    setTimeout(() => {
      if (node._h3vConfigured) return;
      node.setSize?.([
        Math.max(Number(node.size?.[0]) || 640, 640),
        Math.max(Number(node.size?.[1]) || 700, 700),
      ]);
    }, 0);
  }
}

globalThis.H3SubjectPanels = globalThis.H3SubjectPanels || {};
globalThis.H3SubjectPanels.i2v = setup;

app.registerExtension({
  name: "h3i2v.image",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "H3ImageToVideo") return;
    if (nodeType.prototype._h3vPatched) return;
    nodeType.prototype._h3vPatched = true;
    const previous = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      previous?.apply(this, arguments);
      setup(this);
    };
  },
});
