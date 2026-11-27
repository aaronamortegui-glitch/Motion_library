# Motion DNA in Premiere — spike (2026-11-27)

Phase 1 of `docs/PREMIERE_PLAN.md` (in the main clone): can Claude drive Premiere through a UXP plugin, and do the
Motion DNA curves survive? Branch `premiere-beta`, nothing here is installed by `setup.py`.

## How it is wired
```
Claude / scripts ── HTTP 127.0.0.1:8738 ──► helper.py ◄── WebSocket 127.0.0.1:8737 ── UXP plugin in Premiere
```
- `plugin/` — UXP plugin (manifest v5, `premierepro` ≥ 25.6). Panel *Window › UXP Plugins › Motion DNA (spike)*.
  Connects to the helper, reconnects every 2 s, runs each job as an async function `(ppro, uxp, require)`.
- `helper.py` — standard-library Python: WebSocket server for the plugin, HTTP `/call` and `/status` for callers.
  Several Premiere versions can be connected at once; `target` picks one by version prefix (`26`, `27`).
- `ppro.py` — CLI: `python ppro.py --status`, `python ppro.py -f job.js --target 26`.
- `spike/` — the tests (`t0_status.js`, `t1_mogrt.js`, `t2_bake.py`, `t3_frames.js`, `t4_import.js`).
  Their output (projects, JSON, frames) goes to the git-ignored `spike/_projects/`.

Install (Windows): **Creative Cloud desktop must be running**, then
`UnifiedPluginInstallerAgent.exe /install dist\motion-dna-premiere-spike.ccx` (or double-click the .ccx). Without
Creative Cloud running, UPIA fails with status -642. A reinstall of the same id loads only after Premiere restarts.

## Results
| Test | 26.5.2 | 27.0.0 |
|---|---|---|
| Plugin loads, connects, runs code (`allowCodeGenerationFromStrings`) | ✅ | ✅ |
| Both versions connected to one helper at the same time | ✅ | ✅ |
| Create project, sequences at 23.976 / 25 / 29.97 | ✅ | ⏳ `createProject` hung (a dialog in 27?) — not retested |
| Insert a MOGRT (`insertMogrtFromPath`) | ✅ | ⏳ |
| MOGRT controls (text, colour) by script | ⚠️ only **After Effects-authored** MOGRTs expose them; Premiere's "Basic Title" shows only Motion/Opacity | ⏳ |
| **Baked keyframes on the token curve** (Land, Arrive 467 ms, Position) | ✅ **0.0 px error on every frame** at 23.976, 25, 29.97 | ⏳ |
| Two keys + `InterpolationMode.BEZIER` ("simple" mode) | ❌ comes out **linear**: ~860 px off the Land curve at frame 3 | ⏳ |
| Read values back (`getValueAtTime`) | ✅ | ⏳ |
| Import a still, overwrite it onto V2 | ✅ (rules below) | ⏳ |
| Export still frames for Claude to look at (`exportSequenceFrame`) | ✅ ~15 ms a frame (rules below) | ⏳ |
| `.prfpse` effect presets with tangents | not tested (needs a preset saved by hand) | — |

Frames 0 / 2 / 4 / 8 / 12 of the 25 fps test card show the Land curve: off-screen, x≈0.25, 0.40, 0.49, centre.

## API rules learned (each one cost a failed call)
1. **Paths are not consistent on Windows.** `importFiles` needs **forward slashes** (backslashes are dropped:
   `D:motion…` and a modal *File Import Failure*). `exportSequenceFrame` and `createSequenceWithPresetPath` need
   **backslashes** (with `/` they return `false` / "Preset file is invalid" and write nothing). One path helper per call.
2. **Modal dialogs block the plugin.** A failed import opens a dialog even with `suppressUI: true`; every later call
   waits until someone clicks OK. Check the file exists (`fs.lstatSync`) before importing; time out fast and say so.
3. **Keyframe times are clip time, not sequence time.** A MOGRT clip starts at its in-point 01:00:00:00 (3600 s):
   add `getInPoint()` to every keyframe time.
4. **Actions must be created inside `project.lockedAccess`**, then run with `executeTransaction`; creating them
   outside throws "Requires locked access".
5. `createOverwriteItemAction` takes the plain **ProjectItem** from the bin (not `ClipProjectItem.cast`), audio track `-1`
   for a still.
6. `createSequence(name)` makes a 23.976 default; set the rate with `settings.setVideoFrameRate(FrameRate.createWithValue(fps))`
   + `createSetSettingsAction`, or use a preset path with backslashes.
