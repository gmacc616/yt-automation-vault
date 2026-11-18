"""Sound for the yakhchal short: synthesized SFX (template sfx_gen.py) on the picture's events + mystery_bed.py music bed.
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
r = np.random.default_rng(1700)
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
b = {k: W[w] - E for k, w in [("s2", "yousee1"), ("s3", "so1"), ("s6", "then1"), ("s7", "atnight"), ("s8", "morning"), ("s10", "well"), ("s11", "like"), ("s12", "so2"),
     ("s13", "stack"), ("s14", "dome2"), ("s15", "then2"), ("s16", "turns")]}

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
wind = st(G.breeze(DUR, r, 0.8, 0.25, 1200))
market = st(G.babble(DUR, r, 160, 1.1) * 0.25) + st(G.bird_chirps(DUR, r, 0.3, "sparrow") * 0.04)
bed("hot square: market murmur + breeze", market + wind * 0.4, 0, b["s3"], -14)
bed("building site breeze", wind * 0.6 + market * 0.4, b["s3"], b["s6"], -16)
bed("winter wind at the wall", st(G.breeze(DUR, r, 1.1, 0.35, 900)), b["s6"], b["s7"], -14)
bed("night crickets + wind", widen(G.crickets(DUR, r, 3) * 0.02, r, 9, 1.0) + wind * 0.4, b["s7"], b["s8"], -14)
bed("dawn birds", st(G.bird_chirps(DUR, r, 0.4, "sparrow") * 0.06) + wind * 0.3, b["s8"], b["s10"], -15)
bed("night crickets", widen(G.crickets(DUR, r, 3) * 0.02, r, 9, 1.0), b["s10"], b["s11"], -14)
bed("freezer hum", st(np.sin(2 * np.pi * 60 * tt(DUR)) * 0.4 + 0.2 * np.sin(2 * np.pi * 120 * tt(DUR))) + st(lp(colored(ns(DUR), r, 1.0), 300)) * 0.3, b["s11"], b["s12"], -18)
bed("sunrise birds", st(G.bird_chirps(DUR, r, 0.5, "sparrow") * 0.06) + wind * 0.3, b["s12"], b["s13"], -15)
bed("pit echo room", st(lp(colored(ns(DUR), r, 1.6), 250)) * 0.6, b["s13"], b["s14"], -18)
bed("summer square", market + wind * 0.4, b["s14"], DUR, -14)

# ---------- events
put("spoon clink", G.clink(r, 2100, 0.15, 1.2), W["middle"] + 0.2, -12)
put("slurp-ish whoosh", widen(G.whoosh(0.4, r, 0.2, 800, 3500, 0.6, 0.1, 0.2), r, 8, 0.8), W["desert"] + 0.2, -14)
put("kid giggle", G.hurrah(r, 300, 1.4, kid=True), W["freezer"] + 0.1, -11)
put("flash whoosh", widen(G.whoosh(0.75, r, 0.33, 500, 4200, 0.9, 0.09, 0.4), r, 12, 0.9), b["s2"] - 0.33, -6)
put("heat sting", G.clink(r, 300, 0.5, 0.4), W["hundred"] + 0.05, -12)
put("fan flaps", G.flag_flutter(1.2, r), W["centuries"], -16)
put("crane whoosh", widen(G.whoosh(1.2, r, 0.5, 200, 1800, 0.9, 0.4, 0.6), r, 14, 1.0), W["snow1"] - 0.4, -9)
put("dome rises rumble", st(lp(hp(colored(ns(1.4), r, 1.6), 30), 300)), W["built"] - 0.1, -11)
for k in range(4):
    put("mud slap", G.hammer_hit(r, 0.4), W["built"] + 0.1 + k * 0.25, -13 - k)
put("whoa", G.whoa(r), W["sixty"] + 0.1, -11)
put("thick thud", G.hammer_hit(r, 1.0), W["thick"] + 0.05, -9)
for key, f0 in [("sand", 900), ("clay", 700), ("lime", 1200), ("ash", 600)]:
    put(f"plop {key}", G.clink(r, f0, 0.12, 0.6), W[key] + 0.02, -12)
put("goat bleat-ish", G.oof(r, "oof"), W["goat"] + 0.15, -10)
put("egg crack", G.wood_crack(r)[:, : ns(0.25)] if G.wood_crack(r).ndim == 2 else G.wood_crack(r)[: ns(0.25)], W["egg"] + 0.05, -9)
put("question sting", G.clink(r, 520, 0.25, 0.6), W["wall1"] + 0.1, -12)
for k in range(6):
    put("dig", G.rattle(0.25, r, 40), W["dig"] + k * 0.32, -13)
put("wall rise whoosh", widen(G.whoosh(0.9, r, 0.4, 200, 1800, 0.9, 0.3, 0.5), r, 12, 1.0), W["wall2"] - 0.3, -10)
put("sluice clunk", G.hammer_hit(r, 0.8), W["flood"] - 0.05, -9)
put("water rush", widen(G.bubbles(1.8, r, 70, 300, 2500), r, 9, 1.0), W["flood"] + 0.1, -11)
put("freeze shimmer", G.clink(r, 2600, 0.8, 1.5), W["morning"] + 0.2, -11)
put("ice knock", G.clink(r, 1600, 0.2, 1.3), W["ice1"] + 0.02, -7)
put("mystery sting", G.clink(r, 260, 0.6, 0.4), W["frost"] + 0.1, -11)
put("whoosh up", widen(G.whoosh(1.0, r, 0.4, 300, 3000, 0.9, 0.3, 0.5), r, 12, 1.0), W["throws"] - 0.2, -8)
put("sky shimmer", G.clink(r, 2900, 0.9, 1.4), W["sky1"] + 0.1, -11)
put("freezer door", G.creak(0.5, r, 90, 60), W["like"] + 0.05, -10)
put("cold whoosh", widen(G.whoosh(0.9, r, 0.4, 900, 5000, 0.8, 0.3, 0.4), r, 12, 1.0), W["freezer2"], -9)
put("whole sky swell", widen(G.whoosh(1.2, r, 0.5, 200, 2200, 0.9, 0.4, 0.6), r, 14, 1.0), W["whole"] - 0.2, -8)
put("ICE SMASH", G.wood_crack(r), W["smash"] - 0.02, -9)
for k in range(5):
    put("ice chips", G.clink(r, 1800 + 200 * k, 0.15, 1.3), W["smash"] + 0.1 + k * 0.07, -11 - k)
put("sled drag", G.chain_groan(1.4, r, 0.2, 0.6, 18, 26), W["drag"], -11)
for k in range(4):
    put("block stack", G.hammer_hit(r, 0.5), W["stack"] + 0.1 + k * 0.32, -11)
put("straw rustle", G.flag_flutter(0.8, r), W["straw"], -14)
put("warm air whoosh", widen(G.whoosh(1.0, r, 0.4, 200, 1600, 0.9, 0.3, 0.5), r, 12, 1.0), W["warm"] - 0.1, -10)
put("chimney puff", G.oof(r, "oof"), W["chimney"] + 0.1, -16)
put("door creak", G.creak(0.7, r, 80, 50), W["comes"] - 0.2, -10)
put("kids cheer", G.hurrah(r, 280, 1.3, kid=True), W["iceout"] + 0.05, -8)
put("reveal shimmer", G.clink(r, 2400, 0.7, 1.3), W["skyend"] + 0.05, -10)

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
    f.write(f"# yakhchal sound cues\nvoice {v_ref:.1f} LUFS, music {integrated(m):.1f}, sfx {integrated(s):.1f}; master {integrated(y):.2f} LUFS, TP {true_peak(y):.2f} dBTP, {DUR:.3f} s\n\n")
    for t, nm, gg in sorted(cues):
        f.write(f"- {t:7.2f} s  {nm}  ({gg:+.0f} dB)\n")
print(f"master {integrated(y):.2f} LUFS TP {true_peak(y):.2f}; voice {v_ref:.1f} music {integrated(m):.1f} sfx {integrated(s):.1f}; {len(cues)} cues; {y.shape[1]/SR:.3f} s")
