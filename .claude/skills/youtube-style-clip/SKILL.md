---
name: youtube-style-clip
description: Edit a clipping-campaign Short (YouTube Shorts / TikTok / Reels, 9:16) end to end in the measured "hit clip" style learned from the top BOXABL campaign Shorts - a standalone mini-story (setup -> tension -> reveal) built on a stunt, celebrity or reaction moment, 10-35 s, top headline bar, one-word captions, hard cuts ~1/s, few SFX, even loud mix, punch-ins, one grade. It builds and renders with HyperFrames itself (built-in "ysc" preset + full HyperFrames toolset), so it does not need /hyperframes separately. Use when the user types /youtube-style-clip or names this skill for an edit job. Not applied by default; campaign briefs (/gab, BOXABL rules) override anything here they forbid.
---

# YouTube style clip (opt-in)

Use this skill **only** when the user types `/youtube-style-clip` or names it for a job. It decides **what to cut and how it should look and sound**, and **it edits the video end to end itself** with HyperFrames: the built-in `ysc` preset renders the whole look, and the full HyperFrames toolset (keyframes, registry effects, motion graphics, audio mixing) is available on top, always kept inside this style. No separate /hyperframes call is needed. Workspace: `C:\Users\manth\OneDrive\Desktop\AI-Video-Editor`.

