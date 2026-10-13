// Motion DNA panel (CEP) — the After Effects side. The HTML panel (panel/js/app.js) calls these functions through
// CSInterface.evalScript: every function takes plain strings (JSON for objects) and returns a string. The engine is the
// same as the ScriptUI panel's: tools/ss_presets.jsx (presets, styles, curves) and tools/ss_bridge.jsx (Claude).
// The repo root comes from panel/.root (written by tools/setup.py, because the panel is installed as a link and its
// own path points into the CEP extensions folder), or from the folder above the extension when it runs from the repo.

function mdna_json(v) {   // ExtendScript has no JSON.stringify: strings, numbers, booleans, arrays, plain objects
    if (v === null || v === undefined) return "null";
    if (typeof v === "number") return isFinite(v) ? String(v) : "null";
    if (typeof v === "boolean") return String(v);
    if (typeof v === "string") return '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "") + '"';
    var out = [], k;
    if (v instanceof Array) { for (k = 0; k < v.length; k++) out.push(mdna_json(v[k])); return "[" + out.join(",") + "]"; }
    for (k in v) if (v.hasOwnProperty(k)) out.push('"' + k + '":' + mdna_json(v[k]));
    return "{" + out.join(",") + "}";
}
function mdna_parse(s) { return eval("(" + s + ")"); }   // only our own panel calls these functions

// Finds the repo root and loads the engine. Returns {root, presets, bridge} or {error}.
function mdna_boot(extPath) {
    try {
        var root = null, f = new File(extPath + "/.root");
        if (f.exists) { f.encoding = "UTF-8"; f.open("r"); root = f.read().replace(/^\s+|\s+$/g, ""); f.close(); }
        if (!root || !new File(root + "/tools/ss_presets.jsx").exists) {
            var up = new Folder(extPath).parent;
            if (up && new File(up.fsName + "/tools/ss_presets.jsx").exists) root = up.fsName;
        }
        if (!root) return mdna_json({ error: "Repo not found: run python tools/setup.py from the Motion DNA clone." });
        root = root.split("\\").join("/");
        $.global.SS_ROOT = root;
        // $.evalFile runs in the caller's scope: publish the engine globally so every mdna_* function sees it
        if (typeof $.global.SSP === "undefined") { $.evalFile(new File(root + "/tools/ss_presets.jsx")); $.global.SSP = SSP; $.global.SSM = SSM; }
        if (typeof $.global.SSA === "undefined") { try { $.evalFile(new File(root + "/tools/ss_assets.jsx")); $.global.SSA = SSA; } catch (e) {} }
        if (!$.global.SS_BRIDGE_TASK) { try { $.evalFile(new File(root + "/tools/ss_bridge.jsx")); } catch (e) {} }
        $.global.MDNA_CEP = true;   // ae_status (MCP) reports the panel as loaded
        return mdna_json({ root: root, presets: $.global.SSP.names().length, bridge: !!$.global.SS_BRIDGE_TASK });
    } catch (e) { return mdna_json({ error: e.toString() + (e.line ? " (line " + e.line + ")" : "") }); }
}

// Claude connection: bridge running and minutes since its last answer
function mdna_status() {
    var on = !!$.global.SS_BRIDGE_TASK, mins = -1;
    try {
        var fs = Folder($.global.SS_ROOT + "/bridge/outbox").getFiles("*.txt"), best = 0;
        for (var i = 0; i < fs.length; i++) if (fs[i].name.charAt(0) !== "_" && fs[i].modified && fs[i].modified.getTime() > best) best = fs[i].modified.getTime();
        if (best) mins = Math.round((new Date().getTime() - best) / 60000);
    } catch (e) {}
    return mdna_json({ bridge: on, minutes: mins });
}
function mdna_connect() {
    try { if (!$.global.SS_BRIDGE_TASK) $.evalFile(new File($.global.SS_ROOT + "/tools/ss_bridge.jsx")); } catch (e) { return "ERR " + e.toString(); }
    return mdna_status();
}

function mdna_layers() {
    var c = app.project.activeItem;
    if (!(c instanceof CompItem)) return null;
    return c.selectedLayers.length ? c.selectedLayers : null;
}

