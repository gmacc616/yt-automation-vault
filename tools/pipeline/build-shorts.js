// Generate one HyperFrames project per short.
// Run from the job folder (needs shorts.json, reframe.json, clipNN/base.mp4, clipNN/music_duck.wav, clipNN/t/transcript.json):
//   node ../../tools/pipeline/build-shorts.js <outDir> clip01 [clip02 ...]
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const mgl = require("../../motion-graphics-library/mgl.js");
const panel = require("../../motion-graphics-library/panel.js");

const JOB = process.cwd();
const OUT = path.resolve(process.argv[2]);
const SFX_DIR = path.resolve(__dirname, "../../.agents/skills/media-use/audio/assets/sfx");
const spec = JSON.parse(fs.readFileSync(path.join(JOB, "shorts.json"), "utf8"));
const reframe = JSON.parse(fs.readFileSync(path.join(JOB, "reframe.json"), "utf8"));
const sfxManifest = JSON.parse(fs.readFileSync(path.join(SFX_DIR, "manifest.json"), "utf8"));

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const r3 = (n) => Math.round(n * 1000) / 1000;
const probeDuration = (file) =>
  parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString());

function captionWords(name, s, dur) {
  const raw = JSON.parse(fs.readFileSync(path.join(JOB, name, "t", "transcript.json"), "utf8"));
  const out = [];
  raw.forEach((w, i) => {
    const key = String(i);
    const text = Object.prototype.hasOwnProperty.call(s.fixes, key) ? s.fixes[key] : w.text;
    if (text === null) return;
    out.push({ i, text, start: r3(w.start), end: r3(Math.min(w.end, dur)), emph: s.emphasis.includes(i) });
  });
  return out;
}

// One line per caption: up to 3 words / ~16 characters; break on punctuation and pauses.
function groupWords(words) {
  const groups = [];
  let cur = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    if (cur.length && (cur.length >= 3 || chars > 16 || w.start - prev.end > 0.5 || w.end - cur[0].start > 1.6)) {
      groups.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.?!,]$/.test(w.text)) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

// True when a caption line says nothing beyond what a callout already shows.
const STOP = new Set(["A", "AN", "THE", "AND", "OR", "OF", "TO", "IN", "ON", "AT", "IS", "IT", "ITS", "FOR", "WITH", "THIS", "THAT", "SO", "BUT", "WE", "YOU", "I"]);
const NUM = { ONE: "1", TWO: "2", THREE: "3", FOUR: "4", FIVE: "5", SIX: "6", SEVEN: "7", EIGHT: "8", NINE: "9", TEN: "10", FIFTEEN: "15", TWENTY: "20", NINETY: "90" };
const SYN = { FT: "FOOT", FEET: "FOOT", LBS: "POUNDS", LB: "POUNDS", MINS: "MINUTES", MIN: "MINUTES", HR: "HOUR", HRS: "HOURS" };
const tokens = (t) => t.toUpperCase().replace(/(\d)[.,](?=\d)/g, "$1_").replace(/[^A-Z0-9$_ ]+/g, " ").split(/\s+/).filter(Boolean)
  .flatMap((x) => x.split(/(?<=\d)-|-(?=\d)/)).map((x) => NUM[x] || SYN[x] || x).filter((x) => !STOP.has(x));
const sameWord = (a, b) => a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));
function repeatsCallout(line, calloutText) {
  const cap = tokens(line), co = tokens(calloutText);
  if (!cap.length) return false;
  const hit = cap.filter((t) => co.some((c) => sameWord(t, c))).length;
  return hit === cap.length || (hit >= 2 && hit / cap.length >= 0.66);
}

