#!/usr/bin/env bash
# Rebuilds every preview from scratch: preset comps (gif_comps.jsx, on the robot head), one aerender pass over the
# saved queue, the style scenes (style_scenes.py), GIFs, WebMs, posters, panel thumbnails, style stills, the visualizer
# and the README catalog.
# Usage: bash tools/rebuild_previews.sh            (AE open with the bridge; FORCE=1 re-renders existing MP4s)
set -e
cd "$(dirname "$0")/.."
[ "${FORCE:-0}" = "1" ] && rm -f library/mp4/motion/*.mp4 library/mp4/fx/*.mp4 library/mp4/text/*.mp4
bash tools/bridge.sh tools/gif_comps.jsx 1200 | tail -1
bash tools/bridge.sh tools/queue_previews_and_styles.jsx 900 | tail -1
bash tools/render_queue_aerender.sh || true
SKIP_RENDER=1 bash tools/render_gifs.sh | tail -1
PYTHONUTF8=1 python tools/style_scenes.py all | tail -1
bash tools/make_previews_stills.sh
python tools/make_webm.py
python tools/build_library_guide.py
PYTHONUTF8=1 python tools/build_library_html.py | tail -1
PYTHONUTF8=1 python tools/readme_catalog.py | tail -1