7. To clear animation: `createSetTimeVaryingAction(false)` then `(true)`.
8. Only After Effects-authored MOGRTs expose their controls (`MogrtText`, colours) — Adobe's changelog says so. On
   26.5.3 they show too (26.5.2 in the first spike showed none: the controls load a moment after insert).

## What this changes in the plan
- **Baked keys are the curve route** (exact); the "simple" two-key mode is dropped — the API cannot ease.
- **The kit's MOGRTs must be authored in After Effects** (`tools/build_mogrts.jsx`), which also makes their text and
  colours editable from Claude. Next spike step: export one Motion DNA title as a MOGRT from AE and set its text and
  colour from Premiere.
- The real plugin exposes **named commands with the rules above built in**, not free JavaScript.
- Repeat these tests on every new Premiere version (27 is already on this machine).

## The MCP: `motion-dna-premiere` (`mcp_premiere.py`)
Registered in this branch's `.mcp.json`. It works on **whatever project is open** in Premiere (2026+), starts the
helper by itself, and builds in every rule above. Tested end to end on Premiere 27.0.0 with the user's own project:

| Tool | What it does | Tested |
|---|---|---|
| `ppro_status` | connected versions, project, sequences | ✅ |
| `create_sequence` / `open_sequence` | 1080p at any fps (presets with backslash paths) | ✅ |
| `list_clips` | tracks, clips, times | ✅ |
| `import_media` | file or Flora/Krea URL → bin (created if missing); file checked first | ✅ |
| `place_clip` | overwrite/insert a project item on a track | ✅ |
| `animate` | one property on a token curve, baked | ✅ |
| `list_presets` / `apply_preset` | the 37 portable Motion DNA presets (position, scale, rotation, opacity), in/out/both, duration and intensity multipliers | ✅ Drop Bounce: 46 keys, falls, lands frame 9, bounces |
| `add_mogrt`, `mogrt_params`, `set_mogrt_text`, `set_mogrt_color` | AE-authored MOGRTs: read and set their text and colour | ✅ on 27 (the controls load a moment after insert) |
| `reformat_sequence` | 16:9 → 9:16, 1:1, 4:5, 4:3, 21:9 or WxH: duplicates the sequence, sets the frame size, re-fits every clip (keyframes included); footage fill/fit/keep with a focus point, MOGRTs fit | ✅ `MDNA 9x16 d`, original untouched |
| `render_frame` | exports a frame and returns the image | ✅ footage; ⚠️ see below |
| `run_script` | raw UXP JavaScript with the shared helpers | ✅ |

More rules from the MCP tests:
9. **Objects go stale after every edit** ("The script object is no longer valid"): look the sequence and clips up again
   after each transaction, read all values first, and create the actions *inside* the transaction callback.
10. `exportSequenceFrame` **does not draw graphics**: Premiere titles and AE MOGRTs come out transparent; footage and
    stills render. `render_frame` cannot check titles yet (next: export a short range through `EncoderManager`).
11. A clip's MOGRT controls (`AE.ADBE Capsule`, "Graphic Parameters") appear a moment after `insertMogrtFromPath`.
12. After Effects writes `exportAsMotionGraphicsTemplate` into a **folder** named like the path, and only when the AE
    project has been saved (otherwise it waits on a save dialog).
13. `reformat_sequence` treats every non-MOGRT clip as footage: a small still is scaled like full-frame video. Next:
    per-track modes, or detect the clip's size.

## Real footage test (2026-11-27, Premiere 27)
`MDNA edit 16x9` (23.976 fps): two clips (Aaron, Gian) from `media/faceswap/out/`, a speed ramp on the second, an
animated Motion DNA headline on top; then `MDNA edit 9x16 text`, the vertical version made by `reformat_sequence`.

| Tool | Result |
|---|---|
| `speed_ramp` | Premiere's API has **no time remapping** (no component, `getSpeed` is read-only). The ramp is rendered for that clip only (ffmpeg, frame-blended slow part): 1x → 0.25x on **Land** (0.5 s), hold 1 s, back on **Ramp**; 5.17 s → 6.42 s; placed over the original in `Motion DNA renders/` next to the project. No audio yet. |
| `reframe_follow` (+ automatic in `reformat_sequence`) | `track_subject.py`: Haar face detection re-anchors an OpenCV MIL visual tracker every 3 frames (hands over the face, caps, head turns), jumps of more than 12 % of the width in under 1 s are refused (lamps and mics were caught as faces), 5-sample median, then a critically damped spring with a dead zone (the crop settles like the Settle curve, no jitter). Position keys keep the person centred and never show the clip's edges. Gian: 52/52 samples, centred on every checked frame. |
| `MDNA Headline` MOGRT | Built in AE: Chars Rise in/out from the library, responsive text — **Text width %** (share of the frame width) and **Max size** (0–100 = a 0–200 % scale cap) drive a Scale expression. Premiere shows its 4 controls; text set from the MCP. |
| Responsive text in `reformat_sequence` | MOGRT fit to the new width; **Text width %** → 86 (9:16) / 80 (1:1, 4:5); size cap raised by as much as the clip shrank. |

