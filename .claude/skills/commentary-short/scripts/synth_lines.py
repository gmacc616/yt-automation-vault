"""Batch narration with the default narrator (clone_3_voicebox-qwen3, see default-voice/SKILL.md):
load the model once, render every narration item to its own WAV.

Usage: py synth_lines.py <job>/edit/short.json [--force]
Reads "tempo" (default 1.0 = the natural clone_3 pace; old "voice"/"speed" Kokoro fields are ignored) and every item
that has "text". "|" marks sentence breaks for the script; the whole item is voiced in one call so the sentences flow
casually (long items are split at sentence ends past ~260 characters, joined with a 0.25 s pause).
Writes <job>/vo/<id>.wav (24 kHz mono) and <job>/vo/durations.json. Skips lines already rendered unless --force.
"""
import json, os, subprocess, sys
from pathlib import Path
import numpy as np, soundfile as sf

def engine_dir():
    here = Path(__file__).resolve()
    cands = [Path(os.environ["DEFAULT_VOICE_DIR"])] if os.environ.get("DEFAULT_VOICE_DIR") else []
    cands += [p / "default-voice" for p in here.parents] + [Path.home() / ".claude/skills/default-voice"]
    for c in cands:
        if (c / "qwen_voice.py").exists():
            return c
    sys.exit("default-voice skill not found: set DEFAULT_VOICE_DIR to the folder holding qwen_voice.py")

sys.path.insert(0, str(engine_dir()))
from qwen_voice import Voice, chunks_of, tempo

cfg_path = Path(sys.argv[1]).resolve()
force = "--force" in sys.argv
cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
job = cfg_path.parents[1]
outdir = job / "vo"; outdir.mkdir(exist_ok=True)
tempo_f = float(cfg.get("tempo", 1.0))
durs_path = outdir / "durations.json"
durs = json.loads(durs_path.read_text()) if durs_path.exists() else {}
v = None

for item in cfg["items"]:
    if not item.get("text"):
        continue
    out = outdir / f"{item['id']}.wav"
    if out.exists() and item["id"] in durs and not force:
        continue
    v = v or Voice()
    text = " ".join(p.strip() for p in item["text"].replace("\n", " ").split("|") if p.strip())
    gap = np.zeros(int(0.25 * 24000), np.float32)
    parts = []
    for c in chunks_of(text):
        parts += [v.say(c), gap]
    sf.write(out, np.concatenate(parts[:-1]), v.sr); tempo(out, tempo_f)
    durs[item["id"]] = round(sf.info(out).duration, 3)
    durs_path.write_text(json.dumps(durs, indent=1))
    print(item["id"], durs[item["id"]], flush=True)
