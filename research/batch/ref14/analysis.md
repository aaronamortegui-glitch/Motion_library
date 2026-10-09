# ref14 — Osmo Studio · "make stories that move" word-per-shot promo

`references/_inbox/ref14.mp4` · 21.6 s · source 60 fps (metrics on a 30 fps copy) · 1280×720 · contact sheets in `research/contact_sheets/ref14/` (sheet frame labels are @60)

**Verdict: between 02 Playful reel and 04 Mixed media; proposed sub-style "Minimal word-per-shot showreel".**
A launch teaser for **Osmo Studio** (osmo.inc), an animation tool. One tiny lowercase word sits dead-center while the background swaps to a different
animated visual every two beats: mirrored psychedelic footage, a particle ring, doves with tracking boxes, red ink silhouettes, a video-editor timeline,
a 3D network fly-through, a number field, a glassy music-player UI, organic gradient blobs, a neon "X" light shape, then the product UI itself.
The sentence reads: *animate your story like a pro · create · keyframe · polish · animate · without the slop · make stories that move* → red OSMO STUDIO logo → "osmo.inc".
Energy 4.4 (cuts carry it: 33/min, speed low). Tone mid (≈4.5): saturated visuals, deadpan tiny type.

## Structure

| t (s) | Word (center) | Background visual |
|---|---|---|
| 0–1.08 | animate | mirrored, posterized pink/green footage of two people with UI bounding boxes |
| 1.08–2.2 | your | sparse colored particle ring on near-black, slowly breathing |
| 2.2–3.3 | story | white doves fly across, each wrapped in a thin tracking box (HUD) |
| 3.3–4.33 | like a | two red smoky/inky silhouettes, mirrored, growing |
| 4.33–5.42 | pro | a video-editor timeline (thumbnail strips, green/orange clips) scrolling sideways |
| 5.42–6.5 | create | blue 3D line network, camera flies through with radial blur; dims and re-bursts |
| 6.5–7.58 | keyframe | white numerals of many sizes on black |
| 7.58–8.67 | polish | frosted-glass music player card ("Old Scratch Blues") over a blue radial burst |
| 8.67–9.75 | animate | organic gradient blobs and brush strokes (teal, red, violet) |
| 9.75–10.83 | (no word) | neon X-shaped light form with a sine line, white/pink/cyan |
| 10.83–12.3 | without the slop | plain near-black card |
| 12.3–15.17 | (no word) | the product UI: the same X visual inside the Osmo Studio editor (layers, sliders, timeline) |
| 15.17–17.4 | make stories that move | plain near-black card |
| 17.4–19.7 | — | red OSMO STUDIO logo (pill-shaped O / D) |
| 19.7–21.6 | osmo.inc | small URL, hold to end |

## Elements

| Type | Present | Notes |
|---|---|---|
| Text | central device | one small white lowercase sans word, always centered, ~2% of frame height; appears and leaves with the cut |
| Abstract / generative | main cast | particles, networks, blobs, light shapes, numerals |
| Photo / footage | yes | treated footage (posterized pink/green), doves, inky silhouettes |
| UI | yes | editor timeline, music-player card, the product UI at the climax |
| Logo | yes | red OSMO STUDIO wordmark, cut on, static |
| Camera | some | fly-through in "create", sideways scroll in "pro" |

Kind of motion: **each background loops/moves on its own** (generative, footage, fly-through) while **the type never animates**: text changes only by cut.

## Lifecycle (highlights; read from sheets unless marked)

