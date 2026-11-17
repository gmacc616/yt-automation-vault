// Catch cut problems BEFORE building/rendering: words clipped at a segment edge, unfinished
// sentences at the end of a clip, and segments that start mid-sentence.
// Usage: node check-bounds.js <source transcript.json> <clips.txt>
//   clips.txt lines: "<clip#> <start> <end>" in source seconds (several lines per clip = segments, in play order)
// Exit code 1 when any ERROR is found. Suggested boundaries sit in the middle of the nearest word gap.
const fs = require("fs");
const [tPath, cPath] = process.argv.slice(2);
const words = JSON.parse(fs.readFileSync(tPath, "utf8")).sort((a, b) => a.start - b.start);
const segs = fs.readFileSync(cPath, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  .map((l) => l.split(/\s+/)).map(([c, a, b]) => ({ clip: c, a: +a, b: +b }));

const MARGIN = 0.06; // a boundary closer than this to a word edge risks an audible clip
const END_PUNCT = /[.!?]["')\]]*$/;
const CONTINUATION = /^(and|but|so|or|because|which|that|then|also|plus)$/i;
let errors = 0, warns = 0;
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}`;
const say = (lvl, s, msg) => { lvl === "ERROR" ? errors++ : warns++; console.log(`${lvl} clip ${s.clip} [${s.a}-${s.b}] ${msg}`); };

// Middle of the silence before/after word i.
const gapBefore = (i) => i <= 0 ? Math.max(0, words[0].start - 0.15) : (words[i - 1].end + words[i].start) / 2;
const gapAfter = (i) => i >= words.length - 1 ? words[i].end + 0.15 : (words[i].end + words[i + 1].start) / 2;

const byClip = {};
for (const s of segs) (byClip[s.clip] = byClip[s.clip] || []).push(s);

for (const [clip, list] of Object.entries(byClip)) {
  list.forEach((s, k) => {
    const inside = words.filter((w) => w.end > s.a && w.start < s.b);
    if (!inside.length) return say("ERROR", s, "contains no speech");
    const first = inside[0], last = inside[inside.length - 1];
    const fi = words.indexOf(first), li = words.indexOf(last);

    if (first.start < s.a - 0.01) say("ERROR", s, `start cuts through "${first.text}" (${fmt(first.start)}-${fmt(first.end)}); use ${gapBefore(fi + 1).toFixed(2)} or ${gapBefore(fi).toFixed(2)}`);
    else if (first.start - s.a < MARGIN && s.a > 0.05) say("WARN", s, `start is only ${(first.start - s.a).toFixed(2)}s before "${first.text}"; safer ${gapBefore(fi).toFixed(2)}`);

    if (last.end > s.b + 0.01) say("ERROR", s, `end cuts through "${last.text}" (${fmt(last.start)}-${fmt(last.end)}); use ${gapAfter(li).toFixed(2)} or ${gapAfter(li - 1).toFixed(2)}`);
    else if (s.b - last.end < MARGIN) say("WARN", s, `end is only ${(s.b - last.end).toFixed(2)}s after "${last.text}"; safer ${gapAfter(li).toFixed(2)}`);

    if (k === 0 && fi > 0 && !END_PUNCT.test(words[fi - 1].text) && CONTINUATION.test(first.text.replace(/[^a-z]/gi, "")))
      say("WARN", s, `clip opens mid-sentence on "${first.text}"`);
    if (k === list.length - 1) {
      const endWord = last.end > s.b + 0.01 ? words[li - 1] : last;
      if (endWord && !END_PUNCT.test(endWord.text)) {
        const nextEnd = words.slice(li).find((w) => END_PUNCT.test(w.text));
        say("ERROR", s, `clip ends mid-sentence on "${endWord.text}"` + (nextEnd ? `; sentence ends at ${fmt(nextEnd.end)} ("${nextEnd.text}") -> end ${gapAfter(words.indexOf(nextEnd)).toFixed(2)}` : ""));
      }
    }
  });
}
console.log(`${errors} error(s), ${warns} warning(s) across ${Object.keys(byClip).length} clip(s)`);
process.exit(errors ? 1 : 0);
