// Panel graphics + split layout for explainer/motivational Shorts (the /motivational reference look):
// whenever a panel graphic is on screen the frame splits: a black motion-graphics panel on top (0..PANEL_H) and the
// speaker in a band below (a synced, muted copy of the footage); with no graphic, the full-frame speaker shows.
// Every graphic makes its own sound: build() returns sound events shaped to each animation, which the builder renders
// with ffmpeg (synth(), no sound files). Used by tools/pipeline/build-shorts.js ("panel": [...]). Index: EFFECTS_INDEX.md.
// Look follows prompt-motion.com's showreel direction (2026-10-28): one typeface, <= 3 colours + black/white, no glows,
// gradients or bouncy easing, exponential easing with blur that follows fast moves, nothing holds still (slow drift),
// graphics leave by moving/blurring out (no crossfades), a code-generated hit on each scene change.
// Self-check: node motion-graphics-library/panel.js --selftest
"use strict";

const PANEL_H = 1280;
const r3 = (x) => Math.round(x * 1000) / 1000;
const tw = (sel, from, to, dur, at, ease = "none") =>
  `tl.fromTo("${sel}", ${JSON.stringify(from)}, ${JSON.stringify({ ...to, duration: r3(Math.max(dur, 0.001)), ease, immediateRender: false })}, ${r3(Math.max(at, 0))});\n`;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const accent = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em class="pn-acc">$1</em>');

// Neon line icons, 100x100 viewBox, stroke only (drawn on with strokeDashoffset).
const ICONS = {
  infinity: "M20 50 C20 30 45 30 50 50 C55 70 80 70 80 50 C80 30 55 30 50 50 C45 70 20 70 20 50 Z",
  check: "M25 52 L43 70 L77 32", cross: "M30 30 L70 70 M70 30 L30 70",
  "arrow-up": "M50 82 L50 20 M30 40 L50 20 L70 40", "arrow-right": "M18 50 L82 50 M62 30 L82 50 L62 70",
  mountain: "M10 80 L38 35 L52 55 L64 40 L90 80 Z M38 35 L38 18 L50 22 L38 26",
  trophy: "M32 20 H68 V40 C68 55 58 62 50 62 C42 62 32 55 32 40 Z M32 26 H20 C20 40 28 44 34 44 M68 26 H80 C80 40 72 44 66 44 M50 62 V74 M36 82 H64",
  clock: "M50 15 A35 35 0 1 1 49.9 15 M50 30 V50 L65 58",
  heart: "M50 80 C20 60 12 42 22 30 C32 18 46 24 50 34 C54 24 68 18 78 30 C88 42 80 60 50 80 Z",
  person: "M50 20 A12 12 0 1 1 49.9 20 M28 80 C28 58 72 58 72 80",
  lightbulb: "M38 64 C30 56 28 48 28 42 A22 22 0 1 1 72 42 C72 48 70 56 62 64 Z M40 72 H60 M43 80 H57",
  flame: "M50 85 C30 85 24 66 34 52 C36 62 42 64 44 60 C40 46 48 30 56 18 C58 34 76 44 74 62 C72 78 62 85 50 85 Z",
  target: "M50 15 A35 35 0 1 1 49.9 15 M50 32 A18 18 0 1 1 49.9 32 M50 46 A4 4 0 1 1 49.9 46",
  rocket: "M50 12 C64 26 66 48 60 66 H40 C34 48 36 26 50 12 Z M40 58 L28 72 L40 70 M60 58 L72 72 L60 70 M44 72 L50 88 L56 72",
  "chart-up": "M15 80 H85 M20 70 L40 50 L55 60 L80 30 M66 30 H80 V44", "chart-down": "M15 80 H85 M20 30 L40 50 L55 40 L80 70 M66 70 H80 V56",
  money: "M60 28 C56 22 44 22 40 30 C36 40 64 42 60 56 C57 66 44 66 38 60 M50 16 V74",
  star: "M50 14 L60 40 L88 40 L66 56 L74 84 L50 68 L26 84 L34 56 L12 40 L40 40 Z",
  lock: "M32 48 H68 V82 H32 Z M38 48 V36 A12 12 0 0 1 62 36 V48", dumbbell: "M20 40 V60 M28 34 V66 M72 34 V66 M80 40 V60 M28 50 H72",
  calendar: "M22 28 H78 V82 H22 Z M22 42 H78 M36 20 V34 M64 20 V34", stairs: "M15 82 H35 V66 H52 V50 H69 V34 H86",
  eye: "M10 50 C30 20 70 20 90 50 C70 80 30 80 10 50 Z M50 38 A12 12 0 1 1 49.9 38",
  brain: "M50 22 C38 14 22 22 24 36 C12 40 14 58 26 60 C26 74 42 80 50 70 C58 80 74 74 74 60 C86 58 88 40 76 36 C78 22 62 14 50 22 Z M50 22 V70",
};

