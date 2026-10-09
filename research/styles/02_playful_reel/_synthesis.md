# Style 02 — Playful reel · synthesis

Status: **draft from 5 references**: ref06 AchX Studio, ref09 aratama KAMI CIRCUIT, ref10 Claude motion-designer reel, ref14 Osmo Studio, ref16 Hyundai #i10inside.

Naming note: not every piece here is "playful" in mood (ref09 is epic/gritty). What they share is **high visual energy, showreel/promo
structure and expressive form**. A better family name may be **"Expressive reel"**. Pending Gian.

## Rules: what most share
| # | Rule | 06 | 09 | 10 | 14 | 16 |
|---|---|---|---|---|---|---|
| 1 | **Energy ≥ 4.4** and the shortest shots of the catalog (median ≤ 2 beats in 4 of 5) | 5.0 · 4.3 b | 7.7 · 0.6 b | 6.1 · 1.0 b | 4.4 · 2.0 b | 5.2 · 1.4 b |
| 2 | **Clear musical pulse** (≥ 0.45 in 4 of 5) and the edit shaped by it at some level | weak | build → drop | beat-locked | fixed 2-beat clock | loosely on beat |
| 3 | **A sampler structure**: each shot shows a different technique, material or idea | ✔ media mix | ✔ | ✔ principles | ✔ | ✔ sections |
| 4 | **A section change = a color or material change** (flat color per section, strobes, wipes) | strobes | ✔ | ✔ | ✔ | ✔ wipes |
| 5 | **Expressive form without heavy springs**: smear, blur, echo, glitch, morph carry the energy; measured springs appear only in demos | ✔ blur/echo | glitch | demo only | — | — |
| 6 | **Bold type moments** (smeared, sliced, word-per-shot, kinetic) | ✔ | ✔ | ✔ | ✔ | ribbons |
| 7 | **Logo bookend / end card** | ✔ | ✔ | ✔ | ✔ | ✔ |

## Sub-styles
| Sub-style | Refs | Core |
|---|---|---|
| **Kinetic type** | ref06, ref10, ref14 | type is the hero; one statement per shot; smear/blur entrances or word-per-shot; mono or flat-color sections |
| **Hype montage** | ref09 | build → drop structure, syncopated cut runs, HUD continuity, generative 3D, manga vocabulary |
| **3D toy world** | ref16 | low-poly papercraft world, color wipes per story beat, one long camera flight, game/celebration premise |

## Measured values
| Behavior | Ref | Duration | Curve |
|---|---|---|---|
| Diagonal color wipe | 16 | 6–9 f @25 (~300 ms) | symmetric ease-in-out `≈0.37, -0.1, 0.65, 1.1` (≈ Flat) |
| UI pill stack push | 06 | 20 f @30 | expo-like ease-in-out `0.80, 0.01, 0.14, 1.03` |
| White arch wipe | 06 | 6 f @30 | `0.37, 0.10, 0, 0.77` ≈ Settle |
| Easing demo: ease-in-out | 10 | ~2 beats | `0.61, -0.03, 0.40, 1.01` (no token → candidate) |
| Easing demo: back-out | 10 | ~2 beats | 17% overshoot ≈ Pop |
| Easing demo: elastic / bounce | 10 | ~2 beats | +16/-13/+5 %; bounces 0.75/0.94/0.99 |
| Logo color strobe | 06 | 5 f per plate | stepped |
| Countdown accelerating | 16 | 24 → 20 → 16 f | stepped |

## Map position
Energy 4.4–7.7, tone 4.5–8.0, rhythm mostly Mixed/Cut. The hypothetical zone (X 5.5–10, Y 4.5–10) is too narrow on energy: ref06, ref14 and ref16 sit at 4.4–5.2.
The zone should extend down to energy ~4.

## Open questions
- Rename the family "Expressive reel"?
- Kinetic type vs Elegant › Editorial: the line is energy and shot length in beats (≤ 2 here vs 4–9 in Editorial), plus jokes/smears.
