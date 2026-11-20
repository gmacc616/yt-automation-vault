"""Sound for "The loneliest tree" (Tree of Ténéré): an original desert music bed (synthesized here, no samples), story SFX
on exact words from plan.gen.json, and the master mix with the same rules and helpers as calendar_mix.py (voice on
top, bed ~14 dB under the speech with a -3 dB duck, each SFX leveled against the voice, two-pass loudnorm to -14 LUFS).
The bed thins out under the 1973 night (a low drone only) and returns, softer, for the ending.
Usage: python3 audio/tenere_mix.py vo/tenere src/videos/tenere/plan.gen.json out/tenere/audio
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
import calendar_mix as cm  # noqa: E402  (env, tone, noise, lp, sfx, rms)

SR = cm.SR
rng = np.random.default_rng(11)


def bed(dur, quiet_from, quiet_to, bpm=84):
    """a calm desert groove in D (Phrygian colour): plucked oud-like bass and figures, a frame drum, a drone pad"""
    out = np.zeros(int((dur + 2) * SR))
    beat = 60 / bpm
    D = 146.83
    semis = lambda n: D * 2 ** (n / 12)
    figs = [[0, 1, 4, 5], [7, 5, 4, 1], [0, 4, 7, 8], [7, 5, 4, 0]]
    t = 0.0
    bar = 0

    def put(y, at):
        i = int(at * SR)
        if i < len(out):
            out[i:i + len(y)] += y[: max(0, len(out) - i)]

    while t < dur:
        quiet = quiet_from <= t < quiet_to
        if bar % 2 == 0:
            put(cm.tone(semis(-12), 4 * beat * 2, "pad", 0.09 if not quiet else 0.12), t)
            put(cm.tone(semis(-5), 4 * beat * 2, "pad", 0.05 if not quiet else 0.0), t)
        if not quiet:
            put(cm.tone(semis(-12), 0.5, "pluck", 0.5), t)
            put(cm.tone(semis(-12), 0.5, "pluck", 0.35), t + 2.5 * beat)
            for k, n in enumerate(figs[bar % 4]):
                put(cm.tone(semis(n), 0.45, "pluck", 0.2), t + (k + 0.5) * beat)
            # frame drum: a low dum on 1, two light taks
            for at, f, a in ((0, 70, 0.5), (1.5 * beat, 300, 0.15), (3 * beat, 300, 0.12)):
                n = int(0.2 * SR)
                tt = np.arange(n) / SR
                put(np.sin(2 * np.pi * f * tt) * cm.env(n, 0.002, 0.06 if f > 100 else 0.12) * a, t + at)
        t += 4 * beat
        bar += 1
    return out[: int(dur * SR)]


def sfx(kind):
    n = lambda s: int(s * SR)
    if kind == "crash":  # a truck into a trunk: boom + crunch + rattle of debris
        N = n(1.6)
        t = np.arange(N) / SR
        boom = np.sin(2 * np.pi * 55 * t) * cm.env(N, 0.002, 0.25)
        crunch = cm.lp(rng.standard_normal(N), 0.5) * cm.env(N, 0.001, 0.12) * 0.9
        rattle = np.zeros(N)
        for k in range(14):
            i = n(0.15 + rng.random() * 1.1)
            b = cm.sfx("block") * (0.2 + 0.3 * rng.random())
            rattle[i:i + len(b)] += b[: N - i]
        return boom + crunch + rattle
    if kind == "crack":  # wood splitting
        N = n(0.7)
        y = np.zeros(N)
        for k in range(9):
            i = n(k * 0.06 + rng.random() * 0.02)
            c = cm.lp(rng.standard_normal(n(0.05)), 0.7) * cm.env(n(0.05), 0.001, 0.01)
            y[i:i + len(c)] += c[: N - i] * (1 - k / 12)
        return y
    if kind == "fall":  # the tree hits the ground: a long thump and a leaf swish
        N = n(1.4)
        t = np.arange(N) / SR
        return np.sin(2 * np.pi * 45 * t) * cm.env(N, 0.004, 0.3) * 1.2 + cm.lp(rng.standard_normal(N), 0.15) * np.sin(np.pi * t / 1.4) * 0.6
    if kind == "engine":  # a lorry approaching at night: low rumble that grows
        N = n(3.2)
        t = np.arange(N) / SR
        f = 48 + 6 * t / 3.2
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 13 * t)) + cm.lp(rng.standard_normal(N), 0.04) * 1.5
        return y * np.minimum(1, t / 2.6) ** 2 * np.minimum(1, (3.2 - t) / 0.15)
    if kind == "putter":  # a 1930s car engine
        N = n(2.4)
        t = np.arange(N) / SR
        pulses = (np.sin(2 * np.pi * 14 * t) > 0.6).astype(float)
        return cm.lp(rng.standard_normal(N), 0.2) * pulses * np.sin(np.pi * t / 2.4) * 1.4
    if kind == "bells":  # camel bells, a few soft clinks
        N = n(1.8)
        y = np.zeros(N)
        for k in range(5):
            i = n(k * 0.33 + rng.random() * 0.08)
            b = cm.tone(1046.5 * (1 + 0.05 * k % 3), 0.8, "bell", 0.6)
            y[i:i + len(b)] += b[: N - i]
        return y
    if kind == "dig":  # shovel into sand, twice
        N = n(1.2)
        y = np.zeros(N)
        for i0 in (0.0, 0.6):
            c = cm.lp(rng.standard_normal(n(0.25)), 0.3) * cm.env(n(0.25), 0.01, 0.08)
            i = n(i0)
            y[i:i + len(c)] += c[: N - i]
        return y
    if kind == "drip":  # water far below: a drop with an echo
        y = cm.tone(1400, 0.4, "bell", 1.0) * 0.6
        out = np.zeros(n(1.2))
        for k, a in enumerate((1, 0.4, 0.15)):
            i = n(k * 0.28)
            out[i:i + len(y)] += y[: len(out) - i] * a
        return out
    if kind == "hit":  # a muffled knock (the tease)
        return cm.sfx("stamp")
    return cm.sfx(kind)


def main(vdir, planp, outd):
    out = Path(outd)
    out.mkdir(parents=True, exist_ok=True)
    v, vsr = sf.read(f"{vdir}/voice.wav")
    v = v if v.ndim == 1 else v.mean(1)
    if vsr != SR:
        idx = np.arange(int(len(v) * SR / vsr)) * (vsr / SR)
        v = np.interp(idx, np.arange(len(v)), v)
    plan = json.loads(Path(planp).read_text())
    dur = plan["duration_s"]
    N = int(dur * SR)
    voice = np.zeros(N)
    voice[: min(N, len(v))] = v[:N]
    ev = plan["events"]
    sh = {s["id"]: s for s in plan["shots"]}
    win = int(0.05 * SR)
    act = np.convolve(np.abs(voice), np.ones(win) / win, "same")
    speech = act > 0.02
    v_rms = cm.rms(voice[speech]) if speech.any() else 0.05
    v_peak = float(np.max(np.abs(voice)))
    # ---- bed: ~14 dB under the speech, a drone only through the night crash, -3 dB duck, faded at the end
    b = bed(dur, sh["S13"]["t"] - 0.2, sh["S15"]["t"])
    b *= (v_rms * 10 ** (-14 / 20)) / cm.rms(b)
    duck = np.where(cm.lp(speech.astype(float), 0.0005) > 0.3, 10 ** (-3 / 20), 1.0)
    b *= duck
    fade = int(1.4 * SR)
    b[-fade:] *= np.linspace(1, 0, fade)
    # ---- SFX on visible events (time, kind)
    cues = [
        (0.0, "wind"), (ev["thud1"], "hit"), (ev["twice"], "hit"),
        (sh["S03"]["t"] - 0.1, "whoosh"), (sh["S05"]["t"], "chime"),
        (sh["S06"]["t"] + 0.2, "bells"), (ev["lose"], "bells"),
        (sh["S08"]["t"] - 0.1, "whoosh"), (ev["dug"], "dig"), (ev["water"], "drip"),
        (sh["S10"]["t"], "putter"), (ev["y1934"] + 0.1, "chime"),
        (sh["S12"]["t"], "wind"), (ev["crashed59"], "stamp"),
        (sh["S13"]["t"], "engine"), (ev["knocked"] - 0.05, "crash"), (ev["knocked"] + 0.15, "crack"),
        (ev["knocked"] + 1.5, "fall"), (sh["S15"]["t"] + 0.2, "wind"),
        (sh["S16"]["t"] - 0.1, "whoosh"), (ev["metal"], "toll"),
    ]
    fx = np.zeros(N)
    for at, kind in cues:
        y = sfx(kind)
        pk = float(np.max(np.abs(y))) + 1e-9
        g = (v_peak * 10 ** (-8 / 20)) / pk
        w = int(0.1 * SR)
        loud = max(cm.rms(y[i:i + w] * g) for i in range(0, max(1, len(y) - w), w // 2))
        # the crash may sit a little hotter than the rule (the story's one big hit), never over the voice
        lim = -3 if kind in ("crash", "fall") else -6
        if loud > v_rms * 10 ** (lim / 20):
            g *= (v_rms * 10 ** (lim / 20)) / loud
        i = max(0, int(at * SR))
        fx[i:i + len(y)] += (y * g)[: max(0, N - i)]
    mix = voice + b + fx
    sf.write(out / "voice.wav", voice, SR)
    sf.write(out / "bed.wav", b, SR)
    sf.write(out / "sfx.wav", fx, SR)
    sf.write(out / "premix.wav", mix / max(1.0, float(np.max(np.abs(mix)))), SR)
    m = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(out / "premix.wav"), "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex("{"): m.rindex("}") + 1])
    af = (f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
          f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out / "premix.wav"), "-af", af, "-ar", str(SR), str(out / "mix.wav")], check=True)
    print(f"mix.wav {dur:.2f} s, {len(cues)} SFX cues ({len(cues) / dur * 20:.1f} per 20 s)")


if __name__ == "__main__":
    main(*sys.argv[1:4])
