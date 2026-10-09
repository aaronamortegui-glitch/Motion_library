# ref12 — Blueprint · iPod "patent / x-ray" sizzle

`references/_inbox/ref12.mp4` · 17.2 s · 23.98 fps · contact sheets in `research/contact_sheets/ref12/`

**Verdict: Mixed media (04), sub-style proposed "Blueprint / technical collage".** A short sizzle about the iPod built from three image sources:
live footage of hands holding iPods, **patent line drawings on a grainy electric-blue field**, and **x-ray / false-color scans** of the device's insides.
Closes on a patent sheet with a signature and a blackletter **"Blueprint"** wordmark (the channel or brand behind the piece; no other branding visible).
Energy 6.4 (cut-driven: 122 cuts/min); tone expressive through texture and color treatment, not through springs.

## Structure

| t (s) | Section | What happens |
|---|---|---|
| 0–0.7 | Hook (footage) | hand holds a classic iPod "Now Playing" (Cowboy Bebop OST); hard punch-in at f6 |
| 0.7–1.2 | Split flicker | screen splits vertically: blue patent drawing on one half, footage on the other; halves swap (f16→f22) |
| 1.2–2.1 | Patent | full-frame blue patent drawing of the iPod; cut to a 3-up repeat of the same drawing (f38) |
| 2.1–7.0 | X-ray | blue-tinted x-ray scans: device outline, click wheel, circuit board; cuts every ~0.3–0.6 s, slow push between cuts; ends on a bright ring (click wheel, f155+) |
| 7.0–9.3 | False color | same scans with a yellow/green thermal LUT; tilted device floating, 3 devices side by side (f216) |
| 9.3–12.8 | Patent details | patent figures (click wheel, finger on wheel, X/Y diagram, scroll list "SONG 1…8" scrolling, exploded view on a slow move) |
| 12.85–14.0 | Footage burst | **10 lifestyle shots cut every 3 f** (≈ 125 ms) incl. a vintage print ad ("…in your pocket") |
| 14.0–15.4 | End plate 1 | patent sheet: hand with iPod, patent number, signature, header "…USE OF ROTATIONAL USER INPUTS" (hold 1.4 s) |
| 15.4–17.2 | End plate 2 | blackletter "Blueprint" centered on the blue field (hold to end) |

## Elements

| Type | Present | Notes |
|---|---|---|
| Photo / live footage | yes | hands + iPods, lifestyle B-roll, one vintage print ad |
| Object (technical imagery) | main cast | patent line drawings (light-blue line on saturated blue), x-ray scans, false-color scans |
| Text | minimal | text lives *inside* the drawings (patent labels, SONG list); one small blackletter wordmark at the end |
| Background | yes | saturated electric blue with heavy grain/noise; black for the x-ray section |
| Camera | yes | slow push-ins and drifts over drawings and scans; vertical scroll over the song list |

Kind of motion: **cuts and stepped camera moves** over still images. No element animates on its own; the motion is the virtual camera plus editing.

## Lifecycle (highlights; read from sheets unless marked)

- **Footage → patent (split flicker), f16–f28 @24:** a hard vertical split at ~50% width; for 6 f the left half is patent and the right footage, then they swap for 8 f. Sheet `a_open_0-2.6.png`. A cut-based "glitch", not a wipe: no in-between positions.
- **Patent repeat, f38:** cut from one drawing to a 3-up tiling of the same drawing (a "multiply" beat).
- **X-ray section:** each scan gets a slow push (Ken Burns, on twos), then a hard cut. The click wheel becomes a concentric target (f141–f151), then a cut to a giant bright ring (f155): a graphic match on the circle. Sheet `b_xray_4.3-7.2.png`.
- **False-color switch, f168:** same imagery recolored with a thermal LUT: color as the transition device.
- **Song list scroll, f244–f262:** the camera tracks down the patent's "SONG 1…8" list, one line per two frames (stepped). Sheet `c_songs_9.3-12.png`.
- **Exploded view, f262–f300:** slow drift across the exploded patent drawing, on twos (measured below).
- **End:** strobe montage (f308–f335), hold on the patent sheet + signature (f336–f368, only grain moves), cut to the wordmark (f370) and hold to the end. Sheet `d_flicker_end_12.7-15.6.png`.

