# Learnings

Everything we learned building SS Motion and *The 1974 Boardroom* test, written so the next person (or LLM) doesn't have to rediscover it. Keep this file up to date when something new bites you.

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
- Font names must be PostScript names; AE only sees newly installed fonts after a restart. Use `SSM.font(role)`.

### Rendering
- `aerender` **hangs** when the project contains layers with Animation Composer presets (the plugin waits for UI). Use the open AE's render queue: `tools/render_comps.jsx` / `tools/render_queue.jsx`.
- Output template `H.264 - Match Render Settings - 15 Mbps` includes audio when the comp has it.
- Contact sheets are the fastest QA: `ffmpeg -i out.mp4 -vf "select='eq(n\,30)+eq(n\,90)',scale=800:-1,tile=2x2" -frames:v 1 sheet.png`. Check several frames, not one — push-ins move things into labels.

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

## 4. Tracking, roto and overlays
- **Tracking** (`tools/track_points.py`): pick regions from a gridded first frame (`drawgrid`), radius 40–90 px, textured areas (faces, ties, lapels, glass rims, skyline). Check the debug sheet; low `conf_min` or big drift means the object left the frame → give HUD items a `t1`.
- Nulls are 100×100 with anchor `[50, 50]`; expressions use `a.toComp(a.transform.anchorPoint)` so tracked points are exact in comp space.
- **Roto matte → depth:** plate · *behind* text · people matte · grain · contours · face scans · HUD. That order puts giant titles behind the people for free.
- **Contours** (`tools/matte_contours.py`): biggest external contours per frame, resampled to a fixed point count starting at the top-most point, temporally smoothed → stable animated paths. When subjects touch (a toast), use `--split-x` to cut the mask so each person keeps their own line. Add *Wiggle Paths* (Roughen, smooth points) + an offset echo line for an organic, hand-drawn feel.
- **Face scan:** a sweeping band used as track matte for (a) a sideways-shifted copy of the plate (the "slice") and (b) Find Edges → Threshold → Tint copy screened on top (holographic face). Without Threshold, hair/beard edges turn into a green blob.
- **Holographic look:** Glow + faint Venetian Blinds scanlines + a rare opacity flicker; motion always comes from library presets so timing stays on-brand.

## 5. Design and layout rules
- Keep kickers and meters in empty corners; on push-ins faces move toward top labels.
- Giant behind-the-subject words at ~68% opacity so HUD labels stay readable over them.
- Stagger HUD entrances by ~0.3–0.6 s and sync SFX to them; one UI beep per element reads as "data arriving".
- Brand: Pine/Sea/Cloud/Spark/Coral from the *Essentials* Figma, Instrument Serif for display, Inter Tight for UI (`assets/fonts/`, OFL).

## 6. Audio
- Target about **−16 LUFS integrated** for web (measure: `ffmpeg -i out.mp4 -af ebur128 -f null -`).
- Music at 0 dB with a 1 s fade at the end; UI SFX around −9 to −11 dB.

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
| *The 1974 Boardroom* v2 total (3 stills, 3 clips, 3 mattes, 2 music tracks) | ≈ 4.15 |
