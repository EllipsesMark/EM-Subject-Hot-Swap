// H3 Delete RefMod — same panel chrome as Create; Confirm stays a real safeguard.

import { app } from "../../scripts/app.js";

const NODE = "H3DeleteRefMod";
const HIDE = new Set(["name", "confirm"]);

const CSS = `
.h3drm-root { box-sizing:border-box; width:100%; min-width:0;
  display:flex; flex-direction:column; gap:6px; padding:8px;
  background:#1a1a1a; color:#ddd; border:1px solid #555; border-radius:8px;
  font:12px/1.4 sans-serif; }
.h3drm-root *, .h3drm-root *::before, .h3drm-root *::after { box-sizing:border-box; }
.h3drm-bar { display:flex; align-items:center; gap:6px; }
.h3drm-title { color:#46b4e6; font-weight:700; font-size:13px; }
.h3drm-hint { color:#888; margin-left:auto; font:11px sans-serif; }
.h3drm-lbl { color:#46b4e6; font:600 11px monospace; }
.h3drm-root input[type=text] {
  background:#1d1d1d; border:1px solid #444; border-radius:4px; color:#ddd;
  font:13px monospace; padding:4px 6px; width:100%; }
.h3drm-line { display:flex; gap:8px; align-items:center; }
.h3drm-note { color:#888; font:11px/1.35 sans-serif; white-space:normal; }
.h3drm-note b { color:#e7b15a; font-weight:600; }
.h3drm-warn { color:#e7b15a; }
`;

function ensureCss() {
  if (document.getElementById("h3drm-css")) return;
  const el = document.createElement("style");
  el.id = "h3drm-css";
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

function setup(node) {
  if (node._h3drmMounted || typeof node.addDOMWidget !== "function") return;
  node._h3drmMounted = true;
  ensureCss();
  for (const w of node.widgets || []) {
    if (HIDE.has(w.name)) hideWidget(w);
  }

  const root = el("div", "h3drm-root");
  stop(root);
  const bar = el("div", "h3drm-bar");
  bar.append(el("span", "h3drm-title", "Delete RefMod"), el("span", "h3drm-hint", "models/refmods"));
  root.appendChild(bar);

  const name = document.createElement("input");
  name.type = "text";
  name.placeholder = "refmod name (no extension)";
  name.value = String(widgetOf(node, "name")?.value || "");
  stop(name);

  const confirm = document.createElement("input");
  confirm.type = "checkbox";
  confirm.checked = Boolean(widgetOf(node, "confirm")?.value);
  stop(confirm);
  const confirmLab = el("label", "h3drm-line");
  confirmLab.append(confirm, el("span", "h3drm-warn", "Confirm delete"));
  stop(confirmLab);

  function sync() {
    setWidget(node, "name", name.value);
    setWidget(node, "confirm", confirm.checked);
  }
  name.addEventListener("input", sync);
  confirm.addEventListener("change", sync);

  root.append(
    el("div", "h3drm-lbl", "name"), name,
    confirmLab,
    el("div", "h3drm-note", "Removes the .safetensors and .preview.jpg. Confirm off = dry run."),
  );

  const dom = node.addDOMWidget("h3drm_panel", "H3DRM_PANEL", root, { serialize: false });
  if (dom && Array.isArray(node.widgets)) {
    const idx = node.widgets.indexOf(dom);
    if (idx > 0) {
      node.widgets.splice(idx, 1);
      node.widgets.unshift(dom);
    }
  }
  sync();
  node.setSize?.([Math.max(node.size?.[0] || 300, 320), Math.max(node.size?.[1] || 160, 180)]);
}

app.registerExtension({
  name: "h3.subject_prompt.delete_refmod",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name !== NODE) return;
    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = onNodeCreated?.apply(this, arguments);
      setup(this);
      return r;
    };
  },
});