- **Word, enter/exit:** hard cut with the background; no fade, no build, no position change (all tiles of each word identical). Read from sheets a–d.
- **Word, hold:** exactly one scene length, 1.083 s (measured) through the middle section.
- **Doves (2.2–3.3 s):** birds fly through frame with tracking rectangles that follow them: a "computer vision HUD" layer. Sheet `a_open_doves_0.9-3.6.png`.
- **Inky silhouettes (3.3–4.3 s):** red smoke grows outward around two mirrored black heads: an organic grow, probably simulated.
- **Timeline (4.3–5.4 s):** clip strips slide sideways in rows, a small stepped scroll. Sheet `b_words_4.2-7.0.png`.
- **Create (5.4–6.5 s):** fly-through with radial blur, dims almost to black at ~5.8 s and bursts again: a pulse inside the shot.
- **Product UI (12.3–15.2 s):** the hero visual is shown again inside the app with a small push; the payoff of the montage. Sheet `d_app_logo_12.2-18.2.png`.
- **End:** text card hold 2.2 s → logo cut on (2.3 s hold) → URL card (1.9 s hold). No logo animation.

## Measured (script: `research/batch/ref14/measure.py`)
- **Scene-change clock:** scene changes at 1.083, 4.333, 5.417, 6.500, 7.583, 8.667, 9.750, 10.833 s → intervals **1.083 s exactly, 7 times in a row** (65 f @60, 32.5 f @30).
- **Against the beat (librosa, 107.7 BPM, beat 0.557 s):** 1.083 s is 1.95 beats, i.e. the 2-beat length of a **110.8 BPM** grid. The phase of the cuts therefore drifts through the bar: −0.45 beat at 5.42 s, +0.50 at 6.50 s, +0.23 at 10.83 s. The last two changes (12.30 s, 15.17 s) land within −0.18 and −0.03 beat.
- No element has a clean, isolated tween to fit (backgrounds are loops/footage, text is cut). No ease curve reported.

## Secondary animation
- Every background is alive: particle breathing, HUD boxes following doves, ink growth, network pulse, blob drift.
- No springs, overshoot or squash anywhere; the type is perfectly still.

## Transitions
| Type | Where | Duration |
|---|---|---|
| Hard cut (word and background change together) | every 1.083 s, 1.1–10.8 s | — |
| Cut to plain black text card | 10.83, 15.17 s | — |
| Cut to UI (same hero visual, now inside the product): a match cut on content | 12.3 s | — |
| Cut to logo / URL | 17.4, 19.7 s | — |

## Music & edit
- **107.7 BPM**, beat moderately clear (pulse clarity 0.55, tempo stability 0.98), **very low percussive share (0.11)** and low loudness range (5.8 dB): a steady, compressed, synth-pad-like bed rather than drums (inferred from numbers only).
- audio.json: cuts on beat 25% (chance 25%) but **on half-beats 67%**; median shot ≈ 2 beats. The tool's verdict is "edit independent of the beat".
- The measurement above explains it: the edit runs on a **metronomic 1.083 s clock (≈2 beats at 110.8 BPM)**, about 3% faster than the detected tempo, so cuts slide across the beat instead of locking to it. Either the edit was laid on a fixed frame grid, or the beat tracker is slightly off; the evenness of the cutting is certain, the lock to the track is not.
- The montage's denser onset clusters (~10–11 s, ~15–16.5 s) roughly coincide with the neon-X climax and the "make stories that move" card.

## Speed and rhythm
Energy 4.4 · Cut-driven (cuts 7.4 vs motion 4.4, speed only 1.4). 33 cuts/min; motion 44% of the time; average shot 1.66 s; holds median 1.7 s, max 2.1 s (text cards and logo).

## Look
Near-black base, with **saturated, varied backgrounds** (pink/green posterization, red ink, blue networks, neon pastel light, gradient blobs): colorfulness 37.4. Typography is deliberately tiny and neutral (white lowercase grotesk). Brand color: red logo.

## What defines it
1. **One tiny centered word per shot**, never animated: the sentence is read across the cuts.
2. **Metronomic cutting**: identical 1.083 s scenes (≈ 2 beats), a fixed clock rather than a beat lock.
3. **Every shot is a different visual technique** (generative, simulation, footage + HUD, UI): a sampler of what the tool can do.
4. **Backgrounds move, type stays still**: all the motion lives behind the words.
5. **Payoff = the same visual inside the product UI** (match cut on content).
6. **Plain black text cards** for the key lines ("without the slop", "make stories that move").
7. **Static logo and URL end cards** with long holds.
