// Samples frame by frame the evaluated (post-expression) value of every property with an expression or keys
// on the layers of the CALIBRATION comp. Output: research/inspections/samples_<ts>.json
var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    var proj = app.project, comp = null;
    for (var i = 1; i <= proj.numItems; i++) if (proj.item(i) instanceof CompItem && proj.item(i).name === "CALIBRATION") comp = proj.item(i);
    if (!comp) return "The CALIBRATION comp does not exist";
    var fd = comp.frameDuration, nF = Math.round(comp.duration / fd);

    function esc(s) { return String(s).split("\\").join("\\\\").split('"').join('\\"'); }
    function num(v) {
        if (typeof v === "number") return isFinite(v) ? String(Math.round(v * 10000) / 10000) : "null";
        if (v instanceof Array) { var a = []; for (var k = 0; k < v.length; k++) a.push(num(v[k])); return "[" + a.join(",") + "]"; }
        return "null";
    }
    function collect(group, path, out) {
        for (var p = 1; p <= group.numProperties; p++) {
            var pr = group.property(p);
            var nm = path + "/" + pr.name;
            if (pr.propertyType === PropertyType.PROPERTY) {
                var animated = (pr.canSetExpression && pr.expressionEnabled && pr.expression) || pr.numKeys > 0;
                var t = pr.propertyValueType;
                var numeric = t === PropertyValueType.OneD || t === PropertyValueType.TwoD || t === PropertyValueType.ThreeD ||
                    t === PropertyValueType.TwoD_SPATIAL || t === PropertyValueType.ThreeD_SPATIAL || t === PropertyValueType.COLOR;
                if (animated && numeric) out.push({ path: nm, prop: pr });
            } else collect(pr, nm, out);
        }
    }
    var parts = [];
    for (var l = 1; l <= comp.numLayers; l++) {
        var L = comp.layer(l);
        if (L.name === "BG Pine") continue;
        var props = [];
        collect(L, "", props);
        var markers = [];
        var mk = L.property("ADBE Marker");
        for (var m = 1; m <= mk.numKeys; m++) markers.push(Math.round(mk.keyTime(m) / fd));
        var ps = [];
        for (var q = 0; q < props.length; q++) {
            var vals = [];
            for (var f = 0; f <= nF; f++) vals.push(num(props[q].prop.valueAtTime(f * fd, false)));
            ps.push('{"path":"' + esc(props[q].path) + '","values":[' + vals.join(",") + "]}");
        }
        parts.push('{"layer":"' + esc(L.name) + '","inPoint":' + Math.round(L.inPoint / fd) + ',"outPoint":' + Math.round(L.outPoint / fd) +
            ',"markers":' + num(markers) + ',"props":[' + ps.join(",") + "]}");
    }
    var f = new File(SS_ROOT + "/research/inspections/samples_" + new Date().getTime() + ".json");
    f.encoding = "UTF-8";
    f.open("w");
    f.write('{"fps":' + comp.frameRate + ',"frames":' + nF + ',"layers":[' + parts.join(",") + "]}");
    f.close();
    return "samples ok → " + f.fsName;
})();
