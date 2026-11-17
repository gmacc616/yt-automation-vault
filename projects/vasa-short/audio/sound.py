"""Sound for the Vasa short: synthesized SFX (template sfx_gen.py) on the picture's events + mystery_bed.py music bed,
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
r = np.random.default_rng(1628)
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
b = {"s2": W["stockholm"] - 0.1, "s7": W["problem"] - 0.1, "s12": W["august"] - 0.12, "s16": W["lucky"] - 0.12,
     "s18": W["yousee"] - 0.12, "s19": W["vasa2"] - 0.12, "s20": W["inquiry"] - 0.12, "s21": W["but"] - 0.12, "s22": W["million"] - 0.12}

# ---------- ambience beds
harb = G.water_bed(DUR, r, 0.7, 0.6)
bed("harbour water (hook)", harb, 0, b["s2"], -10)
bed("harbour water + gulls", harb + st(G.bird_chirps(DUR, r, 0.25, "sparrow") * 0.05), b["s2"], b["s12"], -13)
bed("breeze + crowd murmur", st(G.breeze(DUR, r, 0.8, 0.2, 800)) + st(G.babble(DUR, r, 150, 1.05, 4.2, 0.7) * 0.25), b["s12"], b["s16"], -12)
bed("harbour water (survivors)", harb, b["s16"], b["s18"], -12)
bed("bus engine hum", st(lp(colored(ns(DUR), r, 1.6), 220) * 0.6), b["s18"], b["s19"], -9)
bed("night water + crickets", st(G.water_bed(DUR, r, 0.4, 0.4)) * 0.6 + widen(G.crickets(DUR, r, 3) * 0.02, r, 9, 1.0), b["s19"], b["s21"], -12)
bed("day harbour + tourists", harb * 0.7 + st(G.babble(DUR, r, 170, 1.1, 4.5, 0.8) * 0.3), b["s21"], DUR, -13)

# ---------- events
def whoosh(t, g=-8):
    put("whoosh", widen(G.whoosh(0.7, r, 0.35, 400, 3200, 0.8, 0.2, 0.3), r, 12, 0.9), t - 0.35, g)

# hook: creaking hull, water rushing, a crowd gasp
put("hull creak", G.creak(2.6, r, 70, 120, scale=1.6), 0.0, -4, -0.2)
put("water rush (hook)", widen(G.bubbles(3.2, r, 40) * 0.8, r, 9, 1.0), 0.3, -6)
put("hook splash", G.splash_big(r), 0.6, -8)
put("crowd whoa", G.whoa(r), 1.2, -10, -0.4)
# flash after the hook
put("flash whoosh", widen(G.whoosh(0.75, r, 0.33, 500, 4200, 0.9, 0.09, 0.4), r, 12, 0.9), b["s2"] - 0.33, -6)
# fanfare-ish: the king (a short cheer), cannons reveal
put("nobles chuckle", G.babble(1.2, r, 120, 1.0, 5.0, 0.6) * 0.5, W["terrify"], -14)
whoosh(W["so"])
for k in range(4):
    put("gun port clunk", G.clink(r, 180 + 30 * k, 0.15, 0.6), W["sixty"] + 0.12 * k, -10, -0.3 + 0.2 * k)
put("sparkle (golden lions)", G.clink(r, 2400, 0.4, 1.4), W["golden"] + 0.05, -14)
# stability test: footsteps running, hull creak growing on every lean
for t0, n_, g in [(W["once"] - 0.35, 1.0, -9), (W["twice"] - 0.35, 1.0, -7), (W["three"] - 0.35, 1.0, -5)]:
    for k in range(int(n_ * 12)):
        put("running boots", G.boot(r, 0.6 + 0.4 * r.uniform()), t0 + k * 0.085 + r.uniform(0, 0.03), g - 6, r.uniform(-0.6, 0.6))
    put("hull lean creak", G.creak(1.2, r, 90, 140, scale=1.3), t0 + 0.4, g)
put("STOP burst", widen(G.whoosh(0.4, r, 0.1, 800, 4000, 0.7, 0.1, 0.2), r, 8, 0.8), W["stop"] - 0.05, -10)
put("big creak after stop", G.creak(1.6, r, 60, 100, scale=1.8), W["stop"] + 0.2, -6)
put("nope sting", G.clink(r, 300, 0.25, 0.5), W["nope"], -12)
# sailing day: cheer, sails, tip, gunports flood
put("crowd cheer", G.applause(2.6, r, 30), W["crowds"], -12)
for k in range(5):
    put("hurrah", G.hurrah(r, r.uniform(110, 260), r.uniform(1.0, 1.2)), W["crowds"] + 0.2 + 0.3 * k, -16, r.uniform(-0.8, 0.8))
put("sails fill (whump)", widen(G.whoosh(0.9, r, 0.4, 150, 1200, 0.9, 0.3, 0.5), r, 14, 1.0), W["breeze"] + 0.2, -4)
put("flag flutter", G.flag_flutter(2.0, r), W["breeze"] + 0.3, -14)
put("tip creak", G.creak(1.4, r, 50, 90, scale=2.0), W["tipped"] - 0.1, -3)
put("crowd gasp", G.whoa(r), W["tipped"] + 0.15, -10, -0.3)
put("right-up creak", G.creak(1.0, r, 80, 60, scale=1.6), W["cameback"], -6)
put("second gust", widen(G.whoosh(1.0, r, 0.45, 200, 1600, 0.9, 0.3, 0.5), r, 14, 1.0), W["second"] + 0.1, -5)
put("timber groan", G.timber_tear(r, 1.0), W["water"] - 0.1, -6)
put("water pours in", G.splash_big(r), W["water"], -4)
put("bubbles", widen(G.bubbles(2.4, r, 60), r, 9, 1.0), W["gunports"], -8)
put("sinking glug", widen(G.bubbles(2.0, r, 25, 150, 900), r, 9, 1.0), W["twenty"], -6)
put("masts crack", G.wood_crack(r), W["thirteen"] + 0.4, -8)
put("GONE splash", G.splash_big(r), W["gone"] - 0.05, -2)
# survivors / the city
for k in range(4):
    put("swim splash", G.splash_big(r)[: ns(0.6)] * 0.4, W["lucky"] + 0.3 + 0.55 * k, -14, -0.4)
put("oof", G.oof(r, "oof"), W["crew"], -12, -0.3)
put("crowd murmur", G.babble(2.4, r, 160, 1.1, 4.5, 0.8), W["unlucky"] + 0.2, -12)
put("crowd gasp", G.whoa(r), W["watched"] - 0.05, -9)
# bus
put("bus bump", G.boot(r, 1.6), W["bump"], -4)
put("bus rattle", G.rattle(0.5, r, 40), W["bump"] + 0.02, -12)
put("bus turn screech", widen(G.whoosh(0.8, r, 0.3, 900, 3500, 0.6, 0.2, 0.3), r, 10, 0.8), W["turn"] - 0.05, -10)
put("whoa (passenger)", G.whoa(r), W["turn"] + 0.15, -9)
put("shopping lands", G.oof(r, "ugh"), W["flying"] + 0.05, -10)
for k in range(3):
    put("apple bounce", G.boot(r, 0.5), W["flying"] + 0.15 + 0.13 * k, -14, 0.4)
put("night ship creak", G.creak(2.0, r, 60, 90, scale=1.5), W["vasa2"] + 0.2, -8)
# inquiry
put("shrug sting", G.clink(r, 260, 0.3, 0.4), W["nobody2"], -12)
# twist: she rises
put("rising water rush", widen(G.bubbles(2.2, r, 50, 200, 1500), r, 9, 1.0), W["pulled"] - 0.1, -6)
put("crowd applause", G.applause(3.0, r, 40), W["million"] + 0.2, -14)
whoosh(W["still"] - 0.3, -10)

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
    f.write(f"# Vasa sound cues\nvoice {v_ref:.1f} LUFS, music {integrated(m):.1f}, sfx {integrated(s):.1f}; master {integrated(y):.2f} LUFS, TP {true_peak(y):.2f} dBTP, {DUR:.3f} s\n\n")
    for t, nm, g in sorted(cues):
        f.write(f"- {t:7.2f} s  {nm}  ({g:+.0f} dB)\n")
print(f"master {integrated(y):.2f} LUFS TP {true_peak(y):.2f}; voice {v_ref:.1f} music {integrated(m):.1f} sfx {integrated(s):.1f}; {len(cues)} cues")
