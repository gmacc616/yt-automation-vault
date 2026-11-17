#!/usr/bin/env bash
# Render a folder of HyperFrames shorts (clipNN/ each with index.html) to caption-named MP4s.
#   bash tools/pipeline/render-shorts.sh <projectDir> "<output subfolder>" [clip01 clip02 ...]
# Speed settings (benchmarked 2026-10-10 on this 3.6 GB i5 laptop, 6 s test clip):
#   npx 1 worker CPU encode 62 s  ->  direct node, 2 workers, Intel QSV encode 37 s (SSIM 0.994).
# Each clip falls back to 1 worker + CPU encode if the fast render fails (e.g. low RAM).
# Never overwrites: an existing output is skipped. Audio is two-pass loudnormed to -14 LUFS / -1.5 dBTP.
set -u
PIPE="$(cd "$(dirname "$0")" && pwd)"
PROJ="$(cd "$1" && pwd)"
OUT="$2"; shift 2
mkdir -p "$OUT"; OUT="$(cd "$OUT" && pwd)"
CLIPS=("$@"); [ ${#CLIPS[@]} -eq 0 ] && CLIPS=($(cd "$PROJ" && ls -d clip* | sort))
LOG="$PROJ/render.log"
# One render queue at a time: two queues at once ran out of memory and failed before.
LOCK="$PIPE/../../.render.lock"
if [ -f "$LOCK" ] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then echo "another render queue is running (pid $(cat "$LOCK")); not starting"; exit 1; fi
echo $$ > "$LOCK"; trap 'rm -f "$LOCK"' EXIT
echo "start $(date)" >> "$LOG"

for c in "${CLIPS[@]}"; do
  dir="$PROJ/$c"
  title=$(sed -n 's:.*<title>\(.*\)</title>.*:\1:p' "$dir/index.html" | head -1 |
    sed 's/&amp;/\&/g; s/&lt;/</g; s/&gt;/>/g' | tr '\\/:*?"<>|' '_________')
  final="$OUT/$title.mp4"
  if [ -e "$final" ]; then echo "$c: exists, skipped -> $title.mp4" | tee -a "$LOG"; continue; fi
  raw="$dir/raw.mp4"; rm -f "$raw"
  t0=$(date +%s)
  ( cd "$dir" && bash "$PIPE/hf.sh" render . --workers 2 --gpu --fps 30 --quality high -o "$raw" ) > "$dir/render_out.txt" 2>&1
  if [ ! -s "$raw" ]; then
    echo "$c: fast render failed, retrying 1 worker / CPU encode" | tee -a "$LOG"
    ( cd "$dir" && bash "$PIPE/hf.sh" render . --workers 1 --fps 30 --quality high -o "$raw" ) >> "$dir/render_out.txt" 2>&1
  fi
  if [ ! -s "$raw" ]; then echo "$c: RENDER FAILED (see $dir/render_out.txt)" | tee -a "$LOG"; continue; fi

  # Two-pass loudness normalization; video is copied untouched.
  raw_w=$(cygpath -w "$raw")
  m=$(ffmpeg -hide_banner -nostats -i "$raw_w" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
  g(){ echo "$m" | grep "\"$1\"" | sed -E 's/.*: "?([^",]*)"?,?/\1/'; }
  if [[ "$(g input_i)" =~ ^-?[0-9.]+$ ]]; then
    ffmpeg -v error -y -i "$raw_w" -c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart \
      -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true" \
      "$(cygpath -w "$final")"
  else
    # Silent or unmeasurable audio (loudnorm reports -inf): copy as-is instead of failing.
    echo "$c: audio is silent/unmeasurable, loudness normalization skipped" | tee -a "$LOG"
    ffmpeg -v error -y -i "$raw_w" -c copy -movflags +faststart "$(cygpath -w "$final")"
  fi
  # Git Bash does not translate /c/... paths for Windows programs when the name has a comma,
  # hence the explicit cygpath; only report success when the file is really there.
  if [ -s "$final" ]; then rm -f "$raw"; echo "$c: done $(( $(date +%s)-t0 ))s -> $title.mp4" | tee -a "$LOG"
  else echo "$c: LOUDNESS/WRITE FAILED, render kept at $raw" | tee -a "$LOG"; fi
done
echo "ALL DONE $(date)" | tee -a "$LOG"
