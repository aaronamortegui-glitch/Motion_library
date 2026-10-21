// Tests for the connector logic of the panel's Agent (panel/js/agent.js: the block between "// <pure>" and "// </pure>", plus
// mcpList, svcStatus, confirmStatus, removeStray and connectService run against a scripted `claude`).
// What it checks: which `claude mcp list` line is a duplicate server (a connected one never is), CRLF / colour codes on the real
// parsing, never adding a server on a bad read or a failed add, Remove duplicate (scopes, stale flag), that every generator name that
// is allowed also gets its deny rules in the real allow/deny lists, and that "Copy diagnostics" hides secrets.
// Usage (no After Effects, no CLI, no config touched): node tools/test_mcp_status.js
const fs = require("fs"), path = require("path"), vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "panel", "js", "agent.js"), "utf8").replace(/\r\n/g, "\n");   // CRLF on Windows checkouts, LF on Mac
const m = /\/\/ <pure>[^\n]*\n([\s\S]*?)\n\/\/ <\/pure>/.exec(src);
if (!m) { console.error("FAIL: the <pure> block is missing in panel/js/agent.js"); process.exit(1); }
const ctx = {}; vm.createContext(ctx);
vm.runInContext(m[1] + "\nthis.api = { lineOk, clean, strayLine, toolServer, GEN_DENY, allowGen, denyGen, genNamesFrom, fullToolsFor, neverToolsFor, listForDiagnostics, redactSecrets, foldStatus };", ctx);
const { lineOk, strayLine, toolServer, GEN_DENY, allowGen, denyGen, genNamesFrom, fullToolsFor, neverToolsFor, listForDiagnostics, redactSecrets, foldStatus } = ctx.api;

process.on("unhandledRejection", (e) => { console.log("FAIL unhandled rejection: " + String((e && e.stack) || e).split("\n").slice(0, 2).join(" | ")); process.exit(1); });
let bad = 0;
const check = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log((ok ? "PASS " : "FAIL ") + name + (ok ? "" : ` -> got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`)); };

// the same read the panel does: one line per server of the service
const linesOf = (txt, name) => { const re = new RegExp("^(claude\\.ai |plugin:[\\w-]+:)?" + name + ":", "i"); return txt.split(/\r?\n/).map((l) => l.trim()).filter((l) => re.test(l)); };
const K = "https://api.krea.ai/mcp", F = "https://mcp.figma.com/mcp";

for (const eol of ["\n", "\r\n"]) {   // Mac / Windows
  const t = (s) => s.split("\n").join(eol);
  const tag = eol === "\n" ? "[mac]" : "[win]";
  check(tag + " duplicate krea needing sign-in next to the account connector", strayLine(linesOf(t(`claude.ai Krea: ${K} - ✔ Connected\nkrea: ${K} (HTTP) - ! Needs authentication\n`), "krea"), "krea", K), true);
  check(tag + " duplicate that failed to connect", strayLine(linesOf(t(`claude.ai Krea: ${K} - ✔ Connected\nkrea: ${K} (HTTP) - ✗ Failed to connect\n`), "krea"), "krea", K), true);
  check(tag + " figma connected twice is NOT a duplicate", strayLine(linesOf(t(`plugin:figma:figma: ${F} (HTTP) - ✔ Connected\nfigma: ${F} (HTTP) - ✔ Connected\n`), "figma"), "figma", F), false);
  check(tag + " only the account connector", strayLine(linesOf(t(`claude.ai Krea: ${K} - ✔ Connected\n`), "krea"), "krea", K), false);
  check(tag + " only a bare krea, nothing connected (it is the one to log in)", strayLine(linesOf(t(`krea: ${K} (HTTP) - ! Needs authentication\n`), "krea"), "krea", K), false);
  check(tag + " bare krea pointing to another URL is the user's own", strayLine(linesOf(t(`claude.ai Krea: ${K} - ✔ Connected\nkrea: https://example.com/mcp (HTTP) - ! Needs authentication\n`), "krea"), "krea", K), false);
  check(tag + " no krea at all", strayLine(linesOf(t("claude.ai Flora: x - ✔ Connected\n"), "krea"), "krea", K), false);
}
check("lineOk: Connected", lineOk("krea: u - ✔ Connected"), true);
check("lineOk: Needs authentication", lineOk("krea: u - ! Needs authentication"), false);
check("lineOk: Failed to connect", lineOk("krea: u - ✗ Failed to connect"), false);
check("lineOk: Disconnected is not connected", lineOk("krea: u - ✗ Disconnected"), false);
check("lineOk: a URL with 'fail' in it does not hide a Connected status", lineOk("krea: https://h/failover/mcp (HTTP) - ✔ Connected"), true);
check("lineOk: a mangled check mark (Windows console) still reads Connected", lineOk("krea: u - âœ” Connected"), true);

