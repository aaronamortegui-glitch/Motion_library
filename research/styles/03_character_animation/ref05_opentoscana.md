# ref05 — OpenToscana explainer

`references/03_character_animation/ref05.mp4` · 108.5 s · 1920×1080 · 24 fps · contact sheets in `research/contact_sheets/ref05/`

**Verdict: first reference for "03 Character".** Flat-vector, character-driven explainer for a regional open-data platform (Tuscany).
Sub-style: **Flat vector explainer**. Energy: suave (2.6); tone: expressive through character acting and color, not speed.

## Structure

Problem → solution → benefits → vision → logo, told through characters and objects. One solid background color per section.

| t (s) | Section | Background | What happens |
|---|---|---|---|
| 0–10 | Problem: bureaucracy | grey-blue | iris opens from black; impatient queue at an office counter; ticket number flips 01 → 02 |
| 10–20 | The office | light cyan | whip pan; a character rolls in on an office chair with speed lines; the desk scene assembles itself (props pop in); logo appears on the monitor |
| 20–36 | The narrator | green | circle wipe; a narrator character (bust) acts while line icons draw on around him and orbit his head |
| 36–48 | Data | blue grid | camera pushes through the icons; bars rise; characters jump onto the bars; labels (TURISMO, SPORT, TERRITORIO, AMBIENTE); speech bubbles |
| 48–61 | Citizens | yellow | crowd walks in; colored % chips count up; the floor fills with colors |
| 61–76 | Apps | purple | hand with phone rises; Pisa tower + pigeon; callouts; the phone stays while the world behind it changes (map with traffic, body diagram, restaurant reviews) |
| 76–89 | Network | orange | node network; icons cloud; buildings connected to a cloud |
| 89–98 | Vision | sage | Tuscan landscape; the narrator gets an idea (light bulb); a rocket draws on and launches |
| 98–103 | Scale | navy | zoom out landscape → map → globe; the rocket orbits the globe; the globe becomes the logo mark |
| 103–108 | Logo | white | white circle reveal; wordmark slides out from behind the mark; app icons pop in |

## Elements

| Type | Present | Notes |
|---|---|---|
| Characters | main cast | flat vector people, rigged (cut-out puppets); a recurring narrator in teal jacket + crowds |
| Objects / icons | yes | desk props, phone, rocket, globe, line icons in circles |
| Data viz | yes | bars, pie, % chips, trend line |
| Text | minimal | a few labels in bold sans; no headlines (voiceover carries the message) |
| Backgrounds | solid colors | one saturated color per section, subtle paper grain |
| Camera | yes | whip pans, push-ins, zoom-outs between scales |

Kind of motion: **rigged character animation** (walks, jumps, head turns, gestures), **pop-ins with soft overshoot**,
**line draw-ons**, camera pans/zooms, **element continuity** (the phone, the narrator, the rocket → logo).

## Lifecycle (measured where possible; frames @24 fps)

### Characters
- **Enter:** walk in from the frame edge (walk cycle) and stop in pose; or **gag entrances** (rolling in on an office chair with speed lines, decelerating into the desk).
- **Move:** acting: head tilts, blinks, brow raises, mouth shapes; impatience loops in the queue (weight shifts, a scribble of annoyance over a head); **jumps with arcs** onto bars; walking off together.
- **Hold:** never frozen: idle breathing and blinks; background characters keep small loops.
- **Exit:** walk off frame, or the camera leaves them (whip pan, push-in).

### Objects / props
- **Set assembly:** the office builds itself prop by prop (desk extends, plant pops, clock flies in spinning, monitor flips into place), each ~4–6 f with a soft settle.
- **Hand + phone enter — measured:** rises from the bottom in **20 f (833 ms)**, `cubic-bezier(0.53, 0.31, 0.30, 1.29)`, **4% overshoot** held ~5 f, then settles. Nearest token Cruise (0.076) + overshoot.
- **Rocket:** draws on as an outline, then fills solid (**construction → solid**, as in ref02), then launches. **Launch — measured:** **22 f** until off-frame, `cubic-bezier(0.71, -0.02, 0.87, 0.45)` = pure ease-in (accelerating), nearest **Launch (0.076)**. Smoke puffs trail behind.
- **Icons (narrator section):** a circle draws on with a **radial ray burst**, the line icon appears inside, then it shrinks and **orbits / drifts** around the head.
- **End icons — measured:** each pops in **4 f** (`0.25, 0, 0.52, 0.94`, no visible overshoot), staggered ~5 f.

### Data
- Bars rise from the floor with motion-blur stretch, staggered; % chips count up; speech bubbles with icons pop between characters ("dialogue" without words).

### Logo
- The globe becomes the mark → **white circle reveal — measured: 13 f (542 ms)**, `0.76, 0.04, 0.54, 0.92` (ease-in, then lands)
  → **wordmark slides out from behind the mark — measured: 10 f (417 ms)**, `0.71, 0.06, 0.30, 0.94` (ease-in-out) → app icons pop in one by one.

## Secondary animation
- Character acting and idle loops, soft overshoot (~4%) on arrivals, speed lines on gags, smoke trails, a light-bulb flash for "idea", pigeon idle.
- Springs stay soft: the expressiveness comes from **acting and gags**, not from bouncy curves.

## Transitions
| Type | Where | Duration |
|---|---|---|
| **Iris from black** — measured | 0.4 s | **5 f (208 ms)**, `0.23, 0.22, 0, 0.94` strong ease-out |
| **Whip pan** (scene slides out with blur, new color slides in) | 10, 61–65 | ~6 f |
| **Circle wipe from a point** on an object (new color expands) | 20 | ~4 f |
| **Push-in through foreground elements** (icons fly past camera) | 36 | ~10 f |
| **Element continuity** (phone stays, world changes behind it) | 65–75 | — |
| **Zoom out across scales** (landscape → map → globe) | 98 | ~12 f |
| **Hard cuts** between sections | 48.5, 61.6, 76 | — |
| **Morph + white circle reveal** (globe → mark → white) | 103 | 13 f (measured) |

## Speed and rhythm
- Energy 2.6 (calm): 4.4 cuts/min, 34% of the time in motion, median hold 1.5 s (up to 8.8 s).
- Pacing follows the voiceover: one section per idea (10–15 s), with gags as punctuation.

## Look
Flat vector, saturated solid backgrounds that change per section (grey-blue, cyan, green, blue, yellow, purple, orange, sage, navy),
orange/teal character palette, subtle paper grain. Colorfulness 87.8: by far the highest so far.

## What defines it (candidates for family 03)
1. **Characters carry the story** with acting (expressions, gestures, gags), not just movement.
2. **Soft springs** (~4% overshoot) and gentle pop-ins; the energy comes from acting, not from fast curves.
3. **One saturated background color per section**: the color change marks the topic change.
4. **Sets assemble themselves** prop by prop.
5. **Visual gags as punctuation** (chair roll-in, light bulb idea, rocket).
6. **Icons and speech bubbles stand in for text**; minimal typography.
7. **Continuity devices**: the narrator, the phone, rocket → globe → logo.
8. **Logo**: mark first, wordmark slides out from behind it (same pattern as ref01 and ref03).
