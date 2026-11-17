#!/usr/bin/env python3
"""Original "playful mystery" music bed for a story short -> music.wav (48 kHz mono, exact length).

The style was measured from the reference channel's 8 latest Shorts (2026-11-16, see the vault note
"RicksClips3000 voice analysis"). Nothing is copied from their audio; the music is composed here at random from rules:
- minor key (D/E/A minor), 100-118 bpm, one continuous cue that never stops and is never ducked
- staccato pizzicato walking bass (C2-C3, a new note every half beat), plucked/mallet melody high up (C5-C7),
  soft off-beat chord stabs in the middle, a light low kick: dark and bass-heavy, almost nothing above 4 kHz
- flat level with small lifts: a hit on frame 0, a lift after the twist, and a final hit on the last word
Set the level with the skill's mix script (the bed sits ~15-16 dB under the voice).

Usage: python3 mystery_bed.py --dur 63.2 [--out music.wav] [--bpm 112] [--key D] [--twist 41.5] [--seed 3]
"""
import argparse, wave
import numpy as np

SR = 48000
ap = argparse.ArgumentParser()
ap.add_argument("--dur", type=float, required=True, help="seconds; use the voice length")
ap.add_argument("--out", default="music.wav")
ap.add_argument("--bpm", type=float, default=112)
ap.add_argument("--key", default="D", choices=["D", "E", "A", "C", "G"], help="minor key root")
ap.add_argument("--twist", type=float, default=None, help="time of the twist line: the band lifts ~3 dB for 2 bars")
ap.add_argument("--seed", type=int, default=3)
a = ap.parse_args()

rng = np.random.default_rng(a.seed)
N = int(a.dur * SR)
out = np.zeros(N + SR * 3)
beat = 60 / a.bpm
root = {"C": 48, "D": 50, "E": 52, "G": 55, "A": 57}[a.key]          # C3..A3
MINOR = [0, 2, 3, 5, 7, 8, 10]
hz = lambda m: 440 * 2 ** ((m - 69) / 12)


def ks(f, dur, bright=0.5, decay=0.996):
    """Additive pizzicato pluck: a few harmonics, the higher ones dying faster. `bright` sets how many overtones
    speak, `decay` (0.99-0.997) how long the note rings. No noise burst, so the spectrum stays dark like the reference."""
    t = np.arange(int(dur * SR)) / SR
    ring = 1 / (1 - decay) / SR * 60          # seconds-ish time constant from the decay factor
    y = sum((bright ** (k - 1)) / k * np.sin(2 * np.pi * f * k * t) * np.exp(-t * k / ring) for k in range(1, 7) if f * k < 6000)
    return y * np.minimum(1, t / 0.003)


def mallet(f, dur=0.5):
    """Marimba-ish: fundamental + 4th partial, fast decay."""
    t = np.arange(int(dur * SR)) / SR
    return (np.sin(2 * np.pi * f * t) * np.exp(-t * 9) + 0.1 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t * 30)) \
        * np.minimum(1, t / 0.002)


def kick(vel=1.0):
    t = np.arange(int(0.3 * SR)) / SR
    f = 48 + 70 * np.exp(-t * 35)
    return vel * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)


def snap(vel=0.3):
    t = np.arange(int(0.08 * SR)) / SR
    x = rng.standard_normal(len(t)) * np.exp(-t * 60)
    return vel * np.diff(x, prepend=0)  # crude high-pass: a dry finger snap / shaker tick


def lowpass(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + (f / fc) ** 4), len(x))


def put(sig, t, g):
    i = int(t * SR); j = min(len(out), i + len(sig))
    if 0 <= i < len(out): out[i:j] += sig[:j - i] * g


# i - VI - iv - V (natural minor with a major V for the "sneaky" pull back home)
PROG = [(0, [0, 3, 7]), (8, [8, 12, 15]), (5, [5, 8, 12]), (7, [7, 11, 14])]
deg = lambda d: root + MINOR[d % 7] + 12 * (d // 7)

# a 2-bar melody motif (8th-note grid, None = rest), reused with small variations so it sounds composed
def motif():
    m, d = [], rng.integers(2, 6)
    for k in range(16):
        if rng.random() < 0.35:
            m.append(None); continue
        d = int(np.clip(d + rng.choice([-2, -1, -1, 0, 1, 1, 2]), 0, 9)); m.append(d)
    return m
MOT = [motif(), motif()]

bars = int(np.ceil(a.dur / (4 * beat))) + 1
SEC = rng.uniform(0.75, 1.15, bars // 4 + 2)
for b in range(bars):
    t0 = b * 4 * beat
    if t0 > a.dur: break
    rb, chord = PROG[b % 4]
    lift = SEC[b // 4]  # each 4-bar section a little louder or softer, like a real arrangement
    if a.twist is not None and a.twist <= t0 < a.twist + 8 * beat: lift = 1.4
    if t0 > a.dur * 0.9: lift = max(lift, 1.2)
    # walking bass: 8 eighths per bar, staccato, chord tones + passing notes
    c0, c1, c2 = chord
    nxt = PROG[(b + 1) % 4][0]
    walk = [c0, c2, c1, c2, c0 + 12, c2, c1, nxt + (1 if nxt < c0 else -1)]  # chord tones, then a step into the next chord
    for k, iv in enumerate(walk):
        f = hz(root - 12 + iv - (12 if iv > 9 else 0))  # stays in C2-C3
        put(ks(f, 0.45, bright=0.15, decay=0.995) * np.exp(-np.arange(int(0.45 * SR)) / SR * 4), t0 + k * beat / 2, 0.35 * lift)
    # kick on 1 and 3, a soft snap on 2 and 4
    for k in (0, 2): put(kick(), t0 + k * beat, 0.75 * lift)
    for k in (1, 3): put(snap(), t0 + k * beat, 0.08 * lift)
    # off-beat chord stabs (the "and" of 2 and 4)
    for k in (1.5, 3.5):
        for c in chord:
            put(ks(hz(root + 12 + c - (12 if c > 11 else 0)), 0.3, bright=0.5, decay=0.993), t0 + k * beat, 0.32 * lift)
    # melody: motif A A' B A pattern, alternating pizzicato and mallet colour per 4 bars
    mot = MOT[0] if (b // 2) % 4 != 2 else MOT[1]
    if b % 8 in (4, 5) and b > 3: mot = [None] * 16  # melody drops out for 2 of every 8 bars: room for the voice
    half = (b % 2) * 8
    inst = mallet if (b // 4) % 2 else (lambda f, d=0.3: ks(f, d, bright=0.55, decay=0.995))
    for k in range(8):
        d = mot[half + k]
        if d is None or (b % 8 == 7 and k > 4): continue
        put(inst(hz(deg(d) + 36)), t0 + k * beat / 2, 0.3 * lift)

# frame-0 hit and the final hit on the last word: low stab + kick
for t in (0.0, max(0.0, a.dur - 0.25)):
    put(kick(1.2), t, 0.45)
    for c in PROG[0][1]: put(ks(hz(root - 12 + c), 0.8, bright=0.4, decay=0.996), t, 0.35)

y = lowpass(out, 4000)[:N]                   # keep it dark: the reference bed has ~1-2 % energy above 4 kHz
y *= np.minimum(1, (N - np.arange(N)) / (0.05 * SR))  # no click at the end
y = y / max(1e-9, np.abs(y).max()) * 0.8
with wave.open(a.out, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((y * 32767).astype(np.int16).tobytes())
print(f"{a.out}: {a.dur:.2f} s, {a.bpm:g} bpm, {a.key} minor, twist lift at {a.twist}")
