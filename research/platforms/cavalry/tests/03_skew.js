// Test 03 · Jello / Light Speed In (AE: Transform effect skew). Cavalry: the "skew" behaviour connected into the
// shape's "deformers" list; "skew.x" keyframed (Light Speed: -40 -> 0 with position from off-screen on "Whip";
// Jello: a damped back-and-forth skew on the "Snap"/"Settle" tokens).
// UNITS: Cavalry skew is a shear factor (tan of the angle): skew 1 = 45 degrees. Convert AE degrees with Math.tan.
function sh(deg) { return Math.tan(deg * Math.PI / 180); }
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
T.cleanup();
var stage = T.stage();
// Light Speed In
var a = T.text("T_lightSpeed", "LIGHT SPEED", 150, "#c6f432", 0, 220);
var sk = api.create("skew", "T_skewLS");
api.connect(sk, "id", a, "deformers");
T.key(a, "position.x", 0, -1500, 12, 0, "Whip");
T.key(sk, "skew.x", 0, sh(40), 16, 0, "Snap");
T.key(a, "opacity", 0, 0, 6, 100, "Flat");
// Jello on a card
var card = T.rect("T_jello", 360, 360, "#5b6cff", 0, -200);
var sk2 = api.create("skew", "T_skewJello");
api.set(sk2, { pivotY: 0 });            // skew from the base, like a jelly on a plate
api.connect(sk2, "id", card, "deformers");
var stops = [[0, 0], [5, 22], [10, -14], [15, 8], [20, -4], [25, 0]];
for (var i = 0; i < stops.length - 1; i++) T.key(sk2, "skew.x", stops[i][0], sh(stops[i][1]), stops[i + 1][0], sh(stops[i + 1][1]), "Settle");
T.front();
var bb = [];
for (var f = 0; f <= 25; f += 5) { api.setFrame(f); var b = api.getBoundingBox(card, true); bb.push([f, Math.round(b.left), Math.round(b.right), +api.get(sk2, "skew").x.toFixed(3)]); }
JSON.stringify({ jello_bbox_left_right_skew: bb, ls: T.sample(sk, "skew", [0, 4, 8, 16]) });
