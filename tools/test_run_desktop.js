// Tests for runDesktop in the panel's Agent (panel/js/agent.js): "Open in Claude app" runs `claude --desktop --resume <id>`, which
// refuses to run with redirected output, so it needs a terminal. Windows: a minimized console runs it and the panel reads its exit
// code and stderr from temp files. macOS: a Terminal window runs it (the helper that login and update use).
// What it checks: the id is validated before anything runs, each Windows outcome (success, error text, exit code, empty file first,
// no answer, console that cannot start) with the temp folder always removed and `done` called once, and the exact macOS command
// (quoting of paths with spaces or quotes).
// Usage (no After Effects, no Claude app, nothing is launched): node tools/test_run_desktop.js
const fs = require("fs"), vm = require("vm"), os = require("os"), path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "panel", "js", "agent.js"), "utf8").replace(/\r\n/g, "\n");   // CRLF on Windows checkouts, LF on Mac
const m = /function runDesktop\(id, done\) \{[\s\S]*?\n\}\n/.exec(src);
if (!m) { console.error("FAIL: runDesktop is missing in panel/js/agent.js"); process.exit(1); }
const ID = "7f68e3b4-f6c8-485c-92c5-83b93769e32b";
const mdna = () => fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith("mdna-desktop-")).length;
process.on("unhandledRejection", (e) => { console.log("FAIL unhandled rejection: " + String((e && e.stack) || e).split("\n").slice(0, 2).join(" | ")); process.exit(1); });
setTimeout(() => { console.log("FAIL the tests did not finish within 60 s: some path never calls done"); process.exit(1); }, 60000).unref();   // a hang is a failure, not a wait
let bad = 0;
const check = (n, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log((ok ? "PASS " : "FAIL ") + n + (ok ? "" : ` -> got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`)); };

// platform: "win32" | "darwin". behaviour(h) plays the console: h.errF / h.codeF are the files the .cmd would write; h.cb the exec callback.
function run(behaviour, { platform = "win32", clock = false, id = ID, cwd = "/work/project", exe = "/usr/bin/claude" } = {}) {
  return new Promise((resolve) => {
    let now = 1e6; const calls = [], terminal = [], doneCalls = [];
    const fakeCp = { exec(cmd, opt, cb) {
      calls.push(cmd);
      const bat = /cmd \/c "(.+)"$/.exec(cmd)[1], body = fs.readFileSync(bat, "utf8");
      behaviour({ cb, errF: /2>"([^"]+)"/.exec(body)[1], codeF: />"([^"]+)" echo/.exec(body)[1], advance: (ms) => { now += ms; } });
    }, execFile(exeFile, args) { calls.push("execFile " + exeFile); } };
    const ctx = { nodeReq: () => (n) => (n === "child_process" ? fakeCp : require(n)), process: { platform }, setInterval, clearInterval,
      cwdNow: () => cwd, AG: { exe }, macTerminal: (c) => terminal.push(c), Date: { now: () => (clock ? now : Date.now()) } };
    vm.createContext(ctx);
    vm.runInContext(m[0] + "\nthis.runDesktop = runDesktop;", ctx);
    const before = mdna();
    ctx.runDesktop(id, (err, how) => { doneCalls.push([err, how]); setTimeout(() => resolve({ err, how, doneCalls, calls, terminal, left: mdna() - before }), 700); });
  });
}
const writes = (err, code, ms = 50) => ({ errF, codeF }) => setTimeout(() => { fs.writeFileSync(errF, err); fs.writeFileSync(codeF, code); }, ms);

(async () => {
  for (const bogus of ["not an id; calc", "abc", "../../x", ID + "; del *", ""]) {
    for (const platform of ["win32", "darwin"]) {
      const r = await run(() => {}, { platform, id: bogus });
      check(`[${platform}] invalid id ${JSON.stringify(bogus)}: rejected, nothing launched`, [/^not a conversation id/.test(r.err), r.calls.length, r.terminal.length, r.left], [true, 0, 0, 0]);
    }
  }
  let r = await run(writes("", "0\r\n"));
  check("[win] exit code 0: success, folder removed, done once", [r.err, r.doneCalls.length, r.left], [null, 1, 0]);
  r = await run(writes("Error: app not installed\r\nsecond line\r\n", "1\r\n"));
  check("[win] exit code 1 with stderr: the last stderr line is the message", [r.err, r.doneCalls.length, r.left], ["second line", 1, 0]);
  r = await run(writes("", "9\r\n"));
  check("[win] exit code 9 and empty stderr: says the exit code", [r.err, r.left], ["exit code 9", 0]);
  r = await run(writes("\x1b[31mNo session found\x1b[0m\r\n", "1\r\n"));
  check("[win] colour codes are stripped from the message", r.err, "No session found");
  r = await run(({ codeF }) => { fs.writeFileSync(codeF, ""); setTimeout(() => fs.writeFileSync(codeF, "0\r\n"), 1200); });
  check("[win] code file created empty first, 0 a moment later: no premature result", [r.err, r.doneCalls.length], [null, 1]);
  r = await run(({ advance }) => { setTimeout(() => advance(31000), 50); }, { clock: true });
  check("[win] no answer after 30 s: a clear message and the folder removed", [r.err, r.left], ["no answer after 30 s", 0]);
  r = await run(({ cb }) => { setTimeout(() => cb(new Error("spawn failed")), 50); });
  check("[win] the console cannot start: reported once, folder removed", [r.err, r.doneCalls.length, r.left], ["spawn failed", 1, 0]);
  r = await run(writes("", "0\r\n"));
  check("[win] it starts a minimized console that runs the .cmd, and never the macOS helper", [/^start "Claude" \/min cmd \/c ".+open\.cmd"$/.test(r.calls[0]), r.terminal.length], [true, 0]);

  r = await run(() => {}, { platform: "darwin", cwd: "/Users/ana/My Projects/motion dna", exe: "/Users/ana/Library/Application Support/Claude/claude-code/2.1.304/x/claude" });
  check("[mac] opens Terminal with the exact command (paths with spaces quoted), done once with 'terminal'",
    [r.terminal, r.doneCalls.length, r.how, r.err], [["cd '/Users/ana/My Projects/motion dna' && '/Users/ana/Library/Application Support/Claude/claude-code/2.1.304/x/claude' --desktop --resume " + ID + "; exit"], 1, "terminal", null]);
  r = await run(() => {}, { platform: "darwin", cwd: "/Users/o'brien/proj" });
  check("[mac] a quote in the folder name cannot break out of the command", r.terminal[0].startsWith("cd '/Users/o'\\''brien/proj' && "), true);
  r = await run(() => {}, { platform: "darwin", cwd: "/tmp/$(whoami)`id`" });
  check("[mac] $ and backticks stay inside single quotes", r.terminal[0].startsWith("cd '/tmp/$(whoami)`id`' && "), true);
  check("[mac] no execFile / exec is used (the `script` wrapper is gone)", r.calls.length, 0);

  console.log(bad ? `\n${bad} FAILED` : "\nall passed");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log("FAIL a scenario crashed: " + String((e && e.stack) || e).split("\n").slice(0, 2).join(" | ")); process.exit(1); });
