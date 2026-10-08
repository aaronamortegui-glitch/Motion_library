---
name: ss-motion-library
description: Apply, grow and document Superside's own motion library (SS Motion) in After Effects from this repo. Use when asked to animate layers or text with Superside presets, pick animations by energy (soft/medium/dynamic) or use (social, corporate, UI), create a new preset, harvest Animation Composer presets as behavioral reference, or regenerate the GIF thumbnails and the HTML visualizer.
---

# SS Motion Library

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