check("toolServer: claude.ai Krea", toolServer("claude.ai Krea"), "claude_ai_Krea");
check("toolServer: plugin:figma:figma", toolServer("plugin:figma:figma"), "plugin_figma_figma");
check("toolServer: plain name", toolServer("krea"), "krea");

// the real lists the Agent runs with, for several ways the servers can be named: every allowed generator server has every deny rule
const KREA_WRITE_FAMILY = ["write_files", "write_files_inline", "write_files_upload", "overwrite_files", "create_folders", "create_style", "update_style",
  "delete_style", "create_moodboard", "update_moodboard", "delete_moodboard", "call_desktop_tool", "create_api_token", "revoke_api_token", "list_api_tokens", "start_free_trial", "show_plans"];
for (const servers of [undefined, {}, { krea: "krea" }, { krea: "claude.ai Krea", flora: "claude.ai Flora" }, { krea: "plugin:krea:krea" }, { krea: "My Krea (team)" }]) {
  const names = genNamesFrom(servers), allow = fullToolsFor(names), never = neverToolsFor(names);
  const gens = allow.filter((a) => /^mcp__(claude_ai_)?(krea|flora)/i.test(a) || names.map((n) => "mcp__" + n).includes(a));
  check("real lists for " + JSON.stringify(servers) + ": every allowed generator server is fully denied",
    gens.length > 0 && gens.every((g) => KREA_WRITE_FAMILY.concat(GEN_DENY).every((t) => never.includes(g + "__" + t))), true);
}
check("git commit / push stay denied", ["Bash(git commit:*)", "Bash(git push:*)"].every((r) => neverToolsFor(genNamesFrom({})).includes(r)), true);
check("the denied tools are never in the allow list", fullToolsFor(genNamesFrom({ krea: "krea" })).every((a) => !a.includes("__create_api_token")), true);

// a bad read must not undo a connected service: two in a row do
check("foldStatus: one bad read keeps 'connected'", foldStatus("connected", 0, "missing"), { svc: "connected", miss: 1, hold: true });
check("foldStatus: the second bad read in a row is believed", foldStatus("connected", 1, "missing"), { svc: "missing", miss: 2, hold: false });
check("foldStatus: a good read resets the count", foldStatus("connected", 1, "connected"), { svc: "connected", miss: 0, hold: false });
check("foldStatus: not connected before, so nothing to hold", foldStatus("missing", 0, "auth"), { svc: "auth", miss: 1, hold: false });
check("foldStatus: 'unknown' never counts as a bad read", foldStatus("connected", 0, "unknown"), { svc: "unknown", miss: 0, hold: false });

// Copy diagnostics: only the Figma / Krea / Flora lines in full, no secrets anywhere
const DIAG = ["claude.ai Krea: " + K + " - ✔ Connected", "figma: " + F + "?token=abc123 (HTTP) - ✔ Connected",
  "secretsrv: npx some-server --api-key sk-live-1234567890abcdefghij1234 - ✔ Connected", "corp: https://private.example.com/mcp?token=zzz (HTTP) - ! Needs authentication", "weird line without separators"].join("\r\n");
