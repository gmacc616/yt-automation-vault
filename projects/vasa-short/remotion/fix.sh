#!/bin/bash
# re-render the stretches where the lens passes had been switched on mid-chunk (over-blurred), resumable
cd /root/remotion-3d; export TMPDIR=/root/remotion-tmp
for r in 175-202 307-405 710-811 1168-1217 1675-1764 1909-2024; do
  o=out/fix/seg_$r.mp4; [ -f $o ] && continue
  echo "seg $r start $(date +%T)"
  for t in 1 2 3; do
    npx remotion render src/index.ts VasaShort out/fix/tmp.mp4 --frames=$r --scale 1.3333 --gl=swangle --concurrency=1 --codec h264 --crf 16 --log=error && { mv out/fix/tmp.mp4 $o; echo "seg $r done $(date +%T)"; break; }
    echo "seg $r failed try $t"; [ $t = 3 ] && { echo FAILED; exit 1; }
  done
done
echo ALLDONE