// Applies a preset to the selected layers. a = {kind, name, phase, tune:{speed,intensity,flipX,flipY,ease}, stagger, markers,
// existing: "modify"|"replace"}. A layer that already moves keeps its animation and gets the preset's feel (modify), or
// loses it first (replace); a layer with no animation gets the preset generated. Loops (fx) always add on top.
function mdna_apply(s) {
    var a = mdna_parse(s), ls = mdna_layers();
    if (!ls) return "ERR Select one or more layers in a composition.";
    var st = (a.stagger || 0) * ls[0].containingComp.frameDuration, cnt = { generated: 0, modified: 0, replaced: 0 };
    SSP.markerTiming(!!a.markers); SSP.tune(a.tune || {});
    app.beginUndoGroup("Motion DNA: " + a.name + " (" + a.phase + ")");
    try {
        for (var i = 0; i < ls.length; i++) {
            var L = ls[i], t0 = (a.phase === "out" ? L.outPoint - SSM.seconds("Arrive") : L.inPoint) + i * st;
            if (a.kind === "fx") { SSP.applyFx(L, a.name); cnt.generated++; continue; }
            var gen = (function (L, t0) { return function () {
                if (a.kind === "text") SSP.applyText(L, a.name, a.phase, t0);
                else if (a.kind === "recipe") SSP.applyRecipe(L, a.name, a.phase);
                else SSP.apply(L, a.name, a.phase, t0);
            }; })(L, t0);
            cnt[SSP.smartApply(L, a.name, a.existing || "modify", gen)]++;
        }
    } catch (e) { SSP.markerTiming(false); SSP.tune(); app.endUndoGroup(); return "ERR " + e.toString(); }
    SSP.markerTiming(false); SSP.tune();
    app.endUndoGroup();
    var parts = [];
    if (cnt.generated) parts.push(cnt.generated + " animated");
    if (cnt.modified) parts.push(cnt.modified + " kept their animation, re-timed and re-eased");
    if (cnt.replaced) parts.push(cnt.replaced + " replaced");
    return "OK " + a.name + ": " + parts.join(" · ");
}
// The selected layers and whether they already move (the panel says what Apply will do)
function mdna_sel_info() {
    var ls = mdna_layers(), out = { layers: 0, own: 0, ours: 0 };
    if (!ls) return mdna_json(out);
    out.layers = ls.length;
    for (var i = 0; i < ls.length; i++) { var x = SSP.animationOf(ls[i]); if (x.props) { if (x.ours) out.ours++; else out.own++; } }
    return mdna_json(out);
}

// Applies a style (pack) to the comp or the selected layers. a = {name, phase, whole, tune, markers}
function mdna_apply_style(s) {
    var a = mdna_parse(s), c = app.project.activeItem;
    if (!(c instanceof CompItem)) return "ERR Open a composition first.";
    var ls = a.whole ? null : c.selectedLayers;
    if (!a.whole && (!ls || !ls.length)) return "ERR Select layers, or tick 'Whole comp'.";
    SSP.markerTiming(!!a.markers); SSP.tune(a.tune || {});
    app.beginUndoGroup("Motion DNA style: " + a.name);
    var res = [];
    try { res = SSP.applyPack(c, a.name, ls, a.phase, a.existing || "modify"); } catch (e) { SSP.markerTiming(false); SSP.tune(); app.endUndoGroup(); return "ERR " + e.toString(); }
    SSP.markerTiming(false); SSP.tune();
    app.endUndoGroup();
    var kept = 0; for (var i = 0; i < res.length; i++) if (res[i].indexOf("kept its animation") >= 0) kept++;
    return res.length ? "OK " + a.name + ": " + (res.length - kept) + " layers animated" + (kept ? " · " + kept + " kept their animation, re-eased" : "") : "ERR No layers matched (backgrounds, nulls and locked layers are skipped).";
}

// Removes what Motion DNA added to the selected layers
function mdna_remove() {
    var ls = mdna_layers();
    if (!ls) return "ERR Select one or more layers in a composition.";
    app.beginUndoGroup("Motion DNA: remove");
    var n = 0;
    try { for (var i = 0; i < ls.length; i++) n += SSP.remove(ls[i]); } catch (e) { app.endUndoGroup(); return "ERR " + e.toString(); }
    app.endUndoGroup();
    return "OK " + n + " animated properties cleared";
}

