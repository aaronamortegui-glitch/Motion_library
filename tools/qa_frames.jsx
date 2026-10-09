// Saves QA stills of a comp at given times: set QA_COMP, QA_TIMES (seconds) and QA_DIR before including, or edit below.
// Run: bash tools/bridge.sh tools/qa_frames.jsx   (saveFrameToPng is async: wait for the files)
(function () {
    var name = (typeof QA_COMP !== "undefined") ? QA_COMP : "PROMO_EDIT";
    var times = (typeof QA_TIMES !== "undefined") ? QA_TIMES : [1.5, 3.2, 4.6, 6.2, 7.6, 8.9, 10.6, 12.2, 13.6, 16.2, 17.4, 18.4, 20.6, 24.3, 25.9, 27.4, 28.9, 31, 33.5, 36.9, 38.8, 41, 42.4, 43.6, 45.5, 47.8, 49.3, 51.6, 53.6, 55.6, 58.5];
    var dir = (typeof QA_DIR !== "undefined") ? QA_DIR : SS_ROOT + "/research/promo_qa";
    var c = null;
    for (var i = 1; i <= app.project.numItems; i++) if (app.project.item(i).name === name) c = app.project.item(i);
    if (!c) return "ERROR no comp " + name;
    Folder(dir).create();
    for (var k = 0; k < times.length; k++) c.saveFrameToPng(times[k], new File(dir + "/f_" + ("00" + Math.round(times[k] * 10)).slice(-3) + ".png"));
    return "queued " + times.length + " frames of " + name;
})();
