// Superside Motion Lib — aplica los tokens propios (tokens/superside_motion_tokens.json) en AE.
// Uso: #include este archivo y llama SSM.load(rutaTokens), luego SSM.animate(prop, t0, v0, v1, "Arrive", "Land").
var SSM = (function () {
    var T = null;

    function readJSON(path) {
        var f = new File(path);
        f.encoding = "UTF-8";
        f.open("r");
        var s = f.read();
        f.close();
        return eval("(" + s + ")"); // archivo propio y confiable
    }
    function find(list, name) {
        for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
        throw new Error("Token no encontrado: " + name);
    }
    // respeta min/max de la propiedad (ej. selectores de texto ±100)
    function clampTo(prop, v) {
        var lo = prop.hasMin ? prop.minValue : null, hi = prop.hasMax ? prop.maxValue : null;
        function c1(x) { if (lo !== null && x < lo) x = lo; if (hi !== null && x > hi) x = hi; return x; }
        if (lo === null && hi === null) return v;
        if (v instanceof Array) { var r = []; for (var i = 0; i < v.length; i++) r.push(c1(v[i])); return r; }
        return c1(v);
    }
    function dims(v) { return (v instanceof Array) ? v.length : 1; }
    function isSpatial(prop) {
        return prop.propertyValueType === PropertyValueType.TwoD_SPATIAL || prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL;
    }
    function avgSpeed(v0, v1, dur, spatial) {
        if (!(v0 instanceof Array)) return [Math.abs(v1 - v0) / dur];
        if (spatial) { // velocidad espacial: un solo valor, sobre la distancia total
            var d = 0;
            for (var i = 0; i < v0.length; i++) d += Math.pow(v1[i] - v0[i], 2);
            return [Math.sqrt(d) / dur];
        }
        var r = [];
        for (var j = 0; j < v0.length; j++) r.push(Math.abs(v1[j] - v0[j]) / dur);
        return r;
    }
    function eases(spec, avg) {
        var out = [];
        for (var i = 0; i < avg.length; i++) out.push(new KeyframeEase(Math.max(spec.speed_x_avg * avg[i], 0), Math.max(spec.influence, 0.1)));
        return out;
    }

    return {
        load: function (path) { T = readJSON(path); return T; },
        tokens: function () { return T; },
        frames: function (durName) { return find(T.durations, durName).frames; },
        seconds: function (durName, fps) { return find(T.durations, durName).frames / (fps || T.fps); },

        // Anima prop de v0 a v1 empezando en t0 (s), duración y easing por token. Devuelve el tiempo final.
        animate: function (prop, t0, v0, v1, durName, easeName, fps) {
            var dur = this.seconds(durName, fps);
            var t1 = t0 + dur;
            var e = find(T.easings, easeName);
            if (easeName === "Pop") return this.pop(prop, t0, v0, v1, durName, fps);
            if (easeName === "Recoil") return this.recoil(prop, t0, v0, v1, durName, fps);
            var k0 = prop.addKey(t0), k1;
            prop.setValueAtKey(k0, v0);
            k1 = prop.addKey(t1);
            prop.setValueAtKey(k1, v1);
            k0 = prop.nearestKeyIndex(t0);
            k1 = prop.nearestKeyIndex(t1);
            if (e.ae.out === "linear") {
                prop.setInterpolationTypeAtKey(k0, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
                prop.setInterpolationTypeAtKey(k1, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
                return t1;
            }
            var spatial = isSpatial(prop);
            var avg = avgSpeed(v0, v1, dur, spatial);
            prop.setTemporalEaseAtKey(k0, prop.keyInTemporalEase(k0), eases(e.ae.out, avg));
            prop.setTemporalEaseAtKey(k1, eases(e.ae["in"], avg), prop.keyOutTemporalEase(k1));
            return t1;
        },

        // Overshoot: v0 → v1 + 8% de la distancia → v1 (Land hasta el pico, Settle de vuelta)
        pop: function (prop, t0, v0, v1, durName, fps, durSec) {
            var dur = durSec || this.seconds(durName, fps);
            var peak;
            var ov = find(T.easings, "Pop").overshoot || 0.05;
            if (v0 instanceof Array) { peak = []; for (var i = 0; i < v0.length; i++) peak.push(v1[i] + (v1[i] - v0[i]) * ov); }
            else peak = v1 + (v1 - v0) * ov;
            var tm = t0 + dur * 0.6;
            this.animateRaw(prop, t0, tm, v0, peak, find(T.easings, "Land").ae);
            this.animateRaw(prop, tm, t0 + dur, peak, v1, find(T.easings, "Settle").ae);
            return t0 + dur;
        },
        // Anticipación: v0 → retrocede 4% del recorrido (Settle) → v1 (Launch)
        recoil: function (prop, t0, v0, v1, durName, fps, durSec) {
            var dur = durSec || this.seconds(durName, fps), back;
            if (v0 instanceof Array) { back = []; for (var i = 0; i < v0.length; i++) back.push(v0[i] - (v1[i] - v0[i]) * 0.04); }
            else back = v0 - (v1 - v0) * 0.04;
            var tm = t0 + dur * 0.35;
            this.animateRaw(prop, t0, tm, v0, back, find(T.easings, "Settle").ae);
            this.animateRaw(prop, tm, t0 + dur, back, v1, find(T.easings, "Launch").ae);
            return t0 + dur;
        },
        // Anima con un cubic-bezier CSS arbitrario (x1,y1,x2,y2) en n frames; y fuera de [0,1] → 3 keys (overshoot/undershoot)
        animateBezier: function (prop, t0, v0, v1, frames, bz, fps) {
            var dur = frames / (fps || T.fps), x1 = bz[0], y1 = bz[1], x2 = bz[2], y2 = bz[3];
            if (y1 > 1.02 || y2 > 1.02) return this.pop(prop, t0, v0, v1, null, fps, dur);
            if (y1 < -0.02 || y2 < -0.02) return this.recoil(prop, t0, v0, v1, null, fps, dur);
            var ae = { out: { influence: Math.max(x1 * 100, 0.1), speed_x_avg: x1 > 0 ? y1 / x1 : 0 },
                       "in": { influence: Math.max((1 - x2) * 100, 0.1), speed_x_avg: x2 < 1 ? (1 - y2) / (1 - x2) : 0 } };
            this.animateRaw(prop, t0, t0 + dur, v0, v1, ae);
            return t0 + dur;
        },
        animateRaw: function (prop, t0, t1, v0, v1, ae) {
            v1 = clampTo(prop, v1); v0 = clampTo(prop, v0);
            prop.setValueAtTime(t0, v0);
            prop.setValueAtTime(t1, v1);
            var k0 = prop.nearestKeyIndex(t0), k1 = prop.nearestKeyIndex(t1);
            var avg = avgSpeed(v0, v1, t1 - t0, isSpatial(prop));
            prop.setTemporalEaseAtKey(k0, prop.keyInTemporalEase(k0), eases(ae.out, avg));
            prop.setTemporalEaseAtKey(k1, eases(ae["in"], avg), prop.keyOutTemporalEase(k1));
        },
        readJSON: readJSON
    };
})();
