// H3 Create RefMod — Hybrid-style panel; native widgets stay hidden sync targets.

import { app } from "../../scripts/app.js";

const NODE = "H3CreateRefMod";
const HIDE = new Set([
  "name", "folder", "build", "description", "role",
  "layout", "pack", "fit_mode", "step_curve",
  "short_edge", "max_edge", "max_items", "max_frames", "max_tokens", "recursive",
]);

const CSS = `
.h3crm-root { box-sizing:border-box; width:100%; min-width:0;
  display:flex; flex-direction:column; gap:6px; padding:8px;
  background:#1a1a1a; color:#ddd; border:1px solid #555; border-radius:8px;
  font:12px/1.4 sans-serif; }
.h3crm-root *, .h3crm-root *::before, .h3crm-root *::after { box-sizing:border-box; }
.h3crm-bar { display:flex; align-items:center; gap:6px; min-width:0; }
.h3crm-title { color:#46b4e6; font-weight:700; font-size:13px; white-space:nowrap; }
.h3crm-hint { color:#888; margin-left:auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.h3crm-lbl { color:#46b4e6; font:600 11px monospace; }
.h3crm-line { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.h3crm-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 8px; }
.h3crm-grid .h3crm-span2 { grid-column:1 / -1; }
.h3crm-root input[type=text], .h3crm-root input[type=number], .h3crm-root select, .h3crm-root textarea {
  background:#1d1d1d; border:1px solid #444; border-radius:4px; color:#ddd;
  font:13px monospace; padding:4px 6px; width:100%; min-width:0; }
.h3crm-root textarea { resize:vertical; min-height:72px; }
.h3crm-grow { flex:1 1 160px; min-width:0; }
.h3crm-mini { width:120px; flex:0 0 auto; }
.h3crm-note { color:#888; font:11px/1.35 sans-serif; white-space:normal; }
.h3crm-encode { display:none; flex-direction:column; gap:6px; padding-top:4px; border-top:1px solid #333; }
.h3crm-encode.open { display:flex; }
.h3crm-check { display:flex; align-items:center; gap:8px; color:#ccc; font:12px sans-serif; }
.h3crm-check input { width:auto; }
`;

function ensureCss() {
  if (document.getElementById("h3crm-css")) return;
  const el = document.createElement("style");
  el.id = "h3crm-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function hideWidget(widget) {
  if (!widget) return;
  widget.hidden = true;
  widget.computeSize = () => [0, -4];
  if (widget.element) widget.element.style.display = "none";
}

function widgetOf(node, name) {
  return node.widgets?.find((w) => w.name === name);
}

function setWidget(node, name, value) {
  const w = widgetOf(node, name);
  if (!w) return;
  w.value = value;
  if (w.inputEl) w.inputEl.value = value;
  if (w.callback) {
    try { w.callback(value); } catch (e) { /* ignore */ }
  }
}

function stop(node) {
  const block = (e) => { if (e.button === 0) e.stopPropagation(); };
  node.addEventListener("pointerdown", block);
  node.addEventListener("mousedown", block);
}

function addOptions(select, values) {
  for (const opt of values) {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    select.appendChild(o);
  }
}

