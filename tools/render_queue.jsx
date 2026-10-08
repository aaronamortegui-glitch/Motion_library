// Renderiza en el AE abierto (cola de render) las comps listadas en research/gif_comps.txt que aún no tienen MP4.
// Se usa en lugar de aerender: aerender se cuelga cuando el proyecto contiene capas con presets de
// Animation Composer (el plugin espera interacción en modo sin interfaz).
// Salida: library/mp4/<tipo>/<slug>.mp4   (mismo esquema que render_gifs.sh)
var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    var ROOT = SS_ROOT + "/";
    var TEMPLATE = "H.264 - Match Render Settings - 15 Mbps";
    var lf = new File(ROOT + "research/gif_comps.txt"); lf.encoding = "UTF-8";
    if (!lf.exists) return "Falta research/gif_comps.txt";
    lf.open("r"); var names = lf.read().split("\n"); lf.close();
    function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
    var proj = app.project, rq = proj.renderQueue, queued = 0, skipped = 0, missing = [];
    for (var i = rq.numItems; i >= 1; i--) rq.item(i).remove(); // cola limpia
    var comps = {};
    for (var k = 1; k <= proj.numItems; k++) if (proj.item(k) instanceof CompItem) comps[proj.item(k).name] = proj.item(k);
    for (var n = 0; n < names.length; n++) {
        var nm = names[n].replace(/\r/g, "");
        if (!nm) continue;
        var parts = nm.split("__");                    // GIF__<tipo>__<nombre que puede contener __>
        var out = new File(ROOT + "library/mp4/" + parts[1] + "/" + slug(parts.slice(2).join("__")) + ".mp4");
        if (out.exists) { skipped++; continue; }
        if (!comps[nm]) { missing.push(nm); continue; }
        Folder(out.parent.fsName).create();
        var item = rq.items.add(comps[nm]);
        var om = item.outputModule(1);
        om.applyTemplate(TEMPLATE);
        om.file = out;
        queued++;
    }
    // render() no corre dentro de la tarea del puente: se programa como tarea propia.
    // El llamador espera a que existan los archivos listados en research/_render_expected.txt.
    var ex = new File(ROOT + "research/_render_expected.txt"); ex.encoding = "UTF-8"; ex.open("w");
    for (var q = 1; q <= rq.numItems; q++) ex.writeln(rq.item(q).outputModule(1).file.fsName);
    ex.close();
    if (queued) app.scheduleTask("app.project.renderQueue.render()", 200, false);
    return "render: " + queued + " nuevas · " + skipped + " ya existían" + (missing.length ? " · sin comp: " + missing.join(", ") : "");
})();
