// APP_SCREEN: a browser-window recording of the SS Motion Library visualizer, rebuilt from screenshots.
// A cursor clicks each category filter (All → Motion → Text → Effects → Recipes); each click swaps to that
// filter's screenshot with a soft scroll. Screenshots: media/whisky/app/app_<kind>.png (1600×1400, from
// msedge --headless --screenshot "library/index.html?poster=1&kind=<kind>").
// Run: bash tools/bridge.sh tools/build_app_screen.jsx   (then use it in a scene as a "panel" with comp "APP_SCREEN")
#include "ss_presets.jsx"

(function () {
    var ROOT = SS_ROOT + "/", proj = app.project;
    var PAL = SSM.readJSON(ROOT + "assets/figma_essentials/palette.json").colors;
    function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function findItem(n) { for (var i = 1; i <= proj.numItems; i++) if (proj.item(i).name === n) return proj.item(i); return null; }
    function importOnce(path) {
        var f = new File(ROOT + path);
        for (var i = 1; i <= proj.numItems; i++) { var it = proj.item(i); if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) return it; }
        return proj.importFile(new ImportOptions(f));
    }
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }

    var W = 1600, BAR = 44, VIEW = 1000, H = BAR + VIEW, DUR = 6, FPS = 24;
    // filter order + chip centers in the 1600-wide screenshot (y = 299)
    var STEPS = [["all", 221], ["motion", 298], ["text", 475], ["fx", 391], ["recipe", 562]];
    var STEP = 1.1;   // seconds per filter

    var old = findItem("APP_SCREEN"); if (old) old.remove();
    var C = proj.items.addComp("APP_SCREEN", W, H, 1, DUR, FPS);
    var f = findItem("WHISKY 1974"); if (f instanceof FolderItem) C.parentFolder = f;
    C.layers.addSolid(hex(PAL.pine), "BG", W, H, 1);

    // screenshots: each fades in on its click and scrolls slightly
    for (var s = 0; s < STEPS.length; s++) {
        var item = importOnce("media/whisky/app/app_" + STEPS[s][0] + ".png");
        var L = C.layers.add(item); L.name = "Screen · " + STEPS[s][0];
        var t0 = s * STEP;
        L.inPoint = t0; L.outPoint = DUR;
        var y0 = BAR + item.height / 2, scroll = s === 0 ? 0 : 40;
        SSM.animate(tr(L, "ADBE Position"), t0, [W / 2, y0], [W / 2, y0 - (60 + scroll)], s === STEPS.length - 1 ? "Stage" : "Sweep", "Settle");
        if (s > 0) SSM.animate(tr(L, "ADBE Opacity"), t0, 0, 100, "Blink", "Flat");
    }
    // browser chrome bar (on top of the screenshots)
    var bar = C.layers.addShape(); bar.name = "Browser bar";
    tr(bar, "ADBE Position").setValue([0, 0]);
    var bg = bar.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
    var br = bg.addProperty("ADBE Vector Shape - Rect"); br.property("ADBE Vector Rect Size").setValue([W, BAR]); br.property("ADBE Vector Rect Position").setValue([W / 2, BAR / 2]);
    bg.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL.sea));
    var dots = [PAL.coral, PAL.spark, PAL.cloud];
    for (var d = 0; d < 3; d++) {
        var dg = bar.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var e = dg.addProperty("ADBE Vector Shape - Ellipse"); e.property("ADBE Vector Ellipse Size").setValue([14, 14]); e.property("ADBE Vector Ellipse Position").setValue([28 + d * 24, BAR / 2]);
        dg.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(dots[d]));
    }
    var url = C.layers.addText("github.com/aaronamortegui-glitch/Motion_library · library/index.html");
    var tp = url.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
    td.resetCharStyle(); td.font = SSM.font("ui_regular"); td.fontSize = 18; td.fillColor = hex(PAL.cloud); td.applyFill = true;
    td.justification = ParagraphJustification.LEFT_JUSTIFY; tp.setValue(td);
    tr(url, "ADBE Position").setValue([120, BAR / 2 + 6]);
    tr(url, "ADBE Opacity").setValue(75);

    // cursor: glides to each chip just before its click, then a Spark ripple marks the click
    var cur = C.layers.addShape(); cur.name = "Cursor";
    var cg = cur.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
    var arrow = new Shape(); arrow.vertices = [[0, 0], [0, 34], [9, 26], [16, 40], [22, 37], [15, 24], [27, 24]]; arrow.closed = true;
    cg.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(arrow);
    cg.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL.cloud));
    var cs = cg.addProperty("ADBE Vector Graphic - Stroke"); cs.property("ADBE Vector Stroke Color").setValue(hex(PAL.pine)); cs.property("ADBE Vector Stroke Width").setValue(2.5);
    var chipY = BAR + 299 - 60;   // chips scroll up ~60px with the page
    var p = tr(cur, "ADBE Position"), prev = [W * 0.62, H * 0.72];
    p.setValueAtTime(0, prev);
    for (var c = 1; c < STEPS.length; c++) {
        var tc = c * STEP, target = [STEPS[c][1], chipY + 4];
        SSM.animate(p, tc - SSM.seconds("Arrive"), prev, target, "Arrive", "Cruise");
        prev = target;
        var R = C.layers.addShape(); R.name = "Click " + c;
        var rg = R.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        rg.addProperty("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").setValue([60, 60]);
        var rs = rg.addProperty("ADBE Vector Graphic - Stroke"); rs.property("ADBE Vector Stroke Color").setValue(hex(PAL.spark)); rs.property("ADBE Vector Stroke Width").setValue(4);
        tr(R, "ADBE Position").setValue(target);
        R.inPoint = tc; R.outPoint = tc + SSM.seconds("Sweep");
        SSM.animate(tr(R, "ADBE Scale"), tc, [20, 20, 100], [150, 150, 100], "Glide", "Land");
        SSM.animate(tr(R, "ADBE Opacity"), tc, 100, 0, "Glide", "Flat");
    }
    p.setValueAtTime(DUR, [W * 0.7, H * 0.8]);
    cur.moveToBeginning();
    C.motionBlur = true; cur.motionBlur = true;
    proj.save();
    return "APP_SCREEN built";
})();
