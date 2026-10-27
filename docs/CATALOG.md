# Motion DNA · catalog

Every preset with its live thumbnail, energy and use, generated from `library/library.json`, `library/recipes.json` and
`library/packs.json` by `python tools/readme_catalog.py`. Filterable version: open `library/index.html`; for LLMs:
`library/INDEX.txt`. Tags (roles, targets, energy 1–5, tones) for every entry: `library/tags.json`.

<!-- catalog:start -->
**80 presets** in 5 categories, plus style packs. Every one is also listed in `library/INDEX.txt` (for LLMs) and `library/index.html` (for people).

### Motion (32)

Entrances and exits for any layer. `SSP.apply(layer, name, "in" | "out" | "both")`

|   |   |   |   |
|---|---|---|---|
| <img src="../library/gifs/motion/fade.gif" width="200"><br>**Fade** · `soft`<br><sub>Corporate, UI, supporting text</sub> | <img src="../library/gifs/motion/fade-up.gif" width="200"><br>**Fade Up** · `soft`<br><sub>Headlines, paragraphs, lists</sub> | <img src="../library/gifs/motion/scale-pop.gif" width="200"><br>**Scale Pop** · `dynamic`<br><sub>Icons, chips, stickers, social</sub> | <img src="../library/gifs/motion/blur-in.gif" width="200"><br>**Blur In** · `soft`<br><sub>Photos, backgrounds, premium moments</sub> |
| <img src="../library/gifs/motion/slide-land.gif" width="200"><br>**Slide Land** · `medium`<br><sub>Images and cards entering from off-screen</sub> | <img src="../library/gifs/motion/rotate-settle.gif" width="200"><br>**Rotate Settle** · `medium`<br><sub>Logos, badges, pieces with personality</sub> | <img src="../library/gifs/motion/squash-warp.gif" width="200"><br>**Squash Warp** · `dynamic`<br><sub>Social, hype, rhythmic transitions</sub> | <img src="../library/gifs/motion/wipe-reveal.gif" width="200"><br>**Wipe Reveal** · `medium`<br><sub>Bars, lower thirds, underlines</sub> |
| <img src="../library/gifs/motion/organic-draw.gif" width="200"><br>**Organic Draw** · `medium`<br><sub>Hand-drawn feel: contours, underlines, sketch lines (shape layers only)</sub> | <img src="../library/gifs/motion/organic-stroke.gif" width="200"><br>**Organic Stroke** · `dynamic`<br><sub>Traveling brush stroke: the start chases the end (accent lines, HUD links)</sub> | <img src="../library/gifs/motion/line-draw.gif" width="200"><br>**Line Draw** · `medium`<br><sub>Lines, stroke icons, tracking HUD (shape layers only)</sub> | <img src="../library/gifs/motion/slam-in.gif" width="200"><br>**Slam In** · `dynamic`<br><sub>Hero words, titles over footage, kinetic type</sub> |
| <img src="../library/gifs/motion/flip-in.gif" width="200"><br>**Flip In** · `medium`<br><sub>Cards, tiles, reveals, before/after</sub> | <img src="../library/gifs/motion/spin-pop.gif" width="200"><br>**Spin Pop** · `dynamic`<br><sub>Badges, stickers, stamps, icons</sub> | <img src="../library/gifs/motion/drop-bounce.gif" width="200"><br>**Drop Bounce** · `dynamic`<br><sub>Icons, products, emoji, playful drops</sub> | <img src="../library/gifs/motion/stretch-slide.gif" width="200"><br>**Stretch Slide** · `dynamic`<br><sub>Cards, chips, pills, fast UI moves</sub> |
| <img src="../library/gifs/motion/ramp-slide.gif" width="200"><br>**Ramp Slide** · `dynamic`<br><sub>Transitions, product slides, bold entrances</sub> | <img src="../library/gifs/motion/ramp-zoom.gif" width="200"><br>**Ramp Zoom** · `dynamic`<br><sub>Logo reveals, hero products, end cards</sub> | <img src="../library/gifs/motion/ramp-spin.gif" width="200"><br>**Ramp Spin** · `dynamic`<br><sub>Icons, badges, logo spins</sub> | <img src="../library/gifs/motion/whip-pan.gif" width="200"><br>**Whip Pan** · `dynamic`<br><sub>Swipe transitions, camera-style moves, carousels</sub> |
| <img src="../library/gifs/motion/surge-rise.gif" width="200"><br>**Surge Rise** · `medium`<br><sub>Headlines, cards, elegant entrances</sub> | <img src="../library/gifs/motion/speed-ramp.gif" width="200"><br>**Speed Ramp** · `dynamic`<br><sub>Footage, product shots, action beats, transitions</sub> | <img src="../library/gifs/motion/punch-zoom.gif" width="200"><br>**Punch Zoom** · `medium`<br><sub>Footage, precomps, freeze frames, cut emphasis</sub> | <img src="../library/gifs/motion/coast-rise.gif" width="200"><br>**Coast Rise** · `soft`<br><sub>Product UI, editorial headlines, icons: fast start, clean stop</sub> |
| <img src="../library/gifs/motion/glide-in.gif" width="200"><br>**Glide In** · `soft`<br><sub>Products, cars, premium heroes: a long glide in that settles, no bounce</sub> | <img src="../library/gifs/motion/wind-up-slide.gif" width="200"><br>**Wind-up Slide** · `soft`<br><sub>Logo slides, premium reveals: a small pull-back, then a long glide</sub> | <img src="../library/gifs/motion/nudge-grow.gif" width="200"><br>**Nudge Grow** · `soft`<br><sub>Bars, charts, columns, panels growing from their anchor (put the anchor at the base)</sub> | <img src="../library/gifs/motion/snap-scale.gif" width="200"><br>**Snap Scale** · `medium`<br><sub>Editorial cuts on the action: shapes and type that jump in size and settle</sub> |
| <img src="../library/gifs/motion/iris-reveal.gif" width="200"><br>**Iris Reveal** · `medium`<br><sub>Scene changes, photo reveals, opening a new section from a point</sub> | <img src="../library/gifs/motion/wordmark-reveal.gif" width="200"><br>**Wordmark Reveal** · `medium`<br><sub>Wordmarks sliding out from behind their logo mark, names after an icon</sub> | <img src="../library/gifs/motion/push-through.gif" width="200"><br>**Push Through** · `medium`<br><sub>Fly-through transitions: the camera pushes into a word, a logo or a planet and through it</sub> | <img src="../library/gifs/motion/color-wipe.gif" width="200"><br>**Color Wipe** · `medium`<br><sub>Section changes: a full-frame color solid sweeps in diagonally (put it on a solid)</sub> |

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

