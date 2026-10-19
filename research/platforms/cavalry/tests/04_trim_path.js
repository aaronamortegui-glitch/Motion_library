// Test 04 · Line Draw / Organic Draw / Organic Stroke (AE: Trim Paths). Cavalry: every shape has a built-in stroke
// with trim: "stroke.trim" = true, then keyframe "stroke.trimEnd" (0..100, %) and/or "stroke.trimStart" / "stroke.trimTravel".
// Organic curve = "editableShape" + api.setEditablePath (absolute handle coords). Tokens: "Ramp" draw-on.
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
T.cleanup();
var stage = T.stage();
// organic S curve
var c = api.create("editableShape", "T_organic");
api.setEditablePath(c, false, [{ isClosed: false, points: [
    { position: { x: -700, y: 150 }, inHandle: { x: -700, y: 150 }, outHandle: { x: -450, y: 450 } },
    { position: { x: -150, y: 100 }, inHandle: { x: -350, y: -200 }, outHandle: { x: 50, y: 400 } },
    { position: { x: 500, y: 200 }, inHandle: { x: 250, y: -150 }, outHandle: { x: 500, y: 200 } } ] }]);
api.setFill(c, false); api.setStroke(c, true);
api.set(c, { "stroke.width": 18, "stroke.strokeColor": "#c6f432", "stroke.capStyle": 1, "stroke.trim": true });
T.key(c, "stroke.trimEnd", 0, 0, 24, 100, "Ramp");
// frame outline drawing on (kit "frame") with a travelling segment (Organic Stroke style: start chases end)
var f = T.rect("T_frame", 600, 300, "#14171c", 300, -250);
api.setFill(f, false); api.setStroke(f, true);
api.set(f, { "stroke.width": 10, "stroke.strokeColor": "#5b6cff", "stroke.trim": true });
T.key(f, "stroke.trimEnd", 0, 0, 20, 100, "Surge");
T.key(f, "stroke.trimStart", 8, 0, 28, 100, "Surge");
T.front();
JSON.stringify({ strokeAttrs: api.getAttributes(c).filter(function (a) { return a.indexOf("stroke.trim") === 0; }),
  end: T.sample(c, "stroke.trimEnd", [0, 12, 24]), frameStartEnd: [T.sample(f, "stroke.trimStart", [14]), T.sample(f, "stroke.trimEnd", [14])] });
