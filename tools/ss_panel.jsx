// SS Motion — panel to apply Superside's own presets to the selected layers.
// Open: File > Scripts > Run Script File… (floating window). Run it from tools/ so relative includes resolve.
#include "ss_presets.jsx"

var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function (thisObj) {
    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "SS Motion", undefined, { resizeable: true });
    win.orientation = "column"; win.alignChildren = ["fill", "top"];

    var tabs = win.add("tabbedpanel");
    var tM = tabs.add("tab", undefined, "Motion");
    var tT = tabs.add("tab", undefined, "Text");
    var tF = tabs.add("tab", undefined, "Effects");
    var tR = tabs.add("tab", undefined, "Recipes");
    tabs.selection = tM;

    // Builds a tab: energy filter, list, info, optional phase/stagger controls and an Apply button.
    function buildTab(tab, names, getMeta, withPhase, applyFn, buttonLabel) {
        tab.alignChildren = ["fill", "top"];
        var gE = tab.add("group"); gE.add("statictext", undefined, "Energy:");
        var energy = gE.add("dropdownlist", undefined, ["all", "soft", "medium", "dynamic"]); energy.selection = 0;
        var list = tab.add("listbox", [0, 0, 320, 200]);
        var info = tab.add("statictext", undefined, " ", { multiline: true }); info.preferredSize.height = 34;
        var rIn, rOut, rBoth, stag;
        if (withPhase) {
            var gP = tab.add("group");
            rIn = gP.add("radiobutton", undefined, "In"); rOut = gP.add("radiobutton", undefined, "Out"); rBoth = gP.add("radiobutton", undefined, "In + Out");
            rBoth.value = true;
            var gS = tab.add("group"); gS.add("statictext", undefined, "Stagger (frames):");
            stag = gS.add("edittext", undefined, String(SSM.frames("Tick"))); stag.characters = 4;
        }
        var btn = tab.add("button", undefined, buttonLabel);
        function refill() {
            list.removeAll();
            var want = energy.selection.text;
            for (var i = 0; i < names.length; i++) {
                var m = getMeta(names[i]);
                if (want === "all" || m.energy === want) list.add("item", names[i]);
            }
            if (list.items.length) list.selection = 0;
        }
        energy.onChange = refill;
        list.onChange = function () {
            if (!list.selection) return;
            var m = getMeta(list.selection.text);
            info.text = m.channels + " · " + m.energy + "\n" + m.use;
        };
        refill();
        btn.onClick = function () {
            var ls = selected(); if (!ls || !list.selection) return;
            var phase = !withPhase ? "both" : rIn.value ? "in" : rOut.value ? "out" : "both";
            var st = withPhase ? (parseFloat(stag.text) || 0) * ls[0].containingComp.frameDuration : 0;
            app.beginUndoGroup("SS Motion: " + list.selection.text);
            try {
                for (var i = 0; i < ls.length; i++) {
                    var L = ls[i];
                    // with "both" the stagger applies to the entrance; the exit stays anchored to the outPoint
                    var t0 = (phase === "out" ? L.outPoint - SSM.seconds("Arrive") : L.inPoint) + i * st;
                    applyFn(L, list.selection.text, phase, t0);
                }
            } catch (e) { alert("Error: " + e.toString() + " (line " + e.line + ")"); }
            app.endUndoGroup();
        };
    }
    function selected() {
        var c = app.project.activeItem;
        if (!(c instanceof CompItem) || !c.selectedLayers.length) { alert("Select layers in a composition."); return null; }
        return c.selectedLayers;
    }
    var ENERGY = { s: "soft", m: "medium", d: "dynamic" };

    buildTab(tM, SSP.names(), function (n) { return SSP.presets[n]; }, true,
        function (L, n, ph, t0) { SSP.apply(L, n, ph, t0); }, "Apply to selected layers");
    buildTab(tT, SSP.textNames(), function (n) { return SSP.text[n]; }, true,
        function (L, n, ph, t0) { SSP.applyText(L, n, ph, t0); }, "Apply to selected text layers");
    buildTab(tF, SSP.effectNames(), function (n) { return SSP.effects[n]; }, false,
        function (L, n) { SSP.applyFx(L, n); }, "Apply effect to selected layers");
    buildTab(tR, SSP.recipeIds(), function (id) {
        var r = SSP.recipes[id];
        return { channels: r.channels.join(" & ") + (r.kind === "fx" ? " (loop)" : ""), energy: ENERGY[r.energy] || r.energy,
                 use: (r.name ? r.name + " · " : "") + "AC ref · " + (r.section || "?") };
    }, false, function (L, id) { SSP.applyRecipe(L, id, "both"); }, "Apply recipe to selected layers");

    if (win instanceof Window) { win.center(); win.show(); } else win.layout.layout(true);
})(this);
