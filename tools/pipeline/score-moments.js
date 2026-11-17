// Rank candidate Shorts from a long transcript, as a shortlist for the final (human/Claude) pick.
// Usage: node score-moments.js <source transcript.json> [--min 15] [--max 55] [--top 12] [--out candidates.json] [--pack judge-pack.md]
// --pack writes the story-first judging sheet (full text + preceding context + the playbook test) for the final pick.
// Candidates start at a sentence start and end on a sentence end, with boundaries placed in word gaps
// (so check-bounds.js passes). Scores are transparent heuristics, each listed in "why":
//   hook      first sentence: question, "you", numbers/money, contrast or curiosity words
//   payoff    last sentence: numbers, conclusions ("so", "that's why", "the reason"), strong verbs
//   density   numbers and concrete nouns per second; speaking rate in a lively range
//   standalone  does not open on a dangling reference ("and", "but", "this", "he") or end on a question
//   clean     few fillers, no long dead pauses inside
// Overlapping windows are de-duplicated (best one kept). Output: printed table + JSON with times and text.
const fs = require("fs");
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const MIN = +opt("--min", 15), MAX = +opt("--max", 55), TOP = +opt("--top", 12), OUT = opt("--out", null), PACK = opt("--pack", null);
const words = JSON.parse(fs.readFileSync(argv[0], "utf8")).sort((a, b) => a.start - b.start);

