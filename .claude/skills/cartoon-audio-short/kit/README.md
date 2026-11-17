# cartoon-short-kit
Audio in, finished vertical cartoon short out. 2D bean-head cards in an inked, painted 3D world
(three.js in headless Chromium, no Remotion and no GPU needed), with a synthesized music bed and SFX.

- `engine/` renderer: world helpers, cards, ink pass, lens blur, grade (`main.js`), painted textures (`paint.js`),
  cast drawing (`roman.js` on top of the Pen library from mromidev/claude-animated-shorts), motion helpers (`motion.js`).
- `example/soldier/` the worked example "The Soldier Who Never Left" (story.js shot plan + audio.py cue table).
- `tools/` setup.sh (new project), timing.py (word timings), render.mjs (frames), sheet.py (contact sheets),
  mystery_bed.py (original playful-mystery music bed), mix.py (music 16 dB under the voice, SFX at 50 %), finish.sh (one linear gain + limiter, encode, QA).
- `vendor/` three.js r160 `three.module.js` (MIT, see `three.LICENSE`) and `toon.ts` from mromidev/claude-animated-shorts
  (MIT), so setup works offline.

Quick start: `bash tools/setup.sh ~/shorts/my-short && cd ~/shorts/my-short && python3 timing.py voice.wav script.txt --out work`
(on Windows use `py` for `python3`). Sound: `python3 audio.py` (writes music.wav + sfx.wav), then
`python3 mix.py voice.wav music.wav sfx.wav` (writes mix_raw.wav), then `bash finish.sh "Title"`.
Built on github.com/mromidev/claude-animated-shorts (MIT): toon.ts, look values and readability rules.
