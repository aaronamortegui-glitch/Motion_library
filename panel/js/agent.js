// Motion DNA panel — Agent section. Type an order; the panel runs Claude Code in the background (Node.js in CEP) with the
// Motion DNA MCP server and the context of the open comp. Claude follows CLAUDE.md, drives After Effects through the
// bridge, and its steps and answer stream back here. After Effects stays responsive.
//   Chat     the conversation. Safe mode: only the Motion DNA tools. Full mode: also Figma, files and scripts (never
//            git commit or push). Review notes come back as rule proposals: keep them in the brand, the project or the
//            general rules (CONTRIBUTING §9) with one click.
//   Library  the Styles and Techniques: what each one does, with a ready order to send or copy (for Claude Code too).
//   Project  a folder per piece (motion-dna.project.json + CLAUDE.md + .mcp.json): Claude works there, with its brand,
//            and keeps ONE conversation per project that also opens in the Claude app or a terminal (claude --resume).
// One-time setup: Connect Claude (one button, a sign-in window), and optionally Figma.
"use strict";

const AG = {
  node: null, exe: null, ready: false, logged: null, method: "", proc: null, session: store.get("agentSession", null),
  mode: store.get("agentMode", "safe"), ctx: store.get("agentCtx", { brand: true, comp: true, selection: true }),
  log: store.get("agentLog", []),   // [{role: "you"|"agent"|"step"|"done"|"error"|"rule", text, rule?, state?}]
  tab: store.get("agentTab", "chat"), libKind: store.get("agentLib", "styles"), libSel: null, libQ: "",
  costSeen: store.get("agentCost", {}),   // total_cost_usd is cumulative per conversation: remember the last total
};
let PJ = null;   // the open project: {dir, p} (p = motion-dna.project.json)
const nodeReq = () => window.require || (window.cep_node && window.cep_node.require) || null;
const PROJECT_FOLDERS = ["01_brief", "02_references", "03_footage", "04_audio", "05_ae", "06_renders", "07_exports", "claude"];

// the newest Claude Code shipped with the desktop app (its folder changes with every update), else `claude` on PATH
function findClaude() {
  const req = nodeReq(); if (!req) return null;
  const fs = req("fs"), path = req("path"), os = req("os");
  // the Windows Store build of the desktop app keeps its files in a private folder (AppData\Local\Packages\Claude_*
  // LocalCache\Roaming): other programs, like After Effects, only see them there
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
  setDot("st-claude", AG.logged, AG.logged ? "Claude Code: signed in (Agent ready)" : AG.logged === false ? "Claude Code: not signed in. Click to sign in." : "Claude Code: not found. Click for setup.");
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
        // Figma comes from the Claude account (claude.ai connector "claude.ai Figma") or from a server added by hand ("figma")
        const lines = String(out || "").split(/\r?\n/).map((l) => l.trim()).filter((l) => /^(claude\.ai |plugin:figma:)?figma:/i.test(l));   // account connector, Figma plugin or hand-added
        if (!lines.length) return resolve(err ? "unknown" : "missing");
        const ok = lines.find((l) => /connected/i.test(l) && !/fail|need/i.test(l));
        AG.figmaServer = (ok || lines[0]).split(": http")[0].replace(/:$/, "");   // e.g. "claude.ai Figma", "plugin:figma:figma"
        resolve(ok ? "connected" : "auth");
      });
    } catch (e) { resolve("unknown"); }
  });
}
document.addEventListener("DOMContentLoaded", () => {
  for (const id of ["st-claude", "st-figma"]) { const b = document.getElementById(id); if (b) b.onclick = openSetup; }
});
setTimeout(() => { connStatus(); setInterval(connStatus, 10 * 60 * 1000); }, 2500);

function authStatus() {   // claude auth status: JSON with loggedIn and authMethod (none, claude.ai, oauth_token, api_key…)
  return new Promise((resolve) => {
    try {
      nodeReq()("child_process").execFile(AG.exe, ["auth", "status"], { timeout: 20000, windowsHide: true }, (err, out) => {
        try { const j = JSON.parse(out); AG.method = j.authMethod || ""; resolve(j.loggedIn === true); } catch (e) { resolve(null); }
      });
    } catch (e) { resolve(null); }
  });
}
const SAFE_TOOLS = ["mcp__motion-dna"];
const FULL_TOOLS = ["mcp__motion-dna", "mcp__figma", "mcp__claude_ai_Figma", "mcp__plugin_figma_figma", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch",
  "Bash(python:*)", "Bash(python3:*)", "Bash(bash tools/:*)", "Bash(ffmpeg:*)", "Bash(ffprobe:*)", "Bash(ls:*)", "Bash(mkdir:*)"];
const NEVER = ["Bash(git commit:*)", "Bash(git push:*)", "Bash(git reset:*)", "Bash(rm -rf:*)",
  "mcp__motion-dna__add_brand_note"];   // in the panel the user decides where a rule goes (the proposal card)

const TEMPLATES = [
  ["Figma → animate", "Take the frames from this Figma file: <paste URL>. Import their assets into After Effects as editable layers and animate them in the <style> style. Render a few check frames and tell me what you built."],
  ["Brand this comp", "Animate the open comp in the active brand's style: use its curves and timing benchmarks, follow its rules, then render a frame to check."],
  ["Review vs brand", "Review the open comp against the active brand's rules and timing. List what breaks them, without changing anything."],
  ["Explain selection", "Describe the animation on the selected layers: properties, durations in frames, curves, and which Motion DNA preset or curve is closest."],
];
const EXISTING_ASK = "If a layer I point to already has animation, modify it (keep its keyframe values; change timing, curves and style) unless I say replace; if it has none, create it.";
const RULE_ASK = "When I give you a review note or a correction, apply it, then end your reply with one line per note in exactly this form: " +
  "RULE: <category> | <one instruction anyone can follow without context> | <why, in a few words>. Categories: layout, typography, motion, " +
  "effects, color, audio, edit, process. Do not save rules yourself: the panel asks me where to keep them.";

