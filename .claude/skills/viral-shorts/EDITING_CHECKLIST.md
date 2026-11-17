# Editing checklist (fill in for every clip; report pass/fail)

## Plan (before cutting)
- [ ] `moments.md` written: timestamped moments with hook / clarity / emotion / novelty / story scores (1–5), plus the weak or slow sections to drop.
- [ ] Story in one line: setup → tension → reveal, and it passes the 8-question standalone test (`docs/clipping-playbook.md` §1).
- [ ] Teaser chosen: from the **same story**, 0.3–1.2 s per shot, 1–2.5 s total, shows the build-up or the moment before the result, not the result.
- [ ] Narration script fits the shots (about 3 words/s), and every claim is visible or audible in the footage.
- [ ] The campaign brief is checked: AI voice allowed? Names allowed? Logos and tags required? Banned words?

## Edit
- [ ] 0.0 s: the teaser plays and the narration starts on frame 1. No title card or logo intro.
- [ ] Return to the start of the story with a hard cut, flash or whoosh. Then the story runs in order, cause before effect.
- [ ] Dead space removed. Shots hold long enough to read the proof (timer, impact, reaction).
- [ ] Payoff last; the video ends on it, or within 1 s after.
- [ ] Every effect has a reason (attention / clarity / suspense / emotion / impact):
  - punch-ins on reactions and details;
  - push-in to build;
  - at most 2 flashes;
  - shake only on real impacts, 0.2–0.4 s;
  - at most 6 SFX (2 for brand campaigns), each on a visible event.
- [ ] Arrows or circles point at the thing the narration names, for about 0.5–1.5 s.
- [ ] Captions word by word, synced, 1–2 emphasised words, off faces, logos and the bottom 20% / right-edge UI.
- [ ] Music matches the mood: ducked under the narrator, lifted or hit at the payoff. No silence; −14 LUFS master.

## QC (after render)
- [ ] `bash tools/pipeline/ysc-qc.sh <file>`: 1080×1920, length 13–35 s, −14 LUFS, small LRA, 0 silences. Cuts per second are reported; about 0.7–1.2 is normal here.
- [ ] `blackdetect` clean. `qc-sheet.sh` frame sheet viewed: subject in frame, nothing stretched, text readable.
- [ ] Re-transcribe the final. Narration intelligible over the music; captions match; no curses or banned words (`clean-check.py` when the brief requires it).
- [ ] The teaser matches the later payoff (same event, consistent).
- [ ] Watch the whole render (frame sheets at 2–4 fps plus the transcript). The standalone test passes on the finished file.
