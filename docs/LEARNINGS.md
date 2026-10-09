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

### Rendering
- `aerender` **hangs** when the project contains layers with Animation Composer presets (the plugin waits for UI). Use the open AE's render queue: `tools/render_comps.jsx` / `tools/render_queue.jsx`.
- **Prefer `aerender` now that the project has no AC layers**, one process per comp in parallel: `aerender -project <abs .aep> -comp CYPHER_EDIT -OMtemplate "H.264 - Match Render Settings - 15 Mbps" -output <abs .mp4> -mfr ON 100`. The 32 s Cypher edit took **50 s** this way, while the in-app queue sat 40 min at half the file. Paths must be absolute (`cygpath -aw`). It renders the *saved* project, so save after a build.
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

## 2. Animation Composer as a behavioral reference
- Presets are encrypted (`.mhcitem`/`.mhitemdata`). We never decrypt or modify the plugin, and we never enable CEP debug modes.
- Architecture (observed in AE): a preset creates **no keyframes**. Properties get the expression `getAnimationComposerPresetValue()`, driven by pseudo-effects `MHAC PrCtrl <CODE> <ver>` (`AC IN`, `AC OUT`, `AC FX`) whose parameters are the recipe (offset, angle, bounces, scale; FX = frequency/range/time offset), plus `TR In`/`TR Out` markers.
- So: sample the **evaluated value** frame by frame (`valueAtTime(t, false)`), fit a bezier (`tools/fit_samples.py`) and store a recipe (`tools/harvest_to_library.py`). Loops are stored as amplitude + frequency (FFT).
- There is no scripting API to apply presets; automate the UI instead (`tools/ac_driver.py`, double-click per thumbnail) with the harvest station logging each one.
- Real transitions measured: entrances 12–17 frames, exits 13–20, typical overshoot ~5%, exits often with anticipation. Our tokens were calibrated with this.
- The asset packs (grain, light leaks, VHS, UI SFX) are plain files and usable directly.

## 3. AI footage (Flora)
- **Consistency across shots:** generate one **master** two-shot with both identity photos, then generate each close-up with `[master, identity photo]` as references ("same scene, lighting, wardrobe as image 1"). Set, wardrobe and light stay consistent.
- Kling 3.0 Pro image-to-video (5 s, 1080p) gives handheld motion that is great for tracking; expect push-ins and objects leaving the frame.
- Kling outputs **1928×1076** at 24 fps → normalize to 1920×1080 before anything else (`scale=1920:1080,fps=24`).
- VEED background removal **fails on the raw Kling URL** ("failed to preprocess input video"); upload the normalized 1080p file and use that URL. Output is VP9 with alpha at a different size → convert with `ffmpeg -c:v libvpx-vp9 -i matte.webm -vf fps=24,scale=1920:1080 -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le matte.mov` (the `-c:v libvpx-vp9` *before* `-i` is required to keep alpha).
- Local files → Flora: `flora_create_asset(source="signed-url")` then `python tools/signed_upload.py <file> '<upload json>'`, then `flora_complete_asset`.
- Music: ElevenLabs Music follows duration and structure from the prompt ("26 seconds… breakdown at second 15…"); design the edit to the BPM (96 BPM → 8 beats = 5 s = one shot).
- Use blank labels / fictional brands in prompts ("whisky bottle with a blank cream label") so overlays can carry fictional data.

## 3b. Keeping real people's likeness (The 1974 Cypher)
- **Identity references = real photos only.** Using earlier AI shots of the same person as extra references compounds drift (the Boardroom close-ups had already made both collaborators slimmer and younger; reusing them made it worse).
- **Describe the person's traits in the prompt** (age, build, face shape, beard, hair texture, eyelids, nose) and say "same age, not idealized". Models default to a younger, more handsome actor.
- **Wardrobe can break a likeness.** One collaborator stopped reading as himself with a flat cap plus aviators on the face; a cap like the one in his real photo, with the glasses hooked on the collar, fixed it instantly.
- **Never pass the old master as a reference when fixing faces**: the model copies its faces. Build the new master from real photos + approved close-ups, and describe the scene in text.
- **Nano Banana 2.1 (`is2i-elote-gateway`) kept likeness better than Nano Banana Pro** in our tests, even with glasses, at ~USD 0.05 per image; `thinking_level: HIGH`.
- **QA before spending on video:** `python tools/face_check.py --ref <real photo> --out sheet.png <stills or clips>` puts every detected face next to the real one. Run it on stills, then again on the generated clips.
- **Video models, same shot and prompt (orbit around a face):** Seedance 2.5 (`i2v-gengateway-seedance-2-5-i2v`, 1080p) kept the face *and* the background consistent with a real orbit, but billed **USD 6.05** for 5 s (the estimate said 2.48). MiniMax H3 Max (`i2v-minimax-h3-max-gateway`, 768p, ~USD 0.48, ~15 s) kept the face but the background drifted; upscale to 1080 with lanczos + light unsharp. Kling 3.0 Pro is fine for shots without faces. Use Seedance for the hero face shot, MiniMax for the rest.
- **Face refinement pass (MiniMax H3, local):** every generated clip with Aaron or Gian goes through `tools/faceswap_refine.py` before editing. Head inpainting (`h3_swap.py`, SAM3 head mask, denoise 0.9, expand 25, 8 steps, `--ref-size max`) keeps wardrobe, hats, glasses, background and camera, and moves the face back to the real person (Cypher close-up of Gian: ~6.8 min for 5 s on an RTX 5090, 1080p kept by the uncrop). Character Swap would bring the reference photo's t-shirt into the shot; inpainting does not.
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

