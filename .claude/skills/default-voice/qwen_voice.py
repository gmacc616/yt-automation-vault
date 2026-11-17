"""Default narrator for every skill: the "clone_3_voicebox-qwen3" voice.

Qwen3-TTS 1.7B Base (the engine behind the Voicebox app) cloning voice/ref.wav, free and local.
Settings are the ones that made clone_3_voicebox-qwen3.mp3 on 2026-11-16 (see SKILL.md).

Usage (python3 on Linux/cloud, py on Windows):
  qwen_voice.py line  "One line of narration." -o vo1.wav
  qwen_voice.py lines lines.txt -o vo_dir            one WAV per non-empty line: vo_dir/vo1.wav, vo2.wav, ...
  qwen_voice.py script script.txt -o out_dir [--words] [--gap 0.4]
        -> out_dir/voice.wav + out_dir/chunks.json ([{text, start, end}]) (+ words.json [{w, s, e}] with --words)
Common options: --tempo 1.0 (pitch-safe speed-up via ffmpeg atempo; 1.0 = the natural clone_3 pace)
                --model Qwen/Qwen3-TTS-12Hz-1.7B-Base (or env QWEN_VOICE_MODEL; 0.6B-Base is the low-RAM fallback) --seed N
Output: 24 kHz mono WAV, raw level (the skills' own mixers set levels).
"""
import argparse, json, os, re, subprocess, sys
from pathlib import Path
import numpy as np, soundfile as sf

HERE = Path(__file__).resolve().parent
REF = HERE / "voice" / "ref.wav"
REF_TEXT = (HERE / "voice" / "ref_text.txt").read_text(encoding="utf-8").strip()
MODEL = os.environ.get("QWEN_VOICE_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-Base")  # 0.6B-Base = low-RAM fallback
GAP = 0.4          # silence between chunks (paragraphs), seconds, as in clone_3
MAX_CHARS = 260    # a chunk is one script paragraph, split at sentence ends only if longer than this


class Voice:
    """Load once, then call .say(text) -> float32 numpy array at .sr (24 kHz)."""

    def __init__(self, model=MODEL, seed=None, threads=None):
        import torch
        from qwen_tts import Qwen3TTSModel
        if threads:
            torch.set_num_threads(threads)
        self.torch, self.seed = torch, seed
        self.m = Qwen3TTSModel.from_pretrained(model, device_map="cpu", dtype=torch.float32)
        self.prompt = self.m.create_voice_clone_prompt(ref_audio=str(REF), ref_text=REF_TEXT)
        self.sr = 24000

    def say(self, text):
        if self.seed is not None:
            self.torch.manual_seed(self.seed)
        w, self.sr = self.m.generate_voice_clone(text=text, language="English", voice_clone_prompt=self.prompt)
        return trim(np.asarray(w[0], np.float32).squeeze(), self.sr)


def trim(a, sr):
    """Cut the model's edge silence: keep 30 ms before the first and 80 ms after the last sound."""
    nz = np.where(np.abs(a) > 0.01)[0]
    return a[max(0, nz[0] - int(.03 * sr)):nz[-1] + int(.08 * sr)] if len(nz) else a


def chunks_of(text):
    """One chunk per paragraph (line); long paragraphs are split at sentence ends. Whole thoughts in one call
    keep the casual flow between sentences; very short lines ("Then they let go.") are fine on their own."""
    out = []
    for para in [p.strip() for p in text.splitlines() if p.strip()]:
        cur = ""
        for s in re.split(r"(?<=[.!?])\s+", para):
            if cur and len(cur) + len(s) > MAX_CHARS:
                out.append(cur); cur = s
            else:
                cur = f"{cur} {s}".strip()
        if cur:
            out.append(cur)
    return out


def tempo(path, factor):
    if abs(factor - 1.0) < 1e-3:
        return
    tmp = Path(path).with_suffix(".tempo.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(path), "-af", f"atempo={factor}", str(tmp)], check=True)
    tmp.replace(path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["line", "lines", "script"])
    ap.add_argument("src", help="the text (line) or a text file (lines/script)")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--gap", type=float, default=GAP)
    ap.add_argument("--tempo", type=float, default=1.0)
    ap.add_argument("--words", action="store_true", help="script mode: also write words.json via faster-whisper")
    ap.add_argument("--whisper", default="small.en")
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--threads", type=int, default=None)
    a = ap.parse_args()
    v = Voice(a.model, a.seed, a.threads)

    if a.mode == "line":
        out = Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)
        sf.write(out, v.say(a.src), v.sr); tempo(out, a.tempo)
        print(f"{out} {sf.info(out).duration:.2f} s"); return

    text = Path(a.src).read_text(encoding="utf-8")
    if a.mode == "lines":
        d = Path(a.out); d.mkdir(parents=True, exist_ok=True)
        for i, line in enumerate([l.strip() for l in text.splitlines() if l.strip()], 1):
            out = d / f"vo{i}.wav"; sf.write(out, v.say(line), v.sr); tempo(out, a.tempo)
            print(f"{out} {sf.info(out).duration:.2f} s", flush=True)
        return

    d = Path(a.out); d.mkdir(parents=True, exist_ok=True)
    parts, timings, t, gap = [], [], 0.0, np.zeros(int(a.gap * 24000), np.float32)
    for i, c in enumerate(chunks_of(text)):
        w = v.say(c)
        if i:
            parts.append(gap); t += a.gap
        timings.append({"text": c, "start": round(t / a.tempo, 3), "end": round((t + len(w) / v.sr) / a.tempo, 3)})
        parts.append(w); t += len(w) / v.sr
        print(f"chunk {i + 1}: {len(w) / v.sr:.1f} s", flush=True)
    wav = d / "voice.wav"
    sf.write(wav, np.concatenate(parts), v.sr); tempo(wav, a.tempo)
    (d / "chunks.json").write_text(json.dumps(timings, indent=1), encoding="utf-8")
    dur = sf.info(wav).duration
    msg = f"voice.wav {dur:.2f} s ({round(dur * 30)} frames), {len(timings)} chunks"
    if a.words:
        del v; import gc; gc.collect()  # TTS model and Whisper together are heavy on a small PC
        from faster_whisper import WhisperModel
        audio, sr = sf.read(wav, dtype="float32")
        idx = np.round(np.arange(0, len(audio), sr / 16000)).astype(int); idx = idx[idx < len(audio)]
        segs, _ = WhisperModel(a.whisper, device="cpu", compute_type="int8").transcribe(
            audio[idx], word_timestamps=True, beam_size=5)
        words = [dict(w=x.word.strip(), s=round(x.start, 3), e=round(x.end, 3)) for s in segs for x in s.words]
        (d / "words.json").write_text(json.dumps(words, indent=1), encoding="utf-8")
        msg += f", {len(words)} words, {len(words) / dur:.2f} words/s"
    print(msg)


if __name__ == "__main__":
    sys.exit(main())
