# ref13 — "1984" (Orwell) · typographic zoom-through trailer

`references/_inbox/ref13.mp4` · 15.1 s · 24 fps · 1344×768 · contact sheets in `research/contact_sheets/ref13/`

**Verdict: between 01 Elegant · Cinematic and 04 Mixed media; proposed sub-style "Cinematic editorial / zoom-through".**
A short book-style trailer for Orwell's *1984*: moody, desaturated cinematic stills (newspaper press, telescreen eye, a man writing, a couple in a light beam, an evidence board, an interrogation room)
with **big lowercase heavy-serif statements** built word by word on top, and **every scene change is a camera zoom-through into the type or the image**.
Ends on a halftone "BIG BROTHER" poster. No brand/publisher visible. The imagery looks AI-generated (garbled stamp text "WNSIUNET DEIEIIER", nonsense handwriting): read from sheets, not verified.
Energy 5.2; tone mid (≈5): restrained color and motion, expressive typography.

## Structure

| t (s) | Scene | Text | What happens |
|---|---|---|---|
| 0–1.5 | Title | **1984** | red rubber stamp slams onto the title (f2–f4); accelerating zoom into the "8" → black |
| 1.5–3.4 | Printing press | **the past is rewriten.** | newspaper with a redacted face; words appear one by one; redaction bars; zoom-through the word "rewriten." |
| 3.4–5.3 | Telescreen | **you are always watched.** | an eye on a huge screen in a concrete plaza; words build; zoom-through into the eye's iris → next scene inside the pupil |
| 5.3–7.2 | Writing | **thoughtcrime** | a silhouetted man at a desk; cursive handwriting writes on across the paper; a red "!" stamp appears |
| 7.2–9.2 | Couple | **they rebel.** | red square expands from the stamp to fill the frame, a window opens inside it onto a couple in a light beam; the light then sweeps off left→right, erasing the type |
| 9.2–11.1 | Evidence board | **they are caught.** | photos pinned with red string; stamps land on the photos; the string tightens; camera tilts down into darkness |
| 11.1–13.2 | Interrogation | **2+2=5** | dark cell, a man at a table under a lamp; the equation builds glyph by glyph |
| 13.2–15.1 | End | **BIG BROTHER** | hard cut to a halftone poster of eyes; "BIG", then "BROTHER" with a seated-man pictogram as the R; hold |

## Elements

| Type | Present | Notes |
|---|---|---|
| Photo / still imagery | main cast | cinematic stills (likely generated), each with slow camera push or tilt |
| Text | central | lowercase heavy high-contrast serif, large (≈ 1/6 of frame height), top-left aligned, ends with a period; one handwriting write-on; a condensed bold sans on the end poster |
| Object | yes | red rubber stamps, red string, redaction bars, the "!" stamp |
| Characters | silhouettes only | no acting, no rigs: figures are part of the image |
| Camera | central | zoom-throughs (scale up 7–11× into a letter or the eye), slow pushes, a tilt down |

Kind of motion: **camera moves on stills + text builds**. Elements rarely move on their own (stamps, string, red square).

## Lifecycle (highlights; frames @24)

- **Stamp slam, f0–f4:** the red stamp appears large/blurred over "1984" at f2 and is set at f4 (2 f): a hit, no bounce. Read from sheet `a_stamp_zoomthrough_0-2.2.png`.
- **Words, enter:** one word at a time, left to right; partial words in tiles ("the pa", "watc") show a **fast left-to-right reveal within the word**, ~3–4 f per word (e.g. "you" f96, "are" f99, "always" f102, "watched." f105–f108). Read from sheets.
- **Text, hold:** ~1 s fully readable while the camera keeps pushing slowly.
- **Text, exit:** never fades on its own. It is **carried out by the zoom-through** (1984, rewriten., watched.) or **erased by the light** ("they rebel." goes dark left→right as the beam sweeps off, f204–f216).
- **Handwriting:** cursive line writes on over ~25 f (f141–f168), then a red "!" stamp pops on the desk.
- **2+2=5:** glyphs appear one by one, ~3–6 f apart (f271 "+", f274 "2+", f280 "2+2", f283 "2+2=", f289 "2+2=5"). Read from sheet `d_caught_2plus2_logo_9.2-13.6.png`.
- **Logo:** "BIG" (f319), then "B?OTHER" with the pictogram (f322): a two-step cut build, then a 1.7 s hold.

