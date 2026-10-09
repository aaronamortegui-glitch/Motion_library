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
    var PFX = SPEC.prefix || "EX_", EL = PFX + "el · ";   // comp name prefix: each spec only replaces its own comps
    function col(c) { return c instanceof Array ? c : PAL[c]; }
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
    function findItem(n) { for (var i = 1; i <= proj.numItems; i++) if (proj.item(i).name === n) return proj.item(i); return null; }
    function importOnce(path) {
        var f = new File(SS_ROOT + "/" + path);
        if (!f.exists) throw new Error("Missing media: " + path);
        for (var i = 1; i <= proj.numItems; i++) { var it = proj.item(i); if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) return it; }
        return proj.importFile(new ImportOptions(f));
    }
    var folder = findItem(SPEC.folder || "EXPLAINER");
    if (!(folder instanceof FolderItem)) folder = proj.items.addFolder(SPEC.folder || "EXPLAINER");
    // remove previous build (scenes and element precomps)
    for (var r = proj.numItems; r >= 1; r--) { var it = proj.item(r); if (it instanceof CompItem && (it.name.indexOf(PFX) === 0)) it.remove(); }

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
        var c = proj.items.addComp(EL + name, Math.max(4, Math.round(w)), Math.max(4, Math.round(h)), 1, dur, FPS);
        c.parentFolder = folder; c.bgColor = [0, 0, 0];
        return c;
    }
    function place(scene, c, at) {
        var L = scene.layers.add(c); L.name = c.name.replace(EL, "");
        tr(L, "ADBE Position").setValue([at[0] + c.width / 2, at[1] + c.height / 2]);
        return L;
    }
    // Big shape transition: full-frame bars (main colour + accent) that whip across the frame.
    // mode "in": the scene starts covered and the bars leave (reveal). mode "out": the bars arrive and cover the
    // last frames, so the cut to the next scene happens under a solid colour. dir 1 = left to right, -1 = right to left.
    function wipe(C, E, dur) {
        var cols = E.colors || ["spark", "pine"], d = E.dir || 1, D = E.duration || 0.5, gap = E.gap || 0.07;
        var t0 = E.mode === "out" ? dur - D - gap * (cols.length - 1) : (E.t || 0);
        for (var i = 0; i < cols.length; i++) {
            var w = W * 1.25, L = roundRect(C, w, H + 40, 0, cols[i], null, 0, "wipe " + cols[i]);
            var off = d * (W / 2 + w / 2 + 20), mid = W / 2;
            var a, b, k = E.mode === "out" ? i : cols.length - 1 - i;   // the last colour is the one that touches the footage
            if (E.mode === "out") { a = [mid - off, H / 2]; b = [mid, H / 2]; }
            else { a = [mid, H / 2]; b = [mid + off, H / 2]; }
            SSM.animateRaw(tr(L, "ADBE Position"), t0 + k * gap, t0 + k * gap + D, a, b, SSM.ease(E.ease || "Whip"));
            if (E.mode === "out") { L.inPoint = Math.max(0, t0 + k * gap - 0.05); L.outPoint = dur; }
            else { L.inPoint = 0; L.outPoint = Math.min(dur, t0 + k * gap + D + 0.05); }
            L.motionBlur = true;
        }
    }
    function animate(L, e, dur, isText) {
        var t = e.t || 0;
        L.inPoint = Math.max(0, Math.min(t, dur - 0.1)); L.outPoint = e.until ? Math.min(dur, e.until) : dur;
        if (e.motion === "cut") return;   // hard cut on the beat, no entrance
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
        var item = e.comp ? compSource(e) : importOnce(e.file), w = e.size[0], h = e.size[1];
        var M = roundRect(c, w, h, e.radius || 0, "white", null, 0, "matte"); tr(M, "ADBE Position").setValue([e.at[0] + w / 2, e.at[1] + h / 2]);
        var L = c.layers.add(item); L.name = "media";
        var k = Math.max(w / item.width, h / item.height) * 100 * (e.zoom || 1);
        try { tr(L, "ADBE Scale").setValue([k, k, 100]); tr(L, "ADBE Position").setValue([e.at[0] + w / 2 + (e.offset ? e.offset[0] : 0), e.at[1] + h / 2 + (e.offset ? e.offset[1] : 0)]); }
        catch (x) { throw new Error("media " + (e.comp || e.file) + " (" + item.name + ", " + item.typeName + ", hasVideo " + L.hasVideo + "): " + x.toString()); }
        if (item instanceof CompItem) {
            try { L.audioEnabled = false; } catch (x) {}
            if (e.skip) L.startTime = -e.skip;
            L.inPoint = 0; L.outPoint = dur;
        } else if (item.mainSource && !item.mainSource.isStill) {
            item.mainSource.loop = 20; try { L.audioEnabled = false; } catch (x) {}
            if (e.rate && e.rate !== 1) L.stretch = 100 / e.rate;
            if (e.skip) L.startTime = -e.skip / (e.rate || 1);   // start the clip where its content is already on screen
            L.inPoint = 0; L.outPoint = dur;
        }
        if (e.push) {   // slow camera push over the scene (scale factor at the end), keeps footage alive
            var sc = tr(L, "ADBE Scale"); SSM.animateRaw(sc, 0, dur, [k, k, 100], [k * e.push, k * e.push, 100], SSM.ease("Cruise"));
        }
        L.moveAfter(M); L.setTrackMatte(M, TrackMatteType.ALPHA); M.enabled = false;
        return L;
    }
    // an existing comp (e.g. a tracked Cypher scene) as footage; "hide" disables layers whose name starts with any
    // of the given prefixes, in a duplicate owned by this spec, so the original comp is never touched
    function compSource(e) {
        var src = findItem(e.comp);
        if (!(src instanceof CompItem)) throw new Error("Missing comp: " + e.comp);
        if (!e.hide || !e.hide.length) return src;
        var d = src.duplicate(); d.name = PFX + "src " + e.comp; d.parentFolder = folder;
        for (var i = 1; i <= d.numLayers; i++)
            for (var h = 0; h < e.hide.length; h++) if (d.layer(i).name.indexOf(e.hide[h]) === 0) d.layer(i).enabled = false;
        return d;
    }
    // slow ambient lines: wavy strokes that draw on and drift (background texture instead of a static pattern)
    function lines(C, E, dur) {
        var n = E.count || 7, made = [];
        for (var i = 0; i < n; i++) {
            var L = C.layers.addShape(); L.name = "line " + (i + 1);
            var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
            var path = g.addProperty("ADBE Vector Shape - Group"), sh = new Shape(), pts = [], tin = [], tout = [];
            var y0 = (i + 0.5) * H / n, amp = 40 + (i % 3) * 30, seg = 5, step = (W + 600) / seg;
            for (var k = 0; k <= seg; k++) {
                pts.push([-300 + k * step, y0 + (k % 2 ? amp : -amp) * (i % 2 ? 1 : -1)]);
                tin.push([-step * 0.4, 0]); tout.push([step * 0.4, 0]);
            }
            sh.vertices = pts; sh.inTangents = tin; sh.outTangents = tout; sh.closed = false;
            path.property("ADBE Vector Shape").setValue(sh);
            var st = g.addProperty("ADBE Vector Graphic - Stroke");
            st.property("ADBE Vector Stroke Color").setValue(col(E.color || "spark"));
            st.property("ADBE Vector Stroke Width").setValue(E.width || 2);
            var tp = g.addProperty("ADBE Vector Filter - Trim");
            SSM.animateRaw(tp.property("ADBE Vector Trim End"), (E.t || 0) + i * 0.08, (E.t || 0) + i * 0.08 + 1.6, 0, 100, SSM.ease("Settle"));
            tr(L, "ADBE Position").setValue([0, 0]); tr(L, "ADBE Anchor Point").setValue([0, 0]);
            tr(L, "ADBE Position").expression = "value + [Math.sin(time * 0.35 + " + i + ") * 70, Math.cos(time * 0.27 + " + (i * 1.7) + ") * 28];";
            tr(L, "ADBE Opacity").setValue(E.opacity || 22);
            L.inPoint = 0; L.outPoint = dur;
            made.push(L);
        }
        return made;
    }
    function mediaComp(e, dur) {
        var c = sub("media " + (e.comp || e.file.split("/").pop()), e.size[0], e.size[1], dur);
        mediaInto(c, { file: e.file, comp: e.comp, hide: e.hide, at: [0, 0], size: e.size, radius: e.radius, zoom: e.zoom, offset: e.offset, skip: e.skip, rate: e.rate, push: e.push }, dur);
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
            else if (E.type === "media") {
                if (E.full) { E.at = [0, 0]; E.size = [W, H]; E.radius = 0; }
                L = place(C, mediaComp(E, dur), E.at);
                if (E.t) L.startTime = E.t;   // footage cut in on a word starts playing from that moment
            }
            else if (E.type === "rect") { L = roundRect(C, E.size[0], E.size[1], E.radius || 0, E.fill, E.stroke, E.strokeWidth); tr(L, "ADBE Position").setValue([E.at[0] + E.size[0] / 2, E.at[1] + E.size[1] / 2]); if (E.opacity !== undefined) tr(L, "ADBE Opacity").setValue(E.opacity); }
            else if (E.type === "wipe") { wipe(C, E, dur); continue; }
            else if (E.type === "lines") { lines(C, E, dur); continue; }
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
