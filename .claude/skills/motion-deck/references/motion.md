# Motion: curves, reveals, masks, interludes, panels, pinned stories, loops

All of it is wired into `assets/deck.src.html`. Change values there, never inline.

## 1. Curves and durations (Motion DNA tokens, 30 fps)

| Token | cubic-bezier | Use |
|---|---|---|
| `--land` | `.12,.9,.28,1` | entrances from off-screen: words rising, cards arriving (default) |
| `--settle` | `.3,0,.1,1` | fades, colour changes, soft glides into interludes |
| `--pop` | `.34,1.45,.64,1` | small things that bounce: chips, nodes, icons (~5% overshoot) |
| `--whip` | `.75,0,.05,1` | holds then fires: highlight wipes, line draws, clip-path wipes |
| `--coast` | `.18,.28,0,.9` | starts fast and coasts: photo settle-ins, editorial type |
| `--surge` | `.7,0,.3,1` | slow-fast-slow for premium moves |

| Duration | ms | Use |
|---|---|---|
| `--glide` | 300 | small moves, colour swaps |
| `--arrive` | 467 | entrances |
| `--sweep` | 700 | word rises, half-screen moves |
| `--stage` | 1100 | wipes, line draws, full-screen moments |

Each slide names its curve in `data-curve` (Land, Pop, Settle, Whip, Coast) and `data-dur` ("Stage 1100 ms"); the
footer draws that curve and runs a dot along it. Stagger with `--d` (ms) or `data-base` on split headings: words
55 ms apart, characters 34 ms, blocks 100-200 ms apart; a slide is in by ~1.6 s.

## 2. Reveals

Slides get `.armed` at load and `.in` when ≥28% visible; leaving removes `.in`, so every slide replays.

| Markup | Effect |
|---|---|
| `data-split` (+ `data-base`) | words rise one by one inside padded masks |
| `data-chars` (+ `data-delay`) | a title arrives letter by letter, each tilting up |
| `.r.r-up` / `.r-fade` / `.r-pop` | rise 48 px / fade / pop from .4 |
| `.r-wipe` / `.r-wipeL` / `.r-wipeR` | clip-path wipe from the bottom / left / right |
| `.zoom` on `.bg` | the photo settles from 1.14 over 1.8 s on Coast; `.drift` then pushes it slowly forever |
| `.mark` / `.hl` | a colour block wipes in behind a phrase |
| `.rule` | a hairline draws |
| `.illo` | line illustrations draw themselves (2.6 s, Settle) |
| `data-count="N"` | a number counts up on Land |
| `data-type="text"` | lines type out one after another |
| `svg.flow` | nodes pop, links draw, a dot travels each link; hover lights a node's links |

Masks: `.w{padding:.1em .16em .2em;margin:-.1em -.16em -.2em}` keeps the serif's italics, descenders and ascenders
whole; hidden words wait at `translateY(105%)`. If a display font with deep descenders is swapped in, raise the
bottom padding (and the matching negative margin) rather than shrinking the type.

## 3. Transitions between slides

- Scroll-snap, arrows, space, PageUp/Down, Home/End; F or the Full screen button for full screen.
- **Interlude + cover-up**: `.hold` wraps an `.interlude` (a full-bleed photo with one big line) and the next block
  (`.cover-up`). The photo holds while the next slide rises over it; its top-right corner starts rounded (158 px,
  `data-rad` sets the resting radius) and straightens as it lands; the photo dims to 50%. Interludes get no page
  number or dot. Keys and wheel glide into and out of them in 1500 ms on Settle.
- **Horizontal stretch**: `.hwrap.pinned` with one `.stop` per panel; each screen of scroll slides the next
  `.hpanel` in from the right, stacked like tabs (each a step shorter, rounded corner, shadow), the one underneath
  dims 15%. Moves between panels glide in 1100 ms.
- **Pinned workflow** (`#flow`): the scroll picks the step; its clip plays, its bar fills.
- **Scroll marquee** (`#ask`): one track of big prompts crosses right to left, 2 px per px scrolled, easing after the
  scroll; snapping is off inside it (`html.free`).
- **Pinned hub** (`#roof`): three scroll moments reveal spokes, ring and new nodes.

## 4. Loops while a slide is on screen

- `video[data-auto]` loops play only while their slide is in; `video[data-once]` plays once on arrival.
- `.drift` slow push on photos, `.rays` shimmer on the cover, `.pulse` ring on the hub, diagram pulses.

## 5. Hover

- Advantage icons tilt and grow; chart dots grow; diagram nodes light their links; links slide their arrow.
- Keep hover reactions small: the deck is presented, not browsed.

All motion is reduced to instant changes under `prefers-reduced-motion`.
