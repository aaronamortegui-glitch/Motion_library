// File > Scripts > Motion DNA (installed by tools/setup.py as a tiny loader that points to this clone). It opens the
// Motion DNA panel (Window > Extensions > Motion DNA) and starts the Claude bridge, so the MCP server can drive AE. If
// the HTML panel is not installed, it opens the classic ScriptUI panel (tools/ss_panel.jsx) as a floating window.
// It is a script, not a dockable panel: it never leaves a second window next to the panel.
(function (host) {
    var root = $.global.SS_ROOT || SS_ROOT;
    var b = new File(root + "/tools/ss_bridge.jsx");
    if (b.exists && !$.global.SS_BRIDGE_TASK) { try { $.evalFile(b); } catch (e) {} }
    var id = app.findMenuCommandId("Motion DNA");   // Window > Extensions > Motion DNA
    if (!id) {
        var f = new File(root + "/tools/ss_panel.jsx");
        if (!f.exists) { alert("Motion DNA: run python tools/setup.py from the Motion DNA folder."); return; }
        $.evalFile(f);
        return;
    }
    app.executeCommand(id);
    if (host instanceof Panel) {   // opened as a dockable panel: a small card with a button, nothing else
        host.orientation = "column"; host.alignChildren = ["fill", "top"]; host.margins = 12; host.spacing = 8;
        host.add("statictext", undefined, "Motion DNA opens in its own panel.");
        var open = host.add("button", undefined, "Open Motion DNA");
        open.onClick = function () { app.executeCommand(id); };
        host.add("statictext", undefined, "Also in Window > Extensions > Motion DNA.");
        host.layout.layout(true);
    }
})(this);
