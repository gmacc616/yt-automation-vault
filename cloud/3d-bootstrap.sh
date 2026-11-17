#!/usr/bin/env bash
# Cloud bootstrap for the 3D shorts (3d-short, cartoon-3d-short): run in the background at session start by
# ai-video-editor/cloud/session-start.sh. Idempotent; log /root/3d-bootstrap.log; touches /root/.3d-ready when done.
#   - tools/remotion-3d: npm ci (pinned Remotion + three.js kit, see its README)
#   - Kenney CC0 models: committed in tools/remotion-3d/public/bridge/kenney (master copy Assets/kenney; kenney.nl blocks cloud downloads)
#   - default voice engine: /root/qwen-venv with CPU-only torch/torchaudio pinned (PyPI's default pulls a CUDA torchaudio)
#   - Mesa EGL for headless Chrome; resumes an unfinished final render (~/.render-job, written by scripts/render.sh)
V="$(cd "$(dirname "$0")/.." && pwd)"
K="$V/tools/remotion-3d"
rm -f /root/.3d-ready
echo "3d-bootstrap start $(date +%T)"
if [ ! -d "$K/node_modules/remotion" ]; then (cd "$K" && npm ci --no-audit --no-fund --loglevel=error) || echo "WARN: npm ci failed in $K"; fi
mkdir -p "$K/public/bridge"
if ls "$K"/public/bridge/kenney/*.glb >/dev/null 2>&1; then :  # committed with the project (the coldframe cloud render needs them there)
elif ls "$V"/Assets/kenney/*.glb >/dev/null 2>&1; then ln -sfn "$V/Assets/kenney" "$K/public/bridge/kenney"; else echo "NOTE: no Kenney models in $V/Assets/kenney (trees/lanterns/stalls fall back to the procedural town)"; fi
VENV=/root/qwen-venv
if ! "$VENV/bin/python" -c "import qwen_tts, torchaudio, faster_whisper, scipy" 2>/dev/null; then
  python3 -m venv "$VENV" && "$VENV/bin/pip" install -q --upgrade pip \
  && "$VENV/bin/pip" install -q "torch==2.11.0" "torchaudio==2.11.0" --index-url https://download.pytorch.org/whl/cpu \
  && "$VENV/bin/pip" install -q qwen-tts soundfile numpy scipy faster-whisper \
  && "$VENV/bin/pip" install -q --force-reinstall --no-deps "torch==2.11.0" "torchaudio==2.11.0" --index-url https://download.pytorch.org/whl/cpu \
  || echo "WARN: voice engine install failed"
fi
[ -n "$(ls /usr/lib/x86_64-linux-gnu/libEGL.so* 2>/dev/null)" ] || apt-get install -y -qq libegl1 libgles2 >/dev/null 2>&1 || true
if [ -f ~/.render-job ] && ! pgrep -f "scripts/render.sh" >/dev/null; then
  echo "resuming render: $(cat ~/.render-job)"; setsid nohup bash -c "$(cat ~/.render-job)" >> /root/render-resume.log 2>&1 < /dev/null &
fi
touch /root/.3d-ready
echo "3d-bootstrap done $(date +%T)"
