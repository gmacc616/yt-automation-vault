// Render every shot change and crossfade (+-2 frames) in the browser at draft size, so React mount/unmount bugs at
// boundaries (they crashed the Vasa render twice) show up in minutes, not hours into the final render.
// Usage: node scripts/boundary.mjs <CompositionId>   (needs out/shots.json from scripts/check.sh)
import fs from "node:fs";
import path from "node:path";
fs.mkdirSync("/root/remotion-tmp", { recursive: true }); process.env.TMPDIR = "/root/remotion-tmp";
const { bundle } = await import("@remotion/bundler");
const { renderFrames, selectComposition, openBrowser } = await import("@remotion/renderer");
const id = process.argv[2]; if (!id) { console.log("usage: node scripts/boundary.mjs <CompositionId>"); process.exit(1); }
const meta = JSON.parse(fs.readFileSync("out/shots.json", "utf8"));
const chromiumOptions = { gl: "swangle" }, inputProps = { draft: true };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id, chromiumOptions, inputProps });
const puppeteerInstance = await openBrowser("chrome", { chromiumOptions });
const wins = [...meta.shots.slice(1).map((s) => [s.a - 2, s.a + 2]), ...meta.xfade.map(([a, b]) => [a - 1, b + 1])]
  .map(([a, b]) => [Math.max(0, a), Math.min(meta.total - 1, b)]).sort((x, y) => x[0] - y[0])
  .reduce((m, w) => { const l = m[m.length - 1]; if (l && w[0] <= l[1] + 1) l[1] = Math.max(l[1], w[1]); else m.push([...w]); return m; }, []); // merge overlaps
const flash = meta.flash ?? [-1, -1];
const tmp = "/root/remotion-tmp/boundary"; let bad = 0;
for (const [a, b] of wins) {
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  try {
    await renderFrames({ composition, serveUrl, outputDir: tmp, imageFormat: "jpeg", scale: 0.25, concurrency: 1, chromiumOptions, inputProps, puppeteerInstance,
      frameRange: [a, b], timeoutInMilliseconds: 600000, onStart: () => {}, onFrameUpdate: () => {} });
    // renderFrames names them in order: frame = a + index; the planned white flash is allowed to be "empty"
    const small = fs.readdirSync(tmp).sort().filter((f, i) => fs.statSync(path.join(tmp, f)).size < 2500 && !(a + i >= flash[0] && a + i < flash[1]));
    if (small.length) { bad++; console.log(`BLANK? frames ${a}-${b}: ${small.length} near-empty images`); }
  } catch (e) { bad++; console.log(`CRASH frames ${a}-${b}: ${String(e.message || e).split("\n")[0].slice(0, 200)}`); }
}
await puppeteerInstance.close({ silent: true });
console.log(bad ? `${bad} boundary problems in ${wins.length} windows` : `boundaries OK (${wins.length} windows)`);
process.exit(bad ? 1 : 0);
