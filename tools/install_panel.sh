#!/usr/bin/env bash
# macOS: installs Motion DNA's entry points in every After Effects version (Windows: tools/install_panel.ps1).
# The panel itself is the CEP extension (Window > Extensions > Motion DNA), installed by tools/setup.py. This adds:
#   Scripts/Motion DNA.jsx           File > Scripts > Motion DNA: opens the panel and starts the Claude bridge
#   Scripts/Startup/Motion DNA.jsx   starts the Claude bridge when After Effects opens (silent)
# and removes the old Window > Motion DNA.jsx (ScriptUI Panels), which opened a second, empty window.
# Usage (from the repo):  bash tools/install_panel.sh      then restart After Effects.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
LAUNCHER="// Motion DNA (installed by tools/install_panel.sh): File > Scripts > Motion DNA opens the panel. Repo: $REPO
var SS_ROOT = \"$REPO\";
(function () {
    var f = new File(SS_ROOT + \"/tools/mdna_launcher.jsx\");
    if (!f.exists) { alert(\"Motion DNA: run python tools/setup.py from the Motion DNA folder.\"); return; }
    \$.evalFile(f);
})();"
STARTUP="// Motion DNA (installed by tools/install_panel.sh): starts the Claude bridge when After Effects opens. Repo: $REPO
var SS_ROOT = \"$REPO\";
(function () {
    try {
        \$.global.SS_ROOT = SS_ROOT;
        var b = new File(SS_ROOT + \"/tools/ss_bridge.jsx\");
        if (b.exists && !\$.global.SS_BRIDGE_TASK) \$.evalFile(b);
    } catch (e) {}
})();"
ok=0
for d in "$HOME/Library/Preferences/Adobe/After Effects"/*/; do
  [ -d "$d" ] || continue
  case "$(basename "$d")" in [0-9]*) ;; *) continue ;; esac
  s="$d/Scripts"; mkdir -p "$s/Startup"
  printf '%s\n' "$LAUNCHER" > "$s/Motion DNA.jsx"
  printf '%s\n' "$STARTUP" > "$s/Startup/Motion DNA.jsx"
  rm -f "$s/ScriptUI Panels/Motion DNA.jsx" "$s/ScriptUI Panels/SS Motion.jsx"   # the old dockable entries
  echo "installed: $s/Motion DNA.jsx (+ Startup)"; ok=$((ok + 1))
done
[ "$ok" -gt 0 ] || { echo "Nothing installed: open After Effects once (it creates its Scripts folder), then run setup again."; exit 1; }
echo "Restart After Effects: the panel is Window > Extensions > Motion DNA (also File > Scripts > Motion DNA)."
