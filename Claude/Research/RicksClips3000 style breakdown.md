# RicksClips3000: style breakdown (20 latest Shorts)

Studied 2026-11-04. Channel: https://www.youtube.com/@RicksClips3000 (Shorts only, no long-form tab). Full scripts: [[RicksClips3000 transcripts]].

**How this was studied.** All 20 downloaded at source quality (1080×1920, native 30 fps, H.264 + AAC). Every frame (30 fps) measured by script: brightness, contrast, black/white points, saturation, colour balance, centre vs edge light, frame-to-frame motion. Hard cuts found with ffmpeg `scdet`. 1-fps contact sheets of all 20, plus 30-fps strips around transitions, inspected by eye. Word-timed Whisper transcripts. Loudness by EBU R128. **Limits:** Claude can't hear audio, so music and SFX are inferred from loudness and YouTube's `[music]` caption tags, not listened to. Raw data was in `C:\Users\manth\yt-research\RicksClips3000` (deleted 2026-11-04 after the move to the cloud; re-download with yt-dlp if needed).

## Snapshot
- 20 Shorts from 2026-10-14 to 2026-11-01: about **one a day**, two on some days.
- Views: 110K to 31.3M. Median about 8M. Top: *The Ancient Jar That Warned an Empire* 31.3M, *Why Perfect Railroads Don't Work* 17.6M, *The Job Nobody Wants in Japan* 16.4M.
- **Format shift:** the older Shorts (10-14 to 10-17) are 30–47 s "how X works" explainers. From 10-18 on, nearly all are **55–78 s character stories with a real-world twist**, and that's where the big numbers are.
- Flops: *The Science Behind Slot Machines* 110K (31 s, explainer), *How Painkillers Actually Work* 299K (34 s, explainer), *Every Memory Has a Price* 458K (78 s, fantasy with no real-world reveal, darkest video). Lesson: **a story with a character plus a true fact revealed at the end beats a pure explainer or pure fiction.**

## Visual look
- **2D characters in 3D worlds.** Flat, hand-drawn round-head characters: white circle head, dot eyes, thick black outline, stick limbs, a hat or hair that says the role (engineer cap, bowler hat, nightcap, crown). They're composited as flat cut-outs into fully rendered, stylised 3D sets (canyons, palaces, casinos, snowy towns, ships). Props are 3D and slightly toy-like (gold dragons, bronze jar, steam trains).
- Expressions change in a few frames: squint, smug half-lid, sweat drop, steam puffs, face turning purple with anger. Small motions (head bob and tilt, a smile) loop while the character talks.
- **Text props carry information:** newspapers ("THE CLICKETY CLACK LINE!"), death certificates, signs ("FIRST LINE IN GETS IT ALL!"), ledgers with SOLD stamps, gauges. They're readable for about a second and do the job of on-screen text.

## How it's built (render forensics, 2026-11-04)
Question asked: is it Three.js? **Nothing in the frames points to Three.js specifically, and the exact tool can't be read from pixels.** YouTube re-encodes and strips tool metadata; the file only says "Google / Lavf". What the frames do show:
- **The worlds are real 3D scenes.** Props, gravestones and signs keep their shape and readable text through big camera moves, with correct parallax. The camera flies through the space.
- **The characters are 2D cut-outs on camera-facing cards (billboards).** In *Perfect Railroads* (1.6–3.0 s) the camera swings about 90° around the engineer. The rails go from receding to crossing the frame, but he stays front-facing and never foreshortens. His animation is 2D (drawn expressions and poses swapping on the card). Some props are cards too: the crosses and gravestones in *Grave Bell*, whose snow caps are separate flat white ovals floating above them.
- **Fake blob shadows.** Characters and flat props cast a soft oval blob, not a silhouette-shaped shadow. This is the standard game-engine trick for sprites in 3D.
- **The cards are lit by the scene.** Characters pick up the scene's colour (blue at night, warm rim and bloom in sun), so they're lit materials, not overlays added in the edit.
- **Higher-end rendering features:** rack focus and depth of field, camera motion blur on whips, bloom, volumetric-looking fire and smoke (railroad explosion), and a rain-lashed ocean with a breaking wave. These are easy in Blender (Eevee or Cycles), Unreal or Unity. In Three.js they need custom post-processing plus pre-rendered fire and smoke flipbooks: possible, but uncommon.
- **Verdict:** 2D animated characters as billboards inside 3D environments, rendered with a cinematic camera. Blender, Unreal or Unity fit best; Three.js is possible but unlikely. Building this many new, detailed worlds every day suggests reused asset kits or AI-generated 3D and textures; that's a guess, not visible in the frames.
- **For us:** this is reproducible. Use a 3D scene (Blender, or Three.js inside HyperFrames, which supports Three.js) with our own 2D character PNG sequences on billboard planes, blob shadows, and a keyframed camera. Three.js in HyperFrames is the closest fit to our existing render pipeline.

