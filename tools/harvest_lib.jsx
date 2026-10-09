// SSH — behavior harvesting utilities (read-only) for layers with Animation Composer presets.
// SSH.harvestLayer(L) → JSON-string object with recipe (MHAC controls), markers, effects and sampled curves.
var SSH = (function () {
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
    // Returns {codes:[...], json:"..."} or null if the layer has no AC preset
    function harvestLayer(L, extra) {
        var comp = L.containingComp, fd = comp.frameDuration, nF = Math.round(comp.duration / fd);
        var fx = L.property("ADBE Effect Parade");
        if (!fx) return null;
        var controls = [], natives = [], codes = [];
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
                if (m) codes.push(m[1]);
                controls.push('{"role":"' + role + '","code":"' + (m ? m[1] : "?") + '","ver":"' + (m ? m[2] : "?") + '","params":{' + params.join(",") + "}}");
            } else if (E.name.indexOf("AC ") === 0) natives.push('"' + esc(E.matchName) + '"');
        }
        if (!controls.length) return null;
        var mk = L.property("ADBE Marker"), markers = [];
        for (var k = 1; k <= mk.numKeys; k++) markers.push('{"f":' + Math.round(mk.keyTime(k) / fd) + ',"c":"' + esc(mk.keyValue(k).comment) + '"}');
        var props = [], ps = [];
        animatedProps(L, "", props);
        for (var a = 0; a < props.length; a++) {
            var vals = [];
            for (var f = 0; f <= nF; f++) vals.push(num(props[a].prop.valueAtTime(f * fd, false)));
            ps.push('{"path":"' + esc(props[a].path) + '","values":[' + vals.join(",") + "]}");
        }
        var ex = "";
        if (extra) for (var key in extra) if (extra.hasOwnProperty(key)) ex += ',"' + key + '":"' + esc(extra[key]) + '"';
        return {
            codes: codes,
            json: '{"layer":"' + esc(L.name) + '","fps":' + comp.frameRate + ',"frames":' + nF + ',"inPoint":' + Math.round(L.inPoint / fd) +
                ',"outPoint":' + Math.round(L.outPoint / fd) + ex + ',"controls":[' + controls.join(",") + '],"native_effects":[' + natives.join(",") +
                '],"markers":[' + markers.join(",") + '],"props":[' + ps.join(",") + "]}"
        };
    }
    function write(path, text) {
        var f = new File(path); f.encoding = "UTF-8"; f.open("w"); f.write(text); f.close();
    }
    return { harvestLayer: harvestLayer, write: write, esc: esc };
})();
