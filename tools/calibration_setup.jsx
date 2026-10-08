// Crea la comp CALIBRATION con una capa S-mark por preset a probar.
// El usuario aplica a cada capa el preset de Animation Composer que indica su nombre;
// después calibration_dump.jsx vuelca keyframes/eases de todas para calibrar el analizador.
var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    var ROOT = SS_ROOT + "/";
    var PRESETS = [
        "2D Transitions / Fade / Fade Linear 1",
        "2D Transitions / Fade / Fade Cubic In 1",
        "2D Transitions / Fade / Fade Cubic In & Out 1",
        "2D Transitions / Fade & Position / Ease Fade & Position 1",
        "2D Transitions / Fade & Position / Overshoot Fade & Position 1",
        "2D Transitions / Blur & Fade / Gaussian Blur & Fade Eased 1",
        "2D Transitions / Blur & Fade & Warp / Fast Blur & Fade & Warp 1",
        "2D Transitions / Position & Scale / (primero de la carpeta)",
        "2D Transitions / Rotate & Scale / (primero de la carpeta)",
        "2D Transitions / Scale / (primero de la carpeta)",
        "3D Transitions / Fade & Rotate / (primero de la carpeta)",
        "Effects / Long Shadow & Extrude / (primero de la carpeta)"
    ];
    var proj = app.project;
    var comp = proj.items.addComp("CALIBRATION", 1920, 1080, 1, 3, 30);
    var src = null;
    for (var i = 1; i <= proj.numItems; i++) {
        var it = proj.item(i);
        if (it instanceof CompItem && it.name === "01_SS_Icon_Intro") src = it;
    }
    var bg = comp.layers.addSolid([0.039, 0.129, 0.122], "BG Pine", 1920, 1080, 1);
    bg.locked = true;
    for (var p = 0; p < PRESETS.length; p++) {
        // capa simple y limpia (sin keys) para que solo existan las del preset
        var L = comp.layers.addShape();
        L.name = ("0" + (p + 1)).slice(-2) + " · " + PRESETS[p];
        var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var r = g.addProperty("ADBE Vector Shape - Rect");
        r.property("ADBE Vector Rect Size").setValue([220, 220]);
        r.property("ADBE Vector Rect Roundness").setValue(40);
        g.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue([0.847, 1, 0.522]);
        var col = p % 4, row = Math.floor(p / 4);
        L.property("ADBE Transform Group").property("ADBE Position").setValue([300 + col * 440, 220 + row * 320]);
        L.label = 9;
    }
    comp.openInViewer();
    proj.save();
    return "CALIBRATION creada con " + PRESETS.length + " capas";
})();
