// Puente Claude ↔ After Effects.
// Ejecutar UNA vez por sesión: File > Scripts > Run Script File… > este archivo.
// Vigila bridge/inbox cada segundo, ejecuta cada .jsx y deja el resultado en bridge/outbox/<nombre>.txt
// Para detenerlo: vuelve a ejecutar este archivo (alterna on/off).
var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    var BASE = SS_ROOT + "/bridge/";
    Folder(BASE + "inbox").create();
    Folder(BASE + "outbox").create();
    Folder(BASE + "done").create();

    if ($.global.SS_BRIDGE_TASK) {
        app.cancelTask($.global.SS_BRIDGE_TASK);
        $.global.SS_BRIDGE_TASK = null;
        var hs = new File(BASE + "outbox/_bridge_started.txt"); hs.remove();
        return;
    }

    $.global.SS_BRIDGE_POLL = function () {
        var jobs = Folder(BASE + "inbox").getFiles("*.jsx");
        for (var i = 0; i < jobs.length; i++) {
            var job = jobs[i];
            var name = job.name.replace(/\.jsx$/, "");
            var out = new File(BASE + "outbox/" + name + ".txt");
            var result;
            try {
                var r = $.evalFile(job);
                result = "OK\n" + (r === undefined ? "" : String(r));
            } catch (e) {
                result = "ERROR line " + e.line + " in " + (e.fileName || job.name) + "\n" + e.toString();
            }
            out.encoding = "UTF-8";
            out.open("w"); out.write(result); out.close();
            job.copy(BASE + "done/" + job.name);
            job.remove();
        }
    };
    $.global.SS_BRIDGE_TASK = app.scheduleTask("$.global.SS_BRIDGE_POLL()", 1000, true);
    var hb = new File(BASE + "outbox/_bridge_started.txt");
    hb.open("w"); hb.write("AE " + app.version + " · " + new Date().toString()); hb.close();
    writeLn("SS Bridge activo: " + BASE + "inbox");
})();
