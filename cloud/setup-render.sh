#!/usr/bin/env bash
# Render-only CI setup.   bash cloud/setup-render.sh <hyperframes|cartoon-audio|remotion>
# Needs Node 22+ already on PATH (actions/setup-node). Skips every extra (Kokoro, torch, mediapipe).
set -e
ENGINE="${1:?usage: setup-render.sh hyperframes|cartoon-audio|remotion}"
SUDO=""; [ "$(id -u)" = 0 ] || SUDO="sudo"
node -v | grep -qE '^v(2[2-9]|[3-9][0-9])' || { echo "Node 22+ required (use actions/setup-node)"; exit 1; }
$SUDO apt-get update -qq
$SUDO apt-get install -y -qq ffmpeg fonts-dejavu-core python3 >/dev/null
case "$ENGINE" in
  hyperframes)  # skills: viral-shorts, youtube-style-clip, gab, puregrit and the other HyperFrames skills (tools/pipeline/render-shorts.sh)
    printf '#!/bin/sh\nexec python3 "$@"\n' | $SUDO tee /usr/local/bin/py >/dev/null
    printf '#!/bin/sh\nfor a; do :; done; printf "%%s\\n" "$a"\n' | $SUDO tee /usr/local/bin/cygpath >/dev/null
    $SUDO chmod +x /usr/local/bin/py /usr/local/bin/cygpath
    npx --yes hyperframes@0.8.157 --version
    npx --yes hyperframes@0.8.157 browser ensure ;;
  cartoon-audio)  # skill: cartoon-audio-short (kit: three.js in headless Chromium, software WebGL)
    $SUDO apt-get install -y -qq python3-numpy python3-pil >/dev/null
    npx --yes playwright@1.63.0 install --with-deps chromium ;;
  remotion)  # skills: 3d-short, cartoon-3d-short (npx remotion render); the project's own npm ci runs in the workflow
    $SUDO apt-get install -y -qq libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libgbm1 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libasound2t64 libpango-1.0-0 libcairo2 >/dev/null || true ;;
  *) echo "unknown engine: $ENGINE"; exit 1 ;;
esac
