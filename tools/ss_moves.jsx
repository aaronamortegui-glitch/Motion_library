// SS Moves — parametric 2D/3D entrances and exits for any layer (behavior modelled on Animation Composer's 3D
// Transitions and Scale-from-edge families, rebuilt from scratch). Every move is keyed with Motion DNA token curves
// (SSM.animate), so duration and ease come from the tokens and Pop/Nudge overshoot or Wind-up anticipation carry over.
//
// Usage: #include "ss_presets.jsx" (SSM, SSK) then #include "ss_moves.jsx"
//        SSMV.apply(layer, "hinge", "in", 1.0, {edge: "left", direction: "forward"});
//        SSMV.apply(layer, "flip", "out", 3.0, {axis: "y"});
// Moves: flip (card turn on the anchor, axis x|y) · hinge (door on an edge: left|right|top|bottom, forward|backward)
//        orbit (swings in around a distant pivot, from behind|front) · fly (Z fly-in: near|far) · tumble (fly + turn)
//        grow_edge (scales from an edge: uniform or one axis) · squash (one-axis bounce: x|y)
// Options: dur (duration token), ease (curve token), fade (true: also fades), distance (orbit/fly, px), angle (deg)
var SSMV = (function () {
    function T(L) { return L.property("ADBE Transform Group"); }
    function ref(L, phase, t) { return phase === "in" ? t + 5 : t - 0.001; }   // rest values: after an entrance, before an exit
    // in: from → rest with the "in" curve; out: rest → to with the "out" curve
    function key(prop, phase, t, from, rest, o, dIn, eIn, dOut, eOut) {
        if (phase === "in") return SSM.animate(prop, t, from, rest, o.dur || dIn, o.ease || eIn);
        return SSM.animate(prop, t, rest, from, o.dur || dOut, o.ease || eOut);
    }
    function fade(L, phase, t, o) {
        if (o.fade === false) return;
        var op = T(L).property("ADBE Opacity"), v = op.valueAtTime(ref(L, phase, t), false);
        if (phase === "in") SSM.animate(op, t, 0, v, "Glide", "Flat"); else SSM.animate(op, t + SSM.seconds(o.dur || "Sweep") * 0.6, v, 0, "Glide", "Flat");
    }
    function anchorTo(L, where, t) {
        if (typeof SSK !== "undefined") { try { SSK.anchor(L, where, t); return; } catch (e) {} }
    }
    var EDGE = { left: ["left", "ADBE Rotate Y", -1], right: ["right", "ADBE Rotate Y", 1], top: ["top", "ADBE Rotate X", 1], bottom: ["bottom", "ADBE Rotate X", -1] };

    var MOVES = {
        flip: function (L, phase, t, o) {
            L.threeDLayer = true;
            var p = T(L).property(o.axis === "x" ? "ADBE Rotate X" : "ADBE Rotate Y"), rest = p.valueAtTime(ref(L, phase, t), false);
            key(p, phase, t, rest + (o.angle || 90) * (o.reverse ? -1 : 1), rest, o, "Sweep", "Nudge", "Arrive", "Launch");
            fade(L, phase, t, o);
        },
        hinge: function (L, phase, t, o) {
            L.threeDLayer = true;
            var e = EDGE[o.edge || "left"]; anchorTo(L, e[0], ref(L, phase, t));
            var p = T(L).property(e[1]), rest = p.valueAtTime(ref(L, phase, t), false), dir = o.direction === "backward" ? -1 : 1;
            key(p, phase, t, rest + e[2] * dir * (o.angle || 95), rest, o, "Sweep", "Pop", "Arrive", "Launch");
            fade(L, phase, t, o);
        },
        orbit: function (L, phase, t, o) {
            // a null at a distance behind (or in front of) the layer becomes its pivot; the null turns, the layer swings
            L.threeDLayer = true;
            var comp = L.containingComp, d = o.distance || 900, side = o.from === "front" ? -1 : 1;
            var N = comp.layers.addNull(); N.threeDLayer = true; N.name = "MV pivot · " + L.name; N.enabled = false; N.shy = true;
            var lp = T(L).property("ADBE Position").valueAtTime(ref(L, phase, t), false);
            T(N).property("ADBE Position").setValue([lp[0], lp[1], (lp[2] || 0) + d * side]);
            if (L.parent !== null) N.parent = L.parent;
            L.parent = N;   // compensated: the layer keeps its place; it swings when the pivot turns
            key(T(N).property("ADBE Rotate Y"), phase, t, (o.angle || 55) * (o.reverse ? -1 : 1), 0, o, "Stage", "Nudge", "Sweep", "Launch");
            N.moveAfter(L);
            fade(L, phase, t, o);
        },
        fly: function (L, phase, t, o) {
            L.threeDLayer = true;
            var p = T(L).property("ADBE Position"), rest = p.valueAtTime(ref(L, phase, t), false), z = (o.distance || 1600) * (o.from === "near" ? -0.6 : 1);
            var from = [rest[0], rest[1], (rest[2] || 0) + z];
            key(p, phase, t, from, [rest[0], rest[1], rest[2] || 0], o, "Sweep", "Land", "Arrive", "Launch");
            fade(L, phase, t, o);
        },
        tumble: function (L, phase, t, o) {
            MOVES.fly(L, phase, t, { dur: o.dur, ease: o.ease, distance: o.distance || 1200, from: o.from, fade: false });
            var rx = T(L).property("ADBE Rotate X"), ry = T(L).property("ADBE Rotate Y");
            var a = o.angle || 70;
            key(rx, phase, t, rx.valueAtTime(ref(L, phase, t), false) + a, rx.valueAtTime(ref(L, phase, t), false), o, "Sweep", "Nudge", "Arrive", "Launch");
            key(ry, phase, t, ry.valueAtTime(ref(L, phase, t), false) - a * 0.6, ry.valueAtTime(ref(L, phase, t), false), o, "Sweep", "Nudge", "Arrive", "Launch");
            fade(L, phase, t, o);
        },
        grow_edge: function (L, phase, t, o) {
            var edge = o.edge || "left"; anchorTo(L, edge, ref(L, phase, t));
            var s = T(L).property("ADBE Scale"), rest = s.valueAtTime(ref(L, phase, t), false), from = rest.slice(0);
            var horiz = edge === "left" || edge === "right";
            if (o.uniform) { from[0] = 0; from[1] = 0; } else if (horiz) from[0] = 0; else from[1] = 0;
            key(s, phase, t, from, rest, o, "Sweep", "Surge", "Arrive", "Launch");
            if (o.fade) fade(L, phase, t, o);
        },
        squash: function (L, phase, t, o) {
            var s = T(L).property("ADBE Scale"), rest = s.valueAtTime(ref(L, phase, t), false), from = rest.slice(0);
            if (o.axis === "y") from[1] = 0; else from[0] = 0;
            key(s, phase, t, from, rest, o, "Arrive", "Pop", "Glide", "Launch");
            if (o.fade) fade(L, phase, t, o);
        }
    };

    function apply(L, move, phase, t, o) {
        o = o || {};
        if (!MOVES[move]) throw new Error("Unknown move: " + move + " (" + names().join(", ") + ")");
        phase = phase || "in";
        if (t === undefined || t === null) t = phase === "in" ? L.inPoint : L.outPoint - SSM.seconds(o.dur || "Arrive");
        if (phase === "both") { MOVES[move](L, "in", L.inPoint, o); MOVES[move](L, "out", L.outPoint - SSM.seconds(o.dur || "Arrive"), o); }
        else MOVES[move](L, phase, t, o);
        L.comment = (L.comment ? L.comment + " | " : "") + "SS move: " + move + " (" + phase + ")";
        return L.name + ": " + move + " " + phase;
    }
    function names() { var a = []; for (var k in MOVES) if (MOVES.hasOwnProperty(k)) a.push(k); return a; }
    return { apply: apply, moves: names() };
})();
