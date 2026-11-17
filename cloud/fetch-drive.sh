#!/usr/bin/env bash
# Download a source video the user shared on Google Drive ("Anyone with the link → Viewer").
# Works for big files: skips Drive's "too large to scan for viruses" page.
#   bash cloud/fetch-drive.sh <drive link or file id> [out file]   # default: downloads/<Drive file name>
#   bash cloud/fetch-drive.sh --check <drive link or file id>      # name + size only, no download
set -euo pipefail
CHECK=0; [ "${1:-}" = "--check" ] && { CHECK=1; shift; }
SRC="${1:?usage: fetch-drive.sh [--check] <drive link or file id> [out file]}"

# Accept .../file/d/<id>/view, ...?id=<id>, or a bare id.
ID=$(printf '%s' "$SRC" | sed -nE 's#.*/d/([A-Za-z0-9_-]+).*#\1#p; s#.*[?&]id=([A-Za-z0-9_-]+).*#\1#p' | head -1)
[ -n "$ID" ] || ID="$SRC"
[[ "$ID" =~ ^[A-Za-z0-9_-]{20,}$ ]] || { echo "Not a Google Drive link or file id: $SRC" >&2; exit 1; }
URL="https://drive.usercontent.google.com/download?id=$ID&export=download&confirm=t"

head=$(curl -fsIL "$URL" | tr -d '\r') || { echo "Drive refused the request (deleted file, or network access blocks drive.usercontent.google.com)." >&2; exit 1; }
type=$(printf '%s\n' "$head" | grep -i '^content-type:' | tail -1 | cut -d' ' -f2-)
size=$(printf '%s\n' "$head" | grep -i '^content-length:' | tail -1 | awk '{print $2}')
name=$(printf '%s\n' "$head" | grep -i '^content-disposition:' | tail -1 | sed -nE 's/.*filename="([^"]+)".*/\1/p')
case "$type" in text/html*) echo "Drive returned a web page, not the file: it isn't shared as 'Anyone with the link'." >&2; exit 1;; esac
echo "Drive file: ${name:-unknown name}, ${size:-unknown} bytes"
[ "$CHECK" = 1 ] && exit 0

OUT="${2:-downloads/${name:-drive_$ID.mp4}}"
mkdir -p "$(dirname "$OUT")"
curl -fL --retry 3 -o "$OUT" "$URL"
got=$(wc -c < "$OUT" | tr -d ' ')
[ -z "$size" ] || [ "$got" = "$size" ] || { echo "Incomplete download: $got of $size bytes" >&2; exit 1; }
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT" >/dev/null || { echo "Downloaded file is not a playable video: $OUT" >&2; exit 1; }
echo "saved $OUT ($got bytes, $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT" | cut -d. -f1) s)"
