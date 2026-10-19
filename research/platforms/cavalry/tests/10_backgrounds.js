// Test 10 · Backgrounds: mesh gradient + plexus/network (AE kit: SSL.background mesh / network).
// Mesh gradient: "multiPointGradientShader" connected into a full-frame rectangle's "material.colorShaders";
//   api.addArrayIndex(shader, "point") per colour point, then "point.<i>.pointPosition" / "point.<i>.pointColor"
//   (attr names read back below); point positions keyframed for a slow drift.
// Plexus: "connectShape" with api.setGenerator(c, "sourceGenerator", "randomDistribution") (count/size/seed),
//   ignoreTarget true + targetMode 0 (Within Range) + distance = link radius; dots = a "duplicator" of small ellipses
//   on the same random distribution; one "noise" behaviour in both shapes' "deformers" moves points and links together.
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
T.cleanup();
var bg = T.rect("T_meshBg", 1920, 1080, "#000000");
var mg = api.create("multiPointGradientShader", "T_mesh");
var cols = ["#1b2a6b", "#5b6cff", "#14171c", "#2e8c7a"], pos = [[-700, 400], [600, 300], [-500, -400], [700, -350]];
for (var i = 0; i < 2; i++) api.addArrayIndex(mg, "point");   // the list is pre-seeded with TWO points (checked): 2 + 2 = 4
var pAttrs = api.getAttributes(mg).filter(function (a) { return a.indexOf("point.") === 0; });
api.connect(mg, "id", bg, "material.colorShaders");
// plexus
var c = api.create("connectShape", "T_plexus");
api.setGenerator(c, "sourceGenerator", "randomDistribution");
api.set(c, { "sourceGenerator.count": 70, "sourceGenerator.size": [1900, 1060], "sourceGenerator.seed": 7,
    ignoreTarget: true, targetMode: 0, distance: 260, maxPerPointConnections: 4,
    "stroke.width": 1.5, "stroke.strokeColor": "#c6f432" });
api.setStroke(c, true);
var dot = api.primitive("ellipse", "T_dot");
api.set(dot, { "generator.radius": [5, 5], "material.materialColor": "#f2f2f2" });
var dup = api.create("duplicator", "T_dots");
api.connect(dot, "id", dup, "shapes");
api.setGenerator(dup, "generator", "randomDistribution");
api.set(dup, { "generator.count": 70, "generator.size": [1900, 1060], "generator.seed": 7 });
var nz = api.create("noise", "T_drift");
api.set(nz, { strength: 100 });
api.connect(nz, "id", c, "deformers");
api.connect(nz, "id", dup, "deformers");
T.stack([bg, c, dup]);
var err = [];
for (i = 0; i < 4; i++) {
    try {
        api.set(mg, { ["point." + i + ".pointColor"]: cols[i] });
        T.key(mg, "point." + i + ".pointPosition.x", 0, pos[i][0], 100, pos[i][0] * 0.6, "Cruise");
        T.key(mg, "point." + i + ".pointPosition.y", 0, pos[i][1], 100, -pos[i][1] * 0.4, "Cruise");
    } catch (e) { err.push(String(e)); }
}
var dotPos = []; [0, 50].forEach(function (f) { api.setFrame(f); var b = api.getBoundingBox(c, true); dotPos.push([f, Math.round(b.left), Math.round(b.right)]); });
JSON.stringify({ pointAttrs: pAttrs.slice(0, 12), err: err, plexusBBox: dotPos });
