---
name: commentary-short
description: "Produce a finished AI-narrated commentary YouTube Short (9:16, ~60–120 s) on a current internet story: research and verify the story, source 5–10 news/creator clips, write an original script, voice it with the default narrator (local Qwen3-TTS voice clone), build it with ffmpeg (footage band over blurred fill, word-by-word animated captions, section labels, pop-ups, SFX, ducked music), run QC, and deliver to output-commentary/<slug>/. Use when the user asks for a commentary video/Short for their commentary channel, or runs /commentary-short (optionally with a topic). Not for clipping a single source video into Shorts (that is the jobs/render-shorts pipeline, with /puregrit for that style) and not for HyperFrames compositions."
---

# Commentary Short

End-to-end production of one commentary Short for the user's AI-narrated commentary channel.
Workspace: `C:\Users\manth\OneDrive\Desktop\AI-Video-Editor`. Worked example: `references/example-short.json`
(the "Kelly Clarkson vs. a $15M Bird" Short, finished in `output-commentary\kelly-clarkson-molly\`).

**Channel:** What The Tape Shows (@WhatTheTapeShows). Branding and the channel playbook are in `channel\what-the-tape-shows\` (`SETUP.md`).
Every Short needs an original **MY TAKE** section, because YouTube's "inauthentic content" policy targets AI voice over reused clips. Vary music,
hook style and graphics between Shorts so they don't look templated. Every description ends with
`Narration: AI voice. Script, research and opinions: What The Tape Shows.` followed by `#shorts #commentary`.

**Format is fixed: YouTube Shorts.** Vertical 1080×1920, 30 fps, about 60–120 s (aim for 75–90 s). Never plan long-form unless the user asks.

## Where things go
| What | Where |
|---|---|
| Working files (sources, transcripts, narration, build cache) | `jobs\<slug>\` with `research\ sources\raw\ tmp\ vo\ edit\short.json edit\build\` |
| **Final deliverables** | `output-commentary\<slug>\`, kept separate from HyperFrames' `output\`. `/cleanup-project` never touches it, because its keep-list matches `\output`. |
| Shared assets | `commentary-kit\` (SFX, music + `music\CREDITS.txt`, fonts, `STYLE-GUIDE.md`) |

## Tool facts for this PC (3.6 GB RAM, slow CPU)
- Python: `C:/Users/manth/AppData/Local/Python/pythoncore-3.14-64/python.exe` (or `py`). `python` on PATH is the Store stub.
  Below, `PY` means that path.
- Run heavy steps **one at a time**. Whisper, the TTS model and x264 running in parallel crash with out-of-memory errors. Run long steps with `run_in_background`.
- Transcription: `tools/pipeline/transcribe_lowmem.py <media> <outdir> base.en`. The `small.en` model runs out of memory.
- TTS: use `scripts/synth_lines.py` (the default narrator from the `default-voice` skill: Qwen3-TTS cloning clone_3_voicebox-qwen3).
  The 1.7B model needs ~8 GB RAM, more than this PC has: here set the env var `QWEN_VOICE_MODEL=Qwen/Qwen3-TTS-12Hz-0.6B-Base` (lighter, a bit less natural), or render the voice in the cloud.
- yt-dlp: YouTube rate-limits subtitle downloads (HTTP 429). To find a moment in a long video, download the 240p video-only proxy
  (`-f 133`), make a sheet with `scripts/sheet.sh`, then fetch only that part with `--download-sections "*MM:SS-MM:SS"`
  (no `--force-keyframes-at-cuts`, which re-encodes and runs out of memory).
- Rendering about 22 shots plus the encode takes about 10 min.

## Workflow (in order, without skipping steps)

**Before scripting**, read `docs/clipping-playbook.md` (workspace). The parts that apply here:
- **Effects:** pick sounds, transitions, overlays, camera moves and text animations from `docs/effects-catalog.md` (workspace): the user's prompt first, then the brief and house-style limits, then the catalog's best fit. Add its effect log (time, effect, source, why) to the report.
- **Workflow:** `docs/editing-workflow.md` steps 2, 4, 5 and 7 apply: study any reference the user sends, plan effects per cut, edit, QC. Research and scripting stay as below.
- **Story shape:** the script is a standalone mini-story. Open on the most baffling or surprising fact, give the cause, build the tension, and save the reveal for the end. Answer every question the hook raises.
- **Footage:** each source clip shows the thing being said. No unrelated hype B-roll.
- **Cut dead space** and keep the mix continuous.
- **Hook:** 6 words or fewer, curiosity without spoilers or invented claims.
- **Safety:** check every frame for third-party logos and minors. Use licensed music, credited if CC BY.
- **Test:** run the standalone test on the final file.

### 1. Topic
If the user gave a topic, use it. If not, research current stories (WebSearch `extended`; check outlet dates against
today's date) and present **5 options** ranked by interest, recency, footage availability, room for original commentary,
storytelling, competition and legal risk. Recommend one and wait for the user's pick.

### 2. Research → `jobs\<slug>\research\research-notes.md`
Timeline (check weekdays against the calendar), who's involved, and what is **confirmed / disputed / opinion**.
Use at least 2 outlets per key claim. Note careful-wording rules: attribute every disputed point ("she says", "the shop says"),
never call a side a liar, don't name private employees, leave out unsupported allegations (e.g. racism claims made by one creator).

### 3. Sources → `sources\source-table.md`, then **ask before downloading**
Search with `yt-dlp --flat-playlist --print "%(id)s | %(duration_string)s | %(channel)s | %(title)s" "ytsearch8:<query>"`,
then `--skip-download --print "%(upload_date)s ..."` for dates. Prefer primary sources (whoever first released the footage) and
network news. **Reject other creators' commentary videos** (weak fair use, not original). Table: title, publisher, URL, date, length,
what it shows, how it's used. Tell the user that the plan relies on fair use for commentary (defensible, not guaranteed),
give the total size, and wait for a yes. Then download to `sources\raw\S1.mp4…` (`-f "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080]"`).

### 4. Analyse
- Transcribe each clip: `PY -I tools/pipeline/transcribe_lowmem.py sources/raw/S2.mp4 tmp/S2 base.en`, one at a time.
- Contact sheets: `bash <skill>/scripts/sheet.sh sources/raw/S2.mp4 tmp/S2/sheet.png 3`. Note for each source:
  the banner-free **clean rect** (lower-thirds and podcast banners sit in the bottom 10–30%), the moments worth using,
  and **network wipe transitions**. Check around chosen in-points at `every=0.25`; wipes look like white smears.
- Check that each soundbite's speaker really is who you think. Anchors' banter can sound like the interviewee.
- Skip clips with profanity, personal medical details, or private people's faces (GMA usually blurs bystanders; prefer its CCTV copy).

### 5. Script (Shorts structure) → `edit\short.json` items + `script\short-script.md`
About 220–250 words of narration plus at most one soundbite of 6–10 s:
1. **s01 hook (0–10 s):** the most striking fact, shown over the most striking footage. No greeting.
2. **Side A** (label e.g. `KELLY'S SIDE`), 3. **Side B** (`THE SHOP'S SIDE`), 4. **The evidence/twist** (`THE TAPE`),
5. **My take** (`MY TAKE`): original analysis, clearly marked as opinion, ending in a lead-in to the soundbite.
6. **Soundbite** (`"soundbite": [src, in, out]`), 7. **CTA + loop line** (a question to viewers, then a callback to the hook).
Write for the ear: short sentences, specific numbers, a bit of humour, `|` between sentences. Write it the way you'd say it to a friend:
contractions, "You see," asides, `...` before a reveal, `!` on the punch word, numbers as words (see `default-voice/SKILL.md`).
Voice: the default narrator (clone_3_voicebox-qwen3, every skill), `"tempo": 1.0` (about 3.2 words/s, ~190 wpm, casual). Make a 1-sentence test first if the topic is new.

### 6. Voiceover
`PY <skill>/scripts/synth_lines.py jobs/<slug>/edit/short.json` writes `vo\<id>.wav` (about 1 min per line here).
Then run `PY <skill>/scripts/build_short.py jobs/<slug> --words-only`, which transcribes each line and prints caption text.
Compare it with the script and add `caption_fixes` (`[old, new]`, applied in order of occurrence, `""` deletes Whisper's
hallucinated trailing words like "News." or "fire."). Re-run until the text matches the script exactly.

### 7. Shots (in `short.json`)
`"shots": [[src, in, out, focus_x, fx], ...]` fill each item in order. `fx` is `push` (slow zoom), `punch` (static 1.15×),
`flat`, or `freeze` (B&W still held for `freeze_hold`, for a reveal). Change shots every 2–5 s. Shots under 1 s are merged automatically.
Shots fill items in order, so to land a freeze or a specific image on a word, size the preceding shots so their lengths add up to that word's time.
Use `sources[src].clean = [x, y, w, h]` to crop out banners and logos. The footage band is a 4:3 window from that rect, panned by `focus_x`.
Match visuals to narration: "points at the bird" plays over the shot of her pointing.

### 8. Sound and graphics (in `short.json`)
- `sfx`: `{"at": 0}`, `{"at": "sections"}` (whoosh at each labelled item) or `{"item", "word"}` cue, with a file path relative to
  `commentary-kit\sfx` and a gain. Use about one SFX per beat, not continuously. See the map in `commentary-kit\STYLE-GUIDE.md`.
- `music` (from `commentary-kit\music`, CC BY: credit goes in the description) at `music_db` −24. It's automatically −34 under
  soundbites. Add `music_dropouts` for a beat of silence at the reveal.
- `title` `[white part, yellow part]` (persistent, top), `pops` (yellow callouts on a word), `stamps` (big red rotated
  word), `emphasis` (words shown red when active), `cover` (`at` seconds plus 2 text lines) for `thumbnail.png`.

### 9. Build + QC
`PY <skill>/scripts/build_short.py jobs/<slug>` (background). It writes the mp4, `.ass`, `.srt`, `thumbnail.png`,
`editing-timeline.md`, `voiceover\`, `final-audio-mix.wav` and `qc-metrics.json` to `output-commentary\<slug>\`, plus
`jobs\<slug>\tmp\qc_sheet.png` (1 frame per second).
**Read the QC sheet every time** and check: overlapping captions, visible lower-thirds or watermarks, flash/wipe frames,
freeze/stamp on the right word, pop-ups not covering on-screen text, private faces. Metrics must show 0 black frames,
0 silences, about −14 LUFS and a peak at or below −1 dBTP. After changing shots or crops, delete `edit\build\shot_*.mp4` (shots are
cached); use `--only-subs` for caption-only changes and `--only-audio` for mix changes. Expect 2–3 renders.

### 10. Deliverables → `output-commentary\<slug>\` (fill from `templates\`)
Copy `short-script.md`, `research-notes.md`, `source-table.md` and `short.json`, then write `licensing-manifest.md`,
`youtube-metadata.md` (titles under ~60 characters, a description with sources and the music credit from `music\CREDITS.txt`) and
`qc-report.md` (metrics, what you checked, renders made, what was not checked, e.g. no human listening).

### 11. Report
Give the topic, sources used and why, voice/tools, cost (free unless something else was approved), licensing risks,
duration/resolution, and the exact output path. Send the mp4 with SendUserFile. Never upload or publish without approval.
Mention `/cleanup-project` for the job folder once the user is happy. Downloads and the build cache are about 500 MB per Short.

## Transitions and transition SFX (user rule, 2026-11-07)
- **Main choices:** CapCut's 20 popular transitions: Pull In, Pull Out, Camera Shake, Whirl, Zoom In, Zoom Out, Blur, Glitch, Flash, Spin, Slide, Rotate, Shake, Zoom Blur, Distortion, Cube, Swipe, Wipe, Split, Light Leak. Use them at topic or section changes (commentary still cuts hard inside a section). Their look is defined in `motion-graphics-library/EFFECTS_INDEX.md` ("Main set").
- **Not built yet:** `build_short.py` joins shots with hard cuts (ffmpeg concat) and has no transition engine, so it can't draw these yet. Until one is added, put the transition's sound on the cut and say in the report which transition was intended.
- **Transition SFX:** only the user's sfxv2 pack (`sound effects/sfxv2/`, every file 1.5 s or shorter); sound per transition in that same table. In `short.json`, a `file` starting with `sound effects/` is read from the workspace root, e.g. `{"at": "sections", "file": "sound effects/sfxv2/fast-swish.mp3", "gain": -12}`.

## Rules
- Ask before every download or install. Paid services need approval.
- Never invent facts, quotes, sources or permissions. Never claim to have watched or heard what you didn't. Captions must match what's spoken.
- Credit on screen (`SOURCE:` label on every shot, automatic) and in the description. Credit is not permission.
- Keep each third-party excerpt short (2–6 s, soundbites at most ~10 s), with narration over everything except the soundbite.