async function contextBlock() {
  const lines = [`[Motion DNA panel · Agent. Motion DNA (library, tools, rules): ${S.root}; follow its CLAUDE.md. Report briefly what you did; ask before any paid generation. Never save the After Effects project unless I ask. Before you call a build done, run check_layout and fix its warnings (or say why one stays).]`];
  if (!PJ && scope().kind === "brand") lines.push(`You are in the folder of the brand ${scope().name} (${scope().dir}): this conversation is for everything about that brand.`);
  if (PJ) {
    lines.push(`Project: ${PJ.p.name}, folder ${PJ.dir} (your working folder: put what you make in its subfolders, never in the Motion DNA repo).`);
    if (PJ.p.aep) lines.push(`This project's After Effects file: ${PJ.p.aep}. If the open After Effects project is another file, ask before building there.`);
    const pr = (PJ.p.rules || []).slice(-12).map((r) => `- ${r.rule}`);
    if (pr.length) lines.push("Project rules:\n" + pr.join("\n"));
  }
  if (AG.ctx.brand && typeof activeBrand === "function" && activeBrand()) { const b = activeBrand(); lines.push(`Active brand: ${b.name} (slug ${b.slug}): read it with get_brand before animating and follow its rules.`); }
  if (AG.ctx.comp || AG.ctx.selection) {
    const c = parse(await call("mdna_context"));
    if (AG.ctx.comp && c.comp) lines.push(`Open comp: "${c.comp.name}" ${c.comp.width}x${c.comp.height} @ ${c.comp.fps} fps, ${c.comp.duration} s, ${c.comp.layers} layers.`);
    if (AG.ctx.comp && c.project) lines.push(`After Effects project: ${c.project}`);
    if (AG.ctx.selection) lines.push(c.selected && c.selected.length ? `Selected layers (${c.selected.length}): ${c.selected.join(", ")}.`
      : "No layers are selected: an order about \"the selected layers\" means every layer of the open comp.");
  }
  lines.push(EXISTING_ASK, RULE_ASK);
  return lines.join("\n");
}

function saveLog() { store.set("agentLog", AG.log.slice(-200)); }
function push(role, text, extra) { AG.log.push(Object.assign({ role, text }, extra || {})); saveLog(); if (agent.draw) agent.draw(); }

// ---------- projects and conversations ----------
// Where the agent works, and which conversation it continues: the open project (a video), else the active brand's own
// folder (its workspace: everything about that brand), else the Motion DNA folder. Each one keeps its conversation, and
// the same conversation opens in the Claude app. Conversation ids are per computer: brand.json keeps them under
// "claude", which is never exported.
function scope() {
  if (PJ) return { kind: "project", name: PJ.p.name, dir: PJ.dir, owner: PJ.p, save: saveProjectQuiet };
  const x = typeof activeSlug === "function" ? brandOf(activeSlug()) : null;
  if (x && x.dir && x.where !== "template") { x.b.claude = x.b.claude || {}; return { kind: "brand", name: x.b.name, dir: x.dir, owner: x.b.claude, save: () => saveBrand(x), x }; }
  return { kind: "repo", name: "Motion DNA", dir: S.root, owner: null };
}
const cwdNow = () => scope().dir;
const sessionNow = () => { const sc = scope(); return sc.owner ? sc.owner.session || null : AG.session; };
function scopeText() {
  const sc = scope(), b = activeBrand();
  if (sc.kind === "project") return `Working in: video "${sc.name}"` + (b ? ` · brand ${b.name}` : "");
  if (sc.kind === "brand") return `Working in: brand ${sc.name} (its folder and conversation)`;
  return "Working in: Motion DNA · no brand or project yet";
}
function claudeProjectDir(cwd) {   // where Claude Code keeps the conversations of a folder (~/.claude/projects/<cwd with - >)
  const path = nodeReq()("path"), os = nodeReq()("os");
  return path.join(os.homedir(), ".claude", "projects", cwd.replace(/[^A-Za-z0-9]/g, "-"));
}
function sessionFile(id, cwd) { return nodeReq()("path").join(claudeProjectDir(cwd || cwdNow()), id + ".jsonl"); }
function recentSessions(cwd) {   // [{id, mtime, title}] newest first, with the first thing the user asked
  const fs = nodeReq()("fs"), path = nodeReq()("path"), dir = claudeProjectDir(cwd), out = [];
  let files = []; try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")); } catch (e) { return out; }
  for (const f of files) {
    const full = path.join(dir, f); let st; try { st = fs.statSync(full); } catch (e) { continue; }
    let title = "";
    try {
      const fd = fs.openSync(full, "r"), buf = Buffer.alloc(Math.min(st.size, 65536)); fs.readSync(fd, buf, 0, buf.length, 0); fs.closeSync(fd);
      for (const line of buf.toString("utf8").split("\n")) {
        let m; try { m = JSON.parse(line); } catch (e) { continue; }
        if (m.type !== "user" || !m.message) continue;
        const c = m.message.content, t = typeof c === "string" ? c : (Array.isArray(c) ? (c.find((x) => x.type === "text") || {}).text : "");
        if (!t) continue;
        title = t.split("\n\n---\n[Motion DNA panel")[0];
        if (title) break;
      }
    } catch (e) {}
    out.push({ id: f.replace(/\.jsonl$/, ""), mtime: st.mtimeMs, title: (title || "(no message)").replace(/\s+/g, " ").slice(0, 80) });
  }
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, 15);
}
async function loadProject() {
  const r = await call("mdna_project_find", "");
  const prev = PJ && PJ.dir;
  PJ = r && r !== "null" && !String(r).startsWith("ERR") ? parse(r) : null;
  if (PJ && PJ.error) PJ = null;
  if (PJ) { PJ.p.sessions = PJ.p.sessions || []; PJ.p.rules = PJ.p.rules || []; }
  if ((PJ && PJ.dir) !== prev) {
    if (PJ && PJ.p.brand && typeof setActive === "function" && brandOf(PJ.p.brand) && activeSlug() !== PJ.p.brand) setActive(PJ.p.brand);
    if (agent.render) agent.render();
  }
}
async function saveProjectQuiet() { if (PJ) { const r = await call("mdna_project_save", { dir: PJ.dir, text: JSON.stringify(PJ.p, null, 1) + "\n" }); if (String(r).startsWith("ERR")) report(r); } }
function onBrandChange(slug) { if (PJ && PJ.p.brand !== slug) { PJ.p.brand = slug || null; saveProjectQuiet(); if (agent.render) agent.render(); } }
function setSession(id, title) {
  const sc = scope();
  if (sc.owner) {
    sc.owner.sessions = sc.owner.sessions || [];
    if (id && !sc.owner.sessions.some((s) => s.id === id)) sc.owner.sessions.push({ id, title: (title || "").slice(0, 80), started: today() });
    sc.owner.session = id; sc.save();
  } else { AG.session = id; store.set("agentSession", id); }
}
// Opens the conversation in the Claude app (Code tab), where it stays in the sidebar. No conversation yet: the panel
// starts it with a first message that names it ("Motion DNA · Brand: Vela"), then opens it.
function openInClaudeApp(id) {
  const sc = scope();
  if (!id) {
    if (AG.proc) return toast("Wait for the current order to finish.", true);
    const intro = sc.kind === "brand" ? `Motion DNA · Brand: ${sc.name}. This conversation is for everything about this brand: its rules, curves, timing and reviews. Read it with get_brand (${sc.x.b.slug}) and answer in one short line that you are ready.`
      : sc.kind === "project" ? `Motion DNA · Video: ${sc.name}. This conversation is for everything about this video. Read the brief and the brand if there is one, and answer in one short line that you are ready.`
      : "Motion DNA · General. Answer in one short line that you are ready.";
    AG.afterRun = () => { const n = sessionNow(); if (n) openInClaudeApp(n); };
    toast("Starting the conversation, then it opens in the Claude app…");
    return runAgent(intro);
  }
  const cp = nodeReq()("child_process");
  cp.execFile(AG.exe, ["--desktop", "--resume", id], { cwd: cwdNow(), windowsHide: true, timeout: 30000 }, (err, out, er) => {
    if (err) toast("Could not open the Claude app (" + (String(er || err.message).trim().split("\n").pop() || "update Claude Code") + "). Use the terminal command instead.", true);
    else toast("Opened in the Claude app: it stays in its sidebar.");
  });
}
// the files Claude reads when it works in a brand's folder or a project's folder (written once, never overwritten)
async function ensureClaudeFolder(dir, kind, name, slug) {
  const has = async (f) => !String(await call("mdna_read_file", dir + "/" + f)).startsWith("ERR");
  const mcp = JSON.stringify({ mcpServers: { "motion-dna": { command: "python", args: [S.root + "/tools/mcp/ss_motion_mcp.py"] } } }, null, 1) + "\n";
  const md = kind === "brand"
    ? `# ${name} · a Motion DNA brand\n\nEverything about this brand happens in this folder and its conversation.\n\n` +
      `- **brand.json** (here): the brand's rules, curves and timing. Read it with \`get_brand\` (slug \`${slug}\`) before animating; ` +
      `save every review note with \`add_brand_note\`.\n- **projects/**: one folder per video for this brand, each with its own conversation.\n` +
      `- Motion DNA (library, tools, rules) lives in \`${S.root}\`: read its CLAUDE.md. The \`motion-dna\` MCP server is in .mcp.json.\n\n` +
      `To share this brand, the panel's Brands › ${name} › Download to share writes one file (\`${slug}.motiondna-brand.json\`); ` +
      `the other person imports it. Never put this brand in the Motion DNA repo.\n`
    : "";
  if (md && !(await has("CLAUDE.md"))) await call("mdna_write_file", { path: dir + "/CLAUDE.md", text: md });
  if (!(await has(".mcp.json"))) await call("mdna_write_file", { path: dir + "/.mcp.json", text: mcp });
}
function resumeCommand(id) {
  return process.platform === "win32" ? `cd "${cwdNow()}"; & "${AG.exe}" --resume ${id}` : `cd "${cwdNow()}" && "${AG.exe}" --resume ${id}`;
}

