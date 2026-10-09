// End-to-end test of the preset engine in the open AE: every preset (motion, text, loops, recipes) is applied to a
// suitable layer in a temp comp, then checked: did it create animation that actually changes the layer over time,
// do the tuning controls (duration, intensity, mirror, easing) change the result, and does SSP.remove clean it.
// Writes research/tests/library_report.json and returns a one-line summary per failure.
// Run: bash tools/bridge.sh tools/test_library.jsx 900      (python tools/test_all.py runs everything)
#include "ss_presets.jsx"
(function () {
    var proj = app.project, W = 1920, H = 1080, D = 4, FPS = 30, rows = [], fails = [];
    for (var i = proj.numItems; i >= 1; i--) if (proj.item(i) instanceof CompItem && proj.item(i).name.indexOf("_TEST_LIB") === 0) proj.item(i).remove();
    var comp = proj.items.addComp("_TEST_LIB", W, H, 1, D, FPS);
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
    function shape(stroke) {
        var L = comp.layers.addShape(); L.name = "shape";
        var v = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var r = v.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([300, 120]); r.property("ADBE Vector Rect Roundness").setValue(30);
        if (stroke) v.addProperty("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Width").setValue(8);
        else v.addProperty("ADBE Vector Graphic - Fill");
        tr(L, "ADBE Position").setValue([W / 2, H / 2]); return L;
    }
    function text(str) {
        var L = comp.layers.addText(str || "Motion DNA test"), tp = L.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
        td.fontSize = 80; tp.setValue(td); tr(L, "ADBE Position").setValue([W / 2, H / 2]); return L;
    }
    var SRC = null;
    function precomp() {   // Speed Ramp needs time to remap: a precomp whose content moves at constant speed
        if (!SRC) {
            SRC = proj.items.addComp("_TEST_LIB_src", 400, 400, 1, 20, FPS);
            var s = SRC.layers.addSolid([0.85, 1, 0.52], "dot", 80, 80, 1), p = s.property("ADBE Transform Group").property("ADBE Position");
            p.setValueAtTime(0, [0, 200]); p.setValueAtTime(20, [400, 200]);
        }
        var L = comp.layers.add(SRC); L.name = "precomp"; return L;
    }
    function layerFor(kind, name) {
        if (kind === "text") return text(name === "Count Up" ? "12,480" : null);
        if (name === "Speed Ramp" || name === "Punch Zoom") return precomp();
        return shape(/Draw|Stroke/.test(name));
    }
    function animated(L) {   // properties with keys or expressions, and whether any of them changes between t=0.1 and t=1.5
        var keys = 0, expr = 0, moves = false;
        (function walk(g) {
            for (var j = 1; j <= g.numProperties; j++) {
                var p = g.property(j); if (!p || p.matchName === "ADBE Marker") continue;
                if (p.propertyType === PropertyType.PROPERTY) {
                    var has = p.numKeys > 0 || (p.canSetExpression && p.expression);
                    if (p.numKeys > 0) keys += p.numKeys;
                    if (p.canSetExpression && p.expression) expr++;
                    if (has && !moves && p.propertyValueType !== PropertyValueType.NO_VALUE && p.propertyValueType !== PropertyValueType.CUSTOM_VALUE) {
                        try {   // sample every frame (random flickers only show on some frames)
                            var a = String(p.valueAtTime(0.1, false));
                            for (var tt = 0.1; tt < D && !moves; tt += 1 / FPS) if (String(p.valueAtTime(tt, false)) !== a) moves = true;
                        } catch (e) {}
                    }
                } else if (p.numProperties) walk(p);
            }
        })(L);
        return { keys: keys, expr: expr, moves: moves };
    }
    function lastKeyTime(L) {
        var t = 0;
        (function walk(g) { for (var j = 1; j <= g.numProperties; j++) { var p = g.property(j); if (!p || p.matchName === "ADBE Marker") continue;
            if (p.propertyType === PropertyType.PROPERTY) { if (p.numKeys) t = Math.max(t, p.keyTime(p.numKeys)); } else if (p.numProperties) walk(p); } })(L);
        return t;
    }
    function firstKeys(L) {   // every key value of every keyframed property (not opacity): intensity / mirror must change some
        var out = [];
        (function walk(g) { for (var j = 1; j <= g.numProperties; j++) { var p = g.property(j); if (!p || p.matchName === "ADBE Marker") continue;
            if (p.propertyType === PropertyType.PROPERTY) { if (p.numKeys && !/Opacity/.test(p.matchName)) for (var q = 1; q <= p.numKeys; q++) out.push(String(p.keyValue(q))); } else if (p.numProperties) walk(p); } })(L);
        return out.join("|");
    }
    function apply(kind, name, L, phase) {
        if (kind === "text") SSP.applyText(L, name, phase, 0.1);
        else if (kind === "fx") SSP.applyFx(L, name);
        else if (kind === "recipe") SSP.applyRecipe(L, name, phase);
        else SSP.apply(L, name, phase, 0.1);
    }
    var list = [], a;
    var m = SSP.names(); for (a = 0; a < m.length; a++) list.push(["motion", m[a]]);
    var tx = SSP.textNames(); for (a = 0; a < tx.length; a++) list.push(["text", tx[a]]);
    var fx = SSP.effectNames(); for (a = 0; a < fx.length; a++) list.push(["fx", fx[a]]);
    var rc = SSP.recipeIds(); for (a = 0; a < rc.length; a++) list.push(["recipe", rc[a]]);
    for (var n = 0; n < list.length; n++) {
        var kind = list[n][0], name = list[n][1], row = { kind: kind, name: name, ok: true, notes: [] };
        try {
            SSP.tune();
            var L = layerFor(kind, name); L.inPoint = 0; L.outPoint = D;
            apply(kind, name, L, kind === "fx" ? "in" : "both");
            var r = animated(L);
            row.keys = r.keys; row.expr = r.expr; row.moves = r.moves;
            if (!r.keys && !r.expr) { row.ok = false; row.notes.push("nothing created"); }
            else if (!r.moves) { row.ok = false; row.notes.push("created keys/expressions but the layer does not change"); }
            // tuning: duration ×2 must push the last entrance key later; intensity 0.5 + mirror must change the travel
            if (kind === "motion" && r.keys) {
                var base = lastKeyTime(L);
                var L2 = layerFor(kind, name); L2.inPoint = 0; L2.outPoint = D;
                SSP.tune({ speed: 2, intensity: 0.5, flipX: true, ease: "Whip" }); apply(kind, name, L2, "in"); SSP.tune();
                var L3 = layerFor(kind, name); L3.inPoint = 0; L3.outPoint = D; apply(kind, name, L3, "in");
                var t3 = lastKeyTime(L3), t2 = lastKeyTime(L2), k2 = firstKeys(L2), k3 = firstKeys(L3);
                row.tune = { duration: t2 > t3 + 0.01 ? "longer" : "same", shape: k3 ? (k2 !== k3 ? "changed" : "same") : "n/a" };
                if (row.tune.duration === "same" && !/Speed Ramp/.test(name)) row.notes.push("duration control had no effect");
                if (row.tune.shape === "same" && !/Speed Ramp|Zoom Out|Back Out/.test(name)) row.notes.push("intensity / mirror had no effect");   // time remap and exit-only presets have no entrance travel
                L2.remove(); L3.remove();
            }
            var cleared = SSP.remove(L), after = animated(L);
            row.removed = cleared;
            if (after.keys || after.expr) { row.notes.push("remove left " + after.keys + " keys, " + after.expr + " expressions"); }
            L.remove();
        } catch (e) { row.ok = false; row.notes.push("ERROR " + e.toString() + (e.line ? " @" + e.line : "")); }
        if (!row.ok) fails.push(kind + "/" + name + ": " + row.notes.join("; "));
        rows.push(row);
    }
    SSP.tune();
    comp.remove(); if (SRC) SRC.remove();
    Folder(SS_ROOT + "/research/tests").create();
    var f = new File(SS_ROOT + "/research/tests/library_report.json"); f.encoding = "UTF-8"; f.open("w");
    var out = [];
    for (var k = 0; k < rows.length; k++) {
        var R = rows[k];
        out.push('{"kind":"' + R.kind + '","name":"' + R.name + '","ok":' + R.ok + ',"keys":' + (R.keys || 0) + ',"expr":' + (R.expr || 0) + ',"moves":' + !!R.moves +
                 ',"removed":' + (R.removed || 0) + (R.tune ? ',"tune":{"duration":"' + R.tune.duration + '","shape":"' + R.tune.shape + '"}' : "") +
                 ',"notes":["' + R.notes.join('","').replace(/\\/g, "/") + '"]}');
    }
    f.write("[\n" + out.join(",\n") + "\n]\n"); f.close();
    var okN = 0; for (k = 0; k < rows.length; k++) if (rows[k].ok) okN++;
    return okN + "/" + rows.length + " presets animate" + (fails.length ? "\n" + fails.join("\n") : "");
})();
