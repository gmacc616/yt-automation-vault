"""Build a 9:16 commentary Short from <job>/edit/short.json.

Usage:  py build_short.py <job-dir> [--only-audio | --only-subs | --words-only]
Steps:  word timings (Whisper on each vo/<id>.wav, cached) -> shots -> concat -> numpy audio mix ->
        animated ASS captions -> final encode -> cover image -> timeline + QC metrics.
Final files go to <workspace>/output-commentary/<slug>/ (kept apart from HyperFrames' output/).
Intermediates stay in <job>/edit/build/ (shots are cached: delete shot_*.mp4 after changing shots or crops).
"""
import json, re, subprocess, sys
from pathlib import Path
import numpy as np
import soundfile as sf

JOB = Path(sys.argv[1]).resolve()
MODE = sys.argv[2] if len(sys.argv) > 2 else ""
WS = JOB.parents[1]                                   # <workspace>/jobs/<job>
KIT, RAW, BUILD = WS / "commentary-kit", JOB / "sources/raw", JOB / "edit/build"
CFG = json.loads((JOB / "edit/short.json").read_text(encoding="utf-8"))
OUT = WS / "output-commentary" / CFG["slug"]
BUILD.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
NAME = CFG["slug"] + "-short"
FPS, W, H = 30, 1080, 1920
BAND_Y, BAND_W, BAND_H = 330, 1080, 810              # 4:3 footage band in the vertical frame
CAP_Y = BAND_Y + BAND_H + 190                        # captions: below the band, above the Shorts UI zone
SR, GAP = 48000, CFG.get("gap", 0.22)
SRC = CFG["sources"]
ITEMS = CFG["items"]
TRANSCRIBE = WS / "tools/pipeline/transcribe_lowmem.py"

def ff(*args):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", *map(str, args)], capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr[-2000:])

def mmss(t): return f"{int(t // 60)}:{t % 60:05.2f}"

# ---------------------------------------------------------------- plan + words
def plan():
    t, out = 0.0, []
    for it in ITEMS:
        d = it["soundbite"][2] - it["soundbite"][1] if "soundbite" in it else sf.info(str(JOB / f"vo/{it['id']}.wav")).duration
        out.append(dict(it, start=round(t, 3), dur=round(d, 3)))
        t += d + GAP
    return out, t - GAP + 0.6

def ensure_words():
    for it in ITEMS:
        if "soundbite" in it: continue
        d = JOB / f"tmp/vo_words/{it['id']}"
        if not (d / "transcript.json").exists():
            d.mkdir(parents=True, exist_ok=True)
            subprocess.run([sys.executable, "-I", str(TRANSCRIBE), str(JOB / f"vo/{it['id']}.wav"), str(d), "base.en"],
                           check=True, capture_output=True)

def load_words(items):
    words = {}
    for it in items:
        if "soundbite" in it:
            src, a, b = it["soundbite"]
            raw = json.load(open(JOB / f"tmp/{src}/transcript.json", encoding="utf-8"))
            ws = [dict(text=w["text"], abs=it["start"] + w["start"] - a, end_abs=it["start"] + w["end"] - a)
                  for w in raw if w["start"] >= a - 0.05 and w["end"] <= b + 0.05]
        else:
            raw = json.load(open(JOB / f"tmp/vo_words/{it['id']}/transcript.json", encoding="utf-8"))
            ws = [dict(text=w["text"], abs=it["start"] + w["start"], end_abs=it["start"] + w["end"]) for w in raw]
        merged = []                                   # Whisper splits "$15,000" into "$15" + ",000"
        for w in ws:
            if merged and w["text"].startswith(","):
                merged[-1]["text"] += w["text"]; merged[-1]["end_abs"] = w["end_abs"]
            else:
                merged.append(w)
        words[it["id"]] = merged
    # {item: [[old, new], ...]}: each pair replaces the next unfixed occurrence; new "" deletes the word
    for iid, fixes in CFG.get("caption_fixes", {}).items():
        for old, new in fixes:
            for w in words[iid]:
                if w["text"] == old and not w.get("fixed"):
                    w["text"], w["fixed"] = new, True; break
        words[iid] = [w for w in words[iid] if w["text"]]
    return words

def word_t(words, item_id, text):
    hits = [w for w in words.get(item_id, []) if text.lower() in w["text"].lower()]
    return hits[0]["abs"] if hits else None

