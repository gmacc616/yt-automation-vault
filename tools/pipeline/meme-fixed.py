"""Apply the fixed /meme rules (user's standing choice, 2026-10-27) to clips in a job's shorts.json, before build-shorts.js.

Usage (from the repo root):  py tools/pipeline/meme-fixed.py jobs/meme_<id> clip01 [clip02 ...]
Needs per clip: clipNN/base.mp4 (or base_orig.mp4 from an earlier run), clipNN/t/transcript.json, and in shorts.json
  "sfxSrc": [{"t": s, "file": "sound effects/...", "ms": onset_in_file, "why": "..."}]   meme sounds, untrimmed
  "bleep":  [[a, b], ...]                                                                  curse words to mute (optional)
Fixed rules it applies (see .claude/commands/meme.md):
  - speech: bleep windows muted, -6 dB dip (max 1 s) under any sound that overlaps a word, normalised to -16 LUFS
  - music: commentary-kit/music/Ts Pmo.mp3 at -8 dB from 0:00, 0.4 s fade-out -> clipNN/music_duck.wav
  - frame 1: fully white flash + sound effects/awkward-moment.mp3 from the file's start, 20% louder
  - frame 2: CapCut-style "cross-shake" transition (motion-graphics-library)
  - meme sounds: play in full; longer than 2 s -> stop at 1.5 s with a 0.2 s fade; each level-matched to the speech
Writes clipNN/sfx/*.wav and the clip's "sfx", "flashes", "transitions" in shorts.json. Safe to re-run.
Self-check: py tools/pipeline/meme-fixed.py --selftest
"""
import json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MUSIC = "commentary-kit/music/Ts Pmo.mp3"
OPENER = dict(file="sound effects/awkward-moment.mp3", ms=0, boost_db=20 * np.log10(1.2))
LONG, CAP, CAP_FADE = 2.0, 1.5, 0.2


def run(*a):
    subprocess.run(a, check=True)


def dur(f):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
                                capture_output=True, text=True).stdout)


def active_rms_db(f):
    # loudness proxy: RMS over the 20 ms frames within 20 dB of the loudest, i.e. where it actually sounds
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
    a = np.frombuffer(raw, np.int16).astype(float) / 32768; h = 320
    r = 20 * np.log10(np.sqrt((a[:len(a) // h * h].reshape(-1, h) ** 2).mean(1)) + 1e-9)
    return float(20 * np.log10(np.sqrt(np.mean(10 ** (r[r > r.max() - 20] / 10)))))


def play_length(full, is_bleep, given=None):
    """Meme sounds play in full unless longer than 2 s; those stop at 1.5 s. Bleeps keep the curse word's length."""
    if is_bleep: return given
    return CAP if full > LONG else full


def apply(job, name, spec):
    d = os.path.join(job, name); s = spec[name]
    if not os.path.exists(d + "/base_orig.mp4"): os.rename(d + "/base.mp4", d + "/base_orig.mp4")
    D = dur(d + "/base_orig.mp4")
    words = json.load(open(d + "/t/transcript.json"))
    cues = [dict(t=0.0, file=OPENER["file"], ms=OPENER["ms"], why="frame 1: awkward-moment sound", opener=True)] + \
           [dict(t=a, file="sound effects/45_Viral_Meme_Sound_Effects_Pack/26_Censored_Audio_Bleep.mp3", ms=0.05, len=round(b - a, 3), why="censor", bleep=True) for a, b in s.get("bleep", [])] + \
           [dict(c) for c in s.get("sfxSrc", [])]
    for c in cues:
        c["t"] = round(min(c["t"], D - 0.12), 3)
        c["len"] = round(min(play_length(dur(os.path.join(ROOT, c["file"])) - c["ms"], c.get("bleep"), c.get("len")), D - c["t"]), 3)
        c["dip"] = not c.get("bleep") and any(w["start"] < c["t"] + c["len"] and w["end"] > c["t"] for w in words)
    af = [f"volume=0:enable='between(t,{a},{b})'" for a, b in s.get("bleep", [])]
    af += [f"volume=-6dB:enable='between(t,{c['t']},{c['t'] + min(c['len'], 1.0)})'" for c in cues if c["dip"]]
    run("ffmpeg", "-v", "error", "-y", "-i", d + "/base_orig.mp4", "-c:v", "copy", "-af", ",".join(af + ["loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000"]),
        "-c:a", "aac", "-b:a", "256k", d + "/base.mp4")
    run("ffmpeg", "-v", "error", "-y", "-t", f"{D:.3f}", "-i", os.path.join(ROOT, MUSIC), "-af", f"volume=-8dB,aresample=48000,afade=t=out:st={D - 0.4:.3f}:d=0.4",
        "-ac", "2", "-ar", "48000", d + "/music_duck.wav")
    os.makedirs(d + "/sfx", exist_ok=True)
    for old in os.listdir(d + "/sfx"): os.remove(os.path.join(d, "sfx", old))
    ref = active_rms_db(d + "/base.mp4"); out = []
    for k, c in enumerate(cues):
        tmp = f"{d}/sfx/{k}_raw.wav"; dst = f"{d}/sfx/{k}_" + os.path.splitext(os.path.basename(c["file"]))[0] + ".wav"
        fout = CAP_FADE if c["len"] == CAP and not c.get("bleep") else 0.04
        run("ffmpeg", "-v", "error", "-y", "-ss", str(c["ms"]), "-t", str(c["len"]), "-i", os.path.join(ROOT, c["file"]), "-ac", "2", "-ar", "48000",
            "-af", f"afade=t=in:d=0.005,afade=t=out:st={max(0, c['len'] - fout):.3f}:d={fout}", tmp)
        g = ref - active_rms_db(tmp) + (OPENER["boost_db"] if c.get("opener") else 0)
        run("ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", f"volume={g:.2f}dB,alimiter=limit=0.89:level=false", "-ar", "48000", dst)
        os.remove(tmp)
        out.append({"t": c["t"], "file": os.path.relpath(dst, ROOT), "vol": 1})
    s["sfx"] = out
    s["flashes"] = [{"t": 0, "color": "#ffffff"}] + [f for f in s.get("flashes", []) if f.get("t", 0) > 0]
    s["transitions"] = [{"t": round(1 / 30, 3), "type": "cross-shake"}] + [x for x in s.get("transitions", []) if x.get("type") != "cross-shake"]
    s["fixedFeatures"] = False
    return [(c["t"], os.path.basename(c["file"]), c["len"], c.get("why", "")) for c in cues]


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        assert play_length(1.9, False) == 1.9 and play_length(2.0, False) == 2.0 and play_length(3.3, False) == 1.5
        assert play_length(5.0, True, 0.3) == 0.3
        print("selftest ok"); sys.exit()
    job = os.path.abspath(sys.argv[1]); clips = sys.argv[2:]
    spec = json.load(open(os.path.join(job, "shorts.json")))
    for name in clips:
        for t, f, ln, why in apply(job, name, spec): print(f"{name} {t:6.2f}s {ln:4.2f}s {f}  {why}")
    json.dump(spec, open(os.path.join(job, "shorts.json"), "w"), indent=1)