More rules:
14. **MOGRT sliders stop at 100 in Premiere** (a value of 178 reads back as 100). Kit sliders must be 0–100 and scaled
    inside the expression.
15. The EGP name stays what `addToMotionGraphicsTemplateAs` gave it, even if the effect is renamed later.
17. Manifest `network.domains` must be `"all"`: a list (even only `ws://127.0.0.1:8737`) makes the plugin's
    WebSocket fail with "TypeError: URL is not a constructor" (Premiere 27). The plugin only ever opens localhost.
16. Gaps: placing a clip at a fixed time after another leaves a frame or two at 23.976; place at the previous clip's end.

## Premiere on its own (no After Effects for users)
Everything above runs in Premiere alone except **making** MOGRTs. After Effects is only the factory: the Motion DNA
text and graphics kit is authored once by maintainers (`tools/build_mogrts.jsx`) and shipped as `.mogrt` files in
`library/mogrt/`. Premiere plays After Effects MOGRTs without After Effects installed, so an editor needs only
Premiere, the plugin and the MCP. The kit to build from the library: every text preset (Chars Rise, Words Fade Up,
Blur Words, Tracking Settle, Chars Pop, Typewriter, Scramble, Count Up, Chars Ramp, Words Slam, Chars Blur), lower
thirds, captions, counters, and the transitions and looks that need effects — all with responsive text controls.

## Install for anyone (tested 2026-11-27, Windows, Premiere 27)
`python tools/setup.py` runs `install_premiere.py` when Premiere 2026+ is installed (or run it alone; `--check`,
`--mcp-user`, `--uninstall`). It packs `plugin/` into `dist/motion-dna-premiere.ccx`, starts the Creative Cloud app if
needed, removes the spike build, installs with UPIA, verifies it in UXP's plugin list and registers the MCP. Then the
person restarts Premiere and opens Window › UXP Plugins › Motion DNA once. `ppro_status` / any tool explains in plain
words what is missing when not connected. Skill: `.claude/skills/motion-dna-premiere/`. Mac: written, not tested.

## Titles that export (solved 2026-11-27)
18. **Text set through the API (`MogrtText.setText`) shows in the monitor but every export drops the title** (Premiere
    and Media Encoder). Untouched MOGRTs export; colour and slider values set through the API export too. Only text.
19. `definition.json` defaults are ignored for rendering; Premiere renders what is in `project.aegraphic` (a zip with
    the AE project, binary RIFX — do not patch it: AE keeps per-glyph layout there).
20. **Fix: data-driven kit titles.** The AE template packs a CSV (`(Footage)/headline_data.csv`, column `text`) and
    its Source Text expression reads it (falling back to the typed text). `mogrt_stamp.py` writes the new text into that
    CSV in a copy of the template, with its own capsuleID; `add_title` inserts it untouched, then sets colour/sliders
    through the API. Exports show the text, animated (Chars Rise), in every format.
21. An export right after a project is first created can miss MOGRTs until the project has been saved once.
22. Full-frame footage presets (Glide In…) showed the clip's edges: `apply_preset` now overscales just enough
    (x1.326 for Glide In) so no edge shows during the move.
23. Titles avoid faces: the tracked point is the chin; kit titles go below it (16:9 y 0.86, 1:1 0.84, 9:16 0.74 inside
    the feed safe box) or above the head when the person is low (9:16 "One look" over Gian's cap).
24. Music alone is levelled to -14 LUFS (file measured with ebur128); under a voice it sits 16 dB lower. Peak came out
    -1.0 dBFS: aim a little lower for the feed's -1.5 dB true peak.
25. Premiere's export (`IMMEDIATELY`) is the default; Media Encoder is optional (`queue`), and
    `EncoderManager.startBatchEncode()` returned true without starting AME's queue.

Result: `MDNA promo v3` 16:9 / 9:16 / 1:1 (two people, Glide In chosen by tags, kit titles, speed ramp, music at
-14.3 LUFS), built and exported by Claude with no manual step.

## Panel and test (2026-11-27, plugin 0.3.0)
- The panel follows the After Effects panel's UI (`panel/css/panel.css`): the still DNA helix as the mark (drawn by
  `make_helix.py` with the same formula as `helixDraw` in `panel/js/app.js`, since UXP has no dependable canvas),
  Claude / Project pills (muted · spark · coral), the helix spinning next to whatever Claude is running (labels come
  from the MCP tool, in plain words), `.btn` buttons, the same tokens. It says plainly that it is driven from Claude's
  chat and lists prompts to copy. People's guide: `GUIDE.md`.
