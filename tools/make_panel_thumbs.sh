#!/usr/bin/env bash
# Small preview stills for the AE panel (240x135 PNG), from the visualizer posters.
# Usage: bash tools/make_panel_thumbs.sh      (run after new presets get posters)
set -e
cd "$(dirname "$0")/.."
n=0
for f in library/posters/*/*.png; do
  rel="${f#library/posters/}"; out="library/thumbs/$rel"
  mkdir -p "$(dirname "$out")"
  if [ ! -f "$out" ] || [ "$f" -nt "$out" ]; then
    ffmpeg -v error -y -i "$f" -vf "scale=240:135:force_original_aspect_ratio=decrease,pad=240:135:(ow-iw)/2:(oh-ih)/2:color=0x0A211F" "$out"
    n=$((n + 1))
  fi
done
echo "panel thumbs: $n updated · $(ls library/thumbs/*/*.png | wc -l) total"
