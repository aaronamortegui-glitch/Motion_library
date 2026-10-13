// Rebuilds Figma slides as native After Effects layers from a JSON spec (see media/process-deck/make_slides_spec.py
// for the format, extracted with read-only use_figma dumps). Text stays live (real fonts, per-word layers when Figma
// has them), shapes are shape layers (fills, strokes, radius, layer blur, arcs as trimmed strokes), photos/gradients/
// logos are the exported PNGs. Every Figma group becomes a precomp (it animates as one piece, like the explainer
// builder), positioned at its center so scale and rotation presets behave. Layers keep their Figma names.
// API (include this file):  var R = FIGMA_SLIDES.build(spec, {prefix: "PD_", folder: "PROCESS DECK"})
//   R.comps[slide] → slide comp · R.L[slide][name] → [layers] · R.C[slide][name] → inner comp of a group
//   R.inner[slide][group][child] → [layers inside that group's comp]
#include "ss_presets.jsx"
var FIGMA_SLIDES = (function () {
    var proj = app.project, FPS = 30, W = 1920, H = 1080, PFX = "FS_", folder = null, ASSET_DIR = "";
    var FONT = { "Inter Tight|Regular": "InterTight-Regular", "Inter Tight|Medium": "InterTight-Medium", "Inter Tight|SemiBold": "InterTight-SemiBold",
                 "Inter Tight|Bold": "InterTight-Bold", "Instrument Serif|Italic": "InstrumentSerif-Italic", "Instrument Serif|Regular": "InstrumentSerif-Regular" };
    // groups that only wrap other layers: their children go straight into the parent
    var FLAT = { "hero-object": 1, "text": 1, "header": 1, "texture": 1, "title-words": 1, "headline-words": 1, "type": 1, "fx-back": 1, "fx-front": 1 };
    var R;

    // PostScript name if AE has the font, otherwise a close stand-in (rebuild once the font is installed)
    var FALLBACK = { "InstrumentSerif-Italic": "Georgia-Italic", "InstrumentSerif-Regular": "Georgia", "InterTight-Medium": "Arial-BoldMT", "InterTight-SemiBold": "Arial-BoldMT", "InterTight-Regular": "ArialMT", "InterTight-Bold": "Arial-BoldMT" }, HAS = {}, SUBST = {};
    var METRICS = { "Inter Tight": [0.96875, 0.2412], "Instrument Serif": [0.99, 0.31] };   // hhea ascent, descent / em
    function font(key) {
        var ps = FONT[key] || "InterTight-Medium";
        if (HAS[ps] === undefined) { try { HAS[ps] = app.fonts.getFontsByPostScriptName(ps).length > 0; } catch (e) { HAS[ps] = true; } }
        if (HAS[ps]) return ps;
        SUBST[ps] = FALLBACK[ps] || "ArialMT"; return SUBST[ps];
    }
    function hex(c) { c = (c || "#000000").replace("#", ""); return [parseInt(c.substr(0, 2), 16) / 255, parseInt(c.substr(2, 2), 16) / 255, parseInt(c.substr(4, 2), 16) / 255]; }
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
    function reg(map, key, name, L) { if (!map[key]) map[key] = {}; if (!map[key][name]) map[key][name] = []; map[key][name].push(L); }
    function maxBlur(u) { var m = u.bl || 0; if (u.c) for (var i = 0; i < u.c.length; i++) m = Math.max(m, maxBlur(u.c[i])); return m; }
    function importOnce(file) {
        var f = new File(ASSET_DIR + "/" + file);
        if (!f.exists) throw new Error("Missing asset: " + f.fsName);
        for (var i = 1; i <= proj.numItems; i++) { var it = proj.item(i); if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) return it; }
        var item = proj.importFile(new ImportOptions(f)); item.parentFolder = folder; return item;
    }
    // Figma reports the axis-aligned box of a rotated node: recover its own width and height
    function unrotate(w, h, rot) {
        if (!rot) return [w, h];
        var a = Math.abs(rot) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)), d = c * c - s * s;
        if (Math.abs(d) < 0.05) return [w / (c + s), h / (c + s)];
        return [Math.max(1, (w * c - h * s) / d), Math.max(1, (h * c - w * s) / d)];
    }
    function center(u, ox, oy) { return [u.b[0] - ox + u.b[2] / 2, u.b[1] - oy + u.b[3] / 2]; }
    function vgroup(L) { return L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group"); }
    function paint(g, u, strokeColorOverride, strokeW) {
        if (u.f) { var fl = g.addProperty("ADBE Vector Graphic - Fill"); fl.property("ADBE Vector Fill Color").setValue(hex(u.f.c)); if (u.f.o !== undefined) fl.property("ADBE Vector Fill Opacity").setValue(u.f.o * 100); }
        if (u.st || strokeColorOverride) {
            var st = g.addProperty("ADBE Vector Graphic - Stroke");
            st.property("ADBE Vector Stroke Color").setValue(hex(strokeColorOverride || u.st.c)); st.property("ADBE Vector Stroke Width").setValue(strokeW || u.sw || 1);
            if (u.st && u.st.o !== undefined) st.property("ADBE Vector Stroke Opacity").setValue(u.st.o * 100);
        }
    }
    function finish(L, u, pos) {
        tr(L, "ADBE Position").setValue(pos);
        if (u.op !== undefined) tr(L, "ADBE Opacity").setValue(u.op * 100);
        if (u.bl) { var b = L.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur 2"); b.property("ADBE Gaussian Blur 2-0001").setValue(u.bl * 1.1); try { b.property("ADBE Gaussian Blur 2-0003").setValue(0); } catch (e) {} }
        L.name = u.n;
        return L;
    }
    function makeShape(comp, u, ox, oy, ctx) {
        var L = comp.layers.addShape(), g = vgroup(L), w = u.b[2], h = u.b[3];
        if (u.k === "e" && u.arc) {                       // Figma ring sector → trimmed stroke on an ellipse
            var aw = u.aw || 4, el = g.addProperty("ADBE Vector Shape - Ellipse");
            el.property("ADBE Vector Ellipse Size").setValue([w - aw, h - aw]);
            var tm = g.addProperty("ADBE Vector Filter - Trim");
            tm.property("ADBE Vector Trim Start").setValue(0);
            if (u.vis) {                                  // measured visual angles (clockwise from 3 o'clock); AE ellipses start at 12
                tm.property("ADBE Vector Trim End").setValue(Math.min(100, u.vis[1] / 360 * 100));
                tm.property("ADBE Vector Trim Offset").setValue(u.vis[0] + 90);
            } else {
                tm.property("ADBE Vector Trim End").setValue(Math.min(100, (u.arc[1] - u.arc[0]) / (2 * Math.PI) * 100));
                tm.property("ADBE Vector Trim Offset").setValue(u.arc[0] * 180 / Math.PI + 90);
            }
            paint(g, { st: { c: u.f ? u.f.c : "#ffffff" } }, null, aw);
            if (!u.vis) tr(L, "ADBE Rotate Z").setValue(-((ctx && ctx.rot) || 0));
        } else if (u.k === "e") {
            g.addProperty("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").setValue([w, h]);
            paint(g, u);
        } else if (u.k === "l") {                          // placeholder cross lines: the box diagonal
            var sh = new Shape(), down = (u.rot || 0) > 0;
            sh.vertices = down ? [[-w / 2, -h / 2], [w / 2, h / 2]] : [[-w / 2, h / 2], [w / 2, -h / 2]]; sh.closed = false;
            g.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
            paint(g, { st: u.st || { c: "#ffffff" }, sw: u.sw });
        } else if (u.side) {                               // single-edge stroke (Figma individual stroke weights)
            var se = new Shape(), y = u.side === "top" ? -h / 2 : h / 2;
            se.vertices = [[-w / 2, y], [w / 2, y]]; se.closed = false;
            g.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(se);
            paint(g, { st: u.st, sw: u.sw });
        } else {
            var sz = unrotate(w, h, u.rot), rr = g.addProperty("ADBE Vector Shape - Rect");
            rr.property("ADBE Vector Rect Size").setValue(sz);
            if (u.r) rr.property("ADBE Vector Rect Roundness").setValue(Math.min(u.r, Math.min(sz[0], sz[1]) / 2));
            paint(g, u);
            if (u.rot) tr(L, "ADBE Rotate Z").setValue(-u.rot);
        }
        return finish(L, u, center(u, ox, oy));
    }
    // vector connector the export could not rasterize: a line with an arrowhead, pointing along the group rotation
    function makeConnector(comp, u, ox, oy, ctx) {
        var L = comp.layers.addShape(), g = vgroup(L), w = u.b[2], h = u.b[3], horiz = w >= h, rot = (ctx && ctx.rot) || 0, sh = new Shape(), ah = new Shape(), k = 7;
        var a = horiz ? [-w / 2, 0] : [0, -h / 2], b = horiz ? [w / 2, 0] : [0, h / 2];
        if (rot <= -135 || rot >= 135) { var t = a; a = b; b = t; }
        sh.vertices = [a, b]; sh.closed = false;
        g.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
        var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len;
        ah.vertices = [[b[0] - ux * k - uy * k, b[1] - uy * k + ux * k], b, [b[0] - ux * k + uy * k, b[1] - uy * k - ux * k]]; ah.closed = false;
        g.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(ah);
        paint(g, {}, (ctx && ctx.ink) || "#0a211f", 2);
        return finish(L, u, center(u, ox, oy));
    }
    function makeImage(comp, u, ox, oy) {
        var it = importOnce(u.file), L = comp.layers.add(it);
        tr(L, "ADBE Scale").setValue([u.b[2] / it.width * 100, u.b[3] / it.height * 100]);
        return finish(L, u, center(u, ox, oy));
    }
    function makeText(comp, u, ox, oy) {
        var segs = u.g instanceof Array ? u.g : [u.g], g0 = segs[0], lh = g0.lh || g0.z * 1.2, str = u.caps ? u.s.toUpperCase() : u.s;   // Figma text case UPPER
        var L = u.box ? comp.layers.addBoxText([u.b[2] + 14, Math.max(u.b[3] + lh, lh * 2)], str) : comp.layers.addText(str);
        var tp = L.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
        td.resetCharStyle(); td.font = font(g0.f); td.fontSize = g0.z; td.fillColor = hex(g0.c); td.applyFill = true; td.applyStroke = false;
        td.autoLeading = false; td.leading = lh;
        td.tracking = g0.ls ? g0.ls / g0.z * 1000 : 0;
        td.justification = u.al === "C" ? ParagraphJustification.CENTER_JUSTIFY : (u.al === "R" ? ParagraphJustification.RIGHT_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY);
        tp.setValue(td);
        if (segs.length > 1) {                            // mixed styles inside one text (AE 2024+ character ranges)
            try {
                td = tp.value;
                for (var i = 0; i < segs.length; i++) { var cr = td.characterRange(segs[i].i0, segs[i].i1); cr.font = font(segs[i].f); cr.fontSize = segs[i].z; cr.fillColor = hex(segs[i].c); }
                tp.setValue(td);
            } catch (e) {}
        }
        // anchor on the text extent: left (or center) edge, vertical middle, so it lines up with Figma's box
        var r = L.sourceRectAtTime(0, false), ax = r.left, px = u.b[0] - ox;
        if (u.al === "C") { ax = r.left + r.width / 2; px = u.b[0] - ox + u.b[2] / 2; }
        if (u.al === "R") { ax = r.left + r.width; px = u.b[0] - ox + u.b[2]; }
        if (u.box) {
            tr(L, "ADBE Anchor Point").setValue([ax, r.top + r.height / 2]);
            return finish(L, u, [px, u.b[1] - oy + u.b[3] / 2]);
        }
        // point text: anchor on the baseline and place it where Figma puts the first baseline in its line box
        var m = METRICS[g0.f.split("|")[0]] || [0.97, 0.24], base = (lh - (m[0] + m[1]) * g0.z) / 2 + m[0] * g0.z;
        tr(L, "ADBE Anchor Point").setValue([ax, 0]);
        return finish(L, u, [px, u.b[1] - oy + base]);
    }
    function makeNav(comp, u, slide, ox, oy, dark) {
        var X = [50, 238, 404, 641, 891], NAMES = ["01 Concept", "02 Script", "03 Look and feel", "04 Animation + AI", "05 Edit + post"], out = [];
        for (var i = 0; i < 5; i++) {
            var on = u.a === i + 1, col = on && dark ? "#d8ff85" : (dark ? "#f7f9f2" : "#0a211f");   // active stage is Spark on dark slides
            var d = makeShape(comp, on ? { n: "nav-dot-" + (i + 1), k: "e", b: [X[i], 55, 12, 12], f: { c: col } } : { n: "nav-dot-" + (i + 1), k: "e", b: [X[i], 55, 12, 12], st: { c: col }, sw: 1.5 }, ox, oy);
            var t = makeText(comp, { n: "nav-label-" + (i + 1), k: "t", s: NAMES[i], b: [X[i] + 24, 50, 160, 21], g: { f: on ? "Inter Tight|SemiBold" : "Inter Tight|Medium", z: 21, c: col, lh: 21 } }, ox, oy);
            reg(R.L, slide, "nav", d); reg(R.L, slide, "nav", t); out.push(d, t);
        }
        return out;
    }
    function precomp(name, w, h, dur) {
        var c = proj.items.addComp(name, Math.max(4, Math.ceil(w)), Math.max(4, Math.ceil(h)), 1, dur, FPS);
        c.parentFolder = folder; return c;
    }
    function roundMask(L, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2); var k = r * 0.5523, s = new Shape();
        s.vertices = [[x + r, y], [x + w - r, y], [x + w, y + r], [x + w, y + h - r], [x + w - r, y + h], [x + r, y + h], [x, y + h - r], [x, y + r]];
        s.inTangents = [[-k, 0], [0, 0], [0, -k], [0, 0], [k, 0], [0, 0], [0, k], [0, 0]];
        s.outTangents = [[0, 0], [k, 0], [0, 0], [0, k], [0, 0], [-k, 0], [0, 0], [0, -k]];
        s.closed = true;
        L.property("ADBE Mask Parade").addProperty("ADBE Mask Atom").property("ADBE Mask Shape").setValue(s);
    }
    function buildUnit(comp, u, ox, oy, ctx) {
        var L;
        if (u.k === "t") L = makeText(comp, u, ox, oy);
        else if (u.k === "img") L = u.file ? makeImage(comp, u, ox, oy) : makeConnector(comp, u, ox, oy, ctx);
        else if (u.k === "nav") return makeNav(comp, u, ctx.slide, ox, oy, ctx.dark);
        else if (u.k === "logo" || u.k === "footer") L = makeImage(comp, { n: "logo", file: u.file, b: u.k === "footer" ? [50, 1000, 150, 30] : u.b }, ox, oy);
        else if (u.k !== "r" || !u.c) L = makeShape(comp, u, ox, oy, ctx);
        else if (FLAT[u.n] && !u.f && !u.st && !u.r) {
            for (var i = 0; i < u.c.length; i++) buildUnit(comp, u.c[i], ox, oy, { slide: ctx.slide, ink: ctx.ink, dur: ctx.dur, group: ctx.group, rot: u.rot, inner: ctx.inner });
            return null;
        } else {                                          // a group → its own precomp, padded so blurs are not clipped
            var pad = Math.ceil(maxBlur(u) * 3) + 6, c = precomp(PFX + "el · S" + ctx.slide + " · " + u.n, u.b[2] + 2 * pad, u.b[3] + 2 * pad, ctx.dur);
            var ix = u.b[0] - pad, iy = u.b[1] - pad, sub = { slide: ctx.slide, ink: ctx.ink, dur: ctx.dur, group: u.n, rot: u.rot, inner: true };
            if (u.f || u.st) makeShape(c, { n: u.n + " · bg", k: "r", b: u.b, f: u.f, st: u.st, sw: u.sw, r: u.r, side: u.side }, ix, iy, sub);
            for (var j = 0; j < u.c.length; j++) {
                var ch = buildUnit(c, u.c[j], ix, iy, sub);
                if (ch) reg(R.inner, ctx.slide + "|" + u.n, u.c[j].n, ch);
            }
            L = comp.layers.add(c); L.name = u.n;
            tr(L, "ADBE Position").setValue(center(u, ox, oy));
            if (u.op !== undefined) tr(L, "ADBE Opacity").setValue(u.op * 100);
            if (u.r && !u.f) roundMask(L, pad, pad, u.b[2], u.b[3], u.r);
            if (!R.C[ctx.slide]) R.C[ctx.slide] = {};
            R.C[ctx.slide][u.n] = c;
        }
        if (!ctx.inner) reg(R.L, ctx.slide, u.n, L);
        return L;
    }
    function slideInk(s) {
        for (var i = 0; i < s.u.length; i++) if (s.u[i].k === "nav") return s.u[i].c;
        return s.bg && s.bg.toLowerCase() === "#f7f9f2" ? "#0a211f" : "#f7f9f2";
    }

    return {
        build: function (spec, opt) {
            opt = opt || {}; PFX = opt.prefix || PFX; FPS = spec.fps || FPS; ASSET_DIR = SS_ROOT + "/" + spec.assets;
            R = { comps: {}, L: {}, C: {}, inner: {} };
            for (var i = proj.numItems; i >= 1; i--) { var it = proj.item(i); if (it instanceof CompItem && it.name.indexOf(PFX) === 0) it.remove(); }
            for (var f = 1; f <= proj.numItems; f++) if (proj.item(f) instanceof FolderItem && proj.item(f).name === (opt.folder || "FIGMA SLIDES")) folder = proj.item(f);
            if (!folder) folder = proj.items.addFolder(opt.folder || "FIGMA SLIDES");
            for (var s = 0; s < spec.slides.length; s++) {
                var S = spec.slides[s], dur = S.dur + (opt.tail || 0), comp = precomp(PFX + "S" + S.slide, W, H, dur);
                comp.bgColor = hex(S.bg);
                var bg = comp.layers.addSolid(hex(S.bg), "bg", W, H, 1, dur); bg.locked = false;
                var bc = hex(S.bg), ctx = { slide: S.slide, ink: slideInk(S), dur: dur, dark: (bc[0] * 0.3 + bc[1] * 0.59 + bc[2] * 0.11) < 0.5 };
                for (var k = 0; k < S.u.length; k++) buildUnit(comp, S.u[k], 0, 0, ctx);
                R.comps[S.slide] = comp;
            }
            return R;
        },
        hex: hex,
        substitutions: function () { var a = []; for (var k in SUBST) if (SUBST.hasOwnProperty(k)) a.push(k + "→" + SUBST[k]); return a.join(", "); }
    };
})();
