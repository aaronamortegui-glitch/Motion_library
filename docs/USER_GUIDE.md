# Motion DNA · User guide

How to use every part of Motion DNA, with tips from real tests. Read it as a designer in After Effects, or as Claude
driving After Effects through the MCP server: [For Claude](#for-claude) is the agent's version.

Every instruction here was checked on the use cases in [docs/use-cases](use-cases/README.md): fashion, eyewear,
beauty, kitchen and cars.

**Contents:**
[Install](#install) ·
[The panel](#the-panel) ·
[Behaviors](#behaviors-animate-layers) ·
[Curves](#curves-change-the-feel) ·
[Brands](#brands-a-style-that-learns) ·
[Agent](#agent-ask-claude) ·
[Techniques](#techniques-workflows-beyond-one-preset) ·
[Projects](#projects-one-folder-and-one-conversation-per-piece) ·
[For Claude](#for-claude) ·
[Tips by industry](#tips-by-industry) ·
[Troubleshooting](#troubleshooting)

---

## Install
1. Clone the repo, then run `python tools/setup.py`. To update later, run `python tools/setup.py --update`.
2. In After Effects, tick *Edit › Preferences › Scripting & Expressions › Allow Scripts to Write Files and Access
   Network*.
3. Restart After Effects and open **Window › Extensions › Motion DNA**. You can also use *File › Scripts › Motion DNA*.
   Dock it next to Effects & Presets: it then comes back every time After Effects starts.
4. Go to **Agent › Connect** and sign in to Claude once. Figma comes from the connectors of your Claude account.

> **Tip:** after `git pull`, close and reopen the panel to see the new version. You don't need to reinstall: the panel
> loads its code from your clone. Only changes to `panel/index.html` or the manifest need `setup.py --update`.

## The panel
The header shows three status dots:
- **MCP:** the bridge Claude uses to drive After Effects.
- **Claude:** whether you are signed in.
- **Figma:** whether Claude can reach your Figma files.

Green means ready. Click a dot to fix it. In a narrow dock only the dots show; hover a dot to see its name.

The four tabs at the bottom:

| Tab | What it is for |
|---|---|
| **Behaviors** | 80 moves, text animations, loops, transitions and recipes. Hover a card to watch it move. |
| **Curves** | The easing library and an editor, for the keys or layers you select. |
| **Brands** | Each client's motion guidelines: style, curves, timing and the rules learned in reviews. |
| **Agent** | Ask Claude in plain words. Its Library holds the Styles and Techniques; Project holds the folder and the conversation. |

## Behaviors: animate layers
1. Choose a type: Moves, Classics, Text, Loops, Transitions, Recipes or ★ Favorites.
2. Pick a preset. You can filter by energy, from 1 calm to 5 explosive, or search by name.
3. Set the controls if you want: *Duration · Intensity · Direction · Easing*. Choose **In**, **Out** or **Both**.
4. Press the main button. It tells you what it will do:

| Button | When it shows | What happens |
|---|---|---|
| **Create** | The layers have no keyframes | The preset is built. |
| **Modify** | The layers already move, and *Modify* is chosen | Your keyframe values stay. They get the preset's timing and curve. |
| **Replace** | The layers already move, and *Replace* is chosen | The preset replaces only the channels it animates. A rotation or a text animator it does not use stays. |
| **Transition** | Two layers are selected in *Transitions* | The first layer you selected leaves while the second arrives, from the playhead. |

**Remove** takes off what Motion DNA added: keys, our expressions, markers and our effects. Values stay at rest.

> **Tips**
> - **Select in reading order.** The stagger follows the order you click the layers: title, then subtitle, then the call
>   to action.
> - **A client file that already moves:** use **Modify** to keep the client's poses and give them your feel. Use
>   Replace only when the move itself is wrong.
> - **A text preset over a move combines with it.** The move animates the layer and the text preset animates the
>   letters (UC01).
> - **Marker timing:** with it on, the layer gets *SS in / SS out* markers. Drag them to retime without touching keys.
> - **Loops** (Float, Pulse…) add on top of any move. Put them on the product, not on the text.
> - **Text never touches the product or the person.** If a title would, break it into two lines and play with sizes
>   (a small lead line over a big key line) instead of shrinking it or letting it overlap (CONTRIBUTING §9, rule 15).
> - **Parent a button's label to the button.** Styles then move and fade them together.

## Curves: change the feel
1. Select keyframes, or select layers to change every key on them.
2. Pick a curve: the **S curve (1, 0, 0, 1)** is the default, or a token such as Land, Coast, Settle or Surge, or drag
   the handles and type values.
3. Press **Apply**. The keyframe values never change; only the speed between them does.

> **Tips**
> - **"Make it smoother and more premium"** usually means: same keys, S curve or Coast, and a little more duration
>   (UC05).
> - **Curves change speed, not path.** To change how far things travel, use a preset's *Intensity*.
> - **Save a client's curve in their brand** (Brands › Motion): every later move for that brand uses it.

## Brands: a style that learns
A brand holds:
- **Identity:** colours, fonts and logo.
- **Feel:** energy range, tones, base style and main curve.
- **Motion:** its own curves, and timing such as "Title in 20 frames".
- **Rules:** learned in reviews.

**Create one:** Brands › **+ New brand**.
- Give it a name. You can start from a template or empty.
- Choose where it lives:
  - *Plugin folder:* on this computer, never in git.
  - *Choose folder…:* a client or Drive folder.
- The folder also becomes a Claude folder, with its own `CLAUDE.md` and `.mcp.json`.

**Use it:** activate it in Brands (it then shows as a chip in the header). *Apply brand* animates the comp in the base style, then retimes
each layer named in the brand's timing, on the brand's own curve.

**Teach it:**
- Every review note becomes a rule: category, the rule itself, and why.
- In the Agent, Claude proposes `RULE:` lines, and you choose where to keep each one: **Brand**, **Project** or **General**.
- Edit or remove rules in Brands › Rules.

**Share it:**
- *Download to share* writes one file.
- The other person uses *Import an update*: new, edited and removed rules merge into theirs.
- Your local conversation ids are never exported.

> **Tips**
> - **Write rules anyone could follow without context.** "The car never bounces or overshoots: it glides in and
>   settles" beats "less bouncy".
> - **Put numbers in Motion › Timing**, e.g. "Car reveal 900 ms on Vela Glide". `apply_brand` follows them (UC09).
>   Overshoot rules still need a look at a frame.
> - **Client brands never go in the repo.** Only templates live in `library/brands/`.

**Watch a brand learn** (UC20): Oku Optics started on the wrong style. Note 1 (“calm and premium, no slams”) became a
rule and moved it to Calm Modern on Coast; note 2 (“the glasses glide in from the right, 900 ms, never pop”) became a
rule plus a curve and a timing entry, which `apply_brand` now applies by itself. The next piece starts from there.

## Agent: ask Claude
- **Safe** mode uses only the Motion DNA tools: apply, layers and frames.
- **Full** mode adds Figma, files and scripts. It never commits or pushes.

**Chat:**
- Type the order in the big field and press Ctrl+Enter.
- *With: Brand · Comp · Selection* chooses what goes with your order.
- **Try:** chips give ready orders. They show until your first order.

**What the agent always knows:**
- the repo's rules and the active brand;
- the open comp and what is selected. If nothing is selected, "the selected layers" means the whole comp.

**What it never does without asking:**
- save the After Effects project;
- spend money on generation;
- save rules on its own.

**Library:**
- **Styles:** whole-comp looks.
- **Techniques:** workflows. Text behind people, tracked labels, speed ramps, shape wipes…
- *Use in chat* puts a ready order in the field, so you can edit it before sending. It names the technique's tool.

**Costs:** each order's estimate appears when it ends and is logged in `<project>/claude/usage.csv`. Typical costs from
the tests:

| Order | Time | Cost |
|---|---|---|
| A style | ~40 s | ≈ USD 0.36 |
| A review note | ~50 s | ≈ USD 0.45 |
| A Figma frame rebuilt and animated | ~3 min | ≈ USD 2 |

> **Tips**
> - **Name the layers in your request** ("the Title, then the Car") and say the feel ("calm, premium"). Short, specific
>   orders cost less.
> - **For anything with a cut-out**, a person or a product, the agent uses `matte` on your GPU at no cost. Don't let
>   it improvise a roto.
> - **Say "Review vs brand"** before sending a piece out: it lists what breaks the brand's rules, without changing
>   anything.
> - **The `>_` button** copies the command that continues the same conversation in a terminal. *Open in Claude app*
>   continues it in the Claude app.

## Techniques: workflows beyond one preset
Each one was tested end to end (use cases UC12–UC19). The Agent knows the tool for each; by hand:

| Technique | How | Tip |
|---|---|---|
| **Tracked labels + HUD** | `python tools/track_points.py clip.mp4 tracks.json --regions regions.json`, then a scene spec for `tools/build_scene.jsx` (callout, chip, bracket, kicker) | Point callouts inward so the camera move cannot push them out; `"card": true` on light plates |
| **Speed ramp** | Behaviors › Moves › Speed Ramp on a footage layer | The ramp eats about 2.5× its length of footage: use a long enough plate |
| **Text behind a person or product** | MCP `text_behind` (still or video), or `matte` + a `behind` item in a scene spec | Pick a tone that contrasts with the wall, not the brand colour by default |
| **Roto breakdown** | `matte` → `tools/matte_contours.py` → `tools/build_breakdown.jsx` | Contours in ink on light plates, in spark on dark ones |
| **Freeze frame + kinetic type** | an edit spec for `tools/build_edit.jsx` with `freeze` (`mono`, matte, plate) and a `split` title | Split the title around the person, in the empty space; break the subtitle into lines |
| **Shape wipe** | a full-frame solid with Color Wipe in and out around the cut | Start the next scene under the wipe, a few frames before it opens |
| **Marker timing** | apply with *Marker timing*, then drag `SS in` / `SS out` | The fastest way to answer “land it a second later” |
| **Cut on the voice** | `python tools/vo_words.py vo.mp3 words.json`, cuts two frames before each phrase | Whisper can mishear brand names: check them before you cut on them |

## Projects: one folder and one conversation per piece
Agent › Project › **New project**:
- name it, pick where, and choose its brand;
- tick the folders: `01_brief` … `07_exports`, `claude`;
- optionally save the open After Effects project in it.

The project gets its own conversation. Continue it from the panel, the Claude app or a terminal. The project can also
keep rules of its own, next to the brand's.

> **Tip:** keep the `.aep` inside the project's `05_ae`. The agent then knows which file belongs to the piece and asks
> before building somewhere else.

## For Claude
When you drive After Effects for a person (MCP server `motion-dna`):

1. **Before animating:**
   - `ae_status`;
   - `get_brand <slug>` when a brand is active: follow its rules;
   - `list_layers`.
2. **Choose by tags:**
   - `list_tags` and `suggest_mix` for a move, curve and duration that fit the energy and tones;
   - `list_packs` for whole-comp styles.
3. **Act:**
   - `apply_preset` (`existing` = modify | replace, `marker_timing`, `duration`, `intensity`, `direction`, `ease`);
   - `apply_pack` and `apply_brand`, which applies the brand's own timing;
   - `apply_transition` for an outgoing and an incoming layer;
   - `add_asset`;
   - `matte` (still or video cut-out on the local GPU) and `text_behind` (text behind a subject, in one call);
   - `run_jsx` only for what no tool covers.
4. **Check before you call it done:**
   - `render_frame` at the key moments, and look at the PNG;
   - `check_layout` (overlaps, safe area, size, contrast). Fix each warning or say why it stays.
5. **Report briefly.**
   - Do not save the project unless asked.
   - Quote USD before any paid generation.
6. **Review notes:** apply them, then end with one `RULE: <category> | <rule> | <why>` line per note. The person
   chooses where to keep it. Do not call `add_brand_note` from the panel's Agent.

Recipes that worked in the tests:
- **Animate a layout from Figma:**
  - import each element as a native layer (text as text, cards as shapes, photos as footage);
  - `apply_brand`, then `render_frame` at 0.6 s, at the settle point, and at the end;
  - `check_layout`.
- **Text behind a person:** `text_behind subject="Portrait" text="Big word"`, then animate the text (Chars Rise or Blur
  Words) and render a frame where they overlap.
- **A client file that already moves:** `apply_preset … existing=modify`. Never replace unless asked.

## Tips by industry
| Industry | What worked | Watch out for |
|---|---|---|
| **Fashion** | Slide Land or Glide In for the copy, staggered in reading order; huge type behind the model with `text_behind`. | Brand-coloured type on a pale backdrop loses contrast: COAT in tan on cream measured 1.6:1. |
| **Eyewear** | Modify on the client's product move; Scale Pop for a single hero; a short Float loop on the frame. | Thin type over a light grey: keep it 32 px or more. |
| **Beauty** | Serif headline with Blur Words or Chars Rise; claim and price later, softer; Calm Modern or Elegant. | Text over texture: put it where the texture is calm, or on a card. |
| **Kitchen** | Whip Pan out of the lifestyle shot, Push Through into the product, Float on the product. | Use **Transition** with both layers selected, so the cut is one move. |
| **Sets (any)** | Build every angle of a set from one master frame as the reference image | Generated independently, the views disagree (windows, doors, furniture) |
| **Cars** | A full studio or road photo, a slow push-in, a spec card on empty space; S curve or the brand's glide. | Don't paste a cut-out car on a road photo: it floats. No overshoot on premium brands. |

## Troubleshooting
| Symptom | Fix |
|---|---|
| The panel shows old screens | Close and reopen it. If `index.html` changed, run `python tools/setup.py --update`. |
| "Waiting for After Effects…" | After Effects is still starting. It retries for a minute; F5 retries too. |
| The MCP dot is red | Open the panel once: it starts the bridge. Check the scripting preference in Install step 2. |
| A card shows "no preview" | Its image is missing. Run `python tools/check_previews.py`, which says how to make it. |
| The agent asks you to connect | Agent › Connect: your Claude sign-in expired. |
| Fonts look substituted | Restart After Effects after `setup.py` installs the fonts. `check_layout` stops when fonts are substituted. |

More pitfalls, each with its cause and fix: [docs/LEARNINGS.md](LEARNINGS.md).
