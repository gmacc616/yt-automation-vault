# Effects catalog: sounds, transitions, overlays, camera moves, text animations

> **User rule (2026-11-07):** transitions come from CapCut's 20 first ("Main set" in `motion-graphics-library/EFFECTS_INDEX.md`), and transition sounds only from `sound effects/sfxv2/` (`CAPCUT20`). The whoosh/glitch/flash entries below are for non-transition moments.

The menu every editing skill picks effects from (/viral-shorts, /youtube-style-clip, /gab, /boxabl, /puregrit,
/commentary-short, HyperFrames jobs). It says what each effect is, where it lives, when it fits and how strong it is.
Built 2026-10-24 from what is actually in this repo; paths are from the repo root.

## 1. How to choose (in this order)

1. **The user's prompt wins.** If the request names an effect ("camera flash + shutter on the reveal", "no SFX",
   "glitch transition"), use exactly that, on the moment it names.
2. **Then the campaign brief and house-style limits.** They cap what the catalog may add. The measured look:
   cuts 0.8–1.6/s, **flashes at most 1–2**, **SFX at most ~6 (2 for brand campaigns)**, one grade, shake only on
   real impacts (`docs/clipping-playbook.md` §2). Briefs can ban more (BOXABL: no brand overlays across the action;
   DraftKings: its own rules). "No music" / "only narration" from the user also removes music and, unless they
   say otherwise, SFX.
3. **Then the catalog's best fit** for each remaining moment, using the "Use when" notes below.

Rules for every pick:
- **One effect, one visible moment, one reason** (impact, reveal, turn, transition, emphasis). Nothing decorative,
  nothing on a quiet line. More effects ≠ more views: the weakest measured Short had the most.
- **Sync sound to picture:** a shutter needs a flash or freeze on screen, a boom needs an impact, a whoosh needs
  motion or a cut, a riser must crest on the reveal.
- **Licenses:** only what is listed here or verified the same way. Credit CC BY music in the post.
- **Effect log:** every job report lists each effect: time, effect, where it came from, and why (see §8).

## 2. Built into the Shorts builder (`tools/pipeline/build-shorts.js`, set in `shorts.json`)

| Effect | Key | Use when | Strength |
|---|---|---|---|
| Punch-in (snap zoom) | `"punch": [[t, 1.15–1.3]]` (add a 3rd value for a smooth push) | a reaction face, a detail, a punchline | medium |
| Slow push-in | automatic (`"drift": false` to stop, `"driftScale"`) | keeps every held shot alive | subtle |
| White flash | `"flashes": [{"t": t, "color": "#fff"}]` | the teaser→story return, a big scene change or the final impact | strong (≤2) |
| Screen shake | `"shakes": [{"t": t, "d": 0.2–0.4, "amp": 10–20}]` | only a real impact or reveal, with a hit SFX | strong |
| Red arrow / circle | `"arrows": [{"t","d","x","y","rot"}]` or `{"kind": "circle", "r"}` | the object or face the line names | medium |
| Headline bar | `"headline": "… *KEYWORD* …"`, `"keyColor"` | always on in the ysc look | — |
| One-word captions | automatic; `"emphasis"` word indices, `"yscColor"`, `"yscAlt"`, `"capShift"` | every clip; emphasise 1–2 words | — |
| Callouts | `"callouts"`: `chip`, `stamp`, `plate`, `label` | a number or label that must be read | medium |
| Logo / badge / hook | `"logoImg"`, `"badge"`, `"hook"` | when a brief requires a logo or label | — |
| Sound effect | `"sfx": [{"t", "name"}]` (bundled) or `{"t", "file", "vol"}` (any sound below) | §3 | per sound |
| Grade | `reframe.py --grade ysc / ysc-soft / puregrit` | one per clip, set by the skill | — |

**Transitions, caption animations and overlays:** `motion-graphics-library/` (33 transitions, 15 caption animations, 16 overlays;
index `EFFECTS_INDEX.md`, choice guide `SELECTION_GUIDE.md`). Use those before the registry or hand-building.