## Lighting, contrast, shadow (measured over every frame)
| Metric (0–255 scale) | Average across 20 | Meaning |
|---|---|---|
| Mean brightness | 117 (range 84–151) | Midtone exposure, never dark or blown |
| Contrast (luma std-dev) | 52 | Medium-high, punchy but not harsh |
| Black point (5th pct) | 41 | **Blacks are lifted**: no crushed shadows, soft matte look |
| White point (95th pct) | 207 | **No clipped whites**: highlights roll off |
| Saturation | 0.48 | High, candy-coloured |
| Centre ÷ edge brightness | 1.36 | **Subject lit brighter than edges**, a built-in vignette or spotlight |
| Warmth (R − B) | +16 | Warm overall, but varies a lot by scene |

- **Lighting tells the story's time.** Each beat gets its own time of day or light: warm gold interior for the setup, bright noon exterior for normal life, pink/orange sunset for decline or exile, **deep blue moonlight for tension**, then dawn haze or golden morning for the aftermath. *The Jar* (31M) goes palace gold → daylight → sunset exile → blue night (balls drop) → hazy morning rubble → warm lamplit mechanism reveal. *The Grave Bell* goes dusk gold → blue snowy night with warm candle windows → purple dark interior → green daylight flashback → peach sunrise.
- **Warm practicals against a cool ambient**: candles, lanterns, glowing windows and train headlights pop against blue night. It's the classic orange/teal split, done with light sources inside the scene.
- Toon-shaded 3D: soft key light, gentle gradients on props, soft drop shadows from characters onto the ground, light bloom and god-rays around bright sources, mild depth of field (background softly blurred in close-ups).
- Low performers break this: the slot-machine Short stays in one red/orange casino set with no lighting arc, and *Every Memory* is almost all night-blue (mean brightness 91).

## Camera, movement, cuts
- **Practically no hard cuts.** `scdet` finds 0–1 hard cuts in 17 of the 20 videos (average 0.9 per video). Yet the **set or framing changes about every 1–3 s** (judged by eye from the 1-fps contact sheets). Almost every change is a continuous camera move.
- The camera is **always moving**. Median frame-to-frame change is 7.7 (of 255), and only ~14% of frames are near-still. Moves: slow push-ins on faces, orbits around a prop, crane up and over a ledge, pull-backs to reveal scale (the canyon, the palace army), POV dolly down train tracks.
- **Transition types (seen at 30 fps):**
  1. **Fly-through whip**: a fast forward dolly with heavy directional motion blur over 6–10 frames that lands in the next location (desert → train station dome).
  2. **Occlusion wipe**: a cliff wall, train boiler or doorframe passes the lens and the next shot is behind it.
  3. **Move-past reveal**: the camera keeps travelling past the character, tilts up and reveals the next set piece.
  4. **Quick dissolve** (~4–6 frames) into a push-in, used for flashbacks and "you see" explanations (the death-certificate close-up).
- Close-ups swing wide: big-head close-ups for reactions and dialogue, extreme wides for scale ("an army", "a canyon so deep").
- The climax is usually a big physical payoff: an explosion (railroad), a wave swallowing a ship, a palace in rubble, a seismic cross-section glowing.

## Captions
- **One word to three words at a time**, word-synced to the voice. White, heavy rounded sans (Montserrat ExtraBold / Gilroy Heavy style) in sentence case, with a **thick black outline** and a soft shadow.
- Centred horizontally at **~70% of frame height** (about y=1350 of 1920), under the character's face and above the UI. About 60 px cap height at 1080 wide.
- No coloured keywords, no emoji, no pop animation beyond the word swap. Captions are clean and the visuals do the energy.

