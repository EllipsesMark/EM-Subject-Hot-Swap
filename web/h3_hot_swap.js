/**
 * EM Subject Hot Swap shell — tabs host the Ref Images / RefMods / Mix / I2V panels.
 * Same routes and chrome; envelope state; Hand-Tie widget hide; fixed sockets;
 * aspect + megapixel resolution with a live W×H readout.
 */
import { app } from "../../scripts/app.js";

const NODE = "H3SubjectHotSwap";
const MODES = [
  { id: "stills", label: "Ref Images", panel: "stills" },
  { id: "refmods", label: "RefMods", panel: "refmods" },
  { id: "mix", label: "Mix", panel: "mix" },
  { id: "i2v", label: "I2V", panel: "i2v" },
];

// Sockets are fixed, like H3 Studio: every tab sees the same input list.
const HIDDEN_WIDGETS = ["state", "aspect_ratio", "megapixels", "seconds", "ref_image_size"];

// Duration Pixaroma recipe: round(seconds*24), floor 5, snap UP to 17n+5.
// Mirrors h3_subject_prompt/duration.py.
const FPS = 24;
function framesFromSeconds(seconds) {
  let s = Number(seconds);
  if (!(s >= 0)) s = 5;
  s = Math.min(149.5, s);
  let raw = Math.round(s * FPS);
  if (raw < 5) raw = 5;
  const rem = (((raw - 5) % 17) + 17) % 17;
  if (rem) raw += 17 - rem;
  return raw;
}

// Resolution Selector Ext - Grouped, folded in. Mirrors h3_subject_prompt/resolution.py.
const ASPECTS = [
  "1:1 (Square)", "3:4 (Standard Portrait)", "4:3 (Standard Format)",
  "4:5 (Canvas Portrait)", "5:4 (Canvas Format)", "2:3 (Medium Portrait)",
  "3:2 (Photo Format)", "9:16 (Tall Portrait)", "16:9 (Widescreen)",
  "9:18 (Extended Portrait)", "18:9 (Extended Widescreen)",
  "1:3 (Tall Panorama)", "3:1 (Panorama)", "21:9 (Ultrawide)",
];
const MULTIPLE = 32;
const MINIMUM = 256;

function gcd(a, b) { while (b) [a, b] = [b, a % b]; return a; }

function selectResolution(aspect, megapixels) {
  const m = String(aspect || "").match(/^(\d+):(\d+)/);
  const rw = m ? Number(m[1]) : 16;
  const rh = m ? Number(m[2]) : 9;
  const mp = Number(megapixels) > 0 ? Number(megapixels) : 1;
  const scale = Math.sqrt((mp * 1024 * 1024) / (rw * rh));
  let w = Math.round((rw * scale) / MULTIPLE) * MULTIPLE;
  let h = Math.round((rh * scale) / MULTIPLE) * MULTIPLE;
  if (w < MINIMUM || h < MINIMUM) {
    const sw = MULTIPLE / gcd(rw, MULTIPLE);
    const sh = MULTIPLE / gcd(rh, MULTIPLE);
    const kStep = (sw * sh) / gcd(sw, sh);
    const minK = Math.ceil(Math.max(MINIMUM / rw, MINIMUM / rh));
    const k = Math.ceil(minK / kStep) * kStep;
    w = rw * k;
    h = rh * k;
  }
  return [w, h];
}

const EMPTY = {
  stills: {
    task: "reference generation", subjects: [], summary: "", opening: "",
    detailed: "", soundscape: "", music: "", idea: "", pass: "develop",
    subject_reinforced: true,
  },
  refmods: {
    task: "reference generation", mods: [], summary: "", opening: "",
    detailed: "", soundscape: "", music: "", idea: "", pass: "develop",
    style_mode: "amateur", shot_size: "medium close-up",
    motion: { weight: false, contact: false, follow: false, settle: false },
    subject_reinforced: true,
  },
  mix: {
    task: "reference generation", mods: [], summary: "", opening: "",
    detailed: "", soundscape: "", music: "", idea: "", pass: "develop",
    style_mode: "amateur", shot_size: "medium close-up",
    motion: { weight: false, contact: false, follow: false, settle: false },
    subject_reinforced: true,
  },
  i2v: {
    idea: "", prompt: "", style_mode: "cinematic", shot_size: "medium shot",
    subject: "subject", pass: "stay", first_file: "", last_file: "",
    motion: { weight: false, contact: false, follow: false, settle: false },
  },
};

