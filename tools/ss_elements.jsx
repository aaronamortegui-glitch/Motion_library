// SS Elements — semi-finished, self-sizing graphic elements (behavior modelled on Animation Composer's Titles &
// Callouts and Shapes & Lines packs, rebuilt from scratch): label, lower third, title, underline, highlight and callout.
// Boxes and lines measure their text by expression (sourceRectAtTime at rest), so any copy, font or size fits.
// One controller null per element ("EL · <kind> n") holds Reveal (0-100, keyed with token curves), Padding X/Y,
// Radius, Gap and three colours (Box, Accent, Text): restyle or retime it after it is built.
//
// Usage: #include "ss_presets.jsx"  (token timing + text presets)  then  #include "ss_elements.jsx"
//        SSE.label(comp, "NEW", {position: [960, 540], t: 0.5});
//        SSE.lowerThird(comp, "Dana Ruiz", "Head of Design", {t: 1, out: 5});
//        SSE.title(comp, "Motion DNA", "The motion library to boost your skills", {t: 0});
//        SSE.underline(comp, "Headline", {t: 1}); SSE.highlight(comp, "Headline", {t: 1});
//        SSE.callout(comp, "Battery 48 h", [1200, 420], {t: 2});
// Common options: t (in, s), out (s, optional exit), colors {box, accent, text} (hex), fonts {title, text}, size,
//                 padding [x, y], radius, gap, textPreset (TX name, default per element), position [x, y].
var SSE = (function () {
    var DEF = { box: "#0A211F", accent: "#D8FF85", text: "#F7F9F2" };
    var FONTS = { title: ["InterTight-Bold", "Arial-BoldMT"], text: ["InterTight-Regular", "ArialMT"], display: ["InstrumentSerif-Regular", "Georgia"] };
    var HAS = {};

    function rgb(hex) {
        var h = String(hex).replace("#", "");
        return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
    }
    // first font of the list that AE can really draw: installed AND not in missingOrSubstitutedFonts (a per-user
    // variable font can be "found" yet substituted at render time, see LEARNINGS)
    function font(list) {
        if (typeof list === "string") list = [list];
        var bad = {};
        try { var m = app.fonts.missingOrSubstitutedFonts; for (var j = 0; j < m.length; j++) bad[m[j].postScriptName] = true; } catch (e0) {}
        for (var i = 0; i < list.length; i++) {
            var ps = list[i];
            if (HAS[ps] === undefined) { try { HAS[ps] = app.fonts.getFontsByPostScriptName(ps).length > 0; } catch (e) { HAS[ps] = true; } }
            if (HAS[ps] && !bad[ps]) return ps;
        }
        return "ArialMT";
    }
    function uniqueName(comp, base) {
        for (var n = 1; ; n++) {
            var name = base + " " + n, used = false;
            for (var i = 1; i <= comp.numLayers; i++) if (comp.layer(i).name === name) { used = true; break; }
            if (!used) return name;
        }
    }
    function control(L, type, name, value) {
        var fx = L.property("ADBE Effect Parade").addProperty(type); fx.name = name;
        if (value !== undefined) fx.property(1).setValue(value);
        return fx;
    }
    function controller(comp, kind, o) {
        OUTLINE = o.outline === true ? 4 : (o.outline || 0);
        var c = o.colors || {}, ctrl = comp.layers.addNull();
        ctrl.name = uniqueName(comp, "EL · " + kind); ctrl.enabled = false; ctrl.label = 11;
        control(ctrl, "ADBE Slider Control", "Reveal");
        var pad = o.padding || [28, 16];
        control(ctrl, "ADBE Slider Control", "Padding X", pad[0]);
        control(ctrl, "ADBE Slider Control", "Padding Y", pad[1]);
        control(ctrl, "ADBE Slider Control", "Radius", o.radius === undefined ? 10 : o.radius);
        control(ctrl, "ADBE Slider Control", "Gap", o.gap === undefined ? 10 : o.gap);
        control(ctrl, "ADBE Color Control", "Box", rgb(c.box || DEF.box));
        control(ctrl, "ADBE Color Control", "Accent", rgb(c.accent || DEF.accent));
        control(ctrl, "ADBE Color Control", "Text", rgb(c.text || DEF.text));
        var t = o.t || 0, reveal = ctrl.property("ADBE Effect Parade").property("Reveal").property(1);   // fetched last: adding effects invalidates earlier references
        SSM.animate(reveal, t, 0, 100, o.dur || "Sweep", o.ease || "Surge");
        if (o.out) SSM.animate(reveal, o.out, 100, 0, "Arrive", "Launch");
        return ctrl;
    }
    // the shared expression header: controller, eased reveal 0..1 and the rest time (the text animators include their
    // offsets in sourceRectAtTime, so measure 1.2 s after the reveal lands, when the text presets have settled)
    function head(ctrl) {
        return 'var C = thisComp.layer("' + ctrl + '"), RV = C.effect("Reveal")("Slider");\n' +
               'var e = Math.min(Math.max(RV / 100, 0), 1), tr = RV.numKeys >= 2 ? RV.key(2).time + 1.2 : time;\n' +
               'if (RV.numKeys >= 3) tr = Math.min(tr, RV.key(3).time - 0.05);   // measure once the text animators have settled, before any exit\n' +
               'var px = C.effect("Padding X")("Slider"), py = C.effect("Padding Y")("Slider"), gap = C.effect("Gap")("Slider");\n' +
               'var pk = 1; try { pk = 1 - 0.06 * C.effect("Press")("Slider") / 100; } catch (err) {}\n';
    }
    // comp-space bounds of text layers at rest: [left, top, right, bottom]
    function bounds(names) {
        var s = 'function bb(n) { var L = thisComp.layer(n), r = L.sourceRectAtTime(tr, false);\n' +
                '  var a = L.toComp([r.left, r.top], tr), b = L.toComp([r.left + r.width, r.top + r.height], tr);\n' +
                '  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; }\n' +
                'var B = bb("' + names[0] + '");\n';
        for (var i = 1; i < names.length; i++) s += 'var B' + i + ' = bb("' + names[i] + '"); B = [Math.min(B[0], B' + i + '[0]), Math.min(B[1], B' + i + '[1]), Math.max(B[2], B' + i + '[2]), Math.max(B[3], B' + i + '[3])];\n';
        return s;
    }
    function text(comp, str, ctrl, o, role, justify) {
        var L = comp.layers.addText(str), p = L.property("ADBE Text Properties").property("ADBE Text Document"), d = p.value;
        d.resetCharStyle(); d.resetParagraphStyle();
        var fo = o.fonts || {}, fl, size;   // explicit ifs: chained ternaries with comparisons misbehave in ExtendScript
        // brand fonts first, then the defaults: a substituted brand font falls back to a font of the same weight
        if (role === "title") { fl = [].concat(fo.title || [], FONTS.title); size = o.size || 56; }
        else if (role === "display") { fl = [].concat(fo.display || [], FONTS.display, FONTS.title); size = o.size || 110; }
        else { fl = [].concat(fo.text || [], FONTS.text); size = o.subSize || Math.round((o.size || 56) * 0.6); }
        d.font = font(fl); d.fontSize = size;
        d.applyFill = true; d.fillColor = [1, 1, 1]; d.applyStroke = false; d.tracking = role === "text" ? 0 : -10;
        d.justification = justify || ParagraphJustification.LEFT_JUSTIFY;
        p.setValue(d);
        var f = L.property("ADBE Effect Parade").addProperty("ADBE Fill");
        f.property("ADBE Fill-0002").expression = 'thisComp.layer("' + ctrl + '").effect("' + (o.textColor || "Text") + '")("Color")';
        return L;
    }
    function shapeLayer(comp, name) {
        var S = comp.layers.addShape(); S.name = name;
        var T = S.property("ADBE Transform Group");
        T.property("ADBE Anchor Point").setValue([0, 0]); T.property("ADBE Position").setValue([0, 0]);   // shape space = comp space
        return S;
    }
    var OUTLINE = 0;   // > 0: boxes are drawn as an outline of that width (o.outline)
    function rect(S, sizeExpr, posExpr, radiusExpr, colorExpr, noOutline) {
        var g = S.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"), v = g.property("ADBE Vectors Group");
        var r = v.addProperty("ADBE Vector Shape - Rect");
        r.property("ADBE Vector Rect Size").expression = sizeExpr;
        r.property("ADBE Vector Rect Position").expression = posExpr;
        if (radiusExpr) r.property("ADBE Vector Rect Roundness").expression = radiusExpr;
        if (OUTLINE && !noOutline) {
            var s = v.addProperty("ADBE Vector Graphic - Stroke");
            s.property("ADBE Vector Stroke Color").expression = colorExpr; s.property("ADBE Vector Stroke Width").setValue(OUTLINE);
        } else {
            var f = v.addProperty("ADBE Vector Graphic - Fill");
            f.property("ADBE Vector Fill Color").expression = colorExpr;
        }
        return g;
    }
    var PENDING = [];   // text exits wait for finish(): SSP.applyText times the exit from the layer's out point
    function animateText(L, preset, o) {
        if (preset === "none") return;
        try { SSP.applyText(L, preset, "in", (o.t || 0) + (o.textDelay === undefined ? 0.12 : o.textDelay)); } catch (e) {}
        PENDING.push([L, preset]);
    }
    function finish(comp, ctrl, layers, o) {
        var tIn = o.t || 0, tOut = o.out ? o.out + SSM.seconds("Arrive") + 0.05 : comp.duration;   // the text leaves with the box
        for (var i = 0; i < layers.length; i++) { layers[i].inPoint = tIn; layers[i].outPoint = tOut; layers[i].comment = "SS element: " + ctrl.name; }
        for (var k = 0; k < PENDING.length; k++) if (o.out) try { SSP.applyText(PENDING[k][0], PENDING[k][1], "out"); } catch (e) {}
        PENDING = [];
        ctrl.inPoint = tIn; ctrl.outPoint = tOut;
        ctrl.moveToBeginning();
        return ctrl;
    }

    // Chip / label: a rounded box that hugs the text and grows from the left.
    function label(comp, str, o) {
        o = o || {};
        var ctrl = controller(comp, o.kind || "label", o), n = ctrl.name, W = comp.width, H = comp.height;
        var T = text(comp, str, n, o, "title", ParagraphJustification.CENTER_JUSTIFY); T.name = n + " text";
        var r0 = T.sourceRectAtTime(0, false), pos = o.position || [W / 2, H / 2];
        T.property("ADBE Transform Group").property("ADBE Position").setValue([pos[0], pos[1] - r0.top - r0.height / 2]);
        var S = shapeLayer(comp, n + " box");
        var h = head(n) + bounds([T.name]);
        rect(S, h + '[(B[2] - B[0] + 2 * px) * e * pk, (B[3] - B[1] + 2 * py) * pk];',
             h + '[(B[0] + B[2]) / 2 - (B[2] - B[0] + 2 * px) * (1 - e) / 2, (B[1] + B[3]) / 2];',
             'thisComp.layer("' + n + '").effect("Radius")("Slider")', 'thisComp.layer("' + n + '").effect("' + (o.boxColor || "Box") + '")("Color")');
        S.moveAfter(T);
        animateText(T, o.textPreset || "Chars Rise", o);
        return finish(comp, ctrl, [T, S], o);
    }

    // Lower third: name + role on a box, with an accent bar on the left that grows first.
    function lowerThird(comp, name, role, o) {
        o = o || {};
        var ctrl = controller(comp, o.kind || "lower third", o), n = ctrl.name, W = comp.width, H = comp.height;
        var pos = o.position || [Math.round(W * 0.08), Math.round(H * 0.8)];
        var A = text(comp, name, n, o, "title"); A.name = n + " name";
        A.property("ADBE Transform Group").property("ADBE Position").setValue(pos);
        var layers = [A], names = [A.name], R = null;
        if (role) {
            R = text(comp, role, n, o, "text"); R.name = n + " role";
            // the role sits under the name, whatever the name's size: measured at rest
            R.property("ADBE Transform Group").property("ADBE Position").expression = head(n) + bounds([A.name]) +
                'var r = sourceRectAtTime(tr, false);\n[B[0] - r.left, B[3] + gap - r.top];';
            layers.push(R); names.push(R.name);
        }
        var S = shapeLayer(comp, n + " box"), h = head(n) + bounds(names);
        rect(S, h + '[(B[2] - B[0] + 2 * px) * e, B[3] - B[1] + 2 * py];',
             h + '[B[0] - px + (B[2] - B[0] + 2 * px) * e / 2, (B[1] + B[3]) / 2];',
             'thisComp.layer("' + n + '").effect("Radius")("Slider")', 'thisComp.layer("' + n + '").effect("Box")("Color")');
        // accent bar: full height, grows first (reveal 0-40 %)
        rect(S, h + 'var ea = Math.min(e / 0.4, 1);\n[8, (B[3] - B[1] + 2 * py) * ea];',
             h + '[B[0] - px - 4, (B[1] + B[3]) / 2];', null, 'thisComp.layer("' + n + '").effect("Accent")("Color")');
        S.moveAfter(A);   // the box goes under both texts (A is the lowest)
        animateText(A, o.textPreset || "Words Fade Up", o);
        if (R) animateText(R, o.textPreset || "Words Fade Up", { t: (o.t || 0) + 0.1, out: o.out, textDelay: o.textDelay });
        layers.push(S);
        return finish(comp, ctrl, layers, o);
    }

    // Title: a display line + optional subtitle, centred, with an accent rule between them that draws from the centre.
    function title(comp, str, sub, o) {
        o = o || {};
        if (!o.textColor) o.textColor = "Box";   // no box behind a title: its text takes the main (box) colour; textColor "Text" for dark backgrounds
        var ctrl = controller(comp, "title", o), n = ctrl.name, W = comp.width, H = comp.height, pos = o.position || [W / 2, H / 2];
        var A = text(comp, str, n, o, o.display === false ? "title" : "display", ParagraphJustification.CENTER_JUSTIFY); A.name = n + " title";
        var r0 = A.sourceRectAtTime(0, false);
        A.property("ADBE Transform Group").property("ADBE Position").setValue([pos[0], pos[1] - (sub ? r0.height * 0.35 : 0) - r0.top - r0.height / 2]);
        var layers = [A], S = shapeLayer(comp, n + " rule"), h = head(n) + bounds([A.name]);
        rect(S, h + '[(B[2] - B[0]) * 0.35 * e, 4];', h + '[(B[0] + B[2]) / 2, B[3] + gap * 2];', null, 'thisComp.layer("' + n + '").effect("Accent")("Color")');
        layers.push(S);
        if (sub) {
            var R = text(comp, sub, n, o, "text", ParagraphJustification.CENTER_JUSTIFY); R.name = n + " subtitle";
            R.property("ADBE Transform Group").property("ADBE Position").expression = head(n) + bounds([A.name]) +
                'var r = sourceRectAtTime(tr, false);\n[(B[0] + B[2]) / 2 - r.left - r.width / 2, B[3] + gap * 4 + 4 - r.top];';
            layers.push(R);
            animateText(R, o.subPreset || "Words Fade Up", { t: (o.t || 0) + 0.25, out: o.out, textDelay: o.textDelay });
        }
        animateText(A, o.textPreset || "Chars Rise", o);
        return finish(comp, ctrl, layers, o);
    }

    // Underline / highlight on an existing text layer (by name): the line or marker is measured from it.
    function mark(comp, layerName, o, kind) {
        o = o || {};
        var T = comp.layer(layerName), ctrl = controller(comp, kind, o), n = ctrl.name;
        var S = shapeLayer(comp, n + " " + kind), h = head(n) + bounds([T.name]);
        if (kind === "underline") {
            rect(S, h + '[(B[2] - B[0]) * e, Math.max(4, (B[3] - B[1]) * 0.07)];', h + '[B[0] + (B[2] - B[0]) * e / 2, B[3] + gap];', null,
                 'thisComp.layer("' + n + '").effect("Accent")("Color")');
            S.moveBefore(T);
        } else {   // marker highlight: lower 45 % of the text box, behind it, slightly wider
            rect(S, h + '[(B[2] - B[0] + px) * e, (B[3] - B[1]) * 0.45];', h + '[B[0] - px / 2 + (B[2] - B[0] + px) * e / 2, B[3] - (B[3] - B[1]) * 0.22];', null,
                 'thisComp.layer("' + n + '").effect("Accent")("Color")');
            S.moveAfter(T);
        }
        return finish(comp, ctrl, [S], o);
    }

    // Callout: a dot on the point, a leader line that draws to a label box (offset from the point).
    function callout(comp, str, point, o) {
        o = o || {};
        var ctrl = controller(comp, "callout", o), n = ctrl.name, off = o.offset || [180, -140];
        var T = text(comp, str, n, o, "title"); T.name = n + " text";
        var r0 = T.sourceRectAtTime(0, false), lx = point[0] + off[0], ly = point[1] + off[1];
        T.property("ADBE Transform Group").property("ADBE Position").setValue([off[0] >= 0 ? lx - r0.left : lx - r0.left - r0.width, ly - r0.top - r0.height / 2]);
        var S = shapeLayer(comp, n + " box"), h = head(n) + bounds([T.name]);
        rect(S, h + 'var eb = Math.min(Math.max((e - 0.45) / 0.55, 0), 1);\n[(B[2] - B[0] + 2 * px) * eb, B[3] - B[1] + 2 * py];',
             h + 'var eb = Math.min(Math.max((e - 0.45) / 0.55, 0), 1), w = B[2] - B[0] + 2 * px;\n' +
             (off[0] >= 0 ? '[B[0] - px + w * eb / 2, (B[1] + B[3]) / 2];' : '[B[2] + px - w * eb / 2, (B[1] + B[3]) / 2];'),
             'thisComp.layer("' + n + '").effect("Radius")("Slider")', 'thisComp.layer("' + n + '").effect("Box")("Color")');
        // leader: a path from the point to the box edge, drawn with Trim Paths in the first 45 % of the reveal
        var g = S.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"), v = g.property("ADBE Vectors Group");
        var path = v.addProperty("ADBE Vector Shape - Group");
        path.property("ADBE Vector Shape").expression = h + 'var x = ' + (off[0] >= 0 ? 'B[0] - px' : 'B[2] + px') + ', y = (B[1] + B[3]) / 2;\n' +
            'createPath([[' + point[0] + ', ' + point[1] + '], [' + (point[0] + off[0] * 0.55) + ', y], [x, y]], [], [], false);';
        var st = v.addProperty("ADBE Vector Graphic - Stroke");
        st.property("ADBE Vector Stroke Color").expression = 'thisComp.layer("' + n + '").effect("Accent")("Color")';
        st.property("ADBE Vector Stroke Width").setValue(o.stroke || 3);
        var tp = v.addProperty("ADBE Vector Filter - Trim");
        tp.property("ADBE Vector Trim End").expression = head(n) + 'Math.min(e / 0.45, 1) * 100;';
        var dg = S.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"), dv = dg.property("ADBE Vectors Group");   // the dot: its own group, so the stroke and trim above do not touch it
        var dot = dv.addProperty("ADBE Vector Shape - Ellipse");
        dot.property("ADBE Vector Ellipse Size").expression = head(n) + 'var d = ' + (o.dot || 16) + ' * Math.min(e / 0.15, 1); [d, d];';
        dot.property("ADBE Vector Ellipse Position").setValue(point);
        var df = dv.addProperty("ADBE Vector Graphic - Fill");
        df.property("ADBE Vector Fill Color").expression = 'thisComp.layer("' + n + '").effect("Accent")("Color")';
        S.moveAfter(T);
        animateText(T, o.textPreset || "Chars Rise", { t: (o.t || 0) + 0.3, out: o.out, textDelay: o.textDelay });
        return finish(comp, ctrl, [T, S], o);
    }

    // ---------------------------------------------------------------- more kinds (AC Titles & Callouts, Mixed)
    function q(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; }
    function textOf(ctrl, suffix) { return ctrl.containingComp.layer(ctrl.name + " " + (suffix || "text")); }
    function setSource(L, expr) { L.property("ADBE Text Properties").property("ADBE Text Document").expression = expr; }
    function fmtExpr(dec, sep) {
        return 'function fmt(v) { var s = v.toFixed(' + (dec || 0) + '), p = s.split("."); p[0] = p[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ' + q(sep === undefined ? "," : sep) + '); return p.join("."); }\n';
    }

    // Counter: a label whose number counts with the Reveal curve (Stage + Cruise by default: numbers never overshoot).
    function counter(comp, from, to, o) {
        o = o || {}; o.kind = o.kind || "counter"; o.dur = o.dur || "Stage"; o.ease = o.ease || "Cruise"; o.textPreset = o.textPreset || "none";
        var pre = o.prefix || "", suf = o.suffix || "";
        var ctrl = label(comp, pre + String(to) + suf, o), n = ctrl.name;
        setSource(textOf(ctrl), 'var C = thisComp.layer(' + q(n) + '), e = Math.min(Math.max(C.effect("Reveal")("Slider") / 100, 0), 1);\n' +
            fmtExpr(o.decimals, o.sep) + q(pre) + ' + fmt(' + from + ' + (' + to + ' - ' + from + ') * e) + ' + q(suf) + ';');
        return ctrl;
    }
    // Timer: mm:ss.cc running from the element's in point (or counting down from `from` seconds).
    function timer(comp, from, o) {
        o = o || {}; o.kind = o.kind || "timer"; o.textPreset = o.textPreset || "none";
        var ctrl = label(comp, "00:00.00", o), n = ctrl.name;
        setSource(textOf(ctrl), 'var C = thisComp.layer(' + q(n) + '), R = C.effect("Reveal")("Slider"), t0 = R.numKeys ? R.key(1).time : inPoint;\n' +
            'var s = Math.max(time - t0, 0);' + (from ? ' s = Math.max(' + from + ' - s, 0);' : '') + '\n' +
            'function z(v) { return (v < 10 ? "0" : "") + v; }\nz(Math.floor(s / 60)) + ":" + z(Math.floor(s % 60)) + "." + z(Math.floor((s % 1) * 100));');
        return ctrl;
    }
    // Price tag: the price large on top, a small label under it, on a box with the accent bar.
    function priceTag(comp, price, what, o) {
        o = o || {}; o.kind = o.kind || "price tag"; o.size = o.size || 84;
        return lowerThird(comp, price, what, o);
    }
    // Social handle: a pill with @handle (generic: no network logos, see CLAUDE.md).
    function handle(comp, name, o) {
        o = o || {}; o.kind = o.kind || "handle"; o.radius = o.radius === undefined ? 999 : o.radius;
        return label(comp, (name.charAt(0) === "@" ? "" : "@") + name, o);
    }
    // Speech bubble: a label with a tail under its left edge.
    function bubble(comp, str, o) {
        o = o || {}; o.kind = o.kind || "bubble"; o.radius = o.radius === undefined ? 26 : o.radius; o.padding = o.padding || [34, 22];
        var ctrl = label(comp, str, o), n = ctrl.name, S = textOf(ctrl, "box");
        var g = S.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"), v = g.property("ADBE Vectors Group");
        var pth = v.addProperty("ADBE Vector Shape - Group");
        pth.property("ADBE Vector Shape").expression = head(n) + bounds([textOf(ctrl).name]) + 'var x = B[0] - px + 30, y = B[3] + py - 2;\n' +
            'createPath([[x, y], [x - 4, y + 34 * Math.min(e, 1)], [x + 38, y]], [], [], true);';
        v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").expression = 'thisComp.layer(' + q(n) + ').effect("Box")("Color")';
        return ctrl;
    }
    // Reaction sticker: a short word with a thick outline that pops in at an angle ("yes!", "wow", "no!").
    function sticker(comp, str, o) {
        o = o || {};
        var ctrl = controller(comp, "sticker", { t: o.t, out: o.out, colors: o.colors, dur: o.dur || "Arrive", ease: o.ease || "Pop" }), n = ctrl.name;
        var W = comp.width, H = comp.height, pos = o.position || [W / 2, H / 2], c = o.colors || {};
        var T = comp.layers.addText(str), p = T.property("ADBE Text Properties").property("ADBE Text Document"), d = p.value;
        d.resetCharStyle(); d.font = font([].concat((o.fonts && o.fonts.title) || [], FONTS.title)); d.fontSize = o.size || 140;
        d.applyFill = true; d.fillColor = rgb(c.accent || DEF.accent); d.applyStroke = true; d.strokeColor = rgb(c.box || DEF.box);
        d.strokeWidth = Math.round((o.size || 140) * 0.1); d.strokeOverFill = false; d.justification = ParagraphJustification.CENTER_JUSTIFY;
        p.setValue(d); T.name = n + " text";
        var r = T.sourceRectAtTime(0, false);
        T.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([r.left + r.width / 2, r.top + r.height / 2]);
        T.property("ADBE Transform Group").property("ADBE Position").setValue(pos);
        var R = 'Math.max(thisComp.layer(' + q(n) + ').effect("Reveal")("Slider") / 100, 0)';
        T.property("ADBE Transform Group").property("ADBE Scale").expression = 'var s = ' + R + ' * 100; [s, s];';
        T.property("ADBE Transform Group").property("ADBE Rotate Z").expression = (o.angle === undefined ? -6 : o.angle) + ' - 24 * (1 - Math.min(' + R + ', 1));';
        return finish(comp, ctrl, [T], o);
    }
    // Quote card: a large accent quote mark, the quote as paragraph text, the author under an accent rule, on a box.
    function quote(comp, str, author, o) {
        o = o || {};
        var ctrl = controller(comp, "quote", { t: o.t, out: o.out, colors: o.colors, padding: o.padding || [56, 44], radius: o.radius, gap: o.gap || 16 }), n = ctrl.name;
        var W = comp.width, H = comp.height, width = o.width || Math.round(W * 0.5), pos = o.position || [Math.round((W - width) / 2), Math.round(H * 0.3)];
        var Q = text(comp, "\u201C", n, { size: (o.size || 48) * 4.5, fonts: o.fonts, textColor: "Accent" }, "display"); Q.name = n + " mark";
        var rq = Q.sourceRectAtTime(0, false);
        Q.property("ADBE Transform Group").property("ADBE Position").setValue([pos[0] - rq.left, pos[1] - rq.top]);
        var P = comp.layers.addBoxText([width, Math.round(H * 0.8)], str), pp = P.property("ADBE Text Properties").property("ADBE Text Document"), d = pp.value;
        d.resetCharStyle(); d.font = font([].concat((o.fonts && o.fonts.text) || [], FONTS.text)); d.fontSize = o.size || 48; d.leading = Math.round((o.size || 48) * 1.3);
        d.applyFill = true; d.fillColor = [1, 1, 1]; d.justification = ParagraphJustification.LEFT_JUSTIFY; pp.setValue(d); P.name = n + " quote";
        P.property("ADBE Effect Parade").addProperty("ADBE Fill").property("ADBE Fill-0002").expression = 'thisComp.layer(' + q(n) + ').effect("Text")("Color")';
        P.property("ADBE Transform Group").property("ADBE Position").expression = head(n) + bounds([Q.name]) + 'var r = sourceRectAtTime(tr, false);\n[' + pos[0] + ' - r.left, B[3] + gap - r.top];';
        var A = text(comp, "\u2014 " + (author || ""), n, { size: Math.round((o.size || 48) * 0.6 / 0.6), fonts: o.fonts, textColor: "Accent" }, "text"); A.name = n + " author";
        A.property("ADBE Transform Group").property("ADBE Position").expression = head(n) + bounds([P.name]) + 'var r = sourceRectAtTime(tr, false);\n[' + pos[0] + ' - r.left, B[3] + gap * 2 - r.top];';
        var layers = [Q, P, A];
        if (o.box !== false) {
            var S = shapeLayer(comp, n + " box"), h = head(n) + bounds([Q.name, P.name, A.name]);
            rect(S, h + '[(B[2] - B[0] + 2 * px), (B[3] - B[1] + 2 * py) * e];', h + '[(B[0] + B[2]) / 2, B[1] - py + (B[3] - B[1] + 2 * py) * e / 2];',
                 'thisComp.layer(' + q(n) + ').effect("Radius")("Slider")', 'thisComp.layer(' + q(n) + ').effect("Box")("Color")');
            S.moveAfter(Q); layers.push(S);
        }
        animateText(P, o.textPreset || "Words Fade Up", { t: (o.t || 0) + 0.2 });
        animateText(A, "Words Fade Up", { t: (o.t || 0) + 0.6 });
        try { SSP.apply(Q, "Scale Pop", "in", (o.t || 0) + 0.05); } catch (e) {}
        return finish(comp, ctrl, layers, o);
    }
    // Bullet list: one line per item, an accent dot each, staggered.
    function list(comp, items, o) {
        o = o || {};
        var ctrl = controller(comp, "list", { t: o.t, out: o.out, colors: o.colors }), n = ctrl.name, W = comp.width, H = comp.height;
        var size = o.size || 46, pos = o.position || [Math.round(W * 0.12), Math.round(H * 0.3)], y = pos[1], layers = [], step = o.stagger || 0.14;
        for (var i = 0; i < items.length; i++) {
            var T = text(comp, items[i], n, { size: size, fonts: o.fonts }, "title"); T.name = n + " item " + (i + 1);
            var r = T.sourceRectAtTime(0, false);
            T.property("ADBE Transform Group").property("ADBE Position").setValue([pos[0] + size * 0.9 - r.left, y - r.top]);
            var D = shapeLayer(comp, n + " dot " + (i + 1)), dv = D.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
            dv.addProperty("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").setValue([size * 0.32, size * 0.32]);
            dv.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").expression = 'thisComp.layer(' + q(n) + ').effect("Accent")("Color")';
            D.property("ADBE Transform Group").property("ADBE Position").setValue([pos[0] + size * 0.25, y + r.height / 2]);
            var ti = (o.t || 0) + i * step;
            SSM.animate(D.property("ADBE Transform Group").property("ADBE Scale"), ti, [0, 0, 100], [100, 100, 100], "Arrive", "Pop");
            D.property("ADBE Transform Group").property("ADBE Opacity").expression = 'Math.min(Math.max(thisComp.layer(' + q(n) + ').effect("Reveal")("Slider"), 0), 100);';
            animateText(T, o.textPreset || "Words Fade Up", { t: ti });
            layers.push(T, D);
            y += r.height + (o.lineGap || size * 0.7);
        }
        return finish(comp, ctrl, layers, o);
    }
    // Progress bar: a track and a fill that grows to `value` (0-100) with a counting percentage.
    function progress(comp, value, o) {
        o = o || {};
        var ctrl = controller(comp, "progress", { t: o.t, out: o.out, colors: o.colors, dur: o.dur || "Stage", ease: o.ease || "Cruise" }), n = ctrl.name;
        var W = comp.width, H = comp.height, width = o.width || Math.round(W * 0.4), hh = o.height || 18;
        var pos = o.position || [Math.round(W / 2 - width / 2), Math.round(H / 2)];
        var S = shapeLayer(comp, n + " bar"), e = 'Math.min(Math.max(thisComp.layer(' + q(n) + ').effect("Reveal")("Slider") / 100, 0), 1)';
        var tg = rect(S, '[' + width + ', ' + hh + '];', '[' + (pos[0] + width / 2) + ', ' + pos[1] + '];', '' + hh / 2, 'thisComp.layer(' + q(n) + ').effect("Text")("Color")');
        tg.property("ADBE Vectors Group").property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Opacity").setValue(22);
        rect(S, 'var w = ' + width * (value / 100) + ' * ' + e + '; [Math.max(w, ' + hh + '), ' + hh + '];', 'var w = ' + width * (value / 100) + ' * ' + e + '; [' + pos[0] + ' + Math.max(w, ' + hh + ') / 2, ' + pos[1] + '];',
             '' + hh / 2, 'thisComp.layer(' + q(n) + ').effect("Accent")("Color")');
        var T = text(comp, value + "%", n, { size: o.size || 40, fonts: o.fonts }, "title"); T.name = n + " value";
        var r = T.sourceRectAtTime(0, false);
        T.property("ADBE Transform Group").property("ADBE Position").setValue([pos[0] + width - r.left - r.width, pos[1] - hh - 12 - r.top - r.height]);
        setSource(T, 'Math.round(' + value + ' * ' + e + ') + "%";');
        var layers = [S, T];
        if (o.label) {
            var Lb = text(comp, o.label, n, { size: o.size || 40, fonts: o.fonts }, "text"); Lb.name = n + " label";
            var rl = Lb.sourceRectAtTime(0, false);
            Lb.property("ADBE Transform Group").property("ADBE Position").setValue([pos[0] - rl.left, pos[1] - hh - 12 - rl.top - rl.height]);
            animateText(Lb, "Words Fade Up", { t: o.t || 0 }); layers.push(Lb);
        }
        return finish(comp, ctrl, layers, o);
    }
    // Button with a click: a pill appears, a cursor arrives and clicks; the button presses and swaps to `pressed`.
    function button(comp, str, pressed, o) {
        o = o || {}; o.kind = o.kind || "button"; o.radius = o.radius === undefined ? 999 : o.radius; o.boxColor = "Accent"; o.textColor = "Box";
        var ctrl = label(comp, str, o), n = ctrl.name, T = textOf(ctrl), S = textOf(ctrl, "box");
        var tc = o.click || (o.t || 0) + 1.3;
        control(ctrl, "ADBE Slider Control", "Press");
        var press = ctrl.property("ADBE Effect Parade").property("Press").property(1);
        SSM.animate(press, tc - 0.04, 0, 100, "Tick", "Flat"); SSM.animate(press, tc + 0.1, 100, 0, "Glide", "Land");
        T.property("ADBE Transform Group").property("ADBE Scale").expression = 'var k = 100 * (1 - 0.06 * thisComp.layer(' + q(n) + ').effect("Press")("Slider") / 100); [k, k];';
        if (pressed) setSource(T, 'time >= ' + tc + ' ? ' + q(pressed) + ' : ' + q(str) + ';');
        // after the click the colours swap: box takes the text colour (dark scenes) or, with pressedBox "Box", the box
        // colour with accent text (light scenes, where a text-coloured box would vanish into the background)
        var pb = o.pressedBox === "Box", boxAfter = pb ? "Box" : "Text", textAfter = pb ? "Accent" : "Box";
        S.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").property("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").expression =
            'var C = thisComp.layer(' + q(n) + '); time >= ' + tc + ' ? C.effect("' + boxAfter + '")("Color") : C.effect("Accent")("Color");';
        T.property("ADBE Effect Parade").property(1).property("ADBE Fill-0002").expression = 'var C = thisComp.layer(' + q(n) + '); time >= ' + tc + ' ? C.effect("' + textAfter + '")("Color") : C.effect("Box")("Color");';
        // cursor
        var Cu = shapeLayer(comp, n + " cursor"), cv = Cu.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var s = new Shape(); s.vertices = [[0, 0], [0, 34], [9, 26], [16, 41], [22, 38], [15, 24], [27, 24]]; s.closed = true;
        cv.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(s);
        cv.addProperty("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Color").expression = 'thisComp.layer(' + q(n) + ').effect("Box")("Color")';
        cv.property("ADBE Vector Graphic - Stroke").property("ADBE Vector Stroke Width").setValue(3);
        cv.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").expression = 'thisComp.layer(' + q(n) + ').effect("Text")("Color")';
        var pos = o.position || [comp.width / 2, comp.height / 2], CT = Cu.property("ADBE Transform Group");
        CT.property("ADBE Anchor Point").setValue([0, 0]);
        SSM.animate(CT.property("ADBE Position"), tc - SSM.seconds("Sweep"), [pos[0] + 260, pos[1] + 200], [pos[0] + 14, pos[1] + 6], "Sweep", "Land");
        SSM.animate(CT.property("ADBE Scale"), tc - 0.04, [100, 100, 100], [82, 82, 100], "Tick", "Flat"); SSM.animate(CT.property("ADBE Scale"), tc + 0.1, [82, 82, 100], [100, 100, 100], "Glide", "Land");
        Cu.inPoint = Math.max(tc - SSM.seconds("Sweep") - 0.05, 0); Cu.outPoint = o.out ? o.out : comp.duration; Cu.moveToBeginning();
        return ctrl;
    }
    // Kinetic type stack: lines of different lengths fitted to one width, each sliding in from alternate sides.
    function kinetic(comp, lines, o) {
        o = o || {};
        var ctrl = controller(comp, "kinetic", { t: o.t, out: o.out, colors: o.colors }), n = ctrl.name, W = comp.width, H = comp.height;
        var width = o.width || Math.round(W * 0.55), pos = o.position || [W / 2, H / 2], gap = o.gap === undefined ? 14 : o.gap, info = [], total = 0, i;
        for (i = 0; i < lines.length; i++) {
            var T = text(comp, o.upper === false ? lines[i] : String(lines[i]).toUpperCase(), n, { size: 100, fonts: o.fonts, textColor: i % 2 && o.alternate !== false ? "Accent" : "Text" }, "title", ParagraphJustification.CENTER_JUSTIFY);
            T.name = n + " line " + (i + 1);
            var r = T.sourceRectAtTime(0, false), s = width / r.width * 100;
            info.push([T, r, s]); total += r.height * s / 100 + (i ? gap : 0);
        }
        var y = pos[1] - total / 2, layers = [], step = o.stagger || 0.1;
        for (i = 0; i < info.length; i++) {
            var L = info[i][0], rr = info[i][1], sc = info[i][2], TT = L.property("ADBE Transform Group");
            TT.property("ADBE Scale").setValue([sc, sc]);
            var P = [pos[0] - (rr.left + rr.width / 2) * sc / 100, y - rr.top * sc / 100], dir = i % 2 ? 1 : -1, ti = (o.t || 0) + i * step;
            SSM.animate(TT.property("ADBE Position"), ti, [P[0] + dir * W * 0.7, P[1]], P, o.dur || "Sweep", o.ease || "Whip");
            SSM.animate(TT.property("ADBE Opacity"), ti, 0, 100, "Blink", "Flat");
            if (o.out) SSM.animate(TT.property("ADBE Position"), o.out + i * step * 0.5, P, [P[0] - dir * W * 0.7, P[1]], "Arrive", "Launch");
            y += rr.height * sc / 100 + gap; layers.push(L);
        }
        return finish(comp, ctrl, layers, o);
    }
    // Letter tiles: each letter on its own rounded tile, flipping in (3D, X axis) one after another.
    function tiles(comp, word, o) {
        o = o || {};
        var ctrl = controller(comp, "tiles", { t: o.t, out: o.out, colors: o.colors, radius: o.radius }), n = ctrl.name, W = comp.width, H = comp.height;
        var ch = String(word).split(""), ts = o.size || 130, gap = Math.round(ts * 0.12), pos = o.position || [W / 2, H / 2], count = 0, i;
        for (i = 0; i < ch.length; i++) if (ch[i] !== " ") count++;
        var spaces = ch.length - count, total = ch.length * ts + (ch.length - 1) * gap - spaces * ts * 0.5, x = pos[0] - total / 2 + ts / 2, layers = [], k = 0;
        for (i = 0; i < ch.length; i++) {
            if (ch[i] === " ") { x += ts * 0.5 + gap; continue; }
            var S = shapeLayer(comp, n + " tile " + (k + 1));
            rect(S, '[' + ts + ', ' + ts + '];', '[0, 0];', 'thisComp.layer(' + q(n) + ').effect("Radius")("Slider") * ' + (ts / 60), 'thisComp.layer(' + q(n) + ').effect("' + (k % 2 && o.alternate !== false ? "Accent" : "Box") + '")("Color")');
            S.threeDLayer = true; S.property("ADBE Transform Group").property("ADBE Position").setValue([x, pos[1], 0]);
            var T = text(comp, String(ch[i]).toUpperCase(), n, { size: Math.round(ts * 0.62), fonts: o.fonts, textColor: k % 2 && o.alternate !== false ? "Box" : "Text" }, "title", ParagraphJustification.CENTER_JUSTIFY);
            T.name = n + " letter " + (k + 1); T.threeDLayer = true;
            var r = T.sourceRectAtTime(0, false);
            T.setParentWithJump(S);   // no compensation: the letter lives in the tile's (rotating) space
            T.property("ADBE Transform Group").property("ADBE Position").setValue([-r.left - r.width / 2, -r.top - r.height / 2, -1]);
            var ti = (o.t || 0) + k * (o.stagger || 0.07), RX = S.property("ADBE Transform Group").property("ADBE Rotate X");
            SSM.animate(RX, ti, -95, 0, o.dur || "Sweep", o.ease || "Pop");
            SSM.animate(S.property("ADBE Transform Group").property("ADBE Opacity"), ti, 0, 100, "Blink", "Flat");
            if (o.out) SSM.animate(RX, o.out + k * 0.04, 0, 95, "Arrive", "Launch");
            layers.push(S, T); x += ts + gap; k++;
        }
        return finish(comp, ctrl, layers, o);
    }

    // ---------------------------------------------------------------- titles & boxes (AC Essential/Scale/Cinematic Titles)
    // Text box: a title line over a paragraph, on a box that grows downward.
    function textbox(comp, ttl, body, o) {
        o = o || {};
        var ctrl = controller(comp, "text box", { t: o.t, out: o.out, colors: o.colors, padding: o.padding || [48, 40], radius: o.radius, gap: o.gap || 14, outline: o.outline }), n = ctrl.name;
        var W = comp.width, H = comp.height, width = o.width || Math.round(W * 0.42), pos = o.position || [Math.round((W - width) / 2), Math.round(H * 0.3)];
        var A = text(comp, ttl, n, { size: o.size || 52, fonts: o.fonts, textColor: "Accent" }, "title"); A.name = n + " title";
        var ra = A.sourceRectAtTime(0, false); A.property("ADBE Transform Group").property("ADBE Position").setValue([pos[0] - ra.left, pos[1] - ra.top]);
        var P = comp.layers.addBoxText([width, Math.round(H * 0.8)], body), pp = P.property("ADBE Text Properties").property("ADBE Text Document"), d = pp.value;
        d.resetCharStyle(); d.font = font([].concat((o.fonts && o.fonts.text) || [], FONTS.text)); d.fontSize = o.bodySize || 34; d.leading = Math.round((o.bodySize || 34) * 1.35);
        d.applyFill = true; d.fillColor = [1, 1, 1]; d.justification = ParagraphJustification.LEFT_JUSTIFY; pp.setValue(d); P.name = n + " body";
        P.property("ADBE Effect Parade").addProperty("ADBE Fill").property("ADBE Fill-0002").expression = 'thisComp.layer(' + q(n) + ').effect("Text")("Color")';
        P.property("ADBE Transform Group").property("ADBE Position").expression = head(n) + bounds([A.name]) + 'var r = sourceRectAtTime(tr, false);\n[' + pos[0] + ' - r.left, B[3] + gap * 2 - r.top];';
        var S = shapeLayer(comp, n + " box"), h = head(n) + bounds([A.name, P.name]);
        rect(S, h + '[(B[2] - B[0] + 2 * px), (B[3] - B[1] + 2 * py) * e];', h + '[(B[0] + B[2]) / 2, B[1] - py + (B[3] - B[1] + 2 * py) * e / 2];',
             'thisComp.layer(' + q(n) + ').effect("Radius")("Slider")', 'thisComp.layer(' + q(n) + ').effect("Box")("Color")');
        S.moveAfter(A);
        animateText(A, o.textPreset || "Words Fade Up", { t: (o.t || 0) + 0.15 });
        animateText(P, "Words Fade Up", { t: (o.t || 0) + 0.35 });
        return finish(comp, ctrl, [A, P, S], o);
    }
    // Media placeholder: a framed slot (16:9 by default) with a title under it; o.layer = a layer to fit into the slot.
    function media(comp, ttl, o) {
        o = o || {};
        var ctrl = controller(comp, "media", { t: o.t, out: o.out, colors: o.colors, radius: o.radius, gap: o.gap || 18 }), n = ctrl.name;
        var W = comp.width, H = comp.height, sw = (o.slot && o.slot[0]) || Math.round(W * 0.36), sh = (o.slot && o.slot[1]) || Math.round(sw * 9 / 16);
        var c0 = o.position || [W / 2, H / 2 - sh * 0.1];
        var S = shapeLayer(comp, n + " slot"), e = 'Math.min(Math.max(thisComp.layer(' + q(n) + ').effect("Reveal")("Slider") / 100, 0), 1)';
        var g = rect(S, '[' + sw + ' * ' + e + ', ' + sh + '];', '[' + c0[0] + ', ' + c0[1] + '];', 'thisComp.layer(' + q(n) + ').effect("Radius")("Slider")', 'thisComp.layer(' + q(n) + ').effect("Box")("Color")', true);
        var layers = [S];
        if (o.layer) {   // fit (cover) the given layer into the slot and use the slot as its alpha matte
            var M = comp.layer(o.layer), r = M.sourceRectAtTime(o.t || 0, false), k = Math.max(sw / r.width, sh / r.height) * 100;
            M.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([r.left + r.width / 2, r.top + r.height / 2]);
            M.property("ADBE Transform Group").property("ADBE Position").setValue(c0);
            M.property("ADBE Transform Group").property("ADBE Scale").setValue([k, k]);
            var Mt = S.duplicate(); Mt.name = n + " matte"; M.moveAfter(Mt);
            try { M.setTrackMatte(Mt, TrackMatteType.ALPHA); } catch (e1) { try { M.trackMatteType = TrackMatteType.ALPHA; } catch (e2) {} }
        }
        if (ttl) {   // the caption is optional (no text: the slot alone, never "null")
            var A = text(comp, ttl, n, { size: o.size || 40, fonts: o.fonts, textColor: "Box" }, "title", ParagraphJustification.CENTER_JUSTIFY); A.name = n + " title";
            var ra = A.sourceRectAtTime(0, false);
            A.property("ADBE Transform Group").property("ADBE Position").setValue([c0[0] - ra.left - ra.width / 2, c0[1] + sh / 2 + 26 - ra.top]);
            animateText(A, o.textPreset || "Words Fade Up", { t: (o.t || 0) + 0.3 });
            layers.push(A);
        }
        return finish(comp, ctrl, layers, o);
    }
    // Scale title: the title pushes in from larger (push) or drops in from smaller (drop), token curves.
    function scaleTitle(comp, str, sub, o) {
        o = o || {}; o.display = o.display === undefined ? false : o.display;
        var ctrl = title(comp, str, sub, { t: o.t, out: o.out, colors: o.colors, fonts: o.fonts, size: o.size || 96, position: o.position, display: o.display, textPreset: "none", subPreset: "none", textColor: o.textColor });
        var comp2 = ctrl.containingComp, L = comp2.layer(ctrl.name + " title"), Sb = comp2.layer(ctrl.name + " subtitle"), from = o.mode === "drop" ? 45 : 170;
        var list = [L]; if (Sb) list.push(Sb);
        for (var i = 0; i < list.length; i++) {
            var X = list[i], r = X.sourceRectAtTime((o.t || 0) + 2, false), TT = X.property("ADBE Transform Group");
            var p0 = TT.property("ADBE Position").valueAtTime((o.t || 0) + 2, false);
            if (TT.property("ADBE Position").expression) { var pv = p0; TT.property("ADBE Position").expression = ""; TT.property("ADBE Position").setValue(pv); }
            TT.property("ADBE Anchor Point").setValue([r.left + r.width / 2, r.top + r.height / 2]);
            TT.property("ADBE Position").setValue([p0[0] + r.left + r.width / 2, p0[1] + r.top + r.height / 2]);
            var ti = (o.t || 0) + i * 0.12;
            SSM.animate(TT.property("ADBE Scale"), ti, [from, from, 100], [100, 100, 100], o.dur || "Sweep", o.ease || (o.mode === "drop" ? "Pop" : "Land"));
            SSM.animate(TT.property("ADBE Opacity"), ti, 0, 100, "Blink", "Flat");
        }
        return ctrl;
    }
    // Cinematic title: neon (glow + flicker on), blur (defocus reveal) or kerning (slow tracking expand). (A light-sweep style was
    // retired after a side-by-side with AC: CC Light Sweep on flat text barely read.)
    function cinematic(comp, str, o) {
        o = o || {};
        var style = o.style || "blur";
        var ctrl = controller(comp, "cinematic " + style, { t: o.t, out: o.out, colors: o.colors, dur: "Stage", ease: "Cruise" }), n = ctrl.name, W = comp.width, H = comp.height;
        var T = text(comp, String(str).toUpperCase(), n, { size: o.size || 110, fonts: o.fonts, textColor: style === "neon" ? "Accent" : "Text" }, o.serif ? "display" : "title", ParagraphJustification.CENTER_JUSTIFY);
        T.name = n + " title";
        var r = T.sourceRectAtTime(0, false), pos = o.position || [W / 2, H / 2], TT = T.property("ADBE Transform Group"), t0 = o.t || 0;
        TT.property("ADBE Anchor Point").setValue([r.left + r.width / 2, r.top + r.height / 2]); TT.property("ADBE Position").setValue(pos);
        var R = 'Math.min(Math.max(thisComp.layer(' + q(n) + ').effect("Reveal")("Slider") / 100, 0), 1)';
        var fx = T.property("ADBE Effect Parade");
        if (style === "neon") {
            var gl = fx.addProperty("ADBE Glo2"); gl.name = "SS Neon"; gl = fx.property("SS Neon");
            gl.property("ADBE Glo2-0002").setValue(30); gl.property("ADBE Glo2-0003").setValue(40); gl.property("ADBE Glo2-0004").setValue(1.4);
            TT.property("ADBE Opacity").expression = 'var t0 = ' + t0 + ', d = time - t0; seedRandom(Math.floor(time * 24), true);\nd < 0 ? 0 : (d < 0.7 ? (random() < d / 0.7 ? 100 : 15) : 100) * ' + R + ' + (d >= 0.7 ? 0 : 0);';
        } else if (style === "blur") {
            var gb = fx.addProperty("ADBE Gaussian Blur 2"); gb.name = "SS Defocus"; gb = fx.property("SS Defocus");
            gb.property("ADBE Gaussian Blur 2-0001").expression = '(1 - ' + R + ') * 60;';
            TT.property("ADBE Scale").expression = 'var s = 112 - 12 * ' + R + '; [s, s];';
            TT.property("ADBE Opacity").expression = R + ' * 100;';
        } else if (style === "kerning") {
            var an = T.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator"); an.name = "SS Kerning";
            T.property("ADBE Text Properties").property("ADBE Text Animators").property("SS Kerning").property("ADBE Text Animator Properties").addProperty("ADBE Text Tracking Amount")
                .expression = '-12 + ' + R + ' * 12 + Math.max(time - ' + t0 + ', 0) * ' + (o.drift || 2) + ';';
            TT.property("ADBE Opacity").expression = R + ' * 100;';
        }
        return finish(comp, ctrl, [T], o);
    }
    // Chat bubble: typing dots first, then the message (box measured on the message).
    function chat(comp, msg, o) {
        o = o || {}; o.kind = o.kind || "chat"; o.textPreset = "none"; o.radius = o.radius === undefined ? 26 : o.radius;
        var typing = o.typing || 1.0, ctrl = bubble(comp, msg, o), n = ctrl.name, t0 = (o.t || 0) + 0.15;
        setSource(textOf(ctrl), 'var d = time - ' + t0 + ';\nd < ' + typing + ' ? ["\u2022", "\u2022 \u2022", "\u2022 \u2022 \u2022"][Math.max(0, Math.floor(d * 5)) % 3] : ' + q(msg) + ';');
        return ctrl;
    }
    // Rating: five stars, the first `value` ones fill and pop one after another.
    function rating(comp, value, o) {
        o = o || {};
        var ctrl = controller(comp, "rating", { t: o.t, out: o.out, colors: o.colors }), n = ctrl.name, W = comp.width, H = comp.height;
        var size = o.size || 60, pos = o.position || [W / 2, H / 2], S = shapeLayer(comp, n + " stars"), root = S.property("ADBE Root Vectors Group");
        for (var i = 0; i < 5; i++) {
            var g = root.addProperty("ADBE Vector Group"), v = g.property("ADBE Vectors Group");
            var st = v.addProperty("ADBE Vector Shape - Star"); st.property("ADBE Vector Star Type").setValue(1); st.property("ADBE Vector Star Points").setValue(5);
            st.property("ADBE Vector Star Outer Radius").setValue(size / 2); st.property("ADBE Vector Star Inner Radius").setValue(size / 4.4);
            st.property("ADBE Vector Star Outer Roundess").setValue(12);
            var on = i < Math.round(value);
            if (on) v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").expression = 'thisComp.layer(' + q(n) + ').effect("Accent")("Color")';
            var sk = v.addProperty("ADBE Vector Graphic - Stroke"); sk.property("ADBE Vector Stroke Color").expression = 'thisComp.layer(' + q(n) + ').effect("' + (on ? "Accent" : "Text") + '")("Color")';
            sk.property("ADBE Vector Stroke Width").setValue(Math.max(2, size / 22));
            var gt = g.property("ADBE Vector Transform Group");
            gt.property("ADBE Vector Position").setValue([pos[0] + (i - 2) * size * 1.2, pos[1]]);
            SSM.animate(gt.property("ADBE Vector Scale"), (o.t || 0) + i * 0.08, [0, 0], [100, 100], "Arrive", "Pop");
        }
        return finish(comp, ctrl, [S], o);
    }
    // Progress ring: a circular track and an arc that draws to `value` %, the number counting in the middle.
    function ring(comp, value, o) {
        o = o || {};
        var ctrl = controller(comp, "ring", { t: o.t, out: o.out, colors: o.colors, dur: o.dur || "Stage", ease: o.ease || "Cruise" }), n = ctrl.name, W = comp.width, H = comp.height;
        var d = o.size || 220, pos = o.position || [W / 2, H / 2], S = shapeLayer(comp, n + " ring"), root = S.property("ADBE Root Vectors Group");
        var e = 'Math.min(Math.max(thisComp.layer(' + q(n) + ').effect("Reveal")("Slider") / 100, 0), 1)';
        for (var k = 0; k < 2; k++) {
            var g = root.addProperty("ADBE Vector Group"), v = g.property("ADBE Vectors Group");
            v.addProperty("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").setValue([d, d]);
            var sk = v.addProperty("ADBE Vector Graphic - Stroke");
            sk.property("ADBE Vector Stroke Color").expression = 'thisComp.layer(' + q(n) + ').effect("' + (k ? "Text" : "Accent") + '")("Color")';
            sk.property("ADBE Vector Stroke Width").setValue(Math.max(6, d / 14)); sk.property("ADBE Vector Stroke Line Cap").setValue(2);
            if (k) sk.property("ADBE Vector Stroke Opacity").setValue(22);
            else { var tr = v.addProperty("ADBE Vector Filter - Trim"); tr.property("ADBE Vector Trim End").expression = value + ' * ' + e + ';'; }
            g.property("ADBE Vector Transform Group").property("ADBE Vector Position").setValue(pos);
            g.property("ADBE Vector Transform Group").property("ADBE Vector Rotation").setValue(-90);
        }
        var T = text(comp, value + "%", n, { size: Math.round(d * 0.26), fonts: o.fonts, textColor: o.textColor || "Text" }, "title", ParagraphJustification.CENTER_JUSTIFY); T.name = n + " value";
        var r = T.sourceRectAtTime(0, false); T.property("ADBE Transform Group").property("ADBE Position").setValue([pos[0] - r.left - r.width / 2, pos[1] - r.top - r.height / 2]);
        setSource(T, 'Math.round(' + value + ' * ' + e + ') + "%";');
        return finish(comp, ctrl, [S, T], o);
    }

    // End card: our logo (assets/brand/motion_dna_mark.json, or o.logo = another mark JSON made by tools/logo_to_shape.py)
    // in the lockups of the logo manual (Figma): "stacked" (default, as on the box: the mark on top, MOTION / DNA in caps,
    // centred below) or "horizontal" (mark left, words left-aligned at its right). The mark grows up its own diagonal behind
    // a living edge (Reveal, Surge) while it scales in with overshoot (Pop) and settles its tilt (Settle); the arrow kicks
    // forward (Launch, then Land) with a few sparkles; each word rises into place behind a line mask (Land), and the
    // tagline follows. The mark breathes while it holds.
    function endCard(comp, o) {
        o = o || {};
        var W = comp.width, H = comp.height, t0 = o.t || 0, stacked = o.layout !== "horizontal";
        var cols = { box: (o.colors && o.colors.box) || "#0A211F", accent: (o.colors && o.colors.accent) || "#D8FF85", text: (o.colors && o.colors.text) || "#F7F9F2" };
        var ctrl = controller(comp, "end card", { t: t0, out: o.out, colors: cols, dur: "Stage", ease: "Surge" }), n = ctrl.name;
        var jf = new File(o.logo || (SS_ROOT + "/assets/brand/motion_dna_mark.json")); jf.encoding = "UTF-8"; jf.open("r");
        var D = eval("(" + jf.read() + ")"); jf.close();
        var mh = o.size || Math.round(H * (stacked ? 0.40 : 0.42)), k = mh / D.height, mw = D.width * k;
        var hasWord = o.wordmark !== false, words = hasWord ? String(o.text || "Motion DNA").toUpperCase().split(" ") : [];
        // wordmark: caps in the title face, the same size on every line (as on the box)
        var ws = Math.round(mh * (stacked ? 0.27 : 0.30)), T = [], rr = [];
        for (var a = 0; a < words.length; a++) {
            var TL = text(comp, words[a], n, { size: ws, fonts: o.fonts, textColor: o.wordColor || "Text" }, "title",
                          stacked ? ParagraphJustification.CENTER_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY);
            var td = TL.property("ADBE Text Properties").property("ADBE Text Document"), tv = td.value; tv.tracking = 30; td.setValue(tv);
            TL.name = n + " word " + (a + 1); T.push(TL); rr.push(TL.sourceRectAtTime(0, false));
        }
        var lineGap = ws * 0.16, wordW = 0, wordH = 0;
        for (var b = 0; b < rr.length; b++) { wordW = Math.max(wordW, rr[b].width); wordH += rr[b].height + (b ? lineGap : 0); }
        var ps = o.position || [W / 2, H / 2], cx = ps[0], cy = ps[1], gapM = mh * (stacked ? 0.1 : 0.12), mx, my, wx, wy;
        if (stacked) { var tot = mh + (T.length ? gapM + wordH : 0); mx = cx; my = cy - tot / 2 + mh / 2; wx = cx; wy = my + mh / 2 + gapM; }
        else { var totW = mw + (T.length ? gapM + wordW : 0); mx = cx - totW / 2 + mw / 2; my = cy; wx = cx - totW / 2 + mw + gapM; wy = cy - wordH / 2; }
        // the mark: a precomp where every piece (strands, thin lines, the arrow; tools/logo_parts.py) is drawn by its own
        // centre stroke (Trim Paths) under a matte of its own outline, so the logo assembles piece by piece
        var parts = D.parts || [], CW = Math.ceil(D.width), CH = Math.ceil(D.height);
        var MC = app.project.items.addComp(comp.name + " · " + n + " · mark", CW, CH, 1, comp.duration, comp.frameRate);   // named after its comp: one per end card
        var acc = 'comp("' + comp.name + '").layer("' + n + '").effect("Accent")("Color")';
        function fillLayer(c, name, paths) {
            var F = c.layers.addShape(); F.name = name;
            var fv = F.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
            for (var i = 0; i < paths.length; i++) {
                var P = paths[i], sh = new Shape(); sh.vertices = P.v; sh.inTangents = P.i; sh.outTangents = P.o; sh.closed = true;
                fv.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
            }
            var ff = fv.addProperty("ADBE Vector Graphic - Fill"); ff.property("ADBE Vector Fill Rule").setValue(2); ff.property("ADBE Vector Fill Color").expression = acc;
            F.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([0, 0]); F.property("ADBE Transform Group").property("ADBE Position").setValue([CW / 2, CH / 2]);
            return F;
        }
        if (!parts.length) fillLayer(MC, "mark", D.paths);
        var sB = SSM.seconds("Stage"), lastEnd = t0;
        for (var q = 0; q < parts.length; q++) {
            var Pt = parts[q], S = Pt.stroke, F = fillLayer(MC, Pt.name + " outline", Pt.paths);
            var Bd = MC.layers.addShape(); Bd.name = Pt.name;
            var sv = Bd.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group"), shp = new Shape();
            shp.vertices = S.v; shp.inTangents = S.i; shp.outTangents = S.o; shp.closed = false;
            sv.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(shp);
            var sk = sv.addProperty("ADBE Vector Graphic - Stroke");
            sk.property("ADBE Vector Stroke Width").setValue(S.width); sk.property("ADBE Vector Stroke Line Cap").setValue(2);
            sk.property("ADBE Vector Stroke Color").expression = acc;
            sv.addProperty("ADBE Vector Filter - Trim");
            var te = Bd.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").property("ADBE Vector Filter - Trim").property("ADBE Vector Trim End");
            // timing: the strands climb the helix, the thin lines snap across once their strands are there, the arrow lands last
            var at = Math.min(Math.max(Pt.at, 0), 1), st0, dS, ez;
            if (Pt.kind === "strand") { st0 = t0 + at * sB * 0.45; dS = sB * 0.6; ez = "Surge"; }
            else if (Pt.kind === "line") { st0 = t0 + sB * 0.35 + at * sB * 0.5; dS = sB * 0.3; ez = "Land"; }
            else { st0 = t0 + sB * 0.75; dS = sB * 0.45; ez = "Surge"; }
            SSM.animateRaw(te, st0, st0 + dS, 0, 100, SSM.ease(ez));
            lastEnd = Math.max(lastEnd, st0 + dS);
            Bd.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([0, 0]); Bd.property("ADBE Transform Group").property("ADBE Position").setValue([CW / 2, CH / 2]);
            F.moveBefore(Bd);
            try { Bd.setTrackMatte(F, TrackMatteType.ALPHA); } catch (eM) {}
            F.enabled = false;
        }
        var M = comp.layers.add(MC); M.name = n + " mark"; M.startTime = 0;
        var MT = M.property("ADBE Transform Group");
        MT.property("ADBE Position").setValue([mx, my]);
        SSM.animate(MT.property("ADBE Scale"), t0, [k * 94, k * 94, 100], [k * 100, k * 100, 100], "Stage", "Settle");
        var tl = t0 + sB;
        MT.property("ADBE Rotate Z").expression = 'var b = Math.min(Math.max((time - ' + tl.toFixed(3) + ') / 0.8, 0), 1); value + b * 0.8 * Math.sin((time - ' + tl.toFixed(3) + ') * 1.5)';
        // grain: while the pieces are being drawn their edges dissolve into fine grain (Roughen Edges), which settles to a
        // clean edge once the last piece lands, so the build feels organic instead of a clean vector wipe
        if (o.grain !== false) {
            var RE = M.property("ADBE Effect Parade").addProperty("ADBE Roughen Edges");
            try { RE.property("ADBE Roughen Edges-0001").setValue(1); } catch (eg1) {}   // 1 = Cut: erodes the alpha only (2 adds an edge colour)
            RE.property("ADBE Roughen Edges-0003").setValue(3);
            RE.property("ADBE Roughen Edges-0004").setValue(1);
            RE.property("ADBE Roughen Edges-0005").setValue(10);   // the finest grain AE allows (10-1000)
            RE.property("ADBE Roughen Edges-0008").setValue(6);
            RE = M.property("ADBE Effect Parade").property(1);   // re-fetch after setting values
            RE.property("ADBE Roughen Edges-0009").expression = "time * 720";
            var bd = RE.property("ADBE Roughen Edges-0002"), gB = Math.max(10, mh * 0.09);
            bd.setValueAtTime(t0, gB);
            SSM.animateRaw(bd, Math.max(t0 + 0.01, lastEnd - sB * 0.35), lastEnd + sB * 0.25, gB, 0, SSM.ease("Settle"));
        }
        var layers = [M];
        // the arrow kicks forward once the strands reach it
        var tk = t0 + sB * 1.15, pos = MT.property("ADBE Position"), kick = mh * 0.04;
        SSM.animate(pos, tk, [mx, my, 0], [mx + kick, my - kick, 0], "Blink", "Launch");
        SSM.animate(pos, tk + SSM.seconds("Blink"), [mx + kick, my - kick, 0], [mx, my, 0], "Arrive", "Land");
        if (T.length) {
            // each word rises into place behind its own line mask (a matte per line, fixed in comp space)
            var y = wy, tw = t0 + sB * 0.95;
            for (var j = 0; j < T.length; j++) {
                var r = rr[j], fx = (stacked ? wx - r.width / 2 : wx) - r.left, fy = y - r.top;
                var MA = comp.layers.addShape(); MA.name = n + " matte " + (j + 1);
                MA.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([0, 0]); MA.property("ADBE Transform Group").property("ADBE Position").setValue([0, 0]);
                var slot = MA.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
                var sr = slot.addProperty("ADBE Vector Shape - Rect");
                sr.property("ADBE Vector Rect Size").setValue([r.width + ws * 2, r.height + ws * 0.1]);
                sr.property("ADBE Vector Rect Position").setValue([fx + r.left + r.width / 2, y + r.height / 2]);
                slot.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue([1, 1, 1]);
                var tp = T[j].property("ADBE Transform Group").property("ADBE Position");
                SSM.animate(tp, tw + j * 0.14, [fx, fy + r.height * 1.2, 0], [fx, fy, 0], "Sweep", "Land");
                MA.moveBefore(T[j]);
                try { T[j].setTrackMatte(MA, TrackMatteType.ALPHA); } catch (e3) {}
                MA.enabled = false;
                layers.push(T[j], MA);
                y += r.height + lineGap;
            }
            if (o.tagline) {
                var TT = text(comp, o.tagline, n, { size: ws, subSize: Math.round(ws * 0.4), fonts: o.fonts }, "text"), rt = TT.sourceRectAtTime(0, false);
                TT.name = n + " tagline";
                var ty = stacked ? y + ws * 0.35 : Math.max(my + mh / 2, y) + ws * 0.4;
                TT.property("ADBE Transform Group").property("ADBE Position").setValue([(stacked ? cx - rt.width / 2 : wx) - rt.left, ty - rt.top]);
                animateText(TT, "Words Fade Up", { t: tw + 0.5 }); layers.push(TT);
            }
        }
        return finish(comp, ctrl, layers, o);
    }

    return {
        kinds: ["label", "lower_third", "title", "underline", "highlight", "callout", "counter", "timer", "price_tag", "handle", "bubble",
                "sticker", "quote", "list", "progress", "button", "kinetic", "tiles", "text_box", "media", "scale_title", "cinematic", "chat", "rating", "ring", "end_card"],
        label: label, lowerThird: lowerThird, title: title, callout: callout, counter: counter, timer: timer, priceTag: priceTag,
        handle: handle, bubble: bubble, sticker: sticker, quote: quote, list: list, progress: progress, button: button,
        kinetic: kinetic, tiles: tiles, textbox: textbox, media: media, scaleTitle: scaleTitle, cinematic: cinematic, chat: chat, rating: rating, ring: ring, endCard: endCard,
        underline: function (comp, layerName, o) { return mark(comp, layerName, o, "underline"); },
        highlight: function (comp, layerName, o) { return mark(comp, layerName, o, "highlight"); }
    };
})();
