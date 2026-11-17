"""Fix faster-whisper word times at chunk starts (it smears them: on the Vasa voice "Stockholm" got the time of "1628").
For every chunk in chunks.json: find the real speech onset in voice.wav (RMS > 0.04 in 10 ms frames after the chunk
start) and stretch the chunk's first three words so the first starts there (the third word keeps its end).
Usage: python3 fix_words.py <voice_dir>   (rewrites words.json, keeps words.raw.json)"""
import json, os, shutil, sys
import numpy as np, soundfile as sf
d = sys.argv[1]
W, C = json.load(open(f"{d}/words.json")), json.load(open(f"{d}/chunks.json"))
a, sr = sf.read(f"{d}/voice.wav")
a = a if a.ndim == 1 else a.mean(1)
if not os.path.exists(f"{d}/words.raw.json"):
    shutil.copy(f"{d}/words.json", f"{d}/words.raw.json")
hop = int(0.01 * sr)
rms = np.sqrt(np.convolve(a ** 2, np.ones(hop) / hop, "same"))[::hop]
fixed = 0
for c in C:
    i0 = int(c["start"] * 100)
    on = next((i / 100 for i in range(i0, min(len(rms), i0 + 200)) if rms[i] > 0.04), None)
    idx = [k for k, w in enumerate(W) if w["e"] > c["start"] + 0.05][:3]  # words straddling the chunk start count too
    if on is None or not idx or abs(W[idx[0]]["s"] - on) < 0.12:  # too late or too early
        continue
    s0, e2 = W[idx[0]]["s"], W[idx[-1]]["e"]
    k = (e2 - on) / max(1e-3, e2 - s0)
    for j in idx:
        W[j]["s"] = round(on + (W[j]["s"] - s0) * k, 3); W[j]["e"] = round(on + (W[j]["e"] - s0) * k, 3)
    fixed += 1
    print(f"chunk at {c['start']:.2f}: first word '{W[idx[0]]['w']}' {s0:.2f} -> {on:.2f}")
json.dump(W, open(f"{d}/words.json", "w"), indent=1)
print(f"{fixed} chunk starts fixed")
