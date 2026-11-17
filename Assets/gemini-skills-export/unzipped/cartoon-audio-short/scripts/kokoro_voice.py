"""Kokoro voiceover for a cartoon short: one WAV from the final script, plus sentence timings.

Usage: py kokoro_voice.py script.txt out_dir [--voice am_fenrir] [--speed 1.08] [--gap 0.35]
Writes out_dir/voice.wav (24 kHz mono) and out_dir/sentences.json ([{text, start, end}] in seconds).

Calls kokoro_onnx directly (same model files as commentary-short): `hyperframes tts` falsely
reports Kokoro as missing on this slow PC. Run it alone: Kokoro next to Whisper or x264 runs out of memory.
"""
import argparse, json, re
from pathlib import Path
import numpy as np, kokoro_onnx, soundfile as sf

ap = argparse.ArgumentParser()
ap.add_argument("script"); ap.add_argument("out_dir")
ap.add_argument("--voice", default="am_fenrir"); ap.add_argument("--speed", type=float, default=1.08)
ap.add_argument("--gap", type=float, default=0.35, help="silence between sentences, seconds")
a = ap.parse_args()

text = Path(a.script).read_text(encoding="utf-8").replace("\n", " ")
sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
cache = Path.home() / ".cache/hyperframes/tts"
model = kokoro_onnx.Kokoro(str(cache / "models/kokoro-v1.0.onnx"), str(cache / "voices/voices-v1.0.bin"))

out = Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)
rate, chunks, timings, t = 24000, [], [], 0.0
# One call per sentence keeps each call under Kokoro's 510-token limit and gives exact sentence times.
for i, s in enumerate(sentences):
    samples, rate = model.create(s, voice=a.voice, speed=a.speed, lang="en-us")
    dur = len(samples) / rate
    timings.append({"text": s, "start": round(t, 3), "end": round(t + dur, 3)})
    chunks.append(np.asarray(samples, dtype=np.float32)); t += dur
    if i < len(sentences) - 1:
        chunks.append(np.zeros(int(a.gap * rate), dtype=np.float32)); t += a.gap

sf.write(out / "voice.wav", np.concatenate(chunks), rate)
(out / "sentences.json").write_text(json.dumps(timings, indent=1), encoding="utf-8")
print(f"voice.wav {t:.2f} s, {len(sentences)} sentences, {round(t * 30)} frames")
