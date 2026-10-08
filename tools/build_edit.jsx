// Data-driven edit: sequences scene comps, lays music + SFX, and adds a branded end card.
// Spec (default media/whisky/edit.json):
// { "comp": "WHISKY_EDIT", "fps": 24, "size": [1920, 1080], "music": "media/whisky/music_70s_funk.mp3", "musicGainDb": -3,
//   "shots": [ { "comp": "WHISKY_01", "in": 0, "dur": 5 }, ... ],
//   "sfx": [ { "t": 0.4, "name": "Data Beep 05", "gainDb": -8 }, ... ],          // names = Animation Composer SFX (asset packs)
//   "endCard": { "dur": 5, "title": "The 1974 Boardroom", "kicker": "SS MOTION LAB · TEST 01" } }
// Run: bash tools/bridge.sh tools/build_edit.jsx
#include "ss_hud.jsx"

(function () {
    var spec = SSM.readJSON(SS_ROOT + "/" + ((typeof EDIT_SPEC !== "undefined" && EDIT_SPEC) || "media/whisky/edit.json"));
    var proj = app.project;
    var PAL = SSHUD.palette, ICON = SSM.readJSON(SS_ROOT + "/assets/superside/ss_icon_shape.json");
    function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function findItem(n) { for (var i = 1; i <= proj.numItems; i++) if (proj.item(i).name === n) return proj.item(i); return null; }
    function importFile(f) {
        for (var i = 1; i <= proj.numItems; i++) { var it = proj.item(i); if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) return it; }
        return proj.importFile(new ImportOptions(f));
    }
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
    function db(x) { return x; }
    var AC = Folder($.getenv("LOCALAPPDATA").split("\\").join("/") + "/MisterHorse/ProductManager/AssetPacks/");
    function findSfx(name) {  // search every asset pack for "<name> #hash.wav"
        var packs = AC.getFiles();
        for (var i = 0; i < packs.length; i++) {
            if (!(packs[i] instanceof Folder)) continue;
            var hits = packs[i].getFiles(name + " #*.wav");
            if (hits.length) return hits[0];
        }
        return null;
    }

    var old = findItem(spec.comp); if (old) old.remove();
    var total = 0;
    for (var s = 0; s < spec.shots.length; s++) total += spec.shots[s].dur;
    if (spec.endCard) total += spec.endCard.dur;
    var E = proj.items.addComp(spec.comp, spec.size[0], spec.size[1], 1, total, spec.fps);
    var BG = E.layers.addSolid(hex(PAL.pine), "BG Pine", spec.size[0], spec.size[1], 1);

    // 1) Shots in sequence (hard cuts on the beat)
    var t = 0, log = [];
    for (var k = 0; k < spec.shots.length; k++) {
        var sh = spec.shots[k], src = findItem(sh.comp);
        if (!(src instanceof CompItem)) { log.push("missing comp " + sh.comp); t += sh.dur; continue; }
        var L = E.layers.add(src);
        L.startTime = t - (sh["in"] || 0);
        L.inPoint = t; L.outPoint = t + sh.dur;
        var sx = spec.size[0] / src.width * 100, sy = spec.size[1] / src.height * 100, sc = Math.max(sx, sy);
        tr(L, "ADBE Scale").setValue([sc, sc, 100]);
        L.moveToEnd(); BG.moveToEnd();
        t += sh.dur;
    }

    // 2) End card: Superside S-mark + title + kicker on Pine, built with our presets
    if (spec.endCard) {
        var t0 = t, ec = spec.endCard;
        var S = E.layers.addShape(); S.name = "End card · S-mark";
        var g = S.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        g.property("ADBE Vector Transform Group").property("ADBE Vector Scale").setValue([22, 22]);
        var v = g.property("ADBE Vectors Group"), P = ICON.paths[0], shp = new Shape();
        shp.vertices = P.v; shp.inTangents = P.i; shp.outTangents = P.o; shp.closed = P.closed;
        v.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(shp);
        v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL.spark));
        tr(S, "ADBE Position").setValue([spec.size[0] / 2, spec.size[1] / 2 - 150]);
        S.inPoint = t0; S.outPoint = total;
        SSP.apply(S, "Scale Pop", "in", t0 + 0.2);
        function txt(str, role, size, color, y, tracking) {
            var T = E.layers.addText(str);
            var tp = T.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
            td.resetCharStyle(); td.font = SSM.font(role); td.fontSize = size; td.fillColor = hex(PAL[color]); td.applyFill = true;
            td.justification = ParagraphJustification.CENTER_JUSTIFY; if (tracking) td.tracking = tracking; tp.setValue(td);
            tr(T, "ADBE Position").setValue([spec.size[0] / 2, y]);
            T.inPoint = t0; T.outPoint = total;
            return T;
        }
        SSP.applyText(txt(ec.title, "display", 120, "cloud", spec.size[1] / 2 + 70), "Chars Rise", "in", t0 + 0.5);
        SSP.applyText(txt(ec.kicker, "ui", 26, "spark", spec.size[1] / 2 + 150, 220), "Tracking Settle", "in", t0 + 1.0);
        // fade the whole end card out on the last beat
        var fadeOut = E.layers.addSolid(hex(PAL.pine), "End fade", spec.size[0], spec.size[1], 1);
        fadeOut.inPoint = total - 0.8; fadeOut.outPoint = total;
        SSM.animate(tr(fadeOut, "ADBE Opacity"), total - 0.8, 0, 100, "Sweep", "Cruise");
    }

    // 3) Music + SFX
    if (spec.music) {
        var m = E.layers.add(importFile(new File(SS_ROOT + "/" + spec.music)));
        m.name = "Music"; m.outPoint = total;
        var lv = m.property("ADBE Audio Group").property("ADBE Audio Levels");
        var g0 = spec.musicGainDb || 0;
        lv.setValueAtTime(0, [g0, g0]); lv.setValueAtTime(total - 1.0, [g0, g0]); lv.setValueAtTime(total, [-48, -48]);
    }
    for (var x = 0; x < (spec.sfx || []).length; x++) {
        var fx = spec.sfx[x], f = findSfx(fx.name);
        if (!f) { log.push("sfx not found: " + fx.name); continue; }
        var A = E.layers.add(importFile(f));
        A.name = "SFX · " + fx.name; A.startTime = fx.t;
        var gd = fx.gainDb || -6;
        A.property("ADBE Audio Group").property("ADBE Audio Levels").setValue([gd, gd]);
        A.enabled = false; A.audioEnabled = true;
    }
    BG.locked = true;
    proj.save();
    return "edit " + spec.comp + " · " + total + "s" + (log.length ? " · " + log.join("; ") : "");
})();
