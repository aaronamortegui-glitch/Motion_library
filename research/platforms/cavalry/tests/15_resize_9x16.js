// Test 15 · Social resize 16:9 -> 9:16 (AE: resize_comp). Cavalry: api.set(api.getActiveComp(), {resolution: [1080, 1920]})
// (comp origin stays at the centre, y up), then refit each top-level element: remap its position into the new frame and
// scale it down when its world bbox is wider than the action-safe width (getBoundingBox). Restore with resolution [1920, 1080].
// Alternative kept for later: a second comp (api.createComp) holding a pre-comp reference (api.createCompReference) of the 16:9 one.
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
T.cleanup();
var comp = api.getActiveComp();
var stage = T.stage();
var title = T.text("T_title169", "A wide headline for 16:9", 120, "#f2f2f2", 0, 120);
var card = T.rect("T_card169", 900, 300, "#5b6cff", 0, -200);
var tag = T.text("T_tag169", "corner tag", 50, "#c6f432", 700, 420);
T.stack([stage, title, card, tag]);
var from = api.get(comp, "resolution"), to = { x: 1080, y: 1920 };
api.set(comp, { resolution: [to.x, to.y] });
var safeW = to.x * 0.9, report = [];
[title, card, tag].forEach(function (id) {
    var p = api.get(id, "position");
    api.set(id, { position: [p.x * to.x / from.x, p.y * to.y / from.y] });          // keep the relative placement
    var b = api.getBoundingBox(id, true);
    if (b.width > safeW) { var k = safeW / b.width, s = api.get(id, "scale"); api.set(id, { scale: [s.x * k, s.y * k] }); }
    b = api.getBoundingBox(id, true);
    report.push([api.getNiceName(id), Math.round(b.left), Math.round(b.right), Math.round(b.bottom), Math.round(b.top)]);
});
JSON.stringify({ from: from, to: api.get(comp, "resolution"), boxes: report });
