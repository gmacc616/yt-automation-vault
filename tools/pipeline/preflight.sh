#!/usr/bin/env bash
# Run before a job. Checks every tool the pipeline needs and clears leftovers that broke earlier jobs.
#   bash tools/pipeline/preflight.sh
# Prints OK / FIX / FAIL per item. Exit code 1 if something blocks the pipeline.
PIPE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$PIPE/../.." && pwd)"
fail=0
ok(){ echo "OK    $*"; }; fix(){ echo "FIX   $*"; }; bad(){ echo "FAIL  $*"; fail=1; }

# 1. Leftover render browsers (earlier: 34 orphaned Edge/Chrome processes ate RAM after a failed render).
#    Only processes started with a puppeteer profile are touched, never the user's own browser.
WIN=0; command -v powershell >/dev/null 2>&1 && WIN=1   # 0 = Linux / cloud session
if [ $WIN = 0 ]; then n=$(pgrep -f puppeteer_dev_chrome_profile | wc -l); pkill -f puppeteer_dev_chrome_profile 2>/dev/null
else n=$(powershell -NoProfile -Command "\$p = Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -like '*puppeteer_dev_chrome_profile*' }; \$p | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }; @(\$p).Count" 2>/dev/null | tr -d '\r'); fi
[ "${n:-0}" -gt 0 ] && fix "stopped $n leftover render-browser processes" || ok "no leftover render browsers"

# 2. Another render already running (earlier: two queues at once crashed with screenshot errors).
if [ -f "$ROOT/.render.lock" ] && kill -0 "$(cat "$ROOT/.render.lock")" 2>/dev/null; then bad "a render queue is running (pid $(cat "$ROOT/.render.lock")) - wait for it"
else rm -f "$ROOT/.render.lock"; ok "no render queue running"; fi

# 3. Tools.
AE="C:/Users/manth/OneDrive/Desktop/AutoEditor/auto-editor.exe"
[ $WIN = 0 ] && AE=auto-editor   # pip-installed in cloud sessions
v=$("$AE" --version 2>/dev/null | tr -d '\r'); [ -n "$v" ] && ok "Auto-Editor $v" || bad "Auto-Editor not runnable at $AE"
command -v ffmpeg >/dev/null && ok "ffmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3)" || bad "ffmpeg missing"
v=$(py -m yt_dlp --version 2>/dev/null | tr -d '\r')
if [ -n "$v" ]; then
  age=$(( ( $(date +%s) - $(date -d "${v:0:4}-${v:5:2}-${v:8:2}" +%s) ) / 86400 ))
  if [ "$age" -gt 45 ]; then
    py -m pip install -q -U yt-dlp >/dev/null 2>&1; nv=$(py -m yt_dlp --version 2>/dev/null | tr -d '
')
    [ "$nv" != "$v" ] && fix "yt-dlp updated $v -> $nv" || ok "yt-dlp $v (already the newest release)"
  else ok "yt-dlp $v"; fi
else bad "yt-dlp missing (py -m pip install yt-dlp)"; fi
py -c "import faster_whisper" 2>/dev/null && ok "faster-whisper" || bad "faster-whisper missing"
py -c "import qwen_tts, soundfile" 2>/dev/null && ok "Qwen3-TTS (default narrator clone_3_voicebox-qwen3)" || echo "WARN  default narrator not ready (py -m pip install qwen-tts soundfile; first run downloads ~4.5 GB; see .claude/skills/default-voice/SKILL.md)"
py -c "import mediapipe" 2>/dev/null && [ -s "$PIPE/models/blaze_face_short_range.tflite" ] && ok "face tracking (mediapipe + model)" || echo "WARN  face tracking unavailable (py -m pip install mediapipe; model in tools/pipeline/models/)"
[ -d "$HOME/.cache/huggingface/hub" ] && ls "$HOME/.cache/huggingface/hub" | grep -q whisper && ok "Whisper model cached" || echo "WARN  no Whisper model cached (first transcription downloads ~150 MB)"

# 4. Render browser can actually start (earlier: 'spawn UNKNOWN' when Smart App Control blocked it).
[ -n "$HYPERFRAMES_BROWSER_PATH" ] && echo "WARN  HYPERFRAMES_BROWSER_PATH=$HYPERFRAMES_BROWSER_PATH overrides the bundled browser (Edge fallback hung before)"
tmp=$(mktemp -d); cat > "$tmp/index.html" <<'EOF'
<!doctype html><html><head><meta charset="UTF-8"><title>pf</title><script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script></head><body style="margin:0;background:#000"><div id="root" data-composition-id="main" data-start="0" data-duration="1" data-width="320" data-height="320"><div class="clip" data-start="0" data-duration="1" data-track-index="0" style="color:#fff">ok</div></div><script>window.__timelines={};const tl=gsap.timeline({paused:true});window.__timelines["main"]=tl;</script></body></html>
EOF
out=$( cd "$tmp" && timeout 240 bash "$PIPE/hf.sh" snapshot --at 0.5 2>&1 )
if [ -n "$(find "$tmp" -name "frame-*.png" 2>/dev/null | head -1)" ]; then ok "render browser starts"
elif echo "$out" | grep -q "spawn UNKNOWN"; then bad "render browser blocked by Windows (spawn UNKNOWN) - Smart App Control or antivirus is blocking chrome-headless-shell"
else bad "render browser failed: $(echo "$out" | sed 's/\x1b\[[0-9;]*m//g' | grep -iE 'error|fail' | head -2)"; fi
sleep 2; rm -rf "$tmp" 2>/dev/null

# 5. GPU encoder used by render-shorts.sh.
ffmpeg -v error -f lavfi -i color=c=black:s=320x240:d=0.2 -c:v h264_qsv -f null - 2>/dev/null && ok "Intel QSV GPU encoding" || echo "WARN  QSV unavailable - renders fall back to CPU encoding (slower)"

# 6. Memory and disk.
if [ $WIN = 0 ]; then read totalMB freeMB < <(free -m | awk '/^Mem:/{print $2, $7}')
else read freeMB totalMB < <(powershell -NoProfile -Command "\$o=Get-CimInstance Win32_OperatingSystem; '{0} {1}' -f [int](\$o.FreePhysicalMemory/1024), [int](\$o.TotalVisibleMemorySize/1024)" | tr -d '\r'); fi
[ "$freeMB" -lt 700 ] && echo "WARN  only ${freeMB} MB RAM free of ${totalMB} - close other apps for faster renders" || ok "RAM ${freeMB} MB free"
if [ $WIN = 0 ]; then freeGB=$(df -BG --output=avail "$ROOT" | tail -1 | tr -dc '0-9')
else freeGB=$(powershell -NoProfile -Command "[int]((Get-PSDrive C).Free/1GB)" | tr -d '\r'); fi
[ "$freeGB" -lt 8 ] && bad "only ${freeGB} GB disk free on C: - run /cleanup-project" || ok "disk ${freeGB} GB free"
cache=$(du -sm "$TEMP/hyperframes-extract-cache-u" 2>/dev/null | cut -f1)
[ "${cache:-0}" -gt 1500 ] && echo "WARN  frame cache is ${cache} MB - /cleanup-project clears it" || ok "frame cache ${cache:-0} MB"

[ $fail -eq 0 ] && echo "READY" || echo "NOT READY"
exit $fail
