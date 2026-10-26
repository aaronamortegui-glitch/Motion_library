# Learnings

Everything we learned building Motion DNA and *The 1974 Boardroom* test, written so the next person (or LLM) doesn't have to rediscover it. Keep this file up to date when something new bites you.

## 1. Driving After Effects from an LLM

| Topic | What works | Why |
|---|---|---|
| Control channel | `tools/ss_bridge.jsx` runs inside AE and polls `bridge/inbox/*.jsx` every second; `bash tools/bridge.sh tools/<job>.jsx` writes the job, waits and prints `OK`/`ERROR line N`. | `AfterFX.exe -s/-r` gives no feedback and modal alerts block AE. A file bridge returns results and error lines. |
| Start the bridge | `AfterFX.exe -s "$.evalFile(new File('<repo>/tools/ss_bridge.jsx'))"` (bridge.sh does it if `bridge/outbox/_bridge_started.txt` is missing). | Running it twice toggles it off — only start once per AE session. |
| Return values | Wrap jobs in an IIFE that `return`s a string. | `$.evalFile` returns the last expression; that string lands in the outbox. |
| Never `app.newProject()` in jobs | Rebuild only your own comps: find them by name, `remove()`, recreate. | A new project + save wipes everything else (calibration comps, sections, other scenes). |
| Relative paths | Every script computes `SS_ROOT = File($.fileName).parent.parent`; `#include "ss_presets.jsx"` resolves relative to `tools/`. | The repo works when cloned anywhere. Keep jobs inside `tools/`. |
| Syntax check | Strip `#include` lines, `node --check` a `.js` copy. | Catches typos before AE does (AE errors are slower to read). |

### ExtendScript pitfalls we hit
- Regex `/\\/g` breaks the parser → use `.split("\\").join("/")`.
- `new File()` with `#` in the name (Animation Composer asset packs) fails → `Folder.getFiles("Name*")`.
- Setting `layer.parent` by script keeps the world position → parent first, then set the position.
- Shape layers drawing comp-space paths from expressions need layer position `[0, 0]`.
- Range-limited properties (text selector Start/Offset ±100) reject overshoot values → `SSM` clamps automatically.
- Text reveal: with *Ramp Up* the first characters are never hidden; animate the selector **Offset** from `-W` to `100` (End = W) instead of Start.
- Track mattes by script: `layer.setTrackMatte(matteLayer, TrackMatteType.ALPHA)` (AE 2023+); hide the matte with `enabled = false`.
- Shape modifier match names are not what the UI says: *Wiggle Paths* = `ADBE Vector Filter - Roughen`; `ADBE Vector Filter - Wiggler` is *Wiggle Transform*. Probe unknown match names with a throwaway comp (see `harvest_lib.jsx` style loops).
- `rq.render()` does nothing inside a scheduled task (the bridge) → schedule it with `app.scheduleTask("app.project.renderQueue.render()", 200, false)` and wait for the files (`tools/wait_files.sh`).
- A locked layer can't be reordered (`moveToEnd`) → lock at the very end.
- `Property.setValueAtTime(t, v)` takes **composition time**, not layer time. Offset keys by `layer.startTime` (this broke freeze frames on every shot except the first).
- Time remap: enabling it resets the layer out point, and removing *all* its keys hides the property ("parent property is hidden"). Set your keys first, then delete AE's default keys that aren't yours.
- Font names must be PostScript names; AE only sees newly installed fonts after a restart. Use `SSM.font(role)`.
- **AE ignores per-user fonts**: fonts installed only for the current user (`%LOCALAPPDATA%\Microsoft\Windows\Fonts`) are missing from AE's font cache and render as Times (`app.fonts.missingOrSubstitutedFonts` lists them) → install them *for all users* (right-click › Install for all users) and restart AE. Builders pick the first font of a list that is not substituted, so they fall back to Arial instead of Times.
- **Inter Tight never matched `InterTight-Bold` etc. in AE** (`app.fonts.allFonts` listed no Inter Tight at all, even after restarts) → the repo ships it as one variable file (`InterTight[wght].ttf`) and it was registered per user only → instance static weights with fontTools (`varLib.instancer`, wght 400/500/600/700/800, name IDs 1/2/4/6/16/17 set to `Inter Tight` + style and PostScript `InterTight-<Style>`) into `assets/fonts/static/`, install those and Instrument Serif for all users (elevated copy to `C:\Windows\Fonts` + HKLM registry values) and restart AE; it then lists all seven with the exact PostScript names the builders use.
- **Expressions (JavaScript engine):** arrays have no `+`/`-` (`[1,2] + [3,4]` is a string) → `add()`/`sub()`; `value.points` is undefined on a Mask Path → `thisProperty.points()/inTangents()/outTangents()`.
- **`random()` is seeded per layer and property**, so two properties never draw the same numbers (plexus lines did not meet their dots) → shared positions use a hash, `frac(sin(n * 12.9898 + 78.233) * 43758.5453)`, plus `noise([seed, time])` for drift.
- **A one-point mask path renders black in the render queue**: an expression that returns `createPath([[x, y]])` (an empty fan slice) previews fine and `saveFrameToPng` is fine, but the render queue (multi-frame rendering) outputs black from that frame to the end of the comp. Always return at least a tiny triangle.
- **A hold must never be static (in · hold · out)**: next to plain LLM animation (linear keys, everything at once, a still hold, a hard cut) Motion DNA only reads clearly better when every scene has an entrance on token curves, a living hold (a slow camera push of ~3.5 %, a floating hero, a breathing accent) and a staggered exit on Launch before the cut. Entrances alone still felt static in review (`docs/case-studies/claude-vs-motion-dna.md`).
- **Building a filled logo stroke by stroke**: a traced logo is one compound outline, so Trim Paths has nothing to draw. Split it into pieces with a morphological opening (`tools/logo_parts.py`: what survives an opening of ~14 px at 1024 is the thick strands, the rest are the thin lines), take each piece's skeleton longest path as its centre stroke (wide enough to cover it, round caps, ends extended) and draw it under an alpha matte of that piece's own outline. A skeleton of the whole logo splits at every junction and chaining the branches never reads clean; per-piece skeletons are single lines. `cv2.ximgproc.thinning` is missing from the standard OpenCV wheel: a vectorised Zhang-Suen in NumPy is enough.
- **Granular build edges**: Roughen Edges on the built mark, Border animated from ~9% of the mark height to 0 as the last piece lands. Edge Type 1 (Cut) only erodes alpha; 2 adds an orange edge colour. Scale can't go below 10. A traced logo (integer polyline) also needs its outline smoothed along the contour with corners pinned (`tools/logo_to_shape.py`) before it looks clean at size.
- **Turbulent Displace Amount is a strength, not pixels**: ~55 gives a liquid gradient; 200+ tears holes in the layer.

