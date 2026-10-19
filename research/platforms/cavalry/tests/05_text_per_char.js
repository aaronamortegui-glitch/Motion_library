// Test 05 · Chars Rise / Words Fade Up (AE: text animators with range selectors). Cavalry: the "autoAnimate"
// behaviour connected into the textShape's "deformers": useLevels true, levelMode 3 = characters (2 = words,
// 1 = lines), timingMode 0 = in order, timeOffset = total stagger in frames (negative = first char leads), positionMode 2
// (Drift, angleDistance = [angle deg, px]), opacityMode 1 (Fade Up). The master "progress" 0 -> 100 is keyframed with
// a token bezier; every character replays that curve shifted by its offset, so the token easing is kept per character.
// Clear autoAnimate's two default progress keys first (they blend with scripted keys).
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
T.cleanup();
var stage = T.stage();
function anim(name, target, level, drift, scaleMode, f0, f1, stagger, tok) {
    var a = api.create("autoAnimate", name);
    api.set(a, { useLevels: true, levelMode: level, timingMode: 0, timeOffset: stagger, positionMode: drift ? 2 : 0,
        angleDistance: drift || [0, 0], opacityMode: 1, scaleMode: scaleMode });
    var ks = api.getKeyframeTimes(a, "progress"); for (var i = 0; i < ks.length; i++) api.deleteKeyframe(a, "progress", ks[i]);
    api.connect(a, "id", target, "deformers");
    T.key(a, "progress", f0, 0, f1, 100, tok);
    return a;
}
var t1 = T.text("T_chars", "Chars Rise", 170, "#f2f2f2", 0, 160);
var a1 = anim("T_aaChars", t1, 3, [180, 90], 0, 0, 14, -16, "Land");
var t2 = T.text("T_words", "Words fade up one by one", 90, "#c6f432", 0, -120);
var a2 = anim("T_aaWords", t2, 2, [180, 40], 0, 4, 18, -18, "Surge");
T.front();
// per-character positions at frame 8 via sub-mesh bounding boxes is heavy; read the whole-layer bbox over time instead
var bb = []; for (var f = 0; f <= 30; f += 6) { api.setFrame(f); var b = api.getBoundingBox(t1, true); bb.push([f, Math.round(b.bottom), Math.round(b.top)]); }
JSON.stringify({ a1: a1, a2: a2, bbox_t1: bb, prog: T.sample(a1, "progress", [0, 7, 14]) });
