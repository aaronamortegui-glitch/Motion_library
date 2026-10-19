// Shared helpers for the Cavalry capability tests (research/platforms/cavalry/tests/).
// Load first: api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
// T.stage()   adds a full-frame backdrop (on top of whatever the user already has) and returns its id.
// T.ease(n)   Motion DNA token bezier by name (reads tokens/superside_motion_tokens.json).
// T.key(...)  two keys with the token curve as absolute bezier handles (same maths as mdna_cavalry.js key()).
// T.front()   brings the test layers above the user's layers before a comp snapshot.
// T.cleanup() deletes every layer that is not in the baseline list (the user's scene before the tests).
var T = (function () {
    var ROOT = "D:/motion category ai library";
    var BASE = ["compNode#1", "textShape#4", "basicShape#45", "basicShape#47", "textShape#5", "basicShape#48", "basicShape#46"];
    var EASE = null;
    function ease(n) {
        if (!EASE) { EASE = {}; var t = JSON.parse(api.readFromFile(ROOT + "/tokens/superside_motion_tokens.json"));
            for (var i = 0; i < t.easings.length; i++) EASE[t.easings[i].name] = t.easings[i].bezier; }
        return EASE[n] || [0, 0, 1, 1];
    }
    function key(id, attr, f0, v0, f1, v1, bz) {
        if (typeof bz === "string") bz = ease(bz);
        var a = {}; a[attr] = v0; api.keyframe(id, f0, a);
        var b = {}; b[attr] = v1; api.keyframe(id, f1, b);
        var dt = f1 - f0, dv = v1 - v0, o = {}, i = {};
        o[attr] = { frame: f0, outHandle: true, inHandle: false, angleLocked: false, weightLocked: false, xValue: f0 + bz[0] * dt, yValue: v0 + bz[1] * dv };
        api.modifyKeyframeTangent(id, o);
        i[attr] = { frame: f1, inHandle: true, outHandle: false, angleLocked: false, weightLocked: false, xValue: f0 + bz[2] * dt, yValue: v0 + bz[3] * dv };
        api.modifyKeyframeTangent(id, i);
    }
    function rect(name, w, h, color, x, y) {
        var r = api.primitive("rectangle", name);
        api.set(r, { "generator.dimensions": [w, h], "material.materialColor": color, position: [x || 0, y || 0] });
        return r;
    }
    function stage() { return rect("T_stage", 2400, 2400, "#14171c"); }
    function text(name, str, size, color, x, y) {
        var t = api.create("textShape", name);
        api.set(t, { text: str, fontSize: size || 120, autoWidth: true, autoHeight: true, textBoxSize: [1, 1],
            horizontalAlignment: 1, verticalAlignment: 1, "material.materialColor": color || "#f2f2f2", position: [x || 0, y || 0] });
        try { api.set(t, { "font.font": "Inter Tight", "font.style": "Bold" }); } catch (e) {}
        return t;
    }
    function cleanup() {
        var all = api.getAllSceneLayers(), gone = [];
        for (var i = 0; i < all.length; i++) if (BASE.indexOf(all[i]) < 0) { try { api.deleteLayer(all[i]); gone.push(all[i]); } catch (e) {} }
        return gone;
    }
    function front() {   // brings every test layer above the user's layers (keeps the user's selection)
        var sel = api.getSelection(), kids = api.getChildren(api.getActiveComp()), mine = [];
        for (var i = 0; i < kids.length; i++) if (BASE.indexOf(kids[i]) < 0) mine.push(kids[i]);
        api.select(mine); api.bringToFront(); api.select(sel);
        return api.getChildren(api.getActiveComp());
    }
    function sample(id, attr, frames) {
        var out = {}; for (var i = 0; i < frames.length; i++) { api.setFrame(frames[i]); out[frames[i]] = api.get(id, attr); } return out;
    }
    return { ROOT: ROOT, BASE: BASE, ease: ease, key: key, rect: rect, text: text, stage: stage, cleanup: cleanup, sample: sample, front: front };
})();
