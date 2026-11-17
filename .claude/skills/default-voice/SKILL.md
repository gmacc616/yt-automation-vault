---
name: default-voice
description: The channel's default AI narrator for every skill - "clone_3_voicebox-qwen3", a realistic, casual voice made by Qwen3-TTS 1.7B Base (the free, local engine behind the Voicebox app) cloning our reference clip. Holds the voice reference, the exact settings and the qwen_voice.py engine that cartoon-audio-short, cartoon-3d-short, 3d-short, commentary-short, viral-shorts and puregrit call. Use whenever any skill needs a voiceover or narration line, or the user asks about / wants to change the default voice.
---

# Default narrator: clone_3_voicebox-qwen3

Every skill that needs an AI voiceover uses this voice (set 2026-11-16, replacing Kokoro `am_fenrir`). It is the voice of
`clone_3_voicebox-qwen3.mp3` from the 2026-11-16 free-voice comparison: natural, casual storyteller delivery with real emphasis.
Only use another voice when the user asks, or when a campaign brief bans AI voiceover (then no voice at all).

## Files
- `voice/ref.wav`: the reference the voice is cloned from. The first 8.55 s of the user's `voice-comparison.mp3`
  (24 kHz mono, 0.15 s fade-out from 8.4 s, cut before the next word). The user confirmed they have the rights to this voice.
- `voice/ref_text.txt`: exactly what is said in `ref.wav` (the clone needs it).
- `qwen_voice.py`: the engine (CLI + `Voice` class).

## Settings (exactly what made clone_3)
| Setting | Value |
|---|---|
| Model | `Qwen/Qwen3-TTS-12Hz-1.7B-Base` (voice-clone model), CPU, float32 |
| Clone prompt | `create_voice_clone_prompt(ref_audio=voice/ref.wav, ref_text=voice/ref_text.txt)`, built once, reused for every chunk |
| Language | `English` |
| Sampling | the model's own defaults (sampling on); no seed (pass `--seed N` to make a take repeatable) |
| Chunking | one call per script paragraph (one line of the script file); split at sentence ends only past ~260 characters |
| Edge trim | cut each chunk's silence: keep 30 ms before the first and 80 ms after the last sound (threshold 0.01) |
| Gap between chunks | 0.4 s of silence |
| Tempo | 1.0 (natural pace, measured ~3.2 words/s). `--tempo 1.1` = pitch-safe ffmpeg `atempo` speed-up for tighter styles |
| Output | 24 kHz mono WAV at the model's raw level (each skill's own mixer sets loudness; the comparison sample was loudnorm -16 LUFS) |

Measured on the sample: pitch and pitch range match the reference (median ~229 Hz vs 229 Hz), ~3.2 words/s vs the reference's ~3.5.

## The casual, realistic delivery comes from the text
Write narration the way you'd tell it to a friend; the model follows punctuation closely:
- Short sentences. Contractions ("it's", "they're"). Conversational pivots: "You see,", "Here's the thing.", "Luckily... Unluckily...".
- `...` for a beat before a reveal ("picked up out of the sea... by a wall!"). `!` on the punch word or line. `?` for real questions.
- Repeated words for build-up get their own punctuation: "Higher. Higher!".
- Numbers, dates and units as words ("two-fourteen BC", "sixty warships", "twenty-one years").
- One paragraph per line in script files: a paragraph is voiced in one go, so its sentences flow together. Keep a punch line
  ("Then they let go.") on its own line when it should land alone after a pause.
- No stage directions or tags in the spoken text: this model reads `[excited]` aloud.

## Usage
`py` on Windows, `python3` on Linux/cloud (in the cloud use the venv that has `qwen-tts`).
```bash
py .claude/skills/default-voice/qwen_voice.py line "One line of narration." -o vo1.wav
py .claude/skills/default-voice/qwen_voice.py lines lines.txt -o vo_dir          # vo1.wav, vo2.wav ... one per line
py .claude/skills/default-voice/qwen_voice.py script script.txt -o out_dir --words  # voice.wav + chunks.json + words.json
```
From Python: `from qwen_voice import Voice; v = Voice(); audio = v.say("text")` (24 kHz float32).
Skill wrappers: `cartoon-audio-short/scripts/kokoro_voice.py`, `cartoon-3d-short|3d-short/templates/scripts/fenrir_voice.py`
(old file names, same command lines), `commentary-short/scripts/synth_lines.py`. They find this folder next to them,
via `DEFAULT_VOICE_DIR`, or in `~/.claude/skills/default-voice`.

## Setup
- Python 3.10-3.13 with `pip install qwen-tts soundfile numpy` (pulls `torch` and `transformers`; on a CPU-only box install
  torch from `https://download.pytorch.org/whl/cpu`). ffmpeg on PATH (only for `--tempo`).
- First run downloads the model from Hugging Face (~4.5 GB) to `~/.cache/huggingface`. In the cloud set
  `REQUESTS_CA_BUNDLE=/root/.ccr/ca-bundle.crt SSL_CERT_FILE=/root/.ccr/ca-bundle.crt` so the download trusts the proxy.
- A "SoX could not be found" warning is harmless.

## Speed and memory
- CPU: about 1-1.5 min per 10 s of voice (4 cores), plus ~30 s to load the model. A 75 s short takes ~8-10 min.
- RAM: the 1.7B model needs about 8 GB. The cloud session (16 GB) is fine. **The home PC (3.6 GB) can't load it**: there,
  set `QWEN_VOICE_MODEL=Qwen/Qwen3-TTS-12Hz-0.6B-Base` (smaller, a bit less natural) or voice the script in the cloud.
- Run it alone: the voice model next to Whisper or x264 can run out of memory.

## Quality check (always)
Read every take back with faster-whisper and compare it with the script. Known slips: a dropped repeated word
("Higher. Higher!" said once) or a mangled very short line. Re-render only that chunk (`line` mode) and splice it in at the
chunk's pause, or just re-run: takes differ because sampling is on.
