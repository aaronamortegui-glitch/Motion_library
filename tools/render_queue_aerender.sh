#!/usr/bin/env bash
# Renders the saved project's render queue with aerender (one launch, multi-frame rendering): far faster than the
# in-app queue, which can stall. Fill and save the queue first (tools/render_queue.jsx with SS_QUEUE_ONLY,
# tools/pack_demos.jsx, or tools/rebrand_queue.jsx). Usage: bash tools/render_queue_aerender.sh [project.aep]
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AEP="${1:-$ROOT/ae/motion_lab_v01.aep}"
if [ "$(uname -s)" = "Darwin" ]; then
  AER="${SS_AERENDER:-$(ls -d /Applications/Adobe\ After\ Effects\ 20*/aerender 2>/dev/null | sort | tail -1)}"; P="$AEP"
else
  AER="${SS_AERENDER:-/c/Program Files/Adobe/Adobe After Effects 2026/Support Files/aerender.exe}"; P="$(cygpath -aw "$AEP")"
fi
mkdir -p "$ROOT/research/aerender"
"$AER" -project "$P" -mfr ON 100 -sound ON > "$ROOT/research/aerender/queue.log" 2>&1
grep -c "Finished composition" "$ROOT/research/aerender/queue.log" | xargs echo "finished comps:"
grep -i "error" "$ROOT/research/aerender/queue.log" | head -5 || true   # no errors is success
