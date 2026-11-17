"""Render one /gab clip in the reference style: black 1080x1920 canvas, static white headline at the top,
source footage centred as a wide band, optional approved logo over the lower-left of the footage, no captions.

Usage:
  py tools/pipeline/gab-render.py --src SOURCE.mp4 --seg 61.20-75.80 [--seg 80.10-92.40 ...]
      --headline "Bro goes on a blind date 😭" --out output/gab/<source>/<name>.mp4
      [--words transcript.json --max-pause 0.9] [--cx 0.5] [--aspect 1.27] [--logo assets/gab/draftkings-d.png]

- Segments are source seconds, played in order with clean hard cuts (a 12 ms audio fade at each edge, no clicks).
- --words + --max-pause: inside each segment, silences longer than max-pause (word gap) are shortened to 0.3 s.
  Use a larger value (or omit --words) when a pause is part of the joke.
- --aspect: width/height of the footage band (reference ≈ 1.27, a gentle centre crop of 16:9). Use 1.78 to keep
  the full 16:9 frame. --cx moves the crop centre (0-1) so people stay in frame.
- The headline card is rendered by HyperFrames (Chrome: real fonts and colour emoji); ffmpeg composites the
  footage on top. Never overwrites an existing --out. Loudness: two-pass -14 LUFS / -1.5 dBTP.
"""
import argparse, json, os, re, subprocess, sys, tempfile, html as H

HERE = os.path.dirname(os.path.abspath(__file__))
W, CANVAS_H, BAND_W, BAND_CY = 1080, 1920, 1056, 1068   # measured from the reference (scaled to 1080x1920)

ap = argparse.ArgumentParser()
ap.add_argument("--src", required=True); ap.add_argument("--out", required=True)
ap.add_argument("--seg", action="append", required=True); ap.add_argument("--headline", required=True)
ap.add_argument("--words"); ap.add_argument("--max-pause", type=float, default=0.9)
ap.add_argument("--cx", type=float, default=0.5); ap.add_argument("--aspect", type=float, default=1.27)
ap.add_argument("--logo"); ap.add_argument("--fps", type=float, default=30)
a = ap.parse_args()
if os.path.exists(a.out): sys.exit(f"exists, not overwriting: {a.out}")
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
if a.logo and not os.path.exists(a.logo): sys.exit(f"logo not found: {a.logo}")

def probe(path, entries):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", entries, "-of", "json", path],
                       capture_output=True, text=True, check=True)
    return json.loads(r.stdout)

# 1) Keep-ranges: segments, minus long silences inside them (from word timings).
segs = []
for s in a.seg:
    x, y = (float(v) for v in s.split("-"))
    assert y > x, f"bad segment {s}"
    segs.append((x, y))
if a.words:
    words = sorted(json.load(open(a.words, encoding="utf-8")), key=lambda w: w["start"])
    keep = []
    for x, y in segs:
        inside = [w for w in words if w["end"] > x and w["start"] < y]
        cur = x
        for p, n in zip(inside, inside[1:]):
            if n["start"] - p["end"] > a.max_pause:
                keep.append((cur, p["end"] + 0.15)); cur = n["start"] - 0.15
        keep.append((cur, y))
    segs = keep

# 2) Headline card (+ logo) via HyperFrames snapshot.
st = probe(a.src, "stream=width,height")["streams"][0]
sw, sh = st["width"], st["height"]
band_h = round(BAND_W / a.aspect / 2) * 2
band_top = BAND_CY - band_h // 2
crop_w = min(sw, round(sh * a.aspect / 2) * 2)
crop_h = min(sh, round(crop_w / a.aspect / 2) * 2)
crop_x = max(0, min(sw - crop_w, round(a.cx * sw - crop_w / 2)))
crop_y = (sh - crop_h) // 2