const CSS = `
.h3hs-shell { box-sizing:border-box; width:100%; height:100%; min-height:0;
  display:flex; flex-direction:column; gap:6px; padding:8px; overflow:hidden;
  background:#1a1a1a; color:#ddd; border:1px solid #555; border-radius:8px; font:12px/1.4 sans-serif; }
.h3hs-shell * { box-sizing:border-box; }
.h3hs-shell-bar { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.h3hs-shell-title { color:#46b4e6; font-weight:700; font-size:13px; white-space:nowrap; }
.h3hs-shell-tabs { display:flex; gap:4px; flex-wrap:wrap; margin-left:auto; }
.h3hs-shell-btn { background:#333; border:1px solid #555; border-radius:4px; color:#bbb;
  font:11px sans-serif; cursor:pointer; padding:3px 10px; line-height:16px; }
.h3hs-shell-btn:hover { border-color:#46b4e6; color:#fff; }
.h3hs-shell-btn.on { border-color:#46b4e6; color:#46b4e6; background:#2a3a42; }
.h3hs-shell-size { display:flex; gap:8px; flex-wrap:wrap; align-items:end;
  padding-bottom:6px; border-bottom:1px solid #333; }
.h3hs-shell-field { display:flex; flex-direction:column; gap:2px; color:#46b4e6; font:600 10px monospace; }
.h3hs-shell-field input, .h3hs-shell-field select {
  width:72px; background:#1d1d1d; border:1px solid #444; border-radius:4px; color:#ddd;
  font:12px monospace; padding:3px 5px; }
.h3hs-shell-field select { width:84px; }
.h3hs-shell-field select.h3hs-shell-aspect { width:190px; }
.h3hs-shell-frames { color:#bbb; font-weight:600; }
.h3hs-shell-dims { align-self:center; color:#e7b15a; font:700 13px monospace; min-width:84px;
  white-space:nowrap; padding:3px 6px; border:1px solid #444; border-radius:4px; background:#1d1d1d; }
.h3hs-shell-host { flex:1; min-height:0; overflow:auto; position:relative; }
.h3hs-shell-pane { display:none; min-height:100%; }
.h3hs-shell-pane.on { display:flex; flex-direction:column; }
.h3hs-shell-wait { color:#e7b15a; padding:16px; }
/* Hosted panels: no nested box, no duplicate title; the tab is the title. */
.h3hs-shell .h3sr-root, .h3hs-shell .h3m-root, .h3hs-shell .h3h-root, .h3hs-shell .h3v-root {
  border:none; border-radius:0; padding:0; background:transparent;
  height:auto; min-height:100%; flex:1; overflow:visible; }
.h3hs-shell .h3sr-title, .h3hs-shell .h3m-title, .h3hs-shell .h3h-title, .h3hs-shell .h3v-title { display:none; }
`;

