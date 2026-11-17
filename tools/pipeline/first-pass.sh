#!/usr/bin/env bash
# Auto first pass: long video -> transcript -> heuristic shortlist -> story-first judge pack.
#   bash tools/pipeline/first-pass.sh <video> [outdir=jobs/<name>/t] [model=base.en] [--min 8] [--max 75] [--top 40]
# Needs ffmpeg + faster-whisper. Slow on this 3.6 GB PC: run it in the background. Skips steps whose output exists.
# Then read <outdir>/judge-pack.md and write candidates.md per docs/clipping-playbook.md sec. 1.
set -e
V="$1"; [ -f "$V" ] || { echo "usage: first-pass.sh <video> [outdir] [model] [score-moments flags]"; exit 1; }
N="$(basename "${V%.*}")"; OUT="${2:-jobs/$N/t}"; MODEL="${3:-base.en}"; shift 3 2>/dev/null || shift $#
PY="${PYTHON:-C:/Users/manth/AppData/Local/Python/pythoncore-3.14-64/python.exe}"
[ -x "$PY" ] || PY=python3   # Linux / cloud sessions
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT"
[ -f "$OUT/audio.wav" ] || ffmpeg -v error -y -i "$V" -vn -ac 1 -ar 16000 -c:a pcm_s16le "$OUT/audio.wav"
[ -f "$OUT/transcript.json" ] || "$PY" "$HERE/transcribe.py" "$OUT/audio.wav" "$OUT" "$MODEL"
node "$HERE/score-moments.js" "$OUT/transcript.json" --min 8 --max 75 --top 40 "$@" --out "$OUT/shortlist.json" --pack "$OUT/judge-pack.md" | head -n 30
echo "-> $OUT/judge-pack.md"
