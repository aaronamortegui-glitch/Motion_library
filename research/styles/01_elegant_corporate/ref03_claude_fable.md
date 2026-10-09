# ref03 — Claude Fable 5.5 launch film (Anthropic)

`references/01_elegant_corporate/ref03.mp4` · 62.5 s · 1280×720 · 60 fps · contact sheets in `research/contact_sheets/ref03/`
Metrics computed on a 30 fps copy, for comparability with the other references.

**Verdict: Product launch, closest to "01 Elegant / corporate / product", but warmer and more expressive than ref01/ref02.**
Proposed sub-style: **Warm editorial** (storybook). It sits between Elegant and Playful on the tone axis. To be confirmed by Gian.
Energy: suave–medio.

## Structure

A narrative copy line ("Once upon a time… / Every fable has a moral.") frames a classic product-launch sequence:
promise → reveal → capabilities → proof (benchmarks) → values → availability → logo.

| t (s) | Section | What happens |
|---|---|---|
| 0–5 | Hook | blinking coral cursor; "Once upon a time," typed in serif italic |
| 5–10.6 | Problem | the typed line shrinks into a kicker; headline "AI could finish your *sentence.*" with the coral word rolling through function → feature → pull request → refactor → migration → release → roadmap, faster each time; a time slider below grows from seconds to a week |
| 10.6–14 | Turn | the slider becomes a full coral panel; "Now it can finish *the story.*" + hand-drawn underline |
| 14–20 | Reveal | text collapses into a dot → circular reveal → organic shapes burst → asterisk mark → "Introducing Claude Fable 5.5" |
| 20–29 | Capability 1 | blue liquid wipe; "Works for days, *not hours.*" + illustrated arch window cycling day/night, task list ticking off, progress bar |
| 29–36 | Capability 2 | peach liquid wipe; terminal card; "Writes the code. Runs the tests. Ships the fix." |
| 36–42 | Capability 3 | card zooms out → dark; coral dot becomes the center of an agent network, "Leads a team *of agents.*" |
| 42–50 | Proof | lavender liquid wipe; the coral dot drops and becomes a bar; benchmark charts with counting numbers; whip pans between charts; summary of 3 charts |
| 50–55 | Values | pink liquid wipe → dark; "Every fable has a moral."; two circles converge into a Venn, "*Powerful* and safe belong in the same story." |
| 55–60 | Availability | circles merge into a dot → circular reveal (same as 14 s) → shapes → logo lockup, "*Available today.*", platform pills |
| 60–62.5 | Sign-off | Anthropic wordmark reveal |

## Elements

| Type | Present | Notes |
|---|---|---|
| Text | main cast | large serif headlines; accent word in coral italic; small sans UI text |
| Abstract shapes | yes | organic blobs, asterisk, spiral, dots, wavy wipe bands. Hand-made feel, clean edges |
| Product / UI | yes | terminal card, task list, slider, charts, platform pills |
| Data viz | yes | bar charts + counting numbers |
| Illustration | yes | arch window landscape with day/night cycle (the only scenic element) |
| Logo | reveal + end | asterisk mark + wordmark; company wordmark at the end |
| Characters | none | the "story" is told through type and objects |
| Camera | minimal | one zoom-out and whip pans between charts; mostly flat 2D |

Kind of motion: **smooth tweens with long ease-outs**, **mask reveals** for text, **morph / continuity** (one coral dot travels through
the whole film), **organic wipes**, **idle loops** in the illustration and shapes.

## Lifecycle (measured where possible; frames given @30 fps)

### Coral dot: the protagonist (like ref02's dot, but in color)
- Is the cursor → collapses from the text → opens the circular reveal → is the center node of the agents → drops and **squashes on landing** to become the first bar → circles merge back into it → second reveal.
- Continuity device: scenes change around it.

### Circular reveal (iris) — measured
- Dot grows into a soft glowing disc, then the disc expands to fill the frame, revealing the next scene with shapes already popping in.
- **9 f (300 ms)** · `cubic-bezier(0.53, -0.25, 0.20, 0.87)`: a short hold, then a fast start and long deceleration. Nearest token Cruise (0.123).
- Used twice (14.4 s and 55.3 s) → bookend.

