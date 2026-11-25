// Internal six-section prompt editor used by EM Subject Hot Swap.
// Hidden `state` widget is the source of truth. Python builds the prompt.

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
const STARTER_OUTFITS = [
  "she is completely nude",
  "he is completely nude",
  "she is nude from the waist up",
  "she is wearing a short dress",
  "she is wearing a t-shirt and underwear",
];
const VOICE_KEEP = "only the timbre, rhythm, style, and delivery are referenced without copying the signal";
const SUBJ_DIR = "h3subject/subjects";
const WARD_FILE = "h3subject/wardrobes.json";

const CSS = `
.h3s-root { box-sizing:border-box; width:100%; height:100%; min-height:0;
  display:flex; flex-direction:column; gap:6px; padding:8px; overflow:auto;
  background:#1a1a1a; color:#ddd; border:1px solid #555; border-radius:8px;
  font:12px/1.4 sans-serif; }
.h3s-root *, .h3s-root *::before, .h3s-root *::after { box-sizing:border-box; }
.h3s-bar { display:flex; align-items:center; gap:6px; min-width:0; }
.h3s-title { color:#46b4e6; font-weight:700; font-size:13px; white-space:nowrap; }
.h3s-hint { color:#888; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-left:auto; }
.h3s-btn { background:#333; border:1px solid #555; border-radius:4px; color:#bbb;
  font:11px sans-serif; cursor:pointer; padding:2px 8px; line-height:16px; white-space:nowrap; }
.h3s-btn:hover { border-color:#46b4e6; color:#fff; }
.h3s-btn.on { border-color:#46b4e6; color:#46b4e6; background:#2a3a42; }
.h3s-drop:hover { background:#a33; border-color:#a33; color:#fff; }
.h3s-list { display:flex; flex-direction:column; gap:4px; padding-right:2px; }
.h3s-empty { color:#888; padding:8px; }
.h3s-row { background:#262626; border-radius:4px; padding:4px 6px; }
.h3s-row.active { box-shadow:inset 0 0 0 1px #46b4e6; }
.h3s-row.off { opacity:.45; }
.h3s-row.dragging { opacity:.4; }
.h3s-head { display:flex; align-items:center; gap:6px; min-width:0; }
.h3s-grip { cursor:grab; color:#888; user-select:none; flex:0 0 auto; letter-spacing:-1px; }
.h3s-num { font:bold 11px monospace; color:#888; width:18px; flex:0 0 auto; }
.h3s-name { font-weight:650; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.h3s-tag { color:#46b4e6; font:11px monospace; flex:0 0 auto; }
.h3s-snip { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#888; }
.h3s-body { display:flex; flex-direction:column; gap:5px; padding-top:6px; }
.h3s-line { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.h3s-line input[type=text], .h3s-line select, .h3s-root select, .h3s-root textarea {
  background:#1d1d1d; border:1px solid #444; border-radius:4px; color:#ddd;
  font:13px monospace; padding:4px 6px; }
.h3s-line input[type=text]:focus, .h3s-root textarea:focus, .h3s-root select:focus {
  border-color:#46b4e6; outline:none; }
.h3s-grow { flex:1 1 160px; min-width:0; }
.h3s-root textarea { width:100%; resize:vertical; min-height:36px; }
.h3s-lbl { color:#46b4e6; font:600 11px monospace; margin-top:4px; }
.h3s-mini { color:#888; font:11px sans-serif; }
.h3s-joined { background:#1d1d1d; border-radius:4px; padding:5px 7px; color:#aaa;
  font:12px/1.45 monospace; white-space:pre-wrap; word-break:break-word; }
.h3s-sec { display:flex; flex-direction:column; gap:3px; }
.h3s-map { color:#888; font:11px/1.4 monospace; white-space:pre-wrap; }
.h3s-preview { background:#1d1d1d; border:1px solid #444; border-radius:4px; margin:0;
  padding:8px; color:#bbb; font:12px/1.45 monospace;
  white-space:pre-wrap; word-break:break-word; }
.h3s-menu { position:fixed; z-index:10000; background:#262626; border:1px solid #555;
  border-radius:6px; padding:4px; box-shadow:0 6px 20px rgba(0,0,0,.55);
  font:12px sans-serif; color:#ddd; max-height:60vh; overflow:auto; min-width:220px; max-width:360px; }
.h3s-mitem { display:flex; align-items:center; gap:6px; padding:3px 5px; border-radius:4px; }
.h3s-mitem:hover { background:#333; }
.h3s-mname { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer; }
.h3s-mhdr { color:#888; padding:2px 6px 4px; }
`;

