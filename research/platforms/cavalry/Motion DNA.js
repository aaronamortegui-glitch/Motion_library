// Motion DNA for Cavalry (beta): a dockable window (Window › Scripts › Motion DNA) laid out like the After Effects
// panel: Behaviors (choose a type: Moves = presets, or Effects / Text / Loops / Elements = kit pieces; pick from thumbnails, adjust,
// In / Out / Both or the piece's own phase, Create) and Curves (the token curves, an
// editable curve, Apply to the selected keyframes). install.py copies this file into Cavalry's Scripts folder and
// writes the clone's path below; presets, curves and thumbnails are read from the clone, so a git pull updates them.
var MDNA_ROOT = "__MDNA_ROOT__";
try {

api.load(MDNA_ROOT + "/research/platforms/cavalry/mdna_cavalry.js");
MDNA.init(MDNA_ROOT);
api.load(MDNA_ROOT + "/research/platforms/cavalry/mdna_figma.js");

var C = { bg: "#141a18", card: "#1d2522", line: "#2c3833", lime: "#c9f25a", text: "#e6efe9", dim: "#8fa39b", warm: "#d9a48f" };
var INFO = {}, ENERGY = { s: "Soft", m: "Medium", d: "Dynamic" };
api.readFromFile(MDNA_ROOT + "/library/INDEX.txt").split("\n").forEach(function (l) {
    var f = l.split("|");
    if ((f[0] === "motion" || f[0] === "fx" || f[0] === "text") && f.length > 4 && !INFO[f[1]]) INFO[f[1]] = { channels: f[2], energy: ENERGY[f[3]] || f[3], use: f[4] };
});
var ALL = MDNA.list();
var TYPES = MDNA.kitTypes();
var TOKENS = JSON.parse(api.readFromFile(MDNA_ROOT + "/tokens/superside_motion_tokens.json"));
var CURVES = TOKENS.easings.map(function (e) { return e.name; });
var ALIAS = { wiggle: "Wiggle Rotate", counter: "Count Up" };   // kit pieces whose library entry / thumbnail has another name
function slug(n) { return n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function thumb(n) { return MDNA_ROOT + "/library/thumbs_sm/motion/" + slug(n) + ".png"; }
function kitThumb(p) {
    var names = [p.name, ALIAS[p.id]].filter(Boolean), dirs = ["motion", "fx", "text"];
    for (var i = 0; i < names.length; i++) for (var j = 0; j < dirs.length; j++) {
        var f = MDNA_ROOT + "/library/thumbs_sm/" + dirs[j] + "/" + slug(names[i]) + ".png";
        if (api.filePathExists(f)) return f;
    }
    return null;
}
function kitInfo(p) { return INFO[p.name] || INFO[ALIAS[p.id]] || {}; }
function label(text, color, size) { var l = new ui.Label(text); if (color) l.setTextColor(color); if (size) l.setFontSize(size); return l; }
function step(n, text) { var h = new ui.HLayout(); var b = label(" " + n + " ", "#0f1412", 12); b.setBackgroundColor(C.lime); b.setCornerRounding(8); h.add(b); h.add(label(text, C.text, 13)); h.addStretch(); return h; }

ui.setTitle("Motion DNA");
ui.setMinimumWidth(300);
ui.setBackgroundColor(C.bg);

// ------------------------------------------------------------------ Behaviors
// type "Moves" = the portable presets (MDNA.apply); Effects, Text, Loops, Elements = kit pieces (MDNA.kit, research/platforms/kit_portable.json)
var state = { type: "Moves", preset: ALL[0], piece: null, energy: "All", phase: "in", query: "" };
var B = new ui.VLayout();
B.add(step(1, "Choose a type"));
var typeDrop = new ui.DropDown();
TYPES.forEach(function (t) { typeDrop.addEntry(t); });
B.add(typeDrop);
B.addSpacing(4);
var stepTwo = label("Pick a preset", C.text, 13), two = new ui.HLayout(), twoBadge = label(" 2 ", "#0f1412", 12);
twoBadge.setBackgroundColor(C.lime); twoBadge.setCornerRounding(8); two.add(twoBadge); two.add(stepTwo); two.addStretch();
B.add(two);

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
scroll.setLayout(flow); scroll.setFixedHeight(250);   // a ScrollView takes fixed sizes only
B.add(scroll);
// hover previews, like After Effects: the tile under the mouse plays its preview (frames made by install.py)
var ANIM_DIR = MDNA_ROOT + "/research/platforms/cavalry/thumbs_anim", ANIM_N = {};
try { ANIM_N = JSON.parse(api.readFromFile(ANIM_DIR + "/index.json")); } catch (e) {}
var HOVER = { pic: null, key: null, still: null, i: 0, onTimeout: function () {
    if (!this.pic) return;
    this.i = (this.i + 1) % ANIM_N[this.key];
    this.pic.setImage(ANIM_DIR + "/" + this.key + "/f_" + (this.i < 10 ? "0" : "") + this.i + ".png");
} };
var hoverTimer = new api.Timer(HOVER); hoverTimer.setInterval(80);
function hoverOn(pic, img) {
    var m = /thumbs_sm\/([a-z]+)\/([^\/]+)\.png$/.exec(img || ""), key = m ? m[1] + "/" + m[2] : null;
    if (!key || !ANIM_N[key]) return;
    hoverOff(); HOVER.pic = pic; HOVER.key = key; HOVER.still = img; HOVER.i = 0; hoverTimer.start();
}
function hoverOff() {
    hoverTimer.stop();
    if (HOVER.pic && HOVER.still) HOVER.pic.setImage(HOVER.still);
    HOVER.pic = null;
}

function tile(title, tip, img, onPick) {
    var box = new ui.Container(), v = new ui.VLayout(), pic;
    if (img) { pic = new ui.ImageButton(img); pic.setImageSize(112, 63); pic.setDrawStroke(false); }
    else { pic = new ui.Button(title); pic.setFixedWidth(112); pic.setFixedHeight(63); pic.setBackgroundColor(C.line); pic.setDrawStroke(false); }   // text tile: no thumbnail for it yet
    pic.setToolTip(tip);
    pic.onClick = onPick;
    var name = label(title, C.text, 11); name.setAlignment(1);
    v.add(pic); v.add(name); v.setMargins(4, 4, 4, 4); v.setSpaceBetween(2);
    box.setLayout(v); box.setRadius(6, 6, 6, 6); box.setBackgroundColor(C.card); box.setFixedWidth(124);
    if (img) { box.onMouseEnter = function () { hoverOn(pic, img); }; box.onMouseLeave = hoverOff; }
    return box;
}
function matches(name, i) {
    return (state.energy === "All" || i.energy === state.energy) && (!state.query || (name + " " + (i.use || "")).toLowerCase().indexOf(state.query) >= 0);
}
function grid() {
    flow.clear(); tiles = {};
    if (state.type === "Moves") {
        var shown = ALL.filter(function (n) { return matches(n, INFO[n] || {}); });
        shown.forEach(function (n) {
            var i = INFO[n] || {};
            tiles[n] = tile(n, i.use ? i.use + " · " + i.channels : n, thumb(n), function () { state.preset = n; select(); });
            flow.add(tiles[n]);
        });
        count.setText(shown.length + " / " + ALL.length);
    } else {
        var all = MDNA.kitList(state.type);
        var kshown = all.filter(function (p) { return matches(p.name, { energy: kitInfo(p).energy, use: p.use }); });
        kshown.forEach(function (p) {
            tiles[p.id] = tile(p.name, p.use, kitThumb(p), function () { state.piece = p; select(); paintPhase(); });
            flow.add(tiles[p.id]);
        });
        count.setText(kshown.length + " / " + all.length);
    }
    select();
}
var chosen = label("", C.text, 13), chosenInfo = label("", C.dim, 11);
function select() {
    var cur = state.type === "Moves" ? state.preset : (state.piece ? state.piece.id : "");
    for (var n in tiles) tiles[n].setBorder(n === cur ? C.lime : C.card, 2);
    if (state.type === "Moves") {
        var i = INFO[state.preset] || {};
        chosen.setText("● " + state.preset + (i.energy ? "  ·  " + i.energy.toLowerCase() : ""));
        chosenInfo.setText(i.use ? i.use + "  ·  " + i.channels : "");
    } else if (state.piece) {
        var k = kitInfo(state.piece);
        chosen.setText("● " + state.piece.name + (k.energy ? "  ·  " + k.energy.toLowerCase() : ""));
        chosenInfo.setText(state.piece.use + (state.piece.creates ? "  ·  creates " + state.piece.creates : ""));
    } else { chosen.setText(""); chosenInfo.setText(""); }
}
B.add(chosen); B.add(chosenInfo);

B.addSpacing(6);
B.add(step(3, "Adjust, then Create"));
function field(v, type, stepv, min) { var f = new ui.NumericField(v); f.setType(type); f.setStep(stepv); if (min !== undefined) f.setMin(min); return f; }
function row(name, a, b) { var h = new ui.HLayout(); var l = label(name, C.dim, 12); l.setFixedWidth(84); h.add(l); h.add(a); if (b) h.add(b); return h; }
var duration = field(1, 1, 0.05, 0.25), intensity = field(1, 1, 0.05, 0), stagger = field(3, 0, 1, 0), start = field(0, 0, 1, 0);
var ease = new ui.DropDown(); ease.addEntry("Preset's own curves"); CURVES.forEach(function (c) { ease.addEntry(c); });
var now = new ui.Button("Playhead"); now.onClick = function () { start.setValue(api.getFrame()); };
B.add(row("Duration ×", duration)); B.add(row("Intensity ×", intensity)); B.add(row("Curve", ease));
B.add(row("Stagger (f)", stagger)); B.add(row("Start frame", start, now));

// In / Out / Both, plus one button for a piece's own phase (Emphasis, Loop, Transition); only the phases it supports are enabled
var phases = {}, ph = new ui.HLayout(), special = "";
[["in", "In"], ["out", "Out"], ["both", "Both"], ["special", "Loop"]].forEach(function (p) {
    var b = new ui.Button(p[1]); b.onClick = function () { if (b.isEnabled()) { state.phase = p[0] === "special" ? special : p[0]; paintPhase(); } };
    phases[p[0]] = b; ph.add(b);
});
function supported() {
    if (state.type === "Moves") return ["in", "out", "both"];
    var ps = state.piece ? state.piece.phase.slice() : [];
    if (ps.indexOf("in") >= 0 && ps.indexOf("out") >= 0) ps.push("both");
    return ps;
}
function paintPhase() {
    var ok = supported();
    special = ok.filter(function (x) { return x !== "in" && x !== "out" && x !== "both"; })[0] || "";
    if (ok.indexOf(state.phase) < 0) state.phase = ok[0] || "in";
    phases.special.setHidden(!special);
    if (special) phases.special.setText(special.charAt(0).toUpperCase() + special.slice(1));
    ["in", "out", "both"].forEach(function (k) { phases[k].setEnabled(ok.indexOf(k) >= 0); phases[k].setHidden(!!special); });
    for (var k in phases) {
        var on = k === "special" ? (special && state.phase === special) : k === state.phase;
        phases[k].setBackgroundColor(on ? C.line : C.card);
    }
}
B.add(ph);

typeDrop.onValueChanged = function () {
    state.type = typeDrop.getText();
    if (state.type !== "Moves" && (!state.piece || state.piece.type !== state.type)) state.piece = MDNA.kitList(state.type)[0] || null;
    stepTwo.setText(state.type === "Moves" ? "Pick a preset" : "Pick a piece");
    search.setPlaceholder(state.type === "Moves" ? "Search presets" : "Search " + state.type.toLowerCase());
    grid(); paintPhase();
};

var status = label("Select layers in the Viewport, pick a preset, Create.", C.dim, 11);
var create = new ui.Button("Create"), remove = new ui.Button("Remove");
create.setBackgroundColor(C.lime); remove.setBackgroundColor(C.warm); create.setFixedHeight(30); remove.setFixedHeight(30);
create.onClick = function () {
    var sel = api.getSelection();
    var opts = { duration: duration.getValue(), intensity: intensity.getValue(), ease: ease.getValue() > 0 ? ease.getText() : null };
    var s0 = start.getValue(), st = stagger.getValue(), ends = [];
    if (state.type !== "Moves") {   // kit piece: Elements that create layers (counter, bars) work with no selection
        if (!state.piece) { status.setText("Pick a piece first."); return; }
        if (!state.piece.creates && !sel.length) { status.setText("Select one or more layers first."); return; }
        try {
            opts.stagger = st;
            var r = MDNA.kit(state.piece.id, sel, state.phase, s0, opts);
            status.setText(state.piece.name + (state.piece.creates ? " created" : " on " + sel.length + " layer" + (sel.length > 1 ? "s" : "")) +
                (r.end > s0 ? ", ends at frame " + r.end : "") + (r.cut !== undefined ? " (cut at frame " + r.cut + ")" : "") + ".");
            if (state.piece.creates && r.layers.length) api.select(r.layers);
        } catch (e) { status.setText(String(e)); }
        return;
    }
    if (!sel.length) { status.setText("Select one or more layers first."); return; }
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
    var gone = MDNA.kitRemove(sel);   // kit helpers (filters, deformers, masks, behaviours) and the layers a piece created
    sel.forEach(function (id) { if (gone.indexOf(id) < 0) ["position", "scale", "rotation", "opacity"].forEach(function (a) { try { api.deleteAnimation(id, a); } catch (e) {} }); });
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
K.add(step(2, "Select keyframes, then Apply"));
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
// ------------------------------------------------------------------ Figma
// Cavalry has no Figma link: Claude reads the frame with the Figma MCP and writes a folder (manifest.json + assets),
// research/platforms/figma/README.md. Here: rebuild that folder as layers, then animate it by role.
var F = new ui.VLayout(), FIG = { folder: "", built: null };
F.add(step(1, "Import a frame Claude prepared from Figma"));
F.add(label("Ask Claude: “bring this Figma frame to Cavalry” with the frame's link. It writes a folder with the layers; pick it here.", C.dim, 11));
var figPath = label("No folder yet", C.text, 12);
var pick = new ui.Button("Choose frame folder…");
pick.onClick = function () { var d = api.presentChooseFolder(FIG.folder || MDNA_ROOT, "Figma frame folder (manifest.json)"); if (d) { FIG.folder = d; figPath.setText(d); } };
var imp = new ui.Button("Import frame"); imp.setBackgroundColor(C.lime); imp.setFixedHeight(30);
var figStatus = label("", C.dim, 11);
imp.onClick = function () {
    if (!FIG.folder) { figStatus.setText("Choose the folder first."); return; }
    try { FIG.built = MDNA_FIGMA.build(FIG.folder, { resize: true }); figStatus.setText(FIG.built.length + " layers, Figma names kept: " + FIG.built.map(function (b) { return b.role; }).join(", ")); }
    catch (e) { figStatus.setText(String(e)); }
};
F.add(pick); F.add(figPath); F.add(imp);
F.addSpacing(6);
F.add(step(2, "Animate it by role"));
F.add(label("title → Chars Rise · subtitle → Words Fade Up · media → Blur In · shapes → Wipe Reveal · body → Fade Up · logo → Scale Pop", C.dim, 11));
var figStagger = field(4, 0, 1, 0);
F.add(row("Stagger (f)", figStagger));
var anim = new ui.Button("Animate by role"); anim.setBackgroundColor(C.lime); anim.setFixedHeight(30);
anim.onClick = function () {
    if (!FIG.built) { figStatus.setText("Import a frame first."); return; }
    var done = MDNA_FIGMA.animate(FIG.built, null, api.getFrame(), figStagger.getValue());
    figStatus.setText(done.length + " layers animated from the playhead.");
};
F.add(anim); F.add(figStatus); F.addStretch();

var tabs = new ui.TabView();
tabs.add("Behaviors", B);
tabs.add("Curves", K);
tabs.add("Figma", F);
var head = new ui.HLayout(); head.add(label("Motion DNA", C.lime, 15)); head.addStretch(); head.add(label(ALL.length + " presets · " + MDNA.kitList().length + " kit · " + CURVES.length + " curves", C.dim, 11));
// Play and Motion blur, like the panel header in After Effects: blur needs the comp switch and each layer's own (Full)
var bar = new ui.HLayout();
var play = new ui.Button("Play"); play.onClick = function () { api.play(); };
var mb = new ui.Button("Motion blur: off");
function paintMb() { var on = !!api.get(api.getActiveComp(), "motionBlur"); mb.setText("Motion blur: " + (on ? "on" : "off")); mb.setBackgroundColor(on ? C.line : C.card); }
mb.onClick = function () {
    var comp = api.getActiveComp(), on = !api.get(comp, "motionBlur"), sel = api.getSelection();
    api.set(comp, { motionBlur: on });
    (sel.length ? sel : api.getCompLayers(true)).forEach(function (id) { try { api.set(id, { motionBlur: on ? 1 : 0 }); } catch (e) {} });
    paintMb();
};
bar.add(play); bar.add(mb);
ui.add(head);
ui.add(bar);
ui.add(tabs);
paintChips(); paintPhase(); grid(); paint(); paintMb();
ui.show();

} catch (MDNA_ERR) {   // never an empty window: say what failed
    var errLabel = new ui.Label("Motion DNA could not start: " + MDNA_ERR + (MDNA_ERR && MDNA_ERR.stack ? " · " + String(MDNA_ERR.stack).split(String.fromCharCode(10)).slice(1, 3).join(" · ") : ""));
    ui.setTitle("Motion DNA"); ui.add(errLabel); ui.show();
}
