// Builds the SS Motion Library explainer: scenes (build_explainer.jsx) + edit with VO, music and SFX (build_edit.jsx).
// Run: bash tools/bridge.sh tools/build_explainer_all.jsx 900   then render EXPLAINER_EDIT with tools/render_comps.jsx
var EXPLAINER_SPEC = "media/explainer/explainer.json", EDIT_SPEC = "media/explainer/edit.json";
var r1 = $.evalFile(new File(File($.fileName).parent.fsName + "/build_explainer.jsx"));
var r2 = $.evalFile(new File(File($.fileName).parent.fsName + "/build_edit.jsx"));
r1 + " | " + r2;
