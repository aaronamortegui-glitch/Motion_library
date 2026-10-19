// Test 99 · Clean-up after the capability tests: removes the test layers (everything not in T.BASE, the user's scene
// before the tests; behaviours, filters, assets and render-queue items made by the tests are scene layers too),
// restores the comp to 1920x1080 (test 15 changes it) and puts the playhead back where it was (frame 58).
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
var removed = T.cleanup();
api.set(api.getActiveComp(), { resolution: [1920, 1080] });
api.setFrame(58);
JSON.stringify({ removed: removed, left: api.getAllSceneLayers(), children: api.getChildren(api.getActiveComp()),
  res: api.get(api.getActiveComp(), "resolution"), assets: api.getAssetWindowLayers(false), rq: api.getRenderQueueItems() });
