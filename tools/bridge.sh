#!/usr/bin/env bash
# Runs a .jsx in After Effects through the bridge (tools/ss_bridge.jsx must be active) and waits for the result.
# Usage: bash tools/bridge.sh tools/file.jsx [timeout_sec]
# Exits with code 1 if AE returns ERROR or does not respond in time. Starts AE and the bridge if they are not running.
# Works on Windows (Git Bash) and macOS. Overrides: SS_AFTERFX (Windows AfterFX.exe), SS_AE_APP (macOS app name,
# e.g. "Adobe After Effects 2026"), SS_AE_PROJECT (project to open when AE is closed).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$1"; TIMEOUT="${2:-180}"
mkdir -p "$ROOT/bridge/inbox" "$ROOT/bridge/outbox"

if [ "$(uname -s)" = "Darwin" ]; then
  # newest installed version unless SS_AE_APP says otherwise
  AE_APP="${SS_AE_APP:-$(ls -d /Applications/Adobe\ After\ Effects\ 20*/ 2>/dev/null | sort | tail -1 | xargs -I{} basename {})}"
  [ -n "$AE_APP" ] || { echo "After Effects not found in /Applications (set SS_AE_APP)"; exit 1; }
  native() { echo "$1"; }
  ae_running() { pgrep -f "$AE_APP.app/Contents/MacOS" >/dev/null 2>&1 || pgrep -x "After Effects" >/dev/null 2>&1; }
  ae_open() { open -a "$AE_APP" "$1"; }
  ae_script() { osascript -e "tell application \"$AE_APP\" to DoScriptFile \"$1\"" >/dev/null 2>&1; }
  ae_poll() { osascript -e "tell application \"$AE_APP\" to DoScript \"if (\$.global.SS_BRIDGE_POLL) \$.global.SS_BRIDGE_POLL();\"" >/dev/null 2>&1; }
else
  AFX="${SS_AFTERFX:-/c/Program Files/Adobe/Adobe After Effects 2026/Support Files/AfterFX.exe}"
  native() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
  ae_running() { tasklist //FI "IMAGENAME eq AfterFX.exe" 2>/dev/null | grep -qi afterfx; }
  ae_open() { "$AFX" "$(cygpath -w "$1" 2>/dev/null || echo "$1")" >/dev/null 2>&1 & }
  ae_script() { "$AFX" -s "\$.evalFile(new File('$1'))" >/dev/null 2>&1; }
  ae_poll() { "$AFX" -s "if (\$.global.SS_BRIDGE_POLL) \$.global.SS_BRIDGE_POLL();" >/dev/null 2>&1; }
fi

# AE closed (or crashed): the old marker is stale. Open AE normally first (on Windows, launching a closed AE with
# -s runs the script and then quits), and only then attach the bridge.
if ! ae_running; then
  rm -f "$ROOT/bridge/outbox/_bridge_started.txt"
  ae_open "${SS_AE_PROJECT:-$ROOT/ae/motion_lab_v01.aep}"
  for ((w = 0; w < 120; w++)); do ae_running && break; sleep 2; done
  sleep 20   # let AE finish loading the project
fi
if [ ! -f "$ROOT/bridge/outbox/_bridge_started.txt" ]; then
  ae_script "$(native "$ROOT/tools/ss_bridge.jsx")" || true
fi
name="$(date +%s)_$$_${RANDOM}_$(basename "$SRC" .jsx)"   # no %N: BSD date (macOS) does not support it
printf '$.evalFile(new File("%s"));\n' "$(native "$(cd "$(dirname "$SRC")" && pwd)/$(basename "$SRC")")" > "$ROOT/bridge/inbox/$name.jsx"
out="$ROOT/bridge/outbox/$name.txt"
for ((i = 0; i < TIMEOUT * 2; i++)); do
  [ -f "$out" ] && break
  # AE sometimes stops firing scheduled tasks (the bridge's poll) while scripts still run: after 15 s with the job
  # untouched in the inbox, run one poll ourselves (it executes the job synchronously).
  if (( i > 0 && i % 30 == 0 )) && [ -f "$ROOT/bridge/inbox/$name.jsx" ]; then ae_poll || true; fi
  sleep 0.5
done
[ -f "$out" ] || { echo "No response from AE in ${TIMEOUT}s (is AE open and the bridge active?)"; exit 1; }
cat "$out"; echo
head -1 "$out" | grep -q '^OK' || exit 1
