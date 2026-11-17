# Default editing workflow (every editing job)

The standard process behind every editing skill: /boxabl, /gab, /youtube-style-clip, /viral-shorts, /puregrit and
/commentary-short. It also applies when the user just sends a link (with or without a reference video) and asks for clips.
- **The active skill sets the look and rules.** Its style, brief and limits fill in the details below and override this file where they differ: its own paths, output folder, narration rules and QC.
- **This file sets the steps:** input → reference study → story moments → effects per cut → edit → clip all that pass → render.
- The `clip_<id>` / `output/clip/` names below are the defaults when no skill names its own.
- `/commentary-short` has no single source link: it applies steps 2, 4, 5 and 7 (reference study, effects plan, edit, QC) inside its own research/script flow.

Workspace `C:\Users\manth\OneDrive\Desktop\AI-Video-Editor` (cloud: the repo root), tools in `tools/pipeline/`.
**Read `docs/clipping-playbook.md` and `docs/effects-catalog.md` first.** Run `bash tools/pipeline/preflight.sh`.
Never publish, schedule or boost. Never ask for a clip count, timestamps or rules. Ask only when the source link is missing.

## Step 1: Read the input
Sort what the message contains:
- **Source link(s)**: the video(s) to clip. Required; if none, ask for it and stop.
- **Reference video**: a link or local file the user says to copy or follow. Optional.
- **Prompt**: any instructions (length, tone, captions, effects, "no music"…). These outrank everything except campaign rules.

**Rule set:** the invoked skill's. If no skill was named, pick by source, and always apply it, with or without a reference:
- **BOXABL** source or campaign → every rule in `.claude/commands/boxabl.md` (whole home, BOXABL label, no Kanye/Elon, `@boxabl` caption filenames).
- **DraftKings / ClipFarm creators** (Cheddy, Nick Nayersina, FlightReacts) → the `/gab` skill rules (DK logo, zero cursing, brief checks).
- **Anything else** → the `/youtube-style-clip` look; no campaign rules, but the playbook's safety rules still apply.

Download with `py -m yt_dlp` (≤1080p) into `downloads/clip_<id>.mp4` (reference: `downloads/clipref_<id>.mp4`).
- Job folder: `jobs/clip_<id>/`.
- If a link is private or blocked: report the exact error and continue with the rest.

## Step 2: Study the reference (skip if none)
`py tools/pipeline/study-reference.py downloads/clipref_<id>.mp4 jobs/clip_<id>/ref`
- This gives `study.json`: length, cuts and cuts/s, shot lengths, first-cut time, loudness (LUFS and LRA), sound hits (likely SFX/impacts), words/s and the transcript.
- It also gives `sheets/`: 4 frames/s with timestamps.

**Read every sheet.** Then write `jobs/clip_<id>/style.md`, the style sheet, with measured values, not impressions:
- **Structure:** hook type (cold open on payoff, question, teaser, narrator line), where the payoff lands, ending/loop, length.
- **Pacing:** cuts/s, median shot, how fast the first cut comes.
- **Text:** headline bar (yes/no, position, colours, word count), caption style (words per card, position, colour, outline, emphasis colour), other labels.
- **Motion:** punch-ins, zooms/drift, shakes, flashes, transitions (hard cut, whip, glitch, fade), arrows/circles, stickers/emoji.
- **Sound:** original audio vs narration, music presence and level, SFX count and where they sit. Match `sound_hits` to the frames.
- **Layout:** full-frame vs stacked, blurred fill, crop tightness.

**Copy the editing, never the content.** Structure, pacing, caption look, effects and hook pattern are copied. Footage, wording, frames, logos and music from the reference never are.

**Narration** follows the reference: if the reference is narrated, write an original narration (Kokoro, `hf.sh tts` + `add-vo.py`) the way `/viral-shorts` does. **Exception:** if the campaign rules ban AI voice (BOXABL brief, /gab), use the original audio plus a text hook instead, and tell the user why.

**No reference** → the style sheet is the active skill's look; if no skill was named:
- BOXABL → the /boxabl style section;
- DraftKings → /gab;
- else → the `/youtube-style-clip` measured look (playbook §2).

