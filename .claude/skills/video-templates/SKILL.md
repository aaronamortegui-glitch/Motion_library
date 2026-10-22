---
name: video-templates
description: Make motion-graphics videos as code with Motion DNA's video templates (research/video_prompts, not part of the plugin yet) and bring them into After Effects. Use when asked for a showreel, a SaaS or product launch film, a UI demo where one shape becomes the interface, an infinite zoom, kinetic typography, a character explainer, a timeline, a data story, a particle loop, a shader hero shot, a liquid transition or a logo reveal, or when someone wants a "video made with code" (Opus-style HTML/canvas animation) rendered to MP4/MOV as an asset, rebuilt natively in AE, or both.
---

# Motion DNA video templates (research)

**Where the repo is.** Outside the Motion DNA clone (this skill is also linked into `~/.claude/skills` by
`tools/setup.py`), the clone's path is in `REPO_ROOT.txt` next to this file; every path below is relative to it.

Videos written as code: a page draws each frame as a pure function of time, a renderer screenshots it frame by frame
into an MP4 (or a ProRes 4444 MOV with alpha), and the file goes into After Effects. It lives in
`research/video_prompts/` and does not change the panel or the MCP. Read `research/video_prompts/REPORT.md` for what
works, what does not yet and why.

## Setup (once per machine)
```
pip install playwright numpy pillow
python -m playwright install chromium
```
ffmpeg must be on PATH (it already is for the rest of Motion DNA).

## Pick a template
`research/video_prompts/templates/catalog.json` lists the 12 archetypes: id, title, uses, **route**, energy (1 calm ..
5 explosive), tones, duration, `vars` (the content you change) and `prompt` (our own brief for making a new version).
Previews: `research/video_prompts/previews/<id>.gif`. Routes:
- **A · render as an asset**: 3D, shaders, particles, long camera moves, alpha overlays (t04, t09, t10, t11, t01).
- **B · native AE**: type and a few shapes stay editable (t05, t12, t03). Map to the existing kit first (`list_kit`:
  text engine `SSTX`, solid/liquid transitions, `end_card`); `research/video_prompts/ae/route_b.jsx` shows the pattern.
- **C · hybrid**: render the plate with `--notext`, set the copy live in AE with Motion DNA text presets (t02, t06, t07, t08).

## Make a version
1. Copy the template to a new file in `research/video_prompts/templates/` and change only `VARS` (copy, numbers,
   colours from the tokens). For a new archetype, follow the card's `prompt` and the runtime contract below.
2. Check frames before rendering: `python research/video_prompts/snap.py templates/<file>.html out.jpg 1 3 6 9` and look
   at the sheet (overlaps, text on busy areas, empty frames, a word cut by the end).
3. Render: `python research/video_prompts/html_to_mp4.py templates/<file>.html [--notext] [--mblur 3]` →
   `research/video_prompts/renders/<name>.mp4|.mov` (+ a poster PNG). `--mblur` multiplies render time ~3x per
   sub-frame and ghosts discrete swaps: use it only on continuous motion.
4. Into AE (MCP `run_jsx`): `$.evalFile(SS_ROOT + "/research/video_prompts/ae/import_render.jsx");
   return VP_IMPORT(SS_ROOT + "/research/video_prompts/renders/<name>.mov", "<comp>", <time_s>);`
   then `render_frame` and look at it, as with any other layer.

## Runtime contract (runtime/mdna.js)
- `MDNA.scene({ duration, alpha, background, render(t) })`: `render(t)` draws the frame at `t` seconds and depends on
  nothing else (no timers, no real clock, random only through `MDNA.rng(seed)`).
- Tokens: `MDNA.T.color` (pine, spark, cloud, sea, ink, mint, coral, sky), `MDNA.T.font` (Inter Tight, Instrument
  Serif), `MDNA.EASE[name]` / `MDNA.seg(t, a, b, "Land")` / `MDNA.k(t, keys)` with the 14 token curves.
- Finish and type: `MDNA.finish(g, t, {grain, vignette})`, `MDNA.glow(g, x, y, r, colour, a)`,
  `MDNA.rich(D, "Give your agent *taste.*", …)` (serif-italic accent), `MDNA.kicker(D, "Fig. 1", …)`, `D = MDNA.draw(canvas)`
  (txt, width, rr, fill, alpha, at, cursor). `MDNA.NOTEXT` is true when rendering a hybrid plate.

## Rules
- Motion DNA colours, fonts and curves only; fictional brands and names; never a real brand's logo or screenshots.
- The source collection and the Skillry remakes are third-party: `python research/video_prompts/fetch_sources.py`
  downloads them into `source/` (git-ignored). Use them as behavioral references; never copy a prompt text into the
  repo. `build_index.py` rebuilds `index.json`/`INDEX.md`; `compare.py` makes the side-by-side test with the remakes.
- Renders stay in `renders/` (git-ignored). A template worth keeping gets a preview GIF in `previews/` (< 500 KB) and a
  card in `catalog.json`.
- New lessons go to `docs/LEARNINGS.md` like everything else.
