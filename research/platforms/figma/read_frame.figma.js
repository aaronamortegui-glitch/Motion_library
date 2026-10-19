// Motion DNA · Figma bridge, step 1 (read-only): paste into the Figma MCP tool use_figma with FRAME_ID set. Returns the
// frame as a tree in the format build_figma_slides.jsx already reads (n name, id, k kind, b [x, y, w, h] relative to the
// frame, f fill, st stroke, sw stroke width, r radius, o opacity, rot, s text, g {f "Family|Style", z size, c colour,
// ls letter spacing, lh line height}, al align, c children). Vectors come back as SVG strings; nodes that need pixels
// (image fills, gradients, effects) are flagged png: true, to be exported with get_screenshot by node id.
const FRAME_ID = "__FRAME_ID__";
const root = await figma.getNodeByIdAsync(FRAME_ID);
if (!root) throw new Error("frame not found: " + FRAME_ID);
let page = root; while (page.type !== "PAGE") page = page.parent;
await figma.setCurrentPageAsync(page);   // exports need the frame's page loaded
const R = root.absoluteBoundingBox || { x: root.x, y: root.y };
const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
const solid = (paints) => {
  if (!Array.isArray(paints)) return null;
  const p = paints.find((x) => x.visible !== false && x.type === "SOLID");
  return p ? { c: hex(p.color), o: Math.round((p.opacity ?? 1) * 100) / 100 } : null;
};
const needsPixels = (n) =>
  ("fills" in n && Array.isArray(n.fills) && n.fills.some((f) => f.visible !== false && (f.type === "IMAGE" || f.type.startsWith("GRADIENT")))) ||
  ("effects" in n && Array.isArray(n.effects) && n.effects.some((e) => e.visible !== false && e.type !== "DROP_SHADOW" && e.type !== "INNER_SHADOW"));
const VECTOR = new Set(["VECTOR", "BOOLEAN_OPERATION", "STAR", "POLYGON", "LINE"]);
let svgCount = 0;

async function walk(n) {
  if (n.visible === false) return null;
  const bb = n.absoluteBoundingBox || { x: n.x, y: n.y, width: n.width, height: n.height };
  const o = { n: n.name, id: n.id, b: [bb.x - R.x, bb.y - R.y, bb.width, bb.height].map((v) => Math.round(v * 10) / 10) };
  if ("opacity" in n && n.opacity < 1) o.o = Math.round(n.opacity * 100) / 100;
  if ("rotation" in n && Math.abs(n.rotation) > 0.01) o.rot = Math.round(n.rotation * 100) / 100;
  if (n.type === "TEXT") {
    const fn = n.fontName === figma.mixed ? n.getRangeFontName(0, 1) : n.fontName;
    const size = n.fontSize === figma.mixed ? n.getRangeFontSize(0, 1) : n.fontSize;
    const ls = n.letterSpacing === figma.mixed ? n.getRangeLetterSpacing(0, 1) : n.letterSpacing;
    const lh = n.lineHeight === figma.mixed ? n.getRangeLineHeight(0, 1) : n.lineHeight;
    const fill = solid(n.fills === figma.mixed ? n.getRangeFills(0, 1) : n.fills);
    Object.assign(o, { k: "t", s: n.characters, al: (n.textAlignHorizontal || "LEFT")[0],
      g: { f: fn.family + "|" + fn.style, z: size, c: fill ? fill.c : "#000000",
           ls: ls.unit === "PERCENT" ? Math.round(ls.value * size) / 100 : ls.value,
           lh: lh.unit === "PIXELS" ? lh.value : lh.unit === "PERCENT" ? Math.round(lh.value * size) / 100 : null } });
    if (fill && fill.o < 1) o.g.o = fill.o;
    return o;
  }
  if (needsPixels(n)) { o.k = "img"; o.png = true; return o; }   // photos, gradients, blurs: exported as pixels
  if (VECTOR.has(n.type)) {
    o.k = "v";
    try { if (svgCount < 60) { o.svg = await n.exportAsync({ format: "SVG_STRING" }); svgCount++; } else o.png = true; } catch (e) { o.png = true; }
    return o;
  }
  o.k = n.type === "ELLIPSE" ? "e" : n.type === "RECTANGLE" ? "r" : "g";
  const f = solid(n.fills), st = solid("strokes" in n ? n.strokes : null);
  if (f) o.f = f;
  if (st && n.strokeWeight) { o.st = st; o.sw = n.strokeWeight; }
  if ("cornerRadius" in n && typeof n.cornerRadius === "number" && n.cornerRadius > 0) o.r = n.cornerRadius;
  if ("clipsContent" in n && n.clipsContent && n !== root) o.clip = true;
  if ("children" in n && n.children.length) {
    o.c = [];
    for (const ch of n.children) { const w = await walk(ch); if (w) o.c.push(w); }
  }
  return o;
}

const tree = await walk(root);
return { file: figma.fileKey || null, id: root.id, name: root.name, w: Math.round(root.width), h: Math.round(root.height),
         bg: (solid(root.fills) || { c: "#000000" }).c, u: tree.c || [] };