## Step 3: Find the moments
- **Transcribe the whole source:** `py tools/pipeline/transcribe_lowmem.py <src> jobs/clip_<id>/t base.en`, in the background for long videos.
- **Read all of `segments.txt`,** then run `node tools/pipeline/score-moments.js jobs/clip_<id>/t/transcript.json --min <len-5> --max <len+10>`, using the reference length (or the rule set's length).
- **Make contact sheets across the full runtime** for visual moments the transcript misses: stunts, reactions, reveals.

**Every pick must be a complete mini-story** (playbook §1: setup → tension → reveal; it must pass the standalone test).
- Prefer moments that fit the reference's hook pattern, e.g. a reference that opens on the payoff needs a moment with a strong visual payoff.
- Write `candidates.md`. For each pick: setup/tension/reveal timestamps, "this clip is about…", test result, risks, and the 4-part score (playbook §1, "Judging the shortlist"). Also list rejects and why. Long sources: read in windows, then rank all candidates against each other.

## Step 4: Decide the effects for every cut
For each clip, write `jobs/clip_<id>/clipNN/plan.md`: a cut list with one row per cut (`time | shot | transition | motion | text | SFX`).

Choose from `docs/effects-catalog.md`, in this order:
1. the user's prompt;
2. the campaign rules and house-style limits (≤2 flashes, ≤6 SFX, 2 for DraftKings/gab);
3. the style sheet's measured choices (reference cut rate, SFX count and placement, transition types);
4. the catalog's best fit for the moment.

**Where everything comes from (paths from the repo root):**
| Need | Look here first | Details |
|---|---|---|
| Sound effects | `sound effects/` (user's packs + fixed woosh/riser, see its `README.md`) and `commentary-kit/sfx/sfx-kit/sounds/<category>/` | sfx-kit choice notes: `commentary-kit/sfx/sfx-kit/catalogue.md`, `commentary-kit/sfx/sfx-kit/sounds.json`; everything else: `docs/effects-catalog.md` §3 |
| Transitions | **CapCut's 20 first** ("Main set" at the top of `motion-graphics-library/EFFECTS_INDEX.md`), then the rest of the index | which fits which moment: `motion-graphics-library/SELECTION_GUIDE.md`; how to use: `motion-graphics-library/USAGE_GUIDE.md` |
| Caption / text animations | `motion-graphics-library/EFFECTS_INDEX.md` (15) | `shorts.json` `capAnim` / `capAnims` |
| Callouts, emphasis, backgrounds | `motion-graphics-library/EFFECTS_INDEX.md` (16 overlays) + the builder's `arrows`, `callouts`, `punch`, `shakes`, `flashes` | `shorts.json` `overlays` |
| Music | `commentary-kit/music/` (CC BY, credits in `CREDITS.txt`) | moods in `docs/effects-catalog.md` §6 |
| Anything not listed | HyperFrames registry: `bash tools/pipeline/hf.sh catalog --tag=transition` (or `--tag=captions`) | install with `hf.sh add <name>` |
If a listed folder is missing on this machine (e.g. sfx-kit removed from the PC), say so and use the other sources; never invent a path.

**Transition sounds** come only from `sound effects/sfxv2/` (each CapCut-20 transition's sound in `CAPCUT20`, added automatically by `build-shorts.js`; other engines: `node motion-graphics-library/mgl.js --capcut20`). **Other sound sources:** pick SFX from the `sound effects/` folder (repo root, the user's packs) and `commentary-kit/sfx/sfx-kit/`
(`catalogue.md` / `sounds.json` there), plus the rest of the catalog. For campaign clips (BOXABL, DraftKings) prefer
sfx-kit for anything that is a recognisable brand or meme sound (see `sound effects/README.md`).

**Transitions and animations:** every scene change (a new location, subject or story beat) gets a different transition (from CapCut's 20 first, also in motion-graphics edits)
and a different animation from the motion-graphics library (`motion-graphics-library/EFFECTS_INDEX.md`, chosen with its
`SELECTION_GUIDE.md`; `shorts.json` fields `transitions`, `capAnims`, `overlays`), never the same one twice in a clip. Quick cuts inside
one scene stay hard cuts. Log each choice in the cut list.

**Fixed features on EVERY clip (constant, built in by `build-shorts.js`; build them by hand for any other builder):**
1. **Open:** a very fast zoom-out (scale 1.6 → 1 in 0.3 s, expo.out) at 0.0 s with `sound effects/woosh-sound-effect.mp3`,
   its leading 0.09 s skipped so the woosh peaks during the zoom.
2. **Hook riser:** `sound effects/popular-riser-metallic-sound-effect.mp3` is the only riser in the clip. Its peak
   (its loudest moment and hard stop, 1.86 s into the file) lands exactly when the narrator (or speaker) finishes the hook line: set `"hookEnd"` in
   `shorts.json` from the word timestamps. Hooks shorter than 1.86 s start inside the riser.
   **Campaign override (e.g. Brezscales):** `"typedHook": "LINE ONE / *KEYWORD LINE*"` replaces the riser with an on-screen
   hook typed out line by line (green glowing `*keyword*`) and the key-click sound `sound effects/fast-and-dynamic-typing-keyboard.mp3`
   playing exactly while each line types; captions are skipped under it. Use only when the prompt asks for it.
3. **Loop ending:** the last scene is the same shot as the first scene. Into the last frame, a fast zoom-in
   (scale 1 → 1.6 in 0.3 s, expo.in) with the same woosh peaking 0.1 s before the end, so frame N (zoomed in) flows
   into frame 0 (zoomed in, about to zoom out).
4. **Arrow ding:** every arrow that points at something (builder `arrows`, not circles, and the library's pointer `label`)
   plays `sound effects/ding-sound-effect_2.mp3`, its first 0.11 s skipped so the ding peaks as the arrow finishes popping in
   (automatic in `build-shorts.js`).
Exception on purpose: `/meme` builds with `"fixedFeatures": false` (no opening/closing zoom-woosh, no riser).
These count toward no SFX cap and can't be dropped; if a campaign's SFX limit makes them impossible, tell the user.

Rules for the cut list:
- Put SFX on story turns and payoffs only.
- If the reference uses music, pick a bed matched to its mood from the catalog. If there is a beat grid, use the `beat-sync-editing` skill to place cuts.
- Never exceed the reference's own effect density, except for the fixed features and the one-transition-per-scene-change rule above (the user's standing rules win). More effects ≠ more views.

## Step 5: Edit
Per clip:
1. **Cut** the segments into `clipNN/tight.mp4`. Use `cut-mistakes` then `cut-silences` (or `auto-editor`) to remove dead air, keeping reaction beats. Check sentence boundaries with `check-bounds.js`.
2. **Transcribe the clip.** Fix Whisper mishearings (names, brand spellings) in `fixes`.
3. **Crop and grade:** run `track-faces.py --write`, correct the crops by eye from frames of `tight.mp4`, then `reframe.py` with the style sheet's grade.
4. **Build:**
   - Write `shorts.json` (`style: "ysc"`, plus headline, captions, `punch`, `drift`, `flashes`, `shakes`, `arrows`, `callouts`, `sfx`, with values taken from `plan.md`).
   - Run `node tools/pipeline/build-shorts.js videos/clip-<id> clipNN ...`.
5. **Hand-edit** anything the builder doesn't do (stacked layouts, whip/glitch transitions, registry effects, speed ramps, custom caption looks): edit the HyperFrames composition directly with the hyperframes-core / keyframes / registry / audio skills, as `/viral-shorts` does.
6. **Check:** run `bash tools/pipeline/hf.sh check`, then `snapshot`, and compare the snapshot frames against the reference sheets side by side.

## Step 6: Clip as many as pass
Build every candidate that passed the standalone test and the rule set; there is no fixed count. Stop when the next-best moment fails the test. Never pad with weak or repeated moments, and never mix sources in one clip. This PC has 3.6 GB RAM: at most ~3 renders at once.

## Step 7: Render, QC, report
- **Render:** `bash tools/pipeline/render-shorts.sh videos/clip-<id> "output/clip/<Creator or topic>"`. It never overwrites: recycle old files first.
- **QC per clip:**
  - `bash tools/pipeline/qc-sheet.sh` and `bash tools/pipeline/ysc-qc.sh "<file>"`: length, cuts/s, −14 LUFS, LRA, no silence;
  - `blackdetect` / `freezedetect`;
  - re-transcribe the final and run `clean-check.py`;
  - read the frames: frame 1 mid-action, captions off faces, no forbidden content, and the campaign checks;
  - **fixed features:** frame 0 and the last frame show the same shot at the same zoom (compare them side by side); the opening zoom-out and woosh start at 0.0 s; the riser peaks within 0.05 s of the hook's last word; the closing zoom-in and woosh end the clip; no other riser is used; every arrow has its ding;
  - **reference match:** cuts/s within ±25% of the reference, same hook pattern, same caption and headline style, SFX count ≤ the reference's.
  - Fix and re-render anything that fails.
- **Report** in `output/clip/<...>/clips_report.md`. Per clip:
  - filename, source timestamps, duration, the story in one line;
  - the effect log (time, effect, source, why);
  - QC pass/fail and the reference-match numbers.

  Also list rejected moments and blockers, and state whether narration was used and why.
- **Keep the job files.** The user runs `/cleanup-project` when ready.