## The kit (201 pieces in 52 families)

Built by Claude on the open comp through the MCP server, on the same token curves. One row per family: a still of its first piece and every variant by name (ask for any of them in the chat; `list_kit` shows energy and tones). Moving previews: hover a card in `library/index.html` or open *Agent › Library › Kit* in the panel.

### Solid transitions (34)

| | Family | Variants (ask for them by name) |
|---|---|---|
| <img src="../library/gifs/kit-transition/clean-wipe_md.png" width="160"> | **Wipes**<br><sub>Colour layers sweep across the cut.</sub><br><sub>`solid_transition(look="Clean Wipe")`</sub> | `Clean Wipe` · `Diagonal Wipe` · `Vertical Drop` · `Soft Wipe` · `Gradient Wipe` |
| <img src="../library/gifs/kit-transition/slanted-bars_md.png" width="160"> | **Bands**<br><sub>Bars, blinds, stacks and interleaved strips.</sub><br><sub>`solid_transition(look="Slanted Bars")`</sub> | `Slanted Bars` · `Bar Cascade` · `Venetian Blinds` · `Shutter` · `Color Stack` · `Stack Rise` · `Zipper` · `Comb` |
| <img src="../library/gifs/kit-transition/center-split_md.png" width="160"> | **Splits**<br><sub>The frame opens from the middle.</sub><br><sub>`solid_transition(look="Center Split")`</sub> | `Center Split` · `Horizon Split` |
| <img src="../library/gifs/kit-transition/iris-pop_md.png" width="160"> | **Iris and shapes**<br><sub>Circles, rings and diamonds grow from a point.</sub><br><sub>`solid_transition(look="Iris Pop")`</sub> | `Iris Pop` · `Ring Burst` · `Corner Burst` · `Rainbow Rise` · `Diamond Reveal` |
| <img src="../library/gifs/kit-transition/pixel-grid_md.png" width="160"> | **Grids and dots**<br><sub>Cells and dots fill the frame in an order.</sub><br><sub>`solid_transition(look="Pixel Grid")`</sub> | `Pixel Grid` · `Grid Scatter` · `Grid Bloom` · `Dot Matrix` |
| <img src="../library/gifs/kit-transition/fan-sweep_md.png" width="160"> | **Fans**<br><sub>Pie slices sweep round a corner or the centre.</sub><br><sub>`solid_transition(look="Fan Sweep")`</sub> | `Fan Sweep` · `Corner Fan` |
| <img src="../library/gifs/kit-transition/liquid-wipe_md.png" width="160"> | **Liquid and ink**<br><sub>Living wavy edges and ink blooms.</sub><br><sub>`solid_transition(look="Liquid Wipe")`</sub> | `Liquid Wipe` · `Liquid Rise` · `Ink Drop` · `Ink Corner` |
| <img src="../library/gifs/kit-transition/bubble-wipe_md.png" width="160"> | **Bubbles**<br><sub>Bubbles that melt into each other cover the cut.</sub><br><sub>`solid_transition(look="Bubble Wipe")`</sub> | `Bubble Wipe` · `Bubble Rise` |
| <img src="../library/gifs/kit-transition/shatter_md.png" width="160"> | **Shards**<br><sub>Voronoi shards break and sweep away.</sub><br><sub>`solid_transition(look="Shatter")`</sub> | `Shatter` · `Shard Sweep` |

