// Builds The 1974 Cypher: scenes (media/cypher/scenes.json) + edit with speed ramps (media/cypher/edit.json).
// Run: bash tools/bridge.sh tools/build_cypher.jsx   then render CYPHER_EDIT with tools/render_comps.jsx
var SCENE_SPEC = "media/cypher/scenes.json", EDIT_SPEC = "media/cypher/edit.json";
var r1 = $.evalFile(new File(File($.fileName).parent.fsName + "/build_scene.jsx"));
var r2 = $.evalFile(new File(File($.fileName).parent.fsName + "/build_edit.jsx"));
r1 + " | " + r2;
