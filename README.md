# Motion DNA

Motion made with AI all looks the same: same curves, same moves, same templates. **Motion DNA** gives it an identity.
It is a library of moves, curves, techniques and styles for After Effects, built on measured references, that a
designer applies from a panel or **Claude drives directly inside After Effects** (MCP). Every brand you animate keeps
its own profile that learns from each review. Everything it makes is native keyframes and expressions: nothing extra to render.

![Motion DNA promo: a 1985 infomercial parody made with the library](docs/examples/dna-promo.gif)

*From [the Motion DNA promo](#showcases): tracking, roto, a backlight glow and a freeze title, all built by Claude with the library.*

## How it works

```mermaid
flowchart LR
  subgraph K["Knowledge · lives in the repo"]
    MSM["<b>Motion Style Map</b><br/>20 reference films measured<br/>research by Gian Orsi"]
    REF["Reference profiles<br/>library/references"]
    LIB["<b>Library</b><br/>79 presets · 14 curves · 9 styles · 11 techniques<br/>all tagged: role · energy 1–5 · tone"]
    BR["<b>Brand profiles</b><br/>library/brands<br/>rules learned in every review"]
    RU["Layout &amp; edit rules<br/>CONTRIBUTING §9 · LEARNINGS"]
    MSM --> LIB
    REF --> LIB
  end
  subgraph D["Who drives it"]
    P["Designer<br/>Motion DNA panel"]
    C["Claude / any LLM<br/>MCP server motion-dna"]
  end
  LIB --> P
  LIB --> C
  BR --> P
  BR --> C
  RU --> C
  P --> AE["After Effects<br/>native keyframes"]
  C -- "file bridge" --> AE
  AE --> QA["Check<br/>check_layout · test_all · render_frame"]
  QA -- "review notes" --> BR
  QA -- "gaps → new moves" --> LIB
```

1. **The library** is the vocabulary: moves, token curves (`tokens/`), styles and script techniques, all tagged so they
   can be recombined by feel.
2. **Research feeds it**: reference films and brand analyses are measured and matched against the library; whatever is
   missing is created, tagged and rendered (CONTRIBUTING §8).
3. **Brand profiles remember**: each brand keeps its base style, curve, palette, fonts and the rules learned in its reviews.
4. **Two ways to drive it**: the panel in After Effects, or Claude through the MCP server and a file bridge.
5. **Every piece is checked and feeds back**: the layout QA and the tests catch problems; review notes become brand
   rules, and new needs become new presets.

## What's inside

| Moves | Classics | Text | Loops | Recipes | Styles | Techniques | Curves |
|---|---|---|---|---|---|---|---|
| 31 | 17 | 11 | 11 | 9 | 9 | 11 | 14 + 6 durations |

![Every preset with its energy range and tones](docs/examples/library-mosaic.gif)

Full catalog with live thumbnails: **[docs/CATALOG.md](docs/CATALOG.md)** · filterable: `library/index.html` · for LLMs:
`library/INDEX.txt` · tags: `library/tags.json`. All timing comes from the motion tokens: presets ask for `Arrive` +
`Land`, never a raw speed, so the whole library retunes in one place.

## Motion Style Map · research by Gian Orsi

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
  musical events; the logo pattern "mark first, wordmark slides out from behind it". The Motion DNA promo uses all three.

Explore it: [the map](research/style_map/style_map.html) · [taxonomy](research/style_map/taxonomy.md) ·
[behaviors and mapping](research/ontology/) · [family syntheses, music & edit, cross-family patterns](research/styles/) ·
pipeline in `tools/style_research/`.

## Brand profiles: styles that learn

Every time you animate for a brand and give notes ("labels go into the negative space", "a soft glow, not rays",
"never cut a phrase"), the note is saved as a **rule** in that brand's profile, with why, the project and who said it.
The next piece for that brand, by Claude, another agent or a designer, starts with everything already learned. Brands
are independent: each one refines its own style.

**How a brand learns**

```mermaid
flowchart LR
    N["Review note<br/>'the car never bounces'"] --> A["Agent applies it<br/>and proposes a rule"]
    A -->|"you pick: brand ·<br/>project · general"| R["brand.json<br/>rules · curves · timing"]
    R --> C["Next order, next video<br/>Claude reads the brand first"]
    C --> N
    R -->|"Download to share<br/>(one file)"| F["vela.motiondna-brand.json"]
    F -->|"Import brand file"| T["A teammate's copy:<br/>new, edited and removed<br/>rules merge, shown as new"]
```

1. **Create** a brand (empty or from a template) in its own folder, never in the repo. It gets its own `CLAUDE.md`
   and its own Claude conversation for everything about that brand; each video of the brand is a project inside it.
2. **Work and review.** Every note you give the agent comes back as a rule proposal; one click keeps it in the brand,
   the project or the general rules. Rules can be edited or removed at any time (*Brands › Rules*).
3. **Capture what works**: curves and timing benchmarks from your own keyframes (*Capture from selection*).
4. **Share**: *Download to share* writes one file; the other person imports it and the rules merge (each rule has an
   id, so an edit or a removal travels too). What the brand learned travels; the conversations stay on each computer.

```text
<brand folder>/brand.json   identity (colours, fonts, logo) · feel (energy, tones, base style, curve)
                            motion spec: the brand's own curves (bezier) and timing benchmarks
                            (frames, ms or %) · preferred / avoided presets · rules · projects
<brand folder>/thumb.png    its card in the panel
```

**Client brands never go in the repo.** Only templates live in `library/brands/` (e.g. Motion DNA). Your brands stay on
your computer, in the plugin folder (`library/brands.local/`, git-ignored) or in any folder you choose. To work on the
same brand with someone, **Export** it to one file and they **Import** it: new, edited and removed rules merge into
their copy (nothing is overwritten blindly) and the ones that came in show as *new*.

**One conversation per brand, and one per video.** A brand has its own folder (with `CLAUDE.md`, so Claude knows the
brand there) and its own Claude Code conversation for everything about it; each video of the brand is a project inside
`<brand>/projects/` with its own. Both are the same conversation in the panel's Agent and in the Claude app (**Start /
Open in Claude app** puts it in the app's sidebar) or a terminal. Conversations stay on each computer; what a brand
learned travels in its file.

- **Panel:** *Brands* is a workspace per client: **+ New brand** (start empty or from a template, in the plugin folder
  or a folder you choose), **Import brand file**, then a kit whose *Overview* says **where it lives** (its folder and
  what each file is) and how to **share it** (**Download to share** writes the one file to send), then style, curve, apply,
  *Motion* (brand curves with Apply/Edit, timing benchmarks shown in frames at the comp's frame rate with Apply that
  retimes and eases the selected keyframes, **Capture from selection**, and **Apply to everything** to re-ease a whole
  comp), *Rules* (add, edit, remove) and *Claude* (the brand's conversation and its videos). **Activate** makes it the brand of the current After Effects project: a chip in the
  header opens it from any section and its curves come first in *Curves*.
- **Claude (MCP):** `get_brand` before animating, `add_brand_note` for every review note, `apply_brand`, `list_brands`.
- **Terminal:** `python tools/brand.py new acme --name "Acme" --style Modern --curve Coast`,
  `python tools/brand.py note acme "Logos never bounce" --cat motion --why "..."`, `python tools/brand.py show acme`,
  `python tools/brand.py export acme` / `import acme.motiondna-brand.json`.

Example: [`library/brands/motion-dna`](library/brands/motion-dna/brand.json), the 22 rules learned while making our
own promo. Schema: [`library/brands/_schema.md`](library/brands/_schema.md).

## Rules that keep the work clean

Lessons from real reviews, checked automatically on the built comps by `tools/check_layout.jsx`: no text on text or cards
touching, nothing outside the safe area (labels stack into up to 3 lines instead), at least 32 px, contrast or a card,
nothing on a face, no substituted fonts. Edit rules: never cut a phrase, trim AI shots to their action, music leads the
key moments. All of them: [CONTRIBUTING §9](CONTRIBUTING.md#9-layout-and-edit-rules-every-video-every-comp).

## Get started

**Install** (Windows or macOS): double-click `INSTALL-Windows.cmd` / `INSTALL-macOS.command`, or run `python tools/setup.py`
(Claude does it when you ask it to install Motion DNA). It installs the panel, the fonts and the local asset previews,
and checks everything. Then restart After Effects, open **Window › Extensions › Motion DNA** (also *File › Scripts ›
Motion DNA*) and dock it once: it comes back every time After Effects opens, and the Claude bridge starts with After
Effects by itself (a silent Startup script). Tick
*Preferences › Scripting & Expressions › Allow Scripts to Write Files and Access Network*.

The panel is a **CEP extension** (`panel/`, HTML). `setup.py` signs it on your machine (a self-signed certificate made
with Adobe's ZXPSignCmd, downloaded once into `tools/.cache/`) and installs the signed copy, so After Effects loads it
with **no developer mode**; `--update` signs it again. Developers can run `python tools/setup.py --dev` instead: the
panel then runs straight from the clone (edits show with **F5**), which needs Adobe's developer mode; setup asks before
turning it on, and only you can say yes. The previous ScriptUI panel (`tools/ss_panel.jsx`, opened by *File › Scripts › Motion DNA* when the HTML panel is missing)
is still installed as a fallback.
**Update:** `python tools/setup.py --update` (never pulls over local changes) · **remove:** `--uninstall`.

<img src="docs/screens/cep-panel.gif" width="320" align="right" alt="Motion DNA panel: Behaviors, Curves, Brands, Agent">

| Behaviors | Curves | Brands | Agent |
|---|---|---|---|
| ![Behaviors](docs/screens/cep-behaviors.gif) | ![Curves](docs/screens/cep-curves.gif) | ![Brands](docs/screens/cep-brands.gif) | ![Agent](docs/screens/cep-agent.gif) |

**Designers.** The header shows the connections (**MCP** · **Claude** · **Figma**); the bottom bar has four sections:
- **Behaviors:** choose a type (Moves, Classics, Text, Loops, Transitions, Recipes, Favorites), pick a preset in the
  gallery (hover a thumbnail to see it move, energy tabs from Calm to Explosive), tune *Duration*, *Intensity*,
  *Direction* and *Easing* in *Controls*, choose **In / Out / Both** and **Apply**; **Remove** cleans it off. The button
  says what it will do: **Create** when the selected layers have no keyframes; when a layer already has keyframes,
  *The layer already has keyframes: **Modify** | **Replace*** appears: Modify (the default) keeps its values and gives
  them the preset's curve and the *Duration* factor, Replace deletes them and creates the preset. With
  *Marker timing*, drag the `SS in` / `SS out` markers to retime.
- **Curves:** a square curve editor (drag the handles or type `x1, y1, x2, y2`), the token library, **Apply to keyframes**
  (every selected pair, linear stays linear; with no keyframes selected, every keyframe of the selected layers, and a
  Fade Up on this curve for a layer with no animation), **Read keys**, **Reverse**, and **Save curve** into
  `tokens/superside_motion_tokens.json` (only curves saved from the panel can be deleted).
- **Brands** (above).
- **Agent:** type an order and Claude does it in After Effects for you (e.g. *take these Figma frames, import their
  assets and animate them in the Editorial style*). The panel runs Claude Code in the background with the context of
  the open comp, the selection, the active brand and the project; steps, the answer and an estimate of what the order
  cost stream back, **Stop** cancels. *Safe* mode uses only the Motion DNA tools; *Full* adds Figma and files and
  scripts (never git commit or push). Three tabs:
  - **Chat.** Review notes come back as rule proposals: keep each one in the brand, the project or the general rules
    (CONTRIBUTING §9) with one click, or dismiss it.
  - **Library:** the **Styles** and **Techniques**, each with a preview, what it does and a ready order: **Use in chat**
    or **Copy order** (for Claude Code). They are guides the agent applies to comps.
  - **Project:** a folder per piece (brief, references, footage, audio, AE, renders, exports) with its brand, its own
    rules, a `CLAUDE.md` and `.mcp.json` (so Claude Code opened in that folder knows Motion DNA) and **one
    conversation** that you continue from the panel, the Claude app (**Open in Claude app**) or a terminal
    (**Copy resume command**); a conversation started elsewhere in that folder can be picked as the project's.
  One-time setup in *Agent › Connect*: **Connect Claude** (one sign-in) and, optionally, **Connect Figma** (one click:
  Figma's permission page opens in the browser, press Allow; it turns green by itself). *Safe* orders load only the
  Motion DNA server.

**Claude (MCP).** Open the repo in Claude Code and approve the `motion-dna` server (`.mcp.json`). Claude gets:
browse (`list_presets`, `list_packs`, `list_tags`, `suggest_mix`, `match_reference`, `list_assets`, `list_brands`,
`get_brand`), act in After Effects (`apply_preset`, `apply_pack`, `apply_brand`, `add_asset`, `remove_animation`,
`show_in_panel`), learn (`add_brand_note`), check (`ae_status`, `list_layers`, `render_frame`, `render_comp`) and
`run_jsx`. Without MCP, any LLM reads `library/INDEX.txt` and runs `.jsx` jobs with `bash tools/bridge.sh`.
Contributors and their agents: read [`CLAUDE.md`](CLAUDE.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md).

<br clear="right">

## Showcases

### *Motion DNA · promo* (45 s, 1985 infomercial parody)

Two bored designers in 1985 complain that Claude makes the same animation every time; a salesman bursts in with Motion
DNA. Characters, location and props were designed as sheets first and every shot was generated with them as references
(Nano Banana 2.1 + Seedance 2.5, USD 15.50). The edit was built entirely by Claude with the library: 2D tracked callouts,
a planar-tracked "1985" on the wall, roto (local InSPyReNet mattes), a backlight glow, action lines, a freeze with the
person in colour, a retro app inside a curved CRT, words landing on the voice, music-led timing from the Style Map, and
the layout QA at 0 warnings. Video: [`media/motion_dna_promo/motion_dna_promo.mp4`](media/motion_dna_promo/motion_dna_promo.mp4) ·
story, shot list and costs: [`media/motion_dna_promo/story.md`](media/motion_dna_promo/story.md) · storyboard:
[Figma Slides](https://www.figma.com/slides/z2BSXVNVFhjYOlbBI1ZUy6).

| Tested: styles on one layout | Mix by tags | One move, the panel's controls |
|---|---|---|
| ![Styles](docs/examples/test-styles.gif) | ![Mix](docs/examples/test-mix.gif) | ![Controls](docs/examples/test-controls.gif) |

<details>
<summary>Earlier showcases: the explainer, The 1974 Cypher, The 1974 Boardroom and the first tests</summary>

**Motion DNA · internal explainer** (68 s): how the library was built and how to use it, animated with the library
itself. [`docs/examples/ss_motion_explainer.mp4`](docs/examples/ss_motion_explainer.mp4) ·
[step by step](docs/case-studies/ss-motion-explainer.md). The promotional cut (67 s):
[`docs/examples/ss_motion_promo.mp4`](docs/examples/ss_motion_promo.mp4) · [step by step](docs/case-studies/ss-motion-promo.md).

| Our own curves | The plugin | Claude drives it |
|---|---|---|
| ![Curves](docs/examples/explainer-curves.gif) | ![Plugin](docs/examples/explainer-plugin.gif) | ![Claude](docs/examples/explainer-claude.gif) |

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

## Documentation

- [`docs/CATALOG.md`](docs/CATALOG.md): every preset and style with its thumbnail.
- [`docs/TOOLS.md`](docs/TOOLS.md): every script, what it does and how to run it.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): adding presets, open-source effects, styles, references, case studies; the layout and edit rules (§9).
- [`docs/LEARNINGS.md`](docs/LEARNINGS.md): every pitfall already solved (driving AE from an LLM, ExtendScript, rendering, AI footage, tracking and roto, typography, audio, costs).
- [`CLAUDE.md`](CLAUDE.md): the rules every Claude follows in this repo.

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