### Clip transitions (24)

| | Family | Variants (ask for them by name) |
|---|---|---|
| <img src="../library/gifs/kit-transition/zoom-through_md.png" width="160"> | **Zoom and spin**<br><sub>Shot to shot through a zoom, a spin, a roll or a twirl.</sub><br><sub>`solid_transition(look="Zoom Through")`</sub> | `Zoom Through` · `Spin Through` · `Camera Roll` · `Twirl Zoom` |
| <img src="../library/gifs/kit-transition/whip-slide_md.png" width="160"> | **Slides**<br><sub>Push and whip from one shot to the next.</sub><br><sub>`solid_transition(look="Whip Slide")`</sub> | `Whip Slide` · `Vertical Whip` · `Stretch Slide` |
| <img src="../library/gifs/kit-transition/flash-cut_md.png" width="160"> | **Flash and dip**<br><sub>A flash or a dip to a colour between shots.</sub><br><sub>`solid_transition(look="Flash Cut")`</sub> | `Flash Cut` · `Dip to Black` |
| <img src="../library/gifs/kit-transition/camera-shake_md.png" width="160"> | **Shake, slices and glitch**<br><sub>Camera shake, sliced frames and an RGB glitch.</sub><br><sub>`solid_transition(look="Camera Shake")`</sub> | `Camera Shake` · `Slice Cut` · `Glitch Cut` |
| <img src="../library/gifs/kit-gltransition/heartwipe_md.png" width="160"> | **Shader wipes**<br><sub>Shapes, patterns and noise reveal the next shot (gl-transitions shaders as luma mattes; 73 in all with gl_transition).</sub><br><sub>`gl_transition(name="HeartWipe", outgoing="…", incoming="…")`</sub> | `HeartWipe` · `StarWipe` · `FlowerWipe` · `Pinwheel` · `ClockWipe` · `PolkaDotsCurtain` · `Crosshatch` · `WindowBlinds` · `RadialWipe` · `PerlinDissolve` · `DoomMelt` · `UndulatingBurnOut` |

### Elements (30)