tmp = tempfile.mkdtemp(prefix="gab_")
open(os.path.join(tmp, "index.html"), "w", encoding="utf-8").write(f'''<!doctype html><html><head><meta charset="UTF-8"><title>card</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>*{{margin:0;padding:0;box-sizing:border-box}} html,body{{width:{W}px;height:{CANVAS_H}px;overflow:hidden;background:#000}}
#root{{position:relative;width:{W}px;height:{CANVAS_H}px;background:#000}}
.hl{{position:absolute;left:70px;right:70px;bottom:{CANVAS_H - band_top + 42}px;text-align:center;color:#fff;
font-family:"Helvetica Neue",Helvetica,Arial,"Segoe UI Emoji",sans-serif;font-weight:500;font-size:60px;line-height:1.2}}</style></head>
<body><div id="root" data-composition-id="main" data-start="0" data-duration="1" data-width="{W}" data-height="{CANVAS_H}">
<div class="clip" data-start="0" data-duration="1" data-track-index="0"><div class="hl">{H.escape(a.headline)}</div></div></div>
<script>window.__timelines={{}};window.__timelines["main"]=gsap.timeline({{paused:true}});</script></body></html>''')
r = subprocess.run(["bash", os.path.join(HERE, "hf.sh"), "snapshot", "--at", "0.5"], cwd=tmp, capture_output=True, text=True)
card = next((os.path.join(dp, f) for dp, _, fs in os.walk(tmp) for f in fs if f.startswith("frame-00")), None)
if not card: sys.exit("headline card render failed:\n" + (r.stdout + r.stderr)[-800:])

# 3) Composite: cut segments -> crop to band aspect -> scale -> overlay on card (+ logo layer kept on top).
f, ins = [], ""
for i, (x, y) in enumerate(segs):
    f.append(f"[0:v]trim={x:.3f}:{y:.3f},setpts=PTS-STARTPTS[v{i}];[0:a]atrim={x:.3f}:{y:.3f},asetpts=PTS-STARTPTS,"
             f"afade=t=in:d=0.012,afade=t=out:st={max(0, y - x - 0.015):.3f}:d=0.015[a{i}]")
    ins += f"[v{i}][a{i}]"
f.append(f"{ins}concat=n={len(segs)}:v=1:a=1[cv][ca]")
f.append(f"[cv]crop={crop_w}:{crop_h}:{crop_x}:{crop_y},scale={BAND_W}:{band_h}:flags=lanczos,setsar=1,fps={a.fps}[band]")
f.append(f"[1:v]scale={W}:{CANVAS_H},format=yuv420p[bg];[bg][band]overlay={(W - BAND_W) // 2}:{band_top}:shortest=1[comp]")
if a.logo:  # approved logo, unaltered except scaling, over the lower-left of the footage (as in the reference)
    lx = (W - BAND_W) // 2 + 63
    f.append(f"[2:v]scale=180:-1:flags=lanczos,format=rgba[lg];[comp][lg]overlay={lx}:{band_top + band_h}-100-h[vout]")
else:
    f.append("[comp]null[vout]")
raw = os.path.join(tmp, "raw.mp4")
cmd = ["ffmpeg", "-v", "error", "-y", "-i", a.src, "-loop", "1", "-i", card, *(["-i", a.logo] if a.logo else []), "-filter_complex", ";".join(f),
       "-map", "[vout]", "-map", "[ca]", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
       "-r", str(a.fps), "-c:a", "aac", "-b:a", "192k", "-ar", "48000", raw]
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode: sys.exit("composite failed:\n" + r.stderr[-1500:])

# 4) Two-pass loudness to -14 LUFS (skip if silent).
m = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
                    "-f", "null", "-"], capture_output=True, text=True).stderr
try:
    j = json.loads(m[m.rindex("{"):m.rindex("}") + 1]); float(j["input_i"])
    af = ["-af", f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
                 f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true", "-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
except Exception:
    af = ["-c:a", "copy"]
r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-c:v", "copy", *af, "-movflags", "+faststart", a.out], capture_output=True, text=True)
if r.returncode or not os.path.exists(a.out): sys.exit("final write failed:\n" + r.stderr[-800:])
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.out], capture_output=True, text=True).stdout)
print(json.dumps({"out": a.out, "duration": round(dur, 2), "segments": [[round(x, 2), round(y, 2)] for x, y in segs],
                  "crop": [crop_w, crop_h, crop_x, crop_y], "band": [BAND_W, band_h, band_top]}))
