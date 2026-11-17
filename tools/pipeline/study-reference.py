"""Measure a reference Short so its editing can be copied from data, not guesses.

Usage: py tools/pipeline/study-reference.py <reference.mp4> <outdir> [--no-transcript]
Writes to <outdir>:
  study.json        duration, size, fps, cut times, cuts/s, shot lengths, loudness (I, LRA), sound hits, transcript
  sheets/sheetN.png 4 frames per second with timestamps (read these to see captions, headline, zooms, flashes, layout)
  t/                word-level transcript (faster-whisper, local) unless --no-transcript
Sound hits are sudden jumps in loudness (likely SFX, beat drops or impacts); confirm each by eye and ear.
Self-check: py tools/pipeline/study-reference.py --selftest
"""
import json, os, re, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = next((f for f in ["C:/Windows/Fonts/arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"] if os.path.exists(f)), None)


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")


def probe(src):
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate",
               "-of", "json", src]).stdout
    d = json.loads(out)
    v = next((s for s in d["streams"] if s["codec_type"] == "video"), {})
    num, den = (v.get("r_frame_rate") or "0/1").split("/")
    return {"duration": round(float(d["format"]["duration"]), 2), "width": v.get("width"), "height": v.get("height"),
            "fps": round(float(num) / float(den or 1), 2), "has_audio": any(s["codec_type"] == "audio" for s in d["streams"])}


def cut_times(src, thresh=0.3):
    err = run(["ffmpeg", "-hide_banner", "-i", src, "-vf", f"select='gt(scene,{thresh})',showinfo", "-an", "-f", "null", "-"]).stderr
    ts = [round(float(t), 2) for t in re.findall(r"pts_time:([0-9.]+)", err)]
    out = []
    for t in ts:  # one cut can register on 2-3 neighbouring frames
        if not out or t - out[-1] > 0.15:
            out.append(t)
    return out


def loudness(src):
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", src, "-af", "ebur128", "-f", "null", "-"]).stderr
    i = re.findall(r"^\s+I:\s+(-?[0-9.]+) LUFS", err, re.M)
    lra = re.findall(r"^\s+LRA:\s+([0-9.]+) LU", err, re.M)
    return {"integrated_lufs": float(i[-1]) if i else None, "lra": float(lra[-1]) if lra else None}


def sound_hits(samples, sr=16000, win=0.05, jump_db=9.0, min_gap=0.25):
    """Times where short-term level jumps by >= jump_db over the previous 0.3 s: likely SFX, impacts or beat drops."""
    n = int(sr * win)
    frames = len(samples) // n
    if frames < 8:
        return []
    x = samples[: frames * n].astype(np.float64).reshape(frames, n)
    db = 20 * np.log10(np.sqrt((x ** 2).mean(axis=1)) + 1e-9)
    look = int(0.3 / win)
    hits = []
    for k in range(look, frames):
        prev = db[k - look:k].mean()
        if db[k] - prev >= jump_db and db[k] > db.max() - 30 and (not hits or k * win - hits[-1] >= min_gap):
            hits.append(round(k * win, 2))
    return hits


def read_audio(src, sr=16000):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"],
                         capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768


def sheets(src, outdir, duration, fps=4, cols=8, rows=6):
    os.makedirs(os.path.join(outdir, "sheets"), exist_ok=True)
    per = cols * rows / fps
    paths, k, start = [], 0, 0.0
    while start < duration:
        k += 1
        p = os.path.join(outdir, "sheets", f"sheet{k}.png")
        label = (f"drawtext=fontfile='{FONT.replace(':', chr(92) + ':')}':text='%{{pts\\:flt\\:{start}}}':x=3:y=3:fontsize=16:"
                 "fontcolor=yellow:box=1:boxcolor=black@0.7,") if FONT else ""
        run(["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-t", str(per), "-i", src,
             "-vf", f"fps={fps},scale=180:-2,{label}tile={cols}x{rows}", "-frames:v", "1", p])
        if os.path.exists(p):
            paths.append(os.path.relpath(p, outdir))
        start += per
    return paths


def selftest():
    sr = 16000
    sig = np.zeros(sr * 3, dtype=np.float32)
    sig[int(1.0 * sr):int(1.2 * sr)] = 0.8  # a loud 0.2 s burst at 1.0 s
    sig += 0.001
    h = sound_hits(sig, sr)
    assert h and abs(h[0] - 1.0) <= 0.05, h
    assert sound_hits(np.full(sr * 3, 0.1, dtype=np.float32), sr) == [], "steady tone must give no hits"
    print("selftest ok:", h)


def main():
    a = sys.argv[1:]
    if a[:1] == ["--selftest"]:
        return selftest()
    if len(a) < 2:
        sys.exit(__doc__)
    src, outdir = a[0], a[1]
    if not os.path.isfile(src):
        sys.exit(f"not a file: {src}")
    os.makedirs(outdir, exist_ok=True)
    info = probe(src)
    cuts = cut_times(src)
    bounds = [0.0] + cuts + [info["duration"]]
    shots = [round(b - a2, 2) for a2, b in zip(bounds, bounds[1:]) if b - a2 > 0.04]
    study = {**info, "cuts": cuts, "cut_count": len(cuts),
             "cuts_per_second": round(len(cuts) / info["duration"], 2) if info["duration"] else None,
             "shot_seconds": {"min": min(shots), "median": float(np.median(shots)), "max": max(shots)} if shots else None,
             "first_cut": cuts[0] if cuts else None}
    if info["has_audio"]:
        study.update(loudness(src))
        study["sound_hits"] = sound_hits(read_audio(src))
    study["sheets"] = sheets(src, outdir, info["duration"])
    if "--no-transcript" not in a and info["has_audio"]:
        run([sys.executable, os.path.join(HERE, "transcribe_lowmem.py"), src, os.path.join(outdir, "t"), "base.en"])
        tp = os.path.join(outdir, "t", "transcript.json")
        if os.path.exists(tp):
            words = json.load(open(tp, encoding="utf-8"))
            study["transcript"] = " ".join(w["text"] for w in words)
            study["words_per_second"] = round(len(words) / info["duration"], 2) if info["duration"] else None
    json.dump(study, open(os.path.join(outdir, "study.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(json.dumps({k: v for k, v in study.items() if k not in ("sheets", "transcript")}, ensure_ascii=False))
    print(f"sheets: {len(study['sheets'])} in {outdir}/sheets; transcript: {'yes' if 'transcript' in study else 'no'}")


if __name__ == "__main__":
    main()
