---
name: viral-shorts
description: "Analyze raw footage, pick the strongest moments, write an original AI narration, and edit a fast, suspense-driven narrated 9:16 Short with a future-moment teaser hook (narrator hook over a preview of the payoff → story in order → payoff). Also a full HyperFrames editor: builds with the ysc preset (shakes, flashes, punch-ins, arrows, SFX, ducked music, default clone_3_voicebox-qwen3 voice), then edits any HyperFrames composition directly — cuts, camera moves, transitions, speed ramps, audio mixing, effects, grades, captions, overlays, preview, render — and handles follow-up edits on an existing viral-shorts project. Use when the user types /viral-shorts, or asks to \"edit this video in my viral Shorts style\", \"use the teaser hook and narration workflow\", \"find the best moments and create a narrated Short\", or to change a viral-shorts edit. Campaign briefs override anything here they forbid (e.g. AI voiceover bans)."
argument-hint: "<video file | YouTube url> [more...]"
---

# /viral-shorts: narrated teaser-hook Shorts, edited with HyperFrames

This is one skill: the former `/viral-shorts` command and `viral-shorts-editor` skill were merged on 2026-10-20. It **edits like the HyperFrames skill**: Phases A–F make the first cut fast, and § "HyperFrames editing" below gives the full HyperFrames toolset for every extra effect and every follow-up change.

**Which path:**
- **A new source** (file or link): run Phases A–F.
- **A change to an existing viral-shorts edit** ("stronger zoom here", "swap the hook line", "add a whip", "music lower"): skip A–C and go straight to § "HyperFrames editing" on `videos/vs-<id>/clipNN/`. Then re-check, re-render and re-QC.
- **Only inspect, preview or render an existing project:** do just that operation with `/hyperframes-cli`.

Run the whole workflow automatically. Ask only for a missing source, or for a choice that only the user can make (e.g. a campaign that bans AI voice). Never ask the user to write the script, give timestamps or restate these instructions.

Workspace: `C:\Users\manth\OneDrive\Desktop\AI-Video-Editor`. Tools are in `tools/pipeline/`.

**Read before planning:**
- `docs/clipping-playbook.md`: story-first rules, safety, workflow traps (shared by every editing skill).
- `docs/effects-catalog.md`: the effects menu (sounds, transitions, overlays, moves, text). Prompt first, then brief and house-style limits, then catalog fit; add its effect log to the delivery.
- `docs/editing-workflow.md`: the default 7-step process for every editing job (input → reference study → story moments → effects per cut → edit → clip all that pass → render). This skill's rules fill in the details.
- `STYLE_GUIDE.md` (next to this file): what the two reference Shorts actually do, measured shot by shot.
- `NARRATION_GUIDE.md`: how to write and produce the voiceover.
- `EDITING_CHECKLIST.md`: the pass/fail list to report.

**Core idea:** a narrator hook over a short **preview of the payoff** → a quick return to the start of the story → the story in order, cause before effect, each narration line landing on its shot → the full payoff last, ending on it. Reproduce the editing language, never the references' footage, wording or frames.

## Phase A: Inspect
1. **Source:**
   - a local file; or
   - a link via `py -m yt_dlp -J` (check rights, channel and the brief), then download up to 1080p into `downloads/vs_<id>.mp4`.
   - Never bypass DRM, private videos or region locks.
2. **Facts:** run `ffprobe` for duration, fps, resolution and audio streams. Run `bash tools/pipeline/preflight.sh` and fix anything that FAILs. Note the RAM (3.6 GB: base.en transcripts, renders in the background).
3. **Brief:** if it's a campaign job, read the brief fresh. Check: AI voiceover allowed? Names and celebrities allowed? Required tags and logos? Banned words? Note the limits.

## Phase B: Analyze (evidence only: real footage and audio)
1. **Transcribe:** `py tools/pipeline/transcribe_lowmem.py <src> jobs/vs_<id>/t base.en en` (use `small` if the speech is unclear).
2. **Look:**
   - contact sheets of the whole source (1 frame / 10–15 s), then 2–4 fps sheets around candidates;
   - `node tools/pipeline/score-moments.js t/transcript.json --min 8 --max 45 --top 60`;
   - for silent action, check audio spikes and scene changes, e.g. `ffmpeg … select='gt(scene,0.3)'`.
3. **Write `jobs/vs_<id>/moments.md`.** One row per moment:
   - timestamps; what happens (seen or heard, not guessed);
   - type (twist / reaction / impressive / tension / near-miss / reveal / funny);
   - scores 1–5 for hook potential, visual clarity, emotion, novelty and story value;
   - a "slow / repetitive / cut" list.
