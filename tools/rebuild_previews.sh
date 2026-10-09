#!/usr/bin/env bash
# Rebuilds every preview from scratch: preset comps (gif_comps.jsx), style demos (pack_demos.jsx), one aerender pass
# over the saved queue, GIFs, posters, panel thumbnails, style stills, the visualizer and the README catalog.
# Usage: bash tools/rebuild_previews.sh            (AE open with the bridge; FORCE=1 re-renders existing MP4s)
set -e
cd "$(dirname "$0")/.."
[ "${FORCE:-0}" = "1" ] && rm -f library/mp4/motion/*.mp4 library/mp4/fx/*.mp4 library/mp4/text/*.mp4
bash tools/bridge.sh tools/gif_comps.jsx 1200 | tail -1
bash tools/bridge.sh tools/queue_previews_and_styles.jsx 900 | tail -1
bash tools/render_queue_aerender.sh || true
SKIP_RENDER=1 bash tools/render_gifs.sh | tail -1
bash tools/make_previews_stills.sh
PYTHONUTF8=1 python tools/build_library_html.py | tail -1
PYTHONUTF8=1 python tools/readme_catalog.py | tail -1
