# Motion DNA in Cavalry and Blender (beta)

The same Motion DNA (presets, token curves, kit pieces, styles by role, Figma frames) in two more tools:
**Cavalry** (2D motion graphics, by Canva) and **Blender** (3D, and 2D through a camera). Each has its own panel inside
the app and a live link for Claude. It is a beta: it lives on the branch `platforms-beta`, apart from the After Effects
plugin, until it is approved.

- [Which tool for what](#which-tool-for-what)
- [After Effects stays safe](#after-effects-stays-safe)
- [Cavalry: step by step](#cavalry-step-by-step)
- [Blender: step by step](#blender-step-by-step)
- [Figma frames in Cavalry and Blender](#figma-frames-in-cavalry-and-blender)
- [The proof: the same animation in the three tools](#the-proof-the-same-animation-in-after-effects-cavalry-and-blender)
- [What each tool can do](#what-each-tool-can-do)
- [How it works](#how-it-works) · [Files](#files) · [For Claude and maintainers](#for-claude-and-maintainers) · [Troubleshooting](#troubleshooting)

## Which tool for what
| | After Effects | Cavalry | Blender |
|---|---|---|---|
| Best for | everything: video edits, footage, effects, the full library | fast 2D motion graphics, procedural layouts, social pieces | 3D, camera moves, tracking and roto on footage, text in space |
| Motion DNA there | the full plugin (49 moves, text, loops, 159 kit pieces, styles, brands, Agent) | 37 moves + 15 kit pieces + styles by role + Figma | 37 moves + 15 kit pieces + styles by role + Figma |
| Panel | Window › Extensions › Motion DNA | Window › Scripts › Motion DNA | 3D Viewport › **N** › Motion DNA |
| Claude's live link | `motion-dna` MCP (file bridge) | Canva's **Cavalry MCP** | `motion-dna-blender` MCP (file bridge in the add-on) |
| Figma | Claude reads it directly | Claude prepares a folder; the panel imports it | Claude prepares a folder; the panel imports it |
| Licence | AE | **free Starter** works (some filters are Pro) | free |

## After Effects stays safe
- Everything here is on the branch **`platforms-beta`**, checked out in its own folder (a git worktree) next to the
  main clone: `git worktree add "../motion category ai library - platforms" platforms-beta`. The main clone stays on
  `main`: After Effects loads its panel from it and teammates get it with Update. Nobody receives this branch by
  accident.
- The ports **only read** Motion DNA data (tokens, `library/INDEX.txt`, thumbnails, the recipes); no After Effects
  installer, panel or MCP tool knows they exist, and their installers point to the folder they are run from.
- Before merging into `main`, this must print nothing (the branch may only add `research/platforms`, docs and
  `.gitignore` lines):
  `git diff --stat main...platforms-beta -- . ':!research/platforms' ':!docs/LEARNINGS.md' ':!.gitignore' ':!README.md'`

## Cavalry: step by step
**Needs:** Cavalry 2.8 or newer (the free Starter licence is enough), Python 3, this branch's folder.

**Install (once)**
1. In the platforms folder: `python research/platforms/cavalry/install.py`. It copies the panel into Cavalry's
   Scripts folder with this folder's path written in (no restart needed).
2. In Cavalry: **Window › Scripts › Motion DNA**. Dock the window where you like.
3. For Claude (optional, to let it work in Cavalry): Cavalry's own MCP server is on by default (*Preferences › MCP
   Server*). Download Canva's connector (`cavalry-mcp-server.zip`, cavalry.studio › docs › AI automation with Claude),
   unzip it, and register it in Claude Code:
   `claude mcp add cavalry -e SSE_URL=http://localhost:6768/sse -- node "<unzipped folder>/server/index.js"`
   The first time Claude connects, Cavalry asks for approval: click **Allow**.

**Use it by hand**
- **Play** and **Motion blur** (top): Motion blur turns it on in the comp and on the selected layers (or all).
- **Behaviors**: 1 choose a type (Moves, Effects, Text, Loops, Elements) → pick a tile (search and energy filter) →
  2 adjust Duration ×, Intensity ×, Curve (a token that replaces the preset's own), Stagger, Start frame (or Playhead),
  In / Out / Both → **Create**. **Remove** takes it off. Counter and Bars work with nothing selected.
- **Curves**: pick a token curve or drag its handles; select keyframes in the Time Editor → **Apply to selected
  keyframes**.
- **Figma**: Choose frame folder → **Import frame** → **Animate by role** (see [Figma frames](#figma-frames-in-cavalry-and-blender)).

**Use it with Claude** (Cavalry open, the connector registered): ask in words, e.g.
*"In Cavalry, animate the selected layers with Surge Rise, 3 frames apart"*, *"add a counter to 1,250"*,
*"bring this Figma frame to Cavalry and animate it by role: <link>"*. Claude loads the Motion DNA library with
`execute_script`, works on the open scene and checks with `snapshot_layer` (or a render) before saying it is done.

## Blender: step by step
**Needs:** Blender 4.2 or newer (tested on 5.0), Python 3 with `pip install fonttools skia-pathops` (for the fonts),
this branch's folder.

**Install (once)**
1. In the platforms folder: `python research/platforms/blender/install.py`. It makes Blender-safe copies of the
   token fonts (Inter Tight's overlapping outlines merged; the repo keeps the originals), puts a small loader in
   Blender's add-ons folder that runs the add-on from this folder, and enables it with your own preferences.
2. Open Blender (the add-on loads new code by itself on every start: no reinstall after an update).
3. For Claude (optional, to let it work in your open Blender), register its MCP server once:
   `claude mcp add motion-dna-blender -- python "<platforms folder>/research/platforms/blender/mcp_blender.py"`

**Use it by hand**
- In the 3D Viewport press **N** and click the **Motion DNA** tab (right edge; Blender remembers it).
- **Workspace** switches to Animation: camera view with material preview, the Dope Sheet and the timeline.
  **Preview** plays the animation (press again to stop). **Motion blur** turns it on for renders (with the shutter);
  Whip Pan turns it on by itself. Blender shows motion blur in renders, not in the viewport.
- **Behaviors**, **Curves**, **Figma**: the same steps as in Cavalry (Curves applies to keyframes selected in the
  Graph Editor or the Dope Sheet).
- Start from a new file without the default cube, or delete it: it sits in front of an imported Figma frame.

**Use it with Claude** (Blender open, `motion-dna-blender` registered): *"in Blender, apply Scale Pop to the selected
objects"*, *"bring this Figma frame to Blender and animate it by role"*, *"render frame 40 and show me"*. Tools:
`blender_status`, `list_objects`, `list_presets`, `apply_preset`, `add_kit`, `figma_build`, `figma_animate`,
`remove_animation`, `render_frame` (Claude looks at the PNG), `run_python`. Without an open Blender, Claude can still
build headless and hand over a `.blend` (`blender -b -P …`, below).

## Figma frames in Cavalry and Blender
Neither tool has a Figma link (Cavalry only pastes SVG), so **Claude prepares the frame** and the panel (or Claude)
rebuilds it. Nobody exports by hand. The full procedure for Claude is in [figma/README.md](figma/README.md); in short:
1. You give Claude the frame's link and say which tool.
2. Claude reads the frame with the Figma MCP (`figma/read_frame.figma.js`), exports photos and gradients as PNG and
   vectors as SVG, and writes a folder in your project with `manifest.json`: every layer with its Figma name, box,
   style and a **role** (title, subtitle, body, shape, media, logo, background).
3. The frame is rebuilt at the same place and size: live text with the Figma font, shapes, photos, vectors.
4. **Animate by role** gives each role its move (title → Chars Rise, subtitle → Words Fade Up, media → Blur In,
   shapes → Wipe Reveal, body → Fade Up, logo → Scale Pop), staggered in reading order, like a style in After Effects.

**Tip for designers:** name Figma layers by role (`title`, `subtitle`, `photo`, `logo / mark`, `cta`): roles are then
exact instead of guessed from the layout. Tested on *motion-adn › 06 storyboard › Shot 09f*: both rebuilds match the
Figma screenshot.

## The proof: the same animation in After Effects, Cavalry and Blender
One Figma frame (*motion-adn › 06 storyboard › Shot 09f*, a fictional car ad) with the Motion DNA logo as a sign-off,
and one choreography (`out/proof/choreo.json`, 12 steps, 96 frames at 30 fps): the kicker word by word, "Drive"
letter by letter, the photo blurring in, "into summer." word by word, three stripes wiping in, the price, then the
logo mark (Scale Pop) and the wordmark "MOTION DNA" letter by letter. Each tool built the frame from Figma and ran
the same steps with the same presets and token curves:
- After Effects: `tools/build_figma_slides.jsx` + `SSP.apply` / `SSP.applyText`.
- Cavalry: `cavalry/proof_cavalry.js` (Canva's MCP), which saves and restores the open scene.
- Blender: `blender/proof_blender.py` (headless).
- Comparison: `python research/platforms/proof_compare.py <proof folder> <AE render.mp4>` → a 2×2 video (Figma,
  AE, Cavalry, Blender), a sheet of key frames and the mean pixel difference to After Effects.

**Result** (mean absolute pixel difference to the After Effects render, 0–255; an identical frame through video
encoding alone scores about 2.7):

| t | 0.30 s | 0.55 s | 1.00 s | 1.90 s | 3.10 s |
|---|---|---|---|---|---|
| Cavalry | 3.16 | 3.20 | 2.86 | 2.95 | 2.95 |
| Blender | 3.01 | 3.67 | 3.91 | 4.32 | 4.35 |

Letters and words appear in the same order, at the same moments, with the same rise, scale and blur; the photo blurs
in the same way; the stripes reveal right to left with a hard edge; the wordmark in Inter Tight Bold matches. What it
took:
- **Text pieces copy After Effects' Range Selector** (a Ramp Up window sweeping the text) instead of a fixed stagger,
  baked per unit and frame; each letter or word has its own blur.
- **Cavalry** splits the text into one layer per unit placed on its glyph: its Sub-Mesh shows per-letter changes in
  the viewport but not in renders (Starter licence). Its Fast Blur takes 0.3 × AE's blurriness.
- **Blender** pre-blurs photos (its depth of field is disc-shaped and softened the rest of the frame), keeps depth of
  field only inside blur windows, and mixes colours in display space like AE.
- **The comparison found a bug in After Effects' Figma import:** text with "Auto" line height sat 0.05 em too high;
  fixed on `main` (the font's own line height, as Figma uses).

Still different: Blender's blurred letters are a little lighter as they appear (disc bokeh vs Gaussian), the
Cavalry photo shows a faint darker band at its edge in the first blurred frames, and Blender's fill of the
letter-spaced kicker is a few pixels narrower.

## What each tool can do
**Moves and kit** (curves measured against the token: 0.000 % error in both)

| Type | Pieces | Cavalry | Blender |
|---|---|---|---|
| Moves | 37 of the 49 presets (position, scale, opacity, rotation, 3D flips) | ✅ | ✅ |
| Effects | Blur In, Slam In, Wipe Reveal, Iris Reveal, Jello, Light Speed In, Line Draw | ✅ | ✅ (blur via depth of field: softer than AE's gaussian) |
| Text | Chars Rise, Words Fade Up, Typewriter | ✅ | ✅ |
| Loops | Float, Pulse, Wiggle | ✅ (oscillator / noise) | ✅ (F-curve modifiers) |
| Elements | Counter, Bars Transition | ✅ | ✅ |

Not ported yet: the other 12 moves (blur, masks, trim paths, warp, time remap inside a preset), 8 text animations,
the rest of the 159 AE kit pieces, brands. Tested and possible, waiting to become panel pieces: glitch, plexus and
mesh-gradient backgrounds, time remap / speed ramps, layout check, 9:16 resize (`cavalry/tests`, `blender/tests`).

**Techniques**

| Technique | Cavalry | Blender |
|---|---|---|
| Tracking | planar tracker + Corner Pin (screen replacement); point tracks from `tools/track_points.py` | full: points, planes, 3D camera solve |
| Roto / mattes | none native: use the AI mattes from our scripts as footage | mask editor, compositor keying, our mattes |
| Speed ramps / freeze | ✅ | ✅ |
| Styles by role | ✅ | ✅ |
| Cut on the voice, face refinement, stroke build | the scripts run outside the app, so their output works in both | same |

**Known limits:** Cavalry Starter caps renders at 1920×1080 and keeps Glow, Scan Lines and Pixel Sorting for Pro;
motion blur did not show in scripted renders on Starter (check it in the app). Blender shows motion blur only in
renders; its Blur In uses depth of field, so objects off the focus plane blur too.

## How it works
1. **Portable recipes.** `export_portable.jsx` runs inside After Effects: it applies every motion preset to a test
   solid with the engine's animation calls wrapped, and writes what each animates as data (`portable_presets.json`):
   channel, start frame and length (at 30 fps), from/to relative to the rest value (position in pixels with y down,
   rotation in degrees, scale and opacity as fractions) and the curve token. 37 of 49 are fully portable; `ae_only`
   names what the others need.
2. **One kit catalog** (`kit_portable.json`) with the same 15 pieces, defaults and tokens for both tools.
3. **One interpreter per tool** (`cavalry/mdna_cavalry.js`, `blender/mdna_blender.py`) keys the tool's own properties
   with each token's cubic-bezier as free handles, so curves are exact (After Effects needs three keys for Pop or
   Recoil; these tools take the curve itself).
4. **Figma bridge** (`figma/`) and the importers (`cavalry/mdna_figma.js`, `blender/mdna_figma.py`).
5. **Live links**: Canva's Cavalry MCP; for Blender, the add-on's file bridge (`blender/bridge/inbox` → `outbox`, no
   network port) and `blender/mcp_blender.py`.

## Files
| Path | What |
|---|---|
| `portable_presets.json` · `export_portable.jsx` | the presets as data, and the After Effects script that exports them |
| `kit_portable.json` | the 15 kit pieces both tools offer |
| `figma/` | the Figma bridge: `read_frame.figma.js`, `figma_bridge.py`, its README |
| `cavalry/` | `mdna_cavalry.js` (library), `mdna_figma.js` (importer), `Motion DNA.js` (panel), `install.py`, `demo_kit.js`, `tests/` (15 capability tests) |
| `blender/` | `mdna_blender.py` (library), `mdna_figma.py` (importer), `motion_dna_addon.py` (panel + bridge), `mcp_blender.py` (MCP server), `install.py`, `fix_fonts.py`, `test_blender.py`, `test_kit.py`, `tests/` |
| `assets/curves/` | the token curve icons (both panels) |

Git-ignored, made on each machine: `blender/out/`, `blender/fonts/`, `blender/bridge/`, `cavalry/out/`, `out/`.

## For Claude and maintainers
- **Presets changed in After Effects?** Re-export the recipes: MCP `run_jsx` with
  `$.evalFile(new File("<repo>/research/platforms/export_portable.jsx")); return JSON.stringify(MDNA_EXPORT_PORTABLE());`
  and write the result into `portable_presets.json` with the same wrapper (version, tokens, fps, note, portable).
- **A new kit piece:** add it to `kit_portable.json`, implement it in **both** libraries (`MDNA.kit` and `M.kit`), key
  it with the token curves, add a test, render key frames and look at them, then measure the curve.
- **Tests:** Blender `blender -b --factory-startup -P research/platforms/blender/test_blender.py` (37 presets and the
  curve check) and `… test_kit.py -- pieces` / `-- addon` / `-- demo`; Cavalry: the scripts in `cavalry/tests` through
  Canva's MCP (`execute_script`), each cleaning up after itself.
- **Never** run Blender tests without `--factory-startup` together with `save_userpref` (it would replace the user's
  preferences); never create a second comp in Cavalry by script (unsupported); test in the open comp and remove what
  you made.
- Lessons: `docs/LEARNINGS.md` §10.

## Troubleshooting
| Problem | Fix |
|---|---|
| Cavalry: the Motion DNA window opens empty or shows "could not start" | Close it and run `install.py` again; if the message stays, send it (it names the failing line). |
| Cavalry: Claude says "not approved" | Switch to Cavalry and click **Allow** in the approval dialog. |
| Blender: no Motion DNA tab | Edit › Preferences › Add-ons › enable **Motion DNA**; or run `install.py` again. |
| Blender: Inter Tight shows holes | `pip install fonttools skia-pathops`, then `install.py` (it rebuilds `blender/fonts/`). |
| Blender: Claude says "Blender is not listening" | Open Blender (the add-on listens while it is open) and check the add-on is enabled. |
| Blender: an imported Figma frame is hidden | Delete the default cube, or start from a new file. |
| Blender: windows open and close by themselves | Claude's screenshot tests: they use factory settings and do not touch your Blender. |
