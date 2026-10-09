#!/usr/bin/env bash
# macOS installer for the Motion DNA panel (Windows: tools/install_panel.ps1).
# Adds Window > Motion DNA.jsx (dockable) to every installed After Effects version. The loader points to THIS repo
# clone (the panel always shows the current library) and also starts the Claude bridge for the MCP server.
# Usage (from the repo):  bash tools/install_panel.sh      then restart After Effects.
# Also enable: After Effects > Settings > Scripting & Expressions > "Allow Scripts to Write Files and Access Network".
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOADER='// Motion DNA panel loader (installed by tools/install_panel.sh). Repo: __REPO__
// Re-run the installer if you move the repo.
var SS_ROOT = "__REPO__";
var SS_PANEL_HOST = this;
(function () {
    var f = new File(SS_ROOT + "/tools/ss_panel.jsx");
    if (!f.exists) { alert("Motion DNA: panel not found at " + f.fsName + "\nRe-run tools/install_panel.sh from the repo."); return; }
    $.evalFile(f);
    // start the Claude bridge too (tools/ss_bridge.jsx), so the MCP server (tools/mcp/ss_motion_mcp.py) can drive AE
    var b = new File(SS_ROOT + "/tools/ss_bridge.jsx");
    if (b.exists && !$.global.SS_BRIDGE_TASK) { try { $.evalFile(b); } catch (e) {} }
})();'
LOADER="${LOADER//__REPO__/$REPO}"
ok=0
# per-user Scripts folders (no admin needed), one per AE version that has been launched once
for d in "$HOME/Library/Preferences/Adobe/After Effects"/*/; do
  [ -d "$d" ] || continue
  case "$(basename "$d")" in [0-9]*) ;; *) continue ;; esac
  t="$d/Scripts/ScriptUI Panels"; mkdir -p "$t"; rm -f "$t/SS Motion.jsx"   # pre-rename loader
  printf '%s\n' "$LOADER" > "$t/Motion DNA.jsx" && { echo "installed: $t/Motion DNA.jsx"; ok=$((ok + 1)); }
done
# application Scripts folders (may need: sudo bash tools/install_panel.sh)
for d in /Applications/Adobe\ After\ Effects\ 20*/; do
  [ -d "$d" ] || continue
  t="$d/Scripts/ScriptUI Panels"
  if mkdir -p "$t" 2>/dev/null && printf '%s\n' "$LOADER" > "$t/Motion DNA.jsx" 2>/dev/null; then
    echo "installed: $t/Motion DNA.jsx"; ok=$((ok + 1))
  else
    echo "skipped (no permission): $t"
  fi
done
[ "$ok" -gt 0 ] || { echo "Nothing installed. Launch After Effects once, or run with sudo."; exit 1; }
echo "Restart After Effects, then open Window > Motion DNA.jsx and dock it."
