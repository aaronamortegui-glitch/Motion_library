// SS Motion — After Effects panel: browse the library and apply presets to the selected layers.
// Install once (adds "SS Motion" to AE's Window menu, dockable):  powershell -ExecutionPolicy Bypass -File tools/install_panel.ps1
// Or run it directly: File > Scripts > Run Script File… > tools/ss_panel.jsx (floating window).
// The installed loader sets SS_ROOT (repo path) and SS_PANEL_HOST (the dockable panel) before evaluating this file,
// so the panel always reads the library straight from the repo clone.
#include "ss_presets.jsx"
#include "ss_assets.jsx"

var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function (thisObj) {
    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "SS Motion", undefined, { resizeable: true });
    win.orientation = "column"; win.alignChildren = ["fill", "top"]; win.spacing = 6; win.margins = 8;

    // preview stills: library/thumbs/<kind>/<slug>.png (made by tools/make_panel_thumbs.sh from the posters)
    var META = {};
    try {
        var lib = SSM.readJSON(SS_ROOT + "/library/library.json").presets;
        for (var i = 0; i < lib.length; i++) META[lib[i].name] = lib[i];
    } catch (e) {}
    function thumbFor(kind, name) {
        var m = META[name], slug = m ? m.slug : name.toLowerCase().replace(/__/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        var f = new File(SS_ROOT + "/library/thumbs/" + kind + "/" + slug + ".png");
        return f.exists ? f : null;
    }

    var head = win.add("group"); head.alignChildren = ["left", "center"];
    var title = head.add("statictext", undefined, "SS Motion Library");
    try { title.graphics.font = ScriptUI.newFont(title.graphics.font.name, "BOLD", 14); } catch (e) {}
    var vis = head.add("button", undefined, "Visualizer"); vis.preferredSize.width = 80;
    vis.onClick = function () { var f = new File(SS_ROOT + "/library/index.html"); if (f.exists) f.execute(); };

    var tabs = win.add("tabbedpanel"); tabs.alignChildren = ["fill", "top"];
    var tM = tabs.add("tab", undefined, "Motion");
    var tT = tabs.add("tab", undefined, "Text");
    var tF = tabs.add("tab", undefined, "Effects");
    var tR = tabs.add("tab", undefined, "Recipes");
    var tA = tabs.add("tab", undefined, "Assets");
    tabs.selection = tM;

    function selected() {
        var c = app.project.activeItem;
        if (!(c instanceof CompItem) || !c.selectedLayers.length) { alert("Select one or more layers in a composition."); return null; }
        return c.selectedLayers;
    }

    // One library tab: search + energy filter, list, preview, info, optional phase/stagger, Apply.
    function buildTab(tab, kind, names, getMeta, withPhase, applyFn, buttonLabel) {
        tab.alignChildren = ["fill", "top"]; tab.spacing = 6;
        var gF = tab.add("group"); gF.alignChildren = ["fill", "center"];
        var search = gF.add("edittext", undefined, ""); search.preferredSize.width = 170; search.helpTip = "Search by name, channel or use";
        var energy = gF.add("dropdownlist", undefined, ["all energies", "soft", "medium", "dynamic"]); energy.selection = 0;
        var row = tab.add("group"); row.alignChildren = ["fill", "top"];
        var list = row.add("listbox", [0, 0, 190, 230]);
        var right = row.add("group"); right.orientation = "column"; right.alignChildren = ["fill", "top"];
        var img = right.add("image", [0, 0, 240, 135]);
        var info = right.add("statictext", [0, 0, 240, 64], " ", { multiline: true });
        var rIn, rOut, rBoth, stag;
        if (withPhase) {
            var gP = tab.add("group");
            rIn = gP.add("radiobutton", undefined, "In"); rOut = gP.add("radiobutton", undefined, "Out"); rBoth = gP.add("radiobutton", undefined, "In + Out");
            rBoth.value = true;
            gP.add("statictext", undefined, " Stagger:").helpTip = "Frames between layers";
            stag = gP.add("edittext", undefined, String(SSM.frames("Tick"))); stag.characters = 3;
        }
        var btn = tab.add("button", undefined, buttonLabel);
        function refill() {
            list.removeAll();
            var want = energy.selection.index === 0 ? "" : energy.selection.text, q = search.text.toLowerCase();
            for (var i = 0; i < names.length; i++) {
                var m = getMeta(names[i]);
                if (want && m.energy !== want) continue;
                if (q && (names[i] + " " + m.channels + " " + m.use).toLowerCase().indexOf(q) < 0) continue;
                list.add("item", names[i]);
            }
            if (list.items.length) list.selection = 0; else { info.text = "No presets match."; }
        }
        energy.onChange = refill;
        search.onChanging = refill;
        list.onChange = function () {
            if (!list.selection) return;
            var n = list.selection.text, m = getMeta(n), f = thumbFor(kind, n);
            info.text = m.energy + " · " + m.channels + "\n" + m.use;
            try { img.image = f ? ScriptUI.newImage(f) : null; } catch (e) {}
        };
        list.onDoubleClick = function () { btn.notify("onClick"); };
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
            } catch (e) { alert("SS Motion: " + e.toString() + (e.line ? " (line " + e.line + ")" : "")); }
            app.endUndoGroup();
        };
        refill();
    }
    var ENERGY = { s: "soft", m: "medium", d: "dynamic" };

    buildTab(tM, "motion", SSP.names(), function (n) { return SSP.presets[n]; }, true,
        function (L, n, ph, t0) { SSP.apply(L, n, ph, t0); }, "Apply to selected layers");
    buildTab(tT, "text", SSP.textNames(), function (n) { return SSP.text[n]; }, true,
        function (L, n, ph, t0) { SSP.applyText(L, n, ph, t0); }, "Apply to selected text layers");
    buildTab(tF, "fx", SSP.effectNames(), function (n) { return SSP.effects[n]; }, false,
        function (L, n) { SSP.applyFx(L, n); }, "Apply loop to selected layers");
    buildTab(tR, "recipe", SSP.recipeIds(), function (id) {
        var r = SSP.recipes[id];
        return { channels: r.channels.join(" & ") + (r.kind === "fx" ? " (loop)" : ""), energy: ENERGY[r.energy] || r.energy,
                 use: (r.name ? r.name + " · " : "") + "measured reference · " + (r.section || "?") };
    }, false, function (L, id) { SSP.applyRecipe(L, id, "both"); }, "Apply recipe to selected layers");

    // ---- Assets: locally installed SFX and overlays (licensed, never in the repo) ----
    (function () {
        tA.alignChildren = ["fill", "top"]; tA.spacing = 6;
        var idx = new File(SS_ROOT + "/library/ASSETS.local.txt"), rows = [];
        if (idx.exists) {
            idx.encoding = "UTF-8"; idx.open("r");
            var lines = idx.read().split("\n"); idx.close();
            for (var i = 0; i < lines.length; i++) {
                if (!lines[i] || lines[i].charAt(0) === "#") continue;
                var c = lines[i].split("|");
                if (c[0] === "sfx" || c[0] === "overlay") rows.push({ type: c[0], cat: c[1], name: c[2], sec: c[3], mean: c[4], flags: c[6] || "" });
            }
        }
        if (!rows.length) {
            tA.add("statictext", undefined, "No local asset index yet. In a terminal, from the repo:\n  python tools/index_assets.py\nthen reopen this panel.", { multiline: true }).preferredSize.height = 70;
            return;
        }
        var g = tA.add("group");
        var type = g.add("dropdownlist", undefined, ["sfx", "overlay"]); type.selection = 0;
        var cat = g.add("dropdownlist", undefined, []); cat.preferredSize.width = 130;
        var search = g.add("edittext", undefined, ""); search.preferredSize.width = 110; search.helpTip = "Search by name";
        var list = tA.add("listbox", [0, 0, 440, 190]);
        var info = tA.add("statictext", undefined, " ", { multiline: true }); info.preferredSize.height = 30;
        var g2 = tA.add("group");
        g2.add("statictext", undefined, "Gain dB:"); var gain = g2.add("edittext", undefined, "-9"); gain.characters = 4;
        g2.add("statictext", undefined, "  Opacity %:"); var opac = g2.add("edittext", undefined, "70"); opac.characters = 4;
        var add = tA.add("button", undefined, "Add at the playhead");
        function cats() {
            cat.removeAll(); cat.add("item", "all categories");
            var seen = {};
            for (var i = 0; i < rows.length; i++) if (rows[i].type === type.selection.text && !seen[rows[i].cat]) { seen[rows[i].cat] = 1; cat.add("item", rows[i].cat); }
            cat.selection = 0;
        }
        function fill() {
            list.removeAll();
            var q = search.text.toLowerCase(), c = cat.selection ? cat.selection.text : "all categories";
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                if (r.type !== type.selection.text || (c !== "all categories" && r.cat !== c)) continue;
                if (q && r.name.toLowerCase().indexOf(q) < 0) continue;
                var it = list.add("item", r.name + (r.flags ? "   [" + r.flags + "]" : "")); it.row = r;
            }
            if (list.items.length) list.selection = 0;
        }
        type.onChange = function () { cats(); fill(); };
        cat.onChange = fill; search.onChanging = fill;
        list.onChange = function () {
            if (!list.selection) return;
            var r = list.selection.row;
            info.text = r.cat + " · " + r.sec + " s" + (r.mean ? " · mean " + r.mean + " dB" : "") + (r.flags.indexOf("loud") >= 0 ? " · loud: lower the gain" : "");
        };
        add.onClick = function () {
            var comp = app.project.activeItem;
            if (!(comp instanceof CompItem) || !list.selection) { alert("Open a composition and pick an asset."); return; }
            var r = list.selection.row;
            app.beginUndoGroup("SS Motion asset: " + r.name);
            try {
                if (r.type === "sfx") SSA.sfx(comp, r.name, comp.time, parseFloat(gain.text) || -9);
                else SSA.overlay(comp, r.name, comp.time, null, parseFloat(opac.text) || 70);
            } catch (e) { alert("SS Motion: " + e.toString()); }
            app.endUndoGroup();
        };
        list.onDoubleClick = function () { add.notify("onClick"); };
        cats(); fill();
    })();

    win.onResizing = win.onResize = function () { this.layout.resize(); };
    if (win instanceof Window) { win.center(); win.show(); } else { win.layout.layout(true); win.layout.resize(); }
})((typeof SS_PANEL_HOST !== "undefined" && SS_PANEL_HOST) || this);