| | Family | Variants (ask for them by name) |
|---|---|---|
| <img src="../library/gifs/kit-element/title_md.png" width="160"> | **Titles**<br><sub>Titles that size themselves: plain, scaled, cinematic, kinetic, on tiles.</sub><br><sub>`add_element(kind="title", …)`</sub> | `title` · `scale_title` · `cinematic` · `kinetic` · `tiles` |
| <img src="../library/gifs/kit-element/label_md.png" width="160"> | **Labels and tags**<br><sub>Chips, handles, stickers, price tags and buttons.</sub><br><sub>`add_element(kind="label", …)`</sub> | `label` · `handle` · `sticker` · `price_tag` · `button` |
| <img src="../library/gifs/kit-element/cursor_md.png" width="160"> | **Cursors and selection**<br><sub>Named collaborator cursors that click on arcs, and a selection marquee dragged open.</sub><br><sub>`add_element(kind="cursor", text="Dana", items=[[700, 400], [1200, 620]])`</sub> | `cursor` · `selection` |
| <img src="../library/gifs/kit-element/callout_md.png" width="160"> | **Callouts and chat**<br><sub>Pointers, speech bubbles and chat messages.</sub><br><sub>`add_element(kind="callout", …)`</sub> | `callout` · `bubble` · `chat` |
| <img src="../library/gifs/kit-element/counter_md.png" width="160"> | **Data**<br><sub>Counters, timers, progress bars, rings and ratings.</sub><br><sub>`add_element(kind="counter", …)`</sub> | `counter` · `timer` · `progress` · `ring` · `rating` |
| <img src="../library/gifs/kit-element/lower-third_md.png" width="160"> | **Text blocks**<br><sub>Lower thirds, quotes, text boxes and lists.</sub><br><sub>`add_element(kind="lower_third", …)`</sub> | `lower_third` · `quote` · `text_box` · `list` |
| <img src="../library/gifs/kit-element/underline_md.png" width="160"> | **Marks on text**<br><sub>Underline or highlight an existing text layer.</sub><br><sub>`add_element(kind="underline", …)`</sub> | `underline` · `highlight` · `scribble` |
| <img src="../library/gifs/kit-element/media_md.png" width="160"> | **Media slot**<br><sub>A rounded slot that fits an image or a clip.</sub><br><sub>`add_element(kind="media", …)`</sub> | `media` |
| <img src="../library/gifs/kit-element/glass-card_md.png" width="160"> | **Glass card**<br><sub>A smoky frosted card over a moving background.</sub><br><sub>`add_element(kind="glass_card", text=…, sub=…)`</sub> | `glass_card` |
| <img src="../library/gifs/kit-element/end-card_md.png" width="160"> | **Logo close**<br><sub>Our logo built stroke by stroke (Motion DNA videos only).</sub><br><sub>`add_element(kind="end_card", text="Motion DNA", sub=tagline, style="horizontal"?)`</sub> | `end_card` |

### Shapes (42)

| | Family | Variants (ask for them by name) |
|---|---|---|
| <img src="../library/gifs/kit-shape/circle_md.png" width="160"> | **Primitives**<br><sub>Circles, polygons, stars, badges, hearts, checks.</sub><br><sub>`add_shape(kind="circle", …)`</sub> | `circle` · `ring` · `square` · `frame` · `triangle` · `diamond` · `pentagon` · `hexagon` · `star` · `sparkle` · `badge` · `heart` · `shield` · `cross` · `plus` · `check` |
| <img src="../library/gifs/kit-shape/line_md.png" width="160"> | **Lines and arrows**<br><sub>Lines that draw on and travel off: waves, arrows, brackets, spirals, brush strokes.</sub><br><sub>`add_shape(kind="line", …)`</sub> | `line` · `wave` · `zigzag` · `arrow` · `curved_arrow` · `chevrons` · `brackets` · `spiral` · `infinity` · `brush` · `speed_lines` |
| <img src="../library/gifs/kit-shape/burst_md.png" width="160"> | **Bursts**<br><sub>Impacts, shockwave rings, pops, fireworks, confetti and swooshes.</sub><br><sub>`add_shape(kind="burst", …)`</sub> | `burst` · `impact` · `rings` · `pops` · `fireworks` · `confetti` · `swoosh` · `particle fireworks` · `confetti cannons` · `sparks` |
| <img src="../library/gifs/kit-shape/glitter_md.png" width="160"> | **Sparkles**<br><sub>Four-point sparkles that pop, twinkle and fade.</sub><br><sub>`add_shape(kind="glitter", …)`</sub> | `glitter` |
| <img src="../library/gifs/kit-shape/shape-row_md.png" width="160"> | **Rows and loaders**<br><sub>Rows of shapes, dot rows and a loader.</sub><br><sub>`add_shape(kind="shape_row", …)`</sub> | `shape_row` · `dots` · `loader` |
| <img src="../library/gifs/kit-shape/blob_md.png" width="160"> | **Blob**<br><sub>A liquid blob that keeps breathing.</sub><br><sub>`add_shape(kind="blob", …)`</sub> | `blob` |