# ---------------------------------------------------------------- video
def render_shot(i, src, a, fx_x, fx, length):
    s = SRC[src]; cx, cy, cw, ch = s["clean"]
    fw = min(cw, int(ch * 4 / 3)) // 2 * 2            # 4:3 window inside the banner-free rect
    fx0 = int(cx + (cw - fw) * fx_x) // 2 * 2
    out = BUILD / f"shot_{i:03d}.mp4"
    win, n = f"crop={fw}:{ch}:{fx0}:{cy}", max(1, round(length * FPS))
    if fx == "push":
        fg = f"{win},scale=1440:1080,zoompan=z='1+0.10*on/{n}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s={BAND_W}x{BAND_H}:fps={FPS}"
    elif fx == "punch":
        fg = f"{win},crop=iw/1.15:ih/1.15,scale={BAND_W}:{BAND_H}"
    else:
        fg = f"{win},scale={BAND_W}:{BAND_H}"
    if fx == "freeze": fg += ",hue=s=0,eq=contrast=1.15"
    filt = (f"[0:v]crop={cw}:{ch}:{cx}:{cy},fps={FPS},split[a][b];"
            f"[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},gblur=sigma=28,eq=brightness=-0.18:saturation=0.8[bg];"
            f"[b]{fg},setsar=1[fg];[bg][fg]overlay=0:{BAND_Y},format=yuv420p,setsar=1")
    if fx == "freeze":                                # grab one frame and hold it
        png = BUILD / f"freeze_{i:03d}.png"
        ff("-ss", a, "-i", RAW / s["file"], "-frames:v", 1, png)
        inp = ["-loop", 1, "-t", length, "-i", png]
    else:
        inp = ["-ss", a, "-t", length, "-i", RAW / s["file"]]
    ff(*inp, "-filter_complex", filt, "-r", FPS, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", 19,
       "-threads", 2, "-t", length, out)

def build_video(items, total):
    shots, cues = [], []
    for it in items:
        last = it is items[-1]
        remain, t = it["dur"] + (total - it["start"] - it["dur"] if last else GAP), it["start"]
        for (src, a, b, fxx, fx) in it["shots"]:
            if remain <= 0.05: break
            length = min(CFG.get("freeze_hold", 2.2) if fx == "freeze" else b - a, remain)
            if remain - length < 1.0: length = remain   # never leave a sub-second sliver
            shots.append([len(shots), src, a, fxx, fx, round(length, 3)])
            cues.append(dict(t=round(t, 3), src=src, a=a, fx=fx, dur=round(length, 3), item=it["id"]))
            t += length; remain -= length
        if remain > 0.05:                              # out of footage: stretch the item's last shot
            shots[-1][5] = round(shots[-1][5] + remain, 3); cues[-1]["dur"] = shots[-1][5]
    lst = []
    for (k, src, a, fxx, fx, length) in shots:
        p = BUILD / f"shot_{k:03d}.mp4"
        if not p.exists():
            render_shot(k, src, a, fxx, fx, length); print("shot", k, src, a, fx, length, flush=True)
        lst.append(f"file '{p.as_posix()}'")
    (BUILD / "shots.txt").write_text("\n".join(lst))
    ff("-f", "concat", "-safe", 0, "-i", BUILD / "shots.txt", "-c", "copy", BUILD / "video.mp4")
    json.dump(cues, open(BUILD / "cues.json", "w"), indent=1)
    return cues

# ---------------------------------------------------------------- audio
def load(p, gain_db=0.0):
    tmp = BUILD / ("_a_" + Path(p).stem + ".wav")
    if not tmp.exists(): ff("-i", p, "-ar", SR, "-ac", 2, "-c:a", "pcm_f32le", tmp)
    x, _ = sf.read(str(tmp), dtype="float32", always_2d=True)
    return x * (10 ** (gain_db / 20))

def place(track, x, t):
    i = int(t * SR); j = min(len(track), i + len(x))
    if j > i: track[i:j] += x[: j - i]

