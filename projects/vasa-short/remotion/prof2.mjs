// per-frame render cost under post toggles (sequential, setup excluded): node scripts/prof2.mjs <from> <to> <scale>
import fs from "node:fs";
fs.mkdirSync("/root/remotion-tmp", { recursive: true }); process.env.TMPDIR = "/root/remotion-tmp";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [a, b, scale = "1"] = process.argv.slice(2);
const chromiumOptions = { gl: process.env.GL || "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
for (const post of JSON.parse(process.env.VARIANTS || "[{}]")) {
  const composition = await selectComposition({ serveUrl, id: process.env.COMP || "VasaShort", chromiumOptions, inputProps: { post } });
  const ts = [];
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: "out/prof2.mp4", frameRange: [Number(a), Number(b)], scale: Number(scale), concurrency: 1,
    chromiumOptions, inputProps: { post, prof: true }, onBrowserLog: (l) => { if (l.text.startsWith('PROF')) console.log(l.text); }, timeoutInMilliseconds: 900000, onProgress: ({ renderedFrames }) => { if (ts.length < renderedFrames) ts.push(Date.now()); } });
  const d = ts.slice(1).map((t, i) => (t - ts[i]) / 1000);
  console.log(JSON.stringify(post), "per frame", d.map((x) => x.toFixed(1)).join(" "));
}
