// 04_Text_Tracking_70s: pruebas de animación de texto (fijo y trackeado) sobre el video AI.
#include "ss_presets.jsx"
var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    var ROOT = SS_ROOT + "/";
    var PAL = SSM.readJSON(ROOT + "assets/figma_essentials/palette.json").colors;
    var TRK = SSM.readJSON(ROOT + "media/tracks.json");
    var SERIF = "Georgia", SANS = "Arial-BoldMT", SANS_R = "ArialMT";
    function hex(h) { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
    function tr(L, p) { return L.property("ADBE Transform Group").property(p); }
    var proj = app.project;
    function findItem(name) { for (var i = 1; i <= proj.numItems; i++) if (proj.item(i).name === name) return proj.item(i); return null; }

    var old = findItem("04_Text_Tracking_70s");
    if (old) old.remove();
    var vid = findItem("aaron_70s_handheld.mp4") || proj.importFile(new ImportOptions(new File(ROOT + "media/aaron_70s_handheld.mp4")));
    var c = proj.items.addComp("04_Text_Tracking_70s", TRK.size[0], TRK.size[1], 1, vid.duration, TRK.fps);
    var folder = findItem("SS Motion Lab");
    if (folder) c.parentFolder = folder;
    c.layers.add(vid).name = "Plate · Aaron 70s";

    // Nulls de tracking
    var N = {}, fd = 1 / TRK.fps;
    for (var name in TRK.tracks) {
        if (!TRK.tracks.hasOwnProperty(name)) continue;
        var tk = TRK.tracks[name], L = c.layers.addNull();
        L.name = "TRK " + name; L.label = 9; L.enabled = false;
        tr(L, "ADBE Anchor Point").setValue([50, 50]);
        var ts = [], ps = [], sc = [], rt = [];
        for (var f = 0; f < tk.pos.length; f++) { ts.push(f * fd); ps.push(tk.pos[f]); sc.push([tk.scale[f] * 100, tk.scale[f] * 100]); rt.push(tk.rot[f]); }
        tr(L, "ADBE Position").setValuesAtTimes(ts, ps);
        tr(L, "ADBE Scale").setValuesAtTimes(ts, sc);
        tr(L, "ADBE Rotate Z").setValuesAtTimes(ts, rt);
        N[name] = L;
    }

    function text(name, str, font, size, col, just, tracking) {
        var L = c.layers.addText(str);
        L.name = name;
        var tp = L.property("ADBE Text Properties").property("ADBE Text Document"), td = tp.value;
        td.resetCharStyle(); td.font = font; td.fontSize = size; td.fillColor = hex(col); td.applyFill = true;
        td.justification = just || ParagraphJustification.LEFT_JUSTIFY;
        if (tracking) td.tracking = tracking;
        tp.setValue(td);
        return L;
    }
    function pill(name, w, h, col) {
        var L = c.layers.addShape(); L.name = name;
        var v = L.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group").property("ADBE Vectors Group");
        var r = v.addProperty("ADBE Vector Shape - Rect"); r.property("ADBE Vector Rect Size").setValue([w, h]); r.property("ADBE Vector Rect Roundness").setValue(h / 2);
        v.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color").setValue(hex(col));
        return L;
    }
    // pega una capa a un null conservando un offset (en coords del null)
    function stick(L, nullName, dx, dy) { L.parent = N[nullName]; tr(L, "ADBE Position").setValue([50 + dx, 50 + dy]); }

    var log = [];
    // a) Kicker fijo — Tracking Settle
    var kick = text("Kicker", "SUPERSIDE MOTION LAB", SANS, 30, PAL.spark, null, 200);
    tr(kick, "ADBE Position").setValue([110, 110]);
    SSP.applyText(kick, "Tracking Settle", "in", 0.2);

    // b) Título en la escena (pegado al papel tapiz → parallax de fondo) — Chars Rise
    var title = text("Title (wallpaper)", "Aaron, 1974", SERIF, 92, PAL.cloud);
    stick(title, "wallpaper", 40, 300);
    SSP.applyText(title, "Chars Rise", "in", 0.5);

    // c) Etiqueta en la cara — Chars Pop + chip
    var faceChip = pill("Face chip", 260, 58, PAL.cloud);
    var faceTxt = text("Face label", "The host", SANS, 30, PAL.pine, ParagraphJustification.CENTER_JUSTIFY);
    faceTxt.parent = faceChip; tr(faceTxt, "ADBE Position").setValue([0, 10]);
    stick(faceChip, "face", 230, -250);
    SSP.apply(faceChip, "Scale Pop", "in", 1.0);
    SSP.applyText(faceTxt, "Chars Pop", "in", 1.1);

    // d) ON AIR en el micrófono — Scale Pop + Pulse
    var air = pill("On air chip", 170, 50, PAL.coral);
    var airTxt = text("On air", "ON AIR", SANS, 26, PAL.pine, ParagraphJustification.CENTER_JUSTIFY, 80);
    airTxt.parent = air; tr(airTxt, "ADBE Position").setValue([0, 9]);
    stick(air, "mic_head", 40, -150);
    SSP.apply(air, "Scale Pop", "in", 1.4);
    SSP.applyFx(air, "Pulse");

    // e) Lower third fijo — Wipe Reveal + Words Fade Up
    var bar = pill("Lower third bar", 760, 96, PAL.pine);
    tr(bar, "ADBE Position").setValue([110 + 380, 900]);
    SSP.apply(bar, "Wipe Reveal", "in", 1.8);
    var lt1 = text("Lower third name", "Aaron Amortegui", SANS, 40, PAL.cloud);
    tr(lt1, "ADBE Position").setValue([150, 895]);
    SSP.applyText(lt1, "Words Fade Up", "in", 2.1);
    var lt2 = text("Lower third role", "Motion · AI Native Studio", SANS_R, 26, PAL.spark);
    tr(lt2, "ADBE Position").setValue([150, 935]);
    SSP.applyText(lt2, "Words Fade Up", "in", 2.3);

    // f) Subtítulo — Blur Words, centrado abajo
    var sub = text("Caption", "Tracking test: text that lives inside the shot", SANS_R, 34, PAL.cloud, ParagraphJustification.CENTER_JUSTIFY);
    tr(sub, "ADBE Position").setValue([c.width / 2, 1020]);
    SSP.applyText(sub, "Blur Words", "in", 3.0);

    // g) Textura: grano y light leak de los asset packs de Animation Composer
    var AC = $.getenv("LOCALAPPDATA").split("\\").join("/") + "/MisterHorse/ProductManager/AssetPacks/";
    function pack(dir, mask, mode, op, nm) {
        var hits = Folder(AC + dir).getFiles(mask);
        if (!hits.length) { log.push("sin asset " + mask); return; }
        var it = findItem(hits[0].displayName) || proj.importFile(new ImportOptions(hits[0]));
        it.mainSource.loop = 10;
        var L = c.layers.add(it); L.name = nm; L.blendingMode = mode;
        tr(L, "ADBE Opacity").setValue(op);
        var k = Math.max(c.width / it.width, c.height / it.height) * 100; tr(L, "ADBE Scale").setValue([k, k, 100]);
        L.outPoint = c.duration;
    }
    pack("178fd44c06a96db4cd0c3d15eb6c50b158d26ee0f02fc060b2a7a4e2d248a1e1", "Grain Footage 01*", BlendingMode.OVERLAY, 55, "AC · Grain");
    pack("a2dd4f536b07842f43fa68ea010305d7c37404e8ba49388105978cc3baf4fab0", "Light Leak 006*", BlendingMode.SCREEN, 35, "AC · Light Leak");

    proj.save();
    return "04 ok " + log.join("; ");
})();
