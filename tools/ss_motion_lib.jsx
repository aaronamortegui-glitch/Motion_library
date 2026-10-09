// Superside Motion Lib — applies our own tokens (tokens/superside_motion_tokens.json) in AE.
// Usage: #include this file, call SSM.load(tokensPath), then SSM.animate(prop, t0, v0, v1, "Arrive", "Land").
var SSM = (function () {
    var T = null;

    function readJSON(path) {
        var f = new File(path);
        f.encoding = "UTF-8";
        f.open("r");
        var s = f.read();
        f.close();
        return eval("(" + s + ")"); // our own, trusted file
    }
    function find(list, name) {
        for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
        throw new Error("Token not found: " + name);
    }
    // respects the property's min/max (e.g. text selectors ±100)
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
        if (spatial) { // spatial speed: a single value over the total distance
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
        // SSM.speed scales every token duration (the panel's Duration control: 2 = twice as long)
        speed: 1,
        seconds: function (durName, fps) { return find(T.durations, durName).frames / (fps || T.fps) * (this.speed || 1); },
        // Re-eases the segment between keys k and k+1 of prop with a token curve (keeps values and times)
        easeSegment: function (prop, k, easeName) {
            var e = find(T.easings, easeName);
            if (!e || k < 1 || k >= prop.numKeys) return;
            if (e.ae.out === "linear") { prop.setInterpolationTypeAtKey(k, prop.keyInInterpolationType(k), KeyframeInterpolationType.LINEAR); prop.setInterpolationTypeAtKey(k + 1, KeyframeInterpolationType.LINEAR, prop.keyOutInterpolationType(k + 1)); return; }
            if (prop.keyOutInterpolationType(k) === KeyframeInterpolationType.HOLD) return;
            prop.setInterpolationTypeAtKey(k, prop.keyInInterpolationType(k), KeyframeInterpolationType.BEZIER);
            prop.setInterpolationTypeAtKey(k + 1, KeyframeInterpolationType.BEZIER, prop.keyOutInterpolationType(k + 1));
            var v0 = prop.keyValue(k), v1 = prop.keyValue(k + 1), dur = Math.max(prop.keyTime(k + 1) - prop.keyTime(k), 0.001);
            var avg = avgSpeed(v0, v1, dur, isSpatial(prop));
            prop.setTemporalEaseAtKey(k, prop.keyInTemporalEase(k), eases(e.ae.out, avg));
            prop.setTemporalEaseAtKey(k + 1, eases(e.ae["in"], avg), prop.keyOutTemporalEase(k + 1));
        },
        ease: function (easeName) { return find(T.easings, easeName).ae; },

        // Animates prop from v0 to v1 starting at t0 (s); duration and easing come from tokens. Returns the end time.
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

        // Overshoot: v0 → v1 + overshoot% of the distance → v1 (Land up to the peak, Settle back)
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
        // Anticipation: v0 → pulls back 4% of the travel (Settle) → v1 (Launch)
        recoil: function (prop, t0, v0, v1, durName, fps, durSec) {
            var dur = durSec || this.seconds(durName, fps), back;
            if (v0 instanceof Array) { back = []; for (var i = 0; i < v0.length; i++) back.push(v0[i] - (v1[i] - v0[i]) * 0.04); }
            else back = v0 - (v1 - v0) * 0.04;
            var tm = t0 + dur * 0.35;
            this.animateRaw(prop, t0, tm, v0, back, find(T.easings, "Settle").ae);
            this.animateRaw(prop, tm, t0 + dur, back, v1, find(T.easings, "Launch").ae);
            return t0 + dur;
        },
        // Animates with an arbitrary CSS cubic-bezier (x1,y1,x2,y2) over n frames; y outside [0,1] → 3 keys (overshoot/undershoot)
        animateBezier: function (prop, t0, v0, v1, frames, bz, fps) {
            var dur = frames / (fps || T.fps), x1 = bz[0], y1 = bz[1], x2 = bz[2], y2 = bz[3];
            if (y1 > 1.02 || y2 > 1.02) return this.pop(prop, t0, v0, v1, null, fps, dur);
            if (y1 < -0.02 || y2 < -0.02) return this.recoil(prop, t0, v0, v1, null, fps, dur);
            var ae = { out: { influence: Math.max(x1 * 100, 0.1), speed_x_avg: x1 > 0 ? y1 / x1 : 0 },
                       "in": { influence: Math.max((1 - x2) * 100, 0.1), speed_x_avg: x2 < 1 ? (1 - y2) / (1 - x2) : 0 } };
            this.animateRaw(prop, t0, t0 + dur, v0, v1, ae);
            return t0 + dur;
        },
        // Multi-stop animation: stops = [{ v: value, frames: n, ease: "Settle" }, ...] starting from v0 at t0.
        // Consecutive segments share keys, so uneven frame spacing creates organic accelerations and decelerations.
        animateStops: function (prop, t0, v0, stops, fps) {
            var t = t0, v = v0, rate = fps || T.fps;
            for (var i = 0; i < stops.length; i++) {
                var st = stops[i], t1 = t + st.frames / rate;
                this.animateRaw(prop, t, t1, v, st.v, find(T.easings, st.ease || "Cruise").ae);
                t = t1; v = st.v;
            }
            return t;
        },
        // Seeded organic rhythm from v0 to v1 over ~totalFrames: 3–5 uneven segments, varied speeds, short holds.
        organicStops: function (v0, v1, totalFrames, seed, segments) {
            var x = (seed || 1) % 2147483647; if (x <= 0) x += 2147483646;
            function rnd() { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }
            var n = segments || (3 + Math.floor(rnd() * 3)), w = [], sum = 0, i;
            for (i = 0; i < n; i++) { w.push(0.35 + rnd()); sum += w[i]; }
            var eases = ["Land", "Cruise", "Settle"], stops = [], acc = 0, used = 0;
            for (i = 0; i < n; i++) {
                acc += w[i] / sum;
                var frac = i === n - 1 ? 1 : acc;
                var speedJitter = 0.55 + rnd() * 1.1;                    // some strokes rush, others crawl
                var frames = Math.max(2, Math.round(totalFrames * (w[i] / sum) * speedJitter));
                var v = v0 + (v1 - v0) * frac;
                stops.push({ v: v, frames: frames, ease: eases[Math.floor(rnd() * eases.length)] });
                used += frames;
                if (i < n - 1 && rnd() < 0.45) stops.push({ v: v, frames: 2 + Math.floor(rnd() * 3), ease: "Flat" });  // micro-hold
            }
            return stops;
        },
        animateRaw: function (prop, t0, t1, v0, v1, ae) {
            v1 = clampTo(prop, v1); v0 = clampTo(prop, v0);
            prop.setValueAtTime(t0, v0);
            prop.setValueAtTime(t1, v1);
            var k0 = prop.nearestKeyIndex(t0), k1 = prop.nearestKeyIndex(t1);
            if (ae.out === "linear") {   // linear segment (e.g. Flat holds inside multi-stop animations)
                prop.setInterpolationTypeAtKey(k0, prop.keyInInterpolationType(k0), KeyframeInterpolationType.LINEAR);
                prop.setInterpolationTypeAtKey(k1, KeyframeInterpolationType.LINEAR, prop.keyOutInterpolationType(k1));
                return;
            }
            var avg = avgSpeed(v0, v1, t1 - t0, isSpatial(prop));
            prop.setTemporalEaseAtKey(k0, prop.keyInTemporalEase(k0), eases(ae.out, avg));
            prop.setTemporalEaseAtKey(k1, eases(ae["in"], avg), prop.keyOutTemporalEase(k1));
        },
        // Font for a typographic role (display | ui | ui_regular): first installed one from the token list
        font: function (role) {
            var list = (T.fonts && T.fonts[role]) || ["ArialMT"];
            for (var i = 0; i < list.length; i++) {
                try { if (app.fonts.getFontsByPostScriptName(list[i]).length) return list[i]; } catch (e) { return list[list.length - 1]; }
            }
            return list[list.length - 1];
        },
        // Folder of the locally installed asset packs (Animation Composer). Override with the SS_ASSET_PACKS env var.
        assetPacks: function () {
            var env = $.getenv("SS_ASSET_PACKS");
            if (env) return env.split("\\").join("/").replace(/\/?$/, "/");
            if ($.os.indexOf("Windows") >= 0) return ($.getenv("LOCALAPPDATA") || "").split("\\").join("/") + "/MisterHorse/ProductManager/AssetPacks/";
            return Folder("~/Library/Application Support/MisterHorse/ProductManager/AssetPacks/").fsName + "/";
        },
        isMac: function () { return $.os.indexOf("Windows") < 0; },
        readJSON: readJSON
    };
})();
