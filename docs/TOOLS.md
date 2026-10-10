# Motion DNA · tools

Every script lives in `tools/` with a header comment (what it does, how to run it). Start with the MCP server or the
panel; reach for these when building a piece.

| Tool | What it does |
|---|---|
| `tools/ss_motion_lib.jsx` (`SSM`) | Token-driven keyframes: `animate`, `pop`, `recoil`, `animateBezier`, `animateStops`, `organicStops` (hand-drawn rhythm), `font(role)` |
| `tools/ss_presets.jsx` (`SSP`) | The presets: `apply`, `applyFx`, `applyText`, `applyRecipe` |
| `tools/ss_panel.jsx` + `tools/install_panel.ps1` | Gallery panel (Window menu, dockable): categories, live vector previews, In/Out/Both, marker timing, packs, assets |
| `tools/mcp/ss_motion_mcp.py` (`.mcp.json`) | MCP server: Claude browses the library and drives AE (apply presets and packs, add assets, render frames) |
| `tools/sample_previews.jsx` · `tools/make_panel_thumbs.sh` · `tools/pack_demos.jsx` | Panel previews (sampled curves), panel thumbnails, pack demo renders |
| `tools/bridge.sh` + `tools/ss_bridge.jsx` | Runs `.jsx` jobs in the open AE from the terminal |
| `tools/ss_hud.jsx` (`SSHUD`) | Holographic overlays on tracked points: bracket, callout, meter, chip, contour, face scan, floating panel |
| `tools/track_points.py` | OpenCV point tracker → JSON for AE nulls (`--regions regions.json`) |
| `tools/matte_contours.py` | Per-frame subject contours from an AI matte (`--subjects`, `--split-x`) |
| `tools/video_matte.py` | Local people matte (InSPyReNet, MIT, GPU via ComfyUI's Python) → ProRes 4444 alpha, no cost |
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
| `tools/tag_library.py` → `library/tags.json` | Tags for every preset, curve and technique: roles, targets, channels, direction, energy range (1–5), tones |
| `tools/match_reference.py` | Compares a reference profile (`library/references/<slug>.json`) with the library: what fits, how to build each move, the gaps to create, a proposed style |
| `tools/vo_words.py` | Word timestamps of a voiceover (openai-whisper) to cut scenes on the spoken word |
| `tools/qa_frames.jsx` | QA stills of a comp at given times |
| `tools/faceswap_refine.py` + `media/faceswap/jobs.json` | **Face refinement pass** for every clip with a real person (MiniMax H3 head inpainting, local GPU); `faceswap_apply.py`, `footage_relink_*.jsx`, `reload_footage.jsx` put the refined clips in place |
| `tools/ss_assets.jsx` (`SSA`) + `tools/index_assets.py` | Local asset packs: index SFX/overlays by category and loudness, place them by name |
| `tools/style_research/` | Motion Style Map pipeline: per-video energy, metrics, music/BPM sync (`audio.py`), contact sheets, curve fitting, catalog integration, the map, and `map_to_dna.py` (behaviors → Motion DNA presets and curves) |
| `tools/record_panel.py` | Records the panel in use (SS_PANEL hook driven through the bridge, DPI-aware PrintWindow) → `docs/screens/ae-panel.gif` |
| `tools/brand.py` (+ MCP `list_brands`, `get_brand`, `add_brand_note`, `apply_brand`) | **Brand profiles**: a custom style per brand that learns a rule from every review (`library/brands/<slug>/brand.json`) |
| `tools/check_layout.jsx` | **Layout QA** on built comps: text on text, cards touching, safe area, size, contrast, graphics on faces, substituted fonts (CONTRIBUTING §9) |
| `tools/face_boxes.py` | Face boxes per frame (OpenCV) so the layout QA can flag graphics on faces |
| `tools/trace_mark.py` | Traces a flat-colour mark (a logo on a prop, a sketch) into a clean SVG + PNG |
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

## Notes

- If a project contains Animation Composer layers, `aerender` hangs: render through `tools/render_comps.jsx` / `tools/render_queue.jsx` (the open AE's queue). AE shows "Not Responding" while a scripted render runs; that is expected.
- Brand fonts (Inter Tight and Instrument Serif, OFL) are picked with `SSM.font("display" | "ui" | "ui_regular")`, falling back to Georgia/Arial.
- Rebuilding a scene comp removes it from every comp that nests it; `build_scene.jsx` rebuilds the breakdown automatically, and `build_edit.jsx` should run after it.
