// Builds one PACK__<slug> demo comp per pack in library/packs.json (title, subtitle, body, chips, a media card and a
// logo, all animated by SSP.applyPack) and queues them for render into library/packs/<slug>.mp4.
// Run: bash tools/bridge.sh tools/pack_demos.jsx 300   then   bash tools/wait_files.sh research/_render_expected.txt
#include "ss_presets.jsx"
(function () {
    var proj = app.project, W = 1280, H = 720, D = 3.2, made = [];
    var PAL = SSM.readJSON(SS_ROOT + "/assets/figma_essentials/palette.json").colors;
    function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
    var ICON = SSM.readJSON(SS_ROOT + "/assets/superside/ss_icon_shape.json").paths[0];
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
    var packs = SSP.packs(), rq = proj.renderQueue, ex = [];
    for (var r = rq.numItems; r >= 1; r--) rq.item(r).remove();
    Folder(SS_ROOT + "/library/packs").create();
    for (var p = 0; p < packs.length; p++) {
        var pk = packs[p], c = proj.items.addComp("PACK__" + pk.slug, W, H, 1, D, 30);
        c.layers.addSolid(hex(PAL.pine), "BG", W, H, 1);
        // media card: a solid "photo" (the pack moves it as media)
        var card = c.layers.addSolid(hex(PAL.sea), "Media card", 420, 470, 1); tr(card, "ADBE Position").setValue([930, 360]); card.outPoint = D;
        rect(c, "Chip 1", 150, 46, 23, "spark", [160, 560]); rect(c, "Chip 2", 150, 46, 23, "cloud", [330, 560]); rect(c, "Chip 3", 150, 46, 23, "coral", [500, 560]);
        var logo = c.layers.addShape(); logo.name = "Logo";
        var lg = logo.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        lg.property("ADBE Vector Transform Group").property("ADBE Vector Scale").setValue([16, 16]);
        var sh = new Shape(); sh.vertices = ICON.v; sh.inTangents = ICON.i; sh.outTangents = ICON.o; sh.closed = ICON.closed;
        lg.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
        lg.property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL.spark));
        tr(logo, "ADBE Position").setValue([110, 110]); logo.outPoint = D;
        text(c, "Built for speed", "display", 92, "cloud", [90, 330]);
        text(c, pk.name.toUpperCase() + " PACK", "ui", 30, "spark", [94, 220]);
        text(c, "Superside · AI Native Studio", "ui_regular", 26, "cloud", [94, 410]);
        SSP.applyPack(c, pk.name, null, "in");
        var it = rq.items.add(c), om = it.outputModule(1);
        try { om.applyTemplate("H.264 - Match Render Settings - 15 Mbps"); } catch (e) { try { om.applyTemplate("H.264"); } catch (e2) {} }
        var f = new File(SS_ROOT + "/library/packs/" + pk.slug + ".mp4");
        om.file = f; ex.push(f.fsName);
        made.push(c.name);
    }
    var lf = new File(SS_ROOT + "/research/_render_expected.txt"); lf.encoding = "UTF-8"; lf.open("w"); lf.write(ex.join("\n")); lf.close();
    proj.save();
    app.scheduleTask("app.project.renderQueue.render()", 300, false);
    return "packs: " + made.join(", ");
})();