- **Reframing a comp without touching its keys** (`resize_comp`): parent the layers to a null whose transform is identity first (anchor and position `[0, 0]`), so AE compensates nothing, and only then give the null its anchor/position/scale. Parenting under a non-identity parent rewrites the child's values. Measure where layers *rest* (after their last entrance key, boxes clipped to the frame) or entrances from off-screen inflate the content box. One uniform scale makes 16:9 text unreadable in 9:16 (120 px → 29 px): group layers that rest together and let each group keep its size. Layout checks must walk the whole parent chain: a chip's text under its chip under a rig was misplaced by a one-level calculation.
- **Helper names in `ss_presets.jsx` share one scope**: a new `function wipe(L, name, angle)` silently replaced the existing `wipe(L)` and broke *Wipe Reveal* ("Unable to call property… undefined"). Grep `function <name>(` before adding a helper; the Style Map set uses `linearWipe`.
- Multi-key curves (Pop, Recoil, Nudge, Wind-up, Snap) have no 2-key `ae.out/in`: `SSM.animate` dispatches them by their token fields (`overshoot`, `anticipation`, `jump`), and `easeSegment` (the panel's Easing control) re-eases them with their closest 2-key token.
- **Scheduled tasks from a `#targetengine` job did not reach the panel** on the second recording (the `SS_PANEL` calls were no-ops), while the same call sent as a normal bridge job worked. `tools/record_panel.py` drops one bridge job per step into `bridge/inbox` instead.
- **A layer reference dies after `addProperty`** ("null is not an object" on the next line): adding a shape group or effect
  invalidates the JS objects you held for that layer → keep `layer.index` and re-fetch `comp.layer(index)` after every
  `addProperty`, then read the new property by index (`property(numProperties)`).
- **Matchnames that are not what the UI says:** a 2D layer's rotation is `ADBE Rotate Z` (not `ADBE Rotation`);
  `textDocument.tracking` must be an **integer** (240.000001 throws "is not an integer": `Math.round`); a spatial
  property (Position) takes **one** `KeyframeEase` per key, a 3D Scale takes three; ExtendScript has no `forEach`.
- **Shape layers drawn with absolute vertices sit in the wrong place**: `addShape()` puts the layer at the comp centre, so
  a path built from comp coordinates is shifted by (w/2, h/2) → set Position and Anchor Point to `[0, 0]` on any layer
  whose path you build in comp space (callout lines, live curves, leader lines).
- **Extending nested precomps: extend the source first.** Setting `layer.outPoint = 25` while its source comp is still
  20 s long clamps the layer at 20 s even after the source grows (the panels vanished after second 20, the outPoint
  read 25) → recurse into the source comp, then set the layer's outPoint. Screen comps that must outlive their length:
  time remap with `Math.min(time, source.duration - 0.05)`.
- **Time remap can refuse to key** ("can not set value at time… property is hidden") on some footage layers → use
  `layer.stretch` and `startTime` for slow motion instead.
- **`copyToComp` does not keep the stacking you expect**: copied layers landed under the full-frame shot they belong
  on (the box hero lost its whole type column) → after copying, `moveBefore` the overlay layers above their plate.
- **A literal newline in a generated JSX string** ("Unterminated string constant"): a Python patch that writes `\r`
  or `\n` must emit the two characters backslash + letter (`chr(92) + "n"`), not the control character.
- **Text preset names are exact**: `SSP.applyText` takes the text list (`Words Fade Up`, `Chars Rise`, …); motion names
  like `Fade Up` throw "Text preset not found". `Tracking Settle` starts very wide and slow: on a 1 s label it never
  reads (and widens the box past the safe area) → use `Words Fade Up` for short labels and counters.
- **Easing a playhead that drives footage:** a time-remap expression that follows an eased key makes the footage crawl
  at the start of the shot (the callouts arrived before the content) → keep the keys linear wherever the playhead plays
  footage at a known rate.

### Rendering
- `aerender` **hangs** when the project contains layers with Animation Composer presets (the plugin waits for UI). Use the open AE's render queue: `tools/render_comps.jsx` / `tools/render_queue.jsx`.
- **Prefer `aerender` now that the project has no AC layers**, one process per comp in parallel: `aerender -project <abs .aep> -comp CYPHER_EDIT -OMtemplate "H.264 - Match Render Settings - 15 Mbps" -output <abs .mp4> -mfr ON 100`. The 32 s Cypher edit took **50 s** this way, while the in-app queue sat 40 min at half the file. Paths must be absolute (`cygpath -aw`). It renders the *saved* project, so save after a build.
- **Test File objects against null, never with `!`.** In a bridge job `!app.project.file` was true and `"x" + app.project.file` threw ("Object of type File found where a Number... is needed") although the project was saved. Use `=== null` and `.fsName`. Collect Files has no scripting API: `tools/collect_files.jsx` saves a copy, reduces it, copies and relinks the footage, then reopens the original.
- **A job's variables can break the bridge.** `$.evalFile` runs a file in the caller's scope: a job that declared `var out` overwrote the poll's own `out`, the poll failed ("Function out.open is undefined") and AE showed a modal dialog that froze every script until someone clicked OK. Fixed in `ss_bridge.jsx`: jobs run inside their own function (`SS_BRIDGE_RUN`), the poll runs under `app.beginSuppressDialogs()` with every step in try/catch, and the scheduled string is guarded. `bridge.sh` also forces a poll through `AfterFX -s` when a job sits untouched for 15 s (AE sometimes stops firing scheduled tasks while `-s` still works).
- **Fonts can silently fall back to Times after an AE restart.** The fonts were installed and registered, but the new AE session resolved InterTight-* and InstrumentSerif-* to `times.ttf` (`app.fonts.missingOrSubstitutedFonts`), so the whole render came out in a serif. `ae_status` (MCP) and `tools/check_layout.jsx` now report substituted fonts and stop; fix by restarting After Effects, then rebuild.
- **The bridge stops when another scheduled task throws.** A ScriptUI palette opened from a job with `#targetengine` scheduled `"SS_PANEL_TICK()"`; that string runs in the main engine, where the function does not exist, and the error stopped the bridge's polling task too (jobs piled up in `bridge/inbox`, AE idle). Guard scheduled strings (`if (typeof F === "function") F();`), close test palettes, and restart the bridge (`app.cancelTask` + `ss_bridge.jsx`). If AE does not even run `AfterFX.exe -s`, a modal error dialog is open: ask the user to dismiss it.
- **Re-rendering a file AE has imported can leave the footage item broken** (`elegant.mp4` came back with `hasVideo false`, and the builder failed with "property is hidden"). Run `tools/reload_footage.jsx` (it calls `mainSource.reload()`) before rebuilding comps that use it.
- Headless Edge screenshots catch animated GIFs on their first frame (empty for entrances): `tools/make_visualizer_screens.py` shoots a copy of the page that shows the posters, and builds the README GIF by overlaying the preset MP4s on the cards. `PrintWindow` cannot capture Edge (GPU content comes back grey).
- **A stalled in-app render looks like a slow one.** Measure: if the `*.m4v` temp file grows only a few hundred KB in two minutes, it is stuck. Stop it and switch to `aerender`; do not wait.
- Force-closing AE shows a "Crash Repair Options" dialog on the next launch; click **Continue** (Safe Mode disables scripts, so the bridge and the panel would not load). `bridge.sh` can launch two instances if it runs while the dialog is up: close both and start one.
- Output template `H.264 - Match Render Settings - 15 Mbps` includes audio when the comp has it.
- Contact sheets are the fastest QA: `ffmpeg -i out.mp4 -vf "select='eq(n\,30)+eq(n\,90)',scale=800:-1,tile=2x2" -frames:v 1 sheet.png`. Check several frames, not one — push-ins move things into labels.

- Rebuilding a comp (remove + recreate) silently deletes its layers from every comp that nested it (e.g. the breakdown grid lost its composite cell). Rebuild dependents in the same run: `build_scene.jsx` now rebuilds the breakdown.
- Quick QA without a full render: `comp.saveFrameToPng(time, file)` from a bridge job writes stills in seconds (asynchronously: wait for the files).
- Screenshots of ScriptUI windows: open the palette from a job with `#targetengine` (otherwise it closes when the job ends), then `PrintWindow` from a **DPI-aware** process (`SetProcessDPIAware`), or the capture is cropped on scaled displays.
- If AE closes or crashes, the bridge marker (`bridge/outbox/_bridge_started.txt`) goes stale and jobs wait forever. Launching a closed AE with `AfterFX.exe -s "..."` runs the script and then quits; open AE normally with the project first, then attach the bridge. `tools/bridge.sh` now does this on its own (`SS_AE_PROJECT` overrides the project).
- AE shows "Not Responding" during a scripted render queue run; check that the output file keeps growing before assuming a hang.

- **Figma text with "Auto" line height sat too high in AE** (Instrument Serif 0.05 em, 13 px on a 260 px title) → `build_figma_slides.jsx` assumed 1.2 em when Figma gave no line height, but Figma's Auto is the font's own (hhea ascent + descent: 1.3 em for Instrument Serif) → it uses `METRICS` for the font; checked against a Figma screenshot to the pixel.
- **Figma storyboard → AE:** keep Figma frames at 1920×1080 and copy element coordinates into a JSON spec; anchor AE text at its `sourceRectAtTime` top-left so `at` means the same as Figma's x/y. Build every composite element (pill, card, rounded media) as its own precomp: opacity and scale presets on a parent layer do not reach parented children, a precomp moves as one piece.
- Figma screenshots do not render animated GIF fills; use a still in the storyboard. Upload images into existing placeholders with `upload_assets(nodeIds=…)` (multipart POST, one URL per image).
- SVG logos for AE: rasterize with headless Edge (`--default-background-color=00000000`); Edge writes the screenshot a few seconds after the command returns, and a reused `--user-data-dir` makes later calls fail silently (use a fresh one per call).
- **macOS:** run scripts in a running AE with AppleScript (`osascript -e 'tell application "Adobe After Effects 2026" to DoScriptFile "/path/job.jsx"'`; the first call asks for Automation permission), detect AE with `pgrep`, avoid `date +%N` (BSD date) and Windows-only paths: the asset-pack folder comes from `SSM.assetPacks()` / `SS_ASSET_PACKS`. Per-user ScriptUI panels live in `~/Library/Preferences/Adobe/After Effects/<version>/Scripts/ScriptUI Panels`.
- The chained-ternary bug keeps coming back: it broke the panel's "last N min" status, the stagger of styles saved from Mix, and the in/out/loop classification in the harvest tools. Before committing JSX, grep for it: `grep -nE "\? [^:;]+ : [^;]*\? " tools/*.jsx`.
- ScriptUI can show stills in a custom `onDraw` with `graphics.drawImage(ScriptUI.newImage(file), x, y, w, h)`: the panel uses it for style grids, technique frames and asset thumbnails in the preview box.
- ExtendScript has no `JSON.stringify`: the panel writes `library/packs.json` with a small writer (`toJSON` in `tools/ss_panel.jsx`); check the output with `python -c "import json; json.load(open(...))"`.
- **Chained ternaries with comparisons are mis-evaluated by ExtendScript**: `return sz >= max*0.85 ? "title" : sz >= max*0.45 ? "subtitle" : "body"` returned "subtitle" for the largest text, and `L instanceof TextLayer ? "text" : L instanceof ShapeLayer ? …` fell through. Use explicit `if` chains.
- **ScriptUI cannot play GIFs or video.** For live previews, sample each preset's real motion (`tools/sample_previews.jsx` → `library/preview_curves.json`, ~90 KB for 68 presets) and redraw it as vectors in a custom `onDraw`, ticking with `app.scheduleTask(…, 83, true)`; redraw with `hide()/show()`. A flipbook of PNG frames would weigh ~6 MB and stutter.
- **Marker-driven timing** (like Animation Composer): record the keyframes each phase creates, drop `SS in` / `SS out` layer markers, and put `valueAtTime(remapped time)` expressions on those properties; the keyframes and curves stay intact. Never overwrite an expression that is not ours.
- Simulated mouse clicks (SendInput) do not reliably reach ScriptUI palettes; expose a scripting hook instead (`SS_PANEL.select(kind, name)`), which the MCP server also uses.
- **MCP over stdio on Windows:** force UTF-8 on stdin/stdout (`sys.stdout.reconfigure(encoding="utf-8")`); a reader that dies on a non-cp1252 character (`→`) breaks the pipe and looks like a server crash.
- **License drift in open-source sources:** animate.css moved from MIT to the Hippocratic License after 4.1.1; pin the last permissive version and record it next to the data.

### Panels: ScriptUI and CEP
- **ScriptUI panel crashes AE 2026** (access violation in `dvaui.dll` `UI_DispatchDrawToChild`) → custom-drawn controls
  repainted with `hide()/show()` inside a mouse event, or a control removed by its own click handler → defer rebuilds and
  repaints to a timer; in the end the panel moved to CEP (HTML), which also gives mouse-wheel scrolling.
- **"Cannot run a script while a modal dialog is waiting"** popping repeatedly → a repeating `app.scheduleTask` fires
  while a dialog is open → chain one-shot tasks (each tick schedules the next) and restart them on panel use. The
  bridge itself (`tools/ss_bridge.jsx`) was still a repeating task until 2026-10-19; now its ticks chain and the panel
  restarts the chain when the heartbeat (`SS_BRIDGE_LAST`) is older than 15 s (`host.jsx` `mdna_bridge_heal`).
  That restart then ran on the panel's 4 s status timer and re-armed the bridge into a dialog still open, so the
  message came back every ~15 s (2026-10-22) → the panel restarts it only when someone is there (a click or key in
  the panel in the last 10 s, or an Agent order running), and each restart that does not bring the heartbeat back
  waits twice as long (15 s … 4 min).
- **CEP extension does not load** (log: *Signature verification failed*) → unsigned → sign it: `tools/setup.py` makes a
  self-signed certificate with Adobe's ZXPSignCmd, signs `panel/` into a `.zxp` and unzips it into the user's CEP
  extensions folder; AE 2026 loads it with no developer mode (no UPIA needed; the 2024 UPIA known issue is about
  symlinks inside the package, and ours has none). Only `--dev` (a link to the clone) needs `PlayerDebugMode=1`, which
  the person sets, never Claude. Manifest changes (e.g. `--enable-nodejs`) need an AE restart.
- **"null" printed in the panel** → DOM `append()` / `replaceChildren()` turn a `null` child into the text "null" (our
  `h()` builder filters them, the DOM does not) → pass children through `kids(...)`.
- **The Agent answered "Failed to authenticate: OAuth session expired"** as if it were a normal reply (exit 0, result
  success) → `claude auth status` can still say logged in → the panel watches for that text and opens *Connect*.
- **Headless runs from another folder:** the repo's `.mcp.json` and CLAUDE.md follow the cwd → pass `--mcp-config` as
  inline JSON with the absolute server path, `--add-dir <repo>` and `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`;
  drop `ANTHROPIC_API_KEY` from the child env (in `-p` it wins over the subscription). Sessions live per cwd in
  `~/.claude/projects/<cwd with - >/<id>.jsonl`, resume with `--resume <id>` from the panel, `claude --resume <id>` in a
  terminal or `claude --desktop --resume <id>` in the Claude app; two writers on one session interleave, so warn.
- **"Connect Figma" opened a list of 71 servers** → `claude "/mcp"` shows every connector of the account, and the
  account already had Figma (`claude.ai Figma`, tools `mcp__claude_ai_Figma__*`); a second `figma` server added by hand
  only asked for authentication again → the panel counts any Figma server as Figma (`claude.ai Figma`,
  `plugin:figma:figma`, `figma`) and Safe orders run with `--strict-mcp-config` (only Motion DNA: faster, no other
  account tools).
- **Connecting Figma with the least friction:** linking to claude.ai › Settings › Connectors opened the Claude app, not
  Figma. `claude mcp login "<server>"` opens Figma's own permission page, but refuses without a terminal ("stdin isn't
  a terminal", even with `--no-browser`) → the panel opens a small minimized window running it (it closes by itself),
  the user presses Allow, and the panel polls `claude mcp list` until Figma is connected. Figma's access expires now
  and then: the same button reconnects it. In the panel the agent may not call `add_brand_note`: the user picks where a rule goes.
- **A conversation per brand that the Claude app also shows:** sessions are per folder, so a brand gets its own folder
  (with `CLAUDE.md` + `.mcp.json`) and the panel runs there; `claude --desktop --resume <id>` (2.1.285+) opens it in the
  app's sidebar. A conversation started with `-p` is not listed by the app on its own, so "Start in Claude app" sends a
  first message that names it ("Motion DNA · Brand: Vela …"), then opens it. The user's words go first in each message
  and the panel context after, so the app titles conversations by what was asked.
- **"Open in Claude app" failed with "--desktop … can't run non-interactively (… or redirected output)"** → Claude Code
  2.1.30x refuses `--desktop` when stdout is not a terminal, and the panel's `execFile` has none (2.1.220 does not know
  `--desktop` at all, so only the desktop-bundled build works) → `runDesktop` in `agent.js`: on Windows a minimized
  console runs it (`start /min`), stderr and `%errorlevel%` go to temp files the panel reads, so real errors still show;
  on macOS `script -q /dev/null` gives it a pseudo-terminal. Testing it from a Claude Code shell needs the
  `CLAUDE*`/`ANTHROPIC*` variables removed, or the CLI reports "requires signing in" (AE has none of them).
