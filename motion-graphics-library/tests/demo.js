// Demo + regression test for the motion-graphics library.
//   node motion-graphics-library/tests/demo.js build            -> jobs/mgl_demo + videos/mgl-demo/{base,transitions,overlays}
//   bash tools/pipeline/hf.sh check videos/mgl-demo/<project>     (each must pass)
//   bash tools/pipeline/render-shorts.sh videos/mgl-demo <outDir> base transitions overlays
//   node motion-graphics-library/tests/demo.js verify <outDir>   -> per-effect pixel difference vs the plain "base" render
// The test video has numbered scenes (hue + number change every SCENE seconds) so every transition sits on a scene change.
"use strict";
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const mgl = require("../mgl.js");
const ROOT = path.resolve(__dirname, "../.."), JOB = path.join(ROOT, "jobs", "mgl_demo"), OUT = path.join(ROOT, "videos", "mgl-demo");
const SCENE = 1.6, TRANS = Object.keys(mgl.TRANSITIONS), OVER = Object.keys(mgl.OVERLAYS), ANIMS = Object.keys(mgl.ANIMATIONS);
const D = { base: (TRANS.length + 1) * SCENE, transitions: (TRANS.length + 1) * SCENE, overlays: (OVER.length + 1) * SCENE, combo: 15, capcut20: (mgl.CAPCUT20.length + 1) * SCENE };
const cutsFor = (n) => Array.from({ length: n }, (_, i) => +((i + 1) * SCENE).toFixed(3));

function makeClip(name, dur) {
  const d = path.join(JOB, name); fs.mkdirSync(path.join(d, "t"), { recursive: true });
  const font = ["C:/Windows/Fonts/arialbd.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"].find(fs.existsSync).replace(":", "\\:");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `testsrc2=s=1080x1920:r=30:d=${dur}`, "-f", "lavfi", "-i", `sine=f=220:d=${dur}`,
    "-vf", `hue=h='floor(t/${SCENE})*47':s=1.6,drawtext=fontfile='${font}':text='SCENE %{eif\\:floor(t/${SCENE})+1\\:d}':fontsize=150:fontcolor=white:borderw=10:x=(w-tw)/2:y=760`,
    "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path.join(d, "base.mp4")]);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `anoisesrc=d=${dur}:a=0.01`, "-ac", "2", path.join(d, "music_duck.wav")]);
  // One caption word per scene so caption animations can be shown too.
  const n = Math.round(dur / SCENE);
  fs.writeFileSync(path.join(d, "t", "transcript.json"), JSON.stringify(Array.from({ length: n }, (_, i) => ({ text: i ? `word${i}` : "Hook.", start: +(i * SCENE + 0.2).toFixed(2), end: +(i * SCENE + 0.9).toFixed(2) }))));
}