function ensureStyle() {
  if (document.getElementById("h3s-style")) return;
  const s = document.createElement("style");
  s.id = "h3s-style";
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
    who: "",
    keep: "",
    wardrobe: "",
    marker: "fully_preserved",
    shots: "1",
    audio: false,
    audio_marker: "reference",
    audio_keep: VOICE_KEEP,
    expanded: true,
  };
}

function defaultState() {
  return {
    task: "reference generation",
    subjects: [],
    summary: "",
    detailed: "",
    soundscape: "",
    music: "",
    wardrobes: [],
    active: "",
  };
}

function markersFor(kind) {
  return kind === "audio" ? AUDIO_MARKERS : PICTURE_MARKERS;
}

function pack(row) {
  return {
    name: row.name || "",
    kind: row.kind || "picture",
    who: row.who || "",
    keep: row.keep || "",
    wardrobe: row.wardrobe || "",
    marker: row.marker || "fully_preserved",
    shots: row.shots || "1",
    audio: !!row.audio,
    audio_marker: row.audio_marker || "reference",
    audio_keep: row.audio_keep || VOICE_KEEP,
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

function setup(node) {
  if (node._h3sMounted || typeof node.addDOMWidget !== "function") return;
  const stateWidget = node.widgets?.find((w) => w.name === "state");
  if (!stateWidget) return;
  node._h3sMounted = true;
  ensureStyle();
  hideWidget(stateWidget);
  const socket = node.inputs?.findIndex((input) => input.name === "state");
  if (socket != null && socket !== -1) node.removeInput(socket);

  const state = defaultState();
  try {
    const parsed = JSON.parse(stateWidget.value || "{}");
    if (parsed && typeof parsed === "object") Object.assign(state, parsed);
  } catch (e) { /* a fresh node starts empty */ }
  if (!Array.isArray(state.subjects)) state.subjects = [];
  if (!Array.isArray(state.wardrobes)) state.wardrobes = [];

  const write = () => {
    const raw = JSON.stringify(state);
    stateWidget.value = raw;
    if (stateWidget.inputEl) stateWidget.inputEl.value = raw;
  };
  stateWidget.serializeValue = () => {
    write();
    return stateWidget.value;
  };

  let preview = { prompt: "", report: "", map: [], lines: [] };
  let timer = 0;

  const root = el("div", "h3s-root");
  stop(root);
  middleClickPan(root);
  wheelPassthrough(root);

  const bar = el("div", "h3s-bar");
  const title = el("span", "h3s-title", "EM Subject Hot Swap — Prompt");
  const addBtn = el("button", "h3s-btn", "Add");
  addBtn.title = "Add a subject row";
  const savedBtn = el("button", "h3s-btn", "Saved ▾");
  savedBtn.title = "Save, edit, or drop a stored subject";
  const hint = el("span", "h3s-hint", "Checked rows number from the top");
  stop(addBtn);
  stop(savedBtn);
  bar.append(title, addBtn, savedBtn, hint);

  const subjectsLabel = el("div", "h3s-lbl", "subject_definitions / retention_analysis");
  const list = el("div", "h3s-list");
  const mapLine = el("div", "h3s-map", "");

  function field(label, child) {
    const wrap = el("div", "h3s-sec");
    const row = el("div", "h3s-line");
    row.appendChild(el("span", "h3s-lbl", label));
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

  const summaryWrap = field("summary:", taskSel);
  const summaryBox = area("summary", 3, "the woman sits on the sofa and looks at the camera");
  summaryWrap.appendChild(summaryBox);
  const detailedWrap = el("div", "h3s-sec");
  detailedWrap.appendChild(el("div", "h3s-lbl", "detailed_description:"));
  detailedWrap.appendChild(area("detailed", 5, "[Shot 1] what the camera sees, one idea per line"));
  const soundWrap = el("div", "h3s-sec");
  soundWrap.appendChild(el("div", "h3s-lbl", "overall_soundscape:"));
  soundWrap.appendChild(area("soundscape", 2, "room tone, fabric, breath"));
  const musicWrap = el("div", "h3s-sec");
  musicWrap.appendChild(el("div", "h3s-lbl", "non_diegetic_music:"));
  musicWrap.appendChild(area("music", 2, "leave empty for N/A"));

  const previewBar = el("div", "h3s-line");
  const previewBtn = el("button", "h3s-btn", "Preview");
  const copyBtn = el("button", "h3s-btn", "Copy");
  stop(previewBtn);
  stop(copyBtn);
  const previewBox = el("pre", "h3s-preview", "");
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

  root.append(bar, subjectsLabel, list, mapLine, summaryWrap, detailedWrap, soundWrap, musicWrap, previewBar, previewBox);

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
    list.querySelectorAll(".h3s-row").forEach((view) => {
      const index = Number(view.dataset.index);
      const line = byIndex.get(index);
      const row = state.subjects[index];
      const tag = view.querySelector(".h3s-tag");
      if (tag) tag.textContent = row && row.enabled === false ? "off" : (line?.tag || "");
      const joined = view.querySelector(".h3s-joined");
      if (joined) {
        joined.textContent = line
          ? line.definition + "\n" + line.retention
          : "";
      }
    });
    if (preview.map?.length) {
      mapLine.textContent = preview.map.map((row) => `${row.label} → ${row.wire} · ${row.name}`).join("\n");
    } else {
      mapLine.textContent = preview.error || "No subjects are switched on.";
    }
    previewBox.textContent = preview.prompt || "";
    const words = (preview.prompt || "").split(/\s+/).filter(Boolean).length;
    hint.textContent = words ? `${words} words` : "Checked rows number from the top";
    app.graph?.setDirtyCanvas(true, true);
  }

  async function assemble() {
    try {
      const response = await api.fetchApi("/h3subject/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const body = await response.json();
      if (!response.ok || body.error) {
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

  function renderList() {
    list.innerHTML = "";
    if (!state.subjects.length) {
      list.appendChild(el("div", "h3s-empty", "No subjects yet. Add one, or open Saved."));
      applyPreview();
      return;
    }
    state.subjects.forEach((row, index) => list.appendChild(renderRow(row, index)));
    applyPreview();
  }

  function renderRow(row, index) {
    const view = el("div", "h3s-row" + (row.id === state.active ? " active" : "") + (row.enabled === false ? " off" : ""));
    view.dataset.id = row.id;
    view.dataset.index = String(index);
    const head = el("div", "h3s-head");
    const grip = el("span", "h3s-grip", "⋮⋮");
    grip.title = "Drag to reorder";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = row.enabled !== false;
    check.title = "Switch this subject on or off";
    stop(check);
    const num = el("span", "h3s-num", String(index + 1).padStart(2, "0"));
    const name = el("span", "h3s-name", row.name || "subject");
    const tag = el("span", "h3s-tag", row.enabled === false ? "off" : "");
    const snip = el("span", "h3s-snip", row.wardrobe || row.who || "");
    const expand = el("button", "h3s-btn" + (row.expanded ? " on" : ""), row.expanded ? "Close" : "Expand");
    const save = el("button", "h3s-btn", "Save");
    save.title = "Save this subject for other workflows";
    const drop = el("button", "h3s-btn h3s-drop", "Drop");
    drop.title = "Drop this subject from the prompt";
    for (const button of [expand, save, drop]) stop(button);
    head.append(grip, check, num, name, tag, snip, expand, save, drop);
    view.appendChild(head);

    check.addEventListener("change", () => {
      row.enabled = check.checked;
      view.classList.toggle("off", !check.checked);
      commit();
    });
    expand.addEventListener("click", () => {
      row.expanded = !row.expanded;
      state.active = row.id;
      renderList();
      applyPreview();
    });
    save.addEventListener("click", () => saveSubject(row));
    drop.addEventListener("click", () => {
      state.subjects = state.subjects.filter((item) => item.id !== row.id);
      if (state.active === row.id) state.active = "";
      renderList();
      commit();
    });
    head.addEventListener("pointerdown", () => { state.active = row.id; });

    grip.addEventListener("pointerdown", (e) => startDrag(e, view));

    if (row.expanded) view.appendChild(renderBody(row, name, snip));
    return view;
  }

  function renderBody(row, nameEl, snipEl) {
    const body = el("div", "h3s-body");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "name, for the library";
    nameInput.value = row.name || "";
    nameInput.className = "h3s-grow";
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
      state.active = row.id;
      renderList();
      commit();
    });
    const top = el("div", "h3s-line");
    top.append(nameInput, kind);
    body.appendChild(top);

    body.appendChild(labeledArea("who", row, "who they are", "the woman with tanned skin and a copper bob", 2));
    body.appendChild(labeledArea("keep", row, "what stays", "identity, facial features, skin tone, and hair are retained", 2));

    const wear = document.createElement("input");
    wear.type = "text";
    wear.className = "h3s-grow";
    wear.placeholder = "wardrobe line for this run";
    wear.value = row.wardrobe || "";
    stop(wear);
    const outfit = document.createElement("select");
    const custom = el("option", null, "outfits");
    custom.value = "";
    outfit.appendChild(custom);
    for (const line of outfits()) {
      const option = el("option", null, line);
      option.value = line;
      outfit.appendChild(option);
    }
    outfit.value = outfits().includes(row.wardrobe) ? row.wardrobe : "";
    stop(outfit);
    outfit.addEventListener("change", () => {
      if (!outfit.value) return;
      row.wardrobe = outfit.value;
      wear.value = outfit.value;
      snipEl.textContent = row.wardrobe;
      commit();
    });
    wear.addEventListener("input", () => {
      row.wardrobe = wear.value;
      snipEl.textContent = row.wardrobe;
      outfit.value = outfits().includes(wear.value) ? wear.value : "";
      commit();
    });
    const saveOutfit = el("button", "h3s-btn", "Save outfit");
    saveOutfit.title = "Keep this wardrobe line in the outfit list";
    stop(saveOutfit);
    saveOutfit.addEventListener("click", () => storeOutfit(wear.value));
    const wearRow = el("div", "h3s-line");
    wearRow.append(wear, outfit, saveOutfit);
    const wearWrap = el("div", "h3s-sec");
    wearWrap.appendChild(el("div", "h3s-lbl", "wardrobe"));
    wearWrap.appendChild(wearRow);
    body.appendChild(wearWrap);

    const marker = document.createElement("select");
    for (const value of markersFor(row.kind)) {
      marker.appendChild(el("option", null, value)).value = value;
    }
    marker.value = markersFor(row.kind).includes(row.marker) ? row.marker : markersFor(row.kind)[0];
    stop(marker);
    marker.addEventListener("change", () => { row.marker = marker.value; commit(); });
    const shots = document.createElement("input");
    shots.type = "text";
    shots.placeholder = "shots: 1";
    shots.value = row.shots || "1";
    shots.style.width = "88px";
    stop(shots);
    shots.addEventListener("input", () => { row.shots = shots.value; commit(); });
    const markRow = el("div", "h3s-line");
    markRow.append(el("span", "h3s-mini", "retention"), marker, el("span", "h3s-mini", "shots"), shots);
    body.appendChild(markRow);

    if (row.kind === "picture") {
      const audio = document.createElement("input");
      audio.type = "checkbox";
      audio.checked = !!row.audio;
      stop(audio);
      const audioLabel = el("label", "h3s-mini");
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
        const audioMarker = document.createElement("select");
        for (const value of AUDIO_MARKERS) audioMarker.appendChild(el("option", null, value)).value = value;
        audioMarker.value = AUDIO_MARKERS.includes(row.audio_marker) ? row.audio_marker : "reference";
        stop(audioMarker);
        audioMarker.addEventListener("change", () => { row.audio_marker = audioMarker.value; commit(); });
        body.appendChild(audioMarker);
        body.appendChild(labeledArea("audio_keep", row, "voice retention", VOICE_KEEP, 2));
      }
    }

    const joined = el("div", "h3s-joined", "");
    body.appendChild(joined);
    return body;
  }

  function labeledArea(key, row, label, placeholder, rows) {
    const wrap = el("div", "h3s-sec");
    wrap.appendChild(el("div", "h3s-lbl", label));
    const box = document.createElement("textarea");
    box.rows = rows;
    box.placeholder = placeholder;
    box.value = row[key] || "";
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
      for (const other of list.querySelectorAll(".h3s-row")) {
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
      const ids = [...list.querySelectorAll(".h3s-row")].map((item) => item.dataset.id);
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

  const menu = el("div", "h3s-menu");
  menu.style.display = "none";
  document.body.appendChild(menu);
  node._h3sMenu = menu;

  function closeMenu() { menu.style.display = "none"; }

  async function openSavedMenu() {
    if (menu.style.display !== "none") { closeMenu(); return; }
    await fillSavedMenu();
    menu.style.display = "";
    const rect = savedBtn.getBoundingClientRect();
    menu.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 4)) + "px";
    menu.style.top = Math.min(rect.bottom + 4, window.innerHeight - 8) + "px";
  }

  async function fillSavedMenu() {
    menu.innerHTML = "";
    const saveAs = el("button", "h3s-btn", "+ Save active…");
    stop(saveAs);
    saveAs.addEventListener("click", async () => {
      const row = activeRow();
      closeMenu();
      if (!row) { window.alert("Add a subject first."); return; }
      await saveSubject(row);
    });
    const saveRow = el("div", "h3s-mitem");
    saveRow.appendChild(saveAs);
    menu.appendChild(saveRow);
    const names = await listSubjectNames();
    if (!names.length) menu.appendChild(el("div", "h3s-mhdr", "No saved subjects yet."));
    for (const name of names) {
      const item = el("div", "h3s-mitem");
      const label = el("span", "h3s-mname", name);
      label.title = "Insert " + name + " as a new row";
      const edit = el("button", "h3s-btn", "Edit");
      edit.title = "Load this into the active row";
      const del = el("button", "h3s-btn h3s-drop", "Drop");
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
  document.addEventListener("pointerdown", (e) => {
    if (menu.style.display === "none") return;
    if (menu.contains(e.target) || savedBtn.contains(e.target)) return;
    closeMenu();
  });

  const domWidget = node.addDOMWidget("h3subject_ui", "h3-subject", root, {
    serialize: false,
    hideOnZoom: false,
    getMinHeight: () => 160,
  });
  repairWidgetWidth(domWidget);

  const previousConfigure = node.onConfigure;
  node.onConfigure = function () {
    node._h3sConfigured = true;
    previousConfigure?.apply(this, arguments);
    try {
      const parsed = JSON.parse(stateWidget.value || "{}");
      if (parsed && typeof parsed === "object") {
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, defaultState(), parsed);
      }
    } catch (e) { /* keep the editor state */ }
    if (!Array.isArray(state.subjects)) state.subjects = [];
    if (!Array.isArray(state.wardrobes)) state.wardrobes = [];
    taskSel.value = state.task || "reference generation";
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
    else if (box.placeholder.startsWith("[Shot 1]")) box.dataset.key = "detailed";
    else if (box.placeholder.startsWith("room tone")) box.dataset.key = "soundscape";
    else if (box.placeholder.startsWith("leave empty")) box.dataset.key = "music";
  });

  const previousRemoved = node.onRemoved;
  node.onRemoved = function () {
    previousRemoved?.apply(this, arguments);
    closeMenu();
    menu.remove();
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
  setTimeout(() => {
    if (node._h3sConfigured) return;
    node.setSize?.([
      Math.max(Number(node.size?.[0]) || 560, 560),
      Math.max(Number(node.size?.[1]) || 520, 520),
    ]);
  }, 0);
}

app.registerExtension({
  name: "h3subject.prompt",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "H3SubjectPrompt") return;
    if (nodeType.prototype._h3sPatched) return;
    nodeType.prototype._h3sPatched = true;
    const previous = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      previous?.apply(this, arguments);
      setup(this);
    };
  },
});
