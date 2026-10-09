// Fills the render queue with the preview comps that have no MP4 yet and saves the project, for
// tools/render_queue_aerender.sh. Run: bash tools/bridge.sh tools/render_queue_only.jsx 120
$.global.SS_QUEUE_ONLY = true;
var r = $.evalFile(new File(File($.fileName).parent.fsName + "/render_queue.jsx"));
$.global.SS_QUEUE_ONLY = false;
r;
