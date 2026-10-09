// Queues the preset previews that have no MP4 yet and the style demos, and saves the project, so that
// tools/render_queue_aerender.sh renders everything in one aerender pass. Used by tools/rebuild_previews.sh.
$.global.SS_QUEUE_ONLY = true; $.global.SS_KEEP_QUEUE = false;
var r1 = $.evalFile(new File(SS_ROOT + "/tools/render_queue.jsx"));
$.global.SS_KEEP_QUEUE = true;
var r2 = $.evalFile(new File(SS_ROOT + "/tools/pack_demos.jsx"));
$.global.SS_QUEUE_ONLY = false; $.global.SS_KEEP_QUEUE = false;
app.project.save();
r1 + " | " + r2 + " | queue " + app.project.renderQueue.numItems;
