# Clipping playbook: everything learned so far (read before any edit job)

Shared by every editing skill (/youtube-style-clip, /gab, /boxabl, /puregrit, /commentary-short, /viral-shorts, and HyperFrames jobs). Each skill's own rules and the live campaign brief override anything here. The step-by-step process every job follows is `docs/editing-workflow.md`.

Sources:
- research and studies done 2026-10-18 → 10-20;
- evidence in `~/.claude/skills/youtube-style-clip/reference.md` and `~/.claude/skills/gab/reference.md`;
- channel numbers in `data/youtube/`.

## 1. Story first: what makes a clip
You're paid for views, and views only stick if the clip makes sense on its own and makes people feel something. **A clip is a sentence lifted from a paragraph.** It has to stand up without the rest of the video.

**Every clip is a complete mini-story:**
1. **Setup (cause):** who wants what, the question, the challenge. A stranger gets it within 3 s.
2. **Tension:** an attempt, doubt, negotiation, "you can't", a withheld answer.
3. **Reveal (effect):** the result, twist, punchline or reaction to it. End on it, so it loops.

**Shapes that work:**
- **Baffle first, explain after:** open on the most confusing or surprising line or image, rewind to the cause, pay it off.
- **Challenge → attempt → result.**
- **Question or offer → negotiation → answer.** The Clip Farm demo clip: a price negotiation ending "…I'll do it".
- **Claim → proof**, **ask → reaction.**
- **Stunt / "will it break?"** (the BOXABL hits).
- **Trend-jack:** "[creator] reacts to [trend]", only if the reaction has a point.

**Reject a moment when:**
- it needs earlier context (an inside joke, "like I said", an unexplained name);
- it's energy with no visible trigger, or a montage of unrelated shots;
- it stops before the answer, or gives the answer away with nothing left to find out;
- the story belongs to someone else, or a brief rule sits inside it.

**Standalone test** (all yes, before cutting and again on the final file):
1. Does a stranger get the first 3 s?
2. Does the opening raise a question, tension or surprise?
3. Is it one specific event, not just a topic?
4. Is the cause of every reaction or punchline in the clip?
5. Is the opening answered by the end, and not before?
6. Does the viewer know or feel something new at the end?
7. Would someone send it to a friend?
8. Does it work with the sound off (captions) and with the screen off (audio)?

**Stitching** non-contiguous parts is fine only *within the same story*, to remove dead space or detours. Meaning, and the order of cause and effect, stay intact. Never borrow a line from another scene to manufacture a story.

**Dead space is the number one retention killer.** Cut every pause, stutter, restart and preamble, unless a silence is the joke. J-cuts tighten joins.

**"The sizzle must meet the steak":** a big hook needs a middle and end that deliver.

Write `candidates.md` before cutting. For each pick: setup / tension / reveal timestamps, "this clip is about…" in one line, the test result, and risks. List rejects and why.

