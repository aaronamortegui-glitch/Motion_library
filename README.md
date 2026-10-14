# Motion DNA

Motion made with AI all looks the same: same curves, same moves, same templates. **Motion DNA** gives it an identity.
It is a motion library for After Effects (80 moves, 14 curves, 9 styles, 11 techniques, built on measured references)
with a panel for designers and an AI agent that works inside After Effects. You direct; it accelerates. Every brand you
animate keeps a profile that **learns from each review**, and everything it makes is native keyframes.

<img src="docs/screens/cep-panel.gif" width="280" align="right" alt="The Motion DNA panel in After Effects">

**What you get**
- **Your motion, not the default.** Pick moves and curves by feel (energy 1 calm → 5 explosive, tone), hover to see
  them move, apply them to the selected layers. Already animated? Keep your keyframes and change only their timing and
  curve.
- **Brands that learn.** Each review note becomes a rule of that brand; the next order, the next video and the next
  person start from everything it learned. Share a brand with one file.
- **An agent that knows the library.** Ask in plain words ("animate these Figma frames in the Editorial style"); it uses
  the library, the brand and your selection, and shows what each order cost.
- **Claude where you prefer.** The same conversation continues in the panel, the Claude app or a terminal: one per brand
  and one per video.

<br clear="right">

## Get started

1. **Install** (Windows or macOS): double-click `INSTALL-Windows.cmd` / `INSTALL-macOS.command`, or run
   `python tools/setup.py` (or ask Claude to install Motion DNA). The panel is signed on your machine: no Adobe
   developer mode, no admin rights.
2. **Open After Effects** › **Window › Extensions › Motion DNA** (also *File › Scripts › Motion DNA*) and dock it once:
   it comes back every time. The link with Claude starts with After Effects by itself.
3. **Agent › Connect:** *Connect Claude* (sign in once) and, if you use Figma, *Connect Figma* (press Allow).
4. Once, in After Effects: *Preferences › Scripting & Expressions › Allow Scripts to Write Files and Access Network*.

Update with `python tools/setup.py --update` (never over your local changes) · remove with `--uninstall`.

<details>
<summary>Install details: signing, developer mode, the classic panel, where things live</summary>

- `setup.py` signs the panel (`panel/`, a CEP extension) on your machine with a self-signed certificate made with
  Adobe's ZXPSignCmd (downloaded once into `tools/.cache/`) and installs the signed copy, so After Effects loads it with
  no developer mode. The installed copy is a shell that loads the panel's code from your clone: after `git pull`, close
  and reopen the panel.
- It also installs *File › Scripts › Motion DNA* (opens the panel) and a silent Startup script (starts the Claude bridge
  when After Effects opens), and removes entries older versions left. Fonts (Inter Tight, Instrument Serif, OFL) and the
  local asset-pack previews come with it.
- Developers: `python tools/setup.py --dev` runs the panel straight from the clone (edits show with **F5**); that needs
  Adobe's developer mode, and setup asks before turning it on (only you can say yes).
- The previous ScriptUI panel (`tools/ss_panel.jsx`) opens instead when the HTML panel is missing.
- Brands: templates in `library/brands/` (Motion DNA, the 22 rules learned making our promo); yours in
  `library/brands.local/` or a folder you choose. Terminal: `python tools/brand.py new | note | show | export | import`.
  Schema: [`library/brands/_schema.md`](library/brands/_schema.md).
</details>

## Use it

> **Manual:** [docs/USER_GUIDE.md](docs/USER_GUIDE.md) explains every part step by step, with tips by industry and a
> section for Claude. [docs/use-cases](docs/use-cases/README.md) has the tests behind it: each tool on a real-looking
> piece (fashion, eyewear, beauty, kitchen, cars), what broke, and how it was fixed.

### Connect Claude and Figma
<img src="docs/screens/cep-connect.gif" width="300" align="right" alt="Connect Claude and Figma">

*Agent › Connect* has one button each. **Connect Claude** opens the sign-in (your Claude account) and turns green by
itself. **Connect Figma** opens Figma's own permission page: press Allow. The header shows **MCP · Claude · Figma**:
green is ready, a click opens Connect. When Figma asks for permission again, the same button reconnects it.

<br clear="right">

### Animate the selected layers: create, or modify what is there
<img src="docs/screens/cep-create-modify.gif" width="300" align="right" alt="Create, Modify or Replace">

**Behaviors**: choose a type (Moves, Classics, Text, Loops, Transitions, Recipes, Favorites), hover a preset to see it
move, tune *Duration · Intensity · Direction · Easing* and press the button, which says what it will do:
- **Create** when the layers have no keyframes;
- **Modify** when they already move: your keyframes and values stay, they get the preset's timing and curve;
- **Replace** to swap their animation for the preset on the channels it uses (a rotation it does not touch stays);
- **Transition** with two layers selected in *Transitions*: the first leaves as the second arrives.

