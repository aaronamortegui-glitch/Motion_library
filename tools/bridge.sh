#!/usr/bin/env bash
# Runs a .jsx in After Effects through the bridge (tools/ss_bridge.jsx must be active) and waits for the result.
# Usage: bash tools/bridge.sh tools/file.jsx [timeout_sec]
# Exits with code 1 if AE returns ERROR or does not respond in time. Starts the bridge if it is not active.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$1"; TIMEOUT="${2:-180}"
AFX="/c/Program Files/Adobe/Adobe After Effects 2026/Support Files/AfterFX.exe"
win() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
mkdir -p "$ROOT/bridge/inbox" "$ROOT/bridge/outbox"

ae_running() { tasklist //FI "IMAGENAME eq AfterFX.exe" 2>/dev/null | grep -qi afterfx; }
# AE closed (or crashed): the old marker is stale. Open AE normally first — launching it with -s runs the
# script and then quits — and only then attach the bridge.
if ! ae_running; then
  rm -f "$ROOT/bridge/outbox/_bridge_started.txt"
  PROJ="${SS_AE_PROJECT:-$ROOT/ae/motion_lab_v01.aep}"
  "$AFX" "$(cygpath -w "$PROJ" 2>/dev/null || echo "$PROJ")" >/dev/null 2>&1 &
  for ((w = 0; w < 120; w++)); do ae_running && break; sleep 2; done
  sleep 20   # let AE finish loading the project
fi
if [ ! -f "$ROOT/bridge/outbox/_bridge_started.txt" ]; then
  "$AFX" -s "\$.evalFile(new File('$(win "$ROOT/tools/ss_bridge.jsx")'))" >/dev/null 2>&1 || true
fi
name="$(date +%s%N)_$(basename "$SRC" .jsx)"
printf '$.evalFile(new File("%s"));\n' "$(win "$(cd "$(dirname "$SRC")" && pwd)/$(basename "$SRC")")" > "$ROOT/bridge/inbox/$name.jsx"
out="$ROOT/bridge/outbox/$name.txt"
for ((i = 0; i < TIMEOUT * 2; i++)); do
  [ -f "$out" ] && break
  sleep 0.5
done
[ -f "$out" ] || { echo "No response from AE in ${TIMEOUT}s (is AE open and the bridge active?)"; exit 1; }
cat "$out"; echo
head -1 "$out" | grep -q '^OK' || exit 1
