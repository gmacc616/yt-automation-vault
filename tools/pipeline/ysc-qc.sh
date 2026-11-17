#!/usr/bin/env bash
# Measured QC for /youtube-style-clip renders (section 9 of the skill). Prints PASS/FAIL per check.
#   bash tools/pipeline/ysc-qc.sh "<file.mp4>" [more.mp4 ...]
# Checks: length 10-17 s (hard max 20), cuts 0.8-1.6/s, about -14 LUFS, LRA <= 7, no silence > 0.3 s, 1080x1920.
# Visual checks (frame 1 mid-action, headline <= 6 words, captions off eyes/mouth) still need a frame review.
for f0 in "$@"; do
  f=$(cygpath -w "$f0" 2>/dev/null || echo "$f0")
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  wh=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$f" | head -1 | tr -d '\r' | sed 's/,*$//')
  cuts=$(ffmpeg -hide_banner -i "$f" -vf "select='gt(scene,0.3)',showinfo" -an -f null - 2>&1 | grep -c pts_time)
  loud=$(ffmpeg -hide_banner -nostats -i "$f" -af ebur128 -f null - 2>&1 | grep -E "^\s+(I|LRA):" | tail -2 | awk '{print $2}' | tr '\n' ' ')
  I=$(echo $loud | awk '{print $1}'); LRA=$(echo $loud | awk '{print $2}')
  sil=$(ffmpeg -hide_banner -nostats -i "$f" -af silencedetect=n=-40dB:d=0.3 -vn -f null - 2>&1 | grep -c silence_start)
  cps=$(awk -v c=$cuts -v d=$d 'BEGIN{printf "%.2f", c/d}')
  ok(){ [ "$1" = 1 ] && echo PASS || echo FAIL; }
  echo "== $(basename "$f0")"
  echo "  $(ok $(awk -v d=$d 'BEGIN{print (d>=10&&d<=20)}'))  length ${d}s (target 10-17, max 20)"
  echo "  $(ok $([ "$wh" = "1080,1920" ] && echo 1))  size $wh"
  echo "  $(ok $(awk -v c=$cps 'BEGIN{print (c>=0.8&&c<=1.6)}'))  cuts ${cuts} = ${cps}/s (target 0.8-1.6; caption pops can inflate this, confirm by eye)"
  echo "  $(ok $(awk -v i=$I 'BEGIN{print (i>=-15&&i<=-13)}'))  loudness ${I} LUFS (target -14)"
  echo "  $(ok $(awk -v l=$LRA 'BEGIN{print (l<=7)}'))  loudness range ${LRA} LU (target <= 7)"
  echo "  $(ok $([ "$sil" = 0 ] && echo 1))  silences > 0.3 s: $sil"
done
