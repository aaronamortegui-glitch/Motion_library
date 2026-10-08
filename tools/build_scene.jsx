// Data-driven scene builder: footage + tracking nulls + SS HUD components, described in a JSON spec.
// Usage (from a job in tools/):  SCENE_SPEC = "media/whisky/scenes.json"; $.evalFile(".../build_scene.jsx")
// or run directly: bash tools/bridge.sh tools/build_scene.jsx   (reads media/whisky/scenes.json by default)
//
// Spec: { "scenes": [ { "comp": "WHISKY_01", "plate": "media/whisky/clip01.mp4", "tracks": "media/whisky/clip01_tracks.json",
//                        "grain": true, "hud": [ {"type": "bracket", ...}, {"type": "callout", ...}, ... ] } ] }
// HUD item types map 1:1 to SSHUD.bracket / callout / meter / chip, plus "title" (Chars Rise headline) and "kicker".
#include "ss_hud.jsx"

(function () {
    var specPath = SS_ROOT + "/" + ((typeof SCENE_SPEC !== "undefined" && SCENE_SPEC) || "media/whisky/scenes.json");
    var SPEC = SSM.readJSON(specPath);
    var proj = app.project, made = [];
    function findItem(n) { for (var i = 1; i <= proj.numItems; i++) if (proj.item(i).name === n) return proj.item(i); return null; }
    function folder(n) { var f = findItem(n); return (f instanceof FolderItem) ? f : proj.items.addFolder(n); }
    function importOnce(path) {
        var f = new File(SS_ROOT + "/" + path);
        for (var i = 1; i <= proj.numItems; i++) { var it = proj.item(i); if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) return it; }
        return proj.importFile(new ImportOptions(f));
    }
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
    function text(c, str, role, size, color, tracking) {
        var L = c.layers.addText(str);
        var tp = L.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
        td.resetCharStyle(); td.font = SSM.font(role); td.fontSize = size; td.applyFill = true;
        var h = (SSHUD.palette[color] || color).replace("#", "");
        td.fillColor = [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
        td.justification = ParagraphJustification.LEFT_JUSTIFY;
        if (tracking) td.tracking = tracking;
        tp.setValue(td);
        return L;
    }
    var AC = $.getenv("LOCALAPPDATA").split("\\").join("/") + "/MisterHorse/ProductManager/AssetPacks/";
    function grain(c) {
        var hits = Folder(AC + "178fd44c06a96db4cd0c3d15eb6c50b158d26ee0f02fc060b2a7a4e2d248a1e1").getFiles("Grain Footage 01*");
        if (!hits.length) return;
        var it = null;
        for (var i = 1; i <= proj.numItems; i++) { var x = proj.item(i); if (x instanceof FootageItem && x.file && x.file.fsName === hits[0].fsName) it = x; }
        if (!it) it = proj.importFile(new ImportOptions(hits[0]));
        it.mainSource.loop = 20;
        var L = c.layers.add(it); L.name = "AC · Grain"; L.blendingMode = BlendingMode.OVERLAY;
        tr(L, "ADBE Opacity").setValue(45);
        var k = Math.max(c.width / it.width, c.height / it.height) * 100; tr(L, "ADBE Scale").setValue([k, k, 100]);
        L.outPoint = c.duration;
    }

    for (var s = 0; s < SPEC.scenes.length; s++) {
        var S = SPEC.scenes[s];
        var old = findItem(S.comp); if (old) old.remove();
        var plate = importOnce(S.plate);
        var TRK = SSM.readJSON(SS_ROOT + "/" + S.tracks);
        var c = proj.items.addComp(S.comp, TRK.size[0], TRK.size[1], 1, S.duration || plate.duration, TRK.fps);
        c.parentFolder = folder(SPEC.folder || "SS Scenes");
        c.layers.add(plate).name = "Plate";
        // tracking nulls: anchor at the center (100x100 null) so toComp(anchorPoint) == tracked point
        var fd = 1 / TRK.fps;
        for (var nm in TRK.tracks) {
            if (!TRK.tracks.hasOwnProperty(nm)) continue;
            var tk = TRK.tracks[nm], N = c.layers.addNull(), ts = [], ps = [], sc = [];
            N.name = "TRK " + nm; N.enabled = false; N.label = 9;
            tr(N, "ADBE Anchor Point").setValue([50, 50]);
            for (var f = 0; f < tk.pos.length; f++) { ts.push(f * fd); ps.push(tk.pos[f]); sc.push([tk.scale[f] * 100, tk.scale[f] * 100]); }
            tr(N, "ADBE Position").setValuesAtTimes(ts, ps);
            tr(N, "ADBE Scale").setValuesAtTimes(ts, sc);
        }
        SSHUD.init(c);
        function runItem(o) {
            var made_ = [];
            if (o.type === "bracket") made_ = SSHUD.bracket(o);
            else if (o.type === "callout") made_ = SSHUD.callout(o);
            else if (o.type === "meter") made_ = SSHUD.meter(o);
            else if (o.type === "chip") made_ = SSHUD.chip(o);
            else if (o.type === "contour") made_ = SSHUD.contour(o);
            else if (o.type === "faceScan") made_ = SSHUD.faceScan(o);
            else if (o.type === "behind") {
                // in-world text that sits between the background and the people (needs scene.matte)
                var B = text(c, o.text, o.role || "display", o.size || 260, o.color || "cloud", o.tracking || 0);
                var td = B.property("ADBE Text Properties").property("ADBE Text Document"), tv = td.value;
                tv.justification = ParagraphJustification.CENTER_JUSTIFY; td.setValue(tv);
                if (o.anchor) tr(B, "ADBE Position").expression = 'var a = thisComp.layer("' + o.anchor + '"); a.toComp(a.transform.anchorPoint) + [' + o.offset[0] + "," + o.offset[1] + "]";
                else tr(B, "ADBE Position").setValue(o.at);
                tr(B, "ADBE Opacity").setValue(o.opacity || 92);
                SSP.applyText(B, o.preset || "Chars Rise", "in", o.t0 || 0);
                made_ = [B];
            }
            else if (o.type === "title" || o.type === "kicker") {
                var isTitle = o.type === "title";
                var T = text(c, o.text, isTitle ? "display" : "ui", o.size || (isTitle ? 96 : 26), o.color || (isTitle ? "cloud" : "spark"), isTitle ? 0 : 200);
                tr(T, "ADBE Position").setValue(o.at);
                SSP.applyText(T, isTitle ? "Chars Rise" : "Tracking Settle", "in", o.t0 || 0);
                SSHUD.holo(T, 0.5);
                made_ = [T];
            }
            // optional exit: fade every layer of the component out and end it at t1 (e.g. before it leaves the frame)
            if (o.t1) {
                for (var q = 0; q < made_.length; q++) {
                    if (!made_[q] || made_[q].parent) continue;  // children follow their parent
                    made_[q].outPoint = o.t1;
                    SSM.animate(tr(made_[q], "ADBE Opacity"), o.t1 - SSM.seconds("Glide"), tr(made_[q], "ADBE Opacity").valueAtTime(o.t1 - SSM.seconds("Glide") - 0.01, true), 0, "Glide", "Flat");
                }
                for (var q2 = 0; q2 < made_.length; q2++) if (made_[q2] && made_[q2].parent) made_[q2].outPoint = o.t1;
            }
        }
        function pass(test) { for (var h = 0; h < S.hud.length; h++) if (test(S.hud[h].type)) runItem(S.hud[h]); }
        // Layer order (bottom → top): plate · behind texts · people matte · grain · contours · face scans · HUD
        pass(function (t) { return t === "behind"; });
        if (S.matte) {
            var mItem = importOnce(S.matte);
            mItem.mainSource.alphaMode = AlphaMode.STRAIGHT;
            var M = c.layers.add(mItem); M.name = "Matte · people (roto)";
            tr(M, "ADBE Scale").setValue([c.width / mItem.width * 100, c.height / mItem.height * 100, 100]);
        }
        if (S.grain !== false) grain(c);
        pass(function (t) { return t === "contour"; });
        pass(function (t) { return t === "faceScan"; });
        pass(function (t) { return t !== "behind" && t !== "contour" && t !== "faceScan"; });
        made.push(S.comp);
    }
    proj.save();
    return "scenes: " + made.join(", ");
})();
