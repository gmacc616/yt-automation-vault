"""Splice re-rendered frame ranges into a full render (both already motion-blurred at 30 fps).
Usage: python3 audio/splice.py full.mp4 seg.mp4 '[[a,b],...]' out.mp4   (ranges = inclusive output frames, in order)"""
import json, subprocess, sys

full, seg, ranges, out = sys.argv[1], sys.argv[2], json.loads(sys.argv[3]), sys.argv[4]
n = int(subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", full], capture_output=True, text=True).stdout.strip())
parts, labels, cur, off = [], [], 0, 0
for k, (a, b) in enumerate(ranges):
    if a > cur:
        parts.append(f"[0:v]trim=start_frame={cur}:end_frame={a},setpts=PTS-STARTPTS[f{k}]")
        labels.append(f"[f{k}]")
    parts.append(f"[1:v]trim=start_frame={off}:end_frame={off + b - a + 1},setpts=PTS-STARTPTS[s{k}]")
    labels.append(f"[s{k}]")
    off += b - a + 1
    cur = b + 1
if cur < n:
    parts.append(f"[0:v]trim=start_frame={cur}:end_frame={n},setpts=PTS-STARTPTS[fe]")
    labels.append("[fe]")
fc = ";".join(parts) + ";" + "".join(labels) + f"concat=n={len(labels)}:v=1:a=0[v]"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", full, "-i", seg, "-filter_complex", fc, "-map", "[v]", "-r", "30", "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", out], check=True)
print("spliced", len(ranges), "ranges into", out)
