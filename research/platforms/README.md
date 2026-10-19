# Motion DNA beyond After Effects (research)

The same presets and token curves in other tools. Not part of the plugin yet: each port is a beta to judge.

## Keeping After Effects safe (read before changing anything here)
- This work lives on the branch **`platforms-beta`**, checked out in its own folder (a git worktree:
  `git worktree add "../motion category ai library - platforms" platforms-beta`). The main clone stays on `main`:
  After Effects loads its panel from that clone, and teammates get `main` with Update.
- The ports **only read** After Effects data (tokens, `library/INDEX.txt`, thumbnails, `portable_presets.json`); they
  never write to it, and no After Effects installer or panel knows they exist. Their installers point to the clone
  they are run from.
- Before merging into `main`, this must print nothing (the branch may only add `research/platforms`, LEARNINGS and
  `.gitignore` lines):
  `git diff --stat main platforms-beta -- . ':!research/platforms' ':!docs/LEARNINGS.md' ':!.gitignore'`

## How it works
1. **Portable recipes.** `export_portable.jsx` runs inside After Effects: it applies every motion preset to a test
   solid with the engine's animation calls wrapped, and writes what each one animates as data
   (`portable_presets.json`): channel, start frame and length (at 30 fps), from/to relative to the layer's rest value
   (position offsets in pixels with y down, rotation in degrees, scale and opacity as fractions) and the curve token.
   Run it again after changing presets: `run_jsx` with
   `$.evalFile(new File("<repo>/research/platforms/export_portable.jsx")); return JSON.stringify(MDNA_EXPORT_PORTABLE());`
   and wrap the result as in the current file.
2. **One interpreter per tool** reads the recipes and the tokens and keys the tool's own properties, with each
   token's cubic-bezier as free handles.

Today: 49 motion presets, **37 fully portable** (position, scale, opacity, rotation, 3D flips). The other 12 use
what only After Effects has (blur, masks, linear wipe, trim paths, warp, time remap); `ae_only` names it per preset.

## Status
| Tool | How Claude drives it | State |
|---|---|---|
| **Blender 5** | Python (`bpy`), headless: `blender -b -P` | `blender/mdna_blender.py`: 37/37 presets in and out, curves exact (0.000 % error vs the token), demo renders |
| **Cavalry 2.8+** | Cavalry's own MCP server (Canva's `cavalry-mcp-server` extension → `execute_script`, `snapshot_layer`); works on the free Starter licence | `cavalry/mdna_cavalry.js`: 37/37 presets, curves exact, demo built and checked with `snapshot_layer` |
| **Affinity 3.2+** | Affinity's own MCP server (Settings › Model Context Protocol, `localhost:6767`) | No timeline: the design side (brand tokens, layouts, export to After Effects). Waiting for the MCP switch |

## Inside each tool (for people, not only Claude)
| Tool | Install | Where |
|---|---|---|
| Blender | `python research/platforms/blender/install.py` (a loader in Blender's add-ons folder that runs the add-on from this clone, enabled with the user's own preferences) | 3D Viewport › press **N** › **Motion DNA** tab |
| Cavalry | `python research/platforms/cavalry/install.py` (copies `Motion DNA.js` into Cavalry's Scripts folder with this clone's path) | **Window › Scripts › Motion DNA** (a dockable window; works on the free Starter licence) |

Both show the same controls: energy filter, preset (with what it is for, its channels and energy, from
`library/INDEX.txt`), In / Out / In + Out, start frame (or the playhead), stagger, duration ×, intensity ×,
**Apply to selected** and **Remove**. Presets and curves are read from the clone, so `setup.py --update` (a git pull)
updates both. Before these leave research, each needs its GIF in `docs/screens/` (CLAUDE.md).

## Claude driving an open Blender (live)
The add-on listens while Blender is open (a file bridge like After Effects': `blender/bridge/inbox` → `outbox`,
no network port; `bridge/alive.json` says it is listening). Register its MCP server once in Claude Code:
`claude mcp add motion-dna-blender -- python "<clone>/research/platforms/blender/mcp_blender.py"`
Tools: blender_status, list_objects, list_presets, apply_preset, add_kit, figma_build, figma_animate,
remove_animation, render_frame (look at it), run_python. Tested live: Figma frame built, animated by role, Float and a
Counter added, frames rendered and checked. Cavalry needs no bridge of ours: Canva's Cavalry MCP is the live link.

## Blender
```
blender -b --factory-startup -P research/platforms/blender/test_blender.py      # test + demo → blender/out/
blender -b scene.blend -P research/platforms/blender/mdna_blender.py -- apply "Fade Up" --objects Title,Card --save out.blend
```
Inside Blender: `import mdna_blender as M; M.apply(obj, "Surge Rise", "in", start=6)`. Opacity keys `obj.color[3]`,
which the object's materials multiply into their alpha (added on first use). Camera convention: looking along +Y.

## Cavalry
Connect Claude to Cavalry with Canva's extension (`cavalry-mcp-server.zip` from cavalry.studio › AI automation with
Claude); the first connection shows an approval dialog in Cavalry. Then, in `execute_script`:
```js
api.load("<repo>/research/platforms/cavalry/mdna_cavalry.js");
MDNA.init("<repo>");
MDNA.apply(layerId, "Scale Pop", "in", 0);
MDNA.applyMany([id1, id2, id3], "Bounce In", "in", 18, 3);   // 3-frame stagger
```
Text: set `autoWidth` and `autoHeight`, then centre on the glyphs' bounding box before animating (a text box is
300 px tall by default and hangs below its pivot).
