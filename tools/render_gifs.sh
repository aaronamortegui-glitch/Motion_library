#!/usr/bin/env bash
# Renderiza todas las comps "GIF__<tipo>__<preset>" del proyecto y las convierte en GIF optimizados.
# Uso: bash tools/render_gifs.sh [proyecto.aep]      (SKIP_RENDER=1 reusa los mp4 ya renderizados)
# Salida: library/gifs/<tipo>/<slug>.gif  (+ .mp4 de respaldo en library/mp4)
set -euo pipefail
export PYTHONIOENCODING=utf-8 PYTHONUTF8=1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AEP="${1:-$ROOT/ae/motion_lab_v01.aep}"
AER="/c/Program Files/Adobe/Adobe After Effects 2026/Support Files/aerender.exe"
LIST="${LIST:-$ROOT/research/gif_comps.txt}"
OUTDIR="${OUTDIR:-$ROOT/library}"
[ -f "$LIST" ] || { echo "Falta $LIST (lista de comps)"; exit 1; }

slug() { echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/-/g; s/^-//; s/-$//'; }
to_win() { cygpath -m "$1" 2>/dev/null || echo "$1"; }

while IFS= read -r comp || [ -n "$comp" ]; do
  [ -z "$comp" ] && continue
  kind=$(echo "$comp" | awk -F'__' '{print $2}')
  name="${comp#GIF__*__}"        # todo lo que sigue a GIF__<tipo>__ (los ids pueden contener __)
  s=$(slug "$name")
  mkdir -p "$OUTDIR/gifs/$kind" "$OUTDIR/mp4/$kind"
  mp4="$OUTDIR/mp4/$kind/$s.mp4"
  if [ "${SKIP_RENDER:-0}" = "1" ] && [ ! -f "$mp4" ]; then
    echo "falta $kind/$s.mp4 (renderízalo con tools/render_queue.jsx)"; continue
  fi
  # aerender solo sin SKIP_RENDER: se cuelga si el proyecto tiene capas con presets de Animation Composer
  if [ "${SKIP_RENDER:-0}" != "1" ]; then
    "$AER" -project "$(to_win "$AEP")" -comp "$comp" -OMtemplate "H.264 - Match Render Settings - 15 Mbps" \
      -output "$(to_win "$mp4")" > /dev/null 2>&1 || { echo "FALLÓ render: $comp"; continue; }
  fi
  gif="$OUTDIR/gifs/$kind/$s.gif"
  dur=""; [ "$kind" = "fx" ] && dur="-t 2"   # los loops no necesitan más de 2 s
  ffmpeg -loglevel error -y $dur -i "$mp4" \
    -filter_complex "fps=12,scale=240:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=24:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" \
    "$gif"
  echo "$kind/$s.gif  $(du -k "$gif" | cut -f1)KB"
done < "$LIST"
