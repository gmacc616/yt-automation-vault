// Draft look-check in ONE page load (the world and its textures are built once): renders every Nth frame with the draft
// preset (540x960 buffer), writes out/draft/f_<frame>.jpg, a contact sheet per 12 frames and light.txt
// (per frame: luma and warmth R-B, so "golden must be warm / night must be blue" can be checked without opening images).
// Usage: node scripts/sheet.mjs <CompositionId> [every Nth frame = 15] [from] [to]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
fs.mkdirSync("/root/remotion-tmp", { recursive: true }); process.env.TMPDIR = "/root/remotion-tmp";
const { bundle } = await import("@remotion/bundler");
const { renderFrames, selectComposition } = await import("@remotion/renderer");
const [id, nth = "15", from, to] = process.argv.slice(2);
if (!id) { console.log("usage: node scripts/sheet.mjs <CompositionId> [nth] [from] [to]"); process.exit(1); }
const chromiumOptions = { gl: "swangle" };
const inputProps = { draft: true, ...JSON.parse(process.env.PROPS || "{}") };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id, chromiumOptions, inputProps });
const out = path.resolve("out/draft"); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const a = Number(from ?? 0), b = Number(to ?? composition.durationInFrames - 1), t0 = Date.now();
await renderFrames({ composition, serveUrl, outputDir: out, imageFormat: "jpeg", jpegQuality: 85, scale: 0.5, concurrency: 1, chromiumOptions, inputProps,
  frameRange: [a, b], everyNthFrame: Number(nth), timeoutInMilliseconds: 900000, onStart: () => {}, onFrameUpdate: () => {},
});
// renderFrames names them element-NN.jpeg in order: rename to the real frame numbers
fs.readdirSync(out).filter((f) => /^element-\d+\.jpe?g$/.test(f)).sort().forEach((f, i) =>
  fs.renameSync(path.join(out, f), path.join(out, `f_${String(a + i * Number(nth)).padStart(4, "0")}.jpg`)));
const files = fs.readdirSync(out).filter((f) => f.startsWith("f_")).sort();
console.log(`${files.length} draft frames in ${((Date.now() - t0) / 1000).toFixed(0)} s -> ${out}`);
// contact sheets (12 per sheet) + light stats
for (let i = 0; i < files.length; i += 12) {
  const part = files.slice(i, i + 12), args = [];
  for (const f of part) args.push("-i", path.join(out, f));
  const n = part.length;
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args, "-filter_complex", `${part.map((_, k) => `[${k}]scale=270:-1[s${k}]`).join(";")};${n > 1 ? `${part.map((_, k) => `[s${k}]`).join("")}hstack=${n}` : "[s0]null"}`, path.join(out, `sheet_${String(i / 12).padStart(2, "0")}.jpg`)]);
}
const rows = files.map((f) => {
  // luma over the whole frame, warmth over the top half (sky + world: golden water is a deliberate dark navy)
  const px = (vf) => execFileSync("ffmpeg", ["-loglevel", "error", "-i", path.join(out, f), "-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  const [r, g, b] = px("scale=1:1:flags=area"), [rt, , bt] = px("crop=iw:ih/2:0:0,scale=1:1:flags=area");
  return `${f.replace(/\D/g, "")}\tluma ${((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255).toFixed(2)}\twarmth ${rt - bt}`;
});
fs.writeFileSync(path.join(out, "light.txt"), rows.join("\n") + "\n");
console.log(`sheets + light.txt written`);