4. **Choose the Short:**
   - the one story (setup → tension → reveal) that passes the standalone test;
   - its **payoff shot**;
   - its **teaser excerpt**: from the same story; shows the build-up or the instant before the result, never the result; readable in 0.3–1.2 s;
   - what to shorten, reorder, replay or drop.
   - If the source holds several stories, plan one Short per story and don't pad.

## Phase C: Plan
1. **Narration:** write the original script per `NARRATION_GUIDE.md`.
   - Shape: hook → context → turn → build → final tease → silence for the payoff, or a handover to original audio.
   - About 3 words per second. Every claim supported by the footage.
2. **Edit plan:** `jobs/vs_<id>/plan.md`, a timestamped table:

   | out t | src in–out | shot | narration line | captions/emphasis | effect + reason | SFX | music |
   |---|---|---|---|---|---|---|---|

   - **0.0–~2.5 s:** the teaser (1–3 shots) with the hook line from frame 1.
   - **Return:** hard cut, white flash or whoosh to the story start.
   - **Story:** in order. Fast cuts (about 0.5–1 s) while energy is high; hold 1.5–3 s where a proof must be read (a timer, an impact, a face).
   - **Payoff:** last. End on it, or ≤1 s after.
   - **Length:** 13–35 s (the references are 13–15 s). As long as the story needs.
3. **Effects, chosen per moment** (each with a reason):

   | Effect | When |
   |---|---|
   | punch-in (`punch`) | reactions and details |
   | slow push-in | auto; or longer for build-up |
   | flash (`flashes`, ≤2) | the teaser→story return and/or the payoff impact |
   | screen shake (`shakes`, 0.2–0.4 s) | only on real impacts or reveals, synced to a SFX hit |
   | arrows/circles | the object or face the narrator names |
   | whip / match transition | a time or place jump: a HyperFrames registry transition, or keyframed blur/translate (§ HyperFrames editing) |
   | speed ramp | HyperFrames `rate` lane in `data-automation` (or a constant `data-playback-rate`). Only to compress a slow action without hiding it |

## Phase D: Produce
Work in `jobs/vs_<id>/`. Projects go in `videos/vs-<id>/`. Output goes to `output/viral-shorts/<slug>/`.
1. **Cut** the plan's segments in output order (teaser first) with ffmpeg `-ss/-t` per segment + `concat` into `clipNN/tight.mp4` at 30 fps.
   - Keep the original audio where useful.
   - Mute segments that the narrator talks over only if the brief allows; otherwise duck them.
   - **Set crops on frames of `tight.mp4`**, then run `py tools/pipeline/reframe.py clipNN [--grade ysc]`. Fill 9:16; pan when the subject moves.
2. **Voice:** default narrator clone_3_voicebox-qwen3 (`default-voice` skill). Put the clip's lines in `clipNN/lines.txt` (one per line) and run `py .claude/skills/default-voice/qwen_voice.py lines clipNN/lines.txt -o clipNN` (loads the model once → `clipNN/vo1.wav`, `vo2.wav`, ...; a single line: `py .claude/skills/default-voice/qwen_voice.py line "<line>" -o clipNN/voN.wav`), then `py tools/pipeline/add-vo.py clipNN --at <t> --vo clipNN/voN.wav`. If the line's length doesn't fit, trim words, not speed.
3. **Music:** `clipNN/music_duck.wav`.
   - Licensed instrumental (`commentary-kit/music/`, CC BY: credit it), matched to the mood.
   - Ducked about −10 dB under narration (ffmpeg `sidechaincompress` against the clip audio), lifted or hit at the payoff. No silence.
4. **Compose** (`shorts.json`, the `ysc` look):
   ```json
   {"clip01": {"title": "<caption-style title>", "style": "ysc",
     "headline": "HOW FAST DID IT *GO UP*?", "fixes": {}, "emphasis": [],
     "punch": [[9.1, 1.2]], "flashes": [{"t": 2.4}, {"t": 12.3}],
     "shakes": [{"t": 12.3, "d": 0.3, "amp": 18}],
     "arrows": [{"t": 0.3, "d": 1.2, "x": 640, "y": 900, "rot": -25}],
     "sfx": [{"t": 2.35, "name": "whoosh-short"}, {"t": 12.25, "name": "impact-bass-1"}], "callouts": []}}
   ```
   - Add `"logoImg"`/`"logoPos"` when a brand logo is required.
   - Captions are automatic from `clipNN/t/transcript.json`: transcribe `tight.mp4` *after* the narration is mixed in, then fix mishears.
   - **Build:** `node tools/pipeline/build-shorts.js videos/vs-<id> clip01 …`. **Check:** `bash tools/pipeline/hf.sh check <dir>` must show 0 errors. **Look:** `hf.sh snapshot <dir> --at <teaser>,<return>,<payoff>`.
   - For anything beyond the preset, continue in § "HyperFrames editing" below on the generated project. Typical extras: whip/match transitions, a two-shot stack, a speed ramp, a custom title or motion graphic, an audio automation.
