// Exports every motion preset as a portable recipe (research/platforms): each preset is applied to a test solid
// with SSM's animation calls wrapped, so what it animates is recorded as data (channel, start frame, frames, from/to
// relative to the layer's rest value, token curve) instead of After Effects keys. Channels a preset animates any other
// way (effects, masks, expressions, text animators) are listed as ae_only.
// Usage (MCP run_jsx, which includes ss_presets.jsx): $.evalFile(<this file>); return MDNA_EXPORT_PORTABLE();
function MDNA_EXPORT_PORTABLE() {
    var CH = { "ADBE Position": "position", "ADBE Scale": "scale", "ADBE Opacity": "opacity", "ADBE Rotate Z": "rotation",
               "ADBE Anchor Point": "anchor", "ADBE Rotate X": "rotationX", "ADBE Rotate Y": "rotationY" };
    var REST = { position: [960, 540], scale: [100, 100], opacity: 100, rotation: 0, anchor: [100, 100], rotationX: 0, rotationY: 0 };
    var log = null, depth = 0, base = 0, fps = 30;
    function rel(ch, v) {   // a value relative to rest: offsets for position/rotation, fractions for scale/opacity
        if (ch === "scale") return [v[0] / 100, v[1] / 100];
        if (ch === "opacity") return v / 100;
        if (v instanceof Array) { var o = []; for (var i = 0; i < v.length; i++) o.push(v[i] - (REST[ch][i] || 0)); return o; }
        return v - REST[ch];
    }
    function rec(kind, prop, t0, t1, v0, v1, extra) {
        if (depth !== 1 || !log) return;
        var ch = CH[prop.matchName] || null;
        var e = { kind: kind, prop: prop.matchName, channel: ch, start_f: Math.round((t0 - base) * fps * 1000) / 1000,
                  frames: Math.round((t1 - t0) * fps * 1000) / 1000 };
        if (ch) { e.from = rel(ch, v0); e.to = rel(ch, v1); } else { e.from = v0; e.to = v1; }
        for (var k in extra) if (extra.hasOwnProperty(k)) e[k] = extra[k];
        log.push(e);
    }
    var names = ["animate", "animateBezier", "animateStops", "animateRaw", "pop", "windup", "recoil", "snap"], orig = {};
    for (var i = 0; i < names.length; i++) orig[names[i]] = SSM[names[i]];
    SSM.animate = function (prop, t0, v0, v1, durName, easeName, f) {
        depth++; try { var t1 = orig.animate.apply(SSM, arguments); rec("token", prop, t0, t1, v0, v1, { dur: durName, ease: easeName }); return t1; } finally { depth--; }
    };
    SSM.animateBezier = function (prop, t0, v0, v1, frames, bz, f) {
        depth++; try { var t1 = orig.animateBezier.apply(SSM, arguments); rec("bezier", prop, t0, t1, v0, v1, { bezier: bz }); return t1; } finally { depth--; }
    };
    SSM.animateStops = function (prop, t0, v0, stops, f) {
        depth++; try {
            var t1 = orig.animateStops.apply(SSM, arguments), ch = CH[prop.matchName], st = [];
            for (var j = 0; j < stops.length; j++) st.push({ v: ch ? rel(ch, stops[j].v) : stops[j].v, frames: stops[j].frames, ease: stops[j].ease || "Cruise" });
            rec("stops", prop, t0, t1, v0, stops.length ? stops[stops.length - 1].v : v0, { stops: st }); return t1;
        } finally { depth--; }
    };
    SSM.animateRaw = function (prop, t0, t1, v0, v1, ae) {
        depth++; try { var r = orig.animateRaw.apply(SSM, arguments); rec("raw", prop, t0, t1, v0, v1, { ae: ae }); return r; } finally { depth--; }
    };
    for (var n = 4; n < names.length; n++) (function (nm) {
        SSM[nm] = function () { depth++; try { return orig[nm].apply(SSM, arguments); } finally { depth--; } };
    })(names[n]);

    function keyed(group, out, path) {   // every property with keys or an expression
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.propertyType === PropertyType.PROPERTY) { if (p.numKeys > 0 || (p.canSetExpression && p.expressionEnabled && p.expression)) out.push(p.matchName); }
            else keyed(p, out);
        }
        return out;
    }
    var comp = app.project.items.addComp("_mdna_export", 1920, 1080, 1, 6, fps), out = {}, all = SSP.names();
    try {
        for (var a = 0; a < all.length; a++) {
            var name = all[a], entry = { "in": null, "out": null, ae_only: [] };
            var phases = ["in", "out"];
            for (var ph = 0; ph < 2; ph++) {
                var L = comp.layers.addSolid([0.2, 0.6, 0.5], "probe", 200, 200, 1, 6);
                log = []; base = ph === 0 ? 0.5 : 3;
                try { SSP.apply(L, name, phases[ph], base); }
                catch (e) { entry[phases[ph]] = { error: String(e) }; L.remove(); continue; }
                var seen = {}; for (var q = 0; q < log.length; q++) seen[log[q].prop] = true;
                var ks = keyed(L, []);
                for (var r = 0; r < ks.length; r++) if (!seen[ks[r]] && ks[r] !== "ADBE Marker") entry.ae_only.push(ks[r]);
                for (var s = 0; s < log.length; s++) if (!log[s].channel) entry.ae_only.push(log[s].prop);
                entry[phases[ph]] = log;
                L.remove();
            }
            var u = {}, list = []; for (var z = 0; z < entry.ae_only.length; z++) if (!u[entry.ae_only[z]]) { u[entry.ae_only[z]] = 1; list.push(entry.ae_only[z]); }
            entry.ae_only = list;
            out[name] = entry;
        }
    } finally {
        for (var m = 0; m < names.length; m++) SSM[names[m]] = orig[names[m]];
        comp.remove();
    }
    return out;
}
