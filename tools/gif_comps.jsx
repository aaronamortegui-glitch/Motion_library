// Creates a small comp per preset ("GIF Previews" folder) to render the viewer GIFs.
// Name: GIF__<kind>__<preset>  (kind: motion | fx | text)
#include "ss_presets.jsx"
var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    var ROOT = SS_ROOT + "/";
    var PAL = SSM.readJSON(ROOT + "assets/figma_essentials/palette.json").colors;
    function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    var proj = app.project, W = 640, H = 360;
    var folder = null;
    for (var i = proj.numItems; i >= 1; i--) {
        var it = proj.item(i);
        if (it instanceof CompItem && (it.name.indexOf("GIF__") === 0 || it.name.indexOf("GIF_src__") === 0)) it.remove();
        else if (it instanceof FolderItem && it.name === "GIF Previews") folder = it;
    }
    if (!folder) folder = proj.items.addFolder("GIF Previews");
    function comp(kind, name, dur) {
        var c = proj.items.addComp("GIF__" + kind + "__" + name, W, H, 1, dur, 30);
        c.parentFolder = folder;
        c.layers.addSolid(hex(PAL.pine), "BG", W, H, 1).locked = true;
        return c;
    }
    // The neutral sample every move is shown on: the robot head (assets/motion_dna/sample_robot.json, agreed 26 Oct),
    // one subject for every move so moves compare. Trim-path presets (Draw / Stroke) get its one-line version.
    function smark(c, name, stroke) { return SSM.sampleRobot(c, stroke, null, [W / 2, H / 2], name); }
    function bar(c) {
        var L = c.layers.addShape(); L.name = "bar";
        var v = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var r = v.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([380, 64]); r.property("ADBE Vector Rect Roundness").setValue(32);
        v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL.coral));
        L.property("ADBE Transform Group").property("ADBE Position").setValue([W / 2, H / 2]);
        return L;
    }
    function text(c, str, font, size) {
        var L = c.layers.addText(str);
        var tp = L.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
        td.resetCharStyle(); td.font = font; td.fontSize = size; td.fillColor = hex(PAL.cloud); td.applyFill = true;
        td.justification = ParagraphJustification.CENTER_JUSTIFY; tp.setValue(td);
        L.property("ADBE Transform Group").property("ADBE Position").setValue([W / 2, H / 2 + size * 0.35]);
        return L;
    }
    // a column whose anchor sits at its base (grows upward)
    function column(c) {
        var L = c.layers.addShape(); L.name = "column";
        var v = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var r = v.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([110, 230]); r.property("ADBE Vector Rect Roundness").setValue(14);
        r.property("ADBE Vector Rect Position").setValue([0, -115]);
        v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(PAL.spark));
        L.property("ADBE Transform Group").property("ADBE Position").setValue([W / 2, H / 2 + 115]);
        return L;
    }
    // Speed Ramp works on footage: a precomp where the sample crosses the frame at constant speed
    function constantMotion(c) {
        var src = proj.items.addComp("GIF_src__constant_motion", W, H, 1, 10, 30); src.parentFolder = folder;
        var S = smark(src, "sample constant", false), p = S.property("ADBE Transform Group").property("ADBE Position");
        p.setValueAtTime(0, [-120, H / 2]); p.setValueAtTime(10, [W * 3, H / 2]);
        p.setInterpolationTypeAtKey(1, KeyframeInterpolationType.LINEAR); p.setInterpolationTypeAtKey(2, KeyframeInterpolationType.LINEAR);
        p.expression = "var x = (value[0] + 120) % (" + W + " + 240) - 120; [x, value[1]]";
        var L = c.layers.add(src); L.name = "Speed Ramp";
        return L;
    }
    var made = [];
    var m = SSP.names();
    for (var a = 0; a < m.length; a++) {
        var c = comp("motion", m[a], 2.4);
        var L;   // explicit ifs: ExtendScript runs both branches of this as a chained ternary (see LEARNINGS)
        if (m[a] === "Wipe Reveal") L = bar(c);
        else if (m[a] === "Speed Ramp") L = constantMotion(c);
        // Motion Style Map set: subjects that show the behavior (full-frame color, a growing bar, a mark + wordmark)
        else if (m[a] === "Color Wipe") L = c.layers.addSolid(hex(PAL.coral), "Color Wipe", W, H, 1);
        else if (m[a] === "Iris Reveal") L = c.layers.addSolid(hex(PAL.spark), "Iris Reveal", W, H, 1);
        else if (m[a] === "Nudge Grow") L = column(c);
        else if (m[a] === "Wordmark Reveal") { L = text(c, "Motion DNA", SSM.font("ui"), 56); L.property("ADBE Transform Group").property("ADBE Position").setValue([440, H / 2 + 20]); var mk = smark(c, "mark", false); mk.property("ADBE Transform Group").property("ADBE Position").setValue([150, H / 2]); mk.property("ADBE Transform Group").property("ADBE Scale").setValue([75, 75]); mk.moveToBeginning(); }
        else L = smark(c, m[a], /Draw|Stroke/.test(m[a]));
        // exit-only presets play their exit, so the sample is seen before it leaves
        SSP.apply(L, m[a], /\(exit\)/.test((SSP.presets[m[a]] || {}).use || "") ? "out" : "both", 0.2);
        made.push(c.name);
    }
    var fx = SSP.effectNames();
    for (var b = 0; b < fx.length; b++) {
        var c2 = comp("fx", fx[b], 3);
        var F = smark(c2, fx[b], false);
        if (fx[b] === "On Twos") SSP.apply(F, "Drop Bounce", "both", 0.2);   // it steps an existing animation: give it one
        SSP.applyFx(F, fx[b]);
        // loops made to be subtle in a comp; the preview turns them up so their idea reads in a thumbnail
        var boost = { "Holo Flicker": ["SS Holo · Flicker chance %", 30], "Breathe": ["SS Breathe · Scale %", 12] }[fx[b]];
        if (boost) try { F.property("ADBE Effect Parade").property(boost[0]).property(1).setValue(boost[1]); } catch (e) {}
        made.push(c2.name);
    }
    var tx = SSP.textNames();
    // the sample words (agreed 26 Oct): "DNA", "Motion DNA" where a preset works word by word; numbers where it counts
    var sample = { "Chars Rise": ["DNA", SSM.font("display"), 130], "Words Fade Up": ["Motion DNA", SSM.font("ui"), 80],
        "Blur Words": ["Motion DNA", SSM.font("display"), 84], "Tracking Settle": ["MOTION DNA", SSM.font("ui"), 64],
        "Chars Pop": ["DNA", SSM.font("ui"), 130], "Typewriter": ["Motion DNA", SSM.font("ui"), 80],
        "Scramble": ["DNA", SSM.font("ui"), 130], "Count Up": ["12,480", SSM.font("ui"), 110],
        "Words Slam": ["Motion DNA", SSM.font("display"), 84], "Chars Ramp": ["DNA", SSM.font("display"), 130],
        "Chars Blur": ["DNA", SSM.font("display"), 130] };
    for (var d = 0; d < tx.length; d++) {
        var c3 = comp("text", tx[d], 2.4);
        var sm = sample[tx[d]] || ["DNA", SSM.font("ui"), 120];
        SSP.applyText(text(c3, sm[0], sm[1], sm[2]), tx[d], "both", 0.2);
        made.push(c3.name);
    }
    // Harvested recipes (reproduced with our library, not with the plugin)
    var rids = SSP.recipeIds();
    for (var r = 0; r < rids.length; r++) {
        var c4 = comp("recipe", rids[r], 3);
        var sq = smark(c4, rids[r], false);
        SSP.applyRecipe(sq, rids[r], "both");
        made.push(c4.name);
    }
    var lf = new File(ROOT + "research/gif_comps.txt"); lf.encoding = "UTF-8"; lf.open("w"); lf.write(made.join("\n") + "\n"); lf.close();
    proj.save();
    return made.length + " GIF comps (list in research/gif_comps.txt)";
})();
