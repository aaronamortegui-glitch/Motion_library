// 05_Text_Behind_70s: giant title between the background and the person (Flora/VEED matte) + background tracking.
#include "ss_presets.jsx"
(function () {
    var ROOT = SS_ROOT + "/";
    var PAL = SSM.readJSON(ROOT + "assets/figma_essentials/palette.json").colors;
    var TRK = SSM.readJSON(ROOT + "media/tracks.json");
    function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
    var proj = app.project;
    function findItem(n) { for (var i = 1; i <= proj.numItems; i++) if (proj.item(i).name === n) return proj.item(i); return null; }
    function importOnce(f) {
        for (var i = 1; i <= proj.numItems; i++) { var it = proj.item(i); if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) return it; }
        return proj.importFile(new ImportOptions(f));
    }
    var old = findItem("05_Text_Behind_70s"); if (old) old.remove();
    var plate = importOnce(new File(ROOT + "media/aaron_70s_handheld.mp4"));
    var matte = importOnce(new File(ROOT + "media/aaron_70s_matte.mov"));
    matte.mainSource.alphaMode = AlphaMode.STRAIGHT;
    var c = proj.items.addComp("05_Text_Behind_70s", TRK.size[0], TRK.size[1], 1, plate.duration, TRK.fps);
    var folder = findItem("SS Motion Lab"); if (folder instanceof FolderItem) c.parentFolder = folder;

    c.layers.add(plate).name = "Plate · Aaron 70s";
    // wallpaper null so the title lives in the background (parallax)
    var tk = TRK.tracks.wallpaper, N = c.layers.addNull(), fd = 1 / TRK.fps, ts = [], ps = [];
    N.name = "TRK wallpaper"; N.enabled = false; tr(N, "ADBE Anchor Point").setValue([50, 50]);
    for (var f = 0; f < tk.pos.length; f++) { ts.push(f * fd); ps.push(tk.pos[f]); }
    tr(N, "ADBE Position").setValuesAtTimes(ts, ps);

    // Giant title behind the person
    var T = c.layers.addText("1974");
    T.name = "Title behind";
    var tp = T.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
    td.resetCharStyle(); td.font = SSM.font("display"); td.fontSize = 560; td.fillColor = hex(PAL.spark); td.applyFill = true;
    td.justification = ParagraphJustification.CENTER_JUSTIFY; tp.setValue(td);
    T.parent = N;
    tr(T, "ADBE Position").setValue([50 + 800, 50 + 300]);
    SSP.applyText(T, "Chars Rise", "in", 0.3);

    // Cut-out person on top: the title ends up "behind"
    var M = c.layers.add(matte);
    M.name = "Aaron matte (Flora · VEED)";
    // the matte is 1920x1080 and the plate is 1928x1076: scale per axis to match pixel for pixel
    tr(M, "ADBE Scale").setValue([c.width / matte.width * 100, c.height / matte.height * 100, 100]);

    // Kicker and lower third on top of everything
    var K = c.layers.addText("SUPERSIDE MOTION LAB");
    var kd = K.property("ADBE Text Properties").property("ADBE Text Document"), kv = kd.value;
    kv.resetCharStyle(); kv.font = SSM.font("ui"); kv.fontSize = 30; kv.tracking = 200; kv.fillColor = hex(PAL.cloud); kv.applyFill = true; kv.justification = ParagraphJustification.LEFT_JUSTIFY; kd.setValue(kv);
    tr(K, "ADBE Position").setValue([110, 110]);
    SSP.applyText(K, "Tracking Settle", "in", 0.1);
    proj.save();
    return "05 ok";
})();
