// Animation Composer harvest station (behavior reference, internal use).
// 1) Open this script (File > Scripts > Run Script File…). The AC_STATION comp is created/opened with a SLOT selected.
// 2) Pick the section in the panel and press Start.
// 3) In the Animation Composer panel double-click one preset after another: the station detects the preset,
//    saves recipe + curves to research/harvest/station/, moves it to its own comp ACH__<section>__<code>
//    (to render the thumbnail) and leaves a new SLOT selected.
#include "harvest_lib.jsx"

var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    var ROOT = SS_ROOT + "/";
    var OUT = ROOT + "research/harvest/station/";
    Folder(OUT).create();
    var W = 640, H = 360, DUR = 3, FPS = 30;
    var SECTIONS = ["2D · Blur & Fade", "2D · Blur & Fade & Warp", "2D · Fade", "2D · Fade & Position", "2D · Fade & Position & Scale",
        "2D · Fade & Rotate", "2D · Fade & Scale", "2D · Position", "2D · Position & Rotate", "2D · Position & Rotate & Scale",
        "2D · Position & Scale", "2D · Rotate", "2D · Rotate & Scale", "2D · Scale",
        "3D · Fade & Rotate", "3D · Position", "3D · Position & Rotate", "3D · Position & Rotate & Scale", "3D · Position & Scale",
        "3D · Rotate", "3D · Rotate & Scale",
        "FX · Blur & Warp", "FX · Color Effects", "FX · Isometric", "FX · Long Shadow & Extrude", "FX · Position",
        "FX · Position & Rotate & Scale", "FX · Position & Rotation", "FX · Position & Scale", "FX · Rotate", "FX · Scale", "FX · Warp",
        "TEXT · Text Presets", "TITLES · Titles & Typography"];
    var ICON = (function () { var f = new File(ROOT + "assets/motion_dna/sample_shape.json"); f.encoding = "UTF-8"; f.open("r"); var s = f.read(); f.close(); return eval("(" + s + ")"); })();
    var PINE = [0.039, 0.129, 0.122], SPARK = [0.847, 1, 0.522], CLOUD = [0.969, 0.976, 0.949];
    var proj = app.project;

    function slug(s) { return s.toLowerCase().split("·").join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
    function findItem(name) { for (var i = 1; i <= proj.numItems; i++) if (proj.item(i).name === name) return proj.item(i); return null; }
    function folder(name) { var f = findItem(name); return (f instanceof FolderItem) ? f : proj.items.addFolder(name); }

    function station() {
        var c = findItem("AC_STATION");
        if (!(c instanceof CompItem)) {
            c = proj.items.addComp("AC_STATION", W, H, 1, DUR, FPS);
            c.parentFolder = folder("AC Sections");
            var bg = c.layers.addSolid(PINE, "BG Pine", W, H, 1); bg.locked = true;
        }
        return c;
    }
    function isTextSection() { var s = $.global.SS_ST.section; return s.indexOf("TEXT") === 0 || s.indexOf("TITLES") === 0; }
    function newSlot(c) {
        var L;
        if (isTextSection()) {
            L = c.layers.addText("Superside");
            var tp = L.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
            td.resetCharStyle(); td.fontSize = 80; td.fillColor = CLOUD; td.applyFill = true;
            td.justification = ParagraphJustification.CENTER_JUSTIFY; tp.setValue(td);
            L.property("ADBE Transform Group").property("ADBE Position").setValue([W / 2, H / 2 + 28]);
        } else {
            L = c.layers.addShape();
            var g = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
            g.property("ADBE Vector Transform Group").property("ADBE Vector Scale").setValue([30, 30]);
            var v = g.property("ADBE Vectors Group"), P = ICON.paths[0], sh = new Shape();
            sh.vertices = P.v; sh.inTangents = P.i; sh.outTangents = P.o; sh.closed = P.closed;
            v.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
            v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(SPARK);
            L.property("ADBE Transform Group").property("ADBE Position").setValue([W / 2, H / 2]);
        }
        L.name = "SLOT";
        L.label = 9;
        for (var i = 1; i <= c.numLayers; i++) c.layer(i).selected = false;
        L.selected = true;
        return L;
    }
    function slotOf(c) { for (var i = 1; i <= c.numLayers; i++) if (c.layer(i).name === "SLOT") return c.layer(i); return null; }
    function acEffectCount(L) {
        var fx = L.property("ADBE Effect Parade"), n = 0;
        if (!fx) return 0;
        for (var e = 1; e <= fx.numProperties; e++) if (fx.property(e).name.indexOf("AC ") === 0) n++;
        return n;
    }
    function log(line) {
        var f = new File(OUT + "_log.csv"); f.encoding = "UTF-8";
        var isNew = !f.exists; f.open("a");
        if (isNew) f.writeln("time,section,codes,file,duplicate");
        f.writeln(line); f.close();
    }

    // Global state (survives between poll runs)
    if (!$.global.SS_ST) $.global.SS_ST = { running: false, section: SECTIONS[0], count: 0, dup: 0, pending: null, task: null, ui: null };
    var ST = $.global.SS_ST;

    $.global.SS_ST_POLL = function () {
        var S = $.global.SS_ST;
        if (!S.running) return;
        try {
            var c = findItem("AC_STATION"); if (!(c instanceof CompItem)) return;
            var L = slotOf(c);
            if (!L) { newSlot(c); return; }
            var n = acEffectCount(L);
            if (!n) { S.pending = null; return; }
            // wait for the plugin to finish applying (same effect count on 2 polls)
            if (!S.pending || S.pending !== n) { S.pending = n; return; }
            S.pending = null;
            var h = SSH.harvestLayer(L, { section: S.section });
            if (!h) return;
            var key = h.codes.join("+") || "unknown";
            var file = OUT + slug(S.section) + "__" + key + ".json";
            var dup = new File(file).exists;
            if (!dup) {
                SSH.write(file, h.json);
                // dedicated comp for the reference thumbnail
                var cname = "ACH__" + slug(S.section) + "__" + key;
                var old = findItem(cname); if (old) old.remove();
                var hc = proj.items.addComp(cname, W, H, 1, DUR, FPS);
                hc.parentFolder = folder("AC Harvest");
                hc.layers.addSolid(PINE, "BG Pine", W, H, 1).locked = true;
                L.copyToComp(hc);
                S.count++;
            } else S.dup++;
            log(new Date().toUTCString() + "," + S.section + "," + key + "," + file.split("/").pop() + "," + (dup ? 1 : 0));
            L.remove();
            newSlot(c);
            if (S.ui) S.ui.text = "Harvested: " + S.count + " · duplicates: " + S.dup + " · last: " + key;
        } catch (e) {
            if (S.ui) S.ui.text = "Error: " + e.toString() + " (line " + e.line + ")";
        }
    };

    // ---- UI ----
    var win = new Window("palette", "SS · AC Harvest Station", undefined, { resizeable: true });
    win.alignChildren = ["fill", "top"];
    win.add("statictext", undefined, "Current Animation Composer panel section:");
    var dd = win.add("dropdownlist", undefined, SECTIONS);
    dd.selection = Math.max(0, (function () { for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i] === ST.section) return i; return 0; })());
    var g = win.add("group");
    var bStart = g.add("button", undefined, "Start"), bStop = g.add("button", undefined, "Stop");
    var status = win.add("statictext", undefined, "Ready. Press Start and double-click presets.", { multiline: true });
    status.preferredSize = [380, 40];
    ST.ui = status;

    dd.onChange = function () {
        ST.section = dd.selection.text;
        var c = station(), L = slotOf(c);
        if (L) L.remove(); // the slot type differs between text and layer sections
        newSlot(c);
    };
    bStart.onClick = function () {
        ST.section = dd.selection.text;
        var c = station(); c.openInViewer();
        if (!slotOf(c)) newSlot(c); else slotOf(c).selected = true;
        ST.running = true;
        if (!ST.task) ST.task = app.scheduleTask("$.global.SS_ST_POLL()", 600, true);
        status.text = "Harvesting \u201C" + ST.section + "\u201D. Double-click presets in that folder.";
    };
    bStop.onClick = function () {
        ST.running = false;
        if (ST.task) { app.cancelTask(ST.task); ST.task = null; }
        proj.save();
        status.text = "Stopped. Harvested: " + ST.count + " · duplicates: " + ST.dup + ". Project saved.";
    };
    win.onClose = function () { bStop.onClick(); };
    win.center(); win.show();
})();
