// SS Transitions — parametric "flat 2D" transitions built from plain After Effects solids and masks (behavior modelled
// on Animation Composer's Flat 2D transitions, rebuilt from scratch). One controller null drives every piece through
// Expression Controls, so the look stays editable after it is built: Progress, Direction, Stagger, Ease In / Ease Out
// (dropdowns with the Motion DNA token curves, evaluated as cubic-bezier in each piece, overshoot included) and up to
// three colours. The pieces cover the frame at the cut (Progress 50) and uncover it after, so the clip underneath
// changes unseen. Timing comes from the duration tokens too (default Sweep).
//
// Usage: #include "ss_transitions.jsx"
//        SST.add(comp, "bars", 2.0, {count: 6, angle: 30, colors: ["#14110F", "#FF5A36"], stagger: 40, order: "center"});
//        SST.recipe(comp, "Center Split", 2.0, {colors: [...]});      // a named look from library/transitions.json
//        SST.add(comp, "behavior", 2.0, {behavior: "bubbles"});   // a behaviour (ss_behaviors.jsx) as the pieces: bubbles | blob | voronoi
//        SST.types → ["wipe","bars","blinds","split","interleave","stack","iris","diamond","grid"]
//        SST.add(comp, "zoom", 2.0, {outgoing: "Shot 1", incoming: "Shot 2"});   // clip to clip: zoom | spin | stretch | slide
// Options: dur (duration token, default "Sweep") or duration (s), ease_in / ease_out (token curve names: covering /
//          uncovering, default "Surge"), count, angle (deg, 0 = left to right), colors (hex list, cycled),
//          stagger (0-90 % of the half), order (index|reverse|center|edges|random|diagonal),
//          style ("slide" moves the piece across, "grow" scales it from one edge), alternate (odd pieces mirror),
//          cols/rows (grid), outgoing/incoming (layer names: trimmed at the cut).
if (typeof SSB === "undefined") $.evalFile(new File(File($.fileName).parent.fsName + "/ss_behaviors.jsx"));   // behaviours: blob(), behavior pieces
var SST = (function () {
    var TYPES = ["wipe", "bars", "blinds", "split", "interleave", "stack", "iris", "diamond", "grid", "dots", "fan", "liquid", "ink", "behavior"];
    var BLOB = SSB.fn("blob");   // the shared liquid blob (ss_behaviors.jsx): ink drops
    // where iris / diamond / fan grow from
    var ORIGIN = { center: [0, 0], "top-left": [-0.5, -0.5], "top-right": [0.5, -0.5], "bottom-left": [-0.5, 0.5], "bottom-right": [0.5, 0.5],
                   top: [0, -0.5], bottom: [0, 0.5], left: [-0.5, 0], right: [0.5, 0] };
    function originPx(o, W, H) { var f = ORIGIN[o.origin || "center"] || ORIGIN.center; return [f[0] * W, f[1] * H]; }
    var DEFAULT_COLORS = ["#14110F", "#FF5A36", "#F4EFE6"];
    var TOK = null;
    function tokens() {   // tokens/superside_motion_tokens.json: the same curves and durations as every other preset
        if (TOK) return TOK;
        var f = File(File($.fileName).parent.parent.fsName + "/tokens/superside_motion_tokens.json");
        f.encoding = "UTF-8"; f.open("r"); var txt = f.read(); f.close();
        TOK = eval("(" + txt + ")");
        return TOK;
    }
    function easeNames() { var e = tokens().easings, n = []; for (var i = 0; i < e.length; i++) n.push(e[i].name); return n; }
    function easeIndex(name) { var n = easeNames(); for (var i = 0; i < n.length; i++) if (n[i].toLowerCase() === String(name).toLowerCase()) return i + 1; throw new Error("Unknown curve token: " + name + " (" + n.join(", ") + ")"); }
    function durSeconds(name, fps) {
        var d = tokens().durations;
        for (var i = 0; i < d.length; i++) if (d[i].name.toLowerCase() === String(name).toLowerCase()) return d[i].frames / (fps || tokens().fps || 30);
        throw new Error("Unknown duration token: " + name);
    }
    function bezierTable() {
        var e = tokens().easings, rows = [];
        for (var i = 0; i < e.length; i++) rows.push("[" + e[i].bezier.join(",") + "]");
        return "[" + rows.join(",") + "]";
    }

    // three shades of one colour (darker, the colour, lighter): flat transitions look richer in one hue than in three
    function shades(hex) {
        var c = rgb(hex), out = [], k = [0.55, 1, 1.35];
        for (var i = 0; i < 3; i++) {
            var v = [];
            for (var j = 0; j < 3; j++) v.push(k[i] <= 1 ? c[j] * k[i] : c[j] + (1 - c[j]) * (k[i] - 1));
            out.push("#" + hx(v[0]) + hx(v[1]) + hx(v[2]));
        }
        return out;
    }
    function hx(x) { var s = Math.round(Math.min(Math.max(x, 0), 1) * 255).toString(16); return s.length < 2 ? "0" + s : s; }
    function rgb(hex) {
        var h = String(hex).replace("#", "");
        if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
        return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
    }
    function control(L, type, name, value) {
        var fx = L.property("ADBE Effect Parade").addProperty(type);
        fx.name = name;
        if (value !== undefined) fx.property(1).setValue(value);
        return fx;
    }
    function uniqueName(comp, base) {
        for (var n = 1; ; n++) {
            var name = base + " " + n, used = false;
            for (var i = 1; i <= comp.numLayers; i++) if (comp.layer(i).name === name) { used = true; break; }
            if (!used) return name;
        }
    }
    // order value 0..1 for piece i of n (pieces with a lower value move first)
    function orderK(order, i, n, seed) {
        if (n <= 1) return 0;
        var u = i / (n - 1);
        if (order === "reverse") return 1 - u;
        if (order === "center") return Math.abs(u - 0.5) * 2;
        if (order === "edges") return 1 - Math.abs(u - 0.5) * 2;
        if (order === "random") { var x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453; return x - Math.floor(x); }
        return u;
    }
    // expression prelude shared by every piece: local cover (c) and reveal (o) progress, eased with the token curves
    // picked on the controller (cubic-bezier solved by Newton steps; y beyond 0..1 gives the overshoot of Pop, Nudge…)
    function prelude(ctrl, k, kOut) {
        if (kOut === undefined) kOut = k;
        return 'var C = thisComp.layer("' + ctrl + '");\n' +
            'var P = C.effect("Progress")("Slider") / 100, S = Math.min(Math.max(C.effect("Stagger")("Slider") / 100, 0), 0.9);\n' +
            'var EZ = ' + bezierTable() + ';\n' +
            'var EI = EZ[Math.max(0, Math.min(EZ.length - 1, Math.round(C.effect("Ease In")(1)) - 1))], EO = EZ[Math.max(0, Math.min(EZ.length - 1, Math.round(C.effect("Ease Out")(1)) - 1))];\n' +
            'var k = ' + k.toFixed(4) + ', kOut = ' + kOut.toFixed(4) + ';\n' +
            'function bz(x, e) { x = Math.min(Math.max(x, 0), 1); if (x <= 0) return 0; if (x >= 1) return 1;\n' +
            '  var a = e[0], b = e[1], cc = e[2], d = e[3], u = x;\n' +
            '  for (var i = 0; i < 8; i++) { var f = 3 * a * u * (1 - u) * (1 - u) + 3 * cc * u * u * (1 - u) + u * u * u - x;\n' +
            '    var df = 3 * a * (1 - u) * (1 - u) + 6 * (cc - a) * u * (1 - u) + 3 * (1 - cc) * u * u; if (Math.abs(df) < 1e-6) break;\n' +
            '    u = Math.min(Math.max(u - f / df, 0), 1); }\n' +
            '  return 3 * b * u * (1 - u) * (1 - u) + 3 * d * u * u * (1 - u) + u * u * u; }\n' +
            'var q = P <= 0.5 ? P / 0.5 : 1, r = P > 0.5 ? (P - 0.5) / 0.5 : 0;\n' +
            'var c = bz((q - S * k) / (1 - S), EI), o = bz((r - S * kOut) / (1 - S), EO);\n';
    }
    // a dropdown of the curve tokens (AE 2023+); older versions get a slider holding the token number
    function easeControl(ctrl, name, token) {
        var idx = easeIndex(token);
        try {
            var fx = ctrl.property("ADBE Effect Parade").addProperty("ADBE Dropdown Control");
            fx.name = name;
            var menu = fx.property(1).setPropertyParameters(easeNames());   // recreates the effect (default name): use the returned property
            menu.setValue(idx);
            menu.propertyGroup(1).name = name;
        } catch (e) {
            var fx2 = ctrl.property("ADBE Effect Parade").property(name) || ctrl.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
            fx2.name = name; fx2.property(1).setValue(idx);
        }
    }
    function fill(L, ctrl, colorIndex) {
        var f = L.property("ADBE Effect Parade").addProperty("ADBE Fill");
        f.property("ADBE Fill-0002").expression = 'thisComp.layer("' + ctrl + '").effect("Color ' + (colorIndex + 1) + '")("Color")';
    }
    function gradient(L, ctrl, colorIndex, w) {   // a ramp from this piece's colour to the next one, across the piece
        var g = L.property("ADBE Effect Parade").addProperty("ADBE Ramp"); g.name = "SS Gradient";
        g = L.property("ADBE Effect Parade").property("SS Gradient");
        g.property(1).setValue([0, 0]); g.property(3).setValue([w, 0]);
        g.property(2).expression = 'thisComp.layer("' + ctrl + '").effect("Color ' + (colorIndex + 1) + '")("Color")';
        g.property(4).expression = 'thisComp.layer("' + ctrl + '").effect("Color ' + ((colorIndex + 1) % 3 + 1) + '")("Color")';
    }
    function piece(comp, source, ctrl, name, colorIndex, grad) {
        var L = comp.layers.add(source);
        L.name = name; L.setParentWithJump(comp.layer(ctrl));   // no compensation: the pieces live in the controller's rotated space
        L.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([source.width / 2, source.height / 2]);
        if (grad) gradient(L, ctrl, colorIndex, source.width); else fill(L, ctrl, colorIndex);
        return L;
    }
    function circleMask(L, R, cx, cy, mode) {
        var m = L.property("ADBE Mask Parade").addProperty("ADBE Mask Atom"), s = new Shape(), t = R * 0.5523;
        s.vertices = [[cx, cy - R], [cx + R, cy], [cx, cy + R], [cx - R, cy]];
        s.inTangents = [[-t, 0], [0, -t], [t, 0], [0, t]]; s.outTangents = [[t, 0], [0, t], [-t, 0], [0, -t]]; s.closed = true;
        m.property("ADBE Mask Shape").setValue(s); m.maskMode = mode;
        return m;
    }
    function diamondMask(L, R, cx, cy, mode) {
        var m = L.property("ADBE Mask Parade").addProperty("ADBE Mask Atom"), s = new Shape();
        s.vertices = [[cx, cy - R], [cx + R, cy], [cx, cy + R], [cx - R, cy]]; s.closed = true;
        m.property("ADBE Mask Shape").setValue(s); m.maskMode = mode;
        return m;
    }

    function add(comp, type, t, o) {
        o = o || {};
        for (var ct = 0; ct < CLIP_TYPES.length; ct++) if (CLIP_TYPES[ct] === type) return clip(comp, type, t, o);
        if (type === "wipe") { type = "bars"; o.count = 1; }
        if (type === "blinds") { type = "bars"; o.style = o.style || "grow"; o.count = o.count || 8; }
        if (type === "split") { type = "bars"; o.count = 2; o.alternate = true; }
        if (type === "interleave") { type = "bars"; o.count = o.count || 8; o.alternate = true; }
        if (type === "stack") { type = "bars"; o.full = true; o.count = o.count || (o.colors || DEFAULT_COLORS).length; o.order = o.order || "index"; }
        if (type === "dots") { type = "grid"; o.round = true; o.cols = o.cols || 12; }
        var known = { bars: 1, iris: 1, diamond: 1, grid: 1, fan: 1, liquid: 1, ink: 1, behavior: 1 };
        if (!known[type]) throw new Error("Unknown transition type: " + type + " (" + TYPES.join(", ") + ")");
        var d = o.duration || durSeconds(o.dur || "Sweep", 1 / comp.frameDuration), t0 = t - d / 2, t1 = t + d / 2;
        var colors = o.colors && o.colors.length ? o.colors.slice(0, 3) : DEFAULT_COLORS;
        if (o.tonal || (o.colors && o.colors.length === 1)) colors = shades(colors[0]);
        var W = comp.width, H = comp.height, D = Math.ceil(Math.sqrt(W * W + H * H)) + 4;
        var label = o.name || type;

        // controller: a null at the comp centre (anchor 0,0) that also rotates the pieces
        var ctrl = comp.layers.addNull(); ctrl.name = uniqueName(comp, "TR · " + label);
        var CT = ctrl.property("ADBE Transform Group");
        CT.property("ADBE Anchor Point").setValue([0, 0]); CT.property("ADBE Position").setValue([W / 2, H / 2]);
        var prog = control(ctrl, "ADBE Slider Control", "Progress").property(1);
        prog.setValueAtTime(t0, 0); prog.setValueAtTime(t1, 100);
        control(ctrl, "ADBE Angle Control", "Direction", (type === "bars" || type === "liquid" || type === "fan") ? (o.angle || 0) : 0);
        var stg = o.stagger;   // explicit ifs (ExtendScript ternary pitfall)
        if (stg === undefined) { var cnt = o.count || 1; if (type === "bars" && !o.count) cnt = 6; stg = (cnt > 1 || type === "grid") ? 35 : 0; }
        control(ctrl, "ADBE Slider Control", "Stagger", stg);
        easeControl(ctrl, "Ease In", o.ease_in || "Surge");
        easeControl(ctrl, "Ease Out", o.ease_out || o.ease_in || "Surge");
        for (var ci = 0; ci < 3; ci++) control(ctrl, "ADBE Color Control", "Color " + (ci + 1), rgb(colors[ci % colors.length]));
        if (type === "bars") CT.property("ADBE Rotate Z").expression = 'effect("Direction")("Angle")';
        ctrl.inPoint = t0; ctrl.outPoint = t1; ctrl.enabled = false;
        var name = ctrl.name, pieces = [], seed = o.seed || 1, nc = colors.length;

        if (type === "bars") {
            // Geometry follows the live Direction angle: travel = the frame's extent along the move (Lt), band layout =
            // its extent across (Pe), so every bar lands inside the frame and none of the move happens off screen.
            // Slide pieces also carry a spare length (ext = 35 % of Lt) on the side that matters: behind them while
            // covering (an overshooting curve never opens a gap), ahead while uncovering (the trailing edge reveals at
            // once). At Progress 50 both placements cover the frame, so the switch is invisible.
            var n = Math.max(1, Math.round(o.count || 6)), grow = o.style === "grow";
            var SW = Math.ceil(D * 1.35), SH = Math.ceil(o.full ? D : D / n) + 2;
            var src = comp.layers.addSolid([1, 1, 1], name + " piece", SW, SH, 1).source;
            comp.layer(1).remove();
            var geo = 'var an = degreesToRadians(C.effect("Direction")("Angle")), ca = Math.abs(Math.cos(an)), sa = Math.abs(Math.sin(an));\n' +
                      'var Lt = ca * thisComp.width + sa * thisComp.height + 4, Pe = sa * thisComp.width + ca * thisComp.height + 4, ext = ' + (grow ? '0' : '0.35 * Lt') + ';\n' +
                      'var band = ' + (o.full ? 'Pe' : 'Pe / ' + n) + ';\n';
            for (var i = 0; i < n; i++) {
                var L = piece(comp, src, name, name + " · " + (i + 1), i % nc, o.gradient);
                var sign = (o.alternate && i % 2) ? -1 : 1, yExpr = o.full ? '0' : '-Pe / 2 + band * ' + (i + 0.5);
                var kc = orderK(o.order, i, n, seed), pre = prelude(name, kc, o.full ? 1 - kc : kc) + geo;
                var T = L.property("ADBE Transform Group");
                if (grow) {
                    T.property("ADBE Position").expression = pre + 'var x = -Lt / 2 + Lt * o + Lt * (c - o) / 2;\n[' + sign + ' * x, ' + yExpr + '];';
                    T.property("ADBE Scale").expression = pre + '[Math.max(c - o, 0) * Lt / ' + SW + ' * 100, (band + 2) / ' + SH + ' * 100];';
                } else {
                    T.property("ADBE Position").expression = pre + 'var x = P <= 0.5 ? -Lt + Lt * c - ext / 2 : Lt * o + ext / 2;\n[' + sign + ' * x, ' + yExpr + '];';
                    if (o.swing !== false && !o.full) T.property("ADBE Rotate Z").expression = pre + 'var m = P <= 0.5 ? 1 - c : o; ' + sign + ' * ' + (o.swing || 6) + ' * Math.sin(Math.min(Math.max(m, 0), 1) * Math.PI);';
                    T.property("ADBE Scale").expression = pre + '[(Lt + ext) / ' + SW + ' * 100, (band + 2) / ' + SH + ' * 100];';
                }
                pieces.push(L);
            }
        } else if (type === "iris" || type === "diamond") {
            var rings = Math.max(1, Math.round(o.count || 1)), org = originPx(o, W, H), R = 0;
            var corners = [[-W / 2, -H / 2], [W / 2, -H / 2], [-W / 2, H / 2], [W / 2, H / 2]];
            for (var cn = 0; cn < 4; cn++) {   // reach the farthest corner from the origin
                var dx = Math.abs(corners[cn][0] - org[0]), dy = Math.abs(corners[cn][1] - org[1]);
                R = Math.max(R, type === "diamond" ? dx + dy : Math.sqrt(dx * dx + dy * dy));
            }
            R = Math.ceil(R) + 4;
            var size = Math.ceil(2 * R) + 4;
            var src2 = comp.layers.addSolid([1, 1, 1], name + " piece", size, size, 1).source;
            comp.layer(1).remove();
            for (var j = 0; j < rings; j++) {
                var L2 = piece(comp, src2, name, name + " · " + (j + 1), j % nc);
                var mk = type === "diamond" ? diamondMask : circleMask;
                mk(L2, R, size / 2, size / 2, MaskMode.ADD);
                var hole = mk(L2, R, size / 2, size / 2, MaskMode.SUBTRACT);
                var kr = orderK(o.order, j, rings, seed), pre2 = prelude(name, kr, 1 - kr);
                L2.property("ADBE Transform Group").property("ADBE Position").setValue(org);
                L2.property("ADBE Transform Group").property("ADBE Scale").expression = pre2 + 'var s = Math.max(c, 0.0001) * 100; [s, s];';
                hole.property("ADBE Mask Offset").expression = pre2 + '-' + R + ' * (1 - o) - 1;';
                pieces.push(L2);
            }
        } else if (type === "grid") {
            var cols = Math.max(1, Math.round(o.cols || 8)), rows = Math.max(1, Math.round(o.rows || Math.round(cols * H / W)));
            var cw = W / cols, rh = H / rows;
            var src3 = comp.layers.addSolid([1, 1, 1], name + " piece", Math.ceil(cw) + 2, Math.ceil(rh) + 2, 1).source;
            comp.layer(1).remove();
            var count = cols * rows, idx = 0;
            for (var r = 0; r < rows; r++) for (var cc = 0; cc < cols; cc++, idx++) {
                var L3 = piece(comp, src3, name, name + " · " + (idx + 1), (r + cc) % nc);
                var k3;
                if (o.order === "center") k3 = Math.min(1, Math.sqrt(Math.pow((cc + 0.5) / cols - 0.5, 2) + Math.pow((r + 0.5) / rows - 0.5, 2)) / 0.7072);
                else if (o.order === "random") k3 = orderK("random", idx, count, seed);
                else if (o.order === "index") k3 = idx / Math.max(count - 1, 1);
                else k3 = (cc / Math.max(cols - 1, 1) + r / Math.max(rows - 1, 1)) / 2;   // diagonal (default)
                L3.property("ADBE Transform Group").property("ADBE Position").setValue([-W / 2 + cw * (cc + 0.5), -H / 2 + rh * (r + 0.5)]);
                if (o.round) { var em = L3.property("ADBE Mask Parade").addProperty("ADBE Mask Atom"), es = new Shape(), rx = (cw + 2) / 2, ry = (rh + 2) / 2, kx = rx * 0.5523, ky = ry * 0.5523;
                    es.vertices = [[rx, 0], [2 * rx, ry], [rx, 2 * ry], [0, ry]]; es.inTangents = [[-kx, 0], [0, -ky], [kx, 0], [0, ky]]; es.outTangents = [[kx, 0], [0, ky], [-kx, 0], [0, -ky]]; es.closed = true;
                    em.property("ADBE Mask Shape").setValue(es); }
                L3.property("ADBE Transform Group").property("ADBE Scale").expression = prelude(name, k3) + 'var s = Math.max(c * (1 - o), 0) * ' + (o.round ? 145 : 100) + '; [s, s];';
                pieces.push(L3);
            }
        } else if (type === "fan") {
            // pie slices that sweep round the origin while covering, then sweep away while uncovering
            var nf = Math.max(1, Math.round(o.count || 4)), orgF = originPx(o, W, H), Rf = Math.ceil(D) + 4, sz = 2 * Rf;
            var src4 = comp.layers.addSolid([1, 1, 1], name + " piece", sz, sz, 1).source;
            comp.layer(1).remove();
            for (var f = 0; f < nf; f++) {
                var L4 = piece(comp, src4, name, name + " · " + (f + 1), f % nc);
                L4.property("ADBE Transform Group").property("ADBE Position").setValue(orgF);
                var mf = L4.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
                var kf = orderK(o.order, f, nf, seed);
                mf.property("ADBE Mask Shape").expression = prelude(name, kf) +
                    'var a0 = ' + (f * 360 / nf) + ' + C.effect("Direction")("Angle"), span = ' + (360 / nf + 0.5) + ';\n' +
                    'var from = a0 + span * Math.max(o, 0), to = a0 + span * Math.min(Math.max(c, 0), 1.2);\n' +
                    'var pts = [[' + Rf + ', ' + Rf + ']], n = 24;\n' +
                    'if (to > from) for (var i = 0; i <= n; i++) { var a = degreesToRadians(from + (to - from) * i / n); pts.push([' + Rf + ' + Math.cos(a) * ' + Rf + ', ' + Rf + ' + Math.sin(a) * ' + Rf + ']); }\n' +
                    'else pts = [[0, 0], [0.5, 0], [0, 0.5]];   // never a one-point path: the render queue turns it into black frames\n' +
                    'createPath(pts, [], [], true);';
                pieces.push(L4);
            }
        } else if (type === "liquid") {
            // colour layers whose leading (then trailing) edge is a living wave: an organic wipe. Pieces sit in the
            // controller's rotated space; the wave runs across the travel axis and moves with time.
            var nl = Math.max(1, Math.round(o.count || nc)), SWl = Math.ceil(D * 1.5);
            var src5 = comp.layers.addSolid([1, 1, 1], name + " piece", SWl, SWl, 1).source;
            comp.layer(1).remove();
            for (var li = 0; li < nl; li++) {
                var L5 = piece(comp, src5, name, name + " · " + (li + 1), li % nc);
                L5.property("ADBE Transform Group").property("ADBE Position").setValue([0, 0]);
                var kl = orderK(o.order, li, nl, seed), m5 = L5.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
                m5.property("ADBE Mask Shape").expression = prelude(name, kl, 1 - kl) +
                    'var an = degreesToRadians(C.effect("Direction")("Angle")), ca = Math.abs(Math.cos(an)), sa = Math.abs(Math.sin(an));\n' +
                    'var Lt = ca * thisComp.width + sa * thisComp.height, Pe = sa * thisComp.width + ca * thisComp.height, S0 = ' + SWl / 2 + ';\n' +
                    'var amp = Lt * ' + (o.wave || 0.05) + ', x0 = S0 - Lt / 2 - amp * 2.5, span = Lt + amp * 5;\n' +
                    'var right = P <= 0.5 ? x0 + span * c : ' + (SWl + 10) + ', left = P <= 0.5 ? -10 : x0 + span * o;\n' +
                    'function w(y, s) { return amp * Math.sin(y / Pe * Math.PI * 2.4 + time * 2.2 + s) + amp * 0.6 * noise([y / 180 + s, time * 0.9]); }\n' +
                    'var y0 = S0 - Pe / 2 - 40, y1 = S0 + Pe / 2 + 40, n = 28, pts = [];\n' +
                    'for (var i = 0; i <= n; i++) { var y = y0 + (y1 - y0) * i / n; pts.push([right + (P <= 0.5 ? w(y, ' + (li * 1.3).toFixed(2) + ') : 0), y]); }\n' +
                    'for (var i = n; i >= 0; i--) { var y = y0 + (y1 - y0) * i / n; pts.push([left + (P > 0.5 ? w(y, ' + (li * 1.3 + 7).toFixed(2) + ') : 0), y]); }\n' +
                    'createPath(pts, [], [], true);';
                pieces.push(L5);
            }
            CT.property("ADBE Rotate Z").expression = 'effect("Direction")("Angle")';
        } else if (type === "ink") {
            // ink drops: wobbly blobs that bloom from the origin and open a wobbly hole to the next shot
            var ni = Math.max(1, Math.round(o.count || nc)), orgI = originPx(o, W, H), RI = 0;
            var cornersI = [[-W / 2, -H / 2], [W / 2, -H / 2], [-W / 2, H / 2], [W / 2, H / 2]];
            for (var ci2 = 0; ci2 < 4; ci2++) RI = Math.max(RI, Math.sqrt(Math.pow(cornersI[ci2][0] - orgI[0], 2) + Math.pow(cornersI[ci2][1] - orgI[1], 2)));
            RI = Math.ceil(RI * 1.25) + 10;
            var szI = 2 * RI + 4, src6 = comp.layers.addSolid([1, 1, 1], name + " piece", szI, szI, 1).source;
            comp.layer(1).remove();
            for (var ii = 0; ii < ni; ii++) {
                var L6 = piece(comp, src6, name, name + " · " + (ii + 1), ii % nc);
                L6.property("ADBE Transform Group").property("ADBE Position").setValue(orgI);
                var ki = orderK(o.order, ii, ni, seed), pre6 = prelude(name, ki, 1 - ki) + BLOB;
                var mA = L6.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
                mA.property("ADBE Mask Shape").expression = pre6 + 'blob(' + szI / 2 + ', ' + szI / 2 + ', ' + RI + ' * Math.max(c, 0), 18, ' + (ii * 7 + 3) + ', 0.16, 1.6);';
                var mH = L6.property("ADBE Mask Parade").addProperty("ADBE Mask Atom"); mH.maskMode = MaskMode.SUBTRACT;
                mH.property("ADBE Mask Shape").expression = pre6 + 'blob(' + szI / 2 + ', ' + szI / 2 + ', ' + RI + ' * Math.max(o, 0), 18, ' + (ii * 7 + 5) + ', 0.16, 1.6);';
                pieces.push(L6);
            }
        } else if (type === "behavior") {
            // a behaviour from ss_behaviors.jsx (bubbles, voronoi, blob…) drawn as the pieces, on this controller's eased progress
            pieces = SSB.transition(comp, name, prelude, orderK, o); o.noBlur = true;   // a growing path smears under motion blur
        }
        for (var p = 0; p < pieces.length; p++) { pieces[p].inPoint = t0; pieces[p].outPoint = t1; pieces[p].moveToBeginning(); if (!o.noBlur) try { pieces[p].motionBlur = true; } catch (eb) {} }   // later pieces on top
        try { comp.motionBlur = true; } catch (ec) {}
        ctrl.moveToBeginning();
        if (o.outgoing) try { comp.layer(o.outgoing).outPoint = t; } catch (e) {}
        if (o.incoming) try { var inc = comp.layer(o.incoming); if (inc.inPoint > t) inc.startTime += t - inc.inPoint; inc.inPoint = t; } catch (e) {}
        return ctrl;
    }

    // Clip-to-clip transitions (AC's footage transitions: short, blurred, overshooting). The outgoing layer accelerates
    // into the cut (Launch) and the incoming one lands after it (Nudge overshoot); token timing via SSM (ss_presets.jsx).
    // zoom: push in with blur · spin: rotate through with blur, scaled to keep the frame covered · stretch: slide with
    // squash and stretch + motion blur · slide: whip along `angle` with motion blur.
    var CLIP_TYPES = ["zoom", "spin", "stretch", "slide", "flash", "leak", "dip", "shake", "twirl", "slices", "glitch"];
    function tr(L) { return L.property("ADBE Transform Group"); }
    function gblur(L) {
        var fx = L.property("ADBE Effect Parade"), e = fx.property("SS TR Blur");
        if (!e) { e = fx.addProperty("ADBE Gaussian Blur 2"); e.name = "SS TR Blur"; e.property("ADBE Gaussian Blur 2-0003").setValue(1); }
        return e.property("ADBE Gaussian Blur 2-0001");
    }
    function rblur(L) {   // Radial Blur, zoom type, centred: its amount is what we key
        var fx = L.property("ADBE Effect Parade"), e = fx.property("SS TR Zoom Blur");
        if (!e) { e = fx.addProperty("ADBE Radial Blur"); e.name = "SS TR Zoom Blur"; e = fx.property("SS TR Zoom Blur");
                  try { e.property(4).setValue(2); e.property(5).setValue(2); } catch (x) {} }   // type Zoom, antialias high (2 = Amount, 3 = Center)
        return e.property(2);
    }
    function clip(comp, type, t, o) {
        if (typeof SSM === "undefined") throw new Error("Clip transitions need ss_presets.jsx (token timing)");
        if (!o.outgoing || !o.incoming) throw new Error(type + " is a clip-to-clip transition: give outgoing and incoming layer names");
        var A = comp.layer(o.outgoing), B = comp.layer(o.incoming);
        var durOut = o.dur || "Arrive", durIn = o.dur || "Arrive", tA = t - SSM.seconds(durOut);   // duration tokens, each side of the cut
        A.outPoint = t; if (B.inPoint > t) B.startTime += t - B.inPoint; B.inPoint = t;
        var sA = tr(A).property("ADBE Scale").valueAtTime(tA, false), sB = tr(B).property("ADBE Scale").valueAtTime(t, false);
        var pA = tr(A).property("ADBE Position").valueAtTime(tA, false), pB = tr(B).property("ADBE Position").valueAtTime(t, false);
        var k = o.intensity || 1, W = comp.width, H = comp.height;
        function sc(s, f) { return [s[0] * f, s[1] * f, s.length > 2 ? s[2] : 100]; }
        if (type === "zoom") {   // radial zoom blur (not a soft gaussian): reads as a real push through the cut
            SSM.animate(tr(A).property("ADBE Scale"), tA, sA, sc(sA, 1 + 0.8 * k), durOut, "Launch");
            SSM.animate(rblur(A), tA, 0, 70 * k, durOut, "Launch");
            SSM.animate(tr(B).property("ADBE Scale"), t, sc(sB, 1 + 0.6 * k), sB, durIn, "Land");   // no undershoot: a full-frame shot below 100 % shows its edges
            SSM.animate(rblur(B), t, 70 * k, 0, durIn, "Land");
        } else if (type === "spin") {
            // the scale follows the rotation exactly: cos + (W/H)·sin of the turn so far keeps the frame covered at every angle
            var deg = (o.angle || 90) * k;
            var rA = tr(A).property("ADBE Rotate Z").valueAtTime(tA, false), rB = tr(B).property("ADBE Rotate Z").valueAtTime(t, false);
            SSM.animate(tr(A).property("ADBE Rotate Z"), tA, rA, rA + deg, durOut, "Launch");
            SSM.animate(tr(B).property("ADBE Rotate Z"), t, rB - deg, rB, durIn, "Nudge");
            var coverX = function (r0) {
                return '// SS spin cover\nvar a = degreesToRadians(transform.rotation - (' + r0 + '));\n' +
                       'var f = Math.abs(Math.cos(a)) + (thisComp.width / thisComp.height) * Math.abs(Math.sin(a));\nvalue * Math.max(1, f * 1.02);';
            };
            tr(A).property("ADBE Scale").expression = coverX(rA);
            tr(B).property("ADBE Scale").expression = coverX(rB);
            SSM.animate(gblur(A), tA, 0, 40 * k, durOut, "Launch");
            SSM.animate(gblur(B), t, 40 * k, 0, durIn, "Land");
        } else if (type === "stretch" || type === "slide") {
            // a push: both shots move together, edge to edge, so no frame is ever empty
            var a = (o.angle || 0) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), dist = Math.abs(dx) * W + Math.abs(dy) * H;
            var t0 = tA, t1 = t + SSM.seconds(durIn);
            A.outPoint = t1; B.inPoint = t0;
            pB = tr(B).property("ADBE Position").valueAtTime(t1, false);
            try { A.motionBlur = true; B.motionBlur = true; comp.motionBlur = true; } catch (e) {}
            function off(pt, f) { var r = pt.slice(0); r[0] += f * dx * dist; r[1] += f * dy * dist; return r; }   // keep z: same length as the value
            // one move over [t0, t1]: tokens are per segment, so it is two segments meeting at the cut with matching speed
            SSM.animate(tr(A).property("ADBE Position"), t0, pA, off(pA, -0.5), durOut, "Launch");
            SSM.animate(tr(A).property("ADBE Position"), t, off(pA, -0.5), off(pA, -1), durIn, "Land");
            SSM.animate(tr(B).property("ADBE Position"), t0, off(pB, 1), off(pB, 0.5), durOut, "Launch");
            SSM.animate(tr(B).property("ADBE Position"), t, off(pB, 0.5), pB, durIn, "Land");   // overshooting past rest would open a gap at the far edge
            if (type === "stretch") {   // squash and stretch along the move, peaking at the cut
                var horiz = Math.abs(dx) >= Math.abs(dy), st = horiz ? [1.5, 1.04] : [1.04, 1.5];   // never shrink the cross axis: it would open bars at the frame edges
                var sAx = tr(A).property("ADBE Scale"), sBx = tr(B).property("ADBE Scale");
                var sBe = sBx.valueAtTime(t1, false);
                SSM.animate(sAx, t0, sA, [sA[0] * st[0], sA[1] * st[1], 100], durOut, "Launch");
                SSM.animate(sBx, t0, sBe, [sBe[0] * st[0], sBe[1] * st[1], 100], durOut, "Launch");
                SSM.animate(sBx, t, [sBe[0] * st[0], sBe[1] * st[1], 100], sBe, durIn, "Land");
            }
        } else if (type === "flash" || type === "dip" || type === "leak") {
            // a full-frame solid peaks at the cut: white/colour flash, a dip to black, or a warm light leak (screen)
            var col = o.color || (type === "dip" ? "#000000" : "#FFFFFF");
            var F = comp.layers.addSolid(rgb(type === "leak" ? (o.colors && o.colors[0]) || "#FF9A3C" : col), "TR · " + type, W, H, 1);
            F.inPoint = tA; F.outPoint = t + SSM.seconds("Sweep");
            if (type === "leak") {
                var g4 = F.property("ADBE Effect Parade").addProperty("ADBE 4ColorGradient");
                var lc = o.colors && o.colors.length ? o.colors : ["#FF9A3C", "#FF4E50", "#FFE29A", "#000000"];
                for (var q = 0; q < 4; q++) F.property("ADBE Effect Parade").property(1).property("ADBE 4ColorGradient-000" + (2 * q + 2)).setValue(rgb(lc[q % lc.length]));
                F.property("ADBE Effect Parade").property(1).property("ADBE 4ColorGradient-0001").expression = '[thisComp.width * (0.1 + (time - ' + tA + ') * 0.9), thisComp.height * 0.3];';
                F.blendingMode = BlendingMode.SCREEN;
            }
            var op = F.property("ADBE Transform Group").property("ADBE Opacity");
            SSM.animate(op, tA, 0, type === "leak" ? 85 : 100, durOut, "Launch");
            SSM.animate(op, t, type === "leak" ? 85 : 100, 0, "Sweep", "Settle");
            if (type === "dip") { SSM.animate(gblur(A), tA, 0, 30 * k, durOut, "Launch"); SSM.animate(gblur(B), t, 30 * k, 0, durIn, "Land"); }
            F.moveToBeginning();
        } else if (type === "shake") {
            // an adjustment layer shakes everything under it around the cut (decaying), scaled so no edge shows
            var S = comp.layers.addSolid([1, 1, 1], "TR · shake", W, H, 1); S.adjustmentLayer = true;
            S.inPoint = t - 0.3; S.outPoint = t + 0.5;
            var tf = S.property("ADBE Effect Parade").addProperty("ADBE Geometry2");
            tf = S.property("ADBE Effect Parade").property(1);
            tf.property("ADBE Geometry2-0002").expression = 'var a = Math.max(0, 1 - Math.abs(time - ' + t + ') / 0.4) * ' + (40 * k) + '; value + [noise([time * 18, 1]) * a, noise([time * 18, 7]) * a];';
            tf.property("ADBE Geometry2-0011").setValue(true);   // uniform scale
            tf.property("ADBE Geometry2-0003").setValue(110);    // scale height (drives both when uniform): hides the edges
            tf.property("ADBE Geometry2-0007").expression = 'var a = Math.max(0, 1 - Math.abs(time - ' + t + ') / 0.4) * ' + (3 * k) + '; noise([time * 14, 3]) * a;';
            S.moveToBeginning();
        } else if (type === "twirl") {
            function tw(L) {   // Motion Tile first (mirrored, 3x): the twirl pulls in real pixels, never transparent corners
                var mt = L.property("ADBE Effect Parade").addProperty("ADBE Tile"); mt.name = "SS TR Tile"; mt = L.property("ADBE Effect Parade").property("SS TR Tile");
                mt.property(4).setValue(300); mt.property(5).setValue(300); mt.property(6).setValue(true);
                var e = L.property("ADBE Effect Parade").addProperty("ADBE Twirl"); e.name = "SS TR Twirl"; e = L.property("ADBE Effect Parade").property("SS TR Twirl"); e.property(2).setValue(45); return e.property(1); }   // radius is a percentage
            SSM.animate(tw(A), tA, 0, -320 * k, durOut, "Launch");
            SSM.animate(tr(A).property("ADBE Scale"), tA, sA, sc(sA, 1 + 0.5 * k), durOut, "Launch");
            SSM.animate(tw(B), t, 320 * k, 0, durIn, "Land");
            SSM.animate(tr(B).property("ADBE Scale"), t, sc(sB, 1 + 0.4 * k), sB, durIn, "Land");
        } else if (type === "slices") {
            // the outgoing shot breaks into horizontal slices that slide off in alternate directions over the incoming one
            var ns = Math.max(2, Math.round(o.count || 3)), hgt = H / ns, tEnd = t + SSM.seconds(o.dur || "Arrive") + 0.2;
            B.inPoint = t;
            for (var si = 0; si < ns; si++) {
                var Dp = A.duplicate(); Dp.name = A.name + " · slice " + (si + 1); Dp.inPoint = t; Dp.outPoint = tEnd;
                var ms = Dp.property("ADBE Mask Parade").addProperty("ADBE Mask Atom");
                var y0 = si * hgt, y1 = (si + 1) * hgt;   // the band in comp space, mapped into the layer by fromComp
                ms.property("ADBE Mask Shape").expression = 'var a = fromComp([0, ' + y0 + '], ' + t + '), b = fromComp([thisComp.width, ' + (y1 + 1) + '], ' + t + ');   // fixed at the cut: the slice travels with its content\ncreatePath([[a[0] - 2000, a[1]], [b[0] + 2000, a[1]], [b[0] + 2000, b[1]], [a[0] - 2000, b[1]]], [], [], true);';
                var dirS = si % 2 ? 1 : -1, pp = tr(Dp).property("ADBE Position"), p0 = pp.valueAtTime(t, false), p1 = p0.slice(0); p1[0] += dirS * W * 1.1 * k;
                SSM.animate(pp, t + si * 0.04, p0, p1, o.dur || "Arrive", "Whip");
                Dp.moveBefore(B);
            }
        } else if (type === "glitch") {
            if (typeof SSL === "undefined") throw new Error("glitch needs ss_looks.jsx");
            SSL.glitch(comp, A.name, { t: tA + SSM.seconds(durOut) * 0.4, dur: SSM.seconds(durOut) * 0.6, amount: 30 * k });
            SSL.glitch(comp, B.name, { t: t, dur: SSM.seconds(durIn) * 0.5, amount: 30 * k });
        } else throw new Error("Unknown clip transition: " + type + " (" + CLIP_TYPES.join(", ") + ")");
        A.comment = "SS transition: " + type + " to " + B.name; B.comment = "SS transition: " + type + " from " + A.name;
        return A.name + " → " + B.name + " (" + type + ") at " + t.toFixed(2) + " s";
    }

    // named looks: library/transitions.json
    function recipes() {
        var f = File(File($.fileName).parent.parent.fsName + "/library/transitions.json");
        f.encoding = "UTF-8"; f.open("r"); var txt = f.read(); f.close();
        return eval("(" + txt + ")").transitions;
    }
    function recipe(comp, name, t, extra) {
        var list = recipes();
        for (var i = 0; i < list.length; i++) if (list[i].name.toLowerCase() === String(name).toLowerCase()) {
            var o = {}, k;
            for (k in list[i].options) o[k] = list[i].options[k];
            if (extra) for (k in extra) if (extra[k] !== undefined && extra[k] !== null) o[k] = extra[k];
            if (o.duration === undefined && o.dur === undefined && list[i].dur) o.dur = list[i].dur;
            o.name = list[i].name;
            return add(comp, list[i].type, t, o);
        }
        throw new Error("Unknown transition recipe: " + name);
    }
    return { types: TYPES, clipTypes: CLIP_TYPES, add: add, clip: clip, recipe: recipe, recipes: recipes };
})();
