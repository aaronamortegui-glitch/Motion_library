# Motion DNA · catalog

Every preset with its live thumbnail, energy and use, generated from `library/library.json`, `library/recipes.json` and
`library/packs.json` by `python tools/readme_catalog.py`. Filterable version: open `library/index.html`; for LLMs:
`library/INDEX.txt`. Tags (roles, targets, energy 1–5, tones) for every entry: `library/tags.json`.

<!-- catalog:start -->
**79 presets** in 5 categories, plus style packs. Every one is also listed in `library/INDEX.txt` (for LLMs) and `library/index.html` (for people).

### Motion (31)

Entrances and exits for any layer. `SSP.apply(layer, name, "in" | "out" | "both")`

|   |   |   |   |
|---|---|---|---|
| <img src="../library/gifs/motion/fade.gif" width="200"><br>**Fade** · `soft`<br><sub>Corporate, UI, supporting text</sub> | <img src="../library/gifs/motion/fade-up.gif" width="200"><br>**Fade Up** · `soft`<br><sub>Headlines, paragraphs, lists</sub> | <img src="../library/gifs/motion/scale-pop.gif" width="200"><br>**Scale Pop** · `dynamic`<br><sub>Icons, chips, stickers, social</sub> | <img src="../library/gifs/motion/blur-in.gif" width="200"><br>**Blur In** · `soft`<br><sub>Photos, backgrounds, premium moments</sub> |
| <img src="../library/gifs/motion/slide-land.gif" width="200"><br>**Slide Land** · `medium`<br><sub>Images and cards entering from off-screen</sub> | <img src="../library/gifs/motion/rotate-settle.gif" width="200"><br>**Rotate Settle** · `medium`<br><sub>Logos, badges, pieces with personality</sub> | <img src="../library/gifs/motion/squash-warp.gif" width="200"><br>**Squash Warp** · `dynamic`<br><sub>Social, hype, rhythmic transitions</sub> | <img src="../library/gifs/motion/wipe-reveal.gif" width="200"><br>**Wipe Reveal** · `medium`<br><sub>Bars, lower thirds, underlines</sub> |
| <img src="../library/gifs/motion/organic-draw.gif" width="200"><br>**Organic Draw** · `medium`<br><sub>Hand-drawn feel: contours, underlines, sketch lines (shape layers only)</sub> | <img src="../library/gifs/motion/organic-stroke.gif" width="200"><br>**Organic Stroke** · `dynamic`<br><sub>Traveling brush stroke: the start chases the end (accent lines, HUD links)</sub> | <img src="../library/gifs/motion/line-draw.gif" width="200"><br>**Line Draw** · `medium`<br><sub>Lines, stroke icons, tracking HUD (shape layers only)</sub> | <img src="../library/gifs/motion/slam-in.gif" width="200"><br>**Slam In** · `dynamic`<br><sub>Hero words, titles over footage, kinetic type</sub> |
| <img src="../library/gifs/motion/flip-in.gif" width="200"><br>**Flip In** · `medium`<br><sub>Cards, tiles, reveals, before/after</sub> | <img src="../library/gifs/motion/spin-pop.gif" width="200"><br>**Spin Pop** · `dynamic`<br><sub>Badges, stickers, stamps, icons</sub> | <img src="../library/gifs/motion/drop-bounce.gif" width="200"><br>**Drop Bounce** · `dynamic`<br><sub>Icons, products, emoji, playful drops</sub> | <img src="../library/gifs/motion/stretch-slide.gif" width="200"><br>**Stretch Slide** · `dynamic`<br><sub>Cards, chips, pills, fast UI moves</sub> |
| <img src="../library/gifs/motion/ramp-slide.gif" width="200"><br>**Ramp Slide** · `dynamic`<br><sub>Transitions, product slides, bold entrances</sub> | <img src="../library/gifs/motion/ramp-zoom.gif" width="200"><br>**Ramp Zoom** · `dynamic`<br><sub>Logo reveals, hero products, end cards</sub> | <img src="../library/gifs/motion/ramp-spin.gif" width="200"><br>**Ramp Spin** · `dynamic`<br><sub>Icons, badges, logo spins</sub> | <img src="../library/gifs/motion/whip-pan.gif" width="200"><br>**Whip Pan** · `dynamic`<br><sub>Swipe transitions, camera-style moves, carousels</sub> |
| <img src="../library/gifs/motion/surge-rise.gif" width="200"><br>**Surge Rise** · `medium`<br><sub>Headlines, cards, elegant entrances</sub> | <img src="../library/gifs/motion/speed-ramp.gif" width="200"><br>**Speed Ramp** · `dynamic`<br><sub>Footage, product shots, action beats, transitions</sub> | <img src="../library/gifs/motion/punch-zoom.gif" width="200"><br>**Punch Zoom** · `medium`<br><sub>Footage, precomps, freeze frames, cut emphasis</sub> | <img src="../library/gifs/motion/coast-rise.gif" width="200"><br>**Coast Rise** · `soft`<br><sub>Product UI, editorial headlines, icons: fast start, clean stop</sub> |
| <img src="../library/gifs/motion/wind-up-slide.gif" width="200"><br>**Wind-up Slide** · `soft`<br><sub>Logo slides, premium reveals: a small pull-back, then a long glide</sub> | <img src="../library/gifs/motion/nudge-grow.gif" width="200"><br>**Nudge Grow** · `soft`<br><sub>Bars, charts, columns, panels growing from their anchor (put the anchor at the base)</sub> | <img src="../library/gifs/motion/snap-scale.gif" width="200"><br>**Snap Scale** · `medium`<br><sub>Editorial cuts on the action: shapes and type that jump in size and settle</sub> | <img src="../library/gifs/motion/iris-reveal.gif" width="200"><br>**Iris Reveal** · `medium`<br><sub>Scene changes, photo reveals, opening a new section from a point</sub> |
| <img src="../library/gifs/motion/wordmark-reveal.gif" width="200"><br>**Wordmark Reveal** · `medium`<br><sub>Wordmarks sliding out from behind their logo mark, names after an icon</sub> | <img src="../library/gifs/motion/push-through.gif" width="200"><br>**Push Through** · `medium`<br><sub>Fly-through transitions: the camera pushes into a word, a logo or a planet and through it</sub> | <img src="../library/gifs/motion/color-wipe.gif" width="200"><br>**Color Wipe** · `medium`<br><sub>Section changes: a full-frame color solid sweeps in diagonally (put it on a solid)</sub> |   |

