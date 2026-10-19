// Test 12 · Speed Ramp / time remap (AE: Time Remap on footage). Cavalry: footage = a rectangle whose fill is an
// "imageShader" (connected into "material.colorShaders") with the video asset (api.loadAsset(path, false)) in "image".
// The shader's "time" attribute (frame number of the clip) is connected to the comp's time by default: disconnect it
// (api.disconnect) and keyframe "time" yourself — here a ramp: normal speed, a hard slow-down on the "Ramp" token, then a freeze.
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
T.cleanup();
var stage = T.stage();
var asset = api.loadAsset(T.ROOT + "/docs/examples/test-mix.mp4", false);
// api.set(shader, {image: assetId}) does NOT take (reads back null, renders black): let Cavalry build the footage
// layer with api.addAssetToComp(asset) and find the imageShader it wired up.
var made = api.addAssetToComp(asset);
var r = (typeof made === "string") ? made : made[0];
var sh = api.getAllSceneLayers().filter(function (x) { return api.getLayerType(x) === "imageShader" && T.BASE.indexOf(x) < 0; })[0];
var src = api.getInConnection(sh, "time");
if (src) api.disconnect(src.split(".")[0] === src ? src : src.substring(0, src.indexOf(".")), src.substring(src.indexOf(".") + 1), sh, "time");
var after = api.getInConnection(sh, "time");
T.key(sh, "time", 0, 0, 20, 24, "Flat");      // ~1x (clip is 30 fps, comp 25 fps)
T.key(sh, "time", 20, 24, 50, 40, "Ramp");    // slow-mo ramp
api.keyframe(sh, 70, { time: 40 });            // freeze 50-70
T.stack([stage, r]);
JSON.stringify({ version: api.getCavalryVersion ? api.getCavalryVersion() : null, footage: r, footageType: api.getLayerType(r), shader: sh, asset: asset, assetType: api.getAssetType(asset), seqLen: api.get(sh, "sequenceLength"), timeSrcBefore: src, timeSrcAfter: after,
  time: T.sample(sh, "time", [0, 10, 20, 35, 50, 60, 70]) });
