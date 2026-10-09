#!/usr/bin/env bash
# Cuts the README examples out of the final reel: freeze-frame GIFs, the library app GIF, the breakdown GIF
# and a compressed copy of the full video. Usage: bash tools/make_reel_gifs.sh [renders/WHISKY_EDIT.mp4]
set -e
cd "$(dirname "$0")/.."
SRC="${1:-renders/WHISKY_EDIT.mp4}"
OUT=docs/examples
gif() {  # name start duration [width]
  local w="${4:-560}"
  ffmpeg -v error -y -ss "$2" -t "$3" -i "$SRC" \
    -vf "fps=12,scale=${w}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" \
    "$OUT/$1.gif"
  echo "$OUT/$1.gif $(du -k "$OUT/$1.gif" | cut -f1) KB"
}
# times come from media/whisky/edit.json (freeze windows of each shot)
gif reel-freeze-keyframes 5.3 6.2
gif reel-freeze-tracked 14.2 3.8
gif reel-freeze-rotoscoped 24.1 2.6
gif whisky-breakdown 30.4 4.9
gif reel-library-app 35.6 5.6 520
ffmpeg -v error -y -i "$SRC" -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart "$OUT/whisky_1974_boardroom.mp4"
echo "$OUT/whisky_1974_boardroom.mp4 $(du -k "$OUT/whisky_1974_boardroom.mp4" | cut -f1) KB"
