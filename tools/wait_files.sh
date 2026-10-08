#!/usr/bin/env bash
# Waits until all files listed in a list exist (and stop growing). Usage: wait_files.sh list.txt [timeout_s]
LIST="$1"; T="${2:-900}"
[ -f "$LIST" ] || exit 0
for ((i = 0; i < T; i += 2)); do
  ok=1
  while IFS= read -r f || [ -n "$f" ]; do
    f="${f%$'\r'}"; [ -z "$f" ] && continue
    u=$(cygpath -u "$f" 2>/dev/null || echo "$f")
    [ -s "$u" ] || { ok=0; break; }
  done < "$LIST"
  [ $ok = 1 ] && { sleep 2; echo "render complete"; exit 0; }
  sleep 2
done
echo "timeout waiting for renders"; exit 1
