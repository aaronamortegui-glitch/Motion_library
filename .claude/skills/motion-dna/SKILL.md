---
name: motion-dna
description: Apply, grow and document Motion DNA, a motion library for After Effects that gives AI-made motion its own identity (moves, techniques, scripts, styles). Use when asked to animate layers or text with Motion DNA presets or styles, tune them (duration, intensity, direction, easing), pick animations by energy (soft/medium/dynamic) or use (social, corporate, UI), create a new preset, harvest Animation Composer presets as behavioral reference, or regenerate the GIF thumbnails and the HTML visualizer.
---

# Motion DNA

Read `docs/LEARNINGS.md` before non-trivial AE work: it lists every pitfall already solved (rendering, ExtendScript, Flora, roto, layout, audio).

Our own motion library for After Effects. Everything creates native keyframes/expressions (no plugins).
All repo content is English: write code, comments, messages, metadata and commit messages in English.

## Repo pieces
| File | What it is |
|---|---|
| `tokens/superside_motion_tokens.json` | Durations (Tick→Stage), curves (Flat, Land, Launch, Settle, Cruise, Pop, Recoil), font roles |
| `tools/ss_motion_lib.jsx` | `SSM.animate(prop, t0, v0, v1, "<duration>", "<curve>")`, `SSM.animateBezier`, `SSM.font(role)` |
| `tools/ss_presets.jsx` | `SSP.apply` (motion), `SSP.applyFx` (loops), `SSP.applyText` (text), `SSP.applyRecipe` (harvested) + metadata |
| `tools/ss_panel.jsx` | ScriptUI panel for designers (Motion / Text / Effects / Recipes) |
| `library/INDEX.txt` | **Compact index for LLMs**: the only file you need to read |
| `library/library.json`, `library/recipes.json` | Tool-facing catalog and harvested recipes (they generate the HTML/INDEX) |
| `library/index.html` | Human visualizer with filters |
| `bridge/` | AE bridge: `.jsx` jobs in `inbox/` → result in `outbox/<name>.txt` |

## Tags and references (read first)
- `library/tags.json` tags every preset, curve and technique (roles, targets, channels, direction, energy 1–5, tones);
  `library/packs.json` tags every style. MCP: `list_tags`, `suggest_mix`, `list_packs`.
- A reference analysis (brand/video → energy range + tones + observed moves/curves/techniques) goes to
  `library/references/<slug>.json` and through `match_reference`. Build what fits; **create what is missing** (presets,
  token curves, transitions, techniques), tag it in `tools/tag_library.py`, render the samples
  (`bash tools/rebuild_previews.sh`) and add a style. CONTRIBUTING §8 has the steps.

## Picking a preset
Read ONLY `library/INDEX.txt` (one line per preset: `kind|name|channels|energy s/m/d|use`, tokens in the header).
Do not open `index.html`, `library.json`, GIFs or MP4s to decide: they are for humans/tools and waste context.
Rules:
- Dynamic video / social → `dynamic` (Scale Pop, Squash Warp, Jitter, Chars Pop) + `Tick` stagger.
- Corporate / explainer / UI → `soft` (Fade, Fade Up, Blur In, Words Fade Up).
- Presentations / general → `medium`.
- Text layers always use `SSP.applyText`, never `SSP.apply`, when you want per-character/word animation.

## Applying in AE (bridge)
1. Write the job inside `tools/` (so relative `#include`s resolve), e.g. `tools/_job_title.jsx`.
2. Run it: `bash tools/bridge.sh tools/_job_title.jsx` (starts the bridge if needed, waits, returns `OK` or `ERROR line N`). Delete the job afterwards.
```js
#include "ss_presets.jsx"
(function () {
    var c = app.project.activeItem;            // or find the comp by name
    var L = c.layer("Title");
    SSP.applyText(L, "Chars Rise", "both");    // in + out
    return "ok";
})();
```
3. Verification render: through the AE render queue (`tools/render_comps.jsx` + `tools/wait_files.sh`), or `aerender` only if the project has NO Animation Composer layers (with them `aerender` hangs). Check frames with ffmpeg (contact sheet with `tile`).

## Creating a new preset
1. Add it to `tools/ss_presets.jsx` (object `P`, `FX` or `TX`) with `channels`, `energy` (soft/medium/dynamic), `use` and `in`/`out` built only with `SSM.animate` + tokens.
2. `bash tools/expand_library.sh` → thumbnail comps, render (AE queue), GIFs, `library.json`, `index.html` and `INDEX.txt`.

## Growing it with Animation Composer (behavior only)
- Never decrypt `.mhcitem/.mhitemdata`, never modify the extension, never enable CEP debug modes.
- Flow: the user opens `tools/ss_harvest_station.jsx` in AE (section + Start) and the same folder in the AC panel → `python tools/ac_driver.py run` (UI automation: double-clicks each thumbnail, waits for the entry in `research/harvest/station/_log.csv`, scrolls; ESC stops; run `calibrate` and `preview` first) → `bash tools/expand_library.sh` (name OCR, `harvest_to_library.py` → `library/recipes.json`, thumbnails, index).
- Recipes are applied with `SSP.applyRecipe(L, id, "both")`; they reproduce the behavior with our own keyframes/expressions.

