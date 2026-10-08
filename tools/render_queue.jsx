// Renders in the open AE (render queue) the comps listed in research/gif_comps.txt that don't have an MP4 yet.
// Used instead of aerender: aerender hangs when the project contains layers with
// Animation Composer presets (the plugin waits for interaction in headless mode).
// Output: library/mp4/<kind>/<slug>.mp4   (same scheme as render_gifs.sh)
var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    var ROOT = SS_ROOT + "/";
    var TEMPLATE = "H.264 - Match Render Settings - 15 Mbps";
    var lf = new File(ROOT + "research/gif_comps.txt"); lf.encoding = "UTF-8";
    if (!lf.exists) return "Missing research/gif_comps.txt";
    lf.open("r"); var names = lf.read().split("\n"); lf.close();
    function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
    var proj = app.project, rq = proj.renderQueue, queued = 0, skipped = 0, missing = [];
    for (var i = rq.numItems; i >= 1; i--) rq.item(i).remove(); // clear queue
    var comps = {};
    for (var k = 1; k <= proj.numItems; k++) if (proj.item(k) instanceof CompItem) comps[proj.item(k).name] = proj.item(k);
    for (var n = 0; n < names.length; n++) {
        var nm = names[n].replace(/\r/g, "");
        if (!nm) continue;
        var parts = nm.split("__");                    // GIF__<kind>__<name that may contain __>
        var out = new File(ROOT + "library/mp4/" + parts[1] + "/" + slug(parts.slice(2).join("__")) + ".mp4");
        if (out.exists) { skipped++; continue; }
        if (!comps[nm]) { missing.push(nm); continue; }
        Folder(out.parent.fsName).create();
        var item = rq.items.add(comps[nm]);
        var om = item.outputModule(1);
        om.applyTemplate(TEMPLATE);
        om.file = out;
        queued++;
    }
    // render() does not run inside the bridge task: it is scheduled as its own task.
    // The caller waits for the files listed in research/_render_expected.txt to exist.
    var ex = new File(ROOT + "research/_render_expected.txt"); ex.encoding = "UTF-8"; ex.open("w");
    for (var q = 1; q <= rq.numItems; q++) ex.writeln(rq.item(q).outputModule(1).file.fsName);
    ex.close();
    if (queued) app.scheduleTask("app.project.renderQueue.render()", 200, false);
    return "render: " + queued + " new · " + skipped + " already existed" + (missing.length ? " · no comp: " + missing.join(", ") : "");
})();
