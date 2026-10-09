# SS Motion Library

Superside's own motion library for After Effects. Designers apply it from a panel; **an LLM (Claude Code or any local model) can drive it on its own**: apply animations, test them, render and grow the catalog. Everything it creates is native keyframes and expressions, with no plugins required.

![SS Motion Library visualizer](docs/screens/visualizer.png)

*`library/index.html`: every preset with a live thumbnail, its energy level and the one-line call to apply it.*

## What's inside

> **Latest additions (15):** from *The 1974 Boardroom* reel: `Slam In`, `Punch Zoom`, `Words Slam`, `Breathe`, `Holo Flicker`. New motion: `Flip In`, `Spin Pop`, `Drop Bounce`, `Stretch Slide`. New text: `Typewriter`, `Scramble`, `Count Up`. New effects: `Swing`, `Orbit`, `Shake`. Every piece we make should leave something new in the library.

<!-- catalog:start -->
**44 presets** in 4 categories. Every one is also listed in `library/INDEX.txt` (for LLMs) and `library/index.html` (for people).

### Motion (17)

Entrances and exits for any layer. `SSP.apply(layer, name, "in" | "out" | "both")`

|   |   |   |   |
|---|---|---|---|
| <img src="library/gifs/motion/fade.gif" width="200"><br>**Fade** · `soft`<br><sub>Corporate, UI, supporting text</sub> | <img src="library/gifs/motion/fade-up.gif" width="200"><br>**Fade Up** · `soft`<br><sub>Headlines, paragraphs, lists</sub> | <img src="library/gifs/motion/scale-pop.gif" width="200"><br>**Scale Pop** · `dynamic`<br><sub>Icons, chips, stickers, social</sub> | <img src="library/gifs/motion/blur-in.gif" width="200"><br>**Blur In** · `soft`<br><sub>Photos, backgrounds, premium moments</sub> |
| <img src="library/gifs/motion/slide-land.gif" width="200"><br>**Slide Land** · `medium`<br><sub>Images and cards entering from off-screen</sub> | <img src="library/gifs/motion/rotate-settle.gif" width="200"><br>**Rotate Settle** · `medium`<br><sub>Logos, badges, pieces with personality</sub> | <img src="library/gifs/motion/squash-warp.gif" width="200"><br>**Squash Warp** · `dynamic`<br><sub>Social, hype, rhythmic transitions</sub> | <img src="library/gifs/motion/wipe-reveal.gif" width="200"><br>**Wipe Reveal** · `medium`<br><sub>Bars, lower thirds, underlines</sub> |
| <img src="library/gifs/motion/organic-draw.gif" width="200"><br>**Organic Draw** · `medium`<br><sub>Hand-drawn feel: contours, underlines, sketch lines (shape layers only)</sub> | <img src="library/gifs/motion/organic-stroke.gif" width="200"><br>**Organic Stroke** · `dynamic`<br><sub>Traveling brush stroke: the start chases the end (accent lines, HUD links)</sub> | <img src="library/gifs/motion/line-draw.gif" width="200"><br>**Line Draw** · `medium`<br><sub>Lines, stroke icons, tracking HUD (shape layers only)</sub> | <img src="library/gifs/motion/slam-in.gif" width="200"><br>**Slam In** · `dynamic`<br><sub>Hero words, titles over footage, kinetic type</sub> |
| <img src="library/gifs/motion/flip-in.gif" width="200"><br>**Flip In** · `medium`<br><sub>Cards, tiles, reveals, before/after</sub> | <img src="library/gifs/motion/spin-pop.gif" width="200"><br>**Spin Pop** · `dynamic`<br><sub>Badges, stickers, stamps, icons</sub> | <img src="library/gifs/motion/drop-bounce.gif" width="200"><br>**Drop Bounce** · `dynamic`<br><sub>Icons, products, emoji, playful drops</sub> | <img src="library/gifs/motion/stretch-slide.gif" width="200"><br>**Stretch Slide** · `dynamic`<br><sub>Cards, chips, pills, fast UI moves</sub> |
| <img src="library/gifs/motion/punch-zoom.gif" width="200"><br>**Punch Zoom** · `medium`<br><sub>Footage, precomps, freeze frames, cut emphasis</sub> |   |   |   |