- **Our panel cannot sit at the top of the Window menu like Animation Composer**: AC is a native (C++) plugin; CEP
  panels always go under *Window › Extensions*.
- **"Several Motion DNA windows when AE opens"** → a launcher in *ScriptUI Panels* is itself a dockable panel: it opened
  the CEP panel plus an extra window, and AE reopened the old docked one every start → the launcher is a plain script
  (*File › Scripts › Motion DNA*, no window) and setup removes every `ScriptUI Panels/Motion DNA.jsx`.
- **Per-user Startup scripts run** (`%APPDATA%/Adobe/After Effects/<ver>/Scripts/Startup`): the bridge starts with AE,
  before any panel. Keep them silent: an uncaught error there opens a modal dialog that blocks AE (and every MCP call)
  until someone clicks it; ours is wrapped in try/catch.
- **`tools/test_mcp.py` works on the open project** (it added an SFX and animated the active comp of a client project)
  → run it on a scratch project, or close the project without saving afterwards.
- **"Apply" must respect animation that is already there:** applying a preset on top of hand-made keyframes mixed both →
  every entry point (panel, MCP, Agent) goes through `SSP.smartApply`: own animation is retimed and re-eased with its
  values kept (`SSP.restyle` rebuilds the keys, keeping spatial tangents and holds), Motion DNA's earlier animation is
  redone, and a layer with none gets the preset. A "re-eased" note on the layer must not say "Motion DNA", or the next
  apply would treat the user's keyframes as ours and replace them.
- **A docked panel can open before After Effects' scripting answers** (the panel stayed on "Loading" and never booted)
  → the boot retries for a minute. If the panel was not docked when AE closed, nothing starts the bridge until the user
  opens the panel (since then, a Startup script starts the bridge with AE).
- **Recording the panel's Agent outside After Effects:** the Agent needs Node (only inside AE) → `tools/record_cep_panel.py`
  sets `window.__previewAgent` and small stand-ins for `fs`, `child_process` and Claude's answers, plus a fictional demo
  brand, so every GIF tells one story the same way on any machine. Recording found two real issues: the Connect card
  closed itself right after Claude connected (now it stays, green, with Figma next) and the header wrapped with a brand
  chip.
- **`expand_library.sh` re-renders a few existing previews** when their MP4s are missing locally → after adding one
  preset, restore the unrelated GIFs, posters and thumbs it touched (`git checkout`) so the commit only carries the new one.
- **`total_cost_usd` is cumulative per conversation** (and an estimate; with a subscription it is not billed) → the
  per-order cost is the difference from the last total.
- **An MCP server keeps the code it started with**: after editing `tools/brand.py`, the running server still read the
  old paths ("No such file … library/brands/vela") → restart the session (or Claude Code) to load server changes.
- **Engine "undefined" in host functions** → `$.evalFile` runs in the caller's scope → publish to `$.global` after loading.
- **Old panel code after F5** → CEP caches the page's scripts → load CSS/JS with a `?v=Date.now()` query.
- **Open requests got the same kind of video every time** ("I want a video with DNA" → one generic build) → the Agent
  reads the request first: `read_brief` (`tools/intake.py` over `library/intake.json`) returns what fits from different
  kinds, 2-3 routes and only the questions the request leaves open; a precise order comes back as direct. Each project
  keeps `claude/intake_history.json`, and what it already made goes last. The panel's context tells the Agent to do
  this; the skill does it for Claude Code. A route of its own for a character read oddly ("C. The Agent in the modern
  style"): characters ride along with a template or technique instead, and no style is invented without a feel.
- **Claude only knew Motion DNA inside the clone** (the skills lived in `.claude/skills/` of the repo) → `setup.py`
  links them into `~/.claude/skills` as its last step (a junction on Windows: no admin; a symlink on macOS), wrapped so
  a failure only prints a note. A link, not a copy, so updates reach the skill; a real folder of the user's own is never
  replaced, and uninstall removes only links that point to a Motion DNA clone. Outside the repo, relative paths in a
  skill resolve against `~/.claude/skills/<name>`, not the clone → setup writes `REPO_ROOT.txt` (git-ignored) next to
  each SKILL.md and the skill says to read it. A non-ASCII arrow in a setup message crashed a cp1252 console in a test
  run: keep setup output ASCII.
- **Claude Code not found from AE** on Windows → the Store build of the desktop app keeps it under
  `%LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude\claude-code\<version>\…\claude.exe` → search there too.
- **A text preset over a move wiped the move; Replace wiped the layer's own rotation** (use-case tests UC01, UC02) →
  replacing removed every keyframe of the layer, not only the channels the new preset animates → `SSP.replaceWith`
  snapshots the keys, applies the new preset, and puts back every property it left untouched (text animators stay when
  the new preset is a move). Results now say *replaced* (the layer's own animation) or *redone* (an earlier Motion DNA move).
- **`apply_brand` ignored the brand's own timing** (a 700 ms car with overshoot for a brand that says 900 ms, no bounce;
  UC09) → the style's defaults won → after the style, `SSP.brandTiming` retimes the layers each `motion.timing` entry
  names (by word in the layer name, else by role) on the entry's own curve. Overshoot rules still need a look at a frame.
- **Retiming left marker timing on the old spans** (expressions kept `var A=…, B=…`) → `restyle` only moved keys →
  it now rewrites our marker expressions and moves the SS in / SS out markers by the same factor.
- **The agent saved the AE project unasked and skipped the layout check** (UC08, UC09) → nothing in its context said
  otherwise → the panel's context now says never to save unless asked, names the project's own .aep, says what "the
  selected layers" means when none are selected, and asks for `check_layout` (now an MCP tool) before calling a build done.
- **The panel in After Effects kept showing old screens after a push** → the signed install is a copy of `panel/` made
  when setup ran, so its scripts never changed → the installed `index.html` is now a shell that loads the styles,
  scripts and `host.jsx` from the clone named in `.root`; only changes to `index.html` or the manifest need
  `python tools/setup.py --update`. Close and reopen the panel to see code changes.
- **`setup.py` crashed printing a tool's output** (`UnicodeEncodeError … cp1252`) → a Windows console encoding → it
  reconfigures stdout/stderr to UTF-8 with replacement.
- **Panel rows clipped in a narrow dock** (header status, Modify/Replace row, Agent footer) → fixed-width flex rows →
  rows wrap, the header status shows dots only under 320 px, and the send row stacks.
- **The Agent improvised "text behind people" for 34 turns ($1.24) and fell back to GrabCut** (UC08) → techniques had no
  tools and Full mode cannot run ComfyUI's Python → MCP `matte` (still or video, local GPU) and `text_behind` (matte the
  subject, cut-out above the text, parented to the subject); techniques.json names each technique's tool.
- **Transitions animated each layer on its own** (UC04) → no notion of an outgoing and an incoming layer →
  `SSP.applyTransition` / MCP `apply_transition` / the panel's Transition button with two layers selected: the first
  leaves as the second arrives, from the same cut, keys added to what they already have.
- **HUD labels came out at 18–26 px and white on white** (UC12) → the SSHUD defaults predated the 32 px rule → defaults
  are 32 px; use `"card": true` on light plates. **Callouts drifted out of frame on a moving shot** → they pointed
  outward → point them inward.
- **A style animated a button's label apart from its pill** (UC14) → every text layer got its own role → layers with a
  parent ride it (a style skips them) and fade with it through an opacity expression (opacity is not inherited).
- **`build_scene.jsx` failed with “) does not have a value”** on a scene without tracks → `SSM.readJSON` of a missing file
  evals "()" → no tracks file: the plate gives size and rate.
- **`check_layout` judged text mid-animation and missed parents** (UC11–UC19) → it measured at the first visible frame
  and ignored the parent's transform; a faint shadow counted as help → it waits for the text to settle (its last key
  before the exit, its parent's too), maps parented boxes, counts a shape card under the text as its plate, and only a
  60 %+ shadow as help. It still cannot see products: rule 15 in CONTRIBUTING §9 covers that by eye.
- **A random flicker failed the engine test now and then** → 4 % per frame with a seed that depends on the layer index
  can miss every sampled frame → a random/wiggle expression counts as motion.
- **The engine in After Effects was an older copy** → `$.global.SSP` is loaded once per session → a job that needs the
  latest engine runs `$.evalFile(tools/ss_presets.jsx)` first.
- **The office views for the video disagreed** (windows, doors, desks), and even views generated *from* the master
  moved the screens and swapped the desk props → a generator re-imagines details → close-ups of a set are **crops of the
  master upscaled locally** (`tools/upscale_crop.py`, free, every object identical); a floor plan is **drawn** from the
  master; only an angle the master cannot show (the reverse) is generated, with the master and the close-ups as
  references, then mirrored and cleaned of anything that stands behind the camera. Check each view object by object
  against the master before using it.