// ---------- run ----------
function busyElsewhere(id) {   // the conversation file changed in the last 20 s and not by us: it is open somewhere else
  if (!id) return false;
  try { return Date.now() - nodeReq()("fs").statSync(sessionFile(id)).mtimeMs < 20000; } catch (e) { return false; }
}
function logUsage(row) {
  try {
    const fs = nodeReq()("fs"), path = nodeReq()("path");
    const file = PJ ? path.join(PJ.dir, "claude", "usage.csv") : path.join(S.root, "bridge", "usage.local.csv");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, "date,session,seconds,turns,cost_usd_estimate,tokens,mode,order\n");
    fs.appendFileSync(file, row.map((v) => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v).join(",") + "\n");
  } catch (e) {}
}
function splitRules(text) {   // RULE: category | rule | why  lines become proposals; the rest is the answer
  const rules = [], keep = [];
  for (const line of text.split("\n")) {
    // "RULE: motion | rule | why", and the looser "RULE (motion): rule" some answers use
    const m = line.match(/^\s*[*_]*RULE[*_]*\s*(?:\(([a-z]+)\))?\s*:?[*_]*\s*(?:([a-z]+)\s*\|)?\s*(.+?)\s*(?:\|\s*(.*?))?\s*$/i);
    if (m && m[3]) {
      const cat = (m[2] || m[1] || "").toLowerCase();
      rules.push({ category: RULE_CATS.includes(cat) ? cat : "process", rule: m[3].replace(/\s*[*_(]*saved as .*$/i, "").trim(), why: (m[4] || "").trim() });
    } else keep.push(line);
  }
  return { text: keep.join("\n").trim(), rules };
}
async function runAgent(prompt) {
  if (AG.proc) return;
  const cp = nodeReq()("child_process");
  let sid = sessionNow();
  if (busyElsewhere(sid) && !confirm("This conversation was used in the last seconds somewhere else (the Claude app or a terminal).\nMessages from both would mix. Send anyway?")) return;
  push("you", prompt);
  const full = prompt + "\n\n---\n" + (await contextBlock());
  const mcp = JSON.stringify({ mcpServers: { "motion-dna": { command: "python", args: [S.root + "/tools/mcp/ss_motion_mcp.py"] } } });
  const args = ["-p", full, "--output-format", "stream-json", "--verbose", "--mcp-config", mcp,
    "--allowedTools", ...(AG.mode === "full" ? FULL_TOOLS : SAFE_TOOLS), "--disallowedTools", ...NEVER];
  if (AG.mode !== "full") args.push("--strict-mcp-config");   // Safe: only Motion DNA, not every server of the account
  if (scope().kind !== "repo") args.push("--add-dir", S.root);
  if (sid) args.push("--resume", sid);
  const env = Object.assign({}, process.env, { CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: "1" });
  delete env.ANTHROPIC_API_KEY;   // headless runs would bill the API key instead of the signed-in subscription
  const t0 = Date.now();
  let buf = "", gotResult = false;
  AG.proc = cp.spawn(AG.exe, args, { cwd: cwdNow(), windowsHide: true, env });
  agent.draw();
  AG.proc.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      let m; try { m = JSON.parse(line); } catch (e) { continue; }
      if (m.session_id && m.session_id !== sid) { sid = m.session_id; setSession(sid, prompt); }
      if (m.type === "assistant" && m.message && m.message.content) {
        for (const c of m.message.content) {
          if (c.type === "text" && /Failed to authenticate|OAuth session expired|Please run \/login|Invalid API key|not logged in/i.test(c.text)) {
            AG.logged = false; setDot("st-claude", false, "Claude Code: the sign-in expired. Click to sign in again.");
            push("error", "Claude Code's sign-in expired. Agent › Setup › Sign in to Claude, then send the order again.");
            if (agent.showSetup) agent.showSetup();
            continue;
          }
          if (c.type === "text" && c.text.trim()) {
            const sp = splitRules(c.text.trim());
            if (sp.text) push("agent", sp.text);
            for (const r of sp.rules) push("rule", r.rule, { rule: r, state: null });
          }
          if (c.type === "tool_use") push("step", stepText(c));
        }
      } else if (m.type === "result") {
        gotResult = true;
        const secs = Math.round((m.duration_ms || Date.now() - t0) / 1000);
        const total = +m.total_cost_usd || 0, cost = Math.max(0, total - (AG.costSeen[sid] || 0)); AG.costSeen[sid] = total; store.set("agentCost", AG.costSeen);
        const u = m.usage || {}, tokens = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        logUsage([new Date().toISOString(), sid || "", secs, m.num_turns || "", cost.toFixed(4), tokens, AG.mode, prompt.slice(0, 120)]);
        const costTxt = total ? ` · ≈ $${cost.toFixed(2)} (conversation $${total.toFixed(2)}, estimate)` : "";
        if (m.is_error) push("error", (m.result || m.subtype || "The agent stopped with an error.") + ` · ${secs}s`);
        else push("done", `Done in ${secs}s` + (m.num_turns ? ` · ${m.num_turns} turns` : "") + (tokens ? ` · ${Math.round(tokens / 1000)}k tokens` : "") + costTxt);
      }
    }
  });
  let err = "";
  AG.proc.stderr.on("data", (d) => { err += d.toString(); });
  AG.proc.on("close", (code) => {
    AG.proc = null;
    if (AG.afterRun) { const f = AG.afterRun; AG.afterRun = null; if (gotResult) setTimeout(f, 300); }
    if (!gotResult) push("error", code === null ? "Stopped." : (err.trim().split("\n").slice(-3).join(" ") || `Claude Code exited (${code}).`));
    agent.draw();
  });
  AG.proc.on("error", (e) => { AG.proc = null; push("error", "Could not start Claude Code: " + e.message); });
}
function stepText(c) {
  const n = c.name.replace(/^mcp__motion-dna__/, "").replace(/^mcp__(claude_ai_)?[Ff]igma__/, "Figma · ").replace(/^mcp__/, "");
  const i = c.input || {};
  const hint = i.preset || i.name || i.file_path || i.path || i.url || i.command || i.pattern || "";
  return n + (hint ? " · " + String(hint).slice(0, 80) : "");
}
function stopAgent() { if (AG.proc) { try { AG.proc.kill(); } catch (e) {} } }