**Remove** cleans off what Motion DNA added. With *Marker timing*, drag the `SS in` / `SS out` markers to retime.

<br clear="right">

### Shape the curve
<img src="docs/screens/cep-curves.gif" width="300" align="right" alt="The curve editor">

**Curves**: the editor starts on the S curve `(1, 0, 0, 1)`. Drag the handles, type `x1, y1, x2, y2`, or pick a
library curve (the active brand's own curves come first). **Apply to keyframes** eases the selected keyframes; with none
selected, every keyframe of the selected layers. Values never change, only speed. **Read keys** loads a curve from your animation, **Save curve** adds yours to the library
or to the brand.

<br clear="right">

### Styles and techniques, ready to ask for
<img src="docs/screens/cep-library.gif" width="300" align="right" alt="The Agent library">

*Agent › Library* shows the **Styles** (a whole comp, role by role) and the **Techniques** (tracked labels, text behind
people, roto, speed ramps, HUD…) with a preview, what each one does and a ready order: **Use in chat** sends it to the
agent, **Copy order** takes it to Claude Code. Layers that already move keep their animation.

<br clear="right">

### A brand learns from every review
<img src="docs/screens/cep-brand-learns.gif" width="300" align="right" alt="A review note becomes a brand rule">

Tell the agent what to fix ("the car bounces, make it glide"): it fixes it and proposes the note as a **rule**. One
click keeps it in the **brand**, the **project** (only this video) or the **general** rules. *Brands › Rules* lists them
to add, edit or remove. From then on every order for that brand starts from them, in the panel and in Claude Code.

<br clear="right">

### Share a brand, and know where it lives
<img src="docs/screens/cep-brand-share.gif" width="300" align="right" alt="Where the brand lives and how to share it">

*Brands › brand › Overview* says **where it lives** (its folder, with *Open folder*). **Download to share** writes one
file (`<brand>.motiondna-brand.json`); the other person presses **Import brand file**, and if they already have the
brand, new, edited and removed rules merge into theirs and show as *new*. Client brands never go in this repo (only
templates do); conversations stay on each computer.

<br clear="right">

### One conversation per brand and per video
<img src="docs/screens/cep-workspace.gif" width="300" align="right" alt="Brand conversation and projects">

A brand has its own folder and its own Claude conversation for everything about it (*Brands › Claude › Start in Claude
app* puts it in the Claude app's sidebar). Each video is a **project** inside the brand folder (*Agent › Project*:
brief, references, footage, audio, AE, renders, exports), with its own conversation and rules. Continue any of them
from the panel, the Claude app or a terminal (*Copy terminal command*, or `>_` in the chat); the panel warns if it is
open somewhere else.

<br clear="right">

### Claude Code and other agents
Open the repo (or a brand or project folder) in Claude Code and approve the `motion-dna` server. Its tools:

| To… | Tools |
|---|---|
| Browse | `list_presets` · `list_packs` · `list_tags` · `suggest_mix` · `match_reference` · `list_brands` · `get_brand` |
| Act in After Effects | `apply_preset` · `apply_pack` · `apply_brand` (`existing` = modify / replace) · `apply_transition` · `add_asset` · `remove_animation` |
| Run techniques | `matte` (a cut-out on the local GPU) · `text_behind` |
| Learn and check | `add_brand_note` · `ae_status` · `list_layers` · `render_frame` · `check_layout` |

The order of work and recipes that worked: [User guide › For Claude](docs/USER_GUIDE.md#for-claude). Without MCP, any
LLM reads `library/INDEX.txt` and runs `.jsx` jobs with `bash tools/bridge.sh`.

## Tested on real work

Every tool was run on a small, realistic piece from five industries, with fictional brands. Each case says which part of
Motion DNA it tests, shows the result, and leaves a tip. What broke and how it was fixed:
[docs/use-cases](docs/use-cases/README.md). The manual built from it: [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

| Case | Tests | Result | Tip |
|---|---|---|---|
| **UC01** · Fashion | Behaviors › Moves · Create | <img src="docs/use-cases/img/uc01.jpg" width="360" alt="UC01"> | Select the layers in reading order: the stagger follows it. |
| **UC02** · Eyewear | Behaviors › Modify / Replace | <img src="docs/use-cases/img/uc02.jpg" width="360" alt="UC02"> | A client file that already moves: Modify keeps its poses. |
| **UC03** · Beauty | Behaviors › Text | <img src="docs/use-cases/img/uc03.jpg" width="360" alt="UC03"> | Put text where the texture is calm, or on a card. |
| **UC04** · Kitchen | Behaviors › Loops and Transitions | <img src="docs/use-cases/img/uc04.jpg" width="360" alt="UC04"> | Select both layers and press Transition: the cut is one move. |
| **UC05** · Cars | Curves | <img src="docs/use-cases/img/uc05.jpg" width="360" alt="UC05"> | "Smoother, more premium" = same keys, S curve or Coast. |
| **UC06** · Beauty | Brands | <img src="docs/use-cases/img/uc06.jpg" width="360" alt="UC06"> | Write rules anyone could follow; share the brand as one file. |
| **UC06b** · Beauty | Agent › Chat: a review note becomes a rule | <img src="docs/use-cases/img/uc06b.jpg" width="360" alt="UC06b"> | Keep each rule where it belongs: brand, project or general. |
| **UC07** · Fashion | Agent › Library › Styles | <img src="docs/use-cases/img/uc07.jpg" width="360" alt="UC07"> | No layers selected means the whole comp. |
| **UC08** · Fashion | Agent › Library › Techniques (text behind) | <img src="docs/use-cases/img/uc08.jpg" width="360" alt="UC08"> | Cut-outs with `matte` / `text_behind`; watch the contrast. |
| **UC09** · Cars | Agent (Full): Figma → After Effects, brand timing | <img src="docs/use-cases/img/uc09.jpg" width="360" alt="UC09"> | Put numbers in the brand's timing: `apply_brand` follows them. |
| **UC10** · All | Agent › Project | <img src="docs/use-cases/img/uc10.jpg" width="360" alt="UC10"> | Keep the `.aep` in the project's `05_ae`. |
| **UC11** · All | Claude Code (MCP) + layout QA | <img src="docs/use-cases/img/uc11.jpg" width="360" alt="UC11"> | Before calling it done: `render_frame`, then `check_layout`. |

## The library

| Moves | Classics | Text | Loops | Recipes | Styles | Techniques | Curves |
|---|---|---|---|---|---|---|---|
| 32 | 17 | 11 | 11 | 9 | 9 | 11 | 14 + 6 durations |

![Every preset with its energy range and tones](docs/examples/library-mosaic.gif)

Full catalog with live thumbnails: **[docs/CATALOG.md](docs/CATALOG.md)** · filterable: `library/index.html` · for LLMs:
`library/INDEX.txt` · tags: `library/tags.json`. All timing comes from the motion tokens: presets ask for `Arrive` +
`Land`, never a raw speed, so the whole library retunes in one place.

### Built on research: the Motion Style Map, by Gian Orsi

![Motion Style Map: reference films placed by measured energy and scored tone](docs/screens/style-map.png)

Gian measured **20 reference films** (brand films, launches, explainers, reels) frame by frame and by ear: cuts, share of
time in motion, speed, colour, fitted Bézier curves for every move, and the music (BPM, pulse clarity, cuts on the beat
vs chance, shot length in beats). Each film sits on a map of **measured energy × scored tone**, and every film is broken
into **209 behaviors** named in Motion DNA's own terms (146 map to a preset, 47 are camera, edit or acting craft, 16 were
open gaps). What the library was missing became new pieces:

- **Curves:** `Coast`, `Nudge`, `Wind-up`, `Snap`.
- **Presets measured on real work:** Coast Rise, Wind-up Slide, Nudge Grow, Snap Scale, Iris Reveal, Wordmark Reveal,
  Push Through, Color Wipe, Chars Blur, Boil, On Twos.
- **Styles:** *Editorial*, *Storybook*, *Collage*.
- **How music shapes the edit:** shot length in beats separates styles better than BPM; key moments (logo, reveal) land on
  musical events; the logo pattern "mark first, wordmark slides out from behind it".

Explore it: [the map](research/style_map/style_map.html) · [taxonomy](research/style_map/taxonomy.md) ·
[behaviors and mapping](research/ontology/) · [family syntheses, music & edit, cross-family patterns](research/styles/) ·
pipeline in `tools/style_research/`.

## How it works

| | What it is | Where |
|---|---|---|
| **Research** | 20 reference films measured frame by frame (Motion Style Map, by Gian Orsi) and brand analyses | `research/`, `library/references/` |
| **Library** | 80 moves, 14 curves, 9 styles, 11 techniques, tagged by role, energy 1–5 and tone | `library/`, `tokens/`, `tools/ss_presets.jsx` |
| **Brands** | Rules, curves and timing learned in every review; on your computer, shared as a file | `library/brands.local/` or your folder |
| **Who drives it** | A designer in the panel, or Claude through the MCP server `motion-dna` | `panel/`, `tools/mcp/` |
| **Output** | Native After Effects keyframes, checked by the layout QA and the tests | `tools/check_layout.jsx`, `tools/test_all.py` |

It is a loop: whatever a reference needs and the library lacks becomes a new move, curve or style (CONTRIBUTING §8),
and every review note becomes a brand rule.

## Made with it

Renders from the test suite (`python tools/test_all.py`): the same layout in every style, moves mixed by tags, and one
move through the panel's controls.

| Tested: styles on one layout | Mix by tags | One move, the panel's controls |
|---|---|---|
| ![Styles](docs/examples/test-styles.gif) | ![Mix](docs/examples/test-mix.gif) | ![Controls](docs/examples/test-controls.gif) |

<details>
<summary>Earlier technique tests: The 1974 Cypher, The 1974 Boardroom and the first experiments</summary>

**The 1974 Cypher** (32 s, speed-ramp test): orbital moves speed-ramped on the beat with the `Ramp` curve, tracked labels
on every detail, and a likeness QA. [`docs/examples/cypher_1974.mp4`](docs/examples/cypher_1974.mp4) ·
[step by step](docs/case-studies/the-1974-cypher.md).

| Ramp on the sneakers | Wide orbit + title | Tracked details |
|---|---|---|
| ![Sneakers](docs/examples/cypher-sneakers.gif) | ![Wide](docs/examples/cypher-wide.gif) | ![Details](docs/examples/cypher-details.gif) |

**The 1974 Boardroom** (45 s): consistent AI shots, OpenCV tracking, AI roto, organic contours, face scans, titles behind
the people, a holographic HUD, freeze frames with kinetic type, a 70s announcer VO and a roto breakdown.
[`docs/examples/whisky_1974_boardroom.mp4`](docs/examples/whisky_1974_boardroom.mp4) ·
[step by step](docs/case-studies/the-1974-boardroom.md).

| "Zero keyframes." | "Tracked." | "Rotoscoped." |
|---|---|---|
| ![Zero keyframes](docs/examples/reel-freeze-keyframes.gif) | ![Tracked](docs/examples/reel-freeze-tracked.gif) | ![Rotoscoped](docs/examples/reel-freeze-rotoscoped.gif) |

| A Figma slide, animated | A draw-on intro | Text tracking on video | HUD on tracked points |
|---|---|---|---|
| ![Figma slide](docs/examples/use-figma-slide.gif) | ![Draw-on](docs/examples/use-icon-intro.gif) | ![Text tracking](docs/examples/text-tracking.gif) | ![HUD](docs/examples/hud-test.gif) |

People in these earlier showcases are the project collaborators (Aaron Amortegui and Gian Orsi), who agreed to be test
subjects; every clip went through the face refinement pass. Prices, bottlings and roles are fictional.
</details>

## For contributors

- [`docs/CATALOG.md`](docs/CATALOG.md): every preset and style with its thumbnail.
- [`docs/TOOLS.md`](docs/TOOLS.md): every script, what it does and how to run it.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): adding presets, open-source effects, styles, references, case studies; the layout and edit rules (§9).
- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) and [`docs/use-cases/`](docs/use-cases/README.md): the manual and the tests behind it.
- [`docs/LEARNINGS.md`](docs/LEARNINGS.md): every pitfall already solved (driving AE from an LLM, ExtendScript, rendering, AI footage, tracking and roto, typography, audio, costs).
- [`CLAUDE.md`](CLAUDE.md): the rules every Claude follows in this repo.

