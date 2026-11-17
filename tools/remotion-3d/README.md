# remotion-3d: the 3D shorts kit (3d-short / cartoon-3d-short)

A ready Remotion + three.js project, set up by `cloud/3d-bootstrap.sh` at session start (`npm ci`, pinned versions).
`src/videos/vasa/` is the Vasa short (2026-11-16) and the second template next to the skill's `templates/bridge/`.

## Reusable modules in `src/videos/vasa/`
| File | What it gives a new short |
|---|---|
| `ship.ts` | A lofted 17th-century warship: hull, two gun-port rows (red lids, bronze barrels), carved stern, decks, 3 masts, billowing/furled sails, flags. `halfW/deckAt/topY` for staging people on it |
| `story.ts` | `toWorld/shipMatrix` (ship space -> world with heel/pitch/sink), `shipPose` phases (dock, test roll, sailing heel + sink, night wobble, raise), crew-run timing, camera helpers (`rel` follows a moving subject without rolling), `wide/wideFrom` flags for the checks |
| `world.ts` | Harbour town (river = harbour, quay steps, mooring posts), ship + night bus interior, sky/fog/sun per light |
| `lights.ts` / `grade.ts` | `day`, `golden` and the `night` explanation preset |
| `toon.ts` | Extra cast: `sailor()`, `ADMIRAL`, `KING`, `NOBLE`, `PASSENGER`, `TOURIST()`; hats `cavalier`, `crown`; props `bagsLow/bagsUp/armsUp/point/shrug` |
| `cast.ts` | Crowds on a moving ship (`onShip`), quay crowd (cheer/shock), survivors at the steps, inquiry row, tourists, water-pour / wreck effects |
| `Bridge.tsx` | Software-GL safe renderer: frameloop "never" + one draw per frame, `draft` preset, lens passes always mounted |

Start a new short: `cp -r src/videos/vasa src/videos/<name>`, register it in `src/Root.tsx`, rewrite `story.ts` (shots, cameras), `cast.ts` (who is where) and the world layout.

## The loop (cloud, no GPU)
1. `bash scripts/check.sh <name>` (~4 min): typecheck + every frame's logic, lens inside/under geometry, foreground
   occluders, no character in frame. Must print OK. Writes `out/shots.json`.
2. `node scripts/sheet.mjs <Comp> 15` (~2 min): one-pass draft frames + sheets in `out/draft/` (send these to the
   verifier, never 2K stills), then `python3 scripts/lightcheck.py` (golden warm, night blue, day not dark).
3. `node scripts/boundary.mjs <Comp>` (~12 min): every shot change / crossfade rendered in the browser (catches
   mount/unmount crashes and blank frames before the long render).
4. `bash scripts/render.sh <Comp>` (detached, ~6-9 s/frame at 1440x2560): resumable 100-frame chunks, 3 retries per
   chunk, resumes itself after a container restart (`~/.render-job`). Run it with `setsid nohup ... &`.
5. `bash scripts/deliver.sh <Comp> <mix.wav> <out.mp4>`: join, re-time to exact 30 fps, assert the frame count, mux, QA.

## Final render = coldframe (the default for every 3D short; steps 4-5 are only the fallback)
`.github/workflows/coldframe.yml` renders a composition of this folder on up to 20 GitHub machines at once (same
settings as `render.sh`: 1440x2560, crf 16, swangle, 1 tab per machine) and checks the frame count. It renders what is
pushed to `main`, so commit and push first (including `public/`, which holds the Kenney models).
```bash
npx github:Razee4315/coldframe#da55531509d27399c70846df3e4e5793f922abf3 render VasaShort --repo gmacc616/yt-automation-vault --chunks 20
ffmpeg -v error -y -i out/cloud/<file>.mp4 -i <mix.wav> -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart <out.mp4>
```
- Downloads the silent MP4 to `out/cloud/`; `--no-wait` starts it and `coldframe download` fetches it later.
- Software WebGL at ~6-12 s/frame: a 67 s short (~2,000 frames) is ~4-6 machine-hours. 20 chunks finish in roughly
  20-35 min wall clock (plus ~1-2 min setup per machine). Private repo: that is ~300-400 of the 2,000 free minutes a month.

## Rules learned the hard way (Vasa)
- Never `frameloop="always"` (redraws ~10x per frame in software GL), never MSAA 0 or FXAA (blank frames), never mount or
  unmount post passes per shot (switching the lens passes on mid-render over-blurred whole shots; set cInf 0 instead).
- `renderStill` races the first frame: stills come from `renderFrames` (`sheet.mjs`, `seqstills.mjs`).
- Kenney models: kenney.nl blocks cloud downloads. The 26 models the kit loads (+ `Textures/colormap.png`, which the
  Fantasy Town models reference) are committed in `public/bridge/kenney/`; master copy in the vault's `Assets/kenney/`.