// kind -> build(o, c) -> { html, js, sounds: [{t, kind, d}] }. o.t..o.e is the graphic's time on screen.
const K = {};
const kdef = (name, desc, defaults, build) => (K[name] = { name, desc, defaults, build });
const wrap = (c, o, inner) => `<div id="${o._id}" class="clip pn-el" data-start="${r3(o.t)}" data-duration="${r3(o.e - o.t)}" data-track-index="${c.track()}">${inner}</div>\n`;
const drawIcon = (c, name, color, x, y, size, at, dur) => {
  if (!ICONS[name]) throw new Error(`panel: unknown icon "${name}" (${Object.keys(ICONS).join(", ")})`);
  const id = c.id();
  return { html: `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="position:absolute;left:${x - size / 2}px;top:${y - size / 2}px;overflow:visible"><path id="${id}" d="${ICONS[name]}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`,
    js: tw(`#${id}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0 }, dur, at, "power2.inOut"), sound: { t: at, kind: "shimmer", d: dur } };
};

kdef("title", "Headline at the top of the panel, typed in word by word (each word on its time); *accent* words in italic accent colour", { y: 70, size: 66, gap: 0.12 },
  (o, c) => { const words = String(o.text).split(/\s+/); let html = "", js = ""; const sounds = [];
    let open = false; // keep *multi word accent* spans together
    words.forEach((w, i) => { const id = c.id(), at = o.times?.[i] ?? o.t + i * o.gap;
      const startAcc = w.startsWith("*"), endAcc = /\*[.,!?:]*$/.test(w); if (startAcc) open = true;
      html += `<span id="${id}" class="pn-w${open ? " pn-acc" : ""}" style="opacity:0">${esc(w.replace(/\*/g, ""))}</span> `; if (endAcc) open = false;
      js += tw(`#${id}`, { opacity: 0, y: 14 }, { opacity: 1, y: 0 }, 0.16, at, "power2.out"); sounds.push({ t: at, kind: "tick", d: 0.04 }); });
    return { html: wrap(c, o, `<div class="pn-title" style="top:${o.y}px;font-size:${o.size}px">${html}</div>`), js, sounds }; });
kdef("icon", "Neon line icon that draws itself on, glowing, with an optional label (icons: see ICONS)", { name: "star", color: "#39E75F", x: 540, y: 600, size: 330, draw: 0.6, label: "" },
  (o, c) => { const ic = drawIcon(c, o.name, o.color, o.x, o.y, o.size, o.t, o.draw), lid = c.id();
    return { html: wrap(c, o, ic.html + (o.label ? `<div id="${lid}" class="pn-label" style="opacity:0;top:${o.y + o.size / 2 + 20}px;left:${o.x - Math.max(170, o.size * 0.75)}px;right:auto;width:${2 * Math.max(170, o.size * 0.75)}px;font-size:${o.size < 300 ? 38 : 46}px">${accent(o.label)}</div>` : "")),
      js: ic.js + (o.label ? tw(`#${lid}`, { opacity: 0, y: 16 }, { opacity: 1, y: 0 }, 0.25, o.t + o.draw * 0.6, "power2.out") : ""), sounds: [ic.sound] }; });
kdef("list", "Stacked rows that light up one by one on their own times (each row: text, t, color)", { y: 330, gap: 130, items: [] },
  (o, c) => { let html = "", js = ""; const sounds = [];
    o.items.forEach((it, i) => { const id = c.id(), at = it.t ?? o.t + i * 0.4, col = it.color || "#39E75F";
      html += `<div id="${id}" class="pn-row" style="opacity:0;top:${o.y + i * o.gap}px;border-color:${col}"><span class="pn-dot" style="background:${col}"></span>${accent(it.text)}</div>`;
      js += tw(`#${id}`, { opacity: 0, x: -90, filter: "blur(12px)" }, { opacity: 1, x: 0, filter: "blur(0px)" }, 0.3, at, "expo.out"); sounds.push({ t: at, kind: "whoosh", d: 0.28 }); });
    return { html: wrap(c, o, html), js, sounds }; });
kdef("quote", "Quote card: big italic quote whose words appear as they're spoken (times = word times), optional author", { y: 300, size: 74, gap: 0.18, author: "" },
  (o, c) => { const words = String(o.text).split(/\s+/), qid = c.id(), aid = c.id(); let html = "", js = tw(`#${qid}`, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1 }, 0.3, o.t, "expo.out"); const sounds = [{ t: o.t, kind: "pop", d: 0.1 }];
    words.forEach((w, i) => { const id = c.id(), at = o.times?.[i] ?? o.t + 0.15 + i * o.gap;
      html += `<span id="${id}" class="pn-w" style="opacity:0">${esc(w.replace(/\*/g, ""))}</span> `; js += tw(`#${id}`, { opacity: 0 }, { opacity: 1 }, 0.14, at); });
    if (o.author) { js += tw(`#${aid}`, { opacity: 0 }, { opacity: 1 }, 0.3, (o.times?.at(-1) ?? o.t + words.length * o.gap) + 0.3); }
    return { html: wrap(c, o, `<div id="${qid}" class="pn-qmark" style="opacity:0;top:${o.y - 120}px">&ldquo;</div><div class="pn-quote" style="top:${o.y}px;font-size:${o.size}px">${html}</div>${o.author ? `<div id="${aid}" class="pn-author" style="opacity:0">— ${esc(o.author)}</div>` : ""}`), js, sounds }; });
