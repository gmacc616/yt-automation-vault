"""Sound for the Tsar Bell short: synthesized SFX (template sfx_gen) on the picture's events + mystery_bed.py music bed,
mixed under the voice: bed 16 LU under the voice (no ducking), SFX stem -6 dB, voice unchanged; master -15 LUFS, <= -1 dBTP.
Usage: python3 sound.py  (reads ../w.json, ../voice/voice.wav, music_bed.wav; writes mix.wav + stems + cues.md)"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
TPL = "/home/user/yt-automation-vault/.claude/skills/3d-short/templates/audio"
sys.path.insert(0, TPL)
from dsp import SR, ns, tt, st, dbg, read_wav, write_wav, integrated, true_peak, lp, hp, bp, colored, fades, pan, place, widen, make_ir, convolve_st
import sfx_gen as G

W = json.load(open(os.path.join(HERE, "..", "w.json")))
FPS = 30
TOTAL = int(np.ceil((W["end"] + 0.45) * FPS))
DUR = TOTAL / FPS
N = ns(DUR)
r = np.random.default_rng(1737)
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

def fire_bed(dur):
    """crackling fire: low roar + random pops"""
    n = ns(dur)
    roar = lp(colored(n, r, 1.4), 500) * 0.5
    pops = np.zeros(n)
    for _ in range(int(dur * 22)):
        i = int(r.uniform(0, n - 2000)); k = np.arange(int(r.uniform(150, 900)))
        pops[i:i + len(k)] += r.normal(0, 1, len(k)) * np.exp(-k / r.uniform(40, 200)) * r.uniform(0.2, 1.0)
    return roar + hp(pops, 900) * 0.35

def sizzle(dur, decay=0.6):
    n = ns(dur); t = np.arange(n) / SR
    return hp(bp(colored(n, r, 0.2), 2500, 9000), 1800) * np.exp(-t / decay) * np.minimum(1, t / 0.02)

def metal_crack(big=1.0):
    """a cast-bronze crack: a sharp broadband snap + short inharmonic metal ring"""
    n = ns(0.9); t = np.arange(n) / SR
    snap = r.normal(0, 1, n) * np.exp(-t / 0.012)
    ring = sum(np.sin(2 * np.pi * f * t + r.uniform(0, 6)) * np.exp(-t / d) * a for f, d, a in [(523, 0.25, 0.4), (1187, 0.15, 0.3), (2210, 0.08, 0.25), (3460, 0.05, 0.2)])
    thud = np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.12) * big
    return (snap * 0.9 + ring * 0.5 + thud * 0.6) * 0.8

def glass_crack():
    n = ns(0.6); t = np.arange(n) / SR
    tinks = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, d in [(3200, 0.05), (4700, 0.04), (6100, 0.03)])
    return hp(r.normal(0, 1, n) * np.exp(-t / 0.02), 2500) * 0.8 + tinks * 0.3

def big_thud():
    n = ns(1.2); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * (48 + 30 * np.exp(-t / 0.05)) * t) * np.exp(-t / 0.35) + lp(r.normal(0, 1, n), 400) * np.exp(-t / 0.08) * 0.6)

def bell_clang(f0=180):
    n = ns(2.4); t = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * f0 * m * t + r.uniform(0, 6)) * np.exp(-t / d) * a for m, d, a in [(1, 1.2, 0.5), (2.0, 0.8, 0.35), (2.4, 0.6, 0.3), (3.0, 0.45, 0.25), (4.2, 0.3, 0.2)]) * 0.6 + r.normal(0, 1, n) * np.exp(-t / 0.01) * 0.4

def drip_plink(f=1400):
    n = ns(0.25); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (f + 900 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.04) * 0.5

# shot starts (seconds), mirrored from story.ts
s = lambda k: W[k] - 0.12
b = {"s2": W["because"] - 0.1, "s3": s("moscow"), "s4": s("empress"), "s5": s("two"), "s6": s("heavy"), "s7": s("may"), "s8": s("scaffolding"),
     "s9": s("guards"), "s10": s("crack"), "s11": s("luckily"), "s12": s("unluckily"), "s13": s("yousee"), "s14": s("ice"), "s15": s("eighteen"),
     "s16": s("stone"), "s17": s("heres"), "s18": s("first"), "s19": s("survived")}

# ---------- ambience beds
day = st(G.breeze(DUR, r, 0.6, 0.15, 900)) + st(G.bird_chirps(DUR, r, 0.3, "sparrow") * 0.05)
crowd = st(G.babble(DUR, r, 160, 1.1, 4.4, 0.75) * 0.3)
fire = widen(fire_bed(DUR), r, 11, 1.0)
bed("square: breeze + visitors", day + crowd * 0.6, 0, b["s2"], -14)
bed("fire (hook pour)", fire, b["s2"], b["s3"], -8, 0.05, 0.2)
bed("Moscow day: breeze, birds", day, b["s3"], b["s5"], -13)
bed("pit: hollow room tone", st(lp(colored(N, r, 1.2), 300)) * 0.5, b["s5"], b["s7"], -16)
bed("fire spreading", fire, b["s7"] + 0.5, b["s11"], -9, 1.2, 0.8)
bed("fire dying + steam", fire * 0.5 + st(sizzle(DUR, 9.0)) * 0.3, b["s11"], b["s12"], -12)
bed("ninety-nine years: breeze + birds", day, b["s12"], b["s13"], -13)
bed("night crickets", widen(G.crickets(DUR, r, 3) * 0.02, r, 9, 1.0), b["s13"], b["s15"], -12)
bed("1836 crowd + breeze", day + crowd, b["s15"], b["s18"], -13)
bed("flashback fire", fire, b["s18"], b["s19"], -9, 0.3, 0.4)
bed("square: visitors (end)", day + crowd * 0.6, b["s19"], DUR, -14)

def whoosh(t, g=-8):
    put("whoosh", widen(G.whoosh(0.7, r, 0.35, 400, 3200, 0.8, 0.2, 0.3), r, 12, 0.9), t - 0.35, g)

# hook: total quiet on "never made a single sound" (a soft air tone only), then the pour and the hiss
put("held breath (air)", widen(G.whoosh(1.6, r, 0.8, 200, 900, 0.9, 0.4, 0.6), r, 12, 1.0), W["never"] - 0.2, -18)
put("bucket splash (hook)", G.splash_big(r), b["s2"] + 0.15, -6)
put("steam hiss (hook)", sizzle(1.6, 0.8), b["s2"] + 0.2, -8)
put("flash whoosh", widen(G.whoosh(0.75, r, 0.33, 500, 4200, 0.9, 0.09, 0.4), r, 12, 0.9), b["s3"] - 0.33, -6)
# the Empress
put("nobles murmur", G.babble(1.2, r, 120, 1.0, 5.0, 0.6) * 0.5, W["kremlin"], -14)
put("BIGGEST sting", G.clink(r, 420, 0.4, 1.0), W["biggest2"] - 0.02, -10)
put("nobles gasp", G.whoa(r), W["biggest2"] + 0.25, -12, 0.3)
# bronze, the giraffe pop, the craftsmen's hammers, the crane up
put("bronze hum", G.clink(r, 160, 0.9, 0.5), W["bronze"], -12)
put("giraffe pop", widen(G.whoosh(0.35, r, 0.1, 900, 4000, 0.7, 0.1, 0.2), r, 8, 0.8), W["giraffe"] - 0.28, -8)
put("giraffe boing", G.clink(r, 300, 0.3, 0.6), W["giraffe"] - 0.2, -12)
for k in range(10):
    put("hammer", G.hammer_hit(r, 0.6 + 0.4 * r.uniform()), b["s5"] + 0.4 + k * 0.52 + r.uniform(0, 0.1), -16, r.uniform(-0.6, 0.6))
whoosh(W["pit"] + 0.1, -10)
# 1737: alarm, fire takes the scaffolding, the bell heats
put("crowd gasp (fire)", G.whoa(r), W["fire"] + 0.1, -9, -0.3)
put("fire whoomp", widen(G.whoosh(1.2, r, 0.5, 120, 900, 0.9, 0.4, 0.6), r, 14, 1.0), W["fire"] - 0.1, -6)
put("timber crack", G.wood_crack(r), W["flames"] - 0.05, -8)
put("beam falls", G.timber_tear(r, 0.9), W["flames"] + 0.6, -10, 0.4)
put("heat rumble", widen(G.whoosh(1.6, r, 0.7, 80, 400, 0.9, 0.6, 0.6), r, 12, 1.0), W["hot"] - 0.3, -8)
put("REALLY hot whoomp", widen(G.whoosh(0.7, r, 0.2, 150, 1200, 0.9, 0.3, 0.4), r, 12, 1.0), W["really"] - 0.1, -6)
# guards: boots on planks, buckets, the pour and the hiss
for k in range(6):
    put("boots on planks", G.boot(r, 0.7), b["s9"] + 0.15 + k * 0.16, -14, r.uniform(-0.5, 0.5))
put("buckets clank", G.rattle(0.4, r, 30), W["grab"] - 0.02, -10)
for k in range(5):
    put("water pour", G.splash_big(r)[: ns(0.9)], W["pour"] + 0.05 + k * 0.08, -9 - k, -0.4 + 0.2 * k)
put("STEAM hiss", sizzle(2.0, 0.9), W["pour"] + 0.2, -3)
# cracks
put("CRACK", metal_crack(1.0), W["crack"] - 0.03, -2, 0.1)
put("crack 2", metal_crack(0.8), W["another"] - 0.03, -3, -0.2)
for k in range(9):
    put("crack run", metal_crack(0.4), W["eleven"] - 0.03 + k / 18 + r.uniform(0, 0.02), -9, r.uniform(-0.6, 0.6))
put("chunk tears", G.timber_tear(r, 0.6), W["chunk"] + 0.1, -10)
put("CHUNK THUD", big_thud(), W["off"] - 0.03, 0)
put("debris rattle", G.rattle(0.6, r, 40, heavy=True), W["off"] + 0.05, -10)
# luckily / unluckily
put("relief sigh", G.oof(r, "oof"), W["luckily"] + 0.6, -14, 0.3)
put("time whoosh", widen(G.whoosh(1.2, r, 0.6, 300, 2400, 0.9, 0.3, 0.5), r, 12, 1.0), W["ninety"] - 0.4, -10)
# explanation: hot hum swelling, cold ting, water hiss on the outside
put("hot hum swell", widen(G.whoosh(1.4, r, 0.7, 90, 500, 0.9, 0.4, 0.6), r, 12, 1.0), W["grows"] - 0.3, -9)
put("cold ting", G.clink(r, 1800, 0.5, 1.2), W["shrinks"] + 0.1, -12)
put("water on hot bell", G.splash_big(r)[: ns(0.8)], W["shrank"] - 0.1, -10)
put("outside hiss", sizzle(1.8, 0.8), W["shrank"], -8)
put("inner creak", G.creak(1.0, r, 60, 90, scale=1.4), W["inside"] + 0.4, -10)
# kitchen: pour, sizzle, glass snaps
put("jug pour", G.splash_big(r)[: ns(0.8)], W["ice"] - 0.02, -12)
put("dish sizzle", sizzle(1.4, 0.6), W["ice"] + 0.1, -10)
put("GLASS CRACK", glass_crack(), W["give"] - 0.04, -3)
put("dish halves clatter", G.rattle(0.35, r, 50), W["give"] + 0.25, -10)
# 1836: winches and ropes, the crowd cheers, the stand
put("winch ratchet", G.rattle(2.4, r, 9), W["lifted"] - 0.3, -10, 0.5)
put("rope creak", G.creak(2.0, r, 70, 110, scale=1.2), W["lifted"] - 0.2, -10, -0.3)
put("crowd cheer", G.applause(2.4, r, 30), W["stone"] - 0.1, -12)
for k in range(4):
    put("hurrah", G.hurrah(r, r.uniform(110, 240), r.uniform(1.0, 1.2)), W["stone"] + 0.1 + 0.3 * k, -16, r.uniform(-0.8, 0.8))
put("bell set down", big_thud() * 0.5, W["stone"] - 0.05, -10)
# flashback: the old bells fall
put("flash whoosh 2", widen(G.whoosh(0.75, r, 0.33, 500, 4200, 0.9, 0.09, 0.4), r, 12, 0.9), b["s18"] - 0.3, -10)
put("first bell CLANG", bell_clang(260), W["first"] + 1.4, -6, -0.4)
put("second bell CLANG", bell_clang(170), W["second"] + 0.75, -5, 0.4)
put("crowd whoa", G.whoa(r), W["second"] + 0.95, -12)
# the water got it: drips, a sheepish sting on the last word
for k in range(3):
    put("drip", drip_plink(1300 + 120 * k), b["s19"] + 0.4 + k * 0.72, -14, 0.4)
put("sheepish sting", G.clink(r, 330, 0.35, 0.5), W["got"] - 0.02, -10)

def load(path):
    x, sr = read_wav(path)
    if sr == 24000:
        from scipy.signal import resample_poly
        x = resample_poly(x, 2, 1, axis=-1)
    x = st(x)
    y = np.zeros((2, N)); y[:, : min(N, x.shape[1])] = x[:, :N]
    return y

v = load(os.path.join(HERE, "..", "voice", "voice.wav"))
v_ref = integrated(v)
m = load(os.path.join(HERE, "music_bed.wav"))
m *= dbg(v_ref - 16.0 - integrated(m))
ir = make_ir(0.9, 7, hf=0.7)
s_wet = convolve_st(S, ir)[:, :N]
sx = S + 0.18 * s_wet
sx *= dbg(v_ref - 4.0 - integrated(sx)) * dbg(-6.0)
mix0 = v + m + sx
G_ = -15.0 - integrated(mix0)
y = mix0 * dbg(G_)
ceil = dbg(-1.2)
from scipy.ndimage import minimum_filter1d, uniform_filter1d
for _ in range(3):
    pk = np.abs(y).max(0)
    gain = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    gain = uniform_filter1d(minimum_filter1d(gain, ns(0.004)), ns(0.004))
    y = y * gain[None, :]
    y *= dbg(-15.0 - integrated(y))
y = fades(y, 0.0, 0.05)
write_wav(os.path.join(HERE, "mix.wav"), y)
for nm, x in (("voice", v), ("music", m), ("sfx", sx)):
    write_wav(os.path.join(HERE, f"stem_{nm}.wav"), x * dbg(G_))
with open(os.path.join(HERE, "cues.md"), "w") as f:
    f.write(f"# Tsar Bell sound cues\nvoice {v_ref:.1f} LUFS, music {integrated(m):.1f}, sfx {integrated(sx):.1f}; master {integrated(y):.2f} LUFS, TP {true_peak(y):.2f} dBTP, {DUR:.3f} s\n\n")
    for t, nm, g in sorted(cues):
        f.write(f"- {t:7.2f} s  {nm}  ({g:+.0f} dB)\n")
print(f"master {integrated(y):.2f} LUFS TP {true_peak(y):.2f}; voice {v_ref:.1f} music {integrated(m):.1f} sfx {integrated(sx):.1f}; {len(cues)} cues, {DUR:.3f} s")
