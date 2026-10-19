// Test 08 · Solid transition "bars" over a cut (AE kit: solid_transition bars, staggered solids).
// Cavalry: ONE rectangle into a "duplicator" (api.setGenerator(dup, "generator", "linearDistribution"), count 6,
// spread across the frame); the bar travel is a "value" behaviour keyframed (token curves: Surge in, Launch out)
// connected to dup "shapePosition.y"; a "stagger" (0 -> 6 frames) into dup "shapeTimeOffset" delays each bar.
// The cut: scene A's layers go to opacity 0 at frame 21, scene B appears under the bars.
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
T.cleanup();
var stage = T.stage();
var bgB = T.rect("T_sceneB_bg", 1920, 1080, "#c6f432");
var txtB = T.text("T_sceneB", "SCENE B", 200, "#14171c");
var bgA = T.rect("T_sceneA_bg", 1920, 1080, "#5b6cff");
var txtA = T.text("T_sceneA", "SCENE A", 200, "#f2f2f2");
[bgA, txtA].forEach(function (id) { api.keyframe(id, 20, { opacity: 100 }); api.keyframe(id, 21, { opacity: 0 }); });
var bar = T.rect("T_bar", 1920 / 6 + 2, 1100, "#14171c");
var dup = api.create("duplicator", "T_bars");
api.connect(bar, "id", dup, "shapes");
api.setGenerator(dup, "generator", "linearDistribution");
var genAttrs = api.getAttributes(dup).filter(function (a) { return a.indexOf("generator.") === 0; });
api.set(dup, { "generator.count": 6 });
api.set(dup, { "generator.size": 1920 - 1920 / 6 });   // linearDistribution size is a single double (total extent)
var v = api.create("value", "T_barTravel");
T.key(v, "value", 0, 1100, 14, 0, "Surge");
T.key(v, "value", 22, 0, 36, -1100, "Launch");
api.connect(v, "id", dup, "shapePosition.y");
var st = api.create("stagger", "T_barStagger");
api.set(st, { minimum: 0, maximum: 6 });
api.connect(st, "id", dup, "shapeTimeOffset");
var order = T.stack([stage, bgB, txtB, bgA, txtA, dup]);   // bottom -> top
JSON.stringify({ dup: dup, genAttrs: genAttrs, valueAttrs: api.getAttributes(v).filter(function (a) { return /value|min|max/.test(a); }), order: order.slice(0, 8), bars: (function () { var o = []; [8, 14, 20, 28].forEach(function (f) { api.setFrame(f); var b = api.getBoundingBox(dup, true); o.push([f, Math.round(b.left), Math.round(b.right), Math.round(b.bottom), Math.round(b.top)]); }); return o; })() });
