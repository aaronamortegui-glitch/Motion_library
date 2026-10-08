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
