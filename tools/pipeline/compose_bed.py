# Original ambient bed: soft pad chords + gentle plucked arpeggio + light sub. Deterministic, no samples.
import numpy as np, wave, sys
SR = 48000; BPM = 84; BEAT = 60 / BPM; BAR = 4 * BEAT
out, seconds = sys.argv[1], float(sys.argv[2])
n = int(SR * seconds); t = np.arange(n) / SR
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
# I - vi - IV - V flavour in D: Dmaj9, Bm9, Gmaj7, Asus2 (MIDI notes)
chords = [[50, 57, 61, 64, 66], [47, 54, 57, 61, 62], [43, 50, 54, 57, 62], [45, 52, 57, 59, 64]]
L = np.zeros(n); R = np.zeros(n)
bars = int(np.ceil(seconds / BAR)) + 1
for b in range(bars):
    notes = chords[b % 4]; s0 = int(b * BAR * SR); s1 = min(n, int((b + 1.15) * BAR * SR))
    if s0 >= n: break
    seg = np.arange(s1 - s0) / SR
    env = np.minimum(1, seg / 1.2) * np.minimum(1, np.maximum(0, (BAR * 1.15 - seg) / 1.0))
    for i, m in enumerate(notes):
        f = hz(m + 12 if i else m)
        tone = (np.sin(2 * np.pi * f * seg) + 0.3 * np.sin(4 * np.pi * f * seg) + 0.12 * np.sin(6 * np.pi * f * seg))
        det = np.sin(2 * np.pi * f * 1.004 * seg + 1.3)
        L[s0:s1] += 0.05 * env * (tone + 0.5 * det); R[s0:s1] += 0.05 * env * (tone * 0.9 + 0.6 * det)
    sub = 0.07 * env * np.sin(2 * np.pi * hz(notes[0] - 12) * seg)
    L[s0:s1] += sub; R[s0:s1] += sub
    # plucked eighth-note arpeggio, very soft
    arp = [notes[1] + 12, notes[2] + 12, notes[3] + 12, notes[4] + 12, notes[3] + 12, notes[2] + 12, notes[4] + 12, notes[3] + 24]
    for k, m in enumerate(arp):
        p0 = s0 + int(k * BEAT / 2 * SR); p1 = min(n, p0 + int(1.2 * SR))
        if p0 >= n: break
        ps = np.arange(p1 - p0) / SR
        pl = 0.035 * np.exp(-ps * 4.5) * np.sin(2 * np.pi * hz(m) * ps) * (1 - np.exp(-ps * 400))
        pan = 0.35 + 0.3 * (k % 2)
        L[p0:p1] += pl * (1 - pan); R[p0:p1] += pl * pan
trem = 1 + 0.06 * np.sin(2 * np.pi * 0.11 * t)
mix = np.stack([L * trem, R * trem], axis=1)
mix /= np.max(np.abs(mix)) / 0.7
pcm = (mix * 32767).astype(np.int16)
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", out, seconds, "s")
