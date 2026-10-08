#!/usr/bin/env bash
# Amplía la librería después de una sesión de cosecha (estación + ac_driver.py):
#   1) OCR de etiquetas → nombres   2) cosechas → recetas propias   3) comps de miniaturas en AE
#   4) render de GIF (solo los nuevos)   5) library.json   6) index.html + INDEX.txt
# Uso: bash tools/expand_library.sh        (AE abierto; el puente se arranca solo)
set -euo pipefail
export PYTHONIOENCODING=utf-8 PYTHONUTF8=1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if ls research/harvest/station/labels/*.png >/dev/null 2>&1; then
  echo "1/6 OCR de etiquetas";  powershell -NoProfile -ExecutionPolicy Bypass -File tools/ocr_labels.ps1
else echo "1/6 sin etiquetas que leer"; fi
echo "2/6 recetas";             (cd tools && python harvest_to_library.py | head -1)
echo "3/6 comps de miniaturas"; bash tools/bridge.sh tools/gif_comps.jsx 600
echo "4/6 render (cola de AE) + GIF"; bash tools/bridge.sh tools/render_queue.jsx 120; bash tools/wait_files.sh research/_render_expected.txt 1800; SKIP_RENDER=1 bash tools/render_gifs.sh | tail -3
echo "5/6 library.json";        bash tools/bridge.sh tools/export_library.jsx 120
echo "6/6 HTML + INDEX";        python tools/build_library_html.py
echo "Listo: $(grep -vc '^#' library/INDEX.txt) entradas en library/INDEX.txt"
