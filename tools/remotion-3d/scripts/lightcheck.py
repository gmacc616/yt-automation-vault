"""Light check of a draft sheet: python3 scripts/lightcheck.py [out/draft/light.txt] [out/shots.json]
Rules (measured on the reference look): golden shots read warm (R-B of the top half > +8), night shots read blue (R-B < -5),
day shots are not dark (luma > 0.22). Prints one line per failing shot; exit 1 if any."""
import json, sys
light = sys.argv[1] if len(sys.argv) > 1 else "out/draft/light.txt"
shots = json.load(open(sys.argv[2] if len(sys.argv) > 2 else "out/shots.json"))["shots"]
rows = []
for line in open(light):
    f, l, w = line.split("\t")
    rows.append((int(f), float(l.split()[1]), float(w.split()[1])))
bad = 0
for s in shots:
    fr = [(l, w) for f, l, w in rows if s["a"] <= f < s["b"]]
    if not fr:
        continue
    L = sum(x for x, _ in fr) / len(fr); Wm = sum(y for _, y in fr) / len(fr)
    rule = {"golden": (Wm > 8, f"golden but not warm (R-B {Wm:+.0f})"), "night": (Wm < -5, f"night but not blue (R-B {Wm:+.0f})"),
            "day": (L > 0.22, f"day but dark (luma {L:.2f})")}.get(s.get("light"), (True, ""))
    if not rule[0]:
        bad += 1; print(f"LIGHT shot {s['id']}: {rule[1]}")
print("light OK" if not bad else f"{bad} light problems")
sys.exit(1 if bad else 0)
