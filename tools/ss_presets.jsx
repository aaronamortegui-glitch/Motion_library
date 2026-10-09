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
        // Card flip on Y (turns the layer 3D).
        "Flip In": {
            channels: "Fade & Rotate Y (3D)", energy: "medium", use: "Cards, tiles, reveals, before/after",
            "in": function (L, t) {
                L.threeDLayer = true;
                var r = T(L, "ADBE Rotate Y").valueAtTime(REF(L), true);
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Blink", "Flat");
                return SSM.animate(T(L, "ADBE Rotate Y"), t, r + 90, r, "Arrive", "Land");
            },
            "out": function (L, t) {
                L.threeDLayer = true;
                var r = T(L, "ADBE Rotate Y").valueAtTime(REF(L), true);
                SSM.animate(T(L, "ADBE Opacity"), t + SSM.seconds("Blink"), opa(L), 0, "Blink", "Flat");
                return SSM.animate(T(L, "ADBE Rotate Y"), t, r, r - 90, "Glide", "Launch");
            }
        },
        "Spin Pop": {
            channels: "Fade, Scale & Rotate", energy: "dynamic", use: "Badges, stickers, stamps, icons",
            "in": function (L, t) {
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Tick", "Flat");
                SSM.animate(T(L, "ADBE Rotate Z"), t, rot(L) - 180, rot(L), "Arrive", "Settle");
                return SSM.animate(T(L, "ADBE Scale"), t, [0, 0, 100], scl(L), "Arrive", "Pop");
            },
            "out": function (L, t) {
                SSM.animate(T(L, "ADBE Rotate Z"), t, rot(L), rot(L) + 120, "Glide", "Launch");
                SSM.animate(T(L, "ADBE Opacity"), t + SSM.seconds("Tick"), opa(L), 0, "Blink", "Flat");
                return SSM.animate(T(L, "ADBE Scale"), t, scl(L), [0, 0, 100], "Glide", "Launch");
            }
        },
        // Falls in under gravity (accelerating), then two shrinking bounces.
        "Drop Bounce": {
            channels: "Fade & Position", energy: "dynamic", use: "Icons, products, emoji, playful drops",
            "in": function (L, t) {
                var p = pos(L);
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Tick", "Flat");
                return SSM.animateStops(T(L, "ADBE Position"), t, add(p, [0, -320]), [
                    { v: p, frames: 10, ease: "Launch" },
                    { v: add(p, [0, -48]), frames: 5, ease: "Settle" },
                    { v: p, frames: 5, ease: "Launch" },
                    { v: add(p, [0, -14]), frames: 3, ease: "Settle" },
                    { v: p, frames: 3, ease: "Launch" }
                ]);
            },
            "out": function (L, t) {
                var p = pos(L);
                SSM.animate(T(L, "ADBE Opacity"), t + SSM.seconds("Blink"), opa(L), 0, "Blink", "Flat");
                return SSM.animate(T(L, "ADBE Position"), t, p, add(p, [0, 360]), "Glide", "Launch");
            }
        },
        // Slides in stretched along the motion and relaxes into shape (cartoon squash & stretch).
        "Stretch Slide": {
            channels: "Fade, Position & Scale", energy: "dynamic", use: "Cards, chips, pills, fast UI moves",
            "in": function (L, t) {
                var p = pos(L), s = scl(L);
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Tick", "Flat");
                SSM.animate(T(L, "ADBE Scale"), t, [s[0] * 1.35, s[1] * 0.8, 100], s, "Arrive", "Pop");
                return SSM.animate(T(L, "ADBE Position"), t, add(p, [-420, 0]), p, "Arrive", "Land");
            },
            "out": function (L, t) {
                var p = pos(L), s = scl(L);
                SSM.animate(T(L, "ADBE Scale"), t, s, [s[0] * 1.35, s[1] * 0.8, 100], "Glide", "Launch");
                SSM.animate(T(L, "ADBE Opacity"), t + SSM.seconds("Tick"), opa(L), 0, "Blink", "Flat");
                return SSM.animate(T(L, "ADBE Position"), t, p, add(p, [420, 0]), "Glide", "Launch");
            }
        },
        // ---- Speed-ramp family (tokens Ramp, Surge, Whip): slow → burst of speed → slow ----
        "Ramp Slide": {
            channels: "Fade & Position (Ramp curve)", energy: "dynamic", use: "Transitions, product slides, bold entrances",
            "in": function (L, t) {
                var p = pos(L);
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Blink", "Flat");
                return SSM.animate(T(L, "ADBE Position"), t, add(p, [-760, 0]), p, "Stage", "Ramp");
            },
            "out": function (L, t) {
                var p = pos(L);
                SSM.animate(T(L, "ADBE Opacity"), t + SSM.seconds("Glide"), opa(L), 0, "Blink", "Flat");
                return SSM.animate(T(L, "ADBE Position"), t, p, add(p, [760, 0]), "Arrive", "Surge");
            }
        },
        "Ramp Zoom": {
            channels: "Fade & Scale (Ramp curve)", energy: "dynamic", use: "Logo reveals, hero products, end cards",
            "in": function (L, t) {
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Glide", "Flat");
                return SSM.animate(T(L, "ADBE Scale"), t, [0, 0, 100], scl(L), "Stage", "Ramp");
            },
            "out": function (L, t) {
                SSM.animate(T(L, "ADBE Opacity"), t + SSM.seconds("Glide"), opa(L), 0, "Blink", "Flat");
                return SSM.animate(T(L, "ADBE Scale"), t, scl(L), mul(scl(L), 2.2), "Arrive", "Surge");
            }
        },
        "Ramp Spin": {
            channels: "Fade, Rotate & Scale (Ramp curve)", energy: "dynamic", use: "Icons, badges, logo spins",
            "in": function (L, t) {
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Blink", "Flat");
                SSM.animate(T(L, "ADBE Scale"), t, mul(scl(L), 0.6), scl(L), "Stage", "Surge");
                return SSM.animate(T(L, "ADBE Rotate Z"), t, rot(L) - 360, rot(L), "Stage", "Ramp");
            },
            "out": function (L, t) {
                SSM.animate(T(L, "ADBE Opacity"), t + SSM.seconds("Glide"), opa(L), 0, "Blink", "Flat");
                return SSM.animate(T(L, "ADBE Rotate Z"), t, rot(L), rot(L) + 180, "Arrive", "Surge");
            }
        },
        "Whip Pan": {
            channels: "Position + motion blur (Whip curve)", energy: "dynamic", use: "Swipe transitions, camera-style moves, carousels",
            "in": function (L, t) {
                var p = pos(L);
                try { L.motionBlur = true; L.containingComp.motionBlur = true; } catch (e) {}
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Tick", "Flat");
                return SSM.animate(T(L, "ADBE Position"), t, add(p, [980, 0]), p, "Sweep", "Whip");
            },
            "out": function (L, t) {
                var p = pos(L);
                try { L.motionBlur = true; L.containingComp.motionBlur = true; } catch (e) {}
                SSM.animate(T(L, "ADBE Opacity"), t + SSM.seconds("Glide"), opa(L), 0, "Tick", "Flat");
                return SSM.animate(T(L, "ADBE Position"), t, p, add(p, [-980, 0]), "Arrive", "Whip");
            }
        },
        "Surge Rise": {
            channels: "Fade & Position (Surge curve)", energy: "medium", use: "Headlines, cards, elegant entrances",
            "in": function (L, t) {
                var p = pos(L);
                SSM.animate(T(L, "ADBE Opacity"), t, 0, opa(L), "Glide", "Flat");
                return SSM.animate(T(L, "ADBE Position"), t, add(p, [0, 140]), p, "Sweep", "Surge");
            },
            "out": function (L, t) {
                var p = pos(L);
                SSM.animate(T(L, "ADBE Opacity"), t + SSM.seconds("Blink"), opa(L), 0, "Blink", "Flat");
                return SSM.animate(T(L, "ADBE Position"), t, p, add(p, [0, -140]), "Arrive", "Surge");
            }
        },
        // Real speed ramp on footage or precomps (Time Remap): slow → fast → slow, then back to normal speed.
        "Speed Ramp": {
            channels: "Time Remap (footage / precomps)", energy: "dynamic", use: "Footage, product shots, action beats, transitions",
            "in": function (L, t) {
                if (!L.canSetTimeRemapEnabled) return t;
                L.timeRemapEnabled = true;
                var rm = L.property("ADBE Time Remapping"), dur = L.source.duration;
                var D = SSM.seconds("Stage") * 2, src0 = Math.max(0, t - L.startTime);
                var src1 = Math.min(dur, src0 + D * 2.5);            // the ramp covers 2.5x its length of footage
                var tEnd = L.outPoint, src2 = Math.min(dur, src1 + (tEnd - (t + D)));
                var keys = [[t, src0], [t + D, src1], [tEnd, src2]];
                for (var q = 0; q < keys.length; q++) rm.setValueAtTime(keys[q][0], keys[q][1]);
                for (var r = rm.numKeys; r >= 1; r--) {               // keep only our keys (AE adds its own)
                    var ours = false;
                    for (var q2 = 0; q2 < keys.length; q2++) if (Math.abs(rm.keyTime(r) - keys[q2][0]) < 0.001) ours = true;
                    if (!ours) rm.removeKey(r);
                }
                SSM.animateRaw(rm, t, t + D, src0, src1, SSM.ease("Ramp"));
                var k = rm.nearestKeyIndex(tEnd);
                rm.setInterpolationTypeAtKey(k, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
                L.outPoint = tEnd;
                return t + D;
            },
            "out": function (L, t) { return t; }
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
        "Swing": {
            channels: "Rotate", energy: "soft", use: "Hanging tags, badges, signs, pendulums",
            build: function (L) {
                var a = slider(L, "SS Swing · Angle deg", 8), f = slider(L, "SS Swing · Frequency Hz", 0.6);
                T(L, "ADBE Rotate Z").expression = "value + Math.sin(time*" + f + "*Math.PI*2)*" + a + ";";
            }
        },
        "Orbit": {
            channels: "Position", energy: "soft", use: "Dots and satellites around a logo, decorative loops",
            build: function (L) {
                var r = slider(L, "SS Orbit · Radius px", 40), f = slider(L, "SS Orbit · Turns per second", 0.25);
                T(L, "ADBE Position").expression = "var a = time*" + f + "*Math.PI*2; value + [Math.cos(a), Math.sin(a)]*" + r + ";";
            }
        },
        // Smooth camera shake (unlike Jitter's stepped jumps): good under impacts and bass hits.
        "Shake": {
            channels: "Position & Rotate", energy: "dynamic", use: "Impacts, bass hits, alarms, energetic footage",
            build: function (L) {
                var a = slider(L, "SS Shake · Amplitude px", 10), f = slider(L, "SS Shake · Frequency Hz", 12);
                T(L, "ADBE Position").expression = "wiggle(" + f + ", " + a + ");";
                T(L, "ADBE Rotate Z").expression = "wiggle(" + f + ", " + a + "/8);";
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
    // Source Text expression that decodes (in) and/or encodes (out) the text with random glyphs.
    // In/out times live on the first line so a later phase can update them.
    function scramble(L, phase, t, d) {
        var st = L.property("ADBE Text Properties").property("ADBE Text Document");
        var m = /^var tin=([-\d.]+), din=([-\d.]+), tout=([-\d.]+), dout=([-\d.]+);/.exec(st.expression || "");
        var tin = m ? +m[1] : -1, din = m ? +m[2] : 1, tout = m ? +m[3] : 1e6, dout = m ? +m[4] : 1;
        if (phase === "in") { tin = t; din = d; } else { tout = t; dout = d; }
        st.expression = "var tin=" + tin + ", din=" + din + ", tout=" + tout + ", dout=" + dout + ";\n" +
            "var s = String(value), g = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*/<>';\n" +
            "var p = Math.min(clamp((time - tin) / din, 0, 1), 1 - clamp((time - tout) / dout, 0, 1));\n" +
            "var n = Math.floor(p * s.length); seedRandom(Math.floor(time * 24), true);\n" +
            "var o = s.substr(0, n); for (var i = n; i < s.length; i++) o += (s.charAt(i) === ' ' || p <= 0) ? (p <= 0 ? '' : ' ') : g.charAt(Math.floor(random(g.length)));\n" +
            "o;";
        return t + d;
    }
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
        // Characters appear one by one, hard cut (no ramp), ~2 frames per character.
        "Typewriter": {
            channels: "Text · Opacity (char, stepped)", energy: "medium", use: "Captions, terminals, UI, quotes",
            "in": function (L, t) {
                var a = textAnimator(L, "SS Typewriter", 1, 1);   // shape 1 = square: no soft edge
                a.props.addProperty("ADBE Text Opacity").setValue(0);
                a.sel.property("ADBE Text Percent End").setValue(100);
                a.start.setValue(0);
                var n = String(L.property("ADBE Text Properties").property("ADBE Text Document").value.text).length;
                return SSM.animateStops(a.sel.property("ADBE Text Percent Start"), t, 0, [{ v: 100, frames: Math.max(8, n * 2), ease: "Flat" }]);
            }
        },
        // Decodes from random characters, left to right (Source Text expression; style is kept).
        "Scramble": {
            channels: "Text · Source Text (decode)", energy: "dynamic", use: "Tech, data, HUD labels, reveals",
            "in": function (L, t) { return scramble(L, "in", t, SSM.seconds("Stage")); }
        },
        // Counts a number up from 0 to the value in the text, keeping prefix, suffix, separators and decimals.
        "Count Up": {
            channels: "Text · Source Text (number)", energy: "medium", use: "Stats, KPIs, prices, counters",
            "in": function (L, t) {
                var d = SSM.seconds("Stage") * 1.5;
                L.property("ADBE Text Properties").property("ADBE Text Document").expression =
                    "var s = String(value), m = s.match(/[\\d][\\d,.]*/);\n" +
                    "if (!m) s; else {\n" +
                    "  var raw = m[0], comma = raw.indexOf(',') >= 0, dec = (raw.split('.')[1] || '').length;\n" +
                    "  var n = parseFloat(raw.replace(/,/g, '')), v = easeOut(time, " + t + ", " + (t + d) + ", 0, n);\n" +
                    "  var f = v.toFixed(dec).split('.');\n" +
                    "  if (comma) f[0] = f[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');\n" +
                    "  s.replace(raw, f.join('.'));\n}";
                return t + d;
            }
        },
        // Characters reveal on the Ramp curve: a slow start, a rush through the middle, a slow landing.
        "Chars Ramp": {
            channels: "Text · Position & Fade (char, Ramp curve)", energy: "medium", use: "Titles that build tension, trailers, reveals",
            "in": function (L, t) {
                var a = textAnimator(L, "SS Chars Ramp", 1, 2);
                a.props.addProperty("ADBE Text Position 3D").setValue([0, 70, 0]);
                a.props.addProperty("ADBE Text Opacity").setValue(0);
                return SSM.animate(a.start, t, a.from, 100, "Stage", "Ramp");
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
    TX["Scramble"]["out"] = function (L, t) { return scramble(L, "out", t, SSM.seconds("Arrive")); };

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
    // ---------- Classic presets: animate.css 4.1.1 (MIT) keyframes → native AE keyframes ----------
    // library/css_presets.json: stops {p (0–1), tx/ty px, txp/typ % of the layer box, s/sx/sy scale factor, r deg,
    // rx deg (3D), skx deg (Transform effect skew), o opacity factor, e cubic-bezier of the segment that starts here}.
    function bezAE(bz) {
        var x1 = bz[0], y1 = bz[1], x2 = bz[2], y2 = bz[3];
        return { out: { influence: Math.max(x1 * 100, 0.1), speed_x_avg: x1 > 0 ? y1 / x1 : 0 },
                 "in": { influence: Math.max((1 - x2) * 100, 0.1), speed_x_avg: x2 < 1 ? (1 - y2) / (1 - x2) : 0 } };
    }
    function skewProp(L) {
        var fx = L.property("ADBE Effect Parade"), e = fx.property("SS Skew") || fx.addProperty("ADBE Geometry2");
        e.name = "SS Skew";
        return e.property("ADBE Geometry2-0006");   // Skew
    }
    function playCss(L, def, t0, reverse) {
        var dur = def.dur, R = L.sourceRectAtTime(REF(L), false), bw = R.width || 100, bh = R.height || 100;
        var stops = def.stops.slice(0);
        if (reverse) {   // mirror in time: p → 1 − p, each segment's bezier reversed
            var rv = [];
            for (var i = stops.length - 1; i >= 0; i--) {
                var c = {}, k;
                for (k in stops[i]) if (stops[i].hasOwnProperty(k)) c[k] = stops[i][k];
                c.p = 1 - stops[i].p;
                var prevE = i > 0 ? (stops[i - 1].e || def.ease) : def.ease;
                c.e = [1 - prevE[2], 1 - prevE[3], 1 - prevE[0], 1 - prevE[1]];
                rv.push(c);
            }
            stops = rv;
        }
        var p0 = pos(L), s0 = scl(L), r0 = rot(L), o0 = opa(L);
        function chain(prop, fn, has) {   // keys only on stops that define this channel
            var pts = [];
            for (var i = 0; i < stops.length; i++) if (has(stops[i])) pts.push(stops[i]);
            if (pts.length < 2) return;
            for (var j = 0; j < pts.length - 1; j++)
                SSM.animateRaw(prop, t0 + pts[j].p * dur, t0 + pts[j + 1].p * dur, fn(pts[j]), fn(pts[j + 1]), bezAE(pts[j].e || def.ease));
        }
        function tf(st) { return st.tx !== undefined || st.ty !== undefined || st.txp !== undefined || st.typ !== undefined; }
        function sc(st) { return st.s !== undefined || st.sx !== undefined || st.sy !== undefined; }
        var hasT = false;
        for (var qt = 0; qt < stops.length; qt++) if (tf(stops[qt])) hasT = true;
        if (hasT) chain(T(L, "ADBE Position"), function (st) {
            var dx = (st.tx || 0) + (st.txp || 0) / 100 * bw, dy = (st.ty || 0) + (st.typ || 0) / 100 * bh;
            return add(p0, [dx, dy]);
        }, function (st) { return tf(st) || st.p === 0 || st.p === 1; });
        chain(T(L, "ADBE Scale"), function (st) {
            var k = st.s !== undefined ? st.s : 1;
            return [s0[0] * (st.sx !== undefined ? st.sx : k), s0[1] * (st.sy !== undefined ? st.sy : k), 100];
        }, function (st) { return sc(st); });
        var hasS = false, hasR = false, hasO = false, hasRX = false, hasK = false;
        for (var q = 0; q < stops.length; q++) {
            if (sc(stops[q])) hasS = true; if (stops[q].r !== undefined) hasR = true; if (stops[q].o !== undefined) hasO = true;
            if (stops[q].rx !== undefined) hasRX = true; if (stops[q].skx !== undefined) hasK = true;
        }
        if (hasR) chain(T(L, "ADBE Rotate Z"), function (st) { return r0 + (st.r || 0); }, function (st) { return st.r !== undefined || st.p === 0 || st.p === 1; });
        if (hasO) chain(T(L, "ADBE Opacity"), function (st) { return o0 * st.o; }, function (st) { return st.o !== undefined; });
        if (hasRX) { L.threeDLayer = true; chain(T(L, "ADBE Rotate X"), function (st) { return st.rx || 0; }, function (st) { return st.rx !== undefined || st.p === 1; }); }
        if (hasK) chain(skewProp(L), function (st) { return st.skx || 0; }, function (st) { return true; });
        return t0 + dur;
    }
    var CLASSIC = (function () {
        var f = new File(SS_ROOT + "/library/css_presets.json"), m = {};
        if (!f.exists) return m;
        var d = SSM.readJSON(f.fsName.split("\\").join("/"));
        for (var i = 0; i < d.presets.length; i++) (function (def) {
            var ch = [];
            for (var j = 0; j < def.stops.length; j++) for (var k in def.stops[j]) if (def.stops[j].hasOwnProperty(k) && k !== "p" && k !== "e") ch.push(k);
            var label = (/(^|,)(tx|ty|txp|typ)(,|$)/.test(ch.join(",")) ? "Position · " : "") + (/(^|,)(s|sx|sy)(,|$)/.test(ch.join(",")) ? "Scale · " : "") +
                        (/(^|,)r(,|$)/.test(ch.join(",")) ? "Rotate · " : "") + (/rx/.test(ch.join(",")) ? "Rotate X (3D) · " : "") +
                        (/skx/.test(ch.join(",")) ? "Skew · " : "") + (/(^|,)o(,|$)/.test(ch.join(",")) ? "Fade · " : "");
            m[def.name] = {
                channels: label.replace(/ · $/, ""), energy: def.energy, use: def.use + " (" + def.role + ")", family: "classic", role: def.role,
                "in": function (L, t) { return playCss(L, def, t, def.role === "exit"); },
                "out": function (L, t) {
                    var t1 = L.outPoint - def.dur;
                    return playCss(L, def, Math.min(t, t1), def.role === "enter");
                }
            };
        })(d.presets[i]);
        return m;
    })();
    for (var cn in CLASSIC) if (CLASSIC.hasOwnProperty(cn) && !P[cn]) P[cn] = CLASSIC[cn];

    // ---------- Marker-driven timing ----------
    // With SSP.markerTiming = true (the panel turns it on), apply() records the keyframes each phase creates, drops
    // "SS in" / "SS out" layer markers where the entrance ends and the exit starts, and adds an expression to every
    // animated property that remaps time from those markers: drag a marker and the animation (and its curve) stretches.
    var TAG = "// SS marker timing";
    function walkKeys(L) {
        var map = {};
        (function walk(g, path) {
            for (var i = 1; i <= g.numProperties; i++) {
                var pr = g.property(i);
                if (!pr || pr.matchName === "ADBE Marker" || pr.matchName === "ADBE Time Remapping") continue;
                var ph = path + "/" + i;
                if (pr.propertyType === PropertyType.PROPERTY) {
                    if (pr.numKeys > 0) { var ts = []; for (var k = 1; k <= pr.numKeys; k++) ts.push(pr.keyTime(k)); map[ph] = { prop: pr, t: ts }; }
                } else if (pr.numProperties) walk(pr, ph);
            }
        })(L, "");
        return map;
    }
    function diffKeys(before, after) {   // → { span: [min, max] of new key times, paths: [...] }
        var lo = 1e9, hi = -1e9, paths = [];
        for (var ph in after) {
            if (!after.hasOwnProperty(ph)) continue;
            var old = before[ph] ? before[ph].t : [], nu = false;
            for (var i = 0; i < after[ph].t.length; i++) {
                var t = after[ph].t[i], seen = false;
                for (var j = 0; j < old.length; j++) if (Math.abs(old[j] - t) < 1e-4) { seen = true; break; }
                if (!seen) { nu = true; lo = Math.min(lo, t); hi = Math.max(hi, t); }
            }
            if (nu) paths.push(ph);
        }
        return paths.length ? { span: [lo, hi], paths: paths } : null;
    }
    function setMarker(L, label, t) {
        var M = L.property("ADBE Marker");
        for (var i = M.numKeys; i >= 1; i--) if (M.keyValue(i).comment === label) M.removeKey(i);
        M.setValueAtTime(t, new MarkerValue(label));
    }
    function markerExpr(A, B, C, D) {
        return TAG + "\nvar A=" + A + ", B=" + B + ", C=" + C + ", D=" + D + ";\n" +
            "var st=thisLayer.startTime, lt=time-st, mi=B, mo=C, M=thisLayer.marker;\n" +
            "for (var i=1;i<=M.numKeys;i++){ var k=M.key(i); if (k.comment==\"SS in\") mi=k.time-st; else if (k.comment==\"SS out\") mo=k.time-st; }\n" +
            "var u=lt;\n" +
            "if (A>=0 && lt<mi) u = lt<=A ? lt : A+(lt-A)*(B-A)/Math.max(mi-A,0.001);\n" +
            "else if (C>=0 && lt>mo) u = lt>=D ? lt : C+(lt-mo)*(D-C)/Math.max(D-mo,0.001);\n" +
            "else if (A>=0 && C>=0) u = B+(lt-mi)*(C-B)/Math.max(mo-mi,0.001);\n" +
            "else if (A>=0) u = B+(lt-mi);\n" +
            "else if (C>=0) u = C-(mo-lt);\n" +
            "valueAtTime(u+st);";
    }
    // ---------- Tuning (the panel's Intensity / Direction / Easing controls; Duration is SSM.speed) ----------
    // After a phase runs, its new keyframes are reshaped: every value is pulled toward (or pushed away from) the rest
    // value by `intensity`, position/rotation offsets can be mirrored, and each new segment can be re-eased with
    // any token curve. Opacity, text and markers are never scaled.
    function tuned() { var t = SSP_STATE.tune; return t && (t.intensity !== 1 || t.flipX || t.flipY || t.ease); }
    function retune(L, d, phase) {
        if (!d) return;
        var t = SSP_STATE.tune, all = walkKeys(L);
        for (var i = 0; i < d.paths.length; i++) {
            var rec = all[d.paths[i]]; if (!rec) continue;
            var pr = rec.prop, mn = pr.matchName, ks = [];
            for (var k = 1; k <= pr.numKeys; k++) { var kt = pr.keyTime(k); if (kt >= d.span[0] - 1e-4 && kt <= d.span[1] + 1e-4) ks.push(k); }
            if (ks.length < 2) continue;
            var scaleIt = !/Opacity|Text Document|Marker|Time Remap/.test(mn) && pr.propertyValueType !== PropertyValueType.NO_VALUE &&
                          pr.propertyValueType !== PropertyValueType.CUSTOM_VALUE && pr.propertyValueType !== PropertyValueType.SHAPE;
            if (scaleIt && (t.intensity !== 1 || t.flipX || t.flipY)) {
                var rest = pr.keyValue(phase === "out" ? ks[0] : ks[ks.length - 1]);
                var isPos = /Position/.test(mn) && !/Anchor/.test(mn), isRot = /Rotate|Rotation/.test(mn);
                for (var j = 0; j < ks.length; j++) {
                    var v = pr.keyValue(ks[j]), nv;
                    if (v instanceof Array) {
                        nv = [];
                        for (var c = 0; c < v.length; c++) {
                            var dlt = (v[c] - rest[c]) * t.intensity;
                            if (isPos && ((c === 0 && t.flipX) || (c === 1 && t.flipY))) dlt = -dlt;
                            nv.push(rest[c] + dlt);
                        }
                    } else {
                        var dl = (v - rest) * t.intensity;
                        if (isRot && t.flipX) dl = -dl;
                        if (mn === "ADBE Position_0" && t.flipX) dl = -dl;
                        if (mn === "ADBE Position_1" && t.flipY) dl = -dl;
                        nv = rest + dl;
                    }
                    pr.setValueAtKey(ks[j], nv);
                }
            }
            if (t.ease) for (var e = 0; e < ks.length - 1; e++) SSM.easeSegment(pr, ks[e], t.ease);
        }
    }
    function withMarkers(L, phase, runIn, runOut) {
        if (!SSP_STATE.markerTiming && !tuned()) { if (runIn) runIn(); if (runOut) runOut(); return; }
        var st = L.startTime, k0 = walkKeys(L), dIn = null, dOut = null;
        if (runIn) { runIn(); var k1 = walkKeys(L); dIn = diffKeys(k0, k1); k0 = k1; }
        if (runOut) { runOut(); dOut = diffKeys(k0, walkKeys(L)); }
        if (tuned()) { retune(L, dIn, "in"); retune(L, dOut, "out"); }
        if (!SSP_STATE.markerTiming) return;
        if (!dIn && !dOut) return;
        var all = walkKeys(L), paths = {}, i;
        if (dIn) for (i = 0; i < dIn.paths.length; i++) paths[dIn.paths[i]] = 1;
        if (dOut) for (i = 0; i < dOut.paths.length; i++) paths[dOut.paths[i]] = 1;
        for (var ph in paths) {
            if (!paths.hasOwnProperty(ph) || !all[ph]) continue;
            var pr = all[ph].prop;
            if (!pr.canSetExpression) continue;
            var ex = pr.expression || "";
            if (ex && ex.indexOf(TAG) !== 0) continue;   // never overwrite someone else's expression
            var m = /var A=([-\d.e]+), B=([-\d.e]+), C=([-\d.e]+), D=([-\d.e]+);/.exec(ex);
            var A = m ? +m[1] : -1, B = m ? +m[2] : -1, C = m ? +m[3] : -1, D = m ? +m[4] : -1;
            if (dIn) { A = dIn.span[0] - st; B = dIn.span[1] - st; }
            if (dOut) { C = dOut.span[0] - st; D = dOut.span[1] - st; }
            pr.expression = markerExpr(A, B, C, D);
        }
        if (dIn) setMarker(L, "SS in", dIn.span[1]);
        if (dOut) setMarker(L, "SS out", dOut.span[0]);
    }
    var SSP_STATE = { markerTiming: false, tune: { intensity: 1, flipX: false, flipY: false, ease: null } };

    // ---------- Packs: one button gives a whole comp a look (library/packs.json) ----------
    var PACKS = (function () {
        var f = new File(SS_ROOT + "/library/packs.json");
        return f.exists ? SSM.readJSON(f.fsName.split("\\").join("/")) : { packs: [] };
    })();
    function roleOf(L, comp, maxText) {
        if (!(L instanceof AVLayer) && !(L instanceof TextLayer) && !(L instanceof ShapeLayer)) return null;
        if (L.adjustmentLayer || L.guideLayer || L.nullLayer || !L.enabled || L.locked) return null;
        if (L instanceof AVLayer && !(L instanceof TextLayer) && !(L instanceof ShapeLayer) && !L.hasVideo) return null;
        if (/logo|brand|mark/i.test(L.name)) return "logo";
        if (L instanceof TextLayer) {
            var sz = L.property("ADBE Text Properties").property("ADBE Text Document").value.fontSize;
            // explicit ifs: ExtendScript mis-evaluates this as a chained ternary
            if (sz >= maxText * 0.85) return "title";
            if (sz >= maxText * 0.45) return "subtitle";
            return "body";
        }
        if (L instanceof ShapeLayer) return "shape";
        var r = L.sourceRectAtTime(L.inPoint, false), sc = L.property("ADBE Transform Group").property("ADBE Scale").value;
        if (r.width * sc[0] / 100 >= comp.width * 0.98 && r.height * sc[1] / 100 >= comp.height * 0.98) return null;   // full-frame backgrounds stay still
        return "media";
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
            var doIn = phase === "in" || phase === "both", doOut = phase === "out" || phase === "both";
            withMarkers(L, phase,
                doIn ? function () { pr["in"](L, t0 === undefined ? L.inPoint : t0); } : null,
                doOut ? function () { pr["out"](L, L.outPoint - SSM.seconds("Arrive")); } : null);
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
            var doIn = phase === "in" || phase === "both", doOut = phase === "out" || phase === "both";
            withMarkers(L, phase,
                doIn ? function () { pr["in"](L, t0 === undefined ? L.inPoint : t0); } : null,
                doOut ? function () { pr["out"](L, phase === "out" && t0 !== undefined ? t0 : L.outPoint - SSM.seconds("Arrive")); } : null);
            L.comment = "SS preset: " + name + " (" + pr.channels + ", " + pr.energy + ")";
        },
        // Tuning for the next apply() calls: { speed, intensity, flipX, flipY, ease } (ease = token name or null).
        // SSP.tune() resets to defaults. Used by the panel and the MCP server.
        tune: function (o) {
            o = o || {};
            SSM.speed = o.speed || 1;
            SSP_STATE.tune = { intensity: o.intensity === undefined ? 1 : o.intensity, flipX: !!o.flipX, flipY: !!o.flipY, ease: o.ease || null };
            return SSP_STATE.tune;
        },
        // Removes what Motion DNA added to a layer: keyframes and our expressions on its animated properties (the value
        // at the rest time stays), the SS in / SS out markers, our text animators and SS-named effects.
        remove: function (L) {
            var rest = L.inPoint + (L.outPoint - L.inPoint) / 2, M = L.property("ADBE Marker"), i;
            for (i = M.numKeys; i >= 1; i--) { var cm = M.keyValue(i).comment; if (cm === "SS in" || cm === "SS out") { if (cm === "SS in") rest = Math.max(rest, M.keyTime(i)); M.removeKey(i); } }
            var ours = /SS (preset|FX|recipe)|Motion DNA/.test(L.comment || ""), n = 0;
            (function walk(g) {
                for (var j = g.numProperties; j >= 1; j--) {
                    var pr = g.property(j);
                    if (!pr || pr.matchName === "ADBE Marker") continue;
                    if (pr.propertyType === PropertyType.PROPERTY) {
                        if (pr.canSetExpression && pr.expression && (pr.expression.indexOf(TAG) === 0 || ours)) { pr.expression = ""; n++; }
                        if (pr.numKeys > 0 && pr.matchName !== "ADBE Time Remapping") {
                            var v = pr.valueAtTime(rest, true);
                            while (pr.numKeys) pr.removeKey(1);
                            try { pr.setValue(v); } catch (e) {}
                            n++;
                        }
                    } else if (pr.numProperties) walk(pr);
                }
            })(L);
            var an = L.property("ADBE Text Properties") && L.property("ADBE Text Properties").property("ADBE Text Animators");
            if (an) for (i = an.numProperties; i >= 1; i--) if (/^SS /.test(an.property(i).name)) { an.property(i).remove(); n++; }
            var fx = L.property("ADBE Effect Parade");
            if (fx) for (i = fx.numProperties; i >= 1; i--) if (/^SS /.test(fx.property(i).name)) { fx.property(i).remove(); n++; }
            if (ours) L.comment = "";
            return n;
        },
        // marker-driven timing on/off (off by default so scripted builds stay plain keyframes)
        markerTiming: function (on) { if (on !== undefined) SSP_STATE.markerTiming = !!on; return SSP_STATE.markerTiming; },
        classicNames: function () { var a = []; for (var k in P) if (P.hasOwnProperty(k) && P[k].family === "classic") a.push(k); return a; },
        packs: function () { return PACKS.packs; },
        // Applies a pack (library/packs.json) to the given layers (default: every layer of the comp): each layer gets
        // the preset of its role (title, subtitle, body, shape, media, logo), staggered in stacking order.
        applyPack: function (comp, packName, layers, phase) {
            var pk = null;
            for (var i = 0; i < PACKS.packs.length; i++) if (PACKS.packs[i].name === packName) pk = PACKS.packs[i];
            if (!pk) throw new Error("Pack not found: " + packName);
            var ls = [];
            if (layers && layers.length) for (var a = 0; a < layers.length; a++) ls.push(layers[a]);
            else for (var b = comp.numLayers; b >= 1; b--) ls.push(comp.layer(b));   // bottom-up: backgrounds first
            var maxText = 0;
            for (var c = 0; c < ls.length; c++) if (ls[c] instanceof TextLayer) maxText = Math.max(maxText, ls[c].property("ADBE Text Properties").property("ADBE Text Document").value.fontSize);
            var order = pk.order || ["media", "shape", "logo", "title", "subtitle", "body"], applied = [], st = (pk.stagger || 3) * comp.frameDuration, n = 0;
            for (var o = 0; o < order.length; o++) {
                for (var d = 0; d < ls.length; d++) {
                    var L = ls[d], role = roleOf(L, comp, maxText);
                    if (role !== order[o]) continue;
                    var r = pk.roles[role];
                    if (!r) continue;
                    var t0 = L.inPoint + (pk.delay || 0) + n * st;
                    if (r.text && L instanceof TextLayer) this.applyText(L, r.text, phase || pk.phase || "both", t0);
                    else if (r.motion) this.apply(L, r.motion, phase || pk.phase || "both", t0);
                    if (r.fx) this.applyFx(L, r.fx);
                    applied.push(L.name + " → " + role + ": " + (r.text && L instanceof TextLayer ? r.text : r.motion || "") + (r.fx ? " + " + r.fx : ""));
                    n++;
                }
            }
            return applied;
        }
    };
})();
