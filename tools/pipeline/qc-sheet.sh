#!/usr/bin/env bash
# Verify finished shorts and build a contact sheet for a visual check.
#   bash tools/pipeline/qc-sheet.sh "<output folder>" [seconds=1.2,8,18]
# For every MP4: resolution, duration, decode errors, loudness (-14 +/-1 LUFS).
# The contact sheet goes to %TEMP% (never into the output folder); its path is printed.
dir="$1"; times="${2:-1.2,8,18}"
tmp=$(mktemp -d); i=0; bad=0
for f0 in "$dir"/*.mp4; do f=$(cygpath -w "$f0")
  wh=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$f" | head -1 | tr -d '' | sed 's/,*$//')
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  errs=$(ffmpeg -v error -i "$f" -f null - 2>&1 | wc -l)
  lufs=$(ffmpeg -hide_banner -nostats -i "$f" -af ebur128 -f null - 2>&1 | grep -E "^\s+I:" | tail -1 | awk '{print $2}')
  flag=""; [ "$wh" != "1080,1920" ] && flag+=" WRONG-SIZE"; [ "$errs" -gt 0 ] && flag+=" DECODE-ERRORS"
  awk -v l="$lufs" 'BEGIN{exit !(l < -15 || l > -13)}' && flag+=" LOUDNESS"
  [ -n "$flag" ] && bad=1
  printf "%-6s %s  %5.1fs  %s LUFS  %s\n" "${flag:+FAIL}${flag:-OK}" "$wh" "$d" "$lufs" "$(basename "$f0")"
  [ -n "$flag" ] && echo "       ->$flag"
  row=()
  for t in ${times//,/ }; do
    awk -v t="$t" -v d="$d" 'BEGIN{exit !(t < d)}' || t=$(awk -v d="$d" 'BEGIN{print d-0.5}')
    ffmpeg -v error -y -ss "$t" -i "$f" -frames:v 1 -vf scale=216:384 "$tmp/r${i}_$t.png" && row+=("$tmp/r${i}_$t.png")
  done
  ffmpeg -v error -y $(printf -- '-i %s ' "${row[@]}") -filter_complex "hstack=inputs=${#row[@]}" "$tmp/row$i.png"
  i=$((i+1))
done
rows=(); for ((k=0;k<i;k++)); do rows+=("$tmp/row$k.png"); done
sheet="${TEMP:-/tmp}/qc_$(basename "$dir" | tr ' ' '_').jpg"
if [ $i -gt 1 ]; then ffmpeg -v error -y $(printf -- '-i %s ' "${rows[@]}") -filter_complex "vstack=inputs=$i" "$sheet"; else cp "${rows[0]}" "$sheet"; fi
rm -rf "$tmp"
echo "sheet: $sheet  (rows = files in the order above, columns = ${times})"
exit $bad
