// Motion DNA · Figma bridge for Cavalry: rebuilds a Figma frame from its manifest (research/platforms/figma) as native
// Cavalry layers at the same place and size: text stays live text (Figma font, size, colour, tracking), rectangles and
// ellipses are primitives (fill, stroke, radius), photos are footage layers, vectors come in as SVG. Layers keep their
// Figma names; build() returns {name, id, role, order} per layer so a style can animate them by role.
//   api.load("<repo>/research/platforms/cavalry/mdna_figma.js");
//   var built = MDNA_FIGMA.build("<project>/figma/<frame folder>");     // the folder figma_bridge.py wrote
var MDNA_FIGMA = (function () {
    function rgbaHex(c, o) { return o !== undefined && o < 1 ? c + ("0" + Math.round(o * 255).toString(16)).slice(-2) : c; }

    function build(folder, opts) {
        opts = opts || {};
        var m = JSON.parse(api.readFromFile(folder + "/manifest.json"));
        var comp = api.getActiveComp(), W = m.w, H = m.h;
        if (opts.resize !== false) api.set(comp, { resolution: [W, H] });
        api.set(comp, { backgroundColor: m.bg });
        var centre = function (b) { return { x: b[0] + b[2] / 2 - W / 2, y: H / 2 - (b[1] + b[3] / 2) }; };   // Figma (y down, top-left) → Cavalry (y up, centre)
        var out = [], made = {};
        m.layers.forEach(function (L) {
            if (L.kind === "group") return;   // Figma groups only position their children; the children carry absolute boxes
            var b = L.box, c = centre(b), id = null;
            if (L.kind === "rect" || L.kind === "ellipse") {
                id = api.primitive(L.kind === "rect" ? "rectangle" : "ellipse", L.name);
                if (L.kind === "rect") api.set(id, { "generator.dimensions": [b[2], b[3]] });
                else api.set(id, { "generator.radius": [b[2] / 2, b[3] / 2] });
                if (L.radius && L.kind === "rect") api.set(id, { "generator.cornerRadius": L.radius });
                if (L.fill) api.set(id, { "material.materialColor": rgbaHex(L.fill.c, L.fill.o) }); else api.setFill(id, false);
                if (L.stroke) { api.setStroke(id, true); api.set(id, { "stroke.width": L.stroke.width, "stroke.strokeColor": rgbaHex(L.stroke.c, L.stroke.o) }); }
                api.set(id, { "position.x": c.x, "position.y": c.y });
            } else if (L.kind === "text") {
                var t = L.text;
                id = api.create("textShape", L.name);
                api.set(id, { text: t.string, fontSize: t.size, "material.materialColor": t.color, letterSpacing: t.tracking || 0,
                              autoWidth: true, autoHeight: true, horizontalAlignment: { left: 0, center: 1, right: 2 }[t.align] || 0, verticalAlignment: 1 });
                try { api.set(id, { font: { font: t.family, style: t.style } }); } catch (e) { out.fontMissing = (out.fontMissing || []).concat(t.family + " " + t.style); }
                // match Figma's text box: left (or centre/right) edge on its x; vertically Figma centres the font's line box
                // (hhea ascent + descent, which Cavalry's Top alignment also uses) in the text box, so the first line's top sits at
                // box top + (box height - natural line height) / 2. Natural line height = Bottom-aligned minus Top-aligned glyph bottom.
                api.set(id, { verticalAlignment: 2 }); var yb = api.getBoundingBox(id, true).bottom;
                api.set(id, { verticalAlignment: 0 }); var yt = api.getBoundingBox(id, true).bottom, natural = yb - yt;
                var bb = api.getBoundingBox(id, true), pos = api.get(id, "position");
                var ax = t.align === "center" ? c.x : t.align === "right" ? b[0] + b[2] - W / 2 : b[0] - W / 2;
                var cur = t.align === "center" ? bb.centre.x : t.align === "right" ? bb.right : bb.left;
                var lineTop = b[1] + (b[3] - natural) / 2;   // Figma y (down)
                api.set(id, { "position.x": pos.x + (ax - cur), "position.y": H / 2 - lineTop });
            } else if (L.kind === "image" && L.file) {
                var asset = api.loadAsset(folder + "/" + L.file, false), r = api.addAssetToComp(asset);
                id = typeof r === "string" ? r : r[0];   // a layer id, or a list of them
                api.rename(id, L.name);
                var bb2 = api.getBoundingBox(id, true);
                if (bb2.width > 0) api.set(id, { "scale.x": b[2] / bb2.width, "scale.y": b[3] / bb2.height });
                api.set(id, { "position.x": c.x, "position.y": c.y });
            } else if (L.kind === "svg" && L.file) {
                var ids = api.convertSVGToLayers(folder + "/" + L.file);
                id = ids && ids.length ? ids[0] : null;
                if (id) {
                    api.rename(id, L.name);
                    var bb3 = api.getBoundingBox(id, true), p3 = api.get(id, "position");
                    api.set(id, { "position.x": p3.x + (c.x - bb3.centre.x), "position.y": p3.y + (c.y - bb3.centre.y) });
                }
            }
            if (!id) return;
            if (L.opacity !== undefined) api.set(id, { opacity: L.opacity * 100 });
            if (L.rotation) api.set(id, { "rotation.z": L.rotation });
            api.select([id]); api.bringToFront();   // Figma's order: later layers on top
            made[L.id] = id;
            out.push({ name: L.name, id: id, role: L.role, order: L.order, figma: L.id });
        });
        api.select([]);
        return out;
    }

    // Animates a built frame by role, like an After Effects style: roles → {preset | kit piece}, staggered in reading order.
    var DEFAULT_STYLE = { background: null, shape: { kit: "wipe_reveal" }, media: { kit: "blur_in" }, title: { kit: "chars_rise" },
                          subtitle: { kit: "words_fade_up" }, body: { preset: "Fade Up" }, logo: { preset: "Scale Pop" } };
    function animate(built, style, start, stagger) {
        style = style || DEFAULT_STYLE; start = start || 0; stagger = stagger === undefined ? 4 : stagger;
        var list = built.slice().sort(function (a, b) { return a.order - b.order; }), done = [];
        list.forEach(function (l, i) {
            var s = style[l.role];
            if (!s) return;
            var at = start + i * stagger;
            try {
                if (s.kit) MDNA.kit(s.kit, [l.id], "in", at, {});
                else MDNA.apply(l.id, s.preset, "in", at);
                done.push(l.name + " · " + l.role + " · " + (s.kit || s.preset) + " @" + at);
            } catch (e) { done.push(l.name + " · " + e); }
        });
        return done;
    }
    return { build: build, animate: animate, DEFAULT_STYLE: DEFAULT_STYLE };
})();
