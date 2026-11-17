---
name: puregrit
description: Apply the PureGrit editing style (cold-open story Shorts with mid-screen 2-3 word captions, one coloured glowing keyword per line, cinematic grade, reaction labels, curiosity-gap titles) to a Shorts job. Use ONLY when the user explicitly types /puregrit or says "PureGrit style" / "use the PureGrit style" for a job. Never apply it by default, and never just because PureGrit is mentioned in conversation; the default house style stays in effect otherwise.
---

# PureGrit style (opt-in)

The user's default Shorts look stays the default. This style is used **only** when the user triggers it with
`/puregrit` (optionally followed by a URL or job) or explicitly says "PureGrit style". It applies to that job only;
the next job goes back to the default unless triggered again.

Workspace: `C:\Users\manth\OneDrive\Desktop\AI-Video-Editor`. The normal job pipeline still applies (preflight,
download, transcribe, check-bounds, render-shorts, qc-sheet, never overwrite, ask before publishing).
`reference.md` here holds the full channel study the style is based on.

## What changes vs the default pipeline

1. **Moment choice (most important).** Prefer a *single surprising moment with a visible emotional reaction* that needs
   no prior knowledge: a reveal, a twist, an act of kindness, an underdog win. Avoid biography recaps and rivalry montages
   (those flopped for PureGrit). Run `score-moments.js` for the shortlist, then pick for "no context needed".
   - **Story first:** use `docs/clipping-playbook.md` §1 (workspace). The moment must be a standalone mini-story,
     setup (cause) → tension → reveal (effect).
   - Keep the trigger of every reaction in the clip, and never pad it with unrelated B-roll.
   - Run the 8-question standalone test before cutting and again on the final file.
   - **Effects:** pick sounds, transitions, overlays, camera moves and text animations from `docs/effects-catalog.md` (workspace): the user's prompt first, then the brief and house-style limits, then the catalog's best fit. Add its effect log (time, effect, source, why) to the report.
   - **Workflow:** follow the default process in `docs/editing-workflow.md` (workspace): input → reference study (if a reference is sent) → story moments → effects per cut → edit → clip all that pass → render. PureGrit sets the look.
2. **Structure, 40-60 s:**
   - 0-3 s **cold open**: start on the tensest line or reaction from the footage itself. No hook banner, no intro.
   - about 4-8 s, **one setup sentence** of context ("He waited 21 years for this shot"). Never invent facts: only
     what the source shows or says. Voice it with the default narrator (clone_3_voicebox-qwen3: local Qwen3-TTS voice clone, free, offline), at a point where the footage
     audio is not carrying a key line. Do this **before** transcribing the clip and building the music bed:
     ```bash
     py ../../.claude/skills/default-voice/qwen_voice.py line "He waited twenty-one years for this shot." -o clipNN/vo1.wav
     py ../../tools/pipeline/add-vo.py clipNN --at 4.2 --vo clipNN/vo1.wav      # ducks the original 14 dB under it
     ```
     Several lines: `qwen_voice.py lines lines.txt -o clipNN` (model loaded once). Settings: `../../.claude/skills/default-voice/SKILL.md`.
     About 1-1.5 min per 10 s of voice on CPU; on a low-RAM PC set `QWEN_VOICE_MODEL=Qwen/Qwen3-TTS-12Hz-0.6B-Base`. `add-vo.py` keeps the untouched clip as `tight_novo.mp4`.
   - the rest: original footage building to the **payoff/reveal at the very end** (ideally loops back to the start).
3. **Pacing:** a cut or reaction shot every about 1.7-2.5 s (not faster than about 1.5 s). Favour reaction close-ups.
4. **Framing and look:** tight face crops (`track-faces.py`), then build the base with the grade:
   `py ../../tools/pipeline/reframe.py clipNN --grade puregrit` (contrast, saturation, vignette, light sharpen).
5. **Captions and graphics.** In `shorts.json`, per clip:
   ```json
   "style": "puregrit",
   "logo": "<the user's channel initials, ask once if unknown>",
   "callouts": [ {"t": 2.1, "d": 1.2, "kind": "label", "text": "SHOCKED"} ]
   ```
   - Captions sit mid-screen (`capY`, default 1060 px): 2-3 uppercase words, one keyword per line coloured
     (yellow, blue, red, green rotating; override with `pgColors`) with a glow. The keyword is an `emphasis` word, else the longest meaningful word.
   - No hook banner unless `hook` is set. `kind: "label"` makes a quoted reaction label (optional `y`).
   - Move captions (`capY`) if they cover a face in the QC frame.
6. **Audio:** continuous music bed under the whole clip (no silent gaps), ducked under speech, still delivered at
   -14 LUFS (YouTube turns louder masters down anyway).
7. **Packaging** (filename = caption, as usual):
   - **Title:** third-person curiosity gap, no names, trailing "…", 1-2 emojis, typically 😳 plus a topic emoji.
     Example: "He Waited 21 Years For This Moment… 😳🎤".
   - **Description:** 2-4 sentences retelling the story *with* the names, show and event, for search. No hashtags
     unless the user asks.
8. **QC:** `qc-sheet.sh` and a look at the frames: keyword colour visible, captions not over eyes or mouth, payoff not cut.

## Transitions and transition SFX (user rule, 2026-11-07)
- **Main choices, in every edit:** CapCut's 20 popular transitions: Pull In, Pull Out, Camera Shake, Whirl, Zoom In, Zoom Out, Blur, Glitch, Flash, Spin, Slide, Rotate, Shake, Zoom Blur, Distortion, Cube, Swipe, Wipe, Split, Light Leak. Pick every transition from these first, also when motion graphics are involved (split-screen panels, explainers, montages, slideshows, overlay cards): each scene change between shots or graphics uses one of the 20, not another engine's or the registry's version of the same name. Use another transition only when none of the 20 fits. CapCut name -> preset: the "Main set" table at the top of `motion-graphics-library/EFFECTS_INDEX.md` (`CAPCUT20` in `mgl.js`, ai-video-editor workspace).
- **Transition SFX:** only the user's sfxv2 pack (`sound effects/sfxv2/` in ai-video-editor; master copy `sfxv2/` in the vault repo). The user's files come first; `generated/` holds synthesized fallbacks, currently unused. Each of the 20 has its sound, peak and volume in `CAPCUT20`, and every file is 1.5 s or shorter. `build-shorts.js` adds the sound automatically with the hit on the cut, so never add a second whoosh for the same cut (`"sfx": false` on a transition skips it, `"sfxVol"` sets its volume).
- **Any other engine** (a hand-built HyperFrames composition, Remotion, ffmpeg, OpenMontage): run `node motion-graphics-library/mgl.js --capcut20`, port the transition's motion exactly (same values, durations and eases), and place its sfxv2 sound with the peak on the cut at its volume.
- **Motion graphics keep their own small sounds** (typing ticks, pops, shimmers, rises). The sound on a scene change is the transition's sfxv2 sound; the builder drops a panel split's synthesized hit where a transition sound already lands.
- The skill's or command's own limits still apply: transition sounds count toward its SFX cap, and its cut style (e.g. hard cuts by default) decides how many transitions there are. Not for the cartoon/3D animation skills (cartoon-audio-short, cartoon-3d-short, 3d-short).

## Rights reminder
PureGrit reuses TV and sports broadcast footage; that carries Content ID and reused-content risk. Only use sources the
user has permission to use, and flag any source that looks like a TV-network or league upload before building.
