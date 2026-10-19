// Test 09 · Counter element (AE kit: counter with Slider + expression). Cavalry: a "stringGenerator" (default
// generator = "textValue") connected out -> textShape "text"; keyframe "generator.number" with a token curve.
// textValue formatting: generator.precision (decimals, default 3), generator.length (zero padding, default pads to 5),
// generator.delimiter (thousands), generator.decimalSeparator, generator.multiplier.
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
T.cleanup();
var stage = T.stage();
var t = T.text("T_counter", "0", 220, "#c6f432", 0, 60);
var sg = api.create("stringGenerator", "T_counterGen");
api.connect(sg, "out", t, "text");
var gAttrs = api.getAttributes(sg).filter(function (a) { return a.indexOf("generator.") === 0; });
api.set(sg, { "generator.precision": 0, "generator.length": 0, "generator.delimiter": "," });   // decimals, zero-padding, thousands
T.key(sg, "generator.number", 0, 0, 40, 12500, "Cruise");
var lbl = T.text("T_counterLbl", "renders this month", 60, "#f2f2f2", 0, -110);
T.stack([stage, t, lbl]);
var w = {}; [0, 10, 20, 30, 40].forEach(function (f) { api.setFrame(f); w[f] = [Math.round(api.get(sg, "generator.number")), Math.round(api.getBoundingBox(t, true).width)]; });
JSON.stringify({ genAttrs: gAttrs, number_width: w });
