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
    function col(name) { return hex(PAL[name] || name); }
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
    function text(name, str, role, size, color, tracking, just) {
        var L = C.layers.addText(str); L.name = name;
        var tp = L.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
        td.resetCharStyle(); td.font = SSM.font(role); td.fontSize = size; td.fillColor = col(color); td.applyFill = true;
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
            SSP.apply(dot, "Scale Pop", "in", t0);

            var line = shape("HUD line · " + id);
            pathGroup(line, 'var a = thisComp.layer("' + o.anchor + '"); var p = a.toComp(a.transform.anchorPoint);' +
                " var e = [" + dx * 0.55 + "," + dy + "], f = [" + dx + "," + dy + "];" +
                " createPath([p, p + e, p + f], [], [], false);", color, 2.5);
            SSP.apply(line, "Line Draw", "in", t0 + SSM.seconds("Tick"));

            // text block anchored at the end of the line
            var tx = right ? 14 : -14, just = right ? ParagraphJustification.LEFT_JUSTIFY : ParagraphJustification.RIGHT_JUSTIFY;
            var title = text("HUD title · " + id, o.title, "ui", o.titleSize || 26, color, 160, just);
            tr(title, "ADBE Position").expression = anchorExpr(o.anchor) + " + [" + (dx + tx) + "," + (dy - 12) + "];";
            var tIn = t0 + SSM.seconds("Glide");
            SSP.applyText(title, "Tracking Settle", "in", tIn);
            var body = text("HUD body · " + id, o.lines.join("\r"), "ui_regular", o.bodySize || 24, o.bodyColor || "cloud", 20, just);
            tr(body, "ADBE Position").expression = anchorExpr(o.anchor) + " + [" + (dx + tx) + "," + (dy + 26) + "];";
            SSP.applyText(body, "Words Fade Up", "in", tIn + SSM.seconds("Tick"));
            var layers = [dot, line, title, body];
            for (var i = 0; i < layers.length; i++) holo(layers[i], 0.8);
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
            if (o.label) {
                var L = text("HUD bracket label · " + id, o.label, "ui", 18, color, 220);
                tr(L, "ADBE Position").expression = anchorExpr(o.anchor) + " + [" + -w + "," + (-h - 16) + "]*thisComp.layer(\"" + o.anchor + "\").transform.scale[0]/100;";
                SSP.applyText(L, "Tracking Settle", "in", t0 + SSM.seconds("Glide"));
                layers.push(L);
            }
            for (var j = 0; j < layers.length; j++) holo(layers[j], 1);
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
            var fillName = o.color || "cloud", t0 = o.t0 || 0, h = 46, w = o.width || (o.text.length * 13 + 44);
            var P = C.layers.addShape(); P.name = "HUD chip · " + o.text;
            var g = P.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
            var r = g.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([w, h]); r.property("ADBE Vector Rect Roundness").setValue(h / 2);
            g.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(col(fillName));
            tr(P, "ADBE Position").expression = o.anchor ? anchorExpr(o.anchor) + " + [" + o.offset[0] + "," + o.offset[1] + "];" : "[" + o.at[0] + "," + o.at[1] + "]";
            var T = text("HUD chip text · " + o.text, o.text, "ui", 20, "pine", 80, ParagraphJustification.CENTER_JUSTIFY);
            T.parent = P; tr(T, "ADBE Position").setValue([0, 7]);
            SSP.apply(P, "Scale Pop", "in", t0);
            return [P, T];
        },

        holo: holo
    };
})();