### Text (9)

Per character or per word, on text layers. `SSP.applyText(layer, name, "in" | "out" | "both")`

|   |   |   |   |
|---|---|---|---|
| <img src="library/gifs/text/chars-rise.gif" width="200"><br>**Chars Rise** · `medium`<br><sub>Short headlines, names, kickers</sub> | <img src="library/gifs/text/words-fade-up.gif" width="200"><br>**Words Fade Up** · `soft`<br><sub>Phrases, captions, quotes</sub> | <img src="library/gifs/text/blur-words.gif" width="200"><br>**Blur Words** · `soft`<br><sub>Premium moments, calm intros</sub> | <img src="library/gifs/text/tracking-settle.gif" width="200"><br>**Tracking Settle** · `medium`<br><sub>All-caps titles, typographic logos</sub> |
| <img src="library/gifs/text/chars-pop.gif" width="200"><br>**Chars Pop** · `dynamic`<br><sub>Social, hype, big numbers</sub> | <img src="library/gifs/text/typewriter.gif" width="200"><br>**Typewriter** · `medium`<br><sub>Captions, terminals, UI, quotes</sub> | <img src="library/gifs/text/scramble.gif" width="200"><br>**Scramble** · `dynamic`<br><sub>Tech, data, HUD labels, reveals</sub> | <img src="library/gifs/text/count-up.gif" width="200"><br>**Count Up** · `medium`<br><sub>Stats, KPIs, prices, counters</sub> |
| <img src="library/gifs/text/words-slam.gif" width="200"><br>**Words Slam** · `dynamic`<br><sub>Punchy statements, social hooks, VO beats</sub> |   |   |   |

### Effects (9)

Continuous loops driven by expressions. `SSP.applyFx(layer, name)`

|   |   |   |   |
|---|---|---|---|
| <img src="library/gifs/fx/float.gif" width="200"><br>**Float** · `soft`<br><sub>Idle icons and cards, living backgrounds</sub> | <img src="library/gifs/fx/wiggle-rotate.gif" width="200"><br>**Wiggle Rotate** · `medium`<br><sub>Stickers, illustrations with personality</sub> | <img src="library/gifs/fx/pulse.gif" width="200"><br>**Pulse** · `medium`<br><sub>CTAs, buttons, attention grabbers</sub> | <img src="library/gifs/fx/jitter.gif" width="200"><br>**Jitter** · `dynamic`<br><sub>Social, glitch, high-energy pieces</sub> |
| <img src="library/gifs/fx/breathe.gif" width="200"><br>**Breathe** · `soft`<br><sub>Ambient glows, background shapes, calm idle states</sub> | <img src="library/gifs/fx/swing.gif" width="200"><br>**Swing** · `soft`<br><sub>Hanging tags, badges, signs, pendulums</sub> | <img src="library/gifs/fx/orbit.gif" width="200"><br>**Orbit** · `soft`<br><sub>Dots and satellites around a logo, decorative loops</sub> | <img src="library/gifs/fx/shake.gif" width="200"><br>**Shake** · `dynamic`<br><sub>Impacts, bass hits, alarms, energetic footage</sub> |
| <img src="library/gifs/fx/holo-flicker.gif" width="200"><br>**Holo Flicker** · `medium`<br><sub>HUD labels, tech overlays, holographic UI</sub> |   |   |   |

### Recipes (9)

Behavior measured from reference animations and rebuilt with our own keyframes. `SSP.applyRecipe(layer, id, "both")`

