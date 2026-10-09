// Harvests the "recipe" and behavior of every layer with an Animation Composer preset
// in all comps whose name starts with "AC_" (or CALIBRATION).
// Per layer: controls (preset code + parameters), In/Out markers, native effects used
// and the frame-by-frame evaluated value of every property with an expression or keys.
// Output: research/harvest/<comp>.json (overwrites) — read-only on the project.
var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    var OUT = SS_ROOT + "/research/harvest/";
    Folder(OUT).create();

    function esc(s) { return String(s).split("\\").join("\\\\").split('"').join('\\"').split("\n").join(" ").split("\r").join(" "); }
    function num(v) {
        if (typeof v === "number") return isFinite(v) ? String(Math.round(v * 10000) / 10000) : "null";
        if (v instanceof Array) { var a = []; for (var k = 0; k < v.length; k++) a.push(num(v[k])); return "[" + a.join(",") + "]"; }
        if (typeof v === "boolean") return v ? "1" : "0";
        return "null";
    }
    function isNumeric(pr) {
        var t = pr.propertyValueType;
        return t === PropertyValueType.OneD || t === PropertyValueType.TwoD || t === PropertyValueType.ThreeD ||
            t === PropertyValueType.TwoD_SPATIAL || t === PropertyValueType.ThreeD_SPATIAL || t === PropertyValueType.COLOR;
    }
    function animatedProps(group, path, out) {
        for (var p = 1; p <= group.numProperties; p++) {
            var pr = group.property(p), nm = path + "/" + pr.name;
            if (pr.propertyType === PropertyType.PROPERTY) {
                if (isNumeric(pr) && ((pr.canSetExpression && pr.expressionEnabled && pr.expression) || pr.numKeys > 0)) out.push({ path: nm, prop: pr });
            } else animatedProps(pr, nm, out);
        }
    }
    function harvestComp(comp) {
        var fd = comp.frameDuration, nF = Math.round(comp.duration / fd), layers = [];
        for (var l = 1; l <= comp.numLayers; l++) {
            var L = comp.layer(l);
            var fx = L.property("ADBE Effect Parade");
            if (!fx) continue;
            var controls = [], natives = [];
            for (var e = 1; e <= fx.numProperties; e++) {
                var E = fx.property(e);
                if (E.matchName.indexOf("MHAC PrCtrl") >= 0) {
                    var m = E.matchName.match(/PrCtrl (\w+) (\d+)/);
                    var params = [];
                    for (var q = 1; q <= E.numProperties; q++) {
                        var P = E.property(q), val = "null";
                        try { val = num(P.value); } catch (x) {}
                        if (P.name !== "Compositing Options") params.push('"' + esc(P.name) + '":' + val);
                    }
                    var role = "fx"; if (E.name.indexOf("AC IN") === 0) role = "in"; else if (E.name.indexOf("AC OUT") === 0) role = "out";   // ifs: chained ternaries break in ExtendScript
                    controls.push('{"role":"' + role + '","code":"' + (m ? m[1] : "?") + '","ver":"' + (m ? m[2] : "?") + '","params":{' + params.join(",") + "}}");
                } else if (E.name.indexOf("AC ") === 0) {
                    natives.push('"' + esc(E.matchName) + '"');
                }
            }
            if (!controls.length) continue; // layer without an applied preset
            var mk = L.property("ADBE Marker"), markers = [];
            for (var k = 1; k <= mk.numKeys; k++) markers.push('{"f":' + Math.round(mk.keyTime(k) / fd) + ',"c":"' + esc(mk.keyValue(k).comment) + '"}');
            var props = [];
            animatedProps(L, "", props);
            var ps = [];
            for (var a = 0; a < props.length; a++) {
                var vals = [];
                for (var f = 0; f <= nF; f++) vals.push(num(props[a].prop.valueAtTime(f * fd, false)));
                ps.push('{"path":"' + esc(props[a].path) + '","values":[' + vals.join(",") + "]}");
            }
            layers.push('{"layer":"' + esc(L.name) + '","inPoint":' + Math.round(L.inPoint / fd) + ',"outPoint":' + Math.round(L.outPoint / fd) +
                ',"controls":[' + controls.join(",") + '],"native_effects":[' + natives.join(",") + '],"markers":[' + markers.join(",") +
                '],"props":[' + ps.join(",") + "]}");
        }
        if (!layers.length) return 0;
        var f2 = new File(OUT + comp.name.replace(/[^\w\-]+/g, "_") + ".json");
        f2.encoding = "UTF-8";
        f2.open("w");
        f2.write('{"comp":"' + esc(comp.name) + '","fps":' + comp.frameRate + ',"frames":' + nF + ',"layers":[' + layers.join(",") + "]}");
        f2.close();
        return layers.length;
    }
    var proj = app.project, report = [], total = 0;
    for (var i = 1; i <= proj.numItems; i++) {
        var it = proj.item(i);
        if (!(it instanceof CompItem)) continue;
        if (it.name.indexOf("AC_") !== 0 && it.name !== "CALIBRATION") continue;
        var n = harvestComp(it);
        if (n) { report.push(it.name + ": " + n); total += n; }
    }
    return "harvest: " + total + " layers with preset\n" + report.join("\n");
})();