5. **Render:** `bash tools/pipeline/render-shorts.sh videos/vs-<id> "output/viral-shorts/<slug>"`. It never overwrites; recycle the old file before re-rendering.

## Phase E: Quality control
Run `EDITING_CHECKLIST.md` → QC on every export:
- `ysc-qc.sh`;
- `blackdetect`;
- a frame sheet at 2–4 fps;
- re-transcribe the final to check the narration is intelligible and the captions match;
- `clean-check.py` if the brief bans cursing;
- **the teaser matches the payoff**;
- the standalone test passes.

Fix, re-render and re-check. Never report a clip as done unless its file exists and passed.

## Phase F: Deliver
- The output path(s).
- Per clip: the story in one line, the teaser and payoff timestamps, the narration script, effects used and why, music + credit.
- QC results.
- Anything unavailable or skipped, stated honestly (e.g. "no shake: no real impact in this footage", "AI voice banned by the brief → original audio + text hook").
- Keep job files; the user runs `/cleanup-project`.

## Transitions and transition SFX (user rule, 2026-11-07)
- **Main choices, in every edit:** CapCut's 20 popular transitions: Pull In, Pull Out, Camera Shake, Whirl, Zoom In, Zoom Out, Blur, Glitch, Flash, Spin, Slide, Rotate, Shake, Zoom Blur, Distortion, Cube, Swipe, Wipe, Split, Light Leak. Pick every transition from these first, also when motion graphics are involved (split-screen panels, explainers, montages, slideshows, overlay cards): each scene change between shots or graphics uses one of the 20, not another engine's or the registry's version of the same name. Use another transition only when none of the 20 fits. CapCut name -> preset: the "Main set" table at the top of `motion-graphics-library/EFFECTS_INDEX.md` (`CAPCUT20` in `mgl.js`, ai-video-editor workspace).
- **Transition SFX:** only the user's sfxv2 pack (`sound effects/sfxv2/` in ai-video-editor; master copy `sfxv2/` in the vault repo). The user's files come first; `generated/` holds synthesized fallbacks, currently unused. Each of the 20 has its sound, peak and volume in `CAPCUT20`, and every file is 1.5 s or shorter. `build-shorts.js` adds the sound automatically with the hit on the cut, so never add a second whoosh for the same cut (`"sfx": false` on a transition skips it, `"sfxVol"` sets its volume).
- **Any other engine** (a hand-built HyperFrames composition, Remotion, ffmpeg, OpenMontage): run `node motion-graphics-library/mgl.js --capcut20`, port the transition's motion exactly (same values, durations and eases), and place its sfxv2 sound with the peak on the cut at its volume.
- **Motion graphics keep their own small sounds** (typing ticks, pops, shimmers, rises). The sound on a scene change is the transition's sfxv2 sound; the builder drops a panel split's synthesized hit where a transition sound already lands.
- The skill's or command's own limits still apply: transition sounds count toward its SFX cap, and its cut style (e.g. hard cuts by default) decides how many transitions there are. Not for the cartoon/3D animation skills (cartoon-audio-short, cartoon-3d-short, 3d-short).

## HyperFrames editing (full toolset, inside this style)
Every viral-shorts clip is a real HyperFrames project (`videos/vs-<id>/clipNN/index.html` + `assets/`), so anything HyperFrames can do can be done here.
- **The run:** use `bash tools/pipeline/hf.sh <command>`, the pinned CLI (fast, no npx start-up). `npx hyperframes …` also works.
- **The contract:** read `/hyperframes-core` before hand-writing composition HTML.
- **Shared rules:** the `/hyperframes` router's local addendum and `docs/clipping-playbook.md` still apply.

**1. Know what's on the timeline before changing it:**
- `bash tools/pipeline/hf.sh timeline <dir> --json` lists tracks, clips, starts, ends and what plays. Use it instead of reading the whole file.
- Bracket edits with project history (`/hyperframes-cli` → Project history).

