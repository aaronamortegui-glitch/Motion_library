#!/usr/bin/env bash
# Rebuilds the README GIFs and compressed MP4s of the showcases that show people (Cypher, Boardroom, 1974 tests),
# e.g. after the face refinement pass. The Boardroom freeze GIFs come from tools/make_reel_gifs.sh.
# Usage: bash tools/make_showcase_gifs.sh
set -e
cd "$(dirname "$0")/.."
OUT=docs/examples
gif() {  # name source start duration [width]
  local w="${5:-480}"
  ffmpeg -v error -y -ss "$3" -t "$4" -i "$2" \
    -vf "fps=10,scale=${w}:-1:flags=lanczos,hqdn3d=2:2:4:4,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" \
    "$OUT/$1.gif"
  echo "$OUT/$1.gif $(du -k "$OUT/$1.gif" | cut -f1) KB"
}
# The 1974 Cypher (shot times from media/cypher/edit.json)
gif cypher-sneakers renders/CYPHER_EDIT.mp4 0.6 3.6
gif cypher-wide renders/CYPHER_EDIT.mp4 5.4 3.6
gif cypher-details renders/CYPHER_EDIT.mp4 15.6 3.6
# The 1974 Boardroom shots (media/whisky/edit.json)
gif whisky-two-shot renders/WHISKY_EDIT.mp4 0.5 3.0
gif whisky-aaron renders/WHISKY_EDIT.mp4 12.3 3.0
gif whisky-gian renders/WHISKY_EDIT.mp4 22.0 3.0
# 1974 tests
gif hud-test renders/HUD_TEST.mp4 1.0 3.0
gif text-behind-subject renders/05_Text_Behind_70s.mp4 0.8 3.0
gif text-tracking renders/04_Text_Tracking_70s.mp4 0.8 3.0
mp4() { ffmpeg -v error -y -i "$1" -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart "$OUT/$2"; echo "$OUT/$2 $(du -k "$OUT/$2" | cut -f1) KB"; }
mp4 renders/CYPHER_EDIT.mp4 cypher_1974.mp4
cp renders/CYPHER_EDIT.mp4 renders/SS_Motion_Cypher_1974.mp4
cp renders/WHISKY_EDIT.mp4 renders/SS_Motion_Library_Reel_v5.mp4
