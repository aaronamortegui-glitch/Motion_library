// Data-driven edit: sequences scene comps (with optional freeze frames + foreground titles), lays music
// (auto-ducked under voiceover), VO lines, SFX and a branded end card.
// Spec (default media/whisky/edit.json):
// { "comp": "WHISKY_EDIT", "fps": 24, "size": [1920, 1080],
//   "music": "media/whisky/music.mp3", "musicGainDb": 0, "duckDb": -9,
//   "shots": [ { "comp": "WHISKY_01", "in": 0, "dur": 5,
//                "freeze": { "at": 3.6, "dur": 3.3, "title": "Zero emails.", "sub": "2 EXECUTIVES · 1 DECANTER", "titleAt": 2.6 } } ],
//   "vo":  [ { "file": "media/whisky/vo/vo01.wav", "shot": 0, "local": 0.1, "gainDb": 0 } ],
//   "sfx": [ { "name": "Data Beep 05", "shot": 0, "local": 0.4, "gainDb": -9 } ],     // or { "t": absolute seconds }
//   "endCard": { "dur": 6, "title": "...", "kicker": "..." } }
// "shot"/"local" place audio in the shot's own (scene) time, so freezes shift it automatically.
// The end card is shot index = shots.length. Run: bash tools/bridge.sh tools/build_edit.jsx
#include "ss_hud.jsx"

