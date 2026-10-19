// Test 07 · fx loops Float / Wiggle Rotate / Pulse (AE: expressions wiggle()/Math.sin). Cavalry: behaviours wired
// straight into attributes with api.connect(beh, "id", layer, "<attr>") — no keyframes:
//   Float  = "oscillator" (minimum/maximum/frequency in Hz) -> "position.y" (the layer's rest y is replaced, so set min/max around it)
//   Wiggle = "noise" -> "rotation.z" (attrs read back below)
//   Pulse  = "oscillator" -> "scale.x" and "scale.y"
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
T.cleanup();
var stage = T.stage();
var a = T.rect("T_float", 220, 220, "#5b6cff", -500, 0);
var osc = api.create("oscillator", "T_floatOsc");
api.set(osc, { minimum: -20, maximum: 20, frequency: 0.5 });
api.connect(osc, "id", a, "position.y");
var b = T.rect("T_wiggle", 220, 220, "#ff6a3d", 0, 0);
var nz = api.create("noise", "T_wiggleNoise");
var nzAttrs = api.getAttributes(nz);
api.connect(nz, "id", b, "rotation.z");
var c = T.rect("T_pulse", 220, 220, "#c6f432", 500, 0);
var osc2 = api.create("oscillator", "T_pulseOsc");
api.set(osc2, { minimum: 0.92, maximum: 1.08, frequency: 1 });
api.connect(osc2, "id", c, "scale.x"); api.connect(osc2, "id", c, "scale.y");
T.front();
var s = []; for (var f = 0; f <= 50; f += 5) { api.setFrame(f); s.push([f, +api.get(a, "position").y.toFixed(1), +api.get(b, "rotation").z.toFixed(2), +api.get(c, "scale").x.toFixed(3)]); }
JSON.stringify({ frame_y_rot_scale: s, noiseAttrs: nzAttrs.filter(function (x) { return !/^(userData|uuid|channels|color|colorId|hidden|hierarchy|locked|niceName|notes|pinned|show|tags)/.test(x); }) });