|   |   |   |   |
|---|---|---|---|
| <img src="library/gifs/recipe/calibration-w3l.gif" width="200"><br>**W3L** · `dynamic`<br><sub>position & rotation & scale · loop</sub> | <img src="library/gifs/recipe/calibration-4lc.gif" width="200"><br>**4LC** · `dynamic`<br><sub>position & rotation · transition</sub> | <img src="library/gifs/recipe/calibration-d2t.gif" width="200"><br>**D2T** · `dynamic`<br><sub>position · loop</sub> | <img src="library/gifs/recipe/calibration-2jk.gif" width="200"><br>**2JK** · `medium`<br><sub>rotation · loop</sub> |
| <img src="library/gifs/recipe/calibration-1df-unu.gif" width="200"><br>**1DF+UNU** · `dynamic`<br><sub>scale · loop</sub> | <img src="library/gifs/recipe/calibration-x9r.gif" width="200"><br>**X9R** · `medium`<br><sub>opacity & scale · transition</sub> | <img src="library/gifs/recipe/calibration-pe6.gif" width="200"><br>**PE6** · `medium`<br><sub>position · transition</sub> | <img src="library/gifs/recipe/calibration-4vw.gif" width="200"><br>**4VW** · `dynamic`<br><sub>position & scale · transition</sub> |
| <img src="library/gifs/recipe/calibration-2jv.gif" width="200"><br>**2JV** · `dynamic`<br><sub>scale · transition</sub> |   |   |   |
<!-- catalog:end -->

### Pick by energy

Every preset has an **energy** level, so you can choose by the tone of the piece:

| Energy | Use it for | Examples |
|---|---|---|
| `soft` | Corporate, UI, premium, calm | Fade, Blur In, Words Fade Up, Float, Breathe, Swing, Orbit |
| `medium` | Most brand work | Slide Land, Flip In, Organic Draw, Punch Zoom, Chars Rise, Typewriter, Count Up, Pulse, Holo Flicker |
| `dynamic` | Social, hype, launches | Scale Pop, Slam In, Spin Pop, Drop Bounce, Stretch Slide, Words Slam, Scramble, Chars Pop, Jitter, Shake |

![Filtering the library by energy](docs/screens/visualizer-dynamic.png)

*The visualizer filtered to `dynamic`. Filters can be linked: `index.html?kind=text&energy=soft`.*

## The library in use

Real pieces animated only with library presets and tokens, with no hand-set keyframes:

| A Figma slide, animated | The S-mark intro |
|---|---|
| ![Figma slide](docs/examples/use-figma-slide.gif) | ![S-mark intro](docs/examples/use-icon-intro.gif) |
| The *Essentials* slide rebuilt in AE: title `Arrive` + `Land`, image cards `Stage` + `Land` with a stagger, chips scaling in one by one, the coral chip with `Pop` | Outline draws on (`Sweep` + `Cruise`), fill lands with `Pop`, tagline `Arrive` + `Land`, chained `Launch` exit |
| **Motion presets side by side** | **Effects running as loops** |
| ![Presets grid](docs/examples/use-presets-grid.gif) | ![FX loops](docs/examples/use-fx-loops.gif) |
| Same element, different presets: compare timing and energy at a glance | `Float`, `Wiggle Rotate`, `Pulse`, `Jitter` on the same shape |
| **Text and tracking on video** | **Holographic HUD on tracked points** |
| ![Text tracking](docs/examples/text-tracking.gif) | ![HUD](docs/examples/hud-test.gif) |
| `Chars Rise`, `Tracking Settle` and callouts pinned to points tracked with OpenCV | `SSHUD` brackets, callouts, meter and chip, all animated with library presets |

## How it works

![How it works](docs/screens/how-it-works.png)

All timing comes from the Superside motion tokens: **6 durations** and **7 easing curves** (`tokens/superside_motion_tokens.json`). Presets never hard-code a speed: they ask for `Arrive` + `Land`, so the whole library stays consistent and can be retuned in one place.

![Durations and easing curves](docs/screens/tokens.png)

## How to use it

### Designers (in After Effects)

<img src="docs/screens/ae-panel.png" width="380" align="right" alt="SS Motion panel in After Effects">

