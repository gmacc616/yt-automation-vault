---
name: film-passes
description: Pass-based finishing for a 3D cartoon short that cartoon-3d-short / 3d-short / cartoon-audio-short has already built. Runs named, one-at-a-time passes on the finished project, each with its own frame-sheet check and undo point - Camera (six camera styles or "auto pick"), Environment (richer set, Blender if installed, otherwise three.js), Post (haze, particles, DOF, bloom, grade), Shading (light zones on characters and set), Mix (sound design pass) - plus "fix this" edits aimed at a frame or a time range, and an optional nightly idea-to-video routine. Use when the user types /film-passes, asks for "a camera pass", "a better environment", "post processing", "shading pass", "redo the sound", "change the camera style", "fix frame 240" or "fix 0:12-0:18" on a 3D cartoon project, or wants Creatorize-style passes in our own pipeline.
---

# Film passes (finishing layer for our 3D cartoon shorts)

Our own take on the pass workflow that Creatorize shows publicly on creatorize.io (studied 2026-11-15, see vault note
`Claude/Sessions/2026-11-15 Creatorize research.md`). Nothing here comes from their paid files; only the public idea
(build first, then separate finishing passes, each checked against example frames, each undoable) is reused, on top
of the engine we already have in `cartoon-3d-short`.

Run it on a project that already renders: `src/videos/<name>/` (story.ts, world.ts, lights.ts, shade.ts, build.ts,
paint.ts, toon.ts, cast.ts, ink.ts, lensblur.ts, grade.ts, <Comp>.tsx) plus `~/<name>-short/` (voice, audio).
All `cartoon-3d-short` rules still apply (no captions, English, voice unchanged, mix music +3 dB / SFX -6 dB,
2K export, TEMP on the big drive, Opus verifier).

## How every pass runs
1. **Snapshot.** `git -C <remotion project> add -A src/videos/<name> && git commit -m "before <pass>"` (or copy the
   folder to `backup/<name>_<pass>_<time>/` if the project is not a repo). That commit is the pass's undo.
2. **Look first.** Render a frame sheet before touching code:
   `node scripts/bridge-stills.mjs out/<name>/pre_<pass>_ <8-12 frames spread over the film> 0.5` and write down
   what is weak, in numbers where possible (luma, chroma, px of blur, keys per shot).
3. **Change only the pass's files** (table below). One owner per file, as in the cartoon-3d-short look-match loop.
4. **Check.** Same frames again → side-by-side with `python scripts/sbs_sheet.py` (ours before / after / reference
   frames from `cartoon-3d-short/references/frames/`). A fresh Opus verifier scores the pass area out of 10 and lists
   fixes with frame numbers. Max 3 rounds per pass.
5. **Report** in one line what changed (like "One-shot camera: 23 shots became one path, 45 keys"), then stop and
   let the user pick the next pass. Never chain passes unasked, except in Routine mode.
6. Any pass that moves picture timing means re-running Mix.

| Pass | Files it owns | What it does |
|---|---|---|
| Camera | story.ts (CAMS, cuts, KICKS, DOF, FOREGROUND) | Re-shoots the film in one camera style |
| Environment | build.ts, paint.ts, world.ts | More detailed set around the existing blocking |
| Post | <Comp>.tsx composer, lensblur.ts, grade.ts, new post.ts | Atmosphere and film look |
| Shading | lights.ts, shade.ts, cardshade.ts | Light zones, shade, key and rim on characters |
| Mix | ~/<name>-short/audio/* | Sound effects on frames, music, final mix |

## Camera pass
Ask which style, or pick it yourself ("auto") after watching the frame sheet and reading the script tone.
- **Auto:** match the story. Comedy/history explainer → Classic Glide. Tense or spooky → Low Dread. Wonder, a chase,
  something flying → Long Take. Mystery → Far Lens. Sound or signal travelling → Follow the Signal.
- **Classic Glide** (our default, the bridge values): hard cuts on big jumps, smootherstep glides 18-40 f, creeping
  holds, flip kicks on impacts.
- **Low Dread:** hard cuts exactly on the stressed words, lens ~0.6 m high, 6-9° roll, slow 0.3-0.5 %/f push on
  every shot, narrower FOV (28-35°).
- **Long Take:** no cuts at all. One spline through every shot's framing (Catmull-Rom over the old CAMS keys, ~2 keys
  per second), speed eased so it never passes 25 px/f at 720p. Hide set or cast changes while the lens looks away
  (sky, a wall, a close prop).
- **Phone Cam:** one character is filming. Hand-held noise (2-octave value noise, 0.4-0.8° and 1-2 % position),
  close to faces, quick re-frames, occasional focus hunt. Keep it readable: no shake on punch words.
- **Far Lens:** something watches from far away. FOV 12-18°, camera 40-80 m off, behind foreground clutter, slow
  creep closer over the film, DOF on the subject only.
- **Follow the Signal:** the camera rides a sound/signal/object from place to place, passing through walls, water or
  pipes between scenes (a 6-10 f dark wipe through the solid). Good for science stories about waves.
- Every style keeps: reactions land 0-3 f before their word, no frozen holds ≥ 12 f, sight-line culling after the
  camera moves, props never closer than ~2 m to the lens.

## Environment pass
- First list what reads as empty: flat colours, lollipop trees, no far end, missing life.
- **If Blender is installed** (`blender --version`): model the extra set in a Python script
  (`out/<name>/env/build_env.py`, run with `blender -b -P`), export GLB to `public/<name>/env.glb`, load it in
  build.ts. Bake ink-friendly flat materials; no PBR shine. Blender is NOT installed on this PC as of 2026-11-15.
- **Otherwise** extend build.ts/paint.ts: far town silhouette layers, a landmark at the end of every long view,
  instanced foliage cards (thousands are fine with InstancedMesh) for close-ups, small life (birds, lamps, flags).
- Textures: painted Canvas2D in paint.ts (our house rule), or CC0 photos tinted down to the palette. No AI texture
  service unless the user sets one up.
- Ink must cover the new set (world ink layer), characters stay on NOINK. Up to 3 review rounds.

## Post pass
New `post.ts` with per-beat values read by the composer: haze that changes with camera height or story mood,
particles (pollen, dust bursts on impacts, rain, snow) as instanced sprites, DOF re-focus moves tied to the story,
bloom only on HDR emissives, a warm/cool grade that eases with the story turn, soft vignette. Grain stays OFF.

## Shading pass
Split each set into light zones (open sun, shade under trees/roofs, interior). Characters get the zone they stand in:
real shade under canopies, key from the open side, warm sun / sky-blue shadows by day, inner rim only at golden hour.
Never lavender lit faces, never brown shadows.

## Mix pass
Watch the final picture, list every event that should make a sound (with frame numbers), regenerate SFX with
sfx_gen.py, keep music under the voice, mix to the house levels, check loudness with short_qa.py.

## Fix a frame or a range ("click to change")
The user says "frame 240: the dog is floating" or "0:12-0:18 too dark". Convert time to frames (30 fps), render that
frame/range as a sheet, find the owning file from the table, make the smallest change, re-render the same frames,
show before/after. Snapshot first so every fix can be undone (`git revert`).

## Routine mode (optional, only when the user asks)
Nightly chain with the `schedule` skill: idea from `3d-short` research → script → voice → build → Camera (auto) →
Post → Mix → render → QA → leave the mp4 in `out/<name>/` and a note in the vault. No uploading, ever, without the
user. Stop and leave a note at the first failed check.
