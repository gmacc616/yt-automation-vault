"""Plan for "The 10 days that never happened" (from plan_src.py): shots, accents and tags anchored to WORDS of the voice-over, not to seconds.
Re-run after every VO change; the times move with the words. Run it from the project folder; it writes
src/plan.gen.ts and plan.json there (or to the path you pass) and prints a short report.

    python plan/plan_src.py vo/timings.json [src/plan.gen.ts]

timings.json: {"turns": [{"turn": 1, "words": [{"w": "Hello", "t": 0.12, "end": 0.48}, ...]}, ...]}
FIRST edit SHOTS, ACCENT and TAGS below: every anchor must be a word of YOUR voice-over, with the turn number as it
appears in your timings.json (some aligners count turns from 0).

The generated module plugs into the starter's captions:
    import { WORDS, ACCENT_WORDS, DURATION, FPS } from "./plan.gen";
    const chunks = makeChunks(WORDS as unknown as Word[], DURATION / FPS);
    <Captions chunks={chunks} t={t} accent={new Set(ACCENT_WORDS)} />
"""
import json
import re
import sys
from pathlib import Path

FPS = 30
LEAD = 2  # captions appear 2 frames before the word (applied by makeChunks in core/captions.tsx)

# ---- the story, by words ---------------------------------------------------------------------------------------
# A shot is a setup (a set, a mood, a lens). Inside it the beat rig moves the camera about once a second (SKILL.md
# section 1); change setups only where the picture must change (a new subject, a reaction, the payoff).
SHOTS = [
    # id, anchor (turn, word, nth), mood, set, note
    ("S01", (1, "On", 1), "night", "town", "convent street at night, the wall calendar on 4"),
    ("S02", (1, "next", 1), "golden", "town", "the next morning: pages fly, 15; a townsman is shocked"),
    ("S03", (2, "Pope", 1), "lamp", "study", "the Pope at his desk with shears"),
    ("S04", (3, "Julius", 1), "lamp", "study", "Caesar bust, 365.25"),
    ("S05", (3, "real", 1), "lamp", "study", "orrery: the year 11 minutes too long"),
    ("S06", (4, "11", 1), "lamp", "study", "the Pope shrugs"),
    ("S07", (4, "every", 1), "lamp", "study", "extra-day blocks stack up"),
    ("S08", (4, "spring", 1), "lamp", "study", "March wall: the flower slides 21 to 11"),
    ("S09", (5, "So", 1), "lamp", "study", "the Pope snips out ten days"),
    ("S10", (5, "skipped", 1), "lamp", "study", "year plaques: 1900 NO, 2000 YES"),
    ("S11", (6, "Spain", 1), "day", "town", "the square on the 15th, people cheer"),
    ("S12", (6, "Everyone", 1), "day", "town", "the elder dozes"),
    ("S13", (6, "Britain", 1), "cold", "town", "London 1752: eleven pages fly"),
    ("S14", (7, "Sweden", 1), "cold", "snow", "Sweden: February 30, confusion"),
    ("S15", (8, "Russia", 1), "night", "town", "Russia: October flips to November"),
]
ACCENT = set()
TAGS = []
# word-anchored event times the composition uses (turn, word, nth) -> name
EVENTS = {
    "flipA": (1, "morning", 1), "flipB": (1, "15th", 1), "deleted": (2, "deleted", 1),
    "cut": (5, "Cut", 1), "skip": (5, "skipped", 1), "wasnt": (5, "wasn't", 1), "was": (5, "was", 1),
    "ukA": (6, "delete", 1), "ukB": (6, "days", 1), "feb": (7, "February", 1), "nov": (8, "November", 1),
    "shrug": (4, "nothing", 1), "spring": (4, "spring", 1), "easter": (4, "Easter", 1), "cheer": (6, "overnight", 1),
}
MOVES = ["PUSH", "ORBIT_L", "PUSH", "DOLLY_R", "PULL", "ORBIT_R", "PUSH", "CRANE_UP", "PUSH", "DOLLY_L", "PULL", "TILT_UP"]


def beats_for(words, shots):
    """camera beats on words: one at most every ~0.85 s, sentence starts first, never a gap over ~1.3 s"""
    out = []
    for si, s in enumerate(shots):
        last = s["t"]
        k = si * 5
        ws = [w for w in words if s["t"] + 0.5 <= w["t"] < s["end"] - 0.35]
        prev_end = None
        for i, w in enumerate(ws):
            start = i == 0 or re.search(r"[.?!,]$", ws[i - 1]["w"]) is not None
            gap = w["t"] - last
            if (start and gap >= 0.7) or gap >= 0.85:
                mv = MOVES[k % len(MOVES)]
                k += 1
                out.append({"shot": s["id"], "t": round(max(s["t"] + 0.4, w["t"] - 0.2), 3), "move": mv, "word": w["w"]})
                last = w["t"]
        # fill any hold over 1.25 s (pauses, long words) with evenly spaced small moves
        ts = [s["t"]] + [b["t"] for b in out if b["shot"] == s["id"]] + [s["end"] - 0.3]
        for a, b in zip(ts, ts[1:]):
            m = int((b - a) / 0.85)
            if b - a > 1.1:
                for j in range(1, m):
                    mv = MOVES[k % len(MOVES)]
                    k += 1
                    out.append({"shot": s["id"], "t": round(a + j * (b - a) / m, 3), "move": mv, "word": ""})
    out.sort(key=lambda b: b["t"])
    return out


