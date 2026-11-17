import json, sys, time, types, wave, gc
import numpy as np
# PyAV is blocked by Windows Application Control on this machine; faster-whisper only
# needs it to decode files. Register an inert placeholder so it is never loaded, and
# feed pre-decoded 16 kHz mono PCM instead.
sys.modules["av"] = types.ModuleType("av")
from faster_whisper import WhisperModel
audio, outdir, model_name = sys.argv[1], sys.argv[2], sys.argv[3]
CHUNK = 60  # seconds; low-RAM machine, never hold the whole file as float32
t0 = time.time()
model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=2, num_workers=1)
words, lines = [], []
with wave.open(audio, "rb") as w:
    assert w.getframerate() == 16000 and w.getnchannels() == 1 and w.getsampwidth() == 2
    sr, total = 16000, w.getnframes()
    offset = 0
    while offset < total:
        n = min(CHUNK * sr, total - offset)
        pcm = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
        base = offset / sr
        segs, _ = model.transcribe(pcm, word_timestamps=True, vad_filter=True, beam_size=1, condition_on_previous_text=False)
        for seg in segs:
            lines.append(f"[{base+seg.start:7.2f} - {base+seg.end:7.2f}] {seg.text.strip()}")
            for wd in seg.words or []:
                words.append({"text": wd.word.strip(), "start": round(base+wd.start, 3), "end": round(base+wd.end, 3)})
        offset += n
        del pcm; gc.collect()
        print(f"{offset/sr:.0f}s / {total/sr:.0f}s", flush=True)
json.dump(words, open(f"{outdir}/transcript.json", "w", encoding="utf-8"), ensure_ascii=False)
open(f"{outdir}/segments.txt", "w", encoding="utf-8").write("\n".join(lines))
print(f"done words={len(words)} segs={len(lines)} secs={time.time()-t0:.0f}")