// ---------- curves: apply a cubic-bezier to selected keyframe pairs, read one back, save / delete your own ----------
function mdna_pairs() {   // [[prop, k]] for every selected keyframe whose next keyframe is selected too
    var c = app.project.activeItem, out = [];
    if (!(c instanceof CompItem)) return out;
    var ps = c.selectedProperties;
    for (var i = 0; i < ps.length; i++) {
        var p = ps[i]; if (p.propertyType !== PropertyType.PROPERTY || !p.numKeys) continue;
        var ks = p.selectedKeys, has = {}, j; for (j = 0; j < ks.length; j++) has[ks[j]] = 1;
        for (j = 0; j < ks.length; j++) if (has[ks[j] + 1]) out.push([p, ks[j]]);
    }
    return out;
}
function mdna_seg_avg(p, k) {   // average speed of the segment, one value per ease dimension
    var v0 = p.keyValue(k), v1 = p.keyValue(k + 1), dur = Math.max(p.keyTime(k + 1) - p.keyTime(k), 0.001), n = p.keyOutTemporalEase(k).length, out = [], d = 0, i;
    if (!(v0 instanceof Array)) return [Math.abs(v1 - v0) / dur];
    if (n === 1) { for (i = 0; i < v0.length; i++) d += Math.pow(v1[i] - v0[i], 2); return [Math.sqrt(d) / dur]; }
    for (i = 0; i < n; i++) out.push(Math.abs(v1[i] - v0[i]) / dur);
    return out;
}
// same conversion as SSM.animateBezier / tokens ae_conversion
function mdna_ease_bezier(p, k, bz) {
    if (bz[0] === 0 && bz[1] === 0 && bz[2] === 1 && bz[3] === 1) {   // a linear curve becomes linear keys, as the guidelines say
        p.setInterpolationTypeAtKey(k, p.keyInInterpolationType(k), KeyframeInterpolationType.LINEAR);
        p.setInterpolationTypeAtKey(k + 1, KeyframeInterpolationType.LINEAR, p.keyOutInterpolationType(k + 1));
        return;
    }
    var x1 = Math.max(bz[0], 0.001), x2 = Math.min(bz[2], 0.999), avg = mdna_seg_avg(p, k), o = [], n = [], i;
    var oI = Math.max(0.1, Math.min(100, x1 * 100)), iI = Math.max(0.1, Math.min(100, (1 - x2) * 100));
    for (i = 0; i < avg.length; i++) { o.push(new KeyframeEase(Math.max(0, bz[1] / x1 * avg[i]), oI)); n.push(new KeyframeEase(Math.max(0, (1 - bz[3]) / (1 - x2) * avg[i]), iI)); }
    p.setInterpolationTypeAtKey(k, p.keyInInterpolationType(k), KeyframeInterpolationType.BEZIER);
    p.setInterpolationTypeAtKey(k + 1, KeyframeInterpolationType.BEZIER, p.keyOutInterpolationType(k + 1));
    p.setTemporalEaseAtKey(k, p.keyInTemporalEase(k), o);
    p.setTemporalEaseAtKey(k + 1, n, p.keyOutTemporalEase(k + 1));
}
// Keyframes not selected: works on the selected layers instead. A layer that moves gets all its segments re-eased (and
// retimed when frames is given); a layer that does not move gets a Fade Up made on this curve.
function mdna_layers_fallback(bz, name, frames) {
    var ls = mdna_layers();
    if (!ls) return "ERR Select keyframes, or layers.";
    var re = 0, gen = 0;
    app.beginUndoGroup("Motion DNA: " + (name || "curve") + " on layers");
    try {
        for (var i = 0; i < ls.length; i++) {
            var L = ls[i], x = SSP.animationOf(L);
            if (!x.props) { SSP.apply(L, "Fade Up", "in", L.inPoint); gen++; }
            else re++;
            SSP.restyle(L, { bz: bz, frames: frames || 0 });
        }
    } catch (e) { app.endUndoGroup(); return "ERR " + e.toString(); }
    app.endUndoGroup();
    return "OK " + (name || "Curve") + (frames ? " at " + frames + " f" : "") + ": " + (re ? re + " layer" + (re > 1 ? "s" : "") + " re-eased (values kept)" : "") +
        (re && gen ? " · " : "") + (gen ? gen + " had no animation: Fade Up made on this curve" : "");
}
function mdna_apply_curve(s) {   // s = {bz:[x1,y1,x2,y2], name}
    var a = mdna_parse(s), pairs = mdna_pairs();
    if (!pairs.length) return mdna_layers_fallback(a.bz, a.name, 0);
    app.beginUndoGroup("Motion DNA: curve " + (a.name || "custom"));
    try { for (var i = 0; i < pairs.length; i++) mdna_ease_bezier(pairs[i][0], pairs[i][1], a.bz); } catch (e) { app.endUndoGroup(); return "ERR " + e.toString(); }
    app.endUndoGroup();
    return "OK " + (a.name || "Custom curve") + " applied to " + pairs.length + " keyframe pair" + (pairs.length > 1 ? "s" : "");
}
function mdna_read_curve() {   // the curve between the first selected pair, as [x1,y1,x2,y2]
    var pairs = mdna_pairs();
    if (!pairs.length) return "ERR Select two keyframes next to each other to read their curve.";
    var p = pairs[0][0], k = pairs[0][1];
    if (p.keyOutInterpolationType(k) === KeyframeInterpolationType.LINEAR) return "[0,0,1,1]";
    var a = mdna_seg_avg(p, k)[0] || 1, o = p.keyOutTemporalEase(k)[0], n = p.keyInTemporalEase(k + 1)[0];
    var x1 = o.influence / 100, x2 = 1 - n.influence / 100, r = function (v) { return Math.round(v * 100) / 100; };
    return mdna_json([r(x1), r(o.speed / a * x1), r(x2), r(1 - n.speed / a * (1 - x2))]);
}
// Your own curves go into tokens/superside_motion_tokens.json like every Motion DNA curve, as text inserted in the
// file's own format (json.dump indent=1), so the rest of the file is untouched. Only "source: panel…" curves can be
// overwritten or deleted from the panel.
function mdna_tokens_path() { return $.global.SS_ROOT + "/tokens/superside_motion_tokens.json"; }
function mdna_read_text(path) { var f = new File(path); f.encoding = "UTF-8"; f.open("r"); var s = f.read(); f.close(); return s; }
function mdna_write_text(path, s) { var f = new File(path); f.encoding = "UTF-8"; f.lineFeed = "Unix"; f.open("w"); f.write(s); f.close(); }
function mdna_scan(s, from, to) {   // index just after the bracket that closes the one at `from` (strings skipped)
    var d = 0, inStr = false;
    for (var j = from; j < to; j++) {
        var ch = s.charAt(j);
        if (inStr) { if (ch === "\\") j++; else if (ch === '"') inStr = false; continue; }
        if (ch === '"') inStr = true; else if (ch === "[" || ch === "{") d++; else if (ch === "]" || ch === "}") { d--; if (d === 0) return j + 1; }
    }
    return -1;
}
function mdna_easings_range(s) {
    var i = s.indexOf('"easings"'); if (i < 0) throw new Error("no easings in the tokens file");
    i = s.indexOf("[", i); var e = mdna_scan(s, i, s.length); if (e < 0) throw new Error("unbalanced tokens file");
    return [i, e - 1];
}
function mdna_entry_range(s, nm) {   // [start, end) of the easings entry named nm, with the comma that separates it
    var R = mdna_easings_range(s), at = s.indexOf('"name": ' + mdna_json(nm), R[0]);
    if (at < 0 || at > R[1]) return null;
    var a = s.lastIndexOf("{", at), b = mdna_scan(s, a, R[1]);
    var before = s.lastIndexOf(",", a), prevBrace = s.lastIndexOf("}", a);
    if (before > prevBrace && before > R[0]) return [before, b];
    var after = s.indexOf(",", b); return [a, after >= 0 && after < R[1] ? after + 1 : b];
}
function mdna_is_user_curve(s, nm) {
    var er = mdna_entry_range(s, nm); if (!er) return false;
    return s.substring(er[0], er[1]).indexOf('"source": "panel') >= 0;
}
function mdna_curve_entry(nm, use, bz) {
    var r3 = function (x) { return Math.round(x * 1000) / 1000; }, x1 = bz[0], y1 = bz[1], x2 = bz[2], y2 = bz[3];
    var oS = x1 > 0 ? y1 / x1 : 0, iS = x2 < 1 ? (1 - y2) / (1 - x2) : 0;
    return '  {\n   "name": ' + mdna_json(nm) + ',\n   "bezier": [\n    ' + r3(x1) + ',\n    ' + r3(y1) + ',\n    ' + r3(x2) + ',\n    ' + r3(y2) + '\n   ],\n' +
           '   "use": ' + mdna_json(use || "Saved from the panel") + ',\n   "ae": {\n    "out": {\n     "influence": ' + r3(Math.max(0.1, x1 * 100)) + ',\n     "speed_x_avg": ' + r3(oS) + '\n    },\n' +
           '    "in": {\n     "influence": ' + r3(Math.max(0.1, (1 - x2) * 100)) + ',\n     "speed_x_avg": ' + r3(iS) + '\n    }\n   },\n   "source": "panel (saved in the Curves section)"\n  }';
}
function mdna_save_curve(s) {   // s = {name, use, bz}
    try {
        var a = mdna_parse(s), path = mdna_tokens_path(), t = mdna_read_text(path), er = mdna_entry_range(t, a.name);
        if (er) {
            if (!mdna_is_user_curve(t, a.name)) return "ERR \"" + a.name + "\" is a built-in curve: pick another name.";
            t = t.substr(0, er[0]) + t.substr(er[1]);
        }
        var R = mdna_easings_range(t), last = t.lastIndexOf("}", R[1]);
        t = t.substr(0, last + 1) + ",\n" + mdna_curve_entry(a.name, a.use, a.bz) + t.substr(last + 1);
        mdna_write_text(path, t); SSM.load(path);
        return "OK Saved \"" + a.name + "\" in the library";
    } catch (e) { return "ERR " + e.toString(); }
}
function mdna_delete_curve(nm) {
    try {
        var path = mdna_tokens_path(), t = mdna_read_text(path);
        if (!mdna_is_user_curve(t, nm)) return "ERR Only curves saved from the panel can be deleted.";
        var er = mdna_entry_range(t, nm);
        mdna_write_text(path, t.substr(0, er[0]) + t.substr(er[1])); SSM.load(path);
        return "OK Deleted \"" + nm + "\"";
    } catch (e) { return "ERR " + e.toString(); }
}

