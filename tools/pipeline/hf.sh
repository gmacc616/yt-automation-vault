#!/usr/bin/env bash
# Run the pinned HyperFrames CLI directly with node (skips ~5 s of npx startup per call).
# Falls back to npx when the pinned version isn't in the npx cache yet.
#   bash tools/pipeline/hf.sh check .        bash tools/pipeline/hf.sh render . -o out.mp4
HF_VERSION="${HF_VERSION:-0.8.157}"
NPX_DIR="${LOCALAPPDATA:-$HOME/AppData/Local}/npm-cache/_npx"
[ -d "$NPX_DIR" ] || NPX_DIR="$HOME/.npm/_npx"   # Linux / cloud sessions
# Windows has only the "py" launcher; HyperFrames' Kokoro TTS needs a real python with kokoro-onnx + soundfile.
WIN_PY="C:/Users/manth/AppData/Local/Python/pythoncore-3.14-64/python.exe"
[ -x "$WIN_PY" ] || WIN_PY=python3
export HYPERFRAMES_PYTHON="${HYPERFRAMES_PYTHON:-$WIN_PY}"
for d in "$NPX_DIR"/*/node_modules/hyperframes; do
  if [ -f "$d/package.json" ] && grep -q "\"version\": \"$HF_VERSION\"" "$d/package.json"; then
    exec node "$d/bin/hyperframes.mjs" "$@"
  fi
done
exec npx --yes "hyperframes@$HF_VERSION" "$@"
