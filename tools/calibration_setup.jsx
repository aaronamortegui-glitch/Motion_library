// Creates the CALIBRATION comp with one S-mark layer per preset to test.
// The user applies to each layer the Animation Composer preset named by the layer;
// then calibration_dump.jsx dumps keyframes/eases from all of them to calibrate the analyzer.
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
        "2D Transitions / Position & Scale / (first in folder)",
        "2D Transitions / Rotate & Scale / (first in folder)",
        "2D Transitions / Scale / (first in folder)",
        "3D Transitions / Fade & Rotate / (first in folder)",
        "Effects / Long Shadow & Extrude / (first in folder)"
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
        // simple, clean layer (no keys) so only the preset's keys exist
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
    return "CALIBRATION created with " + PRESETS.length + " layers";
})();
