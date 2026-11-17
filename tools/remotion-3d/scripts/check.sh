#!/bin/bash
# bash scripts/check.sh <video folder> [step]  -> typecheck + logic/lens/subject check of every frame (see check.ts)
set -e
cd "$(dirname "$0")/.."
V=${1:?usage: check.sh <video folder under src/videos>}; export STEP=${2:-3}
npx tsc --noEmit 2>&1 | grep "src/videos/$V/" | grep -v "TS2322" && { echo "TYPE ERRORS"; exit 1; } || true
mkdir -p out
npx esbuild scripts/check.ts --bundle --platform=node --format=esm --outfile=out/check.mjs --log-level=error \
  --alias:@video=./src/videos/$V --alias:remotion=./scripts/remotion-shim.ts --inject:scripts/canvas-stub.js
node out/check.mjs
