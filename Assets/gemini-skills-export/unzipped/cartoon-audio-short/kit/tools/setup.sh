#!/usr/bin/env bash
# Creates a new short project:  bash tools/setup.sh <project_dir>
# Needs: node >= 22.6 (type stripping), python3 (or py on Windows) + numpy, ffmpeg, Playwright Chromium (npx playwright install chromium if missing).
# Works offline when kit/vendor/ has three.module.js + toon.ts (shipped); otherwise falls back to npm / git.
set -e
KIT="$(cd "$(dirname "$0")/.." && pwd)"; P="${1:?project dir}"
mkdir -p "$P/web/lib" "$P/work" "$P/stills" "$P/out"; P="$(cd "$P" && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
winpath() { command -v cygpath >/dev/null 2>&1 && cygpath -m "$1" || echo "$1"; }  # Windows node can't read /c/... paths
cp "$KIT"/engine/*.js "$KIT"/engine/index.html "$P/web/"
cp "$KIT"/example/soldier/story.js "$P/web/story.js"        # starting point: rewrite for the new story
cp "$KIT"/example/soldier/audio.py "$P/audio.py"            # starting point: rewrite the cue table
cp "$KIT"/tools/*.mjs "$KIT"/tools/*.py "$KIT"/tools/finish.sh "$P/"
# three.js r160 (module build): vendored copy, then npm, then a sparse git clone.
if [ ! -f "$P/web/lib/three.module.js" ]; then
  if [ -f "$KIT/vendor/three.module.js" ]; then cp "$KIT/vendor/three.module.js" "$P/web/lib/"
  else
    ( cd "$TMP" && npm pack three@0.160.0 >/dev/null 2>&1 && tar xzf three-0.160.0.tgz && cp package/build/three.module.js "$P/web/lib/" ) \
    || ( cd "$TMP" && git clone -q --depth 1 --filter=blob:none --sparse --branch r160 https://github.com/mrdoob/three.js _t3 && cd _t3 && git sparse-checkout set build && cp build/three.module.js "$P/web/lib/" )
  fi
fi
# toon base: the Pen / head / face library from mromidev/claude-animated-shorts (MIT), types stripped
if [ ! -f "$KIT/vendor/toon.ts" ]; then
  git clone -q --depth 1 https://github.com/mromidev/claude-animated-shorts "$TMP/_cas"
  mkdir -p "$KIT/vendor"; cp "$TMP/_cas/templates/bridge/toon.ts" "$KIT/vendor/toon.ts"
fi
SRC="$(winpath "$KIT/vendor/toon.ts")" DST="$(winpath "$P/web/toonbase.js")" node -e "const m=require('node:module'),fs=require('fs');fs.writeFileSync(process.env.DST,m.stripTypeScriptTypes(fs.readFileSync(process.env.SRC,'utf8'),{mode:'transform'}))"
[ -s "$P/web/toonbase.js" ] || { echo "setup: toonbase.js is empty (node >= 22.6 needed for stripTypeScriptTypes)"; exit 1; }
cat "$P/web/toonbase.js" "$P/web/roman.js" > "$P/web/toon.js"
# playwright: link a global install if there is one, else install it into the project
if [ ! -e "$P/node_modules/playwright" ]; then
  G="$(npm root -g)/playwright"
  if [ -d "$G" ]; then mkdir -p "$P/node_modules"; ln -sf "$G" "$P/node_modules/playwright"
  else ( cd "$P" && npm i --no-save --no-audit --no-fund playwright >/dev/null ); fi
fi
echo "ready: $P   (after editing cast code run: cat web/toonbase.js web/roman.js > web/toon.js)"
