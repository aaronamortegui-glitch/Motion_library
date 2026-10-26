# The library guide: what it shows, and the plan to show everything

`library/guide.html` is the window on everything Motion DNA can do. If something exists underneath (a tool, an engine,
a workflow), it has a place here with an example that plays; if a capability is promised here, it exists underneath.
Built by `tools/build_library_guide.py` from the library's own data, in the deck's language (Motion_DNA_Deck),
gallery first: many pieces on screen, few words.

## Structure (four groups in the top menu, numbered sections inside)

| Group | Section | Shows | Source of truth | Status |
|---|---|---|---|---|
| Library | Moves | 49 presets + 11 loops on the robot head | `library/library.json` | done |
| | Text | 11 presets + 9 text animations, "DNA" | `library.json`, `kit.json` | done |
| | Curves | 14 token curves + the springs and named eases (react-spring, anime.js) drawn the same way | tokens, `library/springs.json` | done |
| | Styles | 9 style scenes (people kept whole) | `library/packs.json` | done |
| | Kit | transitions, elements, shapes, looks, backgrounds, behaviours, 3D moves | `kit.json`, `transitions.json` | done |
| Create | Effects & 3D | code engines rendered as After Effects assets: confetti, fireworks, sparks, scribble, flow field, gradient, the DNA helix in 3D, 3D shapes that pile up; 2D physics; all 73 shader transitions; a 3D turntable (The Agent's head, modelled in code: `tools/make_robot_glb.py`) | `tools/web_fx/`, `physics`, `gl_transitions` | done |
| | Characters | The Agent: sheet, 13 emotions, poses, acts; the pixel kit (Figma → After Effects) and lipsync | `library/characters/`, `tools/character_kit.py` | done |
| | Made in code | 15 video templates (showreel, SaaS launch, morph UI, infinite zoom, kinetic type, storybook, timeline, data story, particles, shader hero, liquid wipe, logo reveal, install tutorial, pixel character, agent promo) + HyperFrames blocks restyled to our colours and fonts (`research/hyperframes/render_blocks.py`) | `research/video_prompts/`, `research/hyperframes/` | done |
| | Sound | the sound kit: whoosh, swish, pop, tick, click, hit, riser, sub, chime, shimmer, type, glitch, each playable | `tools/sound/` | done |
| Workflows | Techniques | 10 techniques, each with a moving example | `library/techniques.json`, `tools/technique_clips.py` | done |
| | Apps | Figma (storyboard → AE, mark AI, QA), the agent (ask, refine and render, resize, check), the panel (create or modify, curves, prompt library), brands that learn and travel, connecting apps | panel + MCP | done (+ Blender: `research/platforms/blender/robot_scene.py`; a video as reference) · next: Flora and Krea generations (they spend credits: asked first) |
| Ask | Prompts | the most used orders, each with its reference and example | `library/prompts.json` | done |
| | Glossary | 36 motion words with live demos | `library/glossary.json` | done |
| | Use it | panel, agent chat, Claude Code | — | done |

## New underneath, made for this

- **Characters ready to animate** (`tools/character_kit.py`, MCP `add_character`, `lipsync`): a pixel character's layers
  exported from its file; drawn in Figma as editable pixel rectangles; built in After Effects with crisp pixels; its
  mouth keyed from a voice line (word timings or the voice's loudness; Rhubarb shapes A-H, X). No GPU, nothing to install.

## Rules

- Every piece plays an example from our own material; nothing the same clip twice; no placeholders ("Shot A / B").
- What needs a strong NVIDIA GPU (face refinement, local voices, matte on GPU) is left out of the guide.
- The style is the deck's: grounds, Inter Tight and Instrument Serif, Spark accents, motion on the token curves.
- Run `python tools/check_previews.py` and look at every section at 1920 × 1080 and on a phone before pushing.