// a review note the agent turned into a rule: the user picks where it lives
async function keepRule(m, where) {
  const r = Object.assign({ uid: newUid() }, m.rule, { updated: today(), source: { project: PJ ? PJ.p.name : "", date: today(), by: whoAmI() || "agent" } });
  if (where === "brand") {
    const x = brandOf(activeSlug()); if (!x) return toast("Activate a brand first (Brands › open one › Activate).", true);
    x.b.rules.push(Object.assign({ id: x.b.rules.reduce((a, q) => Math.max(a, q.id || 0), 0) + 1 }, r)); await saveBrand(x); toast(`Saved to ${x.b.name}'s rules.`);
  } else if (where === "project") {
    if (!PJ) return toast("Open or create a project first (Agent › Project).", true);
    PJ.p.rules.push(Object.assign({ id: PJ.p.rules.reduce((a, q) => Math.max(a, q.id || 0), 0) + 1 }, r)); await saveProjectQuiet(); toast(`Saved to ${PJ.p.name}'s rules.`);
  } else if (where === "general") {
    const order = `Add this as a general rule for every brand to CONTRIBUTING.md §9 (and to tools/check_layout.jsx if it can be checked automatically): "${r.rule}" (${r.category}; why: ${r.why || "review note"}).`;
    if (AG.mode !== "full") { navigator.clipboard && navigator.clipboard.writeText(order); toast("General rules change the repo: switch to Full mode and send it, or paste it into Claude Code (copied).", true); return; }
    m.state = where; saveLog(); runAgent(order); return;
  }
  m.state = where; saveLog(); agent.draw();
}

// ---------- the section ----------
function agent() {
  const sec = $("#sec-agent");
  const render = () => {
    sec.replaceChildren();
    if ((!IN_AE || !nodeReq()) && !window.__previewAgent) {   // __previewAgent: the GIF recorder, with Node stand-ins
      sec.append(h("div", { class: "card-box" }, h("b", {}, "Agent"), h("span", { class: "dim" },
        IN_AE ? "Node.js is not enabled in this panel yet: close and reopen the panel (Window > Extensions > Motion DNA)." : "The Agent runs inside After Effects (it starts Claude Code on this computer). The Library below works everywhere.")));
      sec.append(libraryView());
      return;
    }
    AG.node = true; AG.exe = AG.exe || findClaude();
    const modeSeg = h("div", { class: "seg small" }, ...[["safe", "Safe"], ["full", "Full"]].map(([k, l]) => h("button", {
      class: AG.mode === k ? "on" : "", title: k === "safe" ? "Only the Motion DNA tools (apply, layers, frames)" : "Also Figma, files and scripts (never commits or pushes)",
      onclick: () => { AG.mode = k; store.set("agentMode", k); render(); } }, l)));
    const setup = h("div", { class: "card-box setup", hidden: true });
    const tabsEl = h("div", { class: "seg agent-tabs" }, ...[["chat", "Chat"], ["library", "Library"], ["project", "Project"]].map(([k, l]) =>
      h("button", { class: AG.tab === k ? "on" : "", onclick: () => { AG.tab = k; store.set("agentTab", k); render(); } }, l)));
    const where = h("button", { class: "projchip btn ghost", style: "text-align:left;padding:0", title: "Agent › Project", onclick: () => { AG.tab = "project"; store.set("agentTab", "project"); render(); } },
      scopeText());
    sec.append(h("div", { class: "kit-top" }, h("span", { class: "kit-title" }, "Agent"), modeSeg,
      h("button", { class: "btn" + (AG.logged === false ? " on" : ""), title: "Connect Claude (and Figma)", onclick: () => agent.showSetup() }, AG.logged === false ? "Connect" : "Setup")), setup, tabsEl, where);
    agent.setupEl = setup;
    if (AG.tab === "library") sec.append(libraryView());
    else if (AG.tab === "project") sec.append(projectView());
    else sec.append(chatView());
    agent.showSetup = () => showSetup(setup);
    if (AG.logged === false) showSetup(setup);
  };
  agent.render = render;
  render();
  authStatus().then((ok) => { const was = AG.logged; AG.logged = ok; if (was !== ok) render(); });
  loadProject(); setInterval(loadProject, 15000);
}

