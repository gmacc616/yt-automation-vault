# Usage guide

## 1. In a Shorts job (the normal way)
Add the fields to the clip in `shorts.json`, then build as usual:

```json
{"clip01": {
  "title": "BOXABL ships a house on one truck @boxabl", "style": "ysc", "headline": "HOW DOES IT *FIT*? 😳",
  "hookEnd": 2.4,
  "transitions": [
    {"t": 3.1, "type": "whip", "dir": "left"},
    {"t": 6.8, "type": "light-leak"},
    {"t": 10.2, "type": "circle-reveal"}
  ],
  "capAnims": [{"t": 0, "anim": "punch-in"}, {"t": 3.1, "anim": "slide-up"}, {"t": 6.8, "anim": "bounce"}],
  "overlays": [
    {"t": 7.5, "d": 1.6, "type": "counter", "from": 0, "to": 60000, "prefix": "$", "suffix": " (2023)"},
    {"t": 11.0, "d": 1.4, "type": "box", "x": 260, "y": 820, "w": 560, "h": 420}
  ],
  "fixes": {}, "emphasis": [], "punch": [], "sfx": [], "callouts": []}}
```
```bash
node ../../tools/pipeline/build-shorts.js ../../videos/<project> clip01
bash ../../tools/pipeline/hf.sh check ../../videos/<project>/clip01
```

Rules the builder enforces:
- `t` must be inside the clip. A transition `type` can't repeat in one clip (one different transition per scene change); add `"allowRepeat": true` only if the user asks.
- Unknown names fail the build with a pointer to `EFFECTS_INDEX.md`.
- Missing kit assets (e.g. `static` needs `commentary-kit/transitions/static_glitch_0.5s.mp4`) skip that effect with a warning.

Common parameters: `intensity` (0.5 subtle … 2 strong), `d` (seconds), `dir` (`left|right|up|down`), `color`.
Overlay coordinates are canvas pixels (1080×1920). Leave the bottom ~20% and right edge clear (Shorts UI).

## 2. Combining
- One transition per scene change, plus at most one or two overlays per scene.
- Transitions own `#fx`; `scale-pulse`, `glow-pulse` and `handheld` also use `#fx`, so don't place them on top of a transition window.
- Pair transitions with sound: whip → woosh/swish, white-flash → camera shutter, flash-impact → boom, glitch/rgb-split → glitch SFX, counter → money/data sounds (`docs/effects-catalog.md`).

## 3. In a hand-built HyperFrames composition
```js
const mgl = require("./motion-graphics-library/mgl.js");
const ctx = mgl.makeCtx({ video: "assets/base.mp4", freezeFrame: (t) => "assets/freeze.jpg", asset: (p) => null });
const fx = mgl.apply({ D: 20, ctx, transitions: [{ t: 5, type: "zoom-blur" }], overlays: [] });
// put fx.below before #fx, fx.inFx inside #fx after the video, fx.above after #fx, fx.js into the timeline, mgl.CSS into <style>
```
Caption animation only: `mgl.ANIMATIONS["bounce"].js("#myCaption", 3.2, 1)` returns a GSAP line for the timeline `tl`.

## 4. Test after changing the library
```bash
node motion-graphics-library/mgl.js --selftest
node motion-graphics-library/tests/demo.js build
bash tools/pipeline/hf.sh check videos/mgl-demo/transitions
bash tools/pipeline/render-shorts.sh videos/mgl-demo <outDir> base transitions overlays
node motion-graphics-library/tests/demo.js verify <outDir>
node motion-graphics-library/tests/demo.js index
```
