#!/usr/bin/env bash
# Motion DNA: one-step install for macOS (panel + library + fonts + local asset previews + checks).
# Double-click (or: bash INSTALL-macOS.command), then restart After Effects and open Window > Motion DNA.jsx.
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then python3 tools/setup.py
else echo "python3 not found: installing the panel only."; bash tools/install_panel.sh; fi
read -r -p "Press Enter to close."
