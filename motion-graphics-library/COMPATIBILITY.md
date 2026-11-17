# Compatibility

- **HyperFrames:** CLI 0.8.157 (pinned in `tools/pipeline/hf.sh`). Effects use only documented features: `class="clip"`
  timing attributes, `data-media-start` on video/audio, one paused GSAP timeline in `window.__timelines["main"]`.
  `lint` uses a denylist, so `filter`, `clipPath`, `strokeDashoffset`, SVG `attr` and `innerText` (counters, with `snap`) are allowed.
- **GSAP:** 3.14.2 from the CDN line the builder already uses. No new dependencies were added.
- **ffmpeg:** used at build time to extract freeze stills (slide, push, wipes, reveals, split, breakup, freeze-frame).
- **Assets:** `static` needs `commentary-kit/transitions/static_glitch_0.5s.mp4` (rebuilt in the cloud by
  `cloud/session-start.sh`; on the PC it's skipped with a warning if missing). Everything else is generated.
- **Render cost:** blur/filter effects and the duplicate-layer effects (rgb-split, glitch, vhs, radial-blur) add
  decode work only inside their short windows. `wave-distort` uses an SVG displacement filter on the whole frame: the
  slowest preset.
- **Heavy layers:** HyperFrames warns when a composition holds ~40 elements with blur, radial-gradient or clip-path
  (renders can come out black). A normal clip (3–6 transitions, a few overlays) is far below that; the 33-effect demo is near it.
- **Freeze-still transitions** (slide, push, wipe, diagonal-wipe, circle-reveal, split-reveal, pip-in, breakup) show the
  outgoing shot's last frame as a still during the transition (0.4–0.6 s), the standard trick for single-track footage.

## Not implemented (and why)
| Requested | Status |
|---|---|
| Speed-ramp transition | Use HyperFrames' own `rate` automation lane (`/hyperframes-core`); a fake ramp would change source timing |
| Lens/ripple distortion, swirl, liquid reveal | `wave-distort` covers the liquid/wave look; true lens/swirl needs WebGL shaders (registry items `gravitational-lens`, `domain-warp-dissolve`, `cross-warp-morph` cover these) |
| Particle reveal, film grain | Use registry items (`grain-overlay`, particle blocks) via `hf.sh add`; `particles` here is a light decorative drift |
| Pixel distortion / pixelate | Needs canvas/WebGL; `breakup` and `glitch` cover digital breakup |
| Karaoke word highlight, beat-synced pulse | Need per-word or beat data: use `capAnims` per word group, `scale-pulse` at beat times from `hf.sh beats` |
| Charts, timelines, comparison layouts, location labels | Use registry blocks (`animated-bar-chart`, `bar-chart-race`, data blocks) |
| Lottie, Three.js | Not needed for these effects; no Lottie assets are installed |

## Persistence limits
The library lives in the git repo, so it exists on the PC and in every new cloud session. Edits made in a cloud
session are lost unless that session commits and pushes them.
