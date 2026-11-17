#!/bin/bash
# Final render in resumable 100-frame chunks with a watchdog. Survives crashes (retries a chunk up to 3 times) and
# container restarts: the job is written to ~/.render-job, and cloud/3d-bootstrap.sh relaunches it at session start.
#   bash scripts/render.sh <CompositionId> [scale 1.3333] [chunk 100]      (from tools/remotion-3d)
#   log: out/final/<Comp>/render.log, chunks: out/final/<Comp>/chunk_NNN.mp4, then: bash scripts/deliver.sh <Comp> <mix.wav> <out.mp4>
cd "$(dirname "$0")/.."
COMP=${1:?usage: render.sh <CompositionId> [scale] [chunk]}; SCALE=${2:-1.3333}; CH=${3:-100}
export TMPDIR=/root/remotion-tmp; mkdir -p "$TMPDIR"
D=out/final/$COMP; mkdir -p "$D"
echo "cd $(pwd) && bash scripts/render.sh $COMP $SCALE $CH" > ~/.render-job
TOTAL=$(node scripts/frames.mjs "$COMP" 2>/dev/null | tail -1)
[ -n "$TOTAL" ] || { echo "composition $COMP not found"; exit 1; }
N=$(( (TOTAL + CH - 1) / CH ))
echo "$COMP: $TOTAL frames, $N chunks of $CH, scale $SCALE ($(date +%T))"
for i in $(seq 0 $((N-1))); do
  a=$(( i * CH )); b=$(( a + CH - 1 )); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  out=$D/chunk_$(printf %03d $i).mp4
  [ -f "$out" ] && continue
  for try in 1 2 3; do
    echo "chunk $i ($a-$b) try $try $(date +%T)"
    if npx remotion render src/index.ts "$COMP" "$D/tmp.mp4" --frames=$a-$b --scale "$SCALE" --gl=swangle --concurrency=1 --codec h264 --crf 16 --log=error; then
      mv "$D/tmp.mp4" "$out"; echo "chunk $i done $(date +%T)"; break
    fi
    echo "chunk $i failed (try $try)"; rm -f "$D/tmp.mp4"
    [ $try = 3 ] && { echo "FAILED chunk $i after 3 tries"; exit 1; }
  done
done
rm -f ~/.render-job
echo ALLDONE