function chatView() {
  const wrap = h("div", { class: "stack" });
  const logEl = h("div", { class: "agent-log" });
  const input = h("textarea", { class: "field agent-input", rows: 6, placeholder: "Tell the agent what to do, e.g. \"Animate the selected layers in the brand's style\".\nCtrl+Enter sends." });
  if (AG.pending) { input.value = AG.pending; AG.pending = null; setTimeout(() => input.focus()); }
  const send = h("button", { class: "solid apply", onclick: () => go() }, "Send");
  const stop = h("button", { class: "solid remove", onclick: stopAgent }, "Stop");
  const go = () => { const v = input.value.trim(); if (!v || AG.proc) return; input.value = ""; runAgent(v); };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(); } });
  const chip = (key, label) => h("button", { class: "chip" + (AG.ctx[key] ? " on" : ""), title: `Send the ${label.toLowerCase()} with the order`,
    onclick: (e) => { AG.ctx[key] = !AG.ctx[key]; store.set("agentCtx", AG.ctx); e.currentTarget.classList.toggle("on", AG.ctx[key]); } }, label);
  const templates = h("div", { class: "chips" }, h("span", { class: "dim" }, "Try:"), ...TEMPLATES.map(([label, text]) => h("button", { class: "chip ghost", title: text, onclick: () => { input.value = text; input.focus(); } }, label)));
  const newBtn = h("button", { class: "btn ghost", title: "Start a new conversation (this one stays in the project's list)", onclick: () => {
    if (AG.proc) return; setSession(null); AG.log = []; saveLog(); agent.draw(); } }, "+ New conversation");
  const ruleCard = (m) => {
    const b = activeBrand();
    const btn = (where, label, tip, off) => h("button", { class: "chip" + (m.state === where ? " on" : ""), title: tip, disabled: !!off, onclick: () => keepRule(m, where) }, label);
    return h("div", { class: "msg rule" + (m.state ? " saved" : "") },
      h("div", {}, h("span", { class: "tag", style: "color:var(--pine);background:var(--spark);border-radius:3px;padding:0 5px;font-size:10px;font-weight:700;text-transform:uppercase" }, m.rule.category), " ", m.rule.rule),
      m.rule.why ? h("div", { class: "why" }, m.rule.why) : null,
      m.state ? h("div", { class: "dim" }, m.state === "dismissed" ? "Not kept." : `Kept in the ${m.state} rules.`) :
        h("div", { class: "chips" }, h("span", { class: "dim" }, "Keep as a rule:"),
          btn("brand", b ? b.name : "Brand", b ? `Add to ${b.name}'s rules` : "Activate a brand first", !b),
          btn("project", "Project", PJ ? `Add to ${PJ.p.name}'s rules` : "Open a project first", !PJ),
          btn("general", "General", "A rule for every brand: CONTRIBUTING §9 (Full mode)"),
          h("button", { class: "chip ghost", onclick: () => { m.state = "dismissed"; saveLog(); agent.draw(); } }, "Dismiss")));
  };
  agent.draw = () => {
    logEl.hidden = !AG.log.length && !AG.proc;   // no empty box: the conversation appears with the first order
    templates.hidden = AG.log.length > 0;
    wrap.classList.toggle("talking", AG.log.length > 0);   // during a conversation the log gets the room, the field shrinks
    logEl.replaceChildren(...AG.log.map((m) =>
      m.role === "rule" ? ruleCard(m) : h("div", { class: "msg " + m.role }, m.role === "step" ? "▸ " + m.text : m.text)));
    if (AG.proc) logEl.append(h("div", { class: "msg working" }, h("i", { class: "spin" }), "Working…"));
    logEl.scrollTop = logEl.scrollHeight;
    send.hidden = !!AG.proc; stop.hidden = !AG.proc; input.disabled = !!AG.proc || AG.logged === false;
  };
  const sid = sessionNow();
  if (AG.logged === false) wrap.append(h("div", { class: "conn" }, h("b", {}, "Connect Claude to start"),
    h("span", { class: "dim" }, "One sign-in with your Claude account, once per computer."),
    h("button", { class: "solid apply big", onclick: () => agent.showSetup() }, "Connect Claude")));
  wrap.classList.add("chat");
  wrap.append(logEl, input,
    h("div", { class: "send-row" }, h("div", { class: "chips", title: "What the agent gets with your order (the repo's rules and the library always go)" },
      h("span", { class: "dim" }, "With:"), chip("brand", "Brand"), chip("comp", "Comp"), chip("selection", "Selection")), send, stop),
    templates,
    h("div", { class: "crow foot" }, newBtn,
      h("button", { class: "btn ghost", title: "Continue this conversation in the Claude app (Code tab)", disabled: scope().kind === "repo" && !sid, onclick: () => openInClaudeApp(sessionNow()) }, sid ? "Open in Claude app" : "Start in Claude app"),
      h("button", { class: "btn ghost icon", title: "Copy the command that continues this same conversation in a terminal (claude --resume …)", disabled: !sid, onclick: () => { navigator.clipboard.writeText(resumeCommand(sessionNow())); toast("Command copied: paste it in a terminal to continue this conversation there."); } }, ">_")));
  agent.draw();
  return wrap;
}

