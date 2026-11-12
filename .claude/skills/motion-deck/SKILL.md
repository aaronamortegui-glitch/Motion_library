---
name: motion-deck
description: Build animated HTML presentations (case studies, pitch and proposal decks, product decks, portfolios, animated CVs) in the style of the Motion DNA deck — solid Deck 2.0 grounds, Inter Tight with Instrument Serif italic accents, highlight blocks, full-bleed photos with scrims, interludes, horizontal panels, pinned scroll stories, a curve readout — as ONE self-contained file that opens with a double click, with every entrance on the Motion DNA easing tokens. Colours and fonts come from the source deck or brand, not a fixed palette. Use whenever someone wants to turn a PPT/Google Slides deck, a PDF, images, videos or notes into an HTML presentation, asks for "a presentation like the Motion DNA / Conair ones", wants slides with animation, transitions or video inside, or needs a version light enough to attach to an email — even if they never say "skill" or "HTML".
---

# Motion Deck: animated single-file HTML presentations

The engine is the Motion DNA deck itself (Gian and Aaron's "AI Briefly · Motion DNA"): a 1920×1080 stage scaled to
the window, one slide per screen, solid coloured grounds, Inter Tight for text and Instrument Serif italic for the
words that matter, every entrance timed on the Motion DNA easing tokens, shipped as a single HTML file (fonts, images
and video inlined) that works offline with a double click. Read the references before you design:

- `references/design.md` — the look: grounds, type, the slide catalogue, layout, content rules from client reviews, QA.
- `references/motion.md` — curves and durations, reveals, masks, interludes, panels, pinned stories, loops, hover.
- `references/media.md` — finding existing WebM/MP4 work, encoding full and email versions, size budgets.

## The kit (in `assets/`)

| File | What it is |
|---|---|
| `deck.src.html` | The engine plus the 15 Motion DNA slides as examples of every module, and a film and a live diagram. Copy it, keep the CSS and the script, replace the slides. |
| `palette.py` | Takes the colours and fonts from the source: `--pptx`, `--image`, `--colors`, `--fonts`, or `--preset superside`. Rewrites the BRAND TOKENS block. |
| `build.py` | Inlines fonts, the optional `wordmark.svg`, `{{i:name}}` icons and every file under `assets/` into `<Title>.html`; `--lite` builds the email version from `assets_lite/`. |
| `media.py` | Encodes the media in `media.json` (films, loops, stills) for both versions; reuses WebM that already exist. |
| `new_deck.py` | Scaffolds a deck folder: `python new_deck.py <folder> --title "Name"`. |
| `qa_snippet.js` | Console check: words cut by their mask, text off the stage, overlapping blocks. |
| `fonts/` | Inter Tight and Instrument Serif (SIL OFL 1.1, `fonts/OFL.txt`). |

## Order of work

1. **Content first, exactly.** A source deck (Slides/PPTX/PDF) is the master: keep its text, order and slide count
   word for word. From notes, a CV or a brief: write the copy and show it before building. Never add captions,
   "how to read this" lines or footer guides the source does not have.
2. **The look comes from the source.** Run `palette.py` with the source PPTX (`--pptx`), screenshots of its slides
   or brand images (`--image`), or the brand's hex codes (`--colors`), and its fonts (`--fonts "Text,Accent"`). Use
   `--preset superside` only for Superside or Motion DNA decks. A brand profile (`get_brand`) wins over guesses.
   Put the client's or agency's logo in the deck folder as `wordmark.svg` (class `wordmark`) if the source shows one;
   the kit ships none.
3. **Find the media that already exists** (`references/media.md` §1): renders, `*.webm`/`*.mp4` next to the work,
   the original MP4 behind every GIF. Deck GIFs and thumbnails are never the source for video.
4. **Scaffold, list media, encode**: `new_deck.py`, then `media.json`, then `python media.py` and `--lite`.
5. **Write the slides** from the catalogue: one idea per slide, a heading that rises word by word, one marked or
   serif phrase, one visual. Alternate grounds (a dark ground every two or three slides), open chapters with an
   interlude, tell processes with a pinned story, end with a closing slide.
6. **Build**: `python build.py` (to present) and `python build.py --lite` (to attach). Both print the size.
7. **QA in a browser** (`design.md` §QA), at 1600×900 and at phone width, then run `qa_snippet.js`.
8. **Hand over** both files with their sizes and what you could not verify, plus: "download it and double-click; it
   opens in the browser and works offline". Never upload it to a site that asks for personal or company details.

## Non-negotiables (each one cost a review round)

- Text never cut: word masks keep their padding and negative margins; a heading that wraps more than two lines
  gets a shorter text or a smaller class, never a smaller mask.
- Legible first: text over photos sits on a scrim or band; serif italic is for a phrase, not a paragraph.
- Diagrams are the biggest thing on their slide; lists sit under the box they belong to.
- Inputs and outputs never mix on one slide; a closing slide ends every deck.
- Every name, number and claim comes from the source; label figures quoted from a film or a third party.
- Client media and decks stay out of git (a git-ignored folder). Commit only when asked.

## Install

Unzip `motion-deck.zip` into `~/.claude/skills/` (you get `~/.claude/skills/motion-deck/SKILL.md`) and restart
Claude Code; in a Motion DNA clone `python tools/setup.py` links it. Needs Python 3 with Pillow, and ffmpeg on PATH
for the media script.
