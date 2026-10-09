@echo off
REM Motion DNA: one-step install for Windows. Double-click, then restart After Effects and open Window > Motion DNA.jsx
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\install_panel.ps1"
echo.
echo In After Effects, also enable: Edit ^> Preferences ^> Scripting ^& Expressions ^> "Allow Scripts to Write Files and Access Network".
pause