def build_audio(items, total, words):
    N = int(total * SR)
    voice, sfx = np.zeros((N, 2), np.float32), np.zeros((N, 2), np.float32)
    for it in items:
        if "soundbite" in it:
            src, a, b = it["soundbite"]; tmp = BUILD / f"sb_{it['id']}.wav"
            ff("-ss", a, "-t", b - a, "-i", RAW / SRC[src]["file"], "-vn", "-ar", SR, "-ac", 2, "-af",
               f"afade=t=in:d=0.08,afade=t=out:st={b - a - 0.15:.2f}:d=0.15,loudnorm=I=-16:TP=-2", "-c:a", "pcm_f32le", tmp)
            place(voice, sf.read(str(tmp), dtype="float32", always_2d=True)[0], it["start"])
        else:
            place(voice, load(JOB / f"vo/{it['id']}.wav"), it["start"])
    st = {it["id"]: it["start"] for it in items}
    for c in CFG.get("sfx", []):                     # {"at": 0 | "sections"} or {"item","word"}; file, gain
        f = WS / c["file"] if c["file"].startswith("sound effects/") else KIT / "sfx" / c["file"]   # sfxv2 transition pack
        if c.get("at") == "sections":
            ts = [it["start"] - 0.18 for it in items if it.get("label")]
        elif "word" in c:
            t = word_t(words, c["item"], c["word"]); ts = [t - 0.05] if t is not None else []
        else:
            ts = [float(c.get("at", 0))]
        for t in ts: place(sfx, load(f, c.get("gain", -10)), max(0.0, t))
    mus = load(KIT / "music" / CFG["music"])
    bed = np.tile(mus, (int(np.ceil(N / len(mus))) + 1, 1))[:N]
    env = np.full(N, 10 ** (CFG.get("music_db", -24) / 20), np.float32)          # under narration
    for it in items:
        if "soundbite" in it:                                                     # further under soundbites
            env[int(it["start"] * SR):int((it["start"] + it["dur"]) * SR)] = 10 ** (-34 / 20)
    for d in CFG.get("music_dropouts", []):                                       # silence for a reveal
        t = word_t(words, d["item"], d["word"])
        if t is not None: i = int((t - 0.15) * SR); env[i:i + int(d.get("dur", 1.6) * SR)] = 0.0
    k = int(0.12 * SR); env = np.convolve(env, np.ones(k) / k, mode="same").astype(np.float32)
    fade = int(2.0 * SR); env[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
    sf.write(str(BUILD / "mix_raw.wav"), voice + sfx + bed * env[:, None], SR, subtype="FLOAT")
    ff("-i", BUILD / "mix_raw.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", SR, "-c:a", "pcm_s16le", BUILD / "mix.wav")

# ---------------------------------------------------------------- captions (ASS)
def ass_time(t):
    t = max(0, t); return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"

def srt_time(t):
    ms = int(round(t * 1000)); return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"

def chunks(ws, maxw=3):
    out, cur = [], []
    for w in ws:
        cur.append(w)
        if len(cur) >= maxw or w["text"][-1:] in ".,?!:" or len(" ".join(x["text"] for x in cur)) > 16:
            out.append(cur); cur = []
    if cur: out.append(cur)
    return out

def build_subs(items, cues, words, total):
    YEL, RED = "&H0000D7FF&", "&H004D4DFF&"
    hdr = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Anton,118,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,1,0,1,7,3,5,60,60,0,1
Style: Title,Anton,68,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,6,0,8,40,40,150,1
Style: Label,Bebas Neue,58,&H00000000,&H00000000,&H0000D7FF,&H0000D7FF,0,0,0,0,100,100,3,0,3,14,0,7,0,0,0,1
Style: Credit,Bebas Neue,34,&H00DDDDDD,&H00DDDDDD,&H00000000,&H96000000,0,0,0,0,100,100,2,0,1,3,0,1,0,0,0,1
Style: Stamp,Anton,150,&H003030FF,&H003030FF,&H00FFFFFF,&H00000000,0,0,0,0,100,100,4,0,1,8,0,5,0,0,0,1
Style: Pop,Anton,96,&H0000D7FF,&H0000D7FF,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,7,4,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    plain, hi = CFG["title"]
    ev = [f"Dialogue: 2,{ass_time(0)},{ass_time(total)},Title,,0,0,0,,{{\\fad(150,0)}}{plain}{{\\c{YEL}}}{hi}"]
    for it in items:
        if it.get("label"):
            ev.append(f"Dialogue: 3,{ass_time(it['start'])},{ass_time(it['start'] + 3.2)},Label,,0,0,0,,"
                      f"{{\\pos(36,{BAND_Y + 30})\\fad(120,200)\\t(0,120,\\fscx104\\fscy104)\\t(120,220,\\fscx100\\fscy100)}} {it['label']} ")
    for c in cues:
        ev.append(f"Dialogue: 1,{ass_time(c['t'])},{ass_time(c['t'] + c['dur'])},Credit,,0,0,0,,"
                  f"{{\\pos(28,{BAND_Y + BAND_H - 14})}}SOURCE: {SRC[c['src']]['credit']}")
    for p in CFG.get("pops", []):
        t = word_t(words, p["item"], p["word"])
        if t is not None:
            ev.append(f"Dialogue: 4,{ass_time(t)},{ass_time(t + p.get('dur', 2.2))},Pop,,0,0,0,,{{\\an5\\pos(540,{BAND_Y + p.get('y', 400)})"
                      f"\\fscx40\\fscy40\\t(0,110,\\fscx110\\fscy110)\\t(110,200,\\fscx100\\fscy100)\\fad(0,150)}}{p['text']}")
    for s in CFG.get("stamps", []):
        t = word_t(words, s["item"], s["word"])
        if t is not None:
            ev.append(f"Dialogue: 5,{ass_time(t)},{ass_time(t + s.get('dur', 2.0))},Stamp,,0,0,0,,{{\\an5\\pos(540,{BAND_Y + BAND_H // 2})"
                      f"\\frz-8\\fscx160\\fscy160\\t(0,90,\\fscx100\\fscy100)}}{s['text']}")
    emph = tuple(e.lower() for e in CFG.get("emphasis", []))
    caps, srt = [], []
    for it in items:
        for ch in chunks(words.get(it["id"], [])):
            c0, c1 = ch[0]["abs"], ch[-1]["end_abs"]
            srt.append(f"{len(srt) + 1}\n{srt_time(c0)} --> {srt_time(c1)}\n{' '.join(w['text'] for w in ch)}\n")
            for k, w in enumerate(ch):
                t0 = w["abs"] - 0.08
                t1 = ch[k + 1]["abs"] - 0.08 if k + 1 < len(ch) else c1 + 0.05
                parts = []
                for j, x in enumerate(ch):
                    txt = x["text"].upper()
                    if j == k:
                        col = RED if any(e in x["text"].lower() for e in emph) else YEL
                        txt = f"{{\\c{col}\\fscx110\\fscy110}}{txt}{{\\c&HFFFFFF&\\fscx100\\fscy100}}"
                    parts.append(txt)
                intro = "\\fscx70\\fscy70\\t(0,90,\\fscx100\\fscy100)" if k == 0 else ""
                caps.append([t0, t1, f"{{\\an5\\pos(540,{CAP_Y}){intro}}}{' '.join(parts)}"])
    caps.sort(key=lambda c: c[0])
    for a, b in zip(caps, caps[1:]): a[1] = min(a[1], b[0])     # never two captions on screen
    ev += [f"Dialogue: 6,{ass_time(a)},{ass_time(b)},Cap,,0,0,0,,{t}" for a, b, t in caps if b - a > 0.02]
    (OUT / f"{NAME}.ass").write_text(hdr + "\n".join(ev) + "\n", encoding="utf-8")
    (OUT / f"{NAME}.srt").write_text("\n".join(srt), encoding="utf-8")

# ---------------------------------------------------------------- finishing
def encode():
    fonts = (KIT / "fonts").as_posix().replace(":", "\\:")
    ass = (OUT / f"{NAME}.ass").as_posix().replace(":", "\\:")
    # Single-threaded decode/filter + short lookahead: default settings ran out of RAM on this 3.6 GB machine.
    ff("-threads", 1, "-i", BUILD / "video.mp4", "-i", BUILD / "mix.wav", "-filter_threads", 1, "-vf", f"ass='{ass}':fontsdir='{fonts}'",
       "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "fast", "-crf", 19, "-profile:v", "high",
       "-pix_fmt", "yuv420p", "-r", FPS, "-x264-params", "threads=2:lookahead-threads=1:rc-lookahead=20",
       "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart", "-shortest", OUT / f"{NAME}.mp4")

def cover():
    c = CFG.get("cover")
    if not c: return
    font = (KIT / "fonts/Anton-Regular.ttf").as_posix().replace(":", "\\:")
    top, big = c["lines"]
    ff("-ss", c["at"], "-i", OUT / f"{NAME}.mp4", "-frames:v", 1, "-vf",
       f"drawbox=x=0:y=1150:w=1080:h=480:color=0x111111@0.95:t=fill,"
       f"drawtext=fontfile='{font}':text='{top}':fontsize=130:fontcolor=white:borderw=8:bordercolor=black:x=(w-tw)/2:y=1215,"
       f"drawtext=fontfile='{font}':text='{big}':fontsize=190:fontcolor=0xFFD700:borderw=10:bordercolor=black:x=(w-tw)/2:y=1365",
       OUT / "thumbnail.png")

def timeline(items, cues):
    text = {it["id"]: it.get("text", "").replace("|", " ") for it in ITEMS}
    L = ["# Editing timeline (as rendered)\n", "| Time | Item | Narration / audio | Shot | Effect |", "|---|---|---|---|---|"]
    for c in cues:
        it = next(i for i in items if i["id"] == c["item"])
        say = text[it["id"]] or "Soundbite (original audio)"
        L.append(f"| {mmss(c['t'])}–{mmss(c['t'] + c['dur'])} | {it['id']}{' · ' + it['label'] if it.get('label') else ''} | "
                 f"{say[:70]}… | {SRC[c['src']]['credit']} @ {c['a']}s | {c['fx']} |")
    L += ["", f"Music: {CFG['music']} at {CFG.get('music_db', -24)} dB under narration, −34 dB under soundbites, 2 s fade-out.",
          "SFX cues: " + "; ".join(f"{s['file']} @ {s.get('word', s.get('at'))}" for s in CFG.get("sfx", []))]
    (OUT / "editing-timeline.md").write_text("\n".join(L), encoding="utf-8")

def qc_metrics():
    f = OUT / f"{NAME}.mp4"
    def run(*a): return subprocess.run(["ffmpeg", "-hide_banner", "-i", str(f), *a, "-f", "null", "-"], capture_output=True, text=True).stderr
    probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_name,width,height",
                                       "-of", "json", str(f)], capture_output=True, text=True).stdout)
    eb = run("-af", "ebur128=peak=true", "-vn")
    m = dict(duration=float(probe["format"]["duration"]), size_mb=round(int(probe["format"]["size"]) / 1e6, 1),
             streams=[(s.get("codec_name"), s.get("width"), s.get("height")) for s in probe["streams"]],
             black_frames=run("-vf", "blackdetect=d=0.1:pix_th=0.08", "-an").count("black_start"),
             silences_over_0_6s=run("-af", "silencedetect=n=-45dB:d=0.6", "-vn").count("silence_end"),
             lufs=float(re.findall(r"I:\s+(-?[\d.]+) LUFS", eb)[-1]), true_peak_db=float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", eb)[-1]))
    (OUT / "qc-metrics.json").write_text(json.dumps(m, indent=1))
    ff("-i", f, "-vf", "fps=1,scale=180:-2,drawtext=text='%{pts\\:hms}':x=4:y=4:fontsize=13:fontcolor=yellow:box=1:boxcolor=black,tile=15x7",
       "-frames:v", 1, JOB / "tmp/qc_sheet.png")
    return m

if __name__ == "__main__":
    ensure_words()
    items, total = plan()
    words = load_words(items)
    if MODE == "--words-only":
        for k, v in words.items(): print(k, " ".join(w["text"] for w in v))
        sys.exit()
    cues = json.load(open(BUILD / "cues.json")) if MODE in ("--only-audio", "--only-subs") else build_video(items, total)
    if MODE != "--only-subs": build_audio(items, total, words)
    build_subs(items, cues, words, total)
    encode(); cover(); timeline(items, cues)
    for it in ITEMS:                                   # keep the narration with the deliverables
        if "soundbite" not in it:
            (OUT / "voiceover").mkdir(exist_ok=True)
            (OUT / "voiceover" / f"{it['id']}.wav").write_bytes((JOB / f"vo/{it['id']}.wav").read_bytes())
    (OUT / "final-audio-mix.wav").write_bytes((BUILD / "mix.wav").read_bytes())
    print(json.dumps(qc_metrics()), "\nOUTPUT", OUT)
