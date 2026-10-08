// Roto / mask breakdown: a 2x2 grid that explains how a shot was built.
//   01 Plate (AI footage) · 02 Roto matte (AI person matte) · 03 Contours (OpenCV) · 04 Composite (final comp)
// Spec: scenes.json → "breakdown": { "comp", "duration", "plate", "matte", "contours": {"file", "keys": [...]},
//                                   "composite": "<scene comp>", "labels": [4 strings] }
// Run after build_scene.jsx: bash tools/bridge.sh tools/build_breakdown.jsx
#include "ss_hud.jsx"

(function () {
    var SPEC = SSM.readJSON(SS_ROOT + "/" + ((typeof SCENE_SPEC !== "undefined" && SCENE_SPEC) || "media/whisky/scenes.json"));
    var B = SPEC.breakdown;
    if (!B) return "no breakdown in spec";
    var proj = app.project, PAL = SSHUD.palette, W = 1920, H = 1080, FPS = 24, D = B.duration || 5;
    function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function findItem(n) { for (var i = 1; i <= proj.numItems; i++) if (proj.item(i).name === n) return proj.item(i); return null; }
    function importOnce(path) {
        var f = new File(SS_ROOT + "/" + path);
        for (var i = 1; i <= proj.numItems; i++) { var it = proj.item(i); if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) return it; }
        return proj.importFile(new ImportOptions(f));
    }
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
    function freshComp(name) {
        var old = findItem(name); if (old) old.remove();
        var c = proj.items.addComp(name, W, H, 1, D, FPS);
        var f = findItem(SPEC.folder || "SS Scenes"); if (f instanceof FolderItem) c.parentFolder = f;
        return c;
    }
    function fit(L, item) { tr(L, "ADBE Scale").setValue([W / item.width * 100, H / item.height * 100, 100]); }

    // 01 plate
    var cPlate = freshComp(B.comp + " · 01 plate");
    var plate = importOnce(B.plate); fit(cPlate.layers.add(plate), plate);
    // 02 roto matte: people as solid Cloud silhouettes on Pine
    var cMatte = freshComp(B.comp + " · 02 matte");
    cMatte.layers.addSolid(hex(PAL.pine), "BG", W, H, 1);
    var mItem = importOnce(B.matte); mItem.mainSource.alphaMode = AlphaMode.STRAIGHT;
    var M = cMatte.layers.add(mItem); fit(M, mItem);
    M.property("ADBE Effect Parade").addProperty("ADBE Fill").property("ADBE Fill-0002").setValue(hex(PAL.cloud));
    // 03 contours: organic lines over a faint matte
    var cCont = freshComp(B.comp + " · 03 contours");
    cCont.layers.addSolid(hex(PAL.pine), "BG", W, H, 1);
    var M2 = cCont.layers.add(mItem); fit(M2, mItem);
    M2.property("ADBE Effect Parade").addProperty("ADBE Fill").property("ADBE Fill-0002").setValue(hex(PAL.sea));
    SSHUD.init(cCont);
    for (var k = 0; k < B.contours.keys.length; k++)
        SSHUD.contour({ file: B.contours.file, key: B.contours.keys[k], t0: 0.2 + k * 0.2, color: k % 2 ? "coral" : "spark", width: 4 });
    // 04 composite = the finished scene
    var comp = findItem(B.composite);

    // Grid
    var G = freshComp(B.comp);
    G.layers.addSolid(hex(PAL.pine), "BG Pine", W, H, 1);
    var cells = [cPlate, cMatte, cCont, comp], pad = 24, cw = (W - pad * 3) / 2, ch = cw * H / W;
    var oy = (H - (ch * 2 + pad)) / 2;
    var labels = B.labels || ["01 · PLATE", "02 · ROTO MATTE", "03 · CONTOURS", "04 · COMPOSITE"];
    SSHUD.init(G);
    for (var i = 0; i < 4; i++) {
        if (!cells[i]) continue;
        var col = i % 2, row = Math.floor(i / 2);
        var x = pad + col * (cw + pad) + cw / 2, y = oy + row * (ch + pad) + ch / 2;
        var L = G.layers.add(cells[i]); L.name = labels[i];
        tr(L, "ADBE Position").setValue([x, y]);
        tr(L, "ADBE Scale").setValue([cw / cells[i].width * 100, ch / cells[i].height * 100, 100]);
        var t0 = 0.15 + i * SSM.seconds("Glide");
        SSP.apply(L, "Scale Pop", "in", t0);
        // label chip in the cell's top-left corner
        var T = G.layers.addText(labels[i]);
        var tp = T.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
        td.resetCharStyle(); td.font = SSM.font("ui"); td.fontSize = 22; td.tracking = 180; td.fillColor = hex(PAL.spark); td.applyFill = true;
        td.justification = ParagraphJustification.LEFT_JUSTIFY; tp.setValue(td);
        tr(T, "ADBE Position").setValue([x - cw / 2 + 22, y - ch / 2 + 40]);
        SSP.applyText(T, "Tracking Settle", "in", t0 + SSM.seconds("Tick"));
        SSHUD.holo(T, 0.5);
    }
    proj.save();
    return "breakdown " + B.comp + " · " + D + "s";
})();