(function () {
    var spec = SSM.readJSON(SS_ROOT + "/" + ((typeof EDIT_SPEC !== "undefined" && EDIT_SPEC) || "media/whisky/edit.json"));
    var proj = app.project;
    var PAL = SSHUD.palette, ICON = SSM.readJSON(SS_ROOT + "/assets/superside/ss_icon_shape.json");
    var W = spec.size[0], H = spec.size[1];
    function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function findItem(n) { for (var i = 1; i <= proj.numItems; i++) if (proj.item(i).name === n) return proj.item(i); return null; }
    function importFile(f) {
        for (var i = 1; i <= proj.numItems; i++) { var it = proj.item(i); if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) return it; }
        return proj.importFile(new ImportOptions(f));
    }
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
    var AC = Folder($.getenv("LOCALAPPDATA").split("\\").join("/") + "/MisterHorse/ProductManager/AssetPacks/");
    function findSfx(name) {
        var packs = AC.getFiles();
        for (var i = 0; i < packs.length; i++) {
            if (!(packs[i] instanceof Folder)) continue;
            var hits = packs[i].getFiles(name + " #*.wav");
            if (hits.length) return hits[0];
        }
        return null;
    }
    function text(E, str, role, size, color, at, just, tracking, t0, t1) {
        var T = E.layers.addText(str);
        var tp = T.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
        td.resetCharStyle(); td.font = SSM.font(role); td.fontSize = size; td.fillColor = hex(PAL[color] || color); td.applyFill = true;
        td.justification = just || ParagraphJustification.LEFT_JUSTIFY; if (tracking) td.tracking = tracking; tp.setValue(td);
        tr(T, "ADBE Position").setValue(at);
        T.inPoint = t0; T.outPoint = t1;
        return T;
    }

    // ---- timeline: shot starts and lengths (freezes extend a shot) ----
    var starts = [], lens = [], t = 0;
    for (var s = 0; s < spec.shots.length; s++) {
        var sh = spec.shots[s];
        starts.push(t);
        lens.push(sh.dur + (sh.freeze ? sh.freeze.dur : 0));
        t += lens[s];
    }
    starts.push(t);                                           // end card start = index shots.length
    var total = t + (spec.endCard ? spec.endCard.dur : 0);
    // scene-local time → edit time (accounts for the freeze hold)
    function toEdit(i, local) {
        if (i >= spec.shots.length) return starts[i] + local;
        var fz = spec.shots[i].freeze;
        return starts[i] + local + (fz && local > fz.at ? fz.dur : 0);
    }

    var old = findItem(spec.comp); if (old) old.remove();
    var E = proj.items.addComp(spec.comp, W, H, 1, total, spec.fps);
    var BG = E.layers.addSolid(hex(PAL.pine), "BG Pine", W, H, 1);
    var log = [], autoSfx = [];

    // ---- 1) shots, with time-remapped freeze frames ----
    for (var k = 0; k < spec.shots.length; k++) {
        var shot = spec.shots[k], src = findItem(shot.comp);
        if (!(src instanceof CompItem)) { log.push("missing comp " + shot.comp); continue; }
        var L = E.layers.add(src);
        L.startTime = starts[k]; L.inPoint = starts[k]; L.outPoint = starts[k] + lens[k];
        var sc = Math.max(W / src.width, H / src.height) * 100;
        tr(L, "ADBE Scale").setValue([sc, sc, 100]);
        var fz = shot.freeze, inT = shot["in"] || 0;
        if (fz) {
            L.timeRemapEnabled = true;
            var rm = L.property("ADBE Time Remapping");
            // set our keys first, then drop AE's default keys that aren't ours (removing all keys hides the property)
            // NOTE: setValueAtTime uses COMP time, so offset every key by the shot's start
            var s0 = starts[k];
            var keys = [[s0, inT], [s0 + fz.at, inT + fz.at], [s0 + fz.at + fz.dur, inT + fz.at], [s0 + shot.dur + fz.dur, inT + shot.dur]];
            for (var q = 0; q < keys.length; q++) rm.setValueAtTime(keys[q][0], keys[q][1]);
            for (var r = rm.numKeys; r >= 1; r--) {
                var kt = rm.keyTime(r), ours = false;
                for (var q3 = 0; q3 < keys.length; q3++) if (Math.abs(kt - keys[q3][0]) < 0.001) ours = true;
                if (!ours) rm.removeKey(r);
            }
            for (var q2 = 1; q2 <= rm.numKeys; q2++) rm.setInterpolationTypeAtKey(q2, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
            L.outPoint = starts[k] + lens[k];      // enabling time remap resets the out point
            var f0 = starts[k] + fz.at, f1 = f0 + fz.dur;
            // punch-in on the frozen frame, then back out
            SSM.animate(tr(L, "ADBE Scale"), f0, [sc, sc, 100], [sc * 1.07, sc * 1.07, 100], "Glide", "Land");
            SSM.animate(tr(L, "ADBE Scale"), f1 - SSM.seconds("Glide"), [sc * 1.07, sc * 1.07, 100], [sc, sc, 100], "Glide", "Launch");
            // flash + darken scrim
            var flash = E.layers.addSolid(hex(PAL.cloud), "Freeze flash " + (k + 1), W, H, 1);
            flash.inPoint = f0; flash.outPoint = f0 + SSM.seconds("Glide");
            SSM.animate(tr(flash, "ADBE Opacity"), f0, 55, 0, "Blink", "Flat");
            var scrim = E.layers.addSolid(hex(PAL.pine), "Freeze scrim " + (k + 1), W, H, 1);
            scrim.inPoint = f0; scrim.outPoint = f1;
            SSM.animate(tr(scrim, "ADBE Opacity"), f0, 0, 48, "Blink", "Flat");
            SSM.animate(tr(scrim, "ADBE Opacity"), f1 - SSM.seconds("Blink"), 48, 0, "Blink", "Flat");
            // foreground title + subline + organic underline
            var tIn = f0 + (fz.titleAt || 0.15), tOut = f1;
            autoSfx.push({ name: fz.clickSfx || "Mechanical Keyboard Click 03", t: f0, gainDb: -6 });
            autoSfx.push({ name: fz.popSfx || "Hollow Pop 06", t: tIn, gainDb: -8 });
            var x0 = fz.x || 150, y0 = fz.y || 600;
            var T1 = text(E, fz.title, "display", fz.size || 200, "cloud", [x0, y0], null, 0, tIn, tOut);
            SSP.applyText(T1, "Chars Rise", "in", tIn);
            SSM.animate(tr(T1, "ADBE Opacity"), tOut - SSM.seconds("Blink"), 100, 0, "Blink", "Flat");
            if (fz.sub) {
                var T2 = text(E, fz.sub, "ui", 30, "spark", [x0 + 6, y0 + 80], null, 220, tIn + SSM.seconds("Glide"), tOut);
                SSP.applyText(T2, "Tracking Settle", "in", tIn + SSM.seconds("Glide"));
                SSM.animate(tr(T2, "ADBE Opacity"), tOut - SSM.seconds("Blink"), 100, 0, "Blink", "Flat");
            }
            var U = E.layers.addShape(); U.name = "Freeze underline " + (k + 1);
            tr(U, "ADBE Position").setValue([0, 0]);
            var ug = U.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
            var us = new Shape(); us.vertices = [[x0, y0 + 30], [x0 + (fz.lineW || 760), y0 + 30]]; us.closed = false;
            ug.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(us);
            var ust = ug.addProperty("ADBE Vector Graphic - Stroke");
            ust.property("ADBE Vector Stroke Color").setValue(hex(PAL.spark)); ust.property("ADBE Vector Stroke Width").setValue(5);
            ust.property("ADBE Vector Stroke Line Cap").setValue(2);
            U.inPoint = tIn; U.outPoint = tOut;
            SSP.apply(U, "Organic Draw", "in", tIn + SSM.seconds("Tick"));
            SSM.animate(tr(U, "ADBE Opacity"), tOut - SSM.seconds("Blink"), 100, 0, "Blink", "Flat");
        }
    }

    // ---- 2) end card ----
    if (spec.endCard) {
        var t0 = starts[spec.shots.length], ec = spec.endCard;
        var S = E.layers.addShape(); S.name = "End card · S-mark";
        var g = S.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        g.property("ADBE Vector Transform Group").property("ADBE Vector Scale").setValue([22, 22]);
        var v = g.property("ADBE Vectors Group"), P = ICON.paths[0], shp = new Shape();
        shp.vertices = P.v; shp.inTangents = P.i; shp.outTangents = P.o; shp.closed = P.closed;
        v.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(shp);
        v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL.spark));
        tr(S, "ADBE Position").setValue([W / 2, H / 2 - 150]);
        S.inPoint = t0; S.outPoint = total;
        SSP.apply(S, "Scale Pop", "in", t0 + 0.2);
        SSP.applyText(text(E, ec.title, "display", 120, "cloud", [W / 2, H / 2 + 70], ParagraphJustification.CENTER_JUSTIFY, 0, t0, total), "Chars Rise", "in", t0 + 0.5);
        SSP.applyText(text(E, ec.kicker, "ui", 26, "spark", [W / 2, H / 2 + 150], ParagraphJustification.CENTER_JUSTIFY, 220, t0, total), "Tracking Settle", "in", t0 + 1.0);
        var fadeOut = E.layers.addSolid(hex(PAL.pine), "End fade", W, H, 1);
        fadeOut.inPoint = total - 0.8; fadeOut.outPoint = total;
        SSM.animate(tr(fadeOut, "ADBE Opacity"), total - 0.8, 0, 100, "Sweep", "Cruise");
    }

    // ---- 3) audio: VO, music (ducked under VO), SFX ----
    function audioAt(file, at, gainDb, name) {
        var A = E.layers.add(importFile(file)); A.name = name; A.startTime = at;
        A.property("ADBE Audio Group").property("ADBE Audio Levels").setValue([gainDb, gainDb]);
        A.enabled = false; A.audioEnabled = true;
        return A;
    }
    function when(o) { return o.t !== undefined ? o.t : toEdit(o.shot, o.local || 0); }
    var voSpans = [];
    for (var a = 0; a < (spec.vo || []).length; a++) {
        var vo = spec.vo[a], vt = when(vo);
        var VL = audioAt(new File(SS_ROOT + "/" + vo.file), vt, vo.gainDb || 0, "VO " + (a + 1));
        voSpans.push([vt, vt + VL.source.duration]);
    }
    if (spec.music) {
        var m = audioAt(new File(SS_ROOT + "/" + spec.music), 0, 0, "Music");
        m.outPoint = total;
        var lv = m.property("ADBE Audio Group").property("ADBE Audio Levels"), g0 = spec.musicGainDb || 0, gd = g0 + (spec.duckDb || -9);
        lv.setValueAtTime(0, [g0, g0]);
        for (var d = 0; d < voSpans.length; d++) {     // duck under each VO line
            lv.setValueAtTime(Math.max(0.01, voSpans[d][0] - 0.2), [g0, g0]);
            lv.setValueAtTime(voSpans[d][0], [gd, gd]);
            lv.setValueAtTime(voSpans[d][1], [gd, gd]);
            lv.setValueAtTime(voSpans[d][1] + 0.35, [g0, g0]);
        }
        var mEnd = Math.min(total, m.source.duration);
        lv.setValueAtTime(Math.max(0.02, mEnd - 1.0), lv.valueAtTime(Math.max(0.02, mEnd - 1.0), false));
        lv.setValueAtTime(mEnd, [-48, -48]);
    }
    var allSfx = (spec.sfx || []).concat(autoSfx);
    for (var x = 0; x < allSfx.length; x++) {
        var fx = allSfx[x], f = findSfx(fx.name);
        if (!f) { log.push("sfx not found: " + fx.name); continue; }
        audioAt(f, when(fx), fx.gainDb || -9, "SFX · " + fx.name);
    }
    BG.moveToEnd(); BG.locked = true;
    proj.save();
    return "edit " + spec.comp + " · " + total.toFixed(2) + "s" + (log.length ? " · " + log.join("; ") : "");
})();