// ---------- brands ----------
// Only TEMPLATES live in the repo (library/brands/<slug>). Your brands live on this machine: in the plugin folder
// (library/brands.local/<slug>, git-ignored) or in any folder you choose, listed in library/brands.local/_registry.json.
// Same files and rules as tools/brand.py. A brand travels as one exported file (<slug>.motiondna-brand.json).
function mdna_local_dir() { return $.global.SS_ROOT + "/library/brands.local"; }
function mdna_registry() {
    var f = new File(mdna_local_dir() + "/_registry.json");
    if (!f.exists) return [];
    try { return mdna_parse(mdna_read_text(f.fsName)).external || []; } catch (e) { return []; }
}
function mdna_register(dir) {
    dir = String(dir).split("\\").join("/");
    var ext = mdna_registry();
    for (var i = 0; i < ext.length; i++) if (ext[i] === dir) return;
    ext.push(dir); new Folder(mdna_local_dir()).create();
    mdna_write_text(mdna_local_dir() + "/_registry.json", mdna_json({ external: ext }) + "\n");
}
function mdna_brand_dir(slug, local) { return $.global.SS_ROOT + "/library/brands" + (local ? ".local" : "") + "/" + slug; }
function mdna_brands() {   // [{where: local|external|template, dir, local, b}]; your copy of a slug hides the template
    var out = [], seen = {}, add = function (dir, where) {
        var f = new File(dir + "/brand.json"); if (!f.exists) return;
        var txt = mdna_read_text(f.fsName), slug = "";
        try { slug = mdna_parse(txt).slug; } catch (e) { return; }
        if (seen[slug]) return; seen[slug] = 1;
        out.push('{"where":' + mdna_json(where) + ',"local":' + (where !== "template") + ',"dir":' + mdna_json(String(dir).split("\\").join("/")) + ',"b":' + txt + "}");
    };
    var i, dirs;
    try { dirs = Folder(mdna_local_dir()).getFiles(function (f) { return f instanceof Folder; }); for (i = 0; i < dirs.length; i++) add(dirs[i].fsName, "local"); } catch (e) {}
    var ext = mdna_registry(); for (i = 0; i < ext.length; i++) add(ext[i], "external");
    try { dirs = Folder($.global.SS_ROOT + "/library/brands").getFiles(function (f) { return f instanceof Folder; }); for (i = 0; i < dirs.length; i++) add(dirs[i].fsName, "template"); } catch (e) {}
    return "[" + out.join(",") + "]";
}
function mdna_brand_find(slug) {   // the folder of a brand, the way mdna_brands resolves it
    var all = mdna_parse(mdna_brands());
    for (var i = 0; i < all.length; i++) if (all[i].b.slug === slug) return all[i].dir;
    return null;
}
function mdna_brand_read(slug) {
    var d = mdna_brand_find(slug), f = d ? new File(d + "/brand.json") : null;
    return f && f.exists ? mdna_parse(mdna_read_text(f.fsName)) : null;
}
function mdna_brand_save(s) {   // s = {dir, text} (or the older {slug, local, text}): the panel sends the whole brand.json
    try {
        var a = mdna_parse(s), dir = new Folder(a.dir || mdna_brand_dir(a.slug, a.local === true));
        if (!dir.exists && !dir.create()) return "ERR cannot create " + dir.fsName;
        mdna_write_text(dir.fsName + "/brand.json", a.text);
        if (a.external) mdna_register(dir.fsName);
        return "OK " + dir.fsName.split("\\").join("/");
    } catch (e) { return "ERR " + e.toString(); }
}
// dialogs: the panel has no file dialogs of its own
function mdna_pick_folder(title) { var f = Folder.selectDialog(title || "Choose a folder"); return f ? f.fsName.split("\\").join("/") : ""; }
function mdna_pick_open(title) { var f = File.openDialog(title || "Open", "Motion DNA brand:*.json"); return f ? f.fsName.split("\\").join("/") : ""; }
function mdna_pick_save(name) { var f = new File(Folder.desktop.fsName + "/" + name).saveDlg("Save the brand file", "Motion DNA brand:*.json"); return f ? f.fsName.split("\\").join("/") : ""; }
function mdna_read_file(path) { var f = new File(path); return f.exists ? mdna_read_text(f.fsName) : "ERR missing " + path; }
function mdna_write_file(s) { try { var a = mdna_parse(s); mdna_write_text(a.path, a.text); return "OK " + a.path; } catch (e) { return "ERR " + e.toString(); } }
var MDNA_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function mdna_b64_file(path) {   // a binary file (the brand's thumb.png) as base64, for the exported brand file
    var f = new File(path); if (!f.exists) return "";
    f.encoding = "BINARY"; f.open("r"); var s = f.read(); f.close();
    var out = [], i, a, b, c;
    for (i = 0; i < s.length; i += 3) {
        a = s.charCodeAt(i) & 255; b = i + 1 < s.length ? s.charCodeAt(i + 1) & 255 : -1; c = i + 2 < s.length ? s.charCodeAt(i + 2) & 255 : -1;
        out.push(MDNA_B64.charAt(a >> 2) + MDNA_B64.charAt(((a & 3) << 4) | (b < 0 ? 0 : b >> 4)) +
                 (b < 0 ? "=" : MDNA_B64.charAt(((b & 15) << 2) | (c < 0 ? 0 : c >> 6))) + (c < 0 ? "=" : MDNA_B64.charAt(c & 63)));
    }
    return out.join("");
}
function mdna_b64_write(s) {   // s = {path, b64}: writes a base64 payload as a binary file
    try {
        var a = mdna_parse(s), d = a.b64.replace(/[^A-Za-z0-9+\/]/g, ""), out = [], i, n = [0, 0, 0, 0], k;
        for (i = 0; i < d.length; i += 4) {
            for (k = 0; k < 4; k++) n[k] = i + k < d.length ? MDNA_B64.indexOf(d.charAt(i + k)) : -1;
            out.push(String.fromCharCode((n[0] << 2) | (n[1] >> 4)));
            if (n[2] >= 0) out.push(String.fromCharCode(((n[1] & 15) << 4) | (n[2] >> 2)));
            if (n[3] >= 0) out.push(String.fromCharCode(((n[2] & 3) << 6) | n[3]));
        }
        var f = new File(a.path); f.encoding = "BINARY"; f.open("w"); f.write(out.join("")); f.close();
        return "OK";
    } catch (e) { return "ERR " + e.toString(); }
}

