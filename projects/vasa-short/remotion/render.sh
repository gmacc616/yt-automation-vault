#!/bin/bash
# chunked final render (resumable): each chunk is skipped when its mp4 exists
cd /root/remotion-3d
export TMPDIR=/root/remotion-tmp
TOTAL=2025; N=10; STEP=$(( (TOTAL + N - 1) / N ))
for i in $(seq 0 $((N-1))); do
  a=$(( i * STEP )); b=$(( a + STEP - 1 )); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  out=out/final/chunk_$i.mp4
  [ -f $out ] && continue
  echo "chunk $i $a-$b start $(date +%T)"
  npx remotion render src/index.ts VasaShort out/final/tmp_$i.mp4 --frames=$a-$b --scale 1.3333 --gl=swangle --concurrency=1 --codec h264 --crf 16 --log=error && mv out/final/tmp_$i.mp4 $out && echo "chunk $i done $(date +%T)" || { echo "chunk $i FAILED"; exit 1; }
done
echo ALLDONE
