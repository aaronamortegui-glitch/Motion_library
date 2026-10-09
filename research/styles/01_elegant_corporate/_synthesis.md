# Style 01 — Elegant / Corporate / Product · synthesis

Status: **draft from 3 references**: ref01 Linear (brand film), ref02 OpenAI (brand film), ref03 Claude Fable 5.5 (product launch).

## Rules: what all three share (the style's core)

| # | Rule | ref01 Linear | ref02 OpenAI | ref03 Claude Fable |
|---|---|---|---|---|
| 1 | **One statement at a time**: one phrase or idea per scene, few elements moving at once | ✔ | ✔ | ✔ |
| 2 | **Short copy** (2–6 words per statement) | ✔ | ✔ | ✔ |
| 3 | **Small, functional secondary motion**: overshoot ≤ 5% with no oscillation; squash only on impacts; idle loops subtle | ✔ 4% | ✔ none | ✔ 3%, squash on landing, quiet loops |
| 4 | **Holds where the composition breathes** (median ~1–1.5 s, up to 2.5–4 s) | ✔ | ✔ | ✔ |
| 5 | **Abstract geometry as the main cast**; no acting characters | ✔ 3D | ✔ 2D | ✔ organic 2D |
| 6 | **Restricted palette**: monochrome or neutral base + at most one accent | ✔ mono | ✔ black/white | ✔ cream + coral |
| 7 | **Logo built on screen**: the mark arrives first and the wordmark is revealed from behind it (ref01, ref03) or constructed (ref02) | ✔ | ✔ | ✔ |
| 8 | **Elements change role instead of exiting** (text → light point, dot → circle, line → kicker, slider → panel) | ✔ | ✔ | ✔ |
| 9 | **Long ease-outs / clean landings**: things arrive fast and settle long; never floaty, never bouncy | ✔ | ✔ (snap + settle) | ✔ |

## Strong patterns (2 of 3)
- **A single protagonist element carries continuity** across scenes, usually a dot (ref02 black, ref03 coral).
- **Bookending**: the same mechanism opens and closes (ref01 logo slide, ref03 circular reveal).
- **Typing as text mechanism** (ref02, ref03 hook).

## Rules weakened by ref03
- "Monochrome first" → **restricted palette with one accent** (ref03 is warm and colorful but still disciplined).
- "Quiet small text" → only true for ref01/ref02. ref03 uses **big serif headlines**, still short and calm.
- "No secondary motion" → **small and functional secondary motion** is allowed.

## Variables: the sub-styles (style *parameters*)

| Parameter | Cinematic (ref01) | Editorial (ref02) | Warm editorial (ref03) |
|---|---|---|---|
| Space | 3D, depth of field, drifting camera | flat 2D, static | flat 2D, nearly static |
| How things change | long continuous tweens (≥ 1.5 s) | **snap + micro-settle** | medium tweens (0.3–0.8 s), long ease-out |
| Text | blur-fade per word | typing / cut | **line mask-rise**, accent word in italic color, word roll |
| Transitions | light: flash, bloom, light leak | hard cuts, match cuts, inversion | **liquid color wipes**, circular reveal, continuity dot |
| Blur | central | never | motion blur only (whips, counters) |
| Palette | dark mono | white + black | cream + coral + muted colors |
| Tone score | 0.5 | 1.5 | 5.5 |
| Energy | 4.0 · Flow | 4.1 · Cut-driven | 2.9 · Mixed |

## Measured values so far

| Behavior | Ref | Duration | Curve | Notes |
|---|---|---|---|---|
| Logo slide with anticipation | 01 | 1.54 s | `0.53, -0.26, 0.37, 0.90` | new token candidate |
| Logo slide with soft overshoot | 01 | 1.5 s | `0.42, 1.11, 0.23, 1.08` | ~Pop, slower, 4% |
| Snap + settle | 02 | 1 f jump + 8–10 f @30 | settle `0, 1.17, 0, 0.91` | new behavior "Snap" |
| Particle converge | 02 | 433 ms | `0.67, -0.04, 0.74, 0.97` | ease-in ≈ Launch |
| Circular reveal (iris) | 03 | 300 ms | `0.53, -0.25, 0.20, 0.87` | ≈ Cruise (0.12) |
| Bar grow | 03 | 767 ms | `0.20, 0.40, 0.03, 1.03` | ≈ Pop, 3% overshoot |
| Node fly-out | 03 | 617 ms | strong ease-out, 17% in first frame | stagger ~3 f @30 |
| Liquid wipe (half pass) | 03 | ~0.55 s full pass | in: `1.0, 0.22, 0.86, 1.18` | ease-in, then out |
| Title per character | 01 | 2 f/char @24 | linear rate | blur → sharp |
| Typing | 02 / 03 | 1–2 f/char @30 (02), 3–4 f/char @30 (03) | stepped | pauses at word breaks |
| Word roll accelerando | 03 | 6–8 f per roll @30 | intervals 1.2 → 0.25 s | new preset "Word Roll" |

## Map implications
- ref03 scores **tone 5.5**, above the hypothetical Elegant zone (0–4) and on the edge of the Character zone, though it has no characters.
  Either the Elegant zone extends up to ~6 for warm product work, or "Warm editorial" is a bridge toward Playful. **Decision pending (Gian).**
- Tone alone can't separate families. **Cast** (characters or not) and **energy** must weigh in the matching.

## Open questions
- Does "Warm editorial" belong to Elegant, or is it its own family between Elegant and Playful?
- Product UI appears for the first time in ref03 (terminal, charts, list): it follows the same rules as shapes (mask reveals, ease-outs). Needs more product references to confirm.

---

## Update · batch 2 (now 10 references)
New: ref07 Vercel Ship LDN, ref08 motionmaxxing, ref11 Helium, ref13 1984 trailer, ref15 Payy, ref19 CEAL, ref20 VW Think Blue.

### Consolidated sub-styles
| Sub-style | Refs | Core |
|---|---|---|
| **Cinematic** | 01 Linear, 13 1984, 20 VW | camera as the animator (3D drift, zoom-through, never-stopping travel); light/defocus transitions; long ease-outs or **ease-in push-ins that fly through without landing** |
| **Editorial** | 02 OpenAI, 07 Vercel, 08 motionmaxxing | monochrome type/system frames; snap, stepped or strong ease-out/ease-in; montages under 1 beat, off-grid |
| **Warm editorial** | 03 Claude Fable | warm palette, organic wipes, accent italic word |
| **Product UI** | 11 Helium, 15 Payy | one brand accent, logo → icon → UI element, clean ease-outs (≈ Land / Settle / Cruise), light or white-out transitions |
| **Illustrated editorial** | 19 CEAL | 2.5D flat cut-outs with grain, foreground wipes, infographics |

### Rules re-checked with 10 references
- **Hold for all 10:** restricted palette (mono or one accent); one statement at a time; **no playful springs** (max measured overshoot 4%; most have none); logo built on screen.
- **Hold for most:** elements change role instead of exiting (02, 03, 11, 15, 19); bookends (01, 03, 20).
- **Revised:** "long holds" is not universal. Editorial montages (07: 60 cuts/min) are fast, but each shot is still a near-still frame. The restraint is **inside the frame**, not in the edit rate.
- **New:** strong ease-out on entries + ease-in on exits (measured on 08: Land in, Launch out; 15: Settle/Cruise); stepped motion as an Editorial option (07: held 4–5 f steps, type-on every 2 f).

### Map
Energy 1.2–5.7, tone 0.5–5.5. Overlaps Playful at energy 4–5.7: the separator is tone (≤ 5.5) and expressive devices (no smears/jokes/springs).
