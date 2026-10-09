// Visual test (and sample material): builds mosaic comps that show the library working, and queues them for render.
//   TEST_STYLES   the 6 styles applied to the same layout (title, subtitle, body, chip, media card, logo arrow)
//   TEST_MIX      three feels mixed by tags on that layout (calm + elegant, dynamic + bold, playful)
//   TEST_CONTROLS one move with the panel's controls: default, duration 2x, intensity 50 %, mirrored, Whip, Settle
// Renders to renders/TEST_*.mp4 with aerender (tools/render_queue_aerender.sh); python tools/test_all.py does it all.
// Run: bash tools/bridge.sh tools/test_mosaics.jsx 600
#include "ss_presets.jsx"
(function () {
    var proj = app.project, W = 1920, H = 1080, D = 4, FPS = 30;
    var PAL = SSM.readJSON(SS_ROOT + "/assets/figma_essentials/palette.json").colors;
    var ARROW = SSM.readJSON(SS_ROOT + "/assets/motion_dna/sample_shape.json").paths[0];
    var TAGS = SSM.readJSON(SS_ROOT + "/library/tags.json");
    function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
    for (var i = proj.numItems; i >= 1; i--) if (proj.item(i) instanceof CompItem && proj.item(i).name.indexOf("TEST_") === 0) proj.item(i).remove();
    var folder = null; for (i = 1; i <= proj.numItems; i++) if (proj.item(i) instanceof FolderItem && proj.item(i).name === "TESTS") folder = proj.item(i);
    if (!folder) folder = proj.items.addFolder("TESTS");
    function comp(name, w, h) { var c = proj.items.addComp(name, w, h, 1, D, FPS); c.parentFolder = folder; var bg = c.layers.addSolid(hex(PAL.pine), "BG", w, h, 1); bg.locked = true; return c; }
    function text(c, s, role, size, color, at) {
        var L = c.layers.addText(s), tp = L.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
        td.resetCharStyle(); td.font = SSM.font(role); td.fontSize = size; td.fillColor = hex(PAL[color]); td.applyFill = true;
        td.justification = ParagraphJustification.LEFT_JUSTIFY; tp.setValue(td); tr(L, "ADBE Position").setValue(at); return L;
    }
    function rect(c, name, w, h, rad, color, at) {
        var L = c.layers.addShape(); L.name = name;
        var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var r = g.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([w, h]); r.property("ADBE Vector Rect Roundness").setValue(rad);
        g.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL[color]));
        tr(L, "ADBE Position").setValue(at); return L;
    }
    function arrow(c, name, at, scale) {
        var L = c.layers.addShape(); L.name = name;
        var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        g.property("ADBE Vector Transform Group").property("ADBE Vector Scale").setValue([scale, scale]);
        var sh = new Shape(); sh.vertices = ARROW.v; sh.inTangents = ARROW.i; sh.outTangents = ARROW.o; sh.closed = true;
        g.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
        g.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL.spark));
        tr(L, "ADBE Position").setValue(at); return L;
    }
    function layout(name) {   // 960x540: a small brand layout with one layer per role
        var c = comp(name, 960, 540);
        arrow(c, "Logo · arrow", [100, 70], 9);
        text(c, "Motion DNA", "display", 84, "cloud", [60, 230]);
        text(c, "STYLE TEST", "ui", 22, "spark", [64, 120]);
        text(c, "Moves that feel like the brand.", "ui_regular", 13, "cloud", [64, 290]);
        rect(c, "Chip", 140, 40, 20, "spark", [134, 380]);
        var card = c.layers.addSolid(hex(PAL.sea), "Media card", 320, 260, 1); tr(card, "ADBE Position").setValue([730, 270]);
        return c;
    }
    function label(c, s, at) { var L = text(c, s, "ui", 26, "spark", at); L.name = "label"; return L; }
    function grid(name, cells, cols, labels) {   // cells: comps of 960x540, scaled into a grid with labels
        var rows = Math.ceil(cells.length / cols), cw = W / cols, ch = H / rows, k = Math.min(cw / 960, ch / 540) * 0.94;
        var g = comp(name, W, H);
        for (var n = 0; n < cells.length; n++) {
            var L = g.layers.add(cells[n]), cx = (n % cols + 0.5) * cw, cy = (Math.floor(n / cols) + 0.5) * ch;
            tr(L, "ADBE Position").setValue([cx, cy]); tr(L, "ADBE Scale").setValue([k * 100, k * 100]);
            label(g, labels[n], [cx - 960 * k / 2 + 14, cy + 540 * k / 2 - 14]);   // under the layout, never over it
        }
        return g;
    }
    var made = [];

    // 1) styles
    var packs = SSP.packs(), cells = [], labels = [];
    for (var p = 0; p < packs.length; p++) {
        var c1 = layout("TEST_style__" + packs[p].slug);
        SSP.applyPack(c1, packs[p].name, null, "both");
        cells.push(c1); labels.push(packs[p].name + "  ·  " + (packs[p].tones || []).join(" · "));
    }
    made.push(grid("TEST_STYLES", cells, 3, labels).name);

    // 2) mix by tags (the panel's Mix logic): best move per role + best curve for the feel
    var ROLE_TARGET = { title: "title", subtitle: "text", body: "text", shape: "shape", media: "media", logo: "logo" };
    function score(t, lv, tone) { var s = (t.energy[0] <= lv && lv <= t.energy[1]) ? 2 : -Math.abs(lv - (t.energy[0] + t.energy[1]) / 2); for (var q = 0; q < t.tones.length; q++) if (t.tones[q] === tone) s += 2; return s; }
    function best(target, isText, lv, tone) {
        var b = null, bs = -99;
        for (var q = 0; q < TAGS.presets.length; q++) { var t = TAGS.presets[q];
            if (("," + t.roles.join(",") + ",").indexOf(",enter,") < 0 || ("," + t.targets.join(",") + ",").indexOf("," + target + ",") < 0) continue;
            if ((t.kind === "text" && !isText) || t.kind === "fx") continue;
            var s = score(t, lv, tone) + (isText && t.kind === "text" ? 0.5 : 0); if (s > bs) { bs = s; b = t; } }
        return b;
    }
    function curve(lv, tone) {
        var b = null, bs = -99, playful = tone === "playful" || tone === "bold";
        for (var q = 0; q < TAGS.curves.length; q++) { var c = TAGS.curves[q];
            if ((c.family === "overshoot" || c.family === "anticipation") && !playful) continue;
            if (c.family === "linear" && tone !== "technical") continue;
            var s = score(c, lv, tone); if (s > bs) { bs = s; b = c; } }
        return b ? b.name : null;
    }
    var feels = [[2, "elegant"], [5, "bold"], [4, "playful"]], mcells = [], mlabels = [];
    for (var f = 0; f < feels.length; f++) {
        var c2 = layout("TEST_mix__" + feels[f][1]), cv = curve(feels[f][0], feels[f][1]), used = [];
        for (var l = c2.numLayers; l >= 1; l--) {
            var L = c2.layer(l), role = SSP.roleOf(L); if (!role) continue;
            var mv = best(ROLE_TARGET[role], L instanceof TextLayer, feels[f][0], feels[f][1]); if (!mv) continue;
            SSP.tune({ ease: cv });
            if (mv.kind === "text") SSP.applyText(L, mv.name, "in", 0.2 + used.length * 0.12); else SSP.apply(L, mv.name, "in", 0.2 + used.length * 0.12);
            SSP.tune(); used.push(mv.name);
        }
        mcells.push(c2); mlabels.push("Mix · energy " + feels[f][0] + " · " + feels[f][1] + " · " + cv);
    }
    made.push(grid("TEST_MIX", mcells, 3, mlabels).name);

    // 3) controls on one move
    var variants = [["As designed", {}], ["Duration 2x", { speed: 2 }], ["Intensity 50 %", { intensity: 0.5 }],
                    ["Mirrored", { flipX: true }], ["Easing: Whip", { ease: "Whip" }], ["Easing: Settle", { ease: "Settle" }]], ccells = [], clabels = [];
    for (var v = 0; v < variants.length; v++) {
        var c3 = comp("TEST_ctrl__" + v, 960, 540), A = arrow(c3, "arrow", [480, 270], 30);
        SSP.tune(variants[v][1]); SSP.apply(A, "Slide Land", "both", 0.3); SSP.tune();
        ccells.push(c3); clabels.push("Slide Land · " + variants[v][0]);
    }
    made.push(grid("TEST_CONTROLS", ccells, 3, clabels).name);

    // queue
    var rq = proj.renderQueue, ex = [];
    if (!$.global.SS_KEEP_QUEUE) for (var r = rq.numItems; r >= 1; r--) rq.item(r).remove();
    for (var m = 0; m < made.length; m++) {
        var it = null; for (i = 1; i <= proj.numItems; i++) if (proj.item(i).name === made[m]) it = proj.item(i);
        var om = rq.items.add(it).outputModule(1); om.applyTemplate("H.264 - Match Render Settings - 15 Mbps");
        var out = new File(SS_ROOT + "/renders/" + made[m] + ".mp4"); om.file = out; ex.push(out.fsName);
    }
    var lf = new File(SS_ROOT + "/research/_render_expected.txt"); lf.encoding = "UTF-8"; lf.open("w"); lf.write(ex.join("\n")); lf.close();
    proj.save();
    return "mosaics: " + made.join(", ");
})();
