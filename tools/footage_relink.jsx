// Releases or restores AE's hold on the clips listed in media/faceswap/jobs.json, so tools/faceswap_apply.py can
// overwrite them while AE is open (Windows locks open footage).
//   release: footage that points to a job's "src" is relinked to its refined "out" file
//   restore: footage that points to a job's "out" is relinked back to "src" (now holding the refined pixels)
// Run: bash tools/bridge.sh tools/footage_relink_release.jsx | ..._restore.jsx
#include "ss_motion_lib.jsx"
var FS_MODE = (typeof FS_MODE !== "undefined") ? FS_MODE : "release";
(function () {
    var jobs = SSM.readJSON(SS_ROOT + "/media/faceswap/jobs.json").jobs, n = 0;
    for (var j = 0; j < jobs.length; j++) {
        var src = new File(SS_ROOT + "/" + jobs[j].src), out = new File(SS_ROOT + "/" + jobs[j].out);
        if (!out.exists) continue;
        var from = FS_MODE === "release" ? src : out, to = FS_MODE === "release" ? out : src;
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof FootageItem && it.file && it.file.fsName.toLowerCase() === from.fsName.toLowerCase()) { it.replace(to); n++; }
        }
    }
    return FS_MODE + ": " + n + " footage items relinked";
})();