const diag = listForDiagnostics(DIAG);
check("diagnostics keep the Krea line as it is", diag.includes("claude.ai Krea: " + K + " - ✔ Connected"), true);
check("diagnostics mask a query string in a kept line", diag.includes("figma: " + F + "?*** (HTTP)") && !diag.includes("abc123"), true);
check("diagnostics hide the command line and key of other servers", !diag.includes("sk-live") && !diag.includes("api-key") && diag.includes("secretsrv: (hidden) - ✔ Connected"), true);
check("diagnostics hide the private host", !diag.includes("private.example.com") && !diag.includes("zzz"), true);
check("diagnostics hide a line they cannot read", diag.includes("(line hidden)") && !diag.includes("without separators"), true);
check("home folder on Windows, any slash and case", redactSecrets("a C:\\Users\\aaron\\x and c:/users/aaron/y", "C:\\Users\\aaron"), "a ~\\x and ~/y");
check("home folder on Mac keeps no stray slash", redactSecrets("/Users/aaron/Library and /users/aaron/x", "/Users/aaron"), "~/Library and ~/x");
check("bearer tokens and key-like pairs are masked", redactSecrets("Authorization: Bearer abc.def and 11111111-2222-4333-8444-555555555555:FAKEsecretFAKEsecretFAKE12", ""), "Authorization: Bearer *** and ***");

// ---- the real functions against a scripted `claude` ----
// mcpList, svcStatus, confirmStatus, removeStray and connectService are cut out of panel/js/agent.js and run with a fake child_process.
const cut = (re, what) => { const x = re.exec(src); if (!x) { console.error("FAIL: cannot find " + what + " in panel/js/agent.js"); process.exit(1); } return x[0]; };
const code = [cut(/const SVC = \{[^\n]*\};/, "SVC"), cut(/let MCPLIST = null;[\s\S]*?(?=\/\/ <pure>)/, "mcpList"), m[1],
  cut(/async function svcStatus[\s\S]*?(?=\/\/ Everything a person needs)/, "svcStatus + removeStray + confirmStatus"),
  cut(/async function connectService[\s\S]*?\n\}\n/, "connectService")].join("\n");

function scenario(listOuts, { getOut = "", listErr = false, addErr = false, noExe = false } = {}) {   // listOuts: what each `mcp list` prints, in order (the last one repeats)
  const calls = [], toasts = [], logins = [], dots = [];
  let n = 0;
  const fakeCp = { execFile(exe, args, opt, cb) {
    calls.push(args.join(" "));
    if (args[0] === "mcp" && args[1] === "list") { const out = listOuts[Math.min(n++, listOuts.length - 1)]; return setImmediate(() => cb(listErr ? new Error("spawn failed") : null, out, "")); }
    if (args[0] === "mcp" && args[1] === "get") return setImmediate(() => cb(getOut ? null : new Error("not found"), getOut, ""));
    if (args[0] === "mcp" && args[1] === "add" && addErr) return setImmediate(() => cb(new Error("exit 1"), "", "\x1b[31mError: could not add the server\x1b[0m\n"));
    setImmediate(() => cb(null, "", ""));   // add / remove
  } };
  const c = { nodeReq: () => () => fakeCp, AG: { exe: noExe ? null : "claude" }, S: { root: "x" }, toast: (t) => toasts.push(t), runInWindow: (a) => logins.push(a), waitForService: () => {}, setDot: (...a) => dots.push(a), setTimeout: (f) => setImmediate(f) };
  vm.createContext(c);
  vm.runInContext(code + "\nthis.api = { connectService, svcStatus, confirmStatus, removeStray, AG };", c);
  return { c, calls, toasts, logins, dots };
}
const list = (...ls) => ls.join("\n") + "\n";
const ACC = `claude.ai Krea: ${K} - ✔ Connected`, DUP = `krea: ${K} (HTTP) - ! Needs authentication`, OTHER = "claude.ai Flora: x - ✔ Connected";
const added = (calls) => calls.some((a) => a.startsWith("mcp add"));
const until = async (cond) => { for (let i = 0; i < 100 && !cond(); i++) await new Promise((r) => setImmediate(r)); };   // waits for an async callback, no fixed number of ticks
const reads = (s) => s.calls.filter((a) => a === "mcp list").length;
const removed = (s) => s.calls.some((a) => a.startsWith("mcp remove"));