// ---------- Library: Styles and Techniques, as guides the agent applies ----------
function libItems() {
  const q = AG.libQ;
  if (AG.libKind === "styles") return S.packs.filter((pk) => !q || (pk.name + " " + pk.desc + " " + (pk.tones || []).join(" ")).toLowerCase().includes(q)).map((pk) => ({
    key: "style/" + pk.name, name: pk.name, sub: `${pk.energy}${pk.energy_range ? " " + pk.energy_range.join("–") : ""}`, desc: pk.desc,
    thumb: asset(`library/packs/${pk.slug}_md.png`), img: asset(`library/packs/${pk.slug}.gif`),
    order: `Animate the selected layers (every layer of the open comp if none are selected) in the ${pk.name} style (${pk.desc.replace(/\.$/, "")}). Layers that already move keep their animation and get the style's curve and timing; the others get the move of their role. Then render a frame and tell me what you did.` }));
  return S.techniques.filter((t) => !q || (t.name + " " + t.what).toLowerCase().includes(q)).map((t) => {
    const s = slug(t.name);
    return { key: "technique/" + t.name, name: t.name, sub: "technique", desc: t.what, how: t.how,
      thumb: asset(`library/techniques/${s}_card.png`), fallback: asset(`library/techniques/${s}_md.png`), img: asset(`library/techniques/${s}_md.png`),
      order: `${t.ask} Use the Motion DNA technique "${t.name}". If the layers already have animation, build on it instead of replacing it.` };
  });
}
function libraryView() {
  const wrap = h("div", { class: "stack" });
  const detail = h("div", { class: "lib-detail", hidden: true }), grid = h("div", { class: "lib-grid" });
  const show = (it) => {
    AG.libSel = it.key;
    detail.hidden = false;
    detail.replaceChildren(...kids(safeImg([it.img, it.thumb, it.fallback], it.name),
      h("b", {}, it.name), h("p", {}, it.desc), it.how ? h("p", { class: "dim" }, "Under the hood: " + it.how) : null,
      h("div", { class: "order" }, it.order),
      h("div", { class: "crow" },
        h("button", { class: "solid apply", title: "Put this order in the chat (edit it, then send)", onclick: () => { AG.pending = it.order; AG.tab = "chat"; store.set("agentTab", "chat"); agent.render(); } }, "Use in chat"),
        h("button", { class: "btn", title: "Copy the order (for Claude Code or the Claude app)", onclick: () => { navigator.clipboard.writeText(it.order); toast("Order copied."); } }, "Copy order"))));
    for (const c of grid.children) c.classList.toggle("sel", c.dataset.key === it.key);
  };
  const draw = () => {
    const items = libItems();
    grid.replaceChildren(...items.map((it) => {
      const img = safeImg([it.thumb, it.fallback], it.name, { loading: "lazy" });
      const c = h("button", { class: "card" + (AG.libSel === it.key ? " sel" : ""), title: it.desc }, h("span", { class: "thumb" }, img), AG.libKind === "styles" ? h("span", { class: "label" }, it.name) : null, h("span", { class: "label dim" }, it.sub));
      c.dataset.key = it.key;
      if (AG.libKind === "styles") hoverPlay(c, img, it.img);
      c.onclick = () => show(it);
      return c;
    }));
    const sel = items.find((x) => x.key === AG.libSel); if (sel) show(sel); else detail.hidden = true;
  };
  const kind = h("div", { class: "seg" }, ...[["styles", "Styles"], ["techniques", "Techniques"]].map(([k, l]) => h("button", { class: AG.libKind === k ? "on" : "",
    onclick: (e) => { AG.libKind = k; store.set("agentLib", k); for (const b of kind.children) b.classList.toggle("on", b === e.currentTarget); draw(); } }, l)));
  const search = h("input", { class: "field", type: "search", placeholder: "Search styles and techniques", value: AG.libQ, oninput: (e) => { AG.libQ = e.target.value.toLowerCase(); draw(); } });
  wrap.append(kind, h("div", { class: "note", style: "padding:0" }, "A guide to what the agent can do for you: pick one, read what it does, then send its order to the agent (or copy it into Claude Code). The agent applies it to your comps."),
    search, detail, grid);
  draw();
  return wrap;
}