function build(name) {
  const s = spec[name];
  const entry = reframe[name];
  const shots = Array.isArray(entry) ? entry : entry.shots;
  const broll = Array.isArray(entry) ? [] : entry.broll || [];
  const dir = path.join(OUT, name);
  fs.mkdirSync(path.join(dir, "assets", "sfx"), { recursive: true });
  fs.copyFileSync(path.join(JOB, name, "base.mp4"), path.join(dir, "assets", "base.mp4"));
  fs.copyFileSync(path.join(JOB, name, "music_duck.wav"), path.join(dir, "assets", "music.wav"));
  const D = r3(probeDuration(path.join(dir, "assets", "base.mp4")));
  // "style": "puregrit" -> PureGrit look (mid-screen 2-3 word captions, one coloured glowing keyword per line,
  // no hook banner unless given, optional logo and reaction labels). Only used when the user asks for it.
  const PG = s.style === "puregrit";
  // "style": "ysc" -> /youtube-style-clip hit-clip look: fixed black headline bar on top, footage filling the rest,
  // one-word captions mid-frame, punch-ins + slow push-in, red arrows/circles, rare flashes. Opt-in only.
  // "style": "gab" -> ClipFarm x DraftKings example look: the ysc toolkit (one-word captions, punch-ins, push-in,
  // flashes, sfx) but full-frame footage with no headline bar, small white captions, the DraftKings wordmark image
  // ("logoImg", "logoPos": "bottom" | "topright") and an optional letter-spaced opener ("presents": {text, d}).
  const GAB = s.style === "gab";
  const YSC = s.style === "ysc" || GAB;
  const BAR = GAB ? 0 : YSC ? (s.barH ?? 300) : 0;
  const capY = s.capY || (PG ? 1060 : YSC ? 1060 : 1450);
  // "panel": [{t, e, kind, ...}] motion graphics (motion-graphics-library/panel.js): the screen splits while one is on
  // screen (graphic panel on top, speaker band below) and captions sit on the seam; each graphic makes its own sound.
  const pctx = mgl.makeCtx({ freezeFrame: () => "", trackBase: 200 }); let pnk = 0; pctx.id = () => `pn${++pnk}`; // own ids: never collide with mgl effects
  const pn = panel.build({ panel: s.panel || [], D, ctx: pctx, bandFocus: s.bandFocus, splitCapY: s.splitCapY, accent: s.panelAccent });
  const capAt = (t) => pn.capYAt(t) ?? ((s.capShift || []).find(([a, b]) => t >= a && t < b) || [0, 0, capY])[2];

  // Captions move to the top band on near-fill shots, during a low hook, and in any topRanges.
  const hookDur = s.hookDur || 3.0;
  // Only narrow "card" crops (output narrower than the frame) push captions to the top; full-width zf crops don't.
  const cardShots = shots.filter(([, , m]) => m && typeof m === "object" && m.zf && (m.zf[4] || 860) < 1080);
  const onTop = (t) => cardShots.some(([a, b]) => t >= a - 0.05 && t < b) || (s.hookLow && t < hookDur) ||
    (s.topRanges || []).some(([a, b]) => t >= a && t < b);
  const cutList = [...shots.map(([a]) => a), ...broll.flatMap(([at, bs, be]) => [at, at + be - bs])]
    .filter((a) => a > 0.05).sort((a, b) => a - b);

  // A caption line that only repeats a callout's words (stamp, chip or plate) is dropped while that
  // callout is on screen, so the same words never show twice, e.g. chip "1 EVERY 90 MIN" over caption "EVERY 90 MINUTES".
  // "lines": hand-written caption lines (e.g. an English translation of non-English speech), each
  // {t, e, text}; words wrapped in *asterisks* are highlighted. They replace the transcript-driven captions.
  // Lines longer than ~16 characters are split into word chunks timed by character share, so text stays big.
  const srcGroups = s.lines ? s.lines.flatMap((L, li) => {
    const toks = L.text.split(/\s+/).map((tok, k) => ({
      i: 10000 + li * 50 + k, text: tok.replace(/\*/g, ""), emph: /^\*.+\*[.,!?]*$/.test(tok), fixed: true }));
    const chunks = [[]];
    for (const t of toks) {
      const cur = chunks[chunks.length - 1];
      if (cur.length && cur.reduce((n, x) => n + x.text.length + 1, 0) + t.text.length > 16) chunks.push([t]); else cur.push(t);
    }
    const total = toks.reduce((n, x) => n + x.text.length, 0);
    let t0 = L.t;
    return chunks.map((ch) => {
      const t1 = t0 + (L.e - L.t) * ch.reduce((n, x) => n + x.text.length, 0) / total;
      const g = ch.map((x) => ({ ...x, start: r3(t0), end: r3(t1) }));
      t0 = t1;
      return g;
    });
  })
    : groupWords(captionWords(name, s, D));
  const groups = srcGroups.filter((g) => {
    const line = g.map((w) => w.text).join(" ");
    return !s.callouts.some((c) => g[0].start >= c.t - 0.6 && g[0].start <= c.t + c.d &&
      repeatsCallout(line, `${c.text} ${c.sub || ""}`));
  });

  let html = "";
  let js = "";

  const PG_COLORS = s.pgColors || ["#F5C542", "#3FA9FF", "#FF4D4D", "#39E75F"];
  const PG_STOP = new Set(["THE", "AND", "BUT", "FOR", "WITH", "THAT", "THIS", "YOU", "ARE", "WAS", "HIS", "HER", "SHE", "HAS", "HAD", "JUST", "FROM", "INTO", "THEY", "WHAT", "WHEN", "THEN", "THAN"]);
  // ysc: one word per caption, timed to the original speech.
  // Words sharing a timestamp are spaced so each shows >= 0.15 s and never overlaps the next.
  // "capWords": N puts up to N words on one ysc card (default 1); a card never spans a pause over 0.6 s.
  const capGroups = YSC ? groups.flat().reduce((acc, w) => { const g = acc[acc.length - 1];
    if (g && g.length < (s.capWords || 1) && w.start - g[g.length - 1].end <= 0.6 && !/[.?!,]$/.test(g[g.length - 1].text)) g.push(w); else acc.push([w]); return acc; }, []) : groups;
  if (YSC) {
    let prev = 0;
    capGroups.forEach((g, k) => {
      const w = g[0], last = g[g.length - 1];
      w.start = r3(Math.min(Math.max(w.start, prev), D - 0.15));
      const nx = capGroups[k + 1];
      w.yEnd = r3(Math.min(D, Math.max(w.start + 0.15, Math.min(nx ? Math.max(nx[0].start, w.start + 0.15) : D, last.end + 0.25))));
      prev = w.yEnd;
    });
  }
  // Caption entrance from the motion-graphics library: "capAnim" (one name) or "capAnims" [{t, anim}] (switch per scene).
  const capAnimAt = (t) => { const k = (s.capAnims || []).filter((c) => c.t <= t + 1e-6).pop(); return (k && k.anim) || s.capAnim; };
  // "typedHook": "BREZ PROVES / *HE'S STRONG*" (campaign override, e.g. Brezscales): instead of the riser, the hook is an
  // on-screen card typed out line by line (one line per " / ", *keyword* glows green) with the key-click sound playing
  // exactly while it types; it stays until "hookEnd" (default: 1.4 s after typing ends). Captions are skipped under it.
  const thSpans = [];
  let thEnd = 0;
  if (s.typedHook) {
    let t = 0.3; const k = s.capAnimIntensity || 1;
    String(s.typedHook).split(/\s*\/\s*/).filter(Boolean).forEach((ln, li) => {
      const n = ln.replace(/\*/g, "").length, d = mgl.typeDuration(n, k); thSpans.push({ ln, li, n, d, at: t, k }); t = r3(t + d + 0.08); });
    thEnd = r3(Math.min(D, typeof s.hookEnd === "number" ? s.hookEnd : t + 1.4));
  }
  const capIn = (sel, start, dflt, n) => {
    const a = capAnimAt(start); if (!a) return dflt;
    if (!mgl.ANIMATIONS[a]) throw new Error(`${name}: unknown caption animation "${a}" (motion-graphics-library/EFFECTS_INDEX.md)`);
    return mgl.ANIMATIONS[a].js(sel, start, s.capAnimIntensity || 1, n); };
  capGroups.forEach((g, gi) => {
    const start = g[0].start;
    if (s.typedHook && start < thEnd) return;
    if (YSC) {
      const w = g[0];
      const end = w.yEnd;
      const text = g.map((x) => x.text).join(" ");
      const fsz = Math.min(s.capMax || (GAB ? 64 : 96), Math.floor(980 / (text.length * 0.7)));
      const col = (x) => (x.emph ? (s.yscAlt || (GAB ? "#FFD23F" : "#39E75F")) : (s.yscColor || (GAB ? "#FFFFFF" : "#FFE135")));
      const stroke = s.capStroke ? `;-webkit-text-stroke:${s.capStroke}px #000` : "";
      html += `<div class="cap clip" id="cap${gi}" data-start="${start}" data-duration="${r3(end - start)}" data-track-index="2"><div class="capin ysc${GAB ? " gab" : ""}" id="ci${gi}" style="top:${capAt(start)}px;font-size:${fsz}px;color:${col(w)}${stroke}">` +
        (g.length === 1 ? esc(w.text) : g.map((x) => `<span style="color:${col(x)}">${esc(x.text)}</span>`).join(" ")) + `</div></div>\n`;
      js += capIn(`#ci${gi}`, start, `tl.fromTo("#ci${gi}", { scale: 1.3 }, { scale: 1, duration: 0.08, ease: "power2.out", immediateRender: false }, ${start});\n`, text.length);
      return;
    }
    if (PG) {
      const next = groups[gi + 1];
      const end = r3(Math.min(next ? next[0].start : D, g[g.length - 1].end + 0.6, D));
      // One keyword per line: an emphasised word, else the longest meaningful word.
      const bare = (t) => t.toUpperCase().replace(/[^A-Z0-9$]/g, "");
      let key = g.find((w) => w.emph);
      if (!key) key = g.filter((w) => bare(w.text).length >= 4 && !PG_STOP.has(bare(w.text)))
        .sort((a, b) => bare(b.text).length - bare(a.text).length)[0];
      const color = PG_COLORS[gi % PG_COLORS.length];
      html += `<div class="cap clip" id="cap${gi}" data-start="${start}" data-duration="${r3(end - start)}" data-track-index="2"><div class="capin pg" id="ci${gi}">` +
        g.map((w) => `<span class="w"${w === key ? ` style="color:${color};text-shadow:0 0 18px ${color}99"` : ""}>${esc(w.text)}</span>`).join(" ") + `</div></div>\n`;
      js += capIn(`#ci${gi}`, start, `tl.fromTo("#ci${gi}", { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.1, ease: "power2.out", immediateRender: false }, ${start});\n`, g.length * 5);
      return;
    }
    const next = groups[gi + 1];
    const end = r3(Math.min(next ? next[0].start : D, g[g.length - 1].end + 0.6, D));
    const pos = onTop(start) ? " top" : "";
    // Shrink long lines so they stay inside the 960 px safe width (Montserrat 900 caps ~0.66 em per char).
    const chars = g.reduce((n, w) => n + w.text.length * (w.emph ? 1.14 : 1) + 1, -1);
    const fs = Math.min(76, Math.floor(940 / (chars * 0.66)));
    html += `<div class="cap clip" id="cap${gi}" data-start="${start}" data-duration="${r3(end - start)}" data-track-index="2"><div class="capin${pos}" id="ci${gi}"${fs < 76 ? ` style="font-size:${fs}px"` : ""}>` +
      g.map((w) => `<span class="w${w.emph ? " em" : ""}" id="w${w.i}">${esc(w.text)}</span>`).join(" ") + `</div></div>\n`;
    js += capIn(`#ci${gi}`, start, `tl.fromTo("#ci${gi}", { y: 18, scale: 0.94 }, { y: 0, scale: 1, duration: 0.12, ease: "back.out(2)", immediateRender: false }, ${start});\n`, g.length * 5);
    for (const w of g) {
      if (w.fixed) { // translated line: no per-word timing, only the highlighted words are coloured
        if (w.emph) js += `tl.fromTo("#w${w.i}", { scale: 1 }, { scale: 1.08, duration: 0.1, ease: "power2.out", immediateRender: false }, ${start});
`;
        continue;
      }
      const HL = s.highlight || "#39E75F"; // caption highlight (spoken + emphasized words); hook/chips keep --accent
      const pop = w.text.length > 6 ? 1.03 : w.emph ? 1.1 : 1.05;
      js += `tl.fromTo("#w${w.i}", { color: "${w.emph ? HL : "#FFFFFF"}", scale: 1 }, { color: "${HL}", scale: ${pop}, duration: 0.08, ease: "power2.out", immediateRender: false }, ${w.start});\n`;
      if (!w.emph) js += `tl.fromTo("#w${w.i}", { color: "${HL}", scale: ${pop} }, { color: "#FFFFFF", scale: 1, duration: 0.08, immediateRender: false }, ${r3(Math.max(w.start + 0.09, w.end))});\n`;
    }
  });

  // Brand badge (e.g. "BOXABL CASITA"); badgeHide: [[a,b],...] keeps it off footage that isn't BOXABL.
  if (s.badge) {
    const hide = (s.badgeHide || []).slice().sort((x, y) => x[0] - y[0]);
    const spans = [];
    let t0 = 0;
    for (const [a, b] of hide) { if (a > t0) spans.push([t0, a]); t0 = Math.max(t0, b); }
    if (t0 < D) spans.push([t0, D]);
    spans.forEach(([a, b], bi) => {
      html += `<div class="badgeclip clip" id="badge${bi}" data-start="${r3(a)}" data-duration="${r3(b - a)}" data-track-index="9"><div class="badge">${esc(s.badge)}</div></div>\n`;
    });
  }

  // Hook banner (optional; the PureGrit style normally has none and opens cold on the footage).
  if (s.hook && s.hook[0]) {
  html += `<div id="hook" class="clip${s.hookLow ? " low" : ""}"${s.hookTop ? ` style="padding-top:${s.hookTop}px"` : ""} data-start="0" data-duration="${hookDur}" data-track-index="3"><div class="hk hk1" id="hk1">${esc(s.hook[0])}</div><div class="hkrule" id="hkrule"></div><div class="hk hk2" id="hk2">${esc(s.hook[1])}</div></div>\n`;
  js += `tl.fromTo("#hk1", { opacity: 0, x: -120 }, { opacity: 1, x: 0, duration: 0.32, ease: "power3.out", immediateRender: false }, 0.04);\n`;
  js += `tl.fromTo("#hk2", { opacity: 0, x: 120 }, { opacity: 1, x: 0, duration: 0.32, ease: "power3.out", immediateRender: false }, 0.16);\n`;
  js += `tl.fromTo("#hkrule", { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power2.out", immediateRender: false }, 0.3);\n`;
  }

  if (YSC) {
    // Fixed headline bar: words in *asterisks* get the keyword colour (red by default, or keyColor).
    if (s.headline) {
      const hl = esc(s.headline).replace(/\*([^*]+)\*/g, `<span class="ykey">$1</span>`);
      html += `<div class="ysbar clip" data-start="0" data-duration="${D}" data-track-index="9"><div class="ysbar-in" style="height:${BAR}px"><div class="ysbar-t">${hl}</div></div></div>\n`;
    }
    // Flash transitions (use 1-2 at most): {t, color}.
    (s.flashes || []).forEach((f, fi) => {
      const t0 = r3(Math.max(0, f.t - 0.06));
      html += `<div class="ysfx clip" data-start="${t0}" data-duration="0.22" data-track-index="11"><div class="ysflash" id="fl${fi}" style="background:${f.color || "#ffffff"}"></div></div>\n`;
      // A flash at 0 s has no time to rise: it starts fully white on frame 1 and fades.
      const rise = f.t >= 0.06 ? 0.06 : 0;
      if (rise) js += `tl.fromTo("#fl${fi}", { opacity: 0 }, { opacity: 0.9, duration: 0.06, immediateRender: false }, ${t0});\n`;
      js += `tl.fromTo("#fl${fi}", { opacity: ${rise ? 0.9 : 1} }, { opacity: 0, duration: 0.14, immediateRender: false }, ${r3(t0 + rise)});\n`;
    });
    // Red arrow (tip at x,y, rotated by rot degrees) or circle (centre x,y, radius r) on the key object/face.
    (s.arrows || []).forEach((a, ai) => {
      const d = r3(Math.min(a.d || 1.5, D - a.t));
      const inner = a.kind === "circle"
        ? `<div class="yscircle" id="ar${ai}" style="left:${a.x - a.r}px;top:${a.y - a.r}px;width:${a.r * 2}px;height:${a.r * 2}px"></div>`
        : `<div class="ysarrow" id="ar${ai}" style="left:${a.x - 235}px;top:${a.y - 55}px;rotate:${a.rot || 0}deg"><svg width="240" height="110" viewBox="0 0 240 110"><path d="M8 55 H176" stroke="#ff2a2a" stroke-width="22" stroke-linecap="round"/><polygon points="166,8 236,55 166,102" fill="#ff2a2a"/></svg></div>`;
      html += `<div class="ysfx clip" data-start="${a.t}" data-duration="${d}" data-track-index="12">${inner}</div>\n`;
      js += `tl.fromTo("#ar${ai}", { scale: 0 }, { scale: 1, duration: 0.14, ease: "back.out(2.2)", immediateRender: false }, ${a.t});\n`;
    });
    // Screen shake on impacts: {t, d (s, default 0.3), amp (px, default 18)}. Short decaying x/y jolts on the footage only
    // (captions and bar stay still); transforms only, so it stays seek-safe.
    (s.shakes || []).forEach((k) => {
      const n = 6, step = r3((k.d || 0.3) / n), amp = k.amp || 18;
      let px = 0, py = 0;
      for (let i = 1; i <= n; i++) {
        const f = i === n ? 0 : amp * (1 - i / n) * (i % 2 ? 1 : -1);
        const nx = r3(f), ny = r3(i === n ? 0 : f * 0.6 * (i % 3 ? 1 : -1));
        js += `tl.fromTo("#a-roll", { x: ${px}, y: ${py} }, { x: ${nx}, y: ${ny}, duration: ${step}, ease: "none", immediateRender: false }, ${r3(k.t + (i - 1) * step)});\n`;
        px = nx; py = ny;
      }
    });
    // Slow push-in (~4%) on every shot so no frame sits still; resets at each cut.
    if (s.drift !== false) {
      const pts = [0, ...cutList, D];
      pts.forEach((a, k) => { if (k < pts.length - 1 && pts[k + 1] - a > 0.3)
        js += `tl.fromTo("#a-roll", { scale: 1 }, { scale: ${s.driftScale || 1.04}, duration: ${r3(pts[k + 1] - a)}, ease: "none", immediateRender: false }, ${r3(a)});\n`; });
    }
  }

  if (YSC && s.logoImg) { // gab or ysc (e.g. /gab clips built in the ysc look)
    // Brief: approved DraftKings logo, unaltered, on every frame; text never covers it.
    fs.copyFileSync(path.resolve(JOB, s.logoImg), path.join(dir, "assets", "logo.png"));
    const pos = s.logoPos === "topright" ? "top:70px;right:46px;width:300px" : "bottom:300px;left:50%;translate:-50% 0;width:330px";
    html += `<div class="logoclip clip" data-start="0" data-duration="${D}" data-track-index="13"><img src="assets/logo.png" style="position:absolute;${pos};height:auto"></div>\n`;
  }
  if (GAB && s.presents) {
    const pd = r3(Math.min(s.presents.d || 2.2, D));
    html += `<div class="logoclip clip" data-start="0" data-duration="${pd}" data-track-index="10"><div class="gabpres" id="pres" style="top:${capY - 120}px">${esc(s.presents.text)}</div></div>\n`;
    js += `tl.fromTo("#pres", { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 0.35, ease: "power2.out", immediateRender: false }, 0.05);\n`;
  }

  // Small channel logo under the captions (the PureGrit style puts a "PG"-type mark there).
  if (s.logo) html += `<div class="logoclip clip" data-start="0" data-duration="${D}" data-track-index="8"><div class="pglogo" style="top:${capY + 118}px">${esc(s.logo)}</div></div>\n`;

  s.callouts.forEach((c, ci) => {
    const d = r3(Math.min(c.d, D - c.t));
    const track = 3 + ((ci + 1) % 2);
    if (c.kind === "plate") {
      const fsz = Math.min(50, Math.floor(860 / (c.text.length * 0.52)));
      html += `<div class="co clip" id="co${ci}" data-start="${c.t}" data-duration="${d}" data-track-index="${track}"><div class="plate" id="coin${ci}"><div class="pl-rule" id="plr${ci}"></div><div class="pl-t" style="font-size:${fsz}px">${esc(c.text)}</div><div class="pl-s">${esc(c.sub)}</div></div></div>\n`;
      js += `tl.fromTo("#coin${ci}", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out", immediateRender: false }, ${c.t});\n`;
      js += `tl.fromTo("#plr${ci}", { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power2.out", immediateRender: false }, ${r3(c.t + 0.15)});\n`;
    } else if (c.kind === "label") {
      // Reaction label, e.g. "SHOCKED", shown in quotes near the face.
      html += `<div class="co clip" id="co${ci}" data-start="${c.t}" data-duration="${d}" data-track-index="${track}"><div class="pglabel" id="coin${ci}" style="top:${c.y || capY - 120}px">&ldquo;${esc(c.text)}&rdquo;</div></div>\n`;
      js += `tl.fromTo("#coin${ci}", { opacity: 0, scale: 1.4 }, { opacity: 1, scale: 1, duration: 0.16, ease: "back.out(2)", immediateRender: false }, ${c.t});\n`;
    } else if (c.kind === "stamp") {
      html += `<div class="co clip" id="co${ci}" data-start="${c.t}" data-duration="${d}" data-track-index="${track}"><div class="stamp" id="coin${ci}">${esc(c.text)}</div></div>\n`;
      js += `tl.fromTo("#coin${ci}", { opacity: 0, scale: 1.9, rotation: -10 }, { opacity: 1, scale: 1, rotation: -4, duration: 0.28, ease: "back.out(2)", immediateRender: false }, ${c.t});\n`;
    } else {
      html += `<div class="co clip" id="co${ci}" data-start="${c.t}" data-duration="${d}" data-track-index="${track}"><div class="chip" id="coin${ci}">${esc(c.text)}</div></div>\n`;
      js += `tl.fromTo("#coin${ci}", { opacity: 0, y: 24, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: "back.out(1.8)", immediateRender: false }, ${c.t});\n`;
    }
  });

  s.punch.forEach(([t, sc, dur], pi) => {
    js += `tl.fromTo("#cam", { scale: 1 }, { scale: ${sc}, duration: ${dur || 0.25}, ease: "${dur ? "sine.inOut" : "power3.out"}", immediateRender: false }, ${t});\n`;
    const nextP = s.punch[pi + 1] ? s.punch[pi + 1][0] : D;
    const cut = cutList.find((c) => c > t + (dur || 0.25) + 0.05 && c < nextP);
    if (cut !== undefined) js += `tl.fromTo("#cam", { scale: ${sc} }, { scale: 1, duration: 0.01, immediateRender: false }, ${cut});\n`;
    else if (nextP < D) js += `tl.fromTo("#cam", { scale: ${sc} }, { scale: 1, duration: 0.35, ease: "power2.inOut", immediateRender: false }, ${r3(Math.max(t + (dur || 0.25) + 0.1, nextP - 0.4))});\n`;
  });

  // Fixed features on every clip (user rule, docs/editing-workflow.md step 4): a very fast zoom-out + woosh at 0 s,
  // the metallic riser peaking as the hook ends, and a fast zoom-in + the same woosh into the last frame, which is the
  // same shot as the first so the loop is seamless (end at scale ZOOM, start at scale ZOOM).
  // "actions": [{t, d, text}]: white "*TEXT*" cards for a beat that isn't a spoken word, in the caption position.
  (s.actions || []).forEach((a, ai) => {
    const d = r3(Math.min(a.d || 0.8, D - a.t));
    html += `<div class="cap clip" id="act${ai}" data-start="${a.t}" data-duration="${d}" data-track-index="31"><div class="capin ysc" id="aci${ai}" style="top:${capAt(a.t)}px;font-size:${s.capMax || 90}px;color:#fff${s.capStroke ? `;-webkit-text-stroke:${s.capStroke}px #000` : ""}">*${esc(String(a.text).toUpperCase())}*</div></div>\n`;
    js += `tl.fromTo("#aci${ai}", { scale: 1.3 }, { scale: 1, duration: 0.08, ease: "power2.out", immediateRender: false }, ${a.t});\n`;
  });
  // Typed hook (see thSpans above): lines start hidden (clip-path) and type in one after another with key clicks.
  // "fixedVol": multiplier for the fixed woosh/typing/riser/ding levels (capped at 1), for sources with loud normalised speech.
  const FV = (v) => r3(Math.min(1, v * (s.fixedVol || 1)));
  const typingCues = [];
  if (s.typedHook) {
    html += `<div class="cap clip" id="thk" data-start="0.3" data-duration="${r3(thEnd - 0.3)}" data-track-index="30"><div class="typedhook" style="top:${s.typedHookY || 760}px">` +
      thSpans.map((x) => `<div class="th-line" id="thl${x.li}" style="clip-path:inset(0 100% 0 0)">${esc(x.ln).replace(/\*([^*]+)\*/g, '<span class="th-key">$1</span>')}</div>`).join("") + `</div></div>\n`;
    thSpans.forEach((x) => { js += mgl.ANIMATIONS.typewriter.js(`#thl${x.li}`, x.at, x.k, x.n);
      typingCues.push({ t: x.at, file: "sound effects/fast-and-dynamic-typing-keyboard.mp3", ms: 0.12, len: r3(x.d + 0.05), vol: FV(0.15) }); });
  }
  const FIXED = s.fixedFeatures !== false; // /meme turns these off on purpose
  if (FIXED && !s.typedHook && (typeof s.hookEnd !== "number" || s.hookEnd <= 0 || s.hookEnd > D))
    throw new Error(`${name}: "hookEnd" (seconds, when the narrator/speaker finishes the hook) is required, 0 < hookEnd <= ${D}`);
  if (s.sfx.some((x) => /riser/i.test(x.name || x.file || "")))
    throw new Error(`${name}: the only riser allowed is the fixed hook riser; remove riser cues from "sfx"`);
  const ZOOM = 1.6, WOOSH = "sound effects/woosh-sound-effect.mp3", RISER = "sound effects/popular-riser-metallic-sound-effect.mp3", DING = "sound effects/ding-sound-effect_2.mp3";
  const RISER_PEAK = 1.86, RISER_END = 1.89, WOOSH_LEAD = 0.09, WOOSH_PEAK = 0.16; // measured from the files
  if (FIXED) {
    js += `tl.fromTo("#cam", { scale: ${ZOOM} }, { scale: 1, duration: 0.3, ease: "expo.out", immediateRender: false }, 0);\n`;
    js += `tl.fromTo("#cam", { scale: 1 }, { scale: ${ZOOM}, duration: 0.3, ease: "expo.in", immediateRender: false }, ${r3(D - 0.3)});\n`;
  }
  const riserIn = Math.max(0, RISER_PEAK - (s.hookEnd || 0)); // hook shorter than the build: start inside the riser
  const fixedCues = [
    ...(!FIXED ? [] : [{ t: 0, file: WOOSH, ms: WOOSH_LEAD, vol: FV(0.25) },
    ...(s.typedHook ? [] : [{ t: r3(Math.max(0, s.hookEnd - RISER_PEAK)), file: RISER, ms: r3(riserIn), len: r3(RISER_END - riserIn), vol: FV(0.22) }]),
    { t: r3(D - 0.1 - WOOSH_PEAK), file: WOOSH, vol: FV(0.25) }]),
    ...typingCues,
    // Every arrow pointing at something gets the ding (user rule, workflow step 4): skip its first 0.11 s so the ding's
    // peak (0.21 s into the file) lands as the arrow finishes popping in. Circles don't point, so no ding.
    ...(YSC ? s.arrows || [] : []).filter((a) => a.kind !== "circle").map((a) => ({ t: a.t, file: DING, ms: 0.11, len: 1.2, vol: FV(0.35) })),
    ...(s.overlays || []).filter((o) => o.type === "label").map((o) => ({ t: o.t, file: DING, ms: 0.11, len: 1.2, vol: FV(0.35) })),
  ];

  // Transitions (one different type per scene change) and overlays from the motion-graphics library.
  const mglDir = path.join(dir, "assets", "mgl");
  const fx = mgl.apply({ D, transitions: s.transitions || [], overlays: s.overlays || [], ctx: mgl.makeCtx({
    freezeFrame: (t) => { fs.mkdirSync(mglDir, { recursive: true }); const f = `freeze_${r3(t)}.jpg`;
      if (!fs.existsSync(path.join(mglDir, f))) execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(Math.max(0, r3(t - 0.04))), "-i", path.join(dir, "assets", "base.mp4"), "-frames:v", "1", "-q:v", "2", path.join(mglDir, f)]);
      return `assets/mgl/${f}`; },
    asset: (p) => { const src = path.resolve(__dirname, "../..", p); if (!fs.existsSync(src)) { console.warn(`${name}: mgl asset missing, effect skipped: ${p}`); return null; }
      fs.mkdirSync(mglDir, { recursive: true }); fs.copyFileSync(src, path.join(mglDir, path.basename(src))); return `assets/mgl/${path.basename(src)}`; } }) });
  js += fx.js;
  js += pn.js; // panel graphics' own animations

  let audio = `<audio id="music" src="assets/music.wav" data-start="0" data-duration="${D}" data-track-index="5" data-volume="1"></audio>\n`;
  // SFX cue: {t, name} from the bundled manifest, or {t, file} = any sound in the repo (path from the repo root,
  // e.g. "commentary-kit/sfx/generated/camera_shutter.wav"; see docs/effects-catalog.md). Optional vol overrides.
  const cues = [
    ...fixedCues,
    ...s.sfx.map((x) => ({ t: x.t, name: x.name, file: x.file, vol: x.vol, ms: x.ms, len: x.len })),
    ...s.callouts.filter((c) => c.sfx).map((c) => ({ t: c.t, name: c.sfx })),
    // Transition SFX (user rule 2026-11-07): each of the CapCut 20 gets its sfxv2 sound with the hit on the cut.
    // Skip one with "sfx": false on the transition; "sfxVol" overrides the volume. Counts toward the skill's SFX cap.
    ...(s.transitions || []).filter((x) => x.sfx !== false && mgl.transitionSfx(x.type)).map((x) => { const m = mgl.transitionSfx(x.type);
      return { t: r3(Math.max(0, x.t - m.peak)), file: m.file, ms: r3(Math.max(0, m.peak - x.t)), vol: x.sfxVol ?? m.vol }; }),
  ].sort((a, b) => a.t - b.t);
  cues.forEach((q, qi) => {
    let src, dur;
    if (q.file) {
      src = path.resolve(__dirname, "../..", q.file);
      if (!fs.existsSync(src)) throw new Error(`${name}: sfx file not found: ${q.file}`);
      dur = probeDuration(src);
    } else {
      const m = sfxManifest[q.name];
      if (!m) throw new Error(`${name}: unknown sfx name "${q.name}" (use a manifest name or {file})`);
      src = path.join(SFX_DIR, m.file);
      dur = m.duration;
    }
    const file = `${qi}-${path.basename(src)}`; // numbered: kit packs reuse file names across folders
    fs.copyFileSync(src, path.join(dir, "assets", "sfx", file));
    const ms = q.ms || 0;
    const d = r3(Math.min(q.len ?? dur - ms, D - q.t));
    const key = (q.name || path.basename(src)).toLowerCase();
    const vol = q.vol ?? (/impact|boom|punch|hit/.test(key) ? 0.24 : key.startsWith("whoosh") ? 0.18 : /chime|ding/.test(key) ? 0.14 : 0.2);
    audio += `<audio id="sfx${qi}" src="assets/sfx/${file}" data-start="${q.t}" data-duration="${d}"${ms ? ` data-media-start="${ms}"` : ""} data-track-index="${6 + qi}" data-volume="${vol}"></audio>\n`;
  });

  // The panel graphics' own sounds, generated to fit each animation (no sound files). A split's scene-change "hit" is
  // dropped where a CAPCUT20 transition already puts its sfxv2 sound on that scene change (user rule 2026-11-07).
  const tCuts = (s.transitions || []).filter((x) => x.sfx !== false && mgl.transitionSfx(x.type)).map((x) => x.t);
  pn.sounds.filter((q) => !(q.kind === "hit" && tCuts.some((t) => Math.abs(t - q.t) <= 0.15))).forEach((q, i) => { const f = `pn${i}-${q.kind}.wav`;
    execFileSync("ffmpeg", [...panel.synthArgs(q.kind, q.d), path.join(dir, "assets", "sfx", f)]);
    const d = r3(Math.min(probeDuration(path.join(dir, "assets", "sfx", f)), D - q.t));
    if (d > 0.02) audio += `<audio id="pns${i}" src="assets/sfx/${f}" data-start="${r3(q.t)}" data-duration="${d}" data-track-index="${300 + i}" data-volume="${r3(s.panelSfxVol ?? 0.35)}"></audio>\n`; });

  const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>${esc(s.title)}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      :root { --deep: #111317; --deep-90: rgba(17, 19, 23, 0.86); --accent: #f5c542; --hl: ${s.highlight || "#39E75F"}; --ink: #ffffff; --shade: #08090b; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1080px; height: 1920px; overflow: hidden; background: #000; }
      #root { position: relative; width: 1080px; height: 1920px; overflow: hidden; font-family: "Montserrat", sans-serif; }
      #cam { position: absolute; inset: 0; transform-origin: 50% 40%; }
      #a-roll { width: 1080px; height: 1920px; object-fit: cover; display: block; }
      .cap, .co, #hook, .badgeclip { position: absolute; inset: 0; pointer-events: none; }
      .capin { position: absolute; left: 60px; right: 60px; top: ${capY}px; text-align: center; white-space: nowrap;
               font-weight: 900; font-size: 76px; line-height: 1.3; text-transform: uppercase; letter-spacing: -0.005em;
               color: var(--ink); -webkit-text-stroke: 11px var(--shade); paint-order: stroke fill;
               filter: drop-shadow(0 6px 10px rgba(0,0,0,0.55)); }
      .capin.top { top: 150px; }
      #cam.ysc { inset: auto; left: 0; right: 0; top: ${BAR}px; height: ${1920 - BAR}px; overflow: hidden; transform-origin: 50% 45%; }
      #cam.ysc #a-roll { height: 100%; transform-origin: 50% 45%; }
      .capin.ysc { left: 40px; right: 40px; font-size: 96px; -webkit-text-stroke: 13px #000; letter-spacing: 0;
                   filter: drop-shadow(0 6px 10px rgba(0,0,0,0.6)); }
      .capin.gab { -webkit-text-stroke: 0; filter: drop-shadow(0 0 10px rgba(0,0,0,0.85)) drop-shadow(0 3px 4px rgba(0,0,0,0.9)); }
      .gabpres { position: absolute; left: 0; right: 0; text-align: center; font-family: "Montserrat", sans-serif; font-weight: 900;
                 font-size: 44px; letter-spacing: 0.32em; color: #fff; text-transform: uppercase; -webkit-text-stroke: 2px rgba(0,0,0,0.6);
                 filter: drop-shadow(0 0 8px rgba(0,0,0,0.8)); }
      .ysbar, .ysfx { position: absolute; inset: 0; pointer-events: none; }
      .ysbar-in { position: absolute; left: 0; right: 0; top: 0; background: #000; display: flex; align-items: center;
                  justify-content: center; padding: 0 48px; }
      .ysbar-t { font-family: "Montserrat", sans-serif; font-weight: 900; font-size: 64px; line-height: 1.12; color: #fff;
                 text-align: center; text-transform: uppercase; }
      .ykey { color: ${s.keyColor || "#ff2a2a"}; }
      .ysflash { position: absolute; inset: 0; opacity: 0; }
      .ysarrow { position: absolute; transform-origin: 235px 55px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.55)); }
      .yscircle { position: absolute; border: 12px solid #ff2a2a; border-radius: 50%; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.55)); }
      .capin.pg { top: ${capY}px; font-size: 62px; letter-spacing: 0.01em; -webkit-text-stroke: 7px rgba(0,0,0,0.85);
                  filter: drop-shadow(0 0 10px rgba(255,255,255,0.28)) drop-shadow(0 5px 9px rgba(0,0,0,0.6)); }
      .capin.pg .w { margin: 0 0.12em; }
      .logoclip { position: absolute; inset: 0; pointer-events: none; }
      .pglogo { position: absolute; left: 50%; translate: -50% 0; font-family: "Oswald", sans-serif; font-weight: 700; font-size: 36px;
                letter-spacing: 0.08em; color: #fff; -webkit-text-stroke: 4px rgba(0,0,0,0.85); paint-order: stroke fill;
                filter: drop-shadow(0 0 8px rgba(255,255,255,0.45)) drop-shadow(0 2px 4px rgba(0,0,0,0.7)); }
      .pglabel { position: absolute; left: 50%; translate: -50% 0; font-family: "Montserrat", sans-serif; font-weight: 900; font-size: 46px;
                 color: #fff; text-transform: uppercase; -webkit-text-stroke: 5px rgba(0,0,0,0.8); paint-order: stroke fill;
                 filter: drop-shadow(0 0 12px rgba(255,255,255,0.5)); white-space: nowrap; }
      .w { display: inline-block; margin: 0 0.13em; }
      .w.em { color: var(--hl); font-size: 1.14em; margin: 0 0.16em; }
      .badge { position: absolute; left: 50%; top: 56px; translate: -50% 0; font-family: "Oswald", sans-serif; font-weight: 700;
               font-size: 54px; letter-spacing: 0.16em; color: var(--ink); background: var(--deep-90); padding: 12px 30px 12px 36px;
               border-left: 8px solid var(--accent); border-radius: 6px; white-space: nowrap; box-shadow: 0 8px 18px rgba(0,0,0,0.35); }
      #hook { display: flex; flex-direction: column; align-items: center; gap: 14px; padding-top: 760px; }
      #hook.low { padding-top: 1630px; }
      .hk { font-family: "Oswald", sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em;
            font-size: 84px; line-height: 1; padding: 18px 34px; white-space: nowrap; }
      .hk1 { color: var(--ink); background: var(--deep-90); box-shadow: 0 12px 28px rgba(0,0,0,0.45); }
      .hk2 { color: var(--deep); background: var(--accent); box-shadow: 0 12px 28px rgba(0,0,0,0.45); }
      .hkrule { width: 520px; height: 6px; background: var(--accent); transform-origin: left center; }
      .plate { position: absolute; left: 60px; right: 60px; top: 1640px; padding: 26px 34px 24px; background: var(--deep-90);
               border-radius: 10px; box-shadow: 0 14px 30px rgba(0,0,0,0.5); }
      .pl-rule { position: absolute; left: 0; top: 0; height: 6px; width: 100%; background: var(--accent); border-radius: 10px 10px 0 0; transform-origin: left center; }
      .pl-t { font-family: "Oswald", sans-serif; font-weight: 700; color: var(--ink); letter-spacing: 0.02em; white-space: nowrap; }
      .pl-s { font-family: "Montserrat", sans-serif; font-weight: 700; font-size: 26px; color: var(--accent); letter-spacing: 0.08em; margin-top: 8px; white-space: nowrap; }
      .chip { position: absolute; left: 50%; top: 1310px; translate: -50% 0; white-space: nowrap; font-family: "Oswald", sans-serif;
              font-weight: 700; font-size: 50px; letter-spacing: 0.03em; color: var(--deep); background: var(--accent);
              padding: 14px 30px; border-radius: 8px; box-shadow: 0 10px 22px rgba(0,0,0,0.45); }
      .stamp { position: absolute; left: 50%; top: 1110px; translate: -50% 0; white-space: nowrap; font-family: "Oswald", sans-serif;
               font-weight: 700; font-size: 96px; letter-spacing: 0.02em; color: var(--accent); background: var(--deep-90);
               border: 6px solid var(--accent); padding: 6px 36px; border-radius: 12px; max-width: 1000px;
               filter: drop-shadow(0 14px 22px rgba(0,0,0,0.6)); }
      .typedhook { position: absolute; left: 40px; right: 40px; text-align: center; font-family: "Montserrat", sans-serif; font-weight: 900;
                   font-size: 64px; line-height: 1.1; text-transform: uppercase; color: #fff; -webkit-text-stroke: 9px #000; paint-order: stroke fill; }
      .th-line { display: block; }
      .th-key { color: #39E75F; text-shadow: 0 0 18px rgba(57,231,95,.85), 0 0 36px rgba(57,231,95,.5); }
${mgl.CSS}${panel.PANEL_CSS}    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${D}" data-width="1080" data-height="1920">
      <div id="cam"${YSC ? ' class="ysc"' : ""}>
${fx.below}        <div id="fx">
        <video id="a-roll" class="clip" src="assets/base.mp4" playsinline data-has-audio="true" data-start="0" data-duration="${D}" data-track-index="0" data-volume="1"></video>
${fx.inFx}        </div>
${fx.above}${pn.html}      </div>
${html}${audio}    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
${js}      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
  fs.writeFileSync(path.join(dir, "index.html"), page);
  fs.writeFileSync(path.join(dir, "hyperframes.json"), JSON.stringify({
    $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
    registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
    paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
    media: { autoProxy: true },
  }, null, 2));
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ id: name, name: s.title, createdAt: new Date().toISOString() }, null, 2));
  console.log(`${name}: ${D}s, ${groups.length} caption lines, ${s.callouts.length} callouts, ${s.punch.length} punch-ins, ${cues.length} sfx + music`);
}

for (const n of process.argv.slice(3)) build(n);
