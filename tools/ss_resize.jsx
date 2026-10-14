// SS Resize — duplicates a comp into social sizes (9:16, 1:1, 4:5 or any w×h) and reframes it, keeping every keyframe.
// Nothing is re-keyed: the duplicate's top-level layers are parented to two rig nulls whose transform does the reframing.
//   · background layers (full-frame plates, solids, footage, adjustment layers) go on "SS resize · bg": cover-fit, centred
//   · everything else goes on "SS resize · content" and is fitted into the new comp's title-safe area (where it sits is
//     sampled over the whole comp at rest, so entrances from off-screen do not count; see Modes)
// Move or scale the rig nulls afterwards to adjust the framing by hand. Cameras and lights are left alone; layers inside
// precomps are not touched (a full-frame precomp is a background: it is cover-fitted as a whole).
//
// Modes: reflow (default) — layers that rest on or next to each other form a group; each group keeps its own size where
//        it fits (never above the source size) and gets its own "SS fit · <layer>" null that places it in the title-safe area
//        (a 16:9 title stays legible in 9:16); fit — the whole layout is scaled as one block into the title-safe area, and a
//        text that would still rest outside it gets its own fit null.
// Usage: #include "ss_presets.jsx" then #include "ss_resize.jsx"
//        SSRZ.resize(comp, ["9:16", "1:1", "4:5", "1200x628"], {})  ->  [{comp, name, w, h, scale, bg, content, texts, fixed}]
// Options: mode (reflow | fit), safe (title-safe insets as fractions [top, right, bottom, left]; default per size, see SAFE),
//          suffix (name part after the size)
var SSRZ = (function () {
    var PRESETS = { "9:16": [1080, 1920], "1:1": [1080, 1080], "4:5": [1080, 1350], "16:9": [1920, 1080], "4:3": [1440, 1080], "2:3": [1080, 1620] };
    // title-safe insets [top, right, bottom, left] as fractions of the frame. 9:16 keeps clear of the Reels / TikTok /
    // Shorts interface (caption and buttons at the bottom, account bar on top); the rest use the classic 10 % title safe.
    var SAFE = { "9:16": [0.12, 0.08, 0.20, 0.08], "4:5": [0.08, 0.08, 0.10, 0.08], "default": [0.10, 0.10, 0.10, 0.10] };
    var STEP = 0.25, BG_COVER = 0.85;

    function T(L) { return L.property("ADBE Transform Group"); }
    function v(L, p, t) { var q = T(L).property(p); return q ? q.valueAtTime(t, false) : null; }
    function parse(s) {
        s = String(s).replace(/\s/g, "").toLowerCase();
        if (PRESETS[s]) return { key: s, w: PRESETS[s][0], h: PRESETS[s][1] };
        var m = /^(\d+)[x×*](\d+)$/.exec(s);
        if (m) return { key: m[1] + "x" + m[2], w: parseInt(m[1], 10), h: parseInt(m[2], 10) };
        throw new Error("Unknown size " + s + ": use 9:16, 1:1, 4:5, 16:9, 4:3, 2:3 or WxH (e.g. 1200x628)");
    }
    // 2D affine of a layer at t (anchor, scale, Z rotation, position; parents included): [a, b, c, d, e, f]
    function mat(L, t) {
        var a = v(L, "ADBE Anchor Point", t), s = v(L, "ADBE Scale", t), p = v(L, "ADBE Position", t), r = (v(L, "ADBE Rotate Z", t) || 0) * Math.PI / 180;
        var sx = s[0] / 100, sy = s[1] / 100, cs = Math.cos(r), sn = Math.sin(r);
        var m = [cs * sx, sn * sx, -sn * sy, cs * sy, 0, 0];
        m[4] = p[0] - (m[0] * a[0] + m[2] * a[1]); m[5] = p[1] - (m[1] * a[0] + m[3] * a[1]);
        if (L.parent) { var P = mat(L.parent, t); m = [P[0] * m[0] + P[2] * m[1], P[1] * m[0] + P[3] * m[1], P[0] * m[2] + P[2] * m[3], P[1] * m[2] + P[3] * m[3],
                                                        P[0] * m[4] + P[2] * m[5] + P[4], P[1] * m[4] + P[3] * m[5] + P[5]]; }
        return m;
    }
    function box(L, t) {   // comp-space bounding box of the layer's content at t, or null
        var r;
        try { r = L.sourceRectAtTime(t, false); } catch (e) { return null; }
        if (!r || r.width < 1 || r.height < 1) return null;
        var m = mat(L, t), xs = [], ys = [], cs = [[r.left, r.top], [r.left + r.width, r.top], [r.left, r.top + r.height], [r.left + r.width, r.top + r.height]];
        for (var i = 0; i < 4; i++) { xs.push(m[0] * cs[i][0] + m[2] * cs[i][1] + m[4]); ys.push(m[1] * cs[i][0] + m[3] * cs[i][1] + m[5]); }
        return [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)];
    }
    function clip(b, W, H) { var c = [Math.max(0, b[0]), Math.max(0, b[1]), Math.min(W, b[2]), Math.min(H, b[3])]; return c[2] > c[0] && c[3] > c[1] ? c : null; }
    function union(a, b) { return a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b.slice(); }
    function visible(L, t) {
        if (t < L.inPoint || t >= L.outPoint) return false;
        var op = v(L, "ADBE Opacity", t); return op === null || op >= 20;
    }
    function settle(L) {   // the text has come in: its last key before the exit (as check_layout judges it)
        var ks = SSP.animatedProps(L), s = L.inPoint;
        for (var q = 0; q < ks.length; q++) for (var k = 1; k <= ks[q].numKeys; k++) { var kt = ks[q].keyTime(k); if (kt < L.outPoint - 1) s = Math.max(s, kt); }
        return s;
    }
    function family(comp, L) {   // the layer and every layer parented under it
        var out = [L];
        for (var k = 1; k <= comp.numLayers; k++) if (comp.layer(k).parent && comp.layer(k).parent.index === L.index) out = out.concat(family(comp, comp.layer(k)));
        return out;
    }
    function restBox(comp, L) {   // where the layer and its children rest once they have come in (null if they never show)
        var fam = family(comp, L), t0 = 0, b = null, any = null, f, t, x;
        for (f = 0; f < fam.length; f++) t0 = Math.max(t0, settle(fam[f]));
        for (f = 0; f < fam.length; f++) for (t = Math.max(0, fam[f].inPoint); t < Math.min(comp.duration, fam[f].outPoint); t += STEP) {
            if (!visible(fam[f], t)) continue;
            x = box(fam[f], t); if (!x) continue;
            any = union(any, x); if (t >= t0) b = union(b, x);
        }
        return b || any;
    }
    function skip(L) { return L instanceof CameraLayer || L instanceof LightLayer || (!L.hasVideo && L.hasAudio); }
    function isBackground(L, W, H) {
        if (L.adjustmentLayer) return true;
        if (L instanceof TextLayer || L.nullLayer) return false;
        for (var t = L.inPoint; t < L.outPoint; t += Math.max(STEP, (L.outPoint - L.inPoint) / 8)) {
            var b = box(L, t), c = b && clip(b, W, H);
            if (c && (c[2] - c[0]) * (c[3] - c[1]) >= BG_COVER * W * H) return true;
        }
        return false;
    }
    function rig(c, name) {   // an identity parent first (no keyframe compensation), the reframing comes after
        var N = c.layers.addNull(); N.name = name; N.guideLayer = true; N.shy = true;
        T(N).property("ADBE Anchor Point").setValue([0, 0]); T(N).property("ADBE Position").setValue([0, 0]);
        return N;
    }
    function parentTo(L, N) { var lk = L.locked; L.locked = false; L.parent = N; L.locked = lk; }
    function uniqueName(base) {
        var n = base, k = 2, taken = {};
        for (var i = 1; i <= app.project.numItems; i++) taken[app.project.item(i).name] = 1;
        while (taken[n]) n = base + " " + (k++);
        return n;
    }

    function one(src, size, o) {
        var W = src.width, H = src.height, nw = size.w, nh = size.h;
        var ins = o.safe || SAFE[size.key] || SAFE["default"];
        var safe = [ins[3] * nw, ins[0] * nh, nw - ins[1] * nw, nh - ins[2] * nh];   // x0, y0, x1, y1
        var c = src.duplicate(); c.name = uniqueName(src.name + " · " + size.key.replace(":", "x") + (o.suffix ? " " + o.suffix : ""));
        // measure on the duplicate before anything moves: background or content, and where the content sits
        var tops = [], bgs = [], content = null;
        for (var i = 1; i <= c.numLayers; i++) {
            var L = c.layer(i);
            if (L.parent || skip(L)) continue;
            if (isBackground(L, W, H)) { bgs.push(L); continue; }
            tops.push(L);
        }
        for (var j = 0; j < tops.length; j++) collectBoxes(c, tops[j]);
        function collectBoxes(comp, L) {   // the layer and its children (parented layers move with it)
            for (var t = Math.max(0, L.inPoint); t < Math.min(comp.duration, L.outPoint); t += STEP) {
                if (!visible(L, t)) continue;
                var b = box(L, t), cb = b && clip(b, W, H); if (cb) content = union(content, cb);
            }
            for (var k = 1; k <= comp.numLayers; k++) if (comp.layer(k).parent && comp.layer(k).parent.index === L.index) collectBoxes(comp, comp.layer(k));
        }
        if (!content) content = [0, 0, W, H];
        var bw = content[2] - content[0], bh = content[3] - content[1], sw = safe[2] - safe[0], sh = safe[3] - safe[1];
        var s = Math.min(sw / bw, sh / bh, Math.max(nw / W, nh / H)), cover = Math.max(nw / W, nh / H);
        var cx = (content[0] + content[2]) / 2, cy = (content[1] + content[3]) / 2, tx = (safe[0] + safe[2]) / 2, ty = (safe[1] + safe[3]) / 2;
        var R = rig(c, "SS resize · content"), B = bgs.length ? rig(c, "SS resize · bg") : null;
        for (var g = 0; g < bgs.length; g++) parentTo(bgs[g], B);
        var mode = o.mode === "fit" ? "fit" : "reflow", fixed = [], fits = [], groups = [];
        if (mode === "reflow") {
            // every top-level layer (with its children) rests somewhere; layers that rest on or next to each other move as one group
            var items = [], loose = [], pad = 0.015 * Math.max(W, H);
            for (var q = 0; q < tops.length; q++) { var rb = restBox(c, tops[q]); if (rb) items.push({ Ls: [tops[q]], b: rb }); else loose.push(tops[q]); }
            for (var merged = true; merged;) {
                merged = false;
                for (var i1 = 0; i1 < items.length && !merged; i1++) for (var i2 = i1 + 1; i2 < items.length && !merged; i2++) {
                    var A = items[i1].b, Bb = items[i2].b;
                    if (A[0] - pad < Bb[2] && Bb[0] - pad < A[2] && A[1] - pad < Bb[3] && Bb[1] - pad < A[3]) {
                        items[i1] = { Ls: items[i1].Ls.concat(items[i2].Ls), b: union(A, Bb) }; items.splice(i2, 1); merged = true;
                    }
                }
            }
            // each group keeps its own size where it fits (never above the source size); its place is mapped, then clamped into the safe area
            // places are mapped round the frame centre (a centred title stays centred), spread to fill the safe area
            var ex = 2 * Math.max(W / 2 - content[0], content[2] - W / 2), ey = 2 * Math.max(H / 2 - content[1], content[3] - H / 2);
            var kmax = Math.max(s, Math.min(1, Math.max(nw / W, nh / H))), ax = Math.min(1, sw / ex), ay = Math.min(sh / ey, Math.max(nw / W, nh / H, 1));
            var place = function (it) {
                var w = (it.b[2] - it.b[0]) * it.k, h = (it.b[3] - it.b[1]) * it.k;
                var x = tx + ((it.b[0] + it.b[2]) / 2 - W / 2) * ax, y = ty + ((it.b[1] + it.b[3]) / 2 - H / 2) * ay;
                x = Math.max(safe[0] + w / 2, Math.min(safe[2] - w / 2, x)); y = Math.max(safe[1] + h / 2, Math.min(safe[3] - h / 2, y));
                it.p = [x, y]; it.nb = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
            };
            for (var m1 = 0; m1 < items.length; m1++) { var ib = items[m1].b; items[m1].k = Math.min(kmax, sw / (ib[2] - ib[0]), sh / (ib[3] - ib[1])); place(items[m1]); }
            for (var pass = 0; pass < 16; pass++) {   // groups that now overlap shrink a little at a time, down to the uniform fit
                var hit = false;
                for (var u = 0; u < items.length; u++) for (var w2 = u + 1; w2 < items.length; w2++) {
                    var P1 = items[u].nb, P2 = items[w2].nb;
                    if (P1[0] < P2[2] && P2[0] < P1[2] && P1[1] < P2[3] && P2[1] < P1[3]) {
                        hit = true;
                        items[u].k = Math.max(s, items[u].k * 0.92); items[w2].k = Math.max(s, items[w2].k * 0.92); place(items[u]); place(items[w2]);
                    }
                }
                if (!hit) break;
            }
            for (var n1 = 0; n1 < items.length; n1++) {
                var label = items[n1].Ls[0].name + (items[n1].Ls.length > 1 ? " +" + (items[n1].Ls.length - 1) : "");
                var G = rig(c, "SS fit · " + label);
                parentTo(G, R); for (var n2 = 0; n2 < items[n1].Ls.length; n2++) parentTo(items[n1].Ls[n2], G);
                fits.push([G, [(items[n1].b[0] + items[n1].b[2]) / 2, (items[n1].b[1] + items[n1].b[3]) / 2], items[n1].p, items[n1].k]);
                groups.push(label + " x" + items[n1].k.toFixed(2));
            }
            if (loose.length) {   // layers that never show (nulls, controllers) follow the uniform fit
                var Pz = rig(c, "SS fit · other"); parentTo(Pz, R); for (var n3 = 0; n3 < loose.length; n3++) parentTo(loose[n3], Pz);
                fits.push([Pz, [cx, cy], [tx, ty], s]);
            }
        } else {
            for (var a = 0; a < tops.length; a++) parentTo(tops[a], R);
            // a text that would rest outside the title-safe area gets its own fit null between it and the content rig
            for (var x = 0; x < tops.length; x++) {
                if (!(tops[x] instanceof TextLayer)) continue;
                var tb = restBox(c, tops[x]); if (!tb) continue;
                var nb = [(tb[0] - cx) * s + tx, (tb[1] - cy) * s + ty, (tb[2] - cx) * s + tx, (tb[3] - cy) * s + ty];
                if (nb[0] >= safe[0] - 0.5 && nb[1] >= safe[1] - 0.5 && nb[2] <= safe[2] + 0.5 && nb[3] <= safe[3] + 0.5) continue;
                var f = Math.min(1, sw / (nb[2] - nb[0]), sh / (nb[3] - nb[1])), hw = (nb[2] - nb[0]) * f / 2, hh = (nb[3] - nb[1]) * f / 2;
                var gx = Math.max(safe[0] + hw, Math.min(safe[2] - hw, (nb[0] + nb[2]) / 2)), gy = Math.max(safe[1] + hh, Math.min(safe[3] - hh, (nb[1] + nb[3]) / 2));
                var F = rig(c, "SS fit · " + tops[x].name);
                parentTo(F, R); parentTo(tops[x], F);
                // in the rig's (source) space: scale f round the text's centre, landing where the clamp put it
                fits.push([F, [(tb[0] + tb[2]) / 2, (tb[1] + tb[3]) / 2], [(gx - tx) / s + cx, (gy - ty) / s + cy], f]);
                fixed.push(tops[x].name);
            }
        }
        c.width = nw; c.height = nh;
        if (mode === "fit") { T(R).property("ADBE Anchor Point").setValue([cx, cy]); T(R).property("ADBE Position").setValue([tx, ty]); T(R).property("ADBE Scale").setValue([s * 100, s * 100]); }
        else { T(R).property("ADBE Anchor Point").setValue([nw / 2, nh / 2]); T(R).property("ADBE Position").setValue([nw / 2, nh / 2]); }   // identity: scale it to adjust everything
        if (B) { T(B).property("ADBE Anchor Point").setValue([W / 2, H / 2]); T(B).property("ADBE Position").setValue([nw / 2, nh / 2]); T(B).property("ADBE Scale").setValue([cover * 100, cover * 100]); }
        for (var y = 0; y < fits.length; y++) { var tf = T(fits[y][0]); tf.property("ADBE Anchor Point").setValue(fits[y][1]); tf.property("ADBE Position").setValue(fits[y][2]); tf.property("ADBE Scale").setValue([fits[y][3] * 100, fits[y][3] * 100]); }
        for (var z = 0; z < fits.length; z++) fits[z][0].moveToBeginning();
        R.moveToBeginning(); if (B) B.moveToBeginning();
        c.comment = (c.comment ? c.comment + "\n" : "") + "SS resize: " + src.name + " " + W + "x" + H + " -> " + nw + "x" + nh + ", " + mode + ", content x" + s.toFixed(3) + ", bg cover x" + cover.toFixed(3);
        return { comp: c, name: c.name, w: nw, h: nh, mode: mode, scale: s, cover: cover, bg: bgs.length, content: tops.length, groups: groups, fixed: fixed, safe: safe };
    }

    return {
        PRESETS: PRESETS, SAFE: SAFE,
        resize: function (src, sizes, o) {
            o = o || {};
            if (!(src instanceof CompItem)) throw new Error("Not a comp");
            var list = sizes && sizes.length ? sizes : ["9:16", "1:1", "4:5"], out = [];
            for (var i = 0; i < list.length; i++) out.push(one(src, parse(list[i]), o));
            return out;
        },
        describe: function (r) {
            return r.name + " (" + r.w + "x" + r.h + ", " + r.mode + "): title safe [" + Math.round(r.safe[0]) + "," + Math.round(r.safe[1]) + " - " +
                Math.round(r.safe[2]) + "," + Math.round(r.safe[3]) + "], " + r.content + " layer(s) " +
                (r.mode === "reflow" ? "in " + r.groups.length + " group(s): " + r.groups.join(", ") : "scaled x" + r.scale.toFixed(2) + (r.fixed.length ? ", fitted text: " + r.fixed.join(", ") : "")) +
                "; " + r.bg + " background(s) cover-fitted x" + r.cover.toFixed(2);
        }
    };
})();