## Measured (script: `research/batch/ref13/measure.py`; ORB feature matching → cumulative scale)

| Behavior | Frames @24 | Scale | Curve (fit on log-scale progress) | Nearest token |
|---|---|---|---|---|
| Zoom-through "1984" | f18–f33 · 15 f (625 ms) | 1.0 → 7.5× (then cut) | `0.11, 0.00, 0.66, 0.03` rmse 0.002 | **Launch (0.022)** |
| Zoom-through "rewriten." | f64–f82 · 18 f (750 ms) | 1.0 → 8.4× | `0.50, 0.07, 0.57, 0.26` rmse 0.010 | **Launch (0.066)** |
| Zoom-through eye ("watched.") | f116–f130 · 14 f (583 ms) | 1.0 → 11× | `0.67, 0.14, 0.30, 0.12` rmse 0.017 | Launch (0.113) |
| Red square expand | f168–f175 · 7 f (292 ms) | width 64 → 1343 px (full frame) | near-linear, slightly accelerating (fit unstable, rmse 0.018) | ~Flat |

- The zoom-throughs are **pure accelerations**: the scale multiplies by ~1.01 per frame at the start and ~1.35–1.4 per frame at the end. Even on log scale the progress is ease-in, so on a linear scale the end is a violent rush into black/the next image. The cut happens at peak speed (no deceleration).
- Cadence: the four big motion peaks (zoom-throughs + red wipe) fall at ~1.2, 3.2, 5.2, 7.25 s → **one scene every ~2 s**.

## Secondary animation
- Slow continuous push on every still (never fully static except the end poster).
- Light sweep and darkness as an exit device; stamps hit with no overshoot; red string tightens.
- No springs, no squash, no idle loops.

## Transitions
| Type | Where | Duration |
|---|---|---|
| **Zoom-through into a letter / the eye** (accelerating, cut at full speed) | 1.0–1.5, 2.7–3.5, 4.8–5.5 s | 14–18 f (measured) |
| **Shape wipe: red square expands, window opens inside it** | 7.0–7.5 s | 7 f + ~5 f |
| **Light-off / fade to black** | 8.6–9.2, 10.7–11.2 s | ~12–15 f |
| Hard cut | 9.25 s, 13.17 s (end poster) | — |

## Music & edit
- Detected 112 BPM but **pulse clarity 0.10**: no clear beat; percussive share 0.38; loudness range 17 dB. Verdict: no clear beat (ambient score or voice-led).
- Cuts on beat 20% vs 26% chance; motion accents on beat 0%. The edit does not follow a beat.
- The strongest onset (~0.2 s) coincides with the **stamp slam** at f2–f4, a sound-designed hit rather than a musical one.
- Shots last ~4–5 "beats" (≈2 s): the pacing is the **regular 2 s scene cadence**, set by the text phrases, not by the music.

## Speed and rhythm
Energy 5.2 · Mixed (cuts 6.3, motion 5.6, speed 3.6). Only 5 hard cuts; most scene changes are zoom-throughs (continuous, not counted as cuts). Motion 56% of the time; holds median 1.1 s, max 1.6 s.

## Look
Desaturated, low-key, filmic (colorfulness 17.1): greys, cold teal, warm paper and cork, with **red as the single accent** (stamps, string, the expanding square). Grain and soft vignettes. Typography: black heavy serif on light scenes, dark serif over dark scenes (low contrast, moody). End poster: halftone black on cream.

## What defines it
1. **One short statement per scene**, lowercase heavy serif, ending with a period, built word by word.
2. **Zoom-through transitions**: accelerating scale (ease-in ≈ Launch, 14–18 f) into a letter or the eye, cut at full speed.
3. **Text exits by being carried out** (by the camera or the light), never by its own fade.
4. **Cinematic stills with a slow push**, low saturation, single red accent.
5. **Stamps and redaction marks** as graphic hits (2 f, no bounce).
6. **Regular ~2 s scene cadence**, independent of a musical beat.
7. **Poster end card** (halftone, pictogram inside the wordmark).
