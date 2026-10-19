// Kit demo for Cavalry: a short comp that uses several Motion DNA kit pieces (MDNA.kit) together:
// a photo-like card with Blur In, a title with Chars Rise, a Counter, a chip with a Float loop and a Bars Transition
// to a second scene. Run in Cavalry's JavaScript Editor or through Cavalry's MCP server (execute_script).
// Everything it makes is listed in the comp's user data ("mdnaKitDemo"); run it again with DEMO_MODE = "clean" to remove it.
// Snapshots for the docs go to research/platforms/cavalry/out/ (written by the caller, e.g. the MCP snapshot_layer tool).
var DEMO_ROOT = typeof DEMO_ROOT !== "undefined" ? DEMO_ROOT : "D:/motion category ai library - platforms";   // this clone
var DEMO_MODE = typeof DEMO_MODE !== "undefined" ? DEMO_MODE : "build";
api.load(DEMO_ROOT + "/research/platforms/cavalry/mdna_cavalry.js");
MDNA.init(DEMO_ROOT);

(function () {
    var comp = api.getActiveComp(), old = [];
    try { if (api.hasUserDataKey(comp, "mdnaKitDemo")) old = api.getUserDataKey(comp, "mdnaKitDemo") || []; } catch (e) {}
    var live = api.getAllSceneLayers();
    old.forEach(function (id) { if (live.indexOf(id) >= 0) { try { api.deleteLayer(id); } catch (e) {} } });
    MDNA.dropUserKey(comp, "mdnaKitDemo");
    if (DEMO_MODE === "clean") return;

    var before = api.getAllSceneLayers(), keep = api.getSelection();
    function rect(name, w, h, color, x, y, radius) {
        var r = api.primitive("rectangle", name);
        api.set(r, { "generator.dimensions": [w, h], "material.materialColor": color, position: [x, y] });
        if (radius) try { api.set(r, { "generator.cornerRadius": radius }); } catch (e) {}
        return r;
    }
    function text(name, str, size, color, x, y, style) {
        var t = api.create("textShape", name);
        api.set(t, { text: str, fontSize: size, autoWidth: true, autoHeight: true, horizontalAlignment: 0, verticalAlignment: 1, "material.materialColor": color, position: [x, y] });
        try { api.set(t, { "font.font": "Inter Tight", "font.style": style || "Bold" }); } catch (e) {}
        return t;
    }
    // scene A
    var bg = rect("Demo Backdrop", 2400, 2400, "#0f1412", 0, 0);
    var photo = rect("Demo Photo", 720, 520, "#3b5bdb", -440, 0, 24);
    var sun = api.primitive("ellipse", "Demo Photo Sun");
    api.set(sun, { "generator.radius": [120, 120], "material.materialColor": "#ffb86b", position: [-300, 110] });
    var hill = rect("Demo Photo Hill", 720, 200, "#0b4a3d", -440, -160, 24);
    var title = text("Demo Title", "Motion DNA", 120, "#e6efe9", 40, 190);
    var count = text("Demo Count", "0", 150, "#c9f25a", 40, 10, "SemiBold");
    var label = text("Demo Count Label", "renders this month", 44, "#8fa39b", 44, -110, "Regular");
    var chip = rect("Demo Chip", 300, 76, "#c9f25a", 190, -230, 38);
    var chipTxt = text("Demo Chip Text", "Live", 40, "#0f1412", 150, -230, "SemiBold");
    // scene B (revealed by the bars)
    var bgB = rect("Demo Scene B", 2400, 2400, "#e6efe9", 0, 0);
    var titleB = text("Demo Scene B Title", "Scene two", 140, "#0f1412", -330, 0);
    [bg, photo, sun, hill, title, count, label, chip, chipTxt].forEach(function (id) { api.select([id]); api.bringToFront(); });

    // pieces
    MDNA.kit("blur_in", [photo, sun, hill], "in", 0);
    MDNA.kit("chars_rise", [title], "in", 6);
    MDNA.kit("counter", [count], "in", 10, { params: { to: 1250 } });
    MDNA.kit("words_fade_up", [label], "in", 14);
    MDNA.kit("float", [chip, chipTxt], "loop", 0);
    var bars = MDNA.kit("bars_transition", [], "transition", 70);
    // the cut: scene B switches on under the bars while they cover the frame
    [bgB, titleB].forEach(function (id) { api.keyframe(id, bars.cut - 1, { opacity: 0 }); api.keyframe(id, bars.cut, { opacity: 100 }); });
    [bgB, titleB].concat(bars.layers).forEach(function (id) { api.select([id]); api.bringToFront(); });
    api.select(keep);

    var made = api.getAllSceneLayers().filter(function (id) { return before.indexOf(id) < 0; });
    api.setUserData(comp, "mdnaKitDemo", made);
    DEMO_RESULT = { cut: bars.cut, end: bars.end, made: made.length };
})();
typeof DEMO_RESULT !== "undefined" ? JSON.stringify(DEMO_RESULT) : "cleaned";