kdef("counter", "Big number counting from `from` to `to` (prefix/suffix) with a label; rising tone across the count", { from: 0, to: 100, prefix: "", suffix: "", label: "", y: 470, dur: 1.2, color: "#39E75F" },
  (o, c) => { const id = c.id(), lid = c.id();
    return { html: wrap(c, o, `<div class="pn-count" style="top:${o.y}px;color:${o.color}">${esc(o.prefix)}<span id="${id}">${o.from}</span>${esc(o.suffix)}</div>${o.label ? `<div id="${lid}" class="pn-label" style="opacity:0;top:${o.y + 230}px">${accent(o.label)}</div>` : ""}`),
      js: tw(`#${id}`, { innerText: o.from }, { innerText: o.to, snap: { innerText: 1 } }, o.dur, o.t, "power2.out") + (o.label ? tw(`#${lid}`, { opacity: 0 }, { opacity: 1 }, 0.3, o.t + 0.2) : ""),
      sounds: [{ t: o.t, kind: "rise", d: o.dur }] }; });
kdef("timeline", "Progress bar with markers that fill to their positions on their times (marks: t, at 0..1, label, color)", { y: 640, marks: [] },
  (o, c) => { const fid = c.id(); let html = `<div class="pn-bar" style="top:${o.y}px"><div id="${fid}" class="pn-fill"></div></div>`, js = ""; const sounds = []; let prev = 0;
    o.marks.forEach((m, i) => { const id = c.id(), col = m.color || "#39E75F", at = m.t ?? o.t + i * 0.6;
      js += tw(`#${fid}`, { scaleX: prev, background: col }, { scaleX: m.at, background: col }, 0.45, at, "power2.out"); prev = m.at;
      html += `<div id="${id}" class="pn-mark" style="opacity:0;left:${120 + 840 * m.at}px;top:${o.y - 70}px;color:${col}">${accent(m.label || "")}</div>`;
      js += tw(`#${id}`, { opacity: 0, y: 12 }, { opacity: 1, y: 0 }, 0.25, at + 0.3, "power2.out"); sounds.push({ t: at, kind: "rise", d: 0.45 }); });
    return { html: wrap(c, o, html), js, sounds }; });
