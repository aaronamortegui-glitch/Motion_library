// SS Text — parametric text animation per character, word or line (behavior modelled on Animation Composer's Text
// Presets: Characters / Words / Lines × Fade, Position, Scale, Rotate, Skew, Tracking, Blur, Decode, Color, Mask,
// 3D, Typewrite; ease, overshoot, flicker and wiggly variants), rebuilt from scratch on native text animators.
// Each unit follows a Motion DNA token curve inside an Expression Selector (cubic-bezier solved per unit), so Pop
// overshoots per letter and Wind-up anticipates, exactly like the rest of the library.
//
// Usage: #include "ss_text.jsx"
//        SSTX.animate(layer, {unit: "chars", channels: ["fade", "rise"], ease: "Pop", order: "forward", t: 0.5});
//        SSTX.animate(layer, {unit: "words", channels: ["decode", "fade"], mode: "flicker"});
//        SSTX.animate(layer, {unit: "lines", channels: ["rise"], mask: true});          // lines slide up from a mask
//        SSTX.typewriter(layer, {t: 0.5, cps: 18, cursor: "|"});
// Options: unit chars|words|lines · channels fade, rise, drop, slide, scale, rotate, rotate3d, skew, tracking, blur,
//          decode, color · mode ease|flicker|wiggly · order forward|reverse|center|edges|random · phase in|out|both
//          t (s) · dur (token per unit, default Arrive) · ease (curve token, default Settle in / Launch out)
//          spread (s between first and last unit, default 0.04 s × units, max 1.2) · amount (px / deg, default by channel)
//          color (hex, start colour for "color") · mask (true: clip to the text box)
var SSTX = (function () {
    var TOK = null;
    function tokens() {
        if (TOK) return TOK;
        var f = File(File($.fileName).parent.parent.fsName + "/tokens/superside_motion_tokens.json");
        f.encoding = "UTF-8"; f.open("r"); var txt = f.read(); f.close(); TOK = eval("(" + txt + ")"); return TOK;
    }
    function bezier(name) { var e = tokens().easings; for (var i = 0; i < e.length; i++) if (e[i].name.toLowerCase() === String(name).toLowerCase()) return e[i].bezier; throw new Error("Unknown curve token: " + name); }
    function seconds(name, fps) { var d = tokens().durations; for (var i = 0; i < d.length; i++) if (d[i].name.toLowerCase() === String(name).toLowerCase()) return d[i].frames / (fps || tokens().fps || 30); throw new Error("Unknown duration token: " + name); }
    function rgb(hex) { var h = String(hex).replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    var UNIT = { chars: 2, words: 3, lines: 4 };   // Based On: characters excluding spaces, words, lines
    var BZ = 'function bz(x, e) { if (x <= 0) return 0; if (x >= 1) return 1; var a = e[0], b = e[1], c = e[2], d = e[3], u = x;\n' +
             '  for (var i = 0; i < 8; i++) { var f = 3 * a * u * (1 - u) * (1 - u) + 3 * c * u * u * (1 - u) + u * u * u - x;\n' +
             '    var df = 3 * a * (1 - u) * (1 - u) + 6 * (c - a) * u * (1 - u) + 3 * (1 - c) * u * u; if (Math.abs(df) < 1e-6) break; u = Math.min(Math.max(u - f / df, 0), 1); }\n' +
             '  return 3 * b * u * (1 - u) * (1 - u) + 3 * d * u * u * (1 - u) + u * u * u; }\n';

    function orderExpr(order) {
        if (order === "reverse") return '1 - k';
        if (order === "center") return 'Math.abs(k - 0.5) * 2';
        if (order === "edges") return '1 - Math.abs(k - 0.5) * 2';
        if (order === "random") return '(function () { seedRandom(textIndex * 13 + 7, true); return random(); })()';
        return 'k';
    }
    // amount 100 = fully "off" (the animator's values apply), 0 = at rest; overshooting curves go below 0 (past rest)
    function selectorExpr(o, tIn, tOut, unitDur, spread) {
        var s = BZ + 'var n = Math.max(textTotal - 1, 1), k = (textIndex - 1) / n, ord = ' + orderExpr(o.order) + ';\n';
        var a = '';
        if (tIn !== null) {
            s += 'var pi = (time - ' + tIn + ' - ord * ' + spread + ') / ' + unitDur + ';\n';
            if (o.mode === "flicker") s += 'seedRandom(textIndex * 31 + Math.floor(time * 20), true); var ai = pi >= 1 ? 0 : (pi <= 0 ? 100 : (random() < bz(pi, ' + JSONa(o.ease || "Settle") + ') ? 0 : 100));\n';
            else s += 'var ai = (1 - bz(pi, ' + JSONa(o.ease || "Settle") + ')) * 100;\n';
            if (o.mode === "wiggly") s += 'if (pi > 0 && pi < 1.6) ai += noise([textIndex * 3.1, time * 6]) * 60 * Math.max(1 - pi / 1.6, 0);\n';
            a = 'ai';
        }
        if (tOut !== null) {
            s += 'var po = (time - ' + tOut + ' - ord * ' + spread + ') / ' + unitDur + ';\n';
            if (o.mode === "flicker") s += 'seedRandom(textIndex * 37 + Math.floor(time * 20), true); var ao = po <= 0 ? 0 : (po >= 1 ? 100 : (random() < bz(po, ' + JSONa(o.easeOut || "Launch") + ') ? 100 : 0));\n';
            else s += 'var ao = bz(po, ' + JSONa(o.easeOut || "Launch") + ') * 100;\n';
            a = a ? '(time < ' + tOut + ' ? ' + a + ' : Math.max(' + a + ', ao))' : 'ao';
        }
        return s + a + ';';
    }
    function JSONa(name) { return '[' + bezier(name).join(", ") + ']'; }

    function animate(L, o) {
        o = o || {};
        if (!(L instanceof TextLayer)) throw new Error(L.name + " is not a text layer");
        var comp = L.containingComp, fps = 1 / comp.frameDuration, phase = o.phase || "in";
        var chans = o.channels || ["fade", "rise"], size = 60;
        try { size = L.property("ADBE Text Properties").property("ADBE Text Document").value.fontSize; } catch (e) {}
        var unitDur = o.duration || seconds(o.dur || "Arrive", fps);
        var units = 10;
        try { var txt = L.property("ADBE Text Properties").property("ADBE Text Document").value.text;
              if (o.unit === "words") units = txt.split(/\s+/).length;   // explicit ifs: chained ternaries misbehave in ExtendScript
              else if (o.unit === "lines") units = txt.split(/[\r\n]+/).length;
              else units = txt.replace(/\s/g, "").length; } catch (e2) {}
        var per = 1; if (o.unit === "lines") per = 3; else if (o.unit === "words") per = 2;
        var spread = o.spread === undefined ? Math.min(0.04 * Math.max(units - 1, 1) * per, 1.2) : o.spread;
        var tIn = null, tOut = null, t = o.t === undefined ? L.inPoint : o.t;
        if (phase === "in" || phase === "both") tIn = t;
        if (phase === "out") tOut = t;
        if (phase === "both") tOut = o.out === undefined ? L.outPoint - unitDur - spread : o.out;

        var anims = L.property("ADBE Text Properties").property("ADBE Text Animators");
        var A = anims.addProperty("ADBE Text Animator"); A.name = "SS Text · " + (o.unit || "chars") + " " + chans.join("+");
        var idx = A.propertyIndex;
        function animator() { return L.property("ADBE Text Properties").property("ADBE Text Animators").property(idx); }   // re-fetched: adding properties invalidates references
        var amt = o.amount;
        for (var i = 0; i < chans.length; i++) {
            var c = chans[i], P = animator().property("ADBE Text Animator Properties");
            if (c === "fade") P.addProperty("ADBE Text Opacity").setValue(0);
            else if (c === "rise") P.addProperty("ADBE Text Position 3D").setValue([0, amt || size * 0.9, 0]);
            else if (c === "drop") P.addProperty("ADBE Text Position 3D").setValue([0, -(amt || size * 0.9), 0]);
            else if (c === "slide") P.addProperty("ADBE Text Position 3D").setValue([amt || size * 1.2, 0, 0]);
            else if (c === "scale") P.addProperty("ADBE Text Scale 3D").setValue([0, 0, 100]);
            else if (c === "rotate") P.addProperty("ADBE Text Rotation").setValue(amt || -40);
            else if (c === "rotate3d") { try { L.threeDLayer = true; L.threeDPerChar = true; } catch (e3) {} animator().property("ADBE Text Animator Properties").addProperty("ADBE Text Rotation X").setValue(amt || 90); }
            else if (c === "skew") P.addProperty("ADBE Text Skew").setValue(amt || 30);
            else if (c === "tracking") P.addProperty("ADBE Text Tracking Amount").setValue(amt || size * 0.5);
            else if (c === "blur") P.addProperty("ADBE Text Blur").setValue([amt || size * 0.25, amt || size * 0.25]);
            else if (c === "decode") {
                var co = P.addProperty("ADBE Text Character Offset");
                co.expression = 'seedRandom(Math.floor(time * 15), false); Math.round(random(-26, 26));';
            }
            else if (c === "color") animator().property("ADBE Text Animator Properties").addProperty("ADBE Text Fill Color").setValue(rgb(o.color || "#D8FF85"));
            else throw new Error("Unknown text channel: " + c);
        }
        var sel = animator().property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
        sel = animator().property("ADBE Text Selectors").property(1);
        try { sel.property("ADBE Text Range Type2").setValue(UNIT[o.unit || "chars"] || 2); } catch (e4) {}
        sel.property("ADBE Text Expressible Amount").expression = selectorExpr(o, tIn, tOut, unitDur, spread);

        if (o.mask) {   // clip to the text box at rest: units sliding in from below appear from a line
            var r = L.sourceRectAtTime(t + unitDur + spread + 0.5, false), pad = size * 0.15;
            var m = L.property("ADBE Mask Parade").addProperty("ADBE Mask Atom"), s = new Shape();
            s.vertices = [[r.left - pad * 4, r.top - pad], [r.left + r.width + pad * 4, r.top - pad], [r.left + r.width + pad * 4, r.top + r.height + pad], [r.left - pad * 4, r.top + r.height + pad]];
            s.closed = true; m.property("ADBE Mask Shape").setValue(s); m.name = "SS Text Mask";
        }
        L.comment = (L.comment ? L.comment + " | " : "") + "SS text: " + (o.unit || "chars") + " " + chans.join("+") + " (" + (o.mode || "ease") + ", " + phase + ")";
        return L.name + ": " + A.name;
    }

    // Typewriter: characters appear at `cps` per second, with a blinking cursor while typing and after.
    function typewriter(L, o) {
        o = o || {};
        var t = o.t === undefined ? L.inPoint : o.t, cps = o.cps || 18, cur = o.cursor === undefined ? "|" : o.cursor;
        L.property("ADBE Text Properties").property("ADBE Text Document").expression =
            'var t0 = ' + t + ', n = Math.max(Math.floor((time - t0) * ' + cps + '), 0), full = (value.text === undefined) ? value.toString() : value.text;\n' +
            'var shown = full.substr(0, n), blink = Math.floor(time * 2.2) % 2 === 0 || n < full.length;\n' +
            (cur ? 'shown + (blink && time >= t0 ? ' + '"' + cur + '"' + ' : "");' : 'shown;');
        L.comment = (L.comment ? L.comment + " | " : "") + "SS text: typewriter " + cps + " cps";
        return L.name + ": typewriter";
    }

    // Captions from word timings [{w, s, e}] (tools/vo_words.py) or cues: lines grouped by length and pauses, one text
    // layer per line. style: highlight (the spoken word in the accent colour) | karaoke (spoken words stay coloured)
    // | build (words appear as spoken) | pop (the spoken word grows and takes the accent) | word (one word at a time).
    function captions(comp, words, o) {
        o = o || {};
        var W = comp.width, H = comp.height, size = o.size || Math.round(H * 0.055), maxChars = o.maxChars || 30, style = o.style || "highlight";
        var pos = o.position || [W / 2, Math.round(H * 0.84)], c = o.colors || {};
        var lines = [], cur = [], len = 0;
        for (var i = 0; i < words.length; i++) {
            var w = words[i], gap = cur.length ? w.s - cur[cur.length - 1].e : 0;
            if (cur.length && (len + w.w.length + 1 > maxChars || gap > (o.pause || 0.6))) { lines.push(cur); cur = []; len = 0; }
            cur.push(w); len += w.w.length + 1;
        }
        if (cur.length) lines.push(cur);
        var made = [];
        for (var l = 0; l < lines.length; l++) {
            var ln = lines[l], txt = [], starts = [], ends = [];
            for (var j = 0; j < ln.length; j++) { txt.push(ln[j].w); starts.push(ln[j].s); ends.push(j + 1 < ln.length ? ln[j + 1].s : ln[j].e); }
            var T = comp.layers.addText(txt.join(" ")), pp = T.property("ADBE Text Properties").property("ADBE Text Document"), d = pp.value;
            d.resetCharStyle(); d.fontSize = size; d.applyFill = true; d.fillColor = rgb(c.text || "#FFFFFF");
            try { d.font = o.font || "Arial-BoldMT"; } catch (e0) {}
            d.applyStroke = !!o.stroke; if (o.stroke) { d.strokeColor = rgb(c.stroke || "#000000"); d.strokeWidth = Math.round(size * 0.12); d.strokeOverFill = false; }
            d.justification = ParagraphJustification.CENTER_JUSTIFY; pp.setValue(d);
            T.name = "CAP · " + (l + 1) + " " + txt.join(" ").substr(0, 24);
            var r = T.sourceRectAtTime(0, false);
            T.property("ADBE Transform Group").property("ADBE Position").setValue([pos[0], pos[1] - r.top - r.height / 2]);
            T.inPoint = ln[0].s; T.outPoint = l + 1 < lines.length ? Math.min(lines[l + 1][0].s, ln[ln.length - 1].e + 0.6) : ln[ln.length - 1].e + 0.6;
            var S = '[' + starts.join(",") + ']', E = '[' + ends.join(",") + ']';
            var idx = 'var S = ' + S + ', E = ' + E + ', cur = -1; for (var q = 0; q < S.length; q++) if (time >= S[q]) cur = q;\n';
            if (style === "word") {
                pp.expression = idx + 'cur < 0 ? "" : ' + JSON_ARR(txt) + '[cur];';
            } else {
                var A = T.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator"); A.name = "SS Caption " + style;
                var ai = A.propertyIndex;
                var An = function () { return T.property("ADBE Text Properties").property("ADBE Text Animators").property(ai); };
                if (style === "build") An().property("ADBE Text Animator Properties").addProperty("ADBE Text Opacity").setValue(0);
                else {
                    An().property("ADBE Text Animator Properties").addProperty("ADBE Text Fill Color").setValue(rgb(c.accent || "#D8FF85"));
                    if (style === "pop") An().property("ADBE Text Animator Properties").addProperty("ADBE Text Scale 3D").setValue([118, 118, 100]);
                }
                An().property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
                var sel = An().property("ADBE Text Selectors").property(1);
                try { sel.property("ADBE Text Range Type2").setValue(3); } catch (e1) {}   // words
                var rule = 'i === cur ? 100 : 0';   // amount 100 = the animator applies (hidden for build, accent for the others)
                if (style === "build") rule = 'i > cur ? 100 : 0'; else if (style === "karaoke") rule = 'i <= cur ? 100 : 0';
                sel.property("ADBE Text Expressible Amount").expression = idx + 'var i = textIndex - 1; ' + rule + ';';
            }
            if (o.box) {   // a box behind the line, from the line's own bounds
                var B = comp.layers.addShape(); B.name = T.name + " box";
                B.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([0, 0]); B.property("ADBE Transform Group").property("ADBE Position").setValue([0, 0]);
                var gv = B.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
                var rc = gv.addProperty("ADBE Vector Shape - Rect"), ex = 'var L = thisComp.layer(' + '"' + T.name.replace(/"/g, '\\"') + '"' + '), r = L.sourceRectAtTime(L.outPoint - 0.05, false), a = L.toComp([r.left, r.top]), b = L.toComp([r.left + r.width, r.top + r.height]);\n';
                rc.property("ADBE Vector Rect Size").expression = ex + '[b[0] - a[0] + ' + size * 0.8 + ', b[1] - a[1] + ' + size * 0.45 + '];';
                rc.property("ADBE Vector Rect Position").expression = ex + '[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];';
                rc.property("ADBE Vector Rect Roundness").setValue(size * 0.25);
                gv.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(rgb(c.box || "#000000"));
                B.property("ADBE Transform Group").property("ADBE Opacity").setValue(o.boxOpacity || 70);
                B.inPoint = T.inPoint; B.outPoint = T.outPoint; B.moveAfter(T); made.push(B);
            }
            made.push(T);
        }
        return lines.length + " caption lines (" + style + ")";
    }
    function JSON_ARR(a) { var o = []; for (var i = 0; i < a.length; i++) o.push('"' + String(a[i]).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'); return "[" + o.join(",") + "]"; }
    return { animate: animate, typewriter: typewriter, captions: captions, channels: ["fade", "rise", "drop", "slide", "scale", "rotate", "rotate3d", "skew", "tracking", "blur", "decode", "color"] };
})();
