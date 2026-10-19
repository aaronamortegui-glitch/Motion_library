// Test 06 · Typewriter + Decode/Scramble (AE: text animator opacity per char, stepped; source-text expression).
// Cavalry: a "stringManipulator" host in the textShape's "manipulators" list with api.setGenerator(..., "resizeString")
// (generator.mode 0 = %, generator.indexMode 0 = character, generator.directionMode 1 = reveal from the start) and
// "generator.percentage" keyframed 0 -> 100 (linear on purpose: a typewriter has constant cadence).
// Decode = a second manipulator with "transitionString" (scrambles into generator.destinationText as percentage goes 0 -> 100).
// Cursor: a rect whose x follows the text's right edge would need a per-frame link; here a blinking "|" via an oscillator on opacity... kept out of scope.
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
T.cleanup();
var stage = T.stage();
var t = T.text("T_type", "Typed one letter at a time_", 90, "#f2f2f2", -760, 150);
api.set(t, { horizontalAlignment: 0 });   // left-aligned so the layout does not shift while typing
var m = api.create("stringManipulator", "T_typeMan");
api.setGenerator(m, "generator", "resizeString");
api.set(m, { "generator.mode": 0, "generator.indexMode": 0, "generator.directionMode": 1 });
api.connect(m, "id", t, "manipulators");
api.keyframe(m, 0, { "generator.percentage": 0 });
api.keyframe(m, 40, { "generator.percentage": 100 });
var d = T.text("T_decode", "########", 120, "#c6f432", -760, -150);
api.set(d, { horizontalAlignment: 0 });
var m2 = api.create("stringManipulator", "T_decodeMan");
api.setGenerator(m2, "generator", "transitionString");
api.set(m2, { "generator.destinationText": "DECODED", "generator.mode": 0 });
api.connect(m2, "id", d, "manipulators");
T.key(m2, "generator.percentage", 0, 0, 30, 100, "Cruise");
T.front();
var strs = {};
[0, 10, 20, 30, 40].forEach(function (f) { api.setFrame(f); strs[f] = [Math.round(api.getBoundingBox(t, true).width), Math.round(api.getBoundingBox(d, true).width)]; });
JSON.stringify({ widths_type_decode: strs, attrs: api.getAttributes(m2).filter(function (a) { return a.indexOf("generator.") === 0; }) });