kdef("people", "Ring of person icons filling up around a centre label (n people, fills over `fill` seconds)", { n: 16, color: "#ff3b3b", label: "", y: 640, r: 300, fill: 1.0 },
  (o, c) => { let html = "", js = ""; const lid = c.id();
    for (let i = 0; i < o.n; i++) { const id = c.id(), a = (i / o.n) * 2 * Math.PI - Math.PI / 2, x = 540 + o.r * Math.cos(a), y = o.y + o.r * Math.sin(a);
      html += `<svg id="${id}" width="64" height="64" viewBox="0 0 100 100" style="opacity:0;position:absolute;left:${r3(x - 32)}px;top:${r3(y - 32)}px"><path d="${ICONS.person}" fill="none" stroke="${o.color}" stroke-width="10" stroke-linecap="round"/></svg>`;
      js += tw(`#${id}`, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1 }, 0.18, o.t + (i * o.fill) / o.n, "expo.out"); }
    if (o.label) { html += `<div id="${lid}" class="pn-label" style="opacity:0;top:${o.y - 40}px">${accent(o.label)}</div>`; js += tw(`#${lid}`, { opacity: 0 }, { opacity: 1 }, 0.3, o.t); }
    return { html: wrap(c, o, html), js, sounds: [{ t: o.t, kind: "rise", d: o.fill }] }; });