def norm(w):
    """the same normalization as core/captions.tsx: lowercase, keep letters, digits, ' and -"""
    return re.sub(r"[^a-z0-9'-]", "", w.lower())


def load(p):
    words = []
    for tr in json.loads(Path(p).read_text(encoding="utf8"))["turns"]:
        for w in tr["words"]:
            words.append({"turn": tr["turn"], "w": w["w"], "t": w["t"], "end": w["end"]})
    if not words:
        raise SystemExit(f"no words in {p}")
    return words


def find(words, turn, word, nth=1):
    k = 0
    for w in words:
        if w["turn"] == turn and norm(w["w"]) == norm(word):
            k += 1
            if k == nth:
                return w
    turns = sorted({w["turn"] for w in words})
    raise SystemExit(f"anchor not found: turn {turn} word {word!r} #{nth} (turns in this file: {turns}); "
                     "edit SHOTS / ACCENT / TAGS to words of your voice-over")


def chunk_count(words):
    """the same 1-2 word rule as makeChunks() in core/captions.tsx, for the report"""
    letters = lambda s: len(re.sub(r"[^a-z0-9]", "", s.lower()))
    i = n = 0
    while i < len(words):
        w = words[i]["w"]
        nx = words[i + 1]["w"] if i + 1 < len(words) else None
        two = nx is not None and not re.search(r"[.?!,]$", w) and letters(w) <= 4 and letters(nx) <= 5 \
            and letters(w) + letters(nx) <= 9
        i += 2 if two else 1
        n += 1
    return n


def main(p, out):
    out = Path(out)
    if not out.parent.is_dir():
        raise SystemExit(f"{out.parent} does not exist: run this from the project folder or pass the output path")
    words = load(p)
    total = words[-1]["end"] + 0.6
    shots = []
    for i, (sid, (tn, wd, nth), mood, setn, note) in enumerate(SHOTS):
        t0 = 0.0 if i == 0 else find(words, tn, wd, nth)["t"]
        shots.append({"id": sid, "t": round(t0, 3), "mood": mood, "set": setn, "note": note})
    for a, b in zip(shots, shots[1:] + [{"t": total}]):
        a["end"] = round(b["t"], 3)
        if a["end"] - a["t"] < 1.5:
            print(f"WARN {a['id']} is only {a['end'] - a['t']:.2f} s")
    for tn, wd in ACCENT:
        find(words, tn, wd)  # every accent word must exist
    accent_words = sorted({norm(wd) for _, wd in ACCENT})
    events = {k: round(find(words, *a)["t"], 3) for k, a in EVENTS.items()}
    events["end"] = round(words[-1]["end"], 3)
    beats = beats_for(words, shots)
    mins = total / 60
    print(f"beats {len(beats) + len(shots) - 1} ({(len(beats) + len(shots) - 1) / mins:.1f}/min incl. setup changes), hard cuts 0")
    gaps = sorted(((b["t"] - a["t"], a["t"]) for a, b in zip(beats, beats[1:])), reverse=True)[:3]
    print("longest holds:", [(round(g, 2), t) for g, t in gaps])
    tags = [{"text": tx, "t": round(find(words, tn, wd)["t"], 3), "note": nt} for tn, wd, tx, nt in TAGS]
    print(f"{len(shots)} shots, {chunk_count(words)} caption chunks, {len(accent_words)} accent words, "
          f"{len(tags)} tags, {total:.2f} s")
    if len(accent_words) > max(1, total / 4):
        print("WARN too many accents: about one per sentence")
    if len(tags) > max(1, total / 15 + 1):
        print("WARN too many tags: about one per 15 s, key facts only")
    rows = [[w["w"], round(w["t"], 3), round(w["end"], 3)] for w in words]
    out.write_text(
        "// generated by plan/plan_src.py; do not edit\n"
        f"export const FPS = {FPS};\nexport const DURATION = {round(total * FPS)};\n"
        f"export const SHOTS = {json.dumps(shots)} as const;\n"
        "/** [text, onset s, end s] for makeChunks() in core/captions.tsx */\n"
        f"export const WORDS = {json.dumps(rows)} as const;\n"
        f"export const ACCENT_WORDS = {json.dumps(accent_words)} as const;\n"
        f"export const TAGS = {json.dumps(tags)} as const;\n"
        f"export const EVENTS = {json.dumps(events)} as const;\n"
        f"export const BEATS = {json.dumps(beats)} as const;\n", encoding="utf8")
    plan = out.parent.parent / "plan.json" if out.parent.name == "src" else out.with_suffix(".json")
    plan.write_text(json.dumps({"fps": FPS, "duration_s": round(total, 3), "shots": shots,
                                "accent_words": accent_words, "tags": tags, "events": events, "beats": beats}, indent=1), encoding="utf8")
    print("wrote", out, "and", plan)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "vo/timings.json", sys.argv[2] if len(sys.argv) > 2 else "src/plan.gen.ts")