## Asset packs (SFX, overlays) — local only
Animation Composer's asset packs (≈300 SFX, light leaks, grain, film burns, VHS, glitch masks, textures) are licensed: never copy them into the repo or publish them.
1. `python tools/index_assets.py` → `library/ASSETS.local.txt` (git-ignored): `type|category|name|seconds|mean dB|peak dB|flags`.
2. Pick by category (sfx: whoosh, ui, impact, glitch, slide, sparkle, cartoon, sci-fi, film, riser; overlays: light-leak, grain, film-burn, scratches, vhs, glitch, film-texture). Avoid `loud` SFX for UI sounds, or drop them 12 dB or more; trim `long` ones with `len`.
3. In AE: `#include "ss_assets.jsx"` → `SSA.sfx(comp, name, t, gainDb, len)` and `SSA.overlay(comp, name, t, blend, opacity)` (blend defaults by family: light leaks/burns screen, grain/film overlay).

## MCP, markers, packs and classics
- If the `motion-dna` MCP server is available, use it: `list_presets` / `list_packs` / `list_assets` to choose, `apply_preset` (phase in|out|both, `marker_timing`) / `apply_pack` / `add_asset` to act, `render_frame` to look at the result.
- Marker timing: `SSP.markerTiming(true)` before applying adds layer markers `SS in` / `SS out`; moving them retimes the animation (expression remap, the curve is kept). Off by default for scripted builds.
- Packs: `SSP.applyPack(comp, "Dynamic"|"Elegant"|"Modern"|"Playful"|"Tech", layers?, phase?)` classifies layers by role (title/subtitle/body by font size, shape, media, logo by name) and applies the role's preset.
- Classics (`family: "classic"` in INDEX): animate.css 4.1.1 (MIT) effects as native keyframes; same `SSP.apply` call. Attention moves (Rubber Band, Tada, Heart Beat…) play at the `in` time.

## HUD overlays, scenes and edits
- `tools/ss_hud.jsx` (`#include "ss_hud.jsx"`): `SSHUD.init(comp)`, then `SSHUD.bracket({anchor:"TRK face", size:[w,h], label, t0})`, `SSHUD.callout({anchor, offset:[dx,dy], title, lines:[...], t0, color})`, `SSHUD.meter({at:[x,y], label, value, t0})`, `SSHUD.chip({anchor, offset, text, color, t0})`. Anchors are tracking nulls named `TRK <name>` (anchor point at the null center).
- Tracking: `python tools/track_points.py clip.mp4 tracks.json --regions regions.json --debug debug.mp4`; pick regions from a gridded first frame (`ffmpeg ... drawgrid`), check the debug sheet, and give items that leave the frame a `t1`.
- Scenes are JSON (`media/whisky/scenes.json` is the reference): `bash tools/bridge.sh tools/build_scene.jsx`. Edits (cut + music + Animation Composer SFX by name + end card): `media/whisky/edit.json` → `bash tools/bridge.sh tools/build_edit.jsx`. Render with `render_comps.jsx`; target about -16 LUFS for web.
- Roto/depth: add `"matte": "<people matte .mov>"` to a scene to get `behind` text between background and people; `contour` items read `tools/matte_contours.py` JSON (use `--split-x` when people touch); `faceScan` needs the plate layer named "Plate". Breakdown: `tools/build_breakdown.jsx` (scenes.json → `breakdown`). Full worked example: `docs/case-studies/the-1974-boardroom.md`.
- Edits: shots may carry `"freeze": {"at", "dur", "title", "sub", "titleAt", "x", "y", "lineW"}`; place `vo` and `sfx` with `{"shot": i, "local": s}` so freezes shift them; music auto-ducks under VO (`duckDb`). VO: one ElevenLabs v3 file per line, trimmed + loudnorm; size freezes from measured line lengths.
- Organic lines: use `Organic Draw` (draw and stay) or `Organic Stroke` (traveling) instead of `Line Draw`; for any property use `SSM.animateStops(prop, t0, v0, SSM.organicStops(v0, v1, frames, seed))`.
- Layout rule: keep kickers/meters in empty corners and check a contact sheet at several frames; a push-in moves faces toward the top labels.

## Typography
Use `SSM.font("display" | "ui" | "ui_regular")`: returns Instrument Serif / Inter Tight when installed (files in `assets/fonts/`, OFL), otherwise Georgia / Arial. Never hard-code font names.

## Renders and media
- Test comps: list them in `research/_render_list.txt` → `bash tools/bridge.sh tools/render_comps.jsx` → `bash tools/wait_files.sh research/_render_expected.txt` → `renders/<comp>.mp4`.
- Uploading local files to Flora: `flora_create_asset(source="signed-url")`, then `python tools/signed_upload.py <file> '<upload json>'`.
- Never call `app.newProject()` in jobs: rebuild only your own comps (find them by name and remove them) so the rest of the project survives.

## Known ExtendScript pitfalls
- Regex `/\\/g` breaks the parser → use `.split("\\").join("/")`.
- `new File()` with `#` in the name fails → use `Folder.getFiles("Name*")`.
- Parenting by script keeps the world position → parent first, then set the position.
- Properties with ranges (text selectors ±100) → the lib already clamps.
- Syntax check: strip `#include` lines and run `node --check` on a `.js` copy.
- `rq.render()` does not run inside the bridge task → `render_queue.jsx` / `render_comps.jsx` schedule it with `app.scheduleTask`, and `wait_files.sh` waits for the files.
- Recipe ids contain `__`: comp names are `GIF__<kind>__<rest>`; take everything after the second `__`.
- Windows console: export `PYTHONIOENCODING=utf-8` (the scripts already do).
