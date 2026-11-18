---
name: 3d-short
description: Same pipeline as cartoon-3d-short (45-65 s vertical story short, 2D bean-head cards in a colourful 3D world, three.js inside Remotion, default clone_3_voicebox-qwen3 voice), but it STARTS by researching 10 fact-checked story ideas (facts, verdict, sources; no hooks or scripts) to pick from by number, then runs straight through to the video. Use when the user types /3d-short or asks for "3d short" ideas or video.
---

# 3D short: 10 researched stories → script → voice → three.js + Remotion video

A copy of `cartoon-3d-short` with one extra stage at the start: **Stage 0, 10 researched story ideas**. Everything after the user picks a story is the same pipeline below.

## Stage 0: Research 10 stories (always first)
Stage 0 is research and fact-checking only. Do NOT write hooks, twists, scripts or "why it animates well" pitches here: the pipeline writes the hook, script and twist in step 2.
- **The user already gave a topic or script:** skip the research list and go to Pipeline step 1 with it.
- **Nothing given (just "/3d-short"):** research, then reply with exactly 10 stories, numbered, and ask the user to reply with a number (or "more"). Each story gets:
  - **Title:** a plain label (e.g. "Stirling Castle and the Warwolf, 1304").
  - **What happened:** 2-3 sentences of verified facts (who, when, where, the physical cause and effect).
  - **Verdict:** Documented, Disputed or Legend, plus one line on which details are solid and which are colourful or contested.
  - **Sources:** 2+ links right under the story. Prefer museums, universities, peer-reviewed papers, encyclopaedias and primary records over listicles.
- What makes a story right for this format:
  - One surprising true story with a physical cause and effect you can show. Enough story for 55-70 s (~220 words).
  - A setting that can be built from the 3D kit plus cartoon cards: towns, bridges, ships, castles, deserts, labs, palaces.
  - Mix the 10 across eras and themes: ancient, medieval, 1800s, modern, science, animals, inventions, disasters, weird laws, lucky accidents.
  - Never reuse a story the reference channel already made.
- Fact-check every story with web searches before offering it. Don't present a viral legend as fact; mark it Legend.
- No real living people as the butt of a joke, nothing graphic, nothing political.
- **After the pick, don't stop again.** Run straight through Pipeline step 1 (facts), step 2 (script: show it, but don't wait for an OK), step 3 (voice) and on to the render. Never ask the user to record or upload a voiceover: the default narrator voices it automatically. Only stop if the user interrupts with edits or a step fails.

# Cartoon 3D story short (three.js + Remotion)

Proven example: **The Bridge That Fell for a Song**. It is an original 67 s short about the 1831 Broughton bridge and 74 soldiers marching in step.
- Code: `src/videos/bridge/` of your Remotion project (composition `BridgeShort`, 1080x1920, 30 fps).
- Script, voice and sound: `~/bridge-short/`.
- Style research: `references/`.