### Classics (17)

Effects adapted from animate.css 4.1.1 (MIT) into native keyframes: entrances, exits and attention moves. Same call as Motion.

|   |   |   |   |
|---|---|---|---|
| <img src="../library/gifs/motion/back-in-down.gif" width="200"><br>**Back In Down** · `dynamic`<br><sub>Cards, product shots, bold drops (enter)</sub> | <img src="../library/gifs/motion/back-in-left.gif" width="200"><br>**Back In Left** · `dynamic`<br><sub>Slides, lower thirds, carousels (enter)</sub> | <img src="../library/gifs/motion/bounce-in.gif" width="200"><br>**Bounce In** · `dynamic`<br><sub>Icons, badges, buttons, emoji (enter)</sub> | <img src="../library/gifs/motion/bounce-in-up.gif" width="200"><br>**Bounce In Up** · `dynamic`<br><sub>Notifications, stickers, playful entrances (enter)</sub> |
| <img src="../library/gifs/motion/rubber-band.gif" width="200"><br>**Rubber Band** · `dynamic`<br><sub>CTAs, logos, a beat accent (attention)</sub> | <img src="../library/gifs/motion/jello.gif" width="200"><br>**Jello** · `dynamic`<br><sub>Playful accents, stickers (attention)</sub> | <img src="../library/gifs/motion/heart-beat.gif" width="200"><br>**Heart Beat** · `medium`<br><sub>Likes, prices, a pulse on the beat (attention)</sub> | <img src="../library/gifs/motion/tada.gif" width="200"><br>**Tada** · `dynamic`<br><sub>Reveals, wins, offers (attention)</sub> |
| <img src="../library/gifs/motion/wobble.gif" width="200"><br>**Wobble** · `dynamic`<br><sub>Errors, jokes, quirky accents (attention)</sub> | <img src="../library/gifs/motion/swing-hinge.gif" width="200"><br>**Swing Hinge** · `medium`<br><sub>Signs, tags, hanging elements (attention)</sub> | <img src="../library/gifs/motion/flip-in-x.gif" width="200"><br>**Flip In X** · `medium`<br><sub>Cards, tiles, scoreboard flips (enter)</sub> | <img src="../library/gifs/motion/light-speed-in.gif" width="200"><br>**Light Speed In** · `dynamic`<br><sub>Speed, sport, fast lower thirds (enter)</sub> |
| <img src="../library/gifs/motion/roll-in.gif" width="200"><br>**Roll In** · `dynamic`<br><sub>Wheels, coins, round icons (enter)</sub> | <img src="../library/gifs/motion/zoom-in-down.gif" width="200"><br>**Zoom In Down** · `medium`<br><sub>Titles that drop in from above (enter)</sub> | <img src="../library/gifs/motion/jack-in-the-box.gif" width="200"><br>**Jack In The Box** · `dynamic`<br><sub>Surprises, reveals, kids and playful brands (enter)</sub> | <img src="../library/gifs/motion/back-out-up.gif" width="200"><br>**Back Out Up** · `dynamic`<br><sub>Exits upward, cards leaving (exit)</sub> |
| <img src="../library/gifs/motion/zoom-out.gif" width="200"><br>**Zoom Out** · `soft`<br><sub>Quiet exits, scene changes (exit)</sub> |   |   |   |

