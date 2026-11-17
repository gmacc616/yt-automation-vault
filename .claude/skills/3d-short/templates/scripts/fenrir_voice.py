"""Default narrator (clone_3_voicebox-qwen3, see default-voice/SKILL.md) -> voice.wav + words.json for the cartoon 3D short.
File name kept from the Kokoro am_fenrir days so old notes and commands still work; Kokoro is no longer used.

Usage: py fenrir_voice.py SCRIPT.txt out_dir [--tempo 1.0] [--gap 0.4] [--whisper small.en]
Writes out_dir/voice.wav (24 kHz mono), out_dir/chunks.json and out_dir/words.json ([{w, s, e}] in seconds, the format
timeline.py/mix.py read). Word times come from faster-whisper run on the generated voice; hand-fix them as the skill says.
Runs default-voice/qwen_voice.py (found via DEFAULT_VOICE_DIR, the skills folder above this file, or ~/.claude/skills).
"""
import os, subprocess, sys
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
subprocess.run([sys.executable, str(engine()), "script", sys.argv[1], "-o", sys.argv[2], "--words", *sys.argv[3:]], check=True)
