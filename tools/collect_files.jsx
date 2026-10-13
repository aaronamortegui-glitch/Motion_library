// Collect Files by script (AE has no scripting API for File > Dependencies > Collect Files): a self-contained copy
// of one comp with everything it uses, so the project opens on any machine.
//   1. saves the open project, then saves a COPY into the collect folder (the original file is never modified)
//   2. Reduce Project on the copy: only the comp and what it uses stay
//   3. copies every footage file (video, audio, stills, mattes) into "(Footage)/<bin path>/" and relinks the copy to it
//   4. copies the repo fonts (assets/fonts, OFL) into "Fonts/" and writes "collect_report.txt"
//   5. reopens the original project
// Usage: var COLLECT_COMP = "DNA_EDIT", COLLECT_DIR = "D:/.../renders/DNA_PROMO_collect"; $.evalFile(".../collect_files.jsx")
//   or: bash tools/bridge.sh tools/collect_files.jsx 900   (defaults below). Licensed assets (Animation Composer SFX and
//   overlays) are collected too: keep the folder out of git and share it only inside the team.
#include "ss_presets.jsx"
(function () {
    var COMP = (typeof COLLECT_COMP !== "undefined" && COLLECT_COMP) || "DNA_EDIT";
    var DIR = (typeof COLLECT_DIR !== "undefined" && COLLECT_DIR) || (SS_ROOT + "/renders/" + COMP + "_collect");
    var proj = app.project;
    if (proj.file === null) return "ERROR: save the project first";   // not !proj.file: a File object coerces oddly here
    var original = proj.file, comp = null;
    for (var i = 1; i <= proj.numItems; i++) if (proj.item(i) instanceof CompItem && proj.item(i).name === COMP) comp = proj.item(i);
    if (!comp) return "ERROR: comp not found: " + COMP;
    var root = new Folder(DIR); root.create();
    var foot = new Folder(DIR + "/(Footage)"); foot.create();
    var report = [], copied = 0, missing = [], seen = {};
    function safe(s) { return s.replace(/[\\\/:*?"<>|]/g, "_"); }
    function binPath(it) {   // the item's folder path in the Project panel, as subfolders
        var parts = [], f = it.parentFolder;
        while (f && f !== proj.rootFolder) { parts.unshift(safe(f.name)); f = f.parentFolder; }
        return parts.join("/");
    }
    try {
        proj.save();
        var copyFile = new File(DIR + "/" + safe(original.name.replace(/\.aep$/i, "")) + " · " + COMP + ".aep");
        proj.save(copyFile);                     // from here on we work on the copy
        proj.reduceProject([comp]);
        for (var k = 1; k <= proj.numItems; k++) {
            var it = proj.item(k);
            if (!(it instanceof FootageItem) || !(it.mainSource instanceof FileSource) || it.file === null) continue;
            var src = it.file;
            if (!src.exists) { missing.push(it.name + " → " + src.fsName); continue; }
            var sub = binPath(it), dst = new Folder(foot.fsName + (sub ? "/" + sub : "")); dst.create();
            var target = new File(dst.fsName + "/" + src.name);
            if (!seen[src.fsName]) {
                if (!target.exists || target.length !== src.length) src.copy(target.fsName);
                seen[src.fsName] = target.fsName; copied++;
                report.push((sub ? sub + "/" : "") + src.name + "  (" + Math.round(src.length / 1024) + " KB)  ← " + src.fsName);
            }
            var alpha = it.mainSource.alphaMode, loop = it.mainSource.loop;
            if (it.mainSource.isStill) it.replace(new File(seen[src.fsName]));
            else it.replace(new File(seen[src.fsName]));
            try { it.mainSource.alphaMode = alpha; it.mainSource.loop = loop; } catch (eA) {}
        }
        proj.save();
        var fonts = Folder(SS_ROOT + "/assets/fonts").getFiles(function (f) { return /\.(ttf|otf|txt)$/i.test(f.name); });
        var fdir = new Folder(DIR + "/Fonts"); fdir.create();
        for (var fi = 0; fi < fonts.length; fi++) fonts[fi].copy(fdir.fsName + "/" + fonts[fi].name);
        var rep = new File(DIR + "/collect_report.txt"); rep.encoding = "UTF-8"; rep.open("w");
        rep.write("Collect Files · " + COMP + " · " + new Date().toString() + "\nProject copy: " + copyFile.name +
                  "\nFrom: " + original.fsName + "\n\n" + copied + " footage files copied into (Footage):\n" + report.join("\n") +
                  (missing.length ? "\n\nMISSING (not collected):\n" + missing.join("\n") : "\n\nNothing missing.") +
                  "\n\nFonts (install before opening): " + fonts.length + " files in Fonts/ (Inter Tight, Instrument Serif · SIL OFL)." +
                  "\nLicensed assets (Animation Composer SFX/overlays) are included for internal use only: do not publish this folder.\n");
        rep.close();
    } catch (e) {
        app.open(original);
        return "ERROR " + e.toString() + (e.line ? " @" + e.line : "") + " (original project reopened)";
    }
    app.open(original);                          // back to the original project, untouched
    return "collected " + COMP + ": " + copied + " files" + (missing.length ? ", " + missing.length + " MISSING" : "") + " → " + DIR;
})();
