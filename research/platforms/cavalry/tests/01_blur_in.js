// Test 01 · Blur In (AE: Gaussian Blur + fade). Cavalry: the "sceneGroup::gaussianBlurFilter" filter connected into
// the shape's "filters" list; its "amount.x/amount.y" keyframed 40 -> 0 with the Motion DNA "Surge" token curve.
// Fast alternative: "blurFilter" (Fast Blur), same "amount" attribute.
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
T.cleanup();
var stage = T.stage();
var t = T.text("T_blurText", "Blur In", 200, "#f2f2f2", 0, 0);
var g = api.create("sceneGroup::gaussianBlurFilter", "T_gauss");
api.connect(g, "id", t, "filters");
T.key(g, "amount.x", 0, 40, 20, 0, "Surge");
T.key(g, "amount.y", 0, 40, 20, 0, "Surge");
T.key(t, "opacity", 0, 0, 14, 100, "Surge");
var order = T.front();
var s = T.sample(g, "amount", [0, 5, 10, 15, 20]);
JSON.stringify({ text: t, filter: g, conn: api.getInConnectedAttributes(t), amount: s, order: order });
