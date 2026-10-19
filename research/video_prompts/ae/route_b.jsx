// Route B of the video-prompt pilot: rebuild two code-rendered templates natively in After Effects with the Motion
// DNA text engine and token curves, so they stay editable (research; not part of the plugin yet).
//   VP_T05(): T05 kinetic typography, one text layer per line, words rise into a mask on Land, key word in spark.
//   VP_T12(): T12 logo reveal, three shape layers (disc, bar, arc) on Wind-up / Whip / Settle, Pop lock, wordmark.
// Run (run_jsx, with tools/ss_presets.jsx loaded): $.evalFile(SS_ROOT + "/tools/ss_text.jsx");
//   $.evalFile(SS_ROOT + "/research/video_prompts/ae/route_b.jsx"); return VP_T05() + " · " + VP_T12();
var VP = (function () {
    var TOK = (function () { var f = File(SS_ROOT + "/tokens/superside_motion_tokens.json"); f.encoding = "UTF-8"; f.open("r"); var s = f.read(); f.close(); return eval("(" + s + ")"); })();
    function bz(n) { for (var i = 0; i < TOK.easings.length; i++) if (TOK.easings[i].name === n) return TOK.easings[i].bezier; throw new Error("curve " + n); }
    function hex(h) { return [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255]; }
    var COL = { pine: hex("#0A211F"), spark: hex("#D8FF85"), cloud: hex("#F7F9F2"), mint: hex("#9FD8C2") };
    function comp(name, dur) {
        for (var i = app.project.numItems; i >= 1; i--) if (app.project.item(i).name === name) app.project.item(i).remove();
        var c = app.project.items.addComp(name, 1920, 1080, 1, dur, 30);
        c.layers.addSolid(COL.pine, "bg (preview only)", 1920, 1080, 1, dur).locked = true;   // the template is an overlay: turn this off to export alpha
        return c;
    }
    // two keys with a token curve: bezier (x1,y1,x2,y2) → AE temporal ease (influence %, speed)
    function key(prop, t0, v0, t1, v1, curve) {
        var b = bz(curve), dims = (v0 instanceof Array) ? v0.length : 1, dist = 0;
        if (dims > 1) { for (var i = 0; i < dims; i++) dist += Math.pow(v1[i] - v0[i], 2); dist = Math.sqrt(dist); } else dist = Math.abs(v1 - v0);
        var avg = dist / (t1 - t0), n = (prop.propertyValueType === PropertyValueType.TwoD_SPATIAL || prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL) ? 1 : ((prop.value instanceof Array) ? prop.value.length : 1);
        var oi = Math.max(0.1, b[0] * 100), os = b[0] > 0 ? avg * b[1] / b[0] : avg * 3, ii = Math.max(0.1, (1 - b[2]) * 100), is = (1 - b[2]) > 0 ? avg * (1 - b[3]) / (1 - b[2]) : 0;
        var k0 = prop.addKey(t0), k1 = prop.addKey(t1); prop.setValueAtKey(k0, v0); prop.setValueAtKey(k1, v1); k0 = prop.nearestKeyIndex(t0); k1 = prop.nearestKeyIndex(t1);
        var eo = [], ei = []; for (var j = 0; j < n; j++) { eo.push(new KeyframeEase(Math.max(0, os), oi)); ei.push(new KeyframeEase(Math.max(0, is), ii)); }
        prop.setTemporalEaseAtKey(k0, prop.keyInTemporalEase(k0), eo); prop.setTemporalEaseAtKey(k1, ei, prop.keyOutTemporalEase(k1));
    }
    function tr(L, n) { return L.property("ADBE Transform Group").property(n); }
    function text(c, s, size, col, x, y, font) {
        var L = c.layers.addText(s), p = L.property("ADBE Text Properties").property("ADBE Text Document"), d = p.value;
        d.resetCharStyle(); d.font = font || "InterTight-Bold"; d.fontSize = size; d.fillColor = col; d.applyFill = true; d.applyStroke = false; d.tracking = -30;
        d.justification = ParagraphJustification.CENTER_JUSTIFY; p.setValue(d);
        var r = L.sourceRectAtTime(0, false); tr(L, "ADBE Anchor Point").setValue([r.left + r.width / 2, r.top + r.height / 2]); tr(L, "ADBE Position").setValue([x, y]);
        return L;
    }
    function colorWord(L, from, to, col) {   // AE 24.3+: per-character styling through characterRange
        try { var p = L.property("ADBE Text Properties").property("ADBE Text Document"), d = p.value; d.characterRange(from, to).fillColor = col; p.setValue(d); return true; } catch (e) { return false; }
    }
    return {
        T05: function () {
            var lines = [["Motion", "with", "its", "*own*"], ["*DNA.*"], ["Every", "brand", "moves"], ["the", "way", "it", "*decided.*"]], size = [120, 300, 120, 120], beat = 0.42;
            var c = comp("VP T05 · kinetic type (AE)", 10), t = 0.3, colored = 0;
            for (var i = 0; i < lines.length; i++) {
                var words = lines[i], clean = [], s = "", dur = words.length * beat + 1.0;
                for (var j = 0; j < words.length; j++) clean.push(words[j].replace(/\*/g, ""));
                s = clean.join(" ");
                var L = text(c, s, size[i], COL.cloud, 960, 540); L.name = "line " + (i + 1); L.inPoint = t; L.outPoint = t + dur;
                var pos = 0; for (var j = 0; j < words.length; j++) { if (words[j].indexOf("*") >= 0 && colorWord(L, pos, pos + clean[j].length, COL.spark)) colored++; pos += clean[j].length + 1; }
                SSTX.animate(L, { unit: "words", channels: ["fade", "rise"], ease: "Land", t: t, spread: (words.length - 1) * beat, mask: true, phase: "in" });
                SSTX.animate(L, { unit: "words", channels: ["fade", "rise"], ease: "Launch", t: t + dur - 0.4, phase: "out", dur: "Glide", spread: 0.1 });
                if (i === 1) {   // the underline sweep under "DNA."
                    var u = c.layers.addShape(); u.name = "underline"; var g = u.property("ADBE Root Vectors Group"); g.addProperty("ADBE Vector Shape - Rect").property("ADBE Vector Rect Size").setValue([660, 16]);
                    g.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(COL.spark); tr(u, "ADBE Position").setValue([960, 710]);
                    key(tr(u, "ADBE Scale"), t + 0.4, [0, 100], t + 1.1, [100, 100], "Cruise"); u.inPoint = t; u.outPoint = t + dur;
                }
                t += dur;
            }
            return "T05 built (" + lines.length + " lines, key words coloured: " + colored + ")";
        },
        T12: function () {
            var c = comp("VP T12 · logo reveal (AE)", 5), cx = 660, cy = 540;
            var mark = c.layers.addNull(5); mark.name = "mark"; tr(mark, "ADBE Position").setValue([960, cy]);
            key(tr(mark, "ADBE Position"), 1.9, [960, cy], 2.5, [cx, cy], "Settle");
            key(tr(mark, "ADBE Scale"), 1.25, [100, 100, 100], 1.6, [108, 108, 100], "Pop"); key(tr(mark, "ADBE Scale"), 1.6, [108, 108, 100], 1.9, [100, 100, 100], "Settle");
            function shape(name, build) { var L = c.layers.addShape(); L.name = name; build(L.property("ADBE Root Vectors Group")); L.parent = mark; return L; }
            var disc = shape("disc", function (g) { g.addProperty("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").setValue([140, 140]); g.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(COL.spark); });
            key(tr(disc, "ADBE Position"), 0.2, [-700, -500], 1.2, [-60, -40], "Wind-up");
            var bar = shape("bar", function (g) { var r = g.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([68, 220]); r.property("ADBE Vector Rect Roundness").setValue(34); g.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(COL.cloud); });
            key(tr(bar, "ADBE Position"), 0.35, [70, 700], 1.1, [70, 30], "Whip");
            var arc = shape("arc", function (g) { g.addProperty("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").setValue([300, 300]);
                var st = g.addProperty("ADBE Vector Graphic - Stroke"); st.property("ADBE Vector Stroke Color").setValue(COL.mint); st.property("ADBE Vector Stroke Width").setValue(34); st.property("ADBE Vector Stroke Line Cap").setValue(2);
                var tp = g.addProperty("ADBE Vector Filter - Trim"); tp.property("ADBE Vector Trim Start").setValue(0); tp.property("ADBE Vector Trim Offset").setValue(27); });
            var trim = arc.property("ADBE Root Vectors Group").property("ADBE Vector Filter - Trim").property("ADBE Vector Trim End");
            key(trim, 0.5, 0, 1.3, 55, "Settle"); key(tr(arc, "ADBE Rotate Z"), 0.5, -270, 1.3, 0, "Settle");
            var word = text(c, "northwind", 150, COL.cloud, 0, cy + 8); word.name = "wordmark";
            var d = word.property("ADBE Text Properties").property("ADBE Text Document"), v = d.value; v.justification = ParagraphJustification.LEFT_JUSTIFY; d.setValue(v);
            var r = word.sourceRectAtTime(0, false); tr(word, "ADBE Anchor Point").setValue([r.left, r.top + r.height / 2]); tr(word, "ADBE Position").setValue([900, cy + 8]);
            SSTX.animate(word, { unit: "chars", channels: ["fade", "rise"], ease: "Land", t: 2.2, spread: 0.5, phase: "in" });
            var tag = text(c, "DESIGN THAT MOVES", 34, COL.spark, 0, cy + 120, "InterTight-SemiBold"); tag.name = "tagline";
            var d2 = tag.property("ADBE Text Properties").property("ADBE Text Document"), v2 = d2.value; v2.justification = ParagraphJustification.LEFT_JUSTIFY; v2.tracking = 300; d2.setValue(v2);
            var r2 = tag.sourceRectAtTime(0, false); tr(tag, "ADBE Anchor Point").setValue([r2.left, r2.top + r2.height / 2]); tr(tag, "ADBE Position").setValue([904, cy + 120]);
            SSTX.animate(tag, { unit: "words", channels: ["fade", "rise"], ease: "Land", t: 3.0, spread: 0.2, phase: "in" });
            return "T12 built";
        }
    };
})();
function VP_T05() { return VP.T05(); }
function VP_T12() { return VP.T12(); }
