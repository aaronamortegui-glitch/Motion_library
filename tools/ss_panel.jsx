// SS Motion — panel para aplicar los presets propios de Superside a las capas seleccionadas.
// Abrir: File > Scripts > Run Script File… (ventana flotante)
// o copiar a ".../Support Files/Scripts/ScriptUI Panels" para tenerlo en Window.
#include "ss_presets.jsx"

var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function (thisObj) {
    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "SS Motion", undefined, { resizeable: true });
    win.orientation = "column"; win.alignChildren = ["fill", "top"];

    var tabs = win.add("tabbedpanel");
    var tM = tabs.add("tab", undefined, "Motion");
    var tF = tabs.add("tab", undefined, "Effects");
    tabs.selection = tM;

    // ---- Motion ----
    tM.alignChildren = ["fill", "top"];
    var gE = tM.add("group"); gE.add("statictext", undefined, "Energía:");
    var energy = gE.add("dropdownlist", undefined, ["todas", "suave", "medio", "dinámico"]); energy.selection = 0;
    var list = tM.add("listbox", [0, 0, 300, 200]);
    var info = tM.add("statictext", undefined, " ", { multiline: true }); info.preferredSize.height = 34;
    var gP = tM.add("group");
    var rIn = gP.add("radiobutton", undefined, "In"), rOut = gP.add("radiobutton", undefined, "Out"), rBoth = gP.add("radiobutton", undefined, "In + Out");
    rBoth.value = true;
    var gS = tM.add("group"); gS.add("statictext", undefined, "Escalonar (frames):");
    var stag = gS.add("edittext", undefined, String(SSM.frames("Tick"))); stag.characters = 4;
    var bApply = tM.add("button", undefined, "Aplicar a seleccionadas");

    function refill() {
        list.removeAll();
        var names = SSP.names(), want = energy.selection.text;
        for (var i = 0; i < names.length; i++) {
            var p = SSP.presets[names[i]];
            if (want === "todas" || p.energy === want) list.add("item", names[i]);
        }
        if (list.items.length) list.selection = 0;
    }
    energy.onChange = refill;
    list.onChange = function () {
        if (!list.selection) return;
        var p = SSP.presets[list.selection.text];
        info.text = p.channels + " · " + p.energy + "\n" + p.use;
    };
    refill();

    // ---- Effects ----
    tF.alignChildren = ["fill", "top"];
    var flist = tF.add("listbox", [0, 0, 300, 200]);
    var finfo = tF.add("statictext", undefined, " ", { multiline: true }); finfo.preferredSize.height = 34;
    var fn = SSP.effectNames();
    for (var j = 0; j < fn.length; j++) flist.add("item", fn[j]);
    flist.selection = 0;
    flist.onChange = function () {
        if (!flist.selection) return;
        var f = SSP.effects[flist.selection.text];
        finfo.text = f.channels + " · " + f.energy + "\n" + f.use;
    };
    var bFx = tF.add("button", undefined, "Aplicar efecto a seleccionadas");

    function selected() {
        var c = app.project.activeItem;
        if (!(c instanceof CompItem) || !c.selectedLayers.length) { alert("Selecciona capas en una composición."); return null; }
        return c.selectedLayers;
    }
    bApply.onClick = function () {
        var ls = selected(); if (!ls || !list.selection) return;
        var phase = rIn.value ? "in" : rOut.value ? "out" : "both";
        var st = (parseFloat(stag.text) || 0) * ls[0].containingComp.frameDuration;
        app.beginUndoGroup("SS Motion: " + list.selection.text);
        try {
            for (var i = 0; i < ls.length; i++) {
                var L = ls[i];
                // en "both" el escalonado se aplica a la entrada; la salida queda anclada al outPoint
                var t0 = (phase === "out" ? L.outPoint - SSM.seconds("Arrive") : L.inPoint) + i * st;
                SSP.apply(L, list.selection.text, phase, t0);
            }
        } catch (e) { alert("Error: " + e.toString() + " (línea " + e.line + ")"); }
        app.endUndoGroup();
    };
    bFx.onClick = function () {
        var ls = selected(); if (!ls || !flist.selection) return;
        app.beginUndoGroup("SS FX: " + flist.selection.text);
        try { for (var i = 0; i < ls.length; i++) SSP.applyFx(ls[i], flist.selection.text); }
        catch (e) { alert("Error: " + e.toString() + " (línea " + e.line + ")"); }
        app.endUndoGroup();
    };

    if (win instanceof Window) { win.center(); win.show(); } else win.layout.layout(true);
})(this);
