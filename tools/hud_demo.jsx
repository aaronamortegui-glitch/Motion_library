// Demo of the SS HUD module on the 70s test clip (comp HUD_TEST). Run: bash tools/bridge.sh tools/hud_demo.jsx
#include "ss_hud.jsx"
(function () {
    var proj = app.project, TRK = SSM.readJSON(SS_ROOT + "/media/tracks.json");
    function findItem(n) { for (var i = 1; i <= proj.numItems; i++) if (proj.item(i).name === n) return proj.item(i); return null; }
    var old = findItem("HUD_TEST"); if (old) old.remove();
    var plate = findItem("aaron_70s_handheld.mp4");
    var c = proj.items.addComp("HUD_TEST", TRK.size[0], TRK.size[1], 1, plate.duration, TRK.fps);
    c.layers.add(plate);
    var fd = 1 / TRK.fps;
    for (var nm in TRK.tracks) {
        if (!TRK.tracks.hasOwnProperty(nm)) continue;
        var tk = TRK.tracks[nm], N = c.layers.addNull(), ts = [], ps = [], sc = [];
        N.name = "TRK " + nm; N.enabled = false;
        N.property("ADBE Transform Group").property("ADBE Anchor Point").setValue([50, 50]);
        for (var f = 0; f < tk.pos.length; f++) { ts.push(f * fd); ps.push(tk.pos[f]); sc.push([tk.scale[f] * 100, tk.scale[f] * 100]); }
        N.property("ADBE Transform Group").property("ADBE Position").setValuesAtTimes(ts, ps);
        N.property("ADBE Transform Group").property("ADBE Scale").setValuesAtTimes(ts, sc);
    }
    SSHUD.init(c);
    SSHUD.bracket({ anchor: "TRK face", size: [300, 380], t0: 0.3, label: "SUBJECT 01 · ANALYZING" });
    SSHUD.callout({ anchor: "TRK lapel", offset: [-380, 120], title: "OUTFIT", lines: ["Rust corduroy blazer", "Cream turtleneck · est. $640"], t0: 1.0 });
    SSHUD.callout({ anchor: "TRK mic_head", offset: [120, -260], title: "EQUIPMENT", lines: ["Dynamic mic · 1972", "Studio grade"], t0: 1.6, color: "coral" });
    SSHUD.meter({ at: [1440, 980], label: "STYLE INDEX", value: 97, t0: 2.2 });
    SSHUD.chip({ anchor: "TRK face", offset: [260, -260], text: "HOST", t0: 0.8, color: "spark" });
    proj.save();
    return "hud test ok";
})();
