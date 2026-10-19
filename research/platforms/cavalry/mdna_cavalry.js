// Motion DNA for Cavalry (beta): applies the portable presets (research/platforms/portable_presets.json) to layers,
// with the token curves as exact bezier handles (api.modifyKeyframeTangent takes absolute handle tips, the same cubic
// bezier as the tokens). Runs in Cavalry's JavaScript Editor or through Cavalry's MCP server (execute_script):
//   api.load("<repo>/research/platforms/cavalry/mdna_cavalry.js");
//   MDNA.init("<repo>");                                   // reads the tokens and the recipes
//   MDNA.apply(layerId, "Fade Up", "in", 0);               // returns the end frame
//   MDNA.applyMany(["rectangle#1", "textShape#1"], "Scale Pop", "in", 0, 4);   // a stagger of 4 frames
// Screen conventions: Cavalry's y is up (After Effects' is down), rotation is counter-clockwise, opacity is 0-100.
var MDNA = (function () {
    var EASE = {}, RECIPES = null, FPS_SRC = 30;

    function init(root) {
        var t = JSON.parse(api.readFromFile(root + "/tokens/superside_motion_tokens.json"));
        for (var i = 0; i < t.easings.length; i++) EASE[t.easings[i].name] = t.easings[i].bezier;
        RECIPES = JSON.parse(api.readFromFile(root + "/research/platforms/portable_presets.json"));
        FPS_SRC = RECIPES.fps || 30;
        return RECIPES.portable.length + " portable presets";
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
    return { init: init, apply: apply, applyMany: applyMany, list: list, ease: function (n) { return EASE[n]; } };
})();