// ---------- Project: a folder per piece, with its brand and its conversation ----------
function projectView() {
  const wrap = h("div", { class: "stack" });
  if (!PJ) {
    const name = h("input", { class: "field", placeholder: "Project name (e.g. Acme launch film)" });
    const bx = brandOf(activeSlug());   // a video of the active brand goes inside the brand's folder by default
    let parent = bx && bx.dir && bx.where !== "template" ? bx.dir + "/projects" : store.get("projectParent", ""); const parentTxt = h("span", { class: "dim" }, parent || "Pick where to create it…");
    const pick = h("button", { class: "btn", onclick: async () => { const f = await call("mdna_pick_folder", "Where should the project folder go?"); if (f) { parent = f; store.set("projectParent", f); parentTxt.textContent = f; } } }, "Choose folder…");
    const brandSel = h("select", { class: "field" }, [h("option", { value: "" }, "Brand (optional)"), ...BRANDS.map((x) => h("option", { value: x.b.slug, selected: x.b.slug === activeSlug() }, x.b.name))]);
    const checks = PROJECT_FOLDERS.map((f) => h("input", { type: "checkbox", checked: true, value: f }));
    const saveAep = h("input", { type: "checkbox", checked: true });
    const create = async () => {
      const nm = name.value.trim(); if (!nm) return name.focus();
      if (!parent) return toast("Choose where to create the project first.", true);
      if (/\/projects$/.test(parent)) await call("mdna_write_file", { path: parent + "/.keep", text: "" });   // makes the folder
      const sl = slugify(nm), folders = checks.filter((c) => c.checked).map((c) => c.value);
      const p = { name: nm, slug: sl, created: today(), by: whoAmI(), brand: brandSel.value || null, folders, sessions: [], session: null, rules: [], removed: [], motion_dna: S.root };
      const claude = `# ${nm} · a Motion DNA project\n\nMotion DNA (the motion library for After Effects, its tools and rules) lives in \`${S.root}\`: read its CLAUDE.md first.\n` +
        `The \`motion-dna\` MCP server is registered in this folder's .mcp.json (approve it once).\n\n` +
        (p.brand ? `Brand: **${brandSel.selectedOptions[0].textContent}** (slug \`${p.brand}\`). Read it with \`get_brand\` before animating, and save every review note with \`add_brand_note\`.\n\n` : "") +
        `Project rules and the conversation history are in \`motion-dna.project.json\`. Folders: ${folders.map((f) => "`" + f + "`").join(", ")}.\n` +
        `Put everything you make in these folders, never in the Motion DNA repo. Ask before any paid generation.\n`;
      const mcp = JSON.stringify({ mcpServers: { "motion-dna": { command: "python", args: [S.root + "/tools/mcp/ss_motion_mcp.py"] } } }, null, 1) + "\n";
      const r = await call("mdna_project_new", { parent, name: nm, slug: sl, folders, saveAep: saveAep.checked, text: JSON.stringify(p, null, 1) + "\n", claude, mcp });
      if (String(r).startsWith("ERR")) return report(r);
      const res = parse(r); PJ = { dir: res.dir, p };
      if (p.brand) {
        setActive(p.brand);
        const bx2 = brandOf(p.brand);   // the brand lists its videos
        if (bx2) { bx2.b.projects = bx2.b.projects || []; bx2.b.projects.push({ name: nm, path: res.dir, date: today() }); await saveBrand(bx2); }
      }
      toast(`Project created in ${res.dir}` + (res.aep ? " and the After Effects project saved there." : "."));
      agent.render();
    };
    const openExisting = async () => {
      const f = await call("mdna_pick_folder", "Open a Motion DNA project folder"); if (!f) return;
      const r = await call("mdna_project_find", f);
      if (!r || r === "null") return toast("No motion-dna.project.json in that folder.", true);
      PJ = parse(r); PJ.p.sessions = PJ.p.sessions || []; PJ.p.rules = PJ.p.rules || [];
      if (PJ.p.brand && brandOf(PJ.p.brand)) setActive(PJ.p.brand);
      toast(`${PJ.p.name} is the current project` + (PJ.p.aep ? "" : ". Save your After Effects project inside its folder so it opens with it next time."));
      agent.render();
    };
    wrap.append(h("div", { class: "note", style: "padding:0" }, "One folder per piece: footage, AE file, renders and its own Claude conversation."),
      h("div", { class: "saveform" }, h("b", {}, "New project"), name, h("div", { class: "crow" }, pick, parentTxt), brandSel,
        h("div", { class: "subhead", style: "margin:0" }, "Folders"), h("div", { class: "folders" }, ...checks.map((c) => h("label", {}, c, c.value))),
        h("label", {}, saveAep, " Save the open AE project in it"),
        h("div", { class: "row" }, h("button", { class: "solid apply", onclick: create }, "Create project"))),
      h("button", { class: "btn", onclick: openExisting }, "Open an existing project folder…"));
    return wrap;
  }
  const p = PJ.p;
  const brandSel = h("select", { class: "field", onchange: (e) => { p.brand = e.target.value || null; if (p.brand) setActive(p.brand); saveProjectQuiet(); } },
    [h("option", { value: "" }, "No brand"), ...BRANDS.map((x) => h("option", { value: x.b.slug, selected: x.b.slug === p.brand }, x.b.name))]);
  wrap.append(
    h("div", { class: "card-box" }, h("div", { class: "kit-top" }, h("b", { class: "kit-title" }, p.name),
        h("button", { class: "btn", title: "Open the folder", onclick: () => call("mdna_open", PJ.dir) }, "Folder"),
        h("button", { class: "btn ghost", title: "Stop using this project here (nothing is deleted)", onclick: () => { PJ = null; agent.render(); } }, "Close")),
      h("span", { class: "dim" }, PJ.dir), h("div", { class: "ctl wide" }, h("label", {}, "Brand"), brandSel)),
    h("div", { class: "subhead" }, "Conversation ", h("span", { class: "dim" }, "· everything about this video")),
    conversationCard(),
    h("div", { class: "subhead" }, "Project rules ", h("span", { class: "dim" }, "· only for this piece")),
    rulesEditor(p, saveProjectQuiet, { project: () => p.name, empty: "Notes that only apply to this piece. The agent proposes them from your review notes." }));
  return wrap;
}

// The conversation of the current scope (a video or a brand): one per folder, controllable from the Claude app
function conversationCard() {
  const sc = scope(), sid = sessionNow();
  if (sc.kind === "repo") return h("div", { class: "card-box conv" }, h("span", { class: "dim" }, "Activate a brand or open a project: each one gets its own conversation."));
  const known = new Map(((sc.owner && sc.owner.sessions) || []).map((s) => [s.id, s]));
  const rows = recentSessions(sc.dir).map((s) => h("div", { class: "session-row" + (s.id === sid ? " on" : ""), title: s.id, onclick: () => {
      setSession(s.id, s.title); AG.log = [{ role: "hint", text: `Continuing “${(known.get(s.id) || s).title}”. Earlier messages are in the Claude app.` }]; saveLog();
      toast(`This is now the ${sc.kind === "brand" ? "brand's" : "video's"} conversation.`); agent.render(); if (typeof brands === "function" && brands.render) brands.render(); } },
    h("span", {}, (known.get(s.id) || s).title), h("em", { class: "dim" }, new Date(s.mtime).toLocaleDateString())));
  return h("div", { class: "card-box conv" },
    h("span", {}, sid ? "One conversation for this " + (sc.kind === "brand" ? "brand" : "video") + ". Continue it here or in the Claude app (it is in its sidebar after you open it once)." :
      "No conversation yet. Start it here with a first order, or open it straight in the Claude app."),
    h("div", { class: "crow" },
      h("button", { class: "solid apply", title: "Open this conversation in the Claude app (Code tab)", onclick: () => openInClaudeApp(sid) }, sid ? "Open in Claude app" : "Start in Claude app"),
      h("button", { class: "btn", disabled: !sid, title: "Continue it in a terminal", onclick: () => { navigator.clipboard.writeText(resumeCommand(sid)); toast("Command copied: paste it in a terminal."); } }, "Copy terminal command")),
    sid ? h("span", { class: "dim" }, "Conversation ", h("code", {}, sid.slice(0, 8)), ` · folder ${sc.dir}`) : h("span", { class: "dim" }, `Folder: ${sc.dir}`),
    rows.length > 1 || (rows.length && rows[0].id !== sid) ? h("details", {}, h("summary", { class: "dim" }, "Other conversations in this folder"), ...rows) : null);
}

