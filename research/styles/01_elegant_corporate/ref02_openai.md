# ref02 — OpenAI brand film

`references/01_elegant_corporate/ref02.mp4` · 110 s · 1920×1080 · 30 fps · contact sheets in `research/contact_sheets/ref02/`

**Verdict: fits "Elegant / corporate / product"**, but it's a different flavor from ref01: **editorial / Swiss / flat 2D**
instead of cinematic 3D. Energy: suave overall, with short dinámico bursts in the typography sections.

## Structure

The **black dot** is the protagonist and the thread: it starts as a text cursor, becomes a circle, a dot grid,
particles, color swatches, a photo mask and finally the logo.

| t (s) | Section | What happens |
|---|---|---|
| 0–6 | Prompt | dot = cursor; "What can I help with?" typed, then deleted |
| 6–17 | Dot system | dot → big circle → construction diagrams → particles → dot grid + principles list (Simplicity / Space / Imperfection / Vital) |
| 17–31 | Construction | geometric construction lines → glyph outlines with bezier handles → outline vs filled glyphs → full character set |
| 31–47 | Typography | OpenAI Sans weights, scripts, rapid editorial layouts, product names |
| 47–58 | Wordmark | dot → outline circle → construction of "OpenAI" → solid → product names typed in place |
| 58–64 | Logo | blossom construction drawn in thin lines → solid logo → shrinks |
| 64–72 | Color | dot → big circle cycling through the palette (with a black/white invert) → 7 swatches |
| 72–80 | Particles | swatches scatter into colored confetti → converge into one dot → sky gradient inside the circle |
| 80–92 | Photography | full-bleed and framed photos (nature, silhouettes) with scattered words |
| 92–98 | Grid | wordmark shrinks into a layout grid; product names jump between columns |
| 98–105 | Collage | layered stack of brand applications, piling up fast |
| 105–110 | End | logo, then wordmark |

## Elements

| Type | Present | Notes |
|---|---|---|
| Abstract shapes | main cast | dot, circles, dot grids, particles, construction lines, color swatches |
| Text | main cast | the typeface itself is a subject: glyphs, weights, scripts, specimen |
| Characters / humans | only in photos | silhouettes, hands; never animated as characters |
| Photography | section 80–92 | framed in white, cut on rhythm, revealed through the dot |
| Logo / wordmark | multiple | built from construction lines, then solid |
| Camera | none | completely flat, static frame; no camera moves |

Kind of motion: **reveals** (line draw-on, typing), **rigid transforms done as snaps**, **morph by substitution**
(the dot becomes something else via a cut), procedural (particles). No deformation, no 3D, no blur.

## The signature move: snap + micro-settle (measured)

Scale changes don't tween; they **jump in one frame and then settle the last ~10% over 8–10 frames**:

| Moment | 1-frame jump | Then settles | Settle |
|---|---|---|---|
| dot → big circle (6.3 s) | 33 → 1041 px (97%) | → 1057 px | 8 f, `bezier(0, 1.17, 0, 0.91)` ≈ steep ease-out |
| circle → bigger circle (65.7 s) | 956 → 1252 px (92%) | → 1279 px | 8 f, same curve |
| logo shrink (63.1 s) | 322 → 223 (80%) | → 197 | 10 f, `bezier(0, 0.96, 0, 0.88)` |
| wordmark into grid (92.5 s) | 1267 → 1026 (95%) | → 1014 | ~6 f |

This reads as **"cut on the action"**: precise, editorial, never floaty. The residual settle keeps the cut from feeling rough.
None of the current tokens covers it → candidate new behavior "Snap" (jump ≥ 90%, then a steep ease-out over Glide/Arrive).

## Lifecycle

### Dot / circles
- **Enter:** appears with a cut, or is what's left when something else collapses.
- **Move:** snaps between scales; cycles color by cut (one state every ~0.6–1 s).
- **Hold:** long, completely still: 1.3–1.7 s before anything happens.
- **Exit:** transforms into the next element (circle → construction lines → dot; dot → particles; dot → photo mask). Elements never just leave: **they become the next thing**.

### Particles (72–77 s) — measured
- Scatter outward from the swatches, drift ~2 s, then **converge with an ease-in** (accelerating, `bezier(0.67, -0.04, 0.74, 0.97)` ≈ Launch) over 13 f and snap into a single dot.

### Construction lines
- Lines and circles draw on (trim paths), intersections get small circles and tick marks, then the solid shape replaces the construction via a cut.
- Used for: geometry, glyphs (with bezier handles), wordmark, logo blossom.

### Text
- **Typing:** character by character with a **human, irregular cadence**: bursts of 2–4 characters at 1–2 f each, then pauses of 10–20 f between words. Deleting is faster than typing (~9 f for the whole phrase).
- **Product names:** typed in place, replacing the previous name (OpenAI → ChatGPT → Sora → Research), ~0.6 s each.
- **Glyph sections:** one glyph per ~1 s (outline left, solid right); outline and solid switch at different moments (staggered by a few frames).
- **Character set:** big "A" → duplicates → fills the screen with progressively smaller glyphs (new density every ~3 f); random glyphs flash in accent colors.
- **Editorial bursts (36–47 s):** layouts cut every 2–6 f; rotated words, words typed in sequence, overlapping big glyphs.
- **Phrases over photos:** words scattered across the frame, appearing one after another.
- No blur, no fade-ups. Text appears by **typing or by cut**.

### Photography
- Cut on rhythm (~1–1.5 s per image); framed images sit on white with generous margins, or full-bleed.
- Enters through the dot (sky gradient inside the circle → full-bleed water).

## Secondary animation
- Practically none: no overshoot, no bounce, no squash & stretch, no anticipation, no blur, no camera drift.
- The only "softening" is the 8–10 f micro-settle after a snap.
- Accent: random glyphs flashing in color inside the specimen.

## Transitions
- **Hard cuts** almost everywhere, many as **match cuts on the dot** (the dot stays in the same position and the world changes around it).
- **Transformation as transition:** the element morphs (by cut) into the next section's element.
- **Inversion:** black ↔ white swap (67.2 s).
- **Mask reveal through the dot:** a photo inside the circle → full-bleed photo.
- **Collapse:** swatches → particles → one dot.

## Speed and rhythm
- Extreme contrast between **long still holds (1–2.5 s)** and **bursts of fast cuts (2–6 f per layout)**.
- Motion energy is ~0 for most of the film; activity concentrates in 3 bursts (27–30 s, 36–46 s, 79–92 s).
- Typing rhythm stands in for music-driven pacing.

## Look
White background, black as the main color; color only in one section (soft blues, lavender, navy) and in photography.
Single typeface family. Grid-based, generous white space, tiny UI marks in the corners (like a design document).

## What defines it (candidates)
1. **One protagonist element** (the dot) that carries the whole narrative.
2. **Snap + micro-settle** instead of tweens.
3. **Transformation instead of entering and exiting:** each element becomes the next.
4. **Construction → solid:** show the underlying geometry, then the final form.
5. **Typing as the text mechanism**, with a human cadence.
6. **Long, absolutely still holds** contrasted with short bursts of fast cuts.
7. **No secondary motion, no blur, no camera.** The restraint *is* the style.
