# Motion: curves, reveals, masks, transitions, parallax, loops, hover

All values are already wired into `assets/deck.src.html` as CSS custom properties. Change them there, never inline.

## 1. Curves and durations (Motion DNA tokens, 30 fps)

| Token | cubic-bezier | Use in a deck |
|---|---|---|
| `--land` | `.12,.9,.28,1` | Entrances from off-screen: words rising, cards arriving, the default |
| `--settle` | `.3,0,.1,1` | Opacity fades, colour changes, exits that do not chain |
| `--pop` | `.34,1.45,.64,1` | Small things that should bounce: chips, badges, icons, buttons (~5% overshoot) |
| `--whip` | `.75,0,.05,1` | Holds then fires: wipes, line draws, timelines, curtains |
| `--coast` | `.18,.28,0,.9` | Starts fast, coasts: image zoom-outs, sweeps, editorial type |
| `--surge` | `.7,0,.3,1` | Premium slow-fast-slow for headline transforms |
| `--ramp` | `.87,0,.13,1` | Extreme speed ramp for full-screen transitions |
| `--recoil` | `.6,0,.75,-.4` | Exits with anticipation (rare in decks) |

| Duration | ms | Use |
|---|---|---|
| `--tick` | 133 | hover feedback |
| `--glide` | 300 | small moves, colour swaps |
| `--arrive` | 467 | element entrances |
| `--sweep` | 700 | word rises, half-screen moves |
| `--stage` | 1100 | wipes, line draws, curtains |

Stagger with `--d` (ms) on each element: heading words 45-55 ms apart (automatic), cards 80-120 ms apart, the
supporting paragraph ~300 ms after the heading, the visual 150-300 ms after that. A slide should be fully in by
~1.6 s.

## 2. Reveals (classes)

Every slide gets `.armed` at load and `.in` when ≥28% of it is visible; leaving removes `.in`, so it replays.

| Class | Effect | Curve |
|---|---|---|
| `[data-split]` | Words rise one by one inside masks | land, sweep |
| `[data-dec]` | Mono label decodes from random glyphs (520 ms, always lands on the text) | linear |
| `.r.r-up` | Fade + rise 40 px | settle / land |
| `.r.r-fade` | Fade | settle |
| `.r.r-pop` | Fade + scale from .85 | pop |
| `.r.r-wipe` | Clip-path wipe from the left, rounded | whip, stage |
| `.r.r-wipeUp` | Clip-path wipe from the bottom | whip, stage |
| `.zoom` (on a media frame) | Image/video settles from scale 1.12 | coast, 1800 ms |
| `.tl` | A line draws across (timelines) | whip |
| `svg.flow` | Nodes pop in order, links draw, pulses travel | pop, whip |
| `[data-chars]` | A display title arrives letter by letter, each tilting up | land, stage |
| `[data-count="N"]` | A number counts up from 0 | Land, 1100 ms |
| `[data-type="text"]` | Lines type out one after another (prompts, chat) | 22 ms per letter |
| `.markup` | A colour block wipes in behind a phrase (`--mk` sets the colour) | whip |
| `.rule` | A hairline draws above a block | whip |
| `.illo` (inline SVG) | Line illustrations draw themselves | settle, 2600 ms |
| `data-curve` + `data-dur` on a slide | The footer shows that slide's curve, a dot runs along it | the curve itself |

## 3. Masks

`.w` is the mask, `.wi` the word. The padding/negative-margin pair gives descenders, italics and commas room
without moving the layout: `padding:.25em .35em .32em; margin:-.25em -.35em -.32em`. Hidden words sit at
`translateY(150%)` so no ascender peeks in. Gradient (neon) words get the gradient on each `.wi`.

## 4. Transitions between slides

The deck scrolls with `scroll-snap` (arrows, space, PageUp/Down, Home/End; F for full screen). On top of the reveal:

- `.t-curtain` on a `<section>`: a gradient panel sweeps across once as the slide enters (whip, stage). Use it on
  section openers only.
- **Interlude + cover-up**: a `.hold` wraps a full-bleed `.interlude` (a still or clip with one big line) and the
  next slide (`.cover-up`). The still holds while the slide rises over it; its top-right corner starts rounded
  (158 px) and straightens as it lands, the still dims to 50%. Interludes get no page number or dot.
- **Horizontal stretch**: a `.hwrap.pinned` with one `.stop` per panel and a `.hsticky` of `.hpanel` slides; each
  screen of scroll slides the next panel in from the right, stacked like tabs (each a step shorter, rounded corner,
  shadow), the one underneath dims 15%.
- **Pinned steps**: a `.pinned` slide 300vh tall with stops; the scroll picks the `.step`, its clip plays, its bar fills.
- **Scroll marquee**: a `.pinned` slide whose `.mtrack` of big lines crosses right to left at 2 px per px scrolled,
  easing after the scroll; snapping is off inside it (`html.free`), the bars count the lines passed.
- **Soft moves**: keys and wheel into or out of an interlude glide 1500 ms on Settle; between stretch panels 1100 ms.
- Section openers: the clip sits on the right and fades into the ground on the left; the heading rises over the fade.
- Films (`.film`): the frame wipes in; the play button pops; leaving the slide pauses and resets the film.

## 5. Parallax ground (calm)

Fixed layers behind every slide, moved by a smoothed scroll value `--sy` (lerp .08 per frame):

- `.g-cols` vertical lines, almost still; `.g-rows` horizontal lines at very low alpha and speed (-.04).
- `.g-rain` three thin vertical light streaks at different speeds (.45-.75).
- `.g-floor` a perspective grid at the bottom, opacity .35, moving with the scroll.
- `.g-glow` two or three large soft radial glows.
- `.g-hot` a denser grid visible only in a 220 px circle around the pointer.

Never add fast horizontal streaks: they flicker behind the text when scrolling.

## 6. Loops while a slide is on screen

Loops run only while the slide has `.in` (CSS `animation-play-state` and video play/pause in the script), so a long
deck stays light:

- Section openers: `<video data-auto muted loop>` — a 6-8 s cut of the work (see media.md).
- `.badge` floating pills (5 s ease-in-out), `.sweep` scan band over a portrait (6 s coast), `.ping` live dot.
- `.marquee`: an endless strip of words or chips (client names, tools); duplicate the content once.
- `.orbit`: icons circling a central element (20 s linear).
- Diagram pulses: a dot travels each link (`animateMotion`, 2.4-3.2 s).

## 7. Hover reactions (pointer devices only)

- Spotlight + lit grid under the pointer (`--mx`, `--my`), a ring cursor that grows over anything interactive.
- `.tilt` cards: 3D tilt toward the pointer (±3.5°), lift 6 px, a soft light at the pointer, neon border (`.hud`).
- `.media` frames: image scales 1.05 and a 0.5 s cyan/magenta glitch slips across.
- `.glitch` words: a 0.38 s RGB jitter.
- `.stat` numbers re-decode; chips and pills lift; repo/contact cards reveal an arrow.
- Diagram nodes: hovering one lights it, its links and its neighbours; the rest dim to 25%.
- The side rail shows each slide's label on hover.

All of it is off with `prefers-reduced-motion` and on touch screens.