function ensureStyle() {
  if (document.getElementById("h3hs-shell-style")) return;
  const s = document.createElement("style");
  s.id = "h3hs-shell-style";
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

function hideWidget(w) {
  if (!w || w._h3hsHidden) return;
  w._h3hsHidden = true;
  w._h3hsSaved = {
    type: w.type, computeSize: w.computeSize, computeLayoutSize: w.computeLayoutSize,
    draw: w.draw, options: w.options,
  };
  w.type = "hidden";
  w.hidden = true;
  w.options = Object.assign({}, w.options || {}, {
    hidden: true, hideInPanel: true, canvasOnly: true,
    serialize: w.options?.serialize !== false,
  });
  w.computeSize = () => [0, -4];
  w.computeLayoutSize = () => ({ minHeight: 0, maxHeight: 0, minWidth: 0, maxWidth: 0 });
  w.draw = () => {};
  for (const node of (w.element ? [w.element] : (w.inputEl ? [w.inputEl] : []))) {
    if (!node?.style) continue;
    node.style.setProperty("display", "none", "important");
  }
}

// Same width guard the dedicated writers use: classic canvas must not keep a
// stale Vue-mode widget.width, or the DOM widget renders a narrow column.
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

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function defaultEnvelope() {
  return {
    mode: "mix",
    stills: clone(EMPTY.stills),
    refmods: clone(EMPTY.refmods),
    mix: clone(EMPTY.mix),
    i2v: clone(EMPTY.i2v),
  };
}

function parseEnvelope(raw) {
  let data = {};
  try { data = JSON.parse(raw || "{}") || {}; } catch { data = {}; }
  if (!data.mode && (data.mods || data.subjects || data.prompt != null)) {
    const env = defaultEnvelope();
    if (data.subjects) { env.mode = "stills"; env.stills = Object.assign(clone(EMPTY.stills), data); }
    else if (data.prompt != null && !data.mods && !data.subjects) {
      env.mode = "i2v"; env.i2v = Object.assign(clone(EMPTY.i2v), data);
    } else { env.mode = "mix"; env.mix = Object.assign(clone(EMPTY.mix), data); }
    return env;
  }
  const env = defaultEnvelope();
  if (MODES.some((m) => m.id === data.mode)) env.mode = data.mode;
  for (const key of ["stills", "refmods", "mix", "i2v"]) {
    if (data[key] && typeof data[key] === "object") {
      env[key] = Object.assign(clone(EMPTY[key]), data[key]);
    }
  }
  return env;
}

function modeStateApi(getEnv, setEnv, mode) {
  return {
    get value() {
      return JSON.stringify(getEnv()[mode] || {});
    },
    set value(raw) {
      let blob = {};
      try { blob = JSON.parse(raw || "{}") || {}; } catch { blob = {}; }
      const env = getEnv();
      env[mode] = blob;
      setEnv(env);
    },
    inputEl: null,
    serializeValue() { return this.value; },
  };
}

function setup(node) {
  if (node._h3hsShellMounted || typeof node.addDOMWidget !== "function") return;
  const stateWidget = node.widgets?.find((w) => w.name === "state");
  if (!stateWidget) return;
  node._h3hsShellMounted = true;
  ensureStyle();

  for (const name of HIDDEN_WIDGETS) hideWidget(node.widgets?.find((w) => w.name === name));
  const si = node.inputs?.findIndex((x) => x && x.name === "state") ?? -1;
  if (si !== -1) node.removeInput(si);

  let env = parseEnvelope(stateWidget.value);
  node._h3hsMode = env.mode;

  function persist() {
    stateWidget.value = JSON.stringify(env);
  }
  stateWidget.serializeValue = () => {
    persist();
    return stateWidget.value;
  };

  const root = el("div", "h3hs-shell");
  stop(root);
  const bar = el("div", "h3hs-shell-bar");
  bar.append(el("span", "h3hs-shell-title", "EM Subject Hot Swap"));

  const sizeRow = el("div", "h3hs-shell-size");
  const widget = (name) => node.widgets?.find((x) => x.name === name);

  // W×H readout on the left; aspect + megapixels decide it.
  const dims = el("span", "h3hs-shell-dims", "");
  const aspectW = widget("aspect_ratio");
  const mpW = widget("megapixels");
  const aspectBox = el("label", "h3hs-shell-field");
  aspectBox.append(el("span", null, "aspect"));
  const aspectSel = document.createElement("select");
  aspectSel.className = "h3hs-shell-aspect";
  for (const v of ASPECTS) aspectSel.append(new Option(v, v));
  aspectSel.value = ASPECTS.includes(aspectW?.value) ? aspectW.value : "16:9 (Widescreen)";
  stop(aspectSel);
  aspectBox.append(aspectSel);
  const mpBox = el("label", "h3hs-shell-field");
  mpBox.append(el("span", null, "MP"));
  const mpInput = document.createElement("input");
  mpInput.type = "number";
  mpInput.step = "0.01";
  mpInput.min = "0.1";
  mpInput.max = "16";
  mpInput.value = String(Number(mpW?.value) > 0 ? Number(mpW.value) : 1);
  stop(mpInput);
  mpBox.append(mpInput);

  function paintDims() {
    const [w, h] = selectResolution(aspectSel.value, mpInput.value);
    dims.textContent = `${w}×${h}`;
    dims.title = `${w} × ${h} — sides on ${MULTIPLE}px, from ${aspectSel.value} at ${mpInput.value} MP`;
  }
  aspectSel.addEventListener("change", () => {
    if (aspectW) { aspectW.value = aspectSel.value; aspectW.callback?.(aspectW.value); }
    paintDims();
  });
  mpInput.addEventListener("change", () => {
    let v = Number(mpInput.value);
    if (!(v > 0)) v = 1;
    v = Math.min(16, Math.max(0.1, Math.round(v * 100) / 100));
    mpInput.value = String(v);
    if (mpW) { mpW.value = v; mpW.callback?.(v); }
    paintDims();
  });

  const secW = widget("seconds");
  const secBox = el("label", "h3hs-shell-field");
  secBox.append(el("span", null, "seconds"));
  const secInput = document.createElement("input");
  secInput.type = "number";
  secInput.step = "0.1";
  secInput.min = "0.2";
  secInput.max = "149.5";
  secInput.value = String(Number(secW?.value) > 0 ? Number(secW.value) : 5);
  stop(secInput);
  secBox.append(secInput);
  const framesOut = el("span", "h3hs-shell-dims", "");
  framesOut.classList.add("h3hs-shell-frames");

  function paintFrames() {
    const frames = framesFromSeconds(secInput.value);
    node._h3hsFrames = frames;
    framesOut.textContent = `${frames} f · ${(frames / FPS).toFixed(2)} s`;
    framesOut.title = `${frames} frames at 24 fps — snapped up to H3's 17n+5 grid, so the clip plays ${(frames / FPS).toFixed(2)} s`;
    for (const pane of Object.values(panes)) pane.dispatchEvent(new CustomEvent("h3hs-frames"));
  }
  secInput.addEventListener("change", () => {
    let v = Number(secInput.value);
    if (!(v > 0)) v = 5;
    v = Math.min(149.5, Math.max(0.2, Math.round(v * 100) / 100));
    secInput.value = String(v);
    if (secW) { secW.value = v; secW.callback?.(v); }
    paintFrames();
  });

  sizeRow.append(dims, aspectBox, mpBox, secBox, framesOut);
  const refW = widget("ref_image_size");
  const refBox = el("label", "h3hs-shell-field");
  refBox.append(el("span", null, "ref"));
  const refSel = document.createElement("select");
  for (const v of ["match", "max"]) refSel.append(new Option(v, v));
  refSel.value = refW?.value || "match";
  stop(refSel);
  refSel.addEventListener("change", () => {
    if (!refW) return;
    refW.value = refSel.value;
    refW.callback?.(refW.value);
  });
  refBox.append(refSel);
  sizeRow.append(refBox);

  const tabs = el("div", "h3hs-shell-tabs");
  const host = el("div", "h3hs-shell-host");
  // Hosted panels no longer scroll themselves; the host does.
  host.addEventListener("wheel", (e) => {
    let cur = e.target instanceof Element ? e.target : null;
    while (cur && cur !== host) {
      const oy = getComputedStyle(cur).overflowY;
      if ((oy === "auto" || oy === "scroll") && cur.scrollHeight > cur.clientHeight + 1) return;
      cur = cur.parentElement;
    }
    if (host.scrollHeight <= host.clientHeight + 1) return;
    host.scrollTop += e.deltaY;
    e.preventDefault();
    e.stopPropagation();
  }, { passive: false });
  const panes = {};
  const mounted = {};

  function getEnv() { return env; }
  function setEnv(next) {
    env = next;
    persist();
  }

  function mountPanel(modeId, attempt = 0) {
    if (mounted[modeId]) return;
    const panels = globalThis.H3SubjectPanels || {};
    const fn = panels[modeId];
    const pane = panes[modeId];
    if (!pane) return;
    if (!fn) {
      if (attempt < 40) {
        setTimeout(() => mountPanel(modeId, attempt + 1), 50);
        return;
      }
      pane.innerHTML = "";
      pane.append(el("div", "h3hs-shell-wait",
        `Panel “${modeId}” not ready — hard-refresh the browser.`));
      return;
    }
    pane.innerHTML = "";
    fn(node, {
      container: pane,
      stateApi: modeStateApi(getEnv, setEnv, modeId),
    });
    mounted[modeId] = true;
  }

  function showMode(modeId) {
    env.mode = modeId;
    node._h3hsMode = modeId;
    persist();
    for (const btn of tabs.querySelectorAll(".h3hs-shell-btn")) {
      btn.classList.toggle("on", btn.dataset.mode === modeId);
    }
    for (const [id, pane] of Object.entries(panes)) {
      pane.classList.toggle("on", id === modeId);
    }
    refBox.style.display = (modeId === "stills" || modeId === "mix") ? "" : "none";
    mountPanel(modeId);
  }

  // Pull the hidden widgets back into the band after a workflow load.
  function syncBand() {
    if (aspectW && ASPECTS.includes(aspectW.value)) aspectSel.value = aspectW.value;
    if (mpW && Number(mpW.value) > 0) mpInput.value = String(Number(mpW.value));
    if (secW && Number(secW.value) > 0) secInput.value = String(Number(secW.value));
    if (refW && refW.value) refSel.value = refW.value;
    paintDims();
    paintFrames();
  }

  for (const mode of MODES) {
    const btn = el("button", "h3hs-shell-btn", mode.label);
    btn.dataset.mode = mode.id;
    stop(btn);
    btn.addEventListener("click", () => showMode(mode.id));
    tabs.append(btn);
    const pane = el("div", "h3hs-shell-pane");
    pane.dataset.mode = mode.id;
    panes[mode.id] = pane;
    host.append(pane);
  }

  bar.append(tabs);
  root.append(bar, sizeRow, host);

  const domWidget = node.addDOMWidget("h3hotswap_shell", "h3-hot-swap", root, {
    serialize: false,
    hideOnZoom: false,
    getMinHeight: () => 480,
  });
  if (domWidget) {
    domWidget.serialize = false;
    repairWidgetWidth(domWidget);
  }

  const prevConfigure = node.onConfigure;
  node.onConfigure = function () {
    node._h3hsConfigured = true;
    prevConfigure?.apply(this, arguments);
    env = parseEnvelope(stateWidget.value);
    syncBand();
    showMode(env.mode || "mix");
  };

  persist();
  paintDims();
  paintFrames();
  // Panels register as their scripts load; delay first mount slightly.
  setTimeout(() => showMode(env.mode || "mix"), 0);
  setTimeout(() => {
    if (node._h3hsConfigured) return;
    node.setSize?.([
      Math.max(Number(node.size?.[0]) || 620, 620),
      Math.max(Number(node.size?.[1]) || 760, 760),
    ]);
    node.setDirtyCanvas?.(true, true);
  }, 0);
}

app.registerExtension({
  name: "h3subject.hotswap.shell",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE) return;
    const previous = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const result = previous?.apply(this, arguments);
      try { setup(this); }
      catch (err) {
        console.error("[H3 Hot Swap] shell failed", err);
        this._h3hsShellMounted = false;
      }
      return result;
    };
  },
});
