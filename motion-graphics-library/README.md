# Motion-graphics library (CapCut-style effects for HyperFrames)

Reusable transitions, caption animations and overlays for this repo's HyperFrames Shorts builder
(`tools/pipeline/build-shorts.js`). The effects recreate the *feel* of popular CapCut effects with HyperFrames-native
techniques (GSAP on the composition's one paused timeline, CSS, SVG, synced duplicate video layers, freeze stills).
No CapCut assets or code are used.

**Before creating any transition or animation, read `EFFECTS_INDEX.md`.** If the effect exists, use it; if it
doesn't, add it to `mgl.js` (one `def`/`odef` entry), re-run the tests and regenerate the index.

## Files
| File | What it is |
|---|---|
| `mgl.js` | The library: `TRANSITIONS`, `ANIMATIONS` (captions), `OVERLAYS`, shared `CSS`, `makeCtx`, `apply`. Self-check: `node motion-graphics-library/mgl.js --selftest` |
| `EFFECTS_INDEX.md` | Every effect: name, category, what it does, defaults, use cases, test status (generated) |
| `USAGE_GUIDE.md` | How to use the effects in `shorts.json`, combine them, and use them in hand-built compositions |
| `SELECTION_GUIDE.md` | Which effect fits which moment (read during workflow step 4) |
| `COMPATIBILITY.md` | Versions, dependencies, limits, what isn't implemented |
| `examples/demo-shorts.json` | A `shorts.json` using every transition, caption animation and overlay |
| `tests/demo.js` | `build` the demo, `verify` a render pixel-by-pixel against a plain render, regenerate the `index` |

## How it plugs in
`build-shorts.js` loads `mgl.js` and reads three optional `shorts.json` fields per clip:
- `"transitions": [{ "t": 4.2, "type": "whip", "dir": "left", "intensity": 1 }]`: one entry per **scene change**, each type used once per clip.
- `"overlays": [{ "t": 6.0, "d": 1.5, "type": "counter", "to": 50000, "prefix": "$" }]`
- `"capAnim": "bounce"` or `"capAnims": [{ "t": 0, "anim": "punch-in" }, { "t": 5.1, "anim": "slide-up" }]`

The footage sits in `#cam > #fx > #a-roll`. Transitions animate `#fx`, so the builder's own drift/punch moves
(on `#a-roll`/`#cam`) and the fixed opening/closing zooms keep working underneath.

## Persistence
The library is in the git repo (`gmacc616/ai-video-editor`), so the PC and every cloud session get it. Renders and demo
media are not saved (`jobs/`, `videos/`, `output/` are gitignored); re-run `tests/demo.js build` to recreate them.
