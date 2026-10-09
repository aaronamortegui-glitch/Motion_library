// Motion DNA — After Effects panel: the library by category with live vector previews, per-apply controls
// (duration, intensity, direction, easing), In / Out / Both / Remove, marker-driven timing, one-click styles,
// technique guides, local assets, favorites, and the Claude connection (file bridge used by the MCP server).
// Install once (adds "Motion DNA" to AE's Window menu, dockable): tools/install_panel.ps1 (Windows) or
// tools/install_panel.sh (macOS). Or run it directly: File > Scripts > Run Script File… > tools/ss_panel.jsx.
// The installed loader sets SS_ROOT (repo path) and SS_PANEL_HOST (the dockable panel) before evaluating this file.
// Previews: ScriptUI cannot play GIFs, so the panel redraws the preset's real motion, sampled into
// library/preview_curves.json by tools/sample_previews.jsx, on the neutral sample arrow.
#include "ss_presets.jsx"
#include "ss_assets.jsx"

var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function (thisObj) {
    var NAME = "Motion DNA";
    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", (typeof SS_PANEL_TITLE !== "undefined" && SS_PANEL_TITLE) || NAME, undefined, { resizeable: true });
    win.orientation = "column"; win.alignChildren = ["fill", "top"]; win.spacing = 6; win.margins = 8;
    var C = { pine: [0.04, 0.13, 0.12, 1], sea: [0.09, 0.29, 0.27, 1], spark: [0.85, 1, 0.52, 1], cloud: [0.97, 0.98, 0.95, 1],
              coral: [1, 0.58, 0.58, 1], muted: [0.55, 0.62, 0.59, 1] };

    // ---------- data ----------
    var META = {}, CURVES = { fps: 12, items: {} };
    try { var lib = SSM.readJSON(SS_ROOT + "/library/library.json").presets; for (var i = 0; i < lib.length; i++) META[lib[i].name] = lib[i]; } catch (e) {}
    try { CURVES = SSM.readJSON(SS_ROOT + "/library/preview_curves.json"); } catch (e) {}
    var TECH = []; try { TECH = SSM.readJSON(SS_ROOT + "/library/techniques.json").techniques; } catch (e) {}
    function slugOf(name) { var m = META[name]; return m ? m.slug : name.toLowerCase().replace(/__/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
    function thumb(kind, name) { var f = new File(SS_ROOT + "/library/thumbs_sm/" + kind + "/" + slugOf(name) + ".png"); return f.exists ? f : null; }

    // favorites persist in AE's settings (per machine)
    var FAV = {};
    try { if (app.settings.haveSetting("MotionDNA", "favorites")) { var fl = app.settings.getSetting("MotionDNA", "favorites").split("|"); for (var q = 0; q < fl.length; q++) if (fl[q]) FAV[fl[q]] = 1; } } catch (e) {}
    function saveFav() { var a = []; for (var k in FAV) if (FAV.hasOwnProperty(k)) a.push(k); try { app.settings.saveSetting("MotionDNA", "favorites", a.join("|")); } catch (e) {} }

    // ---------- header: name, Claude status, visualizer ----------
    var head = win.add("group"); head.alignChildren = ["left", "center"]; head.alignment = ["fill", "top"];
    var title = head.add("statictext", undefined, NAME);
    try { title.graphics.font = ScriptUI.newFont(title.graphics.font.name, "BOLD", 15); } catch (e) {}
    var claudeDot = head.add("statictext", [0, 0, 210, 18], "");
    var bConnect = head.add("button", undefined, "Connect Claude"); bConnect.preferredSize.width = 110;
    var vis = head.add("button", undefined, "Visualizer"); vis.preferredSize.width = 76;
    vis.onClick = function () { var f = new File(SS_ROOT + "/library/index.html"); if (f.exists) f.execute(); };
    function bridgeOn() { return !!$.global.SS_BRIDGE_TASK; }
    function lastClaude() {
        var fs = Folder(SS_ROOT + "/bridge/outbox").getFiles("*.txt"), best = 0;
        for (var i = 0; i < fs.length; i++) if (fs[i].name.charAt(0) !== "_" && fs[i].modified && fs[i].modified.getTime() > best) best = fs[i].modified.getTime();
        if (!best) return "";
        var m = Math.round((new Date().getTime() - best) / 60000);
        return m <= 1 ? " · active now" : m < 60 ? " · last " + m + " min ago" : "";
    }
    function status() {
        var on = bridgeOn();
        claudeDot.text = (on ? "● Claude connected" : "○ Claude offline") + (on ? lastClaude() : "");
        try { claudeDot.graphics.foregroundColor = claudeDot.graphics.newPen(claudeDot.graphics.PenType.SOLID_COLOR, on ? [0.45, 0.85, 0.4, 1] : [0.75, 0.5, 0.5, 1], 1); } catch (e) {}
        bConnect.text = on ? "How to use" : "Connect Claude";
    }
    bConnect.onClick = function () {
        if (!bridgeOn()) {
            try { $.evalFile(new File(SS_ROOT + "/tools/ss_bridge.jsx")); } catch (e) { alert(NAME + ": could not start the bridge: " + e.toString()); }
            status();
            if (!bridgeOn()) return;
        }
        alert(NAME + " is connected.\n\nIn Claude Code, open the repo folder (" + SS_ROOT + ").\nThe MCP server 'motion-dna' is registered in .mcp.json, so Claude can list presets, apply them\n" +
              "and styles to your selected layers, add assets and render frames to check its work.\n\nTry: \"Apply the Elegant style to this comp and show me a frame.\"");
    };

    // ---------- category + filters ----------
    var CATS = ["Moves", "Classics", "Text", "Loops", "Recipes", "Styles", "Techniques", "Assets", "★ Favorites"];
    var fRow = win.add("group"); fRow.alignChildren = ["left", "center"]; fRow.alignment = ["fill", "top"];
    var cat = fRow.add("dropdownlist", undefined, CATS); cat.preferredSize.width = 120; cat.selection = 0;
    var search = fRow.add("edittext", undefined, ""); search.preferredSize.width = 140; search.helpTip = "Search by name, channel or use";
    var energy = fRow.add("dropdownlist", undefined, ["all energies", "soft", "medium", "dynamic"]); energy.selection = 0;

    // ---------- live preview ----------
    var PW = 320, PH = 150;
    var prevBox = win.add("panel", undefined, ""); prevBox.alignChildren = ["fill", "top"]; prevBox.margins = 6; prevBox.spacing = 2;
    var view = prevBox.add("group"); view.preferredSize = [PW, PH]; view.alignment = ["fill", "top"];
    var selRow = prevBox.add("group"); selRow.alignChildren = ["left", "center"]; selRow.alignment = ["fill", "top"];
    var selName = selRow.add("statictext", [0, 0, 250, 18], "Pick a preset");
    var bFav = selRow.add("button", undefined, "☆"); bFav.preferredSize = [30, 22]; bFav.helpTip = "Add to / remove from favorites";
    var selInfo = prevBox.add("statictext", [0, 0, PW, 32], " ", { multiline: true }); selInfo.alignment = ["fill", "top"];
    var CUR = null, FRAME = 0;   // CUR = { key, kind, name } of the selected preset
    // the neutral sample: a Spark arrow (assets/motion_dna/sample_shape.json), so direction and rotation read at a glance
    var ARROW = (function () {
        var pts = [[-330, -55], [60, -55], [60, -160], [330, 0], [60, 160], [60, 55], [-330, 55]];
        try { pts = SSM.readJSON(SS_ROOT + "/assets/motion_dna/sample_shape.json").paths[0].v; } catch (e) {}
        var out = []; for (var i = 0; i < pts.length; i++) out.push([pts[i][0] / 660, pts[i][1] / 660]);
        return out;
    })();
    function arrow(g, W, H, it, f) {
        var dx = f[0] * W, dy = f[1] * H, sx = f[2], sy = f[3] * Math.cos((f[6] || 0) * Math.PI / 180), rot = f[4] * Math.PI / 180;
        var op = Math.max(0, Math.min(1, f[5])), sk = Math.tan((f[7] || 0) * Math.PI / 180), trim = f[8];
        var size = 150, c = Math.cos(rot), s = Math.sin(rot), pts = ARROW.concat([ARROW[0]]);
        var stroke = it.shape === "stroke", last = stroke ? Math.max(2, Math.round(pts.length * trim)) : ARROW.length;
        g.newPath();
        for (var p = 0; p < last; p++) {
            var x = pts[p][0] * size * sx, y = pts[p][1] * size * sy; x += sk * y;
            var xr = x * c - y * s + W / 2 + dx, yr = x * s + y * c + H / 2 + dy;
            if (p === 0) g.moveTo(xr, yr); else g.lineTo(xr, yr);
        }
        var col = [C.spark[0], C.spark[1], C.spark[2], op];
        if (stroke) g.strokePath(g.newPen(g.PenType.SOLID_COLOR, col, 3));
        else { g.closePath(); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, col)); }
    }
    view.onDraw = function () {
        var g = this.graphics, W = this.size.width, H = this.size.height;
        g.rectPath(0, 0, W, H); g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, C.pine));
        if (!CUR) { g.drawString("Pick a preset to preview it", g.newPen(g.PenType.SOLID_COLOR, C.muted, 1), 12, H / 2 - 8); return; }
        var it = CURVES.items[CUR.key];
        if (!it) { g.drawString(CUR.kind === "pack" ? "Style: applies a preset per layer role" : "(no preview)", g.newPen(g.PenType.SOLID_COLOR, C.muted, 1), 12, H / 2 - 8); return; }
        var f = it.f[FRAME % it.f.length], op = Math.max(0, Math.min(1, f[5]));
        if (it.shape === "text") {
            var txt = it.text, k;
            if (it.txt) for (k = FRAME % it.txt.length; k >= 0; k--) if (it.txt[k] !== 0) { txt = it.txt[k]; break; }
            var shown = txt.substr(0, Math.round(txt.length * f[9]));
            var fnt = ScriptUI.newFont("Arial", "BOLD", Math.max(8, Math.round(26 * f[2])));
            g.font = fnt; var sz = g.measureString(txt, fnt);
            g.drawString(shown, g.newPen(g.PenType.SOLID_COLOR, [C.cloud[0], C.cloud[1], C.cloud[2], op], 1), W / 2 - sz[0] / 2 + f[0] * W, H / 2 - sz[1] / 2 + f[1] * H);
            return;
        }
        if (it.shape === "bar") {
            var bw = 120 * f[2] * Math.max(0.02, f[8]), bh = 22 * f[3];
            g.rectPath(W / 2 - 60 * f[2] + f[0] * W, H / 2 - bh / 2 + f[1] * H, bw, bh);
            g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, [C.coral[0], C.coral[1], C.coral[2], op]));
            return;
        }
        arrow(g, W, H, it, f);
    };
    function redraw() { try { view.hide(); view.show(); } catch (e) {} }
    // animation clock: AE idle task (ScriptUI has no timer); stops itself when the panel is gone
    var tick = 0;
    $.global.SS_PANEL_TICK = function () {
        try { tick++; if (tick % 24 === 0) status(); if (!CUR) return; FRAME++; redraw(); } catch (e) { try { app.cancelTask($.global.SS_PANEL_TASK); } catch (e2) {} }
    };
    try { if ($.global.SS_PANEL_TASK) app.cancelTask($.global.SS_PANEL_TASK); } catch (e) {}
    // guarded: a scheduled string runs in the main engine, and an error there can stop other scheduled tasks (the bridge)
    $.global.SS_PANEL_TASK = app.scheduleTask("if (typeof SS_PANEL_TICK === \"function\") SS_PANEL_TICK();", Math.round(1000 / (CURVES.fps || 12)), true);
    function favKey() { return CUR ? CUR.kind + "/" + CUR.name : ""; }
    function select(kind, name, meta) {
        CUR = { key: kind + "/" + name, kind: kind, name: name }; FRAME = 0;
        selName.text = name + (meta.energy ? "  ·  " + meta.energy : "");
        selInfo.text = (meta.channels || "") + "\n" + (meta.use || "");
        bFav.text = FAV[favKey()] ? "★" : "☆";
        redraw();
    }
    bFav.onClick = function () {
        if (!CUR) return;
        if (FAV[favKey()]) delete FAV[favKey()]; else FAV[favKey()] = 1;
        saveFav(); bFav.text = FAV[favKey()] ? "★" : "☆";
        if (cat.selection.text === "★ Favorites") show();
    };

    // ---------- controls ----------
    var ctlBox = win.add("panel", undefined, "Controls"); ctlBox.alignChildren = ["fill", "top"]; ctlBox.margins = [8, 14, 8, 6]; ctlBox.spacing = 4;
    function slider(label, min, max, val, fmt) {
        var g = ctlBox.add("group"); g.alignChildren = ["left", "center"];
        var l = g.add("statictext", [0, 0, 64, 18], label);
        var s = g.add("slider", undefined, val, min, max); s.preferredSize.width = 160;
        var v = g.add("statictext", [0, 0, 44, 18], fmt(val));
        s.onChanging = function () { v.text = fmt(s.value); };
        return s;
    }
    var pct = function (x) { return Math.round(x * 100) + "%"; };
    var sDur = slider("Duration", 0.5, 2, 1, function (x) { return x.toFixed(2) + "×"; });
    var sInt = slider("Intensity", 0.25, 2, 1, pct);
    var dRow = ctlBox.add("group"); dRow.alignChildren = ["left", "center"];
    dRow.add("statictext", [0, 0, 64, 18], "Direction");
    var dir = dRow.add("dropdownlist", undefined, ["As designed", "Mirror horizontal", "Mirror vertical", "Mirror both"]); dir.selection = 0;
    var eRow = ctlBox.add("group"); eRow.alignChildren = ["left", "center"];
    eRow.add("statictext", [0, 0, 64, 18], "Easing");
    var EASES = ["Preset curve", "Land", "Settle", "Launch", "Cruise", "Surge", "Ramp", "Whip", "Flat"];
    var ease = eRow.add("dropdownlist", undefined, EASES); ease.selection = 0;
    var sRow = ctlBox.add("group"); sRow.alignChildren = ["left", "center"];
    sRow.add("statictext", [0, 0, 64, 18], "Stagger");
    var stag = sRow.add("edittext", undefined, String(SSM.frames("Tick"))); stag.characters = 3; stag.helpTip = "Frames between layers";
    sRow.add("statictext", undefined, "frames");
    var bReset = sRow.add("button", undefined, "Reset"); bReset.preferredSize.width = 56;
    var mk = ctlBox.add("checkbox", undefined, "Marker timing: drag the SS in / SS out markers to retime"); mk.value = true;
    bReset.onClick = function () { sDur.value = 1; sInt.value = 1; dir.selection = 0; ease.selection = 0; sDur.onChanging(); sInt.onChanging(); };

    var act = win.add("group"); act.alignChildren = ["left", "center"];
    var bIn = act.add("button", undefined, "In"), bOut = act.add("button", undefined, "Out"), bBoth = act.add("button", undefined, "Both");
    var bRem = act.add("button", undefined, "Remove"); bRem.helpTip = "Remove Motion DNA animation from the selected layers";
    bIn.preferredSize.width = bOut.preferredSize.width = bBoth.preferredSize.width = 60; bRem.preferredSize.width = 70;

    function tuning() {
        var d = dir.selection.index;
        return { speed: sDur.value, intensity: sInt.value, flipX: d === 1 || d === 3, flipY: d === 2 || d === 3, ease: ease.selection.index ? ease.selection.text : null };
    }
    function selectedLayers() {
        var c = app.project.activeItem;
        if (!(c instanceof CompItem) || !c.selectedLayers.length) { alert("Select one or more layers in a composition."); return null; }
        return c.selectedLayers;
    }
    function applyCurrent(phase) {
        if (!CUR) { alert("Pick a preset in the gallery first."); return; }
        if (CUR.kind === "technique") { alert(CUR.name + "\n\n" + techText(CUR.name)); return; }
        if (CUR.kind === "pack") { applyPack(phase); return; }
        var ls = selectedLayers(); if (!ls) return;
        var st = (parseFloat(stag.text) || 0) * ls[0].containingComp.frameDuration;
        SSP.markerTiming(mk.value); SSP.tune(tuning());
        app.beginUndoGroup(NAME + ": " + CUR.name + " (" + phase + ")");
        try {
            for (var i = 0; i < ls.length; i++) {
                var L = ls[i], t0 = (phase === "out" ? L.outPoint - SSM.seconds("Arrive") : L.inPoint) + i * st;
                if (CUR.kind === "text") SSP.applyText(L, CUR.name, phase, t0);
                else if (CUR.kind === "fx") SSP.applyFx(L, CUR.name);
                else if (CUR.kind === "recipe") SSP.applyRecipe(L, CUR.name, phase);
                else SSP.apply(L, CUR.name, phase, t0);
            }
        } catch (e) { alert(NAME + ": " + e.toString() + (e.line ? " (line " + e.line + ")" : "")); }
        SSP.markerTiming(false); SSP.tune();
        app.endUndoGroup();
    }
    bIn.onClick = function () { applyCurrent("in"); };
    bOut.onClick = function () { applyCurrent("out"); };
    bBoth.onClick = function () { applyCurrent("both"); };
    bRem.onClick = function () {
        var ls = selectedLayers(); if (!ls) return;
        if (!confirm("Remove the keyframes, expressions and markers Motion DNA added to " + ls.length + " layer(s)?\nAnimated properties keep their resting value.")) return;
        app.beginUndoGroup(NAME + ": remove");
        var n = 0; try { for (var i = 0; i < ls.length; i++) n += SSP.remove(ls[i]); } catch (e) { alert(NAME + ": " + e.toString()); }
        app.endUndoGroup();
        selInfo.text = n + " animated properties cleared.";
    };

    // ---------- gallery ----------
    var body = win.add("group"); body.orientation = "column"; body.alignChildren = ["fill", "top"]; body.alignment = ["fill", "fill"];
    var ENERGY = { s: "soft", m: "medium", d: "dynamic" };
    var own = [], classic = [], all = SSP.names();
    for (var a = 0; a < all.length; a++) (SSP.presets[all[a]].family === "classic" ? classic : own).push(all[a]);
    function recipeMeta(id) {
        var r = SSP.recipes[id];
        return { channels: r.channels.join(" & ") + (r.kind === "fx" ? " (loop)" : ""), energy: ENERGY[r.energy] || r.energy, use: "measured reference · " + (r.section || "?") };
    }
    var SOURCES = {
        "Moves": { kind: "motion", names: own, meta: function (n) { return SSP.presets[n]; } },
        "Classics": { kind: "motion", names: classic, meta: function (n) { return SSP.presets[n]; } },
        "Text": { kind: "text", names: SSP.textNames(), meta: function (n) { return SSP.text[n]; } },
        "Loops": { kind: "fx", names: SSP.effectNames(), meta: function (n) { return SSP.effects[n]; } },
        "Recipes": { kind: "recipe", names: SSP.recipeIds(), meta: recipeMeta }
    };
    function metaOf(kind, name) {
        if (kind === "text") return SSP.text[name]; if (kind === "fx") return SSP.effects[name];
        if (kind === "recipe") return recipeMeta(name); return SSP.presets[name];
    }
    var page = 0;
    function cols() { var w = (win.size && win.size.width) || 380; return Math.max(2, Math.floor((w - 24) / 118)); }
    function clear() { while (body.children.length) body.remove(body.children[0]); }
    function grid(items) {   // items: [{kind, name, meta}]
        var COLS = cols(), ROWS = 3, PER = COLS * ROWS, pages = Math.max(1, Math.ceil(items.length / PER));
        page = Math.max(0, Math.min(page, pages - 1));
        var g = body.add("group"); g.orientation = "column"; g.alignChildren = ["left", "top"]; g.spacing = 2;
        for (var r = 0; r < ROWS; r++) {
            var row = g.add("group"); row.spacing = 4;
            for (var c = 0; c < COLS; c++) {
                var idx = page * PER + r * COLS + c;
                if (idx >= items.length) break;
                (function (it) {
                    var cell = row.add("group"); cell.orientation = "column"; cell.spacing = 0; cell.alignChildren = ["center", "top"];
                    var f = thumb(it.kind, it.name), btn;
                    if (f) btn = cell.add("iconbutton", undefined, ScriptUI.newImage(f), { style: "toolbutton" });
                    else { btn = cell.add("button", undefined, "▶"); btn.preferredSize = [112, 63]; }
                    btn.helpTip = it.name + " · " + (it.meta.energy || "") + "\n" + (it.meta.use || "");
                    var nm = (FAV[it.kind + "/" + it.name] ? "★ " : "") + it.name;
                    var lbl = cell.add("statictext", [0, 0, 112, 16], nm.length > 18 ? nm.substr(0, 17) + "…" : nm); lbl.justify = "center";
                    btn.onClick = function () { select(it.kind, it.name, it.meta); };
                })(items[idx]);
            }
        }
        var nav = body.add("group"); nav.alignChildren = ["center", "center"];
        var prev = nav.add("button", undefined, "<"), lbl2 = nav.add("statictext", [0, 0, 110, 18], items.length ? (page + 1) + " / " + pages + "  (" + items.length + ")" : "no match"), next = nav.add("button", undefined, ">");
        prev.preferredSize.width = next.preferredSize.width = 34; lbl2.justify = "center";
        prev.onClick = function () { page--; show(); }; next.onClick = function () { page++; show(); };
    }
    function matches(name, m) {
        var want = energy.selection.index === 0 ? "" : energy.selection.text, q = search.text.toLowerCase();
        if (want && m.energy !== want) return false;
        return !q || (name + " " + (m.channels || "") + " " + (m.use || "")).toLowerCase().indexOf(q) >= 0;
    }
    function show() {
        clear();
        var c = cat.selection.text, items = [], i;
        if (SOURCES[c]) {
            var src = SOURCES[c];
            for (i = 0; i < src.names.length; i++) { var m = src.meta(src.names[i]); if (matches(src.names[i], m)) items.push({ kind: src.kind, name: src.names[i], meta: m }); }
            grid(items);
        } else if (c === "★ Favorites") {
            for (var k in FAV) if (FAV.hasOwnProperty(k)) {
                var kind = k.split("/")[0], name = k.substr(kind.length + 1);
                if (kind === "pack" || kind === "technique") { items.push({ kind: kind, name: name, meta: { use: kind } }); continue; }
                var mm = metaOf(kind, name); if (mm && matches(name, mm)) items.push({ kind: kind, name: name, meta: mm });
            }
            if (!items.length) body.add("statictext", undefined, "No favorites yet: pick a preset and press ☆.");
            else grid(items);
        } else if (c === "Styles") styles();
        else if (c === "Techniques") techniques();
        else if (c === "Assets") assets();
        win.layout.layout(true);
    }
    cat.onChange = function () { page = 0; show(); };
    energy.onChange = function () { page = 0; show(); };
    search.onChanging = function () { page = 0; show(); };

    // ---------- styles (packs) ----------
    var scopeAll = null;
    function styles() {
        body.add("statictext", undefined, "One click gives the whole comp (or the selected layers) a look: titles, text,\nshapes, media and logos each get the style's preset. Then In / Out / Both.", { multiline: true }).preferredSize.height = 34;
        scopeAll = body.add("checkbox", undefined, "Whole comp (otherwise only the selected layers)"); scopeAll.value = true;
        var packs = SSP.packs();
        for (var p = 0; p < packs.length; p++) (function (pk) {
            if (search.text && (pk.name + " " + pk.desc).toLowerCase().indexOf(search.text.toLowerCase()) < 0) return;
            var row = body.add("group"); row.alignChildren = ["left", "center"];
            var f = new File(SS_ROOT + "/library/packs/" + pk.slug + "_sm.png"), btn;
            if (f.exists) btn = row.add("iconbutton", undefined, ScriptUI.newImage(f), { style: "toolbutton" });
            else { btn = row.add("button", undefined, pk.name); btn.preferredSize = [112, 40]; }
            row.add("statictext", [0, 0, 230, 44], (FAV["pack/" + pk.name] ? "★ " : "") + pk.name + " · " + pk.energy + "\n" + pk.desc, { multiline: true });
            btn.onClick = function () {
                CUR = { key: "pack/" + pk.name, kind: "pack", name: pk.name }; FRAME = 0;
                selName.text = "Style: " + pk.name; selInfo.text = pk.desc; bFav.text = FAV[favKey()] ? "★" : "☆"; redraw();
            };
        })(packs[p]);
    }
    function applyPack(phase) {
        var c = app.project.activeItem;
        if (!(c instanceof CompItem)) { alert("Open a composition first."); return; }
        var whole = !scopeAll || scopeAll.value, ls = whole ? null : c.selectedLayers;
        if (!whole && (!ls || !ls.length)) { alert("Select layers, or tick 'Whole comp' in Styles."); return; }
        SSP.markerTiming(mk.value); SSP.tune(tuning());
        app.beginUndoGroup(NAME + " style: " + CUR.name);
        var res = [];
        try { res = SSP.applyPack(c, CUR.name, ls, phase); } catch (e) { alert(NAME + ": " + e.toString()); }
        SSP.markerTiming(false); SSP.tune();
        app.endUndoGroup();
        selInfo.text = res.length ? res.length + " layers animated with " + CUR.name : "No layers matched (backgrounds, nulls and locked layers are skipped).";
    }

    // ---------- techniques (guides: what each one does and how to run it, alone or with Claude) ----------
    function techText(name) {
        for (var i = 0; i < TECH.length; i++) if (TECH[i].name === name) return TECH[i].what + "\n\nHow: " + TECH[i].how + "\n\nWith Claude: \"" + TECH[i].ask + "\"";
        return "";
    }
    function techniques() {
        if (!TECH.length) { body.add("statictext", undefined, "library/techniques.json is missing."); return; }
        var lb = body.add("listbox", [0, 0, 360, 150]);
        for (var i = 0; i < TECH.length; i++) {
            if (search.text && (TECH[i].name + " " + TECH[i].what).toLowerCase().indexOf(search.text.toLowerCase()) < 0) continue;
            var it = lb.add("item", (FAV["technique/" + TECH[i].name] ? "★ " : "") + TECH[i].name); it.tech = TECH[i];
        }
        var info = body.add("statictext", [0, 0, 360, 110], "Pick a technique.", { multiline: true });
        lb.onChange = function () {
            if (!lb.selection) return;
            var t = lb.selection.tech;
            CUR = { key: "technique/" + t.name, kind: "technique", name: t.name }; FRAME = 0;
            selName.text = "Technique: " + t.name; selInfo.text = t.what; bFav.text = FAV[favKey()] ? "★" : "☆"; redraw();
            info.text = "How: " + t.how + "\nWith Claude: \"" + t.ask + "\"";
        };
    }

    // ---------- assets (local asset packs, licensed, never in the repo) ----------
    var ROWS_A = null;
    function assets() {
        if (!ROWS_A) {
            ROWS_A = [];
            var idx = new File(SS_ROOT + "/library/ASSETS.local.txt");
            if (idx.exists) {
                idx.encoding = "UTF-8"; idx.open("r");
                var lines = idx.read().split("\n"); idx.close();
                for (var i = 0; i < lines.length; i++) {
                    if (!lines[i] || lines[i].charAt(0) === "#") continue;
                    var c = lines[i].split("|");
                    if (c[0] === "sfx" || c[0] === "overlay") ROWS_A.push({ type: c[0], cat: c[1], name: c[2], sec: c[3], mean: c[4], flags: c[6] || "" });
                }
            }
        }
        if (!ROWS_A.length) {
            body.add("statictext", undefined, "No local asset index yet. In a terminal, from the repo:\n  python tools/index_assets.py\nthen reopen this panel.", { multiline: true }).preferredSize.height = 70;
            return;
        }
        var g = body.add("group");
        var type = g.add("dropdownlist", undefined, ["sfx", "overlay"]); type.selection = 0;
        var cg = g.add("dropdownlist", undefined, []); cg.preferredSize.width = 130;
        var list = body.add("listbox", [0, 0, 360, 150]);
        var info = body.add("statictext", undefined, " ", { multiline: true }); info.preferredSize.height = 30;
        var g2 = body.add("group");
        g2.add("statictext", undefined, "Gain dB:"); var gain = g2.add("edittext", undefined, "-9"); gain.characters = 4;
        g2.add("statictext", undefined, " Opacity %:"); var opac = g2.add("edittext", undefined, "70"); opac.characters = 4;
        var add = body.add("button", undefined, "Add at the playhead");
        function cats() {
            cg.removeAll(); cg.add("item", "all categories");
            var seen = {};
            for (var i = 0; i < ROWS_A.length; i++) if (ROWS_A[i].type === type.selection.text && !seen[ROWS_A[i].cat]) { seen[ROWS_A[i].cat] = 1; cg.add("item", ROWS_A[i].cat); }
            cg.selection = 0;
        }
        function fill() {
            list.removeAll();
            var q = search.text.toLowerCase(), c = cg.selection ? cg.selection.text : "all categories";
            for (var i = 0; i < ROWS_A.length; i++) {
                var r = ROWS_A[i];
                if (r.type !== type.selection.text || (c !== "all categories" && r.cat !== c)) continue;
                if (q && r.name.toLowerCase().indexOf(q) < 0) continue;
                var it = list.add("item", r.name + (r.flags ? "   [" + r.flags + "]" : "")); it.row = r;
            }
            if (list.items.length) list.selection = 0;
        }
        type.onChange = function () { cats(); fill(); };
        cg.onChange = fill;
        list.onChange = function () {
            if (!list.selection) return;
            var r = list.selection.row;
            info.text = r.cat + " · " + r.sec + " s" + (r.mean ? " · mean " + r.mean + " dB" : "") + (r.flags.indexOf("loud") >= 0 ? " · loud: lower the gain" : "");
        };
        add.onClick = function () {
            var comp = app.project.activeItem;
            if (!(comp instanceof CompItem) || !list.selection) { alert("Open a composition and pick an asset."); return; }
            var r = list.selection.row;
            app.beginUndoGroup(NAME + " asset: " + r.name);
            try {
                if (r.type === "sfx") SSA.sfx(comp, r.name, comp.time, parseFloat(gain.text) || -9);
                else SSA.overlay(comp, r.name, comp.time, null, parseFloat(opac.text) || 70);
            } catch (e) { alert(NAME + ": " + e.toString()); }
            app.endUndoGroup();
        };
        list.onDoubleClick = function () { add.notify("onClick"); };
        cats(); fill();
    }

    // hook for scripts and the MCP server: SS_PANEL.select("motion", "Scale Pop"); SS_PANEL.frame(); SS_PANEL.tab("Styles")
    $.global.SS_PANEL = {
        select: function (kind, name) {
            var meta = metaOf(kind, name);
            if (!meta) return "unknown preset";
            select(kind, name, meta); return "selected " + kind + "/" + name;
        },
        frame: function () { return CUR ? CUR.key + " @" + FRAME : "none"; },
        tab: function (t) {
            if (t === "Motion") t = "Moves"; if (t === "Effects") t = "Loops"; if (t === "Packs") t = "Styles";
            for (var i = 0; i < CATS.length; i++) if (CATS[i] === t) { cat.selection = i; page = 0; show(); return "category " + t; }
            return "no category " + t;
        },
        controls: function (o) {   // set the controls from a script (recordings, tests)
            o = o || {};
            if (o.speed) sDur.value = o.speed; if (o.intensity) sInt.value = o.intensity;
            if (o.direction !== undefined) dir.selection = o.direction; if (o.ease) for (var i = 0; i < EASES.length; i++) if (EASES[i] === o.ease) ease.selection = i;
            sDur.onChanging(); sInt.onChanging(); return "ok";
        }
    };

    status(); show();
    var lastW = 0;
    win.onResizing = win.onResize = function () {
        this.layout.resize();
        var w = this.size.width; if (Math.abs(w - lastW) > 110) { lastW = w; show(); }
    };
    if (win instanceof Window) {
        win.onClose = function () { try { app.cancelTask($.global.SS_PANEL_TASK); } catch (e) {} };
        win.center(); win.show();
    } else { win.layout.layout(true); win.layout.resize(); }
})((typeof SS_PANEL_HOST !== "undefined" && SS_PANEL_HOST) || this);