// Sentences from punctuation; very long runs are split at long pauses.
const sents = [];
let cur = [];
for (let i = 0; i < words.length; i++) {
  const w = words[i];
  cur.push({ ...w, i });
  const nextGap = i + 1 < words.length ? words[i + 1].start - w.end : 9;
  if (/[.!?]["')]*$/.test(w.text) || (nextGap > 1.2 && cur.length > 3)) { sents.push(cur); cur = []; }
}
if (cur.length) sents.push(cur);
const text = (ws) => ws.map((w) => w.text).join(" ");

const FILLER = /^(uh|um|uhm|er|ah|hmm)$/i;
const bare = (t) => t.replace(/[^a-z']/gi, "");
// Asides that kill a Short when they open or close it: stream/meta talk, housekeeping, "okay so what else".
const META = /\b(okay so|anyway|let me (just )?(check|see|read)|the chat|real quick|what else|subscribe|like and|comment below|link in|sponsor|before we (start|begin)|as i said|where was i)\b/i;
const HOOK = /\b(why|how|what if|secret|mistake|never|stop|nobody|everyone|truth|actually|biggest|worst|best|crazy|insane|wrong|myth|don'?t|imagine|here'?s)\b/i;
const PAYOFF = /\b(so|that'?s why|the reason|which means|that means|the answer|result|in short|bottom line|basically)\b/i;
const NUM = /(\$?\d[\d,.]*\s?(k|m|%|percent|dollars|million|billion|thousand|hundred)?|\b(one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|half|double|triple)\b)/gi;
// Playbook sec. 1: reject a moment that needs earlier context.
const NEEDCTX = /(like i said|as i said|as we (said|saw|discussed)|we talked about|i mentioned|remember (when|that)|earlier|last (time|video|stream)|back to what)/i;
const DANGLING = /^(and|but|so|or|because|which|this|that|it|he|she|they|those|these|then|also|plus)\b/i;

function score(ws, prevEnd) {
  const a = ws[0].start, b = ws[ws.length - 1].end, dur = b - a;
  const first = text(ws.slice(0, Math.min(ws.length, 18))), last = text(ws.slice(-18)), all = text(ws);
  const why = [];
  let s = 0;
  const ss = []; let c = [];
  for (const w of ws) { c.push(w); if (/[.!?]["')]*$/.test(w.text)) { ss.push(c); c = []; } }
  if (c.length) ss.push(c);
  const s1 = text(ss[0]), sN = text(ss[ss.length - 1]);
  const aside = META.test(s1);
  if (!aside) if (/\?/.test(first.split(/[.!]/)[0] || "")) { s += 2; why.push("opens with a question"); }
  if (!aside) if (HOOK.test(first)) { s += 1.5; why.push(`hook word "${first.match(HOOK)[0]}"`); }
  if (!aside) if (/\byou(r)?\b/i.test(first)) { s += 1; why.push("speaks to the viewer"); }
  const firstNums = (first.match(NUM) || []).length;
  if (!aside) if (firstNums) { s += Math.min(2, firstNums); why.push("number/money in the opening"); }
  const nums = (all.match(NUM) || []).length;
  s += Math.min(2, nums * 10 / dur * 0.5); if (nums >= 2) why.push(`${nums} concrete numbers`);
  if (aside) { s -= 3; why.push(`opens on an aside ("${s1.match(META)[0]}")`); }
  if (META.test(sN) || ss[ss.length - 1].filter((w) => FILLER.test(bare(w.text))).length >= 2) { s -= 3; why.push("ends on an aside/filler sentence"); }
  const midAsides = ss.slice(1, -1).filter((x) => META.test(text(x))).length;
  if (midAsides) { s -= 2.5 * midAsides; why.push(`${midAsides} aside(s) in the middle`); }
  if (PAYOFF.test(last)) { s += 1.2; why.push("ends on a payoff/conclusion"); }
  if (/\?["')]*$/.test(ws[ws.length - 1].text)) { s -= 2; why.push("ends on a question (unresolved)"); }
  if (NEEDCTX.test(all)) { s -= 2.5; why.push(`needs earlier context ("${all.match(NEEDCTX)[0]}")`); }
  if (DANGLING.test(ws[0].text)) { s -= 2; why.push(`opens on "${ws[0].text}" (needs context)`); }
  const wps = ws.length / dur;
  if (wps >= 2.3 && wps <= 4) s += 1; else if (wps < 1.8) { s -= 1; why.push(`slow delivery (${wps.toFixed(1)} w/s)`); }
  const fill = ws.filter((w) => FILLER.test(bare(w.text))).length;
  if (fill > ws.length * 0.04) { s -= 1; why.push(`${fill} fillers`); }
  let longPause = 0;
  for (let k = 1; k < ws.length; k++) if (ws[k].start - ws[k - 1].end > 1.5) longPause++;
  if (longPause) { s -= longPause * 0.7; why.push(`${longPause} long pause(s) inside`); }
  if (a - prevEnd > 0.4) { s += 0.5; why.push("clean pause before start"); }
  // Mild preference for 25-45 s.
  s -= Math.abs(dur - 35) / 20;
  return { s, why, a, b, dur };
}

const cands = [];
for (let i = 0; i < sents.length; i++) {
  for (let j = i; j < sents.length; j++) {
    const ws = sents.slice(i, j + 1).flat();
    const dur = ws[ws.length - 1].end - ws[0].start;
    if (dur > MAX) break;
    if (dur < MIN) continue;
    const prevW = words[ws[0].i - 1], nextW = words[ws[ws.length - 1].i + 1];
    const r = score(ws, prevW ? prevW.end : -9);
    const start = prevW ? Math.max(prevW.end, ws[0].start - 0.25) : Math.max(0, ws[0].start - 0.15);
    const end = nextW ? Math.min(nextW.start, ws[ws.length - 1].end + 0.3) : ws[ws.length - 1].end + 0.3;
    cands.push({ score: +r.s.toFixed(2), start: +((start + ws[0].start) / 2).toFixed(2), end: +((end + ws[ws.length - 1].end) / 2).toFixed(2),
      dur: +r.dur.toFixed(1), why: r.why, text: text(ws), before: text(words.slice(Math.max(0, ws[0].i - 30), ws[0].i)), opening: text(ws.slice(0, 16)), closing: text(ws.slice(-12)) });
  }
}
cands.sort((x, y) => y.score - x.score);
const picked = [];
for (const c of cands) {
  if (picked.some((p) => Math.min(p.end, c.end) - Math.max(p.start, c.start) > 0.3 * Math.min(p.dur, c.dur))) continue;
  picked.push(c);
  if (picked.length >= TOP) break;
}
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
picked.forEach((c, k) => {
  console.log(`#${k + 1}  score ${c.score.toFixed(1).padStart(5)}  ${fmt(c.start)}-${fmt(c.end)} (${c.dur}s)`);
  console.log(`     "${c.opening} ..." ... "${c.closing}"`);
  console.log(`     ${c.why.join("; ") || "no strong signals"}`);
});
if (OUT) fs.writeFileSync(OUT, JSON.stringify(picked, null, 1));
if (PACK) {
  const head = `# Judge pack: story-first pick (docs/clipping-playbook.md sec. 1)
Heuristic shortlist only. Heuristics reward punchy lines, not stories. For each candidate decide:
setup / tension / reveal (timestamps), "this clip is about..." in one line, the 8-point standalone test, risks.
Keep only complete mini-stories (setup -> tension -> reveal, ends on the reveal). List rejects and why.
Standalone test: 1 stranger gets first 3 s | 2 opening raises a question/tension | 3 one specific event | 4 cause of every reaction is inside | 5 opening answered by the end, not before | 6 viewer knows something new at the end | 7 send-to-a-friend | 8 works muted and audio-only.
Boundaries may be moved to a sentence edge; re-run check-bounds.js on the final times.
`;
  fs.writeFileSync(PACK, head + picked.map((c, k) => `
## #${k + 1}  ${fmt(c.start)}-${fmt(c.end)} (${c.dur}s)  heuristic ${c.score}
Signals: ${c.why.join("; ") || "none"}
Before (not in clip): ...${c.before}
Clip: ${c.text}
`).join(""));
}