function build() {
  fs.rmSync(JOB, { recursive: true, force: true }); fs.rmSync(OUT, { recursive: true, force: true });
  const spec = {}, reframe = {};
  for (const name of Object.keys(D)) {
    makeClip(name, D[name]);
    reframe[name] = [[0, 0, null], ...cutsFor(Math.round(D[name] / SCENE) - 1).map((c) => [c, c, null])];
    spec[name] = { title: `mgl ${name}`, style: "ysc", headline: `MGL *${name.toUpperCase()}*`, hookEnd: 0.9, drift: false, fixes: {}, emphasis: [], punch: [], sfx: [], callouts: [] };
  }
  spec.transitions.transitions = TRANS.map((type, i) => ({ type, t: cutsFor(TRANS.length)[i] }));
  spec.transitions.capAnims = ANIMS.map((anim, i) => ({ t: i * SCENE * 2, anim }));
  // The user's main set in order, each with its sfxv2 sound (added by the builder): the clip to watch and listen to.
  spec.capcut20.transitions = mgl.CAPCUT20.map((x, i) => ({ type: x.type, t: cutsFor(mgl.CAPCUT20.length)[i] }));
  spec.overlays.overlays = OVER.map((type, i) => ({ type, t: +((i + 1) * SCENE - 0.6).toFixed(2), d: 1.2 }));
  // A realistic 15 s clip: 5 different transitions, per-scene caption animations, overlays, fixed open/riser/loop.
  Object.assign(spec.combo, { hookEnd: 2.1, drift: true,
    transitions: [{ t: 3.2, type: "whip", dir: "left" }, { t: 4.8, type: "light-leak" }, { t: 8.0, type: "glitch" }, { t: 9.6, type: "circle-reveal" }, { t: 12.8, type: "punch-zoom" }],
    capAnims: [{ t: 0, anim: "punch-in" }, { t: 3.2, anim: "slide-up" }, { t: 8.0, anim: "typewriter" }, { t: 12.8, anim: "bounce" }],
    overlays: [{ t: 5.4, d: 1.6, type: "counter", from: 0, to: 60000, prefix: "$" }, { t: 10.2, d: 1.4, type: "box", x: 240, y: 700, w: 600, h: 420 }, { t: 13.2, d: 1.2, type: "speech-bubble", text: "NO WAY!" }, { t: 11.0, d: 1.4, type: "label", x: 300, y: 1100, text: "HERE" }],
    arrows: [{ t: 6.6, d: 1.2, x: 700, y: 1000, rot: -20 }, { t: 7.2, d: 0.6, kind: "circle", x: 540, y: 900, r: 140 }] });
  fs.writeFileSync(path.join(JOB, "shorts.json"), JSON.stringify(spec, null, 1));
  fs.writeFileSync(path.join(JOB, "reframe.json"), JSON.stringify(reframe));
  execFileSync("node", [path.join(ROOT, "tools/pipeline/build-shorts.js"), OUT, ...Object.keys(D)], { cwd: JOB, stdio: "inherit" });
  fs.copyFileSync(path.join(JOB, "shorts.json"), path.join(__dirname, "..", "examples", "demo-shorts.json"));
}

