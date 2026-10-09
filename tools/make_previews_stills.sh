#!/usr/bin/env bash
# Posters, panel thumbnails and style (pack) stills from the rendered preview MP4s, in one pass.
#   library/mp4/<kind>/<slug>.mp4  -> library/posters/<kind>/<slug>.png (480 px, a frame where the move reads)
#                                  -> library/thumbs/... (240x135) and library/thumbs_sm/... (112x63, the panel grid)
#   library/packs/<slug>.mp4       -> <slug>.gif (README / visualizer), <slug>.png (poster), <slug>_sm.png (panel)
# Usage: bash tools/make_previews_stills.sh            (after tools/render_queue_aerender.sh + render_gifs.sh)
set -e
cd "$(dirname "$0")/.."
PAD="pad=%W%:%H%:(ow-iw)/2:(oh-ih)/2:color=0x0A211F"
fit() { echo "scale=$1:$2:force_original_aspect_ratio=decrease,pad=$1:$2:(ow-iw)/2:(oh-ih)/2:color=0x0A211F"; }
n=0
for mp4 in library/mp4/*/*.mp4; do
  rel="${mp4#library/mp4/}"; kind="${rel%%/*}"; slug="$(basename "$mp4" .mp4)"
  # the sample is fully on screen after the entrance: 0.9 s for moves, 1.0 s for loops, 1.3 s for text, 1.5 s recipes
  case "$kind" in motion) t=0.9 ;; fx) t=1.0 ;; text) t=1.3 ;; *) t=1.5 ;; esac
  mkdir -p "library/posters/$kind" "library/thumbs/$kind" "library/thumbs_sm/$kind"
  ffmpeg -v error -y -ss "$t" -i "$mp4" -frames:v 1 -vf "scale=480:-1" "library/posters/$kind/$slug.png"
  ffmpeg -v error -y -i "library/posters/$kind/$slug.png" -vf "$(fit 240 135)" "library/thumbs/$kind/$slug.png"
  ffmpeg -v error -y -i "library/posters/$kind/$slug.png" -vf "$(fit 112 63)" "library/thumbs_sm/$kind/$slug.png"
  n=$((n + 1))
done
p=0
for mp4 in library/packs/*.mp4; do
  slug="$(basename "$mp4" .mp4)"
  ffmpeg -v error -y -i "$mp4" -vf "fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" "library/packs/$slug.gif"
  ffmpeg -v error -y -ss 2.6 -i "$mp4" -frames:v 1 -vf "scale=480:-1" "library/packs/$slug.png"
  ffmpeg -v error -y -i "library/packs/$slug.png" -vf "$(fit 112 63)" "library/packs/${slug}_sm.png"
  p=$((p + 1))
done
echo "stills: $n presets, $p styles"
