"""Sound for "The 10 days that never happened": an original light music bed (synthesized here, no samples), story SFX on
exact words from plan.gen.json, and the master mix (voice on top, bed ~14 dB under the speech with a -3 dB duck, each
SFX leveled against the voice, two-pass loudnorm to -14 LUFS / -1 dBTP).
Usage: python3 audio/calendar_mix.py vo/calendar src/videos/calendar/plan.gen.json out/calendar/audio
"""
import json, subprocess, sys
from pathlib import Path
import numpy as np
import soundfile as sf

SR = 48000
rng = np.random.default_rng(7)  # fixed seed: the same mix every run


def env(n, a=0.005, r=0.2):
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4))
    return e


def tone(f, dur, kind="pluck", amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    if kind == "pluck":  # soft pizzicato-like: a few harmonics, fast decay
        y = sum(np.sin(2 * np.pi * f * k * t) / k ** 1.6 for k in range(1, 6)) * env(n, 0.003, 0.16)
    elif kind == "bell":  # celesta-ish: inharmonic partials
        y = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) + 0.2 * np.sin(2 * np.pi * f * 5.4 * t)) * env(n, 0.002, 0.45)
    else:  # pad: detuned, slow attack
        y = sum(np.sin(2 * np.pi * f * d * t) for d in (0.997, 1.0, 1.004)) / 3 * np.minimum(1, t / 0.4) * np.minimum(1, (dur - t) / 0.4)
    return y * amp


def bed(dur, bpm=104):
    """a light, curious waltz in G major: pizzicato bass on 1, chord plucks on 2-3, a bell melody, a soft pad"""
    out = np.zeros(int((dur + 2) * SR))
    beat = 60 / bpm
    G = 196.0
    semis = lambda n: G * 2 ** (n / 12)
    prog = [(0, [4, 7]), (-5, [4 - 5, 7 - 5]), (2, [5, 9]), (-3, [4 - 3, 7 - 3])]  # G, D/F#, Am, Em-ish (as offsets)
    mel = [12, 14, 16, 14, 12, 11, 9, 11, 12, 16, 19, 16, 14, 12, 11, 7]
    t = 0.0
    bar = 0
    while t < dur:
        root, ch = prog[bar % 4]
        def put(y, at):
            i = int(at * SR)
            out[i:i + len(y)] += y[: max(0, len(out) - i)]
        put(tone(semis(root - 12), 0.5, "pluck", 0.55), t)
        for k in (1, 2):
            for c in ch:
                put(tone(semis(c), 0.35, "pluck", 0.22), t + k * beat)
        if bar % 2 == 0:
            put(tone(semis(root), 3 * beat * 2, "pad", 0.06), t)
            put(tone(semis(root + 7), 3 * beat * 2, "pad", 0.05), t)
        m = mel[(bar * 2) % len(mel)]
        put(tone(semis(m), 0.9, "bell", 0.16), t)
        put(tone(semis(mel[(bar * 2 + 1) % len(mel)]), 0.9, "bell", 0.12), t + 2 * beat)
        t += 3 * beat
        bar += 1
    return out[: int(dur * SR)]


def noise(n):
    return rng.standard_normal(n)


def lp(x, k):  # one-pole low-pass, k in (0,1]
    y = np.empty_like(x)
    a = 0.0
    for i, v in enumerate(x):
        a += k * (v - a)
        y[i] = a
    return y


def sfx(kind):
    if kind == "flip":  # a paper page
        n = int(0.16 * SR)
        return lp(noise(n), 0.35) * env(n, 0.01, 0.05) * 1.2
    if kind == "flurry":  # many pages
        n = int(1.0 * SR)
        y = np.zeros(n)
        for k in range(10):
            i = int((k / 10) * 0.85 * SR)
            f = sfx("flip")
            y[i:i + len(f)] += f * (0.6 + 0.4 * rng.random())
        return y
    if kind == "snip":  # metal shears
        n = int(0.12 * SR)
        t = np.arange(n) / SR
        return (np.sin(2 * np.pi * 3400 * t) * 0.5 + noise(n) * 0.6) * env(n, 0.001, 0.025)
    if kind == "stamp":  # a thud
        n = int(0.3 * SR)
        t = np.arange(n) / SR
        return (np.sin(2 * np.pi * 90 * t) + lp(noise(n), 0.2) * 0.5) * env(n, 0.002, 0.07)
    if kind == "whoosh":
        n = int(0.5 * SR)
        t = np.arange(n) / SR
        return lp(noise(n), 0.08) * np.sin(np.pi * t / 0.5) ** 2 * 2.2
    if kind == "chime":
        return tone(1318.5, 1.2, "bell", 1.0) + tone(1975.5, 1.2, "bell", 0.5)
    if kind == "block":  # wooden block lands
        n = int(0.12 * SR)
        t = np.arange(n) / SR
        return np.sin(2 * np.pi * 620 * t) * env(n, 0.001, 0.03)
    if kind == "cheer":  # a small crowd swell
        n = int(1.4 * SR)
        t = np.arange(n) / SR
        y = lp(noise(n), 0.25) * np.sin(np.pi * t / 1.4) ** 1.5
        return y * (1 + 0.3 * np.sin(2 * np.pi * 7 * t))
    if kind == "wind":
        n = int(3.0 * SR)
        t = np.arange(n) / SR
        return lp(noise(n), 0.02) * 3 * np.sin(np.pi * t / 3.0)
    if kind == "boing":  # comic reveal
        n = int(0.6 * SR)
        t = np.arange(n) / SR
        f = 220 + 160 * np.exp(-t * 6) * np.sin(2 * np.pi * 9 * t)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.005, 0.25)
    raise ValueError(kind)


