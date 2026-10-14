// SS Shapes — animated shape primitives and lines (behavior modelled on Animation Composer's Shapes & Lines packs,
// rebuilt from scratch as native shape layers). Each shape is one layer with its own controls: Reveal (0-100, keyed
// with Motion DNA token curves, so Pop overshoots and Wind-up anticipates), Size (px), Stroke (px, kept constant at any
// size), Color 1 / Color 2. The geometry is drawn at a 100 px base and scaled by Size.
//
// Usage: #include "ss_presets.jsx" (token timing) then #include "ss_shapes.jsx"
//        SSS.add(comp, "star", {position: [960, 540], size: 220, anim: "pop", t: 0.5});
//        SSS.add(comp, "burst", {anim: "burst", colors: ["#D8FF85"], t: 1});
//        SSS.kinds → every kind; SSS.anims → draw | pop | spin | burst | pulse
// Options: t (in, s), out (exit, s), position [x, y], size (px), stroke (px), style (fill | outline | dotted),
//          anim, ease (curve token, default per anim), dur (duration token), colors [c1, c2] (hex), count (rays,
//          rings, chevrons, confetti pieces…), loop (true: keep moving after the reveal: spin, pulse, flow).
if (typeof SSB === "undefined") $.evalFile(new File(File($.fileName).parent.fsName + "/ss_behaviors.jsx"));   // the shared blob() and behaviours
var SSS = (function () {
    var DEF = ["#D8FF85", "#F7F9F2"];
    var ANIMS = { draw: ["Sweep", "Cruise"], pop: ["Arrive", "Pop"], spin: ["Sweep", "Nudge"], burst: ["Sweep", "Launch"], pulse: ["Arrive", "Pop"] };

    function rgb(hex) { var h = String(hex).replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function uniqueName(comp, base) {
        for (var n = 1; ; n++) { var name = base + " " + n, used = false;
            for (var i = 1; i <= comp.numLayers; i++) if (comp.layer(i).name === name) { used = true; break; }
            if (!used) return name; }
    }
    function control(L, type, name, value) {
        var fx = L.property("ADBE Effect Parade").addProperty(type); fx.name = name;
        if (value !== undefined) fx.property(1).setValue(value);
    }
    function root(L) { return L.property("ADBE Root Vectors Group"); }
    function group(parent, name) { var g = parent.addProperty("ADBE Vector Group"); g.name = name; return g; }
    function vectors(g) { return g.property("ADBE Vectors Group"); }
    // a path from points; smooth = automatic tangents (Catmull-Rom style) for curves drawn from samples
    function path(v, pts, closed, smooth) {
        var s = new Shape(), ins = [], outs = [];
        for (var i = 0; i < pts.length; i++) {
            if (!smooth) { ins.push([0, 0]); outs.push([0, 0]); continue; }
            var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
            if (closed) { a = pts[(i - 1 + pts.length) % pts.length]; b = pts[(i + 1) % pts.length]; }
            var tx = (b[0] - a[0]) / 6, ty = (b[1] - a[1]) / 6;
            ins.push([-tx, -ty]); outs.push([tx, ty]);
        }
        s.vertices = pts; s.inTangents = ins; s.outTangents = outs; s.closed = !!closed;
        var p = v.addProperty("ADBE Vector Shape - Group"); p.property("ADBE Vector Shape").setValue(s);
        return p;
    }
    function ellipse(v, d) { var e = v.addProperty("ADBE Vector Shape - Ellipse"); e.property("ADBE Vector Ellipse Size").setValue([d, d]); return e; }
    function rect(v, w, h, r) { var e = v.addProperty("ADBE Vector Shape - Rect"); e.property("ADBE Vector Rect Size").setValue([w, h]); if (r) e.property("ADBE Vector Rect Roundness").setValue(r); return e; }
    function star(v, points, outer, inner, kind, rot) {
        var s = v.addProperty("ADBE Vector Shape - Star");
        s.property("ADBE Vector Star Type").setValue(kind === "polygon" ? 2 : 1);
        s.property("ADBE Vector Star Points").setValue(points);
        s.property("ADBE Vector Star Outer Radius").setValue(outer);
        if (kind !== "polygon") s.property("ADBE Vector Star Inner Radius").setValue(inner);
        if (rot) s.property("ADBE Vector Star Rotation").setValue(rot);
        return s;
    }
    // paint: fill and/or stroke on a vectors group, colours and width driven by the layer's controls
    function paint(v, style, colorIdx, opts) {
        opts = opts || {};
        if (style === "fill") {
            var f = v.addProperty("ADBE Vector Graphic - Fill");
            f.property("ADBE Vector Fill Color").expression = 'effect("Color ' + colorIdx + '")("Color")';
            return f;
        }
        var s = v.addProperty("ADBE Vector Graphic - Stroke");
        s.property("ADBE Vector Stroke Color").expression = 'effect("Color ' + colorIdx + '")("Color")';
        // the base geometry is scaled by Size: divide so the on-screen stroke stays at the Stroke value
        s.property("ADBE Vector Stroke Width").expression = 'effect("Stroke")("Slider") * 100 / Math.max(effect("Size")("Slider"), 1)' + (opts.widthMul ? ' * ' + opts.widthMul : '') + (opts.breathe ? WIDTH_BREATH : '');
        s.property("ADBE Vector Stroke Line Cap").setValue(2);    // round
        s.property("ADBE Vector Stroke Line Join").setValue(2);
        if (style === "dotted") {
            try {
                var dash = s.property("ADBE Vector Stroke Dashes");
                dash.addProperty("ADBE Vector Stroke Dash 1").setValue(0.01);
                dash.addProperty("ADBE Vector Stroke Gap 1").expression = 'effect("Stroke")("Slider") * 2.4 * 100 / Math.max(effect("Size")("Slider"), 1)';
            } catch (e) {}
        }
        if (opts.taper) {   // brush stroke: thin ends (AE 2020+)
            try { var tp = s.property("ADBE Vector Stroke Taper"); tp.property("ADBE Vector Taper Start Length").setValue(40); tp.property("ADBE Vector Taper End Length").setValue(55); } catch (e2) {}
        }
        return s;
    }
    function trim(v, endExpr, startExpr, offsetExpr) {
        var t = v.addProperty("ADBE Vector Filter - Trim");
        if (endExpr) t.property("ADBE Vector Trim End").expression = endExpr;
        if (startExpr) t.property("ADBE Vector Trim Start").expression = startExpr;
        if (offsetExpr) t.property("ADBE Vector Trim Offset").expression = offsetExpr;
        return t;
    }
    function repeater(v, copies, rot, pos, endOpacity) {
        var r = v.addProperty("ADBE Vector Filter - Repeater");
        r.property("ADBE Vector Repeater Copies").setValue(copies);
        var tr = r.property("ADBE Vector Repeater Transform");
        tr.property("ADBE Vector Repeater Rotation").setValue(rot || 0);
        tr.property("ADBE Vector Repeater Position").setValue(pos || [0, 0]);
        if (endOpacity !== undefined) tr.property("ADBE Vector Repeater Opacity 2").setValue(endOpacity);
        return r;
    }

    var TOK = null;
    function tokens() {
        if (TOK) return TOK;
        var f = File(File($.fileName).parent.parent.fsName + "/tokens/superside_motion_tokens.json");
        f.encoding = "UTF-8"; f.open("r"); var txt = f.read(); f.close(); TOK = eval("(" + txt + ")"); return TOK;
    }
    function bez(name) { var e = tokens().easings; for (var i = 0; i < e.length; i++) if (e[i].name === name) return "[" + e[i].bezier.join(",") + "]"; return "[0.3,0,0.1,1]"; }
    var BZ = 'function bz(x, e) { if (x <= 0) return 0; if (x >= 1) return 1; var a = e[0], b = e[1], c = e[2], d = e[3], u = x;\n' +
             '  for (var i = 0; i < 8; i++) { var f = 3 * a * u * (1 - u) * (1 - u) + 3 * c * u * u * (1 - u) + u * u * u - x;\n' +
             '    var df = 3 * a * (1 - u) * (1 - u) + 6 * (c - a) * u * (1 - u) + 3 * (1 - c) * u * u; if (Math.abs(df) < 1e-6) break; u = Math.min(Math.max(u - f / df, 0), 1); }\n' +
             '  return 3 * b * u * (1 - u) * (1 - u) + 3 * d * u * u * (1 - u) + u * u * u; }\n';
    // local progress of one sub-element: starts `delay` s after the Reveal key, lasts `dur` s, eased with a token curve
    function stag(delay, dur, ease) {
        return BZ + 'var RV = effect("Reveal")("Slider"), t0 = RV.numKeys ? RV.key(1).time : inPoint;\n' +
               'var p = Math.max(Math.min((time - t0 - ' + delay.toFixed(3) + ') / ' + dur + ', 1), 0), e = bz(p, ' + bez(ease) + ');\n' +
               'var gone = RV.numKeys > 2 ? Math.min(Math.max(RV / 100, 0), 1) : 1;\n';   // an exit (Reveal back to 0) fades everything
    }
    function rnd(i, k) { var x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); }
    var R = 'Math.max(effect("Reveal")("Slider") / 100, 0)';   // eased by its token keys (can pass 1 with Pop)
    var DRAW = 'Math.min(' + R + ', 1) * 100';
    // exit phase: Reveal has a third key (the exit) and we are past it
    var OUTQ = 'var RV = effect("Reveal")("Slider"), r = Math.min(Math.max(RV / 100, 0), 1), leaving = RV.numKeys >= 3 && time >= RV.key(3).time;\n';
    var DRAW_END = OUTQ + 'leaving ? 100 : r * 100;';
    var DRAW_START = OUTQ + 'leaving ? (1 - r) * 100 : 0;';
    var WIDTH_BREATH = ' * (0.45 + 0.55 * Math.min(Math.max(effect("Reveal")("Slider") / 100, 0), 1))';

    // geometry builders: (vectors, style, o) → which animation channel the trim should drive
    var B = {
        circle:  function (v, st) { ellipse(v, 100); return "area"; },
        ring:    function (v, st) { ellipse(v, 100); return "line"; },
        square:  function (v, st, o) { rect(v, 100, 100, o.radius || 0); return "area"; },
        frame:   function (v, st, o) { rect(v, 160, 100, o.radius || 0); return "line"; },
        triangle: function (v) { star(v, 3, 58, 0, "polygon"); return "area"; },
        diamond: function (v) { star(v, 4, 55, 0, "polygon"); return "area"; },
        pentagon: function (v) { star(v, 5, 55, 0, "polygon"); return "area"; },
        hexagon: function (v) { star(v, 6, 55, 0, "polygon"); return "area"; },
        star:    function (v) { star(v, 5, 55, 23, "star"); return "area"; },
        sparkle: function (v) { star(v, 4, 55, 9, "star"); return "area"; },
        badge:   function (v) { var s = star(v, 18, 52, 45, "star"); s.property("ADBE Vector Star Outer Roundess").setValue(60); s.property("ADBE Vector Star Inner Roundess").setValue(60); return "area"; },
        heart:   function (v) {   // two circles and a square turned 45 degrees, one fill: the classic heart
            var parts = [[-17.7, -10, "c"], [17.7, -10, "c"], [0, 7.7, "s"]];
            for (var i = 0; i < parts.length; i++) {
                var hg = v.addProperty("ADBE Vector Group"), hv = hg.property("ADBE Vectors Group");
                if (parts[i][2] === "c") ellipse(hv, 50); else rect(hv, 50, 50, 0);
                var ht = hg.property("ADBE Vector Transform Group");
                ht.property("ADBE Vector Position").setValue([parts[i][0], parts[i][1]]);
                if (parts[i][2] === "s") ht.property("ADBE Vector Rotation").setValue(45);
            }
            return "area"; },
        shield:  function (v) { path(v, [[-42, -46], [42, -46], [42, 2], [0, 50], [-42, 2]], true, false); return "area"; },
        cross:   function (v) { path(v, [[-40, -40], [40, 40]], false); path(v, [[40, -40], [-40, 40]], false); return "line"; },
        plus:    function (v) { path(v, [[0, -45], [0, 45]], false); path(v, [[-45, 0], [45, 0]], false); return "line"; },
        check:   function (v) { path(v, [[-42, 2], [-12, 32], [44, -30]], false); return "line"; },
        line:    function (v) { path(v, [[-80, 0], [80, 0]], false); return "line"; },
        wave:    function (v) { var p = []; for (var i = 0; i <= 16; i++) p.push([-80 + i * 10, Math.sin(i / 16 * Math.PI * 4) * 16]); path(v, p, false, true); return "line"; },
        zigzag:  function (v) { var p = []; for (var i = 0; i <= 8; i++) p.push([-80 + i * 20, i % 2 ? -16 : 16]); path(v, p, false); return "line"; },
        arrow:   function (v) { path(v, [[-70, 0], [70, 0]], false); path(v, [[40, -30], [72, 0], [40, 30]], false); return "line"; },
        curved_arrow: function (v) { path(v, [[-70, 30], [-30, -26], [30, -30], [62, 10]], false, true); path(v, [[38, 12], [64, 14], [70, -12]], false); return "line"; },
        chevrons: function (v, st, o) { path(v, [[-12, -26], [12, 0], [-12, 26]], false); repeater(v, o.count || 3, 0, [30, 0], 25); return "line"; },
        brackets: function (v) {   // four corners of a frame
            path(v, [[-80, -25], [-80, -50], [-55, -50]], false); path(v, [[55, -50], [80, -50], [80, -25]], false);
            path(v, [[80, 25], [80, 50], [55, 50]], false); path(v, [[-55, 50], [-80, 50], [-80, 25]], false); return "line"; },
        spiral:  function (v) { var p = []; for (var i = 0; i <= 40; i++) { var a = i / 40 * Math.PI * 5, r = 4 + i * 1.2; p.push([Math.cos(a) * r, Math.sin(a) * r]); } path(v, p, false, true); return "line"; },
        infinity: function (v) { var p = []; for (var i = 0; i < 36; i++) { var a = i / 36 * Math.PI * 2, d = 1 + Math.sin(a) * Math.sin(a); p.push([70 * Math.cos(a) / d, 70 * Math.sin(a) * Math.cos(a) / d]); } path(v, p, true, true); return "line"; },
        brush:   function (v) { path(v, [[-85, 8], [-40, -6], [10, 4], [55, -8], [88, 2]], false, true); return "brush"; },
        speed_lines: function (v, st, o) { var n = o.count || 5; for (var i = 0; i < n; i++) { var y = -40 + i * 80 / Math.max(n - 1, 1), l = 60 + ((i * 37) % 70); path(v, [[-l, y], [l * 0.6, y]], false); } return "line"; },
        burst:   function (v, st, o) { path(v, [[34, 0], [70, 0]], false); return "rays"; },
        rings:   function (v, st, o) {   // shockwave: each ring expands while its stroke thins out and fades
            var n = o.count || 3;
            for (var i = 0; i < n; i++) {
                var g = v.addProperty("ADBE Vector Group"), gv = g.property("ADBE Vectors Group");
                gv.addProperty("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").expression = stag(i * 0.1, 0.75, "Settle") + 'var d = 18 + e * 82; [d, d];';
                var s = paint(gv, "outline", (i % 2) + 1);
                s.property("ADBE Vector Stroke Width").expression = stag(i * 0.1, 0.75, "Settle") + 'effect("Stroke")("Slider") * 2.4 * 100 / Math.max(effect("Size")("Slider"), 1) * Math.max(1 - e, 0.04);';
                s.property("ADBE Vector Stroke Opacity").expression = stag(i * 0.1, 0.75, "Settle") + '(p <= 0 ? 0 : Math.max(1 - Math.max(p - 0.5, 0) / 0.5, 0)) * 100 * gone;';
            }
            return "custom"; },
        loader:  function (v) { ellipse(v, 100); return "loader"; },
        dots:    function (v, st, o) { ellipse(v, 14); repeater(v, o.count || 5, 0, [26, 0], 100); return "area"; },
        confetti: function (v) { return "confetti"; },
        blob:    function (v, st, o) {   // a liquid blob that keeps breathing (circle tangents, radius moved by noise)
            v.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").expression =
                SSB.fn("blob") + 'blob(0, 0, 50, 9, ' + (o.seed || 3) + ', ' + (o.wobble || 0.18) + ', ' + (o.speed || 0.8) + ');';
            return "area"; },
        // ---- AC Shape Elements families (sub-elements staggered with token curves) ----
        impact:  function (v, st, o) {   // rays over a spread (360, 180, 90, 45 deg), optionally mirrored
            var n = o.count || 9, spread = o.spread || 360, step = spread >= 360 ? 360 / n : spread / Math.max(n - 1, 1);
            for (var i = 0; i < n; i++) {
                var g = v.addProperty("ADBE Vector Group"), gv = g.property("ADBE Vectors Group");
                path(gv, [[30, 0], [72, 0]], false);
                var tr = gv.addProperty("ADBE Vector Filter - Trim");
                tr.property("ADBE Vector Trim End").expression = stag(0, 0.75, "Settle") + 'Math.min(e * 1.4, 1) * 100;';
                tr.property("ADBE Vector Trim Start").expression = stag(0.2, 0.75, "Surge") + 'Math.min(e * 1.1, 1) * 100;';
                var ps = paint(gv, "outline", (i % 2) + 1);
                ps.property("ADBE Vector Stroke Width").expression = stag(0, 0.6, "Settle") + 'effect("Stroke")("Slider") * 1.4 * 100 / Math.max(effect("Size")("Slider"), 1) * (1 - 0.7 * e);';
                var a = (spread >= 360 ? 0 : -spread / 2) + i * step + (o.angle || 0);
                g.property("ADBE Vector Transform Group").property("ADBE Vector Rotation").setValue(a);
                if (o.mirror) { var g2 = v.addProperty("ADBE Vector Group"), gv2 = g2.property("ADBE Vectors Group"); path(gv2, [[30, 0], [72, 0]], false);
                    var tr2 = gv2.addProperty("ADBE Vector Filter - Trim");
                    tr2.property("ADBE Vector Trim End").expression = stag(0, 0.35, "Launch") + 'Math.min(e * 1.6, 1) * 100;';
                    tr2.property("ADBE Vector Trim Start").expression = stag(0.12, 0.35, "Launch") + 'Math.min(e * 1.2, 1) * 100;';
                    paint(gv2, "outline", (i % 2) + 1); g2.property("ADBE Vector Transform Group").property("ADBE Vector Rotation").setValue(a + 180); }
            }
            return "custom"; },
        pops:    function (v, st, o) {   // particles burst from the centre along seeded angles, spin and shrink away
            var n = o.count || 12, kinds = ["circle", "star", "triangle", "ring", "sparkle", "square"];
            for (var i = 0; i < n; i++) {
                var g = v.addProperty("ADBE Vector Group"), gv = g.property("ADBE Vectors Group"), k = kinds[i % kinds.length];
                if (k === "circle") ellipse(gv, 11); else if (k === "ring") ellipse(gv, 13); else if (k === "star") star(gv, 5, 9, 4, "star");
                else if (k === "sparkle") star(gv, 4, 10, 2.2, "star"); else if (k === "square") rect(gv, 9, 9, 1); else star(gv, 3, 9, 0, "polygon");
                paint(gv, k === "ring" ? "outline" : "fill", (i % 2) + 1);
                var a = (i / n + rnd(i, 1) * 0.08) * Math.PI * 2, dist = 55 + rnd(i, 2) * 50, d0 = rnd(i, 3) * 0.08, gt = g.property("ADBE Vector Transform Group");
                gt.property("ADBE Vector Position").expression = stag(d0, 0.7, "Settle") + '[Math.cos(' + a.toFixed(3) + ') * ' + dist.toFixed(1) + ' * e, Math.sin(' + a.toFixed(3) + ') * ' + dist.toFixed(1) + ' * e];';
                gt.property("ADBE Vector Scale").expression = stag(d0, 0.7, "Settle") + 'var s = (p <= 0 ? 0 : Math.min(p * 5, 1) * Math.max(1 - Math.max(p - 0.45, 0) / 0.55, 0)) * 120 * gone; [s, s];';
                gt.property("ADBE Vector Rotation").expression = stag(d0, 0.7, "Settle") + 'e * ' + Math.round(90 + rnd(i, 4) * 180) * (i % 2 ? 1 : -1) + ';';
            }
            return "custom"; },
        shape_row: function (v, st, o) {   // a row of small shapes popping along a line
            var n = o.count || 6, k = o.item || "circle";
            for (var i = 0; i < n; i++) {
                var g = v.addProperty("ADBE Vector Group"), gv = g.property("ADBE Vectors Group");
                if (k === "star") star(gv, 5, 9, 4, "star"); else if (k === "triangle") star(gv, 3, 9, 0, "polygon"); else ellipse(gv, 14);
                paint(gv, "fill", (i % 2) + 1);
                var gt = g.property("ADBE Vector Transform Group");
                gt.property("ADBE Vector Position").setValue([-80 + i * 160 / Math.max(n - 1, 1), 0]);
                gt.property("ADBE Vector Scale").expression = stag(i * 0.06, 0.4, "Pop") + 'var s = e * 100 * gone; [s, s];';
            }
            return "custom"; },
        fireworks: function (v, st, o) {   // bursts at a few spots, staggered
            var nb = o.count || 4;
            for (var b = 0; b < nb; b++) {
                var bx = (rnd(b, 3) - 0.5) * 150, by = (rnd(b, 4) - 0.5) * 90, d0 = b * 0.18;
                for (var r = 0; r < 10; r++) {
                    var g = v.addProperty("ADBE Vector Group"), gv = g.property("ADBE Vectors Group");
                    path(gv, [[6, 0], [26, 0]], false);
                    var tr = gv.addProperty("ADBE Vector Filter - Trim");
                    tr.property("ADBE Vector Trim End").expression = stag(d0, 0.4, "Launch") + 'Math.min(e * 1.5, 1) * 100;';
                    tr.property("ADBE Vector Trim Start").expression = stag(d0 + 0.15, 0.4, "Launch") + 'Math.min(e * 1.15, 1) * 100;';
                    paint(gv, "outline", (b % 2) + 1, { widthMul: 0.6 });
                    var gt = g.property("ADBE Vector Transform Group");
                    gt.property("ADBE Vector Position").setValue([bx, by]); gt.property("ADBE Vector Rotation").setValue(r * 36 + b * 11);
                }
            }
            return "custom"; },
        glitter: function (v, st, o) {   // sparkles that twinkle (keep twinkling after the reveal)
            var n = o.count || 9;
            for (var i = 0; i < n; i++) {
                var g = v.addProperty("ADBE Vector Group"), gv = g.property("ADBE Vectors Group");
                star(gv, 4, 10 + rnd(i, 5) * 8, 2.2, "star"); paint(gv, "fill", (i % 3 === 0) ? 2 : 1);
                var gt = g.property("ADBE Vector Transform Group");
                gt.property("ADBE Vector Position").setValue([(rnd(i, 6) - 0.5) * 150, (rnd(i, 7) - 0.5) * 100]);
                gt.property("ADBE Vector Scale").expression = stag(rnd(i, 8) * 0.4, 0.35, "Pop") + 'var tw = 0.55 + 0.45 * Math.abs(Math.sin((time + ' + (rnd(i, 9) * 3).toFixed(2) + ') * 3.2)); var s = e * 100 * tw * gone; [s, s];';
                gt.property("ADBE Vector Rotation").expression = 'time * ' + Math.round(20 + rnd(i, 10) * 40) + ';';
            }
            return "custom"; },
        swoosh:  function (v, st, o) {   // three curved strokes echo one another along the curve, tapered, drawn part travelling
            var n = o.count || 3;
            for (var i = 0; i < n; i++) {
                var g = v.addProperty("ADBE Vector Group"), gv = g.property("ADBE Vectors Group"), y = -i * 14;
                path(gv, [[-110, 34 + y], [-45, -4 + y], [30, -18 + y], [112, 2 + y]], false, true);
                var tr = gv.addProperty("ADBE Vector Filter - Trim");
                tr.property("ADBE Vector Trim End").expression = stag(i * 0.06, 0.6, "Surge") + 'e * 100;';
                tr.property("ADBE Vector Trim Start").expression = stag(i * 0.06 + 0.24, 0.6, "Surge") + 'e * 100;';
                paint(gv, "outline", i === 1 ? 2 : 1, { taper: true, widthMul: 2.4 - i * 0.5 });
            }
            return "custom"; }

    };

    function add(comp, kind, o) {
        o = o || {};
        if (!B[kind]) throw new Error("Unknown shape: " + kind + " (" + kinds().join(", ") + ")");
        var L = comp.layers.addShape(); L.name = uniqueName(comp, "SH · " + kind);
        var cols = o.colors && o.colors.length ? o.colors : DEF, size = o.size || 200;
        control(L, "ADBE Slider Control", "Reveal");
        control(L, "ADBE Slider Control", "Size", size);
        control(L, "ADBE Slider Control", "Stroke", o.stroke || Math.max(3, Math.round(size / 28)));
        control(L, "ADBE Color Control", "Color 1", rgb(cols[0]));
        control(L, "ADBE Color Control", "Color 2", rgb(cols[1] || cols[0]));
        var T = L.property("ADBE Transform Group");
        T.property("ADBE Position").setValue(o.position || [comp.width / 2, comp.height / 2]);

        var g = group(root(L), kind), v = vectors(g), chan = B[kind](v, o.style, o);
        var style = o.style || (chan === "area" ? "fill" : "outline");
        if (chan === "area" && style === "outline") chan = "line";
        var anim = o.anim;   // explicit ifs: chained ternaries with comparisons misbehave in ExtendScript (LEARNINGS)
        if (!anim) { if (chan === "line" || chan === "brush") anim = "draw"; else if (chan === "rays") anim = "burst"; else anim = "pop"; }

        if (chan === "rays") {   // rays fly out: trim end leads, start follows, repeated around the centre
            trim(v, 'Math.min(' + R + ' * 1.6, 1) * 100', 'Math.max(' + R + ' * 1.6 - 0.6, 0) * 100');
            paint(v, "outline", 1);
            repeater(v, o.count || 12, 360 / (o.count || 12));
        } else if (chan === "loader") {   // an arc that keeps turning
            paint(v, "outline", 1);
            trim(v, 'Math.min(' + R + ', 1) * 72', null, 'time * ' + (o.speed || 300));
        } else if (chan === "custom") {
            anim = "none";
        } else if (chan === "confetti") {
            var n = o.count || 28;
            for (var i = 0; i < n; i++) {
                var cg = group(v, "piece " + (i + 1)), cv = vectors(cg);
                if (i % 3 === 0) ellipse(cv, 9); else rect(cv, 7, 14, 1);
                paint(cv, "fill", (i % 2) + 1);
                var ct = cg.property("ADBE Vector Transform Group");
                // a burst from the centre, then gravity; seeded per piece so it renders the same every time
                ct.property("ADBE Vector Position").expression = 'seedRandom(' + (i + 1) + ', true); var a = random(0, Math.PI * 2), sp = random(120, 260);\n' +
                    'var R = effect("Reveal")("Slider"), t0 = R.numKeys ? R.key(1).time : 0, t = Math.max(time - t0, 0);\n' +
                    '[Math.cos(a) * sp * t, Math.sin(a) * sp * t * 0.8 + 260 * t * t];';
                ct.property("ADBE Vector Rotation").expression = 'seedRandom(' + (i + 1) + ', true); random(-360, 360) * time;';
                ct.property("ADBE Vector Group Opacity").expression = 'Math.min(effect("Reveal")("Slider"), 100);';
            }
            anim = "none";
        } else {
            var drawn = (chan === "line" || chan === "brush") && anim === "draw";
            if (drawn) trim(v, DRAW_END, DRAW_START);
            if (chan === "brush") paint(v, "outline", 1, { taper: true, widthMul: 3, breathe: true }); else paint(v, style, 1, drawn ? { breathe: true } : null);
            if (kind === "rings") {   // concentric rings in alternating colours, drawn one after another (added last: new groups invalidate earlier references)
                var rn = o.count || 3;
                for (var k = 1; k < rn; k++) { var rg = group(root(L), "ring " + (k + 1)), rv = vectors(rg); ellipse(rv, 100 - k * (60 / rn));
                    trim(rv, 'Math.min(Math.max(' + R + ' * ' + (1 + k * 0.35) + ' - ' + (k * 0.35) + ', 0), 1) * 100'); paint(rv, "outline", (k % 2) + 1); }
            }
        }
        g = root(L).property(kind); v = vectors(g);
        // geometry scale = Size (base 100 px)
        g.property("ADBE Vector Transform Group").property("ADBE Vector Scale").expression = 'var s = effect("Size")("Slider"); [s, s];';
        if (kind === "rings") for (var q = 2; q <= root(L).numProperties; q++) root(L).property(q).property("ADBE Vector Transform Group").property("ADBE Vector Scale").expression = 'var s = effect("Size")("Slider"); [s, s];';

        // layer-level animation from Reveal
        var sc = T.property("ADBE Scale"), ro = T.property("ADBE Rotate Z"), op = T.property("ADBE Opacity");
        if (anim === "pop" || anim === "pulse") sc.expression = 'var r = ' + R + ' * 100;' + (o.loop || anim === "pulse" ? ' var p = effect("Reveal")("Slider").numKeys > 1 && time > effect("Reveal")("Slider").key(2).time ? 1 + 0.06 * Math.sin((time - effect("Reveal")("Slider").key(2).time) * Math.PI * 2 * 0.8) : 1; r *= p;' : '') + ' [r, r];';
        if (anim === "spin") { sc.expression = 'var r = ' + R + ' * 100; [r, r];'; ro.expression = '(1 - ' + R + ') * -180' + (o.loop ? ' + time * 40' : '') + ';'; }
        if (anim === "burst" && chan !== "rays") { sc.expression = 'var r = 60 + ' + R + ' * 60; [r, r];'; op.expression = 'var r = ' + R + '; r < 0.6 ? r / 0.6 * 100 : (1 - (r - 0.6) / 0.4) * 100;'; }
        if (anim === "draw" && chan === "area") sc.expression = 'var r = ' + R + ' * 100; [r, r];';
        if (o.loop && chan === "line" && anim === "draw") {   // a flowing line: the drawn segment travels along the path
            var tr = v.property("ADBE Vector Filter - Trim");
            if (tr) tr.property("ADBE Vector Trim Offset").expression = 'time * 120;';
        }

        // timing: token curve on Reveal; exits with Launch
        var reveal = L.property("ADBE Effect Parade").property("Reveal").property(1), t0 = o.t || 0;
        var pair = ANIMS[anim] || ["Sweep", "Surge"];
        if (anim === "burst" || chan === "rays") SSM.animate(reveal, t0, 0, 100, o.dur || pair[0], o.ease || pair[1]);
        else if (anim === "none") SSM.animate(reveal, t0, 0, 100, "Blink", "Flat");
        else SSM.animate(reveal, t0, 0, 100, o.dur || pair[0], o.ease || pair[1]);
        if (!o.out && o.hold !== undefined) o.out = t0 + SSM.seconds(o.dur || pair[0]) + o.hold;
        if (o.out) SSM.animate(reveal, o.out, 100, 0, anim === "draw" ? (o.dur || pair[0]) : "Arrive", anim === "draw" ? "Cruise" : "Launch");
        L.inPoint = t0; if (o.out) L.outPoint = o.out + SSM.seconds("Arrive") + 0.05;
        L.comment = "SS shape: " + kind + " (" + anim + ")";
        return L;
    }
    function kinds() { var k = []; for (var n in B) if (B.hasOwnProperty(n)) k.push(n); return k; }
    return { add: add, kinds: kinds(), anims: ["draw", "pop", "spin", "burst", "pulse"] };
})();
