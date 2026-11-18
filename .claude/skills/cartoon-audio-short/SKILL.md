---
name: cartoon-audio-short
description: Make a vertical animated cartoon short. Offers 10 ideas, writes the script, voices it automatically with the default narrator, a local Qwen3-TTS voice clone (or uses an uploaded voiceover), then builds a finished MP4 with the narrator clearly on top: a quiet playful-mystery music bed (21 dB under the voice) and SFX hits ~12 dB under it. Use for any cartoon short or animated story video request.
---

# Cartoon short: idea → script → voiceover → finished MP4

The look: flat 2D bean-head cartoon characters (canvas-drawn "cards" with plum outlines) in a colourful 3D world with black ink outlines, painted textures, depth-of-field and gliding cameras. The output is 1080x1920, 30 fps, exactly as long as the voiceover. The voice is generated with the default narrator (clone_3_voicebox-qwen3) by default (no recording needed); an uploaded voiceover is used instead only when the user provides one. Either way the voice is unchanged. The music bed and SFX are synthesized. The bed sits **21 dB under the voice**; SFX hits sit a median **12 dB under the voice** (the reference channel's levels, re-measured on its 30 latest Shorts on 2026-11-18). The full study (camera, cuts, characters, light, script, narration, audio) is `references/STUDY_2026-11-18.md`; it wins wherever older notes disagree. Proven on "The Soldier Who Never Left" (19.7 s, 8 shots).

## Rules
- Stories, characters and shots are always original. Never recreate another creator's video shot for shot. Offer an original take on the same idea instead.
- No real, named living people as characters, and no brand mascots or logos.
- No captions unless the user asks. Diegetic text (a carved message, a sign) is fine, and it must read correctly (not mirrored).
- Never edit or re-time the voice. The picture is timed to it, and every visual reaction lands 0-3 frames before its word.
- **Audio levels:** the narrator is clearly louder than everything else. Music bed 21 dB under the voice (gated RMS), never ducked; SFX hits (400 ms peak) a median 12 dB under the voice, the loudest no closer than 5 dB (measured on the reference channel's 30 latest Shorts on 2026-11-18 with a demucs voice/bed split: music ~21 dB under, hits median -12 / loud 10 % -6, music+SFX 16.6 LU under, mix -14 LUFS). Replaces the 2026-11-16 "bed -16 dB, SFX 50 %" rule, which made SFX nearly as loud as the voice. Always mix with `mix.py`, never by hand. Use no ducking or compression that would change this ratio; only one linear gain plus a peak limiter goes on the whole mix.
- Keep the user informed with a task list. Send a stills contact sheet before the long render.

## Stage 1: Intake (always first)
The voice is always made with the default narrator (see "Voiceover" below) unless the user has already attached their own audio. Never ask the user to record or upload a voiceover.
- An audio file is already attached: skip to Stage 4 with it. If a script was also given, use it for the timing.
- A script was given (no audio): tighten it per Stage 3 if needed, show it once for approval, then run the voiceover and go straight to Stage 4.
- Nothing given: go to Stage 2.
Use the target length the user stated; otherwise use the default 20-30 s without asking (45-60 s is allowed on request).

## Stage 2: 10 video ideas
Give exactly 10 ideas in one reply, numbered, and ask the user to reply with a number (or "more"). Each idea gets:
- **Title** (5-8 words, curiosity-driven, e.g. "The Soldier Who Never Left").
- **Hook line**: the first spoken sentence: the result first, as an insane-sounding act in the past tense ("A man sold the Eiffel Tower. Twice."), or "If you [normal act], [absurd result]."
- **The twist** in one line (the ironic payoff that ends the video).
- **Why it animates well**: the 2-3 big visual moments (a collapse, a reveal, a chase).
- **True or legend**: say plainly whether it is documented history, a disputed account or folklore.

What makes an idea "perfect" for this format:
- One surprising story with a physical cause and effect you can show.
- A clear everyman character, stakes that escalate, and a twist in the last line.
- A setting that can be built from simple 3D shapes plus cartoon cards (towns, bridges, ships, castles, deserts, labs, palaces).
- Mix the 10 across eras and themes: ancient, medieval, 1800s, modern, science, animals, inventions, disasters, weird laws, lucky accidents.
- Never offer a story the 2D-in-3D reference channel already told (one of its shorts already covered the first bridge-short topic; it was dropped).
- For anything presented as true, verify the key facts with a web search before offering it. Check the small numbers too (dates, counts, depths): they often become the best joke ("the river was only two feet deep"). Don't present a viral legend as fact. If the user wants it anyway, frame it as "legend says".
- No real living people as the butt of a joke, nothing graphic and nothing political.

## Stage 3: Script (after they pick)
Write the narration only (no stage directions in the spoken text), with basically zero dead air. Size it at the reference pace of ~3.7 words/s (the voice defaults now hit it): 20 s ≈ 72 words, 30 s ≈ 110, 45 s ≈ 165, 60 s ≈ 220. Formula (measured on the reference's 30 latest transcripts, `references/STUDY_2026-11-18.md` §3):
1. **Hook** (sentence 1, ~14 words, no setup): the result first, as an insane-sounding act in the past tense, often with a twist clause ("…but made sure it wouldn't go off"-type). Or "If you…", "[X] is illegal, yet…", "Imagine you're…".
2. **"You see," + context** in sentence 2: stakes, place, who doubts it. Then **switch to present tense**.
3. **Escalation** where every sentence is a consequence or a reversal, opened with "So", "But", "Then,", "Eventually,", "The next morning,". Ladders of odd, specific numbers or times. 1-3 short quoted mocker lines (no "he said"), one exaggeration joke, a dry aside ("Big mistake.").
4. **Mystery beat** (one short question, "So how does this keep happening?") → "Well, it's called [name]." / "You see," → the mechanism through one everyday analogy in 2-4 sentences. Best pattern: build to the brink, explain, THEN resolve the climax.
5. **Twist / payoff**: an ironic image or a callback to an early detail, on the last words. No moral, no CTA.
Use plain spoken English, contractions, ~13-word sentences (a few long run-on ones are fine), and numbers written as words. Never describe what the viewer already sees.

Then reply with:
- The script in a copyable block, with the word count and estimated length.
- A one-paragraph visual plan (the shots you'll animate).
- The ask: **"Reply OK (or with edits) and I'll voice it and build the video."** This script approval is the only stop between the idea and the finished MP4.
Keep the final script text. It drives the voice and the timing in Stage 4.

### Voiceover (automatic, right after the script is approved)
Default narrator for every skill: **clone_3_voicebox-qwen3** (Qwen3-TTS 1.7B Base cloning our reference voice; free, local; full settings in `../default-voice/SKILL.md`). Don't ask about the voice; generate it and continue. Save the final script as `script.txt` in the project (one paragraph per line: each line is voiced in one go, which keeps the casual flow), then run it alone (the voice model next to Whisper or x264 runs out of memory on small machines):
`py <skill>/scripts/kokoro_voice.py script.txt work [--tempo 1.12] [--gap 0.22]` (`python3` instead of `py` on Linux/cloud; the file name is historical, it runs the default voice)
- It writes `work/voice.wav` (use it wherever Stage 4 says `voice.mp3`) and `work/sentences.json` (= `chunks.json`): start and end in seconds of each script line. Every line boundary is a pause.
- Defaults (since 2026-11-18) = the reference narrator's pace: `--tempo 1.12 --gap 0.22` (~3.7 words/s, ~0.22 s breaths, no pause over ~0.5 s); the wrapper adds them unless you pass your own (`--tempo 1.0 --gap 0.4` = the old relaxed read). A new script line = a breath: break lines before "So / But / Then / Well / Eventually", never mid-phrase. Send the user the WAV for reference, then go straight on with Stage 4 without waiting. If they later ask for another voice, rerun it, then redo 4.1 timing and 4.7 sound (the picture timing follows the voice).
- Write it casual and animated like the reference narrator: statements end level (never trailing off), rhetorical questions short and dropping, dialogue lines in the narrator's own voice with attitude (sarcasm, panic, deadpan), `...` only before the 1-2 biggest reveals, `!` on the punch word, numbers as words (Stage 3). Unusual names may need a phonetic respelling, in `script.txt` only.
- Needs Python 3.10-3.13 with `qwen-tts`, `torch`, `soundfile`, `numpy` (see `../default-voice/SKILL.md` for setup). First run downloads the model (~4.5 GB) without asking. CPU speed: about 1-1.5 min per 10 s of voice.
- In 4.1, check `phrases.json` against `sentences.json`: every line boundary must fall in a pause. If they disagree, trust `sentences.json`.

## Stage 4: Build the video (after the generated voice, or an attached voiceover)
Do everything from here without stopping. Ask only if the timing cannot be resolved.

### 4.0 Get the kit
The code kit ships **inside this skill folder** at `kit/` (engine, tools, worked example, plus vendored three.js r160 and the `toon.ts` Pen library from github.com/mromidev/claude-animated-shorts, both MIT). Locate the folder with `find / -name SKILL.md -path "*cartoon-audio-short*" 2>/dev/null` and treat its `kit/` as read-only.

Then run `bash <skill>/kit/tools/setup.sh ~/shorts/<slug>`. It copies the engine and tools into the project, installs the vendored three.js, strips the types from `toon.ts` with Node 22 `module.stripTypeScriptTypes`, and links Playwright. No network is needed. If the vendored files are missing, it falls back to npm or a git clone.
- Requirements: Node 22.6+, Python 3 with numpy + Pillow, ffmpeg, and Playwright with Chromium (`npm i -g playwright && npx playwright install chromium` if missing).
- If package registries are blocked, git over GitHub usually works. Never disable TLS or route around the proxy.
- Chromium: use the pre-installed Playwright browser with `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. That gives CPU WebGL at about 3-10 s per frame.
- **Windows (this PC):** run every `python3 …` command below as `py …` (`python3` is only the Microsoft Store stub here). Run the `.sh` tools with Git Bash. Playwright 1.49.1 + Chromium are installed globally. `setup.sh` also copies `mix.py` and `finish.sh` into the project.

### 4.1 Timing
Run `python3 timing.py voice.mp3 script.txt --out work` (`work/voice.wav` from the voiceover step works the same).
- With whisper or faster-whisper installed, it uses word timestamps. The audio is decoded with ffmpeg first, which avoids the PyAV crash.
- Otherwise it aligns script phrases (split at punctuation) to silence-detected speech segments, with a DP that matches syllables to duration and penalises sentence ends inside a segment and long gaps inside a phrase.
- With no ASR and no script, ask for the script. Claude cannot hear audio.
- Check `work/phrases.json`: pauses should fall at sentence ends. Total frames = round(duration × 30).

### 4.2 Shot plan (`work/PLAN.md` before code)
Make one row per shot: frames, words, setting, light, camera move, characters/poses/expressions, effects and SFX cue.
- Frame 0 is already the hook image.
- A new framing every 1.5-2.5 s (1-2 per sentence). Merge tiny phrases into the next shot.
- Illustrate every sentence literally. Props carry the jokes.
- Vary shot sizes: hook MCU → wide reveal → two-shot → insert close-up on the key object → reaction close-up → environment move for the payoff. Prop-insert ECUs (the sentence's noun filling the frame) about every 6-10 s. Low, chest-to-floor cameras, top-down inserts, aerials.
- Use light for beats: day while setting up (not too bright, median luma ~.50), a saturated royal-blue night / storm / crisis stretch mid-story (the explanation can live there: blue ambient, warm windows/lamps, violet fog, purple never brown shadows, faces still bright), and sunrise/golden for the payoff. Change light inside a shot on the story word (night → warm in ~0.8 s on "sunrise"). Characters take the nearest lamp's colour; whole-head tints for emotion (red anger, blue cold). A time jump gets a 6-frame white flash or a 1.5 s sunset→night→day time-lapse.
- The twist line gets a sting (music stops, low hit, push-in with roll). The last shot's physical payoff lands on the final word.

### 4.3 World (`web/main.js`)
Keep the engine sections: toon materials, ink contract, `add`/`tbox`, sky, lights, cards, render targets/post, `applyLight`, `drawActors`, `swapForNd`, `renderFrame`. Replace the example world between `// ---------- world ----------` and `// ---------- cards ----------`, plus the story parts of `worldState()`.
- Build from primitives with painted canvas textures (`paint.js`: planks, beams, rotten wood, stone, moss/ivy, grass, dirt, plaster, roof tiles, marble, banners, carved text). Write new painters in the same flat-with-dark-seams style.
- Use `tbox` for constant texel density, a 2-step toon gradient, and fog = horizon colour.
- Background: hills (half-buried spheres), mountains (cones + snow caps), cypress/pine trees, distant houses, painted cloud billboards.
- Set pieces (collapses, falls, doors) are pivoted groups driven by 0..1 progress from `worldAt(f)`, with eased and staggered parts.
- Curved diegetic text uses planar UVs. Check it isn't mirrored.

### 4.4 Cast (`web/roman.js` → `web/toon.js`)
- `romanFront(p, outfitKey, opts)` draws on a 600x1000 design canvas with soles at y=975. The card is 2.25 m tall, so 1 unit = 0.00225 m.
- Add outfits to `OUTFITS` (tunic/cape/armor/helmet/hair/cap/beard/apron/dress/toga) and new headgear and props in the same style.
- Arm poses: hang, spear, point, up, wave, hip, belly, temple (+swirl), lift, reach (+lift), cheek, shield, cross, thumb.
- Expressions: the toon.ts FACE set plus snore, stubborn, squint. Extend FACE for more.
- Rebuild after edits with `cat web/toonbase.js web/roman.js > web/toon.js`. Render a character test sheet before using new designs.
- Billboards turn on yaw only, get a contact blob and an alpha-tested shadow, and are never inked by the world pass.
- Build card keys from `q()`-rounded values (so the canvas redraws only on visible change).
- A detached part (e.g. a lifted helmet) is its own card, aligned with `headCenter(seed)`: y = DECK + (partY − hc) × 0.00225.

### 4.5 Motion: smooth and alive (`web/motion.js`)
- **Cameras** (re-measured 2026-11-18 on 30 reference Shorts, every frame): `camFromKeys(keys, f, {kicks})`. The camera moves in ~94 % of frames. Rhythm = creep → punch → creep: holds push in ~0.5 %/f (smootherstep glides 18-45 f), and a fast 8-12 f reframe / punch-in / whip (`easeOut`, peak ~50 px/f at 720p, 3-5 %/f zoom) lands every ~2.2 s on a key word. `path` via-points (Catmull-Rom) for curved moves. Nothing static for 4+ frames. 10-15° dutch rolls on drama and falls, 7-frame flip-shakes on impacts.
- **Joints**: ~1 dissolve of 6-12 f every ~6 s, also inside one place at a sentence change, wherever no motivated move exists. 0-3 hard cuts. Motivated transitions: follow an object into the next moment, push through a hole (pupil, spyglass, door, window), crane up to an aerial and descend into the next place, a foreground object wiping the lens, match-dissolve on a held object, pull back from a close-up into the wide.
- **Ending**: hold the ironic last image ~1-1.5 s with a slow push.
- **Characters never freeze**: apply `idle(f, seed)` to every card, `blinkAt` blinks, and head bobs on stressed words. Faces act: swap expressions every 0.3-1 s on beat words (brows, O-O shock, >< pain, teeth, sweat drops, anger ticks). Heads near-round, characters 3-3.5 heads tall, outline thicker than the world ink.
- **Actions**: anticipation → `back` overshoot → `spring` settle. A stamp is a 2-frame dip + dust puff + kick. Laughs are an alternating tilt + bob.
- **Secondary motion**: banner cloth waves, leaves/dust/drips/Zzz effect cards, flowing water. Something always moves.
- **Walks**: `walk()` gives distance + step phase. Feet planted, bob 3-7 %.
- **Lens**: DOF on close-ups and mediums (cInf 8-14 px), focus on the eyes. Wides are sharp. Racks take ~14 f.

### 4.6 Look check (before the full render)
Render stills at each shot's middle plus the transitions and key actions: `node render.mjs stills/a "5,40,..."` then `python3 sheet.py stills/a stills/sheet_a.jpg`. Look at the sheet next to 1-2 reference frames (`../cartoon-3d-short/references/frames/`, private study only) and run the "looks cheap" check: ink on ~3/4 of world edges (not wiped by the blur), saturated colour with long blue shadows and no pure black, painted grain with dark plank gaps, visible background blur, characters ~3.5 heads tall with thin limbs, glides not snaps. Then fix these traps:
- **Narrow vertical frame**: horizontal half-width = d·tan(hfov/2), with hfov = 2·atan(tan(vfov/2)·0.5625). At 4 m and fov 40 that is ±0.8 m, so stage characters in depth.
- Railings or posts across faces (camera inside the rail or ~2.5 m up). The camera path through houses, roofs or bushes. Foreground props under ~2 m away. The hero hidden behind a pillar.
- Mirrored text. A detached-part card offset the wrong way.
- Extrude material groups: 0 = caps, 1 = sides+top.
- Missing ink: debug the edge-only output. Ink radius ~2.5 px at 1080. The sky counts as far depth, not a card.
Send the sheet to the user with a one-line shot summary, then start the full render.

### 4.7 Sound (`audio.py` → stems → `mix.py`)
Rewrite the cue table for the story; the synths stay. `audio.py` writes only stems (`music.wav`, `sfx.wav`).
- Music: make the bed with `python3 mystery_bed.py --dur <voice length> --twist <twist line s> --out music.wav` (it replaces the music part of `audio.py`; keep `audio.py` for the SFX stem). It composes an original playful-mystery cue in the reference channel's style: minor key, 100-118 bpm (default 112, D minor), staccato pizzicato walking bass, plucked/mallet melody up high, soft off-beat chord stabs, light kick, dark and continuous, with a hit on frame 0, a lift after the twist and a hit on the last word. Change `--key`/`--bpm`/`--seed` per story so videos don't share one tune.
- SFX on events (in frames/30): whooshes on big moves, thunk on stamps, rumble+crash on collapses, scrape on metal, ting on reveals, sting on the twist, creaks, snap, splash, snore, leaves, water ambience.
- Mix with `python3 mix.py voice.mp3 music.wav sfx.wav`. It sets music to the voice's gated RMS −21 dB and one SFX gain so the median hit sits −12 dB under the voice (loudest ≥ 5 dB under). It prints the measured levels: confirm music shows −21.0 dB vs voice and the SFX median hit −12.0. Aim for ~11 SFX hits a minute (reference 2.5-21).
- Lock picture timing before making sound. Any timing change means re-running audio.py and mix.py.

### 4.8 Render + finish
- Run `node render.mjs frames "0-<N-1>"` with Bash `run_in_background`, watched by a Monitor loop that reports progress and catches errors or process exit. `RESUME=1` continues after an interruption. Don't run heavy Python at the same time on small machines.
- Run `bash finish.sh "Title"`. It applies one linear gain to about −14 LUFS plus a −1 dBFS peak limiter, encodes H.264 CRF 17 + AAC, runs freeze/black and loudness QA, and writes `out/qa_sheet.jpg`. Look at the sheet. Frozen spans ≥0.4 s or black frames need a fix.
- Deliver the MP4 with SendUserFile and a few lines on what each shot shows. Offer captions, tweaks, or the next idea from the list.

## Engine gotchas (kept in the kit; keep them if rebuilding)
- `#include <fog_vertex>` / `<fog_fragment>` go on their own lines.
- The final pass writes `linearToOutputTexel(...)` (render targets are linear HalfFloat).
- The normal+depth pass swaps materials per mesh: world → normal/depth, cards → alpha-tested mask (rgb 0, a = depth), blobs/clouds/sky hidden, water → flat normal. Fog and shadows are off during it.
- Ink goes on the near side of depth jumps only. Creases come from the normal dot. Card neighbours are skipped. Ink fades at ~140-520 m.
- DOF: 48 taps with a per-sample CoC test (no foreground bleed).
- The sun comes from az/el per light preset. The shadow camera is centred on each shot's action.

## Architecture (reference for editing the kit)
- `web/index.html` loads `main.js` (ES module) over a local HTTP server.
- `main.js`: renderer, toon materials, world, cards (1200x2000 CanvasTexture planes, origin at soles), passes colour (RT samples 4) → normal/depth → ink+grade (saturation, gain/lift, vignette, flash) → DOF to screen. It exposes `window.renderFrame(f)` and `window.ready`.
- `story.js` exports SHOTS, `shotAt`, `camAt`, `dofAt`, LIGHTS/`lightFor`, `worldAt`, `actorsAt(f, T)`, `fxAt(f, T)`. All are pure functions of the frame.
- `render.mjs`: Playwright → `renderFrame(f)` → `toDataURL('image/jpeg', .95)` → `frames/f0000.jpg`.
- `mystery_bed.py`: original music bed in the reference style. `mix.py`: level lock (music −21 dB gated RMS, SFX median hit −12 dB, loudest ≥ 5 dB under the voice). `finish.sh`: linear loudness gain, limiter, encode, QA.
- Characters: the Pen API from mromidev/claude-animated-shorts `templates/bridge/toon.ts`, extended in the same module scope by the cast file.