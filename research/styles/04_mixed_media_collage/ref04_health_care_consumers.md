# ref04 — "Health care consumers" explainer (Deloitte University Press)

`references/04_mixed_media_collage/ref04.mp4` · 155.3 s · 1920×1080 · 29.97 fps · contact sheets in `research/contact_sheets/ref04/`

**Verdict: doesn't fit Elegant, Playful reel or Character.** Proposed new family **"04 Mixed media / collage"** (pending Gian's approval).
Format: editorial explainer (voiceover-driven, ends with "Learn more at DUPress.com"). Energy: medio, but continuous.

## Structure

A question ("How can pharmaceutical companies engage with patients?") opens a long, continuous journey through collage scenes,
each illustrating one idea of the voiceover, and returns to the opening plate for the call to action.

| t (s) | Scene | What happens |
|---|---|---|
| 0–6 | Question | textured plate (pill blister, green pharmacy cross, ECG line, crowd); stencil title in magenta builds word by word |
| 6–16 | Patient | camera travels up through layers; a woman's B/W silhouette fills with pink collage and pours a stream of pills; stamped labels (coordinated / convenient / customized / accessible) |
| 16–31 | Industry | collage factory (pills, machines, photo cutouts) in teal pill-shaped frames; arrays of capsules pop in diagonally |
| 31–42 | Pharmacy | rings scale up, B/W hands slide in from the edges, neon pharmacy cross in a magenta ring |
| 42–51 | Population | silhouettes walking in a row (walk cycles), arrows sliding, heart-rate line drawing, numbers |
| 52–64 | Emergency | ambulance collage; the camera slides diagonally through glass/paper layers to a hand holding a phone |
| 64–88 | Data / hand | phone in hand with icon network; colorful app icon; "ENGAGEMENT + CARE" |
| 88–100 | Countdown | segment-digit counter 39 → 13, magenta paper strips wiping across in a loop, loupe over a crowd |
| 101–109 | Flow | dark plate, white silhouettes, streak lines and arrows flowing |
| 109–123 | Process | diagonal plate wipe; hand-drawn orbits; pill labels morphing (insurance verification → benefits investigation → …); stripes growing |
| 123–137 | Industry 2 | skyline + products collage, teal frames |
| 137–150 | Crowd | hard cut to aerial crowd footage, with painted collage overlays |
| 150–155 | CTA | returns to the opening plate; "Learn more at: Industries: Life Sciences & Health Care · DUPress.com" |

## Elements

| Type | Present | Notes |
|---|---|---|
| Photo cutouts | main cast | B/W halftone photos (people, hands, pills, machines, ambulance), cut out like paper |
| Textures | everywhere | paper, concrete, scratches, stains, glass, film grain: every layer is textured |
| Abstract shapes | yes | rings, pill frames, stripes, dots, arrows, brush strokes, radial bursts |
| Text | supporting | condensed stencil caps (magenta/white), labels in pill shapes, segment digits |
| Silhouettes / people | yes | silhouettes walking (cycles), crowd footage, but nobody acts as a character |
| Live footage | yes | aerial crowd (137–150), treated and overlaid |
| Camera | constant | travels through the layered collage in 2.5D |

Kind of motion: **2.5D camera travel through layers** (rigid, mostly linear) + **texture boil** (procedural/frame-by-frame) +
**looping secondary elements** (arrows, strips, flicker) + **reveals** (fills, wipes, draw-ons) + **articulated** silhouettes (walk cycles).

## Measured
- **Never still:** something moves 84.5% of the time. There's only one hold longer than 0.5 s in 155 s.
- **Two clocks at once:** motion runs on every frame (0 duplicated frames), **but textures and collage pieces change every 3 frames**
  (frame-difference autocorrelation peak at 3 f). The hand-made "boil" sits on top of smooth movement.
- **Camera travels** (the transitions between scenes), from optical flow:

| t (s) | Direction | Duration | Curve | Nearest token |
|---|---|---|---|---|
| 5.5 | up | 45 f (1.5 s) | ~linear | Flat (0.02) |
| 42.2 | up-right | 24 f | ~linear | Flat (0.02) |
| 47.3 | diagonal | 32 f | ease-in with a slight pull-back | Recoil (0.09) |
| 59.4 | up (long) | 134 f (4.5 s) | ease-out | Land (0.14) |
| 77.5 | down | 79 f | ease-in | Launch (0.04) |
| 119.3 | down | 26 f | `0.60, 0.28, 0.19, 0.81` ease-in-out | Cruise (0.055) |
| 123.6 | diagonal | 18 f | ~linear | Flat (0.05) |

  Peaks of 11–26 px/frame at 480 px width ≈ **70–160% of the frame width per second**: fast, but short.
- **Countdown:** one number every ~0.4–0.5 s, each change with a flicker; magenta strips sweep across every ~1.5 s.

## Lifecycle

### Photo cutouts / collage pieces
- **Enter:** slide in from the frame edges (hands), fill a silhouette (woman), pop into arrays (capsules), or are already there when the camera arrives.
- **Move:** small drifts and loops; mostly the **camera** moves, not the pieces.
- **Hold:** never still: texture boil every 3 f, flicker, small loops.
- **Exit:** left behind by the camera travel, or covered by a plate/strip wipe.

### Text
- Title and CTA: **condensed stencil caps**, built word by word with a **glitch / scramble** (letters flicker before settling).
- Labels: **stamped in pill-shaped frames**, popping in one by one; a label **morphs into the next one** (the pill shrinks, empties, refills with new text).
- Numbers: segment-display digits counting down, with flicker.

### Abstract shapes
- Rings **scale up** with stroke accents; radial **bursts** of lines sprout around people; arrows **slide in a loop**; stripes **grow** staggered; hand-drawn orbits rotate.

### People
- Silhouettes **walk in cycles** (articulated); crowds come from treated footage. They illustrate "patients" as a mass, not as characters.

## Secondary animation
- Texture boil (every 3 f), flicker and glitch, looping arrows and strips, radial bursts, drifting dots. Constant and layered.
- No squash & stretch, no overshoot: the energy comes from **density and texture**, not from springs.

## Transitions
| Type | Where | Notes |
|---|---|---|
| **Camera travel through layers** (2.5D) | most scene changes | 0.6–1.5 s, mostly linear / ease-in-out, motion blur |
| **Plate / strip wipe** | 59.5, 88–100, 109 | a textured paper plate or magenta strip sweeps across |
| **Hard cut** | 31, 42, 137 | to a new composition |
| **Dissolve / glitch** | 150 | back to the opening plate (bookend) |

## Speed and rhythm
- Energy 4.2 with rhythm **Flow**: motion part 8.5, cuts part 2.9 (3.1 cuts/min, avg shot 17 s).
- Pacing follows the voiceover: one visual metaphor per sentence, connected by camera moves instead of cuts.

## Look
Desaturated paper/concrete base (cream, grey-teal) with **neon accents**: magenta, mint/teal, lime, pharmacy green. B/W halftone photography.
Grunge, hand-made, editorial. The highest colorfulness so far (41.5).

## What defines it (candidates for family 04)
1. **Collage of photo cutouts + textures** as the visual language; every layer has grain/paper.
2. **The camera travels through 2.5D layers** instead of cutting.
3. **Two clocks:** smooth motion on ones + **texture boil on threes**.
4. **Never still:** layered loops (arrows, strips, flicker) keep every hold alive.
5. **Neon accent colors on a desaturated base.**
6. **Stencil / label typography** with glitch builds and morphing labels.
7. **Energy from density, not springs:** no overshoot, no squash.
8. **Bookend:** opens and closes on the same plate.