### Text (11)

Per character or per word, on text layers. `SSP.applyText(layer, name, "in" | "out" | "both")`

|   |   |   |   |
|---|---|---|---|
| <img src="../library/gifs/text/chars-rise.gif" width="200"><br>**Chars Rise** · `medium`<br><sub>Short headlines, names, kickers</sub> | <img src="../library/gifs/text/words-fade-up.gif" width="200"><br>**Words Fade Up** · `soft`<br><sub>Phrases, captions, quotes</sub> | <img src="../library/gifs/text/blur-words.gif" width="200"><br>**Blur Words** · `soft`<br><sub>Premium moments, calm intros</sub> | <img src="../library/gifs/text/tracking-settle.gif" width="200"><br>**Tracking Settle** · `medium`<br><sub>All-caps titles, typographic logos</sub> |
| <img src="../library/gifs/text/chars-pop.gif" width="200"><br>**Chars Pop** · `dynamic`<br><sub>Social, hype, big numbers</sub> | <img src="../library/gifs/text/typewriter.gif" width="200"><br>**Typewriter** · `medium`<br><sub>Captions, terminals, UI, quotes</sub> | <img src="../library/gifs/text/scramble.gif" width="200"><br>**Scramble** · `dynamic`<br><sub>Tech, data, HUD labels, reveals</sub> | <img src="../library/gifs/text/count-up.gif" width="200"><br>**Count Up** · `medium`<br><sub>Stats, KPIs, prices, counters</sub> |
| <img src="../library/gifs/text/chars-ramp.gif" width="200"><br>**Chars Ramp** · `medium`<br><sub>Titles that build tension, trailers, reveals</sub> | <img src="../library/gifs/text/words-slam.gif" width="200"><br>**Words Slam** · `dynamic`<br><sub>Punchy statements, social hooks, VO beats</sub> | <img src="../library/gifs/text/chars-blur.gif" width="200"><br>**Chars Blur** · `soft`<br><sub>Opening titles, premium intros: characters resolve from blur one after another</sub> |   |

### Effects (11)

Continuous loops driven by expressions. `SSP.applyFx(layer, name)`

|   |   |   |   |
|---|---|---|---|
| <img src="../library/gifs/fx/float.gif" width="200"><br>**Float** · `soft`<br><sub>Idle icons and cards, living backgrounds</sub> | <img src="../library/gifs/fx/wiggle-rotate.gif" width="200"><br>**Wiggle Rotate** · `medium`<br><sub>Stickers, illustrations with personality</sub> | <img src="../library/gifs/fx/pulse.gif" width="200"><br>**Pulse** · `medium`<br><sub>CTAs, buttons, attention grabbers</sub> | <img src="../library/gifs/fx/jitter.gif" width="200"><br>**Jitter** · `dynamic`<br><sub>Social, glitch, high-energy pieces</sub> |
| <img src="../library/gifs/fx/breathe.gif" width="200"><br>**Breathe** · `soft`<br><sub>Ambient glows, background shapes, calm idle states</sub> | <img src="../library/gifs/fx/swing.gif" width="200"><br>**Swing** · `soft`<br><sub>Hanging tags, badges, signs, pendulums</sub> | <img src="../library/gifs/fx/orbit.gif" width="200"><br>**Orbit** · `soft`<br><sub>Dots and satellites around a logo, decorative loops</sub> | <img src="../library/gifs/fx/shake.gif" width="200"><br>**Shake** · `dynamic`<br><sub>Impacts, bass hits, alarms, energetic footage</sub> |
| <img src="../library/gifs/fx/holo-flicker.gif" width="200"><br>**Holo Flicker** · `medium`<br><sub>HUD labels, tech overlays, holographic UI</sub> | <img src="../library/gifs/fx/boil.gif" width="200"><br>**Boil** · `medium`<br><sub>Collage, cut-outs, paper and texture layers: a subtle hand-made boil</sub> | <img src="../library/gifs/fx/on-twos.gif" width="200"><br>**On Twos** · `medium`<br><sub>Stop-motion feel: plays the layer's existing animation on 2s or 3s (apply after a motion preset)</sub> |   |

