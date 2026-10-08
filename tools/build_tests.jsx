// Construye el proyecto de pruebas: ícono Superside, tracking 70s y componentes del Figma.
// Ejecutar con: AfterFX.exe -s "$.evalFile(SS_ROOT + '/tools/build_tests.jsx')"
#include "ss_motion_lib.jsx"

var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
  try {
    var ROOT = SS_ROOT + "/";
    var AC_PACKS = $.getenv("LOCALAPPDATA").split("\\").join("/") + "/MisterHorse/ProductManager/AssetPacks/";
    var LOG = [];
    function log(s) { LOG.push(s); }

    SSM.load(ROOT + "tokens/superside_motion_tokens.json");
    var PAL = SSM.readJSON(ROOT + "assets/figma_essentials/palette.json").colors;
    var ICON = SSM.readJSON(ROOT + "assets/superside/ss_icon_shape.json");
    var TRK = SSM.readJSON(ROOT + "media/tracks.json");
    var SERIF = "Georgia", SANS = "Arial-BoldMT"; // fallback: Instrument Serif / Inter Tight no instaladas

    function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function sec(name) { return SSM.seconds(name); }

    app.beginUndoGroup("SS motion tests");
    app.newProject();
    app.project.expressionEngine = "javascript-1.0";
    var folder = app.project.items.addFolder("SS Motion Lab");

    // ---------- helpers ----------
    function solid(comp, name, color) {
        var s = comp.layers.addSolid(hex(color), name, comp.width, comp.height, 1);
        return s;
    }
    function iconShape(comp, name, fillHex, strokeHex, strokeW, groupScale) {
        var L = comp.layers.addShape();
        L.name = name;
        var grp = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        grp.name = "S-mark";
        if (groupScale) grp.property("ADBE Vector Transform Group").property("ADBE Vector Scale").setValue([groupScale, groupScale]);
        var vecs = grp.property("ADBE Vectors Group");
        for (var p = 0; p < ICON.paths.length; p++) {
            var P = ICON.paths[p];
            var sh = new Shape();
            sh.vertices = P.v; sh.inTangents = P.i; sh.outTangents = P.o; sh.closed = P.closed;
            vecs.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(sh);
        }
        if (strokeHex) {
            var st = vecs.addProperty("ADBE Vector Graphic - Stroke");
            st.property("ADBE Vector Stroke Color").setValue(hex(strokeHex));
            st.property("ADBE Vector Stroke Width").setValue(strokeW || 6);
            st.property("ADBE Vector Stroke Line Join").setValue(2);
        }
        if (fillHex) {
            var fl = vecs.addProperty("ADBE Vector Graphic - Fill");
            fl.property("ADBE Vector Fill Color").setValue(hex(fillHex));
        }
        return L;
    }
    function pill(comp, name, w, h, fillHex, strokeHex) {
        var L = comp.layers.addShape();
        L.name = name;
        var grp = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        var vecs = grp.property("ADBE Vectors Group");
        var r = vecs.addProperty("ADBE Vector Shape - Rect");
        r.property("ADBE Vector Rect Size").setValue([w, h]);
        r.property("ADBE Vector Rect Roundness").setValue(Math.min(h / 2, 24));
        if (fillHex) vecs.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(fillHex));
        if (strokeHex) {
            var st = vecs.addProperty("ADBE Vector Graphic - Stroke");
            st.property("ADBE Vector Stroke Color").setValue(hex(strokeHex));
            st.property("ADBE Vector Stroke Width").setValue(3);
        }
        return L;
    }
    function text(comp, name, str, font, size, colorHex, justify) {
        var L = comp.layers.addText(str);
        L.name = name;
        var tp = L.property("ADBE Text Properties").property("ADBE Text Document");
        var td = tp.value;
        td.resetCharStyle();
        td.font = font; td.fontSize = size; td.fillColor = hex(colorHex); td.applyFill = true;
        td.justification = justify || ParagraphJustification.LEFT_JUSTIFY;
        tp.setValue(td);
        return L;
    }
    function centerAnchor(L) {
        var r = L.sourceRectAtTime(0, false);
        L.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([r.left + r.width / 2, r.top + r.height / 2]);
    }
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }

    // =========================================================
    // 01 · Ícono Superside — draw-on de línea + Pop + salida
    // =========================================================
    var c1 = app.project.items.addComp("01_SS_Icon_Intro", 1920, 1080, 1, 3.5, 30);
    c1.parentFolder = folder;
    solid(c1, "BG Pine", PAL.pine);
    var line = iconShape(c1, "S-mark line", null, PAL.spark, 8, 70);
    var fill = iconShape(c1, "S-mark fill", PAL.spark, null, 0, 70);
    var eyebrow = text(c1, "Eyebrow", "Superside motion lab", SANS, 34, PAL.spark, ParagraphJustification.CENTER_JUSTIFY);
    tr(eyebrow, "ADBE Position").setValue([960, 900]);
    var trim = line.property("ADBE Root Vectors Group").addProperty("ADBE Vector Filter - Trim");
    var t = 0.2;
    // Línea: se dibuja en Sweep con Cruise
    var tEnd = SSM.animate(trim.property("ADBE Vector Trim End"), t, 0, 100, "Sweep", "Cruise");
    SSM.animate(trim.property("ADBE Vector Trim Offset"), t, -40, 0, "Sweep", "Cruise");
    // Relleno: entra con Pop al terminar la línea; opacidad Blink/Flat
    SSM.animate(tr(fill, "ADBE Scale"), tEnd - sec("Glide"), [0, 0, 100], [100, 100, 100], "Arrive", "Pop");
    SSM.animate(tr(fill, "ADBE Opacity"), tEnd - sec("Glide"), 0, 100, "Blink", "Flat");
    SSM.animate(tr(line, "ADBE Opacity"), tEnd, 100, 0, "Blink", "Flat");
    // Eyebrow: sube con Land, escalonado un Tick
    var tE = tEnd + sec("Tick");
    SSM.animate(tr(eyebrow, "ADBE Position"), tE, [960, 940], [960, 900], "Arrive", "Land");
    SSM.animate(tr(eyebrow, "ADBE Opacity"), tE, 0, 100, "Blink", "Flat");
    // Salida encadenada: Launch
    var tOut = 2.7;
    SSM.animate(tr(fill, "ADBE Scale"), tOut, [100, 100, 100], [0, 0, 100], "Glide", "Launch");
    SSM.animate(tr(eyebrow, "ADBE Opacity"), tOut, 100, 0, "Blink", "Flat");
    log("01 ok — draw-on termina en " + tEnd.toFixed(2) + "s");

    // =========================================================
    // 02 · Tracking sobre video 70s
    // =========================================================
    var vid = app.project.importFile(new ImportOptions(new File(ROOT + "media/aaron_70s_handheld.mp4")));
    vid.parentFolder = folder;
    var c2 = app.project.items.addComp("02_Track_70s", TRK.size[0], TRK.size[1], 1, vid.duration, TRK.fps);
    c2.parentFolder = folder;
    c2.layers.add(vid).name = "Plate · Aaron 70s";
    var fd = 1 / TRK.fps;
    var nulls = {};
    for (var name in TRK.tracks) {
        if (!TRK.tracks.hasOwnProperty(name)) continue;
        var tk = TRK.tracks[name];
        var N = c2.layers.addNull();
        N.name = "TRK " + name;
        N.label = 9;
        tr(N, "ADBE Anchor Point").setValue([50, 50]); // null de 100x100: anchor al centro
        var times = [], vals = [], sc = [], rt = [];
        for (var f = 0; f < tk.pos.length; f++) {
            times.push(f * fd); vals.push(tk.pos[f]);
            sc.push([tk.scale[f] * 100, tk.scale[f] * 100]); rt.push(tk.rot[f]);
        }
        tr(N, "ADBE Position").setValuesAtTimes(times, vals);
        tr(N, "ADBE Scale").setValuesAtTimes(times, sc);
        tr(N, "ADBE Rotate Z").setValuesAtTimes(times, rt);
        var minC = 1;
        for (var q = 0; q < tk.confidence.length; q++) minC = Math.min(minC, tk.confidence[q]);
        N.comment = "confidence_min=" + minC;
        nulls[name] = { layer: N, conf: minC };
    }
    // Anillos en cada punto (Coral si el track es poco confiable)
    var ringOrder = ["face", "mic_head", "mic_joint", "lapel", "wallpaper", "lamp"];
    for (var i = 0; i < ringOrder.length; i++) {
        var nm = ringOrder[i];
        var ok = nulls[nm].conf >= 0.3;
        var R = c2.layers.addShape();
        R.name = "Ring " + nm + (ok ? "" : " (track débil)");
        var g = R.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        g.addProperty("ADBE Vector Shape - Ellipse").property("ADBE Vector Ellipse Size").setValue([44, 44]);
        var st = g.addProperty("ADBE Vector Graphic - Stroke");
        st.property("ADBE Vector Stroke Color").setValue(hex(ok ? PAL.spark : PAL.coral));
        st.property("ADBE Vector Stroke Width").setValue(4);
        tr(R, "ADBE Position").expression = 'thisComp.layer("TRK ' + nm + '").transform.position';
        SSM.animate(tr(R, "ADBE Scale"), 0.3 + i * sec("Tick"), [0, 0, 100], [100, 100, 100], "Arrive", "Pop");
    }
    // Líneas tipo constelación entre puntos trackeados (path por expresión)
    var lines = c2.layers.addShape();
    lines.name = "Constellation lines";
    tr(lines, "ADBE Position").setValue([0, 0]);
    var lg = lines.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
    var chain = ["wallpaper", "face", "mic_head", "mic_joint"];
    var pathProp = lg.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape");
    var pts = [];
    for (var c = 0; c < chain.length; c++) pts.push('thisComp.layer("TRK ' + chain[c] + '").transform.position');
    pathProp.expression = "createPath([" + pts.join(",") + "], [], [], false);";
    var branch = lg.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape");
    branch.expression = 'createPath([thisComp.layer("TRK face").transform.position, thisComp.layer("TRK lapel").transform.position], [], [], false);';
    var ls = lg.addProperty("ADBE Vector Graphic - Stroke");
    ls.property("ADBE Vector Stroke Color").setValue(hex(PAL.spark));
    ls.property("ADBE Vector Stroke Width").setValue(3);
    var ltrim = lines.property("ADBE Root Vectors Group").addProperty("ADBE Vector Filter - Trim");
    SSM.animate(ltrim.property("ADBE Vector Trim End"), 0.5, 0, 100, "Sweep", "Cruise");
    // Callout chip pegado a la cara
    var chip = pill(c2, "Callout chip", 300, 60, PAL.cloud, null);
    var chipTxt = text(c2, "Callout text", "Aaron · 1974", SANS, 30, PAL.pine, ParagraphJustification.CENTER_JUSTIFY);
    chipTxt.parent = chip;
    tr(chipTxt, "ADBE Position").setValue([0, 10]);
    tr(chip, "ADBE Position").expression = 'thisComp.layer("TRK face").transform.position + [-330, -170]';
    SSM.animate(tr(chip, "ADBE Scale"), 1.1, [0, 0, 100], [100, 100, 100], "Arrive", "Pop");
    var leader = c2.layers.addShape();
    leader.name = "Callout leader";
    tr(leader, "ADBE Position").setValue([0, 0]);
    var ld = leader.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
    ld.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").expression =
        'var a = thisComp.layer("TRK face").transform.position; createPath([a, a + [-200, -140]], [], [], false);';
    var lds = ld.addProperty("ADBE Vector Graphic - Stroke");
    lds.property("ADBE Vector Stroke Color").setValue(hex(PAL.cloud));
    lds.property("ADBE Vector Stroke Width").setValue(3);
    var ldt = leader.property("ADBE Root Vectors Group").addProperty("ADBE Vector Filter - Trim");
    SSM.animate(ldt.property("ADBE Vector Trim End"), 0.9, 0, 100, "Glide", "Settle");
    // S-mark pegado al papel tapiz (prueba de fondo con parallax)
    var mini = iconShape(c2, "S-mark on wallpaper", PAL.spark, null);
    mini.parent = nulls.wallpaper.layer;
    tr(mini, "ADBE Position").setValue([50, 230]);
    SSM.animate(tr(mini, "ADBE Scale"), 0.6, [0, 0, 100], [12, 12, 100], "Arrive", "Pop");
    // Recursos del plugin: grano y light leak de los asset packs de Animation Composer
    function addPack(rel, mode, opac, nameL) {
        // "#" en el nombre rompe new File(): buscar por máscara dentro de la carpeta del pack
        var parts = rel.split("/");
        var hits = Folder(AC_PACKS + parts[0]).getFiles(parts[1].split(" #")[0] + "*");
        var f = hits.length ? hits[0] : null;
        if (!f || !f.exists) { log("asset no encontrado: " + rel); return; }
        var it = app.project.importFile(new ImportOptions(f));
        it.parentFolder = folder;
        it.mainSource.loop = 10;
        var L = c2.layers.add(it);
        L.name = nameL;
        L.blendingMode = mode;
        tr(L, "ADBE Opacity").setValue(opac);
        var s = Math.max(c2.width / it.width, c2.height / it.height) * 100;
        tr(L, "ADBE Scale").setValue([s, s, 100]);
        L.outPoint = c2.duration;
        return L;
    }
    addPack("178fd44c06a96db4cd0c3d15eb6c50b158d26ee0f02fc060b2a7a4e2d248a1e1/Grain Footage 01 #d7e53ec8.mp4", BlendingMode.OVERLAY, 60, "AC · Grain Footage 01");
    addPack("a2dd4f536b07842f43fa68ea010305d7c37404e8ba49388105978cc3baf4fab0/Light Leak 006 #28e4d3e3.mp4", BlendingMode.SCREEN, 45, "AC · Light Leak 006");
    log("02 ok — " + ringOrder.length + " tracks");

    // =========================================================
    // 03 · Componentes del Figma animados con tokens
    // =========================================================
    var c3 = app.project.items.addComp("03_Figma_Chips", 1920, 1080, 1, 4, 30);
    c3.parentFolder = folder;
    solid(c3, "BG Pine", PAL.pine);
    var eb = text(c3, "Eyebrow", "01 · The problem", SANS, 26, PAL.spark);
    tr(eb, "ADBE Position").setValue([120, 120]);
    SSM.animate(tr(eb, "ADBE Opacity"), 0.1, 0, 100, "Blink", "Flat");
    var head = text(c3, "Headline", "What does it take to shoot\rthousands of product images?", SERIF, 66, PAL.cloud);
    tr(head, "ADBE Position").setValue([120, 270]);
    SSM.animate(tr(head, "ADBE Position"), 0.2, [120, 330], [120, 270], "Arrive", "Land");
    SSM.animate(tr(head, "ADBE Opacity"), 0.2, 0, 100, "Blink", "Flat");
    var chips = [["Studio", 128, 120, 620], ["Photographers", 227, 262, 620], ["Models", 139, 503, 620],
                 ["Weeks of planning", 268, 120, 700], ["Stylists", 138, 402, 700], ["Budget per SKU", 238, 120, 780]];
    for (var k = 0; k < chips.length; k++) {
        var C = chips[k];
        var coral = C[0] === "Budget per SKU";
        var P = pill(c3, "Chip · " + C[0], C[1], 55, coral ? PAL.coral : PAL.cloud, null);
        var T = text(c3, "Chip text · " + C[0], C[0], SANS, 26, PAL.pine, ParagraphJustification.CENTER_JUSTIFY);
        T.parent = P;
        tr(T, "ADBE Position").setValue([0, 9]);
        var pos = [C[2] + C[1] / 2, C[3] + 27.5];
        tr(P, "ADBE Position").setValue(pos);
        var t0 = 0.8 + k * sec("Tick"); // stagger = Tick
        SSM.animate(tr(P, "ADBE Scale"), t0, [0, 0, 100], [100, 100, 100], "Arrive", coral ? "Pop" : "Land");
        SSM.animate(tr(P, "ADBE Opacity"), t0, 0, 100, "Blink", "Flat");
    }
    var card = pill(c3, "Image frame", 640, 400, PAL.sea, null);
    tr(card, "ADBE Position").setValue([1470, 320]);
    SSM.animate(tr(card, "ADBE Position"), 0.4, [2300, 320], [1470, 320], "Stage", "Land");
    var card2 = pill(c3, "Image frame 2", 640, 400, PAL.sea, null);
    tr(card2, "ADBE Position").setValue([1470, 740]);
    SSM.animate(tr(card2, "ADBE Position"), 0.4 + sec("Glide"), [2300, 740], [1470, 740], "Stage", "Land");
    var foot = text(c3, "Footer", "Superside Essentials · AI fashion imagery at scale", "ArialMT", 20, PAL.grey);
    tr(foot, "ADBE Position").setValue([120, 1030]);
    log("03 ok");

    app.endUndoGroup();
    var out = new File(ROOT + "ae/motion_lab_v01.aep");
    Folder(ROOT + "ae").create();
    app.project.save(out);
    c2.openInViewer();
    var lf = new File(ROOT + "research/build_log.txt");
    lf.open("w"); lf.write(LOG.join("\n") + "\nsaved: " + out.fsName); lf.close();
    return "saved: " + out.fsName + "\n" + LOG.join("\n");
  } catch (err) {
    var ef = new File(SS_ROOT + "/research/build_log.txt");
    ef.open("w"); ef.write("ERROR line " + err.line + ": " + err.toString() + "\n" + LOG.join("\n")); ef.close();
    throw err;
  }
})();
