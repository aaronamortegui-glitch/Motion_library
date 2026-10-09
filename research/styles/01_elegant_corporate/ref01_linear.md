# ref01 — Linear brand film

`references/01_elegant_corporate/ref01.mp4` · 26.5 s · 1920×1080 · 24 fps · contact sheets in `research/contact_sheets/ref01/`

**Verdict: fits "Elegant / corporate / product".** Energy: suave, with brief medio moments in transitions.

## Structure

Bookended logo → 7 one-phrase scenes → logo. One phrase per scene, ~2.5–3.3 s per scene.

| t (s) | Scene | Phrase | Main elements |
|---|---|---|---|
| 0.0–3.5 | Intro | "Introducing" → Linear logo | text, thin ring, light point → logo mark |
| 3.9–7.4 | Orbit | "From an idea" / "To a plan" | glowing point, orbit ribbon, bokeh orbs, 3D arc segments |
| 7.4–9.8 | Blocks | "Organise what matters" | 3D white blocks, camera drift |
| 9.8–12.7 | People | "Align your team" | top-down people walking into a circle |
| 12.8–16.2 | Spheres | "Clear Direction" | dark 3D spheres, white arrow/cursor |
| 16.2–20.3 | Cubes | "Move work forward" | row of rotating cubes, paper-plane accent |
| 20.4–23.2 | Ring | "Focus on what ships" | light ring + diagonal glass bar |
| 23.2–26.5 | Outro | Linear logo | logo on light gray |

## Elements

| Type | Present | Notes |
|---|---|---|
| Abstract shapes | main cast | spheres, cubes, blocks, rings, ribbons, light points, bokeh |
| Text | yes, minimal | small, light, italic sans; never the hero except the opening |
| Characters / humans | once | tiny top-down people as a crowd (abstracted, not acting) |
| Logo | intro + outro | identical mechanism both times |
| Camera | constant | slow 3D drift/dolly; depth of field is a key ingredient |

Kind of motion: mostly **rigid transforms** of 3D objects + **camera moves**; **reveals** for text and logo. No deformation, no squash & stretch.

## Lifecycle (measured where possible)

### Logo (intro, f44–f80) — measured
- **Enter:** text "Introducing" blurs horizontally (smear) → collapses into a point of light → point becomes the logo mark.
- **Move:** **anticipation**: mark first drifts +20 px right (~4% of travel, 6 frames), then slides 480 px left.
  Total 37 f = **1.54 s**. Fitted curve `cubic-bezier(0.53, -0.26, 0.37, 0.90)`. No current token matches (closest Flat at 0.145 → new curve).
  Long deceleration: last 40% of travel takes ~15 frames.
- **Reveal:** the wordmark "Linear" is revealed from *behind* the mark as it slides (mask reveal, right→left).

### Logo (outro, f565–f600) — measured
- **Enter:** blurred dark blob fades in from flat white, then **rack-focus** to sharp (~0.9 s).
- **Move:** slides 480 px left, fast start, 16 f to arrive, then **soft 4% overshoot** that returns over ~20 frames (no bounce).
  Total 36 f = **1.5 s**. `cubic-bezier(0.42, 1.11, 0.23, 1.08)`, nearest token Pop (0.048) but slower and subtler.
- Wordmark revealed from behind the mark again → **bookend**: intro and outro use the same mechanism.

### Text
- **Opening title:** per character, left→right, ~1 character every 2 frames (linear rate, `Flat`), each character fades in from blur. 11 characters in ~20 f.
- **Phrases:** per **word**, 3–6 f stagger, each word fades in with blur (~6–8 f). Small, light weight, italic, low contrast, centered.
- **Hold:** ~1.4–2 s per phrase.
- **Exit:** text has no exit animation of its own. It leaves with the scene: blurred by camera/depth of field, or washed out by the light transition.

### Abstract shapes
- **Enter:** grow from a point (bokeh orbs scale up from tiny dots), rise into frame (cubes), or fly in on arcs (3D arc segments around the core).
- **Move:** slow, continuous; cubes rotate one after another in a **wave** along the row.
- **Hold:** never fully still: camera keeps drifting, objects keep rotating slowly.
- **Exit:** through the camera (out of focus, out of frame) or the transition. No individual exits.
- **Accent:** one small fast element per scene (white arrow, paper plane) that crosses the frame faster than everything else. It's the only "quick" motion.

## Secondary animation
- Anticipation before the logo slide (measured +4%).
- Soft overshoot with slow settle (measured 4%, no oscillation).
- Constant camera drift and depth-of-field breathing in every hold.
- Motion blur on fast moves; blur used as a design element (smears, bokeh, rack focus).
- No squash & stretch, no wiggle, no bounces.

## Transitions
The signature of the piece: **light-based transitions**.

| t (s) | Type | Duration |
|---|---|---|
| 1.4–1.8 | text smears horizontally and collapses into a light point | ~8 f |
| 7.4 | camera rushes through with heavy blur | ~3 f |
| 9.75–10.0 | **bloom to flat gray**, new scene emerges from it with low contrast that resolves | ~3 f flash + ~4 f resolve |
| 12.7–12.95 | same: flash to gray, scene fades up from washed-out to full contrast | ~2 f + ~5 f |
| 15.75–16.3 | **foreground occlusion wipe**: camera passes behind a big blurred sphere that fills the frame | ~13 f |
| 20.25–20.5 | **overexposure → dark light-leak wipe** | ~6 f |
| 23.13–23.2 | **flash to white**, logo resolves with rack focus | 2 f + ~22 f |

Cuts are quick (2–7 f) while the scenes are slow.

## Speed and rhythm
- Motion energy stays low throughout. Spikes are only at transitions.
- Scenes 2.5–3.5 s; phrases hold ~1.5–2 s; reveals 0.5–1.5 s.
- Main moves ≥ 1.5 s (logo); per-word staggers 3–6 f.
- No beat-synced cutting: the rhythm follows the copy (one phrase, one scene).

## Look (not motion, but part of the style)
Monochrome, soft studio lighting, heavy depth of field, bokeh, film grain/softness.

## What defines the style (candidates to confirm with more references)
1. **Slow main moves with long deceleration** (≥ 1.5 s, last 40% takes ~40% of the time).
2. **Restrained secondary motion:** anticipation and overshoot exist but stay ≤ 5%, with no oscillation.
3. **Blur as a motion tool:** text and logo resolve from blur; rack focus; depth of field.
4. **Light transitions:** flashes, blooms, washes, light leaks instead of shape wipes.
5. **Text is quiet:** word-by-word blur-fade, small and light, no exit of its own.
6. **Never fully still:** constant slow camera drift during holds.
7. **One fast accent per scene** for contrast.
8. **Bookending:** intro and outro share the same mechanism.

## Mapping to the library (draft)
- Logo slide: new curve (anticipation-in + long ease-out), duration ≈ Stage+ (36–37 f @24 = ~45 f @30).
- Outro slide: Pop-like but slower, overshoot 4%.
- Text: existing `Blur Words` (per word) is the closest match for the phrases; `Blur In` for the logo resolve. Missing: a per-character blur-in at a 2 f stagger for titles.
- New transitions needed: light flash / bloom-to-gray, foreground occlusion wipe, rack-focus resolve.
