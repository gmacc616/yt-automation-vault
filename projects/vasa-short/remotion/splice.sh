#!/bin/bash
# replace frame ranges of the joined render with re-rendered segments, frame-accurate, then mux the mix
set -e
cd /root/remotion-3d/out/fix
J=/home/user/yt-automation-vault/tools/remotion-3d/out/final/VasaShort/joined.mp4
SEGS=(175-202 307-405 710-811 1168-1217 1675-1764 1909-2024); TOTAL=2025
inputs="-i $J"; f="[0:v]setpts=N/(30*TB),split=$(( ${#SEGS[@]} + 1 ))"; for k in $(seq 0 ${#SEGS[@]}); do f="$f[o$k]"; done; f="$f;"
parts=""; prev=0; k=0
for s in "${SEGS[@]}"; do
  a=${s%-*}; b=${s#*-}
  inputs="$inputs -i seg_$s.mp4"
  f="$f[o$k]trim=start_frame=$prev:end_frame=$a,setpts=PTS-STARTPTS[g$k];[$((k+1)):v]setpts=N/(30*TB)[n$k];"
  parts="$parts[g$k][n$k]"; prev=$((b+1)); k=$((k+1))
done
f="$f[o$k]trim=start_frame=$prev:end_frame=$TOTAL,setpts=PTS-STARTPTS[g$k];${parts}[g$k]concat=n=$(( 2*k + 1 )):v=1:a=0,fps=30[v]"
OUT=/home/user/ai-video-editor/output/vasa-short/vasa_short_2k.mp4
ffmpeg -loglevel error -y $inputs -i /root/vasa-short/audio/mix.wav -filter_complex "$f" -map "[v]" -map $((k+1)):a -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart $OUT
ffprobe -v error -count_packets -show_entries stream=codec_type,nb_read_packets,duration -of compact $OUT
