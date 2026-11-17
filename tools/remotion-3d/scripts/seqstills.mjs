// stills through renderFrames (same path as the final render; renderStill raced the first frame here):
// node scripts/seqstills.mjs <outPrefix> <f,f,...> [scale]
import fs from "node:fs";
fs.mkdirSync("/root/remotion-tmp", { recursive: true }); process.env.TMPDIR = "/root/remotion-tmp";
import { bundle } from "@remotion/bundler";
import { renderFrames, selectComposition, openBrowser } from "@remotion/renderer";
import path from "node:path";
const [prefix, frames, scale = "0.5"] = process.argv.slice(2);
const chromiumOptions = { gl: "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: process.env.COMP || "VasaShort", chromiumOptions });
const puppeteerInstance = await openBrowser("chrome", { chromiumOptions });
const tmp = "/root/remotion-tmp/frames"; 
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  await renderFrames({ composition, serveUrl, outputDir: tmp, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale), frameRange: [f, f], concurrency: 1,
    chromiumOptions, puppeteerInstance, timeoutInMilliseconds: 900000, inputProps: { ...(process.env.PROF ? { prof: true } : {}), post: JSON.parse(process.env.POST || "{}") }, onBrowserLog: (l) => { if (l.text.includes("PROF")) console.log(l.text.slice(0, 160)); }, onStart: () => {}, onFrameUpdate: () => {} });
  const file = fs.readdirSync(tmp).find((x) => x.endsWith(".jpeg") || x.endsWith(".jpg"));
  fs.copyFileSync(path.join(tmp, file), `${prefix}${f}.jpg`);
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
await puppeteerInstance.close({ silent: true });
