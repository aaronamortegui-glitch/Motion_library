// Vuelca todas las capas de CALIBRATION con el inspector y deja el JSON en research/inspections.
var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    var proj = app.project, comp = null;
    for (var i = 1; i <= proj.numItems; i++) if (proj.item(i) instanceof CompItem && proj.item(i).name === "CALIBRATION") comp = proj.item(i);
    if (!comp) return "No existe la comp CALIBRATION";
    comp.openInViewer();
    for (var j = 1; j <= comp.numLayers; j++) comp.layer(j).selected = comp.layer(j).name !== "BG Pine";
    $.evalFile(new File(SS_ROOT + "/tools/inspect_selected.jsx"));
    return "dump ok: " + (comp.numLayers - 1) + " capas";
})();
