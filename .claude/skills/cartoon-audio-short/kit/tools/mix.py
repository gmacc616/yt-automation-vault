#!/usr/bin/env python3
"""Level-locked mix: voice unchanged, music bed 21 dB under the voice, SFX hits ~12 dB under (reference-channel levels) -> mix_raw.wav.

Usage: python3 mix.py voice.wav music.wav sfx.wav [--out mix_raw.wav]
- Levels measured on the reference channel's 30 latest Shorts (2026-11-18, demucs voice/bed split): the narrator is
  clearly on top. Music alone sits ~21 dB under the voice while it talks (p10-p90 17-23); SFX hits (400 ms peak) sit a
  median 12 dB under the voice, the loud 10 % ~6 dB under; music+SFX together 16.6 LU under the voice. Never ducked.
- Voice and music: gated RMS (400 ms blocks, blocks quieter than -40 dBFS or 20 dB under the loudest are ignored).
- SFX: one gain so the median hit (local max of 400 ms RMS, >= 6 dB over the stem's 40th percentile, >= 0.5 s apart)
  sits SFX_HIT_DB under the voice, and no hit louder than SFX_HIT_MAX_DB. No ducking, no compression: finish.sh adds
  one linear gain + a limiter.
- The output is 32-bit PCM (headroom kept for finish.sh) and exactly as long as the voice.
"""
import argparse, subprocess, wave
import numpy as np

SR = 48000
MUSIC_DB = -21.0      # music bed vs voice, gated RMS
SFX_HIT_DB = -12.0    # median SFX hit vs voice gated RMS
SFX_HIT_MAX_DB = -5.0 # loudest SFX hit vs voice gated RMS

def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)

def gated_rms(x, block=0.4):
    n = int(block * SR)
    b = np.array([np.sqrt(np.mean(x[i:i + n] ** 2)) for i in range(0, max(1, len(x) - n + 1), n)] or [0.0])
    b = b[b > 0]
    if not len(b):
        return 0.0
    keep = b[(b > 10 ** (-40 / 20)) & (b > b.max() * 10 ** (-20 / 20))]
    return float(np.sqrt(np.mean((keep if len(keep) else b) ** 2)))

def hits(x, win=0.4, hop=0.1):
    """400 ms RMS (dBFS) at each SFX hit."""
    w, h = int(win * SR), int(hop * SR)
    L = np.maximum(np.array([db(np.sqrt(np.mean(x[i:i + w] ** 2))) for i in range(0, max(1, len(x) - w), h)]), -90)
    if not len(L) or L.max() <= -90:
        return []
    fl = max(np.percentile(L, 40), L.max() - 30)
    out, last = [], -99
    for i in range(2, len(L) - 2):
        if L[i] == L[i - 2:i + 3].max() and L[i] > fl + 6 and i - last >= 5:
            out.append(L[i]); last = i
    return out

def fit(x, n):
    out = np.zeros(n); out[:min(n, len(x))] = x[:n]; return out

db = lambda r: 20 * np.log10(max(r, 1e-12))

ap = argparse.ArgumentParser()
ap.add_argument("voice"); ap.add_argument("music"); ap.add_argument("sfx"); ap.add_argument("--out", default="mix_raw.wav")
a = ap.parse_args()

voice = load(a.voice); n = len(voice)
music, sfx = fit(load(a.music), n), fit(load(a.sfx), n)
v_rms = gated_rms(voice); v_db = db(v_rms)
gm = 10 ** (MUSIC_DB / 20) * v_rms / max(gated_rms(music), 1e-12)
for _ in range(4):  # the -40 dBFS gate drops more blocks once the bed is turned down: converge on the measured level
    gm *= 10 ** ((MUSIC_DB - (db(gated_rms(music * gm)) - v_db)) / 20)
H = hits(sfx)
if H:
    g_db = min(v_db + SFX_HIT_DB - float(np.median(H)), v_db + SFX_HIT_MAX_DB - max(H))
else:  # no clear hits (e.g. only ambience): keep it as quiet as the music
    g_db = v_db + MUSIC_DB - db(gated_rms(sfx))
gs = 10 ** (g_db / 20)
mix = voice + music * gm + sfx * gs

with wave.open(a.out, "wb") as w:  # 32-bit PCM keeps headroom without float-WAV quirks
    w.setnchannels(1); w.setsampwidth(4); w.setframerate(SR)
    peak = max(1.0, np.abs(mix).max())
    w.writeframes((mix / peak * (2 ** 31 - 1)).astype(np.int32).tobytes())

print(f"voice  gated RMS {v_db:6.1f} dBFS")
print(f"music  {db(gated_rms(music * gm)) - v_db:+5.1f} dB vs voice (target {MUSIC_DB:+.1f})")
if H:
    print(f"sfx    {len(H)} hits, median {np.median(H) + g_db - v_db:+5.1f} dB vs voice (target {SFX_HIT_DB:+.1f}), loudest {max(H) + g_db - v_db:+5.1f} (cap {SFX_HIT_MAX_DB:+.1f})")
else:
    print(f"sfx    no distinct hits; set to {MUSIC_DB:+.1f} dB vs voice")
print(f"wrote {a.out}: {n / SR:.2f} s" + (f", scaled by {db(1 / peak):.1f} dB to avoid clipping" if peak > 1 else ""))
