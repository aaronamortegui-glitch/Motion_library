// Superside Motion Presets v0.1 — our own library built on ss_motion_lib.jsx + tokens v0.2.
// Each preset: channels (folder-style taxonomy), energy, use, and in/out functions that create real keyframes
// (editable, no plugin). Usage: SSP.apply(layer, "Scale Pop", "in", startTime)
#include "ss_motion_lib.jsx"

var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
var SSP = (function () {
    var TOKENS = SS_ROOT + "/tokens/superside_motion_tokens.json";
    SSM.load(TOKENS);

    // "Rest" values: read at the middle of the layer, where in/out no longer apply
    function REF(L) { return (L.inPoint + L.outPoint) / 2; }
    function T(L, p) { return L.property("ADBE Transform Group").property(p); }
    function pos(L) { var v = T(L, "ADBE Position").valueAtTime(REF(L), true); return [v[0], v[1]]; }
    function scl(L) { var v = T(L, "ADBE Scale").valueAtTime(REF(L), true); return [v[0], v[1], 100]; }
    function rot(L) { return T(L, "ADBE Rotate Z").valueAtTime(REF(L), true); }
    function opa(L) { return T(L, "ADBE Opacity").valueAtTime(REF(L), true); }
    function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
    function mul(s, k) { return [s[0] * k, s[1] * k, 100]; }
    function effect(L, match, name) {
        var fx = L.property("ADBE Effect Parade");
        var e = fx.property(name) || fx.addProperty(match);
        e.name = name;
        return e;
    }
    function blur(L) {
        var e = effect(L, "ADBE Gaussian Blur 2", "SS Blur");
        e.property("ADBE Gaussian Blur 2-0003").setValue(1); // repeat edge pixels
        return e.property("ADBE Gaussian Blur 2-0001");
    }
    function wipe(L) {
        var e = effect(L, "ADBE Linear Wipe", "SS Wipe");
        e.property("ADBE Linear Wipe-0002").setValue(90); // left to right
        e.property("ADBE Linear Wipe-0003").setValue(0);  // hard edge
        return e.property("ADBE Linear Wipe-0001");
    }
    // stable per-layer seed so organic rhythms differ between layers but are repeatable
    function seedOf(L) { var s = 0, n = L.name + L.index; for (var i = 0; i < n.length; i++) s = (s * 31 + n.charCodeAt(i)) % 2147483647; return s || 1; }
    function trimEnd(L) {
        var root = L.property("ADBE Root Vectors Group");
        if (!root) return null;
        var tr = root.property("SS Trim") || root.addProperty("ADBE Vector Filter - Trim");
        tr.name = "SS Trim";
        return tr.property("ADBE Vector Trim End");
    }

    // Each phase returns its end time.
    var P = {
        "Fade": {
            channels: "Fade", energy: "soft", use: "Corporate, UI, supporting text",
            "in": function (L, t) { return SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Blink", "Flat"); },
            "out": function (L, t) { return SSM.animate(T(L, "ADBE Opacity"), t, opa(L), 0, "Blink", "Flat"); }
        },
        "Fade Up": {
            channels: "Fade & Position", energy: "soft", use: "Headlines, paragraphs, lists",
            "in": function (L, t) {
                var p = pos(L);
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Blink", "Flat");
                return SSM.animate(T(L, "ADBE Position"), t, add(p, [0, 40]), p, "Arrive", "Land");
            },
            "out": function (L, t) {
                var p = pos(L);
                SSM.animate(T(L, "ADBE Position"), t, p, add(p, [0, -30]), "Glide", "Launch");
                return SSM.animate(T(L, "ADBE Opacity"), t, opa(L), 0, "Glide", "Flat");
            }
        },
        "Scale Pop": {
            channels: "Fade & Scale", energy: "dynamic", use: "Icons, chips, stickers, social",
            "in": function (L, t) {
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Tick", "Flat");
                return SSM.animate(T(L, "ADBE Scale"), t, [0, 0, 100], scl(L), "Arrive", "Pop");
            },
            "out": function (L, t) {
                SSM.animate(T(L, "ADBE Opacity"), t + SSM.seconds("Tick"), opa(L), 0, "Tick", "Flat");
                return SSM.animate(T(L, "ADBE Scale"), t, scl(L), [0, 0, 100], "Glide", "Recoil");
            }
        },
        "Blur In": {
            channels: "Blur & Fade", energy: "soft", use: "Photos, backgrounds, premium moments",
            "in": function (L, t) {
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Glide", "Flat");
                return SSM.animate(blur(L), t, 40, 0, "Sweep", "Settle");
            },
            "out": function (L, t) {
                SSM.animate(T(L, "ADBE Opacity"), t, opa(L), 0, "Arrive", "Flat");
                return SSM.animate(blur(L), t, 0, 40, "Arrive", "Launch");
            }
        },
        "Slide Land": {
            channels: "Position", energy: "medium", use: "Images and cards entering from off-screen",
            "in": function (L, t) {
                var p = pos(L), w = L.containingComp.width;
                return SSM.animate(T(L, "ADBE Position"), t, [w + L.sourceRectAtTime(t, false).width, p[1]], p, "Sweep", "Land");
            },
            "out": function (L, t) {
                var p = pos(L), w = L.containingComp.width;
                return SSM.animate(T(L, "ADBE Position"), t, p, [-L.sourceRectAtTime(t, false).width, p[1]], "Sweep", "Launch");
            }
        },
        "Rotate Settle": {
            channels: "Fade & Rotate & Scale", energy: "medium", use: "Logos, badges, pieces with personality",
            "in": function (L, t) {
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Blink", "Flat");
                SSM.animate(T(L, "ADBE Rotate Z"), t, rot(L) - 12, rot(L), "Arrive", "Settle");
                return SSM.animate(T(L, "ADBE Scale"), t, mul(scl(L), 0.8), scl(L), "Arrive", "Settle");
            },
            "out": function (L, t) {
                SSM.animate(T(L, "ADBE Rotate Z"), t, rot(L), rot(L) + 12, "Glide", "Launch");
                SSM.animate(T(L, "ADBE Scale"), t, scl(L), mul(scl(L), 0.8), "Glide", "Launch");
                return SSM.animate(T(L, "ADBE Opacity"), t, opa(L), 0, "Glide", "Flat");
            }
        },
        "Squash Warp": {
            channels: "Scale & Warp", energy: "dynamic", use: "Social, hype, rhythmic transitions",
            "in": function (L, t) {
                var s = scl(L);
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Tick", "Flat");
                return SSM.animate(T(L, "ADBE Scale"), t, [s[0] * 1.4, s[1] * 0.3, 100], s, "Arrive", "Pop");
            },
            "out": function (L, t) {
                var s = scl(L);
                SSM.animate(T(L, "ADBE Opacity"), t + SSM.seconds("Tick"), opa(L), 0, "Tick", "Flat");
                return SSM.animate(T(L, "ADBE Scale"), t, s, [s[0] * 0.3, s[1] * 1.4, 100], "Glide", "Recoil");
            }
        },
        "Wipe Reveal": {
            channels: "Mask", energy: "medium", use: "Bars, lower thirds, underlines",
            "in": function (L, t) { return SSM.animate(wipe(L), t, 100, 0, "Sweep", "Cruise"); },
            "out": function (L, t) { return SSM.animate(wipe(L), t, 0, 100, "Arrive", "Launch"); }
        },
        "Organic Draw": {
            channels: "Trim Path", energy: "medium", use: "Hand-drawn feel: contours, underlines, sketch lines (shape layers only)",
            "in": function (L, t) {
                var p = trimEnd(L); if (!p) return t;
                return SSM.animateStops(p, t, 0, SSM.organicStops(0, 100, SSM.frames("Stage") + 6, seedOf(L)));
            },
            "out": function (L, t) {
                var p = trimEnd(L); if (!p) return t;
                return SSM.animateStops(p, t, 100, SSM.organicStops(100, 0, SSM.frames("Arrive"), seedOf(L) + 7, 3));
            }
        },
        "Organic Stroke": {
            channels: "Trim Path", energy: "dynamic", use: "Traveling brush stroke: the start chases the end (accent lines, HUD links)",
            "in": function (L, t) {
                var root = L.property("ADBE Root Vectors Group"); if (!root) return t;
                var e = trimEnd(L), s = root.property("SS Trim").property("ADBE Vector Trim Start");
                var stops = SSM.organicStops(0, 100, SSM.frames("Stage"), seedOf(L));
                var end = SSM.animateStops(e, t, 0, stops);
                SSM.animateStops(s, t + SSM.seconds("Glide"), 0, SSM.organicStops(0, 100, SSM.frames("Stage"), seedOf(L) + 3));
                return end;
            },
            "out": function (L, t) { return t; }
        },
        "Line Draw": {
            channels: "Trim Path", energy: "medium", use: "Lines, stroke icons, tracking HUD (shape layers only)",
            "in": function (L, t) { var p = trimEnd(L); return p ? SSM.animate(p, t, 0, 100, "Sweep", "Cruise") : t; },
            "out": function (L, t) { var p = trimEnd(L); return p ? SSM.animate(p, t, 100, 0, "Arrive", "Launch") : t; }
        },
        // From the Boardroom freeze titles: lands big, blurred and tilted, overshoots and settles; shrinks away.
        "Slam In": {
            channels: "Fade, Scale, Blur & Rotate", energy: "dynamic", use: "Hero words, titles over footage, kinetic type",
            "in": function (L, t) {
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Tick", "Flat");
                SSM.animate(blur(L), t, 40, 0, "Glide", "Land");
                SSM.animate(T(L, "ADBE Rotate Z"), t, rot(L) - 7.5, rot(L), "Arrive", "Settle");
                return SSM.animate(T(L, "ADBE Scale"), t, mul(scl(L), 1.65), scl(L), "Arrive", "Pop");
            },
            "out": function (L, t) {
                SSM.animate(T(L, "ADBE Opacity"), t, opa(L), 0, "Blink", "Flat");
                SSM.animate(blur(L), t, 0, 20, "Blink", "Launch");
                return SSM.animate(T(L, "ADBE Scale"), t, scl(L), mul(scl(L), 0.86), "Blink", "Launch");
            }
        },
        // Camera-style punch on footage or precomps: starts pushed in and eases back to frame (out: pushes in).
        "Punch Zoom": {
            channels: "Scale (camera)", energy: "medium", use: "Footage, precomps, freeze frames, cut emphasis",
            "in": function (L, t) { return SSM.animate(T(L, "ADBE Scale"), t, mul(scl(L), 1.08), scl(L), "Glide", "Land"); },
            "out": function (L, t) { return SSM.animate(T(L, "ADBE Scale"), t, scl(L), mul(scl(L), 1.08), "Glide", "Launch"); }
        }
    };


    // ---------- Effects: continuous loops with editable controls (same idea as AC FX: controls + expression) ----------
    function slider(L, label, v) {
        var fx = L.property("ADBE Effect Parade");
        var e = fx.property(label) || fx.addProperty("ADBE Slider Control");
        e.name = label;
        e.property("ADBE Slider Control-0001").setValue(v);
        return 'effect("' + label + '")("ADBE Slider Control-0001")';
    }
    var FX = {
        "Float": {
            channels: "Position", energy: "soft", use: "Idle icons and cards, living backgrounds",
            build: function (L) {
                var a = slider(L, "SS Float · Amplitude px", 12), f = slider(L, "SS Float · Frequency Hz", 0.5);
                T(L, "ADBE Position").expression = "var a=" + a + ", f=" + f + "; value + [0, Math.sin(time*f*Math.PI*2)*a];";
            }
        },
        "Wiggle Rotate": {
            channels: "Rotate", energy: "medium", use: "Stickers, illustrations with personality",
            build: function (L) {
                var a = slider(L, "SS Wiggle · Angle", 6), f = slider(L, "SS Wiggle · Frequency", 2);
                T(L, "ADBE Rotate Z").expression = "wiggle(" + f + ", " + a + ");";
            }
        },
        "Pulse": {
            channels: "Scale", energy: "medium", use: "CTAs, buttons, attention grabbers",
            build: function (L) {
                var a = slider(L, "SS Pulse · Intensity %", 6), f = slider(L, "SS Pulse · Frequency Hz", 1);
                T(L, "ADBE Scale").expression = "var k = 1 + Math.pow(Math.max(0, Math.sin(time*" + f + "*Math.PI*2)), 4)*" + a + "/100; [value[0]*k, value[1]*k];";
            }
        },
        "Jitter": {
            channels: "Position & Rotate", energy: "dynamic", use: "Social, glitch, high-energy pieces",
            build: function (L) {
                var a = slider(L, "SS Jitter · Amplitude px", 8), f = slider(L, "SS Jitter · Frames per jump", 2);
                T(L, "ADBE Position").expression = "var n=" + f + "; var t=Math.floor(timeToFrames(time)/n)*n; seedRandom(t,true); value + random([-1,-1],[1,1])*" + a + ";";
                T(L, "ADBE Rotate Z").expression = "var n=" + f + "; var t=Math.floor(timeToFrames(time)/n)*n; seedRandom(t+7,true); value + random(-2,2);";
            }
        },
        "Breathe": {
            channels: "Scale & Opacity", energy: "soft", use: "Ambient glows, background shapes, calm idle states",
            build: function (L) {
                var a = slider(L, "SS Breathe · Scale %", 3), f = slider(L, "SS Breathe · Frequency Hz", 0.35);
                T(L, "ADBE Scale").expression = "var k = 1 + (Math.sin(time*" + f + "*Math.PI*2)*0.5+0.5)*" + a + "/100; [value[0]*k, value[1]*k];";
                T(L, "ADBE Opacity").expression = "value * (0.85 + 0.15*(Math.sin(time*" + f + "*Math.PI*2)*0.5+0.5));";
            }
        },
        // From the Boardroom HUD: soft glow, scanlines and an occasional flicker frame.
        "Holo Flicker": {
            channels: "Opacity · Glow & Scanlines", energy: "medium", use: "HUD labels, tech overlays, holographic UI",
            build: function (L) {
                var r = slider(L, "SS Holo · Flicker chance %", 4);
                var g = effect(L, "ADBE Glo2", "SS Holo Glow");
                g.property("ADBE Glo2-0002").setValue(70); g.property("ADBE Glo2-0003").setValue(22); g.property("ADBE Glo2-0004").setValue(0.25);   // low intensity: additive glow turns light colors white
                var v = effect(L, "ADBE Venetian Blinds", "SS Holo Scanlines");
                v.property("ADBE Venetian Blinds-0001").setValue(18); v.property("ADBE Venetian Blinds-0002").setValue(90); v.property("ADBE Venetian Blinds-0003").setValue(4);
                T(L, "ADBE Opacity").expression = "seedRandom(Math.floor(time*24), true); value * (random() < " + r + "/100 ? 0.55 : 1);";
            }
        }
    };

    // ---------- Text: native text animators (per character / word / line) ----------
    function textAnimator(L, name, basedOn, shape) {
        var anims = L.property("ADBE Text Properties").property("ADBE Text Animators");
        var A = anims.addProperty("ADBE Text Animator");
        A.name = name;
        var sel = A.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
        var adv = sel.property("ADBE Text Range Advanced");
        adv.property("ADBE Text Range Type2").setValue(basedOn); // 1 characters · 3 words · 4 lines
        adv.property("ADBE Text Range Shape").setValue(shape || 2); // 2 = Ramp Up (soft reveal)
        // Reveal: ramp of width W; with Ramp Up everything after End is 100% affected (hidden)
        // and everything before Start 0%. Animating Offset from -W to 100 reveals left to right.
        var W = 35;
        sel.property("ADBE Text Percent Start").setValue(0);
        sel.property("ADBE Text Percent End").setValue(W);
        var off = sel.property("ADBE Text Percent Offset");
        return { props: A.property("ADBE Text Animator Properties"), start: off, from: -W, sel: sel };
    }
    function isText(L) { return L.property("ADBE Text Properties") !== null; }
    var TX = {
        "Chars Rise": {
            channels: "Text · Position & Fade (char)", energy: "medium", use: "Short headlines, names, kickers",
            "in": function (L, t) {
                var a = textAnimator(L, "SS Chars Rise", 1, 2);
                a.props.addProperty("ADBE Text Position 3D").setValue([0, 50, 0]);
                a.props.addProperty("ADBE Text Scale 3D").setValue([118, 118, 100]);
                a.props.addProperty("ADBE Text Blur").setValue([14, 14]);
                a.props.addProperty("ADBE Text Opacity").setValue(0);
                return SSM.animate(a.start, t, a.from, 100, "Sweep", "Cruise");
            }
        },
        "Words Fade Up": {
            channels: "Text · Position & Fade (word)", energy: "soft", use: "Phrases, captions, quotes",
            "in": function (L, t) {
                var a = textAnimator(L, "SS Words Fade Up", 3, 2);
                a.props.addProperty("ADBE Text Position 3D").setValue([0, 24, 0]);
                a.props.addProperty("ADBE Text Blur").setValue([8, 8]);
                a.props.addProperty("ADBE Text Opacity").setValue(0);
                return SSM.animate(a.start, t, a.from, 100, "Stage", "Settle");
            }
        },
        "Blur Words": {
            channels: "Text · Blur & Fade (word)", energy: "soft", use: "Premium moments, calm intros",
            "in": function (L, t) {
                var a = textAnimator(L, "SS Blur Words", 3, 2);
                a.props.addProperty("ADBE Text Blur").setValue([18, 18]);
                a.props.addProperty("ADBE Text Opacity").setValue(0);
                return SSM.animate(a.start, t, a.from, 100, "Stage", "Cruise");
            }
        },
        "Tracking Settle": {
            channels: "Text · Tracking & Fade", energy: "medium", use: "All-caps titles, typographic logos",
            "in": function (L, t) {
                var a = textAnimator(L, "SS Tracking Settle", 1, 1);
                var tr = a.props.addProperty("ADBE Text Tracking Amount");
                var bl = a.props.addProperty("ADBE Text Blur");
                a.props.addProperty("ADBE Text Opacity").setValue(0);
                a.sel.property("ADBE Text Percent End").setValue(100);
                a.start.setValue(0);
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Glide", "Flat");
                // the selector covers everything; animate tracking 60 → 0 and animator opacity 0 → 100
                SSM.animate(tr, t, 60, 0, "Stage", "Settle");
                SSM.animate(bl, t, [8, 0], [0, 0], "Sweep", "Settle");   // horizontal motion-blur feel while it settles
                return SSM.animate(a.props.property("ADBE Text Opacity"), t, 0, 100, "Arrive", "Flat");
            }
        },
        "Chars Pop": {
            channels: "Text · Scale (char)", energy: "dynamic", use: "Social, hype, big numbers",
            "in": function (L, t) {
                var a = textAnimator(L, "SS Chars Pop", 1, 2);
                a.props.addProperty("ADBE Text Scale 3D").setValue([0, 0, 100]);
                a.props.addProperty("ADBE Text Opacity").setValue(0);
                return SSM.animate(a.start, t, a.from, 100, "Sweep", "Land");
            }
        },
        // Kinetic type: each word lands big, blurred and slightly tilted, one after another.
        "Words Slam": {
            channels: "Text · Scale, Blur & Rotate (word)", energy: "dynamic", use: "Punchy statements, social hooks, VO beats",
            "in": function (L, t) {
                var a = textAnimator(L, "SS Words Slam", 3, 2);
                a.props.addProperty("ADBE Text Scale 3D").setValue([170, 170, 100]);
                a.props.addProperty("ADBE Text Blur").setValue([30, 30]);
                a.props.addProperty("ADBE Text Rotation").setValue(-8);
                a.props.addProperty("ADBE Text Opacity").setValue(0);
                return SSM.animate(a.start, t, a.from, 100, "Stage", "Land");
            }
        }
    };
    // Shared text exit: fade + slight rise (Glide/Launch)
    for (var tk in TX) if (TX.hasOwnProperty(tk)) TX[tk]["out"] = P["Fade Up"]["out"];

    // ---------- Recipes: harvested behaviors → reproduced with our own keyframes/expressions ----------
    var RECIPES = (function () {
        var f = new File(SS_ROOT + "/library/recipes.json");
        if (!f.exists) return {};
        var d = SSM.readJSON(f.fsName.split("\\").join("/")), m = {};
        for (var i = 0; i < d.recipes.length; i++) m[d.recipes[i].id] = d.recipes[i];
        return m;
    })();
    var CH = { position: "ADBE Position", scale: "ADBE Scale", rotation: "ADBE Rotate Z", opacity: "ADBE Opacity",
               rotation_x: "ADBE Rotate X", rotation_y: "ADBE Rotate Y" };
    function easeOf(spec) {
        if (spec.token) { for (var i = 0; i < SSM.tokens().easings.length; i++) { var e = SSM.tokens().easings[i]; if (e.name === spec.token && e.bezier) return e.bezier; } }
        return spec.bezier;
    }
    // start value relative to the layer's rest value (does not copy the preset's absolute positions)
    function relFrom(ch, spec, rest) {
        var f = spec.from, t = spec.to, out = [], i;
        if (!(rest instanceof Array)) {
            if (ch === "opacity") return t[0] ? f[0] / t[0] * rest : f[0];
            return rest + (f[0] - t[0]);
        }
        for (i = 0; i < rest.length; i++) {
            var fi = f[i] !== undefined ? f[i] : t[i], ti = t[i] !== undefined ? t[i] : fi;
            out.push(ch === "scale" ? (ti ? fi / ti * rest[i] : fi) : rest[i] + (fi - ti));
        }
        return out;
    }
    function playPhase(L, phase, anchor, isOut) {
        var fps = L.containingComp.frameRate, minS = 1e9, maxE = 0, ch;
        for (ch in phase) if (phase.hasOwnProperty(ch)) { minS = Math.min(minS, phase[ch].start_f); maxE = Math.max(maxE, phase[ch].start_f + phase[ch].frames); }
        var base = isOut ? anchor - (maxE - minS) / fps : anchor;
        for (ch in phase) {
            if (!phase.hasOwnProperty(ch) || !CH[ch]) continue;
            var prop = T(L, CH[ch]), spec = phase[ch];
            var rest = prop.valueAtTime(REF(L), true);
            var other = relFrom(ch, spec, rest);
            var t0 = base + (spec.start_f - minS) / fps;
            if (isOut) SSM.animateBezier(prop, t0, rest, relFrom(ch, { from: spec.to, to: spec.from }, rest), spec.frames, easeOf(spec), fps);
            else SSM.animateBezier(prop, t0, other, rest, spec.frames, easeOf(spec), fps);
        }
    }
    function playLoop(L, loop) {
        var k = slider(L, "SS Recipe · Intensity %", 100);
        for (var ch in loop) {
            if (!loop.hasOwnProperty(ch) || !CH[ch]) continue;
            var o = loop[ch], parts = [];
            for (var i = 0; i < o.amp.length; i++) {
                if (!o.amp[i] || !o.freq[i]) { parts.push("0"); continue; }
                parts.push(o.style === "wiggle"
                    ? "(wiggle(" + o.freq[i] + "," + o.amp[i] + ")" + (o.amp.length > 1 ? "[" + i + "]" : "") + "-value" + (o.amp.length > 1 ? "[" + i + "]" : "") + ")"
                    : "Math.sin(time*" + o.freq[i] + "*Math.PI*2)*" + o.amp[i]);
            }
            var prop = T(L, CH[ch]), n = prop.value instanceof Array ? prop.value.length : 1;
            while (parts.length < n) parts.push("0");
            parts.length = n;
            prop.expression = "var k=" + k + "/100; value + " + (n > 1 ? "[" + parts.join(",") + "]" : parts[0]) + "*k;";
        }
    }
    return {
        presets: P,
        recipes: RECIPES,
        recipeIds: function () { var a = []; for (var k in RECIPES) if (RECIPES.hasOwnProperty(k)) a.push(k); return a; },
        applyRecipe: function (L, id, phase) {
            var r = RECIPES[id];
            if (!r) throw new Error("Recipe not found: " + id);
            phase = phase || "both";
            if (r.kind === "fx" || r.phases.loop) { playLoop(L, r.phases.loop || {}); }
            else {
                if ((phase === "in" || phase === "both") && r.phases["in"]) playPhase(L, r.phases["in"], L.inPoint, false);
                if ((phase === "out" || phase === "both") && r.phases.out) playPhase(L, r.phases.out, L.outPoint, true);
            }
            L.comment = "SS recipe: " + id + (r.name ? " (" + r.name + ")" : "");
        },
        text: TX,
        textNames: function () { var a = []; for (var k in TX) if (TX.hasOwnProperty(k)) a.push(k); return a; },
        applyText: function (L, name, phase, t0) {
            var pr = TX[name];
            if (!pr) throw new Error("Text preset not found: " + name);
            if (!isText(L)) throw new Error("Layer is not a text layer: " + L.name);
            if (phase === "in" || phase === "both") pr["in"](L, t0 === undefined ? L.inPoint : t0);
            if (phase === "out" || phase === "both") pr["out"](L, L.outPoint - SSM.seconds("Arrive"));
            L.comment = "SS text: " + name + " (" + pr.channels + ", " + pr.energy + ")";
        },
        effects: FX,
        effectNames: function () { var a = []; for (var k in FX) if (FX.hasOwnProperty(k)) a.push(k); return a; },
        applyFx: function (L, name) {
            var f = FX[name];
            if (!f) throw new Error("Effect not found: " + name);
            f.build(L);
            L.comment = (L.comment ? L.comment + " | " : "") + "SS FX: " + name;
        },
        names: function () { var a = []; for (var k in P) if (P.hasOwnProperty(k)) a.push(k); return a; },
        // Applies a preset to a layer. With phase "both", the exit ends at the layer outPoint.
        apply: function (L, name, phase, t0) {
            var pr = P[name];
            if (!pr) throw new Error("Preset not found: " + name);
            if (phase === "in" || phase === "both") pr["in"](L, t0 === undefined ? L.inPoint : t0);
            if (phase === "out" || phase === "both") {
                var dur = SSM.seconds("Arrive");
                pr["out"](L, phase === "out" && t0 !== undefined ? t0 : L.outPoint - dur);
            }
            L.comment = "SS preset: " + name + " (" + pr.channels + ", " + pr.energy + ")";
        }
    };
})();
