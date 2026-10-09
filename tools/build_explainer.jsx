// Builds the explainer scenes from a JSON storyboard (same coordinates as the Figma frames, 1920×1080) and animates
// every element with an SS Motion preset: the explainer is made with the library itself.
// Spec: media/explainer/explainer.json → comps EX_S01…EX_S09 (folder "EXPLAINER"). Then build_edit.jsx sequences them.
// Run: bash tools/bridge.sh tools/build_explainer_all.jsx 900  (scenes + edit)
// Element types: text · pill · card (bg + texts) · media (png/mp4 with rounded corners) · rect · marker (a bar that
// slides on a curve). Each element: at [x, y] (top-left, like Figma), t (seconds into the scene), motion / text
// preset, optional fx loop, attention preset at a time.
#include "ss_presets.jsx"
var EXPLAINER_SPEC = (typeof EXPLAINER_SPEC !== "undefined" && EXPLAINER_SPEC) || "media/explainer/explainer.json";
(function () {
    var proj = app.project, SPEC = SSM.readJSON(SS_ROOT + "/" + EXPLAINER_SPEC);
    var PAL = { pine: [0.0392, 0.1294, 0.1216], cloud: [0.9686, 0.9765, 0.949], spark: [0.847, 1, 0.5216], head: [0.9333, 0.9529, 0.8941],
                pillStroke: [0.3333, 0.4431, 0.4157], chipStroke: [0.851, 0.8902, 0.7569], white: [1, 1, 1], sea: [0.0902, 0.2902, 0.2745],
                coral: [1, 0.584, 0.584], muted: [0.62, 0.68, 0.65], bar: [0.55, 0.2, 0.2], gray: [0.4, 0.47, 0.44] };
    var FONT = { med: "InterTight-Medium", semi: "InterTight-SemiBold", bold: "InterTight-Bold", reg: "InterTight-Regular", ital: "InstrumentSerif-Italic" };
    var FPS = SPEC.fps || 24, W = 1920, H = 1080;
    function col(c) { return c instanceof Array ? c : PAL[c]; }
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
    function findItem(n) { for (var i = 1; i <= proj.numItems; i++) if (proj.item(i).name === n) return proj.item(i); return null; }
    function importOnce(path) {
        var f = new File(SS_ROOT + "/" + path);
        if (!f.exists) throw new Error("Missing media: " + path);
        for (var i = 1; i <= proj.numItems; i++) { var it = proj.item(i); if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) return it; }
        return proj.importFile(new ImportOptions(f));
    }
    var folder = findItem("EXPLAINER");
    if (!(folder instanceof FolderItem)) folder = proj.items.addFolder("EXPLAINER");
    // remove previous build (scenes and element precomps)
    for (var r = proj.numItems; r >= 1; r--) { var it = proj.item(r); if (it instanceof CompItem && (it.name.indexOf("EX_") === 0)) it.remove(); }

    // text layer with its anchor at the top-left of its box, so `at` matches Figma
    function text(comp, s, font, size, color, at, tracking) {
        var L = comp.layers.addText(s), tp = L.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
        td.resetCharStyle(); td.font = FONT[font] || font; td.fontSize = size; td.fillColor = col(color); td.applyFill = true;
        td.justification = ParagraphJustification.LEFT_JUSTIFY;
        if (tracking) td.tracking = tracking;
        if (size >= 100) { td.autoLeading = false; td.leading = size * 0.9; }
        tp.setValue(td);
        var b = L.sourceRectAtTime(0, false);
        tr(L, "ADBE Anchor Point").setValue([b.left, b.top]);
        tr(L, "ADBE Position").setValue(at);
        L.name = s.substr(0, 40);
        return L;
    }
    function roundRect(comp, w, h, rad, fill, stroke, sw, name) {
        var L = comp.layers.addShape(); L.name = name || "box";
        var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var rr = g.addProperty("ADBE Vector Shape - Rect"); rr.property("ADBE Vector Rect Size").setValue([w, h]); rr.property("ADBE Vector Rect Roundness").setValue(Math.min(rad, Math.min(w, h) / 2));
        if (fill) g.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(col(fill));
        if (stroke) { var st = g.addProperty("ADBE Vector Graphic - Stroke"); st.property("ADBE Vector Stroke Color").setValue(col(stroke)); st.property("ADBE Vector Stroke Width").setValue(sw || 2); }
        tr(L, "ADBE Position").setValue([w / 2, h / 2]);
        return L;
    }
    function sub(name, w, h, dur) {   // element precomp
        var c = proj.items.addComp("EX_el · " + name, Math.max(4, Math.round(w)), Math.max(4, Math.round(h)), 1, dur, FPS);
        c.parentFolder = folder; c.bgColor = [0, 0, 0];
        return c;
    }
    function place(scene, c, at) {
        var L = scene.layers.add(c); L.name = c.name.replace("EX_el · ", "");
        tr(L, "ADBE Position").setValue([at[0] + c.width / 2, at[1] + c.height / 2]);
        return L;
    }
    function animate(L, e, dur, isText) {
        var t = e.t || 0;
        L.inPoint = Math.max(0, Math.min(t, dur - 0.1)); L.outPoint = dur;
        if (e.preset && isText) SSP.applyText(L, e.preset, "in", t);
        if (e.motion) SSP.apply(L, e.motion, "in", t);
        if (!e.preset && !e.motion) SSP.apply(L, "Fade", "in", t);
        if (e.fx) SSP.applyFx(L, e.fx);
        if (e.attention) SSP.apply(L, e.attention.name, "in", e.attention.t);
    }
    function pillComp(e, dur, dark) {
        var size = e.size || 30, padX = e.padX || 28, padY = e.padY || 14;
        var tmp = proj.items.addComp("EX_tmp", 1920, 400, 1, 1, FPS), tl = text(tmp, e.text, e.font || "med", size, "pine", [0, 0]);
        var b = tl.sourceRectAtTime(0, false); tmp.remove();
        var w = b.width + padX * 2, h = b.height + padY * 2;
        var c = sub("pill " + e.text, w, h, dur);
        roundRect(c, w - 2, h - 2, h / 2, e.fill || (dark ? null : "white"), dark ? "pillStroke" : "chipStroke", 2).property("ADBE Transform Group").property("ADBE Position").setValue([w / 2, h / 2]);
        text(c, e.text, e.font || "med", size, e.color || (dark ? "cloud" : "pine"), [padX, padY]);
        return c;
    }
    function cardComp(e, dur) {
        var c = sub("card " + (e.name || ""), e.size[0], e.size[1], dur);
        roundRect(c, e.size[0], e.size[1], e.radius || 0, e.fill, e.stroke, e.strokeWidth || 2);
        for (var i = 0; i < (e.items || []).length; i++) {
            var it = e.items[i];
            if (it.type === "media") { mediaInto(c, it, dur); continue; }
            if (it.type === "box") { var bx = roundRect(c, it.size[0], it.size[1], it.radius || 0, it.fill, it.stroke, 2); tr(bx, "ADBE Position").setValue([it.at[0] + it.size[0] / 2, it.at[1] + it.size[1] / 2]); continue; }
            text(c, it.text, it.font || "reg", it.size, it.color || "pine", it.at, it.tracking);
        }
        return c;
    }
    // footage scaled to cover a rounded box, matted by a rounded rectangle
    function mediaInto(c, e, dur) {
        var item = importOnce(e.file), w = e.size[0], h = e.size[1];
        var M = roundRect(c, w, h, e.radius || 0, "white", null, 0, "matte"); tr(M, "ADBE Position").setValue([e.at[0] + w / 2, e.at[1] + h / 2]);
        var L = c.layers.add(item); L.name = "media";
        var k = Math.max(w / item.width, h / item.height) * 100 * (e.zoom || 1);
        tr(L, "ADBE Scale").setValue([k, k, 100]); tr(L, "ADBE Position").setValue([e.at[0] + w / 2 + (e.offset ? e.offset[0] : 0), e.at[1] + h / 2 + (e.offset ? e.offset[1] : 0)]);
        if (item.mainSource && !item.mainSource.isStill) {
            item.mainSource.loop = 20; try { L.audioEnabled = false; } catch (x) {}
            if (e.skip) L.startTime = -e.skip;   // start the clip where its content is already on screen
            L.inPoint = 0; L.outPoint = dur;
        }
        L.moveAfter(M); L.setTrackMatte(M, TrackMatteType.ALPHA); M.enabled = false;
        return L;
    }
    function mediaComp(e, dur) {
        var c = sub("media " + e.file.split("/").pop(), e.size[0], e.size[1], dur);
        mediaInto(c, { file: e.file, at: [0, 0], size: e.size, radius: e.radius, zoom: e.zoom, offset: e.offset, skip: e.skip }, dur);
        return c;
    }

    var made = [];
    for (var s = 0; s < SPEC.scenes.length; s++) {
        var S = SPEC.scenes[s], dur = S.dur;
        var C = proj.items.addComp(S.comp, W, H, 1, dur, FPS); C.parentFolder = folder;
        var BG = C.layers.addSolid(col(S.bg), "BG", W, H, 1); BG.locked = true;
        for (var e = 0; e < S.elements.length; e++) {
            var E = S.elements[e], L = null, isText = false;
            if (E.type === "text") { L = text(C, E.text, E.font || "med", E.size, E.color || (S.bg === "pine" ? "cloud" : "pine"), E.at, E.tracking); isText = true; }
            else if (E.type === "pill") L = place(C, pillComp(E, dur, S.bg === "pine" && !E.light), E.at);
            else if (E.type === "card") L = place(C, cardComp(E, dur), E.at);
            else if (E.type === "media") L = place(C, mediaComp(E, dur), E.at);
            else if (E.type === "rect") { L = roundRect(C, E.size[0], E.size[1], E.radius || 0, E.fill, E.stroke, E.strokeWidth); tr(L, "ADBE Position").setValue([E.at[0] + E.size[0] / 2, E.at[1] + E.size[1] / 2]); }
            else if (E.type === "marker") {
                // a marker bar + label sliding from `from` to `at` on a token curve (shows retiming)
                var mc = sub("marker " + E.label, 260, 170, dur);
                var bar = roundRect(mc, 6, 120, 0, E.color); tr(bar, "ADBE Position").setValue([3, 60]);
                text(mc, E.label, "semi", 30, E.color, [18, 120]);
                L = place(C, mc, E.from);
                L.inPoint = 0; L.outPoint = dur;
                SSM.animate(tr(L, "ADBE Position"), E.t, [E.from[0] + 130, E.from[1] + 85], [E.at[0] + 130, E.at[1] + 85], E.duration || "Stage", E.ease || "Whip");
                SSP.apply(L, "Fade", "in", Math.max(0, E.t - 0.4));
                continue;
            }
            if (!L) continue;
            animate(L, E, dur, isText);
        }
        // motion blur on everything that moves
        C.motionBlur = true;
        for (var m = 1; m <= C.numLayers; m++) { try { if (!C.layer(m).locked) C.layer(m).motionBlur = true; } catch (x) {} }
        made.push(S.comp + " " + dur.toFixed(2) + "s");
    }
    proj.save();
    return "explainer: " + made.join(", ");
})();
