# Code-rendered video templates · pilot (2026-10-19)

Research outside the plugin: can the Opus 5.5 "videos written as code" prompts
([awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos)) become a Motion DNA library of
video templates that Claude renders to MP4 assets or rebuilds in After Effects?

**Short answer: yes.** Twelve archetypes were rebuilt as our own templates, rendered frame by frame to video, two of
them were also rebuilt natively in AE, and every piece follows the Motion DNA tokens.

## What is here
| Path | What |
|---|---|
| `build_index.py` → `index.json`, `INDEX.md` | The 703 source entries, categorized: our use tags, output route, tech, prompt quality, language, duplicates, real-brand flag. Metadata and links only. |
| `source/` (git-ignored) | The third-party prompt texts (MIT collection; each prompt belongs to its creator). |
| `runtime/mdna.js` | The template runtime: Motion DNA colours, fonts, the 14 token curves and durations, `seg`/`k` tweens, a seeded random, 2D drawing helpers. A template is `MDNA.scene({duration, alpha, render(t)})`, a pure function of time. |
| `html_to_mp4.py` | Renders a template frame by frame with Playwright: H.264 MP4, or ProRes 4444 with alpha when `alpha: true`; `--notext` renders the plate of a hybrid template. Identical output on any machine. |
| `templates/*.html` + `templates/catalog.json` | The 12 pilot templates; each card has uses, route, energy, tones, duration, variables and **our own rewritten prompt** (the brief Claude follows to make a new version). |
| `ae/route_b.jsx` | Native AE rebuilds of T05 and T12 with the Motion DNA text engine (`SSTX`) and token curves. |
| `renders/` (git-ignored) | The pilot renders and posters. |

## The source, categorized (heuristic first pass)
- 703 entries: motion 369 · 3D 117 · explainer 116 · interactive 101 (games: not video templates).
- Prompt quality: 140 full (≥ 400 chars) · 244 medium · 112 short · 207 partial. 115 are in Chinese/Japanese, and
  several authors reuse the same prompt (grouped as `dup_of`).
- Most prompts are "make something amazing" briefs that point to a real brand, real screenshots and music. Their value
  is the **archetypes** (showreel on the beat, launch film, one shape becomes the UI, infinite zoom, kinetic type,
  character explainer, timeline, data story, particle world, shader hero, liquid wipe, logo reveal), not the text.
- License: the collection is MIT, but each prompt was written by its creator on X. We treat them as behavioral
  references (like Animation Composer): we keep the link and tags, and write our own templates.

## Pilot results
| # | Template | Route | Length | Render time | Notes |
|---|---|---|---|---|---|
| T01 | Showreel on the beat | A | 15 s | 49 s | 7 scenes, a cut on every beat (120 BPM), one-frame accent flash. |
| T02 | SaaS launch | C | 14 s | 129 s (+ plate) | Hook, dashboard assembles, cursor, feature pills, end card. `--notext` gives the plate. Gradients make it the slowest. |
| T03 | One shape becomes the UI | B | 12 s | 58 s | One rounded rect keyed through 5 states; maps 1:1 to one AE shape layer. |
| T04 | Infinite zoom | A | 12 s | 55 s | Log-scale camera from a dot to the desktop, out to a point in space, into a phone. |
| T05 | Kinetic typography | B (and A) | 10 s | 39 s (ProRes 4444) | Rebuilt natively in AE: 4 text layers, words rise into a mask on Land, key words in spark. |
| T06 | Storybook explainer | C | 15 s | 92 s | Character with eyes and moods, 3 scenes (parallax, squash, the leaf lights up). |
| T07 | Timeline | C | 12 s | 53 s | Line draws with the playhead, cards pop per milestone, pull-back at the end. |
| T08 | Data story | C | 12 s | 41 s | 100 dots: waffle → highlight → bars → counter. |
| T09 | Particle world | A | 10 s | 69 s | 14k projected particles, day → dusk → day, seamless loop. |
| T10 | Shader hero | A | 8 s | 40 s | Ray-marched object, soft shadow, spark rim, turntable; WebGL on CPU (SwiftShader) is fine. |
| T11 | Liquid wipe | A (alpha) | 1.2 s | 5 s | Covers at 0.6 s; ProRes 4444 overlay to drop on a cut. |
| T12 | Logo reveal | B (and A) | 5 s | 18 s (ProRes 4444) | Rebuilt natively in AE: 3 shape layers on Wind-up / Whip / Settle, Pop lock, wordmark chars rise. |

