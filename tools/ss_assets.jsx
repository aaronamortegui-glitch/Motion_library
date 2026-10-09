// SS Assets — places locally installed asset-pack files (Animation Composer SFX, overlays, textures) by name.
// The files are licensed and stay on this machine; library/ASSETS.local.txt (python tools/index_assets.py) lists
// what is available with category, length and loudness.
// Usage: #include "ss_assets.jsx"
//        SSA.sfx(comp, "Swoosh Wood 01_Variant Main", 1.2, -9);            // name, time, gain dB [, max length s]
//        SSA.overlay(comp, "Light Leak B1 10", 0, "screen", 60);           // name, time [, blend, opacity %]
var SSA = (function () {
    var PACKS = Folder($.getenv("LOCALAPPDATA").split("\\").join("/") + "/MisterHorse/ProductManager/AssetPacks/");
    var BLEND = { normal: BlendingMode.NORMAL, screen: BlendingMode.SCREEN, add: BlendingMode.ADD, overlay: BlendingMode.OVERLAY,
                  "soft-light": BlendingMode.SOFT_LIGHT, multiply: BlendingMode.MULTIPLY, lighten: BlendingMode.LIGHTEN };
    // sensible defaults per overlay family (from library/ASSETS.local.txt categories)
    var DEFAULT_BLEND = [[/light ?leak|burn/i, "screen"], [/grain|scratch|film \d|8mm|16mm|35mm/i, "overlay"], [/vhs|tv_noise|crt|glitch|distort/i, "screen"]];

    function find(name) {
        if (!PACKS.exists) return null;
        var packs = PACKS.getFiles();
        for (var i = 0; i < packs.length; i++) {
            if (!(packs[i] instanceof Folder)) continue;
            var hits = packs[i].getFiles(name + " #*");   // waveform previews are named "<name>.wav #hash.png": no match
            if (hits.length) return hits[0];
        }
        return null;
    }
    function footage(file) {
        var proj = app.project;
        for (var i = 1; i <= proj.numItems; i++) { var it = proj.item(i); if (it instanceof FootageItem && it.file && it.file.fsName === file.fsName) return it; }
        return proj.importFile(new ImportOptions(file));
    }
    function need(name) {
        var f = find(name);
        if (!f) throw new Error("Asset not found in local packs: " + name + " (see library/ASSETS.local.txt)");
        return f;
    }
    return {
        find: find,
        // Audio layer at time t; optional len trims it and fades the last 0.5 s (long booms, risers).
        sfx: function (comp, name, t, gainDb, len) {
            var L = comp.layers.add(footage(need(name)));
            L.name = "SFX · " + name; L.startTime = t;
            var g = gainDb === undefined ? -9 : gainDb;
            var lv = L.property("ADBE Audio Group").property("ADBE Audio Levels");
            lv.setValue([g, g]);
            if (len) { lv.setValueAtTime(t + len - 0.5, [g, g]); lv.setValueAtTime(t + len, [-48, -48]); L.outPoint = t + len; }
            if (L.hasVideo) L.enabled = false;
            return L;
        },
        // Full-frame overlay from t to the end of the comp (looped), scaled to cover, with a blend mode.
        overlay: function (comp, name, t, blend, opacity) {
            var item = footage(need(name));
            if (item.mainSource && !item.mainSource.isStill) item.mainSource.loop = 50;
            var L = comp.layers.add(item);
            L.name = "Overlay · " + name; L.startTime = t || 0; L.inPoint = t || 0; L.outPoint = comp.duration;
            var k = Math.max(comp.width / item.width, comp.height / item.height) * 100;
            L.property("ADBE Transform Group").property("ADBE Scale").setValue([k, k, 100]);
            if (!blend) for (var i = 0; i < DEFAULT_BLEND.length; i++) if (DEFAULT_BLEND[i][0].test(name)) { blend = DEFAULT_BLEND[i][1]; break; }
            L.blendingMode = BLEND[blend || "screen"];
            L.property("ADBE Transform Group").property("ADBE Opacity").setValue(opacity === undefined ? 70 : opacity);
            try { L.audioEnabled = false; } catch (e) {}
            return L;
        }
    };
})();