## Measured (script: `research/batch/ref12/measure.py`)
- **Animated on twos:** frame-to-frame diff over f262–f300 alternates ~35 / ~1 (`34.6, 3.1, 36.9, 2.7, 38.0, 5.1, …`), and over f100–f140 `0.3, 8.2, 0.5, 71.6, 1.8, 11.0, …`. Camera moves update every 2nd frame → **12 fps stepped motion** on 24 fps footage. This is the saw-tooth in `energy.png`.
- **Song scroll (f244–f262, 18 f):** phase correlation gives a stepped track, but the repeated text lines alias the correlation; the fit (`0.0, 0.20, 0.99, 1.26`, rmse 0.14) is **not reliable** and is not used. Reported only as "stepped scroll".
- **Ring (f149–f168):** the 95th-percentile radius of bright pixels jumps 196 → 717 px in one frame (a cut), then grows 717 → 740 px over 12 f: a ~3% slow push after the cut, not a scale animation.
- **End strobe (cuts.txt):** cuts at f308, 311, 314, 317, 320, 323, 326, 329, 332, 335 → **exactly every 3 frames** (125 ms).
- No element moves cleanly on its own, so no ease curve is measurable.

## Secondary animation
- **Heavy film grain / noise** on every blue plate, boiling even in holds.
- **Stepped (on twos) camera** gives a mechanical, stop-motion feel.
- No overshoot, squash or idle loops.

## Transitions
| Type | Where | Duration |
|---|---|---|
| Hard cut | throughout (35 cuts) | — |
| Split-screen flicker (half/half, swap) | f16–f28 | 2 states × 6–8 f |
| Repeat / tile cut (1 → 3 copies) | f38 | cut |
| Graphic match on the circle (wheel → ring) | f151–f155 | cut |
| Color-LUT switch (blue x-ray → thermal) | f168 | cut |
| Strobe montage | f308–f335 | 10 shots × 3 f |

## Music & edit
- **103.4 BPM**, beat fairly clear (pulse clarity 0.62, tempo stability 0.99), **low percussive share (0.32)**: a steady groove rather than drum-led.
- **Edit independent of the beat:** cuts on beat 14% vs 24% chance; motion accents on beat 18% vs 24%. Median shot = 0.57 beats: the edit runs *faster* than the music.
- The 3-frame strobe montage (12.85–14.0 s) has no matching build in the onset curve; the loudest onsets (≈14.7–15.6 s) fall on the **still end plates**, so the music punctuates the hold, not the cuts.
- Read: music as a bed; the rhythm of the piece comes from the cutting and the on-twos stepping, not from the beat.

## Speed and rhythm
Energy 6.4 · Cut-driven (cuts 10.0 vs motion 4.4). 122 cuts/min, average shot 0.48 s; motion 44% of the time; only 2 real holds (median 1.15 s, max 1.7 s), both at the end.

## Look
Saturated electric blue + light-blue linework + grain (blueprint), black x-ray plates with blue glow, a thermal yellow/green LUT section, and warm natural-light footage for contrast.
Colorfulness 67.1. A blackletter wordmark is the only typographic voice.

## What defines it
1. **Archive/technical imagery as the cast** (patents, x-rays): the product is shown through its documents, not renders.
2. **One strong color treatment per source** (blueprint blue, x-ray blue/black, thermal LUT) used as section markers.
3. **Grain on everything**, boiling even in holds.
4. **Motion on twos**: stepped camera moves (12 fps feel) over still images.
5. **Cut-driven, faster than the music** (median shot ≈ half a beat).
6. **Strobe montage of footage (3 f per shot)** right before the end card.
7. **Graphic devices made from cuts**: split-screen flicker, 1→3 tile repeat, circle match.
8. **Long still end plates** (patent sheet + signature, then wordmark) where the music lands.
