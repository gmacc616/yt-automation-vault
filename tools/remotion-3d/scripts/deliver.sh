#!/bin/bash
# Join the chunks, re-time to exactly 30 fps (concat leaves ~60 ms gaps per chunk), assert the frame count, mux the mix
# (Remotion's own silent track is dropped) and run the frame QA.
#   bash scripts/deliver.sh <CompositionId> <mix.wav> <out.mp4>
set -e
cd "$(dirname "$0")/.."
COMP=${1:?usage: deliver.sh <Comp> <mix.wav> <out.mp4>}; MIX=${2:?}; OUT=${3:?}
D=out/final/$COMP
TOTAL=$(node scripts/frames.mjs "$COMP" 2>/dev/null | tail -1)
ls $D/chunk_*.mp4 | sort | sed "s|^|file '$(pwd)/|; s|$|'|" > $D/list.txt
ffmpeg -loglevel error -y -f concat -safe 0 -i $D/list.txt -c copy $D/joined.mp4
mkdir -p "$(dirname "$OUT")"
ffmpeg -loglevel error -y -i $D/joined.mp4 -i "$MIX" -map 0:v:0 -map 1:a:0 -vf "setpts=N/(30*TB)" -r 30 -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -movflags +faststart "$OUT"
NF=$(ffprobe -v error -count_packets -select_streams v -show_entries stream=nb_read_packets -of csv=p=0 "$OUT" | tr -d ,)
[ "$NF" = "$TOTAL" ] || { echo "FRAME COUNT $NF != $TOTAL"; exit 1; }
echo "delivered $OUT: $NF frames, $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT") s"
[ -f out/shots.json ] && python3 scripts/short_qa.py "$OUT" out/qa out/shots.json | head -6 || true
