"""Default-voice output -> the timings.json that templates/plan/plan_src.py reads.
qwen_voice.py writes words.json ([{w, s, e}]) and chunks.json ([{text, start, end}], one per script line); each chunk
becomes one turn (numbered from 1), so plan anchors read (line number, "word", nth).
Usage: python3 vo_to_timings.py <voice_dir> [out.json]   (default out: <voice_dir>/timings.json)"""
import json, sys
from pathlib import Path

def convert(words, chunks):
    turns = [{"turn": i + 1, "words": []} for i in range(len(chunks))]
    for w in words:
        mid = (w["s"] + w["e"]) / 2  # the chunk whose span holds the word's middle; gaps go to the nearest chunk
        i = min(range(len(chunks)), key=lambda k: 0 if chunks[k]["start"] <= mid <= chunks[k]["end"]
                else min(abs(mid - chunks[k]["start"]), abs(mid - chunks[k]["end"])))
        turns[i]["words"].append({"w": w["w"], "t": round(w["s"], 3), "end": round(w["e"], 3)})
    return {"turns": turns}

assert convert([{"w": "a", "s": 0.1, "e": 0.3}, {"w": "b", "s": 1.2, "e": 1.4}],
               [{"text": "a", "start": 0, "end": 0.5}, {"text": "b", "start": 1.0, "end": 1.6}]) == \
    {"turns": [{"turn": 1, "words": [{"w": "a", "t": 0.1, "end": 0.3}]},
               {"turn": 2, "words": [{"w": "b", "t": 1.2, "end": 1.4}]}]}

if __name__ == "__main__":
    d = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else d / "timings.json"
    res = convert(json.loads((d / "words.json").read_text("utf8")), json.loads((d / "chunks.json").read_text("utf8")))
    out.write_text(json.dumps(res, indent=1), encoding="utf8")
    print(f"{out}: {len(res['turns'])} turns, {sum(len(t['words']) for t in res['turns'])} words")
    for w in res["turns"][0]["words"][:10]:
        print(f"  {w['t']:7.3f}-{w['end']:7.3f}  {w['w']}")
