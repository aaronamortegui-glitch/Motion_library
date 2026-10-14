// SS Behaviors — the algorithm apart from what it draws. A behaviour is an expression generator (how points move: liquid
// bubbles that merge, a jelly spring, a flock, a noise flow field, Voronoi cells, a verlet rope, organic growth); a target
// is what it draws into (its own shape layer, a looping background, a matte for any layer or text, an element's box, or
// the pieces of a solid transition). Every target hands the behaviour the same context, so one behaviour feeds them all:
//   BX    the region [x0, y0, x1, y1] in the path's space (comp space: the shape layers sit at [0, 0])
//   p     progress 0..1 (eased by the token curve of the target: a keyed slider, an element's Reveal or SST's cover/reveal)
//   PT(t) progress at any time (springs and the rope read the past); OR the origin point; LOOP 1 = keeps moving at rest
// Families (by nature): fill = covers a region (bubbles, blob, voronoi, grow) · swarm = populates a region and loops
// (flock, flow) · physics = reacts to the token curve with physics (spring, rope) · modifier = works on any existing layer
// (line_boil: hand-drawn tremble). Each behaviour lists the targets where it passed the side-by-side quality check.
// Gooey pass (bubbles): Gaussian Blur + Levels on alpha, so close shapes melt into one.
//
// Usage: #include "ss_presets.jsx" (token timing) then #include "ss_behaviors.jsx"
//        SSB.add(comp, "bubbles", "shape", {t: 0.5, colors: ["#D8FF85"]});              // its own layer, keyed on tokens
//        SSB.add(comp, "voronoi", "background", {colors: ["#0A211F", "#174A46", "#2E8B80"]});
//        SSB.add(comp, "bubbles", "mask", {layer: "Title", t: 0.4});                      // reveals a layer (text) through it
//        SSB.add(comp, "spring", "box", {element: "EL · label 1"});                       // an element's box becomes jelly
//        SST.add(comp, "behavior", 2.0, {behavior: "bubbles"});                            // transition pieces (ss_transitions.jsx)
//        SSB.add(comp, "line_boil", "layer", {layers: ["Title", "SH · star 1"]});              // hand-drawn tremble on 3s
//        SSB.fn("blob") → the shared blob() expression function (ink transition, blob shape, blobs background)
// Options: t, out (s), dur / ease (tokens), colors, count, seed, origin (center | top-left | … | bottom), speed, size,
//          stroke, goo (gooey blur px), gap / round (cells), box [x, y, w, h] or layer (region), loop.
var SSB = (function () {
    // ---------------------------------------------------------------- shared expression functions
    var FN = {
        // a smooth closed blob: n points round a centre, radius breathing with noise; tangents of a circle (4/3·tan(π/2n))
        // so the outline stays round and liquid, never polygonal
        blob: 'function blob(cx, cy, r, n, seed, amp, spd) { var pts = [], it = [], ot = [], k = 4 / 3 * Math.tan(Math.PI / (2 * n));\n' +
              '  for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2, rr = Math.max(r, 0.5) * (1 + amp * noise([seed + i * 1.7, time * spd]));\n' +
              '    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); var tl = rr * k; it.push([Math.sin(a) * tl, -Math.cos(a) * tl]); ot.push([-Math.sin(a) * tl, Math.cos(a) * tl]); }\n' +
              '  return createPath(pts, it, ot, true); }\n',
        // a hash instead of random(): AE seeds random() per layer and property, so shared positions would disagree
        hash: 'function hh(n) { var x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }\n' +
              'function cl(x) { return Math.min(Math.max(x, 0), 1); }\n',
        // smooth path through points (Catmull-Rom tangents)
        smooth: 'function smoothPath(pts, closed) { var it = [], ot = [], n = pts.length;\n' +
                '  for (var i = 0; i < n; i++) { var a = pts[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)], b = pts[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];\n' +
                '    var tx = (b[0] - a[0]) / 6, ty = (b[1] - a[1]) / 6; it.push([-tx, -ty]); ot.push([tx, ty]); }\n' +
                '  return createPath(pts, it, ot, closed); }\n'
    };
    function fn(name) { if (!FN[name]) throw new Error("Unknown behaviour function: " + name); return FN[name]; }

    function rgb(hex) { var h = String(hex).replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function uniqueName(comp, base) {
        for (var n = 1; ; n++) { var name = base + " " + n, used = false;
            for (var i = 1; i <= comp.numLayers; i++) if (comp.layer(i).name === name) { used = true; break; }
            if (!used) return name; }
    }
    function hash(n) { var x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
    function q(s) { return '"' + String(s).replace(/"/g, '\\"') + '"'; }
    var ORIGIN = { center: [0.5, 0.5], "top-left": [0, 0], "top-right": [1, 0], "bottom-left": [0, 1], "bottom-right": [1, 1],
                   top: [0.5, 0], bottom: [0.5, 1], left: [0, 0.5], right: [1, 0.5] };
    function originOf(o) { return ORIGIN[o.origin || "center"] || ORIGIN.center; }
    function originExpr(o) { var f = originOf(o); return 'var OR = [BX[0] + ' + f[0] + ' * (BX[2] - BX[0]), BX[1] + ' + f[1] + ' * (BX[3] - BX[1])];\n'; }

    // a sub-group with one path and its paint; colorExpr null = white (mattes)
    function addPath(v, name, expr, paint, colorExpr, width) {
        var g = v.addProperty("ADBE Vector Group"); g.name = name;
        var gv = g.property("ADBE Vectors Group");
        gv.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").expression = expr;
        if (paint === "stroke") {
            var s = gv.addProperty("ADBE Vector Graphic - Stroke");
            if (colorExpr) s.property("ADBE Vector Stroke Color").expression = colorExpr; else s.property("ADBE Vector Stroke Color").setValue([1, 1, 1]);
            if (typeof width === "string") s.property("ADBE Vector Stroke Width").expression = width; else s.property("ADBE Vector Stroke Width").setValue(width || 4);
            s.property("ADBE Vector Stroke Line Cap").setValue(2);   // round caps
            s.property("ADBE Vector Stroke Line Join").setValue(2);
        } else {
            var f = gv.addProperty("ADBE Vector Graphic - Fill");
            if (colorExpr) f.property("ADBE Vector Fill Color").expression = colorExpr; else f.property("ADBE Vector Fill Color").setValue([1, 1, 1]);
        }
        return g;
    }
    // body: an expression function BEH() returning a path; wrapped so its locals never clobber the target's prelude
    function body(ctx, code) { return ctx.pre + FN.hash + 'function BEH() {\n' + code + '\n}\nBEH();'; }
    // jittered grid in the unit square (cover behaviours need every cell filled)
    function grid(n, aspect, seed, jit) {
        var cols = Math.max(1, Math.round(Math.sqrt(n * aspect))), rows = Math.max(1, Math.round(n / cols)), pts = [];
        for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
            var i = r * cols + c;
            pts.push([(c + 0.5 + (hash(i * 3 + seed) - 0.5) * jit) / cols, (r + 0.5 + (hash(i * 7 + seed + 1) - 0.5) * jit) / rows]);
        }
        return { pts: pts, cols: cols, rows: rows };
    }
    function distOrder(pts, o, aspect) {   // 0..1 distance of each point from the origin (who moves first)
        var f = originOf(o), d = [], mx = 0;
        for (var i = 0; i < pts.length; i++) { var dx = (pts[i][0] - f[0]) * aspect, dy = pts[i][1] - f[1]; d.push(Math.sqrt(dx * dx + dy * dy)); mx = Math.max(mx, d[i]); }
        for (var j = 0; j < d.length; j++) d[j] = mx > 0 ? d[j] / mx : 0;
        return d;
    }
    function arr(a, dec) { var s = []; for (var i = 0; i < a.length; i++) s.push(a[i] instanceof Array ? arr(a[i], dec) : Number(a[i]).toFixed(dec === undefined ? 4 : dec)); return "[" + s.join(",") + "]"; }

    // ---------------------------------------------------------------- behaviours
    // build(v, ctx, o) adds paths to the vectors group v. ctx: pre (prelude), loop, aspect, W, H (region size estimate),
    // color(i) (fill expression or null), seed. gooey: needs the gooey pass. reveal: how a transition uncovers
    // ("hole": the same behaviour cuts a hole, "shrink": it plays backwards). targets: where it passed the quality check.
    var B = {
        bubbles: { family: "fill", gooey: true, reveal: "hole", targets: ["shape", "background", "mask", "transition"], dur: "Sweep", ease: "Settle",
            use: "Liquid bubbles that bloom from the origin and melt into each other (metaballs: blur + alpha threshold); as a background they rise like a lava lamp.",
            build: function (v, ctx, o) {
                var n = o.count || (ctx.loop ? 10 : 16), G = grid(n, ctx.aspect, ctx.seed, 0.7), d = distOrder(G.pts, o, ctx.aspect), sp = o.spread === undefined ? 0.55 : o.spread;
                for (var i = 0; i < G.pts.length; i++) {
                    var u = G.pts[i][0].toFixed(4), w = G.pts[i][1].toFixed(4), sd = ctx.seed * 13 + i * 5;
                    var code = FN.blob + 'var W = BX[2] - BX[0], H = BX[3] - BX[1], rf = 0.62 * Math.sqrt(Math.pow(W / ' + G.cols + ', 2) + Math.pow(H / ' + G.rows + ', 2));\n';
                    if (ctx.loop) {   // lava lamp: bubbles rise through the region and wrap below it, swaying, breathing
                        code += 'var rr = rf * 0.5 * (0.55 + 0.8 * hh(' + (sd + 1) + ')) * Math.min(Math.max(p, 0), 1.2), span = H + 4 * rf, spd = H * ' + (0.05 * (o.speed || 1)).toFixed(4) + ' * (0.6 + 0.8 * hh(' + (sd + 2) + '));\n' +
                                'var y = BX[3] + 2 * rf - ((hh(' + (sd + 3) + ') * span + time * spd) % span);\n' +
                                'var x = BX[0] + ' + u + ' * W + Math.sin(time * 0.5 + ' + i + ') * rf * 0.35;\n' +
                                'return blob(x, y, rr, 8, ' + sd + ', 0.08, 1.1);';
                    } else {
                        code += 'var pi = Math.min(Math.max((p - ' + (sp * d[i]).toFixed(4) + ') / ' + (1 - sp).toFixed(4) + ', 0), 1.15);\n' +
                                'var rr = rf * pi * (0.92 + 0.22 * hh(' + (sd + 1) + '));\n' +
                                'var x = BX[0] + ' + u + ' * W + noise([' + sd + ', time * 0.6]) * rf * 0.22, y = BX[1] + ' + w + ' * H + noise([' + (sd + 40) + ', time * 0.6]) * rf * 0.22;\n' +
                                'return blob(x, y, rr, 8, ' + sd + ', 0.07, 1.2);';
                    }
                    addPath(v, "bubble " + (i + 1), body(ctx, code), "fill", ctx.color(i));
                }
                var rf0 = 0.62 * Math.sqrt(Math.pow(ctx.W / G.cols, 2) + Math.pow(ctx.H / G.rows, 2));
                return Math.round(o.goo || Math.max(6, rf0 * (ctx.loop ? 0.22 : 0.3)));
            } },
        blob: { family: "fill", gooey: false, reveal: "hole", targets: ["shape", "background", "mask", "transition"], dur: "Sweep", ease: "Settle",
            use: "One liquid blob: grows from the origin with a breathing edge (the ink transition, the blob shape, the blobs background).",
            build: function (v, ctx, o) {
                var n = o.count || 1;
                for (var i = 0; i < n; i++) {
                    var sd = ctx.seed * 7 + i * 7 + 3;
                    addPath(v, "blob " + (i + 1), body(ctx, FN.blob +
                        'var dx = Math.max(Math.abs(OR[0] - BX[0]), Math.abs(OR[0] - BX[2])), dy = Math.max(Math.abs(OR[1] - BX[1]), Math.abs(OR[1] - BX[3]));\n' +
                        'var R = Math.sqrt(dx * dx + dy * dy) * 1.25 + 10, pi = Math.max((p - ' + (i * 0.12).toFixed(2) + ') / ' + (1 - i * 0.12).toFixed(2) + ', 0);\n' +
                        'return blob(OR[0], OR[1], R * pi, 18, ' + sd + ', 0.16, 1.6);'), "fill", ctx.color(i));
                }
                return 0;
            } },
        spring: { family: "physics", gooey: false, reveal: "shrink", targets: ["box", "shape"], dur: "Arrive", ease: "Pop",
            use: "Jelly box: a rounded rectangle on the token curve whose edges lag and wobble like a damped spring driven by the curve's own speed, then settle.",
            build: function (v, ctx, o) {
                var amp = o.wobble === undefined ? 0.5 : o.wobble, fr = o.frequency || 3.2, dm = o.damping || 5.5;
                addPath(v, "jelly", body(ctx,
                    'var W = BX[2] - BX[0], H = BX[3] - BX[1], cx = (BX[0] + BX[2]) / 2, cy = (BX[1] + BX[3]) / 2, dt = thisComp.frameDuration;\n' +
                    // each edge is a damped spring driven by the speed of p (a convolution over the last 1.5 s)
                    'function edge(f, ph) { var x = 0, w0 = Math.PI * 2 * f; for (var s = dt; s < 1.5; s += dt) { var v0 = (PT(time - s) - PT(time - s - dt)) / dt; if (v0 === 0) continue;\n' +
                    '  x += v0 * Math.exp(-' + dm + ' * s) * Math.sin(w0 * s + ph) * dt; } return x; }\n' +
                    'var sc = Math.max(p, 0), w2 = W / 2 * sc, h2 = H / 2 * sc, m = Math.min(W, H) * ' + amp.toFixed(3) + ';\n' +
                    'var bt = edge(' + fr + ', 0.0) * m, br = edge(' + (fr * 1.13).toFixed(3) + ', 0.6) * m, bb = edge(' + (fr * 0.93).toFixed(3) + ', 1.1) * m, bl = edge(' + (fr * 1.07).toFixed(3) + ', 1.7) * m;\n' +
                    'var rad = Math.max(Math.min(RAD, w2, h2), 0.01), kk = 0.5523 * rad, pts = [], it = [], ot = [];\n' +
                    'function side(a, b, nx, ny, bulge) { var L = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2)), ux = L > 0 ? (b[0] - a[0]) / L : 0, uy = L > 0 ? (b[1] - a[1]) / L : 0;\n' +
                    '  var m0 = [(a[0] + b[0]) / 2 + nx * bulge, (a[1] + b[1]) / 2 + ny * bulge];\n' +
                    '  pts.push(a); it.push([-ux * kk, -uy * kk]); ot.push([(m0[0] - a[0]) / 3, (m0[1] - a[1]) / 3]);\n' +
                    '  pts.push(m0); it.push([-ux * L / 6, -uy * L / 6]); ot.push([ux * L / 6, uy * L / 6]);\n' +
                    '  pts.push(b); it.push([(m0[0] - b[0]) / 3, (m0[1] - b[1]) / 3]); ot.push([ux * kk, uy * kk]); }\n' +
                    'side([cx - w2 + rad, cy - h2], [cx + w2 - rad, cy - h2], 0, -1, bt); side([cx + w2, cy - h2 + rad], [cx + w2, cy + h2 - rad], 1, 0, br);\n' +
                    'side([cx + w2 - rad, cy + h2], [cx - w2 + rad, cy + h2], 0, 1, bb); side([cx - w2, cy + h2 - rad], [cx - w2, cy - h2 + rad], -1, 0, bl);\n' +
                    'return createPath(pts, it, ot, true);'), "fill", ctx.color(0));
                return 0;
            } },
        flock: { family: "swarm", gooey: false, reveal: "shrink", targets: ["shape"], dur: "Stage", ease: "Cruise",
            use: "A flock (birds or a school of fish): a leader wanders on noise, the members trail it with their own lag and orbit, each turned to its heading.",
            build: function (v, ctx, o) {
                var n = o.count || 36, sz = o.size || 34, sp = (o.speed || 1) * 0.12;
                for (var i = 0; i < n; i++) {
                    var lag = (hash(i * 3 + ctx.seed) * 1.6).toFixed(3), ring = (0.25 + 0.75 * hash(i * 5 + ctx.seed + 2)).toFixed(3), ph = (hash(i * 11 + ctx.seed) * 6.28).toFixed(3);
                    addPath(v, "bird " + (i + 1), body(ctx,
                        'var W = BX[2] - BX[0], H = BX[3] - BX[1], R = Math.min(W, H) * 0.26;\n' +
                        'function lead(t) { return [(BX[0] + BX[2]) / 2 + noise([' + ctx.seed + ', t * ' + sp.toFixed(3) + ']) * W * 0.75, (BX[1] + BX[3]) / 2 + noise([' + (ctx.seed + 9) + ', t * ' + sp.toFixed(3) + ']) * H * 0.7]; }\n' +
                        'function pos(t) { var L0 = lead(t - ' + lag + '), a = t * 0.35 + ' + ph + ';\n' +
                        '  return [L0[0] + Math.cos(a) * R * ' + ring + ' + noise([' + i + ' * 2.1, t * 0.8]) * R * 0.4, L0[1] + Math.sin(a) * R * ' + ring + ' * 0.6 + noise([' + i + ' * 3.3 + 50, t * 0.8]) * R * 0.4]; }\n' +
                        'var a0 = pos(time), b0 = pos(time - 0.08), hx = a0[0] - b0[0], hy = a0[1] - b0[1], hl = Math.sqrt(hx * hx + hy * hy) || 1; hx /= hl; hy /= hl;\n' +
                        'var e = Math.min(Math.max((p - ' + (hash(i + ctx.seed * 3) * 0.4).toFixed(3) + ') / 0.6, 0), 1), s = ' + sz + ' * e * (0.75 + 0.5 * hh(' + i + ')), fl = 0.55 + 0.45 * Math.sin(time * 14 + ' + ph + ');\n' +
                        'var nx = -hy, ny = hx;\n' +
                        'return createPath([[a0[0] + hx * s, a0[1] + hy * s], [a0[0] - hx * s * 0.5 + nx * s * 0.7 * fl, a0[1] - hy * s * 0.5 + ny * s * 0.7 * fl], [a0[0] - hx * s * 0.2, a0[1] - hy * s * 0.2], [a0[0] - hx * s * 0.5 - nx * s * 0.7 * fl, a0[1] - hy * s * 0.5 - ny * s * 0.7 * fl]], [], [], true);'),
                        "fill", ctx.color(i));
                }
                return 0;
            } },
        flow: { family: "swarm", gooey: false, reveal: "shrink", targets: ["background", "shape"], dur: "Stage", ease: "Cruise",
            use: "Noise flow field: streamlines that follow a slowly turning noise field, like wind or water currents.",
            build: function (v, ctx, o) {
                var n = o.count || 70, steps = 18, sc = o.scale || 0.0018, sp = (o.speed || 1) * 0.08;
                for (var i = 0; i < n; i++) {
                    var u = hash(i * 3 + ctx.seed).toFixed(4), w = hash(i * 7 + ctx.seed + 1).toFixed(4);
                    addPath(v, "stream " + (i + 1), body(ctx, FN.smooth +
                        'var W = BX[2] - BX[0], H = BX[3] - BX[1], st = Math.min(W, H) * 0.022, x = BX[0] + ' + u + ' * W, y = BX[1] + ' + w + ' * H, pts = [[x, y]];\n' +
                        'var m = Math.max(2, Math.round(' + steps + ' * Math.min(Math.max(p, 0), 1)));\n' +
                        'for (var s = 1; s < m; s++) { var a = noise([x * ' + sc + ', y * ' + sc + ', time * ' + sp.toFixed(3) + ' + ' + ctx.seed + ']) * Math.PI * 3; x += Math.cos(a) * st; y += Math.sin(a) * st; pts.push([x, y]); }\n' +
                        'return smoothPath(pts, false);'), "stroke", ctx.color(i), o.stroke || 2.5);
                }
                return 0;
            } },
        voronoi: { family: "fill", gooey: false, reveal: "shrink", targets: ["background", "transition", "mask", "box"], dur: "Sweep", ease: "Surge",
            use: "Voronoi cells: the region shatters into drifting cells that pop in from the origin (shards, stained glass, cell biology).",
            build: function (v, ctx, o) {
                var n = o.count || (ctx.loop ? 34 : 20), G = grid(n, ctx.aspect, ctx.seed, 1.6), d = distOrder(G.pts, o, ctx.aspect), sp = o.spread === undefined ? 0.55 : o.spread;
                var gap = o.gap === undefined ? (ctx.cover ? 0 : 0.1) : o.gap, jt = ctx.loop ? 0.35 / Math.max(G.cols, G.rows) : 0.12 / Math.max(G.cols, G.rows);
                var SD = arr(G.pts), drift = ctx.loop ? 0.12 * (o.speed || 1) : 0.25;
                for (var i = 0; i < G.pts.length; i++) {
                    addPath(v, "cell " + (i + 1), body(ctx,
                        'var SD = ' + SD + ', me0 = ' + i + ', W = BX[2] - BX[0], H = BX[3] - BX[1];\n' +
                        'function sp(j) { return [BX[0] + (SD[j][0] + noise([j * 2.3 + ' + ctx.seed + ', time * ' + drift + ']) * ' + jt.toFixed(4) + ') * W, BX[1] + (SD[j][1] + noise([j * 4.1 + ' + (ctx.seed + 30) + ', time * ' + drift + ']) * ' + jt.toFixed(4) + ') * H]; }\n' +
                        'var me = sp(me0), poly = [[BX[0] - 6, BX[1] - 6], [BX[2] + 6, BX[1] - 6], [BX[2] + 6, BX[3] + 6], [BX[0] - 6, BX[3] + 6]];\n' +
                        'for (var j = 0; j < SD.length; j++) { if (j === me0) continue; var ot = sp(j), nx = ot[0] - me[0], ny = ot[1] - me[1], mx = (ot[0] + me[0]) / 2, my = (ot[1] + me[1]) / 2, nw = [];\n' +
                        '  for (var e = 0; e < poly.length; e++) { var A = poly[e], Bq = poly[(e + 1) % poly.length], da = (A[0] - mx) * nx + (A[1] - my) * ny, db = (Bq[0] - mx) * nx + (Bq[1] - my) * ny;\n' +
                        '    if (da <= 0) nw.push(A); if ((da <= 0) !== (db <= 0)) { var tt = da / (da - db); nw.push([A[0] + (Bq[0] - A[0]) * tt, A[1] + (Bq[1] - A[1]) * tt]); } }\n' +
                        '  poly = nw; if (poly.length < 3) break; }\n' +
                        'var pi = Math.min(Math.max((p - ' + (sp * d[i]).toFixed(4) + ') / ' + (1 - sp).toFixed(4) + ', 0), 1.1), f = pi * ' + (1 - gap).toFixed(3) + ', pts = [];\n' +
                        'if (poly.length < 3) return createPath([me, me, me], [], [], true);\n' +
                        'for (var e2 = 0; e2 < poly.length; e2++) pts.push([me[0] + (poly[e2][0] - me[0]) * f, me[1] + (poly[e2][1] - me[1]) * f]);\n' +
                        'return createPath(pts, [], [], true);'), "fill", ctx.color(i));
                }
                if (o.round !== 0 && !ctx.cover) { var rc = v.addProperty("ADBE Vector Filter - RC"); rc.property(1).setValue(o.round || Math.round(Math.min(ctx.W, ctx.H) / Math.max(G.cols, G.rows) * 0.12)); }
                return 0;
            } },
        rope: { family: "physics", gooey: false, reveal: "shrink", targets: ["shape"], dur: "Sweep", ease: "Surge",
            use: "Verlet rope: one end is pinned, the other is carried to its place on the token curve; gravity and the rope's length do the rest (sag, swing, settle).",
            build: function (v, ctx, o) {
                var m = o.segments || 16, slack = o.slack || 1.06, grav = o.gravity || 2600;
                addPath(v, "rope", body(ctx, FN.smooth +
                    'var W = BX[2] - BX[0], H = BX[3] - BX[1], A = [BX[0], BX[3]], E = [BX[2], BX[3]], dt = thisComp.frameDuration / 2, m = ' + m + ';\n' +
                    'function endAt(t) { var u = PT(t); return [A[0] + (E[0] - A[0]) * u, A[1] + (E[1] - A[1]) * u - Math.sin(Math.min(Math.max(u, 0), 1) * Math.PI) * H * 0.35]; }\n' +
                    'var seg = W * ' + slack + ' / (m - 1), t0 = Math.max(inPoint, time - 6), x = [], xp = [];\n' +
                    'for (var i = 0; i < m; i++) { x.push([A[0] + 0.01 * i, A[1]]); xp.push([A[0] + 0.01 * i, A[1]]); }\n' +   // coiled at the pinned end: it pays out as the end travels
                    'for (var t = t0; t <= time + 1e-6; t += dt) { var B0 = endAt(t);\n' +
                    '  for (var i = 1; i < m - 1; i++) { var nx = x[i][0] + (x[i][0] - xp[i][0]) * 0.985 + noise([i * 0.3, t * 0.6]) * 0.15, ny = x[i][1] + (x[i][1] - xp[i][1]) * 0.985 + ' + grav + ' * dt * dt; xp[i] = x[i]; x[i] = [nx, ny]; }\n' +
                    '  for (var it = 0; it < 6; it++) { x[0] = [A[0], A[1]]; x[m - 1] = [B0[0], B0[1]];\n' +
                    '    for (var i = 0; i < m - 1; i++) { var dx = x[i + 1][0] - x[i][0], dy = x[i + 1][1] - x[i][1], dl = Math.sqrt(dx * dx + dy * dy) || 0.001;\n' +
                    '      if (dl <= seg) continue; var df = (dl - seg) / dl * 0.5, wa = i === 0 ? 0 : 1, wb = i + 1 === m - 1 ? 0 : 1, sw = wa + wb || 1;\n' +
                    '      x[i] = [x[i][0] + dx * df * 2 * wa / sw, x[i][1] + dy * df * 2 * wa / sw]; x[i + 1] = [x[i + 1][0] - dx * df * 2 * wb / sw, x[i + 1][1] - dy * df * 2 * wb / sw]; } } }\n' +
                    'return smoothPath(x, false);'), "stroke", ctx.color(0), o.stroke || 6);
                return 0;
            } },
        grow: { family: "fill", gooey: false, reveal: "shrink", targets: ["shape", "background"], dur: "Stage", ease: "Settle",
            use: "Organic growth: branches grow from the origin, wander and split like vines or roots, tapering with each generation.",
            build: function (v, ctx, o) {
                // the tree is grown here (seeded, so it is the same every time); the expressions only trim it with p
                var B0 = ctx.box0, f = originOf(o), org = [B0[0] + f[0] * (B0[2] - B0[0]), B0[1] + f[1] * (B0[3] - B0[1])];
                var cx = (B0[0] + B0[2]) / 2, cy = (B0[1] + B0[3]) / 2, diag = Math.sqrt(Math.pow(B0[2] - B0[0], 2) + Math.pow(B0[3] - B0[1], 2));
                var seed = ctx.seed * 101, rnd = function () { seed += 1; return hash(seed); }, branches = [], maxD = o.depth || 3, w0 = o.stroke || Math.max(3, Math.round(diag / 260));
                function grow(x, y, ang, len, depth, a) {
                    var pts = [[x, y]], steps = 12, sg = len / steps, span = 0.5 / (depth + 1), kids = [];
                    for (var s = 1; s <= steps; s++) {
                        ang += (rnd() - 0.5) * 0.55; x += Math.cos(ang) * sg; y += Math.sin(ang) * sg; pts.push([x, y]);
                        if (depth < maxD && (s === 4 || s === 8) && rnd() < 0.85) kids.push([x, y, ang + (rnd() < 0.5 ? -1 : 1) * (0.45 + rnd() * 0.5), len * (0.5 + rnd() * 0.2), depth + 1, a + span * s / steps]);
                    }
                    branches.push({ pts: pts, a: a, b: a + span, depth: depth });
                    for (var k = 0; k < kids.length; k++) grow.apply(null, kids[k]);
                }
                var roots = o.count || 5, base = Math.atan2(cy - org[1], cx - org[0]), fan = (f[0] === 0.5 && f[1] === 0.5) ? Math.PI * 2 : Math.PI * 0.7;
                for (var r = 0; r < roots; r++) grow(org[0], org[1], base + (fan >= Math.PI * 2 ? r / roots * fan : (r / Math.max(roots - 1, 1) - 0.5) * fan) + (rnd() - 0.5) * 0.3, diag * (fan >= Math.PI * 2 ? 0.32 : 0.55), 0, 0);
                var end = 0; for (var e = 0; e < branches.length; e++) end = Math.max(end, branches[e].b);
                for (var b = 0; b < branches.length; b++) {
                    var br = branches[b], g = v.addProperty("ADBE Vector Group"); g.name = "branch " + (b + 1);
                    var gv = g.property("ADBE Vectors Group"), sh = new Shape(), ins = [], outs = [], P = br.pts;
                    for (var i = 0; i < P.length; i++) { var pa = P[Math.max(i - 1, 0)], pb = P[Math.min(i + 1, P.length - 1)], tx = (pb[0] - pa[0]) / 6, ty = (pb[1] - pa[1]) / 6; ins.push([-tx, -ty]); outs.push([tx, ty]); }
                    sh.vertices = P; sh.inTangents = ins; sh.outTangents = outs; sh.closed = false;
                    gv.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
                    var tr = gv.addProperty("ADBE Vector Filter - Trim");
                    tr.property("ADBE Vector Trim End").expression = ctx.pre + 'Math.min(Math.max((p - ' + (br.a / end).toFixed(4) + ') / ' + ((br.b - br.a) / end).toFixed(4) + ', 0), 1) * 100;';
                    var st = gv.addProperty("ADBE Vector Graphic - Stroke"), cExpr = ctx.color(br.depth);
                    if (cExpr) st.property("ADBE Vector Stroke Color").expression = cExpr; else st.property("ADBE Vector Stroke Color").setValue([1, 1, 1]);
                    st.property("ADBE Vector Stroke Width").setValue(Math.max(1, w0 * Math.pow(0.62, br.depth)));
                    st.property("ADBE Vector Stroke Line Cap").setValue(2); st.property("ADBE Vector Stroke Line Join").setValue(2);
                    if (o.leaves !== false && br.depth === maxD) {   // a bud at the tip, popping when the branch arrives
                        var bud = gv.addProperty("ADBE Vector Shape - Ellipse"), tip = P[P.length - 1], bs = w0 * 2.2;
                        bud.property("ADBE Vector Ellipse Position").setValue(tip);
                        bud.property("ADBE Vector Ellipse Size").expression = ctx.pre + 'var e = Math.min(Math.max((p - ' + (br.b / end).toFixed(4) + ' + 0.04) / 0.08, 0), 1); [' + bs + ' * e, ' + bs + ' * e];';
                        var bf = gv.addProperty("ADBE Vector Graphic - Fill");
                        if (cExpr) bf.property("ADBE Vector Fill Color").expression = ctx.color(br.depth + 1); else bf.property("ADBE Vector Fill Color").setValue([1, 1, 1]);
                    }
                }
                return 0;
            } }
    };
    // modifiers: not a path of their own, they work on any existing layer (target "layer")
    B.line_boil = { family: "modifier", gooey: false, reveal: "shrink", targets: ["layer"], dur: "Blink", ease: "Flat",
        use: "Hand-drawn line boil: outlines tremble as if redrawn on 3s (three drawings cycling). Shape layers get Wiggle Paths on their own geometry; text, footage and solids a fine Turbulent Displace. Works on any layer and in styles (Collage).",
        apply: function (L, o) {
            var fps = 1 / L.containingComp.frameDuration, step = o.step || 3, F = (fps / step).toFixed(3), cyc = o.drawings || 3, amt = o.amount === undefined ? 1 : o.amount;
            var pick = 'posterizeTime(' + F + '); Math.floor(time * ' + F + ') % ' + cyc;
            var fx = L.property("ADBE Effect Parade"), done = [];
            if (L instanceof ShapeLayer) {
                var rough = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Filter - Roughen"); rough.name = "SS Line Boil";
                rough.property("ADBE Vector Roughen Size").setValue(2.2 * amt);
                rough.property("ADBE Vector Roughen Detail").setValue(o.detail || 6);
                rough.property("ADBE Vector Roughen Points").setValue(2);      // smooth: a pen line, not a zigzag
                rough.property("ADBE Vector Temporal Freq").setValue(0);       // still between steps…
                rough.property("ADBE Vector Random Seed").expression = pick + ' + 1;';   // …a new drawing each step
                done.push("Wiggle Paths");
            }
            var td = fx.addProperty("ADBE Turbulent Displace"); td.name = "SS Line Boil";
            td = fx.property("SS Line Boil");
            td.property(2).setValue((L instanceof ShapeLayer ? 14 : 22) * amt);   // amount (a strength, not px)
            td.property(3).setValue(o.size || 7);                                // size: a fine tremble on the edge
            td.property(6).expression = pick + ' * 97;';                         // evolution: one per drawing
            try { td.property(12).setValue(1); } catch (e) {}                    // pin none: the edge can move
            done.push("Turbulent Displace");
            L.comment = (L.comment ? L.comment + " | " : "") + "SS line boil (" + done.join(" + ") + ", on " + step + "s)";
            return L.name + ": line boil on " + step + "s, " + cyc + " drawings (" + done.join(" + ") + ")";
        } };
    var NAMES = []; for (var nm in B) if (B.hasOwnProperty(nm)) NAMES.push(nm);
    function get(name) { if (!B[name]) throw new Error("Unknown behaviour: " + name + " (" + NAMES.join(", ") + ")"); return B[name]; }
    function allows(beh, target) { for (var i = 0; i < beh.targets.length; i++) if (beh.targets[i] === target) return true; return false; }

    // ---------------------------------------------------------------- gooey pass
    function goo(L, px) {
        if (!px) return;
        var fx = L.property("ADBE Effect Parade"), b = fx.addProperty("ADBE Gaussian Blur 2"); b.name = "SS Goo Blur";
        b = fx.property("SS Goo Blur"); b.property(1).setValue(px); b.property(3).setValue(1);
        var lv = fx.addProperty("ADBE Pro Levels2"); lv.name = "SS Goo Threshold";
        lv = fx.property("SS Goo Threshold"); lv.property("ADBE Pro Levels2-0032").setValue(0.45); lv.property("ADBE Pro Levels2-0033").setValue(0.55);
    }
    function shapeLayer(comp, name) {
        var L = comp.layers.addShape(); L.name = uniqueName(comp, name);
        var T = L.property("ADBE Transform Group"); T.property("ADBE Anchor Point").setValue([0, 0]); T.property("ADBE Position").setValue([0, 0]);
        return L;
    }
    function control(L, type, name, value) { var e = L.property("ADBE Effect Parade").addProperty(type); e.name = name; if (value !== undefined) e.property(1).setValue(value); return e; }
    function layerBox(L, t) {   // comp-space bounds of a layer at t
        var r = L.sourceRectAtTime(t, false), a = L.sourceRectAtTime ? [r.left, r.top] : [0, 0];
        var T = L.property("ADBE Transform Group"), pos = T.property("ADBE Position").valueAtTime(t, false), an = T.property("ADBE Anchor Point").valueAtTime(t, false), sc = T.property("ADBE Scale").valueAtTime(t, false);
        var x0 = pos[0] + (a[0] - an[0]) * sc[0] / 100, y0 = pos[1] + (a[1] - an[1]) * sc[1] / 100;
        return [x0, y0, x0 + r.width * sc[0] / 100, y0 + r.height * sc[1] / 100];
    }
    function boundsExpr(layerName, t, pad) {
        return 'var TG = thisComp.layer(' + q(layerName) + '), tr0 = ' + t.toFixed(3) + ', rr0 = TG.sourceRectAtTime(tr0, false);\n' +
               'var a0 = TG.toComp([rr0.left, rr0.top], tr0), b0 = TG.toComp([rr0.left + rr0.width, rr0.top + rr0.height], tr0), pd = ' + pad + ';\n' +
               'var BX = [Math.min(a0[0], b0[0]) - pd, Math.min(a0[1], b0[1]) - pd, Math.max(a0[0], b0[0]) + pd, Math.max(a0[1], b0[1]) + pd];\n';
    }
    function ctxOf(pre, box0, o, loop, colorFn, cover) {
        var W = Math.max(box0[2] - box0[0], 1), H = Math.max(box0[3] - box0[1], 1);
        return { pre: pre, box0: box0, W: W, H: H, aspect: W / H, loop: !!loop, color: colorFn, seed: o.seed || 1, cover: !!cover };
    }
    function key(prog, o, beh) {
        var t = o.t || 0;
        SSM.animate(prog, t, 0, 100, o.dur || beh.dur, o.ease || beh.ease);
        if (o.out) SSM.animate(prog, o.out, 100, 0, o.dur || beh.dur, "Launch");
    }

    // ---------------------------------------------------------------- targets
    // shape / background: the behaviour on its own shape layer (Progress keyed with the token curve, Color 1-3)
    function shapeTarget(comp, name, o, bg) {
        var beh = get(name), W = comp.width, H = comp.height, cols = o.colors && o.colors.length ? o.colors : (bg ? ["#0A211F", "#174A46", "#2E8B80", "#D8FF85"] : ["#D8FF85", "#F7F9F2"]);
        var base = null;
        if (bg) { base = comp.layers.addSolid(rgb(cols[0]), uniqueName(comp, "BG · " + name + " base"), W, H, 1); }
        var L = shapeLayer(comp, (bg ? "BG · " : "BH · ") + name), ink = bg && cols.length > 1 ? cols.slice(1) : cols;
        control(L, "ADBE Slider Control", "Progress", 100);
        for (var c = 0; c < 3; c++) control(L, "ADBE Color Control", "Color " + (c + 1), rgb(ink[c % ink.length]));
        var box0, pre;
        if (o.layer) {
            var tg = comp.layer(o.layer); if (!tg) throw new Error("Layer not found: " + o.layer);
            var rest = Math.min(tg.outPoint - 0.05, (o.t || 0) + 2), pad = o.pad === undefined ? 12 : o.pad;
            box0 = layerBox(tg, rest); box0 = [box0[0] - pad, box0[1] - pad, box0[2] + pad, box0[3] + pad];
            pre = boundsExpr(o.layer, rest, pad);
        } else {
            var bx = o.box || (bg ? [-40, -40, W + 80, H + 80] : [W * 0.2, H * 0.2, W * 0.6, H * 0.6]);
            box0 = [bx[0], bx[1], bx[0] + bx[2], bx[1] + bx[3]];
            pre = 'var BX = ' + arr(box0, 1) + ';\n';
        }
        var loop = bg || o.loop;
        pre += 'function PT(t) { return thisLayer.effect("Progress")("Slider").valueAtTime(t) / 100; }\nvar p = PT(time), LOOP = ' + (loop ? 1 : 0) + ', RAD = ' + (o.radius === undefined ? 16 : o.radius) + ';\n' + originExpr(o);
        var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"); g.name = name;
        var px = beh.build(g.property("ADBE Vectors Group"), ctxOf(pre, box0, o, loop, function (i) { return 'effect("Color ' + (i % 3 + 1) + '")("Color")'; }), o);
        if (beh.gooey) goo(L, px);
        var prog = L.property("ADBE Effect Parade").property("Progress").property(1);
        if (!bg) key(prog, o, beh); else if (o.t !== undefined) { SSM.animate(prog, o.t, 0, 100, o.dur || "Stage", o.ease || "Settle"); }
        if (bg) { L.moveToEnd(); base.moveToEnd(); base.comment = "SS background: " + name + " (base)"; if (o.t !== undefined) base.inPoint = o.t; }
        else { L.inPoint = o.t || 0; if (o.out) L.outPoint = o.out + SSM.seconds(o.dur || beh.dur) + 0.05; }
        L.comment = (bg ? "SS background: " : "SS behavior: ") + name;
        return L;
    }
    // mask: the behaviour drawn as an alpha matte over any layer (text included): the layer shows through it
    function maskTarget(comp, name, o) {
        var beh = get(name); if (!o.layer) throw new Error("mask needs layer: the layer (text) to reveal");
        var tg = comp.layer(o.layer); if (!tg) throw new Error("Layer not found: " + o.layer);
        var rest = Math.min(tg.outPoint - 0.05, (o.t || 0) + 2), box0 = layerBox(tg, rest), pad = o.pad === undefined ? Math.round((box0[3] - box0[1]) * 0.15) : o.pad;
        box0 = [box0[0] - pad, box0[1] - pad, box0[2] + pad, box0[3] + pad];
        var L = shapeLayer(comp, "BH · " + name + " matte");
        control(L, "ADBE Slider Control", "Progress", 100);
        var pre = boundsExpr(o.layer, rest, pad) + 'function PT(t) { return thisLayer.effect("Progress")("Slider").valueAtTime(t) / 100; }\nvar p = PT(time), LOOP = 0, RAD = ' + (o.radius || 12) + ';\n' + originExpr(o);
        var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"); g.name = name;
        var px = beh.build(g.property("ADBE Vectors Group"), ctxOf(pre, box0, o, false, function () { return null; }, true), o);
        if (beh.gooey) goo(L, o.goo || px);
        key(L.property("ADBE Effect Parade").property("Progress").property(1), o, beh);
        L.moveBefore(tg); L.inPoint = tg.inPoint; L.outPoint = tg.outPoint;
        tg.setTrackMatte(L, TrackMatteType.ALPHA); L.enabled = false;
        L.comment = "SS behavior: " + name + " matte for " + tg.name;
        return L;
    }
    // box: an element's box (ss_elements.jsx) redrawn by the behaviour, on the element's Reveal, Box colour and Radius
    function boxTarget(comp, name, o) {
        var beh = get(name), ctrlName = o.element || o.layer; if (!ctrlName) throw new Error("box needs element: the element controller (EL · …)");
        var ctrl = comp.layer(ctrlName), box = comp.layer(ctrlName + " box"); if (!ctrl || !box) throw new Error("Element box not found: " + ctrlName + " box");
        var RV = ctrl.property("ADBE Effect Parade").property("Reveal").property(1), rest = RV.numKeys >= 2 ? RV.keyTime(2) + 1.2 : comp.time;
        if (RV.numKeys >= 3) rest = Math.min(rest, RV.keyTime(3) - 0.05);
        var r0 = box.sourceRectAtTime(rest, false), box0 = [r0.left, r0.top, r0.left + r0.width, r0.top + r0.height];
        var L = shapeLayer(comp, ctrlName + " " + name);
        var pre = 'var C0 = thisComp.layer(' + q(ctrlName) + '), RV0 = C0.effect("Reveal")("Slider"), tr0 = RV0.numKeys >= 2 ? RV0.key(2).time + 1.2 : time;\n' +
                  'if (RV0.numKeys >= 3) tr0 = Math.min(tr0, RV0.key(3).time - 0.05);\n' +
                  'var rr0 = thisComp.layer(' + q(ctrlName + " box") + ').sourceRectAtTime(tr0, false), BX = [rr0.left, rr0.top, rr0.left + rr0.width, rr0.top + rr0.height];\n' +
                  'function PT(t) { return RV0.valueAtTime(t) / 100; }\nvar p = PT(time), LOOP = 0, RAD = C0.effect("Radius")("Slider");\n' + originExpr(o);
        var col = 'thisComp.layer(' + q(ctrlName) + ').effect("' + (o.boxColor || "Box") + '")("Color")';
        var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"); g.name = name;
        var px = beh.build(g.property("ADBE Vectors Group"), ctxOf(pre, box0, o, false, function () { return col; }, true), o);
        if (beh.gooey) goo(L, o.goo || Math.max(4, Math.round(px * 0.6)));
        box.property("ADBE Transform Group").property("ADBE Opacity").setValue(0);   // the original box keeps measuring the text
        L.moveBefore(box); L.inPoint = box.inPoint; L.outPoint = box.outPoint;
        L.comment = "SS element: " + ctrlName + " (" + name + " box)";
        return L;
    }
    // transition pieces, called by SST.add(comp, "behavior", t, {behavior}) with its controller and eased prelude:
    // cover layers play the behaviour with SST's cover progress c; "hole" behaviours cut the reveal with a second copy
    // as an inverted alpha matte (progress o), "shrink" ones play backwards
    function transition(comp, ctrlName, prelude, orderK, o) {
        var name = o.behavior || "bubbles", beh = get(name), W = comp.width, H = comp.height, nl = Math.max(1, Math.round(o.layers || 1)), out = [];
        if (!allows(beh, "transition")) throw new Error("Behaviour " + name + " has no transition (passes: " + beh.targets.join(", ") + ")");
        var box0 = [0, 0, W, H], nc = Math.max(1, Math.min(3, (o.colors || [1, 2, 3]).length));
        for (var li = 0; li < nl; li++) {
            var k = orderK(o.order, li, nl, o.seed || 1), base = prelude(ctrlName, k, 1 - k) + 'var BX = [0, 0, thisComp.width, thisComp.height];\n';
            var oc = {}; for (var kk in o) oc[kk] = o[kk]; oc.seed = (o.seed || 1) + li * 3;
            var colorFn = (function (li0) { return function (i) { return 'thisComp.layer(' + q(ctrlName) + ').effect("Color ' + ((li0 + (name === "voronoi" ? i : 0)) % nc + 1) + '")("Color")'; }; })(li);
            var cv = shapeLayer(comp, ctrlName + " · " + (li + 1));
            var preC = base + 'var p = ' + (beh.reveal === "shrink" ? 'P <= 0.5 ? c : 1 - o' : 'c') + ', LOOP = 0, RAD = 0;\nfunction PT(t) { return p; }\n' + originExpr(oc);
            var g = cv.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"); g.name = name;
            var px = beh.build(g.property("ADBE Vectors Group"), ctxOf(preC, box0, oc, false, colorFn, true), oc);
            if (beh.gooey) goo(cv, px);
            if (beh.reveal === "hole") {
                var hl = shapeLayer(comp, ctrlName + " · " + (li + 1) + " hole"), oh = {}; for (var kh in oc) oh[kh] = oc[kh]; oh.seed = oc.seed + 50; oh.spread = o.spread === undefined ? 0.35 : o.spread;   // the hole opens wider, sooner
                var preH = base + 'var p = o, LOOP = 0, RAD = 0;\nfunction PT(t) { return p; }\n' + originExpr(oh);
                var gh = hl.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"); gh.name = name;
                var pxh = beh.build(gh.property("ADBE Vectors Group"), ctxOf(preH, box0, oh, false, function () { return null; }, true), oh);
                if (beh.gooey) goo(hl, pxh);
                out.push(cv); out.push(hl);   // later pieces go on top: the hole lands above its cover
                cv.setTrackMatte(hl, TrackMatteType.ALPHA_INVERTED); hl.enabled = false;
            } else out.push(cv);
        }
        return out;
    }

    function add(comp, name, target, o) {
        o = o || {};
        var beh = get(name);
        if (target === "text") target = "mask";
        if (!allows(beh, target)) throw new Error("Behaviour " + name + " does not pass on " + target + " (it does on: " + beh.targets.join(", ") + ")");
        if (target === "layer") {   // modifiers on existing layers (o.layer, or o.layers)
            var names = o.layers || (o.layer ? [o.layer] : []), res = [];
            if (!names.length) throw new Error(name + " needs layer (or layers): the layers to modify");
            for (var li = 0; li < names.length; li++) { var Ly = comp.layer(names[li]); if (!Ly) throw new Error("Layer not found: " + names[li]); res.push(beh.apply(Ly, o)); }
            return res.join("\n");
        }
        if (target === "shape") return shapeTarget(comp, name, o, false);
        if (target === "background") return shapeTarget(comp, name, o, true);
        if (target === "mask") return maskTarget(comp, name, o);
        if (target === "box") return boxTarget(comp, name, o);
        if (target === "transition") {
            if (typeof SST === "undefined") throw new Error("transition target needs ss_transitions.jsx");
            var oc = {}; for (var k in o) oc[k] = o[k]; oc.behavior = name;
            return SST.add(comp, "behavior", o.at === undefined ? comp.time : o.at, oc);
        }
        throw new Error("Unknown target: " + target + " (shape, background, mask, text, box, transition, layer)");
    }
    // families: fill (covers a region), swarm (populates a region, loops), physics (reacts to the curve), modifier (on any layer)
    var FAMILIES = ["fill", "swarm", "physics", "modifier"];
    function list() {
        var rows = [];
        for (var f = 0; f < FAMILIES.length; f++) for (var i = 0; i < NAMES.length; i++) if (B[NAMES[i]].family === FAMILIES[f])
            rows.push(FAMILIES[f] + " · " + NAMES[i] + " [" + B[NAMES[i]].targets.join(", ") + "]: " + B[NAMES[i]].use);
        return rows.join("\n");
    }
    return { fn: fn, names: NAMES, families: FAMILIES, family: function (name) { return get(name).family; }, add: add, transition: transition, list: list, goo: goo,
             targets: function (name) { return get(name).targets.slice(0); } };
})();
