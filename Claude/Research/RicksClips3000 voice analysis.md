# RicksClips3000 voice analysis (2026-11-16)

A measured study of the narrator voice in 8 recent Shorts (aD73kaL_PtY, TRUkQ1wbV2E, i4hYq1oSXTg, e9NoHjAXYIY, QlDPMzGmYac, HxqtHI62otM, 7xS87iActkU, Mz72MuPgnGY), compared with our Kokoro voices. The method is in [[2026-11-16 Studying AI voices through code]]. The visual and script study is in [[RicksClips3000 style breakdown]].

## Method
yt-dlp audio → Demucs htdemucs separates the voice from music and SFX → faster-whisper base.en word timings → Praat/librosa delivery metrics (`analyze.py`) → SpeechBrain ECAPA speaker embeddings (`embed.py`) → Kokoro replicas (`replica.py`). Scripts and data live in `C:\Users\manth\yt-research\ricks-voice` (outside the vault).

## The voice
- **One synthetic narrator in all 8 Shorts.** Speaker similarity between videos is 0.95 on average (min 0.93). Every video is mastered the same way.
- **It is not a Kokoro voice.** The best Kokoro match is am_liam at 0.39, then am_echo 0.34 and am_fenrir 0.27. Two different Kokoro voices average 0.17, and the same speaker would score above about 0.6. Audio alone can't name the TTS product. The 44.1 kHz full-band output (energy up to about 11.5 kHz) and the lively prosody point to a high-end neural TTS of the ElevenLabs class.
- **Register:** a high, excited male storyteller. Median pitch is about 195 Hz (range 188–204 across videos), 5–95 % span 120–335 Hz, an 18 st range.
- **Delivery (8-video averages):**

| metric | Ricks | Kokoro Fenrir (skill default 1.15 / gap 0.15) | Kokoro Liam |
|---|---|---|---|
| words/s | 3.67 (3.36–3.85) | 3.35 | 3.41 |
| median pitch | ~195 Hz | 135 Hz | 122 Hz |
| pitch range 5–95 % | 17.4 st | 15.3 st | 16.6 st |
| pitch movement speed | ~39 st/s | 24 st/s | 27 st/s |
| sentence-end pitch (mean / SD) | −2.6 / 3.4 st | −5.9 / 1.1 st | −4.4 / 1.4 st |
| gap between sentences | 0.28 s | 0.40 s | 0.43 s |
| sentence-rate variation (CV) | 0.16 | 0.23 | 0.17 |

- **How human it sounds (by measurement):** jitter, shimmer, HNR and word-duration rhythm (nPVI about 55) are in the same range for Ricks and Kokoro, so those can't separate them. The tells are intonation. Ricks's pitch moves about 50 % faster, and his sentence endings vary three times more (rises, flats, falls). Kokoro ends almost every sentence with the same fall, which is what makes it sound read rather than told. Ricks has natural micro-pauses around 0.3 s and no dead air.
- **Mix:** voice stem −14.1 to −14.3 LUFS in every video. Music + SFX stem −28 to −35 LUFS, which is **14–20 LU under the voice** (roughly 10–20 % of voice level). Our cartoon-audio-short puts the bed at 50 % of voice level (−6 dB), which is much louder than Ricks.

## Replica attempts (railroad script, measured the same way)
`replica.py` does Kokoro per sentence → per-sentence speed variation → Praat contour widening plus a varied sentence-end bend → optional formant-preserving pitch shift (rubberband) → 44.1 kHz, presence/treble EQ, light compression, −14 LUFS.

| version | speaker sim to Ricks | Hz | range st | sent. gap | wps |
|---|---|---|---|---|---|
| Fenrir raw (today's skill) | 0.28 | 135 | 15.3 | 0.40 | 3.35 |
| Liam raw | 0.41 | 122 | 16.6 | 0.43 | 3.41 |
| G: Fenrir +5 st replica | 0.06 | 180 | 17.7 | 0.31 | 3.43 |
| **H: Liam, no shift, replica** | **0.39** | 124 | 19.0 | 0.30 | 3.57 |

- Fixable with Kokoro: pause timing, pitch range, pace, mastering and brightness.
- **Not fixable by post-processing:** the fast, varied intonation (pitch speed stayed around 23–26 st/s) and the high excited register. Pitch-shifting raises the Hz but wrecks the timbre match (0.41 → 0.06–0.19).
- Best Kokoro replica: **H (am_liam, `--pitch 0 --vary 0.8 --expand 1.2 --endvar 3.5 --gap 0.05`)**. Use speed about 1.08 to land on 3.4–3.7 words/s.
- Listening file: `C:\Users\manth\yt-research\ricks-voice\voice-comparison.mp3` (original, Fenrir today, H, G).

## To get closer
- A more expressive TTS with a similar but not identical voice (ElevenLabs-class, or open models such as Chatterbox, F5-TTS or Orpheus). Don't clone Ricks's actual voice: it's his channel's identity.
- Write the delivery into the script: short punchy lines, quoted dialogue with "!", and "?" where his tone rises.
- Mix the music bed 14–20 LU under the voice instead of 6 dB.

## Gotchas
- The PC has 3.6 GB RAM. Demucs and Whisper can't run together (mkl_malloc OOM), and Whisper small.en fails under load, so use base.en with beam 1 and 2 threads.
- faster-whisper on Python 3.14 breaks on file paths (`av.open metadata_errors`). Pass a numpy array instead.
- SpeechBrain on Windows needs `local_strategy=LocalStrategy.COPY` (symlinks need admin).
- The UTMOS naturalness score (torch.hub `tarepan/SpeechMOS`) was blocked by the auto-mode classifier because it runs remote repo code. It needs the user's OK.
- Gap energy in Ricks's stem (about −7 dB) is Demucs music bleed, not breaths, so it isn't a reliable signal.

## Music bed (measured 2026-11-16, Demucs no_vocals stem)
| metric | 8-video median (range) |
|---|---|
| bed vs voice, gated RMS | −14.5 dB (−8.5 to −18.8; the −8.5 video is mostly sub-bass rumble) |
| bed vs voice, integrated | 14–20 LU under |
| ducking (bed in speech gaps vs under speech) | about 0 dB, so **never ducked** |
| stops | none: one continuous cue, flat (level SD 3–6 dB), small bumps at frame 0, the twist and the end |
| tempo | 112–118 bpm in 5 of 8 (others 81, 99, 161) |
| key | minor in 7 of 8 (D minor ×3, E minor ×3, A minor), E major once |
| harmonic share | 0.66 (tonal; light percussion) |
| energy bands sub / bass / low-mid / mid / high | about 25 / 26 / 27 / 12.5 / 1.2 % (dark, almost nothing above 4 kHz) |
| strong transients (SFX hits, drum accents) | about 11 per minute (5–26) |

- **Sound:** zoomed note plots show a staccato walking bass (C2–C3, a new note about every half beat), short plucked/mallet melody notes high up (C5–C7), soft chord stabs in the middle, a light low kick and broadband whoosh hits. It reads as a "sneaky playful mystery" pizzicato underscore.
- **Our version:** `mystery_bed.py` (in all 3 cartoon skills) composes an original cue from these rules; none of their audio is reused. At default settings (D minor, 112 bpm) it measures 112 bpm, D minor, harmonic share 0.69, bands 25 / 32 / 25 / 17.5 / 0 %.
- Plots: `C:\Users\manth\yt-research\ricks-voice\bedplots\`. Test mix: `sample_ricks_style_mix.mp3` (replica voice + bed at −16 dB).