The style reference is a channel studied privately (`references/`: **STUDY_2026-11-18.md** (30 latest Shorts, every frame: camera, cuts, characters, light, script, narration, audio levels; it wins wherever older notes disagree), STYLE_BIBLE.md, reports/*.md, frames/).
- Those videos are private study material. Never upload, publish or send them.
- Never copy their scripts, characters or shots. Story, characters and voice are always OUR OWN.
- Never say the channel's name in a voice-over or description.

User rules that apply:
- No captions or labels in the video.
- English only.
- Voice: one steady tone. Default voice: clone_3_voicebox-qwen3 (step 3).
- Jokes are researched real facts.
- Standard mix (since 2026-11-18, measured on the reference channel's 30 latest Shorts): the narrator is clearly on top. Music bed **21 dB under the voice**, never ducked; SFX hits a median **12 dB under the voice**, loudest ~5 dB under (`mix.py` `BED_LU`, `sfx_level_lock`); master -14 LUFS. Voice unchanged. (Replaces the 2026-11-16 "bed 16 LU, SFX -6 dB" rule: SFX were nearly as loud as the voice.)
- Final export 2K vertical: 1440x2560, `--scale 1.3333`.
- Opus max verifies every check.
- Save after every step.
- "Just do it" once the user picks a story: no further stops, and never ask for a voiceover (the default narrator does it).

## Pipeline
1. **Topic and facts.** Pick one surprising true story with a physical cause and effect (it should be visual), plus a simple everyday analogy that explains it.
   - Write the facts with their source at the top of `SCRIPT.md`.
   - Fact-check every detail before writing a word: date, counts, sizes, depths. The checked numbers often become the best joke (the bridge's river was only 2 ft deep → "Luckily... / Unluckily...").
   - Make sure the reference channel hasn't already told this story (search its titles/transcripts). If it has, drop it and pick another (the first bridge-short topic was dropped this way).
2. **Script** (50-65 s ≈ 185-235 words at the reference pace of ~3.7 words/s; ~15 sentences, median 13 words). Structure measured on the reference's 30 latest transcripts (`references/STUDY_2026-11-18.md` §3):
   - **Hook = the result first, as an insane-sounding act, past tense, ~14 words:** "[Someone] did [baffling thing], but [twist clause]." Alternatives: "If you [normal act], [absurd result].", "[X] is illegal/impossible, yet …", "Imagine you're …". Never a date, setup or question first.
   - **"You see," + context** in sentence 2 (the stakes, place, who doubts it), then **switch to present tense** for the story.
   - **Chain every sentence as a consequence or reversal:** start them with "So" (the reference's #1 opener), "But", "Then,", "Eventually,", "Soon,", "The next morning,". Escalate with ladders of odd, specific numbers or times ("In May… By July… On the hottest day…").
   - **Doubters:** 1-3 short quoted lines from a boss / crowd / buddy, no "he said": the funniest lines, proven wrong by the end.
   - **1-2 exaggeration jokes** (claim → absurd comparison) and dry narrator asides ("Big mistake." / "So he does what any sane person would do.").
   - **Mystery beat** right before the reveal: one short question ("So how does this keep happening?") answered "Well, it's called [name]."
   - **Withheld climax (strongest pattern):** build to the brink → "You see," + the explanation through one everyday analogy (2-4 sentences, never a lecture) → resolve the climax in the LAST sentence.
   - **Ending:** an ironic image or a callback to an early detail on the last word. No moral, no CTA, no coda.
   - "Luckily … / Unluckily …" stays available as a deadpan double line (bridge short), not a required beat.
   - Never describe on screen what the viewer already sees. Two modes: third-person story (~70 %) or "Imagine you're…" second-person explainer (~30 %, can run 35-45 s).
   - Delivery is relentless: ~3.7 words/s, first word at frame 0, sentence gaps ~0.22 s, no pause over ~0.5 s. The video ends ~0.3 s after the last word.
   - Show the script in a copyable block with its word count and estimated length, plus a one-paragraph shot plan, then go straight on to step 3 (no approval stop; the user can still interrupt with edits).
3. **Voice.** Default narrator: **clone_3_voicebox-qwen3** (Qwen3-TTS voice clone, free, local; settings in `../default-voice/SKILL.md`). Never ask the user for a voiceover. Save the script as plain text, then run
   `py templates/scripts/fenrir_voice.py SCRIPT.txt ~/<name>-short/voice/` → `voice.wav` + `words.json` ([{w, s, e}], word times from faster-whisper).
   - Defaults (since 2026-11-18) = the reference pace: `--tempo 1.12 --gap 0.22` (the wrapper adds them unless you pass your own; `--tempo 1.0 --gap 0.4` = the old relaxed read). One paragraph per line in SCRIPT.txt (each line is voiced in one go); a new line = a ~0.22 s breath, so break lines before "So / But / Then / Well / Eventually", never mid-phrase. The printed words/s undercounts numbers (Whisper writes "74", not "seventy-four").
   - Storytelling (measured on the reference narrator, STUDY §2): casual and animated (17-semitone range), statements end level (never trailing off), rhetorical questions end LOW and quick, dialogue lines read in the narrator's own voice with attitude (sarcasm, panic, deadpan), reveal sentences a touch slower, lists and dialogue faster.
   - Write it the way you'd tell a friend: contractions, "You see,", `...` only before the 1-2 biggest reveals, `!` on the punch word, numbers as words.
   - Only use another voice if the user asks (a recorded `voice.wav` + any speech-to-text with word times; Kokoro is no longer the default).
   - Put them in the project folder, e.g. `~/bridge-short/voice/`.
   - Then `python3 templates/scripts/fix_words.py ~/<name>-short/voice/` (fixes Whisper's smeared times at every chunk start, early or late; keeps `words.raw.json`) and `python3 templates/scripts/voice_check.py SCRIPT.txt ~/<name>-short/voice/` (transcript vs script word accuracy, pitch range per line: flat < 2 semitones is flagged). Both must pass before the picture is timed. Everything is timed to words.json. In the cloud, generate the voice while you build the world (it runs ~10-20 min on CPU).
4. **Shot plan** in `story.ts`: copy `templates/bridge/` (the final bridge source, same as `src/videos/bridge/` of your Remotion project) to `src/videos/<name>/`, register a new composition next to `BridgeShort` in `src/Root.tsx`, and rename it.
   - `SHOTS`: id, a/b frames, light day/golden/night (add the `night` preset for the "You see," explanation, see Light arc), crowd mode, `tau` story time.
   - `XFADE`: crossfades at place/time changes.
   - `FLASH_AT`: a white flash after the hook.
   - `CAMS`: per-shot keys `{f, dur?, cut?, s: f => {pos, look, fov, roll}}`.
   - `KICKS`: impact flip-shakes.
   - `DOF`/`dofAt`: lens blur per beat.
   - `FOREGROUND`: near framing props.
   - Every visual reaction lands 0-3 frames before its word.
5. **World.**
   - `lights.ts`: LIGHTS plus the LOOK sky/river/cloud palette per light.
   - `shade.ts`: two-tone shading and `untone()`.
   - `build.ts`: town, houses and Kenney CC0 kit props, recoloured, with sight-line culling of anything blocking a camera.
   - `paint.ts`: HD Canvas2D painted textures with seams painted in as dark tints.
   - `world.ts`: sky shader, fog = horizon colour, river, per-frame posing, sun frozen per shot and camera-relative.
6. **Characters.**
   - `toon.ts`: the Canvas2D `Pen` drawing API, 600x1000 design canvas, soles at y = 975, bean heads, stick limbs, plum variable-width outline, face library.
   - `cast.ts`: camera-facing billboards, crowds, effect cards, blinks, walk cycles. All billboards go on the `NOINK` layer.
   - `cardshade.ts`: cards lit by the scene light, no emissive.
7. **Post** (`Bridge.tsx` + `ink.ts` + `lensblur.ts` + `grade.ts`).
   - Composer order: ink → lens pre → lens main → bloom → NEUTRAL tone map → grade (MSAA 4).
   - Every pixel parameter scales with output height / 1920.
8. **Sound** (`~/bridge-short/audio/`: timeline.py, sfx_gen.py, sfx.py, music.py, instruments.py, dsp.py, mix.py).
   - Event table → synthesized SFX plus the music bed.
   - Music bed (default): `python templates/audio/mystery_bed.py --dur <voice length> --twist <twist line s> --out audio/music_bed.wav`.
     It composes an original playful-mystery cue in the reference channel's style: minor key, 100-118 bpm (default 112, D minor),
     staccato pizzicato walking bass, plucked/mallet melody up high, soft off-beat chord stabs, light kick; dark (almost nothing
     above 4 kHz), continuous, with a hit on frame 0, a lift after the twist and a hit on the last word. Change `--key`/`--bpm`/`--seed`
     per story so videos don't share one tune. When `audio/music_bed.wav` exists, `mix.py` uses it at BED_LU (-21) with no ducking
     and skips `music.py`. `music.py` (the bridge march) stays as the example of a story-locked score, only when the user asks for one.
   - Output: mix.wav (48 kHz, exact length), stems and cues.md.
   - Lock the picture's time constants before the sound is made. Any later timing change means re-running the sound.
9. **Look checks.** In the cloud (no GPU) use the kit loop in `tools/remotion-3d/README.md`: `bash scripts/check.sh <name>` (must print OK), `node scripts/sheet.mjs <Comp> 15` (one-pass draft sheets, ~2 min) + `python3 scripts/lightcheck.py`; the verifier gets the draft sheets. With a GPU (PC) the old stills script still works: `node scripts/bridge-stills.mjs out/<name>/x_ 100,400 0.5`.
   - Set `BRIDGE_ENTRY=src/sandboxes/<n>/index.tsx` to render a sandbox copy.
   - Make side-by-sides against reference frames with `python scripts/sbs_sheet.py out.jpg --ours ... --ref ...`.
   - Send them to an Opus max verifier: 1-3 images, a ≤200-word verdict.
10. **Final render.**
    - **Default for every 3D short: coldframe** (parallel GitHub render, PC or cloud). First `node scripts/boundary.mjs <Comp>` (every shot change / crossfade in the browser, ~12 min). Then commit and push `tools/remotion-3d` to `gmacc616/yt-automation-vault` `main` (with `public/` and the composition registered in `src/Root.tsx`: coldframe renders what is pushed, not local edits) and run `npx github:Razee4315/coldframe#da55531509d27399c70846df3e4e5793f922abf3 render <Comp> --repo gmacc616/yt-automation-vault --chunks 20`. It splits the render over 20 GitHub machines (1440x2560, crf 16, software WebGL, frame count checked), ~20-35 min, and downloads the silent MP4 to `out/cloud/` (`--no-wait` only starts it; `coldframe download` fetches it later). Mux: `ffmpeg -i out/cloud/<file>.mp4 -i <mix.wav> -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart <final.mp4>`. Details: `tools/remotion-3d/README.md`.
    - Fallback only when coldframe fails (Actions down, a chunk still failing after its retries); tell the user before switching. Cloud: `setsid nohup bash scripts/render.sh <Comp> &` (resumable 100-frame chunks, ~6-9 s/frame, a 67 s short ~3.5-5 h) then `bash scripts/deliver.sh <Comp> <mix.wav> <out.mp4>`. PC: `npx remotion render src/index.ts <Comp> out/<name>/video.mp4 --codec h264 --crf 16 --scale 1.3333`.
    - Mux with `-map 0:v:0 -map 1:a:0` (Remotion writes a silent audio track).
    - QA: `python scripts/short_qa.py final.mp4 out/<name>/qa shots.json` checks every frame for black, white, frozen and pop frames, plus loudness and sheets.
    - Fix anything it finds, then run a deep Opus audit.
11. **Deliver.** SendUserFile the final mp4, update memory, write notes, refresh the vault graph (`/graphify "<vault>/Claude" --update --obsidian --obsidian-dir "<vault>/Graphs/vault-notes"`).

## Final look values (bridge after 4 verifier rounds; all in `templates/bridge/`)
Start every new short from `templates/bridge/` (copy to `src/videos/<name>/`): the look lives in these values, the
story lives in story.ts / build.ts layout / cast.ts roles. Opus max scores at the end: colour day 7, golden 5-6,
lighting 5-6, ink 6, textures 5-6, characters 7, depth 6-7, composition 6-7 (from 5/3/4/5/4/7/4/6 at the start).
- **Light presets** (`lights.ts`, sun camera-relative and frozen per shot):
  - day: az 75 / el 48, lit [1.58,1.5,1.33], shade [.30,.29,.36], lift [.05,.06,.11] (cool tint ONLY in shade), sky
    top #3e7fd2 → horizon #b8d0ec, fog = horizon, 25→300 m, uSat 1.08, ~15 % blue haze past 60 m.
  - golden: az 6 / el 7 (backlit low sun), key toward #FFB36B ×1.5, violet-blue shade (facade ≈ #444380), sky
    #ffc47c → #8a6f8a, peach fog only past 50 m, sun disc #ffcf9e + bloom, contact blobs + real card shadows.
- **Albedos** (`paint.ts`/`build.ts`): muted brick / cream / ochre / terracotta houses with plinth, cornice, sills,
  hoods, door step, chimney + pot, heights 7 / 8.4 / 9.8 m; warm grey/beige stone (saturation −35 % from "storybook");
  ochre wood deck C* ~51-58 with near-black seams; iron dark and desaturated. Never lemon, never lavender lit faces.
- **Ink** (`ink.ts`): #030303, 5.1 px near (6 m) → 3.3 px far (90 m) at 1080x1920, creases ×0.8 from 35°, depth
  jumps from 1 %, fog tint 0.3 only far; character cards on layer `NOINK` (they carry their own plum ink).
- **Lens** (`lensblur.ts` + `dofAt` in story.ts): cInf px at 1080: hook/river CU 15-16, close-ups 12-14, MS 10-12,
  park 7, golden sway 5, wides/aerials 0. Focus on the eyes of the front row.
- **Post** (`Bridge.tsx`): ink → lens pre → lens main → bloom (thr 1.0, int .5, 6 levels, radius .6) → NEUTRAL tone
  map → grade; MSAA 4. Film grain exists but is OFF (reference measures no grain; it quadruples the file size).
- **Characters** (`toon.ts`/`cast.ts`/`cardshade.ts`): bean heads h/w .94, plum ink #241726, eyes .26 W apart, no blush,
  14 expressions; adults 3.5 head-heights; walk bob 5 %, lean 1-7°, planted 0.8 m stride; blinks 0.5-2.3 s; tight
  contact shadow ~.5 under the feet + sun-direction tail by day; golden rim inner only (never an offset outer copy).
- **Light arc** (story beats; STUDY §7): day while setting up (median luma ~.50, not brighter), a saturated royal-blue **night / storm / crisis stretch mid-story** (luma .22-.30, 9 of 10 references have one; the "You see," explanation can live there), and a return to **sunrise/golden for the payoff** (half the references end golden). Light changes inside a shot on the story word (night → warm in ~0.8 s on "sunrise"; a 1.5 s sunset→night→day time-lapse for "a week later"). Characters take the colour of the nearest practical lamp; whole-head tints for emotion (red anger, blue cold, green disgust). The template only has `day` and `golden`; add a `night` preset to `LIGHTS`/`LOOK` when needed: blue ambient, warm windows/lamps as the key, violet fog #877aea, purple (never brown) shadows, faces still bright (V ~.97). Numbers: `references/reports/lighting.md` (night rows) and `grade.md`.
- **Camera** (`story.ts`, updated 2026-11-18, see Look targets): a new framing every 1.5-2.5 s; creep → punch → creep (a fast 8-12 f reframe/punch every ~2.2 s); ~9 `XFADE` dissolves of 6-12 f per short (also inside one place, at sentence changes); 0-3 hard cuts; motivated transitions (follow an object, push through a hole, crane up and descend, foreground wipe, match-dissolve on a held object);
  flip kicks decaying over 7 f on impacts, 10-15° dutch rolls on drama/falls, foreground props (`FOREGROUND`) in ~1/3 of shots, 6-10 prop-insert ECUs per short.

## Look targets (measured from the reference; see references/reports/)
- **Ink:**
  - World lines: about 3 px at 1080 wide, near-black #0b0a0c, nearly constant with distance. Silhouettes, depth jumps and normal creases only. No line on wall/floor joins or the horizon. Character cards are never outlined by the world ink.
  - Character ink: dark plum #201628-#2f1d28, thicker on the bottom/shadow side.
- **Colour:**
  - Day median luma ~.50 (reference .45 overall incl. its night stretches; the old .57 was too bright). Non-ink p5 ~.23 (no crushed blacks). Lit chroma C* p90 ~55. Day sky top ~#5e93d9, horizon 1.28x brighter.
  - Golden: peach horizon #ffd08a, violet-blue shadows (never brown), backlit sun.
- **Depth:**
  - DOF on about 1/3 of screen time (CU, MS, inserts), cInf 10-16 px at 1080, focus on the eyes. Establishing and wide shots stay sharp.
  - Fog = horizon colour, 25→420 m day, 20→360 m golden.
  - Bloom only on HDR emissives: threshold 1.0.
- **Camera:**
  - (Re-measured 2026-11-18 on 30 Shorts, every frame; replaces the 20-Short numbers.) The camera moves in ~94 % of frames; still in only ~6 % of half-second windows.
  - Push-ins 57 % of the time at a median 0.5 %/f (p75 1.3, p90 3.0 = punches); pull-outs 28 % (median 0.64 %/f); pans median 5.7 px/f at 720p.
  - Rhythm creep → punch → creep: a fast reframe / punch-in / whip of 8-12 f every ~2.2 s, peak ~50 px/f at 720p and 3-5 %/f zoom (push-throughs up to 12-18 %/f). The old "peak ≤ 25 px/f" cap is lifted. Explainers punch far more often than slow narratives.
  - A new framing every 1.5-2.5 s; per sentence rotate wide → medium two-shot → close-up on the punch word → prop insert ECU (6-10 per short). Low, chest-to-floor cameras, wide lenses, top-down inserts and aerials.
  - Joints: ~9 dissolves of 6-12 f per short (4-19 in the reference), used inside one location too whenever no motivated move exists; 0-3 hard cuts (bursts around explosions/glitches); motivated transitions: follow an object, push through a hole (pupil, spyglass, door, window, furnace, held photo, optional 1-f white flash), crane up to aerial/map and descend, a foreground object wiping the lens, match-dissolve on a held object, pull out of a screen.
  - Dutch rolls of 10-15° on drama and falls (up to ~25° held).
  - The ending holds the ironic last image ~1-1.5 s with a slow push.
  - No hand-held float. Impact shakes flip sign every frame and decay over 7 f.
- **Characters:**
  - 3-3.5 head-heights tall, no neck, capsule torso ~1.2 HH about as wide as the head, legs ~1.5 HH (re-measured 2026-11-18).
  - Stick limbs about 0.055 of head width, ink-dot hands.
  - Near-round head (h/w ~0.95-1.0; the old 0.93 bean was too narrow). In close-ups the head fills 70-100 % of the frame width.
  - Outline 6-14 px at 1080 (2-4x the world ink), thicker on the shadow side.
  - Faces act: expression swaps every 0.3-1 s on beat words, heavy brows, O-O shock / >< pain eyes, teeth, sweat drops, tears, anger ticks; blush allowed. No eye highlights. Faces at brightness ~.93.
  - 1-2 characters in ~80 % of shots; crowds of 20-40 copies for scale/payoff beats.
  - Walk bob 3-7 %, lean 1-7°, planted feet.
  - Blinks every 0.5-2.3 s, lasting 4 f.

## Look-match loop (how the bridge look was reached; reuse for any "make it look like X" pass)
1. **Measure the reference first.** One analysis agent per topic (motion, depth, textures, characters, lighting, outlines, grade), each writing numbers, not adjectives, to `references/reports/<topic>.md`. Shared brief: `compare/CONTEXT.md`. Reports are the source of truth for every agent after.
   - Make it measure, don't ask for opinions: contact sheets (2 s = 60 frames per sheet), phase correlation for camera motion, cut flags, per-shot brightness/contrast/saturation. You can recreate a number, not an opinion.
   - Check the tool before trusting it: frame-to-frame phase correlation misses very slow push-ins, so confirm any "still" verdict over a longer gap (frame f vs f+30). Re-measure your own earlier notes too: the agents found that "their heads are egg-shaped" and "camera still 80 %" were both wrong.
2. **Sandboxes, one owner per file.** Copy the project folder to `src/videos/<name>_{cam,world,mat,char,post}` with entries `src/sandboxes/<n>/index.tsx` (same `index.tsx` as main, only the import path changed). Ownership used for the bridge:
   - cam: story.ts (camera keys, cuts, kicks, DOF table, foreground props)
   - world: world.ts, lights.ts, shade.ts, grade.ts (sun, sky, fog, river, colour, grade)
   - mat: paint.ts, build.ts (painted textures, buildings, props)
   - char: toon.ts, cast.ts, cardshade.ts (character drawing, posing, card lighting, fx cards)
   - post: ink.ts, Bridge.tsx, lensblur.ts (outline pass, composer, lens blur, bloom)
   Agents only edit their own files in their own sandbox and render stills with `BRIDGE_ENTRY=src/sandboxes/<n>/index.tsx node scripts/bridge-stills.mjs out/<name>/<n>/x_ <frames> 0.5`.
3. **Merge** with `python scripts/bridge_merge.py [cam,world,mat,char,post]` (backs main up to `backup/bridge_<time>/`, copies owned files only). Then `npx tsc --noEmit` (filter to the project folder), then **re-sync every sandbox from main** (`cp -f src/videos/<name>/* src/videos/<name>_<n>/`) before the next round.
4. **Verify** with a fresh Opus max agent: side-by-side sheets (`python scripts/sbs_sheet.py out.jpg --ours a b --ref r1 r2`), score each area out of 10 (colour day / golden, lighting, ink, textures, characters, depth, composition) plus a numbered fix list with frame numbers. Map each fix to the file owner and resume that owner's agent with SendMessage (keeps its context). Bridge scores: round 1 5/3/4/5/4/7/4/6 → round 2 5/4/5/6/4/7/6/6 → round 3 see notes.
5. Contracts between owners live in exported constants (e.g. `NOINK` layer from ink.ts, `dofAt`/`FOREGROUND` from story.ts, `LIGHTS`/`LOOK` from lights.ts). Changing a contract means telling every owner that reads it.

## "Looks cheap" checklist (what made our first bridge frames look dull next to the original)
Put one of our frames next to an original before any full render and check each line:
- Ink on ~3/4 of the world's edges. Ours had zero because the blur ran in the same pass and wiped the ink (ink must be its own pass first).
- Bold saturated colour, long blue shadows, deep darks but no pure black; sunset shadows purple, never brown. Ours were pastel and flat.
- Hand-painted wood and stone with visible grain and dark gaps between planks. Ours were plain.
- Visible background blur so the eye goes to the character. Ours was so weak it didn't show.
- Characters ~3.5 heads tall with thin stick limbs, lit by the scene. Ours were under 3 heads with limbs 5x too thick and looked like clip art pasted on top.
- Camera glides (~23 f) instead of snapping (3 f).

## Gotchas
- **Cloud / no GPU:** use the kit in `tools/remotion-3d/` (set up at session start by `cloud/3d-bootstrap.sh`; `/root/.3d-ready` when done). Its README has the loop and the hard rules: frameloop "never" with one draw per frame (the default loop redrew ~10x per frame: 25-45 s/frame), never MSAA 0 or FXAA (blank frames), never mount/unmount post passes per shot (switching the lens on mid-render over-blurred whole shots), stills via `renderFrames`, draft preset for look checks.
- **Staging rules (Vasa verifier rounds):** a heeling ship leans away from the quay and sails mid-river (masts swing over the land and the lenses otherwise); never put a lens on the line of the masts; pack crowds within the frame width (~1.1 m apart, 3-4 rows) or most of them fall outside a 9:16 frame; keep posts/props off the line between lens and subject; stage characters where the lens looks; mark scene-only shots `wide: true` (or `wideFrom`) so `check.sh` skips the subject test; front-light faces in golden crowd shots (sunAz ~150) or they go grey-violet.
- Kenney nature-kit materials are teal: recolour them by material name in build.ts.
- Cameras end up inside houses: the sight-line culler in build.ts/world.ts removes anything blocking any camera ray.
- Ink in the same merged effect pass as DOF gets overwritten. Ink must be its own pass before the blur.
- Pixel-sized post parameters must scale with resolution: stills are at 0.5, the final at 1.333. R3F clamps dpr to ≥ 1, so `--scale 0.5` stills still render a 1080x1920 buffer.
- **Disk:** every Remotion bundle copies `public/` (~1.3 GB) into `the temp folder\remotion-webpack-bundle-*` and never deletes it. 60+ GB filled the system drive during the bridge passes and a render died with ENOSPC. Always render with `export TEMP='<big drive>/remotion-tmp' TMP='<big drive>/remotion-tmp'` (bridge-stills.mjs sets it itself) and ask the user before deleting old bundle folders in the shared the temp folder (auto mode blocks the sweep). <big drive>/remotion-tmp fills too (~500 folders / 110 GB after the 4 bridge rounds): when a project is finished and nothing is rendering, delete its `remotion-webpack-bundle-*` and `puppeteer_dev_chrome_profile-*` folders there.
- In JS strings write `"<big drive>/remotion-tmp"`, never `"<big drive>\remotion-tmp"` (`\r` becomes a carriage return).
- Remotion writes a silent audio track: mux with `-map 0:v:0 -map 1:a:0`.
- Sub-agents can't write report files in this harness: ask them for a ≤150-word final message and save it yourself to `out/<name>/<n>/REPORT.md`.
- Scratch `.ts` files inside `out/` break `tsc`: name them `.txt`.
- 2K renders run ~4 fps (≈10 min for 67 s). Stills at 0.5 take 3-8 s each after a ~40 s bundle.
- Film grain at 2.5 % made the 2K file 910 MB instead of ~250 MB and will turn to mush on YouTube; the reference has none. Keep it off.

## Readability traps the verifier caught (check every new prop/shot for these)
- **A swing drawn as one rope that disappears behind the kid reads as a HANGING.** Always two ropes to a wide plank
  with the kid between them (`swingKid` in toon.ts), and a frame whose legs clear the arc (A-frame at each end).
- Props or flotsam closer than ~2 m to a lens become huge cut-off blobs at the frame edge. When a camera moves, re-check
  every prop near its new position (the river cameras moved into the floating hats).
- A foreground bush cut by the frame edge reads as a "green ball"; a foreground prop must be recognisable or gone.
- Flags: red + yellow star/diamond reads as Vietnam's. Use a period-correct flag (St George's cross for England 1831).
- Painted signs lit by a side sun go grey-blue and unreadable: give the sign face an unlit material.
- Golden rim light done as an offset outer copy turns every hat into a picture frame: inner rim only, head/torso only.
- Balcony/railing rails at chest height through characters: put the lens ~2.5 m up so rails cross legs, not torsos.
- Flat holds read as freezes in QA (frozen span ≥12 f): every hold needs a creeping push-in.
