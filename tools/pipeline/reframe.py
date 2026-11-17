# 1080x1920 base per clip from a landscape source. Run from the job folder: py reframe.py clip01 clip02 ...
# Reads reframe.json there. Add --grade puregrit (PureGrit look) or --grade ysc (/youtube-style-clip look).
# Shot modes:
#   number          -> 9:16 crop centred on that x fraction (speaker framing)
#   {"pan":[a,b]}   -> 9:16 crop easing from x=a to x=b across the shot
#   {"zf":[cx,W(,y0,H,fw)]} -> near-fill: crop W px (optionally y0..y0+H) scaled to fw px wide over a blurred bed
#   "fit"           -> whole frame letterboxed over a blurred bed (keeps a full subject, e.g. a whole house, visible)
import json, subprocess, sys
cfg = json.load(open("reframe.json", encoding="utf-8"))
probe = lambda f: subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", f], capture_output=True, text=True).stdout.strip().split(",")
# Optional look: --grade puregrit (only when the PureGrit style is requested). Default: no grade.
GRADES = {"puregrit": "eq=contrast=1.15:saturation=1.3:gamma=0.96,vignette=angle=PI/4.5,unsharp=5:5:0.5",
          # /youtube-style-clip: saturated, high contrast, slightly teal shadows, punchy, light sharpen
          "ysc": "eq=contrast=1.14:saturation=1.38:gamma=0.97,colorbalance=rs=-0.05:gs=0.01:bs=0.05:rh=0.03:bh=-0.02,unsharp=5:5:0.6",
          # moderate version for brand campaigns where the product must look like itself (/boxabl)
          "ysc-soft": "eq=contrast=1.07:saturation=1.15,colorbalance=rs=-0.02:bs=0.02,unsharp=5:5:0.4"}
argv = sys.argv[1:]
GRADE = GRADES[argv[argv.index("--grade") + 1]] if "--grade" in argv else None
if "--grade" in argv: del argv[argv.index("--grade"):argv.index("--grade") + 2]
for name in [a for a in argv if not a.startswith('_')]:
    src = f"{name}/tight.mp4"
    W, H = map(int, probe(src))
    CW = round(H * 9 / 16) // 2 * 2
    def px(cx, w=CW): return max(0, min(W - w, round(cx * W - w / 2)))
    entry = cfg[name]
    shots = entry["shots"] if isinstance(entry, dict) else entry
    # Optional B-roll inserts from the original source, shown whole (letterboxed) over a blurred bed:
    #   "broll": [[at_seconds, src_start, src_end], ...] with "_src" (path to source) at the top level of reframe.json.
    broll = entry.get("broll", []) if isinstance(entry, dict) else []
    expr = "0"
    for a, b, m in reversed(shots):
        if isinstance(m, (int, float)):
            expr = f"if(between(t,{a},{b}),{px(m)},{expr})"
        elif isinstance(m, dict) and "pan" in m:
            x1, x2 = px(m["pan"][0]), px(m["pan"][1])
            expr = f"if(between(t,{a},{b}),{x1}+({x2 - x1})*(1-cos(PI*(t-{a})/{b - a}))/2,{expr})"
    special = [(a, b, m) for a, b, m in shots if m == "fit" or (isinstance(m, dict) and "zf" in m)]
    n = 2 + len(special)
    nb = max(1, len(special))
    g = [f"[0:v]split={n}" + "".join(f"[s{i}]" for i in range(n)),
         f"[s0]crop={CW}:{H}:x='{expr}':y=0,scale=1080:1920:flags=lanczos,setsar=1[v0]",
         f"[s1]scale=-2:1920,crop=1080:1920,boxblur=40:3,eq=brightness=-0.18:saturation=0.8,split={nb}" + "".join(f"[bg{i}]" for i in range(nb))]
    if not special: g.append("[bg0]nullsink")
    last = "v0"
    for i, (a, b, m) in enumerate(special):
        s = f"s{i + 2}"
        if m == "fit":
            g.append(f"[{s}]scale=1080:-2:flags=lanczos[fg{i}]")
            yexpr = "(H-h)/2"
        else:
            cx, w, *rest = m["zf"]
            y0, h, fw = rest if len(rest) == 3 else (0, H, 860)
            g.append(f"[{s}]crop={w}:{h}:{px(cx, w)}:{y0},scale={fw}:-2:flags=lanczos[fg{i}]")
            # fw 1080 = full-frame crop of a sub-region (e.g. above burned-in subtitles): centre it vertically.
            yexpr = "(H-h)/2" if fw >= 1080 else "930-h/2"
        g.append(f"[bg{i}][fg{i}]overlay=(W-w)/2:{yexpr}[sp{i}]")
        g.append(f"[{last}][sp{i}]overlay=enable='between(t,{a},{b})'[o{i}]")
        last = f"o{i}"
    inputs = ["-i", src]
    for j, (at, bs, be) in enumerate(broll, start=1):
        inputs += ["-ss", str(bs), "-t", f"{be - bs:.3f}", "-i", cfg["_src"]]
        k = f"b{j}"
        g.append(f"[{j}:v]split=2[{k}a][{k}b]")
        g.append(f"[{k}a]scale=-2:1920,crop=1080:1920,boxblur=40:3,eq=brightness=-0.18:saturation=0.8,setsar=1[{k}bg]")
        g.append(f"[{k}b]scale=1080:-2:flags=lanczos,setsar=1[{k}fg]")
        g.append(f"[{k}bg][{k}fg]overlay=(W-w)/2:(H-h)/2,fps=30000/1001,setpts=PTS-STARTPTS+{at}/TB[{k}v]")
        g.append(f"[{last}][{k}v]overlay=enable='between(t,{at},{at + be - bs:.3f})':eof_action=pass[ob{j}]")
        last = f"ob{j}"
    if GRADE:
        g.append(f"[{last}]{GRADE}[graded]")
        last = "graded"
    cmd = ["ffmpeg", "-nostdin", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(g),
           "-map", f"[{last}]", "-map", "0:a", "-c:v", "libx264", "-preset", "medium", "-crf", "15",
           "-pix_fmt", "yuv420p", "-g", "30", "-keyint_min", "30", "-sc_threshold", "0",
           "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", f"{name}/base.mp4"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    print(name, "ok" if r.returncode == 0 else "FAIL\n" + r.stderr[-1500:])
