// Inspector de comportamiento: vuelca capas seleccionadas (o todas) de la comp activa a JSON.
// Uso: aplica un preset de Animation Composer a una capa, selecciónala y corre este script.
// Salida: <repo>/research/inspections/<comp>_<timestamp>.json
var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    var OUT_DIR = SS_ROOT + "/research/inspections";

    function esc(s) {
        return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
    }
    function toJSON(v) {
        if (v === null || v === undefined) return "null";
        if (typeof v === "number") return isFinite(v) ? String(v) : "null";
        if (typeof v === "boolean") return v ? "true" : "false";
        if (typeof v === "string") return '"' + esc(v) + '"';
        if (v instanceof Array) {
            var a = [];
            for (var i = 0; i < v.length; i++) a.push(toJSON(v[i]));
            return "[" + a.join(",") + "]";
        }
        var o = [];
        for (var k in v) if (v.hasOwnProperty(k)) o.push('"' + esc(k) + '":' + toJSON(v[k]));
        return "{" + o.join(",") + "}";
    }
    function safeVal(v) {
        if (v === null || v === undefined) return null;
        if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
        if (v instanceof Array) return v;
        if (v.toString && v.text !== undefined) return { text: v.text, fontSize: v.fontSize, font: v.font };
        if (v.vertices) return { shapeVertices: v.vertices.length, closed: v.closed };
        return String(v);
    }
    function interpName(t) {
        if (t === KeyframeInterpolationType.LINEAR) return "linear";
        if (t === KeyframeInterpolationType.BEZIER) return "bezier";
        if (t === KeyframeInterpolationType.HOLD) return "hold";
        return String(t);
    }
    function eases(arr) {
        var r = [];
        for (var i = 0; i < arr.length; i++) r.push({ speed: arr[i].speed, influence: arr[i].influence });
        return r;
    }
    function dumpProp(p, fps) {
        var d = { name: p.name, matchName: p.matchName };
        if (p.propertyType === PropertyType.PROPERTY) {
            if (p.expressionEnabled && p.expression) d.expression = p.expression;
            if (p.numKeys > 0) {
                d.keys = [];
                for (var k = 1; k <= p.numKeys; k++) {
                    var key = { t: p.keyTime(k), frame: Math.round(p.keyTime(k) * fps), value: safeVal(p.keyValue(k)),
                        inInterp: interpName(p.keyInInterpolationType(k)), outInterp: interpName(p.keyOutInterpolationType(k)) };
                    try { key.inEase = eases(p.keyInTemporalEase(k)); key.outEase = eases(p.keyOutTemporalEase(k)); } catch (e) {}
                    d.keys.push(key);
                }
            } else if (!d.expression) {
                // Sin keys ni expresión: solo reportar si cambió del default
                if (!p.isModified) return null;
                try { d.value = safeVal(p.value); } catch (e2) {}
            } else {
                try { d.value = safeVal(p.value); } catch (e3) {}
            }
            return d;
        }
        d.children = [];
        for (var i = 1; i <= p.numProperties; i++) {
            var c = dumpProp(p.property(i), fps);
            if (c) d.children.push(c);
        }
        return d.children.length ? d : null;
    }
    function dumpLayer(L, fps) {
        var d = { index: L.index, name: L.name, type: L.matchName, inPoint: L.inPoint, outPoint: L.outPoint,
            parent: L.parent ? L.parent.name : null, threeD: L.threeDLayer || false, blending: L.blendingMode,
            trackMatte: L.hasTrackMatte ? L.trackMatteType : null, props: [] };
        if (L.source && L.source.typeName === "Composition") {
            d.precomp = L.source.name;
            d.precompLayers = [];
            for (var i = 1; i <= L.source.numLayers; i++) d.precompLayers.push(dumpLayer(L.source.layer(i), fps));
        }
        for (var j = 1; j <= L.numProperties; j++) {
            var p = dumpProp(L.property(j), fps);
            if (p) d.props.push(p);
        }
        return d;
    }

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) { writeLn("Abre una composición primero."); return; }
    var layers = comp.selectedLayers.length ? comp.selectedLayers : [];
    if (!layers.length) for (var i = 1; i <= comp.numLayers; i++) layers.push(comp.layer(i));

    var out = { comp: comp.name, fps: comp.frameRate, w: comp.width, h: comp.height, duration: comp.duration, layers: [] };
    for (var n = 0; n < layers.length; n++) out.layers.push(dumpLayer(layers[n], comp.frameRate));

    var folder = new Folder(OUT_DIR);
    if (!folder.exists) folder.create();
    var f = new File(OUT_DIR + "/" + comp.name.replace(/[^\w\-]+/g, "_") + "_" + new Date().getTime() + ".json");
    f.encoding = "UTF-8";
    if (!f.open("w")) { writeLn("No se pudo escribir. Activa Preferencias > Scripting & Expressions > Allow Scripts to Write Files."); return; }
    f.write(toJSON(out));
    f.close();
    writeLn("Inspección guardada: " + f.fsName);
})();
