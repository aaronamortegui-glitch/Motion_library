# Installs the SS Motion panel in After Effects: Window > SS Motion.jsx (dockable). Loading the panel also starts the
# Claude bridge, so the MCP server in .mcp.json can drive AE (dock the panel once and it reloads with AE).
# It copies a tiny loader that points to THIS repo clone, so the panel always shows the current library.
# Usage (from the repo):  powershell -ExecutionPolicy Bypass -File tools/install_panel.ps1
# Then restart After Effects. Also enable: Edit > Preferences > Scripting & Expressions >
# "Allow Scripts to Write Files and Access Network" (needed to read the library files).
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path -replace "\\", "/"
$loader = @"
// SS Motion panel loader (installed by tools/install_panel.ps1). Repo: $repo
// Re-run the installer if you move the repo.
var SS_ROOT = "$repo";
var SS_PANEL_HOST = this;
(function () {
    var f = new File(SS_ROOT + "/tools/ss_panel.jsx");
    if (!f.exists) { alert("SS Motion: panel not found at " + f.fsName + "\nRe-run tools/install_panel.ps1 from the repo."); return; }
    $.evalFile(f);
    // start the Claude bridge too (tools/ss_bridge.jsx), so the MCP server (tools/mcp/ss_motion_mcp.py) can drive AE
    var b = new File(SS_ROOT + "/tools/ss_bridge.jsx");
    if (b.exists && !$.global.SS_BRIDGE_TASK) { try { $.evalFile(b); } catch (e) {} }
})();
"@

$targets = @()
# per-user Scripts folders (no admin needed), one per installed AE version
Get-ChildItem "$env:APPDATA\Adobe\After Effects" -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^\d+(\.\d+)?$' } |
    ForEach-Object { $targets += Join-Path $_.FullName "Scripts\ScriptUI Panels" }
# application Scripts folders (need admin; skipped if not allowed)
Get-ChildItem "C:\Program Files\Adobe" -Directory -Filter "Adobe After Effects*" -ErrorAction SilentlyContinue |
    ForEach-Object { $targets += Join-Path $_.FullName "Support Files\Scripts\ScriptUI Panels" }

$ok = 0
foreach ($t in $targets) {
    try {
        New-Item -ItemType Directory -Force -Path $t | Out-Null
        Set-Content -Path (Join-Path $t "SS Motion.jsx") -Value $loader -Encoding UTF8
        Write-Output "installed: $t\SS Motion.jsx"
        $ok++
    } catch {
        Write-Output "skipped (no permission): $t"
    }
}
if ($ok -eq 0) { Write-Output "Nothing installed. Run PowerShell as administrator or copy the loader manually."; exit 1 }
Write-Output "Restart After Effects, then open Window > SS Motion.jsx and dock it."
