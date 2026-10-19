// Puts the user's Cavalry scene back after proof_cavalry.js: deletes every layer and node the proof made (anything not in
// the saved list), unhides the user's layers, restores fps, frame range, background, motion blur and the playhead.
var P = "D:/motion category ai library - platforms/research/platforms/out/proof";
var keep = JSON.parse(api.readFromFile(P + "/_cavalry_restore.json")), comp = api.getActiveComp();
var mine = {}; keep.layers.concat(keep.all || []).forEach(function (id) { mine[id] = 1; });
var removed = 0;
api.getCompLayers(true).forEach(function (id) { if (!mine[id]) { try { api.deleteLayer(id); removed++; } catch (e) {} } });
if (keep.all) api.getAllSceneLayers().forEach(function (id) { if (!mine[id]) { try { api.deleteLayer(id); removed++; } catch (e) {} } });
keep.layers.forEach(function (id) { try { api.set(id, { hidden: keep.hidden ? keep.hidden[id] : false }); } catch (e) {} });
api.set(comp, { backgroundColor: keep.bg, fps: keep.fps, startFrame: keep.startFrame, endFrame: keep.endFrame, motionBlur: keep.motionBlur === undefined ? false : keep.motionBlur });
api.setFrame(keep.frame);
keep.pending = false; api.writeToFile(P + "/_cavalry_restore.json", JSON.stringify(keep), true);
JSON.stringify({ removed: removed, layers: api.getCompLayers(true).length, all: api.getAllSceneLayers().length, fps: api.get(comp, "fps"), end: api.get(comp, "endFrame") });
