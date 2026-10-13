// Motion DNA panel — Agent section. Type an order; the panel runs Claude Code in the background (Node.js in CEP),
// in the repo folder, with the Motion DNA MCP server and the context of the open comp. Claude follows CLAUDE.md,
// drives After Effects through the bridge, and its steps and answer stream back here. After Effects stays responsive.
//   Safe mode: only the Motion DNA tools (apply, read layers, render frames…).
//   Full mode: also Figma, reading and writing files in the repo and its scripts. Never git commit or push.
// One-time setup (the user, in a terminal): sign the CLI in, and optionally connect Figma's MCP server.
"use strict";

const AG = {
  node: null, exe: null, ready: false, logged: null, proc: null, session: store.get("agentSession", null),
  mode: store.get("agentMode", "safe"), ctx: store.get("agentCtx", { brand: true, comp: true, selection: true }),
  log: store.get("agentLog", []),   // [{role: "you"|"agent"|"step"|"done"|"error", text}]
};
const nodeReq = () => window.require || (window.cep_node && window.cep_node.require) || null;

// the newest Claude Code shipped with the desktop app (its folder changes with every update), else `claude` on PATH
function findClaude() {
  const req = nodeReq(); if (!req) return null;
  const fs = req("fs"), path = req("path"), os = req("os");
  // the Windows Store build of the desktop app keeps its files in a private folder (AppData\Local\Packages\Claude_*  // LocalCache\Roaming): other programs, like After Effects, only see them there
  const bases = [path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Claude", "claude-code")];
  try {
    const pk = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Packages");
    for (const d of fs.readdirSync(pk)) if (/^Claude_/i.test(d)) bases.push(path.join(pk, d, "LocalCache", "Roaming", "Claude", "claude-code"));
  } catch (e) {}
  const cands = [];
  for (const base of bases) {
    try {
      for (const v of fs.readdirSync(base)) for (const h of fs.readdirSync(path.join(base, v))) {
        const exe = path.join(base, v, h, process.platform === "win32" ? "claude.exe" : "claude");
        if (fs.existsSync(exe)) cands.push({ v, exe });
      }
    } catch (e) {}
  }
  const ver = (s) => s.split(".").map((n) => +n || 0);
  cands.sort((a, b) => { const x = ver(a.v), y = ver(b.v); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; });
  if (cands.length) return cands[0].exe;
  if (process.platform !== "win32" && fs.existsSync("/usr/local/bin/claude")) return "/usr/local/bin/claude";
  return "claude";
}
// header dots for Claude and Figma: checked when the panel opens, every 10 minutes, and after Setup's Check again
function setDot(id, state, tip) {   // state: true (ok) | false (needs action) | null (checking / unknown)
  const b = document.getElementById(id); if (!b) return;
  b.classList.toggle("on", state === true); b.classList.toggle("off", state === false); b.title = tip;
}
async function connStatus() {
  if (!IN_AE || !nodeReq()) {
    const why = IN_AE ? "Node.js is off in this panel: restart After Effects" : "only inside After Effects";
    setDot("st-claude", null, "Claude Code: " + why); setDot("st-figma", null, "Figma: " + why); return;
  }
  AG.exe = AG.exe || findClaude();
  setDot("st-claude", null, "Claude Code sign-in: checking…"); setDot("st-figma", null, "Figma: checking…");
  AG.logged = await authStatus();
  setDot("st-claude", AG.logged, AG.logged ? "Claude Code: signed in (Agent ready)" : AG.logged === false ? "Claude Code: not signed in. Click for the one-step setup." : "Claude Code: not found. Click for setup.");
  if (typeof agent.draw === "function") agent.draw();
  AG.figma = await figmaStatus();
  setDot("st-figma", AG.figma === "connected", { connected: "Figma: connected (Agent, Full mode)", auth: "Figma: added, needs sign-in. Click for the step.",
    missing: "Figma: not connected. Click to connect it.", unknown: "Figma: status unknown. Click to check." }[AG.figma]);
  if (AG.figma === "unknown") setDot("st-figma", null, "Figma: status unknown. Click to check.");
}
function openSetup() { S.sec = "agent"; store.set("section", "agent"); showSection(); if (agent.showSetup) agent.showSetup(); }
function figmaStatus() {   // "connected" | "auth" | "missing" | "unknown" (claude mcp list runs a health check: a few seconds)
  return new Promise((resolve) => {
    try {
      nodeReq()("child_process").execFile(AG.exe, ["mcp", "list"], { timeout: 45000, windowsHide: true, cwd: S.root || undefined }, (err, out) => {
        const line = String(out || "").split(/\r?\n/).find((l) => /^figma:/i.test(l.trim()));
        if (!line) return resolve(err ? "unknown" : "missing");
        resolve(/connected/i.test(line) && !/fail|need/i.test(line) ? "connected" : "auth");
      });
    } catch (e) { resolve("unknown"); }
  });
}
document.addEventListener("DOMContentLoaded", () => {
  for (const id of ["st-claude", "st-figma"]) { const b = document.getElementById(id); if (b) b.onclick = openSetup; }
});
setTimeout(() => { connStatus(); setInterval(connStatus, 10 * 60 * 1000); }, 2500);

function authStatus() {
  return new Promise((resolve) => {
    try {
      nodeReq()("child_process").execFile(AG.exe, ["auth", "status"], { timeout: 20000, windowsHide: true }, (err, out) => {
        try { resolve(JSON.parse(out).loggedIn === true); } catch (e) { resolve(null); }
      });
    } catch (e) { resolve(null); }
  });
}

const SAFE_TOOLS = ["mcp__motion-dna"];
const FULL_TOOLS = ["mcp__motion-dna", "mcp__figma", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch",
  "Bash(python:*)", "Bash(python3:*)", "Bash(bash tools/:*)", "Bash(ffmpeg:*)", "Bash(ffprobe:*)", "Bash(ls:*)", "Bash(mkdir:*)"];
const NEVER = ["Bash(git commit:*)", "Bash(git push:*)", "Bash(git reset:*)", "Bash(rm -rf:*)"];

const TEMPLATES = [
  ["Figma → animate", "Take the frames from this Figma file: <paste URL>. Import their assets into After Effects as editable layers and animate them in the <style> style. Render a few check frames and tell me what you built."],
  ["Brand this comp", "Animate the open comp in the active brand's style: use its curves and timing benchmarks, follow its rules, then render a frame to check."],
  ["Review vs brand", "Review the open comp against the active brand's rules and timing. List what breaks them, without changing anything."],
  ["Explain selection", "Describe the animation on the selected layers: properties, durations in frames, curves, and which Motion DNA preset or curve is closest."],
];

async function contextBlock() {
  const lines = ["[Motion DNA panel · Agent section. Follow CLAUDE.md. Report briefly what you did; ask before any paid generation.]"];
  if (AG.ctx.brand && typeof activeBrand === "function" && activeBrand()) { const b = activeBrand(); lines.push(`Active brand: ${b.name} (library/brands/${b.slug}/brand.json).`); }
  if (AG.ctx.comp || AG.ctx.selection) {
    const c = parse(await call("mdna_context"));
    if (AG.ctx.comp && c.comp) lines.push(`Open comp: "${c.comp.name}" ${c.comp.width}x${c.comp.height} @ ${c.comp.fps} fps, ${c.comp.duration} s, ${c.comp.layers} layers.`);
    if (AG.ctx.comp && c.project) lines.push(`Project: ${c.project}`);
    if (AG.ctx.selection && c.selected && c.selected.length) lines.push(`Selected layers: ${c.selected.join(", ")}.`);
  }
  return lines.join("\n");
}

function saveLog() { store.set("agentLog", AG.log.slice(-200)); }
function push(role, text) { AG.log.push({ role, text }); saveLog(); agent.draw(); }

async function runAgent(prompt) {
  if (AG.proc) return;
  const cp = nodeReq()("child_process");
  push("you", prompt);
  const full = (await contextBlock()) + "\n\n" + prompt;
  const args = ["-p", full, "--output-format", "stream-json", "--verbose", "--mcp-config", ".mcp.json",
    "--allowedTools", ...(AG.mode === "full" ? FULL_TOOLS : SAFE_TOOLS), "--disallowedTools", ...NEVER];
  if (AG.session) args.push("--resume", AG.session);
  const t0 = Date.now();
  let buf = "", gotResult = false;
  AG.proc = cp.spawn(AG.exe, args, { cwd: S.root, windowsHide: true, env: Object.assign({}, process.env) });
  agent.draw();
  AG.proc.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let m; try { m = JSON.parse(line); } catch (e) { continue; }
      if (m.session_id) { AG.session = m.session_id; store.set("agentSession", AG.session); }
      if (m.type === "assistant" && m.message && m.message.content) {
        for (const c of m.message.content) {
          if (c.type === "text" && c.text.trim()) push("agent", c.text.trim());
          if (c.type === "tool_use") push("step", stepText(c));
        }
      } else if (m.type === "result") {
        gotResult = true;
        const secs = Math.round((m.duration_ms || Date.now() - t0) / 1000);
        if (m.is_error) push("error", (m.result || m.subtype || "The agent stopped with an error.") + ` · ${secs}s`);
        else push("done", `Done in ${secs}s` + (m.num_turns ? ` · ${m.num_turns} turns` : ""));
      }
    }
  });
  let err = "";
  AG.proc.stderr.on("data", (d) => { err += d.toString(); });
  AG.proc.on("close", (code) => {
    AG.proc = null;
    if (!gotResult) push(code === null ? "error" : "error", code === null ? "Stopped." : (err.trim().split("\n").slice(-3).join(" ") || `Claude Code exited (${code}).`));
    agent.draw();
  });
  AG.proc.on("error", (e) => { AG.proc = null; push("error", "Could not start Claude Code: " + e.message); });
}
function stepText(c) {
  const n = c.name.replace(/^mcp__motion-dna__/, "").replace(/^mcp__figma__/, "Figma · ").replace(/^mcp__/, "");
  const i = c.input || {};
  const hint = i.preset || i.name || i.file_path || i.path || i.url || i.command || i.pattern || "";
  return n + (hint ? " · " + String(hint).slice(0, 80) : "");
}
function stopAgent() { if (AG.proc) { try { AG.proc.kill(); } catch (e) {} } }