### Recipes (9)

Behavior measured from reference animations and rebuilt with our own keyframes. `SSP.applyRecipe(layer, id, "both")`

|   |   |   |   |
|---|---|---|---|
| <img src="../library/gifs/recipe/calibration-w3l.gif" width="200"><br>**W3L** · `dynamic`<br><sub>position & rotation & scale · loop</sub> | <img src="../library/gifs/recipe/calibration-4lc.gif" width="200"><br>**4LC** · `dynamic`<br><sub>position & rotation · transition</sub> | <img src="../library/gifs/recipe/calibration-d2t.gif" width="200"><br>**D2T** · `dynamic`<br><sub>position · loop</sub> | <img src="../library/gifs/recipe/calibration-2jk.gif" width="200"><br>**2JK** · `medium`<br><sub>rotation · loop</sub> |
| <img src="../library/gifs/recipe/calibration-1df-unu.gif" width="200"><br>**1DF+UNU** · `dynamic`<br><sub>scale · loop</sub> | <img src="../library/gifs/recipe/calibration-x9r.gif" width="200"><br>**X9R** · `medium`<br><sub>opacity & scale · transition</sub> | <img src="../library/gifs/recipe/calibration-pe6.gif" width="200"><br>**PE6** · `medium`<br><sub>position · transition</sub> | <img src="../library/gifs/recipe/calibration-4vw.gif" width="200"><br>**4VW** · `dynamic`<br><sub>position & scale · transition</sub> |
| <img src="../library/gifs/recipe/calibration-2jv.gif" width="200"><br>**2JV** · `dynamic`<br><sub>scale · transition</sub> |   |   |   |

### Packs (9)

One click gives a whole comp an identity: each layer gets the preset of its role (title, subtitle, body, shape, media, logo), staggered. `SSP.applyPack(comp, name)`

|   |   |   |   |
|---|---|---|---|
| <img src="../library/packs/dynamic.gif" width="260"><br>**Dynamic** · `dynamic`<br><sub>Social, launches, hype: fast slams, whips and speed ramps.</sub> | <img src="../library/packs/elegant.gif" width="260"><br>**Elegant** · `soft`<br><sub>Premium, fashion, hospitality: slow blurs, soft rises, generous timing.</sub> | <img src="../library/packs/modern.gif" width="260"><br>**Modern** · `medium`<br><sub>Corporate, SaaS, product: clean rises and slides on the brand curves.</sub> | <img src="../library/packs/playful.gif" width="260"><br>**Playful** · `dynamic`<br><sub>Kids, food, consumer apps: bounces, wobbles and jack-in-the-box reveals.</sub> |
| <img src="../library/packs/tech.gif" width="260"><br>**Tech** · `medium`<br><sub>Data, AI, fintech, HUDs: decoding text, line draws and holographic flicker.</sub> | <img src="../library/packs/calm-modern.gif" width="260"><br>**Calm Modern** · `soft`<br><sub>Product and brand pieces: small travel, word-by-word text, quiet exits, no bounce.</sub> | <img src="../library/packs/editorial.gif" width="260"><br>**Editorial** · `medium`<br><sub>Brand systems, tech launches, type-led films: typing, snaps on the action, construction lines, clean ease-outs (Motion Style Map: Editorial).</sub> | <img src="../library/packs/storybook.gif" width="260"><br>**Storybook** · `soft`<br><sub>Warm product launches and character explainers: line-by-line rises, soft 3% overshoots, circular reveals (Motion Style Map: Warm editorial, Character).</sub> |
| <img src="../library/packs/collage.gif" width="260"><br>**Collage** · `dynamic`<br><sub>Mixed media, cut-outs, archive and texture: whips through layers, hand-made boil on 3s, decoding type (Motion Style Map: Mixed media).</sub> |   |   |   |
<!-- catalog:end -->
