#!/usr/bin/env bash
# Renders all "GIF__<type>__<preset>" comps in the project and converts them into optimized GIFs.
# Usage: bash tools/render_gifs.sh [project.aep]      (SKIP_RENDER=1 reuses the already rendered mp4s)
# Output: library/gifs/<type>/<slug>.gif  (+ backup .mp4 in library/mp4)
set -euo pipefail
export PYTHONIOENCODING=utf-8 PYTHONUTF8=1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AEP="${1:-$ROOT/ae/motion_lab_v01.aep}"
if [ "$(uname -s)" = "Darwin" ]; then
  AER="${SS_AERENDER:-$(ls -d /Applications/Adobe\ After\ Effects\ 20*/aerender 2>/dev/null | sort | tail -1)}"
else
  AER="${SS_AERENDER:-/c/Program Files/Adobe/Adobe After Effects 2026/Support Files/aerender.exe}"
fi
LIST="${LIST:-$ROOT/research/gif_comps.txt}"
OUTDIR="${OUTDIR:-$ROOT/library}"
[ -f "$LIST" ] || { echo "Missing $LIST (comp list)"; exit 1; }

slug() { echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/-/g; s/^-//; s/-$//'; }
to_win() { cygpath -m "$1" 2>/dev/null || echo "$1"; }

while IFS= read -r comp || [ -n "$comp" ]; do
  [ -z "$comp" ] && continue
  kind=$(echo "$comp" | awk -F'__' '{print $2}')
  name="${comp#GIF__*__}"        # everything after GIF__<type>__ (ids may contain __)
  s=$(slug "$name")
  mkdir -p "$OUTDIR/gifs/$kind" "$OUTDIR/mp4/$kind"
  mp4="$OUTDIR/mp4/$kind/$s.mp4"
  if [ "${SKIP_RENDER:-0}" = "1" ] && [ ! -f "$mp4" ]; then
    echo "missing $kind/$s.mp4 (render it with tools/render_queue.jsx)"; continue
  fi
  # aerender only without SKIP_RENDER: it hangs if the project has layers with Animation Composer presets
  if [ "${SKIP_RENDER:-0}" != "1" ]; then
    "$AER" -project "$(to_win "$AEP")" -comp "$comp" -OMtemplate "H.264 - Match Render Settings - 15 Mbps" \
      -output "$(to_win "$mp4")" > /dev/null 2>&1 || { echo "Render FAILED: $comp"; continue; }
  fi
  gif="$OUTDIR/gifs/$kind/$s.gif"
  dur=""; [ "$kind" = "fx" ] && dur="-t 2"   # loops don't need more than 2 s
  ffmpeg -loglevel error -y $dur -i "$mp4" \
    -filter_complex "fps=12,scale=240:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=24:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" \
    "$gif"
  echo "$kind/$s.gif  $(du -k "$gif" | cut -f1)KB"
done < "$LIST"