function agent() {
  const sec = $("#sec-agent"); sec.replaceChildren();
  if (!IN_AE || !nodeReq()) {
    sec.append(h("div", { class: "card-box" }, h("b", {}, "Agent"), h("span", { class: "dim" },
      IN_AE ? "Node.js is not enabled in this panel yet: close and reopen the panel (Window > Extensions > Motion DNA)." : "The Agent runs inside After Effects (it starts Claude Code on this computer).")));
    return;
  }
  AG.node = true; AG.exe = AG.exe || findClaude();
  const logEl = h("div", { class: "agent-log" });
  const input = h("textarea", { class: "field agent-input", rows: 3, placeholder: "Give the agent an order… (Ctrl+Enter to send)" });
  const send = h("button", { class: "solid apply", onclick: () => go() }, "Send");
  const stop = h("button", { class: "solid remove", onclick: stopAgent }, "Stop");
  const go = () => { const v = input.value.trim(); if (!v || AG.proc) return; input.value = ""; runAgent(v); };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(); } });

  const chip = (key, label) => h("button", { class: "chip" + (AG.ctx[key] ? " on" : ""), title: `Send the ${label.toLowerCase()} with the order`,
    onclick: (e) => { AG.ctx[key] = !AG.ctx[key]; store.set("agentCtx", AG.ctx); e.currentTarget.classList.toggle("on", AG.ctx[key]); } }, label);
  const modeSeg = h("div", { class: "seg small" }, ...[["safe", "Safe"], ["full", "Full"]].map(([k, l]) => h("button", {
    class: AG.mode === k ? "on" : "", title: k === "safe" ? "Only the Motion DNA tools (apply, layers, frames)" : "Also Figma, files and scripts in the repo (never commits or pushes)",
    onclick: () => { AG.mode = k; store.set("agentMode", k); agent(); } }, l)));
  const templates = h("div", { class: "chips" }, ...TEMPLATES.map(([label, text]) => h("button", { class: "chip ghost", title: text, onclick: () => { input.value = text; input.focus(); } }, label)));
  const newBtn = h("button", { class: "btn", title: "Start a new conversation (the agent forgets this thread)", onclick: () => {
    if (AG.proc) return; AG.session = null; store.set("agentSession", null); AG.log = []; saveLog(); agent.draw(); } }, "New");
  const setup = h("div", { class: "card-box setup", hidden: true });

  agent.draw = () => {
    logEl.replaceChildren(...(AG.log.length ? AG.log : [{ role: "hint", text: "Orders run with the repo's rules (CLAUDE.md), the library and the brands. Try a template below." }]).map((m) =>
      h("div", { class: "msg " + m.role }, m.role === "step" ? "▸ " + m.text : m.text)));
    if (AG.proc) logEl.append(h("div", { class: "msg working" }, h("i", { class: "spin" }), "Working…"));
    logEl.scrollTop = logEl.scrollHeight;
    send.hidden = !!AG.proc; stop.hidden = !AG.proc; input.disabled = !!AG.proc || AG.logged === false;
  };

  sec.append(
    h("div", { class: "kit-top" }, h("span", { class: "kit-title" }, "Agent"), modeSeg, newBtn,
      h("button", { class: "btn", title: "Connections: Claude sign-in and Figma", onclick: () => agent.showSetup() }, "Setup")),
    setup, logEl,
    h("div", { class: "chips" }, h("span", { class: "dim" }, "Context:"), chip("brand", "Brand"), chip("comp", "Comp"), chip("selection", "Selection")),
    input, h("div", { class: "crow" }, send, stop), templates);
  agent.draw();

  // setup: shown by itself while the CLI is not signed in, and any time from the Setup button (Claude + Figma status)
  const runCmd = () => process.platform === "win32" ? `& "${AG.exe}"` : `"${AG.exe}"`;   // PowerShell needs & before a quoted path
  const cmdRow = (cmd) => h("div", { class: "cmdrow" }, h("code", { class: "cmd" }, cmd),
    h("button", { class: "btn", onclick: () => { navigator.clipboard && navigator.clipboard.writeText(cmd); toast("Command copied: paste it in PowerShell."); } }, "Copy"));
  const figmaStatusLocal = () => new Promise((resolve) => {   // replaced by the global figmaStatus()
    try {
      nodeReq()("child_process").execFile(AG.exe, ["mcp", "list"], { timeout: 45000, windowsHide: true, cwd: S.root }, (err, out) => {
        const line = String(out || "").split(/\r?\n/).find((l) => /^figma:/i.test(l.trim()));
        if (!line) return resolve(err ? "unknown" : "missing");
        resolve(/connected/i.test(line) && !/fail|need/i.test(line) ? "connected" : "auth");
      });
    } catch (e) { resolve("unknown"); }
  });
  const showSetup = async () => {
    setup.hidden = false;
    const row = (ok, label, detail) => h("div", { class: "status-row" }, h("i", { class: "sdot " + (ok === true ? "ok" : ok === false ? "no" : "") }), h("b", {}, label), h("span", { class: "dim" }, detail));
    setup.replaceChildren(h("div", { class: "kit-top" }, h("b", { class: "kit-title" }, "Setup"), h("button", { class: "btn ghost", title: "Close", onclick: () => (setup.hidden = true) }, "✕")),
      row(AG.logged, "Claude", AG.logged ? "signed in" : "not signed in"), h("div", { class: "dim" }, "Checking Figma…"));
    const fig = await figmaStatus(); AG.figma = fig;
    setDot("st-figma", fig === "connected", fig === "connected" ? "Figma: connected (Agent, Full mode)" : "Figma: needs attention. Click for the step.");
    setDot("st-claude", AG.logged, AG.logged ? "Claude Code: signed in (Agent ready)" : "Claude Code: not signed in. Click for the one-step setup.");
    const parts = [h("div", { class: "kit-top" }, h("b", { class: "kit-title" }, "Setup"), h("button", { class: "btn ghost", title: "Close", onclick: () => (setup.hidden = true) }, "✕")),
      row(AG.logged, "Claude", AG.logged ? "signed in" : "not signed in")];
    if (!AG.logged) parts.push(h("span", {}, "Sign in once: paste this in PowerShell (it opens your browser; paste the code it shows back into PowerShell):"), cmdRow(`${runCmd()} auth login`));
    parts.push(row(fig === "connected", "Figma", { connected: "connected", auth: "added, needs sign-in", missing: "not connected", unknown: "unknown" }[fig]));
    if (fig === "missing" || fig === "unknown") parts.push(h("span", {}, "1 · Add Figma's MCP server (PowerShell):"), cmdRow(`${runCmd()} mcp add --scope user --transport http figma https://mcp.figma.com/mcp`));
    if (fig !== "connected") parts.push(h("span", {}, (fig === "auth" ? "" : "2 · ") + "Sign in to Figma once: open Claude Code with this, type /mcp, pick figma › Authenticate, allow it in the browser, then /exit:"), cmdRow(runCmd()));
    parts.push(h("div", { class: "crow" }, h("button", { class: "btn", onclick: async () => { AG.logged = await authStatus(); agent.draw(); showSetup(); } }, "Check again")),
      h("span", { class: "dim" }, "Figma orders need Full mode."));
    setup.replaceChildren(...parts);
  };
  agent.showSetup = showSetup;
  authStatus().then((ok) => { AG.logged = ok; agent.draw(); if (!ok) showSetup(); });
}
