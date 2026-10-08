// Crea una comp por sección del panel de Animation Composer (Motion Presets + Effects),
// cada una con 8 capas-slot. El usuario aplica un preset distinto de esa carpeta a cada slot
// (seleccionar slot → doble clic en la miniatura) y renombra el slot con el nombre del preset si quiere.
// Luego harvest.jsx cosecha receta + curvas de todas las comps "AC_".
(function () {
    var SECTIONS = {
        "2D": ["Blur & Fade", "Blur & Fade & Warp", "Fade", "Fade & Position", "Fade & Position & Scale", "Fade & Rotate",
               "Fade & Scale", "Position", "Position & Rotate", "Position & Rotate & Scale", "Position & Scale", "Rotate",
               "Rotate & Scale", "Scale"],
        "3D": ["Fade & Rotate", "Position", "Position & Rotate", "Position & Rotate & Scale", "Position & Scale", "Rotate", "Rotate & Scale"],
        "FX": ["Blur & Warp", "Color Effects", "Isometric", "Long Shadow & Extrude", "Position", "Position & Rotate & Scale",
               "Position & Rotation", "Position & Scale", "Rotate", "Scale", "Warp"]
    };
    var SLOTS = 8;
    var proj = app.project;
    var folder = null;
    for (var i = 1; i <= proj.numItems; i++) if (proj.item(i) instanceof FolderItem && proj.item(i).name === "AC Sections") folder = proj.item(i);
    if (!folder) folder = proj.items.addFolder("AC Sections");
    var made = 0;
    for (var group in SECTIONS) {
        if (!SECTIONS.hasOwnProperty(group)) continue;
        for (var s = 0; s < SECTIONS[group].length; s++) {
            var name = "AC_" + group + " · " + SECTIONS[group][s];
            var exists = false;
            for (var k = 1; k <= proj.numItems; k++) if (proj.item(k).name === name) exists = true;
            if (exists) continue;
            var c = proj.items.addComp(name, 1920, 1080, 1, 3, 30);
            c.parentFolder = folder;
            var bg = c.layers.addSolid([0.039, 0.129, 0.122], "BG Pine", 1920, 1080, 1);
            bg.locked = true;
            for (var n = 0; n < SLOTS; n++) {
                var L = c.layers.addShape();
                L.name = "slot " + (n + 1);
                var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
                var r = g.addProperty("ADBE Vector Shape - Rect");
                r.property("ADBE Vector Rect Size").setValue([200, 200]);
                r.property("ADBE Vector Rect Roundness").setValue(36);
                g.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue([0.847, 1, 0.522]);
                L.property("ADBE Transform Group").property("ADBE Position").setValue([300 + (n % 4) * 440, 330 + Math.floor(n / 4) * 420]);
                L.label = 9;
            }
            made++;
        }
    }
    proj.save();
    return made + " comps de sección creadas en la carpeta 'AC Sections'";
})();
