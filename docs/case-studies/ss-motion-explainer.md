# Case study: *SS Motion Library · internal explainer* (68 s)

The video that explains this repo to Superside: why AI-made motion looks generic, how our own curves and categories avoid that, the plugin, marker retiming, Claude driving the library through MCP, the techniques each test leaves behind, and refining by hand. **It is built with the library itself**: every element on screen is animated by an SS Motion preset. Final video: [`docs/examples/ss_motion_explainer.mp4`](../examples/ss_motion_explainer.mp4).

## Storyboard (Figma)
File *slack_video*, page **motion pluguin**: <https://www.figma.com/design/OGiHZakKWL9iUXUJ8rn7Ko/slack_video?node-id=70-2>. It follows the format of the earlier storyboards in that file: a header (specs, story, music) and, per scene, a 1920×1080 frame plus a notes card with the time, VO, on-screen text and **which preset animates each element**. Real screenshots fill the frames (uploaded with the Figma MCP `upload_assets`).

| # | Scene | VO |
|---|---|---|
| S01 | Hook | Most AI animation looks the same. Same curves, same moves, same template. |
| S02 | Our own curves | So we started from our own timing: six durations and ten curves, tuned to how Superside moves. |
| S03 | Categories and styles | Every move lives in a category, with an energy. And packs give a whole video one identity, in one click. |
| S04 | The plugin | Inside After Effects, the panel shows each preset live. Pick it, then apply in, out, or both. |
| S05 | Markers | Drag a marker to retime it. The curve keeps its shape. |
| S06 | Claude drives it | Claude drives the same library: it picks presets, applies packs, and checks its own work, frame by frame. |
| S07 | Techniques | Every test leaves a technique behind: tracking, roto, kinetic type, speed ramps. Any style can use them. |
| S08 | Refine by hand | And it's all native keyframes, so designers can refine every move by hand. |
| S09 | Close | Motion that looks like Superside. Not like AI. SS Motion Library. |

## How it is built
| Step | Tool / file |
|---|---|
| Panel recording (GIF + MP4) | panel hook `SS_PANEL.tab/select` on scheduled tasks + `PrintWindow` capture at 8 fps → `docs/screens/ae-panel.gif`, `media/explainer/panel_rec.mp4` |
| Stills | visualizer and tokens screens, AE timeline with SS in / SS out markers (a pack applied with marker timing), reel frames → `media/explainer/` |
| Storyboard | Figma (`use_figma` + `upload_assets`) |
| Specs | `media/explainer/make_specs.py` → `explainer.json` (Figma coordinates, element types, presets, times) + `edit.json` |
| Scenes | `tools/build_explainer.jsx`: text, pills, cards, rounded media and markers, each a precomp so any preset moves it as one piece |
| Edit | `tools/build_edit.jsx` (VO in each scene's own time, music ducked under VO, whooshes on cuts) via `tools/build_explainer_all.jsx` |
| Audio | ElevenLabs v3 (9 lines, Adam, stability 0.35, `atempo 1.05`), ElevenLabs Music (minimal electronic, `atempo 0.88` to fit 68 s) |
| Render + QA | `tools/render_comps.jsx`, stills with `saveFrameToPng`, loudness about −16 LUFS |

## Costs (USD)
| Item | Count | Cost |
|---|---|---|
| ElevenLabs v3 VO line | 9 | 1.09 |
| ElevenLabs Music | 1 | 0.36 |

## Notes
- The Figma frames and the AE comps share coordinates (1920×1080), so the storyboard is the layout spec: positions in `make_specs.py` are copied from Figma.
- Figma does not render an animated GIF fill in screenshots; use a still for the storyboard and the GIF in the repo.
- SVG logos are rasterized with headless Edge (`--default-background-color=00000000`) for AE.
