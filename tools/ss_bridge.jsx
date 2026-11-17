// Claude ↔ After Effects bridge.
// Run ONCE per session: File > Scripts > Run Script File… > this file.
// Watches bridge/inbox (every 0.25 s for 30 s after a job, every 2.5 s when idle), runs each .jsx and leaves the result in bridge/outbox/<name>.txt
// Every tick is a script run, and After Effects shows its wait cursor during each one: an idle tick every second (and
// every 0.2 s for two minutes after a job) kept the cursor flickering all day, so idle ticks are rarer now.
// While the Motion DNA panel is open it runs the jobs itself (Node watches bridge/inbox outside AE and asks AE to run a
// job only when there is one, through CEP, which waits while a dialog is open): no timer runs in AE then. A timer that
// fired while any dialog was open (Composition Settings, Preferences, a save prompt) made AE show "Cannot run a script
// while a modal dialog is waiting for response". The panel leaves a heartbeat (outbox/_panel_beat.txt); when it is
// older than 10 s (panel closed) this timer takes over again.
// To stop it: run this file again (toggles on/off).
var SS_ROOT = (typeof SS_ROOT !== "undefined" && SS_ROOT) || File($.fileName).parent.parent.fsName.split("\\").join("/");
(function () {
    var BASE = SS_ROOT + "/bridge/";
    Folder(BASE + "inbox").create();
    Folder(BASE + "outbox").create();
    Folder(BASE + "done").create();
    // Results and copies of finished jobs pile up (2,000+ after a few weeks) and slow every read of these folders: keep 3 days.
    try {
        var cut = new Date().getTime() - 3 * 86400000, olds = Folder(BASE + "outbox").getFiles("*.txt").concat(Folder(BASE + "done").getFiles("*.jsx"));
        for (var o = 0; o < olds.length; o++) if (olds[o].name.charAt(0) !== "_" && olds[o].modified && olds[o].modified.getTime() < cut) olds[o].remove();
    } catch (e) {}

    $.global.SS_PANEL_ON = function () {   // the panel drives the bridge: its heartbeat is less than 10 s old
        var f = new File(BASE + "outbox/_panel_beat.txt");
        return f.exists && !!f.modified && new Date().getTime() - f.modified.getTime() < 10000;
    };
    var marker = function (text) { var hb = new File(BASE + "outbox/_bridge_started.txt"); hb.encoding = "UTF-8"; hb.open("w"); hb.write(text); hb.close(); };

    if ($.global.SS_BRIDGE_TASK && $.global.SS_BRIDGE_TASK !== "panel") {   // "panel": nothing scheduled to stop, start the timer below
        $.global.SS_BRIDGE_ON = false;   // a tick already running won't schedule the next one
        try { app.cancelTask($.global.SS_BRIDGE_TASK); } catch (e) {}
        $.global.SS_BRIDGE_TASK = null;
        var hs = new File(BASE + "outbox/_bridge_started.txt"); hs.remove();
        return;
    }

    // A job runs in its own function: $.evalFile evaluates in the caller's scope, so a job declaring `var out` (or any
    // name) used to overwrite the poll's own variables and raise a modal error that froze every script until OK.
    $.global.SS_BRIDGE_RUN = function (jobFile) { return $.evalFile(jobFile); };
    $.global.SS_BRIDGE_POLL = function () {
        $.global.SS_BRIDGE_LAST = new Date().getTime();   // heartbeat: the panel restarts the timer if it goes quiet
        var jobs = Folder(BASE + "inbox").getFiles("*.jsx");
        // quick while someone is working (an agent sends one job after another), slow when idle: AE's thread stays free
        if (jobs.length) $.global.SS_BRIDGE_BUSY = $.global.SS_BRIDGE_LAST;
        $.global.SS_BRIDGE_MS = $.global.SS_BRIDGE_LAST - ($.global.SS_BRIDGE_BUSY || 0) < 30000 ? 250 : 2500;
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
    // One tick at a time: each tick schedules the next. A repeating task fires while any dialog is open and AE answers
    // every tick with "Cannot run a script while a modal dialog is waiting", one dialog after another; a chained tick
    // that hits a dialog shows it once and the chain stops, and the panel restarts it when its heartbeat goes quiet
    // (host.jsx mdna_bridge_heal). The scheduled string is guarded too: an error there would stop AE's scheduled tasks.
    if ($.global.SS_PANEL_ON()) {   // the panel runs the jobs (host.jsx mdna_bridge_run): no timer
        $.global.SS_BRIDGE_ON = false; $.global.SS_BRIDGE_TASK = "panel";
        marker("panel · AE " + app.version + " · " + new Date().toString());
        writeLn("Motion DNA bridge: the panel runs the jobs");
        return;
    }
    // A tick that finds the panel's heartbeat fresh hands over to the panel and stops the chain.
    $.global.SS_BRIDGE_ON = true;
    $.global.SS_BRIDGE_TICK = "var ssp = false; try { ssp = $.global.SS_PANEL_ON(); } catch (e) {} " +
        "if (ssp) { $.global.SS_BRIDGE_ON = false; $.global.SS_BRIDGE_TASK = 'panel'; } else { try { $.global.SS_BRIDGE_POLL(); } catch (e) {} } " +
        "if ($.global.SS_BRIDGE_ON) $.global.SS_BRIDGE_TASK = app.scheduleTask($.global.SS_BRIDGE_TICK, $.global.SS_BRIDGE_MS || 1000, false);";
    $.global.SS_BRIDGE_TASK = app.scheduleTask($.global.SS_BRIDGE_TICK, 1000, false);
    marker("AE " + app.version + " · " + new Date().toString());
    writeLn("Motion DNA bridge active: " + BASE + "inbox");
})();