**Judging the shortlist on long sources** (ideas from SupoClip's picker, 2026-10-25; `score-moments.js` already does the clean sentence bounds and overlap removal):
- **Read in windows, then compare across them.** Sources over ~20 min: read `segments.txt` in ~12-min windows with ~2 min overlap and pick the best stories inside each, so late moments get the same attention as early ones. Then rank **all** candidates against each other in one pass: scores given window by window aren't comparable.
- **Comparative scores, spread out.** The best candidate usually lands at 80–95; weak, contextless or filler ones go below 50. Never give everything 70.
- **Score four parts, 0–25 each, in `candidates.md`:** hook (does the first line or image stop a scroller), engagement (emotion, humour, energy), value (a concrete number, detail or lesson), shareability (would someone send it). Add the hook type: question / statement / statistic / story / contrast.
- **Expand before you shrink.** If a strong moment is too short or lacks its cause, first add the neighbouring lines that hold the setup, then trim dead space. Accept a short clip only when it already has full setup and payoff.
- **Auto-reject:** intros, sponsor reads, calls to action, repeated points, vague setups, and answers whose question isn't in the clip.
- **Sanity check on count:** good sources yield roughly one strong story per ~5 minutes. Far more than that usually means weak or repeated picks crept in; re-run the standalone test. This is a check, not a cap: keep every pick that truly passes.
- **Past results only break ties** (and only when the user asked for analytics): they never justify a weak moment or a stretched timestamp.
- **Accuracy beats virality** whenever the two conflict.

**History:** a /gab run on 2026-10-20 copied example-clip packaging (a quote + beat drop + unrelated montage) and the user rejected it: "it doesn't have a story or context". Learn principles from references; never copy their look as a substitute for a story.

## 2. Packaging that measured best (the /youtube-style-clip look)
The user's preferred look, from 10 top BOXABL Shorts (28–38K views vs 1–3K):
- **Length:** 15–35 s for a story (10–17 s for a single stunt). Viewers on this channel leave at ~0:15, so long feature tours fail.
- **Frame 1 mid-action:** a face, a stunt, the strongest line. No title card, logo or still frame.
- **Headline bar:** black, ≤6 words, one red/yellow keyword, a curiosity hook that builds intrigue without spoiling the reveal and without adding claims.
- **Captions:** one word at a time, synced to the original speech, mid-frame, outlined, never over faces, logos or disclosures.
- **Cuts and effects:**
  - hard cuts about 0.8–1.6/s;
  - punch-ins on reactions and a slow push-in on held shots;
  - one grade; at most 1–2 flashes;
  - at most ~6 SFX (2 for DraftKings/gab), only where the story turns or pays off.
- **Sound:**
  - one continuous bed, −14 LUFS, small LRA, no silence;
  - speech on top; music low, almost inaudible under speech, matched to the vibe, lifted at the reveal.
- **More effects ≠ more views:** the weakest Short measured had the most cuts, SFX and flashes.
- **The effects menu:** pick sounds, transitions, overlays, camera moves and text animations from
  `docs/effects-catalog.md`. Order: the user's prompt first, then the brief and house-style limits, then the catalog's
  best fit. Every job report includes its effect log (time, effect, source, why).

## 3. Rules that keep clips paid and safe
- **Read the campaign brief fresh every job.** Check: allowed sources, tags/hashtags, logos, AI and voiceover rules, audience rules, exclusions.
- **Brand assets:**
  - use official logos unaltered, never recoloured, never lifted from example videos;
  - if a variant is missing, ask before downloading it from the brand's own link.
- **No AI voiceover** unless the brief allows it. Never use detection-evasion tricks (mirroring, pitch or speed shifts, noise). Being transformative comes from framing, story, headline and edit.
- **Check every frame for:**
  - third-party logos (team caps, jerseys, storefronts, other brands on clothes);
  - other big creators (crop them out);
  - alcohol, nicotine or drugs; minors.
- **Check every line of** speech, on-screen text and caption **for** curses (`tools/pipeline/clean-check.py`), betting or bonus language, and sponsor reads.
- **Music:** licensed, instrumental, no cursing lyrics.
  - `commentary-kit/music/` (Kevin MacLeod) is CC BY 4.0, so posts need the credit line from `CREDITS.txt`.
  - Never rip copyrighted songs.
- **YouTube:** don't tick "paid promotion" on uploads (the user's standing choice). Made for kids: No. Altered content: No.
- **Before publishing or scheduling:** confirm with the user first.

## 4. Workflow lessons (things that went wrong once)
- **Crop from frames of the cut clip** (`tight.mp4`), not the source. Input seeking lands a fraction of a second off, and earlier crops missed the subject.
- **Pan** when the subject moves. Skip camera whips no crop can hold.
- **Whisper mishears** names and words ("Chetty" = Cheddy, "the strip" = this trip, dropped "go"). Fix the captions to what was actually said, and re-transcribe the final to confirm it's clean.
- **A cut that starts mid-sentence** can leak a syllable of the previous word: start a few frames after it ends.
- **HyperFrames:** animate only transforms and opacity (letter-spacing tweens fail `hf.sh check`). `render-shorts.sh` never overwrites, so recycle old files before re-rendering.
- **This PC has 3.6 GB RAM:** transcribe with base.en, run long jobs in the background, at most ~3 renders at once.
- **The built-in browser can't attach local files**, and popups block its navigation. Studio uploads need the user to drag files in; don't press Escape or Back on the upload dialog's first step.
- **Channel facts (2026-10-19):**
  - 79.6% swipe away; the one Short pushed was a 20 s celebrity moment;
  - the audience was mostly the Philippines;
  - US/tier-1 posting slots are 12:00 AM or 7:00 AM Singapore time (+1 h after Nov 1). See `data/youtube/strategy-us-tier1.md`.
