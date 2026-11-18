"""Sound for the Hannibal short: synthesized SFX (template sfx_gen.py) on the picture's events + mystery_bed.py music bed.
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
r = np.random.default_rng(218)
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
b = {k: W[w] - E for k, w in [("s2", "yousee1"), ("s9", "sohannibal"), ("s14", "least"), ("s15", "sohow"), ("s16", "well"), ("s17", "like"), ("s18", "sorock"),
     ("s19", "zigzag"), ("s20", "four"), ("s21", "elephants3")]}

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
wind = st(G.breeze(DUR, r, 1.0, 0.3, 900))
bed("night fire + wind (hook)", fire(DUR) + wind * 0.5, 0, b["s2"], -8)
bed("mountain wind", wind, b["s2"], W["wind"] - 0.3, -15)
bed("howling wind", st(G.breeze(DUR, r, 1.4, 0.5, 1400)), W["wind"] - 0.3, W["finally"] - 0.2, -10, 0.2, 0.4)
bed("summit wind", wind, W["finally"] - 0.2, b["s9"], -15)
bed("night wind", wind * 0.8, b["s9"], W["fire1"] - 0.2, -16)
bed("bonfire", fire(DUR) + wind * 0.3, W["fire1"] - 0.2, W["his"] - 0.2, -7, 0.1, 0.3)
bed("night wind (grove)", wind * 0.7, W["his"] - 0.2, W["burn"] - 0.2, -16)
bed("bonfire", fire(DUR) + wind * 0.3, W["burn"] - 0.2, b["s14"], -8, 0.3, 0.3)
bed("study crickets", widen(G.crickets(DUR, r, 3) * 0.02, r, 9, 1.0), b["s14"], b["s15"], -15)
bed("embers + steam", fire(DUR) * 0.5 + hiss(DUR, 0.3), b["s15"], b["s16"], -13)
bed("night wind (explain)", wind * 0.6, b["s16"], b["s17"], -17)
bed("kitchen crickets", widen(G.crickets(DUR, r, 3) * 0.02, r, 9, 1.0), b["s17"], b["s18"], -15)
bed("dawn wind", wind * 0.7, b["s18"], b["s20"], -16)
bed("valley birds + breeze", wind * 0.4 + st(G.bird_chirps(DUR, r, 0.45, "sparrow") * 0.06), b["s20"], DUR, -14)

# ---------- events
# hook: fire roar, the vinegar hiss, the rock cracking
put("fire whoomp", roar(0.9, 40, 600, 1.8), 0.0, -4)
put("vinegar hiss", hiss(1.6, 1.0), W["vinegar1"] - 0.25, -6)
put("rock crack", G.wood_crack(r), W["vinegar1"] + 0.5, -6)
put("flash whoosh", widen(G.whoosh(0.75, r, 0.33, 500, 4200, 0.9, 0.09, 0.4), r, 12, 0.9), b["s2"] - 0.33, -6)
# the march
for k in range(14):
    put("boots on the path", G.boot(r, 0.5 + 0.3 * r.uniform()), W["marching"] + k * 0.42, -18, r.uniform(-0.5, 0.5))
put("elephant trumpet", trumpet(1.2), W["elephants1"] + 0.05, -6, 0.2)
for k in range(4):
    put("elephant stomp", thud(0.8), W["with37"] + 0.1 + k * 0.5, -10, 0.2)
put("question sting", G.clink(r, 520, 0.25, 0.6), W["q_snow"] + 0.15, -14)
# the climb
put("climb whoosh", widen(G.whoosh(0.8, r, 0.35, 300, 2600, 0.8, 0.2, 0.3), r, 12, 0.9), W["soclimb"] - 0.3, -10)
put("tribes whoop", G.hurrah(r, 230, 1.2), W["ambushes"] + 0.05, -10, -0.4)
put("rockslide", st(G.rattle(1.4, r, 40, heavy=True)) + roar(1.4, 40, 500, 1.6) * 0.5, W["rockslides"] - 0.05, -5)
put("soldiers whoa", G.whoa(r), W["rockslides"] + 0.3, -11, 0.3)
put("wind gust", widen(G.whoosh(1.2, r, 0.5, 300, 2400, 0.9, 0.4, 0.6), r, 12, 1.0), W["wind"] - 0.2, -7)
# the top
put("army cheer", G.hurrah(r, 170, 1.1), W["top"] - 0.2, -8)
put("snow chime", G.clink(r, 2400, 0.6, 1.4), W["snow1"] - 0.05, -12)
put("cheer dies", G.oof(r, "oof"), W["snow1"] + 0.3, -13, -0.2)
# the path ends
put("stop whoosh", widen(G.whoosh(0.6, r, 0.3, 400, 3000, 0.8, 0.2, 0.3), r, 12, 0.9), W["ends"] - 0.25, -9)
put("pebbles fall", G.rattle(0.9, r, 25), W["ends"] + 0.2, -12, 0.3)
put("landslide rumble", roar(1.8, 30, 400, 1.8), W["landslide"] - 0.1, -4)
put("debris", st(G.rattle(1.2, r, 50, heavy=True)), W["swept"], -9)
put("echo whoosh (crane)", widen(G.whoosh(1.2, r, 0.5, 200, 1800, 0.9, 0.4, 0.6), r, 14, 1.0), W["thousand"] - 0.4, -9)
# horses, elephants, snow
put("hoof scrape", G.creak(0.6, r, 120, 60), W["slip"] - 0.05, -7)
put("horse whinny-ish whoa", G.whoa(r), W["slip"] + 0.1, -11)
put("snow slide", widen(G.whoosh(0.5, r, 0.2, 800, 5000, 0.6, 0.2, 0.2), r, 8, 0.8), W["slip"] + 0.05, -10)
put("stubborn grunt", trumpet(0.6, 180, 220), W["budge"] + 0.05, -8, 0.2)
put("snow crunch", G.rattle(0.35, r, 70), W["eat"] + 0.05, -9)
# the sane general
put("dramatic sting", G.clink(r, 300, 0.4, 0.5), W["sane"] + 0.1, -13)
put("FIRE whoosh", widen(G.whoosh(0.9, r, 0.4, 150, 2200, 0.9, 0.2, 0.4), r, 12, 1.0), W["fire1"] - 0.35, -4)
put("FIRE roar", roar(1.2, 40, 800, 1.6), W["fire1"] + 0.02, -3)
# chop, stack, burn, glow
for k in range(5):
    put("axe thunk", G.hammer_hit(r, 0.7), W["chop"] + k * 0.28, -9 - k, -0.3 + 0.15 * k)
put("tree crack", G.wood_crack(r), W["trees"] + 0.15, -7)
put("tree falls", widen(G.whoosh(0.7, r, 0.4, 150, 1500, 0.8, 0.2, 0.3), r, 10, 0.9), W["trees"] + 0.25, -9)
put("tree THUD", thud(1.2), W["trees"] + 0.62, -4)
for k in range(3):
    put("logs stacked", G.hammer_hit(r, 0.4), W["stack"] + 0.1 + k * 0.22, -12 - k)
put("fire catches", roar(1.0, 40, 900, 1.4), W["burn"] - 0.05, -6)
put("heat hum", st(np.sin(2 * np.pi * 70 * tt(1.6)) * np.minimum(1, tt(1.6) / 0.5) * 0.6), W["glows"], -12)
# vinegar
put("jars clink", G.clink(r, 900, 0.2, 0.8), W["pour"] - 0.15, -12)
put("VINEGAR HISS", hiss(2.2, 1.0), W["vinegar2"] - 0.1, -3)
put("steam whoosh", widen(G.whoosh(1.0, r, 0.4, 600, 4500, 0.9, 0.3, 0.5), r, 12, 1.0), W["vinegar2"], -9)
# Livy
put("scroll rustle", G.flag_flutter(0.6, r), W["livy"] - 0.2, -14)
put("swear ding", G.clink(r, 1800, 0.35, 1.1), W["swears"] + 0.05, -11)
# mystery beat + explanation
put("mystery sting", G.clink(r, 260, 0.6, 0.4), W["mountain"] + 0.1, -11)
put("whoosh in", widen(G.whoosh(0.7, r, 0.35, 300, 2500, 0.8, 0.2, 0.3), r, 12, 0.9), b["s16"], -10)
put("swell hum", st(np.sin(2 * np.pi * (60 + 25 * tt(1.0)) * tt(1.0)) * np.minimum(1, tt(1.0) / 0.4) * 0.6), W["swells"] - 0.1, -10)
put("cold SPLASH", G.splash_big(r), W["splash"] - 0.05, -5)
put("splash hiss", hiss(1.2, 0.8), W["cold"] - 0.05, -8)
put("shrink creak", G.creak(0.8, r, 60, 120), W["shrinks"], -9)
# kitchen: water over the hot dish, crack
put("tap water", widen(G.bubbles(1.4, r, 70, 600, 3000), r, 8, 0.8), W["cold2"] - 0.2, -11)
put("dish sizzle", hiss(1.0, 0.6), W["cold2"] + 0.1, -12)
put("GLASS crack", G.clink(r, 3200, 0.3, 1.6), W["dish"] - 0.05, -5)
put("glass split", G.rattle(0.4, r, 60), W["dish"] + 0.05, -9)
# the rock cracks apart, the zigzag, down into Italy
put("ROCK CRACK", G.wood_crack(r), W["cracks"] - 0.05, -2)
put("rock boom", thud(1.4), W["cracks"] + 0.02, -3)
put("chunks tumble", st(G.rattle(1.6, r, 30, heavy=True)) + roar(1.6, 30, 400, 1.6) * 0.4, W["cracks"] + 0.4, -7)
for k in range(4):
    put("pick clink", G.clink(r, 1200 + 120 * k, 0.12, 1.0), W["zigzag"] + k * 0.16, -12)
put("whoosh down", widen(G.whoosh(0.8, r, 0.35, 300, 2600, 0.8, 0.2, 0.3), r, 12, 0.9), b["s20"], -10)
for k in range(8):
    put("steps down", G.boot(r, 0.5), W["four"] + 0.2 + k * 0.4, -18, r.uniform(-0.4, 0.4))
put("valley shimmer", G.clink(r, 2600, 0.8, 1.3), W["italy"] + 0.05, -12)
# finale
put("elephant TRUMPET", trumpet(1.3, 300, 680), W["elephants3"] + 0.02, -5, 0.1)
put("crane whoosh", widen(G.whoosh(1.0, r, 0.4, 200, 1800, 0.9, 0.3, 0.5), r, 14, 1.0), W["over2"] - 0.3, -10)
put("final snow chime", G.clink(r, 2200, 0.7, 1.3), W["insnow"] + 0.3, -11)

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
    f.write(f"# Hannibal sound cues\nvoice {v_ref:.1f} LUFS, music {integrated(m):.1f}, sfx {integrated(s):.1f}; master {integrated(y):.2f} LUFS, TP {true_peak(y):.2f} dBTP, {DUR:.3f} s\n\n")
    for t, nm, gg in sorted(cues):
        f.write(f"- {t:7.2f} s  {nm}  ({gg:+.0f} dB)\n")
print(f"master {integrated(y):.2f} LUFS TP {true_peak(y):.2f}; voice {v_ref:.1f} music {integrated(m):.1f} sfx {integrated(s):.1f}; {len(cues)} cues; {y.shape[1]/SR:.3f} s")
