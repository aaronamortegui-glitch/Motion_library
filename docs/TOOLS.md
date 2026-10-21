# Motion DNA · tools

Every script lives in `tools/` with a header comment (what it does, how to run it). Start with the MCP server or the
panel; reach for these when building a piece.

| Tool | What it does |
|---|---|
| `tools/ss_motion_lib.jsx` (`SSM`) | Token-driven keyframes: `animate`, `pop`, `recoil`, `animateBezier`, `animateStops`, `organicStops` (hand-drawn rhythm), `font(role)` |
| `tools/ss_presets.jsx` (`SSP`) | The presets: `apply`, `applyFx`, `applyText`, `applyRecipe` |
| `panel/` (CEP extension) + `tools/setup.py` | The panel (Window > Extensions > Motion DNA): Behaviors, Curves (editor + library, save into the tokens), Styles, Brands (workspace per client: curves, timing benchmarks, rules, active brand), Techniques, Agent (runs Claude Code in the background with the Motion DNA MCP and Figma). `panel/host/host.jsx` is the After Effects side |
| `tools/ss_panel.jsx` | Previous ScriptUI panel, kept as a fallback (File › Scripts › Motion DNA opens it when the HTML panel is missing) |
| `tools/build_figma_slides.jsx` | Rebuilds Figma slides as native AE layers from a JSON spec (live text, shapes, arcs, groups as precomps, exported PNGs) |
| `tools/mcp/ss_motion_mcp.py` (`.mcp.json`) | MCP server: Claude browses the library and drives AE (apply presets and packs, add assets, render frames) |
| `tools/sample_previews.jsx` · `tools/make_panel_thumbs.sh` · `tools/pack_demos.jsx` | Panel previews (sampled curves), panel thumbnails, pack demo renders |
| `tools/bridge.sh` + `tools/ss_bridge.jsx` | Runs `.jsx` jobs in the open AE from the terminal |
| `tools/ss_transitions.jsx` (`SST`) + `library/transitions.json` | Parametric transitions from solids and masks (wipe, bars, blinds, split, interleave, stack, iris, diamond, grid, dots, fan, liquid (living wavy edge), ink (wobbly blooms that open a hole); origin and gradient options) driven by one controller (Progress, Direction, Stagger, Ease In / Ease Out token curves evaluated as cubic-bezier, Color 1-3; timing from duration tokens), plus clip-to-clip zoom, spin, stretch, slide, flash, dip, shake, twirl, slices and glitch on token curves; 38 named looks; tonal palettes, swing and motion blur tagged by energy and tone. MCP `solid_transition`. Samples: `docs/examples/solid_transitions.jpg`, `clip_transitions.jpg` |
| `tools/ss_elements.jsx` (`SSE`) | 25 semi-finished elements that size themselves to their text by expression: label, lower third, title, underline, highlight, callout, counter, timer, price tag, handle, bubble, chat, sticker, quote, text box, list, progress, ring, rating, button (cursor click), kinetic stack, letter tiles, media slot, scale title, cinematic (neon, blur, kerning); one controller each (Reveal, Padding, Radius, Gap, Box/Accent/Text colours), outline boxes, brand colours and fonts. MCP `add_element`. Samples: `docs/examples/elements*.jpg` |
| `tools/ss_shapes.jsx` (`SSS`) | 40 animated shapes on native shape layers (a breathing liquid blob, primitives, lines that draw on and travel off, marks, impacts, particle pops, fireworks, glitter, shockwave rings, swoosh echoes, confetti); Reveal keyed with token curves, Size/Stroke/Color controls. MCP `add_shape`. Samples: `docs/examples/shapes_*.jpg` |
| `tools/ss_moves.jsx` (`SSMV`) | 2D/3D entrances and exits on token curves: flip, hinge, orbit, fly, tumble, grow from edge, squash. MCP `move`. Sample: `docs/examples/moves.jpg` |
| `tools/ss_text.jsx` (`SSTX`) | Text animation per char/word/line with token curves solved per unit (fade, rise, drop, slide, scale, rotate, 3D, skew, tracking, blur, decode, colour; ease/flicker/wiggly; mask reveal), typewriter with cursor, and word-timed captions (highlight, karaoke, build, pop, word). MCP `animate_text`, `add_captions`. Samples: `docs/examples/text_engine.jpg`, `captions.jpg` |
| `tools/ss_behaviors.jsx` (`SSB`) | Behaviours: the algorithm apart from what it draws. Expression generators by family: fill (bubbles = metaballs with a gooey pass, blob, voronoi cells, organic growth), swarm (noise flow field, flock), physics (jelly spring driven by the token curve's speed, verlet rope), modifier (`line_boil`, hand-drawn tremble on 3s). Targets: own shape layer, looping background, alpha matte for any layer or text, an element's box, transition pieces (`SST.add(comp, "behavior", t, {behavior})`), existing layers. Holds the shared `blob()` (`SSB.fn("blob")`) used by ink, the blob shape and the blobs background. MCP `add_behavior`. Sample: `docs/examples/behaviors.jpg` |
| `tools/ss_looks.jsx` (`SSL`) | Procedural backgrounds (stripes, dots, grid, gradient, liquid, topo, network/plexus, blobs, mesh gradient, frosted glass), a smoky glass card (`glassCard`, `glassPane`) and finishing looks (tritone, duotone, vignette, grain, scanlines, letterbox, dust, embers, snow), long shadow and RGB glitch. MCP `add_look`. Samples: `docs/examples/backgrounds.jpg`, `looks.jpg` |
| `tools/logo_to_shape.py` | Cleans a traced straight-segment SVG logo into smooth curves without changing its design (contour smoothing with corners pinned, RDP, Catmull-Rom); writes the AE shape JSON, a clean SVG and a 1024 preview. The Motion DNA mark: `assets/brand/motion_dna_mark*` |
| `tools/logo_parts.py` | Splits a filled logo into the pieces it is built from (thick strands, thin lines, the arrow) with their outlines and centre strokes, for the stroke build (`SSE.endCard`, MCP `add_element` kind `end_card`). Its layered SVG for Figma: `assets/brand/motion_dna_mark_parts.svg` |
| `tools/kit_gifs.py` | One preview comp per kit piece and transition look (through the MCP calls), rendered to `library/gifs/kit-<kind>/` for the catalog and the panel; doubles as a test of every piece |
| `tools/build_compare.jsx` | Case study *Claude alone vs Claude + Motion DNA*: six deck slides animated twice (linear and all at once vs token curves with in · hold · out, stagger and kit transitions), side by side, then the logo close. Render the comp `MDNA Compare` |
| `library/kit.json` | The 112 building blocks above (behaviours with family and targets), tagged with energy, tones, use and the call to make. MCP `list_kit` |
| `tools/ss_resize.jsx` (`SSRZ`) | Social resizes: duplicates a comp per size (9:16, 1:1, 4:5, 16:9, 4:3, 2:3 or WxH) keeping every keyframe and expression; nothing is re-keyed, the layers hang from rig nulls (`SS resize · content` / `bg`, `SS fit · <layer>`). Backgrounds cover the new frame; content goes inside the size's title-safe area (9:16 clear of the Reels/TikTok/Shorts interface): `reflow` (default) places each group of layers that rest together at its own size, `fit` scales the layout as one block. MCP `resize_comp` (runs `check_layout` on each new comp) |
| `tools/ss_keyframes.jsx` (`SSK`) | Keyframe toolkit (behavioral equivalent of AC's helper panels): reverse, mirrorOut, stagger, shift, toPlayhead, sequence, distribute, loop, bake, stretch, copyTo, anchor (9 positions, keeps the screen position). MCP `keyframes` / `anchor_point` |
| `library/resources.json` | Catalog of outside resources (OSS scripts and expression libraries, CC0 VFX, motion assets, SFX, royalty-free music), each with its license, credit, whether it can live in the repo, access and when to use it. MCP `list_resources` |
| `tools/ss_hud.jsx` (`SSHUD`) | Holographic overlays on tracked points: bracket, callout, meter, chip, contour, face scan, floating panel |
| `tools/track_points.py` | OpenCV point tracker → JSON for AE nulls (`--regions regions.json`) |
| `tools/matte_contours.py` | Per-frame subject contours from an AI matte (`--subjects`, `--split-x`) |
| `tools/upscale_crop.py` | Close-ups of a set that stay the same set: crop a master frame and upscale it on the local GPU (4x-ClearRealityV1 via ComfyUI's Python), no cost |
| `tools/video_matte.py` | Local subject matte (InSPyReNet, MIT, GPU via ComfyUI's Python): a video → ProRes 4444 alpha, a still → PNG with alpha, no cost. MCP `matte` and `text_behind` run it |
| `tools/matte_points.py` | Head and body track points from a matte (for people KLT cannot hold: walk-ins, jumps) |
| `tools/planar_track.py` | Planar (2.5D) track: a quad glued to a wall / floor / screen with perspective → `planar` items in `build_scene.jsx` |
| `tools/build_scene.jsx` | Scene from JSON: plate, tracking, matte, text behind people, HUD |
| `tools/build_edit.jsx` | Edit from JSON: cuts, **speed ramps** (`speed`), freeze frames with kinetic type, titles (`texts`), VO, music ducking, SFX, end card |
| `tools/build_breakdown.jsx` | 2×2 roto breakdown (plate · matte · contours · composite) |
| `tools/face_check.py` | Likeness QA: real photo next to every face found in AI stills or clips |
| `tools/build_explainer.jsx` | Slides/explainer scenes from a JSON storyboard (Figma coordinates), every element animated by a preset |
| `tools/build_app_screen.jsx` | Browser-window recording of the visualizer, rebuilt from screenshots |
| `tools/render_comps.jsx` | Renders comps through the open AE's render queue |
| `tools/build_promo_all.jsx` + `media/promo/make_promo.py` | Promotional cut: full-screen footage, oversized type, shape wipes, scenes cut on the VO word times |
| `tools/setup.py` (+ `INSTALL-*.cmd/.command`) | One-step install: cleans old versions, panel in every AE version, fonts, local asset previews, checks; `--update` pulls and reinstalls, `--uninstall` removes it, `--mcp-user` registers the MCP server everywhere |
| `tools/test_all.py` (`test_library.jsx`, `test_panel.jsx`, `test_mcp.py`, `test_mosaics.jsx`, `make_library_mosaic.py`) | End-to-end tests and the sample mosaics: presets, controls, Remove, panel, MCP, styles, mix |
| `tools/test_mcp_status.js` | Tests of the panel's connector logic (Krea, Flora, Figma): duplicate servers, the Remove duplicate scopes, never adding a server on a bad read, allow list = deny list; `node tools/test_mcp_status.js`, no After Effects or CLI needed |
| `tools/tag_library.py` → `library/tags.json` | Tags for every preset, curve and technique: roles, targets, channels, direction, energy range (1–5), tones |
| `tools/match_reference.py` | Compares a reference profile (`library/references/<slug>.json`) with the library: what fits, how to build each move, the gaps to create, a proposed style |
| `tools/vo_words.py` | Word timestamps of a voiceover (openai-whisper) to cut scenes on the spoken word |
| `tools/qa_frames.jsx` | QA stills of a comp at given times |
| `tools/faceswap_refine.py` + `media/faceswap/jobs.json` | **Face refinement pass** for every clip with a real person (MiniMax H3 head inpainting, local GPU); `faceswap_apply.py`, `footage_relink_*.jsx`, `reload_footage.jsx` put the refined clips in place |
| `tools/ss_assets.jsx` (`SSA`) + `tools/index_assets.py` | Local asset packs and the free CC0 packs: index SFX, music, overlays, VFX sequences and textures by category and loudness, place them by name (`SSA.sfx`, `SSA.overlay`, `SSA.vfx`) |
| `tools/fetch_free_assets.py` | Downloads the free CC0 packs listed in `library/resources.json` (Unity Labs VFX, Kenney particles, SFX, jingles) into `assets.free/` (git-ignored), converts OGG to WAV and TGA to PNG, writes a LICENSE per pack. Ask before running |
| `tools/ss_vendor.jsx` (`SSV`) + `vendor/` | Vendored open-source code (json2, eKeys, aefunctions) with licenses; `SSV.expressionLib("eKeys")` imports an expression library and returns the line to use it |
| `tools/style_research/` | Motion Style Map pipeline: per-video energy, metrics, music/BPM sync (`audio.py`), contact sheets, curve fitting, catalog integration, the map, and `map_to_dna.py` (behaviors → Motion DNA presets and curves) |
| `tools/record_panel.py` | Records the old ScriptUI panel in use (SS_PANEL hook driven through the bridge, DPI-aware PrintWindow) → `docs/screens/ae-panel.gif` |
| `tools/record_cep_panel.py` | Records the CEP panel in a headless browser (Playwright, preview mode) → `docs/screens/cep-*.gif` (one per section + the tour) |
| `tools/mdna_launcher.jsx` + `tools/install_panel.ps1` / `.sh` | File › Scripts › Motion DNA (opens the panel) and the Startup script that starts the Claude bridge when AE opens |
| `tools/technique_cards.py` | The technique cards of *Agent › Library* (title + what it does) → `library/techniques/<slug>_card.png` |
| `tools/brand.py` (+ MCP `list_brands`, `get_brand`, `add_brand_note`, `apply_brand`) | **Brand profiles**: a custom style per brand that learns a rule from every review; templates in `library/brands/`, client brands in `library/brands.local/` or their own folder; `export` / `import` share one and merge its rules |
| `tools/check_layout.jsx` | **Layout QA** on built comps: text on text, cards touching, safe area, size, contrast, graphics on faces, substituted fonts (CONTRIBUTING §9); boxes follow the whole parent chain (resize rigs included) |
| `tools/qa_hidden.jsx` | **Hidden-layer QA** before a render: `QA_HIDDEN("<comp>")` walks the comp and every nested comp and lists text/shape layers under an opaque full-frame plate, footage that ends before its layer (plates going dark), disabled overlays and overlays whose opacity never rises (CLAUDE.md, before every render) |
| `tools/collect_project.jsx` | **Collect a project** into a handoff folder (a scriptable *Collect Files*): `COLLECT_PROJECT(dest, name)` saves the open project as `<dest>/ae/<name>.aep`, copies every footage file into `<dest>/overlay/` with its repo-relative path (outside files to `overlay/_external/`) and relinks it. Add a `HANDOFF.md` + `CLAUDE.md` so another person or Claude can resume |
| `tools/check_previews.py` | **Preview QA**: lists any preset, recipe, style or technique without its panel image (setup and `test_all.py` run it; the panel shows a placeholder instead of a broken image) |
| `tools/face_boxes.py` | Face boxes per frame (OpenCV) so the layout QA can flag graphics on faces |
| `tools/trace_mark.py` | Traces a flat-colour mark (a logo on a prop, a sketch) into a clean SVG + PNG |
| `tools/collect_files.jsx` | **Collect Files** by script: a self-contained copy of one comp (Reduce Project, every footage file copied into `(Footage)/` and relinked, fonts, a report); the original project is never modified |
| `tools/build_dna_promo.jsx` + `media/motion_dna_promo/make_dna_promo.py` | The Motion DNA promo: technique plates (`build_scene`), shots and graphics (`build_explainer`), the edit (`build_edit`), music-led timing |

Data-driven builders: scenes (`build_scene.jsx`: plate, tracking, matte, HUD, `planar`, `rays`, `glow`, `burst`),
explainer scenes (`build_explainer.jsx`: text, pills, cards, media, `screen`, `pixels`, wipes, camera `push`) and edits
(`build_edit.jsx`: cuts, speed ramps, freezes with `mono` / `split` titles, dialogue, music ducking, SFX) all read JSON.

## Growing the library

New presets come from measuring reference animations, never from copying them. With Animation Composer as the reference:

1. **AE:** *File › Scripts › Run Script File…* → `tools/ss_harvest_station.jsx`. Pick the section and press **Start**.
2. **Animation Composer panel:** open the same folder.
3. **Driver** (first time only: `python tools/ac_driver.py calibrate`, pressing F8 over three thumbnails; then `preview` to check):
   ```bash
   python tools/ac_driver.py run
   ```
   It double-clicks thumbnail after thumbnail, waits for the station to log each preset (curves, channels and name), scrolls, and stops on its own. ESC aborts.
4. **Merge into the library** (name OCR → recipes → thumbnails → index):
   ```bash
   bash tools/expand_library.sh
   ```

Recipes store *what moves and how* (relative channels, frames, curve or frequency/amplitude), and `SSP.applyRecipe` reproduces them with our own keyframes. When a measured curve matches a token, the token is used.

> Animation Composer is licensed software by Mister Horse. It has no scripting API and its presets are encrypted: **we never decrypt or modify it**, we only automate its UI and observe the result. Harvests (`research/harvest/`) are internal behavioral references; no presets or plugin renders are redistributed.

## Asset packs (sound effects and overlays)

The motion presets are ours and live in this repo. Sound effects and footage overlays come from the asset packs installed with Animation Composer (≈300 files on our machines: whooshes, UI blips, impacts, glitches, sparkles, light leaks, grain, film burns, VHS, glitch masks). Those files are licensed, so **they are never copied into the repo**: each machine indexes its own packs and the library places them by name.

```bash
python tools/index_assets.py      # → library/ASSETS.local.txt (git-ignored): category, length and loudness of every asset
```
```js
#include "ss_assets.jsx"
SSA.sfx(comp, "Swoosh Wood 01_Variant Main", 1.2, -9);       // name, time, gain dB [, max length]
SSA.overlay(comp, "Light Leak B1 10", 0);                   // blend picked by family: leaks → Screen, grain → Overlay
```

The index measures each sound's loudness and flags the harsh ones (`loud`) and the long ones (`long`), so an LLM picks a soft blip for UI and trims a boom instead of guessing.

## Structure

| Folder | Contents |
|---|---|
| `tokens/` | Timing, curves and font roles |
| `library/` | `INDEX.txt` (LLM), `library.json`, `recipes.json`, `index.html`, `gifs/`, `posters/`, `tags.json`, `packs.json` (styles), `techniques.json`, `references/`, **`brands/`** (brand profiles) |
| `tools/` | JSX library, panel, bridge, HUD, scene/edit builders, harvest station, AC driver, render pipelines |
| `assets/` | Neutral sample shape (`motion_dna/`), palette and components from the *Essentials* Figma, fonts |
| `docs/` | `LEARNINGS.md`, case studies, screens and examples |
| `ae/` | Test project |
| `media/` | AI test footage, mattes, tracking data, music and VO for the showcases |
| `research/` | Calibration, harvests, preview catalog, Motion Style Map (`style_map/`, `ontology/`, `styles/`, `batch/`) |

## Requirements

**Windows or macOS** · After Effects 2025/2026 · Python 3 with `numpy`, `opencv-python`, `scipy`, `Pillow` · `ffmpeg` on the PATH · Git LFS · a bash shell (Git Bash on Windows; built in on macOS).
The repo can be cloned anywhere: scripts compute the repo root (`SS_ROOT`) from their own location. Run the `.jsx` files from `tools/` (don't copy them into AE's *ScriptUI Panels* folder; the installers add a small loader instead).

| | Windows | macOS |
|---|---|---|
| Install the panel | `tools/install_panel.ps1` | `tools/install_panel.sh` |
| Bridge / MCP start AE scripts with | `AfterFX.exe -s` | `osascript` → AE's `DoScriptFile` |
| Overrides | `SS_AFTERFX`, `SS_AERENDER` | `SS_AE_APP` (e.g. `Adobe After Effects 2026`), `SS_AERENDER` |
| Local asset packs | `%LOCALAPPDATA%\MisterHorse\ProductManager\AssetPacks` | `~/Library/Application Support/MisterHorse/ProductManager/AssetPacks` (override: `SS_ASSET_PACKS`) |
| Animation Composer harvesting (`ac_driver.py`, label OCR) | yes | not available (Windows UI automation and OCR) |

On macOS, the first `osascript` call asks for permission to control After Effects (System Settings › Privacy & Security › Automation): allow it for your terminal. The macOS path is written to mirror the tested Windows one but has not been run on a Mac yet; report anything that breaks.

## Video templates (research, `research/video_prompts/`)

Not part of the plugin yet; Claude finds them through the `video-templates` skill. Needs `pip install playwright numpy pillow` and `python -m playwright install chromium`.

| Script | What it does |
|---|---|
| `research/video_prompts/html_to_mp4.py <template.html> [--notext] [--mblur N]` | Renders a template frame by frame: H.264 MP4, or ProRes 4444 with alpha; `--notext` gives a hybrid plate. |
| `research/video_prompts/snap.py <template.html> out.jpg <t…>` | A contact sheet of a few frames, to check before rendering. |
| `research/video_prompts/ae/import_render.jsx` · `VP_IMPORT(path, comp, t)` | Puts a render into an AE comp (reuses the footage, keeps alpha). |
| `research/video_prompts/ae/route_b.jsx` · `VP_T05()`, `VP_T12()` | Native AE rebuilds of two templates with `SSTX` and token curves. |
| `research/video_prompts/fetch_sources.py` | Downloads the third-party prompt collection and the Skillry remakes into `source/` (git-ignored). |
| `research/video_prompts/build_index.py` | Categorizes the 703 source prompts into `index.json` / `INDEX.md` (metadata only). |
| `research/video_prompts/compare.py` · `make_reel.py` | Side-by-side test with the gradient-mapped remakes; one review reel of every template. |

## Notes

- If a project contains Animation Composer layers, `aerender` hangs: render through `tools/render_comps.jsx` / `tools/render_queue.jsx` (the open AE's queue). AE shows "Not Responding" while a scripted render runs; that is expected.
- Brand fonts (Inter Tight and Instrument Serif, OFL) are picked with `SSM.font("display" | "ui" | "ui_regular")`, falling back to Georgia/Arial.
- Rebuilding a scene comp removes it from every comp that nests it; `build_scene.jsx` rebuilds the breakdown automatically, and `build_edit.jsx` should run after it.
