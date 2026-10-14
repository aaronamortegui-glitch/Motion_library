// Motion DNA keyframe toolkit (SSK): the utilities an animator reaches for between presets, as plain ExtendScript, so
// Claude can call them in the background (MCP `keyframes`, `anchor_point`). Behavioural equivalents of the helper
// panels that ship with commercial packs (anchor mover, keyframe actions, transition shifter): written from scratch,
// nothing copied. Every function works on layers (all their animated properties) and returns a short report.
//   #include "ss_keyframes.jsx"   then   SSK.reverse(layers) · SSK.stagger(layers, 3) · SSK.anchor(L, "bottom-left") …
(function () {
    function tr(L, m) { return L.property("ADBE Transform Group").property(m); }
    // every keyframed property of a layer (markers and time remap left out), with its key data
    function animated(L) {
        var out = [];
        (function walk(g) {
            for (var j = 1; j <= g.numProperties; j++) {
                var p = g.property(j);
                if (!p) continue;
                if (p.propertyType === PropertyType.PROPERTY) {
                    if (p.numKeys > 0 && p.matchName !== "ADBE Marker" && p.matchName !== "ADBE Time Remapping") out.push(p);
                } else if (p.numProperties) walk(p);
            }
        })(L);
        return out;
    }
    function read(p) {   // a property's keys, enough to rebuild them anywhere
        var ks = [];
        for (var k = 1; k <= p.numKeys; k++) ks.push({ t: p.keyTime(k), v: p.keyValue(k), ii: p.keyInInterpolationType(k), oi: p.keyOutInterpolationType(k),
            ie: p.keyInTemporalEase(k), oe: p.keyOutTemporalEase(k), it: p.isSpatial ? p.keyInSpatialTangent(k) : null, ot: p.isSpatial ? p.keyOutSpatialTangent(k) : null });
        return ks;
    }
    function write(p, ks) {   // replace a property's keys; eases and tangents are put back after every key exists
        while (p.numKeys) p.removeKey(1);
        var idx = [];
        for (var k = 0; k < ks.length; k++) { var x = p.addKey(ks[k].t); p.setValueAtKey(x, ks[k].v); idx.push(ks[k].t); }
        for (k = 0; k < ks.length; k++) {
            var n = p.nearestKeyIndex(ks[k].t);
            try { p.setInterpolationTypeAtKey(n, ks[k].ii, ks[k].oi); } catch (e1) {}
            try { p.setTemporalEaseAtKey(n, ks[k].ie, ks[k].oe); } catch (e2) {}
            if (ks[k].it) { try { p.setSpatialTangentsAtKey(n, ks[k].it, ks[k].ot); } catch (e3) {} }
        }
    }
    function span(L) {   // first and last key time over all animated properties
        var a = 1e9, b = -1e9, ps = animated(L);
        for (var i = 0; i < ps.length; i++) { a = Math.min(a, ps[i].keyTime(1)); b = Math.max(b, ps[i].keyTime(ps[i].numKeys)); }
        return ps.length ? [a, b] : null;
    }
    function selKeys(p) { var s = p.selectedKeys, out = []; for (var i = 0; i < s.length; i++) out.push(s[i]); return out; }
    function frame(L) { return L.containingComp.frameDuration; }

    $.global.SSK = {
        animated: animated,
        span: span,

        // Anchor point to one of nine spots of the layer's own box (or "center"), the layer stays where it is on screen.
        anchor: function (L, where, t) {
            t = t === undefined ? L.containingComp.time : t;
            var r = L.sourceRectAtTime(t, false), w = (where || "center").toLowerCase();
            var fx = /left/.test(w) ? 0 : /right/.test(w) ? 1 : 0.5, fy = /top/.test(w) ? 0 : /bottom/.test(w) ? 1 : 0.5;
            var A = tr(L, "ADBE Anchor Point"), P = tr(L, "ADBE Position"), S = tr(L, "ADBE Scale"), R = tr(L, "ADBE Rotate Z");
            if (A.numKeys || A.expression) return L.name + ": anchor is animated or has an expression, left as it is";
            var a0 = A.value, a1 = [r.left + r.width * fx, r.top + r.height * fy];
            if (a0.length > 2) a1.push(a0[2]);
            var d = [a1[0] - a0[0], a1[1] - a0[1]], s = S.valueAtTime(t, false), rad = R.valueAtTime(t, false) * Math.PI / 180;
            var dx = d[0] * s[0] / 100, dy = d[1] * s[1] / 100;
            var off = [dx * Math.cos(rad) - dy * Math.sin(rad), dx * Math.sin(rad) + dy * Math.cos(rad)];
            A.setValue(a1);
            if (P.dimensionsSeparated) {
                var X = L.property("ADBE Transform Group").property("ADBE Position_0"), Y = L.property("ADBE Transform Group").property("ADBE Position_1");
                if (X.numKeys) for (var i = 1; i <= X.numKeys; i++) X.setValueAtKey(i, X.keyValue(i) + off[0]); else X.setValue(X.value + off[0]);
                if (Y.numKeys) for (var j = 1; j <= Y.numKeys; j++) Y.setValueAtKey(j, Y.keyValue(j) + off[1]); else Y.setValue(Y.value + off[1]);
            } else if (P.numKeys) {
                for (var k = 1; k <= P.numKeys; k++) { var v = P.keyValue(k); v[0] += off[0]; v[1] += off[1]; P.setValueAtKey(k, v); }
            } else { var v0 = P.value; v0[0] += off[0]; v0[1] += off[1]; P.setValue(v0); }
            return L.name + ": anchor → " + w;
        },

        // Play the animation backwards: every key keeps its value and moves to (first + last − time); eases swap sides.
        reverse: function (layers) {
            var n = 0;
            for (var i = 0; i < layers.length; i++) {
                var sp = span(layers[i]); if (!sp) continue;
                var ps = animated(layers[i]);
                for (var j = 0; j < ps.length; j++) {
                    var ks = read(ps[j]), out = [];
                    for (var k = ks.length - 1; k >= 0; k--) out.push({ t: sp[0] + sp[1] - ks[k].t, v: ks[k].v, ii: ks[k].oi, oi: ks[k].ii, ie: ks[k].oe, oe: ks[k].ie, it: ks[k].ot, ot: ks[k].it });
                    write(ps[j], out); n++;
                }
            }
            return "reversed " + n + " properties on " + layers.length + " layers";
        },

        // Build the exit from the entrance: the first move, played backwards, ending at the layer's out point.
        mirrorOut: function (layers, gapFrames) {
            var n = 0;
            for (var i = 0; i < layers.length; i++) {
                var L = layers[i], sp = span(L); if (!sp) continue;
                var end = L.outPoint - (gapFrames || 0) * frame(L), ps = animated(L);
                if (end - (sp[1] - sp[0]) <= sp[1]) continue;   // no room for an exit after the entrance
                for (var j = 0; j < ps.length; j++) {
                    var ks = read(ps[j]), add = [];
                    for (var k = ks.length - 1; k >= 0; k--) add.push({ t: end - (ks[k].t - sp[0]), v: ks[k].v, ii: ks[k].oi, oi: ks[k].ii, ie: ks[k].oe, oe: ks[k].ie, it: ks[k].ot, ot: ks[k].it });
                    write(ps[j], ks.concat(add)); n++;
                }
            }
            return "mirrored the entrance into an exit on " + n + " properties";
        },

        // Offset each layer's animation (keys, markers and in point move together) by `frames` more than the previous
        // one. order: "selection" (as given) | "top" | "bottom" | "random" | "center" (from the middle out).
        stagger: function (layers, frames, order) {
            var ls = layers.slice(0), f = frames === undefined ? 3 : frames;
            if (order === "top") ls.sort(function (a, b) { return a.index - b.index; });
            if (order === "bottom") ls.sort(function (a, b) { return b.index - a.index; });
            if (order === "random") ls.sort(function () { return Math.random() - 0.5; });
            var steps = [];
            for (var i = 0; i < ls.length; i++) steps.push(order === "center" ? Math.abs(i - (ls.length - 1) / 2) : i);
            var base = null;
            for (i = 0; i < ls.length; i++) { var sp = span(ls[i]); if (sp && (base === null || sp[0] < base)) base = sp[0]; }
            if (base === null) return "no animated layers";
            for (i = 0; i < ls.length; i++) {
                var L = ls[i], s0 = span(L); if (!s0) continue;
                SSK.shift([L], base + steps[i] * f * frame(L) - s0[0]);
            }
            return "staggered " + ls.length + " layers by " + f + " f" + (order ? " (" + order + ")" : "");
        },

        // Move every key (and our SS in / SS out markers) of the layers by dt seconds.
        shift: function (layers, dt) {
            for (var i = 0; i < layers.length; i++) {
                var ps = animated(layers[i]);
                for (var j = 0; j < ps.length; j++) { var ks = read(ps[j]); for (var k = 0; k < ks.length; k++) ks[k].t += dt; write(ps[j], ks); }
                var M = layers[i].property("ADBE Marker"), mk = [];
                for (var m = M.numKeys; m >= 1; m--) { var c = M.keyValue(m).comment; if (c === "SS in" || c === "SS out") { mk.push({ t: M.keyTime(m) + dt, v: M.keyValue(m) }); M.removeKey(m); } }
                for (m = 0; m < mk.length; m++) M.setValueAtTime(mk[m].t, mk[m].v);
            }
            return "shifted " + layers.length + " layers by " + Math.round(dt * 1000) + " ms";
        },

        // Transition shifter: start the entrance at the playhead (or `at`), or end the exit there.
        toPlayhead: function (layers, which, at) {
            var out = [];
            for (var i = 0; i < layers.length; i++) {
                var L = layers[i], sp = span(L); if (!sp) continue;
                var t = at === undefined ? L.containingComp.time : at;
                SSK.shift([L], which === "end" ? t - sp[1] : t - sp[0]);
                out.push(L.name);
            }
            return (which === "end" ? "ends at " : "starts at ") + "the playhead: " + out.join(", ");
        },

        // Lay the layers end to end (in point after the previous out point), with an overlap in frames; keys follow.
        sequence: function (layers, overlapFrames) {
            var t = layers.length ? layers[0].inPoint : 0;
            for (var i = 0; i < layers.length; i++) {
                var L = layers[i], d = L.outPoint - L.inPoint, dt = t - L.inPoint;
                L.startTime += dt;   // moves in/out points, keys and markers together
                t = L.outPoint - (overlapFrames || 0) * frame(L);
            }
            return "sequenced " + layers.length + " layers";
        },

        // Spread the selected keys of each property evenly between their first and last key (or every key if none).
        distribute: function (layers) {
            var n = 0;
            for (var i = 0; i < layers.length; i++) {
                var ps = animated(layers[i]);
                for (var j = 0; j < ps.length; j++) {
                    var p = ps[j], sel = selKeys(p); if (!sel.length) { sel = []; for (var a = 1; a <= p.numKeys; a++) sel.push(a); }
                    if (sel.length < 3) continue;
                    var ks = read(p), t0 = ks[sel[0] - 1].t, t1 = ks[sel[sel.length - 1] - 1].t;
                    for (var k = 0; k < sel.length; k++) ks[sel[k] - 1].t = t0 + (t1 - t0) * k / (sel.length - 1);
                    write(p, ks); n++;
                }
            }
            return "distributed keys on " + n + " properties";
        },

        // Loop the animation with an expression: "cycle" | "pingpong" | "offset" | "continue".
        loop: function (layers, type) {
            var ty = type || "cycle", n = 0, ex = ty === "continue" ? "loopOut(\"continue\")" : "loopOut(\"" + ty + "\")";
            for (var i = 0; i < layers.length; i++) {
                var ps = animated(layers[i]);
                for (var j = 0; j < ps.length; j++) if (ps[j].numKeys > 1 && ps[j].canSetExpression && !ps[j].expression) { ps[j].expression = ex + ";   // SS loop"; n++; }
            }
            return "loop (" + ty + ") on " + n + " properties";
        },

        // Copy the whole animation of one layer to others, matched by property, starting at each target's in point.
        copyTo: function (src, targets, keepTiming) {
            var ps = animated(src), sp = span(src), n = 0;
            if (!ps.length) return src.name + " has no animation";
            function path(p) { var a = []; var q = p; while (q && q.parentProperty) { a.unshift(q.matchName); q = q.parentProperty; } return a; }
            for (var i = 0; i < targets.length; i++) {
                var T = targets[i], dt = keepTiming ? 0 : T.inPoint - sp[0];
                for (var j = 0; j < ps.length; j++) {
                    var mp = path(ps[j]), q = T;
                    for (var k = 0; k < mp.length && q; k++) q = q.property(mp[k]);
                    if (!q || q.propertyType !== PropertyType.PROPERTY) continue;
                    var ks = read(ps[j]); for (var m = 0; m < ks.length; m++) ks[m].t += dt;
                    try { write(q, ks); n++; } catch (e) {}
                }
            }
            return "copied " + ps.length + " animated properties to " + targets.length + " layers (" + n + " written)";
        },

        // Turn expressions into keyframes, one per frame (for hand-off, Lottie export or editing by hand).
        bake: function (layers) {
            var n = 0;
            for (var i = 0; i < layers.length; i++) {
                (function walk(g) {
                    for (var j = 1; j <= g.numProperties; j++) {
                        var p = g.property(j); if (!p) continue;
                        if (p.propertyType === PropertyType.PROPERTY) {
                            if (p.canSetExpression && p.expression && p.expressionEnabled) {
                                var L = layers[i], fd = L.containingComp.frameDuration, ts = [], vs = [];
                                for (var t = L.inPoint; t < L.outPoint; t += fd) { ts.push(t); vs.push(p.valueAtTime(t, false)); }
                                p.expression = ""; while (p.numKeys) p.removeKey(1);
                                p.setValuesAtTimes(ts, vs); n++;
                            }
                        } else if (p.numProperties) walk(p);
                    }
                })(layers[i]);
            }
            return "baked " + n + " expressions into keyframes";
        },

        // Scale the timing of the whole animation around its first key (factor > 1 slower).
        stretch: function (layers, factor) {
            for (var i = 0; i < layers.length; i++) {
                var sp = span(layers[i]); if (!sp) continue;
                var ps = animated(layers[i]);
                for (var j = 0; j < ps.length; j++) { var ks = read(ps[j]); for (var k = 0; k < ks.length; k++) ks[k].t = sp[0] + (ks[k].t - sp[0]) * factor; write(ps[j], ks); }
            }
            return "stretched " + layers.length + " layers ×" + factor;
        },

        // Keyframe Wingman: re-ease every segment of every animated property with a Motion DNA curve token.
        ease: function (layers, token) {
            if (typeof SSM === "undefined") throw new Error("ease needs ss_presets.jsx (token curves)");
            var n = 0;
            for (var i = 0; i < layers.length; i++) {
                var ps = animated(layers[i]);
                for (var j = 0; j < ps.length; j++) for (var k = 1; k < ps[j].numKeys; k++) { try { SSM.easeSegment(ps[j], k, token); n++; } catch (e) {} }
            }
            return "eased " + n + " segments with " + token;
        },

        // Copy only the easing (influence/speed, interpolation) of the source's keys onto the targets' keys, values kept.
        copyEase: function (src, targets) {
            var sp = animated(src); if (!sp.length) return src.name + " has no keys";
            var ref = read(sp[0]), n = 0;
            for (var i = 0; i < targets.length; i++) {
                var ps = animated(targets[i]);
                for (var j = 0; j < ps.length; j++) for (var k = 1; k <= ps[j].numKeys; k++) {
                    var r = ref[Math.min(k - 1, ref.length - 1)], dims = ps[j].keyInTemporalEase(k).length;
                    function fit(e) { var o = []; for (var d = 0; d < dims; d++) o.push(new KeyframeEase(0, e[Math.min(d, e.length - 1)].influence)); return o; }
                    try { ps[j].setInterpolationTypeAtKey(k, r.ii, r.oi); ps[j].setTemporalEaseAtKey(k, fit(r.ie), fit(r.oe)); n++; } catch (e) {}
                }
            }
            return "copied the easing of " + src.name + " onto " + n + " keys";
        },

        // Shift each layer's animation by a random number of frames in [-frames, frames] (seeded: same result every run).
        randomize: function (layers, frames, seed) {
            var s = seed || 1, out = [];
            for (var i = 0; i < layers.length; i++) {
                var x = Math.sin((i + 1) * 12.9898 + s * 78.233) * 43758.5453, r = (x - Math.floor(x)) * 2 - 1;
                var f = Math.round(r * (frames || 4));
                SSK.shift([layers[i]], f * frame(layers[i])); out.push(layers[i].name + " " + (f > 0 ? "+" : "") + f + " f");
            }
            return "randomized: " + out.join(", ");
        }
    };
})();
