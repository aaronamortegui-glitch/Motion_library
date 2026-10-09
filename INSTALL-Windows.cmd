@echo off
REM Motion DNA: one-step install for Windows (panel + library + fonts + local asset previews + checks).
REM Double-click, then restart After Effects and open Window > Motion DNA.jsx
where python >nul 2>nul
if %errorlevel%==0 (
  python "%~dp0tools\setup.py"
) else (
  echo Python not found: installing the panel only. Install Python 3 for fonts, asset previews and Claude's MCP server.
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\install_panel.ps1"
)
pause
