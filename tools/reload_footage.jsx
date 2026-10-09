// Reloads every footage item that points into the repo (after files were replaced on disk, e.g. by
// tools/faceswap_apply.py), so comps and renders use the new pixels. Run: bash tools/bridge.sh tools/reload_footage.jsx
(function () {
    var root = new Folder(SS_ROOT).fsName.toLowerCase(), n = 0;
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (it instanceof FootageItem && it.file && it.file.fsName.toLowerCase().indexOf(root) === 0) { try { it.mainSource.reload(); n++; } catch (e) {} }
    }
    return "reloaded " + n + " footage items";
})();
