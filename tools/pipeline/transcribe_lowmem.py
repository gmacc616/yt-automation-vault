"""Low-memory word-level transcription with faster-whisper.

Usage: py transcribe_lowmem.py <audio-or-video> <outdir> [model=base.en]
Writes <outdir>/transcript.json (flat [{text,start,end}]) and <outdir>/segments.txt.

Fixes for problems hit on this 3.6 GB machine:
- Any input (wav/mp4/mkv/webm...): decoded by ffmpeg to 16 kHz mono int16 (~2 MB per minute),
  so no manual WAV conversion and no dependence on PyAV.
- 30 s windows with 2 s overlap: words that straddle a window edge are no longer cut in half
  or duplicated (the old hard 30 s chunks could garble the boundary word).
- Checkpoint after every window: if the process is killed (out of memory, session restart),
  re-running the same command resumes where it stopped.
- If a window still fails, it is retried once after freeing memory.
"""
import gc, json, os, subprocess, sys, time, types

# PyAV is only needed by faster-whisper for decoding, which ffmpeg does here; keep it unloaded
# (it was blocked by Smart App Control before and costs RAM).
sys.modules.setdefault("av", types.ModuleType("av"))
import numpy as np
from faster_whisper import WhisperModel

src, outdir = sys.argv[1], sys.argv[2]
model_name = sys.argv[3] if len(sys.argv) > 3 else "base.en"
LANG = sys.argv[4] if len(sys.argv) > 4 else None  # e.g. "tr"; None = auto-detect
os.makedirs(outdir, exist_ok=True)
SR, WIN, STEP = 16000, 30.0, 28.0
ckpt_path = os.path.join(outdir, "transcript.partial.json")

t0 = time.time()
pcm = np.frombuffer(subprocess.run(
    ["ffmpeg", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
    capture_output=True, check=True).stdout, dtype=np.int16)
total = len(pcm) / SR

state = {"next": 0.0, "words": [], "lines": []}
if os.path.exists(ckpt_path):
    with open(ckpt_path, encoding="utf-8") as f:
        state = json.load(f)
    print(f"resuming at {state['next']:.0f}s", flush=True)

model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=1, num_workers=1)

def run_window(off):
    chunk = pcm[int(off * SR):int(min(off + WIN, total) * SR)].astype(np.float32) / 32768.0
    segs, _ = model.transcribe(chunk, language=LANG, word_timestamps=True, vad_filter=True, beam_size=1,
                               condition_on_previous_text=False)
    return list(segs)

off = state["next"]
while off < total - 0.05:
    last = off + WIN >= total
    try:
        segs = run_window(off)
    except (MemoryError, RuntimeError):
        gc.collect()
        segs = run_window(off)
    keep_until = total if last else off + STEP
    prev_end = state["words"][-1]["end"] if state["words"] else -1.0
    for seg in segs:
        kept = []
        for wd in seg.words or []:
            s, e = off + wd.start, off + wd.end
            # Inside the overlap: skip what the previous window already has, and leave
            # words starting past STEP to the next window.
            if s < prev_end - 0.05 or s >= keep_until:
                continue
            kept.append({"text": wd.word.strip(), "start": round(s, 3), "end": round(e, 3)})
        if kept:
            state["words"].extend(kept)
            state["lines"].append(f"[{kept[0]['start']:7.2f} - {kept[-1]['end']:7.2f}] " + " ".join(w["text"] for w in kept))
    off = total if last else off + STEP
    state["next"] = off
    with open(ckpt_path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False)
    gc.collect()
    print(f"{min(off, total):.0f}s / {total:.0f}s", flush=True)

with open(os.path.join(outdir, "transcript.json"), "w", encoding="utf-8") as f:
    json.dump(state["words"], f, ensure_ascii=False)
with open(os.path.join(outdir, "segments.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(state["lines"]))
os.remove(ckpt_path)
print(f"done words={len(state['words'])} segs={len(state['lines'])} secs={time.time() - t0:.0f}")