## 5. Design and layout rules
- Keep kickers and meters in empty corners; on push-ins faces move toward top labels.
- Giant behind-the-subject words at ~68% opacity so HUD labels stay readable over them.
- Stagger HUD entrances by ~0.3–0.6 s and sync SFX to them; one UI beep per element reads as "data arriving".
- Brand: Pine/Sea/Cloud/Spark/Coral from the *Essentials* Figma, Instrument Serif for display, Inter Tight for UI (`assets/fonts/`, OFL).

- **Promotional cut (not a slide explainer):** full-screen footage under oversized type (150–300 px), one idea per beat, hard cuts on the spoken word, and big two-colour shape wipes (Spark + Pine bars on the Whip curve) as transitions: the closing bars cover the last frames so the cut happens under a solid colour. Put the type on a bottom band (Pine at ~50 %) or on the empty side of the frame, never on faces. Busy demo footage goes into a big card next to the word, not full screen behind it (its own text fights the title). **One hero per beat**: a huge word (250–330 px) with a small kicker (60–76 px); two stacked lines of similar size read as a fight. Shape wipes need time and **continuity**: the bars that cover the end of a scene and the bars that reveal the next must have the same colours and direction (a colour swap at the cut reads as a flash), accelerate in (Launch) and decelerate out (Land), ~0.5 s + ~0.75 s; and every cut gets one (hard cuts between scenes felt abrupt). Short scenes lose half their time to the bars: open breaths in the VO (silence inserted in the pause before a phrase, `BREATHS` in `make_promo.py`) so each beat stays on screen ≥ 2.5 s and a speed ramp ~3 s. SFX must be set against the bed: at −14/−19 dB under a −13 LUFS pop track they disappear; a whoosh per cut at −3 dB and swooshes on hero words at −8 dB read clearly. Static pattern backgrounds look cheap; slow drifting lines (`lines` element) keep empty frames alive. Over footage, reuse the tracked scene comps (HUD chips, callouts) instead of the bare clip (`media` with `comp` and `hide`). Never put type over footage that has its own titles (the end card's reel showed through a Pine veil); use a clean plate. `tools/build_promo_all.jsx`.
- **Voice for promos:** one continuous read (ElevenLabs Multilingual v2, Chris, stability 0.45), never line by line, never stretched. Cut the scenes to the VO word times (`tools/vo_words.py`, whisper): a scene changes only in a pause, after its last word.

## 6. Audio
- Target about **−16 LUFS integrated** for web (measure: `ffmpeg -i out.mp4 -af ebur128 -f null -`).
- Music at 0 dB with a 1 s fade at the end; UI SFX around −9 to −11 dB.
- **Fit generated music without splicing:** find the drop with an RMS envelope (0.5 s windows) and offset the whole track so the drop lands on the key word; with ElevenLabs Music the structure in the prompt is followed roughly (asked 6.5 s, got the drop at 16.3 s), so measure, then shift.

## 7. Repo hygiene
- All repo content is **English** (code, UI, docs, commits).
- LLMs read only `library/INDEX.txt` (~1 line per preset); HTML/GIFs are for humans.
- README GIFs: 400 px, 10 fps, 2.5 s, `hqdn3d` + 48-color palette → ~0.5 MB each even with film grain.
- Binary assets via Git LFS (`.aep`, `.mp4`, `.mov`, `.webm`, `.ttf`); temporaries (`_*.png`, `*_raw.mp4`, renders) are ignored.
- Windows console: `PYTHONIOENCODING=utf-8` (or ASCII-only prints) — `→` crashes cp1252 consoles.

## 8. Costs observed (Flora, USD)
| Item | Cost |
|---|---|
| Nano Banana Pro still (2K) | 0.18 |
| Kling 3.0 Pro, 5 s 1080p | 0.706 |
| VEED background removal (5 s) | 0.135 |
| ElevenLabs Music (20–26 s) | 0.36 |
| ElevenLabs v3 VO line | 0.121 |
| ElevenLabs Multilingual v2, full 56 s read in one take | 0.121 |
| Nano Banana 2.1 colorize a reference photo | 0.035 |
| Nano Banana 2.1 still (2K) | 0.053 |
| MiniMax H3 Max, 5–6 s 768p | 0.48–0.58 |
| Seedance 2.5, 5 s 1080p | 6.05 (estimate said 2.48) |
| *The 1974 Boardroom* v3 total (3 stills, 3 clips, 3 mattes, 3 music tracks, 6 VO lines) | ≈ 5.24 |
