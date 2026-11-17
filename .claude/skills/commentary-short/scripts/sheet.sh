#!/usr/bin/env bash
# Timecoded contact sheet of a source clip, for picking shot in-points and spotting banners/wipes.
#   bash sheet.sh <video> <out.png> [every_seconds=3] [start=0] [length=all]
# Use every=0.25 over a short window to find network wipe transitions before choosing an in-point.
v="$1"; out="$2"; step="${3:-3}"; ss="${4:-0}"; len="${5:-}"
fps=$(awk -v s="$step" 'BEGIN{print 1/s}')
ffmpeg -hide_banner -v error -y -ss "$ss" ${len:+-t "$len"} -i "$v" \
  -vf "fps=$fps,scale=200:-2,drawtext=text='%{pts\:flt\:$ss}':x=2:y=2:fontsize=12:fontcolor=yellow:box=1:boxcolor=black,tile=10x8" \
  -frames:v 1 "$out" 2>&1 | grep -v Fontconfig
echo "$out"