**2. Load only the domain skills an edit needs:**

| Edit request | Skills to load |
|---|---|
| Cut, trim, splice, reorder, use a different source range | `/hyperframes-core` (owns `data-start`, `data-duration`, `data-media-start`, track layout); `/general-video` for footage-remix patterns |
| Zoom, punch-in/out, reframe, Ken Burns, camera move, shake | `/hyperframes-core` + `/hyperframes-keyframes`. Animate the inner visual/crop wrapper (`#cam`, `#a-roll`), not the timed clip |
| Whip pan, match cut, flash, glitch, light leak, blur transition | `/hyperframes-animation` + `/hyperframes-keyframes` + **`/hyperframes-registry` first**: search and install a transition block before hand-building one |
| Speed ramp / slow-mo / fast-forward | `/hyperframes-core`: constant `data-playback-rate`, or a `rate` lane in `data-automation` for ramps (picture and pitch-preserved sound stay render-safe) |
| Fade, crossfade, volume, duck/carve under the narrator, automation, audio FX | `/hyperframes-core` (placement) + `/hyperframes-audio` (mixing; a submix bus for several tracks) |
| Grade, LUT, dark/flat footage, stylize, blur a face, media reveal | `/media-use` (read its `references/media-treatments.md` first; use its treatment primitives, not a generic CSS filter) |
| Narration voice | `default-voice` skill (clone_3_voicebox-qwen3), not `/media-use` TTS |
| New SFX, music, images, icons, logos; transcription; background removal | `/media-use` (sourcing/generation only; mixing stays in `/hyperframes-audio`) |
| Captions, title cards, lower-thirds, callouts, animated text, motion-graphic inserts | `/hyperframes-animation` (text effects, motion rules), `/hyperframes-creative` (type, palette, narration/beat planning), `/motion-graphics` for a standalone sub-10 s unit |
| Two-shot stack, picture-in-picture, sub-compositions, caption track/safe zones | `/hyperframes-core` + `/hyperframes-studio` |
| Check, lint, snapshot, compare, preview, render, batch, publish, diagnose | `/hyperframes-cli` |

**3. Rules for every hand edit:**
- **Determinism:** animate transforms and opacity only (letter-spacing, layout or filter tweens fail `check`), on the single paused GSAP timeline. Seek-safe; no `Date`/random.
- **Style:** stay inside this skill's style. At most 2 flashes; shake only on real impacts; at most ~6 SFX (2 for DraftKings/gab); one grade. The headline bar and captions stay readable and off faces, logos and the UI zones. The brand logo, if required, stays visible and unaltered.
- **Narration and dialogue are never changed:** no speed or pitch tricks and no re-ordered words that alter meaning. Detection-evasion edits are forbidden.
- **After every edit:** `hf.sh check <dir>` must show 0 errors; `hf.sh snapshot <dir> --at …` the changed moments and look at them.

**4. Preview and deliver:**
- **Optional Studio preview:** `bash tools/pipeline/hf.sh preview <dir>`. The user can click, retime and edit there. The `/hyperframes` router § 6 covers the desktop app note.
- **Render:** `bash tools/pipeline/render-shorts.sh videos/vs-<id> "output/viral-shorts/<slug>" clipNN`. It never overwrites, so recycle the old export first.
- **Then run Phase E QC again.**

**5. Bigger additions:**
- **A brand-new composition** (an intro card, a recap graphic, a standalone motion graphic to splice in): route it through `/hyperframes` § 2 (usually `/general-video` or `/motion-graphics`), render it, then cut it into the clip like any other segment.
- **Updates:** `npx hyperframes skills update <workflow>` refreshes a workflow. Re-add the router's local addendum afterwards if it disappears.

## Limits on this PC (state them when relevant)
- **Narration voice:** the default narrator clone_3_voicebox-qwen3 (local Qwen3-TTS voice clone, casual and realistic). About 1-1.5 min per 10 s of voice on CPU; the 1.7B model needs ~8 GB RAM (this PC: set `QWEN_VOICE_MODEL=Qwen/Qwen3-TTS-12Hz-0.6B-Base` or voice it in the cloud).
- **Not one-line preset options:** whip/match transitions, speed ramps, split screens and custom motion graphics. They are done as HyperFrames edits (§ HyperFrames editing), so they take a little longer per clip.
- **Music:** from the CC BY kit (needs credit) or user-supplied tracks. No auto-sourced trending audio; the `media-use` BGM resolve needs the HeyGen CLI.
- **Timing:** renders take about 1–2 min per clip; transcription is the slow step on long sources.
