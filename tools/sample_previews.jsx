// Samples every preset's real motion from its GIF__ thumbnail comp into library/preview_curves.json, so the AE panel can
// play a live vector preview (ScriptUI cannot play GIFs). Per frame: [dx, dy, sx, sy, rot, opacity, rotX, skew, trim, reveal]
// dx/dy relative to the comp size, sx/sy and opacity as factors, angles in degrees, trim 0–1 (path draw), reveal 0–1 (text).
// Run after the GIF pipeline: bash tools/bridge.sh tools/sample_previews.jsx 600
#include "ss_presets.jsx"
(function () {
    var proj = app.project, FPS = 12, items = [], n = 0;
    function r3(v) { return Math.round(v * 1000) / 1000; }
    function subject(c) {
        for (var i = 1; i <= c.numLayers; i++) {
            var L = c.layer(i);
            if (L.name === "BG" || L.locked) continue;
            return L;
        }
        return null;
    }
    function findEffect(L, name) { try { return L.property("ADBE Effect Parade").property(name); } catch (e) { return null; } }
    for (var k = 1; k <= proj.numItems; k++) {
        var c = proj.item(k);
        if (!(c instanceof CompItem) || c.name.indexOf("GIF__") !== 0) continue;
        var parts = c.name.split("__"), kind = parts[1], name = parts.slice(2).join("__");
        var L = subject(c);
        if (!L) continue;
        var T = L.property("ADBE Transform Group"), isText = L instanceof TextLayer;
        var p0 = T.property("ADBE Position").valueAtTime(c.duration * 0.5, false), s0 = T.property("ADBE Scale").valueAtTime(c.duration * 0.5, false);
        // rest values = the value in the middle of the comp (presets hold there)
        var sk = findEffect(L, "SS Skew"), skP = sk ? sk.property("ADBE Geometry2-0006") : null;
        var trim = null;
        try { var root = L.property("ADBE Root Vectors Group"); trim = root ? root.property("SS Trim") : null; } catch (e) {}
        var trimEnd = trim ? trim.property("ADBE Vector Trim End") : null, trimStart = trim ? trim.property("ADBE Vector Trim Start") : null;
        var sel = null, selStart = null;
        if (isText) {
            var an = L.property("ADBE Text Properties").property("ADBE Text Animators");
            if (an.numProperties) {
                var s1 = an.property(1).property("ADBE Text Selectors").property(1);
                sel = s1.property("ADBE Text Percent Offset"); selStart = s1.property("ADBE Text Percent Start");
            }
        }
        var frames = [], steps = Math.round(c.duration * FPS), txt = isText ? [] : null, lastTxt = null;
        for (var f = 0; f <= steps; f++) {
            var t = f / FPS, p = T.property("ADBE Position").valueAtTime(t, false), s = T.property("ADBE Scale").valueAtTime(t, false);
            var rx = 0; try { rx = L.threeDLayer ? T.property("ADBE Rotate X").valueAtTime(t, false) : 0; } catch (e) {}
            var tr = 1;
            if (trimEnd) tr = (trimEnd.valueAtTime(t, false) - (trimStart ? trimStart.valueAtTime(t, false) : 0)) / 100;
            var rev = 1;
            if (sel) {
                var off = sel.valueAtTime(t, false), st = selStart.valueAtTime(t, false);
                rev = sel.numKeys ? Math.max(0, Math.min(1, (off + 35) / 135)) : Math.max(0, Math.min(1, st / 100));
            }
            frames.push([r3((p[0] - p0[0]) / c.width), r3((p[1] - p0[1]) / c.height), r3(s[0] / (s0[0] || 100)), r3(s[1] / (s0[1] || 100)),
                         r3(T.property("ADBE Rotate Z").valueAtTime(t, false)), r3(T.property("ADBE Opacity").valueAtTime(t, false) / 100),
                         r3(rx), r3(skP ? skP.valueAtTime(t, false) : 0), r3(tr), r3(rev)]);
            if (isText) {   // Source Text expressions (Scramble, Count Up) change the string itself
                var s2 = String(L.property("ADBE Text Properties").property("ADBE Text Document").valueAtTime(t, false).text);
                txt.push(s2 === lastTxt ? 0 : s2); lastTxt = s2;
            }
        }
        var shape = isText ? "text" : (name === "Wipe Reveal" ? "bar" : (/Draw|Stroke/.test(name) ? "stroke" : "sample"));
        var entry = '"' + kind + "/" + name.split('"').join("") + '":{"dur":' + r3(c.duration) + ',"shape":"' + shape + '"' +
            (isText ? ',"text":"' + String(L.property("ADBE Text Properties").property("ADBE Text Document").value.text).split('"').join("") + '","txt":' + txt.toSource() : "") +
            ',"f":' + frames.toSource() + "}";
        items.push(entry); n++;
    }
    var out = new File(SS_ROOT + "/library/preview_curves.json");
    out.encoding = "UTF-8"; out.open("w");
    out.write('{"fps":' + FPS + ',"items":{' + items.join(",") + "}}");
    out.close();
    return n + " previews sampled";
})();
