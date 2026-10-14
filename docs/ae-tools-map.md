# After Effects tools map (aescripts.com → open source → Motion DNA)

About 607 commercial After Effects scripts and plugins listed on aescripts.com were grouped by what they do (behavior
only: nothing was downloaded, opened or copied). For each group: what Motion DNA covers today, the permissive
open-source projects that do the same job (all in `library/resources.json`, MCP `list_resources`), and what to build
ourselves. Checked 2026-10-14. On the marketplace, the most common tags are Automation, Animation, Utilities, Workflow and Text.

| Group | Paid examples | Motion DNA today | Open source (permissive) | Build ourselves |
|---|---|---|---|---|
| Keyframe easing and curve editors | Flow, EaseCopy, Ease and Wizz | covered (tokens, `keyframes`) | eKeys (vendored), bezier-easing, ae-temporal-to-cubic-ease | `copyEase` / `pasteEase` and velocity scaling in `ss_keyframes.jsx` |
| Timing, offset and sequencing | Rift, Shifter, Again! | covered (`keyframes`: stagger, sequence, shift) | — (popular collections have no license) | curve-weighted stagger orders, "repeat relative" |
| Comp and precomp management | True Comp Duplicator, Un-PreCompose, Auto Crop | **gap** | LST (Apache-2.0) | `ss_comps.jsx`: deep duplicate, un-precompose, recursive size/fps, crop to content |
| Reformat and versioning | CompResizer, CrossFrame, CompsFromSpreadsheet | partial | nexrender, style-parser | **reframe** a built comp to 9:16 / 1:1 / 4:5 from its roles, rerun `check_layout`, variants from CSV/JSON |
| Text animators and splitting | Textevo, DecomposeText, TextExploder | covered (`animate_text`: per char/word/line, token curves, flicker/wiggly, mask, decode; TX presets) | aefunctions (vendored) | split text into separate placed layers |
| Text boxes, highlights, callouts | TextBox, Box It!, MARKr | covered (`add_element`: label, lower third, title, underline, highlight, callout) | eBox | more kinds |
| Layout, alignment, grids | Flex, Pins & Boxes, Grid Builder | partial (`check_layout`) | LST | grid / bento / align, expression pins |
| Anchor and transforms | Move Anchor Point, Bake Parented Transform | covered (`anchor_point`, `bake`) | LST | flip, null per layer, world-space bake |
| Rigging and character | Limber, Joysticks 'n Sliders, Walker | **gap** | PseudoEffect, eSpring (Duik is GPL: excluded) | 2-bone IK, pose slider, squash and stretch, walk cycle |
| Procedural motion and physics | Newton, OverAct, Spring Ease | partial (overshoot curves, loops) | matter-js, planck.js, pymunk | physics bake to keyframes; loopable sway |
| Repeaters, cloners, effectors | Repeater, MographAE | partial (`add_shape` families: pops, shape row, fireworks, glitter) | eTractors, baffects.js | clones of any layer + falloff null |
| Shape and path tools | Explode Shape Layers, MagicMorphing, SVG2AE | partial | flubber, paper.js, svgpathtools, vtracer | explode shapes, matched morphs, full SVG import |
| Strokes and corners | Ouroboros, RoundPro | partial | eBox, paperjs-offset | per-corner radius, multi-trim stroke stacks |
| Counters and charts | Odometer, Graph Master | partial (`add_element`: counter, timer, progress, ring, rating) | d3-scale | `build_chart.jsx` (bar, line, donut) |
| Captions and audio markers | AutoCaption, VoxMark, AudioToMarkers | covered (`add_captions`: highlight, karaoke, build, pop, word; words or SRT) | srt, webvtt-py, Beat This! | — |
| Audio utilities | DuckFlow, Pause Cleaner | partial | auto-editor | `SSA.duck`, `SSA.fade` |
| Transitions | Transition Master, Luma Shifter, AlphaForge | covered (`apply_transition`, `solid_transition`: 9 solid/mask types + 4 clip-to-clip) | gl-transitions (via ISF4AE) | procedural luma mattes |
| Shader and stylize FX | Deep Glow, Pixel Sorter, ToneCraft | partial (`add_look`: tones, grain, scanlines, glitch; neon glow title) | ISF4AE, ISF-Files (native plugin: install per machine) | halftone, pixel sort |
| Gradients and colour | Cosmic, CHR0MA, Brand Keeper | partial (brands, tokens, `add_look` tritone/duotone, gradient backgrounds) | culori, chroma.js, color-thief | palette from a reference |
| 3D, camera, parallax | Parallaxer, Camera 3D Toolkit | partial (`move`: flip, hinge, orbit, fly, tumble) | — | camera + null rig with token eases |
| Render and delivery | RenderQ, GifGun, Social Exporter | covered (`render_comp`, `render_frame`) | nexrender | stills at markers, per-social render presets |
| Lottie and design bridges | Bodymovin, UXLink, SVG2AE | partial (Figma slides) | bodymovin, lottie-web, AEUX | SVG import, Lottie export of the library |
| Project QA and naming | PreFlight, Global Renamer, Spell Checker | partial (`check_layout`) | Typo.js, nspell, fontTools, get-ae-labels | **`preflight`** MCP tool: fonts, footage, off-token colours, spelling, expression errors |
| Expression tooling | Expressionist, Expression Kit | partial | expression-globals-typescript, after-effects-command-ids | expression scan, dropdown controls |
| Toolbars and preset libraries | KBar, Save Objects, InstantRecipe | covered (panel, library) | PseudoEffect | "save layer as recipe" into the library |
| AI agents in AE | AE GPT, MATE, Claude Scripter | covered (MCP + panel Agent) | other AE MCP servers (reference) | — (our edge: tagged library and brand memory) |

Out of scope by decision (2026-10-14): AI models that run outside After Effects (matting, interpolation, upscaling,
depth, separation) are listed as `reference_only`. Excluded for license: GPL/AGPL (Duik, RobustVideoMatting), non-commercial
(CoTracker, CorridorKey), no license (zl_Scriptlets, kyletmartinez scripts, ScriptUI Dialog Builder), and any repo
offering cracked commercial scripts.

## Ranked gaps worth building

1. Reframe and versioning (9:16, 1:1, 4:5 from the build roles, with `check_layout`).
2. Comp toolkit (deep duplicate, un-precompose, recursive settings) on LST.
3. ~~Captions builder~~ (done: `add_captions`).
4. `preflight` QA tool.
5. Rigging basics (IK, pose slider, squash and stretch) with PseudoEffect controllers.
6. Cloners and effectors.
7. Physics bake.
8. Charts and counters.
9. Text split into placed layers (the auto text box is done: `add_element`).
10. Shader FX through ISF4AE (after checking signing).