## Audio
- Every video is mastered to **−14 LUFS integrated** (−15 on some older ones), true peak about −2 dBTP, loudness range only 1.6–3.2 LU: one constant, even level, exactly the YouTube target.
- A single male narrator, conversational and fast: **3.7 words per second** on average (3.4–4.1). The voice starts on **frame 0** (no intro) and the video ends **0.1–0.5 s after the last word** (hard stop on the punchline, so the loop restarts immediately).
- A music bed is present (YouTube tags `[music]` mid-video), most likely swelling at the twist. The low loudness range says it stays well under the voice. SFX are not measurable without hearing them; the visuals (clicks, bells, explosions) suggest on-action SFX.

## Script formula
About 200–250 words for ~60 s (older explainers 110–165 words for 30–45 s). Short, spoken sentences: 11–17 words on average.

**1. Hook (first sentence, 2–4 s): an impossible-sounding action by "He" or "A man".** 11 of 20 open this way:
- "He sawed gaps into a railroad every 39 feet."
- "He poured cooking oil into the sea…"
- "He bet his life savings on the slowest horse in the race."
- "A knight paid a priest to forgive a crime he hadn't committed yet."
- "They buried a man alive with a bell tied to his finger."
- Variants: the forbidden object ("There's a button… nobody's allowed to press it"), the paradox rule ("The fastest gun in the West had one rule, never draw first"), the counter-intuitive claim ("If your ship got hit by a cannonball, you'd be one of the lucky ones"), the direct challenge ("Look at these two scratch cards. One's a winner…").
- The hook states the **ending's action without its reason**. The whole video pays off "why would anyone do that?"

**2. Fast context with "You see," (~3–8 s).** Often the second sentence, to drop the world rules in one line: "You see, two companies are racing to build a railroad…"

**3. Ridicule and stakes (middle 40%).** Everyone mocks the hero, repeatedly, with funny quoted lines:
- "You're wrecking my railroad."
- "Pal, that horse lost a race to the milk cart, and it was pulling the milk cart."
- "Hey, it's the toy guy. Did your frogs get hungry again?"
- The rival or "normal" way wins at first. The mockery escalates in 2–3 steps, with time markers ("In May… By July… On the hottest day anyone can remember…").

**4. Mid-roll question to hold retention (~50–65%).** A voiced audience doubt: "Wait, what's a mirror going to do?", "Wait, practiced?", "How is that possible?", "But how?". Usually 0–2 questions per video.

**5. Real-world reveal with a second "You see," (65–90% in).** The true historical fact or physics, explained with **one everyday analogy**: blowing on soup (storm oil), catching a falling phone (reflex), an elevator's buttons (Benford's law), a house full of smoke alarms (painkillers). Phrases: "You see, back then…", "You see, in real life…".

**6. Punchline-ending (last 1–2 sentences).** It snaps back to the hook's image, with a reversal or irony, and the video cuts on the last word:
- "…right as a train rolls onto it."
- "The crime he'd paid to be forgiven for was robbing the man who sold it to him."
- "…and the house was all hers."
- No call to action, no "follow for more".

**Language habits:** second person to put the viewer in it ("Imagine you're standing in the street at noon…"); casual comic exaggeration ("he'd lose a race to the saloon against a guy carrying two beers"); concrete numbers (39 feet, 47 scratches, 1 inch, 90%); repetition with variation (47 scratches → 48 scratches); everything in present tense for the story and past tense for the history.

## Recipe for our channel
Use this as inspiration, not a copy. Design our own characters and worlds, and write our own stories.
- **Topic:** a real historical or scientific trick, told as a story about one person whose action looks stupid until the end. Avoid pure explainers and pure fantasy.
- **Length:** 55–65 s, ~220 words at ~3.7 wps. First word on frame 0, cut on the last word.
- **Beats:** absurd-action hook → "You see" context → 2–3 rounds of mockery with time markers → "Wait, …?" → "You see, in real life…" plus one everyday analogy → ironic one-line ending.
- **Visuals:** a new framing every 1–3 s, but joined with camera moves and blur whips, not hard cuts. A time-of-day colour arc per beat, warm practicals against cool ambient light, lifted blacks, no clipped whites, a centre-bright vignette, high saturation.
- **Captions:** 1–3 words, white with a thick black stroke, at ~70% height.
- **Mix:** −14 LUFS, voice on top, music bed well under it.
- **Fit with our skills:** [[2026-11-04 YouTube automation channel skills]] lists cartoon-audio-short (Kokoro voice, MP4 build). Its 2D style can't produce the 3D-set look. The closest we can get locally is HyperFrames parallax and camera moves over layered 2.5D backgrounds with flat characters. A true 3D pipeline (Blender or similar) would be a separate build.
