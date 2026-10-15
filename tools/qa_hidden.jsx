// QA before a render: text/shape layers covered by an opaque full-frame layer, disabled overlays,
// overlays whose opacity never rises, and footage that ends before its layer. Usage: QA_HIDDEN("TEASER v6")
function QA_HIDDEN(rootName) {
    var root = null, i, seen = {}, out = [], shortF = [], dis = [], zero = [];
    for (i = 1; i <= app.project.numItems; i++) { var it = app.project.item(i); if (it instanceof CompItem && it.name === rootName) root = it; }
    if (!root) return "no comp " + rootName;
    function covers(l, c, t) {
        if (!(l instanceof AVLayer) || !l.enabled || !l.hasVideo) return false;
        if (l.isTrackMatte || l.hasTrackMatte || l.adjustmentLayer || l.guideLayer) return false;
        if (l.blendingMode !== BlendingMode.NORMAL) return false;
        if (t < l.inPoint || t >= l.outPoint) return false;
        var src = l.source; if (!src || !(src instanceof FootageItem) || src.hasAlpha) return false;
        if (l.name === "dim" || l.name === "shade") return false;
        if (l.property("ADBE Mask Parade").numProperties > 0) return false;
        var tg = l.property("ADBE Transform Group");
        if (tg.property("ADBE Opacity").valueAtTime(t, false) < 99) return false;
        var sc = tg.property("ADBE Scale").valueAtTime(t, false);
        return src.width * sc[0] / 100 >= c.width * 0.98 && src.height * sc[1] / 100 >= c.height * 0.98;
    }
    function scan(c) {
        if (seen[c.id]) return; seen[c.id] = 1;
        for (var j = 1; j <= c.numLayers; j++) {
            var l = c.layer(j), isT = !!l.property("ADBE Text Properties"), isS = l.matchName === "ADBE Vector Layer";
            if (l instanceof AVLayer && l.source instanceof CompItem) scan(l.source);
            if (l instanceof AVLayer && l.source instanceof FootageItem && l.source.duration > 0 && !l.timeRemapEnabled && l.hasVideo) {
                var end = l.startTime + l.source.duration * l.stretch / 100;
                if (end < Math.min(l.outPoint, c.duration) - 0.5 / c.frameRate) shortF.push(c.name + " > " + l.name + " ends " + end.toFixed(2) + " < out " + l.outPoint.toFixed(2));
            }
            if (!(isT || isS)) continue;
            if (!l.enabled) { dis.push(c.name + " > " + l.name); continue; }
            var a = Math.max(l.inPoint, 0), b = Math.min(l.outPoint, c.duration); if (b <= a) continue;
            var op = l.property("ADBE Transform Group").property("ADBE Opacity"), ok = false, k, tt;
            for (k = 0; k <= 4; k++) { tt = a + (b - a) * (0.2 + 0.15 * k); if (op.valueAtTime(tt, false) > 1) ok = true; }
            if (!ok) zero.push(c.name + " > " + l.name);
            for (k = 0; k <= 2; k++) {
                tt = a + (b - a) * (0.3 + 0.2 * k);
                for (var u = 1; u < j; u++) if (covers(c.layer(u), c, tt)) { out.push(c.name + " > " + l.name + " @" + tt.toFixed(2) + " under " + c.layer(u).name); k = 9; break; }
            }
        }
    }
    scan(root);
    return "COVERED (" + out.length + "):\n" + out.join("\n") + "\n\nSHORT FOOTAGE (" + shortF.length + "):\n" + shortF.join("\n") +
        "\n\nDISABLED (" + dis.length + "):\n" + dis.join("\n") + "\n\nOPACITY 0 (" + zero.length + "):\n" + zero.slice(0, 60).join("\n");
}