kdef("compare", "Two columns (left vs right) whose titles and icons appear on their own times, e.g. before/after, wrong/right", { y: 420, left: { title: "BEFORE", icon: "cross", color: "#ff3b3b" }, right: { title: "AFTER", icon: "check", color: "#39E75F" } },
  (o, c) => { let html = "", js = ""; const sounds = [];
    [["left", 290], ["right", 790]].forEach(([k, x], i) => { const s = o[k], at = s.t ?? o.t + i * 0.8, tid = c.id(), ic = drawIcon(c, s.icon, s.color, x, o.y + 260, 220, at + 0.1, 0.45);
      html += `<div id="${tid}" class="pn-coltitle" style="opacity:0;left:${x - 230}px;top:${o.y}px;color:${s.color}">${accent(s.title)}</div>` + ic.html;
      js += tw(`#${tid}`, { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, 0.25, at, "power2.out") + ic.js; sounds.push(ic.sound); });
    return { html: wrap(c, o, `<div class="pn-vline" style="top:${o.y}px"></div>` + html), js, sounds }; });
kdef("document", "Script/document card whose sections fill in with coloured lines on their times (sections: t, label, color, lines)", { y: 260, title: "", sections: [] },
  (o, c) => { const cid = c.id(); let inner = o.title ? `<div class="pn-doc-t">${accent(o.title)}</div>` : "", js = tw(`#${cid}`, { opacity: 0, y: 40 }, { opacity: 1, y: 0 }, 0.35, o.t, "power3.out"); const sounds = [{ t: o.t, kind: "whoosh", d: 0.35 }];
    o.sections.forEach((s, i) => { const at = s.t ?? o.t + 0.5 + i * 0.6, col = s.color || "#ffffff", lid = c.id();
      inner += `<div id="${lid}" class="pn-doc-l" style="opacity:0;color:${col}">${accent(s.label)}</div>`; js += tw(`#${lid}`, { opacity: 0 }, { opacity: 1 }, 0.15, at);
      for (let k = 0; k < (s.lines || 3); k++) { const id = c.id(); inner += `<div id="${id}" class="pn-doc-line" style="transform:scaleX(0);background:${col};width:${86 - k * 9}%"></div>`;
        js += tw(`#${id}`, { scaleX: 0 }, { scaleX: 1 }, 0.25, at + 0.06 * k, "power2.out"); }
      sounds.push({ t: at, kind: "tick", d: 0.04 }); });
    return { html: wrap(c, o, `<div id="${cid}" class="pn-doc" style="opacity:0;top:${o.y}px">${inner}</div>`), js, sounds }; });
kdef("screen", "Rounded 'screen' card showing footage from the source (ms = media time, default the same moment) that pops in", { y: 300, w: 640, h: 860, ms: null },
  (o, c) => { const id = c.id(), vid = c.id();
    return { html: wrap(c, o, `<div id="${id}" class="pn-screen" style="opacity:0;left:${540 - o.w / 2}px;top:${o.y}px;width:${o.w}px;height:${o.h}px"><video id="${vid}" class="clip" src="${c.video}" muted playsinline data-start="${r3(o.t)}" data-duration="${r3(o.e - o.t)}" data-media-start="${r3(o.ms ?? o.t)}" data-track-index="${c.track()}" data-volume="0" style="width:100%;height:100%;object-fit:cover"></video></div>`),
      js: tw(`#${id}`, { scale: 0.6, opacity: 0, filter: "blur(14px)" }, { scale: 1, opacity: 1, filter: "blur(0px)" }, 0.35, o.t, "expo.out"), sounds: [{ t: o.t, kind: "pop", d: 0.1 }] }; });

const PANEL_CSS = `
      .pn-bg { position: absolute; left: 0; right: 0; top: 0; height: ${PANEL_H}px; background: #000; }
      .pn-band { position: absolute; left: 0; right: 0; top: ${PANEL_H}px; height: ${1920 - PANEL_H}px; width: 1080px; object-fit: cover; }
      .pn-el { position: absolute; inset: 0; pointer-events: none; }
      .pn-title { position: absolute; left: 50px; right: 50px; text-align: center; font-family: "Montserrat", sans-serif; font-weight: 800; color: #fff; line-height: 1.12; }
      .pn-w { display: inline-block; }
      .pn-acc { font-style: italic; color: var(--pn-accent, #39E75F); }
      .pn-label { position: absolute; left: 60px; right: 60px; text-align: center; font-family: "Montserrat", sans-serif; font-weight: 700; font-size: 46px; color: #e8e8e8; }
      .pn-row { position: absolute; left: 150px; right: 150px; height: 96px; display: flex; align-items: center; gap: 26px; padding: 0 30px; font-family: "Montserrat", sans-serif; font-weight: 800; font-size: 46px; color: #fff; background: rgba(255,255,255,.06); border: 3px solid; border-radius: 18px; }
      .pn-dot { width: 26px; height: 26px; border-radius: 50%; flex: none; }
      .pn-qmark { position: absolute; left: 0; right: 0; text-align: center; font-family: "Montserrat", sans-serif; font-size: 220px; color: var(--pn-accent, #39E75F); }
      .pn-quote { position: absolute; left: 90px; right: 90px; text-align: center; font-family: "Montserrat", sans-serif; font-style: italic; color: #fff; line-height: 1.2; }
      .pn-author { position: absolute; left: 0; right: 0; top: 1100px; text-align: center; font-family: "Montserrat", sans-serif; font-weight: 700; font-size: 40px; color: #aaa; }
      .pn-count { position: absolute; left: 0; right: 0; text-align: center; font-family: "Montserrat", sans-serif; font-weight: 900; font-size: 200px; }
      .pn-bar { position: absolute; left: 120px; right: 120px; height: 26px; border-radius: 13px; background: rgba(255,255,255,.15); overflow: hidden; }
      .pn-fill { width: 100%; height: 100%; transform-origin: left center; }
      .pn-mark { position: absolute; translate: -50% 0; font-family: "Montserrat", sans-serif; font-weight: 800; font-size: 36px; white-space: nowrap; }
      .pn-coltitle { position: absolute; width: 460px; text-align: center; font-family: "Montserrat", sans-serif; font-weight: 900; font-size: 54px; }
      .pn-vline { position: absolute; left: 538px; width: 4px; height: 560px; background: rgba(255,255,255,.2); }
      .pn-doc { position: absolute; left: 230px; right: 230px; padding: 34px 38px; background: #1c1e23; border: 2px solid #3a3d44; border-radius: 16px; box-shadow: 0 30px 60px rgba(0,0,0,.6); }
      .pn-doc-t { font-family: "Montserrat", sans-serif; font-style: italic; font-size: 34px; color: #ccc; text-align: center; margin-bottom: 18px; }
      .pn-doc-l { font-family: "Montserrat", sans-serif; font-weight: 800; font-size: 30px; margin: 16px 0 8px; }
      .pn-doc-line { height: 12px; border-radius: 6px; margin: 9px 0; opacity: .85; transform-origin: left center; }
      .pn-screen { position: absolute; border-radius: 28px; overflow: hidden; border: 4px solid rgba(255,255,255,.25); box-shadow: 0 30px 60px rgba(0,0,0,.6); }
`;

// Sound synthesis (ffmpeg lavfi args) for each graphic's own sound, shaped to its duration d.
function synthArgs(kind, d) {
  const D = r3(Math.max(0.04, d));
  const src = {
    tick: [`aevalsrc='0.55*sin(2*PI*2300*t)*exp(-110*t)':s=48000:d=0.06`],
    pop: [`aevalsrc='0.7*sin(2*PI*(820-3600*t)*t)*exp(-34*t)':s=48000:d=0.14`],
    whoosh: [`anoisesrc=d=${D + 0.08}:c=pink:a=0.6:r=48000`, `highpass=f=500,lowpass=f=6000,afade=t=in:d=${r3(D * 0.65)}:curve=exp,afade=t=out:st=${r3(D * 0.65)}:d=${r3(D * 0.35 + 0.08)}`],
    shimmer: [`aevalsrc='0.16*(sin(2*PI*1320*t)+sin(2*PI*1760*t)+0.6*sin(2*PI*2640*t))*(0.55+0.45*sin(2*PI*16*t))*min(1,t*20)*exp(-1.6*t/${D})':s=48000:d=${D + 0.25}`],
    hit: [`aevalsrc='0.9*sin(2*PI*(120-180*t)*t)*exp(-13*t)+0.25*sin(2*PI*55*t)*exp(-9*t)':s=48000:d=0.4`],
    rise: [`aevalsrc='0.28*sin(2*PI*(330*t+260*t*t/${D}))*min(1,t*15)*(1-0.6*t/${D + 0.2})':s=48000:d=${D + 0.05}`],
  }[kind];
  if (!src) throw new Error(`panel: unknown sound "${kind}"`);
  return ["-v", "error", "-y", "-f", "lavfi", "-i", src[0], ...(src[1] ? ["-af", src[1]] : []), "-ac", "2"];
}

// Splits: the screen is split exactly while panel graphics are on screen (merged when gaps are < 0.5 s).
function splits(beats, D) {
  const iv = beats.map((b) => [b.t, b.e]).sort((a, b) => a[0] - b[0]), out = [];
  for (const [a, b] of iv) { const L = out[out.length - 1]; if (L && a - L[1] < 0.5) L[1] = Math.max(L[1], b); else out.push([a, b]); }
  return out.map(([a, b]) => [r3(Math.max(0, a)), r3(Math.min(D, b))]);
}

// beats: shorts.json "panel" [{t, e, kind, ...}]; returns { html, js, sounds, splits, capYAt(t) }.
function build({ panel = [], D, ctx, bandFocus = "50% 32%", splitCapY = PANEL_H - 100, accent = "#39E75F" }) {
  const beats = panel.map((x) => { const k = K[x.kind]; if (!k) throw new Error(`panel: unknown kind "${x.kind}" (${Object.keys(K).join(", ")})`);
    const o = { ...k.defaults, ...x }; o.e = o.e ?? o.t + 3;
    if (!(o.t >= 0 && o.e > o.t && o.t < D)) throw new Error(`panel: "${x.kind}" needs 0 <= t < e and t < ${D}`); o.e = Math.min(o.e, D); return o; });
  const sp = splits(beats, D); let html = "", js = ""; const sounds = [];
  sp.forEach(([a, b]) => { html += `<div id="${ctx.id()}w" class="clip pn-el" data-start="${a}" data-duration="${r3(b - a)}" data-track-index="${ctx.track()}" style="--pn-accent:${accent}"><div class="pn-bg"></div></div>\n` +
    `<video id="${ctx.id()}" class="clip pn-band" src="${ctx.video}" muted playsinline data-start="${a}" data-duration="${r3(b - a)}" data-media-start="${a}" data-track-index="${ctx.track()}" data-volume="0" style="object-position:${bandFocus}"></video>\n`; });
  for (const o of beats) { o._id = `${ctx.id()}w`; const r = K[o.kind].build(o, ctx); html += r.html; js += r.js; sounds.push(...(o.sound === false ? [] : r.sounds));
    const life = o.e - o.t; // slow drift so nothing holds still; leave by moving up and blurring out
    js += tw(`#${o._id}`, { scale: 1 }, { scale: 1.03 }, life, o.t);
    if (life > 0.7) js += tw(`#${o._id}`, { y: 0, opacity: 1, filter: "blur(0px)" }, { y: -60, opacity: 0, filter: "blur(10px)" }, 0.25, o.e - 0.25, "expo.in"); }
  sp.forEach(([a]) => sounds.push({ t: a, kind: "hit", d: 0.35 })); // a hit on each scene change
  return { html, js, sounds, splits: sp, capYAt: (t) => (sp.some(([a, b]) => t >= a && t < b) ? splitCapY : null) };
}

module.exports = { PANEL_H, ICONS, KINDS: K, PANEL_CSS, synthArgs, splits, build };

if (require.main === module && process.argv[2] === "--selftest") {
  const mgl = require("./mgl.js"), ctx = mgl.makeCtx({ freezeFrame: () => "x.jpg" });
  const beats = Object.keys(K).map((kind, i) => ({ kind, t: i * 3, e: i * 3 + 1.8, text: "The *Ultimate* Format", items: [{ text: "Hook" }], marks: [{ at: 0.3 }], sections: [{ label: "Hook" }] }));
  const r = build({ panel: beats, D: 60, ctx });
  if (r.splits.length !== beats.length) throw new Error("each separated graphic should make its own split");
  if (build({ panel: [{ kind: "icon", t: 1, e: 3 }, { kind: "title", t: 3.2, e: 5, text: "x" }], D: 10, ctx }).splits.length !== 1) throw new Error("close graphics must merge into one split");
  if (r.capYAt(0.5) !== PANEL_H - 100 || r.capYAt(1.9) !== null) throw new Error("caption position must follow the splits");
  for (const k of ["tick", "pop", "whoosh", "shimmer", "rise", "hit"]) synthArgs(k, 0.4);
  if (/back\.out|elastic|drop-shadow|radial-gradient|Playfair|Georgia/.test(require("fs").readFileSync(__filename, "utf8").split("if (require.main")[0].replace(/\/\/.*$/gm, "")))
    throw new Error("prompt-motion direction broken: glow, bounce, gradient or second typeface found");
  let bad = false; try { build({ panel: [{ kind: "icon", name: "nope", t: 0, e: 1 }], D: 5, ctx }); } catch { bad = true; } if (!bad) throw new Error("unknown icon accepted");
  console.log(`selftest ok: ${Object.keys(K).length} panel kinds, ${Object.keys(ICONS).length} icons, ${r.sounds.length} generated sounds`);
}
