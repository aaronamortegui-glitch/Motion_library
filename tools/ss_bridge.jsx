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

    // A job runs in its own function: $.evalFile evaluates in the caller's scope, so a job declaring `var out` (or any
    // name) used to overwrite the poll's own variables and raise a modal error that froze every script until OK.
    $.global.SS_BRIDGE_RUN = function (jobFile) { return $.evalFile(jobFile); };
    $.global.SS_BRIDGE_POLL = function () {
        var jobs = Folder(BASE + "inbox").getFiles("*.jsx");
        for (var i = 0; i < jobs.length; i++) {
            var job = jobs[i], name = job.name.replace(/\.jsx$/, ""), result;
            try {
                app.beginSuppressDialogs();   // a job's warnings never block AE behind a dialog
                var r = $.global.SS_BRIDGE_RUN(job);
                result = "OK\n" + (r === undefined ? "" : String(r));
            } catch (e) {
                result = "ERROR line " + e.line + " in " + (e.fileName || job.name) + "\n" + e.toString();
            }
            try { app.endSuppressDialogs(false); } catch (e2) {}
            try {
                var res = new File(BASE + "outbox/" + name + ".txt");
                res.encoding = "UTF-8"; res.open("w"); res.write(result); res.close();
                job.copy(BASE + "done/" + job.name);
                job.remove();
            } catch (e3) {}
        }
    };
    // the scheduled string is guarded too: an error here would stop AE's scheduled tasks and show a dialog
    $.global.SS_BRIDGE_TASK = app.scheduleTask("try { $.global.SS_BRIDGE_POLL(); } catch (e) {}", 1000, true);
    var hb = new File(BASE + "outbox/_bridge_started.txt");
    hb.open("w"); hb.write("AE " + app.version + " · " + new Date().toString()); hb.close();
    writeLn("Motion DNA bridge active: " + BASE + "inbox");
})();