### Backgrounds (12)

| | Family | Variants (ask for them by name) |
|---|---|---|
| <img src="../library/gifs/kit-background/stripes_md.png" width="160"> | **Patterns**<br><sub>Stripes, dots, grids and topographic lines.</sub><br><sub>`add_look(kind="stripes", …)`</sub> | `stripes` · `dots` · `grid` · `topo` |
| <img src="../library/gifs/kit-background/gradient_md.png" width="160"> | **Gradients**<br><sub>Moving gradients: four-colour, liquid and mesh.</sub><br><sub>`add_look(kind="gradient", …)`</sub> | `gradient` · `liquid` · `mesh` · `living gradient` |
| <img src="../library/gifs/kit-background/network_md.png" width="160"> | **Organic**<br><sub>A plexus network, breathing blobs and frosted glass.</sub><br><sub>`add_look(kind="network", …)`</sub> | `network` · `blobs` · `glass` · `flow field` |

### Looks (11)

| | Family | Variants (ask for them by name) |
|---|---|---|
| <img src="../library/gifs/kit-look/tritone_md.png" width="160"> | **Colour**<br><sub>Tritone and duotone grades.</sub><br><sub>`add_look(kind="tritone", …)`</sub> | `tritone` · `duotone` |
| <img src="../library/gifs/kit-look/vignette_md.png" width="160"> | **Frames**<br><sub>Vignette and letterbox.</sub><br><sub>`add_look(kind="vignette", …)`</sub> | `vignette` · `letterbox` |
| <img src="../library/gifs/kit-look/grain_md.png" width="160"> | **Texture**<br><sub>Grain and scanlines.</sub><br><sub>`add_look(kind="grain", …)`</sub> | `grain` · `scanlines` |
| <img src="../library/gifs/kit-look/dust_md.png" width="160"> | **Particles**<br><sub>Dust, embers and snow.</sub><br><sub>`add_look(kind="dust", …)`</sub> | `dust` · `embers` · `snow` |
| <img src="../library/gifs/kit-look/long-shadow_md.png" width="160"> | **Long shadow**<br><sub>A long flat shadow behind a layer.</sub><br><sub>`add_look(kind="long_shadow", …)`</sub> | `long_shadow` |
| <img src="../library/gifs/kit-look/glitch_md.png" width="160"> | **Glitch**<br><sub>An RGB glitch burst on a layer.</sub><br><sub>`add_look(kind="glitch", …)`</sub> | `glitch` |

### Text engine (11)