// ---------- projects: a folder per piece, with its brand and its Claude conversation ----------
// <folder>/motion-dna.project.json  {name, created, brand, folders, sessions:[{id, title, started}], session, rules, aep}
// <folder>/CLAUDE.md and .mcp.json   so Claude Code opened in this folder (desktop, terminal or the panel's Agent)
//                                    knows the library, the tools and the brand, and has the motion-dna MCP server
var MDNA_PROJECT = "motion-dna.project.json";
function mdna_project_find(start) {   // walks up from the open .aep (or a given folder) to the project file
    var f = start ? new Folder(start) : (app.project.file ? app.project.file.parent : null);
    for (var i = 0; f && i < 6; i++, f = f.parent) {
        var p = new File(f.fsName + "/" + MDNA_PROJECT);
        if (p.exists) return '{"dir":' + mdna_json(f.fsName.split("\\").join("/")) + ',"p":' + mdna_read_text(p.fsName) + "}";
    }
    return "null";
}
function mdna_project_save(s) {   // s = {dir, text}
    try { var a = mdna_parse(s); mdna_write_text(a.dir + "/" + MDNA_PROJECT, a.text); return "OK"; } catch (e) { return "ERR " + e.toString(); }
}
function mdna_project_new(s) {   // s = {parent, name, slug, brand, folders:[...], saveAep, text, claude, mcp}
    try {
        var a = mdna_parse(s), dir = new Folder(a.parent + "/" + a.slug);
        if (new File(dir.fsName + "/" + MDNA_PROJECT).exists) return "ERR There is already a Motion DNA project in " + dir.fsName;
        if (!dir.exists && !dir.create()) return "ERR cannot create " + dir.fsName;
        for (var i = 0; i < a.folders.length; i++) new Folder(dir.fsName + "/" + a.folders[i]).create();
        mdna_write_text(dir.fsName + "/" + MDNA_PROJECT, a.text);
        mdna_write_text(dir.fsName + "/CLAUDE.md", a.claude);
        mdna_write_text(dir.fsName + "/.mcp.json", a.mcp);
        var aep = "";
        if (a.saveAep) {
            var sub = a.folders.length > 4 ? a.folders[4] : "";   // 05_ae
            var file = new File(dir.fsName + (sub ? "/" + sub : "") + "/" + a.slug + ".aep");
            if (!file.exists) { app.project.save(file); aep = file.fsName.split("\\").join("/"); }
        }
        return mdna_json({ dir: dir.fsName.split("\\").join("/"), aep: aep });
    } catch (e) { return "ERR " + e.toString(); }
}