### Text
- **Typing:** serif italic with a blinking coral cursor. The cursor blinks ~1.7 s before typing starts. Typing has a human cadence (~3–4 f per character, pauses at spaces/commas).
- **Kicker transform:** the typed line shrinks and moves to the top-left to become the kicker of the next headline (~13 f). Text changes role instead of exiting.
- **Headlines:** **line by line, rising from a mask** (each line slides up from its baseline). Second line usually in coral italic.
- **Word roll (accelerando):** the accent word rolls vertically like a slot machine (~6–8 f per roll). The interval between rolls **shrinks** 1.2 → 0.9 → 0.55 → 0.55 → 0.3 → 0.25 s, building tension before the turn.
- **Hand-drawn underline:** draws on left→right (~10 f) after the line lands.
- **Exit:** lines slide up out of their mask, or collapse into the dot.
- **Numbers:** counters roll up with motion-blurred digits and a strong ease-out (23.8 → 78.4 in ~1 s, most of the change in the first third).

### Abstract shapes
- **Enter:** pop in with the circular reveal (scale up from nothing, staggered).
- **Hold:** idle loops (spiral rotates, small "ray" strokes blink in near the coral blob), subtle.
- **Exit:** carried away by the next wipe.

### UI / data
- **Terminal card:** enters from the bottom behind a wipe, settles; monospace typing ~1 character/frame; diff lines appear in blocks.
- **Agent nodes — measured:** fly out radially from the center node, staggered ~3 f; each travels **18 f (617 ms)** with a fast start and long tail (strong ease-out, first frame already 17% of the distance); then connecting lines draw, check marks pop, arrows travel back to the center.
- **Bars — measured:** grow **23 f (767 ms)** · `cubic-bezier(0.20, 0.40, 0.03, 1.03)`, ~3% overshoot, nearest token Pop (0.07). Comparison bars follow, staggered ~3 f, in muted colors.
- **Task list:** items appear one at a time with a coral check, synced with a progress bar and the day/night cycle.
- **Pills:** pop in one by one.

### Illustration
- Arch window: the sun travels across the sky, sky color shifts (peach → blue → violet night with moon → day again). A **time-lapse loop** that says "works for days" without words.

## Secondary animation
- Squash on landing (dot → bar), small overshoot on bars (~3%), idle loops (spiral, rays, sun/moon), motion blur on number digits and whip pans.
- More than ref01/ref02, but always small and functional. No wiggle, no bouncing characters.

## Transitions
| t (s) | Type | Duration |
|---|---|---|
| 10.8 | **progress bar → full-color panel** (UI element becomes the wipe) | ~5 f |
| 14.4, 55.3 | **dot → circular reveal** | 9 f (measured) |
| 20.2, 29.1, 41.9, 50.0 | **liquid / wavy-edge color wipe** (blue, peach, lavender, pink), crossing the frame | ~17 f total; coverage accelerates in, decelerates out |
| 35.7 | card pulls back / zooms out → cut to dark, coral dot carried over (match cut) | ~6 f |
| 44.4, 47.0 | **whip pan** with horizontal motion blur between charts | ~5 f |
| 54.8 | Venn circles merge into one dot → next reveal | ~10 f |

Each section is introduced by **one transition family (the liquid wipe), in a different color**. The wipe color previews the next section's accent.

## Speed and rhythm
- Energy 2.9 (lowest so far): 33% of the time in motion, 6.7 hard cuts/min (transitions are continuous rather than cuts).
- Holds ~1 s median, up to 4 s. Sections of 5–9 s.
- Rhythm follows the copy: one statement per section, with an **accelerando** at the word roll (the only tension build).

## Look
Cream background, coral accent, near-black for "serious" sections (agents, values). Muted secondary colors (blue, sage, peach, lavender, pink).
Serif headlines + italic accents, small sans UI. Organic, slightly hand-made shapes.

## What defines it (candidates)
1. **Narrative copy as the spine:** one line per section, with a story frame (once upon a time → moral).
2. **A single colored protagonist dot** that carries continuity across every section (as in ref02).
3. **Text builds by mask-rise per line**, with a **colored italic accent word**.
4. **Organic liquid wipes**, one color per section, as the main transition.
5. **Elements change role instead of exiting** (line → kicker, slider → panel, dot → node → bar).
6. **Long ease-outs everywhere**; overshoot ≤ 3%, squash only on impacts.
7. **Quiet idle loops** during holds (illustration time-lapse, rotating spiral).
8. **Data as motion:** charts that grow, counters that roll.
9. **Bookends:** the circular reveal + shape burst opens and closes the product reveal.
