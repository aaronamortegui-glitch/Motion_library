#!/usr/bin/env bash
# Expands the library after a harvest session (station + ac_driver.py):
#   1) label OCR → names   2) harvests → our own recipes   3) thumbnail comps in AE
#   4) GIF render (new ones only)   5) library.json   6) index.html + INDEX.txt
# Usage: bash tools/expand_library.sh        (AE open; the bridge starts by itself)
set -euo pipefail
export PYTHONIOENCODING=utf-8 PYTHONUTF8=1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if ls research/harvest/station/labels/*.png >/dev/null 2>&1; then
  echo "1/6 label OCR";  powershell -NoProfile -ExecutionPolicy Bypass -File tools/ocr_labels.ps1
else echo "1/6 no labels to read"; fi
echo "2/6 recipes";             (cd tools && python harvest_to_library.py | head -1)
echo "3/6 thumbnail comps"; bash tools/bridge.sh tools/gif_comps.jsx 600
echo "4/6 render (AE queue) + GIF"; bash tools/bridge.sh tools/render_queue.jsx 120; bash tools/wait_files.sh research/_render_expected.txt 1800; SKIP_RENDER=1 bash tools/render_gifs.sh | tail -3
echo "5/6 library.json";        bash tools/bridge.sh tools/export_library.jsx 120
echo "6/6 HTML + INDEX";        python tools/build_library_html.py
echo "Done: $(grep -vc '^#' library/INDEX.txt) entries in library/INDEX.txt"
