// Comp SS_Presets_Showcase: un ejemplo por preset (in + out), con etiqueta de canales y energía.
#include "ss_presets.jsx"
var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    var ROOT = SS_ROOT + "/";
    var PAL = SSM.readJSON(ROOT + "assets/figma_essentials/palette.json").colors;
    var ICON = SSM.readJSON(ROOT + "assets/superside/ss_icon_shape.json");
    function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    var proj = app.project;
    for (var i = proj.numItems; i >= 1; i--) if (proj.item(i) instanceof CompItem && proj.item(i).name === "SS_Presets_Showcase") proj.item(i).remove();
    var c = proj.items.addComp("SS_Presets_Showcase", 1920, 1080, 1, 3, 30);
    c.layers.addSolid(hex(PAL.pine), "BG Pine", 1920, 1080, 1).locked = true;
    var names = SSP.names();
    function label(txt, x, y, size, col) {
        var L = c.layers.addText(txt);
        var tp = L.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
        td.resetCharStyle(); td.font = "ArialMT"; td.fontSize = size; td.fillColor = hex(col); td.applyFill = true;
        td.justification = ParagraphJustification.CENTER_JUSTIFY; tp.setValue(td);
        L.property("ADBE Transform Group").property("ADBE Position").setValue([x, y]);
        return L;
    }
    function subject(name, x, y) {
        var L = c.layers.addShape(); L.name = name;
        var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        g.property("ADBE Vector Transform Group").property("ADBE Vector Scale").setValue([22, 22]);
        var v = g.property("ADBE Vectors Group");
        var sh = new Shape(); var P = ICON.paths[0];
        sh.vertices = P.v; sh.inTangents = P.i; sh.outTangents = P.o; sh.closed = P.closed;
        v.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
        if (name === "Line Draw") {
            var st = v.addProperty("ADBE Vector Graphic - Stroke");
            st.property("ADBE Vector Stroke Color").setValue(hex(PAL.spark)); st.property("ADBE Vector Stroke Width").setValue(14);
        } else if (name === "Wipe Reveal") {
            v.property(1).remove();
            var r = v.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([260, 34]);
            r.property("ADBE Vector Rect Roundness").setValue(17);
            g.property("ADBE Vector Transform Group").property("ADBE Vector Scale").setValue([100, 100]);
            v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL.coral));
        } else {
            v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL.spark));
        }
        L.property("ADBE Transform Group").property("ADBE Position").setValue([x, y]);
        return L;
    }
    var cols = 5, cw = 1920 / cols;
    for (var n = 0; n < names.length; n++) {
        var x = cw * (n % cols) + cw / 2, y = 300 + Math.floor(n / cols) * 440;
        var L = subject(names[n], x, y);
        SSP.apply(L, names[n], "both");
        var pr = SSP.presets[names[n]];
        label(names[n], x, y + 150, 30, PAL.cloud);
        label(pr.channels + " · " + pr.energy, x, y + 190, 20, pr.energy === "dinámico" ? PAL.coral : pr.energy === "medio" ? PAL.spark : PAL.grey);
    }
    proj.save();
    return "showcase ok: " + names.length + " presets";
})();
