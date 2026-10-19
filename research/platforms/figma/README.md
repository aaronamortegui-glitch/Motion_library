# Figma → Cavalry / Blender (the Figma bridge)

Cavalry and Blender have no Figma link (Cavalry only pastes SVG). In After Effects, Claude reads Figma through the
Figma MCP and builds the layers; for these two tools Claude does the same through a folder: it reads the frame,
exports what needs pixels, writes a manifest, and the tool's importer rebuilds it. Nobody exports by hand.

## When someone asks "bring this Figma frame to Cavalry / Blender" (for Claude)
1. **Read** the frame (read-only): run `read_frame.figma.js` with the Figma MCP tool `use_figma`, `FRAME_ID` replaced
   by the node id from the link (`node-id=32-1196` → `32:1196`). Save what it returns as
   `<project>/figma/<frame-slug>/tree.json` (a project folder, never this repo).
2. **Export pixels:** for every node with `"png": true` (photos, gradients, blurs), call `get_screenshot` with that node
   id, `contentsOnly: true` and `maxDimension` = 2× its width, and save it as `assets/<node-id with - for :>.png`.
   Vectors already came back as SVG.
3. **Manifest:** `python research/platforms/figma/figma_bridge.py <project>/figma/<frame-slug>` → `manifest.json`
   (flat layers, Figma names, boxes, styles, files, and a role per layer: title, subtitle, body, shape, media, logo,
   background — from the layer name when it says so, else from the layout). Name Figma layers by role
   (`title`, `logo / mark`, `photo`…) and the roles are exact.
4. **Build:**
   - Cavalry (MCP `execute_script`): `api.load("<repo>/research/platforms/cavalry/mdna_figma.js"); MDNA_FIGMA.build(folder)`
     — or the person opens Motion DNA › **Figma** › Choose frame folder › Import frame.
   - Blender: `blender -b -P research/platforms/blender/mdna_figma.py -- <folder> --save <file>.blend` — or Motion DNA
     tab (N) › **Figma** › pick the folder › Import frame.
5. **Animate by role:** `MDNA_FIGMA.animate(built)` / `mdna_figma.animate(built)`, or the **Animate by role** button:
   title → Chars Rise, subtitle → Words Fade Up, media → Blur In, shapes → Wipe Reveal, body → Fade Up,
   logo → Scale Pop, staggered in reading order. Then look at frames (`snapshot_layer` / a render) against the
   Figma screenshot.

## What comes across
| Figma | Cavalry | Blender |
|---|---|---|
| Text | live text, same font, size, colour, tracking, placed on Figma's box | live text; the size is converted from Figma's em to Blender's font bounding box (read from the .ttf) |
| Rectangle / ellipse | primitives with fill, stroke, radius | flat meshes with an emission colour (exact sRGB) |
| Photo, gradient, blur | footage layer from the exported PNG | image plane from the exported PNG |
| Vector | SVG → layers | SVG → one curve object, scaled to the box, emission colour |
| Layer order and names | kept | kept (and `mdna_role`, `mdna_order` custom properties) |

Tested on *motion-adn › 06 storyboard › Shot 09f* (`32:1196`): both rebuilds match the Figma screenshot (positions,
sizes, colours, photo); in Blender, Inter Tight falls back to Blender's own font (its outlines overlap and render
with holes) until the font files are cleaned.
