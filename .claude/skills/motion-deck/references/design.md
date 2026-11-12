# Design: the Motion DNA deck look

Everything here is already in `assets/deck.src.html`; the example slides are the reference for spacing and rhythm.

## Stage

- Each slide holds a 1920×1080 `.stage` scaled by `--s`; position in stage pixels with `.abs` (`--x --y --w`).
  Margins: x 50 to 1870. Headings at y ~116, body from ~208. The menu sits above y 90, the footer below y 1010.
- Full-bleed media: `.bg` (with `zoom` for the settle-in and `drift` on the image for a slow push) + `.scrim`
  (a gradient tuned per slide so text sits on colour) + `.band top|bot` (edge bands in the ground colour).

## Grounds (BRAND TOKENS, set by `palette.py`)

| Class | Default | Text | Use |
|---|---|---|---|
| `g-pine` | #0A211F | cloud, accent spark | covers, statements, interludes, pinned stories |
| `g-sea` | #19546E | cloud, accent spark | diagrams, prompts |
| `g-leaf` | #2A4E45 | cloud, accent mint | solutions, closings |
| `g-earth` | #292423 | cloud, accent peach | data, behind the scenes |
| `g-cloud` | #F7F9F2 | pine | films, galleries, plain content |
| `g-stone` `g-sky` `g-mint` `g-peach` `g-spark` | light colours | pine | problems, parts of a stretch, benefits |

The menu, dots, footer, logo and progress bar take each ground's ink automatically (the `GROUND` table in the
script). Rhythm: alternate light and dark; never two identical grounds in a row unless they are one stretch.

## Type (stage px)

| Class | Size | Use |
|---|---|---|
| `.h180` | 180 | statement slides ("We built / Motion DNA.") |
| `.h160` | 160 serif | cover title (with `data-chars`) |
| `.h107` | 107 serif italic | column titles, part labels |
| `.h96` / `.h80` | 96 / 80 | cover subtitle / slide headings |
| `.t48 .t40 .t37 .t32 .t27 .t24 .t21` | | body sizes; 32 is the default paragraph |
| `.eyebrow` | 21 caps | small labels above a title |
| `.serif` | | Instrument Serif in a heading (`<span class="serif" data-split>`) |
| `.mark m-lav|m-spark|m-mint` | | a serif-italic phrase on a colour block that wipes in |
| `.hl` | | a heading phrase on a spark block (dark grounds) |
| `.num` | 88 serif italic | big numbers (with `data-count`) |

## Slide catalogue (each one is an example in the template)

| Example id | Module | Use it for |
|---|---|---|
| `cover` | photo cover, `data-chars` title, subtitle, hint, people with photos | first slide |
| `problem` | three columns: line illustration (`.illo`), serif title, text | problems, pillars |
| `solution` | full-bleed photo, scrim, eyebrow, `.h180` statement, definition with `.mark` | the answer, the product |
| `office` + `parts` | interlude (`.hold` + `.interlude`) covered by a horizontal stretch of three panels | chapter break + three parts of one idea |
| `library` `brand` `agent` | `.hpanel` with a phone-shaped `.panel` clip, part label, marked text | features, modules |
| `flow` | pinned workflow: numbered steps, bars, the active step's clip | a process told by scrolling |
| `ask` | scroll marquee of big prompts with chips | prompts, testimonials, claims |
| `studio` + `behind` | interlude covered by a slide with the style chart (`#chart`) | data, research |
| `fed` | four-column numbers (`.fedgrid`, `data-count`) | what went in, key figures |
| `roof` | pinned hub (`#hub`): spokes, ring, new nodes in three scroll steps | ecosystems, integrations |
| `film` | a `.frame` with a play button; plays with sound | the main video |
| `system` | live diagram (`data-flow`, `FLOWS` in the script) | any system or pipeline |
| `why` | photo with scrim, list of advantages with icons | benefits |
| `next` | closing over a looping video | last slide |

Contact links: `.links` (two columns of underlined links with an arrow) on the closing slide.

## Content rules (from client reviews)

1. The source deck is the master: same text, order and slide count; HTML-only changes only when asked, and say so.
2. No invented explanations, captions or footer guides.
3. Inputs and outputs on separate slides.
4. A diagram that matters takes most of the slide.
5. A closing slide ends the deck.
6. Figures from a film or a third party are labelled; an email and public profiles are fine on a personal deck,
   a phone number only when asked.

## QA

- At 1600×900 step through every slide and every pinned stop with the arrow keys; wait ~2.5 s on each.
- Nothing cut, nothing over the footer or under the menu, headings on at most two lines; new fonts change widths,
  so check every heading after `palette.py --fonts`.
- Run `qa_snippet.js` in the console; check a phone width (390 px): the stage becomes a reading column.
- Hover the diagram, play each film for a second, read the console for errors.
- The single file has no `assets/` references left; report full and lite sizes.
