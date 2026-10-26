// Queues the preset previews that have no MP4 yet and saves the project, so that tools/render_queue_aerender.sh
// renders them in one aerender pass. Used by tools/rebuild_previews.sh (styles: tools/style_scenes.py).
$.global.SS_QUEUE_ONLY = true; $.global.SS_KEEP_QUEUE = false;
var r1 = $.evalFile(new File(SS_ROOT + "/tools/render_queue.jsx"));
$.global.SS_QUEUE_ONLY = false; $.global.SS_KEEP_QUEUE = false;
app.project.save();
r1 + " | queue " + app.project.renderQueue.numItems;
