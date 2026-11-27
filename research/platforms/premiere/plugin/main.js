// Motion DNA for Premiere (beta): the panel people keep open while they talk to Claude.
// It connects to the local helper (research/platforms/premiere/helper.py, started by the motion-dna-premiere MCP) over a
// WebSocket on localhost and runs the jobs Claude sends. Each job is the body of an async function receiving
// (ppro, uxp, require) and may carry a `label` in plain words, shown under "What Claude is doing".
const uxp = require("uxp");
const ppro = require("premierepro");
const URL_WS = "ws://127.0.0.1:8737/mdna";
const VERSION = "0.3.0";
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
let ws = null;
const lines = [];

const ASKS = [
  "Make a 9:16 and a 1:1 version of this sequence that keep the person in frame, and export all three.",
  "Add the title \"Two voices\" at the start, Motion DNA style, clear of the faces.",
  "Give the first clip a calm, elegant entrance from the Motion DNA library.",
  "Put a music bed under the edit at the right level and fade it out.",
  "Slow the second clip down to a quarter speed for one second, on Motion DNA curves.",
];

const $ = (id) => document.getElementById(id);

function pill(id, label, state, title) {   // pills as in the AE header: muted, on (spark) or off (coral)
  const el = $(id);
  if (!el) return;
  el.className = "pill" + (state ? " " + state : "");
  el.innerHTML = '<i class="dot"></i>' + label;
  if (title) el.title = title;
}
function status(text, state) { pill("pill-claude", "Claude", state, text); }

// the helix spins next to whatever is running (rest 1 turn / 7 s in AE; working 1 turn / 1.4 s)
const HELIX = { frame: 0, timer: null };
function busy(text) {
  const box = $("busy");
  if (!box) return;
  if (!text) { box.hidden = true; clearInterval(HELIX.timer); HELIX.timer = null; return; }
  $("busy-text").textContent = text;
  box.hidden = false;
  if (!HELIX.timer) HELIX.timer = setInterval(() => {
    HELIX.frame = (HELIX.frame + 1) % 24;
    $("busy-helix").src = "icons/helix/" + String(HELIX.frame).padStart(2, "0") + ".png";
  }, 58);
}
function log(text, err) {
  const t = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  lines.unshift({ t, text, err });
  while (lines.length > 8) lines.pop();
  const box = $("log");
  if (!box) return;
  box.innerHTML = "";
  for (const l of lines) {
    const row = document.createElement("div"); row.className = "row" + (l.err ? " err" : "");
    const a = document.createElement("span"); a.className = "t"; a.textContent = l.t;
    const b = document.createElement("span"); b.textContent = l.text;
    row.appendChild(a); row.appendChild(b); box.appendChild(row);
  }
}
function toJSONable(v, depth) {
  depth = depth || 0;
  if (v === undefined) return null;
  try { JSON.stringify(v); return v; } catch (e) { /* fall through */ }
  if (depth > 2) return String(v);
  if (Array.isArray(v)) return v.map((x) => toJSONable(x, depth + 1));
  if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = toJSONable(v[k], depth + 1); return o; }
  return String(v);
}

function renderAsks() {
  const box = $("asks");
  if (!box) return;
  box.innerHTML = "";
  for (const text of ASKS) {
    const row = document.createElement("div"); row.className = "ask";
    const span = document.createElement("span"); span.textContent = "“" + text + "”";
    const btn = document.createElement("button"); btn.className = "btn"; btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      try { await navigator.clipboard.setContent({ "text/plain": text }); btn.textContent = "Copied"; btn.className = "btn on"; }
      catch (e) { btn.textContent = "Select it"; }
      setTimeout(() => { btn.textContent = "Copy"; btn.className = "btn"; }, 1500);
    });
    row.appendChild(span); row.appendChild(btn); box.appendChild(row);
  }
}

async function refreshProject() {
  try {
    const p = await ppro.Project.getActiveProject();
    if (!p) { $("project").textContent = "Open a project in Premiere"; pill("pill-project", "Project", "", "No project open"); return; }
    const s = await p.getActiveSequence();
    const name = p.name.replace(/\.prproj$/, "");
    $("project").textContent = name + (s ? "  ·  " + s.name : "  ·  no sequence open");
    pill("pill-project", "Project", "on", name);
  } catch (e) { /* the project is busy: try again on the next tick */ }
}

function connect() {
  try {
    ws = new WebSocket(URL_WS);
  } catch (e) {
    status("Cannot reach Claude: " + e, "off");
    setTimeout(connect, 3000);
    return;
  }
  ws.onopen = () => {
    status("Connected to Claude", "on");
    ws.send(JSON.stringify({ hello: true, host: uxp.host && uxp.host.name, version: uxp.host && uxp.host.version, plugin: VERSION }));
  };
  ws.onmessage = async (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    const t0 = Date.now();
    if (msg.label) busy(msg.label + "…");
    let out;
    try {
      const fn = new AsyncFunction("ppro", "uxp", "require", msg.js);
      const result = await fn(ppro, uxp, require);
      out = { id: msg.id, ok: true, ms: Date.now() - t0, result: toJSONable(result) };
      if (msg.label) log(msg.label);
    } catch (e) {
      out = { id: msg.id, ok: false, ms: Date.now() - t0, error: String((e && (e.stack || e.message)) || e) };
      if (msg.label) log(msg.label + ": " + String((e && e.message) || e).slice(0, 70), true);
    }
    if (msg.label) busy(null);
    ws.send(JSON.stringify(out));
    refreshProject();
  };
  ws.onclose = () => {
    status("Waiting for Claude: it connects as soon as you ask it something about Premiere", "");
    setTimeout(connect, 2000);
  };
  ws.onerror = () => { /* onclose follows */ };
}

uxp.entrypoints.setup({ panels: { mdna: { show() { refreshProject(); } } } });
renderAsks();
if ($("foot")) $("foot").textContent = "Motion DNA for Premiere · beta " + VERSION + " · Guide: research/platforms/premiere/GUIDE.md";
refreshProject();
setInterval(refreshProject, 4000);
connect();
