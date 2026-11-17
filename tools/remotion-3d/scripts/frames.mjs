// print a composition's frame count: node scripts/frames.mjs <CompositionId>
import path from "node:path";
const { bundle } = await import("@remotion/bundler");
const { selectComposition } = await import("@remotion/renderer");
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const c = await selectComposition({ serveUrl, id: process.argv[2], chromiumOptions: { gl: "swangle" } });
console.log(c.durationInFrames);