function mdna_apply_brand(s) {   // s = {slug, phase, whole, tune, markers}: the brand's style on the brand's curve
    var a = mdna_parse(s), b = mdna_brand_read(a.slug);
    if (!b) return "ERR brand not found: " + a.slug;
    if (!b.feel || !b.feel.style) return "ERR " + b.name + " has no base style yet (Overview > Feel).";
    var tu = a.tune || {}; if (!tu.ease && b.feel.curve) tu.ease = b.feel.curve;
    var r = mdna_apply_style(mdna_json({ name: b.feel.style, phase: a.phase, whole: a.whole, tune: tu, markers: a.markers, existing: a.existing }));
    return r.indexOf("OK") === 0 ? r.replace("OK " + b.feel.style + ":", "OK " + b.name + " style:") : r;
}
// Re-eases every keyframe pair of the comp (or of the selected layers) with one curve: "apply the brand to everything"
function mdna_reease(s) {   // s = {bz, name, selectedOnly}
    var a = mdna_parse(s), c = app.project.activeItem;
    if (!(c instanceof CompItem)) return "ERR Open a composition first.";
    var ls = [], i, n = 0;
    if (a.selectedOnly) { ls = c.selectedLayers; if (!ls.length) return "ERR Select layers, or re-ease the whole comp."; }
    else for (i = 1; i <= c.numLayers; i++) ls.push(c.layer(i));
    app.beginUndoGroup("Motion DNA: re-ease with " + (a.name || "curve"));
    try {
        for (i = 0; i < ls.length; i++) {
            if (ls[i].locked) continue;
            (function walk(g) {
                for (var j = 1; j <= g.numProperties; j++) {
                    var pr = g.property(j); if (!pr) continue;
                    if (pr.propertyType === PropertyType.PROPERTY) {
                        if (pr.numKeys < 2 || pr.matchName === "ADBE Marker" || pr.matchName === "ADBE Time Remapping") continue;
                        for (var k = 1; k < pr.numKeys; k++) {
                            if (pr.keyOutInterpolationType(k) === KeyframeInterpolationType.HOLD) continue;
                            try { mdna_ease_bezier(pr, k, a.bz); n++; } catch (e) {}
                        }
                    } else if (pr.numProperties) walk(pr);
                }
            })(ls[i]);
        }
    } catch (e) { app.endUndoGroup(); return "ERR " + e.toString(); }
    app.endUndoGroup();
    return "OK " + (a.name || "Curve") + " on " + n + " keyframe pair" + (n === 1 ? "" : "s") + " in " + ls.length + " layer" + (ls.length === 1 ? "" : "s");
}
// Retimes the selected keyframe pairs to a duration (frames) and eases them: a brand benchmark applied
function mdna_apply_timing(s) {   // s = {frames, bz, name}
    var a = mdna_parse(s), pairs = mdna_pairs(), c = app.project.activeItem, n = 0;
    if (!pairs.length) return mdna_layers_fallback(a.bz || [0.18, 0.28, 0, 0.9], a.name, a.frames);
    var dur = a.frames * c.frameDuration;
    app.beginUndoGroup("Motion DNA: timing " + (a.name || ""));
    try {
        for (var i = pairs.length - 1; i >= 0; i--) {   // last first: moving a key renumbers the ones after it
            var p = pairs[i][0], k = pairs[i][1], t0 = p.keyTime(k), t1 = t0 + dur;
            if (k + 2 <= p.numKeys && p.keyTime(k + 2) <= t1 + c.frameDuration / 2) continue;   // would pass the next key
            if (Math.abs(p.keyTime(k + 1) - t1) > 1e-4) {
                var v = p.keyValue(k + 1); p.removeKey(k + 1); p.setValueAtTime(t1, v);
            }
            if (a.bz) mdna_ease_bezier(p, k, a.bz);
            n++;
        }
    } catch (e) { app.endUndoGroup(); return "ERR " + e.toString(); }
    app.endUndoGroup();
    return n ? "OK " + (a.name || "Timing") + ": " + n + " pair" + (n > 1 ? "s" : "") + " set to " + a.frames + " f" : "ERR No pair could be retimed (the next keyframe is too close).";
}
// Reads the selected keyframes as a benchmark: duration in frames, the curve, the layer and property, the comp fps
function mdna_capture() {
    var pairs = mdna_pairs(), c = app.project.activeItem;
    if (!pairs.length) return "ERR Select two keyframes next to each other (the move you want to keep as a benchmark).";
    var p = pairs[0][0], k = pairs[0][1], frames = Math.round((p.keyTime(k + 1) - p.keyTime(k)) / c.frameDuration);
    var bz = mdna_parse(mdna_read_curve()), layer = "";
    try { var g = p; while (g.parentProperty) g = g.parentProperty; layer = g.name; } catch (e) {}
    var stag = 0;
    if (pairs.length > 1 && pairs[1][0] !== p) stag = Math.round(Math.abs(pairs[1][0].keyTime(pairs[1][1]) - p.keyTime(k)) / c.frameDuration);
    return mdna_json({ frames: frames, bz: bz, layer: layer, prop: p.name, stagger: stag, fps: Math.round(1 / c.frameDuration * 100) / 100 });
}
function mdna_comp_info() {   // fps of the active comp (to convert ms) and the project file (to remember its brand)
    var c = app.project.activeItem, f = app.project.file;
    return mdna_json({ fps: c instanceof CompItem ? Math.round(1 / c.frameDuration * 100) / 100 : 0, project: f ? f.fsName : "" });
}

// Context for the Agent section: the open comp, its size and frame rate, the selected layers, the project file
function mdna_context() {
    var c = app.project.activeItem, f = app.project.file, out = { project: f ? f.fsName : "", comp: null, selected: [] };
    if (c instanceof CompItem) {
        out.comp = { name: c.name, width: c.width, height: c.height, fps: Math.round(1 / c.frameDuration * 100) / 100, duration: Math.round(c.duration * 100) / 100, layers: c.numLayers };
        for (var i = 0; i < c.selectedLayers.length && i < 40; i++) {
            var L = c.selectedLayers[i], x = SSP.animationOf(L);
            out.selected.push(L.index + " " + L.name + (x.props ? " (already animated: " + x.props + " properties" + (x.ours ? ", by Motion DNA" : "") + ")" : " (no animation)"));
        }
    }
    return mdna_json(out);
}

// Opens a file or a folder with the system (the visualizer, a project folder)
function mdna_open(path) {
    var d = new Folder(path); if (d.exists) { d.execute(); return "OK"; }
    var f = new File(path); if (f.exists) { f.execute(); return "OK"; }
    return "ERR missing " + path;
}