function setup(node) {
  if (node._h3crmMounted || typeof node.addDOMWidget !== "function") return;
  node._h3crmMounted = true;
  ensureCss();

  for (const w of node.widgets || []) {
    if (HIDE.has(w.name)) hideWidget(w);
  }

  const root = el("div", "h3crm-root");
  stop(root);
  const bar = el("div", "h3crm-bar");
  bar.append(el("span", "h3crm-title", "Create RefMod"), el("span", "h3crm-hint", "folder → models/refmods"));
  root.appendChild(bar);

  const folder = document.createElement("input");
  folder.type = "text";
  folder.className = "h3crm-grow";
  folder.placeholder = "G:\\path\\to\\photo_folder";
  folder.value = String(widgetOf(node, "folder")?.value || "");
  stop(folder);

  const name = document.createElement("input");
  name.type = "text";
  name.className = "h3crm-grow";
  name.placeholder = "blank = folder name";
  name.value = String(widgetOf(node, "name")?.value || "");
  stop(name);

  const desc = document.createElement("textarea");
  desc.rows = 4;
  desc.placeholder = "Who / caption stored on the RefMod";
  desc.value = String(widgetOf(node, "description")?.value || "");
  stop(desc);

  const role = document.createElement("select");
  role.className = "h3crm-mini";
  addOptions(role, [
    "identity", "wardrobe", "background", "generic", "voice",
    "bodyshape", "helper", "pose_motion", "style",
  ]);
  role.value = String(widgetOf(node, "role")?.value || "identity");
  stop(role);

  const build = document.createElement("select");
  build.className = "h3crm-mini";
  addOptions(build, ["start", "stop"]);
  build.value = String(widgetOf(node, "build")?.value || "start");
  stop(build);

  const encodeBox = el("div", "h3crm-encode");
  encodeBox.appendChild(el("div", "h3crm-lbl", "encode settings"));

  const layout = document.createElement("select");
  addOptions(layout, ["separate_pictures", "stacked_video"]);
  layout.value = String(widgetOf(node, "layout")?.value || "separate_pictures");
  stop(layout);

  const pack = document.createElement("select");
  addOptions(pack, ["single", "per_file"]);
  pack.value = String(widgetOf(node, "pack")?.value || "single");
  stop(pack);

  const fit = document.createElement("select");
  addOptions(fit, ["crop", "pad", "stretch"]);
  fit.value = String(widgetOf(node, "fit_mode")?.value || "crop");
  stop(fit);

  const curve = document.createElement("select");
  addOptions(curve, ["full", "early_lock", "late_detail", "fade", "mid_peak"]);
  curve.value = String(widgetOf(node, "step_curve")?.value || "full");
  stop(curve);

  const num = (widgetName, fallback) => {
    const input = document.createElement("input");
    input.type = "number";
    input.value = String(widgetOf(node, widgetName)?.value ?? fallback);
    stop(input);
    return input;
  };
  const shortEdge = num("short_edge", 2048);
  const maxEdge = num("max_edge", 2048);
  const maxItems = num("max_items", 32);
  const maxFrames = num("max_frames", 48);
  const maxTokens = num("max_tokens", 0);

  const recursive = document.createElement("input");
  recursive.type = "checkbox";
  recursive.checked = !!widgetOf(node, "recursive")?.value;
  stop(recursive);
  const recursiveLine = el("label", "h3crm-check");
  recursiveLine.append(recursive, document.createTextNode("Scan subfolders"));

  const grid = el("div", "h3crm-grid");
  const cell = (label, field, span2) => {
    const wrap = el("div", span2 ? "h3crm-span2" : "");
    wrap.append(el("div", "h3crm-lbl", label), field);
    return wrap;
  };
  grid.append(
    cell("layout", layout, true),
    cell("pack", pack),
    cell("fit", fit),
    cell("step curve", curve),
    cell("short edge", shortEdge),
    cell("max edge", maxEdge),
    cell("max items", maxItems),
    cell("max frames", maxFrames),
    cell("max tokens", maxTokens),
  );
  encodeBox.append(grid, recursiveLine);

  function syncEncodeVisibility() {
    encodeBox.classList.toggle("open", !!folder.value.trim());
  }

  function sync() {
    setWidget(node, "folder", folder.value);
    setWidget(node, "name", name.value);
    setWidget(node, "description", desc.value);
    setWidget(node, "role", role.value);
    setWidget(node, "build", build.value);
    setWidget(node, "layout", layout.value);
    setWidget(node, "pack", pack.value);
    setWidget(node, "fit_mode", fit.value);
    setWidget(node, "step_curve", curve.value);
    setWidget(node, "short_edge", Number(shortEdge.value) || 2048);
    setWidget(node, "max_edge", Number(maxEdge.value) || 2048);
    setWidget(node, "max_items", Number(maxItems.value) || 32);
    setWidget(node, "max_frames", Number(maxFrames.value) || 48);
    setWidget(node, "max_tokens", Number(maxTokens.value) || 0);
    setWidget(node, "recursive", !!recursive.checked);
    syncEncodeVisibility();
  }

  const fields = [
    folder, name, desc, role, build, layout, pack, fit, curve,
    shortEdge, maxEdge, maxItems, maxFrames, maxTokens, recursive,
  ];
  for (const field of fields) {
    field.addEventListener("input", sync);
    field.addEventListener("change", sync);
  }

  const roleLine = el("div", "h3crm-line");
  roleLine.append(el("span", "h3crm-lbl", "role"), role, el("span", "h3crm-lbl", "build"), build);

  root.append(
    el("div", "h3crm-lbl", "folder"), folder,
    el("div", "h3crm-lbl", "name"), name,
    el("div", "h3crm-lbl", "description"), desc,
    roleLine,
    encodeBox,
    el("div", "h3crm-note", "Paste an absolute photos folder path (or a path under ComfyUI input/). Wire the H3 video VAE. Encode settings appear after a folder is set. Optional images / video / audio + audio_vae sockets."),
  );

  node._h3crmFields = {
    folder, name, desc, role, build, layout, pack, fit, curve,
    shortEdge, maxEdge, maxItems, maxFrames, maxTokens, recursive,
    sync,
    pull() {
      folder.value = String(widgetOf(node, "folder")?.value || "");
      name.value = String(widgetOf(node, "name")?.value || "");
      desc.value = String(widgetOf(node, "description")?.value || "");
      role.value = String(widgetOf(node, "role")?.value || "identity");
      build.value = String(widgetOf(node, "build")?.value || "start");
      layout.value = String(widgetOf(node, "layout")?.value || "separate_pictures");
      pack.value = String(widgetOf(node, "pack")?.value || "single");
      fit.value = String(widgetOf(node, "fit_mode")?.value || "crop");
      curve.value = String(widgetOf(node, "step_curve")?.value || "full");
      shortEdge.value = String(widgetOf(node, "short_edge")?.value ?? 2048);
      maxEdge.value = String(widgetOf(node, "max_edge")?.value ?? 2048);
      maxItems.value = String(widgetOf(node, "max_items")?.value ?? 32);
      maxFrames.value = String(widgetOf(node, "max_frames")?.value ?? 48);
      maxTokens.value = String(widgetOf(node, "max_tokens")?.value ?? 0);
      recursive.checked = !!widgetOf(node, "recursive")?.value;
      syncEncodeVisibility();
    },
  };

  const dom = node.addDOMWidget("h3crm_panel", "H3CRM_PANEL", root, { serialize: false });
  if (dom && Array.isArray(node.widgets)) {
    const idx = node.widgets.indexOf(dom);
    if (idx > 0) {
      node.widgets.splice(idx, 1);
      node.widgets.unshift(dom);
    }
  }
  sync();
  node.setSize?.([Math.max(node.size?.[0] || 360, 400), Math.max(node.size?.[1] || 280, 420)]);
}

app.registerExtension({
  name: "h3.subject_prompt.create_refmod",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name !== NODE) return;
    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = onNodeCreated?.apply(this, arguments);
      setup(this);
      return r;
    };
    const onConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      const r = onConfigure?.apply(this, arguments);
      this._h3crmFields?.pull?.();
      return r;
    };
  },
});
