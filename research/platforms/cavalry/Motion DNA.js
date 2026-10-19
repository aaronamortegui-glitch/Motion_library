// Motion DNA for Cavalry (beta): a dockable window (Window › Scripts › Motion DNA) laid out like the After Effects
// panel: Behaviors (pick a preset from thumbnails, adjust, In / Out / Both, Create) and Curves (the token curves, an
// editable curve, Apply to the selected keyframes). install.py copies this file into Cavalry's Scripts folder and
// writes the clone's path below; presets, curves and thumbnails are read from the clone, so a git pull updates them.
var MDNA_ROOT = "__MDNA_ROOT__";

api.load(MDNA_ROOT + "/research/platforms/cavalry/mdna_cavalry.js");
MDNA.init(MDNA_ROOT);

var C = { bg: "#141a18", card: "#1d2522", line: "#2c3833", lime: "#c9f25a", text: "#e6efe9", dim: "#8fa39b", warm: "#d9a48f" };
var INFO = {}, ENERGY = { s: "Soft", m: "Medium", d: "Dynamic" };
api.readFromFile(MDNA_ROOT + "/library/INDEX.txt").split("\n").forEach(function (l) {
    var f = l.split("|");
    if (f[0] === "motion" && f.length > 4) INFO[f[1]] = { channels: f[2], energy: ENERGY[f[3]] || f[3], use: f[4] };
});
var ALL = MDNA.list();
var TOKENS = JSON.parse(api.readFromFile(MDNA_ROOT + "/tokens/superside_motion_tokens.json"));
var CURVES = TOKENS.easings.map(function (e) { return e.name; });
function slug(n) { return n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function thumb(n) { return MDNA_ROOT + "/library/thumbs_sm/motion/" + slug(n) + ".png"; }
function label(text, color, size) { var l = new ui.Label(text); if (color) l.setTextColor(color); if (size) l.setFontSize(size); return l; }
function step(n, text) { var h = new ui.HLayout(); var b = label(" " + n + " ", "#0f1412", 12); b.setBackgroundColor(C.lime); b.setCornerRounding(8); h.add(b); h.add(label(text, C.text, 13)); h.addStretch(); return h; }

ui.setTitle("Motion DNA");
ui.setMinimumWidth(300);
ui.setBackgroundColor(C.bg);

// ------------------------------------------------------------------ Behaviors
var state = { preset: ALL[0], energy: "All", phase: "in", query: "" };
var B = new ui.VLayout();
B.add(step(1, "Pick a preset"));

var search = new ui.LineEdit(); search.setPlaceholder("Search presets");
search.onValueChanged = function () { state.query = search.getText().toLowerCase(); grid(); };
var count = label("", C.dim, 11);
var sh = new ui.HLayout(); sh.add(search); sh.add(count); B.add(sh);

var chips = {}, chipRow = new ui.HLayout();
["All", "Soft", "Medium", "Dynamic"].forEach(function (e) {
    var b = new ui.Button(e); b.setFixedHeight(22);
    b.onClick = function () { state.energy = e; paintChips(); grid(); };
    chips[e] = b; chipRow.add(b);
});
function paintChips() { for (var e in chips) chips[e].setBackgroundColor(e === state.energy ? C.lime : C.card); }
B.add(chipRow);

var flow = new ui.FlowLayout(6, 6), scroll = new ui.ScrollView(), tiles = {};
scroll.setLayout(flow); scroll.setMinimumHeight(250);
B.add(scroll);
function tile(n) {
    var box = new ui.Container(), v = new ui.VLayout();
    var img = new ui.ImageButton(thumb(n)); img.setImageSize(112, 63); img.setDrawStroke(false);
    img.setToolTip(INFO[n] ? INFO[n].use + " · " + INFO[n].channels : n);
    img.onClick = function () { state.preset = n; select(); };
    var name = label(n, C.text, 11); name.setAlignment(1);
    v.add(img); v.add(name); v.setMargins(4, 4, 4, 4); v.setSpaceBetween(2);
    box.setLayout(v); box.setRadius(6, 6, 6, 6); box.setBackgroundColor(C.card); box.setFixedWidth(124);
    return box;
}
function grid() {
    flow.clear(); tiles = {};
    var shown = ALL.filter(function (n) {
        var i = INFO[n] || {};
        return (state.energy === "All" || i.energy === state.energy) && (!state.query || (n + " " + (i.use || "")).toLowerCase().indexOf(state.query) >= 0);
    });
    shown.forEach(function (n) { tiles[n] = tile(n); flow.add(tiles[n]); });
    count.setText(shown.length + " / " + ALL.length);
    select();
}
var chosen = label("", C.text, 13), chosenInfo = label("", C.dim, 11);
function select() {
    for (var n in tiles) tiles[n].setBorder(n === state.preset ? C.lime : C.card, 2);
    var i = INFO[state.preset] || {};
    chosen.setText("● " + state.preset + (i.energy ? "  ·  " + i.energy.toLowerCase() : ""));
    chosenInfo.setText(i.use ? i.use + "  ·  " + i.channels : "");
}
B.add(chosen); B.add(chosenInfo);

B.addSpacing(6);
B.add(step(2, "Adjust, choose In / Out / Both, then Create"));
function field(v, type, stepv, min) { var f = new ui.NumericField(v); f.setType(type); f.setStep(stepv); if (min !== undefined) f.setMin(min); return f; }
function row(name, a, b) { var h = new ui.HLayout(); var l = label(name, C.dim, 12); l.setFixedWidth(84); h.add(l); h.add(a); if (b) h.add(b); return h; }
var duration = field(1, 1, 0.05, 0.25), intensity = field(1, 1, 0.05, 0), stagger = field(3, 0, 1, 0), start = field(0, 0, 1, 0);
var ease = new ui.DropDown(); ease.addEntry("Preset's own curves"); CURVES.forEach(function (c) { ease.addEntry(c); });
var now = new ui.Button("Playhead"); now.onClick = function () { start.setValue(api.getFrame()); };
B.add(row("Duration ×", duration)); B.add(row("Intensity ×", intensity)); B.add(row("Curve", ease));
B.add(row("Stagger (f)", stagger)); B.add(row("Start frame", start, now));

var phases = {}, ph = new ui.HLayout();
[["in", "In"], ["out", "Out"], ["both", "Both"]].forEach(function (p) {
    var b = new ui.Button(p[1]); b.onClick = function () { state.phase = p[0]; paintPhase(); }; phases[p[0]] = b; ph.add(b);
});
function paintPhase() { for (var k in phases) phases[k].setBackgroundColor(k === state.phase ? C.line : C.card); }
B.add(ph);

var status = label("Select layers in the Viewport, pick a preset, Create.", C.dim, 11);
var create = new ui.Button("Create"), remove = new ui.Button("Remove");
create.setBackgroundColor(C.lime); remove.setBackgroundColor(C.warm); create.setFixedHeight(30); remove.setFixedHeight(30);
create.onClick = function () {
    var sel = api.getSelection();
    if (!sel.length) { status.setText("Select one or more layers first."); return; }
    var opts = { duration: duration.getValue(), intensity: intensity.getValue(), ease: ease.getValue() > 0 ? ease.getText() : null };
    var s0 = start.getValue(), st = stagger.getValue(), ends = [];
    try {
        if (state.phase !== "out") ends = MDNA.applyMany(sel, state.preset, "in", s0, st, opts);
        if (state.phase !== "in") {
            var end = api.get(api.getActiveComp(), "endFrame") || 120;
            var at = state.phase === "out" ? s0 : Math.max((ends.length ? Math.max.apply(null, ends) : s0) + 10, end - Math.round(21 * duration.getValue()) - (sel.length - 1) * st);
            MDNA.applyMany(sel, state.preset, "out", at, st, opts);
        }
        status.setText(state.preset + " on " + sel.length + " layer" + (sel.length > 1 ? "s" : "") + ".");
    } catch (e) { status.setText(String(e)); }
};
remove.onClick = function () {
    var sel = api.getSelection();
    sel.forEach(function (id) { ["position", "scale", "rotation", "opacity"].forEach(function (a) { try { api.deleteAnimation(id, a); } catch (e) {} }); });
    status.setText(sel.length ? "Removed the animation." : "Select layers first.");
};
var act = new ui.HLayout(); act.add(create); act.add(remove); B.add(act); B.add(status);
B.addStretch();

// ------------------------------------------------------------------ Curves
var K = new ui.VLayout();
var bz = (MDNA.ease("Land") || [0.12, 0.9, 0.28, 1]).slice(), curveName = "Land", SIZE = 220, PAD = 30;
var draw = new ui.Draw(); draw.setSize(SIZE, SIZE); draw.setBackgroundColor(C.card);
function P(x, y) { return { x: PAD + x * (SIZE - 2 * PAD), y: SIZE - PAD - y * (SIZE - 2 * PAD) }; }   // curve space → widget
function paint() {
    draw.clearPaths();
    var g = new cavalry.Path(), a = P(0, 0), b = P(1, 1);
    g.moveTo(a.x, a.y); g.lineTo(b.x, a.y); g.moveTo(a.x, b.y); g.lineTo(b.x, b.y);
    draw.addPath(g.toObject(), { color: C.line, stroke: true, strokeWidth: 1 });
    var p1 = P(bz[0], bz[1]), p2 = P(bz[2], bz[3]), h = new cavalry.Path();
    h.moveTo(a.x, a.y); h.lineTo(p1.x, p1.y); h.moveTo(b.x, b.y); h.lineTo(p2.x, p2.y);
    draw.addPath(h.toObject(), { color: C.dim, stroke: true, strokeWidth: 1 });
    var c = new cavalry.Path(); c.moveTo(a.x, a.y); c.cubicTo(p1.x, p1.y, p2.x, p2.y, b.x, b.y);
    draw.addPath(c.toObject(), { color: C.lime, stroke: true, strokeWidth: 3 });
    [p1, p2].forEach(function (p) { var d = new cavalry.Path(); d.addEllipse(p.x, p.y, 5, 5); draw.addPath(d.toObject(), { color: C.text }); });
    draw.redraw();
    values.setText(curveName + "   " + bz.map(function (v) { return Math.round(v * 100) / 100; }).join(", "));
}
var drag = -1;
draw.onMousePress = function (pos) {
    var p1 = P(bz[0], bz[1]), p2 = P(bz[2], bz[3]);
    var d1 = Math.hypot(pos.x - p1.x, pos.y - p1.y), d2 = Math.hypot(pos.x - p2.x, pos.y - p2.y);
    drag = Math.min(d1, d2) < 18 ? (d1 < d2 ? 0 : 2) : -1;
};
draw.onMouseMove = function (pos) {
    if (drag < 0) return;
    bz[drag] = Math.max(0, Math.min(1, (pos.x - PAD) / (SIZE - 2 * PAD)));
    bz[drag + 1] = Math.max(-0.5, Math.min(1.5, (SIZE - PAD - pos.y) / (SIZE - 2 * PAD)));
    curveName = "Custom"; paint();
};
draw.onMouseRelease = function () { drag = -1; };
var values = label("", C.text, 12);
K.add(step(1, "Pick a token curve, or drag its handles"));
var cflow = new ui.FlowLayout(4, 4);
CURVES.forEach(function (n) { var b = new ui.Button(n); b.onClick = function () { bz = MDNA.ease(n).slice(); curveName = n; paint(); }; cflow.add(b); });
K.add(cflow);
var dh = new ui.HLayout(); dh.addStretch(); dh.add(draw); dh.addStretch(); K.add(dh); K.add(values);
K.addSpacing(6);
K.add(step(2, "Select keyframes in the Time Editor, then Apply"));
var kstatus = label("Each pair of selected keyframes on an attribute gets this curve.", C.dim, 11);
var kapply = new ui.Button("Apply to selected keyframes"); kapply.setBackgroundColor(C.lime); kapply.setFixedHeight(30);
kapply.onClick = function () {
    var sel = api.getSelectedKeyframes(), n = 0, back = api.getFrame();
    for (var full in sel) {
        var dot = full.indexOf("."), id = full.slice(0, dot), attr = full.slice(dot + 1), fr = sel[full].slice().sort(function (a, b) { return a - b; });
        for (var i = 0; i + 1 < fr.length; i++) {
            var f0 = fr[i], f1 = fr[i + 1];
            api.setFrame(f0); var v0 = api.get(id, attr); api.setFrame(f1); var v1 = api.get(id, attr);
            if (typeof v0 !== "number") continue;
            var o = {}, k = {};
            o[attr] = { frame: f0, outHandle: true, inHandle: false, angleLocked: false, weightLocked: false, xValue: f0 + bz[0] * (f1 - f0), yValue: v0 + bz[1] * (v1 - v0) };
            k[attr] = { frame: f1, inHandle: true, outHandle: false, angleLocked: false, weightLocked: false, xValue: f0 + bz[2] * (f1 - f0), yValue: v0 + bz[3] * (v1 - v0) };
            api.modifyKeyframeTangent(id, o); api.modifyKeyframeTangent(id, k); n++;
        }
    }
    api.setFrame(back);
    kstatus.setText(n ? curveName + " on " + n + " segment" + (n > 1 ? "s" : "") + "." : "Select at least two keyframes on one attribute.");
};
K.add(kapply); K.add(kstatus); K.addStretch();

// ------------------------------------------------------------------ window
var tabs = new ui.TabView();
tabs.add("Behaviors", B);
tabs.add("Curves", K);
var head = new ui.HLayout(); head.add(label("Motion DNA", C.lime, 15)); head.addStretch(); head.add(label(ALL.length + " presets · " + CURVES.length + " curves", C.dim, 11));
ui.add(head);
ui.add(tabs);
paintChips(); paintPhase(); grid(); paint();
ui.show();
