"""Sound for the Autun short: synthesized SFX (template sfx_gen.py) on the picture's events + mystery_bed.py music bed.
Standard mix (2026-11-18): bed 21 dB under the voice, never ducked; SFX median hit 12 dB under, loudest 5 dB under; master -14 LUFS.
Usage: python3 sound.py  (reads ../w.json, ../voice/voice.wav, music_bed.wav; writes mix.wav + stems + cues.md)"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
TPL = "/home/user/yt-automation-vault/.claude/skills/3d-short/templates/audio"
sys.path.insert(0, TPL)
from dsp import SR, ns, tt, st, dbg, read_wav, write_wav, integrated, momentary, true_peak, lp, hp, bp, colored, fades, pan, place, widen, make_ir, convolve_st
import sfx_gen as G

W = json.load(open(os.path.join(HERE, "..", "w.json")))
FPS = 30
TOTAL = int(np.ceil((W["end"] + 0.45) * FPS))
DUR = TOTAL / FPS
N = ns(DUR)
r = np.random.default_rng(1522)
S = np.zeros((2, N))
cues = []

def put(name, x, t, gain_db=0.0, p=0.0):
    x = np.asarray(x, float)
    if x.ndim == 1:
        x = pan(x, p)
    place(S, x, max(0.0, t), dbg(gain_db))
    cues.append((t, name, gain_db))

def bed(name, x, t0, t1, gain_db, fin=0.4, fout=0.6):
    n = ns(t1 - t0)
    x = st(np.asarray(x, float))[:, :n]
    place(S, fades(x, fin, fout), t0, dbg(gain_db))
    cues.append((t0, name + f" ({t1 - t0:.1f} s)", gain_db))

E = 0.1
b = {k: W[w] - E for k, w in [("s2", "yousee1"), ("s4", "so1"), ("s9", "so3"), ("s12", "yousee2"), ("s13", "like"), ("s14", "so4"), ("s15", "nobody"), ("s16", "walked")]}

def roar(dur, lo=60, hi=700, k=1.4):
    return st(lp(hp(colored(ns(dur), r, k), lo), hi))
def fire(dur):
    """crackling bonfire: low roar + random crackle pops"""
    return roar(dur, 50, 900, 1.6) * 0.7 + st(G.rattle(dur, r, 14)) * 0.5
def hiss(dur, k=1.0):
    t = tt(dur); env = np.minimum(1, t / 0.05) * np.exp(-t / (dur * 0.6))
    return st(hp(colored(ns(dur), r, 0.0), 2500) * env * k)
def trumpet(dur=1.1, f0=330, f1=620):
    """elephant trumpet: brassy saw sweep with vibrato and a breathy edge"""
    t = tt(dur); f = f0 + (f1 - f0) * np.minimum(1, t / (dur * 0.35)) - 60 * np.maximum(0, t - dur * 0.6) / dur
    ph = 2 * np.pi * np.cumsum(f * (1 + 0.02 * np.sin(2 * np.pi * 7 * t))) / SR
    x = sum(np.sin(k * ph) / k for k in range(1, 9))
    env = np.minimum(1, t / 0.06) * np.minimum(1, (dur - t) / 0.25)
    x = bp(x * env, 250, 3200) + 0.15 * hp(colored(ns(dur), r, 0.5), 1500) * env
    return x / (np.abs(x).max() + 1e-9)
def thud(big=1.0):
    t = tt(0.5); x = np.sin(2 * np.pi * (55 + 40 * np.exp(-t * 20)) * t) * np.exp(-t * 9) + 0.3 * lp(colored(ns(0.5), r, 1.5), 300) * np.exp(-t * 14)
    return x * big
def whoosh(t, g=-8):
    put("whoosh", widen(G.whoosh(0.7, r, 0.35, 400, 3200, 0.8, 0.2, 0.3), r, 12, 0.9), t - 0.35, g)

# ---------- ambience beds
wind = st(G.breeze(DUR, r, 0.7, 0.25, 1200))
room = st(lp(colored(ns(DUR), r, 1.6), 300)) * 0.5
murmur = st(G.babble(DUR, r, 150, 1.0) * 0.18)
rain = widen(lp(hp(colored(ns(DUR), r, 0.3), 900), 7000), r, 9, 1.0) * 0.9
bed("court room tone + murmur", room + murmur, 0, b["s2"], -16)
bed("field breeze + birds", wind + st(G.bird_chirps(DUR, r, 0.45, "sparrow") * 0.06), b["s2"], b["s4"], -14)
bed("court room tone + murmur", room + murmur, b["s4"], b["s9"], -16)
bed("RAIN + gutters", rain + wind * 0.4, b["s9"], b["s12"], -9, 0.2, 0.4)
bed("court at night (candles, rain outside)", room + rain * 0.25, b["s12"], b["s13"], -16)
bed("party chatter", st(G.babble(DUR, r, 200, 1.2) * 0.3), b["s13"], b["s14"], -14)
bed("after the rain: drips + birds", st(G.bird_chirps(DUR, r, 0.3, "sparrow") * 0.05) + widen(G.bubbles(DUR, r, 6, 800, 3000), r, 9, 1.0) * 0.3, b["s14"], b["s15"], -15)
bed("court room tone", room, b["s15"], b["s16"], -17)
bed("evening lane: birds", st(G.bird_chirps(DUR, r, 0.35, "sparrow") * 0.05) + wind * 0.4, b["s16"], DUR, -15)

# ---------- events
put("gavel", G.hammer_hit(r, 0.7), W["court1"] + 0.05, -10)
put("rat squeaks", G.clink(r, 3200, 0.1, 1.6), W["clients"] + 0.1, -13)
put("ta-da sting", G.clink(r, 1400, 0.4, 1.2), W["never"] + 0.05, -9)
put("flash whoosh", widen(G.whoosh(0.75, r, 0.33, 500, 4200, 0.9, 0.09, 0.4), r, 12, 0.9), b["s2"] - 0.33, -6)
for k in range(6):
    put("rat munch", G.rattle(0.2, r, 60), W["eaten"] + k * 0.18, -14, r.uniform(-0.5, 0.5))
put("farmer gasp", G.whoa(r), W["barley"] + 0.05, -10)
put("gavel x2", G.hammer_hit(r, 0.9), W["trial"] + 0.05, -8)
put("gavel", G.hammer_hit(r, 0.7), W["judge"] + 0.02, -12)
put("crowd laugh", G.hurrah(r, 220, 1.1), W["qcourt"] + 0.3, -14)
put("hero sting", G.clink(r, 700, 0.5, 0.8), W["defend"] + 0.05, -10)
put("scroll unroll", G.flag_flutter(0.6, r), W["summons1"] - 0.1, -13)
put("cricket silence", widen(G.crickets(1.2, r, 2) * 0.03, r, 9, 1.0), W["dont"] + 0.2, -14)
put("deadpan ding", G.clink(r, 520, 0.3, 0.6), W["big"] + 0.05, -12)
put("thunder", st(lp(hp(colored(ns(2.0), r, 1.8), 25), 260)), W["so3"] - 0.05, -6)
put("priests' voices", st(G.babble(1.6, r, 120, 0.9) * 0.4), W["priests"] + 0.2, -14)
put("rat snicker", G.clink(r, 3000, 0.1, 1.6), W["still"] + 0.2, -12)
put("mystery sting", G.clink(r, 260, 0.6, 0.4), W["sohow"] + 0.8, -11)
put("thunder", st(lp(hp(colored(ns(1.6), r, 1.8), 25), 260)), W["dangerous"] + 0.1, -7)
put("cat hiss", st(hp(colored(ns(0.6), r, 0.2), 2000) * np.exp(-tt(0.6) * 4)), W["cats"] + 0.05, -8)
put("cat yowl", G.creak(0.8, r, 260, 180), W["cats"] + 0.4, -11)
put("whoosh in", widen(G.whoosh(0.7, r, 0.35, 300, 2500, 0.8, 0.2, 0.3), r, 12, 0.9), b["s12"], -10)
put("door knock", G.hammer_hit(r, 0.5), W["door"] + 0.05, -10)
put("cats protest", G.creak(0.6, r, 300, 220), W["lock"] + 0.1, -11)
put("gavel (stop)", G.hammer_hit(r, 1.0), W["stopped"] + 0.02, -6)
for k in range(8):
    put("tiny steps", G.boot(r, 0.3), W["walked"] + 0.1 + k * 0.2, -18, r.uniform(-0.4, 0.4))
put("final sparkle", G.clink(r, 2400, 0.7, 1.3), W["story"] + 0.1, -11)

def load(path):
    x, sr = read_wav(path)
    if sr != SR:
        from scipy.signal import resample_poly
        from math import gcd
        g = gcd(SR, sr); x = resample_poly(x, SR // g, sr // g, axis=-1)
    x = st(x)
    y = np.zeros((2, N)); y[:, : min(N, x.shape[1])] = x[:, :N]
    return y

v = load(os.path.join(HERE, "..", "voice", "voice.wav"))
v_ref = integrated(v)
m = load(os.path.join(HERE, "music_bed.wav"))
m *= dbg(v_ref - 21.0 - integrated(m))
ir = make_ir(0.9, 7, hf=0.7)
s = S + 0.18 * convolve_st(S, ir)[:, :N]
# SFX level lock: median hit 12 LU under the voice, loudest <= 5 LU under
M = np.maximum(momentary(s, hop=0.1), -90)
fl = max(np.percentile(M, 40), M.max() - 30); pk, last = [], -99
for i in range(2, len(M) - 2):
    if M[i] == M[i - 2:i + 3].max() and M[i] > fl + 6 and i - last >= 5:
        pk.append(M[i]); last = i
g = min((v_ref - 12.0) - float(np.median(pk)), (v_ref - 5.0) - max(pk))
s *= dbg(g)
print(f"sfx lock: {len(pk)} hits, median {np.median(pk) + g - v_ref:+.1f}, max {max(pk) + g - v_ref:+.1f} LU vs voice")
mix0 = v + m + s
G_ = -14.0 - integrated(mix0)
y = mix0 * dbg(G_)
ceil = dbg(-1.2)
from scipy.ndimage import minimum_filter1d, uniform_filter1d
for _ in range(3):
    pkk = np.abs(y).max(0)
    gain = np.minimum(1.0, ceil / np.maximum(pkk, 1e-9))
    gain = uniform_filter1d(minimum_filter1d(gain, ns(0.004)), ns(0.004))
    y = y * gain[None, :]
    y *= dbg(-14.0 - integrated(y))
y = fades(y, 0.0, 0.05)
write_wav(os.path.join(HERE, "mix.wav"), y)
for nm, x in (("voice", v), ("music", m), ("sfx", s)):
    write_wav(os.path.join(HERE, f"stem_{nm}.wav"), x * dbg(G_))
with open(os.path.join(HERE, "cues.md"), "w") as f:
    f.write(f"# Autun sound cues\nvoice {v_ref:.1f} LUFS, music {integrated(m):.1f}, sfx {integrated(s):.1f}; master {integrated(y):.2f} LUFS, TP {true_peak(y):.2f} dBTP, {DUR:.3f} s\n\n")
    for t, nm, gg in sorted(cues):
        f.write(f"- {t:7.2f} s  {nm}  ({gg:+.0f} dB)\n")
print(f"master {integrated(y):.2f} LUFS TP {true_peak(y):.2f}; voice {v_ref:.1f} music {integrated(m):.1f} sfx {integrated(s):.1f}; {len(cues)} cues; {y.shape[1]/SR:.3f} s")
