// Opens the Motion DNA panel as a floating window and walks every category, filter and selection hook, catching
// errors. Run: bash tools/bridge.sh tools/test_panel.jsx 120   (closes the window at the end)
#targetengine "motiondna_paneltest"
(function () {
    var SS_PANEL_TITLE = "Motion DNA panel test";
    $.global.SS_PANEL_TITLE = SS_PANEL_TITLE;
    $.evalFile(new File(SS_ROOT + "/tools/ss_panel.jsx"));
    var out = [], bad = 0;
    function t(label, fn) { try { var r = fn(); out.push("ok   " + label + (r ? " (" + r + ")" : "")); } catch (e) { bad++; out.push("FAIL " + label + ": " + e.toString() + (e.line ? " @" + e.line : "")); } }
    var cats = ["Moves", "Classics", "Text", "Loops", "Transitions", "Recipes", "Styles", "Mix", "Techniques", "Assets", "★ Favorites"];
    for (var i = 0; i < cats.length; i++) (function (c) { t("category " + c, function () { return SS_PANEL.tab(c); }); })(cats[i]);
    for (var e = 0; e <= 5; e++) (function (e) { t("energy " + e, function () { return SS_PANEL.filters({ energy: e }); }); })(e);
    t("tone elegant", function () { return SS_PANEL.filters({ energy: 0, tone: "elegant" }); });
    t("tone reset", function () { return SS_PANEL.filters({ tone: "all tones" }); });
    t("select motion", function () { return SS_PANEL.select("motion", "Surge Rise"); });
    t("select text", function () { return SS_PANEL.select("text", "Chars Ramp"); });
    t("select fx", function () { return SS_PANEL.select("fx", "Float"); });
    t("select style", function () { return SS_PANEL.select("pack", "Calm Modern"); });
    t("select technique", function () { return SS_PANEL.select("technique", "Tracked labels"); });
    t("controls", function () { return SS_PANEL.controls({ speed: 1.5, intensity: 0.8, direction: 1, ease: "Whip" }); });
    return (bad ? bad + " FAILED\n" : "all panel checks passed\n") + out.join("\n");
})();
