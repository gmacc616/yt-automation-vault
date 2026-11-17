"""Check a generated voiceover without listening: (1) the transcript matches the script (word accuracy, every missing or
extra word listed), (2) the delivery is not flat: per script line, pitch range in semitones (monotone < 2 st is flagged)
and speaking rate. Usage: python3 voice_check.py <SCRIPT.txt> <voice_dir>"""
import json, re, sys, difflib
import numpy as np, soundfile as sf
NUM = {"1628": "sixteen twentyeight", "64": "sixtyfour", "30": "thirty", "20": "twenty", "1300": "thirteen hundred", "29": "twentynine", "1961": "nineteen sixtyone", "10th": "tenth"}
UK = {"harbour": "harbor", "metres": "meters", "metre": "meter", "colour": "color", "gunports": "gun ports", "favourite": "favorite"}
norm = lambda t: [x for x in re.sub(r"[^a-z0-9 ]", " ", " ".join(UK.get(w.lower().strip(".,!?"), NUM.get(w.lower().strip(".,!?"), w)) for w in t.split()).lower().replace("-", "")).split() if x]
script, d = open(sys.argv[1]).read(), sys.argv[2]
W, C = json.load(open(f"{d}/words.json")), json.load(open(f"{d}/chunks.json"))
ref, hyp = norm(script), norm(" ".join(w["w"] for w in W))
sm = difflib.SequenceMatcher(a=ref, b=hyp, autojunk=False)
acc = sum(b.size for b in sm.get_matching_blocks()) / max(1, len(ref))
print(f"TRANSCRIPT word accuracy {acc * 100:.1f}% ({len(ref)} script words, {len(hyp)} heard)")
for op, i1, i2, j1, j2 in sm.get_opcodes():
    if op != "equal":
        print(f"  {op}: script '{' '.join(ref[i1:i2])}' -> heard '{' '.join(hyp[j1:j2])}'")
a, sr = sf.read(f"{d}/voice.wav"); a = a if a.ndim == 1 else a.mean(1)
def f0(seg):
    out, n = [], int(0.04 * sr)
    for i in range(0, len(seg) - n, n // 2):
        x = seg[i:i + n] - seg[i:i + n].mean()
        if np.sqrt((x ** 2).mean()) < 0.03: continue
        ac = np.correlate(x, x, "full")[n - 1:]; lo, hi = int(sr / 400), int(sr / 70)
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.3 * ac[0]: out.append(sr / k)
    return np.array(out)
flat = 0
for c in C:
    p = f0(a[int(c["start"] * sr):int(c["end"] * sr)])
    if len(p) < 10: continue
    st = 12 * np.log2(p / np.median(p)); rng = np.percentile(st, 90) - np.percentile(st, 10)
    words = len(norm(c["text"])); rate = words / max(0.1, c["end"] - c["start"])
    tag = "  <- FLAT" if rng < 2 else ""; flat += rng < 2
    print(f"  {c['start']:6.2f}s  pitch range {rng:4.1f} st  {rate:3.1f} w/s  {c['text'][:50]}{tag}")
print("VOICE OK" if acc > 0.95 and not flat else f"VOICE CHECK: accuracy {acc * 100:.0f}%, {flat} flat lines")
