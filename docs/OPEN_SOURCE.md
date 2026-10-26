# Open-source engines in Motion DNA

Twenty projects were reviewed on 2026-10-26 to feed the library. Each one is used for what it does best,
pinned to a version, with its license next to it. Nothing here was decrypted or modified; libraries load unmodified
(vendored with their license file, or from jsdelivr at a pinned version).

## In the plugin (MCP tools the Agent and Claude use)

Everything here runs on Mac and Windows with no GPU install: the web libraries run in the installed Chrome or Edge
(Playwright, which setup checks), faster-whisper falls back to the CPU. Anything that needs a GPU-specific install stays
in research.


| Project | Version · license | What it gives Motion DNA | Where |
|---|---|---|---|
| [Tone.js](https://github.com/Tonejs/Tone.js) | 15.1.22 · MIT (vendored) | **Sound by default.** A synthesised SFX kit (whoosh, swish, pop, tick, click, hit, riser, sub, chime, shimmer, type, glitch) and temp beds. `add_sound` reads the comp (cuts, big moves, pops, text, `sfx:` markers), gives each action its sound one frame after the picture, rotates takes, and adds one layer *Motion DNA sound*. | `tools/sound/`, `tools/sound_kit.py`, `tools/sound_events.jsx`, MCP `add_sound`; listen at `tools/sound/kit.html` |
| [react-spring](https://github.com/pmndrs/react-spring) | 10.1.2 · MIT (values) | The six spring presets (default, gentle, wobbly, stiff, slow, molasses) as curves + AE expressions. | `tools/springs.py` → `library/springs.json`, MCP `apply_spring` |
| [anime.js](https://github.com/juliangarnier/anime) | 4.5.0 · MIT (formulas) | Its spring (bounce + perceived duration) and named eases (outBack, outElastic, outBounce, outExpo, inOutCirc). Our tokens overshoot about 8 % at most; these reach 37 %. | same |
| [matter.js](https://github.com/liabru/matter-js) | 0.20.0 · MIT (vendored) | 2D physics baked to Position + Rotation keys: fall, drop in, burst. | `tools/physics/`, `tools/physics_bake.py`, MCP `physics` |
| [gl-transitions](https://github.com/gl-transitions/gl-transitions) | 2.0.0 · MIT/BSD per shader (vendored) | 74 shader transitions (49 hard wipes, 25 soft) as luma mattes between two layers, on a token curve. | `tools/gl_transitions/`, `tools/gl_matte.py`, `library/gl_transitions.json`, MCP `gl_transition` |
| [tsParticles](https://github.com/tsparticles/tsparticles) | 4.5.0 · MIT (CDN) | Confetti and fireworks with alpha. | `tools/web_fx/confetti.html`, `fireworks.html`, MCP `add_fx` |
| [PixiJS](https://github.com/pixijs/pixijs) | 8.22.0 · MIT (CDN) | Additive spark bursts from a layer. | `tools/web_fx/sparks.html` |
| [paper.js](https://github.com/paperjs/paper.js) | 0.16.0 · MIT (CDN) | Hand-drawn annotations around a layer (circle, underline, cross, arrow, box), boiling on twos. | `tools/web_fx/scribble.html` |
| [p5.js](https://github.com/processing/p5.js) | 2.3.4 · **LGPL-2.1** (CDN only, never copied) | A calm flow-field background. | `tools/web_fx/flowfield.html` |
| [OGL](https://github.com/oframe/ogl) | 1.0.11 · Unlicense (CDN) | A living mesh gradient in token colours, looping. | `tools/web_fx/gradient.html` |
| [three.js](https://github.com/mrdoob/three.js) | r186 · MIT (CDN) | The DNA helix in real 3D; a glTF product turntable. | `tools/web_fx/helix3d.html` |
| [Rapier](https://github.com/dimforge/rapier) | 0.21.0 · Apache-2.0 (CDN) | 3D physics: shapes rain and pile up with shadows. | `tools/web_fx/drop3d.html` |
| [glTF-Transform](https://github.com/donmccurdy/glTF-Transform) | 4.5.1 · MIT (npx) | Makes a product GLB light enough for the turntable (a 10.6 MB sample → 0.6 MB). | `tools/gltf_prep.py` |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | 1.2.1 · MIT (pip) | Word timings about 4x faster, voice-activity filtered; `vo_words.py` uses it and falls back to openai-whisper. | `tools/vo_words.py` |
| [OBS Studio](https://github.com/obsproject/obs-studio) | 33 · GPL-2.0 (the app, driven over its websocket) | Screen recording for UI demos, imported into AE on stop. | `tools/obs_record.py`, MCP `record_screen` |
| [FFmpeg](https://github.com/FFmpeg/FFmpeg) | 8.1 · LGPL/GPL (the binary) | Already everywhere: encoding, loudness, mattes, previews. | — |

How the web libraries render: `tools/web_capture.py` opens a page in the installed Chrome through Playwright,
installs a **virtual clock** and a seeded `Math.random`, and advances one frame at a time, so libraries made for
real-time screens (tsParticles, Pixi, p5, three.js) give the same frames on any machine, with alpha (ProRes 4444).
Catalogue: `library/web_fx.json`; renders are cached in `renders/web_fx/`.

## In research (not in the plugin yet)

| Project | Version · license | Use | Where |
|---|---|---|---|
| [Chatterbox](https://github.com/resemble-ai/chatterbox) | 0.1.7 · MIT | Local voices: TTS in 23 languages and speech-to-speech into a reference voice (what we paid fal for). Kept out of the plugin: it needs a separate ~3-4 GB install matched to an NVIDIA GPU, and most of the team works on Macs. Consent first; output is watermarked. | `research/voice/voice_setup.py`, `voice_local.py` |
| [HyperFrames](https://github.com/heygen-com/hyperframes) | 0.8.203 · Apache-2.0 (npm, pinned) | HTML → deterministic MP4 with ~450 registry blocks. Our bridge maps the registry's token contract to our colours and fonts, registers our 14 curves as GSAP eases (`mdna.Land`…) and lays our sound under the render. | `research/hyperframes/` (`hf.py`, `catalog.json`) |

## Reviewed, not built on

| Project | Why |
|---|---|
| [Remotion](https://github.com/remotion-dev/remotion) | Its license (not open source) is free only for individuals and companies up to 3 people; Superside would need a company license, internal use included. HyperFrames covers the same ground (and its `/remotion-to-hyperframes` skill converts Remotion projects). If a license is bought, a bridge like `research/hyperframes/hf.py` takes an afternoon. |
| [OpenCut](https://github.com/OpenCut-app/OpenCut) | A CapCut-style editor (MIT): we edit in After Effects, so it adds no capability. Reference for caption and timeline UX only. |