// Setup: one clear step to connect Claude (a sign-in window, then it turns green by itself); Figma is optional;
// the manual commands only show under "Having trouble?".
function openTerminal(args) {   // a visible terminal window running Claude Code with these arguments
  const cp = nodeReq()("child_process"), exe = AG.exe;
  if (process.platform === "win32") cp.exec(`start "Claude" cmd /k ""${exe}" ${args}"`, { windowsHide: false });
  else cp.execFile("osascript", ["-e", `tell application "Terminal" to do script "\\"${exe}\\" ${args}"`, "-e", 'tell application "Terminal" to activate']);
}
function runInWindow(args) {   // Figma's sign-in needs a real terminal: a small window that closes when it is done
  const cp = nodeReq()("child_process"), exe = AG.exe;
  if (process.platform === "win32") cp.exec(`start "Connecting Figma" /min cmd /c ""${exe}" ${args}"`, { windowsHide: false });
  else cp.execFile("osascript", ["-e", `tell application "Terminal" to do script "\"${exe}\" ${args}; exit"`]);
}
function waitForFigma(onDone) {   // checks every 6 s for 4 minutes after the permission page opens
  clearInterval(AG.figmaWait); let n = 0;
  AG.figmaWait = setInterval(async () => {
    if (++n > 40) return clearInterval(AG.figmaWait);
    const f = await figmaStatus();
    if (f === "connected") { clearInterval(AG.figmaWait); AG.figma = f; setDot("st-figma", true, "Figma: connected"); toast("Figma is connected."); onDone(); }
  }, 6000);
}
// One click: the browser opens Figma's own permission page (no Claude settings, nothing to type); the panel turns
// green by itself. With no Figma server at all, it adds Figma's official one first.
function connectFigma(redraw) {
  const go = (name) => { runInWindow(`mcp login "${name}"`); toast("Your browser opens Figma: press Allow. This turns green by itself."); waitForFigma(redraw); };
  if (AG.figmaServer) return go(AG.figmaServer);
  nodeReq()("child_process").execFile(AG.exe, ["mcp", "add", "--scope", "user", "--transport", "http", "figma", "https://mcp.figma.com/mcp"],
    { windowsHide: true, timeout: 30000 }, () => { AG.figmaServer = "figma"; go("figma"); });
}
function openUrl(url) {   // the default browser
  const cp = nodeReq()("child_process");
  if (process.platform === "win32") cp.exec(`start "" "${url}"`); else cp.execFile("open", [url]);
}
function waitForSignIn(onDone) {   // checks every 4 s for 5 minutes after the sign-in window opens
  clearInterval(AG.signWait); let n = 0;
  AG.signWait = setInterval(async () => {
    if (++n > 75) return clearInterval(AG.signWait);
    if (await authStatus()) { clearInterval(AG.signWait); AG.logged = true; setDot("st-claude", true, "Claude: connected"); toast("Claude is connected."); onDone(); }
  }, 4000);
}
function showSetup(setup) {
  setup.hidden = false;
  const runCmd = () => process.platform === "win32" ? `& "${AG.exe}"` : `"${AG.exe}"`;   // PowerShell needs & before a quoted path
  const cmdRow = (cmd) => h("div", { class: "cmdrow" }, h("code", { class: "cmd" }, cmd),
    h("button", { class: "btn", onclick: () => { navigator.clipboard && navigator.clipboard.writeText(cmd); toast("Copied: paste it in PowerShell."); } }, "Copy"));
  const close = h("button", { class: "btn ghost", title: "Close", onclick: () => (setup.hidden = true) }, "✕");
  const redraw = () => showSetup(setup);
  const step = (ok, title, body) => h("div", { class: "conn" + (ok ? " ok" : "") }, h("div", { class: "conn-head" }, h("i", { class: "sdot " + (ok ? "ok" : "") }), h("b", {}, title)), ...kids(body));

  // 1. Claude
  const claude = AG.logged
    ? step(true, "Claude is connected", h("span", { class: "dim" }, "The Agent is ready." + (AG.method === "api_key" ? " (Signed in with an API key: orders bill that key.)" : "")))
    : step(false, "Connect Claude", [
        h("ol", { class: "steps" }, h("li", {}, "Press Connect Claude: a window and your browser open."), h("li", {}, "Sign in with your Claude account."),
          h("li", {}, "If it shows a code, paste it in the window. Done: this turns green by itself.")),
        h("button", { class: "solid apply big", onclick: () => { openTerminal("auth login"); toast("Sign in in your browser…"); waitForSignIn(() => { if (agent.render) agent.render(); if (agent.showSetup) agent.showSetup(); }); } }, "Connect Claude")]);   // stays open: green, and Figma next

  // 2. Figma (optional)
  const fig = AG.figma;
  const figma = fig === "connected"
    ? step(true, "Figma is connected", h("span", { class: "dim" }, "Orders can read your Figma files (Full mode)."))
    : step(false, "Figma (optional)", [
        h("span", {}, fig === "auth" ? "Figma needs your permission again (it asks from time to time)." : "Only if you want the agent to animate your Figma frames."),
        h("span", { class: "dim" }, "Press the button and choose Allow in the Figma page that opens. That's it: this turns green by itself."),
        h("button", { class: "solid apply big", disabled: !AG.logged, title: AG.logged ? "" : "Connect Claude first", onclick: () => connectFigma(redraw) }, "Connect Figma")]);

  const trouble = h("details", { class: "trouble" }, h("summary", {}, "Having trouble?"),
    h("span", { class: "dim" }, "Do it yourself in PowerShell: sign in to Claude"), cmdRow(`${runCmd()} auth login`),
    h("span", { class: "dim" }, "Figma, yourself:"), cmdRow(`${runCmd()} mcp login "${AG.figmaServer || "figma"}"`),
    h("span", { class: "dim" }, "or claude.ai › Settings › Connectors › Figma › Connect."));

  setup.replaceChildren(h("div", { class: "kit-top" }, h("b", { class: "kit-title" }, "Connect"), close), claude, figma,
    h("div", { class: "crow" }, h("button", { class: "btn", onclick: async () => { AG.logged = await authStatus(); AG.figma = await figmaStatus(); redraw(); if (agent.draw) agent.draw(); } }, "Check again")), trouble);
  if (fig === undefined) figmaStatus().then((f) => { AG.figma = f; setDot("st-figma", f === "connected", f === "connected" ? "Figma: connected" : "Figma: not connected (optional). Click to connect."); redraw(); });
}