1. Install the brand fonts from `assets/fonts/` (right-click › Install) and restart AE.
2. **Open the panel:** *File › Scripts › Run Script File…* → `tools/ss_panel.jsx`.
3. **Browse** `library/index.html` to choose a preset (filter by category and energy).
4. **Select layers → pick the preset → Apply.** Choose `in`, `out` or `both`, and a stagger for several layers. Tabs: Motion, Text, Effects, Recipes.
5. **Tweak freely:** the result is plain keyframes and expressions on your layers.

<br clear="right">

### LLM agents (Claude Code or any local model)

The skill in `.claude/skills/ss-motion-library` explains everything. The short version:

1. **Read `library/INDEX.txt`**: one line per preset (`kind|name|channels|energy|use`) plus the calls, tokens and tools. The HTML and GIFs are for humans only.
2. **Write a job** in `tools/`:
   ```js
   #include "ss_presets.jsx"
   (function () {
       var L = app.project.activeItem.layer("Title");
       SSP.applyText(L, "Chars Rise", "both");      // SSP.apply · SSP.applyFx · SSP.applyText · SSP.applyRecipe
       return "ok";
   })();
   ```
3. **Run it in the open AE** and read the answer (`OK`, or `ERROR` with the line number):
   ```bash
   bash tools/bridge.sh tools/my_job.jsx
   ```
4. **Render and review** through AE's own render queue (`tools/render_comps.jsx` + `tools/wait_files.sh`), then iterate.

Bigger pieces are data, not code: a scene (`tools/build_scene.jsx`) or a full edit (`tools/build_edit.jsx`) is described in JSON and rebuilt in one call. See the showcase at the end.

## Tools

| Tool | What it does |
|---|---|
| `tools/ss_motion_lib.jsx` (`SSM`) | Token-driven keyframes: `animate`, `pop`, `recoil`, `animateBezier`, `animateStops`, `organicStops` (hand-drawn rhythm), `font(role)` |
| `tools/ss_presets.jsx` (`SSP`) | The presets: `apply`, `applyFx`, `applyText`, `applyRecipe` |
| `tools/ss_panel.jsx` | Designer panel |
| `tools/bridge.sh` + `tools/ss_bridge.jsx` | Runs `.jsx` jobs in the open AE from the terminal |
| `tools/ss_hud.jsx` (`SSHUD`) | Holographic overlays on tracked points: bracket, callout, meter, chip, contour, face scan, floating panel |
| `tools/track_points.py` | OpenCV point tracker → JSON for AE nulls (`--regions regions.json`) |
| `tools/matte_contours.py` | Per-frame subject contours from an AI matte (`--subjects`, `--split-x`) |
| `tools/build_scene.jsx` | Scene from JSON: plate, tracking, matte, text behind people, HUD |
| `tools/build_edit.jsx` | Edit from JSON: cuts, freeze frames with kinetic type, VO, music ducking, SFX, end card |
| `tools/build_breakdown.jsx` | 2×2 roto breakdown (plate · matte · contours · composite) |
| `tools/build_app_screen.jsx` | Browser-window recording of the visualizer, rebuilt from screenshots |
| `tools/render_comps.jsx` | Renders comps through the open AE's render queue |
| `tools/ss_assets.jsx` (`SSA`) + `tools/index_assets.py` | Local asset packs: index SFX/overlays by category and loudness, place them by name |

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
| `library/` | `INDEX.txt` (LLM), `library.json`, `recipes.json`, `index.html`, `gifs/`, `posters/` |
| `tools/` | JSX library, panel, bridge, HUD, scene/edit builders, harvest station, AC driver, render pipelines |
| `assets/` | Superside logos, S-mark shape for AE, palette and components from the *Essentials* Figma, brand fonts |
| `docs/` | `LEARNINGS.md`, case studies, screens and examples |
| `ae/` | Test project |
| `media/` | AI test footage, mattes, tracking data, music and VO for the showcases |
| `research/` | Calibration, harvests, preview catalog |