- `test_premiere.py` (Premiere open, panel connected): **19/19 passed on Premiere 27.0.0 and on 26.5.3** with the Aaron and Gian clips
  (`--footage`; without footage it makes synthetic clips). Its title check counts near-white pixels in the title band;
  footage with white clothes there can pass without a title: look at one frame when in doubt.
- Glide In's edge guard (x1.326) makes the first shot noticeably tighter: a preset that starts smaller than the
  frame should rather start from the frame size on footage (next).

## Part 2: project, assets, effects, colour, masks (ppro_extra.py, 2026-11-27, tested on 27.0)
Tools: `organize_project`, `collect_project`, `export_interchange` (otio / fcpxml / aaf), `merge_project` (.prproj or
.aep live), `add_placeholder`, `add_generated` (provenance marker, replaces a placeholder in place), `add_voice` (level
+ music ducking + channel fix), `add_animation` (code templates rendered by html_to_mp4.py, MOV/PNG sequence, .aep),
`list_effects` / `add_effect` / `remove_effect` (115 effects), `add_transition` (118; by name or energy, token
durations), `add_markers` / `beat_markers`, `list_looks` / `apply_look` (looks.json), `list_lumetri` / `lumetri`
(every exposed parameter, animatable on token curves), `color_wheels` (Levels per channel), `add_mask` (shape or
person matte + Track Matte Key). All checked on `MDNA full test` with exact frames.

26. Effects: `VideoFilterFactory.createComponent(matchName)` + `chain.createAppendComponentAction`; remove with
    `createRemoveComponentAction`. Lumetri is `AE.ADBE Lumetri` (130 params on 27.0).
27. **Lumetri through the API**: numbers, booleans and colours are writable (Basic, Creative adjustments, HSL Secondary,
    Vignette); **curve points, colour-wheel values and custom LUT files are not** (blobs); Look / Input LUT are indices
    into Premiere's built-in lists. The section booleans ("Light", "Creative"…) are the panel's open/closed state, not
    an on/off: values apply either way. Names repeat (Saturation ×3, Temperature ×2…), so tools address them as
    "Section/Name".
28. Colour wheels instead: `PR.ADBE Levels` per channel (R/G/B black input/output, white input/output, gamma).
29. Masks: no mask-path API. A matte clip on the track above + `AE.ADBE Legacy Key Track Matte` with **Matte = track
    number (1-based)** and **Composite Using 1 = luma, 0 = alpha**; Premiere then hides the matte track.
30. `exportSequenceFrame` skips titles **and track mattes**: `render_frame` now renders through the exporter (a
    two-frame in/out, restored after; ~1 s), so Claude sees what the MP4 will show.
31. Audio volume components are named per layout ("Internal Volume Mono/Stereo/…"): match `^Internal Volume`; Level
    is param 1, linear gain with 0 dB = 0.1778.
32. Transitions: `TransitionFactory.createVideoTransition(match)` + `new AddTransitionOptions()` (`setApplyToStart`,
    `setDuration`) + `trackItem.createAddVideoTransitionAction(tr, opts, true)`.
33. Markers: `Markers.getMarkers(seq).createAddMarkerAction(name, "Comment", start, duration, comments)`.
34. `exportAAF` writes the file but its promise may never answer: check the file instead.
35. `importFiles([".prproj"])` merges a whole project into a bin; `importAllAEComps(aep, bin)` brings AE comps live.
36. `saveAs` makes the copy the open project (collect_project says so); `changeMediaFilePath(path, true)` relinks.

## Not done yet
- The first frame is black on purpose (Glide In fades in from black); the repo's blackdetect rule flags it.
- The plugin still runs free JavaScript from the helper (spike mode): move to named commands.
- The panel UI (Moves, Text, Format, Speed, Music, Export, Agent) in a UXP WebView with the library's previews.
- ~~Confirm by eye that the AE title shows~~: confirmed 2026-11-27 in Premiere 27's Program monitor, "Hecho con Claude"
  with the text and colour set from the MCP. Frame export still cannot show titles.
- A Motion DNA MOGRT kit built from AE (`tools/build_mogrts.jsx`): titles, lower thirds, counters, transitions.
- `.prfpse`: whether saved effect presets keep custom tangents.
- Mac: paths and the install route.