| | Family | Variants (ask for them by name) |
|---|---|---|
| <img src="../library/gifs/kit-text/chars-pop-rise_md.png" width="160"> | **Reveals**<br><sub>Per character, word or line: rise, mask, tracking, skew.</sub><br><sub>`animate_text(unit="chars", channels=["fade","rise"], ease="Pop")`</sub> | `Chars Pop Rise` · `Lines Mask Rise` · `Words Tracking Blur` · `Chars Skew Slide` |
| <img src="../library/gifs/kit-text/chars-3d-flip_md.png" width="160"> | **Playful**<br><sub>3D flips, wiggly scale and colour pops.</sub><br><sub>`animate_text(unit="chars", channels=["rotate3d","fade"], order="center", ease="Nudge")`</sub> | `Chars 3D Flip` · `Chars Wiggly Scale` · `Words Colour Pop` |
| <img src="../library/gifs/kit-text/words-decode_md.png" width="160"> | **Typing**<br><sub>Decode, a typewriter with its cursor and a font swap.</sub><br><sub>`animate_text(unit="words", channels=["decode","fade"], mode="flicker")`</sub> | `Words Decode` · `Typewriter Cursor` · `Font Swap` |
| <img src="../library/gifs/kit-text/captions_md.png" width="160"> | **Captions**<br><sub>Word-timed captions: highlight, karaoke, build, pop.</sub><br><sub>`add_captions(words_path=…, style="highlight")`</sub> | `Captions` |

### Moves (25)

| | Family | Variants (ask for them by name) |
|---|---|---|
| <img src="../library/gifs/kit-move/flip_md.png" width="160"> | **Flips and hinges**<br><sub>3D entrances that turn in.</sub><br><sub>`move(move="flip", layers=[…])`</sub> | `flip` · `hinge` · `tumble` |
| <img src="../library/gifs/kit-move/fly_md.png" width="160"> | **Fly and orbit**<br><sub>Travel in from depth or around a pivot.</sub><br><sub>`move(move="fly", layers=[…])`</sub> | `fly` · `orbit` |
| <img src="../library/gifs/kit-move/grow-edge_md.png" width="160"> | **Grow and squash**<br><sub>Grow from an edge, squash and stretch.</sub><br><sub>`move(move="grow_edge", layers=[…])`</sub> | `grow_edge` · `squash` |
| <img src="../library/gifs/kit-spring/react-spring-default_md.png" width="160"> | **Springs and eases**<br><sub>Real springs, wobble, elastic and bounce from react-spring and anime.js, on any keyed move (apply_spring).</sub><br><sub>`apply_spring(name="react-spring default", layers=[…])`</sub> | `react-spring default` · `react-spring gentle` · `react-spring wobbly` · `react-spring stiff` · `react-spring slow` · `react-spring molasses` · `anime spring default` · `anime spring bounce 0 · 500 ms` · `anime spring bounce 0.25 · 600 ms` · `anime spring bounce 0.5 · 628 ms` · `anime spring bounce 0.7 · 800 ms` · `anime outBack` · `anime outElastic` · `anime outBounce` · `anime outExpo` · `anime inOutCirc` |
| <img src="../library/gifs/kit-webfx/helix-3d_md.png" width="160"> | **3D scenes**<br><sub>Rendered 3D with alpha: the DNA helix or a product turntable (three.js), shapes that rain and pile up (Rapier).</sub><br><sub>`add_fx(kind="helix 3d", …)`</sub> | `helix 3d` · `drop 3d` |

### Behaviours (12)

| | Family | Variants (ask for them by name) |
|---|---|---|
| <img src="../library/gifs/kit-behavior/bubbles_md.png" width="160"> | **Fill**<br><sub>Bubbles, blob, voronoi cells and growth fill an area.</sub><br><sub>`add_behavior(behavior="bubbles", target="shape", …)`</sub> | `bubbles` · `blob` · `voronoi` · `grow` |
| <img src="../library/gifs/kit-behavior/flow_md.png" width="160"> | **Swarm**<br><sub>Flow fields and flocks move in a loop.</sub><br><sub>`add_behavior(behavior="flow", target="background", …)`</sub> | `flow` · `flock` |
| <img src="../library/gifs/kit-behavior/spring_md.png" width="160"> | **Physics**<br><sub>Springs and ropes react to the curve.</sub><br><sub>`add_behavior(behavior="spring", target="box", …)`</sub> | `spring` · `rope` · `fall` · `drop in` · `burst` |
| <img src="../library/gifs/kit-behavior/line-boil_md.png" width="160"> | **Modifier**<br><sub>Line boil: any layer drawn on 3s.</sub><br><sub>`add_behavior(behavior="line_boil", target="layer", …)`</sub> | `line_boil` |
<!-- catalog:end -->
