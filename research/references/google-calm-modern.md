# Reference match: Google — calm, modern product motion (example profile)

Energy 1–2 (calm to soft) · tones: modern, friendly, corporate · avoid: overshoot, anticipation, retro, Shake, Jitter

## Presets that fit (15)
Chars Rise, Count Up, Fade, Fade Up, Flip In, Flip In X, Float, Line Draw, Pulse, Rotate Settle, Slide Land, Surge Rise, Wipe Reveal, Words Fade Up, Zoom Out

Default curve for this feel: **Land**.

## Observed moves → how to build them
| Move | Status | Preset | Curve | Duration | Notes |
|---|---|---|---|---|---|
| cards and chips rise a little while fading in | match (9.0) | Fade Up | Land | Glide |  |
| headline fades in word by word | match (7.0) | Fade | Settle | Arrive | duration ×0.86 |
| a container grows from a button into a full card (shape morph) | gap (2.5) | Ramp Slide | Settle | Arrive | duration ×1.07 |
| elements leave quickly and quietly | match (9.0) | Zoom Out | Launch | Blink |  |
| icons draw their stroke in | match (8.5) | Line Draw | Settle | Arrive | duration ×0.96 |
| colourful dots bounce gently in a loop (loading) | adapt (5.0) | Orbit | Land | Sweep | duration ×1.29 |
| product footage pushes in slowly | gap (6.5) | Pulse | Cruise | Stage | duration ×2.73 |

## Curves
| Observed | Bezier | Closest token | Distance |
|---|---|---|---|
| standard | [0.2, 0, 0, 1] | Settle | 0.14 |
| emphasized decelerate | [0.05, 0.7, 0.1, 1] | Land | 0.28 **gap** |
| emphasized accelerate | [0.3, 0, 0.8, 0.15] | Launch | 0.52 **gap** |

## Gaps to create
- moves: 2
  - a container grows from a button into a full card (shape morph) (closest: Ramp Slide)
  - product footage pushes in slowly (closest: Pulse)
- curves: 2
  - emphasized decelerate [0.05, 0.7, 0.1, 1]
  - emphasized accelerate [0.3, 0, 0.8, 0.15]
- techniques: 1
  - shape morph: a shape (button, chip) grows and changes radius into the next layout
- new tones: friendly

## Proposed style
```json
{
 "name": "Google",
 "slug": "google-calm-modern",
 "energy": "soft",
 "desc": "From reference: Google — calm, modern product motion (example profile)",
 "stagger": 6,
 "curve": "Land",
 "roles": {
  "title": {
   "text": "Words Fade Up"
  },
  "subtitle": {
   "text": "Words Fade Up"
  },
  "body": {
   "text": "Words Fade Up"
  },
  "shape": {
   "motion": "Fade"
  },
  "media": {
   "motion": "Fade"
  },
  "logo": {
   "motion": "Rotate Settle"
  }
 }
}
```

Next steps: CONTRIBUTING.md §8 (create the gaps, tag them, render the samples, add the style).
