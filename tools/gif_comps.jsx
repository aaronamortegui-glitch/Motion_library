// Creates a small comp per preset ("GIF Previews" folder) to render the viewer GIFs.
// Name: GIF__<kind>__<preset>  (kind: motion | fx | text)
#include "ss_presets.jsx"
var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    var ROOT = SS_ROOT + "/";
    var PAL = SSM.readJSON(ROOT + "assets/figma_essentials/palette.json").colors;
    var ICON = SSM.readJSON(ROOT + "assets/superside/ss_icon_shape.json");
    function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    var proj = app.project, W = 640, H = 360;
    var folder = null;
    for (var i = proj.numItems; i >= 1; i--) {
        var it = proj.item(i);
        if (it instanceof CompItem && it.name.indexOf("GIF__") === 0) it.remove();
        else if (it instanceof FolderItem && it.name === "GIF Previews") folder = it;
    }
    if (!folder) folder = proj.items.addFolder("GIF Previews");
    function comp(kind, name, dur) {
        var c = proj.items.addComp("GIF__" + kind + "__" + name, W, H, 1, dur, 30);
        c.parentFolder = folder;
        c.layers.addSolid(hex(PAL.pine), "BG", W, H, 1).locked = true;
        return c;
    }
    function smark(c, name, stroke) {
        var L = c.layers.addShape(); L.name = name;
        var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        g.property("ADBE Vector Transform Group").property("ADBE Vector Scale").setValue([30, 30]);
        var v = g.property("ADBE Vectors Group"), P = ICON.paths[0], sh = new Shape();
        sh.vertices = P.v; sh.inTangents = P.i; sh.outTangents = P.o; sh.closed = P.closed;
        v.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
        if (stroke) {
            var st = v.addProperty("ADBE Vector Graphic - Stroke");
            st.property("ADBE Vector Stroke Color").setValue(hex(PAL.spark)); st.property("ADBE Vector Stroke Width").setValue(14);
        } else v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL.spark));
        L.property("ADBE Transform Group").property("ADBE Position").setValue([W / 2, H / 2]);
        return L;
    }
    function bar(c) {
        var L = c.layers.addShape(); L.name = "bar";
        var v = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var r = v.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([380, 64]); r.property("ADBE Vector Rect Roundness").setValue(32);
        v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL.coral));
        L.property("ADBE Transform Group").property("ADBE Position").setValue([W / 2, H / 2]);
        return L;
    }
    function text(c, str, font, size) {
        var L = c.layers.addText(str);
        var tp = L.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
        td.resetCharStyle(); td.font = font; td.fontSize = size; td.fillColor = hex(PAL.cloud); td.applyFill = true;
        td.justification = ParagraphJustification.CENTER_JUSTIFY; tp.setValue(td);
        L.property("ADBE Transform Group").property("ADBE Position").setValue([W / 2, H / 2 + size * 0.35]);
        return L;
    }
    var made = [];
    var m = SSP.names();
    for (var a = 0; a < m.length; a++) {
        var c = comp("motion", m[a], 2.4);
        var L = m[a] === "Wipe Reveal" ? bar(c) : smark(c, m[a], /Draw|Stroke/.test(m[a]));
        SSP.apply(L, m[a], "both", 0.2);
        made.push(c.name);
    }
    var fx = SSP.effectNames();
    for (var b = 0; b < fx.length; b++) {
        var c2 = comp("fx", fx[b], 3);
        SSP.applyFx(smark(c2, fx[b], false), fx[b]);
        made.push(c2.name);
    }
    var tx = SSP.textNames();
    var sample = { "Chars Rise": ["Superside", SSM.font("display"), 96], "Words Fade Up": ["Built for speed", SSM.font("ui"), 56],
        "Blur Words": ["Calm and premium", SSM.font("display"), 64], "Tracking Settle": ["MOTION LAB", SSM.font("ui"), 54],
        "Chars Pop": ["5,000", SSM.font("ui"), 110], "Typewriter": ["Hello, Superside", SSM.font("ui"), 60],
        "Scramble": ["SS MOTION", SSM.font("ui"), 84], "Count Up": ["12,480", SSM.font("ui"), 110],
        "Words Slam": ["Words Slam", SSM.font("display"), 80] };
    for (var d = 0; d < tx.length; d++) {
        var c3 = comp("text", tx[d], 2.4);
        var sm = sample[tx[d]] || [tx[d], SSM.font("ui"), 60];
        SSP.applyText(text(c3, sm[0], sm[1], sm[2]), tx[d], "both", 0.2);
        made.push(c3.name);
    }
    // Harvested recipes (reproduced with our library, not with the plugin)
    var rids = SSP.recipeIds();
    for (var r = 0; r < rids.length; r++) {
        var c4 = comp("recipe", rids[r], 3);
        var sq = c4.layers.addShape(); sq.name = rids[r];
        var gv = sq.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var rr = gv.addProperty("ADBE Vector Shape - Rect"); rr.property("ADBE Vector Rect Size").setValue([120, 120]); rr.property("ADBE Vector Rect Roundness").setValue(24);
        gv.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL.spark));
        sq.property("ADBE Transform Group").property("ADBE Position").setValue([W / 2, H / 2]);
        SSP.applyRecipe(sq, rids[r], "both");
        made.push(c4.name);
    }
    var lf = new File(ROOT + "research/gif_comps.txt"); lf.encoding = "UTF-8"; lf.open("w"); lf.write(made.join("\n") + "\n"); lf.close();
    proj.save();
    return made.length + " GIF comps (list in research/gif_comps.txt)";
})();
