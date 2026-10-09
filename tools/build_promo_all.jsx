// Builds the promotional cut of the SS Motion explainer: scenes (build_explainer.jsx with media/promo/promo.json,
// comps PR_S01…PR_S11 in folder "PROMO") + edit with VO, music and SFX (build_edit.jsx → PROMO_EDIT).
// Specs: python media/promo/make_promo.py   Run: bash tools/bridge.sh tools/build_promo_all.jsx 900
var EXPLAINER_SPEC = "media/promo/promo.json", EDIT_SPEC = "media/promo/edit.json";
var r1 = $.evalFile(new File(File($.fileName).parent.fsName + "/build_explainer.jsx"));
var r2 = $.evalFile(new File(File($.fileName).parent.fsName + "/build_edit.jsx"));
r1 + " | " + r2;
