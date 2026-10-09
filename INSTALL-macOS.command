#!/usr/bin/env bash
# Motion DNA: one-step install for macOS. Double-click (or: bash INSTALL-macOS.command), then restart After Effects
# and open Window > Motion DNA.jsx.
cd "$(dirname "$0")" && bash tools/install_panel.sh
echo
echo 'In After Effects, also enable: Settings > Scripting & Expressions > "Allow Scripts to Write Files and Access Network".'
read -r -p "Press Enter to close."
