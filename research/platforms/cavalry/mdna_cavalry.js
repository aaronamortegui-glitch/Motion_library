// Motion DNA for Cavalry (beta): applies the portable presets (research/platforms/portable_presets.json) to layers,
// with the token curves as exact bezier handles (api.modifyKeyframeTangent takes absolute handle tips, the same cubic
// bezier as the tokens). Runs in Cavalry's JavaScript Editor or through Cavalry's MCP server (execute_script):
//   api.load("<repo>/research/platforms/cavalry/mdna_cavalry.js");
//   MDNA.init("<repo>");                                   // reads the tokens and the recipes
//   MDNA.apply(layerId, "Fade Up", "in", 0);               // returns the end frame
//   MDNA.applyMany(["rectangle#1", "textShape#1"], "Scale Pop", "in", 0, 4);   // a stagger of 4 frames
//   MDNA.kitList("Effects");                                // kit pieces (research/platforms/kit_portable.json)
//   MDNA.kit("blur_in", ["basicShape#3"], "both", 0, {duration: 1.2, intensity: 0.8, stagger: 3, ease: "Land"});
//   MDNA.kit("bars_transition", [], "transition", 70);     // Elements create their layers; returns {end, layers, helpers, cut}
//   MDNA.kitRemove(["basicShape#3"]);                       // takes kit pieces off (helpers, keys, loop connections)
// Screen conventions: Cavalry's y is up (After Effects' is down), rotation is counter-clockwise, opacity is 0-100.
var MDNA = (function () {
    var EASE = {}, RECIPES = null, FPS_SRC = 30;

    function init(root) {
        try { initKit(root); } catch (e) { KIT = null; }
        var t = JSON.parse(api.readFromFile(root + "/tokens/superside_motion_tokens.json"));
        for (var i = 0; i < t.easings.length; i++) EASE[t.easings[i].name] = t.easings[i].bezier;
        RECIPES = JSON.parse(api.readFromFile(root + "/research/platforms/portable_presets.json"));
        FPS_SRC = RECIPES.fps || 30;
        return RECIPES.portable.length + " portable presets" + (KIT ? ", " + KIT.items.length + " kit pieces" : "");
    }

    function bezierOf(seg) {
        if (seg.ease) return EASE[seg.ease] || [0, 0, 1, 1];
        if (seg.bezier) return seg.bezier;
        var ae = seg.ae;
        if (!ae || ae.out === "linear") return [0, 0, 1, 1];
        var x1 = ae.out.influence / 100, x2 = 1 - ae["in"].influence / 100;
        return [x1, x1 * (ae.out.speed_x_avg || 0), x2, 1 - (1 - x2) * (ae["in"].speed_x_avg || 0)];
    }

    function key(id, attr, f0, v0, f1, v1, bz) {   // two keys + free handles at the token's cubic-bezier
        f0 = Math.round(f0); f1 = Math.max(f0 + 1, Math.round(f1));
        var a = {}; a[attr] = v0; api.keyframe(id, f0, a);
        var b = {}; b[attr] = v1; api.keyframe(id, f1, b);
        var dt = f1 - f0, dv = v1 - v0, o = {}, i = {};
        o[attr] = { frame: f0, outHandle: true, inHandle: false, angleLocked: false, weightLocked: false, xValue: f0 + bz[0] * dt, yValue: v0 + bz[1] * dv };
        api.modifyKeyframeTangent(id, o);
        i[attr] = { frame: f1, inHandle: true, outHandle: false, angleLocked: false, weightLocked: false, xValue: f0 + bz[2] * dt, yValue: v0 + bz[3] * dv };
        api.modifyKeyframeTangent(id, i);
        return f1;
    }

    function apply(id, name, phase, start, opts) {
        if (!RECIPES) throw new Error("call MDNA.init(<repo folder>) first");
        opts = opts || {};
        var rec = RECIPES.presets[name];
        if (!rec) throw new Error("preset not found: " + name);
        var segs = rec[phase || "in"];
        if (!segs || !segs.length || segs.error) throw new Error(name + " has no portable " + phase + " phase");
        var fps = api.get(api.getActiveComp(), "fps"), k = fps / FPS_SRC * (opts.duration || 1), amt = opts.intensity || 1;
        var px = opts.px || 1;   // After Effects pixels → Cavalry units (1:1 for comps of the same size)
        var restPos = api.get(id, "position"), restScale = api.get(id, "scale"), restRot = api.get(id, "rotation"), restOp = api.get(id, "opacity");
        var end = start || 0;
        for (var s = 0; s < segs.length; s++) {
            var sg = segs[s], ch = sg.channel;
            if (!ch) continue;
            var f0 = (start || 0) + sg.start_f * k, pieces = [[sg.from, sg.to, sg.frames, bezierOf(sg)]];
            if (sg.kind === "stops") {
                pieces = []; var v = sg.from;
                for (var j = 0; j < sg.stops.length; j++) { pieces.push([v, sg.stops[j].v, sg.stops[j].frames, EASE[sg.stops[j].ease] || [0, 0, 1, 1]]); v = sg.stops[j].v; }
            }
            for (var p = 0; p < pieces.length; p++) {
                var a = pieces[p][0], b = pieces[p][1], f1 = f0 + pieces[p][2] * k, bz = pieces[p][3];
                if (opts.ease && ch !== "opacity" && EASE[opts.ease]) bz = EASE[opts.ease];   // the panel's Curve override (fades keep theirs)
                if (ch === "position") {
                    key(id, "position.x", f0, restPos.x + a[0] * px * amt, f1, restPos.x + b[0] * px * amt, bz);
                    key(id, "position.y", f0, restPos.y - a[1] * px * amt, f1, restPos.y - b[1] * px * amt, bz);   // y up
                } else if (ch === "scale") {
                    key(id, "scale.x", f0, restScale.x * (1 + (a[0] - 1) * amt), f1, restScale.x * (1 + (b[0] - 1) * amt), bz);
                    key(id, "scale.y", f0, restScale.y * (1 + (a[1] - 1) * amt), f1, restScale.y * (1 + (b[1] - 1) * amt), bz);
                } else if (ch === "opacity") {
                    key(id, "opacity", f0, restOp * a, f1, restOp * b, bz);
                } else if (ch === "rotation") {
                    key(id, "rotation.z", f0, restRot.z - a * amt, f1, restRot.z - b * amt, bz);   // counter-clockwise
                } else if (ch === "rotationX") {
                    key(id, "rotation.x", f0, restRot.x + a * amt, f1, restRot.x + b * amt, bz);
                } else if (ch === "rotationY") {
                    key(id, "rotation.y", f0, restRot.y + a * amt, f1, restRot.y + b * amt, bz);
                }
                f0 = f1; end = Math.max(end, Math.round(f1));
            }
        }
        return end;
    }

    function applyMany(ids, name, phase, start, stagger, opts) {
        var out = [];
        for (var i = 0; i < ids.length; i++) out.push(apply(ids[i], name, phase, (start || 0) + i * (stagger || 0), opts));
        return out;
    }

    function list() { return RECIPES ? RECIPES.portable : []; }

    // ------------------------------------------------------------------ kit pieces (research/platforms/kit_portable.json)
    // MDNA.kit(id, ids, phase, start, opts) builds one kit piece on the layers in ids (stagger between them) and returns
    // { piece, end, layers, helpers[, cut] }. phase: one of the piece's phases ("in", "out", "emphasis", "loop",
    // "transition") or "both" for pieces with in and out. opts: duration (x), intensity (x), stagger (frames between
    // layers), ease (a token name that replaces the piece's main curve; fades keep theirs), outAt (frame for the out
    // phase of "both"), params (overrides of the catalog params, e.g. {to: 98, suffix: "%"} for the counter).
    // Every helper node (filter, deformer, mask, behaviour) is recorded in the layer's user data, so MDNA.kitRemove()
    // can take the piece off again. Techniques: research/platforms/cavalry/tests/ (01 blur, 02 wipe/iris, 03 skew,
    // 04 trim, 05 per char, 06 typewriter, 07 loops, 08 bars, 09 counter).
    var KIT = null, KIT_BY = {};
    function initKit(root) {
        KIT = JSON.parse(api.readFromFile(root + "/research/platforms/kit_portable.json"));
        KIT_BY = {};
        for (var i = 0; i < KIT.items.length; i++) KIT_BY[KIT.items[i].id] = KIT.items[i];
        return KIT.items.length;
    }
    function kitList(type) {
        if (!KIT) return [];
        return type ? KIT.items.filter(function (p) { return p.type === type; }) : KIT.items.slice();
    }
    function kitTypes() { return KIT ? KIT.types.slice() : ["Moves"]; }
    function kitPiece(idOrName) {
        if (KIT_BY[idOrName]) return KIT_BY[idOrName];
        for (var i = 0; KIT && i < KIT.items.length; i++) if (KIT.items[i].name === idOrName) return KIT.items[i];
        return null;
    }

    function tanDeg(d) { return Math.tan(d * Math.PI / 180); }
    // CSS / After Effects skewX(deg) leans the top towards -deg; Cavalry's shear is x += s * y with y up, so s = -tan(deg).
    function shear(deg) { return -tanDeg(deg); }

    function meta(id) { var m = null; try { if (api.hasUserDataKey(id, "mdnaKit")) m = api.getUserDataKey(id, "mdnaKit"); } catch (e) {} return m || { helpers: {}, rest: {} }; }
    function saveMeta(id, m) { api.setUserData(id, "mdnaKit", m); }
    function dropUserKey(id, key) {   // there is no api call to remove a user data key: rewrite the userData JSON string without it
        try { var u = api.get(id, "userData"), o = u ? JSON.parse(u) : {}; delete o[key]; api.set(id, { userData: Object.keys(o).length ? JSON.stringify(o) : "" }); } catch (e) {}
    }
    // one helper node per layer and tag (re-used by in + out), connected into the layer's list attribute (filters, deformers, masks)
    function helper(id, tag, type, list, name, made) {
        var m = meta(id), h = m.helpers[tag];
        if (h && api.getAllSceneLayers().indexOf(h) < 0) h = null;
        helper.fresh = !h;   // true when this call created the node (wire it once)
        if (!h) {
            h = api.create(type, name);
            if (list) api.connect(h, "id", id, list);
            m.helpers[tag] = h; saveMeta(id, m); made.push(h);
        }
        return h;
    }
    function remember(id, key, value) { var m = meta(id); if (m.rest[key] === undefined) { m.rest[key] = value; saveMeta(id, m); } }
    function track(id, h) { var m = meta(id); m.helpers["x" + h] = h; saveMeta(id, m); }
    function isText(id) { return api.getLayerType(id) === "textShape"; }
    function textOf(id) { var v = api.get(id, "text"); return v && typeof v === "object" ? String(v.text || "") : String(v || ""); }   // rich text comes back as {text, overrides}
    function bbox(id) { return api.getBoundingBox(id, true); }

    // stepped keys through several values (Jello): each piece gets the same token curve
    function keySteps(id, attr, f0, values, frames, bz) {
        var n = values.length - 1, f = f0;
        for (var i = 0; i < n; i++) {
            var a = Math.round(f0 + i * frames / n), b = Math.round(f0 + (i + 1) * frames / n);
            f = key(id, attr, a, values[i], b, values[i + 1], bz);
        }
        return f;
    }

    var BUILD = {
        blur_in: function (L, ph, f0, c) {
            // Fast Blur (amount = Gaussian sigma) with Clamp tiling: AE's Gaussian Blur with Repeat Edge Pixels keeps a hard edge
            var g = helper(L, "blur", "blurFilter", "filters", "MDNA Blur", c.made);
            if (helper.fresh) {
                // and AE crops the result to the layer (no glow past the edge): clip the filter's output with a hidden matte of the layer's box
                api.set(g, { tileMode: 0, matteApplyMode: 1 });
                var b = bbox(L), mt = api.primitive("rectangle", "MDNA Blur Edge");
                api.set(mt, { "generator.dimensions": [b.width, b.height] });
                api.parent(mt, L);
                var mb = bbox(mt), mp = api.get(mt, "position");
                api.set(mt, { position: [mp.x + b.centre.x - mb.centre.x, mp.y + b.centre.y - mb.centre.y], hidden: true });
                api.connect(mt, "id", g, "mattes");
                var mm = meta(L); mm.helpers.blurEdge = mt; saveMeta(L, mm); c.made.push(mt);
            }
            var px = AE_BLUR_SIGMA * c.p.blur_px * c.amt, F = c.p.frames * c.k, Ff = c.p.fade_frames * c.k, op = c.restOp(L);
            if (ph === "in") {
                key(g, "amount.x", f0, px, f0 + F, 0, c.bz); key(g, "amount.y", f0, px, f0 + F, 0, c.bz);
                key(L, "opacity", f0, 0, f0 + Ff, op, c.flat);
            } else {
                key(g, "amount.x", f0, 0, f0 + F, px, c.bz); key(g, "amount.y", f0, 0, f0 + F, px, c.bz);
                key(L, "opacity", f0 + F - Ff, op, f0 + F, 0, c.flat);
            }
            return Math.round(f0 + F);
        },
        slam_in: function (L, ph, f0, c) {   // the 4-frame Flat fade is the After Effects engine's (Slam In "in")
            var g = helper(L, "blur", "sceneGroup::gaussianBlurFilter", "filters", "MDNA Blur", c.made);
            var F = c.p.frames * c.k, s = api.get(L, "scale"), r = api.get(L, "rotation"), k = 1 + (c.p.scale_from - 1) * c.amt;
            key(g, "amount.x", f0, c.p.blur_px * c.amt, f0 + F, 0, c.bz); key(g, "amount.y", f0, c.p.blur_px * c.amt, f0 + F, 0, c.bz);
            key(L, "scale.x", f0, s.x * k, f0 + F, s.x, c.bz); key(L, "scale.y", f0, s.y * k, f0 + F, s.y, c.bz);
            key(L, "rotation.z", f0, r.z - c.p.rotation_from * c.amt, f0 + F, r.z, c.bz);   // After Effects degrees are clockwise
            key(L, "opacity", f0, 0, f0 + 4 * c.k, c.restOp(L), c.flat);
            return Math.round(f0 + F);
        },
        wipe_reveal: function (L, ph, f0, c) {
            var w = helper(L, "wipe", "linearWipe", "filters", "MDNA Wipe", c.made);
            // linearWipe "direction" 0 hides from the left edge as completion grows; a reveal runs the other way
            var dir = { left_to_right: 180, right_to_left: 0, bottom_to_top: 90, top_to_bottom: 270 }[c.p.direction];
            api.set(w, { direction: dir === undefined ? 180 : dir, feather: c.p.feather_px || 0 });
            var F = c.p.frames * c.k;
            if (ph === "in") key(w, "completion", f0, 100, f0 + F, 0, c.bz); else key(w, "completion", f0, 0, f0 + F, 100, c.bz);
            return Math.round(f0 + F);
        },
        iris_reveal: function (L, ph, f0, c) {
            var m = meta(L), e = m.helpers.iris, b = bbox(L), R = Math.sqrt(b.width * b.width + b.height * b.height) / 2 + 4;
            if (!e) {
                e = api.primitive("ellipse", "MDNA Iris");
                api.set(e, { position: [b.centre.x, b.centre.y] });
                api.connect(e, "id", L, "masks");
                m.helpers.iris = e; saveMeta(L, m); c.made.push(e);
            }
            var F = c.p.frames * c.k, a = ph === "in" ? 0 : R, z = ph === "in" ? R : 0;
            key(e, "generator.radius.x", f0, a, f0 + F, z, c.bz); key(e, "generator.radius.y", f0, a, f0 + F, z, c.bz);
            return Math.round(f0 + F);
        },
        jello: function (L, ph, f0, c) {
            var s = helper(L, "skew", "skew", "deformers", "MDNA Skew", c.made);
            var v = [0].concat(c.p.skew_deg).map(function (d) { return shear(d * c.amt); });
            return keySteps(s, "skew.x", f0, v, c.p.frames * c.k, c.bz);
        },
        light_speed_in: function (L, ph, f0, c) {   // the 6-frame Flat fade is the After Effects engine's (Light Speed In)
            var s = helper(L, "skew", "skew", "deformers", "MDNA Skew", c.made);
            var F = c.p.frames * c.k, x = api.get(L, "position").x;
            key(L, "position.x", f0, x + c.p.from_x_px * c.amt, f0 + F, x, c.bz);
            key(s, "skew.x", f0, shear(c.p.skew_from_deg * c.amt), f0 + F, 0, c.bz);
            key(L, "opacity", f0, 0, f0 + 6 * c.k, c.restOp(L), c.flat);
            return Math.round(f0 + F);
        },
        line_draw: function (L, ph, f0, c) {
            if (!api.hasAttribute(L, "stroke.trim") || !api.hasStroke(L)) throw new Error("Line Draw needs a shape with a stroke (" + api.getNiceName(L) + " has none)");
            api.set(L, { "stroke.trim": true });
            var F = c.p.frames * c.k;
            if (ph === "in") key(L, "stroke.trimEnd", f0, 0, f0 + F, 100, c.bz); else key(L, "stroke.trimEnd", f0, 100, f0 + F, 0, c.bz);
            return Math.round(f0 + F);
        },
        chars_rise: function (L, ph, f0, c) { return perUnit(L, ph, f0, c, 3); },
        words_fade_up: function (L, ph, f0, c) { return perUnit(L, ph, f0, c, 2); },
        typewriter: function (L, ph, f0, c) {
            if (!isText(L)) throw new Error("Typewriter needs a text layer");
            var str = textOf(L);
            // left-align so the line does not re-centre while it types, keeping the text where it was
            if (api.get(L, "horizontalAlignment") !== 0 && !api.getKeyframeTimes(L, "position.x").length) {
                var before = bbox(L).left; api.set(L, { horizontalAlignment: 0 });
                var after = bbox(L).left, p = api.get(L, "position"); api.set(L, { position: [p.x + before - after, p.y] });
            }
            var m = helper(L, "type", "stringManipulator", null, "MDNA Typewriter", c.made), fresh = helper.fresh;
            if (fresh) {
                api.setGenerator(m, "generator", "resizeString");
                api.set(m, { "generator.mode": 0, "generator.indexMode": 0, "generator.directionMode": 1 });
                api.connect(m, "id", L, "manipulators");
            }
            var F = Math.max(1, str.length / c.p.chars_per_second * c.fps * c.dur);   // constant cadence: linear on purpose
            return key(m, "generator.percentage", f0, 0, f0 + F, 100, [0, 0, 1, 1]);
        },
        float: function (L, ph, f0, c) {
            remember(L, "position.y", api.get(L, "position").y); var y = meta(L).rest["position.y"];   // a live loop reads back moving values
            var o = helper(L, "float", "oscillator", null, "MDNA Float", c.made), fresh = helper.fresh, a = c.p.amp_px * c.amt;
            api.set(o, { minimum: y - a, maximum: y + a, frequency: c.fps / (c.p.period_frames * c.k) });
            if (fresh) api.connect(o, "id", L, "position.y");
            return f0;
        },
        pulse: function (L, ph, f0, c) {
            var s0 = api.get(L, "scale"); remember(L, "scale", [s0.x, s0.y]); var s = { x: meta(L).rest.scale[0], y: meta(L).rest.scale[1] };
            var o = helper(L, "pulse", "oscillator", null, "MDNA Pulse", c.made), fresh = helper.fresh, k = 1 + (c.p.scale - 1) * c.amt;
            api.set(o, { minimum: s.x, maximum: s.x * k, frequency: c.fps / (c.p.period_frames * c.k) });
            if (fresh) { api.connect(o, "id", L, "scale.x"); api.connect(o, "id", L, "scale.y"); }
            return f0;
        },
        wiggle: function (L, ph, f0, c) {
            remember(L, "rotation.z", api.get(L, "rotation").z); var r = meta(L).rest["rotation.z"];
            var n = helper(L, "wiggle", "noise", null, "MDNA Wiggle", c.made), fresh = helper.fresh, a = c.p.rotation_deg * c.amt;
            // noise frequency 2 per wiggle Hz gives After Effects wiggle()'s ~2 extremes per cycle (measured)
            api.set(n, { "generator.minimum": r - a, "generator.maximum": r + a, "generator.frequency": 2 * c.p.frequency_hz / c.dur });
            if (fresh) api.connect(n, "id", L, "rotation.z");
            return f0;
        },
        counter: function (L, ph, f0, c) {
            var p = c.p;
            if (!L) {
                L = api.create("textShape", "MDNA Counter"); c.made.push(L); c.layers.push(L);
                api.set(L, { fontSize: 160, autoWidth: true, autoHeight: true, horizontalAlignment: 1, verticalAlignment: 1, "material.materialColor": "#f2f2f2", position: [0, 0] });
                try { api.set(L, { "font.font": "Inter Tight", "font.style": "SemiBold" }); } catch (e) {}
            }
            var m = meta(L), g = m.helpers.counter;
            if (!g) {
                g = api.create("stringGenerator", "MDNA Counter Value"); c.made.push(g);
                api.connect(g, "out", L, "text"); m.helpers.counter = g; saveMeta(L, m);
            }
            api.set(g, { "generator.precision": p.decimals || 0, "generator.length": 0, "generator.delimiter": p.separator || "", prefix: p.prefix || "", suffix: p.suffix || "" });
            return key(g, "generator.number", f0, p.from, f0 + p.frames * c.k, p.to, c.bz);
        },
        bars_transition: function (L, ph, f0, c) {
            var p = c.p, comp = api.getActiveComp(), res = api.get(comp, "resolution"), W = res.x, H = res.y, n = Math.max(1, Math.round(p.count));
            var horiz = p.direction === "left_to_right" || p.direction === "right_to_left";
            var sign = (p.direction === "right_to_left" || p.direction === "top_to_bottom") ? -1 : 1;
            var travel = (horiz ? W : H) + 40, band = (horiz ? H : W) / n;
            var dup = api.create("duplicator", "MDNA Bars"); c.made.push(dup); c.layers.push(dup);
            var hs = {};
            (p.colors || ["#c9f25a"]).forEach(function (col, i) {
                var r = api.primitive("rectangle", "MDNA Bar " + (i + 1)); c.made.push(r);
                api.set(r, { "generator.dimensions": horiz ? [travel, band + 2] : [band + 2, travel], "material.materialColor": col });
                api.connect(r, "id", dup, "shapes"); hs["bar" + i] = r;
            });
            api.setGenerator(dup, "generator", "linearDistribution");
            api.set(dup, { "generator.count": n, "generator.direction": horiz ? 1 : 0, "generator.size": (horiz ? H : W) - band, position: [0, 0] });
            var v = api.create("value", "MDNA Bars Travel"); c.made.push(v);
            var C = p.cover_frames * c.k, U = p.uncover_frames * c.k, S = p.stagger_frames * c.k;
            var bzIn = c.ease || EASE[p.ease_in], bzOut = c.ease || EASE[p.ease_out];
            var cut = Math.round(f0 + C + S * (n - 1));   // every bar covers the frame here: the place for the cut
            key(v, "value", f0, -sign * travel, f0 + C, 0, bzIn);
            var end = key(v, "value", cut, 0, cut + U, sign * travel, bzOut);
            api.connect(v, "id", dup, horiz ? "shapePosition.x" : "shapePosition.y");
            var st = api.create("stagger", "MDNA Bars Stagger"); c.made.push(st);
            api.set(st, { minimum: 0, maximum: -S * (n - 1) });   // negative = each bar later (a positive offset runs it early)
            api.connect(st, "id", dup, "shapeTimeOffset");
            var keep = api.getSelection(); api.select([dup]); api.bringToFront(); api.select(keep);
            hs.travel = v; hs.stagger = st;
            var m = meta(dup); m.helpers = hs; saveMeta(dup, m);
            c.cut = cut;
            return Math.round(end + S * (n - 1));
        }
    };

    // After Effects' Range Selector (shape Ramp Up, by characters or words), as in kit_portable.json "text_model":
    // unit i of n sits at x_i = 100·(i + 0.5)/n (AE counts spaces as characters), the offset o(t) runs −W → 100 over the
    // piece's frames on its token curve, and each unit is affected by a_i = clamp((x_i − o)/W): it moves down rise·a_i,
    // scales to 1 + (scale_from − 1)·a_i, blurs blur_px·a_i and fades to 1 − a_i.
    // Cavalry: every unit becomes its own text layer (same font, size, colour, tracking), a child of the original text,
    // placed exactly on its glyph (a Get Sub-Mesh Transform reads each glyph's or word's box centre in the laid-out text, so
    // kerning and tracking stay), with its own Fast Blur; the original keeps its layout but stops drawing (fill off).
    // Each unit's position y, scale, opacity and blur are baked frame by frame (linear keys at every frame, equal to the
    // formula there). Why not a Sub-Mesh on the text: Cavalry 2.8 shows Sub-Mesh in the viewport but its renderer drops it
    // (measured on the Starter licence: the render draws the text untouched), so per-unit blur and timing need real layers.
    var AE_BLUR_SIGMA = 0.3;   // After Effects blurriness → Gaussian sigma in px (measured on the AE proof render); Cavalry's Fast Blur amount is sigma
    function bezEase(bz, x) {   // CSS cubic-bezier(x1, y1, x2, y2) at x (the same curve the keyed tangents draw)
        if (x <= 0) return 0; if (x >= 1) return 1;
        var lo = 0, hi = 1, t = x;
        for (var i = 0; i < 60; i++) {
            t = (lo + hi) / 2;
            var X = 3 * (1 - t) * (1 - t) * t * bz[0] + 3 * (1 - t) * t * t * bz[2] + t * t * t;
            if (X < x) lo = t; else hi = t;
        }
        return 3 * (1 - t) * (1 - t) * t * bz[1] + 3 * (1 - t) * t * t * bz[3] + t * t * t;
    }
    function unitStrings(str, level) {   // the units Cavalry's text levels count (characters skip spaces), with AE's x_i
        var out = [], i;
        if (level === 3) {
            for (i = 0; i < str.length; i++) if (!/\s/.test(str[i])) out.push({ s: str[i], x: 100 * (i + 0.5) / str.length });
        } else {
            var words = str.split(/\s+/).filter(Boolean);
            for (i = 0; i < words.length; i++) out.push({ s: words[i], x: 100 * (i + 0.5) / words.length });
        }
        return out;
    }
    function splitUnits(L, level, made) {   // one child text layer per unit, sitting exactly on its glyph(s)
        var units = unitStrings(textOf(L), level), probe = api.create("getSubMeshTransform", "MDNA probe"), ids = [];
        api.connect(L, "id", probe, "inputShape"); api.set(probe, { levelMode: level, useBoundingBox: true });
        var copy = ["fontSize", "letterSpacing", "lineSpacing", "font", "material.materialColor", "horizontalAlignment", "verticalAlignment", "autoWidth", "autoHeight"];
        var base = {}; copy.forEach(function (k) { try { base[k] = api.get(L, k); } catch (e) {} });
        for (var i = 0; i < units.length; i++) {
            api.set(probe, { index: i }); var c = api.get(probe, "position");   // the unit's box centre (world)
            var u = api.create("textShape", "MDNA unit " + units[i].s); made.push(u); ids.push(u);
            // its origin on the baseline, centred on its advance: AE scales a character about that point (its anchor)
            api.set(u, base); api.set(u, { text: units[i].s, horizontalAlignment: 1, verticalAlignment: 3 });
            api.parent(u, L);
            var bb = api.getBoundingBox(u, true), p = api.get(u, "position");
            api.set(u, { position: [p.x + c.x - bb.centre.x, p.y + c.y - bb.centre.y] });
            var g = api.create("blurFilter", "MDNA unit blur"); made.push(g);
            api.set(g, { tileMode: 2, amount: [0, 0] }); api.connect(g, "id", u, "filters");
            units[i].id = u; units[i].blur = g; units[i].y = api.get(u, "position").y;
        }
        api.deleteLayer(probe);
        api.setFill(L, false);   // the original keeps its layout (and the units' parent) but no longer draws
        return units;
    }
    function perUnit(L, ph, f0, c, level) {
        if (!isText(L)) throw new Error(c.piece.name + " needs a text layer");
        var p = c.p, W = p.window_pct || 35, F = p.frames * c.k, m = meta(L), units = m.units;
        if (!units || !units.length || api.getAllSceneLayers().indexOf(units[0].id) < 0) {
            units = splitUnits(L, level, c.made);
            m.units = units; units.forEach(function (u, i) { m.helpers["unit" + i] = u.id; m.helpers["unitBlur" + i] = u.blur; });
            m.fillOff = true; saveMeta(L, m);
        }
        var amt = c.amt, sf = p.scale_from === undefined ? 1 : p.scale_from;
        var rise = p.rise_px * amt, ks = (sf - 1) * amt, kb = AE_BLUR_SIGMA * (p.blur_px || 0) * amt;
        var fa = Math.round(f0), fb = Math.ceil(f0 + F);
        for (var f = fa; f <= fb; f++) {
            var e = bezEase(c.bz, (f - f0) / F), o = ph === "in" ? -W + (100 + W) * e : 100 - (100 + W) * e;
            for (var i = 0; i < units.length; i++) {
                var U = units[i], a = Math.min(1, Math.max(0, (U.x - o) / W));
                api.keyframe(U.id, f, { "position.y": U.y - rise * a, "scale.x": 1 + ks * a, "scale.y": 1 + ks * a, opacity: 100 * (1 - a) });   // AE moves the unit down; Cavalry's y is up
                api.keyframe(U.blur, f, { "amount.x": kb * a, "amount.y": kb * a });
            }
        }
        return fb;
    }

    function kit(idOrName, ids, phase, start, opts) {
        if (!KIT) throw new Error("call MDNA.init(<repo folder>) first");
        var piece = kitPiece(idOrName);
        if (!piece) throw new Error("kit piece not found: " + idOrName);
        opts = opts || {}; ids = ids || []; start = start || 0;
        phase = phase || piece.phase[0];
        var both = phase === "both";
        if (both && !(piece.phase.indexOf("in") >= 0 && piece.phase.indexOf("out") >= 0)) throw new Error(piece.name + " has no In + Out");
        if (!both && piece.phase.indexOf(phase) < 0) throw new Error(piece.name + " has no " + phase + " phase (" + piece.phase.join(", ") + ")");
        var p = {}, k;
        for (k in piece.params) p[k] = piece.params[k];
        for (k in (opts.params || {})) p[k] = opts.params[k];
        var fps = api.get(api.getActiveComp(), "fps"), dur = opts.duration || 1;
        var c = { piece: piece, p: p, fps: fps, dur: dur, k: fps / ((KIT && KIT.fps) || 30) * dur, amt: opts.intensity === undefined ? 1 : opts.intensity,
            ease: opts.ease && EASE[opts.ease] ? EASE[opts.ease] : null, flat: [0, 0, 1, 1], made: [], layers: [], cut: undefined,
            restOp: function (L) { var m = meta(L); if (m.rest.opacity === undefined) { m.rest.opacity = api.get(L, "opacity"); saveMeta(L, m); } return m.rest.opacity; } };
        c.bz = c.ease || EASE[p.ease] || [0, 0, 1, 1];
        var fn = BUILD[piece.id], end = start, stg = opts.stagger || 0;
        if (piece.creates) {
            var target = null;
            for (var t = 0; t < ids.length; t++) if (piece.id === "counter" && isText(ids[t])) { target = ids[t]; break; }
            end = fn(target, phase, start, c);
            if (target) c.layers.push(target);
        } else {
            if (!ids.length) throw new Error("select one or more layers for " + piece.name);
            var ends = [];
            for (var i = 0; i < ids.length; i++) ends.push(fn(ids[i], both ? "in" : phase, start + i * stg, c));
            end = Math.max.apply(null, ends);
            if (both) {
                var comp = api.getActiveComp(), last = api.get(comp, "endFrame") || 120;
                var outDur = Math.round((p.frames || 14) * c.k), at = opts.outAt !== undefined ? opts.outAt : Math.max(end + 10, last - outDur - (ids.length - 1) * stg);
                ends = [];
                for (var j = 0; j < ids.length; j++) ends.push(fn(ids[j], "out", at + j * stg, c));
                end = Math.max.apply(null, ends);
            }
            c.layers = ids.slice();
        }
        for (var h = 0; h < c.layers.length; h++) if (piece.creates) { var mm = meta(c.layers[h]); mm.piece = piece.id; saveMeta(c.layers[h], mm); }
        var out = { piece: piece.id, end: end, layers: c.layers, helpers: c.made.filter(function (x) { return c.layers.indexOf(x) < 0; }) };
        if (c.cut !== undefined) out.cut = c.cut;
        return out;
    }

    // Takes kit pieces off the layers: deletes their helper nodes and keys, puts loop channels back at rest.
    // A layer the kit created (counter, bars) is deleted with its helpers.
    function kitRemove(ids) {
        var gone = [];
        (ids || []).forEach(function (id) {
            var m = meta(id), h;
            for (var tag in m.helpers) { h = m.helpers[tag]; try { api.deleteLayer(h); gone.push(h); } catch (e) {} }
            ["stroke.trimEnd", "stroke.trimStart", "position", "scale", "rotation", "opacity"].forEach(function (a) { try { api.deleteAnimation(id, a); } catch (e) {} });
            if (m.rest["position.y"] !== undefined) { var p = api.get(id, "position"); api.set(id, { position: [p.x, m.rest["position.y"]] }); }
            if (m.rest.scale !== undefined) api.set(id, { scale: m.rest.scale });
            if (m.rest["rotation.z"] !== undefined) { var r = api.get(id, "rotation"); api.set(id, { rotation: [r.x, r.y, m.rest["rotation.z"]] }); }
            if (m.fillOff) { try { api.setFill(id, true); } catch (e) {} }
            if (m.piece) { try { api.deleteLayer(id); gone.push(id); } catch (e) {} }
            else dropUserKey(id, "mdnaKit");
        });
        return gone;
    }

    return { init: init, apply: apply, applyMany: applyMany, list: list, ease: function (n) { return EASE[n]; },
        dropUserKey: dropUserKey, kit: kit, kitList: kitList, kitTypes: kitTypes, kitPiece: kitPiece, kitRemove: kitRemove };
})();
