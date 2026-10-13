# Work plan · October 2026

From the Gian / Aaron sync of Oct 13 (after commit aba397c, the CEP panel). Split: **Aaron takes the plugin now**,
**Gian takes the teaser script**; the video starts once the panel looks finished, because the video shows its UI.
Priority: the panel should look good, not perfect (it is not a public launch). Status as of Oct 13.

## Panel (UI)
| # | From the meeting | Status |
|---|---|---|
| 1.0 | Install without asking people to change Adobe settings | **Done.** `setup.py` signs the panel (self-signed .zxp) and installs it: loads with no developer mode. `--dev` links the clone and asks before turning developer mode on |
| 1.1 | Styles and Techniques out of the bottom bar | **Done.** Bar: Behaviors · Curves · Brands · Agent |
| 1.2 | Styles and Techniques as a library inside the Agent, with previews, an explanation and ready orders; no Apply or controls on styles | **Done.** *Agent › Library*: preview, what it does, **Use in chat** / **Copy order** |
| 1.3 | Technique thumbnails: a clean card with the title and what it does | **Done.** `tools/technique_cards.py` |
| 1.4 | Curves: the search goes down, and the editor starts at (1, 0, 0, 1) | **Done.** The search sits next to the library it filters; the editor opens on the S curve (1, 0, 0, 1) |
| 1.5 | A simple, clear way to connect Claude (and Figma) | **Done.** *Connect*: one button, three short steps, turns green by itself; Figma optional in three steps; commands only under "Having trouble?" |
| 1.6 | GIFs of the panel for the README | **Done.** One per section (`docs/screens/cep-behaviors/curves/brands/agent.gif`) and the tour (`cep-panel.gif`), from `tools/record_cep_panel.py` |
| 1.7 | Easy to find and stable after install | **Done.** *Window › Extensions › Motion DNA* (also *File › Scripts › Motion DNA*), no extra windows; a silent Startup script starts the Claude bridge with AE; the panel retries its start while AE is still loading |
| 1.8 | Layers that already move: modify their animation; layers with none: generate it | **Done** everywhere: Behaviors (*If a layer already moves: Modify it / Replace it*, with a line saying what Apply will do), Curves and brand timings (no keys selected → the selected layers), Styles and brands, the MCP (`existing`) and the Agent's orders |

## Brands
| # | From the meeting | Status |
|---|---|---|
| 2.1 | Client brands never public; Motion DNA stays as the base | **Done.** Only templates in `library/brands/` (git-ignored otherwise); brands live in `library/brands.local/` or a folder you choose |
| 2.2 | Share a brand when two people work on it | **Done.** Export / Import (panel and `brand.py`): new, edited and removed rules merge; the ones that came in show as new |
| 2.3 | Feedback becomes rules while you work | **Done.** The Agent returns each note as a proposal: keep it in the brand, the project or the general rules |
| 2.4 | See and manage the rules | **Done.** Rules: add, edit, remove (a removal travels when shared) |

## Agent, projects and the Claude conversation
| # | From the meeting | Status |
|---|---|---|
| 3.1 | New project: choose the folder, create the usual subfolders, save the AE project there | **Done.** *Agent › Project* (`motion-dna.project.json`, `CLAUDE.md`, `.mcp.json`) |
| 3.2 | One conversation per project, the same one from the panel or from Claude | **Done.** The project keeps its conversation: **Open in Claude app** (`claude --desktop --resume`), **Copy resume command**, or pick one started in that folder |
| 3.3 | Sign in to Claude from the plugin | **Done.** *Connect Claude*. An expired sign-in is detected and sends you there |
| 3.4 | What does a video cost in tokens? | **Partly.** Each order shows its estimated cost and tokens, logged to `claude/usage.csv`. Still to do: the same order with and without Motion DNA, to measure the saving |

## Library and content
| # | From the meeting | Status |
|---|---|---|
| 4.1 | 80 moves (79 at the meeting) | **Done.** Glide In (a long glide that settles, no bounce, on Coast): 80 presets |
| 4.2 | References library: a video from the internet becomes a preview the agent can recall | Later |
| 4.3 | Flora from the Agent | Later |
| 4.4 | A car to show the techniques (clients: cars, eyewear, fashion) | **Started.** Car test case: 4K stills, transparent cutouts, three Figma frames, the Vela test brand and a test project. Still to do: a short car clip for roto and tracking |
| 4.5 | Matte refiner / auto-retouch in the Agent | Future (the segmenters are not in Flora) |
| 4.6 | Techniques as MCP tools (one call instead of improvised scripts) | Proposed: next |

## Teaser video
- Script v8 (Gian): pillars **MOVES · BRANDS · AGENTIC**; the panel UI floats on screen with a cursor; Rex drops a brand
  guidelines binder; an 80s robot carrying coffee ("Make it pop"); proposal: the robot proposes, Dana corrects.
- **Done: production components in 4K** (Figma "Motion DNA · production components (4K)"): office, conference room and TV
  studio with a floor plan; Dana, Marcus, Rex and the robot (turnarounds and expressions); props; graphics as components.
- Fixes from Gian's review, now covered by the components: floppy at true scale, one desk layout (floor plan), the
  computer with the screen off for clean replacement, the box with the exact logo. Still for the edit: no tracking labels
  in the opening, texts long enough to read, calmer surroundings.
- Next: storyboard v8 in Figma from these components → keyframes → clips → AE.

## Decisions pending
- Repo public or private (brands stay local either way).
