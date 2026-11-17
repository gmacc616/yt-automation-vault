#!/usr/bin/env bash
# Start a long command so it keeps running even if the Claude session restarts
# (earlier, session restarts killed background renders/transcriptions mid-way).
#   bash tools/pipeline/run-detached.sh <logfile> <command...>
# Output goes to <logfile>; the last line is "EXIT <code>" when it finishes.
log="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; shift
cmd=$(printf '%q ' "$@")
script=$(mktemp --suffix=.sh)
printf 'cd %q\n%s >> %q 2>&1\necho "EXIT $?" >> %q\nrm -f %q\n' "$PWD" "$cmd" "$log" "$log" "$script" > "$script"
if command -v powershell >/dev/null 2>&1; then
  bash_exe=$(cygpath -w "$(command -v bash)")
  powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath '$bash_exe' -ArgumentList '$(cygpath -m "$script")'"
else  # Linux / cloud sessions
  setsid nohup bash "$script" >/dev/null 2>&1 < /dev/null &
fi
echo "started detached; log: $log"
