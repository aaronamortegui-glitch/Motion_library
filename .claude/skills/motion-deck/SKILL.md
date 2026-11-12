---
name: motion-deck
description: Build animated HTML presentations (decks, case studies, portfolios, pitch and proposal decks, animated CVs) as ONE self-contained file that opens with a double click, with Motion DNA motion — word-mask reveals on token easing curves, wipes, parallax line grounds, looping clips on section slides, live diagrams, hover reactions and a designed top menu. Use whenever someone wants to turn a PPT/Google Slides deck, a PDF, images, videos or notes into an HTML presentation, asks for "a presentation like the Motion DNA / Conair ones", wants slides with animation, transitions or video inside, or needs a version light enough to attach to an email — even if they never say "skill" or "HTML".
---

# Motion Deck: animated single-file HTML presentations

You build a 1920×1080 stage that scales to any window, one slide per screen, every entrance timed on the Motion DNA
easing tokens, and you ship it as a single HTML file (fonts, images and video inlined) that works offline with a
double click. Two decks were made this way (a client case study and a personal portfolio); everything the reviews of
those decks taught is written into this skill. Read the three references before you design:

- `references/design.md` — the stage, type scale, themes, the slide catalogue and the content rules from client reviews.
- `references/motion.md` — the curves and durations, reveals, masks, transitions, parallax, loops and hover reactions.
- `references/media.md` — finding existing WebM/MP4 work, encoding full and email versions, size budgets.

## The kit (in `assets/`)

| File | What it is |
|---|---|
| `deck.src.html` | The engine plus one example of every slide type. Copy it, keep the engine (CSS + script), replace the slides. |
| `build.py` | Inlines fonts, icons (`{{i:name}}`) and every file under `assets/` into `<Name>.html`; `--lite` builds the email version from `assets_lite/`. |
| `media.py` | Encodes the media listed in `media.json` to VP9 WebM (films, loops, stills) for both versions; reuses WebM that already exist. |
| `new_deck.py` | Scaffolds a deck folder: `python new_deck.py <folder> --title "Name" [--theme light|dark]`. |
| `fonts/` | Unbounded, Space Grotesk, JetBrains Mono (SIL OFL 1.1, see `fonts/OFL.txt`), inlined so the file works offline. |

## Install

Unzip `motion-deck.zip` into `~/.claude/skills/` (so you get `~/.claude/skills/motion-deck/SKILL.md`) and restart
Claude Code; it is then available in every folder. In a Motion DNA clone, `python tools/setup.py` links it for you.
Needs Python 3 with Pillow and ffmpeg on PATH for the media script.

## Order of work

1. **Gather the content first, exactly.** A deck (Slides/PPTX/PDF) is the master: keep its text, order and slide
   count word for word. Notes, a CV or a brief: write the copy, then show it before building. Never add explanatory
   captions, "how to read this" lines or footer guides that the source does not have.
2. **Find the media that already exists** before making anything (`references/media.md` §1): the project's renders,
   `*.webm` and `*.mp4` next to the work, the original MP4 behind every GIF. A deck's GIFs and thumbnails are never
   the source for video.
3. **Scaffold**: `python <skill>/assets/new_deck.py <project>/deck --title "..." --theme light`. It copies the engine,
   the scripts, the fonts and an empty `media.json`.
4. **List the media** in `media.json` (films with sound, loops cut from a time range, stills), run `python media.py`
   (full) and `python media.py --lite` (email). Look at a frame of each encode.
5. **Write the slides** in `deck.src.html` from the catalogue in `design.md`: one idea per slide, a big heading that
   rises word by word, one supporting block, one visual. Section openers carry a looping clip; films play on click
   with sound; diagrams are drawn as SVG by the `FLOWS` table in the script.
6. **Build**: `python build.py` (full, for presenting) and `python build.py --lite` (to attach). Both print the size.
7. **QA in a browser** (`references/design.md` §QA): every slide at 1600×900 and at a phone width, no text cut by a
   mask, nothing over the page number, diagrams readable, videos sharp, no console errors, hover states working.
   Measure overlaps with a script rather than trusting a screenshot.
8. **Hand over** the two files with their sizes, what you could not verify, and the line "download it and double-click;
   it opens in the browser and works offline". Never upload it to a hosting or sharing site that asks for personal or
   company details; prefer the user's own Drive, Slack or email.

## Non-negotiables (each one cost a review round)

- Text never cut: word masks get `.25em` top, `.32em` bottom and `.35em` sides of room, matched by negative margins,
  and hidden words start at `translateY(150%)`.
- Legible first: no black on black, no thin grey on photos, a scrim or a white fade behind any text over video, body
  copy at 18-26 stage px. Cyberpunk, neon or glitch is an accent, never the ground.
- The background stays calm: parallax uses vertical lines, a perspective floor and slow glows; fast horizontal streaks
  read as noise when scrolling.
- Diagrams are the largest thing on their slide; lists sit under the box they belong to.
- Inputs and outputs never mix on one slide; a closing slide (thank you, contact or wordmark) ends every deck.
- Decode/scramble effects always land on the real text with a timer fallback (background tabs throttle frames).
- Every name, number and claim comes from the source; say which figures come from a film or a third party.
- Client media and decks stay out of git (a git-ignored folder). Commit only when asked.
