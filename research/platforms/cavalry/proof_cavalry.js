// Motion DNA proof in Cavalry: saves the scene state, hides the user's layers, rebuilds the Figma frame (out/proof/manifest.json),
// runs choreo.json (12 steps, 30 fps) and renders out/proof/proof_cavalry.mp4. ALWAYS run proof_restore.js afterwards.
// Set PROOF_OPTS = {render: false, motionBlur: false} before api.load()ing this file to build without rendering.
var OPT = typeof PROOF_OPTS !== "undefined" ? PROOF_OPTS : {};
var ROOT = "D:/motion category ai library - platforms", P = ROOT + "/research/platforms/out/proof";
api.load(ROOT + "/research/platforms/cavalry/mdna_cavalry.js"); MDNA.init(ROOT);
api.load(ROOT + "/research/platforms/cavalry/mdna_figma.js");
var comp = api.getActiveComp();
// never overwrite a saved state that was not restored yet (it would record the hidden layers and this build as the user's)
var prev = null; try { prev = JSON.parse(api.readFromFile(P + "/_cavalry_restore.json")); } catch (e) {}
if (prev && prev.pending) throw new Error("run proof_restore.js first: the last proof build was not restored");
var keep = { bg: api.get(comp, "backgroundColor"), frame: api.getFrame(), layers: api.getCompLayers(true), fps: api.get(comp, "fps"),
             startFrame: api.get(comp, "startFrame"), endFrame: api.get(comp, "endFrame"),
             motionBlur: api.get(comp, "motionBlur"), all: api.getAllSceneLayers(), pending: true };
keep.hidden = {}; keep.layers.forEach(function (id) { keep.hidden[id] = !!api.get(id, "hidden"); });
api.writeToFile(P + "/_cavalry_restore.json", JSON.stringify(keep), true);
keep.layers.forEach(function (id) { try { api.set(id, { hidden: true }); } catch (e) {} });
var ch = JSON.parse(api.readFromFile(P + "/choreo.json"));
api.set(comp, { fps: 30, startFrame: 0, endFrame: ch.frames - 1 });
var built = MDNA_FIGMA.build(P, { resize: false });
var byId = {}; built.forEach(function (b) { byId[b.figma] = b.id; });
var STRIPE = { 18: "29:384", 21: "29:383", 24: "29:385" }, log = [];
ch.steps.forEach(function (st) {
    var id = st.layer === "Rectangle" ? byId[STRIPE[st.at]] : (built.filter(function (b) { return b.name === st.layer; })[0] || {}).id;
    try { if (st.kit) MDNA.kit(st.kit, [id], "in", st.at, {}); else MDNA.apply(id, st.preset, "in", st.at); log.push(st.layer + "@" + st.at); }
    catch (e) { log.push(st.layer + " ERR " + e); }
});
if (OPT.motionBlur !== false) {
    api.set(comp, { motionBlur: true });
    built.forEach(function (b) { try { api.set(b.id, { motionBlur: 1 }); } catch (e) {} });
}
if (OPT.noUnitBlur) api.getAllSceneLayers().forEach(function (id) { if (api.getNiceName(id) === "MDNA Unit Blur") api.deleteLayer(id); });
if (OPT.legacyJS) api.getAllSceneLayers().forEach(function (id) { if (api.getLayerType(id) === "javaScript") api.set(id, { legacyPerformance: true }); });
if (OPT.render !== false) {
var it = api.addRenderQueueItem(comp);
api.set(it, { filePath: P, fileName: OPT.fileName || "proof_cavalry", frameRangeMode: 2, frameRange: OPT.range || [0, ch.frames - 1] });
api.render(it);
try { api.deleteLayer(it); } catch (e) {}
}
JSON.stringify({ steps: log, fps: api.get(comp, "fps") });
