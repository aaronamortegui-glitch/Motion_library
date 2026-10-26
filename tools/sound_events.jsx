// What happens on screen in a comp, for the sound pass (MCP add_sound -> tools/sound_kit.py cues_from_events).
// Usage: set $.global.SOUND_COMP (a comp name, or "" for the active comp), then $.evalFile this file; it returns
// lines: "<comp>|<duration>|<fps>|<width>|<project folder>" then "E|<t>|<kind>|<value>|<layer>" per event.
// kinds: cut (a full-frame layer starts), move (first position move, value = travel px), pop (scale from < 60 %),
// text (a text layer that arrives without a transform move), marker (layer or comp marker "sfx: <name>").
(function () {
    var name = $.global.SOUND_COMP, c = null;
    if (!name) { c = app.project.activeItem; if (!(c instanceof CompItem)) throw new Error("No active comp: open one or pass comp"); }
    else for (var i = 1; i <= app.project.numItems; i++) { var it = app.project.item(i); if (it instanceof CompItem && it.name === name) { c = it; break; } }
    if (!c) throw new Error("Comp not found: " + name);
    var out = [c.name + "|" + c.duration + "|" + c.frameRate + "|" + c.width + "|" + (app.project.file ? app.project.file.parent.fsName : "")];
    var SFX = /^\s*sfx\s*:\s*/i;
    function keyed(L, match) { var p = L.property("ADBE Transform Group").property(match); return p && p.numKeys >= 2 ? p : null; }
    function markers(m, who) { for (var k = 1; m && k <= m.numKeys; k++) { var cm = m.keyValue(k).comment; if (SFX.test(cm)) out.push("E|" + m.keyTime(k) + "|marker|" + cm.replace(SFX, "") + "|" + who); } }
    for (var i = 1; i <= c.numLayers; i++) {
        var L = c.layer(i);
        if (!L.enabled || L.guideLayer || L.name === "Motion DNA sound") continue;
        markers(L.property("ADBE Marker"), L.name);
        if (L.hasAudio && !L.hasVideo) continue;
        var full = L.source && L.source.width >= c.width * 0.9 && L.source.height >= c.height * 0.9;
        if (full && L.inPoint > 0.05 && L.inPoint < c.duration - 0.1) out.push("E|" + L.inPoint + "|cut|0|" + L.name);
        var P = keyed(L, "ADBE Position"), S = keyed(L, "ADBE Scale"), moved = false;
        if (P) {
            var a = P.keyValue(1), b = P.keyValue(2), d = Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2));
            if (d > 1) { out.push("E|" + P.keyTime(2) + "|move|" + d + "|" + L.name); moved = true; }
        }
        if (S && S.keyValue(1)[0] < 60 && S.keyValue(S.numKeys)[0] >= 80) { out.push("E|" + S.keyTime(2) + "|pop|0|" + L.name); moved = true; }
        if (!moved && L instanceof TextLayer && !full) out.push("E|" + Math.max(L.inPoint, 0) + "|text|0|" + L.name);
    }
    markers(c.markerProperty, "comp");
    return out.join("\n");
})();
