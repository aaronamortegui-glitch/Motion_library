// Layout QA: the rules every Motion DNA edit must pass, checked on the built comps (run it after a build).
//   1 text never overlaps other text            4 text keeps contrast with what is behind it (or sits on a card / shadow)
//   2 text stays inside the safe area (40 px)    5 nothing sits on a face: text, HUD dots and line ends stay off face boxes
//   3 text is at least 32 px on screen           (faces: tools/face_boxes.py JSON, linked by "faces" in a build_scene spec)
// Nested full-frame precomps are flattened, so a title in a scene is checked against the HUD inside its footage comp.
// Usage: var QA_COMPS = ["DNA_EDIT"]; $.evalFile(".../check_layout.jsx")  or  bash tools/bridge.sh tools/check_layout.jsx
// (default: every comp named DNA_S*). Report: research/tests/layout_report.json; returns a summary of the warnings.
#include "ss_presets.jsx"
(function () {
    var proj = app.project, MIN = 32, SAFE = 40, STEP = 0.5, measured = {};
    var names = (typeof QA_COMPS !== "undefined" && QA_COMPS) || null;
    function findItem(n) { for (var i = 1; i <= proj.numItems; i++) if (proj.item(i).name === n) return proj.item(i); return null; }
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
    var comps = [];
    if (names) { for (var n = 0; n < names.length; n++) { var it = findItem(names[n]); if (it instanceof CompItem) comps.push(it); } }
    else for (var i = 1; i <= proj.numItems; i++) if (proj.item(i) instanceof CompItem && /^DNA_S\d/.test(proj.item(i).name)) comps.push(proj.item(i));
    var faceCache = {};
    function faces(comp) {   // build_scene.jsx stores "faces:<path>" in the comp comment
        var m = /faces:(\S+)/.exec(comp.comment || "");
        if (!m) return null;
        if (!faceCache[m[1]]) faceCache[m[1]] = SSM.readJSON(SS_ROOT + "/" + m[1]);
        return faceCache[m[1]];
    }
    function lum(c) { function ch(v) { return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); } return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]); }
    function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
    function isFullFrame(L, comp) {
        var s = tr(L, "ADBE Scale").value, p = tr(L, "ADBE Position").value, src = L.source;
        return src instanceof CompItem && src.width === comp.width && src.height === comp.height &&
            Math.abs(s[0] - 100) < 0.5 && Math.abs(p[0] - comp.width / 2) < 1 && Math.abs(p[1] - comp.height / 2) < 1 && !L.parent;
    }
    // collect visible text layers / HUD dots at comp time t (recursing into full-frame precomps)
    function collect(comp, t, out, path) {
        for (var l = 1; l <= comp.numLayers; l++) {
            var L = comp.layer(l);
            if (!L.enabled || t < L.inPoint || t >= L.outPoint) continue;
            var op = 100; try { op = tr(L, "ADBE Opacity").valueAtTime(t, false); } catch (e) {}
            if (op < 20) continue;
            if (L instanceof AVLayer && L.source instanceof CompItem && isFullFrame(L, comp)) {
                collect(L.source, (t - L.startTime) * 100 / L.stretch, out, path.concat([comp]));
                continue;
            }
            var isText = L instanceof TextLayer, isDot = L.name.indexOf("HUD dot") === 0, isCard = L.name.indexOf("HUD card") === 0;
            if (!isText && !isDot && !isCard) continue;
            var r = L.sourceRectAtTime(t, false), s = tr(L, "ADBE Scale").valueAtTime(t, false), p = tr(L, "ADBE Position").valueAtTime(t, false), a = tr(L, "ADBE Anchor Point").valueAtTime(t, false);
            if (r.width < 2 || r.height < 2) continue;
            var x0 = p[0] + (r.left - a[0]) * s[0] / 100, y0 = p[1] + (r.top - a[1]) * s[1] / 100;
            var box = [x0, y0, x0 + r.width * s[0] / 100, y0 + r.height * s[1] / 100];
            var behind = false;   // text under the people matte (roto) is covered by them, not placed on their faces
            for (var mm = 1; mm < L.index; mm++) if (comp.layer(mm).name.indexOf("Matte") === 0) behind = true;
            var item = { name: L.name, comp: comp.name, box: box, text: isText, card: isCard, id: L.name.split(" · ").slice(1).join(" · "), root: path.length ? path[0] : comp, owner: comp, t: t, behind: behind };
            if (isText) {
                var td = L.property("ADBE Text Properties").property("ADBE Text Document").valueAtTime(t, false);
                item.size = td.fontSize * s[1] / 100; item.fill = td.fillColor;
                item.helped = L.property("ADBE Effect Parade").property("ADBE Drop Shadow") !== null;   // shadow counts as help
                for (var k = 1; k <= comp.numLayers; k++) if (comp.layer(k).name.indexOf("HUD card") === 0 && comp.layer(k).enabled) item.helped = true;
                item.str = String(td.text).replace(/\r/g, " / ").substr(0, 40);
            }
            out.push(item);
        }
        return out;
    }
    function inter(a, b) { var w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); return w > 0 && h > 0 ? w * h : 0; }
    function area(b) { return (b[2] - b[0]) * (b[3] - b[1]); }
    // luminance of the comp's plate under a box (expression sampleImage on a temporary null)
    function plateColor(comp, box, t) {
        var plate = null;
        for (var l = comp.numLayers; l >= 1; l--) { var L = comp.layer(l); if (L.enabled && L.hasVideo && !(L instanceof TextLayer) && !(L instanceof ShapeLayer) && L.name !== "BG") { plate = L; break; } }
        if (!plate) return null;
        var N = comp.layers.addNull(); N.enabled = false;
        var cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, rx = Math.max(4, (box[2] - box[0]) / 2), ry = Math.max(4, (box[3] - box[1]) / 2);
        tr(N, "ADBE Position").expression = 'var c = thisComp.layer("' + plate.name.replace(/"/g, '\\"') + '").sampleImage([' + cx + ',' + cy + '], [' + rx + ',' + ry + '], true, time); [c[0] * 1000, c[1] * 1000, c[2] * 1000];';
        var v = null; try { v = tr(N, "ADBE Position").valueAtTime(t, false); } catch (e) {}
        N.remove();
        return v ? [v[0] / 1000, v[1] / 1000, v[2] / 1000] : null;
    }
    var warn = [], seen = {};
    // rule 0: no substituted fonts. AE silently swaps a font it did not load (e.g. after a restart) for Times;
    // every title then renders in a serif. Fix: restart AE so it reloads the user fonts (python tools/setup.py installs them).
    try {
        var miss = app.fonts.missingOrSubstitutedFonts, mn = [];
        for (var mf = 0; mf < miss.length; mf++) mn.push(miss[mf].postScriptName);
        if (mn.length) return "layout QA: STOP · " + mn.length + " fonts are substituted (" + mn.join(", ") + "). Restart After Effects, then rebuild.";
    } catch (eF) {}
    // a problem counts when it shows in at least two samples (an entrance animation passing by is not a layout problem)
    function add(kind, comp, t, msg) {
        var key = kind + comp + msg; seen[key] = (seen[key] || 0) + 1;
        if (seen[key] === 2 || (kind === "contrast" && seen[key] === 1)) warn.push({ kind: kind, comp: comp, t: Math.round(t * 100) / 100, msg: msg });
    }
    for (var c = 0; c < comps.length; c++) {
        var C = comps[c];
        for (var t = 0; t < C.duration; t += STEP) {
            var items = collect(C, t, [], []), texts = [];
            var cards = [];
            for (var q = 0; q < items.length; q++) { if (items[q].text) texts.push(items[q]); if (items[q].card) cards.push(items[q]); }
            // cards never touch another card, nor text that is not theirs (callout ids follow "HUD <part> · <id>")
            for (var ca = 0; ca < cards.length; ca++) {
                for (var cb = ca + 1; cb < cards.length; cb++) if (inter(cards[ca].box, cards[cb].box) > 0) add("overlap", C.name, t, "card " + cards[ca].id + "  ×  card " + cards[cb].id);
                for (var ct = 0; ct < texts.length; ct++) if (texts[ct].name.indexOf(cards[ca].id) < 0 && inter(cards[ca].box, texts[ct].box) > 0.05 * area(texts[ct].box)) add("overlap", C.name, t, "card " + cards[ca].id + "  ×  " + texts[ct].str);
            }
            for (var a1 = 0; a1 < texts.length; a1++) {
                var A = texts[a1], b = A.box;
                if (A.size < MIN) add("size", C.name, t, A.str + " is " + Math.round(A.size) + " px (min " + MIN + ")");
                if (b[0] < SAFE || b[1] < SAFE || b[2] > C.width - SAFE || b[3] > C.height - SAFE) add("frame", C.name, t, A.str + " leaves the safe area");
                for (var b1 = a1 + 1; b1 < texts.length; b1++) {
                    var B = texts[b1], ov = inter(A.box, B.box);
                    if (ov > 0.08 * Math.min(area(A.box), area(B.box))) add("overlap", C.name, t, A.str + "  ×  " + B.str);
                }
                var mk = A.comp + "/" + A.name;
                if (!A.helped && A.owner === C && !measured[mk]) {   // contrast once per text, where the text and its plate share a comp
                    measured[mk] = 1;
                    var bg = plateColor(C, A.box, t);
                    if (bg && contrast(A.fill, bg) < 3) add("contrast", C.name, t, A.str + " contrast " + (Math.round(contrast(A.fill, bg) * 10) / 10) + ":1 (put it on a card or move it)");
                }
            }
            // faces: in footage comps that carry face boxes
            for (var f = 0; f < items.length; f++) {
                var I = items[f], F = faces(I.owner);
                if (!F || I.behind) continue;
                var fr = Math.min(F.frames - 1, Math.max(0, Math.round((I.t) * F.fps))), fb = F.faces[fr] || [];
                for (var g = 0; g < fb.length; g++) {
                    var fx = [fb[g][0], fb[g][1], fb[g][0] + fb[g][2], fb[g][1] + fb[g][3]];
                    if (inter(I.box, fx) > 0.15 * Math.min(area(I.box), area(fx))) add("face", C.name, t, (I.str || I.name) + " sits on a face");
                }
            }
        }
    }
    var f2 = new File(SS_ROOT + "/research/tests/layout_report.json"); f2.parent.create(); f2.encoding = "UTF-8"; f2.open("w");
    var lines = []; for (var w = 0; w < warn.length; w++) lines.push('{"kind":"' + warn[w].kind + '","comp":"' + warn[w].comp + '","t":' + warn[w].t + ',"msg":"' + warn[w].msg.replace(/\\/g, "/").replace(/"/g, "'") + '"}');
    f2.write("[\n" + lines.join(",\n") + "\n]\n"); f2.close();
    var sum = {}; for (var s2 = 0; s2 < warn.length; s2++) sum[warn[s2].kind] = (sum[warn[s2].kind] || 0) + 1;
    var parts = []; for (var k2 in sum) if (sum.hasOwnProperty(k2)) parts.push(k2 + " " + sum[k2]);
    var top = []; for (var w2 = 0; w2 < Math.min(25, warn.length); w2++) top.push(warn[w2].kind + " · " + warn[w2].comp + " @" + warn[w2].t + "s · " + warn[w2].msg);
    return "layout QA: " + comps.length + " comps, " + warn.length + " warnings (" + parts.join(", ") + ")\n" + top.join("\n");
})();
