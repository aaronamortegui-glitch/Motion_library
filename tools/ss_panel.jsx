// SS Motion — After Effects panel: a gallery of the library by category, a live vector preview of each preset,
// In / Out / Both apply, marker-driven timing and one-click style packs.
// Install once (adds "SS Motion" to AE's Window menu, dockable):  powershell -ExecutionPolicy Bypass -File tools/install_panel.ps1
// Or run it directly: File > Scripts > Run Script File… > tools/ss_panel.jsx (floating window).
// The installed loader sets SS_ROOT (repo path) and SS_PANEL_HOST (the dockable panel) before evaluating this file.
// Previews: ScriptUI cannot play GIFs, so the panel redraws the preset's real motion, sampled into
// library/preview_curves.json by tools/sample_previews.jsx (~90 KB for the whole library).
#include "ss_presets.jsx"
#include "ss_assets.jsx"

var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function (thisObj) {
    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "SS Motion", undefined, { resizeable: true });
    win.orientation = "column"; win.alignChildren = ["fill", "top"]; win.spacing = 6; win.margins = 8;

    // ---------- data ----------
    var META = {}, CURVES = { fps: 12, items: {} }, ICON = null;
    try { var lib = SSM.readJSON(SS_ROOT + "/library/library.json").presets; for (var i = 0; i < lib.length; i++) META[lib[i].name] = lib[i]; } catch (e) {}
    try { CURVES = SSM.readJSON(SS_ROOT + "/library/preview_curves.json"); } catch (e) {}
    try { ICON = SSM.readJSON(SS_ROOT + "/assets/superside/ss_icon_shape.json").paths[0]; } catch (e) {}
    function slugOf(name) { var m = META[name]; return m ? m.slug : name.toLowerCase().replace(/__/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
    function thumb(kind, name) { var f = new File(SS_ROOT + "/library/thumbs_sm/" + kind + "/" + slugOf(name) + ".png"); return f.exists ? f : null; }

    // S-mark as a polyline in a unit box (flattened cubic beziers), for the vector preview
    var SPOLY = (function () {
        if (!ICON) return [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
        var v = ICON.v, ti = ICON.i, to = ICON.o, pts = [], n = v.length, minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
        for (var a = 0; a < n; a++) {
            var b = (a + 1) % n, p0 = v[a], p3 = v[b], p1 = [p0[0] + to[a][0], p0[1] + to[a][1]], p2 = [p3[0] + ti[b][0], p3[1] + ti[b][1]];
            for (var s = 0; s < 6; s++) {
                var t = s / 6, u = 1 - t;
                var x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
                var y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
                pts.push([x, y]); minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
            }
        }
        var sc = 1 / Math.max(maxX - minX, maxY - minY), cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        for (var q = 0; q < pts.length; q++) pts[q] = [(pts[q][0] - cx) * sc, (pts[q][1] - cy) * sc];
        return pts;
    })();

    // ---------- header ----------
    var head = win.add("group"); head.alignChildren = ["left", "center"];
    var title = head.add("statictext", undefined, "SS Motion Library");
    try { title.graphics.font = ScriptUI.newFont(title.graphics.font.name, "BOLD", 14); } catch (e) {}
    var vis = head.add("button", undefined, "Visualizer"); vis.preferredSize.width = 80;
    vis.onClick = function () { var f = new File(SS_ROOT + "/library/index.html"); if (f.exists) f.execute(); };

    // ---------- live preview ----------
    var PW = 300, PH = 150;
    var prevBox = win.add("panel", undefined, ""); prevBox.alignChildren = ["center", "top"]; prevBox.margins = 6;
    var view = prevBox.add("group"); view.preferredSize = [PW, PH];
    var selName = prevBox.add("statictext", [0, 0, PW, 18], "Pick a preset"); selName.justify = "center";
    var selInfo = prevBox.add("statictext", [0, 0, PW, 32], " ", { multiline: true }); selInfo.justify = "center";
    var CUR = null, FRAME = 0;   // CUR = { key, kind, name } of the selected preset
    view.onDraw = function () {
        var g = this.graphics, W = this.size.width, H = this.size.height;
        g.rectPath(0, 0, W, H); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, [0.04, 0.13, 0.12, 1]));
        if (!CUR) return;
        var it = CURVES.items[CUR.key];
        if (!it) { g.drawString("(no preview yet)", g.newPen(g.PenType.SOLID_COLOR, [0.5, 0.55, 0.53, 1], 1), 10, H / 2 - 8); return; }
        var f = it.f[FRAME % it.f.length];
        var dx = f[0] * W, dy = f[1] * H, sx = f[2], sy = f[3] * Math.cos((f[6] || 0) * Math.PI / 180), rot = f[4] * Math.PI / 180, op = Math.max(0, Math.min(1, f[5]));
        var sk = Math.tan((f[7] || 0) * Math.PI / 180), trim = f[8], rev = f[9];
        var col = [0.85, 1, 0.52, op];
        if (it.shape === "text") {
            var txt = it.text, k;
            if (it.txt) for (k = FRAME % it.txt.length; k >= 0; k--) if (it.txt[k] !== 0) { txt = it.txt[k]; break; }
            var shown = txt.substr(0, Math.round(txt.length * rev));
            var fnt = ScriptUI.newFont("Arial", "BOLD", Math.max(8, Math.round(26 * sx)));
            g.font = fnt;
            var sz = g.measureString(txt, fnt);
            g.drawString(shown, g.newPen(g.PenType.SOLID_COLOR, [0.97, 0.98, 0.95, op], 1), W / 2 - sz[0] / 2 + dx, H / 2 - sz[1] / 2 + dy);
            return;
        }
        if (it.shape === "bar") {
            var bw = 120 * sx * Math.max(0.02, trim), bh = 22 * sy;
            g.rectPath(W / 2 - 60 * sx + dx, H / 2 - bh / 2 + dy, bw, bh);
            g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, [1, 0.58, 0.58, op]));
            return;
        }
        var size = 62, c = Math.cos(rot), s = Math.sin(rot), pts = SPOLY, m = pts.length;
        var last = it.shape === "stroke" ? Math.max(2, Math.round(m * trim)) : m;
        g.newPath();
        for (var p = 0; p < last; p++) {
            var x = pts[p][0] * size * sx, y = pts[p][1] * size * sy;
            x += sk * y;
            var xr = x * c - y * s + W / 2 + dx, yr = x * s + y * c + H / 2 + dy;
            if (p === 0) g.moveTo(xr, yr); else g.lineTo(xr, yr);
        }
        if (it.shape === "stroke") g.strokePath(g.newPen(g.PenType.SOLID_COLOR, col, 3));
        else { g.closePath(); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, col)); }
    };
    function redraw() { try { view.hide(); view.show(); } catch (e) {} }
    // animation clock: AE idle task (ScriptUI has no timer); stops itself when the panel is gone
    $.global.SS_PANEL_TICK = function () {
        try { if (!CUR) return; FRAME++; redraw(); } catch (e) { try { app.cancelTask($.global.SS_PANEL_TASK); } catch (e2) {} }
    };
    try { if ($.global.SS_PANEL_TASK) app.cancelTask($.global.SS_PANEL_TASK); } catch (e) {}
    $.global.SS_PANEL_TASK = app.scheduleTask("SS_PANEL_TICK()", Math.round(1000 / (CURVES.fps || 12)), true);
    function select(kind, name, meta) {
        CUR = { key: kind + "/" + name, kind: kind, name: name }; FRAME = 0;
        selName.text = name + "  ·  " + (meta.energy || "");
        selInfo.text = (meta.channels || "") + "\n" + (meta.use || "");
        redraw();
    }

    // hook for scripts and the MCP server: SS_PANEL.select("motion", "Scale Pop"); SS_PANEL.frame()
    $.global.SS_PANEL = {
        select: function (kind, name) {
            var meta = kind === "text" ? SSP.text[name] : kind === "fx" ? SSP.effects[name] : SSP.presets[name];
            if (!meta) return "unknown preset";
            select(kind, name, meta); return "selected " + kind + "/" + name;
        },
        frame: function () { return CUR ? CUR.key + " @" + FRAME : "none"; },
        tab: function (title) {   // switch gallery tab by title (used for UI recordings)
            for (var i = 0; i < tabs.children.length; i++) if (tabs.children[i].text === title) { tabs.selection = tabs.children[i]; return "tab " + title; }
            return "no tab " + title;
        }
    };

    // ---------- apply controls (shared) ----------
    var ctl = win.add("group"); ctl.alignChildren = ["left", "center"];
    var bIn = ctl.add("button", undefined, "In"), bOut = ctl.add("button", undefined, "Out"), bBoth = ctl.add("button", undefined, "Both");
    bIn.preferredSize.width = bOut.preferredSize.width = bBoth.preferredSize.width = 64;
    ctl.add("statictext", undefined, " Stagger:");
    var stag = ctl.add("edittext", undefined, String(SSM.frames("Tick"))); stag.characters = 3; stag.helpTip = "Frames between layers";
    var mk = win.add("checkbox", undefined, "Marker timing: drag the SS in / SS out markers to retime");
    mk.value = true;

    function selectedLayers() {
        var c = app.project.activeItem;
        if (!(c instanceof CompItem) || !c.selectedLayers.length) { alert("Select one or more layers in a composition."); return null; }
        return c.selectedLayers;
    }
    function applyCurrent(phase) {
        if (!CUR) { alert("Pick a preset in the gallery first."); return; }
        if (CUR.kind === "pack") { applyPack(phase); return; }
        var ls = selectedLayers(); if (!ls) return;
        var st = (parseFloat(stag.text) || 0) * ls[0].containingComp.frameDuration;
        SSP.markerTiming(mk.value);
        app.beginUndoGroup("SS Motion: " + CUR.name + " (" + phase + ")");
        try {
            for (var i = 0; i < ls.length; i++) {
                var L = ls[i], t0 = (phase === "out" ? L.outPoint - SSM.seconds("Arrive") : L.inPoint) + i * st;
                if (CUR.kind === "text") SSP.applyText(L, CUR.name, phase, t0);
                else if (CUR.kind === "fx") SSP.applyFx(L, CUR.name);
                else if (CUR.kind === "recipe") SSP.applyRecipe(L, CUR.name, phase);
                else SSP.apply(L, CUR.name, phase, t0);
            }
        } catch (e) { alert("SS Motion: " + e.toString() + (e.line ? " (line " + e.line + ")" : "")); }
        SSP.markerTiming(false);
        app.endUndoGroup();
    }
    bIn.onClick = function () { applyCurrent("in"); };
    bOut.onClick = function () { applyCurrent("out"); };
    bBoth.onClick = function () { applyCurrent("both"); };

    // ---------- gallery tabs ----------
    var tabs = win.add("tabbedpanel"); tabs.alignChildren = ["fill", "top"];
    var COLS = 3, ROWS = 3, PER = COLS * ROWS;
    function gallery(tab, kind, names, getMeta) {
        tab.alignChildren = ["fill", "top"]; tab.spacing = 4; tab.margins = 6;
        var gF = tab.add("group");
        var search = gF.add("edittext", undefined, ""); search.preferredSize.width = 150; search.helpTip = "Search by name, channel or use";
        var energy = gF.add("dropdownlist", undefined, ["all energies", "soft", "medium", "dynamic"]); energy.selection = 0;
        var grid = tab.add("group"); grid.orientation = "column"; grid.alignChildren = ["left", "top"]; grid.spacing = 2;
        var nav = tab.add("group"); nav.alignChildren = ["center", "center"];
        var prev = nav.add("button", undefined, "<"), pageLbl = nav.add("statictext", [0, 0, 90, 18], ""), next = nav.add("button", undefined, ">");
        prev.preferredSize.width = next.preferredSize.width = 34; pageLbl.justify = "center";
        var page = 0, list = [];
        function filter() {
            list = [];
            var want = energy.selection.index === 0 ? "" : energy.selection.text, q = search.text.toLowerCase();
            for (var i = 0; i < names.length; i++) {
                var m = getMeta(names[i]);
                if (want && m.energy !== want) continue;
                if (q && (names[i] + " " + m.channels + " " + m.use).toLowerCase().indexOf(q) < 0) continue;
                list.push(names[i]);
            }
        }
        function build() {
            while (grid.children.length) grid.remove(grid.children[0]);
            var pages = Math.max(1, Math.ceil(list.length / PER));
            page = Math.max(0, Math.min(page, pages - 1));
            pageLbl.text = list.length ? (page + 1) + " / " + pages + "  (" + list.length + ")" : "no match";
            for (var r = 0; r < ROWS; r++) {
                var row = grid.add("group"); row.spacing = 4;
                for (var c = 0; c < COLS; c++) {
                    var idx = page * PER + r * COLS + c;
                    if (idx >= list.length) break;
                    (function (name) {
                        var cell = row.add("group"); cell.orientation = "column"; cell.spacing = 0; cell.alignChildren = ["center", "top"];
                        var f = thumb(kind, name), btn;
                        if (f) btn = cell.add("iconbutton", undefined, ScriptUI.newImage(f), { style: "toolbutton" });
                        else { btn = cell.add("button", undefined, "▶"); btn.preferredSize = [112, 63]; }
                        btn.helpTip = name + " · " + getMeta(name).energy + "\n" + getMeta(name).use;
                        var lbl = cell.add("statictext", [0, 0, 112, 16], name.length > 18 ? name.substr(0, 17) + "…" : name); lbl.justify = "center";
                        btn.onClick = function () { select(kind, name, getMeta(name)); };
                    })(list[idx]);
                }
            }
            tab.layout.layout(true); win.layout.layout(true);
        }
        prev.onClick = function () { page--; build(); };
        next.onClick = function () { page++; build(); };
        energy.onChange = function () { page = 0; filter(); build(); };
        search.onChanging = function () { page = 0; filter(); build(); };
        filter(); build();
    }
    var ENERGY = { s: "soft", m: "medium", d: "dynamic" };
    var own = [], classic = [], all = SSP.names();
    for (var a = 0; a < all.length; a++) (SSP.presets[all[a]].family === "classic" ? classic : own).push(all[a]);
    gallery(tabs.add("tab", undefined, "Motion"), "motion", own, function (n) { return SSP.presets[n]; });
    gallery(tabs.add("tab", undefined, "Classics"), "motion", classic, function (n) { return SSP.presets[n]; });
    gallery(tabs.add("tab", undefined, "Text"), "text", SSP.textNames(), function (n) { return SSP.text[n]; });
    gallery(tabs.add("tab", undefined, "Effects"), "fx", SSP.effectNames(), function (n) { return SSP.effects[n]; });
    gallery(tabs.add("tab", undefined, "Recipes"), "recipe", SSP.recipeIds(), function (id) {
        var r = SSP.recipes[id];
        return { channels: r.channels.join(" & ") + (r.kind === "fx" ? " (loop)" : ""), energy: ENERGY[r.energy] || r.energy, use: "measured reference · " + (r.section || "?") };
    });

    // ---------- packs ----------
    var tP = tabs.add("tab", undefined, "Packs"); tP.alignChildren = ["fill", "top"]; tP.spacing = 6; tP.margins = 6;
    tP.add("statictext", undefined, "One click gives the whole comp (or the selected layers) a look:\ntitles, text, shapes, media and logo each get the pack's preset.", { multiline: true }).preferredSize.height = 34;
    var scopeAll = tP.add("checkbox", undefined, "Whole comp (otherwise only the selected layers)"); scopeAll.value = true;
    var packs = SSP.packs();
    for (var p = 0; p < packs.length; p++) (function (pk) {
        var row = tP.add("group"); row.alignChildren = ["left", "center"];
        var f = new File(SS_ROOT + "/library/packs/" + pk.slug + "_sm.png"), btn;
        if (f.exists) btn = row.add("iconbutton", undefined, ScriptUI.newImage(f), { style: "toolbutton" });
        else { btn = row.add("button", undefined, pk.name); btn.preferredSize = [112, 40]; }
        var txt = row.add("statictext", [0, 0, 220, 44], pk.name + " · " + pk.energy + "\n" + pk.desc, { multiline: true });
        btn.onClick = function () {
            CUR = { key: "pack/" + pk.name, kind: "pack", name: pk.name }; FRAME = 0;
            selName.text = "Pack: " + pk.name; selInfo.text = pk.desc; redraw();
        };
    })(packs[p]);
    function applyPack(phase) {
        var c = app.project.activeItem;
        if (!(c instanceof CompItem)) { alert("Open a composition first."); return; }
        var ls = scopeAll.value ? null : c.selectedLayers;
        if (!scopeAll.value && (!ls || !ls.length)) { alert("Select layers, or tick 'Whole comp'."); return; }
        SSP.markerTiming(mk.value);
        app.beginUndoGroup("SS Motion pack: " + CUR.name);
        var res = [];
        try { res = SSP.applyPack(c, CUR.name, ls, phase); } catch (e) { alert("SS Motion: " + e.toString()); }
        SSP.markerTiming(false);
        app.endUndoGroup();
        selInfo.text = res.length ? res.length + " layers animated with " + CUR.name : "No layers matched (backgrounds, nulls and locked layers are skipped).";
    }

    // ---------- assets (local asset packs, licensed, never in the repo) ----------
    (function () {
        var tA = tabs.add("tab", undefined, "Assets"); tA.alignChildren = ["fill", "top"]; tA.spacing = 6; tA.margins = 6;
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
        var cat = g.add("dropdownlist", undefined, []); cat.preferredSize.width = 120;
        var search = g.add("edittext", undefined, ""); search.preferredSize.width = 100; search.helpTip = "Search by name";
        var list = tA.add("listbox", [0, 0, 360, 170]);
        var info = tA.add("statictext", undefined, " ", { multiline: true }); info.preferredSize.height = 30;
        var g2 = tA.add("group");
        g2.add("statictext", undefined, "Gain dB:"); var gain = g2.add("edittext", undefined, "-9"); gain.characters = 4;
        g2.add("statictext", undefined, " Opacity %:"); var opac = g2.add("edittext", undefined, "70"); opac.characters = 4;
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

    tabs.selection = tabs.children[0];
    win.onResizing = win.onResize = function () { this.layout.resize(); };
    if (win instanceof Window) {
        win.onClose = function () { try { app.cancelTask($.global.SS_PANEL_TASK); } catch (e) {} };
        win.center(); win.show();
    } else { win.layout.layout(true); win.layout.resize(); }
})((typeof SS_PANEL_HOST !== "undefined" && SS_PANEL_HOST) || this);
