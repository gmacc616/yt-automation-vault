#!/usr/bin/env python3
"""Level-locked mix: voice unchanged, music bed and SFX at 50 % of the voice level -> mix_raw.wav.

Usage: python3 mix.py voice.wav music.wav sfx.wav [--out mix_raw.wav]
- Levels are gated RMS (400 ms blocks, blocks quieter than -40 dBFS or 20 dB under the loudest are ignored).
- Music gain: exactly 0.5 x the voice's gated RMS (-6.0 dB). SFX: the same, then lowered further if its
  peak would pass 0.7 x the voice peak. No ducking, no compression: finish.sh adds one linear gain + a limiter.
- The output is float32 (headroom kept for finish.sh) and exactly as long as the voice.
"""
import argparse, subprocess, wave
import numpy as np

SR = 48000

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

def fit(x, n):
    out = np.zeros(n); out[:min(n, len(x))] = x[:n]; return out

db = lambda r: 20 * np.log10(max(r, 1e-12))

ap = argparse.ArgumentParser()
ap.add_argument("voice"); ap.add_argument("music"); ap.add_argument("sfx"); ap.add_argument("--out", default="mix_raw.wav")
a = ap.parse_args()

voice = load(a.voice); n = len(voice)
music, sfx = fit(load(a.music), n), fit(load(a.sfx), n)
v_rms, v_peak = gated_rms(voice), np.abs(voice).max()
gm = 0.5 * v_rms / max(gated_rms(music), 1e-12)
gs = 0.5 * v_rms / max(gated_rms(sfx), 1e-12)
if np.abs(sfx).max() * gs > 0.7 * v_peak:
    gs = 0.7 * v_peak / np.abs(sfx).max()
mix = voice + music * gm + sfx * gs

with wave.open(a.out, "wb") as w:  # 32-bit PCM keeps headroom without float-WAV quirks
    w.setnchannels(1); w.setsampwidth(4); w.setframerate(SR)
    peak = max(1.0, np.abs(mix).max())
    w.writeframes((mix / peak * (2 ** 31 - 1)).astype(np.int32).tobytes())

print(f"voice  gated RMS {db(v_rms):6.1f} dBFS, peak {db(v_peak):6.1f} dBFS")
print(f"music  {db(gated_rms(music * gm)) - db(v_rms):+5.1f} dB vs voice (target -6.0)")
print(f"sfx    {db(gated_rms(sfx * gs)) - db(v_rms):+5.1f} dB vs voice (target <= -6.0), peak {db(np.abs(sfx * gs).max()) - db(v_peak):+5.1f} dB vs voice peak")
print(f"wrote {a.out}: {n / SR:.2f} s" + (f", scaled by {db(1 / peak):.1f} dB to avoid clipping" if peak > 1 else ""))