Rendering runs at roughly 3-9× real time on this machine (CPU), with no page errors. All 12 frames were checked on
contact sheets; two fixes came out of it: T04 now shows the desktop as a glowing point among the stars and its title
no longer sits on the dot, and T05's last line no longer runs past the 10 s end.

## What the routes taught us
- **A · render to an asset** is the right home for what AE does badly or slowly: 3D point clouds, shaders, long
  camera moves through a code-drawn world (T04, T09, T10) and alpha overlays (T11). The file goes into AE with
  `add_asset` like any footage.
- **B · native AE** works when the piece is type or a few shapes (T05, T12): each took one script on top of `SSTX` and
  token curves, and the text stays editable. Many B archetypes already exist in the kit (the text engine, the liquid
  and solid transitions, `end_card`), so B should **map to the kit first** and only add code for what is missing.
- **C · hybrid** (explainers, launches, data stories): the plate renders without text (`--notext`) and the copy goes
  live in AE with Motion DNA text presets, so the brand team can edit it. The flag is implemented and the T02 plate
  was rendered; assembling a C template in AE is the next step.

## Limits found
- **Sound effects: yes (2026-10-26); a beat map from a real track: not yet.** A template can declare `sound` in
  `MDNA.scene` (cues read from its own timing, as `t05_kinetic_type` does) and `python tools/sound_kit.py --template
  <t> --mux <render>` lays the Tone.js kit under the render. Cutting on the beats of a real track is still to do
  (HyperFrames' `beats` command does it; see research/hyperframes).
- **No real brands or screenshots.** The source prompts often pull a real product's assets; our templates draw the UI
  as shapes and use fictional names, per the repo rules.
- Heavier three.js scenes would run slowly on the CPU renderer; if needed, render with the GPU.
- Not yet compared side by side with the Skillry remakes of the same prompts.

## Round 2 (review: "they look basic, add more detail"; compare with the remakes)
- The Skillry remakes are published as MP4 only (no code to recolour), so `compare.py` puts our render next to the
  remake of the same prompt with a **gradient map in the Motion DNA palette** (Hald CLUT by luminance: ink → pine →
  sea → mint → spark → cloud): form, density and detail compare without the colour. Output `renders/compare_reel.mp4`.
- What the remakes have that ours lacked: content density (kickers, meta text, real numbers, several layers at once),
  finish (grain, glow, vignette, light), type hierarchy (tracked kicker + sans headline + serif-italic accent) and
  illustration (a sun with a particle corona and live counters, an illustrated poster timeline).
- Runtime finish added (`finish`, `glow`, `rich`, `kicker`) and a motion-blur option in the renderer (`--mblur N`).
- Rewritten with more detail: T01 (HUD with timecode and scene counter, rings on the beat, area chart with labels,
  serif title), T03 (app window, shadows, state labels with step dots, icons), T06 (corona sun, light trail,
  annotation, live counters, three cloud depths, splash, layered sunrise), T07 (halftone paper, giant serif year,
  chapter illustrations, "today" stamp, tilt), T08 (legend, leader-line annotation, bar values, counter), T09 (sea of
  light with the sun's road, a Ferris wheel of light, ribbons, horizon glow).
- Cost: motion blur with 3 sub-frames took ~17 min per 15 s clip (PNG decode/average in Python); it also ghosts
  discrete swaps (a word changing on a beat shows both words). Next: accumulate sub-frames inside the page and only
  blur continuous moves.

## Proposed next steps
1. Review the renders together and pick which templates are good enough to keep.
2. Have Claude classify all 703 entries (energy, tones, use) instead of the keyword heuristic, and propose the next
   batch of archetypes.
3. Add audio: a beat map from a track (or a token tempo) drives cuts in A and markers in B and C.
4. Assemble one hybrid (T02 or T07) end to end in AE: plate plus live text with presets.
5. When it is solid, bring it into the plugin through CONTRIBUTING §11: templates as a new library family, an MCP
   tool (`render_template` → `add_asset`), tags, previews and the `check_previews` gate.