function frameAt(file, t) {
  return execFileSync("ffmpeg", ["-v", "error", "-ss", String(Math.max(0, t)), "-i", file, "-frames:v", "1", "-vf", "scale=216:384", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
}
// % of footage pixels (below the 300 px headline bar, which differs between demo projects) whose colour changed by > 40 in any channel.
const diff = (a, b) => { const W = 216 * 3, y0 = 64; let n = 0, c = 0; for (let i = y0 * W; i < a.length; i += 3, n++) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 40) c++; return (100 * c) / n; };

function verify(outDir) {
  const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".mp4"));
  const pick = (k) => path.join(outDir, files.find((f) => f.toLowerCase().includes(k)));
  const base = pick("mgl base"), tr = pick("mgl transitions"), ov = pick("mgl overlays");
  const rows = [];
  const check = (file, name, t, d) => { // max difference vs the plain render over the effect window
    let m = 0; for (let k = -0.5; k <= 0.5; k += 0.25) { const at = t + k * d; m = Math.max(m, diff(frameAt(file, at), frameAt(base, at))); }
    rows.push({ name, t, score: +m.toFixed(2), ok: m > 0.5 });
  };
  TRANS.forEach((type, i) => check(tr, `transition:${type}`, cutsFor(TRANS.length)[i], mgl.TRANSITIONS[type].defaults.d));
  OVER.forEach((type, i) => check(ov, `overlay:${type}`, (i + 1) * SCENE - 0.6 + 0.4, 0.6));
  for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(28)} t=${String(r.t).padEnd(6)} changed=${r.score}%`);
  const bad = rows.filter((r) => !r.ok);
  console.log(`${rows.length - bad.length}/${rows.length} effects visibly change the picture`);
  fs.writeFileSync(path.join(__dirname, "last-verify.json"), JSON.stringify({ date: new Date().toISOString(), rows }, null, 1));
  if (bad.length) process.exitCode = 1;
}

// EFFECTS_INDEX.md is generated from mgl.js + the last verify run, so it never drifts from the code.
const USES = {
  "zoom-in": "hype beats, jumping closer to the action", "zoom-out": "revealing the bigger picture, scale reveals", "punch-zoom": "a strong statement or reaction landing",
  "snap-zoom": "comedic beat, sudden focus", "zoom-blur": "energetic scene jumps, sports", "push-in": "building tension, architecture and product shots", "pull-out": "revealing context, the whole home or space",
  spin: "playful or chaotic moments", whip: "fast scene/location change", slide: "clean sequential steps, before/after", push: "list items, next-step changes",
  "shake-cut": "impacts, crashes, drops", "white-flash": "big reveal, photo moment (pair with shutter)", "black-flash": "time skip, mood change", "flash-zoom": "hype reveal",
  "light-leak": "warm, nostalgic or emotional change", exposure: "dreamy, memory, heat", strobe: "party, high energy (use sparingly)", "flash-impact": "payoff hit",
  "rgb-split": "tech, gaming, internet culture", glitch: "tech or a 'malfunction' moment", vhs: "retro, throwback footage", static: "channel switch, interruption", breakup: "dramatic digital exit",
  "blur-to-clear": "soft scene opening, focus on a new subject", "focus-pull": "emotional or contemplative change", "radial-blur": "speed, acceleration", "wave-distort": "dream, confusion, flashback",
  "circle-reveal": "spotlight a new subject", wipe: "comparisons, clean editorial cuts", "diagonal-wipe": "dynamic editorial cut", "split-reveal": "dramatic opening of a new scene", "pip-in": "reaction to footage, 'meanwhile'",
  "pull-in": "rushing into the next moment, hype", "pull-back": "stepping back to show the result", whirl: "chaotic or dizzy turn of events", rotate: "playful change of scene, a twist", cube: "next topic, before/after, list steps", swipe: "feed-style 'next', rapid sequence",
  underline: "stress a word on screen", box: "point out an object", label: "name a thing in frame", counter: "statistics, prices, records", "progress-bar": "percentages, progress", "lower-third": "introduce a person",
  notification: "messages, alerts, social proof", "speech-bubble": "comic reaction", spotlight: "isolate the subject", "vignette-pulse": "tension beat", "freeze-frame": "'that's me' freeze, key moment",
  "scale-pulse": "beat hit, emphasis", "glow-pulse": "positive highlight", handheld: "vlog / documentary feel", "gradient-bg": "title or end cards", particles: "magical, celebratory moments",
};
function index() {
  let st = {}; try { for (const r of JSON.parse(fs.readFileSync(path.join(__dirname, "last-verify.json"), "utf8")).rows) st[r.name] = r.ok ? "Implemented and tested" : "Implemented, test FAILED"; } catch {}
  const status = (k) => st[k] || "Implemented but not fully tested";
  const fmt = (o) => Object.entries(o).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("/") : v}`).join(", ");
  let md = `# Effects index (generated by \`node motion-graphics-library/tests/demo.js index\`; do not edit by hand)\n\nAll presets: \`motion-graphics-library/mgl.js\`. Every transition and overlay also takes \`intensity\` (1 = default) and \`ease\` where noted in code.\nStatus comes from the last \`demo.js verify\` render test.\n`;
  md += `\n## Main set: CapCut's 20 popular transitions (user rule 2026-11-07)\nPick transitions from these 20 first, for every clip. Each one's sound comes from the user's \`sound effects/sfxv2/\` pack (every file <= 1.5 s; the user's files first, \`generated/\` = synthesized fallbacks, currently unused) and the builder adds it automatically with the hit on the cut (\`"sfx": false\` on the transition to skip it, \`"sfxVol"\` to change its volume). It counts toward the skill's SFX cap. The table is \`CAPCUT20\` in \`mgl.js\`.\n\n| CapCut name | Preset | Transition SFX |\n|---|---|---|\n`;
  for (const x of mgl.CAPCUT20) md += `| ${x.capcut} | \`${x.type}\` | \`${x.file}\` |\n`;
  md += `\n## Transitions (\`"transitions": [{ "t": <cut s>, "type": ... }]\` in shorts.json; one type per scene change)\n\n| Name | Category | What it does | Defaults | Good for | Status |\n|---|---|---|---|---|---|\n`;
  for (const [k, p] of Object.entries(mgl.TRANSITIONS)) md += `| \`${k}\` | ${p.category} | ${p.desc} | ${fmt(p.defaults)} | ${USES[k] || ""} | ${status(`transition:${k}`)} |\n`;
  md += `\n## Caption animations (\`"capAnim": <name>\` or \`"capAnims": [{ "t": <s>, "anim": <name> }]\`, \`"capAnimIntensity"\`)\n\n| Name | What it does | Status |\n|---|---|---|\n`;
  for (const [k, a] of Object.entries(mgl.ANIMATIONS)) md += `| \`${k}\` | ${a.desc} | Implemented; renders in the demo (no per-animation pixel test) |\n`;
  md += `\n## Overlays: callouts, emphasis, backgrounds (\`"overlays": [{ "t", "d", "type", ...params }]\`)\n\n| Name | Category | What it does | Parameters (defaults) | Good for | Status |\n|---|---|---|---|---|---|\n`;
  for (const [k, p] of Object.entries(mgl.OVERLAYS)) md += `| \`${k}\` | ${p.category} | ${p.desc} | ${fmt(p.defaults)} | ${USES[k] || ""} | ${status(`overlay:${k}`)} |\n`;
  const panel = require("../panel.js");
  md += `\n## Panel graphics (split screen; \`"panel": [{ "t", "e", "kind", ... }]\` in shorts.json, used by /motivational)\nThe screen splits (graphic panel top, speaker band below) exactly while a panel graphic is on screen; each graphic generates its own sound (no sound files). Code: \`motion-graphics-library/panel.js\` (self-check \`node motion-graphics-library/panel.js --selftest\`). Status: implemented and render-tested (2026-10-28 test clip).\n\n| Kind | What it does | Defaults |\n|---|---|---|\n`;
  for (const [k, p] of Object.entries(panel.KINDS)) md += `| \`${k}\` | ${p.desc} | ${fmt(p.defaults).replace(/\|/g, "/")} |\n`;
  md += `\nIcons: ${Object.keys(panel.ICONS).map((x) => `\`${x}\``).join(", ")}. Generated sounds: tick (typed word), pop (card/quote), whoosh (slide), shimmer (icon draw), rise (fill/count).\n`;
  md += `\n## Already in the builder (\`build-shorts.js\`, ysc look)\n\`punch\`, \`drift\` (slow push-in), \`shakes\`, \`flashes\`, \`arrows\` (arrow / circle), \`callouts\` (chip, plate, label, stamp), headline bar, captions, \`sfx\`.\nFixed on every clip: opening zoom-out + woosh, hook riser, closing zoom-in + woosh loop.\n`;
  md += `\n## HyperFrames registry (installed per project with \`hf.sh add <name>\`)\n38 transition items (e.g. \`flash-through-white\`, \`light-leak\`, \`glitch\`, \`cinematic-zoom\`, \`chromatic-radial-split\`, \`cross-warp-morph\`, \`domain-warp-dissolve\`, \`gravitational-lens\`) and 17 caption styles (\`caption-kinetic-slam\`, \`caption-glitch-rgb\`, \`caption-neon-glow\`…). Use them for named looks this library doesn't cover: \`bash tools/pipeline/hf.sh catalog --tag=transition\`.\n`;
  fs.writeFileSync(path.join(__dirname, "..", "EFFECTS_INDEX.md"), md);
  console.log("wrote EFFECTS_INDEX.md");
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "build") build(); else if (cmd === "verify") verify(path.resolve(arg)); else if (cmd === "index") index();
else console.log("usage: demo.js build | verify <renderDir> | index");
