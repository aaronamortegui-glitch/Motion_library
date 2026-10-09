# Style Map — taxonomy

How every reference video is classified so it can be placed on the map (`style_map.html`) and compared.
Data lives in `catalog.json`; the map is regenerated with `python tools/style_research/build_map.py`.

Each video gets **two positions on the map** (one measured, one scored), **one rhythm label** (measured) and **tags** (fixed vocabularies).

---

## 1. Map axes

### X — Energy (0–10, measured)
Computed by `tools/style_research/metrics.py`, average of three parts:

| Part | Measures | 0 | 10 |
|---|---|---|---|
| Cuts | cuts or hard changes per minute (log scale) | 0/min | 120/min |
| Motion | % of time something is moving | 0% | 100% |
| Speed | average speed while moving (% of frame width per second) | 0 | 60%/s |

> The scale constants are provisional: they get recalibrated once there are playful/showreel references at the top end.
> Videos at other frame rates are measured on a 30 fps copy (ffmpeg `-r 30`), since per-frame motion thresholds depend on fps.
> Continuous transitions (wipes, reveals, morphs) don't count as cuts, so a film built on them scores low on the cuts part even when it changes scenes often.

### Y — Tone (0–10, scored with the rubric below)
**Restrained (0) ↔ Expressive (10).** Five criteria, 0–2 each, summed:

| Criterion | 0 | 1 | 2 |
|---|---|---|---|
| Secondary motion | none / ≤ 5% overshoot or anticipation | visible overshoot, some follow-through | bounces, squash & stretch, wiggle, smears |
| Color | monochrome | limited palette or color in parts | saturated, many colors throughout |
| Typography | small, quiet, regular | bold or big moments, editorial layouts | kinetic: deformed, bouncing, filling the frame |
| Shape language | precise geometry | mixed | organic, wobbly, hand-made |
| Character / humor | none | hints (mascot, wit) | central (characters acting, gags) |

Half points are allowed. Each score is written with its reason in `catalog.json`.

## 2. Rhythm (measured label)
Where the energy comes from, from the energy parts:
- **Flow:** motion part > cuts part + 1 → continuous movement, few cuts (camera moves, long tweens).
- **Cut-driven:** cuts part > motion part + 1 → change happens through editing/snaps, between still holds.
- **Mixed:** otherwise.


## 2b. Music & edit (measured, `tools/style_research/audio.py`)
| Field | Meaning |
|---|---|
| BPM | detected tempo (may be half/double) |
| Pulse clarity | 0–1, how strong and regular the beat is (< 0.2 = no clear beat) |
| Cuts on beat vs chance | share of cuts within ±70 ms of a beat, compared with what random cuts would give |
| Median shot in beats | **edit rate relative to tempo**: ≤ 1 (montage), 1.5–5 (statement per shot), > 5 (continuous / voiceover-led) |
| Verdict | cut on the beat · loosely beat-aware · edit independent of the beat · no clear beat (ambient / voiceover-led) |

Findings across the catalog: `research/styles/_music_and_edit.md`.

## 3. Tags (fixed vocabularies)

| Tag | Values (pick 1; mood picks 1–3) |
|---|---|
| **Format** | Brand film · Product launch / demo · Showreel · Explainer · Social ad · Logo sting / title · UI walkthrough · Event opener |
| **Mood** | Contemplative · Elegant · Precise · Confident · Premium · Warm · Optimistic · Playful · Exciting · Bold · Quirky · Emotional · Epic · Technical · Gritty |
| **Cast** (main subject) | Abstract shapes · Typography · Product / UI · Characters · Live footage · Mixed |
| **Space** | 2D flat · 2.5D · 3D · Mixed with footage |
| **Motion language** | Smooth tween · Snap · Spring / bounce · Organic / frame-by-frame · Rigged / puppet · Physics / simulation |
| **Transitions** | Light (flash, bloom) · Cut / match cut · Shape / mask wipe · Camera move · Morph / transform |
| **Style family** | 01 Elegant · 02 Playful reel · 03 Character · 04 Mixed media (proposed) |
| **Sub-style** | free text for now (Elegant: *Cinematic*, *Editorial*, *Warm editorial*; Character: *Flat vector explainer*; Mixed media: *Grunge collage*); becomes a fixed list as patterns repeat |

## 4. Style family zones
The map now draws each family's **observed range** (min–max of its videos). The original hypotheses were:
- **01 Elegant:** low–mid energy, restrained tone (X 0–5.5, Y 0–4).
- **02 Playful reel:** high energy, expressive (X 5.5–10, Y 4.5–10).
- **03 Character:** mid energy, expressive (X 2.5–7, Y 5.5–10). It differs mainly by **Cast = Characters**, which the map shows as marker shape.
- **04 Mixed media (proposed, from ref04):** mid energy with rhythm *Flow*, expressive through texture rather than springs (X 3–6.5, Y 5–8.5). Overlaps the Character zone in tone: separated by cast, rhythm and texture.

## 5. Adding videos
1. Copy to `references/_inbox/refNN.mp4`; run `bash tools/style_research/batch_auto.sh refNN …` (energy, metrics, audio, overview sheets → `research/batch/refNN/`).
2. Visual analysis per `research/batch/AGENT_BRIEF.md` → `entry.json` (+ `analysis.md`).
3. `python -I tools/style_research/integrate.py refNN …` (moves the video to its family, catalog + behaviors + thumbnail).
4. `python -I tools/style_research/build_map.py`.
