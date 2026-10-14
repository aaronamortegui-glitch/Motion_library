// SS Looks — procedural backgrounds and finishing looks built from native After Effects effects and shapes (behavior
// modelled on the title backgrounds, long shadows and glitches of Animation Composer's Titles & Callouts / Mixed packs).
// Colours come from the brand or a list; everything stays editable (effects and controls are named "SS …").
//
// Usage: #include "ss_presets.jsx" then #include "ss_looks.jsx"
//        SSL.background(comp, "liquid", {colors: ["#0A211F", "#174A46", "#D8FF85"]});   // stripes | dots | grid | gradient | liquid | topo
//        SSL.longShadow(comp, "Title", {length: 120, angle: 45, color: "#0A211F"});
//        SSL.glitch(comp, "Shot 1", {t: 1.2, dur: 0.4, amount: 24});
if (typeof SSB === "undefined") $.evalFile(new File(File($.fileName).parent.fsName + "/ss_behaviors.jsx"));   // the shared blob() and behaviours
var SSL = (function () {
    var DEF = ["#0A211F", "#174A46", "#D8FF85", "#F7F9F2"];
    function rgb(hex) { var h = String(hex).replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function uniqueName(comp, base) {
        for (var n = 1; ; n++) { var name = base + " " + n, used = false;
            for (var i = 1; i <= comp.numLayers; i++) if (comp.layer(i).name === name) { used = true; break; }
            if (!used) return name; }
    }
    function fx(L, match, name) { var e = L.property("ADBE Effect Parade").addProperty(match); e.name = name; return L.property("ADBE Effect Parade").property(name); }
    function turbulence(L, amount, size, evo) {
        var td = fx(L, "ADBE Turbulent Displace", "SS Flow");
        td.property(2).setValue(amount); td.property(3).setValue(size);
        td.property(6).expression = 'time * ' + evo + ';';   // evolution (degrees)
        try { td.property(12).setValue(3); } catch (e) {}      // pin all edges
        return td;
    }
    function colorAt(cols, i) { return rgb(cols[Math.min(i, cols.length - 1)]); }

    // ---------------------------------------------------------------- backgrounds (full frame, at the bottom of the comp)
    function background(comp, kind, o) {
        o = o || {};
        var organic = { network: network, blobs: blobs, mesh: mesh, glass: glassBG };
        if (organic[kind]) { var Lo = organic[kind](comp, o); Lo.moveToEnd(); Lo.comment = "SS background: " + kind; if (o.t !== undefined) Lo.inPoint = o.t; return Lo; }
        var cols = o.colors && o.colors.length ? o.colors : DEF, W = comp.width, H = comp.height, speed = o.speed === undefined ? 1 : o.speed;
        var name = uniqueName(comp, "BG · " + kind), L;
        // No Fractal Noise: rendered from a script with GPU acceleration it returned a stale buffer from another comp
        // (LEARNINGS). Gradient + Turbulent Displace gives the liquid look; displaced lines give the topographic one.
        if (kind === "gradient" || kind === "liquid") {
            L = comp.layers.addSolid(colorAt(cols, 0), name, Math.round(W * 1.5), Math.round(H * 1.5), 1);   // oversized: displacement never pulls in empty pixels
            var g = fx(L, "ADBE 4ColorGradient", "SS Gradient");
            for (var i = 0; i < 4; i++) {
                g.property("ADBE 4ColorGradient-000" + (2 * i + 2)).setValue(colorAt(cols, i % cols.length));
                var base = [[0.2, 0.2], [0.8, 0.25], [0.25, 0.8], [0.8, 0.8]][i];
                g.property("ADBE 4ColorGradient-000" + (2 * i + 1)).expression = 'var a = time * ' + (0.35 * speed) + ' + ' + i * 1.7 + '; [width * (' + (0.17 + base[0] * 0.66).toFixed(3) + ' + 0.08 * Math.sin(a)), height * (' + (0.17 + base[1] * 0.66).toFixed(3) + ' + 0.08 * Math.cos(a * 1.3))];';
            }
            if (kind === "liquid") turbulence(L, 55, Math.min(0.3 * Math.max(W, H), 650), 40 * speed);   // Amount is a strength (~0-100), not pixels: above ~150 it tears holes
        } else {
            L = comp.layers.addShape(); L.name = name;
            var root = L.property("ADBE Root Vectors Group");
            var bg = root.addProperty("ADBE Vector Group"); bg.name = "base";
            bg.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([W * 2, H * 2]);
            bg.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(colorAt(cols, 0));
            var pg = root.addProperty("ADBE Vector Group"); pg.name = "pattern";
            var pv = pg.property("ADBE Vectors Group"), cell = o.cell || (kind === "stripes" ? 60 : kind === "topo" ? 22 : 48), n = Math.ceil(Math.max(W, H) * 2.4 / cell);
            if (kind === "stripes") pv.addProperty("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([cell / 2, Math.max(W, H) * 3]);
            else if (kind === "dots") pv.addProperty("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").setValue([cell * 0.22, cell * 0.22]);
            else if (kind === "topo") pv.addProperty("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([Math.max(W, H) * 3, 2.5]);
            else { pv.addProperty("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([2, Math.max(W, H) * 3]); }
            pv.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(colorAt(cols, kind === "stripes" ? 1 : 2));
            var rep = pv.addProperty("ADBE Vector Filter - Repeater");
            rep.property("ADBE Vector Repeater Copies").setValue(n);
            rep.property("ADBE Vector Repeater Offset").setValue(-n / 2);
            rep.property("ADBE Vector Repeater Transform").property("ADBE Vector Repeater Position").setValue(kind === "topo" ? [0, cell] : [cell, 0]);
            if (kind === "dots") {
                var rep2 = pv.addProperty("ADBE Vector Filter - Repeater");
                rep2.property("ADBE Vector Repeater Copies").setValue(n); rep2.property("ADBE Vector Repeater Offset").setValue(-n / 2);
                rep2.property("ADBE Vector Repeater Transform").property("ADBE Vector Repeater Position").setValue([0, cell]);
            }
            if (kind === "grid") {   // the same lines turned 90 degrees
                var g2 = root.addProperty("ADBE Vector Group"); g2.name = "pattern 2";
                var v2 = g2.property("ADBE Vectors Group");
                v2.addProperty("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([Math.max(W, H) * 3, 2]);
                v2.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(colorAt(cols, 2));
                var r3 = v2.addProperty("ADBE Vector Filter - Repeater"); r3.property("ADBE Vector Repeater Copies").setValue(n); r3.property("ADBE Vector Repeater Offset").setValue(-n / 2);
                r3.property("ADBE Vector Repeater Transform").property("ADBE Vector Repeater Position").setValue([0, cell]);
                g2.property("ADBE Vector Transform Group").property("ADBE Vector Group Opacity").setValue(o.opacity || 18);
                pg = root.property("pattern");
            }
            var pt = pg.property("ADBE Vector Transform Group");
            pt.property("ADBE Vector Group Opacity").setValue(o.opacity || (kind === "stripes" ? 100 : kind === "topo" ? 55 : 30));
            if (kind === "stripes") pt.property("ADBE Vector Rotation").setValue(o.angle === undefined ? 35 : o.angle);
            // slow drift, one cell per period, so it loops seamlessly
            if (kind === "topo") turbulence(L, 140, 340, 18 * speed);
            else pt.property("ADBE Vector Position").expression = 'var p = (time * ' + (cell * 0.5 * speed) + ') % ' + cell + '; [p, ' + (kind === "dots" ? 'p' : '0') + '];';
            L.property("ADBE Root Vectors Group").property("base").moveTo(L.property("ADBE Root Vectors Group").numProperties);   // first group draws on top
            L.property("ADBE Transform Group").property("ADBE Position").setValue([W / 2, H / 2]);
        }
        L.moveToEnd(); L.comment = "SS background: " + kind;
        if (o.t !== undefined) L.inPoint = o.t;
        return L;
    }

    // ---------------------------------------------------------------- long shadow: stepped copies of the layer, shadow colour
    function longShadow(comp, layerName, o) {
        o = o || {};
        var src = comp.layer(layerName), len = o.length || 120, ang = (o.angle === undefined ? 45 : o.angle) * Math.PI / 180;
        var steps = Math.max(4, Math.round(len / (o.step || 3))), col = rgb(o.color || DEF[0]), made = [];
        // one precomp-free stack: duplicates parented to the source, offset along the angle, filled with the shadow colour
        for (var i = steps; i >= 1; i--) {
            var D = src.duplicate(); D.name = "LS · " + src.name + " " + i;
            try { D.setParentWithJump(src); } catch (e) { D.parent = src; }
            var T = D.property("ADBE Transform Group");
            // in the parent's space: the offset is undone by the parent's own scale/rotation, so convert from comp space
            T.property("ADBE Position").expression = 'var d = ' + (len * i / steps) + ', a = ' + ang + ';\n' +
                'var p = parent.fromComp(parent.toComp(parent.anchorPoint) + [Math.cos(a) * d, Math.sin(a) * d]); p;';
            T.property("ADBE Anchor Point").expression = 'parent.anchorPoint;';
            T.property("ADBE Scale").expression = '[100, 100];'; T.property("ADBE Rotate Z").expression = '0;';
            try { T.property("ADBE Opacity").expression = 'parent.transform.opacity * ' + (o.fade ? '(1 - ' + (i / steps * 0.8) + ')' : '1') + ';'; } catch (e2) {}
            var f = D.property("ADBE Effect Parade").addProperty("ADBE Fill"); f.name = "SS Shadow"; f.property("ADBE Fill-0002").setValue(col);
            D.moveAfter(src); D.shy = true; made.push(D);
        }
        src.comment = (src.comment ? src.comment + " | " : "") + "SS long shadow: " + steps + " steps, " + len + " px";
        return src.name + ": long shadow of " + len + " px (" + steps + " shy copies; toggle Shy to hide them in the timeline)";
    }

    // ---------------------------------------------------------------- glitch: RGB split + slice jumps in short bursts
    function glitch(comp, layerName, o) {
        o = o || {};
        var src = comp.layer(layerName), amt = o.amount || 22, t0 = o.t === undefined ? comp.time : o.t, dur = o.dur || 0.4;
        // the burst envelope: on during [t0, t0 + dur], random steps on 2s
        var env = 'var t0 = ' + t0 + ', d = ' + dur + '; var on = time >= t0 && time <= t0 + d;\n' +
                  'seedRandom(Math.floor(time * 15), true); var k = on ? random(0.3, 1) : 0;\n';
        var made = [];
        // three channel copies added together rebuild the image exactly when aligned; the source hides during the bursts,
        // so an opaque shot does not get tinted (adding two copies over the full source would)
        var chans = [["red", [1, 0, 0]], ["green", [0, 1, 0]], ["blue", [0, 0, 1]]];
        for (var c = 0; c < chans.length; c++) {
            var D = src.duplicate(); D.name = "GL · " + src.name + " " + chans[c][0];
            try { D.setParentWithJump(src); } catch (e) { D.parent = src; }
            var T = D.property("ADBE Transform Group");
            T.property("ADBE Anchor Point").expression = 'parent.anchorPoint;'; T.property("ADBE Scale").expression = '[100, 100];'; T.property("ADBE Rotate Z").expression = '0;';
            T.property("ADBE Position").expression = env + 'parent.anchorPoint + [' + (c - 1) + ' * ' + amt + ' * k, 0];';
            // keep one channel only, then add it over the source
            var sc = D.property("ADBE Effect Parade").addProperty("ADBE Shift Channels"); sc.name = "SS Channel";
            sc.property(2).setValue(chans[c][0] === "red" ? 2 : 10); sc.property(3).setValue(chans[c][0] === "green" ? 3 : 10); sc.property(4).setValue(chans[c][0] === "blue" ? 4 : 10);   // 10 = Full Off
            D.blendingMode = BlendingMode.ADD;
            T.property("ADBE Opacity").expression = env + 'on ? 100 : 0;';
            D.moveBefore(src); D.shy = true; made.push(D);
        }
        src.property("ADBE Transform Group").property("ADBE Opacity").expression = env + 'on ? 0 : value;';
        // slice jumps on the source itself
        var tf = src.property("ADBE Effect Parade").addProperty("ADBE Geometry2"); tf.name = "SS Glitch Jump";
        src.property("ADBE Effect Parade").property("SS Glitch Jump").property("ADBE Geometry2-0002").expression =
            env + 'value + [random(-1, 1) * ' + amt + ' * k, 0];';
        src.comment = (src.comment ? src.comment + " | " : "") + "SS glitch at " + t0.toFixed(2) + " s";
        return src.name + ": glitch " + t0.toFixed(2) + "-" + (t0 + dur).toFixed(2) + " s (RGB split + jumps)";
    }


    // ---------------------------------------------------------------- organic backgrounds (network, blobs, mesh, glass)
    // A smooth closed blob: n points round a centre, radius breathing with noise; tangents of a circle (4/3·tan(π/2n))
    // so the outline stays round and liquid, never polygonal. It lives in ss_behaviors.jsx (SSB.fn): blobs, ink and the blob shape share it.
    var BLOB_FN = SSB.fn("blob");   // tools/ss_behaviors.jsx
    function shapeBG(comp, name) {
        var L = comp.layers.addShape(); L.name = uniqueName(comp, name);
        L.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([0, 0]); L.property("ADBE Transform Group").property("ADBE Position").setValue([0, 0]);
        return L;
    }
    function baseRect(L, W, H, col) {
        var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"); g.name = "base";
        var r = g.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
        r.property("ADBE Vector Rect Size").setValue([W * 1.2, H * 1.2]); r.property("ADBE Vector Rect Position").setValue([W / 2, H / 2]);
        L.property("ADBE Root Vectors Group").property("base").property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(col);
    }
    // Network (plexus): points drift with smooth noise; every pair is joined by a line whose opacity falls with distance
    function network(comp, o) {
        var cols = o.colors && o.colors.length ? o.colors : DEF, W = comp.width, H = comp.height, n = o.count || 34, thr = o.reach || Math.round(Math.max(W, H) * 0.13);
        var L = shapeBG(comp, "BG · network"), root = L.property("ADBE Root Vectors Group"), spd = (o.speed === undefined ? 1 : o.speed) * 0.25, A = Math.round(Math.max(W, H) * 0.08);
        // a hash, not random(): AE seeds random() per layer and property, so the line, its opacity and the dot would disagree
        var P = 'function h(n) { var x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }\n' +
                'function P(k) { var b = [h(k + 1) * (thisComp.width + 80) - 40, h(k + 101) * (thisComp.height + 80) - 40];\n' +
                '  return [b[0] + noise([k * 3.1, time * ' + spd + ']) * ' + A + ', b[1] + noise([k * 7.3, time * ' + spd + ' + 50]) * ' + A + ']; }\n';
        var lineCol = colorAt(cols, cols.length > 2 ? 2 : cols.length - 1), dotCol = colorAt(cols, cols.length > 3 ? 3 : cols.length - 1);
        for (var i = 0; i < n; i++) for (var j = i + 1; j < n; j++) {
            var g = root.addProperty("ADBE Vector Group"), v = g.property("ADBE Vectors Group");
            v.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").expression = P + 'createPath([P(' + i + '), P(' + j + ')], [], [], false);';
            var s = v.addProperty("ADBE Vector Graphic - Stroke");
            s.property("ADBE Vector Stroke Color").setValue(lineCol); s.property("ADBE Vector Stroke Width").setValue(o.stroke || 1.4);
            s.property("ADBE Vector Stroke Opacity").expression = P + 'var a = P(' + i + '), b = P(' + j + '), d = length(a, b); Math.max(0, 1 - d / ' + thr + ') * ' + (o.lineOpacity || 70) + ';';
        }
        for (var k = 0; k < n; k++) {
            var dg = root.addProperty("ADBE Vector Group"), dv = dg.property("ADBE Vectors Group");
            var e = dv.addProperty("ADBE Vector Shape - Ellipse"); e.property("ADBE Vector Ellipse Size").setValue([o.dot || 9, o.dot || 9]);
            e.property("ADBE Vector Ellipse Position").expression = P + 'P(' + k + ');';
            dv.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(dotCol);
        }
        baseRect(L, W, H, colorAt(cols, 0));
        root.property("base").moveTo(root.numProperties);
        return L;
    }
    // Blobs: a few liquid shapes in brand colours drifting and breathing, softened with a light blur
    function blobs(comp, o) {
        var cols = o.colors && o.colors.length ? o.colors : DEF, W = comp.width, H = comp.height, nb = o.count || 4, spd = (o.speed === undefined ? 1 : o.speed) * 0.3;
        var L = shapeBG(comp, "BG · blobs"), root = L.property("ADBE Root Vectors Group");
        for (var b = 0; b < nb; b++) {
            var g = root.addProperty("ADBE Vector Group"), v = g.property("ADBE Vectors Group");
            var r = Math.round(Math.min(W, H) * (0.22 + 0.12 * ((b * 37) % 10) / 10)), seed = 11 + b * 5;
            v.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").expression = BLOB_FN +
                'seedRandom(' + seed + ', true); var cx = random(0.15, 0.85) * thisComp.width + noise([' + seed + ', time * ' + spd + ']) * ' + Math.round(W * 0.12) + ';\n' +
                'var cy = random(0.2, 0.8) * thisComp.height + noise([' + seed + ' + 9, time * ' + spd + ']) * ' + Math.round(H * 0.12) + ';\nblob(cx, cy, ' + r + ', 8, ' + seed + ', 0.22, ' + (spd * 1.6) + ');';
            v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(colorAt(cols, 1 + b % Math.max(cols.length - 1, 1)));
            g.property("ADBE Vector Transform Group").property("ADBE Vector Group Opacity").setValue(o.opacity || 85);
        }
        baseRect(L, W, H, colorAt(cols, 0)); root.property("base").moveTo(root.numProperties);
        if (o.soft !== false) { var gb = fx(L, "ADBE Gaussian Blur 2", "SS Soft"); gb.property(1).setValue(o.soft || 18); gb.property(3).setValue(1); }
        return L;
    }
    // Mesh gradient: large colour circles drifting under a heavy blur (smooth, rich, never banded like a ramp)
    function mesh(comp, o) {
        var cols = o.colors && o.colors.length ? o.colors : DEF, W = comp.width, H = comp.height, n = o.count || 6, spd = (o.speed === undefined ? 1 : o.speed) * 0.2;
        var L = shapeBG(comp, "BG · mesh"), root = L.property("ADBE Root Vectors Group");
        for (var i = 0; i < n; i++) {
            var g = root.addProperty("ADBE Vector Group"), v = g.property("ADBE Vectors Group"), d = Math.round(Math.max(W, H) * (0.45 + 0.2 * ((i * 29) % 10) / 10));
            var e = v.addProperty("ADBE Vector Shape - Ellipse"); e.property("ADBE Vector Ellipse Size").setValue([d, d]);
            e.property("ADBE Vector Ellipse Position").expression = 'seedRandom(' + (i + 3) + ', true); [random(0, 1) * thisComp.width + noise([' + i * 2.3 + ', time * ' + spd + ']) * ' + Math.round(W * 0.25) +
                ', random(0, 1) * thisComp.height + noise([' + i * 4.1 + ' + 20, time * ' + spd + ']) * ' + Math.round(H * 0.25) + '];';
            v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(colorAt(cols, i % cols.length));
        }
        baseRect(L, W, H, colorAt(cols, 0)); root.property("base").moveTo(root.numProperties);
        var gb = fx(L, "ADBE Gaussian Blur 2", "SS Mesh Blur"); gb.property(1).setValue(o.blur || Math.round(Math.max(W, H) * 0.12)); gb.property(3).setValue(1);
        return L;
    }
    // A rounded-rectangle mask path (mask space = layer space)
    function roundRect(x0, y0, x1, y1, r) {
        var s = new Shape(), k = r * 0.5523;
        s.vertices = [[x0 + r, y0], [x1 - r, y0], [x1, y0 + r], [x1, y1 - r], [x1 - r, y1], [x0 + r, y1], [x0, y1 - r], [x0, y0 + r]];
        s.inTangents = [[-k, 0], [0, 0], [0, -k], [0, 0], [k, 0], [0, 0], [0, k], [0, 0]];
        s.outTangents = [[0, 0], [k, 0], [0, 0], [0, k], [0, 0], [-k, 0], [0, 0], [0, -k]];
        s.closed = true; return s;
    }
    // Frosted glass pane: an adjustment layer masked to the pane blurs and lifts what is behind; a soft white fill and a
    // light rim on top. Returns [adjustment, rim].
    function glassPane(comp, x, y, w, h, o) {
        o = o || {};
        var W = comp.width, H = comp.height, r = o.radius === undefined ? Math.round(Math.min(w, h) * 0.12) : o.radius;
        var A = comp.layers.addSolid([1, 1, 1], uniqueName(comp, "GL · pane"), W, H, 1); A.adjustmentLayer = true;
        var m = A.property("ADBE Mask Parade").addProperty("ADBE Mask Atom"); m.property("ADBE Mask Shape").setValue(roundRect(x, y, x + w, y + h, r));
        var gb = fx(A, "ADBE Gaussian Blur 2", "SS Frost"); gb.property(1).setValue(o.frost || 45); gb.property(3).setValue(1);
        var bc = fx(A, "ADBE Brightness & Contrast 2", "SS Lift"); bc.property(1).setValue(o.lift === undefined ? 18 : o.lift);
        var S = comp.layers.addShape(); S.name = uniqueName(comp, "GL · rim");
        S.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([0, 0]); S.property("ADBE Transform Group").property("ADBE Position").setValue([0, 0]);
        var v = S.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var rc = v.addProperty("ADBE Vector Shape - Rect"); rc.property("ADBE Vector Rect Size").setValue([w, h]); rc.property("ADBE Vector Rect Position").setValue([x + w / 2, y + h / 2]); rc.property("ADBE Vector Rect Roundness").setValue(r);
        var f = v.addProperty("ADBE Vector Graphic - Fill"); f.property("ADBE Vector Fill Color").setValue(o.tintColor ? rgb(o.tintColor) : [1, 1, 1]); f.property("ADBE Vector Fill Opacity").setValue(o.tint || 10);
        var st = v.addProperty("ADBE Vector Graphic - Stroke"); st.property("ADBE Vector Stroke Color").setValue([1, 1, 1]); st.property("ADBE Vector Stroke Opacity").setValue(o.rim || 35); st.property("ADBE Vector Stroke Width").setValue(1.5);
        S.moveBefore(A);
        return [A, S];
    }
    function glassBG(comp, o) {
        var W = comp.width, H = comp.height;
        var base = mesh(comp, o);
        base.name = uniqueName(comp, "BG · glass");
        var panes = o.panes || [[0.08, 0.16, 0.38, 0.5], [0.52, 0.42, 0.4, 0.42]], made = [];
        for (var i = 0; i < panes.length; i++) {
            var q = panes[i], pr = glassPane(comp, q[0] * W, q[1] * H, q[2] * W, q[3] * H, o);
            pr[0].moveAfter(comp.layer(1)); made.push(pr[0], pr[1]);
            // a slow float so the frost reveals the colours moving behind it
            var off = 'var d = [0, Math.sin(time * 0.4 + ' + (i * 1.7).toFixed(2) + ') * ' + Math.round(H * 0.012) + '];\n';
            pr[1].property("ADBE Transform Group").property("ADBE Position").expression = off + 'd;';
            pr[0].property("ADBE Mask Parade").property(1).property("ADBE Mask Shape").expression = off + 'var q = thisProperty.points(), p = []; for (var j = 0; j < q.length; j++) p.push(add(q[j], d)); createPath(p, thisProperty.inTangents(), thisProperty.outTangents(), true);';   // add(): the JS expression engine has no array +
        }
        for (var k = made.length - 1; k >= 0; k--) made[k].moveToEnd();
        base.moveToEnd();
        return base;
    }
    // Glass card: a frosted pane (blurs what is behind it) with a title and a line of text, fading and rising in.
    // first brand font AE can really draw (installed for all users and not substituted), else the last of the list
    function brandFont(list) {
        if (typeof list === "string") list = [list];
        var bad = {};
        try { var m = app.fonts.missingOrSubstitutedFonts; for (var j = 0; j < m.length; j++) bad[m[j].postScriptName] = true; } catch (e0) {}
        for (var i = 0; i < list.length; i++) { var ok = false; try { ok = app.fonts.getFontsByPostScriptName(list[i]).length > 0; } catch (e) {} if (ok && !bad[list[i]]) return list[i]; }
        return list[list.length - 1];
    }
    function glassCard(comp, title, sub, o) {
        o = o || {};
        var W = comp.width, H = comp.height, w = (o.size && o.size[0]) || Math.round(W * 0.34), h = (o.size && o.size[1]) || Math.round(H * 0.26);
        var c = o.position || [W / 2, H / 2], x = c[0] - w / 2, y = c[1] - h / 2, t0 = o.t || 0;
        // smoky glass by default: a dark tint keeps white text readable over any colour behind it
        if (!o.tintColor) o.tintColor = "#0A211F"; if (!o.tint) o.tint = 35;
        var pr = glassPane(comp, x, y, w, h, o), layers = [pr[0], pr[1]];
        function line(str, size, yy, bold, alpha) {
            var L = comp.layers.addText(str), p = L.property("ADBE Text Properties").property("ADBE Text Document"), d = p.value;
            d.resetCharStyle(); d.font = brandFont(bold ? (o.titleFont || ["InterTight-Bold", "Arial-BoldMT"]) : (o.textFont || ["InterTight-Regular", "ArialMT"]));
            d.fontSize = size; d.fillColor = rgb(o.textColor || "#FFFFFF"); d.applyFill = true;
            d.justification = ParagraphJustification.LEFT_JUSTIFY; p.setValue(d);
            var r = L.sourceRectAtTime(0, false); L.property("ADBE Transform Group").property("ADBE Position").setValue([x + w * 0.08 - r.left, yy - r.top]);
            L.property("ADBE Transform Group").property("ADBE Opacity").setValue(alpha); return L;
        }
        if (title) layers.push(line(title, o.titleSize || Math.round(h * 0.2), y + h * 0.18, true, 100));
        if (sub) layers.push(line(sub, o.subSize || Math.round(h * 0.11), y + h * 0.52, false, 80));
        for (var i = 0; i < layers.length; i++) {
            var L2 = layers[i], op = L2.property("ADBE Transform Group").property("ADBE Opacity"), v = op.value;
            SSM.animate(op, t0 + (i > 1 ? 0.15 * (i - 1) : 0), 0, v, "Sweep", "Cruise");
            if (i > 0) { var pp = L2.property("ADBE Transform Group").property("ADBE Position"), p0 = pp.value; SSM.animate(pp, t0 + (i > 1 ? 0.15 * (i - 1) : 0), [p0[0], p0[1] + 30], p0, "Sweep", "Settle"); }
        }
        // the adjustment pane follows the rim's rise through its mask
        pr[0].property("ADBE Mask Parade").property(1).property("ADBE Mask Shape").expression = 'var R = thisComp.layer("' + pr[1].name + '"), d = sub(R.transform.position, R.transform.position.valueAtTime(' + (t0 + 3) + '));\n' +
            'var q = thisProperty.points(), p = []; for (var j = 0; j < q.length; j++) p.push(add(q[j], [d[0], d[1]])); createPath(p, thisProperty.inTangents(), thisProperty.outTangents(), true);';
        for (var k = 0; k < layers.length; k++) layers[k].inPoint = t0;
        return pr[1].name;
    }
    // ---------------------------------------------------------------- finishing looks (AC Overlays: color, frames, grain, particles, lights)
    function adjust(comp, name) { var A = comp.layers.addSolid([1, 1, 1], uniqueName(comp, name), comp.width, comp.height, 1); A.adjustmentLayer = true; return A; }
    function look(comp, kind, o) {
        o = o || {};
        var cols = o.colors && o.colors.length ? o.colors : DEF, W = comp.width, H = comp.height, L;
        if (kind === "tritone" || kind === "duotone") {
            L = adjust(comp, "LK · " + kind);
            if (kind === "tritone") { var tt = fx(L, "ADBE Tritone", "SS Tone"); tt.property(1).setValue(colorAt(cols, 2)); tt.property(2).setValue(colorAt(cols, 1)); tt.property(3).setValue(colorAt(cols, 0)); }
            else { var ti = fx(L, "ADBE Tint", "SS Tone"); ti.property(1).setValue(colorAt(cols, 0)); ti.property(2).setValue(colorAt(cols, 2)); }
            L.property("ADBE Transform Group").property("ADBE Opacity").setValue(o.amount === undefined ? 100 : o.amount);
        } else if (kind === "vignette") {
            L = comp.layers.addSolid([0, 0, 0], uniqueName(comp, "LK · vignette"), W, H, 1);
            var m = L.property("ADBE Mask Parade").addProperty("ADBE Mask Atom"), s = new Shape(), rx = W * 0.62, ry = H * 0.62, kx = rx * 0.5523, ky = ry * 0.5523, cx = W / 2, cy = H / 2;
            s.vertices = [[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]]; s.inTangents = [[-kx, 0], [0, -ky], [kx, 0], [0, ky]]; s.outTangents = [[kx, 0], [0, ky], [-kx, 0], [0, -ky]]; s.closed = true;
            m.property("ADBE Mask Shape").setValue(s); m.inverted = true; m.property("ADBE Mask Feather").setValue([W * 0.25, W * 0.25]);
            L.property("ADBE Transform Group").property("ADBE Opacity").setValue(o.amount === undefined ? 55 : o.amount);
        } else if (kind === "grain") {
            L = adjust(comp, "LK · grain");
            var nz = fx(L, "ADBE Noise", "SS Grain"); nz.property(1).setValue(o.amount === undefined ? 7 : o.amount);
            try { nz.property(2).setValue(false); } catch (e) {}   // monochrome noise
        } else if (kind === "scanlines") {
            L = comp.layers.addShape(); L.name = uniqueName(comp, "LK · scanlines");
            var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"), v = g.property("ADBE Vectors Group"), gap = o.cell || 4;
            v.addProperty("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([W * 1.2, gap / 2]);
            v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue([0, 0, 0]);
            var rp = v.addProperty("ADBE Vector Filter - Repeater"), n = Math.ceil(H / gap) + 4;
            rp.property("ADBE Vector Repeater Copies").setValue(n); rp.property("ADBE Vector Repeater Offset").setValue(-n / 2);
            rp.property("ADBE Vector Repeater Transform").property("ADBE Vector Repeater Position").setValue([0, gap]);
            g.property("ADBE Vector Transform Group").property("ADBE Vector Position").expression = '[0, (time * ' + (gap * 6) + ') % ' + gap + '];';
            L.property("ADBE Transform Group").property("ADBE Position").setValue([W / 2, H / 2]);
            L.property("ADBE Transform Group").property("ADBE Opacity").setValue(o.amount === undefined ? 18 : o.amount);
        } else if (kind === "letterbox") {
            var ratio = o.ratio || 2.39, bar = Math.max((H - W / ratio) / 2, 0), made = [];
            for (var b = 0; b < 2; b++) {
                var Bb = comp.layers.addSolid([0, 0, 0], uniqueName(comp, "LK · letterbox"), W, Math.ceil(bar) + 2, 1), y = b ? H - bar / 2 : bar / 2, P = Bb.property("ADBE Transform Group").property("ADBE Position");
                if (o.t !== undefined) SSM.animate(P, o.t, [W / 2, b ? H + bar / 2 : -bar / 2], [W / 2, y], o.dur || "Sweep", o.ease || "Surge"); else P.setValue([W / 2, y]);
                made.push(Bb);
            }
            L = made[0];
        } else if (kind === "dust" || kind === "embers" || kind === "snow") {
            // particles drawn as a shape layer: seeded positions drifting and wrapping, so they render the same every time
            L = comp.layers.addShape(); L.name = uniqueName(comp, "LK · " + kind);
            var root = L.property("ADBE Root Vectors Group"), cnt = o.count || (kind === "snow" ? 70 : 45);
            var col = o.particleColor ? rgb(o.particleColor) : (kind === "embers" ? rgb("#FF8A3D") : [1, 1, 1]);   // own colour: brand palettes are often dark
            var vy = kind === "snow" ? 70 : kind === "embers" ? -90 : -12, vx = kind === "snow" ? 15 : kind === "embers" ? 10 : 8;
            for (var i = 0; i < cnt; i++) {
                var pg = root.addProperty("ADBE Vector Group"), pv = pg.property("ADBE Vectors Group");
                pv.addProperty("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").expression = 'seedRandom(' + (i + 1) + ', true); var d = random(' + (kind === "dust" ? '1.5, 4' : kind === "snow" ? '3, 8' : '2, 5') + '); [d, d];';
                pv.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(col);
                var pt = pg.property("ADBE Vector Transform Group");
                pt.property("ADBE Vector Position").expression = 'seedRandom(' + (i + 1) + ', true); var x0 = random(0, thisComp.width), y0 = random(0, thisComp.height), sp = random(0.5, 1.5), ph = random(0, 6.28);\n' +
                    'var x = x0 + Math.sin(time * 0.8 + ph) * ' + vx * 2 + ' + time * ' + vx + ' * sp, y = y0 + time * ' + vy + ' * sp;\n' +
                    '[((x % thisComp.width) + thisComp.width) % thisComp.width, ((y % thisComp.height) + thisComp.height) % thisComp.height];';
                pt.property("ADBE Vector Group Opacity").expression = 'seedRandom(' + (i + 1) + ', true); var ph = random(0, 6.28); ' + (kind === "embers" ? '60 + 40 * Math.sin(time * 4 + ph)' : kind === "dust" ? '35 + 25 * Math.sin(time * 1.5 + ph)' : '80') + ';';
            }
            L.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([0, 0]); L.property("ADBE Transform Group").property("ADBE Position").setValue([0, 0]);
            if (kind === "embers") { L.blendingMode = BlendingMode.ADD; var gl = fx(L, "ADBE Glo2", "SS Glow"); gl.property("ADBE Glo2-0003").setValue(12); }
        } else throw new Error("Unknown look: " + kind + " (tritone, duotone, vignette, grain, scanlines, letterbox, dust, embers, snow; light leaks: real footage via add_asset)");
        L.moveToBeginning(); if (o.t !== undefined && kind !== "letterbox") L.inPoint = o.t;
        L.comment = "SS look: " + kind;
        return L.name;
    }
    return { backgrounds: ["stripes", "dots", "grid", "gradient", "liquid", "topo", "network", "blobs", "mesh", "glass"], glassCard: glassCard, glassPane: glassPane, BLOB_FN: BLOB_FN, looks: ["tritone", "duotone", "vignette", "grain", "scanlines", "letterbox", "dust", "embers", "snow"],
             background: background, longShadow: longShadow, glitch: glitch, look: look };
})();
