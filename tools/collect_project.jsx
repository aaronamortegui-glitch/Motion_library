// Collect an After Effects project into a self-contained folder (a scriptable "Collect Files"): saves the open project
// as <dest>/ae/<name>.aep, copies every footage file it uses into <dest>/overlay/ keeping its path relative to the repo
// (files outside the repo go to overlay/_external/), relinks the footage to the copies and saves again. The overlay
// mirrors the repo, so copying it over a clone restores the paths the build scripts expect.
// Usage (run_jsx): $.evalFile(SS_ROOT + "/tools/collect_project.jsx"); COLLECT_PROJECT("D:/out/handoff", "teaser");
// Note: after it runs, the open project IS the collected copy.
function COLLECT_PROJECT(dest, name) {
    var root = new Folder(SS_ROOT).fsName, out = new Folder(dest), copied = 0, bytes = 0, failed = [];
    function mk(p) { var f = new Folder(p); if (!f.exists) { mk(f.parent.fsName); f.create(); } }
    mk(out.fsName + "/ae"); mk(out.fsName + "/overlay");
    var aep = new File(out.fsName + "/ae/" + name + ".aep"); app.project.save(aep);
    var done = {};
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i); if (!(it instanceof FootageItem) || !it.file || !it.file.exists) continue;
        var src = it.file.fsName, rel = src.indexOf(root) === 0 ? src.substr(root.length + 1) : "_external\\" + it.file.name;
        var dst = new File(out.fsName + "/overlay/" + rel.replace(/\\/g, "/"));
        if (!done[src]) { mk(dst.parent.fsName); if (!dst.exists && !it.file.copy(dst.fsName)) { failed.push(src); continue; } done[src] = 1; copied++; bytes += it.file.length; }
        try { it.replace(dst); } catch (e) { failed.push(src + " (" + e.toString() + ")"); }
    }
    app.project.save(aep);
    return "collected " + copied + " files, " + Math.round(bytes / 1e6) + " MB into " + out.fsName + (failed.length ? "\nFAILED:\n" + failed.join("\n") : "");
}
