// Claude ↔ After Effects bridge.
// Run ONCE per session: File > Scripts > Run Script File… > this file.
// Watches bridge/inbox every second, runs each .jsx and leaves the result in bridge/outbox/<name>.txt
// To stop it: run this file again (toggles on/off).
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
    writeLn("Motion DNA bridge active: " + BASE + "inbox");
})();