## 3. Sound effects by purpose

Bundled names (`"name"`) are the 19 HyperFrames SFX in `.agents/skills/media-use/audio/assets/sfx/` (license:
`CREDITS.md` there). Files (`"file"`) are the commentary kit: `commentary-kit/sfx/generated/` (made for this repo)
and the Kenney packs in `commentary-kit/sfx/kenney/<pack>/Audio/` (**CC0**, free for any use, no credit).
Kenney files come in variants `_000`–`_004`: pick one; vary it if the same sound repeats.
**sfx-kit** (`commentary-kit/sfx/sfx-kit/sounds/<category>/`, Wyzowl, **CC0**, 320 WAVs in 28 categories: whooshes, swishes, risers/fallers,
reverse whooshes, impacts, cinematic hits, booms, pops, appear/vanish, shimmers, logo stings, digital/glitch, money, celebration, time, data…).
To choose one, read `sfx-kit/catalogue.md`; `sfx-kit/sounds.json` gives each sound's use / don't-use notes, length, sync point and level
(`GUIDE.md` explains placing the sync point on the cut). Path example: `"commentary-kit/sfx/sfx-kit/sounds/money/money-register.wav"`.

**User-supplied folder `sound effects/`** (repo root: three meme/editing/transition packs + loose files, licence NOT cleared; see its README): a default SFX source with sfx-kit (workflow step 4). Its `woosh-sound-effect.mp3` + `popular-riser-metallic-sound-effect.mp3` are the fixed opening/closing woosh and hook riser on every clip. For campaign clips prefer sfx-kit over recognisable brand/meme sounds.

**Paths in this table are short.** In `shorts.json` write the full path from the repo root:
`generated/x.wav` → `"commentary-kit/sfx/generated/x.wav"`, Kenney `<pack>/Audio/x.ogg` →
`"commentary-kit/sfx/kenney/<pack>/Audio/x.ogg"`. Example: `{"t": 3.2, "file": "commentary-kit/sfx/generated/camera_shutter.wav"}`.
The builder stops with "sfx file not found" if a path is wrong.

