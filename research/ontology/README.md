# Motion Ontology — system architecture

Goal: turn a large body of motion graphics / animation references into a structured, measurable
**motion ontology**, then use it to go from a **storyboard** to a proposed **animation style** and an
**implementation** in After Effects and JavaScript, built from Aaron's curve and preset library.

```
 PHASE 1 · INGEST                       PHASE 2 · PROPOSE                   PHASE 3 · RESOLVE & BUILD
 reference videos                       storyboard + concept                 Aaron's library (tokens, presets, recipes)
       │                                       │                                     │
       ▼                                       ▼                                     ▼
 measure + read  ──►  ONTOLOGY  ──►  match on the Style Map  ──►  style proposal  ──►  curves/presets per element
 (metrics, curves,    (videos, styles,  (nearest videos,          (rules + per-frame      │
  contact sheets)      behaviors,        style family/sub-style)   behaviors)             ▼
                       curves)                                                        animation spec (JSON)
                                                                                        ├─► After Effects (.jsx via SSM/SSP)
                                                                                        └─► JavaScript (web animation)
```

## The ontology: five levels

| Level | What it is | Where it lives | Used for |
|---|---|---|---|
| **Style family / sub-style** | a cluster of videos + its rules (e.g. Elegant › Editorial) | `research/styles/<family>/_synthesis.md` | proposing a direction |
| **Video** | one reference, positioned on the map and tagged | `research/style_map/catalog.json` | finding the nearest references to a storyboard |
| **Behavior** | one atomic, reusable motion pattern seen in a video: *how a thing of type X does phase Y* | `research/ontology/behaviors.json` | animating each storyboard element |
| **Curve** | the measured timing of a behavior, in a platform-neutral form | inside each behavior | resolving to Aaron's tokens or a new token |
| **Vocabulary** | the fixed word lists for every field | `research/style_map/taxonomy.md` | keeping everything comparable |

**Behaviors are the key unit.** A storyboard doesn't need "a video like Linear". It needs
"how does the *logo* enter, how does the *headline* build, how does the scene *transition*" in that style.
So every analysis extracts behaviors, each tagged with element type × phase × style.

### Behavior record
```
id, video, family, substyle
element_type   abstract shape | text | character | object/icon | UI | background | camera | logo | photo
phase          enter | move | hold | exit | secondary | transition | text-build
mechanism      e.g. "slide-reveal", "snap + settle", "blur-in per word", "flash to white"
channels       position | scale | rotation | opacity | blur | mask | trim | color | camera
timing         duration_f, fps, duration_ms, stagger_f
curve          kind (tween | snap | spring | linear | stepped)
               bezier [x1,y1,x2,y2] · overshoot · anticipation · settle_f
               samples (normalized progress per frame, when measured)
measured       true = fitted from the video, false = read from contact sheets
nearest_token  closest curve in Aaron's tokens + distance (→ reuse it, or propose a new token)
preset         closest preset in Aaron's library, if any
notes
```

### Curves: platform-neutral, then exported
Every curve is stored once and converted for each target:

| Kind | Stored as | After Effects | JavaScript |
|---|---|---|---|
| tween | cubic-bezier + duration | `SSM.animate` with the token, or keyframe speed/influence | CSS `cubic-bezier()`, WAAPI `easing` |
| snap | jump % + settle bezier + settle_f | hold keyframe + short eased keyframe | two-step keyframes |
| spring / overshoot | overshoot %, oscillations, settle_f (+ bezier fit) | `Pop`-style bezier or a spring expression | spring function or a multi-stop easing |
| stepped / typing | per-unit interval + pause pattern | text animator range selector with expression | per-character timeline |

## Phase 2: storyboard → style proposal
1. **Read the storyboard and concept** → the same fields as a video: format, target mood, cast, space,
   intended pace, duration, brand constraints.
2. **Place it on the map** → nearest references (energy/tone/rhythm + tag overlap) → style family and sub-style, with
   2–3 reference videos as evidence.
3. **Apply the style rules** (from the synthesis) → global decisions: rhythm, holds, transition family, text mechanism, secondary-motion budget.
4. **Per frame and per element** → pick the behavior for each element and phase from `behaviors.json`, filtered by that style.
5. Output: a **style proposal** (readable) + an **animation spec** (JSON: elements, phases, timings, curves).

## Phase 3: resolve against Aaron's library and build
1. Each behavior's curve → nearest token in `tokens/superside_motion_tokens.json` (bezier distance, already in `tools/fit_samples.py`).
   Distance above a threshold → **proposed new token** (tracked, for Aaron to approve).
2. Each element/phase → nearest preset in `library/library.json` / `recipes.json` (by channels + energy + use).
3. Generate the **AE job** (`SSP.apply` / `SSM.animate` through the bridge) and the **JS** version from the same spec.

## Ingestion at scale (Phase 1 workflow)
- **Automatic per video:** probe, cut detection, motion energy, metrics (energy, rhythm, colorfulness), overview contact sheets.
- **Analyst pass (me):** read the sheets, zoom into key moments, classify elements, extract behaviors, track and fit curves where an element moves cleanly, score tone, tag.
- **Outputs per video:** analysis doc, catalog entry, behaviors, updated map; style synthesis updated per batch.
- **Depth levels:** *full* (like ref01/ref02, the elegant definition set) vs *light* (metrics + tags + 3–6 behaviors) for volume.

## Status
- [x] Analysis framework (`research/style_analysis_framework.md`)
- [x] Style Map v1: taxonomy, catalog, map (`research/style_map/`)
- [x] Behavior schema + first behaviors from ref01/ref02 (`behaviors.json`)
- [ ] Ingest more references (all three families)
- [ ] Storyboard intake format + matching (Phase 2)
- [ ] Spec → AE / JS generators (Phase 3), aligned with Aaron's library
