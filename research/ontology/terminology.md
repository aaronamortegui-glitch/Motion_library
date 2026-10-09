# Terminology: Motion Style Map ↔ Motion DNA

One vocabulary for the research (`research/styles`, `research/ontology`) and the plugin (`tokens/`, `tools/ss_presets.jsx`, `library/`).
**Rule: Motion DNA names win.** The research uses the plugin's curve, duration, preset and pack names; new names were added
to the plugin only where the references showed something it couldn't express.
Every behavior in `behaviors.json` now carries `dna_curve`, `dna_preset` and `dna_match` (regenerate with `python -I tools/style_research/map_to_dna.py`).

## Curves
Measured curves from the 20 references, matched to the 14 Motion DNA curves (RMS distance of the eased progress; ≤ 0.06 = same curve).

| Research term (before) | Motion DNA curve | Evidence |
|---|---|---|
| linear / constant camera truck | **Flat** | ref09, ref10, ref18 (0.00–0.01) |
| "fly-through" push-in, pure ease-in that never lands | **Launch** | ref13 (0.02), ref17 (0.09), ref20 (0.10), ref03 liquid wipe in |
| long ease-in-out, wordmark from behind the mark | **Surge** | ref05 (0.01), ref10 ease-in-out lane (0.02) |
| expo-like ease-in-out on UI layout | **Ramp** | ref06 pill stack (0.05) |
| camera travel / slide into UI | **Cruise** | ref04 (0.06), ref15 (0.05) |
| expo-out | **Land** | ref10 expo lane (0.04) |
| back-out ~5–17% | **Pop** | ref01 soft overshoot (0.05), ref10 back-out (0.09) |
| quick ease-out on wipes | **Settle** | ref06 arch wipe (0.04) |
| *fast start, coast to a stop* | **Coast** · new | ref08, ref05, ref15 (0.03–0.06); 0.11+ from every older curve |
| *soft 2–4% overshoot, long tail* | **Nudge** · new | ref03 bars, ref19 emblem (0.02) |
| *entrance with anticipation* | **Wind-up** · new | ref01 logo, ref03 iris (0.04); entrance counterpart of Recoil |
| *snap + micro-settle* | **Snap** · new | ref02 (92% jump in 1 f, 8–10 f settle; measured 4×) |
| exit with anticipation | **Recoil** | (no measured instance yet) |
| elastic, bounce | — (classics: **Bounce In**, **Rubber Band**) | ref10 demo lanes |

## Durations (frames @30)
Measured timings map to the six duration tokens: **Tick** 4 (icon pops, strobe frames, stagger), **Blink** 6 (wipes 6–9 f, flashes), **Glide** 9 (iris 9 f, snaps), **Arrive** 14 (text slides 11–15 f, push-throughs 14–18 f), **Sweep** 21 (bars 23 f, logo reveals 10–13 f @24 ≈ 13–16 @30), **Stage** 33 (logo slides 1.5 s, long reveals).

## Presets: behaviors → Motion DNA
| Behavior family in the research | Motion DNA preset |
|---|---|
| per-word blur resolve | **Blur Words** |
| per-character blur resolve | **Chars Blur** · new |
| typing / type-on / retyping | **Typewriter** |
| glitch build / decode | **Scramble** |
| counters, countdowns | **Count Up** |
| underline / outline / construction lines | **Line Draw**, **Organic Draw** |
| icon / chip / label pops | **Scale Pop** |
| idle drift, float, breathing | **Float**, **Breathe**; orbits **Orbit**; pendulums **Swing** |
| glitch / flicker / strobe accents | **Jitter**, **Holo Flicker** |
| whip transitions | **Whip Pan** |
| clean product / editorial entrance (ease-out in, ease-in out) | **Coast Rise** · new |
| logo slide with anticipation | **Wind-up Slide** · new |
| bars and charts growing | **Nudge Grow** · new |
| snap on the action | **Snap Scale** · new |
| circular reveal from a point | **Iris Reveal** · new |
| wordmark slides out from behind the mark (cross-family) | **Wordmark Reveal** · new |
| push / fly-through into the next scene | **Push Through** · new |
| section change by a color wipe | **Color Wipe** · new |
| texture boil on 3s (collage) | **Boil** (fx) · new |
| animation on twos / stepped time | **On Twos** (fx) · new |

Coverage of the 209 behaviors: **146 map to a preset** (99 before the new set), **47 are camera / edit / acting craft** (not layer presets: camera travel, montage, walk cycles, match cuts, continuity), **16 are open gaps** (`dna_coverage.json`).

## Families and sub-styles ↔ packs
| Research family › sub-style | Motion DNA pack |
|---|---|
| 01 Elegant › Cinematic | **Elegant** |
| 01 Elegant › Editorial | **Editorial** · new |
| 01 Elegant › Product UI | **Modern** |
| 01 Elegant › Warm editorial | **Storybook** · new |
| 02 Playful reel › Kinetic type, Hype montage | **Dynamic** |
| 02 Playful reel › 3D toy world | **Playful** |
| 03 Character | **Storybook** · new (soft springs; **Playful** is for bouncy kids/consumer work) |
| 04 Mixed media | **Collage** · new |
| (tech / data / HUD) | **Tech** |

Energy words: the research's *suave / medio / dinámico* = Motion DNA *soft / medium / dynamic*.

## Open gaps (candidates for next presets)
Word roll with accelerating interval (ref03) · RGB-split glitch transition (ref08, ref15) · highlight bars over type (ref07) ·
smear write-on (ref16) · letters hopping on an arc (ref17) · chat-bubble stack (ref06) · manga speed-line hit (ref09) · fast accent crosser (ref01).