### Rules that keep the work clean

Lessons from real reviews, checked automatically on the built comps by `tools/check_layout.jsx`: no text on text or cards
touching, nothing outside the safe area (labels stack into up to 3 lines instead), at least 32 px, contrast or a card,
nothing on a face, no substituted fonts. Edit rules: never cut a phrase, trim AI shots to their action, music leads the
key moments. All of them: [CONTRIBUTING §9](CONTRIBUTING.md#9-layout-and-edit-rules-every-video-every-comp).

## Credits and requirements

Built by **Aaron Amortegui** and **Gian Orsi** (Motion Style Map research), with Claude. Classics adapt
[animate.css](https://animate.style) **4.1.1** (MIT, © 2020 Daniel Eden) into native keyframes; later releases changed
license and are not used. Fonts: Inter Tight and Instrument Serif (SIL OFL). Animation Composer is used only as a
behavioral reference: its presets are never decrypted, modified or redistributed, and its asset packs are indexed
locally, never committed.

**Requirements:** Windows or macOS · After Effects 2025/2026 · Python 3 (`numpy`, `opencv-python`, `scipy`, `Pillow`) ·
`ffmpeg` · Git LFS · a bash shell (Git Bash on Windows). Clone anywhere: scripts find the repo root on their own.
Platform details and overrides (`SS_AFTERFX`, `SS_AE_APP`, `SS_AERENDER`, `SS_ASSET_PACKS`): [docs/TOOLS.md](docs/TOOLS.md)
and [docs/LEARNINGS.md](docs/LEARNINGS.md).
