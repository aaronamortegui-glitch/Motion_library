// Motion DNA for Premiere (beta): connects to the local helper (research/platforms/premiere/helper.py) over a
// WebSocket on localhost and runs the jobs it sends. Each job is the body of an async function that receives
// (ppro, uxp, require) and returns a JSON-able value. Spike only: the real plugin will expose named commands.
const uxp = require("uxp");
const ppro = require("premierepro");
const URL = "ws://127.0.0.1:8737/mdna";
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
let ws = null;
const lines = [];

function show(text) {
  const el = document.getElementById("status");
  if (el) el.textContent = "Motion DNA: " + text;
}
function log(text) {
  lines.push(new Date().toLocaleTimeString() + "  " + text);
  while (lines.length > 12) lines.shift();
  const el = document.getElementById("log");
  if (el) el.textContent = lines.join("\n");
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

function connect() {
  try {
    ws = new WebSocket(URL);
  } catch (e) {
    show("cannot open socket: " + e);
    setTimeout(connect, 3000);
    return;
  }
  ws.onopen = () => {
    show("connected to the helper");
    log("connected");
    ws.send(JSON.stringify({ hello: true, host: uxp.host && uxp.host.name, version: uxp.host && uxp.host.version, plugin: "0.1.1" }));
  };
  ws.onmessage = async (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    const t0 = Date.now();
    let out;
    try {
      const fn = new AsyncFunction("ppro", "uxp", "require", msg.js);
      const result = await fn(ppro, uxp, require);
      out = { id: msg.id, ok: true, ms: Date.now() - t0, result: toJSONable(result) };
    } catch (e) {
      out = { id: msg.id, ok: false, ms: Date.now() - t0, error: String((e && (e.stack || e.message)) || e) };
    }
    log("job " + msg.id + (out.ok ? " ok " : " error ") + out.ms + " ms");
    ws.send(JSON.stringify(out));
  };
  ws.onclose = (ev) => { show("waiting for the helper… (" + (ev && ev.code) + ")"); console.log("[mdna] ws close", ev && ev.code, ev && ev.reason); setTimeout(connect, 2000); };
  ws.onerror = (ev) => { console.log("[mdna] ws error", (ev && (ev.message || ev.type)) || ev); log("socket error: " + ((ev && (ev.message || ev.type)) || ev)); };
}

console.log("[mdna] plugin main.js loaded");
uxp.entrypoints.setup({ panels: { mdna: { show() { console.log("[mdna] panel shown"); } } } });
connect();
