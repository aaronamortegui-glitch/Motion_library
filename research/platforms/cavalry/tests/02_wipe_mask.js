// Test 02 · Wipe Reveal / Color Wipe / Iris Reveal (AE: Linear Wipe effect, mask expansion).
// Cavalry: "linearWipe" filter in the "filters" list, "completion" keyframed 100 -> 0 (100 = hidden) with "direction"
// as the wipe angle; Iris = an ellipse connected into the shape's "masks" list (clipping mask) with its
// "generator.radius" keyframed on the "Wind-up" token; "radialWipe" (clock wipe) and "venetianBlinds" (blinds) also exist.
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
T.cleanup();
var stage = T.stage();
// A) bar + label revealed left -> right by a linear wipe (Wipe Reveal)
var bar = T.rect("T_bar", 700, 120, "#c6f432", -450, 200);
var lw = api.create("linearWipe", "T_linWipe");
api.set(lw, { direction: 0, feather: 0 });
api.connect(lw, "id", bar, "filters");
T.key(lw, "completion", 0, 100, 18, 0, "Ramp");
var lbl = T.text("T_wipeText", "Wipe Reveal", 90, "#14171c", -450, 200);
var lw2 = api.create("linearWipe", "T_linWipe2");
api.connect(lw2, "id", lbl, "filters");
T.key(lw2, "completion", 6, 100, 24, 0, "Ramp");
// B) iris: a panel clipped by a growing circle
var panel = T.rect("T_irisPanel", 640, 640, "#5b6cff", 450, 0);
var circ = api.primitive("ellipse", "T_irisMask");
api.set(circ, { position: [450, 0] });
api.connect(circ, "id", panel, "masks");
T.key(circ, "generator.radius.x", 0, 0, 24, 460, "Wind-up");
T.key(circ, "generator.radius.y", 0, 0, 24, 460, "Wind-up");
// C) venetian blinds on a second bar
var bar2 = T.rect("T_bar2", 700, 220, "#ff6a3d", -450, -170);
var vb = api.create("venetianBlinds", "T_blinds");
api.set(vb, { width: 40, direction: 90 });
api.connect(vb, "id", bar2, "filters");
T.key(vb, "completion", 0, 100, 24, 0, "Surge");
T.front();
JSON.stringify({ lw: T.sample(lw, "completion", [0, 9, 18]), iris: T.sample(circ, "generator.radius", [0, 12, 24]),
  panelConn: api.getInConnectedAttributes(panel), maskAttrs: api.getAttributes(panel).filter(function (a) { return a.indexOf("mask") >= 0; }) });
