// Renderiza con la cola del AE abierto las comps listadas en research/_render_list.txt (una por línea) → renders/<comp>.mp4
// Útil cuando aerender no sirve (proyecto con capas de Animation Composer). Luego: bash tools/wait_files.sh research/_render_expected.txt
var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    var lf = new File(SS_ROOT + "/research/_render_list.txt"); lf.encoding = "UTF-8";
    if (!lf.exists) return "Falta research/_render_list.txt";
    lf.open("r"); var names = lf.read().split("\n"); lf.close();
    var proj = app.project, rq = proj.renderQueue, comps = {}, n = 0, miss = [];
    for (var i = rq.numItems; i >= 1; i--) rq.item(i).remove();
    for (var k = 1; k <= proj.numItems; k++) if (proj.item(k) instanceof CompItem) comps[proj.item(k).name] = proj.item(k);
    Folder(SS_ROOT + "/renders").create();
    var ex = new File(SS_ROOT + "/research/_render_expected.txt"); ex.encoding = "UTF-8"; ex.open("w");
    for (var j = 0; j < names.length; j++) {
        var nm = names[j].replace(/\r/g, "");
        if (!nm) continue;
        if (!comps[nm]) { miss.push(nm); continue; }
        var out = new File(SS_ROOT + "/renders/" + nm + ".mp4");
        if (out.exists) out.remove();
        var om = rq.items.add(comps[nm]).outputModule(1);
        om.applyTemplate("H.264 - Match Render Settings - 15 Mbps");
        om.file = out;
        ex.writeln(out.fsName); n++;
    }
    ex.close();
    if (n) app.scheduleTask("app.project.renderQueue.render()", 200, false);
    return "render: " + n + " comps" + (miss.length ? " · no existen: " + miss.join(", ") : "");
})();
