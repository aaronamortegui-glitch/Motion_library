#!/usr/bin/env bash
# Automatic pass for reference videos: energy, metrics, audio, overview contact sheets.
# Uso: bash tools/style_research/batch_auto.sh ref06 ref07 ...   (videos in references/_inbox/<id>.mp4)
# Outputs: research/batch/<id>/{energy.json,energy.png,metrics.json,audio.json,audio.png,ov_*.png}
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
PY="${PY:-/c/Users/gianc/AppData/Local/Programs/Python/Python312/python.exe}"
T=tools/style_research
for id in "$@"; do
  V=references/_inbox/$id.mp4; O=research/batch/$id; mkdir -p $O
  read -r W H FR DUR <<<"$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -show_entries format=duration -of csv=p=0 "$V" | tr '\n' ',' | tr ',' ' ')"
  FPS=$(awk -v r="$FR" 'BEGIN{split(r,a,"/"); printf "%.3f", (a[2]?a[1]/a[2]:a[1])}')
  M=$V
  if awk -v f="$FPS" 'BEGIN{exit !(f>31)}'; then
    M=$O/_30fps.mp4; ffmpeg -v error -y -i "$V" -r 30 -an -c:v libx264 -crf 18 "$M"
  fi
  "$PY" -I $T/energy.py "$M" $O/energy > $O/cuts.txt
  "$PY" -I $T/metrics.py "$M" $O/energy.json > $O/metrics.json
  "$PY" -I $T/audio.py "$V" $O/energy.json $O/audio > /dev/null
  # overview sheets: ~40 tiles per sheet, 1 sheet if short
  N=$(awk -v d="$DUR" -v f="$FPS" 'BEGIN{printf "%d", d*f}')
  if [ "$W" -lt "$H" ]; then COLS=10; TW=150; else COLS=8; TW=240; fi
  if awk -v d="$DUR" 'BEGIN{exit !(d<=30)}'; then
    STEP=$(( N/48 > 1 ? N/48 : 1 )); "$PY" -I $T/sheet.py "$V" $O/ov_1.png 0 "$DUR" $STEP $COLS $TW > /dev/null
  else
    HALF=$(awk -v d="$DUR" 'BEGIN{printf "%.2f", d/2}'); STEP=$(( N/80 > 1 ? N/80 : 1 ))
    "$PY" -I $T/sheet.py "$V" $O/ov_1.png 0 "$HALF" $STEP $COLS $TW > /dev/null
    "$PY" -I $T/sheet.py "$V" $O/ov_2.png "$HALF" "$DUR" $STEP $COLS $TW > /dev/null
  fi
  echo "$id done · ${W}x${H} @${FPS} · $(cat $O/metrics.json | cut -c1-120)"
done
