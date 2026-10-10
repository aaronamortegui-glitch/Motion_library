// SS HUD — holographic, tracking-driven overlay components built on the SS Motion presets.
// Every component follows a tracked layer (usually a null "TRK <name>") through expressions,
// so it sticks to the footage. Colors and fonts come from the Figma palette and the tokens.
//
//   SSHUD.init(comp)                                  // once per comp
//   SSHUD.callout({ anchor: "TRK face", offset: [260, -180], title: "OUTFIT", lines: ["Wool three-piece suit", "Est. $1,200"], t0: 1.0 })
//   SSHUD.bracket({ anchor: "TRK face", size: [260, 320], t0: 0.4, label: "SUBJECT 01 · ANALYZING" })
//   SSHUD.meter({ at: [120, 900], label: "STYLE INDEX", value: 97, t0: 2.0 })
//   SSHUD.chip({ anchor: "TRK glass", offset: [0, -120], text: "18 YO SINGLE MALT", t0: 1.4, color: "coral" })
#include "ss_presets.jsx"

var SSHUD = (function () {
    var PAL = SSM.readJSON(SS_ROOT + "/assets/figma_essentials/palette.json").colors;
    var C = null;
    function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function col(name) { return name instanceof Array ? name : hex(PAL[name] || name); }   // palette name, hex or [r, g, b]
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
    // comp-space position of a tracked layer's anchor, as an expression
    function anchorExpr(anchor) { return 'var a = thisComp.layer("' + anchor + '"); a.toComp(a.transform.anchorPoint)'; }

    // Holographic look: glow + faint scanlines + subtle flicker (applied per layer, cheap to render)
    function holo(L, strength) {
        var fx = L.property("ADBE Effect Parade");
        var g = fx.addProperty("ADBE Glo2");
        g.name = "SS Holo Glow";
        g.property("ADBE Glo2-0002").setValue(40);                  // threshold %
        g.property("ADBE Glo2-0003").setValue(18 * (strength || 1)); // radius
        g.property("ADBE Glo2-0004").setValue(1.4);                 // intensity
        var v = fx.addProperty("ADBE Venetian Blinds");
        v.name = "SS Holo Scanlines";
        v.property("ADBE Venetian Blinds-0001").setValue(18);       // completion %
        v.property("ADBE Venetian Blinds-0002").setValue(90);       // direction
        v.property("ADBE Venetian Blinds-0003").setValue(4);        // width px
        tr(L, "ADBE Opacity").expression = "seedRandom(Math.floor(time*24), true); value * (random() < 0.04 ? 0.55 : 1);";
        return L;
    }
    function shape(name) {
        var L = C.layers.addShape(); L.name = name;
        tr(L, "ADBE Position").setValue([0, 0]);                    // paths are built in comp space
        return L;
    }
    function pathGroup(L, expr, strokeCol, width) {
        var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        g.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").expression = expr;
        var st = g.addProperty("ADBE Vector Graphic - Stroke");
        st.property("ADBE Vector Stroke Color").setValue(col(strokeCol));
        st.property("ADBE Vector Stroke Width").setValue(width || 2.5);
        st.property("ADBE Vector Stroke Line Cap").setValue(2);
        return g;
    }
    // Layout rule: a label never runs wider than `max` characters a line; it wraps into at most 3 stacked lines
    // (3 short lines read better than one line that leaves the frame or crosses a face).
    function wrap(lines, max) {
        if (!max) return lines;
        var out = [];
        for (var i = 0; i < lines.length; i++) {
            var ws = String(lines[i]).split(" "), cur = "";
            for (var j = 0; j < ws.length; j++) {
                if (cur && (cur + " " + ws[j]).length > max) { out.push(cur); cur = ws[j]; } else cur = cur ? cur + " " + ws[j] : ws[j];
            }
            if (cur) out.push(cur);
        }
        return out.slice(0, 3);
    }
    // Legibility rule: text over a bright or busy plate sits on a card (translucent pine + thin cloud border) that
    // follows the text layers' live bounds, so it fits whatever the text animators do.
    function card(name, layers, pad, t0, opacity) {
        var K = C.layers.addShape(); K.name = name;
        tr(K, "ADBE Position").setValue([0, 0]);
        var g = K.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var r = g.addProperty("ADBE Vector Shape - Rect");
        var names = []; for (var i = 0; i < layers.length; i++) names.push('"' + layers[i].name + '"');
        var bounds = "var n = [" + names.join(",") + "], x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;" +
            " for (var i = 0; i < n.length; i++) { var L = thisComp.layer(n[i]), b = L.sourceRectAtTime(time, false);" +
            " var a = L.toComp([b.left, b.top]), c = L.toComp([b.left + b.width, b.top + b.height]);" +
            " x0 = Math.min(x0, a[0], c[0]); y0 = Math.min(y0, a[1], c[1]); x1 = Math.max(x1, a[0], c[0]); y1 = Math.max(y1, a[1], c[1]); }";
        r.property("ADBE Vector Rect Size").expression = bounds + " [x1 - x0 + " + 2 * pad + ", y1 - y0 + " + 2 * pad + "];";
        r.property("ADBE Vector Rect Position").expression = bounds + " [(x0 + x1) / 2, (y0 + y1) / 2];";
        r.property("ADBE Vector Rect Roundness").setValue(10);
        var f = g.addProperty("ADBE Vector Graphic - Fill"); f.property("ADBE Vector Fill Color").setValue(col("pine"));
        f.property("ADBE Vector Fill Opacity").setValue(opacity || 78);
        var st = g.addProperty("ADBE Vector Graphic - Stroke"); st.property("ADBE Vector Stroke Color").setValue(col("cloud"));
        st.property("ADBE Vector Stroke Width").setValue(2);
        for (var k = 0; k < layers.length; k++) if (layers[k].index > K.index) K.moveAfter(layers[k]);
        SSP.apply(K, "Fade", "in", t0);
        return K;
    }
    function text(name, str, role, size, color, tracking, just) {
        var L = C.layers.addText(str); L.name = name;
        var tp = L.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
        td.resetCharStyle(); td.font = role.indexOf("-") > 0 ? role : SSM.font(role); td.fontSize = size; td.fillColor = col(color); td.applyFill = true;
        td.justification = just || ParagraphJustification.LEFT_JUSTIFY;
        if (tracking) td.tracking = tracking;
        tp.setValue(td);
        return L;
    }

    return {
        palette: PAL,
        init: function (comp) { C = comp; },

        // Dot on the tracked point + elbow leader line + title/body text block at the end of the line.
        callout: function (o) {
            var color = o.color || "spark", t0 = o.t0 || 0, dx = o.offset[0], dy = o.offset[1];
            var right = dx >= 0, id = o.id || o.title;
            var dot = shape("HUD dot · " + id);
            var dg = dot.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
            dg.addProperty("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").setValue([18, 18]);
            var ds = dg.addProperty("ADBE Vector Graphic - Stroke");
            ds.property("ADBE Vector Stroke Color").setValue(col(color)); ds.property("ADBE Vector Stroke Width").setValue(3);
            dg.addProperty("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").setValue([6, 6]);
            dg.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(col(color));
            tr(dot, "ADBE Position").expression = anchorExpr(o.anchor);
            SSP.apply(dot, o.instant ? "Fade" : "Scale Pop", "in", t0);

            var line = shape("HUD line · " + id);
            pathGroup(line, 'var a = thisComp.layer("' + o.anchor + '"); var p = a.toComp(a.transform.anchorPoint);' +
                " var e = [" + dx * 0.55 + "," + dy + "], f = [" + dx + "," + dy + "];" +
                " createPath([p, p + e, p + f], [], [], false);", color, 2.5);
            SSP.apply(line, o.instant ? "Fade" : "Organic Draw", "in", o.instant ? t0 : t0 + SSM.seconds("Tick"));

            // text block anchored at the end of the line
            var tx = right ? 14 : -14, just = right ? ParagraphJustification.LEFT_JUSTIFY : ParagraphJustification.RIGHT_JUSTIFY;
            var title = text("HUD title · " + id, o.title, "ui", o.titleSize || 26, color, 160, just);
            tr(title, "ADBE Position").expression = anchorExpr(o.anchor) + " + [" + (dx + tx) + "," + (dy - 12) + "];";
            // instant: everything readable from the first frame (short shots, labels that must be read at once)
            var tIn = o.instant ? t0 : t0 + SSM.seconds("Glide");
            if (o.instant) SSP.apply(title, "Fade", "in", t0); else SSP.applyText(title, "Tracking Settle", "in", tIn);
            var ts = o.titleSize || 26, bs = o.bodySize || 24;
            var body = text("HUD body · " + id, wrap(o.lines, o.wrap || 22).join("\r"), o.bodyFont || "ui_regular", bs, o.bodyColor || "cloud", 20, just);
            tr(body, "ADBE Position").expression = anchorExpr(o.anchor) + " + [" + (dx + tx) + "," + Math.round(dy - 12 + ts * 0.45 + bs * 1.15) + "];";
            if (o.instant) SSP.apply(body, "Fade", "in", t0); else SSP.applyText(body, "Words Fade Up", "in", tIn + SSM.seconds("Tick"));
            var layers = [dot, line, title, body];
            for (var i = 0; i < layers.length; i++) holo(layers[i], 0.8);
            if (o.card) layers.push(card("HUD card · " + id, [title, body], 18, tIn - 0.05));
            return layers;
        },

        // Four corner brackets around a tracked point + a scan line sweeping inside + label.
        bracket: function (o) {
            var color = o.color || "spark", t0 = o.t0 || 0, w = o.size[0] / 2, h = o.size[1] / 2, k = Math.min(w, h) * 0.28;
            var id = o.id || o.anchor;
            var B = shape("HUD bracket · " + id);
            var corners = [[-w, -h, 1, 1], [w, -h, -1, 1], [w, h, -1, -1], [-w, h, 1, -1]];
            for (var i = 0; i < corners.length; i++) {
                var c = corners[i];
                pathGroup(B, anchorExpr(o.anchor) + "; var p = a.toComp(a.transform.anchorPoint), s = a.transform.scale[0]/100, c = [" + c[0] + "," + c[1] + "]*s;" +
                    " createPath([p + c + [" + (c[2] * k) + ",0]*s, p + c, p + c + [0," + (c[3] * k) + "]*s], [], [], false);", color, 3);
            }
            SSP.apply(B, "Scale Pop", "in", t0);
            var S = shape("HUD scan · " + id);
            pathGroup(S, anchorExpr(o.anchor) + "; var p = a.toComp(a.transform.anchorPoint), s = a.transform.scale[0]/100;" +
                " var y = (" + -h + " + ((time*" + (o.scanSpeed || 0.9) + ") % 1) * " + (2 * h) + ") * s;" +
                " createPath([p + [" + -w * 0.92 + "*s, y], p + [" + w * 0.92 + "*s, y]], [], [], false);", color, 1.5);
            tr(S, "ADBE Opacity").setValue(60);
            S.inPoint = t0 + SSM.seconds("Arrive");
            var layers = [B, S];
            var KL = null;
            if (o.label) {
                // label lines (an array, or a string wrapped at o.wrap chars); side "top" (default), "bottom", "left" or "right"
                var ls = o.labelSize || 18, lines = o.label instanceof Array ? o.label : wrap([o.label], o.wrap || 0);
                var side = o.labelSide || "top", lj = (side === "left" || o.labelAlign === "right") ? ParagraphJustification.RIGHT_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY;
                var L = text("HUD bracket label · " + id, lines.join("\r"), o.labelFont || "ui", ls, color, o.labelTracking === undefined ? 220 : o.labelTracking, lj);
                var off = side === "left" ? [-w - 24, -h + ls] : side === "right" ? [w + 24, -h + ls] : side === "bottom" ? [o.labelAlign === "right" ? w : -w, h + ls + 14] : [-w, -h - 16 - (lines.length - 1) * ls * 1.2];
                tr(L, "ADBE Position").expression = anchorExpr(o.anchor) + " + [" + off[0] + "," + off[1] + "]*thisComp.layer(\"" + o.anchor + "\").transform.scale[0]/100 - [0, " + (o.labelLift || 0) + "];";   // labelLift: clear the object the bracket frames
                SSP.applyText(L, "Tracking Settle", "in", t0 + SSM.seconds("Glide"));
                layers.push(L);
                if (o.card) KL = card("HUD card · " + id, [L], 16, t0 + SSM.seconds("Glide") - 0.05);
            }
            for (var j = 0; j < layers.length; j++) holo(layers[j], 1);
            if (KL) layers.push(KL);
            return layers;
        },

        // Fixed bar meter with a counting percentage (e.g. STYLE INDEX 97%).
        meter: function (o) {
            var color = o.color || "spark", t0 = o.t0 || 0, W = o.width || 360, id = o.label;
            var bg = C.layers.addShape(); bg.name = "HUD meter bg · " + id;
            var g = bg.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
            var r = g.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([W, 6]);
            g.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(col("cloud"));
            tr(bg, "ADBE Position").setValue([o.at[0] + W / 2, o.at[1] + 30]); tr(bg, "ADBE Opacity").setValue(25);
            SSP.apply(bg, "Wipe Reveal", "in", t0);
            var fill = C.layers.addShape(); fill.name = "HUD meter fill · " + id;
            var gf = fill.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
            var rf = gf.addProperty("ADBE Vector Shape - Rect"); rf.property("ADBE Vector Rect Size").setValue([W, 6]);
            gf.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(col(color));
            tr(fill, "ADBE Anchor Point").setValue([-W / 2, 0]);
            tr(fill, "ADBE Position").setValue([o.at[0], o.at[1] + 30]);
            SSM.animate(tr(fill, "ADBE Scale"), t0 + SSM.seconds("Glide"), [0, 100, 100], [o.value, 100, 100], "Stage", "Settle");
            var lab = text("HUD meter label · " + id, o.label, "ui", 20, color, 200);
            tr(lab, "ADBE Position").setValue([o.at[0], o.at[1]]);
            SSP.applyText(lab, "Tracking Settle", "in", t0);
            var num = text("HUD meter value · " + id, "0%", "ui", 20, "cloud", 60, ParagraphJustification.RIGHT_JUSTIFY);
            tr(num, "ADBE Position").setValue([o.at[0] + W, o.at[1]]);
            num.property("ADBE Text Properties").property("ADBE Text Document").expression =
                'var s = thisComp.layer("HUD meter fill · ' + id + '").transform.scale[0]; Math.round(s) + "%";';
            SSP.apply(num, "Fade", "in", t0 + SSM.seconds("Glide"));
            var layers = [bg, fill, lab, num];
            for (var i = 0; i < layers.length; i++) holo(layers[i], 0.6);
            return layers;
        },

        // Figma-style pill chip (Cloud/Coral/Spark) that sticks to a tracked point.
        chip: function (o) {
            var fillName = o.color || "cloud", t0 = o.t0 || 0, ts = o.textSize || 20, h = Math.round(ts * 2.3), w = o.width || (o.text.length * ts * 0.65 + ts * 2.2);
            var P = C.layers.addShape(); P.name = "HUD chip · " + o.text;
            var g = P.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
            var r = g.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([w, h]); r.property("ADBE Vector Rect Roundness").setValue(h / 2);
            g.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(col(fillName));
            tr(P, "ADBE Position").expression = o.anchor ? anchorExpr(o.anchor) + " + [" + o.offset[0] + "," + o.offset[1] + "];" : "[" + o.at[0] + "," + o.at[1] + "]";
            var T = text("HUD chip text · " + o.text, o.text, "ui", ts, "pine", 80, ParagraphJustification.CENTER_JUSTIFY);
            T.parent = P; tr(T, "ADBE Position").setValue([0, ts * 0.35]);
            SSP.apply(P, "Scale Pop", "in", t0);
            return [P, T];
        },

        // Organic contour lines that draw on around a subject. Data: tools/matte_contours.py JSON (one path per frame).
        // o = { file: "media/whisky/clip01_contours.json", key: "c0", t0, color, width, wiggle, offsetLine }
        contour: function (o) {
            var D = SSM.readJSON(SS_ROOT + "/" + o.file), frames = D.contours[o.key], fd = 1 / D.fps;
            var sx = C.width / D.size[0], sy = C.height / D.size[1], color = o.color || "spark";
            var L = C.layers.addShape(); L.name = "HUD contour · " + o.key;
            tr(L, "ADBE Position").setValue([0, 0]);
            var grp = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
            grp.name = "Contour";
            var v = grp.property("ADBE Vectors Group");
            var path = v.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape");
            var times = [], shapes = [];
            for (var f = 0; f < frames.length; f++) {
                var pts = frames[f], verts = [];
                for (var p = 0; p < pts.length; p++) verts.push([pts[p][0] * sx, pts[p][1] * sy]);
                var sh = new Shape(); sh.vertices = verts; sh.closed = true;
                times.push(f * fd); shapes.push(sh);
            }
            path.setValuesAtTimes(times, shapes);
            var st = v.addProperty("ADBE Vector Graphic - Stroke");
            st.property("ADBE Vector Stroke Color").setValue(col(color));
            st.property("ADBE Vector Stroke Width").setValue(o.width || 3);
            st.property("ADBE Vector Stroke Line Join").setValue(2);
            st.property("ADBE Vector Stroke Line Cap").setValue(2);
            // hand-drawn feel: gentle wiggle on the path
            var wg = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Filter - Roughen");   // "Wiggle Paths"
            wg.property("ADBE Vector Roughen Size").setValue(o.wiggle === undefined ? 4 : o.wiggle);
            wg.property("ADBE Vector Roughen Detail").setValue(4);
            wg.property("ADBE Vector Roughen Points").setValue(2);                                          // smooth points
            wg.property("ADBE Vector Temporal Freq").setValue(1.2);
            SSP.apply(L, o.draw || "Organic Draw", "in", o.t0 || 0);
            var layers = [L];
            if (o.offsetLine !== false) {   // second, thinner line slightly outside the silhouette
                var L2 = L.duplicate(); L2.name = "HUD contour echo · " + o.key;
                var off = L2.property("ADBE Root Vectors Group").addProperty("ADBE Vector Filter - Offset");
                off.property("ADBE Vector Offset Amount").setValue(o.echoOffset || 10);
                L2.property("ADBE Root Vectors Group").property("Contour").property("ADBE Vectors Group")
                    .property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Width").setValue(1.2);
                tr(L2, "ADBE Opacity").setValue(55);
                L2.startTime = L2.startTime + SSM.seconds("Glide");
                layers.push(L2);
            }
            for (var i = 0; i < layers.length; i++) holo(layers[i], 0.7);
            if (o.glow) for (var gi = 0; gi < layers.length; gi++) {   // "lit" outline: a strong halo of light around the subject
                var gg = layers[gi].property("ADBE Effect Parade").addProperty("ADBE Glo2"); gg.name = "SS Halo";
                gg.property("ADBE Glo2-0002").setValue(10); gg.property("ADBE Glo2-0003").setValue(o.glow); gg.property("ADBE Glo2-0004").setValue(2.2);
            }
            if (o.t1) for (var oi = 0; oi < layers.length; oi++) layers[oi].outPoint = o.t1;
            return layers;
        },

        // God rays: thin beams of light fanning out from behind a tracked point (a holy, "the answer has arrived" moment).
        // Put it between the plate and the people matte so the beams come from behind the person.
        // o = { anchor, t0, t1, count, length, width, color, opacity, spin }
        rays: function (o) {
            var n = o.count || 22, len = o.length || 1500, wid = o.width || 7, t0 = o.t0 || 0;
            var L = C.layers.addShape(); L.name = "HUD rays · " + (o.id || o.anchor);
            var root = L.property("ADBE Root Vectors Group");
            for (var i = 0; i < n; i++) {
                var a = i * 2 * Math.PI / n, a2 = a + (wid + (i % 3) * 3) * Math.PI / 180, l = len * (0.7 + 0.3 * ((i * 7) % 5) / 4);
                var g = root.addProperty("ADBE Vector Group").property("ADBE Vectors Group"), sh = new Shape();
                sh.vertices = [[0, 0], [Math.cos(a) * l, Math.sin(a) * l], [Math.cos(a2) * l, Math.sin(a2) * l]]; sh.closed = true;
                g.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
            }
            root.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(col(o.color || "cloud"));   // gradients are not scriptable: blur does the falloff
            tr(L, "ADBE Position").expression = anchorExpr(o.anchor);
            tr(L, "ADBE Rotate Z").expression = "time * " + (o.spin || 8) + ";";
            L.blendingMode = BlendingMode.ADD;
            var fx = L.property("ADBE Effect Parade"), b = fx.addProperty("ADBE Gaussian Blur 2"); b.property(1).setValue(o.blur || 18);
            var gl = fx.addProperty("ADBE Glo2"); gl.property("ADBE Glo2-0003").setValue(40); gl.property("ADBE Glo2-0004").setValue(0.7);
            var op = tr(L, "ADBE Opacity"), peak = o.opacity || 75;
            SSM.animateRaw(op, t0, t0 + 0.5, 0, peak, SSM.ease("Land"));
            SSM.animateRaw(tr(L, "ADBE Scale"), t0, t0 + 0.9, [20, 20, 100], [100, 100, 100], SSM.ease("Settle"));
            L.inPoint = t0; if (o.t1) L.outPoint = o.t1;
            return [L];
        },

        // Glow: a soft pool of light behind a tracked person (backlight, "the answer has arrived"), between plate and matte.
        // o = { anchor, t0, t1, size: [w, h], color, opacity, pulse }
        glow: function (o) {
            // a radial Gradient Ramp on an oversized solid, added on top: soft to the edge (a blurred shape layer gets
            // clipped to its bounds and shows a hard rectangle)
            var t0 = o.t0 || 0, sz = o.size || [700, 900], D = Math.round(Math.max(sz[0], sz[1]) * 2.4);
            var L = C.layers.addSolid([0, 0, 0], "HUD glow · " + (o.id || o.anchor), D, D, 1);
            var rp = L.property("ADBE Effect Parade").addProperty("ADBE Ramp");
            rp.property("ADBE Ramp-0001").setValue([D / 2, D / 2]); rp.property("ADBE Ramp-0002").setValue(col(o.color || "cloud"));
            rp.property("ADBE Ramp-0003").setValue([D / 2 + D * 0.42, D / 2]); rp.property("ADBE Ramp-0004").setValue([0, 0, 0]);
            rp.property("ADBE Ramp-0005").setValue(2);   // radial
            tr(L, "ADBE Position").expression = anchorExpr(o.anchor) + (o.offset ? " + [" + o.offset[0] + "," + o.offset[1] + "]" : "");
            L.blendingMode = BlendingMode.ADD;
            var k = Math.min(sz[0], sz[1]) / Math.max(sz[0], sz[1]) * 100, sx = sz[0] < sz[1] ? k : 100, sy = sz[0] < sz[1] ? 100 : k;
            SSM.animateRaw(tr(L, "ADBE Opacity"), t0, t0 + 0.7, 0, o.opacity || 70, SSM.ease("Land"));
            SSM.animateRaw(tr(L, "ADBE Scale"), t0, t0 + 1.0, [sx * 0.6, sy * 0.6, 100], [sx, sy, 100], SSM.ease("Settle"));
            if (o.pulse !== false) tr(L, "ADBE Scale").expression = "value * (1 + 0.03 * Math.sin(time * 2.2));";
            L.inPoint = t0; if (o.t1) L.outPoint = o.t1;
            return [L];
        },

        // Burst: radial action lines that shoot out from a tracked point when something great happens (manga emphasis).
        // o = { anchor, t0, count, r0, r1, width, color, repeat, every }
        burst: function (o) {
            var n = o.count || 14, r0 = o.r0 || 110, r1 = o.r1 || 380, made = [];
            for (var k = 0; k < (o.repeat || 1); k++) {
                var t0 = (o.t0 || 0) + k * (o.every || 0.45), L = C.layers.addShape(); L.name = "HUD burst · " + (o.id || o.anchor) + " " + (k + 1);
                var root = L.property("ADBE Root Vectors Group");
                for (var i = 0; i < n; i++) {
                    var a = (i + 0.5 * k) * 2 * Math.PI / n, rr = r1 * (0.8 + 0.2 * ((i * 5) % 3) / 2);
                    var g = root.addProperty("ADBE Vector Group").property("ADBE Vectors Group"), sh = new Shape();
                    sh.vertices = [[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * rr, Math.sin(a) * rr]]; sh.closed = false;
                    g.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
                }
                var st = root.addProperty("ADBE Vector Graphic - Stroke");
                st.property("ADBE Vector Stroke Color").setValue(col(o.color || "spark")); st.property("ADBE Vector Stroke Width").setValue(o.width || 7);
                st.property("ADBE Vector Stroke Line Cap").setValue(2);
                var tp = root.addProperty("ADBE Vector Filter - Trim");
                SSM.animateRaw(tp.property("ADBE Vector Trim End"), t0, t0 + 0.22, 0, 100, SSM.ease("Launch"));
                SSM.animateRaw(tp.property("ADBE Vector Trim Start"), t0 + 0.12, t0 + 0.42, 0, 100, SSM.ease("Land"));
                tr(L, "ADBE Position").expression = anchorExpr(o.anchor) + (o.offset ? " + [" + o.offset[0] + "," + o.offset[1] + "]" : "");
                L.inPoint = t0; L.outPoint = t0 + 0.5;
                made.push(L);
            }
            return made;   // solid colour, no holo: action lines must read at a glance
        },

        // Face scan "slice": a band sweeps the face; inside it the plate is shifted sideways (a cut) and an
        // edge-detected holographic copy of the face shows through. Needs a footage layer named o.plate (default "Plate").
        faceScan: function (o) {
            var t0 = o.t0 || 0, w = o.size[0], h = o.size[1], speed = o.speed || 0.7, color = o.color || "spark";
            var plate = C.layer(o.plate || "Plate");
            function band(name, frac) {
                var B = C.layers.addShape(); B.name = name;
                tr(B, "ADBE Position").setValue([0, 0]);
                var g = B.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
                var r = g.addProperty("ADBE Vector Shape - Rect");
                r.property("ADBE Vector Rect Size").expression = 'var s = thisComp.layer("' + o.anchor + '").transform.scale[0]/100; [' + w + "*s, " + (h * frac) + "*s]";
                r.property("ADBE Vector Rect Position").expression = anchorExpr(o.anchor) + "; var s = a.transform.scale[0]/100;" +
                    " var u = ((time - " + t0 + ") * " + speed + ") % 1; a.toComp(a.transform.anchorPoint) + [0, (-" + h / 2 + " + u * " + h + ") * s]";
                g.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue([1, 1, 1]);
                B.inPoint = t0;
                return B;
            }
            // 1) slice: plate copy shifted sideways inside a thin band
            var slice = plate.duplicate(); slice.name = "HUD face slice · " + o.anchor;
            slice.moveToBeginning();
            tr(slice, "ADBE Position").expression = "value + [" + (o.shift || 18) + ", 0]";
            var b1 = band("HUD face slice matte · " + o.anchor, 0.12);
            b1.moveBefore(slice);
            slice.setTrackMatte(b1, TrackMatteType.ALPHA);
            b1.enabled = false;
            slice.inPoint = t0;
            // 2) holographic edges of the face inside a taller band
            var edges = plate.duplicate(); edges.name = "HUD face edges · " + o.anchor;
            edges.moveToBeginning();
            var fx = edges.property("ADBE Effect Parade");
            var fe = fx.addProperty("ADBE Find Edges"); fe.property("Invert").setValue(1);   // invert → bright edges on black
            var th = fx.addProperty("ADBE Threshold2"); th.property(1).setValue(o.edgeThreshold || 150);  // keep only strong edges
            var tint = fx.addProperty("ADBE Tint");
            tint.property("ADBE Tint-0002").setValue(col(color));                                    // map white to → Spark
            edges.blendingMode = BlendingMode.SCREEN;
            tr(edges, "ADBE Opacity").setValue(70);
            var b2 = band("HUD face edges matte · " + o.anchor, 0.34);
            b2.moveBefore(edges);
            edges.setTrackMatte(b2, TrackMatteType.ALPHA);
            b2.enabled = false;
            edges.inPoint = t0;
            holo(edges, 0.5);
            return [slice, b1, edges, b2];
        },

        // Floating holographic screen that plays a library preview comp in a loop, pinned to a tracked point.
        // o = { anchor: "TRK window", offset: [dx, dy], comp: "GIF__motion__Scale Pop", w: 300, label: "Scale Pop", t0, color }
        panel: function (o) {
            var src = null;
            for (var i = 1; i <= app.project.numItems; i++) if (app.project.item(i).name === o.comp) src = app.project.item(i);
            if (!(src instanceof CompItem)) return [];
            var t0 = o.t0 || 0, w = o.w || 300, h = w * src.height / src.width, color = o.color || "spark";
            var k = w / src.width * 100;
            var posExpr = 'var a = thisComp.layer("' + o.anchor + '"), s = a.transform.scale[0]/100; a.toComp(a.transform.anchorPoint) + [' + o.offset[0] + "," + o.offset[1] + "]*s";
            var sclExpr = 'var s = thisComp.layer("' + o.anchor + '").transform.scale[0]/100; ';
            var N = C.layers.add(src); N.name = "HUD panel · " + (o.label || o.comp);
            N.timeRemapEnabled = true;
            N.property("ADBE Time Remapping").expression = "(time - inPoint) % source.duration";
            N.inPoint = t0; N.outPoint = C.duration;
            tr(N, "ADBE Position").expression = posExpr;
            tr(N, "ADBE Scale").expression = sclExpr + "var v = value; [v[0]*s, v[1]*s]";
            tr(N, "ADBE Scale").setValue([k, k, 100]);
            var F = C.layers.addShape(); F.name = "HUD panel frame · " + (o.label || o.comp);
            var g = F.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
            var r = g.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([w + 14, h + 14]); r.property("ADBE Vector Rect Roundness").setValue(10);
            var st = g.addProperty("ADBE Vector Graphic - Stroke");
            st.property("ADBE Vector Stroke Color").setValue(col(color)); st.property("ADBE Vector Stroke Width").setValue(2.5);
            tr(F, "ADBE Position").expression = posExpr;
            tr(F, "ADBE Scale").expression = sclExpr + "[100*s, 100*s]";
            F.inPoint = t0;
            SSP.apply(F, "Scale Pop", "in", t0);
            SSP.apply(N, "Fade", "in", t0 + SSM.seconds("Tick"));
            var layers = [N, F];
            if (o.label) {
                var T = text("HUD panel label · " + o.label, o.label.toUpperCase(), "ui", 18, color, 160, ParagraphJustification.CENTER_JUSTIFY);
                tr(T, "ADBE Position").expression = posExpr + " + [0, " + (h / 2 + 34) + "]*s";
                tr(T, "ADBE Scale").expression = sclExpr + "[100*s, 100*s]";
                T.inPoint = t0;
                SSP.applyText(T, "Tracking Settle", "in", t0 + SSM.seconds("Glide"));
                layers.push(T);
            }
            holo(F, 1);   // glow only on the frame: glowing the preview itself washes out its Pine background
            if (layers[2]) holo(layers[2], 0.5);
            return layers;
        },

        holo: holo
    };
})();
