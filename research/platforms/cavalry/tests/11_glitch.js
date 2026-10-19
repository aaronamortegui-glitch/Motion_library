// Test 11 · Glitch look (AE kit: SSL.glitch = RGB split + slice displacement + stepped timing).
// Cavalry: "rgbSplitFilter" (redOffset/greenOffset/blueOffset double2, strength) + "distortionFilter" in
// directionMode 1 (Directional) whose "shader" sub-UI defaults to a noise shader (amplitude = px) for the slice tear,
// both in the textShape's "filters" list; a "noise" behaviour drives redOffset.x so it jitters; the layer's
// "posterizeTime" (+ posterizeFrameRate 8) gives the stepped, on-twos look. A burst = keyframed strength/amplitude.
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
T.cleanup();
var stage = T.stage();
var t = T.text("T_glitch", "GLITCH", 300, "#f2f2f2", 0, 0);
var rgb = api.create("rgbSplitFilter", "T_rgb");
api.set(rgb, { redOffset: [24, 0], blueOffset: [-24, 0], greenOffset: [0, 0] });
api.connect(rgb, "id", t, "filters");
var dist = api.create("distortionFilter", "T_tear");
api.set(dist, { directionMode: 1, amplitude: 60, direction: 0 });
api.connect(dist, "id", t, "filters");
var nz = api.create("noise", "T_jitter");
api.connect(nz, "id", rgb, "redOffset.x");
api.set(nz, { "generator.minimum": -40, "generator.maximum": 40, "generator.frequency": 4 });
api.set(t, { posterizeTime: true, posterizeFrameRate: 8 });
// burst: clean -> glitch (frames 10-16) -> clean
[[0, 0], [9, 0], [10, 100], [16, 100], [17, 0]].forEach(function (k) { api.keyframe(rgb, k[0], { strength: k[1] }); api.keyframe(dist, k[0], { amplitude: k[1] * 0.6 }); });
// NOTE: do not burst the distortion with its "opacity": its blendMode is Replace, so opacity 0 hides the whole layer.
T.stack([stage, t]);
JSON.stringify({ jitter: T.sample(rgb, "redOffset", [10, 12, 14, 16]), shaderAttrs: api.getAttributes(dist).filter(function (a) { return a.indexOf("shader.") === 0; }).slice(0, 8) });
