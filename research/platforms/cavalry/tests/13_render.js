// Test 13 · Rendering a still and a clip (AE: render_frame / render_comp). Cavalry: api.addRenderQueueItem(comp) ->
// renderQueueItem; api.setGenerator(item, "generator", "renderPNG") for a PNG sequence (default generator is MP4,
// "renderMP4"); set filePath, fileName, frameRangeMode 2 (Custom) + frameRange [in, out]; api.render(item) renders
// synchronously. The MCP tool snapshot_layer (or api.snapshotLayer in a script) gives a quick PNG without the queue.
// Output goes to a "cavalry-mcp-" folder under api.getTempFolder() (removable with the MCP tool cleanup_workspace).
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
T.cleanup();
var stage = T.stage();
var t = T.text("T_renderText", "Render test", 160, "#c6f432");
T.key(t, "position.y", 0, -200, 14, 0, "Land");
T.key(t, "opacity", 0, 0, 8, 100, "Flat");
T.stack([stage, t]);
var dir = api.getTempFolder() + "/cavalry-mcp-mdna-render";
var comp = api.getActiveComp(), out = {};
var png = api.addRenderQueueItem(comp);
api.setGenerator(png, "generator", "renderPNG");
api.set(png, { filePath: dir, fileName: "still", frameRangeMode: 2, frameRange: [14, 14] });
var t0 = Date.now(); api.render(png); out.pngMs = Date.now() - t0;
var mp4 = api.addRenderQueueItem(comp);
api.set(mp4, { filePath: dir, fileName: "clip", frameRangeMode: 2, frameRange: [0, 24] });
t0 = Date.now(); api.render(mp4); out.mp4Ms = Date.now() - t0;
out.dir = dir; out.items = api.getRenderQueueItems();
out.files = api.getFilesInFolder ? api.getFilesInFolder(dir) : "n/a";
JSON.stringify(out);
