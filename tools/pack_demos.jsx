// Builds one PACK__<slug> demo per style in library/packs.json: a 2×2 grid that shows how the style moves each kind
// of layer — 1 title · 2 text (subtitle + body) · 3 shapes (the sample arrow as logo + chips) · 4 media (a card) —
// every quadrant animated by SSP.applyPack with the style's own curve. Queues them into library/packs/<slug>.mp4 and
// saves the project: render with aerender (bash tools/render_queue_aerender.sh), then bash tools/make_previews_stills.sh.
// Run: bash tools/bridge.sh tools/pack_demos.jsx 300   (used by tools/rebuild_previews.sh)
#include "ss_presets.jsx"
(function () {
    var proj = app.project, W = 1280, H = 720, QW = 632, QH = 352, GAP = 16, D = 3.2, made = [];
    var PAL = SSM.readJSON(SS_ROOT + "/assets/figma_essentials/palette.json").colors;
    function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
    var ARROW = SSM.readJSON(SS_ROOT + "/assets/motion_dna/sample_shape.json").paths[0];
    for (var i = proj.numItems; i >= 1; i--) if (proj.item(i) instanceof CompItem && proj.item(i).name.indexOf("PACK__") === 0) proj.item(i).remove();
    function text(c, s, role, size, color, at, just) {
        var L = c.layers.addText(s), tp = L.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
        td.resetCharStyle(); td.font = SSM.font(role); td.fontSize = size; td.fillColor = hex(PAL[color]); td.applyFill = true;
        td.justification = just || ParagraphJustification.LEFT_JUSTIFY; tp.setValue(td);
        tr(L, "ADBE Position").setValue(at); L.outPoint = D; return L;
    }
    function rect(c, name, w, h, rad, color, at) {
        var L = c.layers.addShape(); L.name = name;
        var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var r = g.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([w, h]); r.property("ADBE Vector Rect Roundness").setValue(rad);
        g.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL[color]));
        tr(L, "ADBE Position").setValue(at); L.outPoint = D; return L;
    }
    function arrow(c, at, scale) {
        var L = c.layers.addShape(); L.name = "Logo · arrow";   // the logo role: the neutral sample arrow
        var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        g.property("ADBE Vector Transform Group").property("ADBE Vector Scale").setValue([scale, scale]);
        var sh = new Shape(); sh.vertices = ARROW.v; sh.inTangents = ARROW.i; sh.outTangents = ARROW.o; sh.closed = ARROW.closed;
        g.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
        g.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL.spark));
        tr(L, "ADBE Position").setValue(at); L.outPoint = D; return L;
    }
    function quad(pk, n, build) {   // one quadrant: its own comp, background, caption, content, then the style
        var q = proj.items.addComp("PACK__" + pk.slug + "__" + n, QW, QH, 1, D, 30);
        var bg = q.layers.addSolid(hex(PAL.pine), "BG", QW, QH, 1); bg.locked = true;
        build(q);
        SSP.applyPack(q, pk.name, null, "in");
        var cap = text(q, n, "ui_regular", 18, "cloud", [24, QH - 22]); cap.name = "caption"; tr(cap, "ADBE Opacity").setValue(45);
        return q;
    }
    var packs = SSP.packs(), rq = proj.renderQueue, ex = [];
    if (!$.global.SS_KEEP_QUEUE) for (var r = rq.numItems; r >= 1; r--) rq.item(r).remove();
    Folder(SS_ROOT + "/library/packs").create();
    for (var p = 0; p < packs.length; p++) {
        var pk = packs[p];
        var q1 = quad(pk, "Title", function (q) { text(q, pk.name, "display", 96, "cloud", [40, 200]); });
        var q2 = quad(pk, "Text", function (q) {
            text(q, pk.name.toUpperCase() + " STYLE", "ui", 22, "spark", [40, 120]);
            text(q, "Moves that feel like the brand,\rnot like a template.", "ui_regular", 30, "cloud", [40, 175]);
        });
        var q3 = quad(pk, "Shapes", function (q) {
            arrow(q, [150, 150], 22);
            rect(q, "Chip 1", 130, 42, 21, "spark", [130, 260]); rect(q, "Chip 2", 130, 42, 21, "cloud", [280, 260]); rect(q, "Chip 3", 130, 42, 21, "coral", [430, 260]);
        });
        var q4 = quad(pk, "Media", function (q) {
            var card = q.layers.addSolid(hex(PAL.sea), "Media card", 300, 210, 1); tr(card, "ADBE Position").setValue([QW / 2, QH / 2 - 10]); card.outPoint = D;
        });
        var c = proj.items.addComp("PACK__" + pk.slug, W, H, 1, D, 30);
        c.layers.addSolid([0.03, 0.09, 0.08], "Grid gap", W, H, 1);
        var qs = [q1, q2, q3, q4];
        for (var k = 0; k < 4; k++) {
            var L = c.layers.add(qs[k]);
            tr(L, "ADBE Position").setValue([GAP / 2 + QW / 2 + (k % 2) * (QW + GAP / 2), GAP / 2 + QH / 2 + Math.floor(k / 2) * (QH + GAP / 2)]);
        }
        var it = rq.items.add(c), om = it.outputModule(1);
        try { om.applyTemplate("H.264 - Match Render Settings - 15 Mbps"); } catch (e) { try { om.applyTemplate("H.264"); } catch (e2) {} }
        var f = new File(SS_ROOT + "/library/packs/" + pk.slug + ".mp4");
        om.file = f; ex.push(f.fsName);
        made.push(c.name);
    }
    var lf = new File(SS_ROOT + "/research/_render_expected.txt"); lf.encoding = "UTF-8"; lf.open("w"); lf.write(ex.join("\n")); lf.close();
    proj.save();
    return "styles: " + made.join(", ");
})();
