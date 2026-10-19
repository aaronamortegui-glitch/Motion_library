// Test 14 · Layout QA (AE: check_layout — overlaps and title/action safe area). Cavalry: api.getBoundingBox(id, true)
// returns world-space {left,right,top,bottom,width,height,centre} (y up) at the current frame; sample the final frame
// of each element (api.setFrame) and test pairs for intersection and each box against a 5% action-safe inset.
// Limits: getBoundingBox ignores filter padding (blur/glow spill) and reads geometry, not visible pixels.
api.load("D:/motion category ai library/research/platforms/cavalry/tests/_common.js");
T.cleanup();
var stage = T.stage();
var title = T.text("T_title", "Headline sits here", 120, "#f2f2f2", 0, 300);
var sub = T.text("T_sub", "Subtitle collides", 80, "#c6f432", 120, 230);      // overlaps the title on purpose
var badge = T.rect("T_badge", 300, 120, "#5b6cff", 860, -480);               // crosses the safe area on purpose
T.stack([stage, title, sub, badge]);
function check(ids, frame) {
    api.setFrame(frame);
    var res = api.get(api.getActiveComp(), "resolution"), mx = res.x * 0.05, my = res.y * 0.05;
    var safe = { left: -res.x / 2 + mx, right: res.x / 2 - mx, top: res.y / 2 - my, bottom: -res.y / 2 + my };
    var boxes = {}, warn = [];
    ids.forEach(function (id) { boxes[id] = api.getBoundingBox(id, true); });
    ids.forEach(function (id) { var b = boxes[id];
        if (b.left < safe.left || b.right > safe.right || b.top > safe.top || b.bottom < safe.bottom) warn.push("outside action-safe: " + api.getNiceName(id)); });
    for (var i = 0; i < ids.length; i++) for (var j = i + 1; j < ids.length; j++) {
        var a = boxes[ids[i]], b = boxes[ids[j]];
        var ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom);
        if (ox > 0 && oy > 0) warn.push("overlap " + api.getNiceName(ids[i]) + " x " + api.getNiceName(ids[j]) + " (" + Math.round(ox) + "x" + Math.round(oy) + "px)");
    }
    return { warnings: warn, boxes: Object.keys(boxes).map(function (k) { var b = boxes[k]; return [api.getNiceName(k), Math.round(b.left), Math.round(b.right), Math.round(b.bottom), Math.round(b.top)]; }) };
}
JSON.stringify(check([title, sub, badge], 0));
