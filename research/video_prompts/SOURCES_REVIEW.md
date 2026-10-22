# Source review · prompt, template and style libraries (2026-10-22)

Draft for decision. Nine outside sources were read against what Motion DNA already has (71 presets, 113 kit pieces,
46 transitions, 12 techniques, 9 style packs, 14 curves, 13 code-rendered templates, 703 indexed prompts). Internal use:
everything that can be tried is tried; what is not under a permissive license stays **local only** (a git-ignored
folder, as `source/` already does) and we write our own version for the repo.

## 1. The sources

| Source | What it is | Size | License | New to us |
|---|---|---|---|---|
| [yihui-dev/awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos) | Prompts of videos made as code | 703 | MIT (curation); prompts belong to their creators → local only | Already ingested; **0 changes** since 2026-10-19 |
| [prompt-motion.com](https://prompt-motion.com/) | Gallery + the site's own improved prompts and 5 archetype recipes | 236 entries, 213 rewrites | None; robots `use=reference` → local only | 153 of 236 already in our index; ~94 are one showreel line. **New: the site's own layer** (recipes, fields, dials) |
| [joeseesun/opus-video-prompts](https://github.com/joeseesun/opus-video-prompts) | First-week index (ZH) | 18 prompts, 54 cases | None → local only | 11 of 18 prompts already ours; 7 new; the case list is mostly new |
| [athemeroy/awesome-claude-5-5-videos](https://github.com/athemeroy/awesome-claude-5-5-videos) | Research: atlas, workflows, costs, briefs | 424 posts | CC-BY-4.0 (its own writing) → local only | ~94 % new; little prompt text; best for **taxonomy and links** |
| [JohnHeibel/ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) | p5.brush cartoon kit + a 461-line craft guide | 18 files | **MIT** | Character rig, craft guide, review loop. Its mascot (Clawd) is Anthropic's → never shipped |
| [JohnHeibel/PDoomVideo](https://github.com/JohnHeibel/PDoomVideo) | 156 s music video made by Opus with parallel subagents | 26 files | None → local only | Multi-agent production method, karaoke, stage props, cast registry |
| [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) | Independent three.js remake of the same song | 154 files | **MIT** (code); song/lyrics third-party | Audio map, lyric-anchored beat-snapped edit, adaptive motion blur, treatment format |
| [Vincentwei1021/mg-styles-15](https://github.com/Vincentwei1021/mg-styles-15) | 15 MG styles, numeric specs, code films, soundtracks | 15 styles | **MIT** (author's own prompts) | 7 new styles, 4 better than ours, `mgaudio`, jury rubric |
| [lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) | Claude Code plugin: 59 film styles + director/technique guides | 59 styles, 98 prompts | **MIT** (code, docs, STYLE.md); films CC BY 4.0; 3 voice tracks excluded | Almost all new: style-spec schema, directing rules, brand-variant flow, audio stack |

Also linked and permissive (to read next): papermotion, Clearwater (WebGL water), 184 SwiftUI text animations,
video-production-skills, taste-skill, cinetic, product-film-skill (all MIT), hyperframes (Apache-2.0).

**Never shipped:** real brands, logos and people in the demos (Clawd, OpenAI/Anthropic, NASA, Ford, Spotify, Apple
homages, real films and artists named in OPUSCAR 98), and third-party songs and lyrics.

## 2. What we discard (we have it)
Showreel one-liners (t01), short launch prompts (t02), UI morph (t03), infinite zoom (t04), kinetic type (t05),
timelines and data stories (t07, t08), particles (t09), single 3D object (t10), liquid wipes (t11), logo reveals (t12),
UI walkthroughs (t13), liquid metaballs, aurora/glass, HUD, flash/iris/zoom transitions, `On Twos`, glow, grain. Also
skipped: games and interactive pieces, model comparisons, empty or truncated posts. Fix in our index:
`zacxbt-944604` is a copy of `majidmanzarpour-927543` (`dup_of`).

## 3. What is new, by our categories

### 3.1 Characters (new family; we have only t06)
- ~21 strong character/mascot shorts in yihui, 18 in athemeroy; full rig patterns in ClaudeAnimationBase (5 views,
  31 emotions, an acted mood change, hooks for props, a model sheet rendered from the rig) and lemo-opuscar's rig rules.
- Proposal: `library/characters/<slug>.json` — `traits` (fixed, pasted verbatim into every brief), `variable`,
  `palette` (tokens), `views`, `emotions` (face + tint + idle), `acts` (verbs on token curves), `idle` (breathe, blink,
  squash, lagging accessory), `hooks`, `shot_sizes`, `sheet` (images from our sheets-first pipeline), `voice`,
  `consent` (real people), `reused_in`. Rule: on model within a video; the sheet is generated, never drawn apart.
- Acting checklist (anticipation, follow-through, eyes lead, key poses held ≥ 6 frames, silhouette reads, avoid
  twinning) as a technique card.

### 3.2 Creative direction and prompt recipes (new; today scattered in USER_GUIDE)
- **One brief format** for every template and long video: `inputs` (typed, with defaults) · `direction` (concept,
  look, motion rules, **banned list with replacements**) · `structure` (beats with times, a hook in 0.5 s, the hero at
  60-75 %) · `build` · `gotchas` · `start` (storyboard and stills before code). (prompt-motion, mg-styles, lemo)
- **Write the reads:** per shot, an ordered list of what the eye reads, with times. Fixes "too fast" reviews.
- Treatment / style bible with a **revision log** (pdoom-video) = our brand notes, shaped for a video.
- Through-line object or motif that transforms in every scene; escalating recurring set; ending rhymes with the opening.
- Measurable pacing rules (lemo DIRECTOR): ≥ 2 silences, ≥ 2 J/L cuts, text held letters ÷ 15 + 1.5 s, voice ~10 dB
  over music, −14 LUFS, a "not the demo again" check.
- Vague wishes become options ("more premium" = fewer colours, slower, more space), never silent edits.
- Production brief with 3 gates (storyboard + keyframes → hardest 2-4 s → full film) and a rights table (athemeroy).
- Multi-agent production for long pieces: a lead writes the guide, one agent per chapter, shared files read-only.

### 3.3 Style packs (9 today)
- **New:** Swiss / Bauhaus grid, Treatise / Blueprint, line art (one continuous line), isometric 2.5D, synthwave/VHS,
  pixel art, print (risograph, halftone, silkscreen, woodcut, engraving), hand-painted (watercolour, ink-wash, crayon,
  impasto, whiteboard), East Asian (shadow puppet, ukiyo-e, papercut, lantern), cartoon (rubber hose, 80s cel,
  mid-century), silent film / found footage, documentary and news editing.
- **Better than ours:** flat-vector explainer, cel with smear frames, collage (scissor edge, slap-on, page flip),
  morph chain, dark keynote, dataviz.
- **Schema to adopt** (lemo STYLE.md + mg-styles specs): essence + what it is not · materials · colour roles (one
  signal colour) · type voices · motion with numbers (beziers, frames, px, fps/step) · camera grammar table · sound
  palette · native moves ("fits content like") · pitfalls (symptom → fix) · variation space · `forbid[]` ·
  brand-change safety (safe / changes character / can't change).

### 3.4 Techniques (12 today)
Audio → beat, downbeat, section and word markers in AE (unblocks lyric videos, showreels on a real track) ·
edit anchored to the voice/lyrics and snapped to the beat (extends *Cut on the voice*) · talking head → circle PiP
with line-art B-roll · caption-news / telestrator on footage · 3D fly-over of a landing page from layers + JSON ·
morph chain · seamless loop ending · footage transformation (line art over AI video) · overpaint of generated video.

### 3.5 Kit and text
Reaction captions (emotion → decoration), karaoke with word fill, plotter-pen writing (OFL single-stroke fonts),
comic SFX words, type that builds the layout per line, stamp slam, drum odometer, token-probability prompt, in-world
beat-stepped meter, brush wipe, shaped iris aimed at a layer, "object becomes the transition", stage backdrop,
VHS look, retro grid, halation / chromatic aberration / signal-only bloom, paper underlay, smear frame, iso boxes.

### 3.6 Video templates (13 today) — gaps by count in the sources
Character short synced to music (21) · recipe / step-by-step build (15) · map / route story (18) · lyric or music
video (12) · exploded / x-ray product (14) · handmade looks (31) · architecture diagram (19) · diorama (12) ·
physics as data (7) · pixel loop (11) · scale dive (12) · sticker explainer on a giant canvas · teardown / data-physical.

### 3.7 Tooling (runtime and render)
Beat clock, shot registry, camera, spring/arc helpers in `mdna.js`; strip/crop/cuts contact sheets; GPU flags and
parallel in-order encoding; the `frameIdx` rule that fixes our `--mblur` ghosting; code-made music and SFX
(`mgaudio`, lemo `sfx/sampler/pluck`, `OfflineAudioContext`); reading-time check and ASR check of voice.

## 4. One taxonomy for everything underneath
Every item (preset, kit piece, technique, template, style, character, recipe) carries the facets we have — role,
target, channel, direction, **energy 1-5**, tones — plus:

| Facet | Values (examples) | From |
|---|---|---|
| `domain` | product_ad, education, story_short, music_video, data, history, social, corporate, greeting | athemeroy |
| `style` | motion_graphics_ui, flat_vector, hand_drawn, paper_collage, pixel, painterly, print, 3d, photoreal, anime, generative, diagram, retro_terminal | athemeroy, lemo |
| `on_screen` | product_ui, phone, charts, diagrams, kinetic_type, shapes, particles, characters, photos, footage, code | prompt-motion |
| `route` | A render asset · B native AE · C hybrid | ours |
| `needs` | logo, footage, product shots, screenshots, VO, music, character sheet, data | new |
| `triggers` | words in EN/ES that point to it ("launch", "lanzamiento", "receta", "paso a paso", "mascota"…) | new |
| `questions` | what to ask when the brief leaves it open | new |
| `dials` | creativity (safe/balanced/wild), pace (= energy), polish (QA depth) | prompt-motion |
| `aspects`, `length_s`, `audio`, `bg_lightness` | | yihui, athemeroy |

## 5. Reading the brief (the Agent stops making the same thing)
1. **`read_brief(text)`** (new MCP tool) matches the words against `triggers`, `domain`, `on_screen`, `needs` and returns:
   3-5 candidates from different categories, what is missing, and 2-4 short questions with options.
2. **Ask only when the order is open** ("I want a video for…"). A precise order ("apply Land to the selection") runs at once.
   Typical questions: what is it for and where it runs · length and format · what assets you have (logo, footage,
   product, voice, character) · energy.
3. **Propose 2-3 routes** ("A: kinetic type on your footage · B: character explainer · C: data story") and build the one chosen.
4. **Variety:** each project keeps what it used; `read_brief` ranks unused options higher.
5. The answers fill the brief format of §3.2, so every build starts from the same structure.

## 6. README section (draft)
> ### What runs underneath, and what you can ask for
> Motion DNA is a Swiss army knife: behind the panel there are N presets, N kit pieces, N transitions, N techniques,
> N styles, N characters, N video templates and N prompt recipes, all tagged by use, energy, style and what they need.
> You don't have to know their names: describe the video ("a 20 s launch for a fictional app, playful, I have the logo
> and three screenshots") and the Agent reads the brief, asks what is missing, proposes two or three routes and builds
> the one you choose. Ask for…  *(a table: domain → example orders → what it uses)*
> **Characters:** … how a character is defined, kept on model, and reused.

## 7. Suggested order
1. **Taxonomy + brief format + `read_brief`** (S-M): the base for everything else; no visual change to AE.
2. **Characters family** + acting checklist (L): the biggest gap; the teaser needs it.
3. **Style schema** + 3 new packs first: Swiss/Bauhaus, Treatise/Blueprint, Handmade (M each).
4. **Audio → markers** technique + beat clock in the runtime (M).
5. **Templates:** mascot short, recipe/step build, lyric video, map story (M-L each).
6. Kit additions in batches with previews (CONTRIBUTING §11 gate).

Detailed per-source tables live in the review agents' reports (local scratchpad), summarized above.