## Build workflow (run this; it is HyperFrames under the hood)
Tools live in `tools/pipeline/`. Work in `jobs/ysc_<id>/`; the HyperFrames projects go in `videos/ysc-<id>/`; finished files go in `output/<campaign or source>/`. Run `bash tools/pipeline/preflight.sh` first.
1. **Source.** `py -m yt_dlp` up to 1080p into `downloads/` (or use the user's file).
2. **Transcribe.** `py tools/pipeline/transcribe_lowmem.py <src> jobs/ysc_<id>/t <base.en|small> [lang]`. Then `node tools/pipeline/score-moments.js t/transcript.json --min 8 --max 20` gives a shortlist. Pick per §1; stunts and reactions also need a visual scan (contact sheets), because they're often silent.
3. **Cut 10–17 s.** Segments in play order, cut with ffmpeg `trim`/`atrim` + `concat` into `clipNN/tight.mp4`. Check every boundary with `check-bounds.js`, and run `clean-check.py` if the brief bans cursing.
4. **Frame + grade.** Set or check every crop on frames of `clipNN/tight.mp4`, not the source: input seeking lands a fraction of a second off. Also check every frame for third-party logos, other big creators, alcohol and minors. Run `py tools/pipeline/track-faces.py clipNN --write` for the face crops. Then correct by eye: stunts need the object in frame, not the face. Build with `py tools/pipeline/reframe.py clipNN --grade ysc`. The output fills the whole 9:16 frame; never use the letterbox or "fit" mode in this style.
5. **Compose (HyperFrames).** `shorts.json` per clip:
   ```json
   {"clip01": {"title": "...", "style": "ysc",
     "headline": "COULD ELON'S HOUSE *SURVIVE* THIS?! 😳",
     "keyColor": "#ff2a2a", "yscColor": "#FFE135",
     "fixes": {}, "emphasis": [],
     "punch": [[3.2, 1.22]],
     "arrows": [{"t": 1.0, "d": 1.5, "x": 700, "y": 900, "rot": -20}, {"t": 6.0, "d": 1.5, "kind": "circle", "x": 540, "y": 980, "r": 150}],
     "flashes": [{"t": 9.1, "color": "#ffffff"}],
     "capShift": [[4.0, 6.5, 1250]],
     "callouts": [],
     "sfx": [{"t": 9.05, "name": "whoosh-short"}, {"t": 9.12, "name": "impact-bass-1"}]}}
   ```
   - **headline:** `*word*` gets the keyword colour (red by default, or `keyColor`). Text is uppercase, with the black bar fixed at the top (`barH`, default 300 px).
   - **Captions:** automatically one word at a time from the transcript, mid-frame and yellow. `emphasis` words go green (`yscAlt`). `fixes` corrects mishears or blanks hallucinated words.
   - **capShift `[[a, b, y]]`:** moves captions off a face for a time range.
   - **punch `[t, scale]`:** snap zooms (1.15–1.3) that reset at the next cut. A slow ~4% push-in runs on every shot automatically (`drift: false` turns it off).
   - **arrows:** an arrow has its tip at `x,y`; a circle has its centre at `x,y` with radius `r`. Coordinates are canvas pixels in 1080×1920.
   - **flashes:** 1–2 at most.
   - **sfx:** 6 at most, from the bundled library (`.agents/skills/media-use/audio/assets/sfx/manifest.json`).
   - **Music:** `clipNN/music_duck.wav` is required. Use the source's own bed or `compose_bed.py`, sidechain-ducked under the speech so the mix stays continuous (no silence).

   Build with `node tools/pipeline/build-shorts.js videos/ysc-<id> clip01 ...`, then `bash tools/pipeline/hf.sh check` and `snapshot` on each clip, and look at frame 1, a punch-in and the payoff frame.
6. **Render.** `bash tools/pipeline/render-shorts.sh videos/ysc-<id> "output/<folder>"`. It never overwrites, loudness-normalises to −14 LUFS, and names files after the title.
7. **QC (measured).** `bash tools/pipeline/ysc-qc.sh "output/<folder>/<file>.mp4"` checks length, size, cuts per second, LUFS, LRA and silences. Do the visual checklist in §9 from a frame sheet (`qc-sheet.sh`). Fix and re-render anything that fails.

### Beyond the preset: full HyperFrames editing, in this style
When a clip needs more than the preset (a two-shot stack, a celebrity cutaway card, a custom transition, a speed ramp, an animated callout), edit the generated `videos/ysc-<id>/clipNN/index.html` directly, using the HyperFrames domain skills:
- `/hyperframes-core` for structure, timing and tracks;
- `/hyperframes-keyframes` for zooms, camera moves and arrow motion;
- `/hyperframes-registry` to search for a flash, light-leak or glitch block before hand-building one;
- `/hyperframes-audio` for ducking or a submix;
- `/media-use` for grades, LUTs and SFX.

Keep every addition inside §3–§7:
- the bar stays fixed;
- one word on screen;
- at most 2 flashes and 6 SFX;
- one grade;
- no logo overlays over the action.

Re-run `hf.sh check` after any hand edit.

`reference.md` (next to this file) has the evidence behind every rule. It covers the 10 BOXABL Shorts that were studied, the measured numbers, links, and the platform rules. Read it when a rule's reason matters.

**Precedence:**
1. The campaign brief wins. Read it fresh each job.
2. This skill comes next. It overrides the 2-3 s cut cadence and the "SFX on frame 1" habit in the older retention playbook.
3. Everything else in the normal pipeline still applies: never overwrite, run QC, ask before publishing.

## 0. Before editing (2 minutes)
- **Read the brief.** Check:
  - Allowed footage sources.
  - Required tag or hashtags, and whether hashtags are banned in titles.
  - Whether logos, AI or text-to-speech voiceover, or music are allowed.
  - Audience-country and minimum-view rules.
  - Any "no third-party names" clause. If it exists, step 1's celebrity framing is out.
- **No AI voiceover by default.** Most campaigns ban "AI-generated videos". Narration only when the brief explicitly allows it.
- **Never use detection-evasion tricks.** No mirroring, pitch or speed shifts, or added noise. Being transformative comes from the headline, framing, cut choice, grade, and arrows/callouts.

**Effects:** pick sounds, transitions, overlays, camera moves and text animations from `docs/effects-catalog.md` (workspace): the user's prompt first, then the brief and house-style limits, then the catalog's best fit. Add its effect log (time, effect, source, why) to the report.

**Workflow:** follow the default process in `docs/editing-workflow.md` (workspace): input → reference study (if the user sends a reference) → story moments → effects per cut → edit → clip all that pass → render. This skill sets the look and limits.

## 1. Pick the moment (this matters most)
**Story first:** read §1 of `docs/clipping-playbook.md` (workspace) before choosing anything.
- Every clip must be a standalone mini-story: setup (cause) → tension → reveal (effect). It opens on something baffling or surprising and pays it off at the end.
- Run its 8-question standalone test on each pick, and again on the final file.
- Never build a clip from a line plus unrelated hype B-roll.

The kinds of moments that carry those stories, in order of proven strength:
1. **Stunt or "will it break?" moments.** For BOXABL: the crane car drop, cars stacked on the roof, workers smashing walls. These were 5 of the top 7 Shorts.
2. **Borrowed fame:** "Elon Musk's house", FaZe Rug's tour, an IShowSpeed reaction. These were 6 of the top 7. Use only if the brief allows names.
3. **A reveal or reaction** with a visible face.

**Avoid:** concept explainers (the Thermos idea got 77 views), spec or price recaps, and openings with a slow talking head.

## 2. Structure: 10-17 s for a single stunt, 15-35 s for a story (45 s max)
Cut all dead space. Length is whatever the story needs and no more.
| Time | Beat |
|---|---|
| 0.0 s | Already mid-action: a car in the air, a face mid-reaction. No title card, no logo, no still frame. |
| 0-3 s | The question is obvious ("can it survive this?"). |
| middle | Build up: 2-4 angles or reactions, plus one celebrity cutaway if allowed. |
| last 1-2 s | Payoff: the impact or reveal. End right on it so the loop back to the start is seamless. |

## 3. Layout (9:16, 1080x1920)
- **Headline bar:** solid black across the top (about the top 15-18%).
  - 1-2 lines of bold white sans-serif, uppercase or title case, 6 words or fewer.
  - One keyword in **red or yellow**, plus 1 emoji.
  - A question or challenge: "COULD ELON'S HOUSE SURVIVE THIS?! 😳", "NO WAY THEY DID THIS…💀".
  - It stays fixed for the whole video.
- **Footage:** fills everything below the bar, cropped to 9:16. No blurred side bands, no letterbox band.
- **Keep the bottom ~20% and the right edge clear** of key action and text (that's where the Shorts buttons sit).

## 4. Captions
- **One word at a time,** mid-frame (about 55-60% of the height), bold, with a black outline.
- **Colour:** yellow or green (white is acceptable).
- **Timing:** synced to the **original speech** (transcribe it). No sentences, no karaoke blocks.
- **Never cover a face's eyes or mouth.** Nudge the caption up or down per shot if needed.

## 5. Cuts, transitions, motion
- **Hard cuts at about 0.8-1.6 per second.** Faster isn't better: the 77-view Short ran at 1.8 per second.
- **At most 1-2 flash or light-leak transitions** (white or orange, about 3-5 frames), only for a big scene change (outside → inside) or the final impact. Never one on every cut.
- **Punch-in zooms** on reaction faces: the same shot jumps from wide to about 115-130%.
- **Keep the frame moving:** a slow push-in (about 3-5% per shot) on otherwise static shots. Frozen frames should be rare.
- **Optional:** a two-shot stack (cause on top, reaction below) for one beat.

## Transitions and transition SFX (user rule, 2026-11-07)
- **Main choices, in every edit:** CapCut's 20 popular transitions: Pull In, Pull Out, Camera Shake, Whirl, Zoom In, Zoom Out, Blur, Glitch, Flash, Spin, Slide, Rotate, Shake, Zoom Blur, Distortion, Cube, Swipe, Wipe, Split, Light Leak. Pick every transition from these first, also when motion graphics are involved (split-screen panels, explainers, montages, slideshows, overlay cards): each scene change between shots or graphics uses one of the 20, not another engine's or the registry's version of the same name. Use another transition only when none of the 20 fits. CapCut name -> preset: the "Main set" table at the top of `motion-graphics-library/EFFECTS_INDEX.md` (`CAPCUT20` in `mgl.js`, ai-video-editor workspace).
- **Transition SFX:** only the user's sfxv2 pack (`sound effects/sfxv2/` in ai-video-editor; master copy `sfxv2/` in the vault repo). The user's files come first; `generated/` holds synthesized fallbacks, currently unused. Each of the 20 has its sound, peak and volume in `CAPCUT20`, and every file is 1.5 s or shorter. `build-shorts.js` adds the sound automatically with the hit on the cut, so never add a second whoosh for the same cut (`"sfx": false` on a transition skips it, `"sfxVol"` sets its volume).
- **Any other engine** (a hand-built HyperFrames composition, Remotion, ffmpeg, OpenMontage): run `node motion-graphics-library/mgl.js --capcut20`, port the transition's motion exactly (same values, durations and eases), and place its sfxv2 sound with the peak on the cut at its volume.
- **Motion graphics keep their own small sounds** (typing ticks, pops, shimmers, rises). The sound on a scene change is the transition's sfxv2 sound; the builder drops a panel split's synthesized hit where a transition sound already lands.
- The skill's or command's own limits still apply: transition sounds count toward its SFX cap, and its cut style (e.g. hard cuts by default) decides how many transitions there are. Not for the cartoon/3D animation skills (cartoon-audio-short, cartoon-3d-short, 3d-short).

## 6. Graphics and look
- **One red arrow or circle** on the key object or famous face per shot that needs it. Pop it in; don't animate it around.
- **Celebrity cutaway** (1-2 s) with an arrow on the face, if the brief allows.
- **One consistent grade on every shot:** saturated, high contrast, slightly teal and punchy. Light sharpening.
- **No** big brand-logo overlays over the action (the 2K-view Short did this), no sticker spam, no stat cards.

## 7. Sound
- **One continuous bed,** loud and even. Target -14 LUFS integrated, with small loudness swings and no silence anywhere.
  - Original speech on top; music, if allowed, ducked under speech.
- **At most 3-6 SFX per video,** only on impacts and reveals: a boom or hit on the crash, a whoosh into the flash transition, a riser into the payoff. The low-view Shorts had 17-33 hits.
- **Sound starts at 0.0 s.** That means the speech or bed, not a stinger.

## 8. Packaging
- **Title:** a challenge or question with a curiosity gap plus 1-2 emojis, e.g. "Could Elon Musk's House SURVIVE This?! 😳".
  - Add the campaign tag (`@BOXABL`) only if the brief requires it.
  - Hashtags only if the brief allows them in titles.
- **Description:** 1-3 sentences naming who and what, for search.

## 9. QC before delivering (report pass/fail per line)
Measure the render. Don't eyeball it.
```bash
# all of these in one go: bash tools/pipeline/ysc-qc.sh out.mp4
# cuts per second (scene changes); count lines, divide by duration
ffmpeg -i out.mp4 -vf "select='gt(scene,0.3)',showinfo" -an -f null - 2>&1 | grep -c pts_time
# integrated loudness + loudness range
ffmpeg -i out.mp4 -af ebur128 -f null - 2>&1 | grep -E "I:|LRA:" | tail -2
# silences longer than 0.3 s
ffmpeg -i out.mp4 -af silencedetect=n=-40dB:d=0.3 -f null - 2>&1 | grep -c silence_start
```
- [ ] Length: 10-17 s for a stunt, 15-35 s for a story (45 s at most). ysc-qc.sh flags anything over 17 s; that is fine for a story clip
- [ ] Standalone test (docs/clipping-playbook.md §1) passes on the final file: a cold viewer gets the setup, the cause of every reaction is shown, and it ends on the reveal
- [ ] Frame 1 is mid-action; no title card or logo
- [ ] Headline bar: 6 words or fewer, one red/yellow keyword, fixed
- [ ] Captions one word, synced to speech, not on eyes or mouth, outside the bottom 20%
- [ ] Hard cuts 0.8-1.6 per second; at most 2 flash transitions
- [ ] Punch-ins present; one grade across all shots
- [ ] SFX count 6 or fewer, each on an impact or reveal
- [ ] About -14 LUFS, LRA small (aim for 7 or less), 0 silences
- [ ] Ends on the payoff and loops cleanly
- [ ] Every brief rule met (sources, tags, no banned AI/TTS/logos/names)

## 10. Learn from results
After posting, when the user asks for analytics (never automatically), compare stayed-to-watch % and average view duration against the baseline in memory (`boxabl-winning-pattern`, `analytics-first-viral-format`). Change **one** variable per new clip, e.g. 12 s vs 25 s, or ~4 SFX vs ~20. Add confirmed findings to `reference.md`.
