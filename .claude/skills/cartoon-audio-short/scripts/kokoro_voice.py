"""Voiceover for a cartoon short with the default narrator (clone_3_voicebox-qwen3, see default-voice/SKILL.md).
File name kept from the Kokoro days so old notes and commands still work; Kokoro is no longer used.

Usage: py kokoro_voice.py script.txt out_dir [--tempo 1.0] [--gap 0.4]
Writes out_dir/voice.wav (24 kHz mono), out_dir/chunks.json and out_dir/sentences.json (same content:
[{text, start, end}] per chunk = per script paragraph; every chunk boundary is a pause).
Runs default-voice/qwen_voice.py (found next to this skill, or via DEFAULT_VOICE_DIR). Run it alone: the voice model
next to Whisper or x264 runs out of memory on a small PC.
"""
import os, shutil, subprocess, sys
from pathlib import Path

def engine():
    here = Path(__file__).resolve()
    cands = [Path(os.environ["DEFAULT_VOICE_DIR"])] if os.environ.get("DEFAULT_VOICE_DIR") else []
    cands += [p / "default-voice" for p in here.parents] + [p / ".claude/skills/default-voice" for p in here.parents]
    cands += [Path.home() / ".claude/skills/default-voice"]
    for c in cands:
        if (c / "qwen_voice.py").exists():
            return c / "qwen_voice.py"
    sys.exit("default-voice skill not found: set DEFAULT_VOICE_DIR to the folder holding qwen_voice.py")

if len(sys.argv) < 3:
    sys.exit(__doc__)
script, out_dir, rest = sys.argv[1], sys.argv[2], sys.argv[3:]
subprocess.run([sys.executable, str(engine()), "script", script, "-o", out_dir, *rest], check=True)
shutil.copyfile(Path(out_dir) / "chunks.json", Path(out_dir) / "sentences.json")
