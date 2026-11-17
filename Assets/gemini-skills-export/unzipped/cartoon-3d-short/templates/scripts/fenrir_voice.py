"""Default narrator: Kokoro am_fenrir -> voice.wav + words.json for the cartoon 3D short.

Usage: py fenrir_voice.py SCRIPT.txt out_dir [--voice am_fenrir] [--speed 1.15] [--gap 0.12] [--whisper small.en]
Writes out_dir/voice.wav (24 kHz mono) and out_dir/words.json ([{w, s, e}] in seconds, the format timeline.py/mix.py read).
Word times come from faster-whisper run on the generated voice; hand-fix them afterwards as the skill says.
Kokoro model files: ~/.cache/hyperframes/tts (same as cartoon-audio-short / commentary-short).
"""
import argparse, gc, json, re
from pathlib import Path
import numpy as np, soundfile as sf

ap = argparse.ArgumentParser()
ap.add_argument("script"); ap.add_argument("out_dir")
ap.add_argument("--voice", default="am_fenrir"); ap.add_argument("--speed", type=float, default=1.15)
ap.add_argument("--gap", type=float, default=0.12, help="silence between sentences, s (style: almost no pauses)")
ap.add_argument("--whisper", default="small.en")
a = ap.parse_args()

import kokoro_onnx
text = Path(a.script).read_text(encoding="utf-8").replace("\n", " ")
sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
cache = Path.home() / ".cache/hyperframes/tts"
tts = kokoro_onnx.Kokoro(str(cache / "models/kokoro-v1.0.onnx"), str(cache / "voices/voices-v1.0.bin"))
rate, chunks = 24000, []
# One call per sentence keeps each call under Kokoro's 510-token limit.
for i, s in enumerate(sentences):
    samples, rate = tts.create(s, voice=a.voice, speed=a.speed, lang="en-us")
    chunks.append(np.asarray(samples, dtype=np.float32))
    if i < len(sentences) - 1:
        chunks.append(np.zeros(int(a.gap * rate), dtype=np.float32))
audio = np.concatenate(chunks)
out = Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)
sf.write(out / "voice.wav", audio, rate)
del tts; gc.collect()  # Kokoro and Whisper together run out of memory on a small PC

from faster_whisper import WhisperModel
idx = np.round(np.arange(0, len(audio), rate / 16000)).astype(int)
idx = idx[idx < len(audio)]
segs, _ = WhisperModel(a.whisper, device="cpu", compute_type="int8").transcribe(audio[idx], word_timestamps=True, beam_size=5)
words = [dict(w=w.word.strip(), s=round(w.start, 3), e=round(w.end, 3)) for seg in segs for w in seg.words]
(out / "words.json").write_text(json.dumps(words, indent=1), encoding="utf-8")
dur = len(audio) / rate
print(f"voice.wav {dur:.2f} s ({round(dur * 30)} frames), {len(words)} words, {len(words) / dur:.2f} words/s, voice {a.voice}")
