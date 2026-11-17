// Word timings -> Auto-Editor --cut-out ranges. Usage: node cuts.js <clipdir> <duration> [keepPause]
// Long pauses are shortened to KEEP seconds (not removed); fillers and head/tail air are removed.
const fs = require("fs");
const [dir, durS, keepS] = process.argv.slice(2);
const dur = parseFloat(durS), KEEP = parseFloat(keepS || "0.3");
const words = JSON.parse(fs.readFileSync(`${dir}/transcript.json`, "utf8"));
const FILLERS = /^(uh|um|uhm|er|ah|hmm)[.,!?]*$/i;
const PRE = 0.08, POST = 0.12;
const cuts = [];
const spoken = words.filter((w) => !FILLERS.test(w.text));
if (!spoken.length) { console.error(`${dir}: no speech in transcript - check the segment times`); process.exit(1); }
for (const w of words) if (FILLERS.test(w.text)) cuts.push([w.start - 0.03, w.end + 0.03]);
if (spoken[0].start - PRE > 0.05) cuts.push([0, spoken[0].start - PRE]);
for (let i = 1; i < spoken.length; i++) {
  const gap = spoken[i].start - spoken[i - 1].end;
  if (gap > PRE + POST + KEEP + 0.1) cuts.push([spoken[i - 1].end + POST + KEEP / 2, spoken[i].start - PRE - KEEP / 2]);
}
// Trim the tail only when there is clearly dead air: Whisper sometimes misses the last word,
// and the segment ends were chosen by hand to land just after the final word.
const lastEnd = spoken[spoken.length - 1].end;
if (dur - lastEnd > 1.2) cuts.push([lastEnd + 0.4, dur]);
cuts.sort((a, b) => a[0] - b[0]);
fs.writeFileSync(`${dir}/cuts.txt`, cuts.map(([a, b]) => `${a.toFixed(3)}s,${b.toFixed(3)}s`).join(" "));
console.log(`${dir}: ${cuts.length} cuts, ${cuts.reduce((s, [a, b]) => s + b - a, 0).toFixed(1)}s removed (pause kept ${KEEP}s)`);
