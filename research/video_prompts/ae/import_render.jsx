// Brings a code-rendered template (route A: MP4, or ProRes 4444 MOV with alpha) into an After Effects comp.
// Reuses the footage item when the same file is already in the project; creates the comp when it does not exist.
// Run (run_jsx): $.evalFile(SS_ROOT + "/research/video_prompts/ae/import_render.jsx");
//   return VP_IMPORT(SS_ROOT + "/research/video_prompts/renders/t11_liquid_transition.mov", "My edit", 4.4);
// opts: { name: layer name, blend: "ADD"|"SCREEN"|..., opacity: 0-100, scaleToComp: true }
function VP_IMPORT(path, compName, t, opts) {
    opts = opts || {};
    var f = new File(path); if (!f.exists) throw new Error("render not found: " + path);
    var item = null;
    for (var i = 1; i <= app.project.numItems; i++) { var it = app.project.item(i); if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) { item = it; break; } }
    if (!item) item = app.project.importFile(new ImportOptions(f));
    var comp = null;
    for (var i = 1; i <= app.project.numItems; i++) if (app.project.item(i) instanceof CompItem && app.project.item(i).name === compName) { comp = app.project.item(i); break; }
    if (!comp) comp = app.project.items.addComp(compName, item.width, item.height, 1, Math.max(item.duration + (t || 0), 1), item.frameRate || 30);
    var L = comp.layers.add(item); L.startTime = t || 0; L.name = opts.name || item.name.replace(/\.[^.]+$/, "");
    if (opts.scaleToComp !== false && (item.width !== comp.width || item.height !== comp.height)) {
        var s = Math.max(comp.width / item.width, comp.height / item.height) * 100; L.property("ADBE Transform Group").property("ADBE Scale").setValue([s, s]);
    }
    if (opts.blend) L.blendingMode = BlendingMode[opts.blend];
    if (opts.opacity !== undefined) L.property("ADBE Transform Group").property("ADBE Opacity").setValue(opts.opacity);
    L.comment = "Motion DNA video template (research/video_prompts)";
    return "placed " + L.name + " in " + comp.name + " at " + (t || 0) + " s (" + (item.mainSource.hasAlpha ? "with alpha" : "opaque") + ")";
}