| Purpose | Best picks | Use when | Strength |
|---|---|---|---|
| Hard impact / slam | name `impact-bass-1`; file `generated/boom_impact.wav` (1.6 s) | a crash, drop, slam, headline hit | strong |
| Deep sub boom | file `generated/boom_deep_sub.wav` (3 s); name `impact-bass-2` (swell then hit) | the biggest reveal, after a silence | strongest |
| Punch / body hit | file `generated/punch_hit.wav`; Kenney `impact-sounds/Audio/impactPunch_heavy_00N.ogg`, `impactPunch_medium_00N.ogg` | a physical hit, a punchy word | strong |
| Material impacts | Kenney `impactMetal_*`, `impactGlass_*`, `impactWood_*`, `impactPlate_*`, `impactSoft_*`, `impactBell_heavy_*` | match the material on screen (metal wall, glass, wood) | medium–strong |
| Whoosh (cut / fast move) | names `whoosh-short`, `whoosh`; file `generated/whoosh_short.wav` | a hard cut, whip, slide, fast camera move | medium |
| Long whoosh / sweep | name `whoosh-cinematic` (5.5 s, peak on the cut); file `generated/whoosh_long.wav` | a scene or time jump | medium |
| Riser / build | **default short riser: file `generated/riser_metallic_1.7s.wav`** (the user's pick: a bright metallic build that cuts dead at its peak 1.63 s in, so start it 1.63 s before the cut); name `riser` (10 s: start 10.03 s before the peak); file `generated/riser_2s.wav`; sfx-kit `risers-and-fallers/riser-{1s,2s,4s}-{soft,strong}.wav`, `reverse-whooshes/*` | tension into the payoff | builds |
| Money / price | sfx-kit `money/money-register.wav` (till), `money-coin-drop.wav`, `money-coins-pour.wav`, `money-notes.wav` (counting bills), `money-card-tap.wav` | a price, a deal, a cost reveal | light–medium |
| Camera shutter | file `generated/camera_shutter.wav` (0.25 s) | **only** with a white flash, freeze frame or photo moment | light |
| Pop / appear | name `pop`; file `generated/pop.wav` | a chip, sticker, emoji or caption pop-in | light |
| Click / UI tap | names `click`, `click-soft`, `key-press`; file `generated/click.wav`; Kenney `interface-sounds/Audio/click_*`, `select_*`, `toggle_*`, `switch_*` | a tap, toggle, menu or cursor on screen | light |
| Zoom blip | file `generated/zoom_in_blip.wav` | a snap punch-in on a punchline | light |
| Glitch / digital | names `glitch-1` (punchy), `glitch-2` (harsh), `glitch-3` (subtle); file `generated/glitch_burst.wav`; Kenney `interface-sounds/Audio/glitch_*` | a glitch transition, a "malfunction", a sudden reveal | medium |
| Correct / win | file `generated/correct_chime.wav`, `generated/ding.wav`; name `chime`; Kenney `interface-sounds/Audio/confirmation_*` | the right answer, a success, a good number | light |
| Wrong / fail | file `generated/wrong_buzzer.wav`, `generated/slide_down_fail.wav`; name `error`; Kenney `interface-sounds/Audio/error_*` | a fail, a "no", a bad result | medium |
| Notification | name `notification`, `ping` | a message, badge or toast appears | light |
| Typing | name `typing` (1.5 s), `key-press` | text typing on screen | light |
| Sparkle / shine | name `sparkle` | a shiny product reveal or highlight sweep | light |
| Ticking clock | file `generated/clock_tick_4s.wav` (4 s) | a timer, a countdown, "how fast" stories | light |
| Suspense drone | file `generated/suspense_drone_12s.wav` (12 s) (PC only until the large files are pushed) | a slow tense build, under narration | bed |
| Censor bleep | file `generated/censor_bleep.wav` | bleeping a word (with a bar or blur on screen) | — |
| Record scratch / stop | Kenney `interface-sounds/Audio/scratch_*` | a "wait, what?" stop or freeze | medium |
| Footsteps | Kenney `impact-sounds/Audio/footstep_{concrete,wood,grass,snow,carpet}_*` | someone walking in on a quiet shot | light |
| Sci-fi / power-up / laser | Kenney `digital-audio/Audio/powerUp*`, `laser*`, `phaser*`, `zap*`; `sci-fi-sounds/Audio/forceField_*`, `explosionCrunch_*` | gaming, tech or playful moments only | medium |

Find more: `ls commentary-kit/sfx/kenney/*/Audio | grep -i <word>` (e.g. `impact`, `glass`, `door`, `engine`).

## 4. Overlays and transition clips (`commentary-kit/`)

Not one-line builder keys: add them as a HyperFrames edit in the generated project (§ "HyperFrames editing" in the
skill; blend mode in the file name).

| File | Length | Use when |
|---|---|---|
| `transitions/white_flash_0.4s_screen-blend.mp4` | 0.4 s | prefer the built-in `flashes`; this is the softer film-style flash |
| `transitions/static_glitch_0.5s.mp4` | 0.5 s | a glitch cut between chapters; pair with a glitch SFX |
| `overlays/film_grain_4s_overlay-blend.mp4` | 4 s loop | old footage or screenshots that look flat (20–40 %) |
| `overlays/vhs_scanlines_6s_screen-blend.mp4` | 6 s loop | a retro or "found footage" beat; never on a brand product shot |
| `overlays/vignette.png` | still | focus the eye on screenshots |
| `overlays/letterbox_bars.png` | still | a cinematic beat in 16:9 sources |
| `overlays/red_arrow_right.png`, `red_circle_highlight.png` | still | static versions of the built-in arrow and circle |

## 5. HyperFrames registry (456 ready-made items, installed per project)

Search before hand-building any named look: `bash tools/pipeline/hf.sh catalog --query "<what the moment does>"`
(English; see the hyperframes-registry skill), install inside the project with `bash tools/pipeline/hf.sh add <name>`
(needs the network), then wire it per that skill. Notable items by purpose:

| Purpose | Items |
|---|---|
| Transitions | `whip-pan`, `whip-pan-cut`, `match-cut`, `text-match-cut`, `zoom-through-transition`, `push-in`, `flash-through-white`, `beat-freeze-cut`, `directional-wipe`, `iris-reveal`, `chromatic-aberration-wipe`, `grid-pixelate-wipe`, `halftone-dissolve`, the `transitions-*` families (blur, light, push, scale, radial, distortion, destruction, 3d…) |
| Flash / light | `flash-through-white`, `light-leak`, `organic-light-leak-overlay`, `lens-flare`, `vfx-anamorphic-flare`, `light-sweep-pass`, `shimmer-sweep`, `editorial-flash-overlay`, `ridged-burn` (film burn) |
| Glitch / grain / retro | `glitch`, `rgb-glitch-text`, `chromatic-radial-split`, `grain-overlay`, `grain-field`, `warm-grain`, `filmed-screen` |
| Camera moves | `camera-shake`, `cinematic-zoom`, `camera-dolly-zoom`, `parallax-zoom`, `parallax-unzoom`, `motion-blur`, `focus-blur-resolve`, `yt-camera-move`, `stop-motion-cadence` |
| Particles | `confetti`, `sun-burst`, `snow`, `caption-particle-burst`, `particle-image-reveal` |
| Text / captions | `headline-slam`, `kinetic-type`, `typewriter`, `text-stagger`, `per-word-rise`, `caption-kinetic-slam`, `caption-pill-karaoke`, `caption-highlight`, `caption-emoji-pop`, `caption-glitch-rgb`, `caption-neon-glow`, `number-pop-in`, `number-wheel` (counters), `yt-lower-third` |
| Callouts | `hw-arrow`, `hw-callout-circle`, `yt-circle-pointer`, `marker-highlight`, `hw-underline`, `badge-pop`, `freeze-frame-dressing` |
| Social / UI mockups | `reddit-post`, `yt-comment-card`, `chat-thread`, `notification-stack`, `tiktok-follow`, `instagram-follow` |

The house look still decides captions: one-word ysc captions stay unless the prompt asks for another caption style.

## 6. Music (`commentary-kit/music/`, Kevin MacLeod, CC BY 4.0: credit from `music/CREDITS.txt`)

PC only until the large files are pushed. Off when the user says "no music" / "only narration".

| Mood | Tracks |
|---|---|
| Investigating, "the receipts" | Investigations, Sneaky Snitch, Scheming Weasel faster, Sneaky Adventure |
| Goofy, someone being ridiculous | Fluffing a Duck, Monkeys Spinning Monkeys, Pixel Peeker Polka - faster |
| Neutral bed | Wallpaper, Carefree, Thinking Music, Local Forecast - Elevator |
| Shady, dramatic | Hitman, Night on the Docks - Sax, Dark Fog |
| Tech | Aitech |

Cutting to a track: the beat-sync-editing skill (beats from `hf.sh beats`, never mid-word).

## 7. Fonts (`commentary-kit/fonts/`)

Anton, Bebas Neue (condensed headlines), Montserrat (variable; the ysc captions and headline). All OFL: free to use.

## 8. Effect log (in every job report)

One line per effect, in time order:

| Time | Effect | Source | Why |
|---|---|---|---|
| 0:02.4 | white flash + `whoosh-short` | built-in / bundled | teaser → story return |
| 0:12.3 | shake 0.3 s + `generated/boom_impact.wav` | built-in / kit | the car hits the roof |

This lets the user say "drop the shake at 0:12" or "stronger hit on the impact" and get exactly that change.