async function main() {
  // the real parsing with the output of each platform
  for (const [tag, eol, wrap] of [["[mac]", "\n", (l) => l], ["[win]", "\r\n", (l) => l], ["[colour codes]", "\n", (l) => "\x1b[1m" + l.replace(": ", ":\x1b[0m ")]]) {
    const s = scenario([[ACC, DUP, OTHER].map(wrap).join(eol) + eol]);
    const st = await s.c.api.svcStatus("krea", true);
    check(tag + " svcStatus reads the account connector and flags the duplicate", [st, (s.c.api.AG.stray || {}).krea, (s.c.api.AG.server || {}).krea], ["connected", true, "claude.ai Krea"]);
  }

  let s = scenario([list(OTHER), list(ACC, OTHER)]);   // the first read lacks the account's connector (seen in the real CLI: 74 lines, then 75)
  await s.c.api.connectService("krea", () => {});
  check("first read without the connector: no second server added", added(s.calls), false);
  check("  ...and it is reported as connected, with no login window", [s.toasts.some((t) => /connected/i.test(t)), s.logins.length], [true, 0]);

  s = scenario([list(OTHER)]);   // really not there: it stays missing on every read
  await s.c.api.connectService("krea", () => {});
  await until(() => s.logins.length);   // the login opens when `mcp add` finishes
  check("really missing: the server is added once and the login opens", [s.calls.filter((a) => a.startsWith("mcp add")).length, s.logins.length], [1, 1]);

  s = scenario([list(OTHER)], { addErr: true });   // `mcp add` itself fails (colour codes in its message)
  await s.c.api.connectService("krea", () => {});
  await until(() => s.toasts.some((t) => /Could not add/.test(t)));
  check("mcp add fails: it says so, with no login window", [s.toasts.some((t) => /Could not add Krea: Error: could not add the server$/.test(t)), s.logins.length], [true, 0]);

  s = scenario([list(OTHER)]);   // a name remembered from an earlier read, but the server is gone now
  s.c.api.AG.server = { krea: "claude.ai Krea" };
  await s.c.api.connectService("krea", () => {});
  await until(() => s.logins.length);
  check("a remembered server that is gone is added again, not logged in to", [added(s.calls), s.logins], [true, ['mcp login "krea"']]);

  s = scenario([list(`figma: ${F} (HTTP) - ✔ Connected`)]);   // Figma already connected: header dot turns green, nothing added
  await s.c.api.connectService("figma", () => {});
  check("figma already connected: green dot, nothing added", [added(s.calls), s.dots.some((d) => d[0] === "st-figma" && d[1] === true)], [false, true]);

  s = scenario([list(OTHER)], { listErr: true });   // claude could not be run (PATH, permissions)
  await s.c.api.connectService("krea", () => {});
  check("mcp list fails: nothing is added blind", [added(s.calls), s.logins.length], [false, 0]);

  s = scenario([list(DUP)]);   // only the hand-added one, needing sign-in: log in to it, do not add another
  await s.c.api.connectService("krea", () => {});
  check("only the bare server needing sign-in: it logs in to it, no add", [added(s.calls), s.logins], [false, ['mcp login "krea"']]);

  s = scenario([list(DUP), list(ACC, DUP)]);   // Setup opens right after the duplicate appeared: the first read lacks the account's connector
  let cs = await s.c.api.confirmStatus("krea", await s.c.api.svcStatus("krea", true));
  check("Setup: 'needs sign-in' from a bad first read is corrected by the second read (and the duplicate is flagged)", [cs, reads(s), s.c.api.AG.stray.krea], ["connected", 2, true]);
  s = scenario([list(DUP)]);   // it really needs its sign-in: asked once more, then believed
  cs = await s.c.api.confirmStatus("krea", await s.c.api.svcStatus("krea", true));
  check("a service that really needs sign-in stays 'auth' after one more read", [cs, reads(s)], ["auth", 2]);
  s = scenario([list(OTHER)]);   // really absent: two more reads, then believed
  cs = await s.c.api.confirmStatus("krea", await s.c.api.svcStatus("krea", true));
  check("a service that is really absent stays 'missing' after two more reads", [cs, reads(s)], ["missing", 3]);
  s = scenario([list(ACC)]);   // connected: no extra reads
  cs = await s.c.api.confirmStatus("krea", await s.c.api.svcStatus("krea", true));
  check("a connected service is not read twice", [cs, reads(s)], ["connected", 1]);

  s = scenario([list(ACC, DUP)]);
  const st = await s.c.api.svcStatus("krea", true);
  check("duplicate next to the connector: connected, flagged, nothing removed behind the user's back", [st, s.c.api.AG.stray.krea, removed(s)], ["connected", true, false]);

  for (const [scope, out, want] of [["Local", "krea:\n  Scope: Local config (private to you in this project)\n", "mcp remove krea -s local"], ["User", "krea:\n  Scope: User config (available in all your projects)\n", "mcp remove krea -s user"]]) {
    s = scenario([list(ACC, DUP)], { getOut: out });
    const msg = await new Promise((r) => s.c.api.removeStray("krea", r));
    check(`Remove duplicate in ${scope} scope`, [msg, s.calls.includes(want)], [null, true]);
  }
  s = scenario([list(ACC, DUP)], { getOut: "krea:\n  Scope: Project config (shared via .mcp.json)\n" });
  const pm = await new Promise((r) => s.c.api.removeStray("krea", r));
  check("project scope (.mcp.json) is never edited", [/\.mcp\.json/.test(pm), removed(s)], [true, false]);

  s = scenario([list(ACC, DUP), list(ACC)], { getOut: "krea:\n  Scope: Local config (private to you in this project)\n" });   // the button was drawn from an old read; the duplicate is gone now
  await s.c.api.svcStatus("krea", true);
  const stale = await new Promise((r) => s.c.api.removeStray("krea", r));
  check("Remove duplicate on a stale flag: re-reads and removes nothing", [/no longer a duplicate/.test(stale), removed(s)], [true, false]);

  s = scenario([list(ACC, DUP), list(DUP)], { getOut: "krea:\n  Scope: Local config (private to you in this project)\n" });   // the account connector went away meanwhile: the bare one is now the only one
  await s.c.api.svcStatus("krea", true);
  const lone = await new Promise((r) => s.c.api.removeStray("krea", r));
  check("Remove duplicate when the connector is gone: the bare server is kept", [/no longer a duplicate/.test(lone), removed(s)], [true, false]);

  s = scenario([list(ACC, DUP)], { noExe: true });
  const nx = await new Promise((r) => s.c.api.removeStray("krea", r));
  check("Remove duplicate without Claude Code: a message, not a silent click", [/not found/.test(nx), removed(s)], [true, false]);

  console.log(bad ? `\n${bad} FAILED` : "\nall passed");
  process.exit(bad ? 1 : 0);
}
main().catch((e) => { console.log("FAIL a scenario crashed: " + String((e && e.stack) || e).split("\n").slice(0, 2).join(" | ")); console.log("\ncrashed"); process.exit(1); });
