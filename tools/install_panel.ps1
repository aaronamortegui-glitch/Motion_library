# Installs Motion DNA's entry points in every After Effects version on this machine (Windows; macOS: install_panel.sh).
# The panel itself is the CEP extension (Window > Extensions > Motion DNA), installed by tools/setup.py. This adds:
#   Scripts\Motion DNA.jsx            File > Scripts > Motion DNA: opens the panel (or the classic one if the HTML panel
#                                     is missing) and starts the Claude bridge. Not a dockable panel, so no extra window.
#   Scripts\Startup\Motion DNA.jsx    starts the Claude bridge when After Effects opens, so the MCP server can drive AE
#                                     even before the panel is shown. Silent: no window, no dialog.
# and removes the old Window > Motion DNA.jsx (ScriptUI Panels), which opened a second, empty window.
# Both files are tiny loaders that point to THIS clone. Usage (from the repo):
#   powershell -ExecutionPolicy Bypass -File tools/install_panel.ps1      then restart After Effects.
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path -replace "\\", "/"
$launcher = @"
// Motion DNA (installed by tools/install_panel.ps1): File > Scripts > Motion DNA opens the panel. Repo: $repo
var SS_ROOT = "$repo";
(function () {
    var f = new File(SS_ROOT + "/tools/mdna_launcher.jsx");
    if (!f.exists) { alert("Motion DNA: not found at " + f.fsName + "\nRun python tools/setup.py from the Motion DNA folder."); return; }
    $.evalFile(f);
})();
"@
$startup = @"
// Motion DNA (installed by tools/install_panel.ps1): starts the Claude bridge when After Effects opens. Repo: $repo
var SS_ROOT = "$repo";
(function () {
    try {
        `$.global.SS_ROOT = SS_ROOT;
        var b = new File("$repo/tools/ss_bridge.jsx");
        if (b.exists && !`$.global.SS_BRIDGE_TASK) `$.evalFile(b);
    } catch (e) {}
})();
"@

$ok = 0
Get-ChildItem "$env:APPDATA\Adobe\After Effects" -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^\d+(\.\d+)?$' } | ForEach-Object {
        $scripts = Join-Path $_.FullName "Scripts"
        try {
            New-Item -ItemType Directory -Force -Path (Join-Path $scripts "Startup") | Out-Null
            Set-Content -Path (Join-Path $scripts "Motion DNA.jsx") -Value $launcher -Encoding UTF8
            Set-Content -Path (Join-Path $scripts "Startup\Motion DNA.jsx") -Value $startup -Encoding UTF8
            foreach ($old in @("ScriptUI Panels\Motion DNA.jsx", "ScriptUI Panels\SS Motion.jsx")) {   # the old dockable entries
                $p = Join-Path $scripts $old; if (Test-Path $p) { Remove-Item $p -Force }
            }
            Write-Output "installed: $scripts\Motion DNA.jsx (+ Startup)"
            $ok++
        } catch {
            Write-Output "skipped: $scripts ($($_.Exception.Message))"
        }
    }
if ($ok -eq 0) { Write-Output "Nothing installed: open After Effects once (it creates its Scripts folder), then run setup again."; exit 1 }
Write-Output "Restart After Effects: the panel is Window > Extensions > Motion DNA (also File > Scripts > Motion DNA)."
