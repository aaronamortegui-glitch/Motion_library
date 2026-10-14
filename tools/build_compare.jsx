// Builds the case study "Claude alone vs Claude + Motion DNA" (docs/case-studies/claude-vs-motion-dna.md): six deck slides
// animated twice, the way a plain LLM animates them (linear keys, everything at once, hard cuts) and with Motion DNA (token
// curves; every slide has an entrance, a living hold and an exit; staggered pieces, kit elements and transitions, a slow
// camera drift). Split screen with labels, then the Motion DNA close. Usage: bash tools/bridge.sh tools/build_compare.jsx
// (AE open), then render the comp "MDNA Compare" (MCP render_comp). All names and numbers on screen are fictional.
(function () {
    var R = SS_ROOT + "/tools/";
    $.evalFile(new File(R + "ss_presets.jsx")); $.evalFile(new File(R + "ss_keyframes.jsx"));
    var libs = ["ss_shapes.jsx", "ss_behaviors.jsx", "ss_looks.jsx", "ss_elements.jsx", "ss_transitions.jsx", "ss_text.jsx", "ss_assets.jsx"];
    for (var i = 0; i < libs.length; i++) $.evalFile(new File(R + libs[i]));
    for (var z = app.project.numItems; z >= 1; z--) { var it = app.project.item(z); if (/^MDNA Compare/.test(it.name)) it.remove(); }

    var PINE = "#0A211F", SEA = "#174A46", SPARK = "#D8FF85", CLOUD = "#F7F9F2", TEAL = "#2E8B80", MINT = "#9FD9C4";
    var W = 1920, H = 1080, FPS = 30, SL = 3.4, NS = 6, OUT = SL - 0.55;   // seconds per slide; exits start at OUT
    var bad = {}; try { var m = app.fonts.missingOrSubstitutedFonts; for (var j = 0; j < m.length; j++) bad[m[j].postScriptName] = true; } catch (e0) {}
    function font(list) { for (var i = 0; i < list.length; i++) { var ok = false; try { ok = app.fonts.getFontsByPostScriptName(list[i]).length > 0; } catch (e) {} if (ok && !bad[list[i]]) return list[i]; } return list[list.length - 1]; }
    var SERIF = font(["InstrumentSerif-Regular", "Georgia"]), BOLD = font(["InterTight-Bold", "Arial-BoldMT"]), REG = font(["InterTight-Regular", "ArialMT"]);
    function rgb(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function comp(n, d) { return app.project.items.addComp("MDNA Compare · " + n, W, H, 1, d, FPS); }
    function bg(c, col) { var S = c.layers.addSolid(rgb(col), "bg", W, H, 1); S.moveToEnd(); return S; }
    function txt(c, s, f, size, x, y, col, center) {
        var L = c.layers.addText(s), p = L.property("ADBE Text Properties").property("ADBE Text Document"), d = p.value;
        d.resetCharStyle(); d.font = f; d.fontSize = size; d.fillColor = rgb(col); d.applyFill = true; d.justification = ParagraphJustification.LEFT_JUSTIFY; p.setValue(d);
        var r = L.sourceRectAtTime(0, false); L.property("ADBE Transform Group").property("ADBE Position").setValue([(center ? x - r.width / 2 : x) - r.left, y - r.top]); return L;
    }
    function rect(c, x, y, w, h, col, name, base) {   // base: anchor at the bottom (bars grow up)
        var L = c.layers.addShape(); L.name = name;
        var v = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var r = v.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([w, h]); r.property("ADBE Vector Rect Position").setValue([0, base ? -h / 2 : 0]); r.property("ADBE Vector Rect Roundness").setValue(Math.min(w, h) / 2 > 12 ? 12 : Math.min(w, h) / 2);
        v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(rgb(col));
        L.property("ADBE Transform Group").property("ADBE Position").setValue([x, y]); return L;
    }
    function dot(c, x, y, d, col, name) { return rect(c, x, y, d, d, col, name, false); }
    // the plain way: linear keys, the same start for everything, no exit
    function linear(prop, t0, t1, v0, v1) { prop.setValueAtTime(t0, v0); prop.setValueAtTime(t1, v1);
        for (var k = 1; k <= prop.numKeys; k++) prop.setInterpolationTypeAtKey(k, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR); }
    function plainIn(L, t) { var T = L.property("ADBE Transform Group"), p = T.property("ADBE Position"), v = p.value;
        linear(T.property("ADBE Opacity"), t, t + 1, 0, 100); linear(p, t, t + 1, [v[0], v[1] + 40], [v[0], v[1]]); }
    // the Motion DNA way: text per unit on token curves, in and out; a living hold
    function tIn(L, t, o) { o = o || {}; SSTX.animate(L, { unit: o.unit || "chars", channels: o.channels || ["fade", "rise", "blur"], t: t, ease: o.ease || "Settle", dur: o.dur || "Arrive", phase: "both", out: o.out || OUT, order: o.order }); }
    function popIn(L, t, out, ease) { var S = L.property("ADBE Transform Group").property("ADBE Scale");
        SSM.animate(S, t, [0, 0, 100], [100, 100, 100], "Arrive", ease || "Pop"); SSM.animate(S, out || OUT, [100, 100, 100], [0, 0, 100], "Glide", "Launch"); }
    function growUp(L, t, out) { var S = L.property("ADBE Transform Group").property("ADBE Scale");
        SSM.animate(S, t, [100, 0, 100], [100, 100, 100], "Arrive", "Pop"); SSM.animate(S, out || OUT, [100, 100, 100], [100, 0, 100], "Glide", "Launch"); }
    function drift(L, px) { L.property("ADBE Transform Group").property("ADBE Position").expression = 'value + [0, ' + (px || 6) + ' * Math.sin(time * 1.6 + ' + (Math.random() * 6).toFixed(2) + ')]'; }

    function slides(mode) {
        var dna = mode === "dna", out = [];
        // 1 · title
        var c1 = comp(mode + " 1 title", SL); bg(c1, PINE); out.push(c1);
        var k1 = txt(c1, "QUARTERLY REVIEW", BOLD, 30, 160, 330, SPARK), t1 = txt(c1, "The Q3 launch", dna ? SERIF : BOLD, 150, 160, 390, CLOUD), s1 = txt(c1, "Product · Marketing · Operations", REG, 44, 160, 600, MINT);
        if (dna) { tIn(k1, 0.1, { channels: ["fade", "blur"], ease: "Cruise" }); tIn(t1, 0.25, { dur: "Sweep" }); tIn(s1, 0.6, { unit: "words" });
                   SSS.add(c1, "line", { position: [470, 710], size: 620, t: 0.8, hold: 1.4, colors: [SPARK] }); drift(t1, 5); }
        else { plainIn(k1, 0.3); plainIn(t1, 0.3); plainIn(s1, 0.3); }
        // 2 · agenda
        var c2 = comp(mode + " 2 agenda", SL); bg(c2, SEA); out.push(c2);
        var h2 = txt(c2, "Agenda", dna ? SERIF : BOLD, 110, 160, 200, CLOUD), items = ["01  Results", "02  What we shipped", "03  Next quarter"], L2 = [];
        for (var a = 0; a < items.length; a++) L2.push(txt(c2, items[a], a === 0 ? BOLD : REG, 56, 160, 420 + a * 110, a === 0 ? SPARK : CLOUD));
        if (dna) { tIn(h2, 0.1, { dur: "Sweep" }); for (var a2 = 0; a2 < L2.length; a2++) tIn(L2[a2], 0.45 + a2 * 0.16, { unit: "words", channels: ["fade", "slide"], ease: "Land", out: OUT + a2 * 0.06 });
                   var mk = rect(c2, 130, 455, 8, 64, SPARK, "marker"); popIn(mk, 0.5, OUT, "Settle"); }
        else { plainIn(h2, 0.3); for (var a3 = 0; a3 < L2.length; a3++) plainIn(L2[a3], 0.3); }
        // 3 · numbers
        var c3 = comp(mode + " 3 numbers", SL); bg(c3, PINE); out.push(c3);
        var h3 = txt(c3, "Growth this quarter", BOLD, 64, 160, 180, CLOUD), vals = [180, 300, 420, 560], bars = [];
        for (var b = 0; b < vals.length; b++) bars.push(rect(c3, 1080 + b * 170, 860, 110, vals[b], b === 3 ? SPARK : MINT, "bar " + (b + 1), true));
        if (dna) { tIn(h3, 0.1, { unit: "words" });
                   SSE.counter(c3, 0, 38, { t: 0.3, position: [470, 560], size: 190, prefix: "+", suffix: "%", colors: { box: PINE, accent: SPARK, text: SPARK } });
                   SSE.label(c3, "12,500 new users", { t: 0.8, out: OUT, position: [470, 760], size: 44, colors: { box: SPARK, accent: SPARK, text: PINE } });
                   for (var q = 0; q < bars.length; q++) growUp(bars[q], 0.35 + q * 0.1, OUT + q * 0.05); }
        else { plainIn(h3, 0.3); var n3 = txt(c3, "+38%", BOLD, 190, 470, 470, SPARK, true); plainIn(n3, 0.3); var u3 = txt(c3, "12,500 new users", REG, 44, 470, 720, CLOUD, true); plainIn(u3, 0.3);
               for (var q2 = 0; q2 < bars.length; q2++) linear(bars[q2].property("ADBE Transform Group").property("ADBE Scale"), 0.3, 1.3, [100, 0], [100, 100]); }
        // 4 · timeline
        var c4 = comp(mode + " 4 timeline", SL); bg(c4, SEA); out.push(c4);
        var h4 = txt(c4, "How we got here", dna ? SERIF : BOLD, 100, 160, 180, CLOUD), steps = ["Plan", "Build", "Launch"], dots = [], labs = [];
        var line = rect(c4, 960, 600, 1300, 6, MINT, "track");
        for (var s = 0; s < 3; s++) { dots.push(dot(c4, 460 + s * 500, 600, 44, s === 2 ? SPARK : CLOUD, "dot " + (s + 1))); labs.push(txt(c4, steps[s], BOLD, 54, 460 + s * 500, 660, s === 2 ? SPARK : CLOUD, true)); }
        if (dna) { tIn(h4, 0.1, { dur: "Sweep" });
                   var LS = line.property("ADBE Transform Group").property("ADBE Scale"); SSM.animate(LS, 0.2, [0, 100, 100], [100, 100, 100], "Sweep", "Surge"); SSM.animate(LS, OUT, [100, 100, 100], [0, 100, 100], "Glide", "Launch");
                   for (var s2 = 0; s2 < 3; s2++) { popIn(dots[s2], 0.45 + s2 * 0.22, OUT + s2 * 0.05); tIn(labs[s2], 0.55 + s2 * 0.22, { channels: ["fade", "rise"], ease: "Pop", out: OUT + s2 * 0.05 }); }
                   dots[2].property("ADBE Transform Group").property("ADBE Scale").expression = 'var s = value[0] > 0 ? value[0] * (1 + 0.08 * Math.sin(time * 6)) : 0; [s, s]'; }
        else { plainIn(h4, 0.3); plainIn(line, 0.3); for (var s3 = 0; s3 < 3; s3++) { plainIn(dots[s3], 0.3); plainIn(labs[s3], 0.3); } }
        // 5 · quote
        var c5 = comp(mode + " 5 quote", SL); bg(c5, PINE); out.push(c5);
        var q5 = txt(c5, "“It finally feels like us.”", dna ? SERIF : BOLD, 110, 960, 400, CLOUD, true), a5 = txt(c5, "— Head of Brand", REG, 44, 960, 600, MINT, true);
        if (dna) { tIn(q5, 0.15, { unit: "words", channels: ["fade", "rise", "blur"], dur: "Sweep" }); tIn(a5, 0.9, { channels: ["fade", "tracking"], ease: "Cruise" }); drift(q5, 4); }
        else { plainIn(q5, 0.3); plainIn(a5, 0.3); }
        // 6 · close
        var c6 = comp(mode + " 6 close", SL); bg(c6, SEA); out.push(c6);
        var t6 = txt(c6, "Ship faster,\rtogether.", dna ? SERIF : BOLD, 150, 960, 300, CLOUD, true);
        if (dna) { tIn(t6, 0.1, { unit: "lines", channels: ["rise"], dur: "Sweep", out: SL + 1 });
                   SSE.button(c6, "Questions?", "Let's talk", { t: 0.7, position: [960, 800], size: 46, click: 1.9, colors: { box: PINE, accent: SPARK, text: CLOUD } }); }
        else { plainIn(t6, 0.3); var b6 = txt(c6, "Questions?", BOLD, 46, 960, 780, SPARK, true); plainIn(b6, 0.3); }
        // the deck
        var D = comp(mode + " deck", SL * NS);
        for (var k = 0; k < out.length; k++) { var L = D.layers.add(out[k]); L.name = "Slide " + (k + 1); L.startTime = SL * k; L.moveToBeginning();
            if (dna) { var sc = L.property("ADBE Transform Group").property("ADBE Scale"); sc.setValueAtTime(SL * k, [100, 100]); sc.setValueAtTime(SL * (k + 1), [103.5, 103.5]); } }   // a slow camera push on every slide
        if (dna) { var looks = [["Liquid Wipe", [SPARK]], ["Slanted Bars", [MINT]], ["Iris Pop", [SPARK]], ["Color Stack", [TEAL]], ["Ink Drop", [SPARK]]];
                   for (var tr = 0; tr < looks.length; tr++) SST.recipe(D, looks[tr][0], SL * (tr + 1), { colors: looks[tr][1] }); }
        return D;
    }
    var plain = slides("plain"), dna = slides("dna");

    // master: side by side, labelled, then the Motion DNA close
    var END = 4.0, T = SL * NS, M = app.project.items.addComp("MDNA Compare", W, H, 1, T + END, FPS);
    bg(M, "#071715");
    function side(Dk, x, label, curve, col) {
        var L = M.layers.add(Dk); L.property("ADBE Transform Group").property("ADBE Scale").setValue([46, 46]);
        L.property("ADBE Transform Group").property("ADBE Position").setValue([x, 560]); L.outPoint = T;
        var frame = M.layers.addShape(); frame.name = label + " frame";
        var v = frame.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var r = v.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([W * 0.46 + 6, H * 0.46 + 6]); r.property("ADBE Vector Rect Roundness").setValue(8);
        var st = v.addProperty("ADBE Vector Graphic - Stroke"); st.property("ADBE Vector Stroke Color").setValue(rgb(col)); st.property("ADBE Vector Stroke Width").setValue(3);
        frame.property("ADBE Transform Group").property("ADBE Position").setValue([x, 560]); frame.outPoint = T;
        var t = txt(M, label, BOLD, 40, x, 250, col, true); t.outPoint = T;
        var c = txt(M, curve, REG, 26, x, 840, MINT, true); c.outPoint = T;
    }
    side(plain, 480, "Claude alone", "linear keys · everything at once · hard cuts", "#A3AAA6");
    side(dna, 1440, "Claude + Motion DNA", "in · hold · out on token curves · stagger · kit", SPARK);
    var ttl = txt(M, "Same slides, same brief", SERIF, 64, 960, 110, CLOUD, true); ttl.outPoint = T;
    var E = comp("end", END); SSL.background(E, "mesh", { colors: [PINE, SEA, PINE, TEAL, "#0F302C", SEA] });
    SSE.endCard(E, { t: 0.2, text: "Motion DNA", tagline: "The motion library for After Effects" });
    var LE = M.layers.add(E); LE.startTime = T; LE.moveToBeginning();
    SST.recipe(M, "Liquid Rise", T, { colors: [SPARK] });
    try { SSA.sfx(M, "Just Saying Tho", 0, -12, T + END); } catch (e) {}
    M.openInViewer();
    return M.name + " " + M.duration + " s";
})();