- **Remote debugging lands on another extension** → several `.debug` files used the same port → give ours its own.
- **Transition bars ignored their Direction angle** → `layer.parent = ctrl` compensates the parent's rotation so the child keeps its look → pieces that must live in the controller's rotated space use `setParentWithJump(ctrl)` (no compensation).
- **"Object is invalid" right after building a controller** → adding an effect invalidates every property reference fetched before it (a slider grabbed first, then more controls added) → add all controls, then fetch the property you key.
- **Text came out in Times although `getFontsByPostScriptName` found Inter Tight** → the per-user variable font is installed but listed in `app.fonts.missingOrSubstitutedFonts` → pick fonts that are found AND not substituted, and keep same-weight fallbacks behind brand fonts (`ss_elements.jsx` `font()`).
- **A box measured from its text was twice too tall** → `sourceRectAtTime` includes text-animator offsets (characters still rising) → measure at rest: after the entrance has settled, before any exit.
- **A clip slide showed black frames at the cut** → the outgoing shot left the frame before the incoming one entered → slides are pushes: both shots move together, edge to edge; a spin needs the scale to follow the angle (`cos + (W/H)·sin`), not the same ease as the rotation.
- **Position keys with `[x, y]` on a 3-value position made NaN** (overshoot tokens interpolate every dimension) → copy the current value (`slice(0)`) and change x/y so z stays.
- **Generated transitions must use our own tokens, not ad-hoc easing** (review note 2026-10-14) → each piece solves the token cubic-bezier in its expression (y beyond 0..1 keeps the overshoot of Pop/Nudge and the anticipation of Wind-up), picked from Ease In / Ease Out dropdowns; durations are tokens too.
- **`setPropertyParameters` on a Dropdown Menu Control recreates the effect with its default name** → keep the property it returns: set the value on it, then rename `propertyGroup(1)`.
- **A vertical wipe spent most of its time off screen** → the travel used the comp diagonal → travel and band layout come from the live Direction angle (`|cos|·W + |sin|·H` along, `|sin|·W + |cos|·H` across), and the spare length that absorbs overshoot sits behind the piece while covering and ahead of it while uncovering.
- **A background rendered another comp's pixels (an old ad, tinted)** → Fractal Noise, rendered from a script with GPU acceleration, returned a stale buffer → no Fractal Noise in generated looks: liquid = 4-Color Gradient + Turbulent Displace on an oversized solid (so displacement never pulls in emptiness), topographic = thin lines + Turbulent Displace.
- **Shape-layer backgrounds showed only the base colour** → in a shape layer the first group in the list draws on top → add the base last, or `moveTo(numProperties)`.
- **Camera shake turned the frame black** → Transform effect index 0003 is Scale Height, not Uniform Scale (0011) → check effect parameters by matchName in a probe comp before writing them.
- **Twirl and similar distortions showed black corners** → they pull pixels from outside the layer → Motion Tile (300 %, mirror edges) before the distortion. Twirl's radius is a percentage.
- **Shift Channels "Full Off" is 10**, not 11 (the menu runs 1-10). Adding red and blue channel copies over an opaque shot tints it → glitch with three channel copies (R, G, B) and hide the source during the burst.
- **An edited expression on an existing comp still rendered the old result** (`saveFrameToPng` right after the edit) → verify an expression change in a fresh comp, or wait before reading the frame.
- **Chained ternaries struck again** (`a === "x" ? … : a === "y" ? … : …` picked the wrong branch: shapes drew nothing, elements took the display font) → explicit `if` chains in every ExtendScript engine; expression strings (AE's JS engine) are fine.
- **A slice of a moving layer stayed put while its content slid** → a mask expression using `fromComp()` follows the layer every frame → pass the cut time, `fromComp(point, t)`, so the slice travels with its content.
- **Rebuilt pieces looked "simulated" next to the reference** (review note 2026-10-14: if it is low quality or not organic, do not offer it) → compare 8-frame strips side by side with AC previews of the same family before shipping. What made ours mechanical: lines that only draw on (AC's draw on, hold, then *travel off*), constant stroke widths (AC's breathe or thin out), one element at a time (AC echoes 2-3 offsets), flat contrasting colours (AC uses one hue in shades), soft gaussian blur on pushes (AC uses directional or radial blur), incoming shots that overshoot and show an edge. What still does not hold up gets retired from the kit, not kept "just in case".
- `saveFrameToPng` returns before the PNG is on disk: wait a moment (or check the file time) before reading it.
- **Setup kept asking to connect Krea although the Claude account's Krea was connected** → `claude mcp list` lists the account's connectors (`claude.ai Krea`) separately from servers added by hand (`krea`), and its first read after a change can leave the account's connector out (74 lines, then 75 with the same setup). The panel read "missing", added a second `krea` that never finishes its login, and that one kept asking → "not connected" is believed only after another read (Setup, Connect and the Agent's context: 1 more for "needs sign-in", 2 more for "missing"; the Agent asks again after a minute, not five); a server is added only if it stays missing, and a name remembered from an earlier read is dropped once the service is gone; if the read fails, add nothing; a leftover duplicate (hand-added, our URL, not connected, with another connector of the service connected) is shown in Setup with a **Remove duplicate** button that asks `claude mcp get <name>` for its scope (local/user are removed, project `.mcp.json` is never edited). The allow and deny lists of the Agent are built from the same server names (`claude mcp list` spells them `claude.ai Krea`, tools `mcp__claude_ai_Krea__…`), so nothing is allowed without its deny rules (tokens, plans, deletes). Tests: `node tools/test_mcp_status.js` (no CLI needed; it also runs on LF and CRLF checkouts). **Copy diagnostics** in Setup › Having trouble? copies platform, `claude` path and version and the Figma / Krea / Flora lines of `mcp list` (query strings masked); every other server shows only its name and status, because `mcp list` prints their command lines and URLs, which can carry keys. The Agent's deny rules match exact tool names while the allow rule takes the whole server, so every way of writing a file (`write_files`, `_inline`, `_upload`), editing a moodboard or driving a desktop app is listed; a new tool of that kind in a connector must be added to `GEN_DENY`. The status of a connected service is only downgraded after two bad reads in a row.
- **Update stopped with "local change(s) to tracked files" for a person who had only run the tests** → `tools/test_mcp.py`, `test_library.jsx`, `check_layout.jsx` and the mosaic tools rewrite versioned files in `research/tests` (reports and sample images) → `setup.py --update` now restores exactly those from git before the pull (`GENERATED` in `setup.py`; the fixtures are inputs and count as the person's work); any other modified tracked file still stops it with nothing touched, not even those outputs. **A fix in `setup.py` cannot help a clone that is already blocked:** the old `setup.py` on that disk runs the check before it pulls, so that person fixes it once by hand (`git checkout HEAD -- research/tests`, or commit/stash their own change) and every later update is covered. **With the person's own changes and nothing new to pull** (a developer's clone that is already up to date) `--update` no longer stops: it reinstalls the panel from the files on disk and touches none of them; if the remote has commits waiting (or cannot be reached, or there is no upstream) it still stops, and says how many are waiting. Tests: `python tools/test_setup_update.py`.

- **Figma UI exported for AE came out soft when scaled up** (MCP `get_screenshot` ignores `maxDimension` above the node's native size: a 400 px panel stays 400 px) → clone the node, `rescale(2.2)` the clone (detach instances first), export the clone and place it at 1/2.2 in AE; delete the export clones afterwards (T02 tutorial, 2026-10-20).

- **`importFile` failed with "undefined is not an object" on a teaser still** (`storyboard/car_sf/sf_car5.png`): the file is JPEG data with a .png extension (ffprobe: `yuvj444p`) → check the codec, not the extension; re-encode to a real .jpg/.png before importing (T05 tutorial, 2026-10-20). Also: loops such as Float are effects, `SSP.applyFx(L, "Float")`, not `SSP.apply` ("Preset not found").

- **A tutorial showed Modify on a layer Motion DNA had just animated; the panel never offers it there** (review 2026-10-20) → the Modify / Replace switch shows only for keyframes Motion DNA did not make (a client's or hand animation: `mdna_sel_info` `own`); a Motion DNA move is simply redone by Create (`ours`). Check the panel code (`panel/js/app.js` `selHint`), not the Figma screen, before scripting what a button does.

- **The bridge stopped answering ("No answer from After Effects") after files were moved on disk** (T05 tutorial, 2026-10-20): AE noticed footage items whose files had moved and opened a modal "Files could not be found" dialog; nothing runs behind a modal → never move or rename files the open project references; archive by copying, or remove/relink the footage items first (`it.footageMissing`, `it.usedIn.length === 0` → `it.remove()`).

## 2. Animation Composer as a behavioral reference
- Presets are encrypted (`.mhcitem`/`.mhitemdata`). We never decrypt or modify the plugin, and we never enable CEP debug modes.
- Architecture (observed in AE): a preset creates **no keyframes**. Properties get the expression `getAnimationComposerPresetValue()`, driven by pseudo-effects `MHAC PrCtrl <CODE> <ver>` (`AC IN`, `AC OUT`, `AC FX`) whose parameters are the recipe (offset, angle, bounces, scale; FX = frequency/range/time offset), plus `TR In`/`TR Out` markers.
- So: sample the **evaluated value** frame by frame (`valueAtTime(t, false)`), fit a bezier (`tools/fit_samples.py`) and store a recipe (`tools/harvest_to_library.py`). Loops are stored as amplitude + frequency (FFT).
- There is no scripting API to apply presets; automate the UI instead (`tools/ac_driver.py`, double-click per thumbnail) with the harvest station logging each one.
- Real transitions measured: entrances 12–17 frames, exits 13–20, typical overshoot ~5%, exits often with anticipation. Our tokens were calibrated with this.
- The asset packs (grain, light leaks, VHS, UI SFX) are plain files and usable directly.
- Measured AC fingerprint across ~6,100 previews (`docs/animation-composer-map.md`): short phases with overshoot (Pop
  dominates), blur on most moves, warp on a third; footage transitions are the snappiest (median 434 ms, 81% overshoot).
  Its helper panels (Keyframe Actions, Wingman, Transition Shifter, Anchor Point Mover) are rebuilt from scratch in
  `tools/ss_keyframes.jsx` (MCP `keyframes`, `anchor_point`).

## 3. AI footage (Flora)
- **Consistency across shots:** generate one **master** two-shot with both identity photos, then generate each close-up with `[master, identity photo]` as references ("same scene, lighting, wardrobe as image 1"). Set, wardrobe and light stay consistent.
- Kling 3.0 Pro image-to-video (5 s, 1080p) gives handheld motion that is great for tracking; expect push-ins and objects leaving the frame.
- Kling outputs **1928×1076** at 24 fps → normalize to 1920×1080 before anything else (`scale=1920:1080,fps=24`).
- VEED background removal **fails on the raw Kling URL** ("failed to preprocess input video"); upload the normalized 1080p file and use that URL. Output is VP9 with alpha at a different size → convert with `ffmpeg -c:v libvpx-vp9 -i matte.webm -vf fps=24,scale=1920:1080 -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le matte.mov` (the `-c:v libvpx-vp9` *before* `-i` is required to keep alpha).
- Local files → Flora: `flora_create_asset(source="signed-url")` then `python tools/signed_upload.py <file> '<upload json>'`, then `flora_complete_asset`.
- Music: ElevenLabs Music follows duration and structure from the prompt ("26 seconds… breakdown at second 15…"); design the edit to the BPM (96 BPM → 8 beats = 5 s = one shot).
- Use blank labels / fictional brands in prompts ("whisky bottle with a blank cream label") so overlays can carry fictional data.
- **Voices must be one per character for the whole film.** Generic TTS lines (ElevenLabs "Adam") next to Seedance clips
  that already speak in the character's voice sound like two people (similarity 0.64) → convert every line with
  speech-to-speech (`resemble-ai/chatterboxhd/speech-to-speech`, target = the character's reference wav): 0.75–0.87
  similarity, same words and timing, ≈ $0.02/min. Measure with `resemblyzer` instead of guessing by ear. Also level
  every line to the clips' dialogue (−21 LUFS here): TTS came 4–8 dB louder.
- **A shout that has to sync:** do not paste a voice over a silent clip. Kling **v3 pro** image-to-video with
  `generate_audio: true` ($0.14/s) gave a clean, synced "Yes!"; Kling 2.6 audio was garbled, MiniMax H3 reference-to-video
  returned 2.2 s and looked wrong, Veo 3 fast refused (content policy). Write **"no music, no background music"** in every
  video prompt: generated clips with their own score fight the edit's track.
- **Kling image-to-video for living plates:** five R4 stills became moving shots (village, key, coast, sunset, café) at
  $0.35 each; a shot that carries a still cut-out (text behind the car) stays a still, because the car moves in the clip.
- **lipsync** (`fal-ai/sync-lipsync/v2`, $3/min) fixed a talking-to-camera Kling shot in one pass; pad the line with
  silence to the clip's start offset.

- **A generated character drifted from his design** (T03 tutorial, review 2026-10-20: "the character looks a little bit different"; Marcus was made from a teaser frame and the scared close-up) → always source the character sheets: Figma *motion-adn* › `05 · Video assets (4K)` › *Characters · turnarounds and expressions* (`characters/<name>_turnaround`, `<name>_expressions`) plus the location sheet (`locations/office_<name>_desk`), as references for the still and the clip.

## 3b. Keeping real people's likeness (The 1974 Cypher)
- **Identity references = real photos only.** Using earlier AI shots of the same person as extra references compounds drift (the Boardroom close-ups had already made both collaborators slimmer and younger; reusing them made it worse).
- **Describe the person's traits in the prompt** (age, build, face shape, beard, hair texture, eyelids, nose) and say "same age, not idealized". Models default to a younger, more handsome actor.
- **Wardrobe can break a likeness.** One collaborator stopped reading as himself with a flat cap plus aviators on the face; a cap like the one in his real photo, with the glasses hooked on the collar, fixed it instantly.
- **Never pass the old master as a reference when fixing faces**: the model copies its faces. Build the new master from real photos + approved close-ups, and describe the scene in text.
- **Nano Banana 2.1 (`is2i-elote-gateway`) kept likeness better than Nano Banana Pro** in our tests, even with glasses, at ~USD 0.05 per image; `thinking_level: HIGH`.
- **QA before spending on video:** `python tools/face_check.py --ref <real photo> --out sheet.png <stills or clips>` puts every detected face next to the real one. Run it on stills, then again on the generated clips.
- **Video models, same shot and prompt (orbit around a face):** Seedance 2.5 (`i2v-gengateway-seedance-2-5-i2v`, 1080p) kept the face *and* the background consistent with a real orbit, but billed **USD 6.05** for 5 s (the estimate said 2.48). MiniMax H3 Max (`i2v-minimax-h3-max-gateway`, 768p, ~USD 0.48, ~15 s) kept the face but the background drifted; upscale to 1080 with lanczos + light unsharp. Kling 3.0 Pro is fine for shots without faces. Use Seedance for the hero face shot, MiniMax for the rest.
- **Face refinement pass (MiniMax H3, local):** every generated clip with Aaron or Gian goes through `tools/faceswap_refine.py` before editing. Head inpainting (`h3_swap.py`, SAM3 head mask, denoise 0.9, expand 25, 8 steps, `--ref-size max`) keeps wardrobe, hats, glasses, background and camera, and moves the face back to the real person (Cypher close-up of Gian: ~6.8 min for 5 s on an RTX 5090, 1080p kept by the uncrop). Character Swap would bring the reference photo's t-shirt into the shot; inpainting does not.
- **A screen replacement must look inside the glass:** corner-pin a flat UI and it reads as pasted on. Clean the plate's screen first (OpenCV inpaint of what was on it, keep the glass reflection), then pin with lens distortion (Optics Compensation, the CRT bulge), Add blend so the reflection shows through, and a soft glow (`screen` with `bulge`, `blend`, `glow` in `build_explainer.jsx`). Readable UI needs the screen large in frame (~600 px wide or more).
- **Holy light = a soft glow behind the person, not rays.** Radiating rays read as too much; a warm radial light between plate and people matte (`glow` HUD item) reads as a backlight. Build it as a radial Gradient Ramp on an oversized solid (Add blend): a blurred shape layer is clipped to its bounds and shows a hard rectangle.
- **Scene-cut timestamps are the first frame of the NEXT shot.** Cutting a plate from 0 to the detected cut (ffmpeg `select=gt(scene,…)`) leaks one frame of the next shot: a character flashes in where they are not. End every plate one frame before the cut.
- **Local mattes, no cost:** ComfyUI's embedded Python has `transparent-background` + CUDA; InSPyReNet (MIT) from `models/RMBG/INSPYRENET` gives clean people mattes (`tools/video_matte.py`). Avoid RMBG-2.0 for this (CC BY-NC). For people KLT loses (fast moves, blur), take the track from the matte (`tools/matte_points.py`) or track the clip backwards from the frame where the object is sharp.
- **Scripting gotchas met on the way:** `ADBE Vector Grad Colors` (shape gradient colours) cannot be set by script — use a solid fill + blur; 2D layer rotation is `ADBE Rotate Z`; layer Scale always takes 3 values; `Glide` is a duration token, not an easing.
- **Multi-shot AI clips break spatial continuity at the edges of their shots.** Seedance r2v kept faces and wardrobe, but the last seconds of a shot moved characters to desks they never sat at, and a new shot opened with a prop already in the wrong hand. Fix in the edit, not with a re-generation: scrub every shot at 0.1 s (`fps=10,tile`), trim each one to its action, end a shot on a freeze when what follows is wrong, and bridge to graphics through an object in the world (a corner-pinned screen + camera push) instead of a hard cut to a blank scene. Durations of shots that carry a freeze must be whole frames (time remap goes up to `dur`).
- **Consistent characters: sheets first, then references everywhere.** Generate one character sheet per character (close-up, full body, 3/4), a location sheet and a props sheet, then make every keyframe with Nano Banana 2.1 images-to-image (`is2i-elote-gateway`) passing those sheets as `reference_node_ids`. Text-only shots drift (other face, other shirt). For video, Seedance 2.5 `r2v` takes up to ~6+ reference images and up to 30 s with several cuts and dialogue in one run; passing the keyframes + character sheets kept faces, wardrobe and room identical across 15 s. Ask Flora for a `quote: true` first: its r2v 720p quote was within 2 % of the charge. FLORA's `flora-script-to-video` skill describes the gated pipeline.
- **The reference must be in colour.** Our real portraits are black and white; MiniMax turns a B&W reference into a grey, high-contrast face. Colorize the real photo first (Nano Banana 2.1: "colorize, change nothing else, plain light grey background", ~USD 0.035) and cut the background out (the tool runs `rembg`).
- Two people in one shot: one pass per person, the second fed with the first's result, **and pick the head with `"object": 0|1`** (SAM3 track index, left to right in our shots). The detect text does not single anyone out: "the head of the man in the navy pinstripe suit" tracked both heads, so the second pass painted Gian's face over Aaron too (he lost his beard and his hat).
- Clips longer than 5.17 s (124 frames) run as two overlapping chunks joined by a 0.5 s cross-fade; the first version silently cut a 6.6 s clip to 5.2 s.
- AE locks open footage on Windows: relink it before overwriting (`tools/footage_relink_release.jsx`, `faceswap_apply.py`, `tools/footage_relink_restore.jsx`).
- Flora routes a two-image MiniMax "mixed" request to first-frame/last-frame (`f2v`): the second image becomes the ending, not an identity reference.

## 4c. Speed ramps
- A speed ramp is a time-remap curve: `edit.json` shots take `"speed": [[editLocal, clipTime, "Ramp"|"Surge"|"Whip"|"Flat", "whoosh sfx"], ...]`. A good pattern per 2-bar shot: slow-mo (≈0.5×) → a `Ramp` burst through most of the clip → slow-mo landing, with the whoosh centred on the burst.
- Turn on pixel-motion frame blending for the slow parts (`build_edit.jsx` does it); AI clips at 24 fps stutter otherwise.
- Reversing a clip with a ramp (`[[0, 6.4, "Ramp"], [2.53, 0.6]]`) gives a free "rewind whip" for the last beat.
- Cut the music on the bar grid (tempo + phase from onset flux) and drop long silences; titles go in a soft lower-third band because orbiting shots move the people across the whole frame.

## 4. Tracking, roto and overlays
- **Tracking** (`tools/track_points.py`): pick regions from a gridded first frame (`drawgrid`), radius 40–90 px, textured areas (faces, ties, lapels, glass rims, skyline). Check the debug sheet; low `conf_min` or big drift means the object left the frame → give HUD items a `t1`.
- Nulls are 100×100 with anchor `[50, 50]`; expressions use `a.toComp(a.transform.anchorPoint)` so tracked points are exact in comp space.
- **Roto matte → depth:** plate · *behind* text · people matte · grain · contours · face scans · HUD. That order puts giant titles behind the people for free.
- **Contours** (`tools/matte_contours.py`): biggest external contours per frame, resampled to a fixed point count starting at the top-most point, temporally smoothed → stable animated paths. When subjects touch (a toast), use `--split-x` to cut the mask so each person keeps their own line. Add *Wiggle Paths* (Roughen, smooth points) + an offset echo line for an organic, hand-drawn feel.
- **Face scan:** a sweeping band used as track matte for (a) a sideways-shifted copy of the plate (the "slice") and (b) Find Edges → Threshold → Tint copy screened on top (holographic face). Without Threshold, hair/beard edges turn into a green blob.
- **Holographic look:** Glow + faint Venetian Blinds scanlines + a rare opacity flicker; motion always comes from library presets so timing stays on-brand.
- **Template tracking beats colour tracking** for a small object: tracking a pale blue car by colour locked onto the sea;
  OpenCV `matchTemplate` on a 90×70 crop, re-cut from each new frame, followed it for 5 s. Parent a null to the footage
  layer and key its Position in source pixels; labels and leader lines read `toComp([0, 0])`.

## 4b. Organic motion, freezes and voiceover
- **Organic strokes come from keyframe spacing**, not from a single curve: split the travel into 3–5 uneven segments, give each its own duration (some rush, some crawl) and ease (Land/Cruise/Settle), and drop 2–4 frame holds between some of them. `SSM.organicStops(v0, v1, frames, seed)` + `SSM.animateStops` do it with a repeatable seed per layer. A chasing Trim Start (offset by a Glide) turns it into a traveling brush stroke.
- Linear segments inside multi-stop animations (`Flat`) must set linear interpolation, not temporal ease — otherwise `KeyframeEase` gets `NaN`.
- **Freeze frames:** time-remap hold on the shot (keys in comp time!), 7% punch-in (Land in, Launch out), a 2-frame Cloud flash, a 48% Pine scrim, then a big foreground title (Chars Rise) + Tracking Settle subline + Organic Draw underline. A camera-click SFX on the freeze and a pop on the title sell it.
- Place audio in each shot's **local time** (`{"shot": i, "local": s}`) so changing a freeze never desyncs VO/SFX.
- **VO:** ElevenLabs v3 accepts tone tags (`[smooth 1970s TV announcer, dry humor]`, `[chuckles]`, `[short pause]`). Generate one file per line, trim silence (`silenceremove` both ends), loudnorm to −16, and if the edit is tight speed up with `atempo=1.07` (inaudible). Design freezes around the measured line lengths; land the punchline on the freeze title.
- **Freeze with the subject lit:** the scrim darkens only the background — duplicate the frozen shot above the scrim and track-matte it with the person matte (same time-remap keys, scale linked by expression), so the people stay at full brightness while the title lands.
- **Copy must sell the product, not just the joke.** First pass was funny but about the characters; second pass ties every punchline to what the library does ("Zero keyframes", "Tracked.", "Rotoscoped.") and the freeze title repeats the exact keyword the VO says. Use kicker "beats" that pop in sync with each VO phrase (`freeze.beats`, timed from silence detection).
- **Expressive VO:** ElevenLabs v3 at stability ~0.15 with energy tags (`[theatrical 1970s TV commercial announcer, big warm smile in the voice]`, `[beat]`, `[laughs]`) is far less flat than 0.35. Detect phrase starts with `silencedetect=noise=-35dB:d=0.16` to time beats and titles.
- **Harsh SFX:** measure before using — `Single UI Beep 02` sits at −3.9 dB mean with strong highs and sounds like an alarm; soft blips/plastic pops (`Blip 01_Variant Minus 18`, `Pop Plastic Micro 03`) read as "data" without hurting.
- **Text needs effects, not just position:** per-character blur + 118% scale in the reveal animator, animated horizontal blur on tracking reveals, motion blur on every graphic layer, and glow + soft drop shadow on big foreground titles.
- **Ducking:** drop the music ~9 dB under every VO line (0.2 s attack, 0.35 s release); with VO the whole mix lands near −16 LUFS when VO and music sit at −3 dB.

- **Kinetic type on freezes:** one line at a time, big and centered; contrast sizes (small tracked caps lead + huge serif hero) instead of same-size stacked kickers. Lines replace each other (shrink + fade out as the next slams in); beats that fall after the title cycle in the title's lead slot so nothing overlaps. Pivot text around its visual center (`sourceRectAtTime` → anchor) before scaling or tilting. Each entrance gets a short swoosh; the title a soft boom trimmed to ~1.8 s with a fade.
- **Clean freezes:** darken (~66%) *and* defocus the background (adjustment layer with Box Blur) under the type; cut the people from the clean plate, not from the finished scene, so HUD lines don't run through them under the title. Drop heavy glows on titles: they read as saturated noise behind big type.
- **Showing the product in the video:** a real screenshot of the app beats mock panels. Capture each state headless (`msedge --headless --screenshot "index.html?kind=…"`), rebuild it as a browser window comp with a cursor clicking each filter (`tools/build_app_screen.jsx`).

### Behaviours: the algorithm apart from the target (tools/ss_behaviors.jsx)
- **One contract for every target.** A behaviour only reads `BX` (region), `p` (eased progress), `PT(t)` (progress at any time), `OR` (origin) and `LOOP`; each target writes that prelude (a keyed Progress slider, an element's Reveal, SST's cover/reveal). So bubbles feed a shape, a background, a text matte and a wipe without new code. Group them by nature (fill, swarm, physics, modifier) and list per behaviour the targets that passed review: the next Claude picks family → behaviour → target.
- **Wrap behaviour code in a function** (`function BEH() {…} BEH();`): SST's prelude declares `c, o, P, S, k, q, r`, and a behaviour's own `var r` silently clobbered them.
- **Gooey / metaballs:** Gaussian Blur (~0.3 × bubble radius) then *Levels (Individual Controls)* on alpha only: `ADBE Pro Levels2-0032/0033` (Alpha Input Black/White) = 0.45 / 0.55 (values 0..1). Close shapes melt into one; keep one colour per layer or the blur mixes colours at the edges.
- **Motion blur smears a path that grows by expression** (the blob wipe looked out of focus) → no motion blur on behaviour pieces.
- **Springs on token curves:** drive each edge with the curve's own speed, `x(t) = Σ v(t−s)·e^(−d·s)·sin(ω·s)·dt` over the last 1.5 s (`PT` is read back in time). Overshooting curves (Pop) wobble more, Settle barely: the jelly follows the token, no extra keys.
- **Verlet in an expression is cheap:** re-simulate from `max(inPoint, time − 6)` each frame at half-frame steps (16 points × 360 steps × 6 constraint passes). Start coiled at the pinned end: a rope that starts hanging straight down reads as a falling stick.
- **Voronoi without libraries:** clip the region by each neighbour's bisector half-plane (Sutherland–Hodgman), O(n²) per frame is fine for 40 cells. Jitter the seed grid by ≥ 1.5 cells or the cells line up in columns.
- **Hand-drawn line boil:** a new drawing every 3 frames from a short cycle of 3 (`posterizeTime(fps / 3); Math.floor(time * f) % 3`). Shape layers: *Wiggle Paths* (`ADBE Vector Filter - Roughen`) with Wiggles/Second 0, Points smooth and the posterized cycle on Random Seed. Any layer: Turbulent Displace (Amount ~14–22, Size ~7, Pinning 1 = none) with the cycle on Evolution. This is different from the *Boil* preset, which jitters the whole layer; they combine. Styles carry it with `"modifiers": ["line_boil"]` in `library/packs.json` (Collage).
- **Dropped in review (2026-10-14):** spring as a text mask (the jelly box contains the text, so nothing reads), flock as a background (a small cluster in an empty frame), bubbles as an element box (the text lands before the box forms).

## 5. Design and layout rules
- Keep kickers and meters in empty corners; on push-ins faces move toward top labels.
- Giant behind-the-subject words at ~68% opacity so HUD labels stay readable over them.
- Stagger HUD entrances by ~0.3–0.6 s and sync SFX to them; one UI beep per element reads as "data arriving".
- Brand: Pine/Sea/Cloud/Spark/Coral from the *Essentials* Figma, Instrument Serif for display, Inter Tight for UI (`assets/fonts/`, OFL).

- **Promotional cut (not a slide explainer):** full-screen footage under oversized type (150–300 px), one idea per beat, hard cuts on the spoken word, and big two-colour shape wipes (Spark + Pine bars on the Whip curve) as transitions: the closing bars cover the last frames so the cut happens under a solid colour. Put the type on a bottom band (Pine at ~50 %) or on the empty side of the frame, never on faces. Busy demo footage goes into a big card next to the word, not full screen behind it (its own text fights the title). **One hero per beat**: a huge word (250–330 px) with a small kicker (60–76 px); two stacked lines of similar size read as a fight. Shape wipes need time and **continuity**: the bars that cover the end of a scene and the bars that reveal the next must have the same colours and direction (a colour swap at the cut reads as a flash), accelerate in (Launch) and decelerate out (Land), ~0.5 s + ~0.75 s; and every cut gets one (hard cuts between scenes felt abrupt). Short scenes lose half their time to the bars: open breaths in the VO (silence inserted in the pause before a phrase, `BREATHS` in `make_promo.py`) so each beat stays on screen ≥ 2.5 s and a speed ramp ~3 s. SFX must be set against the bed: at −14/−19 dB under a −13 LUFS pop track they disappear; a whoosh per cut at −3 dB and swooshes on hero words at −8 dB read clearly. Static pattern backgrounds look cheap; slow drifting lines (`lines` element) keep empty frames alive. Over footage, reuse the tracked scene comps (HUD chips, callouts) instead of the bare clip (`media` with `comp` and `hide`). Never put type over footage that has its own titles (the end card's reel showed through a Pine veil); use a clean plate. `tools/build_promo_all.jsx`.
- **Voice for promos:** one continuous read (ElevenLabs Multilingual v2, Chris, stability 0.45), never line by line, never stretched. Cut the scenes to the VO word times (`tools/vo_words.py`, whisper): a scene changes only in a pause, after its last word.
- **UI scenes in a promo for a motion tool must show the tool doing what the line says**, not a screenshot fading in:
  the panel builds on a base that stretches from a line, its sections and cards arrive in reading order, the cursor
  hovers / clicks / drags the real controls (positions read from the panel comps, not guessed), the result happens on
  screen (a live curve built from the dragged handle, its values updating by expression; a rule card flying into the
  brand), and a type block on the side swaps with each step. Split the VO so each phrase lands on its action. Blurred
  *video* behind the UI, never a still.
- **Layout QA before rendering** (`check_layout`): overlay type at 32 px or more, kickers included; microcopy inside a
  rebuilt app UI may stay small (say so). Headlines in a side block are left-aligned with their kicker. On light UI
  (Figma) put labels on a dark pill, never Spark on white.
- **Content on a CRT:** Screen blend plus a feathered mask (≈110 px) so the edge does not show; darken the glass under it
  when the plate already has something on screen; track the glass box frame by frame when the camera pushes in.
- **Callouts must point at what is on screen at that moment:** map the playhead to source time, check frames, and give
  each callout the duration of its shot.

- **Review round v9 (Motion DNA teaser), what went wrong and the fix** — now rules 16-24 in CONTRIBUTING §9:
  supers typed as a sentence and small → one word per beat on the whisper time, 150 px; UI side text 32-34 px in one
  long line → two-line blocks 86-136 px with `Words Slam`, the panels moved left to make the column; a background plate
  went black under the UI → the clip (12.07 s) started at −6.6 s and ran out at 5.47 s (`tools/qa_hidden.jsx` now flags
  it); the curve drag was too small to read → bigger handle travel plus a zoom rig on the editor; "just ask" typed into
  a floating card → a real chat composer, answer included; callouts on random spots → rings on car parts while that
  part is on screen; YES! fully hidden by one person → moved so one person covers it partly; hearts spilled into the
  next shot → outPoint clamped to the shot; the box sticker lost its text → text parented to the disc, stacked above.
- **Review round v10, what went wrong and the fix:** the curve in the panel moved 1.4 s before the cursor dragged it →
  a nested comp runs on its own clock (here editor time = scene time − 2.0 because of the panel's time remap): compute
  the offset through the chain and key the nested animation on it, with the same ease as the cursor; a spot played in
  the AE viewer jumped (the playhead scrubbed 15.5 → 3 → 20 → 9 s) → play the footage forward and cut only on its own
  wipes; cutting inside a wipe showed the spot's own black gaps (an iris that opens from black) → `blackdetect -d 0.04`
  on the source and cut around them; a generated close-up used a different mug than the wide shot → a hard punch-in on
  the liquid hides the prop; a title repeated what the product already says (MOTION DNA on the box) → use the empty wall
  for the presenter's name instead; a plate that ends one frame early still flashes black → `qa_hidden.jsx` now
  flags anything shorter than half a frame, and the final check runs `blackdetect` with `d=0.04`, not 0.3.
- **Review round v11:** a generated clip can end in black frames of its own (the box shot had 5) → `blackdetect` the
  source and cut at its last image, starting the next shot there; a tracked label froze when the shot got longer →
  re-track the whole new duration; a prop that should not be there (a white mug) is hidden with a punch-in computed in
  source pixels (keep the prop's top edge below the frame and the hands inside), then checked on a rendered frame.
- **Generating with characters that look real (teaser v12):** Flora refused every run with
  BILLING_WORKSPACE_MEMBER_USAGE_LIMIT_EXCEEDED (no charge); fal Seedance 2.5 reference-to-video rejected 4 of 6 shots
  ("likeness of real people", no charge) and accepted only the ones whose references show a robot or a wide shot;
  **Krea's Seedance 2.5** (MCP `https://api.krea.ai/mcp`, enterprise credits) accepted the same faces and references.
  Give each shot reference images (frames of the neighbouring shots) + `reference_audios` (the character's wav): the
  speaking clips came back with the right line and the character's voice (resemblyzer 0.84-0.87), no speech-to-speech
  needed. Seedance sometimes adds its own cut inside a 4 s clip: detect it (frame difference) and use the right part.
- **Continuity across shots → one multi-shot generation (teaser v12 round 2).** Symptom: a prop changed between
  separately generated shots (Marcus's mug went from amber glass to white ceramic), a door "burst" into flying wood,
  a hand came into frame from nowhere. Cause: each clip was its own generation, and "bursts open" reads as breaking.
  Fix: ask Seedance 2.5 for the whole beat in one run, with timed shots (`SHOT 1 — WIDE (0–3.5s) … HARD CUT to SHOT
  2 — CLOSE-UP INSERT … RAMPS TO SLOW MOTION … SNAPS BACK … HARD CUT to SHOT 3`), name the prop's exact look in
  every shot and again in a constraints tail ("the same amber tortoiseshell glass mug in shot 1 and 2, never white"),
  say "swings open fast… stays intact, no splinters, no debris", and "no other hands, no hand from outside the
  frame". Result: 9 s, three cuts exactly where asked (2.92 s, 5.88 s), the same mug in the wide and the insert.
  Whisper `small` can drop the first words of a line said under room noise: re-check with `medium` before regenerating.
- **SFX against dialogue:** measure each SFX window with ebur128 next to the lines around it before normalising. A
  door bang inside a generated clip was 4.5 LU over the line that follows it; duck that clip's first second with
  audio-level keys instead of lowering the whole clip.
- **Clips copied from an older edit keep their old speed.** Symptom: "the end looks slowed down and too short". Cause:
  the box close came from the v5 edit with `stretch` 222 % (2.1 s of source). Fix: read `stretch`/time remap of copied
  layers; play the move at 100 % and hold the last frame with time remap. From a script: enable time remap, set the
  new keys, then remove the default end key (removing every key first leaves the property hidden: "Can not set value
  at time").
- **Relinking ~140 footage items in one `run_jsx`** froze the file bridge and then After Effects closed (the project
  saved before it was fine). Relink or collect in slices of 30-60 items per call; if the bridge stops answering, clear
  `bridge/inbox` and `bridge/outbox/_bridge_started.txt` and start `tools/ss_bridge.jsx` again (`AfterFX -s`) once
  AE has finished loading.
- **Patching big JSX files from Python:** the files are CRLF; detect the newline (`chr(13) + chr(10)`) and replace
  with it. Never write the patch through a bash heredoc that contains `\n` / `\r` escapes meant for Python: write the
  `.py` with an editor tool instead (a heredoc turned them into real line breaks and broke the script).

## 6. Audio
- Target about **−16 LUFS integrated** for web (measure: `ffmpeg -i out.mp4 -af ebur128 -f null -`).
- Music at 0 dB with a 1 s fade at the end; UI SFX around −9 to −11 dB.
- **Fit generated music without splicing:** find the drop with an RMS envelope (0.5 s windows) and offset the whole track so the drop lands on the key word; with ElevenLabs Music the structure in the prompt is followed roughly (asked 6.5 s, got the drop at 16.3 s), so measure, then shift.

- **Level every line, then the master.** Lines from different sources came 2-6 LU apart (TTS, speech-to-speech,
  generated video with its own audio). Measure each line in the mix (`ebur128` over its span), set per-layer gains so
  they sit within ~1.5 LU, then `loudnorm` + `alimiter` on the master (≈ −14 LUFS).

- **Stock TTS for an off-camera line did not match the character's on-camera voice** (Krea ElevenLabs stock voices scored 0.50-0.71 with resemblyzer against `dana_ref.wav`; the Seedance clip with `reference_audios` scored 0.88) → keep the speech-to-speech pass (Chatterbox HD on fal, `FAL_KEY`) for every off-camera line of a generated character. On Windows `pip install resemblyzer` fails building `webrtcvad`: install `webrtcvad-wheels`, then `resemblyzer --no-deps`, `librosa` and CPU `torch`.

- **Sound made in code (Tone.js, `add_sound`), 2026-10-26.** Rendered offline in headless Chrome, two runs match to
  within 1 bit (float rounding), so a track is reproducible from its cue list. Rules borrowed from HyperFrames' sound
  reference: every effect has a cause on screen, few and exact; a sound lands one frame after its picture (light
  arrives first); the same whoosh on every cut is the first thing that reads as a template, so repeats rotate takes;
  synthesised chimes and dings read as synthetic, keep them for one payoff. A sparse SFX-only track can't reach
  −14 LUFS under a −1 dBTP limit: the peak wins, so the mux prints what it measured.
- **faster-whisper failed twice before it ran:** `open() got an unexpected keyword argument 'metadata_errors'` (a PyAV
  that does not match it) → decode with ffmpeg to 16 kHz mono and pass the array; then `cublas64_12.dll is not found`
  on an NVIDIA card without CUDA 12 libraries → retry on the CPU (a VO line takes seconds there).
- **Local Chatterbox on an RTX 50xx:** Chatterbox pins torch 2.6, which has no sm_120 kernels → its own environment
  (`research/voice/voice_setup.py`) with torch 2.7.1 cu128 and Chatterbox installed `--no-deps`; never inside ComfyUI's Python.
  Kept out of the plugin (team rule, 2026-10-26): nothing that needs a GPU-specific install goes in the plugin, because
  most of the team works on Macs.

## 7. Repo hygiene
- All repo content is **English** (code, UI, docs, commits).
- LLMs read only `library/INDEX.txt` (~1 line per preset); HTML/GIFs are for humans.
- README GIFs: 400 px, 10 fps, 2.5 s, `hqdn3d` + 48-color palette → ~0.5 MB each even with film grain.
- Binary assets via Git LFS (`.aep`, `.mp4`, `.mov`, `.webm`, `.ttf`); temporaries (`_*.png`, `*_raw.mp4`, renders) are ignored.
- Windows console: `PYTHONIOENCODING=utf-8` (or ASCII-only prints) — `→` crashes cp1252 consoles.

- The preview pipeline re-renders **existing** previews too (text GIFs fall back to Arial when AE cannot see Inter Tight, a per-user variable font): after running it for a few new presets, restore the modified old GIFs/MP4s with `git checkout --` and commit only the new files.
- `make_library_mosaic.py` past ~70 presets: the inline ffmpeg filter graph hit the Windows command-line limit (WinError 206) and the 9-row grid had an odd height for libx264. The graph now goes in a file (`-/filter_complex`) and the grid is padded to even size.
- `pack_demos.jsx` / `queue_previews_and_styles.jsx` call `app.project.save()`: save the open project to `renders/_preview_build.aep` first, or they overwrite whatever project is open.
- Motion Style Map: reference videos stay out of git (`references/`, size and third-party rights); measure 60 fps sources on a 30 fps copy (per-frame thresholds depend on fps); continuous transitions don't count as cuts in the energy metric.
- Subagents can't write `.md` files in this environment: have them return the analysis text and write it from the lead session (never work around the block).
- **Outside resources:** Unity Labs CC0 VFX unpack as uncompressed TGA (372 MB of zips became 2.5 GB) → PNG keeps the alpha at ~1/9 of the size (272 MB), so `fetch_free_assets.py` converts them. Kenney audio ships OGG, which AE does not import → converted to WAV. Kenney particle packs repeat every sprite (black background, rotated, Unity samples) → the indexer skips the copies, and only runs of 60+ numbered frames count as an image sequence (`blackSmoke00-24` are 25 separate puffs).
- **Editing a UTF-8 file with PowerShell 5.1 `Get-Content -Raw | Set-Content` double-encoded every `·` and `…` (read as ANSI) and turned LF into CRLF** → edit repo files with Python (`read_text/write_text(encoding="utf-8")`) or the Edit tool, never `Set-Content`.
- Anonymous GitHub API calls hit the hourly rate limit after a research pass, and `gh` is not installed on this machine → `git clone --depth 1` into a scratch folder and read LICENSE files directly; release assets are listed at `github.com/<repo>/releases/expanded_assets/<tag>`. aescripts.com answers 403 to scripts: browse it in the browser pane.
- **A library item without its preview showed a broken image in the panel** (a style added without its demo) → the panel trusted that every file existed → every panel image now goes through `safeImg` (tries each source, then a named placeholder) and hover GIFs swap in only once loaded; `python tools/check_previews.py` (run by setup and `test_all.py`) lists what is missing.
- **Panel connectors (Agent › Connect):** `claude mcp list` names the same service three ways (`figma:`,
  `plugin:figma:figma:`, `claude.ai Krea:`) and a stale manual entry (`krea: … Needs authentication`) can sit next to a
  connected claude.ai one → match `^(claude\.ai |plugin:[\w-]+:)?<name>:` and call it connected if **any** line is
  connected; log in with the exact server name found (`claude mcp login "claude.ai Krea"`). Codex installs as
  `%APPDATA%\npm\codex.cmd`, which `execFile` only runs with `shell: true`. The Update check reads
  `git rev-list --count HEAD..@{u}` after `git fetch`; offline it fails → show "Update" (unknown), never "up to date".
- **The panel's Agent could not use Krea or Flora although both showed connected** → a headless run (`claude -p`) only
  calls the tools in `--allowedTools`, and the list had Figma but no generator → `FULL_TOOLS` lists
  `mcp__claude_ai_Krea`, `mcp__claude_ai_Flora` (and the hand-added `mcp__krea` / `mcp__flora`) plus `ToolSearch`
  (connector tools are deferred), and `NEVER` blocks the account tools (API tokens, trials, plans, LoRA training,
  sharing, deletes). Claude.ai connectors show `pending` in the init message and connect a moment later: check the
  tools a run actually called, not the init list. Generated media comes in with MCP `import_media` (URL → file →
  layer); Krea's `generate_video` with `preflight: true` gives the exact cost in compute units for free.
- **On a Mac the panel's Agent said the `motion-dna` MCP server "failed to connect (Executable not found in $PATH)"**
  → the panel started it with `python`, which macOS does not have (only `python3`, often in Homebrew, outside AE's
  PATH) → `pyExe()` in `panel/js/agent.js` picks the first python3 that exists on macOS. The same report showed Safe
  mode asked to read Figma: Safe has only the Motion DNA tools, Figma needs Full. A review for macOS found more:
  AE starts with a bare PATH (no Homebrew, no `~/.local/bin`, no `node` for npm-installed `codex`/`claude`) → the panel
  prepends them to `process.env.PATH`; Connect's Terminal window broke on the quotes in `mcp login "claude.ai Krea"`
  (AppleScript string) → every Terminal launch goes through `macTerminal()`, which escapes `\` and `"`; `findClaude`
  now looks in `~/Library/Application Support/Claude/claude-code`, `~/.local/bin` and Homebrew; the repo's `.mcp.json`
  says `python`, so `setup.py` registers `motion-dna` for the clone in Claude Code's local scope (which wins) with its
  own Python's absolute path wherever `python` is missing.
- **Review of the install/update path once teammates were using it** (three independent reviews, each finding
  verified before fixing):
  - `setup.py --update` crashed after the pull on Python < 3.12 (macOS ships 3.9): `os.path.isjunction` is 3.12+ →
    `is_junction()` reads the reparse-point flag. The pull had already happened, and the installed panel is a shell
    that loads its code from the clone, so Reload panel still got the new code; the rest of setup did not run.
  - The panel was deleted before the new one was extracted → it extracts next to it and swaps.
  - An update ran the old installer from memory → after a pull that changed `setup.py`, it runs the new one.
  - `codex.cmd` with `shell: true` split `D:/motion category ai library/…` into words and still reported success →
    run it through `cmd.exe /d /s /c` with each argument quoted (`windowsVerbatimArguments`), and trust
    `codex mcp list`, not the exit code. `where codex` lists the extensionless npm shim first → take the `.cmd`.
  - The first Full-mode message waited ~8 s for `claude mcp list` with Send still enabled → a second Enter started a
    second paid run; the panel is busy from the first moment now, and the generator check waits 3 s at most.
  - `import_media`: names with `%20` or `:` broke the file (unquote and sanitise), HTML error pages were "imported"
    (refused), downloads had no size cap (streamed to a `.part`, 2 GB), python.org's Python on macOS has no CA
    certificates (curl fallback).
  - The Python setup ran with is written to `panel/.python` (git-ignored); the panel uses it, never the Store stub.
- **`tools/record_cep_panel.py` stand-ins are JS inside a Python string:** a `'\n'` became a real newline and broke the
  injected script silently (the sheet never rendered) → write `'\\n'` in the Python source, and check the page console
  when a recorded scene comes out blank.

### Open-source web libraries rendered as video (tools/web_capture.py, 2026-10-26)
- **Real-time libraries (tsParticles, Pixi, p5, three.js) rendered frame by frame:** Playwright's clock: `install`
  before loading, `pause_at` once the page is ready, then `run_for(1000 / fps)` per frame, with `Math.random` seeded
  by an init script. Two traps: `wait_for_function("window.MATTE")` CALLS the function when the expression is one (use
  `typeof window.X === 'function'`), and `evaluate("window.FX_START()")` waits for the promise it returns, which never
  settles while the clock is paused (call it inside an arrow that returns nothing).
- **tsParticles sizes its particles for a screen:** at 1080p confetti read as dust (scalar 3.2) and fireworks as
  specks (draw the canvas at 1/3 and let CSS scale it up).
- **three.js ACES tone mapping washed the spark green to cream** → `NeutralToneMapping` keeps the token colours.
- **Rapier: `world.createCollider(desc, body).setRestitution(…)` throws** (a Collider's setters return nothing) → set
  restitution and friction on the `ColliderDesc` before creating it.
- **gl-transitions as AE mattes:** render each shader from a black texture to a white one; the frame is the mix map.
  Of 125 shaders, 49 give a hard-edged wipe and 25 a soft one; 41 are only a dissolve as a matte (they warp or recolour
  the pictures), 10 need the images or extra textures. A matte layer that ends turns the matted layer invisible:
  time-remap it so its last (white) frame holds.
- **HyperFrames registry components are timed in three places:** the root's `data-composition-duration`, the template
  root's `data-duration` and the inner `.clip`'s `data-duration`. Retiming only the first two left the inner clip at
  1.2 s and the incoming scene blank → change all three (or place the host at the transition's time and keep the
  component's own length). Their `check` also reports craft issues ours does not yet: a line on screen for less than
  0.5 s + 0.3 s a word.

## 8. Costs observed (Flora, USD)
| Item | Cost |
|---|---|
| Office views regenerated from office_wide (Nano Banana 2.1 image-to-image, 4K, 8 variants) | 0.632 |
| Office reverse angle: 2 variants with the master + close-ups as references, then 2 clean-up edits (Nano Banana 2.1, 4K) | 0.316 |
| README banner, 80s software-box poster: 3 variants at 21:9 with the props box as reference (Nano Banana 2.1, 4K) | 0.237 |
| README banner, synthwave version: 2 edits of variant 3 (new tagline, helix behind the box) | 0.158 |
| Nano Banana Pro still (2K) | 0.18 |
| Kling 3.0 Pro, 5 s 1080p | 0.706 |
| VEED background removal (5 s) | 0.135 |
| ElevenLabs Music (20–26 s) | 0.36 |
| ElevenLabs v3 VO line | 0.121 |
| ElevenLabs Multilingual v2, full 56 s read in one take | 0.121 |
| Nano Banana 2.1 colorize a reference photo | 0.035 |
| Nano Banana 2.1 still (2K) | 0.053 |
| Nano Banana 2.1 still (4K, comes back 5504x3072 JPEG) | 0.079 |
| Production components: 28 sheets (locations, characters, props) + 4 car test stills, 4K | 2.528 (2 more failed upstream, not charged) |
| MiniMax H3 Max, 5–6 s 768p | 0.48–0.58 |
| Seedance 2.5, 5 s 1080p | 6.05 (estimate said 2.48) |
| Seedance 2.5 r2v, 15 s 720p, 6 reference images | 7.325 (quote said 7.45) |
| Seedance 2.5 r2v, 15 s 720p, 9 reference images + 1–2 voice references (`audio_urls`) | 7.325 (quote 7.45); 12 s = 5.861 (quote 5.96); 8 s = 3.922 (quote 3.97) |
| Seedance 2.5 r2v, 8 s **1080p**, 4 reference images (keyframes as "reference image 1-4"), ~8 min | 9.648 (quote 9.775) |
| Nano Banana 2.1 is2i still, 2K 16:9 (teaser storyboard fixes and new close-ups) | 0.053 each (22 charged; failed runs are free) |
| ElevenLabs v3 voice line on Flora (`t2a-elevenlabs-tts-v3`) | 0.121 each; ElevenLabs Music 0.36 |
| fal `fal-ai/elevenlabs/tts/eleven-v3` (list price 0.10 / 1k characters) | ≈ 0.01 per short line (9 lines ≈ 0.04) |
| fal `elevenlabs/music/v2.5` (0.60 / min), 102 s teaser track | ≈ 1.02 |
| fal `fal-ai/kling-video/v2.5-turbo/pro/image-to-video`, 5 s 1080p (1928x1072) | 0.35 list price (3 clips ≈ 1.05) |
| fal `resemble-ai/chatterboxhd/speech-to-speech` (voice conversion) | 0.02 / min (13 lines ≈ 0.02) |
| fal `fal-ai/sync-lipsync/v2`, 5 s | ≈ 0.25 |
| fal `fal-ai/elevenlabs/sound-effects/v2` (0.002 / s) | ≈ 0.03 for 5 effects |
| fal `fal-ai/kling-video/v2.6/pro/image-to-video` with audio, 5 s | 0.35 (audio unusable) |
| fal `fal-ai/kling-video/v3/pro/image-to-video` with audio, 4 s | 0.56 (the one used) |
| fal `fal-ai/kling-video/o3/pro/image-to-video`, 4 s | 0.56 |
| fal `minimax/h3-max/reference-to-video`, 1080P (0.05 / s) | ≈ 0.25 (clip came back 2.2 s) |
| fal Kling 2.5 turbo pro, six R4 plates, 5 s each | ≈ 2.10 |
| fal `elevenlabs/music/v2.5`, 102 s 1985 commercial track | ≈ 1.02 |

- **fal Seedance rejects our fictional characters** (`content_policy_violation` on `bytedance/seedance-2.5/reference-to-video`
  with the character sheets as references; the likeness filter does not know they are generated) → animate each shot from
  its approved still with Kling image-to-video on fal (one clip per shot, no dialogue) and lay the ElevenLabs VO over it.
  The look stays consistent because every still already came from the sheets. fal downloads: use `curl` (Python's
  urllib hit an SSL certificate error on Windows).

- **Flora accepts a batch, then runs fail with `BILLING_WORKSPACE_MEMBER_USAGE_LIMIT_EXCEEDED`** (the create call returns
  `ok: true` with a run id for every item; a few seconds later most runs are `failed`, one or two may still complete and
  bill) → poll every batch before assuming outputs exist, stop launching once one run reports the limit, and ask the
  workspace admin to raise it; failed runs are not charged.
| *The 1974 Boardroom* v3 total (3 stills, 3 clips, 3 mattes, 3 music tracks, 6 VO lines) | ≈ 5.24 |
| Krea Seedance 2.5 r2v, 6 s **1080p**, start image + 1 image + 1 voice reference (T02 opening) | 2,527.2 compute units (Krea enterprise; no USD rate published) |

## 9. Code-rendered video templates (research/video_prompts)
- **A page that animates with timers or the real clock renders differently on every machine** → templates draw each
  frame as a pure function of time (`MDNA.scene({render(t)})`, random only through a seed) and the renderer calls
  `MDNA.frame(t)` per frame before the screenshot: frame N is always the same picture.
- **The first templates read as "basic" next to the Opus remakes** → what the remakes had: content density (kickers,
  meta text, real numbers, several layers at once), a finish (grain, glow, vignette, light), type hierarchy (tracked
  kicker + sans headline + serif-italic accent) and illustration (counters, corona, an illustrated poster). The runtime
  now ships `finish`, `glow`, `rich` and `kicker`; check templates on a `snap.py` sheet before rendering.
- **The Skillry remakes are MP4 only (no code to recolour)** → compare form, not colour: a Hald CLUT gradient map
  (luminance → ink, pine, sea, mint, spark, cloud) puts the remake in our palette next to our render (`compare.py`).
- **Motion blur by averaging 3 screenshots per frame took ~17 min for 15 s and ghosted discrete swaps** (two words at
  once on a beat) → blur only continuous moves; next, accumulate sub-frames inside the page instead of in Python.
- **`glow()` drew at full strength inside a faded group** (it set `globalAlpha` itself) → multiply by the current
  alpha. **`FootageItem.hasAlpha` does not exist** → read `item.mainSource.hasAlpha`.
- **`add_asset` only places indexed assets** → renders go into AE with `research/video_prompts/ae/import_render.jsx`.
- **A curve to AE keys: `setTemporalEaseAtKey` wants one ease per dimension of the property** (Scale is 3D on a 2D
  layer even when you key 2 values) → count the property's value, not the value you pass.
- Third-party prompts and remakes stay in `source/` (git-ignored, `fetch_sources.py`); the index keeps only metadata.
- **Two renders of the same template ran at once and wrote the same MP4** (a background chain that `wmic … terminate`
  did not stop, plus a new one) → before re-rendering, list the processes (`Get-CimInstance Win32_Process` with
  `html_to_mp4`) and stop the old one, or render to a new file name; a shared output is corrupt even if both finish.
- **Captions ran past their card in the tutorial** → `research/video_prompts/text_check.py` hooks `D.txt`/`D.rr`, samples
  the frames and lists every visible text that leaves the safe area or overflows the card under it. Run it before
  every render, with a `snap.py` sheet for centring.
- **The templates themselves looked mediocre once someone looked closely** (a leaf's veins drawn outside the leaf, words
  overlapping on a swap, an end card drawn over a fading dashboard, a sun glowing through the sea, a ray-marched shape
  tearing open, a 9 px final frame) → a strict designer QA pass on every template, at 0.5 s steps plus every transition,
  with full-size crops, then fixes. The recurring causes, now rules for every new template:
  - draw details inside their container with `g.clip()` (veins, illustrations, glows, sun light below a horizon);
  - text ≥ 24 px at 1080p (`kicker()` enforces it), measured masks, nothing cut by the frame unless meant;
  - no empty first frame and no dead static hold at the end: start moving, end on a slow push and a clean resolve;
  - a click must cause the visible change at that moment; a cursor that drags must be locked to what it drags;
  - transitions are designed (a match, a carried wipe), never a hard branch switch; one-sided dissolves on the art's grid;
  - mix colours in OKLab (RGB sea→cloud goes grey); `glow(…, light)` and `finish({light:true})` on light backgrounds;
  - a mix of two signed distance fields is not a distance field: morph with `smin` or sizes inside one field;
  - loops: drive every cycle from `t / duration` with whole cycles, and compare the last frame with the first;
  - `text_check.py` only sees `D.txt`: check `rich()` lines by eye.
- **The README previews looked dated and broken** (a black infinite zoom, banding on gradients, a "slideshow") while
  the renders were fine → the GIFs had 24-40 frames for 12-15 s (about 3 fps), 320 px and a small palette, and some
  started on an empty stretch → `make_previews.py` builds animated WebP from the full renders (480 px, 15 fps, full
  colour, alpha laid over the pine) and each catalog card can set `"preview": [start, end]` for its best stretch; all
  15 stay under 500 KB. GitHub shows animated WebP in a README like a GIF.
- **A template that reads repo data hung on "MDNA_READY"** (t14 loads `library/characters/<slug>/character.json`) →
  the renderers open pages as `file://`, and `fetch` refuses that scheme even with Chromium's
  `--allow-file-access-from-files` → load data with `XMLHttpRequest` (which the flag allows); `html_to_mp4.py`,
  `snap.py` and `text_check.py` pass the flag. In a normal browser, preview such a template through
  `python -m http.server`.
- **Pixel-art characters stay crisp only if nothing is anti-aliased** → `runtime/pixel_rig.js` rasterizes each
  primitive itself (pixel-centre tests), squashes and leans the whole sprite with nearest-neighbour sampling, outlines
  after posing, poses on twos, and the world is drawn at 240x135 then scaled x8; a preview GIF at exactly 2x (480 px,
  `flags=neighbor`, 10 fps, 32 colours) stays under 500 KB. The `rich` serif italic runs wider than its size suggests:
  measure the right edge of a closing line before rendering.
- **A character drifts when its sheet is drawn apart from the videos** → the character sheet is rendered from the same
  `character.json` the videos use (`t14_pixel_character.html?sheet`). The Figma expression sheet of the teaser robot
  shows an older, boxier body: use it for the six expressions only; the turnaround is the canonical body.
- **A second slide showed behind the demo comp in the tutorials' AE viewer** (Gian: "has a green solid on top of it and
  is duplicating the card") → the workspace PNG was exported from the Figma `TUT / AE workspace` component with its
  teal `comp` placeholder rectangle still on → a workspace plate that frames a live comp must have an empty, solid-gray
  viewer; hide the placeholder in the component before exporting. After replacing a footage file at the same path,
  reload it in AE (`item.mainSource.reload()`).
- **Tutorial screens went stale when the panel changed** (Gian, 2026-10-22: "make sure you are using the new UI") →
  the AE builds used PNG exports of the Figma screens, which lag the code → capture the panel itself: run
  panel/index.html in its browser preview mode with the Node stand-ins of tools/record_cep_panel.py (Playwright,
  device_scale_factor 2.2 for the 880 px dock PNGs) and read each element's box from the DOM for the highlights.
- **"Illegal use of reserved word" in an AE builder** → an object key named `with` (ExtendScript is ES3: reserved words
  cannot be bare keys) → rename the key, or quote it.
