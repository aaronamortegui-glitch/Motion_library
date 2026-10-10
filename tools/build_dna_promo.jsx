// Builds the Motion DNA promo (1985 infomercial parody):
//   1. live plates with the library's techniques (build_scene.jsx with media/motion_dna_promo/scenes_fx.json → DNAFX_P01…)
//   2. shots + graphics (build_explainer.jsx with scenes.json → DNA_S01…, folder "DNA PROMO")
//   3. edit with dialogue, music, SFX and Rex's freeze title (build_edit.jsx with edit.json → DNA_EDIT)
// Specs: python media/motion_dna_promo/make_dna_promo.py   Run: bash tools/bridge.sh tools/build_dna_promo.jsx 900
var SCENE_SPEC = "media/motion_dna_promo/scenes_fx.json";
var EXPLAINER_SPEC = "media/motion_dna_promo/scenes.json", EDIT_SPEC = "media/motion_dna_promo/edit.json";
var r0 = $.evalFile(new File(File($.fileName).parent.fsName + "/build_scene.jsx"));
var r1 = $.evalFile(new File(File($.fileName).parent.fsName + "/build_explainer.jsx"));
var r2 = $.evalFile(new File(File($.fileName).parent.fsName + "/build_edit.jsx"));
r0 + " | " + r1 + " | " + r2;
