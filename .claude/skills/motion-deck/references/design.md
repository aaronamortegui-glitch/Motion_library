# Design: stage, type, themes, slide catalogue, content rules, QA

## Stage and grid

- Every slide holds a 1920×1080 `.stage` scaled by `--s` (`min(100vw, 100vh·16/9) / 1920`). Position with stage
  pixels: `.abs` takes `--x --y --w`; media frames take `--l --t --w --h`. Everything is `calc(N * var(--s))`.
- Margins: content from x 110 to 1810. Eyebrow at y 150, heading at y 215, body from ~y 330, the bottom 120 px is for
  the footer (page number, deck name). The top 120 px belongs to the menu bar.
- Columns that work: text 600-640 wide + visual ~1020 wide at x 790; three cards of 540; four cards of 410;
  four stills of 400 with 32 gaps.

## Type (stage px)

| Class | Size | Use |
|---|---|---|
| `.h130` | 130 | Cover name/title, section openers |
| `.h110` | 110 | Big section titles, closing |
| `.h72` | 72 | Statement headings |
| `.h56` | 56 | Slide headings (most slides) |
| `.t32` | 32 | Lead paragraph on covers/openers |
| `.t26` | 26 | Supporting paragraph |
| `.t21` | 21 | Small body next to a visual |
| `.mono`, `.eyebrow` | 17-19 | Labels, captions, numbering |

Fonts (inlined): **Unbounded** for display, **Space Grotesk** for text, **JetBrains Mono** for labels. A brand deck
can swap them: put the brand's WOFF2 files in `fonts/`, edit `FONTS` in `build.py` and `--disp/--sans/--mono`.
Headings: one or two lines, the key words in `.neon` (gradient) or `.hl`. Body copy never under 18 px.

## Themes

`<html data-theme="light">` (default) or `"dark"`. Tokens: `--bg --card --soft --line --ink --mute` plus accents
`--cyan --violet --hot --lime` and the `--neon` gradient. For a client, replace the accents with the brand palette
and keep contrast ≥ 4.5:1 for text. Light is the default: it reads better on projectors and in email previews.
Dark decks put content on lifted panels (`--card` a few steps above `--bg`, a visible border), never black on black.

## Chrome

A floating top bar (logo mark + name, section links with icons that highlight with the slide, one call-to-action
button), a progress line at the very top, a side rail of dots with labels on hover, and a footer with the deck name
and `NN / NN`. Hide the bar on a full-screen film if it covers the frame.

## Slide catalogue (examples of each in `deck.src.html`)

| Type | Contents | Notes |
|---|---|---|
| Cover | eyebrow, big title (name), one-line promise, meta pills, portrait/visual with floating badges | The visual wipes in; badges pop and float |
| Statement | eyebrow, h72 heading, paragraph, three icon cards | Cards tilt on hover |
| Timeline | heading, a drawn line, 3-5 stops (icon, years, title, text) | Stops rise in order |
| Section opener | eyebrow, h130/h110 title, one line, looping clip on the right | `.t-curtain` |
| Film | heading, short text, 2-4 stats, a 16:9 film frame with a play button, tool pills | Plays with sound on click |
| Diagram | heading, a hint line, a `FLOWS` diagram | Biggest thing on the slide |
| Pipeline + stills | heading, a horizontal flow, 3-4 stills with tags | Stills glitch on hover |
| Cards grid | heading, 4×2 cards with icon and status pill | For services, research, features |
| Repos / links grid | heading, 4×2 link cards with meta | Arrow appears on hover |
| Chips + cards | heading, tool chips (highlight the key ones), three cards | |
| Gallery / mosaic | heading, 4-8 images in a grid, labels | `.zoom` frames |
| Quote | big quote in `.quote`, attribution | Only real quotes, with permission |
| Interlude | one full-bleed still or clip, one big line; the next slide covers it | Use 1-2 per deck, at chapter breaks |
| Horizontal stretch | 2-4 panels on different grounds that slide in from the right | Parts of one idea (library, brand, agent) |
| Pinned steps | numbered steps on the left, the clip of the active step on the right | A process told by scrolling |
| Scroll marquee | big quoted lines crossing the screen with the scroll | Prompts, testimonials, claims |

Grounds per slide: `g-base` (theme), `g-soft`, `g-cyan`, `g-violet`, `g-dark`, `g-ink`. The menu, rail and footer
take the slide's ink automatically. Alternate grounds to give the deck rhythm (a coloured ground every 3-4 slides).
| Closing / contact | big line, contact cards (featured one spans two columns), portrait | Last slide always |

## Content rules (from client reviews)

1. The source deck is the master: same text, order and slide count. Changes go into the source first; one-off
   HTML-only changes are fine when asked, and you say so.
2. No invented explanations, captions, footers or guideline text.
3. Inputs and outputs on separate slides.
4. A diagram that matters takes most of the slide; supporting lists go under the box they describe.
5. A closing slide ends the deck.
6. Figures quoted from a film or a third party are labelled as such.
7. Personal data: an email and public profiles are fine on a personal deck; never a phone number unless asked.

## QA (before handing over)

- Open `index.html` (the build writes it next to the single file) through a local server or by double click.
- At 1600×900 step through every slide after its entrance (~2.5 s): nothing cut, nothing over the footer or under
  the menu bar, headings on at most two lines.
- Run an overlap check in the console: force every slide `.in`, then compare the bounding boxes of the top-level
  blocks of each stage and of each mask against its word's ink (see `assets/qa_snippet.js`).
- Check at a phone width (390 px): the menu collapses, nothing scrolls sideways.
- Hover one card, one image, one diagram node; play each film for a second; read the console for errors.
- Check the single file has no `assets/` references left and report its size (full and lite).