def rms(x):
    return float(np.sqrt(np.mean(x ** 2)) + 1e-12)


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
    shots = {s["id"]: s for s in plan["shots"]}
    # speech activity (for the duck) and the speech RMS (for leveling)
    win = int(0.05 * SR)
    act = np.convolve(np.abs(voice), np.ones(win) / win, "same")
    speech = act > 0.02
    v_rms = rms(voice[speech]) if speech.any() else 0.05
    v_peak = float(np.max(np.abs(voice)))
    # ---- music bed: ~14 dB under the speech, -3 dB duck under the voice, faded at the end
    b = bed(dur)
    b *= (v_rms * 10 ** (-14 / 20)) / rms(b)
    duck = np.where(lp(speech.astype(float), 0.0005) > 0.3, 10 ** (-3 / 20), 1.0)
    b *= duck
    fade = int(1.2 * SR)
    b[-fade:] *= np.linspace(1, 0, fade)
    # ---- SFX on words (time, kind)
    cues = [
        (ev["flipA"], "flurry"), (ev["flipB"], "flip"), (ev["deleted"], "snip"),
        (shots["S02"]["t"] - 0.1, "whoosh"), (shots["S03"]["t"] - 0.1, "whoosh"),
        (ev["spring"], "chime"), (ev["cut"], "snip"), (ev["skip"] + 0.35, "stamp"), (ev["skip"] + 0.75, "stamp"),
        (ev["wasnt"], "stamp"), (ev["was"], "chime"), (ev["cheer"] - 0.2, "cheer"),
        (shots["S11"]["t"] - 0.1, "whoosh"), (shots["S13"]["t"] - 0.1, "whoosh"), (ev["ukA"] - 0.1, "flurry"),
        (shots["S14"]["t"] - 0.1, "wind"), (ev["feb"], "flip"), (ev["feb"] + 0.3, "boing"),
        (shots["S15"]["t"] - 0.1, "whoosh"), (ev["nov"] - 0.15, "flip"), (ev["nov"] + 0.2, "boing"),
    ]
    s07 = shots["S07"]
    for k in range(10):  # the stacking day blocks
        cues.append((s07["t"] + (k + 1) / 10 * max(0.5, s07["end"] - s07["t"] - 0.4) - 0.05, "block"))
    fx = np.zeros(N)
    gain = None
    for at, kind in cues:
        y = sfx(kind)
        # level against the voice: peak ~8 dB under the voice peak, loudest 100 ms >= 6 dB under the speech RMS
        pk = float(np.max(np.abs(y))) + 1e-9
        g = (v_peak * 10 ** (-8 / 20)) / pk
        w = int(0.1 * SR)
        loud = max(rms(y[i:i + w] * g) for i in range(0, max(1, len(y) - w), w // 2))
        if loud > v_rms * 10 ** (-6 / 20):
            g *= (v_rms * 10 ** (-6 / 20)) / loud
        i = max(0, int(at * SR))
        fx[i:i + len(y)] += (y * g)[: max(0, N - i)]
    mix = voice + b + fx
    sf.write(out / "voice.wav", voice, SR)
    sf.write(out / "bed.wav", b, SR)
    sf.write(out / "sfx.wav", fx, SR)
    sf.write(out / "premix.wav", mix / max(1.0, float(np.max(np.abs(mix)))), SR)
    # two-pass loudnorm to -14 LUFS, -1 dBTP
    m = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(out / "premix.wav"), "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex("{"): m.rindex("}") + 1])
    af = (f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
          f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out / "premix.wav"), "-af", af, "-ar", str(SR), str(out / "mix.wav")], check=True)
    print(f"mix.wav {dur:.2f} s, {len(cues)} SFX cues ({len(cues) / dur * 20:.1f} per 20 s)")


if __name__ == "__main__":
    main(*sys.argv[1:4])