## Requirements

Windows · After Effects 2026 · Python 3 with `numpy`, `opencv-python`, `scipy`, `Pillow` · `ffmpeg` on the PATH · Git LFS.
The repo can be cloned anywhere: scripts compute the repo root (`SS_ROOT`) from their own location. Run the `.jsx` files from `tools/` (don't copy them into AE's *ScriptUI Panels* folder).

## Notes

- If a project contains Animation Composer layers, `aerender` hangs: render through `tools/render_comps.jsx` / `tools/render_queue.jsx` (the open AE's queue). AE shows "Not Responding" while a scripted render runs; that is expected.
- Brand fonts (Inter Tight and Instrument Serif, OFL) are picked with `SSM.font("display" | "ui" | "ui_regular")`, falling back to Georgia/Arial.
- Rebuilding a scene comp removes it from every comp that nests it; `build_scene.jsx` rebuilds the breakdown automatically, and `build_edit.jsx` should run after it.

## Documentation

- [`docs/LEARNINGS.md`](docs/LEARNINGS.md) — everything we learned: driving AE from an LLM, ExtendScript pitfalls, rendering, AI footage with Flora, tracking/roto/overlays, typography, audio, repo hygiene and costs.
- [`docs/case-studies/the-1974-boardroom.md`](docs/case-studies/the-1974-boardroom.md) — the showcase below, step by step, with prompts.

---

## Tests and showcases

### *The 1974 Boardroom* (45 s)

A capability test built end to end by Claude with this repo, to show the team what the library can do: three consistent AI shots of the two project collaborators (Flora: Nano Banana Pro + Kling 3.0 Pro), OpenCV tracking, AI roto mattes (VEED), organic hand-drawn contours, face scans, titles behind the people, a holographic HUD built from library presets, **freeze frames with kinetic type**, a 70s announcer voiceover (ElevenLabs v3), a soul-funk score ducked under the VO, a roto breakdown, and the library app itself. Full video: [`docs/examples/whisky_1974_boardroom.mp4`](docs/examples/whisky_1974_boardroom.mp4).

| "Zero keyframes." | "Tracked." | "Rotoscoped." |
|---|---|---|
| ![Zero keyframes](docs/examples/reel-freeze-keyframes.gif) | ![Tracked](docs/examples/reel-freeze-tracked.gif) | ![Rotoscoped](docs/examples/reel-freeze-rotoscoped.gif) |

| The library, in the office | Roto breakdown |
|---|---|
| ![Library app](docs/examples/reel-library-app.gif) | ![Breakdown](docs/examples/whisky-breakdown.gif) |

| Shot 1 · two-shot | Shot 2 · subject 01 | Shot 3 · subject 02 |
|---|---|---|
| ![Two-shot](docs/examples/whisky-two-shot.gif) | ![Aaron](docs/examples/whisky-aaron.gif) | ![Gian](docs/examples/whisky-gian.gif) |

Everything is data-driven: `media/whisky/scenes.json` (shots, app screen, breakdown) and `media/whisky/edit.json` (cut, freezes, VO, music, SFX, end card):

```bash
bash tools/bridge.sh tools/build_scene.jsx     # scenes + app screen + breakdown
bash tools/bridge.sh tools/build_edit.jsx      # the edit
```

### Earlier tests

| Text behind the subject |
|---|
| ![Text behind](docs/examples/text-behind-subject.gif) |
| Giant title between background and person, using an AI person matte |

Test comps in `ae/motion_lab_v01.aep`: `01_SS_Icon_Intro` (S-mark draw-on), `02_Track_70s` (tracked points and callout), `03_Figma_Chips` (*Essentials* slide with tokens), `04_Text_Tracking_70s`, `05_Text_Behind_70s`, `HUD_TEST`, and the `WHISKY 1974` folder.

People in `media/` and the showcases are project collaborators (Aaron Amortegui and Gian Orsi) who agreed to be used as test subjects. Prices, bottlings and roles are fictional.
