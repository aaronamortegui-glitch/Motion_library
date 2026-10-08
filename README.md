# SS Motion Library

Superside's own motion library for After Effects, built so that **an LLM (Claude or any other) can use it locally to drive AE**: apply animations, test them, render, and grow the catalog. Everything it creates is native keyframes and expressions, with no plugins required.

## What it looks like

240 px thumbnails (the full catalog lives in `library/index.html`).

| Category | Example | Example | Good for |
|---|---|---|---|
| **Motion** — entrances and exits | ![Scale Pop](library/gifs/motion/scale-pop.gif) `Scale Pop` | ![Line Draw](library/gifs/motion/line-draw.gif) `Line Draw` | Icons, chips, cards, lines |
| **Effects** — continuous loops | ![Float](library/gifs/fx/float.gif) `Float` | ![Jitter](library/gifs/fx/jitter.gif) `Jitter` | Idle elements, high-energy pieces |
| **Text** — per character or word | ![Chars Rise](library/gifs/text/chars-rise.gif) `Chars Rise` | ![Tracking Settle](library/gifs/text/tracking-settle.gif) `Tracking Settle` | Headlines, kickers, captions |
| **Recipes** — behavior harvested from Animation Composer and reproduced with our own code | ![2JV](library/gifs/recipe/calibration-2jv.gif) `2JV` bouncy pop | ![4VW](library/gifs/recipe/calibration-4vw.gif) `4VW` bouncy drop | Growing the catalog from real references |

Every preset has an **energy** level (`soft`, `medium`, `dynamic`) to match the piece: social/hype → dynamic, corporate/UI → soft.

## How it works

```
tokens (timing + curves) ──► ss_motion_lib.jsx (SSM.animate) ──► ss_presets.jsx (SSP.apply / applyFx / applyText / applyRecipe)
                                                                        │
            LLM ──► bridge/inbox/*.jsx ──► AE (ss_bridge.jsx) ──► bridge/outbox/*.txt   (apply, test, render)
                                                                        │
                                       library/INDEX.txt  ◄── the only file the LLM reads (~1 line per preset)
```

- **`tokens/superside_motion_tokens.json`**: 6 durations (Tick 4f … Stage 33f), 7 easing curves (Flat, Land, Launch, Settle, Cruise, Pop, Recoil) calibrated against real transitions, and font roles.
- **`library/INDEX.txt`**: ultra-compact index `kind|name|channels|energy|use`. An LLM reads it whole for very few tokens; the HTML and GIFs are for humans only.

## For the LLM (Claude Code)

The skill in `.claude/skills/ss-motion-library` explains everything. The essentials:

```bash
bash tools/bridge.sh tools/<job>.jsx      # runs a .jsx in AE and returns OK/ERROR with the line number (starts the bridge if needed)
```
```js
#include "ss_presets.jsx"   // keep the job inside tools/ (or use the path to tools/ss_presets.jsx)
(function () {
    var L = app.project.activeItem.layer("Title");
    SSP.applyText(L, "Chars Rise", "both");
    return "ok";
})();
```

## Growing the library with Animation Composer (without touching the plugin)

Animation Composer has no scripting API and its presets are encrypted: **we never decrypt or modify it**. Instead we automate its UI, the way a person would, and observe the result.

1. **AE:** *File › Scripts › Run Script File…* → `tools/ss_harvest_station.jsx`. Pick the section and press **Start**.
2. **Animation Composer panel:** open the same folder.
3. **Driver** (first time only: `python tools/ac_driver.py calibrate`, pressing F8 over three thumbnails; then `preview` to check):
   ```bash
   python tools/ac_driver.py run
   ```
   It double-clicks thumbnail after thumbnail, waits for the station to log each preset (recipe, curves and name), scrolls, and stops on its own. ESC aborts.
4. **Merge into the library** (name OCR → recipes → thumbnails → index):
   ```bash
   bash tools/expand_library.sh
   ```

Recipes store *what moves and how* (relative channels, frames, curve or frequency/amplitude), and `SSP.applyRecipe` reproduces them with our own keyframes. When a measured curve matches a token, the token is used.

> Animation Composer is licensed software by Mister Horse. Harvests (`research/harvest/`) are internal behavioral references; no presets or plugin renders are redistributed.

## For designers

- **Panel:** `tools/ss_panel.jsx` → select layers → pick a preset → Apply (tabs: Motion, Text, Effects, Recipes; energy filter; stagger).
- **Visualizer:** `library/index.html`.

## Test comps (`ae/motion_lab_v01.aep`, all on an AI-generated video)

| Comp | What it tests |
|---|---|
| `01_SS_Icon_Intro` | Superside S-mark: line draw-on, Pop fill, Launch exit |
| `02_Track_70s` | 6 OpenCV-tracked points, constellation lines, tracked callout, Animation Composer grain/light leak |
| `03_Figma_Chips` | The *Essentials* Figma slide animated with tokens (staggered chips) |
| `04_Text_Tracking_70s` | Text presets, fixed and tracked to the scene (title on the wallpaper, label on the face, ON AIR on the mic) |
| `05_Text_Behind_70s` | Giant title between the background and the person, using a person matte from Flora (VEED) |

## Structure

| Folder | Contents |
|---|---|
| `tokens/` | Timing, curves and font roles |
| `tools/` | JSX library, panel, bridge, harvest station, AC driver, pipelines (`expand_library.sh`, `render_gifs.sh`, `render_queue.jsx`, `render_comps.jsx`) |
| `library/` | `INDEX.txt` (LLM), `library.json`, `recipes.json`, `index.html`, `gifs/` |
| `assets/` | Superside logos, S-mark shape for AE, palette and components from the *Essentials* Figma, brand fonts |
| `ae/` | Test project (see above) |
| `media/` | Base video (Flora, 70s 16mm look), person matte and tracking data |
| `research/` | Calibration, Animation Composer harvests, preview catalog |

## Requirements

Windows · After Effects 2026 · Python 3 with `numpy`, `opencv-python`, `scipy`, `Pillow` · `ffmpeg` on the PATH · Git LFS.
The repo can be cloned anywhere: scripts compute the repo root (`SS_ROOT`) from their own location. Run the `.jsx` files from `tools/` (don't copy them into AE's *ScriptUI Panels* folder).

## Notes

- `render_gifs.sh` only uses `aerender` without `SKIP_RENDER`. If the project contains layers with Animation Composer presets, render through `tools/render_queue.jsx` / `tools/render_comps.jsx` (the open AE's render queue), because `aerender` hangs.
- Brand fonts live in `assets/fonts/` (Inter Tight and Instrument Serif, OFL). Install them in Windows (right-click › Install) before opening AE; scripts pick them with `SSM.font("display" | "ui")` and fall back to Georgia/Arial.
- Person matte for text-behind-subject: `media/aaron_70s_matte.webm` (Flora · VEED). AE needs the `.mov`: `ffmpeg -c:v libvpx-vp9 -i media/aaron_70s_matte.webm -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le media/aaron_70s_matte.mov`.
- `aaron.png` and the videos in `media/` are personal test material from a project collaborator.
