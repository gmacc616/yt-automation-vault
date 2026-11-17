"""Sound for the Lake Peigneur short: synthesized SFX (template sfx_gen.py) on the picture's events + mystery_bed.py music bed,
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
r = np.random.default_rng(1980)
S = np.zeros((2, N))
cues = []

def put(name, x, t, gain_db=0.0, p=0.0):
    x = np.asarray(x, float)
    if x.ndim == 1:
        x = pan(x, p)
    place(S, x, t, dbg(gain_db))
    cues.append((t, name, gain_db))

def bed(name, x, t0, t1, gain_db, fin=0.4, fout=0.6):
    n = ns(t1 - t0)
    x = st(np.asarray(x, float))[:, :n]
    place(S, fades(x, fin, fout), t0, dbg(gain_db))
    cues.append((t0, name + f" ({t1 - t0:.1f} s)", gain_db))

# shot boundaries (seconds), mirrored from story.ts
b = {k: W[w] - 0.1 for k, w in [("s2", "november"), ("s4", "sitting"), ("s5", "out"), ("s6", "down1"), ("s7", "then1"), ("s12", "mine"), ("s14", "unlucky"),
     ("s15", "yousee"), ("s16", "tiny"), ("s17", "empty"), ("s18", "days"), ("s19", "nobody"), ("s20", "andlake")]}

def roar(dur, lo=60, hi=700, k=1.4):
    return st(lp(hp(colored(ns(dur), r, k), lo), hi))
def hum(dur, f0=55):
    t = tt(dur); x = 0.5 * np.sin(2 * np.pi * f0 * t) + 0.25 * np.sin(2 * np.pi * 2 * f0 * t) + 0.12 * np.sin(2 * np.pi * 3 * f0 * t)
    return x * (0.8 + 0.2 * np.sin(2 * np.pi * 7 * t)) + 0.15 * lp(colored(ns(dur), r, 1.0), 400)

# ---------- ambience beds
lake = G.water_bed(DUR, r, 0.5, 0.5)
bed("whirlpool roar (hook)", lake + roar(DUR) * 0.9, 0, b["s2"], -6)
bed("calm lake + birds", lake * 0.6 + st(G.bird_chirps(DUR, r, 0.35, "sparrow") * 0.06), b["s2"], b["s4"], -13)
bed("deep earth hum (cut-away)", st(lp(colored(ns(DUR), r, 1.8), 160)), b["s4"], b["s5"], -12)
bed("rig engines", st(hum(DUR, 48)) + lake * 0.4, b["s5"], b["s6"], -10)
bed("drill grind (cut-away)", st(hum(DUR, 38)) + st(lp(colored(ns(DUR), r, 1.2), 900)) * 0.3, b["s6"], b["s7"], -9)
bed("lake + rig strain", lake * 0.7 + st(hum(DUR, 44)) * 0.5, b["s7"], W["spin"] - 0.2, -10)
bed("whirlpool roar", lake + roar(DUR, 40, 900) * 1.2, W["spin"] - 0.2, b["s12"], -5, 0.6, 0.4)
bed("mine rumble + rushing water", roar(DUR, 50, 1400, 1.2) * 0.8 + st(G.bubbles(DUR, r, 30) * 0.3), b["s12"], b["s14"], -8)
bed("empty lake wind", st(G.breeze(DUR, r, 0.9, 0.25, 700)), b["s14"], b["s15"], -12)
bed("night kitchen crickets", widen(G.crickets(DUR, r, 3) * 0.02, r, 9, 1.0), b["s15"], b["s17"], -13)
bed("waterfall roar", roar(DUR, 80, 2400, 1.0) * 1.1 + lake * 0.5, b["s17"], b["s18"], -6, 0.3, 0.5)
bed("day lake + birds", lake * 0.6 + st(G.bird_chirps(DUR, r, 0.4, "sparrow") * 0.06), b["s18"], DUR, -13)

# ---------- events
def whoosh(t, g=-8):
    put("whoosh", widen(G.whoosh(0.7, r, 0.35, 400, 3200, 0.8, 0.2, 0.3), r, 12, 0.9), t - 0.35, g)

# hook: the drain gurgle, metal groans, barges grinding
put("drain gurgle", widen(G.bubbles(2.6, r, 45, 120, 900), r, 9, 1.0), 0.2, -5)
put("metal groan", G.creak(2.2, r, 40, 70, scale=2.2), 0.6, -6, -0.3)
put("barge scrape", G.chain_groan(1.6, r, 0.3, 1.0, 18, 30), 1.5, -9, 0.3)
put("flash whoosh", widen(G.whoosh(0.75, r, 0.33, 500, 4200, 0.9, 0.09, 0.4), r, 12, 0.9), b["s2"] - 0.33, -6)
put("fish plop", G.splash_big(r)[: ns(0.4)] * 0.4, W["quiet"] + 0.3, -16, 0.3)
put("reel click", G.rattle(0.5, r, 50), W["fishing"] if "fishing" in W else W["quiet"] + 0.6, -16, -0.2)
whoosh(b["s4"] + 0.1, -10)
put("salt sparkle", G.clink(r, 2600, 0.4, 1.3), W["salt"] + 0.05, -14)
whoosh(b["s6"] + 0.1, -10)
for t0, g in [(W["down1"], -10), (W["down2"], -8), (W["down3"], -6)]:
    put("drill bite", G.rattle(0.6, r, 60, heavy=True), t0 + 0.05, g)
    put("drill whoosh down", widen(G.whoosh(0.5, r, 0.2, 200, 1400, 0.7, 0.15, 0.2), r, 8, 0.8), t0, g - 2)
put("drill STUCK clunk", G.hammer_hit(r, 1.4), W["stuck"] - 0.03, -3)
put("stuck groan", G.creak(1.0, r, 50, 40, scale=2.0), W["stuck"] + 0.1, -8)
put("tilt groan", G.creak(1.4, r, 45, 80, scale=2.2), W["tilt"] - 0.1, -4)
put("crew oof", G.oof(r, "oof"), W["tilt"] + 0.2, -11, 0.3)
put("whoa (crew)", G.whoa(r), W["tilt"] + 0.4, -10, -0.3)
put("SANK splash", G.splash_big(r), W["sank"] - 0.03, -2)
put("sinking glug", widen(G.bubbles(1.6, r, 30, 150, 900), r, 9, 1.0), W["sank"] + 0.2, -6)
put("spin swirl", widen(G.whoosh(1.4, r, 0.6, 150, 1800, 0.9, 0.4, 0.6), r, 14, 1.0), W["spin"] - 0.4, -4)
put("barge crunch", G.timber_tear(r, 0.9), W["barges"], -7, 0.4)
put("tug horn (sinking)", st(hum(0.9, 180) * np.linspace(1, 0.2, ns(0.9))), W["tug"] + 0.1, -12, -0.4)
put("land rumble", roar(1.8, 30, 300, 1.8), W["acres"] + 0.1, -2)
put("trees crack", G.wood_crack(r), W["land"] - 0.1, -6, 0.3)
put("LAND splash", G.splash_big(r), W["land"] + 0.2, -4)
# mine
put("rushing water", widen(G.bubbles(2.0, r, 70), r, 9, 1.0), W["water"] - 0.05, -5)
put("miners whoa", G.whoa(r), W["water"] + 0.15, -9, -0.3)
for k in range(10):
    put("running boots", G.boot(r, 0.6 + 0.4 * r.uniform()), W["tunnels"] - 0.2 + k * 0.1, -14, r.uniform(-0.6, 0.6))
put("cage gate clank", G.hammer_hit(r, 0.8), W["every"] + 0.05, -8)
put("cage chain", G.chain_groan(1.8, r, 0.4, 1.0, 26, 40), W["every"] + 0.4, -10)
put("cheer (relief)", G.hurrah(r, 180, 1.1), W["elevator"] + 0.1, -12)
put("drained wind whoosh", widen(G.whoosh(1.0, r, 0.4, 200, 1500, 0.9, 0.3, 0.5), r, 12, 1.0), W["unlucky"] - 0.2, -9)
put("crowd gasp", G.whoa(r), W["didnt"] - 0.05, -9)
# kitchen: sugar into tea
put("cup clink", G.clink(r, 1900, 0.25, 1.1), W["sugar"] + 0.25, -8)
put("sugar plop", G.splash_big(r)[: ns(0.35)] * 0.35, W["sugar"] + 0.3, -10)
put("fizz", widen(G.bubbles(1.4, r, 90, 1200, 5000), r, 8, 0.8), W["tea"], -14)
put("melting fizz", widen(G.bubbles(2.0, r, 70, 600, 3000), r, 8, 0.8), W["melting"], -10)
put("FELL whoosh", widen(G.whoosh(1.0, r, 0.4, 120, 1500, 0.9, 0.3, 0.5), r, 14, 1.0), W["fell"] - 0.3, -4)
put("FELL rumble", roar(1.5, 30, 250, 1.8), W["fell"] + 0.05, -3)
# waterfall
put("canal swoosh", widen(G.whoosh(1.2, r, 0.5, 200, 2200, 0.9, 0.4, 0.6), r, 12, 1.0), W["backwards"] - 0.3, -8)
put("waterfall crash", G.splash_big(r), W["waterfall"] + 0.1, -5)
# barges pop
for k in range(5):
    put("barge pop splash", G.splash_big(r)[: ns(0.9)], W["popped"] - 0.3 + [0, 0.15, 0.3, 0.45, 0.6][k] + 0.25, -8 - k, -0.5 + 0.25 * k)
put("cork pop", G.clink(r, 700, 0.12, 0.6), W["corks"] + 0.05, -9)
# suits
put("shrug sting", G.clink(r, 260, 0.3, 0.4), W["drillers"] - 0.3, -12)
for k in range(6):
    put("cash ching", G.clink(r, 2200 + 300 * k, 0.15, 1.2), W["paid"] + 0.05 + 0.08 * k, -13 - k, -0.3 + 0.12 * k)
put("money flutter", G.flag_flutter(1.2, r), W["million"], -14)
# twist
whoosh(b["s20"] + 0.1, -10)
put("deepen rumble", roar(1.6, 30, 400, 1.6), W["now"] - 0.1, -6)
put("water fill rush", widen(G.bubbles(1.6, r, 50, 200, 1500), r, 9, 1.0), W["two00"] - 0.2, -8)
put("drill tink", G.clink(r, 1400, 0.3, 1.0), W["drill"] + 0.05, -9)

def load(path):
    x, sr = read_wav(path)
    assert sr == SR or sr == 24000, sr
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
# SFX stem: a light room on everything, then the standard -6 dB against the voice (set so the stem sits ~10 LU under the voice
# before the -6 dB trim; individual cue gains above shape the balance)
ir = make_ir(0.9, 7, hf=0.7)
s_wet = convolve_st(S, ir)[:, :N]
s = S + 0.18 * s_wet
s *= dbg(v_ref - 4.0 - integrated(s)) * dbg(-6.0)
mix0 = v + m + s
G_ = -15.0 - integrated(mix0)
y = mix0 * dbg(G_)
# simple look-ahead peak limiter to -1.2 dBTP
ceil = dbg(-1.2)
for _ in range(3):
    pk = np.abs(y).max(0)
    gain = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    gain = uniform_filter1d(minimum_filter1d(gain, ns(0.004)), ns(0.004))
    y = y * gain[None, :]
    y *= dbg(-15.0 - integrated(y))
y = fades(y, 0.0, 0.05)
write_wav(os.path.join(HERE, "mix.wav"), y)
for nm, x in (("voice", v), ("music", m), ("sfx", s)):
    write_wav(os.path.join(HERE, f"stem_{nm}.wav"), x * dbg(G_))
with open(os.path.join(HERE, "cues.md"), "w") as f:
    f.write(f"# Lake Peigneur sound cues\nvoice {v_ref:.1f} LUFS, music {integrated(m):.1f}, sfx {integrated(s):.1f}; master {integrated(y):.2f} LUFS, TP {true_peak(y):.2f} dBTP, {DUR:.3f} s\n\n")
    for t, nm, g in sorted(cues):
        f.write(f"- {t:7.2f} s  {nm}  ({g:+.0f} dB)\n")
print(f"master {integrated(y):.2f} LUFS TP {true_peak(y):.2f}; voice {v_ref:.1f} music {integrated(m):.1f} sfx {integrated(s):.1f}; {len(cues)} cues")
