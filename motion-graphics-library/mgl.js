// Motion-graphics library: CapCut-style transitions, caption animations and overlays for the HyperFrames Shorts
// builder (tools/pipeline/build-shorts.js). Each preset returns plain HTML + GSAP lines added to the composition's
// single paused timeline, so everything is seek-safe and passes `hf.sh check`. Index: EFFECTS_INDEX.md.
//
// Layer model inside #cam:  [freeze stills (below)] [#fx > #a-roll + synced duplicate layers] [flash/leak overlays]
//   #fx       wrapper the transitions transform/filter/clip (the builder's drift/punch tweens stay on #a-roll/#cam)
//   freeze    a still of the outgoing shot's last frame (ctx.freeze) so slides/wipes/reveals have two pictures
//   dup       a muted copy of base.mp4 playing in sync (same media time) for RGB split, radial blur, glitch slices
// Self-check: node motion-graphics-library/mgl.js --selftest
"use strict";

const r3 = (x) => Math.round(x * 1000) / 1000;
const typeDuration = (n, k = 1) => r3(Math.min(0.9, (0.045 * Math.max(2, n)) / k)); // shared with the builder's typing clicks
const tw = (sel, from, to, dur, at, ease = "none") =>
  `tl.fromTo("${sel}", ${JSON.stringify(from)}, ${JSON.stringify({ ...to, duration: r3(Math.max(dur, 0.001)), ease, immediateRender: false })}, ${r3(Math.max(at, 0))});\n`;
const DIRS = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const dirv = (d) => DIRS[d] || DIRS.left;

// ---------- transitions: build(o, ctx) at cut time o.t -> { below, inFx, above, js } ----------
// o: { t, d (total seconds), intensity (1 = default), dir, color, ease }   ctx: see makeCtx()
const T = {};
const def = (name, category, desc, defaults, build) => (T[name] = { name, category, desc, defaults, build });

// A. zoom and camera
def("zoom-in", "zoom", "Push hard into the outgoing shot, incoming lands zoomed and settles", { d: 0.36 },
  (o) => { const h = o.d / 2, z = 1 + 0.6 * o.intensity;
    return { js: tw("#fx", { scale: 1 }, { scale: z }, h, o.t - h, "expo.in") + tw("#fx", { scale: z }, { scale: 1 }, h, o.t, "expo.out") }; });
def("zoom-out", "zoom", "Outgoing shrinks away, incoming arrives oversized and pulls back to fit", { d: 0.4 },
  (o) => { const h = o.d / 2;
    return { js: tw("#fx", { scale: 1 }, { scale: 1 - 0.22 * o.intensity }, h, o.t - h, "power3.in") + tw("#fx", { scale: 1 + 0.35 * o.intensity }, { scale: 1 }, h, o.t, "power3.out") }; });
def("punch-zoom", "zoom", "Incoming hits at +25% and snaps back to full frame (no outgoing motion)", { d: 0.32 },
  (o) => ({ js: tw("#fx", { scale: 1 + 0.25 * o.intensity }, { scale: 1 }, o.d, o.t, "expo.out") }));
def("snap-zoom", "zoom", "Incoming holds a hard crop for a beat, then snaps to full frame", { d: 0.22 },
  (o) => ({ js: tw("#fx", { scale: 1 + 0.35 * o.intensity }, { scale: 1 + 0.35 * o.intensity }, o.d * 0.6, o.t) + tw("#fx", { scale: 1 + 0.35 * o.intensity }, { scale: 1 }, 0.04, o.t + o.d * 0.6) }));
def("zoom-blur", "zoom", "Zoom-in through a motion blur", { d: 0.4 },
  (o) => { const h = o.d / 2, z = 1 + 0.55 * o.intensity, b = 16 * o.intensity;
    return { js: tw("#fx", { scale: 1, filter: "blur(0px)" }, { scale: z, filter: `blur(${b}px)` }, h, o.t - h, "expo.in") +
      tw("#fx", { scale: z, filter: `blur(${b}px)` }, { scale: 1, filter: "blur(0px)" }, h, o.t, "expo.out") }; });
def("push-in", "zoom", "Slow dynamic push into the new shot", { d: 1.2 },
  (o) => ({ js: tw("#fx", { scale: 1 }, { scale: 1 + 0.1 * o.intensity }, o.d, o.t, "power1.inOut") + tw("#fx", { scale: 1 + 0.1 * o.intensity }, { scale: 1 }, 0.001, o.t + o.d) }));
def("pull-out", "zoom", "New shot starts tight and slowly pulls back", { d: 1.2 },
  (o) => ({ js: tw("#fx", { scale: 1 + 0.12 * o.intensity }, { scale: 1 }, o.d, o.t, "power1.out") }));
def("spin", "zoom", "Rotate-and-zoom out of the outgoing shot, counter-rotate into the incoming", { d: 0.42 },
  (o) => { const h = o.d / 2, a = 22 * o.intensity;
    return { js: tw("#fx", { rotation: 0, scale: 1, filter: "blur(0px)" }, { rotation: a, scale: 1.35, filter: "blur(10px)" }, h, o.t - h, "power3.in") +
      tw("#fx", { rotation: -a, scale: 1.35, filter: "blur(10px)" }, { rotation: 0, scale: 1, filter: "blur(0px)" }, h, o.t, "power3.out") }; });

// B. motion and directional
def("whip", "motion", "Whip pan: outgoing flies off with motion blur and skew, incoming flies in from the other side (dir)", { d: 0.32, dir: "left" },
  (o) => { const h = o.d / 2, [dx, dy] = dirv(o.dir), px = 700 * o.intensity, b = 22 * o.intensity, sk = dy ? 0 : -14 * dx;
    return { js: tw("#fx", { x: 0, y: 0, skewX: 0, filter: "blur(0px)" }, { x: dx * px, y: dy * px, skewX: sk, filter: `blur(${b}px)` }, h, o.t - h, "power4.in") +
      tw("#fx", { x: -dx * px, y: -dy * px, skewX: -sk, filter: `blur(${b}px)` }, { x: 0, y: 0, skewX: 0, filter: "blur(0px)" }, h, o.t, "power4.out") }; });
def("slide", "motion", "Incoming slides in over the frozen last frame of the outgoing shot (dir = travel direction)", { d: 0.45, dir: "left" },
  (o, c) => { const [dx, dy] = dirv(o.dir);
    return { below: c.freeze(o.t, o.d), js: tw("#fx", { x: -dx * 1080, y: -dy * 1920 }, { x: 0, y: 0 }, o.d, o.t, "power3.out") }; });
def("push", "motion", "Incoming pushes the frozen outgoing frame off screen (dir = travel direction)", { d: 0.45, dir: "left" },
  (o, c) => { const [dx, dy] = dirv(o.dir), id = c.id();
    return { below: c.freeze(o.t, o.d, id), js: tw("#fx", { x: -dx * 1080, y: -dy * 1920 }, { x: 0, y: 0 }, o.d, o.t, "power3.inOut") +
      tw(`#${id}`, { x: 0, y: 0 }, { x: dx * 1080, y: dy * 1920 }, o.d, o.t, "power3.inOut") }; });
// Modelled frame by frame on CapCut's "Cross shakes" template: 4 frames of whip blur whose direction crosses
// (↗ ↘ ↑ ↗, an X), brightened, then the shot lands at ~115% and settles with a damped left/right jitter.
def("cross-shake", "motion", "CapCut-style cross shake: 4 frames of criss-crossing diagonal whip blur, then lands oversized and settles with jitter", { d: 0.3 },
  (o) => { const f = o.d / 9, k = o.intensity;
    const keys = [
      { x: -110, y: 110, rotation: -4, scale: 1.18, filter: `blur(${16 * k}px) brightness(1.35)` },
      { x: 110, y: 100, rotation: 4, scale: 1.18, filter: `blur(${16 * k}px) brightness(1.35)` },
      { x: 20, y: -130, rotation: 0, scale: 1.18, filter: `blur(${14 * k}px) brightness(1.3)` },
      { x: -80, y: 70, rotation: -3, scale: 1.16, filter: `blur(${10 * k}px) brightness(1.2)` },
      { x: -26, y: 0, rotation: 0, scale: 1.15, filter: "blur(3px) brightness(1.08)" },
      { x: 18, y: 0, rotation: 0, scale: 1.09, filter: "blur(1px) brightness(1.03)" },
      { x: -9, y: 0, rotation: 0, scale: 1.05, filter: "blur(0px) brightness(1)" },
      { x: 4, y: 0, rotation: 0, scale: 1.02, filter: "blur(0px) brightness(1)" },
      { x: 0, y: 0, rotation: 0, scale: 1, filter: "blur(0px) brightness(1)" },
    ].map((p) => ({ ...p, x: r3(p.x * k), y: r3(p.y * k) }));
    let js = tw("#fx", keys[0], keys[0], f, o.t);
    for (let i = 1; i < keys.length; i++) js += tw("#fx", keys[i - 1], keys[i], f, o.t + i * f);
    return { js }; });
def("shake-cut", "motion", "Camera-shake burst on the cut, decaying", { d: 0.35 },
  (o) => { let js = "", px = 0, py = 0; const n = 7, a = 26 * o.intensity;
    for (let i = 1; i <= n; i++) { const f = i === n ? 0 : a * (1 - i / n) * (i % 2 ? 1 : -1), nx = r3(f), ny = r3(i === n ? 0 : f * 0.6 * (i % 3 ? 1 : -1));
      js += tw("#fx", { x: px, y: py }, { x: nx, y: ny }, o.d / n, o.t + (i - 1) * o.d / n); px = nx; py = ny; }
    return { js }; });

// C. flash and light
const overlay = (c, o, style) => { const id = c.id();
  return [id, `<div id="${c.id()}w" class="clip mgl-ov" data-start="${r3(Math.max(0, o.t - o.d / 2))}" data-duration="${r3(o.d)}" data-track-index="${c.track()}"><div id="${id}" class="mgl-fill" style="${style}"></div></div>\n`]; };
def("white-flash", "flash", "Bright white flash peaking just after the cut", { d: 0.3, color: "#ffffff" },
  (o, c) => { const [id, html] = overlay(c, o, `background:${o.color};opacity:0`), s = o.t - o.d / 2, a = Math.min(0.95, 0.95 * o.intensity); // intensity < 1 = see-through colour flash
    return { above: html, js: tw(`#${id}`, { opacity: 0 }, { opacity: a }, o.d * 0.35, s, "power2.in") + tw(`#${id}`, { opacity: a }, { opacity: 0 }, o.d * 0.65, s + o.d * 0.35, "power2.out") }; });
def("black-flash", "flash", "Dip to black and back", { d: 0.32 },
  (o, c) => { const [id, html] = overlay(c, o, "background:#000;opacity:0"), s = o.t - o.d / 2;
    return { above: html, js: tw(`#${id}`, { opacity: 0 }, { opacity: 1 }, o.d / 2, s, "power2.in") + tw(`#${id}`, { opacity: 1 }, { opacity: 0 }, o.d / 2, o.t, "power2.out") }; });
def("flash-zoom", "flash", "White flash with the incoming shot zooming out of it", { d: 0.34 },
  (o, c) => { const f = T["white-flash"].build({ ...o, color: "#ffffff" }, c);
    return { above: f.above, js: f.js + tw("#fx", { scale: 1 + 0.3 * o.intensity }, { scale: 1 }, o.d * 0.8, o.t, "expo.out") }; });
def("light-leak", "flash", "Warm orange-pink light leak sweeping across the frame", { d: 0.7 },
  (o, c) => { const [id, html] = overlay(c, o, "inset:-20% -60%;mix-blend-mode:screen;opacity:0;background:radial-gradient(ellipse 35% 60% at 50% 50%,rgba(255,240,210,.95),rgba(255,140,40,.75) 35%,rgba(255,40,90,.35) 60%,transparent 75%)"), s = o.t - o.d / 2;
    return { above: html, js: tw(`#${id}`, { xPercent: -45 }, { xPercent: 45 }, o.d, s, "power1.inOut") +
      tw(`#${id}`, { opacity: 0 }, { opacity: 0.95 * Math.min(1, o.intensity) }, o.d * 0.4, s, "power2.out") + tw(`#${id}`, { opacity: 0.95 * Math.min(1, o.intensity) }, { opacity: 0 }, o.d * 0.6, s + o.d * 0.4, "power2.in") }; });
def("exposure", "flash", "Over-exposure pulse: the picture blows out to near white and recovers", { d: 0.36 },
  (o) => { const h = o.d / 2, b = 1 + 2.2 * o.intensity;
    return { js: tw("#fx", { filter: "brightness(1)" }, { filter: `brightness(${b})` }, h, o.t - h, "power2.in") + tw("#fx", { filter: `brightness(${b})` }, { filter: "brightness(1)" }, h, o.t, "power2.out") }; });
def("strobe", "flash", "Three quick, restrained white strobes around the cut", { d: 0.36 },
  (o, c) => { const [id, html] = overlay(c, o, "background:#fff;opacity:0"), s = o.t - o.d / 2, k = o.d / 6, a = Math.min(0.75, 0.6 * o.intensity);
    let js = ""; for (let i = 0; i < 3; i++) js += tw(`#${id}`, { opacity: 0 }, { opacity: a }, k / 2, s + i * 2 * k) + tw(`#${id}`, { opacity: a }, { opacity: 0 }, k, s + i * 2 * k + k / 2);
    return { above: html, js }; });
def("flash-impact", "flash", "White flash plus a heavy camera shake: for hits and reveals", { d: 0.4 },
  (o, c) => { const f = T["white-flash"].build({ ...o, d: 0.26, color: "#ffffff" }, c), s = T["shake-cut"].build({ ...o, d: 0.4, intensity: 1.3 * o.intensity }, c);
    return { above: f.above, js: f.js + s.js }; });

// D. glitch and digital
const dups = (c, o, n, styleFn) => { const ids = [], s = r3(Math.max(0, o.t - o.d / 2));
  const html = Array.from({ length: n }, (_, i) => { const id = c.id(); ids.push(id);
    return `<video id="${id}" class="clip mgl-dup" src="${c.video}" muted playsinline data-start="${s}" data-duration="${r3(o.d)}" data-media-start="${s}" data-track-index="${c.track()}" data-volume="0" style="${styleFn(i)}"></video>\n`; }).join("");
  return [ids, html]; };
def("rgb-split", "glitch", "Red/cyan channel split that jitters apart around the cut", { d: 0.34 },
  (o, c) => { const [ids, html] = dups(c, o, 2, (i) => `mix-blend-mode:screen;opacity:0;filter:${i ? "sepia(1) saturate(6) hue-rotate(150deg)" : "sepia(1) saturate(9) hue-rotate(-40deg)"}`);
    const a = 18 * o.intensity, s = o.t - o.d / 2; let js = "";
    ids.forEach((id, i) => { const sg = i ? -1 : 1;
      js += tw(`#${id}`, { opacity: 0, x: 0 }, { opacity: 0.85, x: sg * a }, o.d * 0.3, s, "steps(3)") + tw(`#${id}`, { opacity: 0.85, x: sg * a }, { opacity: 0.85, x: -sg * a * 0.6 }, o.d * 0.3, s + o.d * 0.3, "steps(3)") +
        tw(`#${id}`, { opacity: 0.85, x: -sg * a * 0.6 }, { opacity: 0, x: 0 }, o.d * 0.4, s + o.d * 0.6, "steps(4)"); });
    return { inFx: html, js }; });
def("glitch", "glitch", "Digital glitch: horizontal slices of the picture tear sideways with a skew jitter", { d: 0.36 },
  (o, c) => { const bands = [[8, 18], [30, 37], [52, 66], [74, 80], [88, 95]];
    const [ids, html] = dups(c, o, bands.length, (i) => `clip-path:inset(${bands[i][0]}% 0 ${100 - bands[i][1]}% 0);opacity:0`);
    const s = o.t - o.d / 2, a = 70 * o.intensity; let js = "";
    ids.forEach((id, i) => { const x = r3(a * ((i * 37) % 7 - 3) / 3);
      js += tw(`#${id}`, { opacity: 1, x }, { opacity: 1, x: -x }, o.d * 0.8, s + i * 0.015, "steps(5)") + tw(`#${id}`, { opacity: 1 }, { opacity: 0 }, 0.001, s + o.d * 0.8 + i * 0.015); });
    js += tw("#fx", { skewX: 0 }, { skewX: 8 * o.intensity }, o.d / 2, s, "steps(4)") + tw("#fx", { skewX: 8 * o.intensity }, { skewX: 0 }, o.d / 2, o.t, "steps(4)");
    return { inFx: html, js }; });
def("vhs", "glitch", "VHS tape distortion: scanlines, colour bleed and a vertical roll", { d: 0.5 },
  (o, c) => { const sp = T["rgb-split"].build({ ...o, intensity: 0.6 * o.intensity }, c), [id, html] = overlay(c, o, "opacity:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.45) 0 3px,transparent 3px 6px)");
    const s = o.t - o.d / 2;
    return { inFx: sp.inFx, above: html, js: sp.js + tw(`#${id}`, { opacity: 0 }, { opacity: 1 }, o.d * 0.2, s) + tw(`#${id}`, { opacity: 1 }, { opacity: 0 }, o.d * 0.3, s + o.d * 0.7) +
      tw("#fx", { y: 0 }, { y: 40 * o.intensity }, o.d / 2, s, "steps(6)") + tw("#fx", { y: -24 * o.intensity }, { y: 0 }, o.d / 2, o.t, "steps(6)") }; });
def("static", "glitch", "TV static interruption over the cut (kit clip static_glitch_0.5s.mp4)", { d: 0.3 },
  (o, c) => { const src = c.asset("commentary-kit/transitions/static_glitch_0.5s.mp4"); if (!src) return null;
    const id = c.id(), s = r3(Math.max(0, o.t - o.d / 2));
    return { above: `<video id="${id}" class="clip mgl-dup" src="${src}" muted playsinline data-start="${s}" data-duration="${r3(o.d)}" data-track-index="${c.track()}" data-volume="0" style="mix-blend-mode:screen;opacity:${Math.min(1, 0.85 * o.intensity)}"></video>\n`, js: "" }; });
def("breakup", "glitch", "Digital breakup: the frozen outgoing frame shatters into slices that shoot off sideways", { d: 0.42 },
  (o, c) => { const n = 8; let above = "", js = ""; const s = r3(o.t);
    for (let i = 0; i < n; i++) { const id = c.id(), top = (i * 100) / n, sg = i % 2 ? 1 : -1;
      above += c.freezeHtml(o.t, o.d, id, `clip-path:inset(${r3(top)}% 0 ${r3(100 - top - 100 / n)}% 0)`, "above");
      js += tw(`#${id}`, { x: 0, opacity: 1 }, { x: sg * (900 + 120 * (i % 3)) * o.intensity, opacity: 0.2 }, o.d, s + i * 0.012, "power3.in"); }
    return { above, js }; });

// E. blur and distortion
def("blur-to-clear", "blur", "Incoming starts heavily blurred and sharpens", { d: 0.45 },
  (o) => ({ js: tw("#fx", { filter: `blur(${24 * o.intensity}px)` }, { filter: "blur(0px)" }, o.d, o.t, "power2.out") }));
def("focus-pull", "blur", "Rack focus: outgoing defocuses, incoming comes into focus with a slight breathe", { d: 0.5 },
  (o) => { const h = o.d / 2, b = 18 * o.intensity;
    return { js: tw("#fx", { filter: "blur(0px)", scale: 1 }, { filter: `blur(${b}px)`, scale: 1.04 }, h, o.t - h, "sine.in") + tw("#fx", { filter: `blur(${b}px)`, scale: 1.04 }, { filter: "blur(0px)", scale: 1 }, h, o.t, "sine.out") }; });
def("radial-blur", "blur", "Radial zoom streak: echo layers burst outward from the centre and fade", { d: 0.4 },
  (o, c) => { const sc = [1.05, 1.1, 1.17], [ids, html] = dups(c, o, 3, () => "opacity:0");
    let js = ""; ids.forEach((id, i) => { const z = 1 + (sc[i] - 1) * o.intensity;
      js += tw(`#${id}`, { opacity: 0.4, scale: 1 }, { opacity: 0, scale: z }, o.d, o.t - o.d / 2, "power2.out"); });
    return { inFx: html, js: js + tw("#fx", { scale: 1.08 }, { scale: 1 }, o.d / 2, o.t, "power2.out") }; });
def("wave-distort", "blur", "Liquid wave distortion (SVG displacement) that swells and settles", { d: 0.5 },
  (o, c) => { const id = c.id(), s = o.t - o.d / 2, k = 70 * o.intensity;
    return { above: `<svg width="0" height="0" style="position:absolute"><filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves="2" seed="3"/><feDisplacementMap id="${id}m" in="SourceGraphic" scale="0"/></filter></svg>\n`,
      js: `tl.set("#fx", { filter: "url(#${id})" }, ${r3(Math.max(0, s))});\n` + tw(`#${id}m`, { attr: { scale: 0 } }, { attr: { scale: k } }, o.d / 2, s, "sine.in") + tw(`#${id}m`, { attr: { scale: k } }, { attr: { scale: 0 } }, o.d / 2, o.t, "sine.out") +
        `tl.set("#fx", { filter: "none" }, ${r3(o.t + o.d / 2)});\n` }; });

// F. creative reveals (need the frozen outgoing frame underneath)
def("circle-reveal", "creative", "Incoming opens as a growing circle from the centre", { d: 0.5 },
  (o, c) => ({ below: c.freeze(o.t, o.d), js: tw("#fx", { clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(75% at 50% 50%)" }, o.d, o.t, "power2.inOut") + `tl.set("#fx", { clipPath: "none" }, ${r3(o.t + o.d)});\n` }));
def("wipe", "creative", "Hard-edged wipe across the frame (dir = wipe direction)", { d: 0.42, dir: "left" },
  (o, c) => { const from = { left: "inset(0 0 0 100%)", right: "inset(0 100% 0 0)", up: "inset(100% 0 0 0)", down: "inset(0 0 100% 0)" }[o.dir] || "inset(0 0 0 100%)";
    return { below: c.freeze(o.t, o.d), js: tw("#fx", { clipPath: from }, { clipPath: "inset(0% 0% 0% 0%)" }, o.d, o.t, "power3.inOut") + `tl.set("#fx", { clipPath: "none" }, ${r3(o.t + o.d)});\n` }; });
def("diagonal-wipe", "creative", "Angled shape wipe from the corner", { d: 0.45 },
  (o, c) => ({ below: c.freeze(o.t, o.d), js: tw("#fx", { clipPath: "polygon(0% 0%, 0% 0%, 0% 0%, 0% 0%)" }, { clipPath: "polygon(0% 0%, 200% 0%, 200% 0%, 0% 200%)" }, o.d, o.t, "power2.inOut") + `tl.set("#fx", { clipPath: "none" }, ${r3(o.t + o.d)});\n` }));
def("split-reveal", "creative", "The frozen outgoing frame splits in two halves that slide apart", { d: 0.5 },
  (o, c) => { const a = c.id(), b = c.id();
    return { above: c.freezeHtml(o.t, o.d, a, "clip-path:inset(0 0 50% 0)", "above") + c.freezeHtml(o.t, o.d, b, "clip-path:inset(50% 0 0 0)", "above"),
      js: tw(`#${a}`, { y: 0 }, { y: -1000 }, o.d, o.t, "power3.inOut") + tw(`#${b}`, { y: 0 }, { y: 1000 }, o.d, o.t, "power3.inOut") }; });
def("pip-in", "creative", "Incoming enters as a rounded picture-in-picture card and grows to full frame", { d: 0.6 },
  (o, c) => ({ below: c.freeze(o.t, o.d), js: tw("#fx", { scale: 0.42, borderRadius: "48px", y: 120 }, { scale: 1, borderRadius: "0px", y: 0 }, o.d, o.t, "back.out(1.2)") }));

// G. CapCut's 20 popular transitions that the presets above did not cover (2026-11-07). Recreations of the look only.
def("pull-in", "zoom", "CapCut 'Pull in': outgoing rushes toward the camera in a bright zoom blur with radial streaks, incoming lands from the rush and settles", { d: 0.5 },
  (o, c) => { const h = o.d / 2, z = 1 + 0.45 * o.intensity, b = 20 * o.intensity, st = T["radial-blur"].build({ ...o, intensity: 1.4 * o.intensity }, c);
    return { inFx: st.inFx, js: st.js.replace(/tl\.fromTo\("#fx"[^\n]*\n$/, "") +
      tw("#fx", { scale: 1, filter: "blur(0px) brightness(1)" }, { scale: z, filter: `blur(${b}px) brightness(1.25)` }, h, o.t - h, "power4.in") +
      tw("#fx", { scale: z, filter: `blur(${b}px) brightness(1.25)` }, { scale: 1, filter: "blur(0px) brightness(1)" }, h, o.t, "power4.out") }; });
def("pull-back", "zoom", "CapCut 'Pull out': outgoing is yanked back away from the camera with blur, incoming starts oversized and blurred and pulls back to fit", { d: 0.45 },
  (o) => { const h = o.d / 2, b = 14 * o.intensity;
    return { js: tw("#fx", { scale: 1, filter: "blur(0px)" }, { scale: 1 - 0.3 * o.intensity, filter: `blur(${b}px)` }, h, o.t - h, "power4.in") +
      tw("#fx", { scale: 1 + 0.5 * o.intensity, filter: `blur(${b}px)` }, { scale: 1, filter: "blur(0px)" }, h, o.t, "power4.out") }; });
def("whirl", "zoom", "CapCut 'Whirl': a big twisting turn (~160 degrees) with zoom and blur out of the outgoing shot, unwinding into the incoming", { d: 0.5 },
  // Zoom leads (eases out) while the turn lags (eases in), so the scale always covers a 9:16 frame rotated by
  // the current angle (with the 50%/45% pivot: 2.3x for whirl, 2.25x for rotate, checked numerically for 1920 and 1620 px tall frames); the incoming half mirrors it.
  (o) => { const h = o.d / 2, a = 160 * o.intensity, b = 16 * o.intensity;
    return { js: tw("#fx", { rotation: 0 }, { rotation: a }, h, o.t - h, "power3.in") + tw("#fx", { scale: 1, filter: "blur(0px)" }, { scale: 2.3, filter: `blur(${b}px)` }, h, o.t - h, "power2.out") +
      tw("#fx", { rotation: -a }, { rotation: 0 }, h, o.t, "power3.out") + tw("#fx", { scale: 2.3, filter: `blur(${b}px)` }, { scale: 1, filter: "blur(0px)" }, h, o.t, "power2.in") }; });
def("rotate", "motion", "CapCut 'Rotate': a crisp 90-degree turn (zoomed to keep the frame filled), no blur; incoming finishes the turn", { d: 0.45 },
  (o) => { const h = o.d / 2, a = 90 * Math.min(1, o.intensity); // same lead/lag trick as whirl; 2.25x covers every angle
    return { js: tw("#fx", { rotation: 0 }, { rotation: a }, h, o.t - h, "power2.in") + tw("#fx", { scale: 1 }, { scale: 2.25 }, h, o.t - h, "power2.out") +
      tw("#fx", { rotation: -a }, { rotation: 0 }, h, o.t, "power2.out") + tw("#fx", { scale: 2.25 }, { scale: 1 }, h, o.t, "power2.in") }; });
def("cube", "creative", "CapCut 'Cube': the frame turns like the face of a 3D box to show the incoming shot on the next face (dir = left/right)", { d: 0.55, dir: "left" },
  (o, c) => { const id = c.id(), L = o.dir !== "right", P = 1600, s = L ? 1 : -1;
    const out0 = { x: 0, rotationY: 0, transformOrigin: L ? "100% 50%" : "0% 50%", transformPerspective: P, filter: "brightness(1)" };
    const in0 = { x: 1080 * s, rotationY: 90 * s, transformOrigin: L ? "0% 50%" : "100% 50%", transformPerspective: P, filter: "brightness(0.55)" };
    return { above: c.freezeHtml(o.t, o.d, id, "", "above"),
      js: tw(`#${id}`, out0, { ...out0, x: -1080 * s, rotationY: -90 * s, filter: "brightness(0.55)" }, o.d, o.t, "power2.inOut") +
        tw("#fx", in0, { ...in0, x: 0, rotationY: 0, filter: "brightness(1)" }, o.d, o.t, "power2.inOut") +
        `tl.set("#fx", { transformOrigin: "50% 45%", filter: "none" }, ${r3(o.t + o.d)});\n` }; }); // #fx's CSS origin
def("swipe", "motion", "CapCut 'Swipe': fast feed-style swipe, incoming shoves the outgoing frame off with motion blur on both (dir = travel direction, default up)", { d: 0.35, dir: "up" },
  // Percent moves: the footage area is shorter than 1920 px under the headline bar, so fixed pixels left a black gap.
  (o, c) => { const [dx, dy] = dirv(o.dir), id = c.id(), b = 18 * o.intensity;
    return { below: c.freeze(o.t, o.d, id),
      js: tw("#fx", { xPercent: -dx * 100, yPercent: -dy * 100, filter: `blur(${b}px)` }, { xPercent: 0, yPercent: 0, filter: "blur(0px)" }, o.d, o.t, "power4.inOut") +
        tw(`#${id}`, { xPercent: 0, yPercent: 0, filter: "blur(0px)" }, { xPercent: dx * 100, yPercent: dy * 100, filter: `blur(${b}px)` }, o.d, o.t, "power4.inOut") }; });

// The user's main transition set (2026-11-07): CapCut's 20 popular transitions -> preset + transition SFX from the
// user's sfxv2 pack (`sound effects/sfxv2/`, every file <= 1.5 s). The user's files come first; generated/ holds synthesized
// fallbacks, unused since the second batch (2026-11-07) had fitting sounds. peak = seconds into the file to line up with
// the cut (the hit; for long glitch/warp beds, just after onset so the sound starts with the effect). vol (optional) = playback
// volume for files recorded much louder/quieter than the rest, set to match the level of the sound each one replaced.
const SFXV2 = "sound effects/sfxv2/";
const CAPCUT20 = [
  ["Pull In", "pull-in", "reverse-ding.mp3", 0.58], ["Pull Out", "pull-back", "fast-swish.mp3", 0.21],
  ["Camera Shake", "cross-shake", "DB studios - Camera Flash Low and Powerful Impact.wav", 0.26, 0.19], ["Whirl", "whirl", "fast-whoosh.mp3", 0.56],
  ["Zoom In", "zoom-in", "fast-whoosh.mp3", 0.56], ["Zoom Out", "zoom-out", "fast-swish.mp3", 0.21],
  ["Blur", "focus-pull", "reverse-ding.mp3", 0.58], ["Glitch", "glitch", "glitch-2.mp3", 0.3, 0.73],
  ["Flash", "white-flash", "camera-flash-sound-effect.mp3", 0.18], ["Spin", "spin", "reverse-dj.mp3", 0.34],
  ["Slide", "slide", "fast-swish.mp3", 0.21], ["Rotate", "rotate", "fast-whoosh.mp3", 0.56],
  ["Shake", "shake-cut", "DB studios - Camera Flash Low and Powerful Impact.wav", 0.26, 0.19], ["Zoom Blur", "zoom-blur", "fast-whoosh.mp3", 0.56],
  ["Distortion", "wave-distort", "Cristian Lucchetta - Classic Sci Fi Weapons - Incoming Logo Transition .wav", 0.35, 0.1], ["Cube", "cube", "fast-swish.mp3", 0.21],
  ["Swipe", "swipe", "fast-swish.mp3", 0.21], ["Wipe", "wipe", "fast-swish.mp3", 0.21],
  ["Split", "split-reveal", "camera-shutterrrr.mp3", 0.66], ["Light Leak", "light-leak", "ES_Cinematic Reverse Glass 01 - Epidemic Sound.mp3", 1.08, 0.36],
].map(([capcut, type, file, peak, vol]) => ({ capcut, type, file: SFXV2 + file, peak, vol }));
const transitionSfx = (type) => CAPCUT20.find((x) => x.type === type) || null;

// ---------- caption / text animations: entrance tween for a caption element ----------
const A = {
  pop: { desc: "Quick overshoot pop (default ysc look)", js: (sel, t, k) => tw(sel, { scale: 1 + 0.3 * k }, { scale: 1 }, 0.08, t, "power2.out") },
  bounce: { desc: "Drops in and bounces", js: (sel, t, k) => tw(sel, { y: -60 * k, opacity: 0 }, { y: 0, opacity: 1 }, 0.32, t, "bounce.out") },
  spring: { desc: "Springy scale-up with elastic settle", js: (sel, t, k) => tw(sel, { scale: 0.3 }, { scale: 1 }, 0.45, t, `elastic.out(${r3(1 + 0.2 * k)}, 0.45)`) },
  "slide-up": { desc: "Slides up from below", js: (sel, t, k) => tw(sel, { y: 70 * k, opacity: 0 }, { y: 0, opacity: 1 }, 0.16, t, "power3.out") },
  "slide-in": { desc: "Slides in from the left", js: (sel, t, k) => tw(sel, { x: -160 * k, opacity: 0 }, { x: 0, opacity: 1 }, 0.16, t, "power3.out") },
  "fade-rise": { desc: "Soft fade with a small rise", js: (sel, t, k) => tw(sel, { y: 24 * k, opacity: 0 }, { y: 0, opacity: 1 }, 0.22, t, "power2.out") },
  "fade-scale": { desc: "Fades in while scaling down from 120%", js: (sel, t, k) => tw(sel, { scale: 1 + 0.2 * k, opacity: 0 }, { scale: 1, opacity: 1 }, 0.18, t, "power2.out") },
  "scale-up": { desc: "Grows from small with a back-out", js: (sel, t, k) => tw(sel, { scale: 0.2 }, { scale: 1 }, 0.22, t, `back.out(${r3(1.5 + k)})`) },
  "rotate-in": { desc: "Twists in from -14 degrees", js: (sel, t, k) => tw(sel, { rotation: -14 * k, scale: 0.8, opacity: 0 }, { rotation: 0, scale: 1, opacity: 1 }, 0.2, t, "back.out(2)") },
  flip: { desc: "Flips up on the X axis", js: (sel, t, k) => tw(sel, { rotationX: 90 * Math.min(1, k), opacity: 0, transformPerspective: 600 }, { rotationX: 0, opacity: 1, transformPerspective: 600 }, 0.22, t, "power3.out") },
  "blur-in": { desc: "Out-of-focus to sharp", js: (sel, t, k) => tw(sel, { filter: `blur(${14 * k}px)`, opacity: 0 }, { filter: "blur(0px)", opacity: 1 }, 0.2, t, "power2.out") },
  typewriter: { desc: "Reveals left to right one character at a time, like typing (~0.045 s per character, max 0.9 s)", js: (sel, t, k, n = 8) => tw(sel, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }, typeDuration(n, k), t, `steps(${Math.max(2, n)})`) },
  "stretch-in": { desc: "Stretches horizontally into place (tracking-style, transform only)", js: (sel, t, k) => tw(sel, { scaleX: 1.8 * k, opacity: 0 }, { scaleX: 1, opacity: 1 }, 0.2, t, "expo.out") },
  shake: { desc: "Pops then shakes for emphasis", js: (sel, t, k) => tw(sel, { scale: 1.25 }, { scale: 1 }, 0.08, t, "power2.out") + tw(sel, { x: -10 * k }, { x: 10 * k }, 0.05, t + 0.08, "none") + tw(sel, { x: 10 * k }, { x: 0 }, 0.05, t + 0.13, "none") },
  "punch-in": { desc: "Slams in from 180% for impact words", js: (sel, t, k) => tw(sel, { scale: 1 + 0.8 * k, opacity: 0 }, { scale: 1, opacity: 1 }, 0.14, t, "expo.out") },
};

// ---------- overlays: callouts, emphasis, backgrounds -> { above, js } at o.t for o.d ----------
const O = {};
const odef = (name, category, desc, defaults, build) => (O[name] = { name, category, desc, defaults, build });
const box = (c, o, inner, track = true) => { const id = c.id();
  return [id, `<div id="${c.id()}w" class="clip mgl-ov" data-start="${r3(o.t)}" data-duration="${r3(o.d)}" data-track-index="${c.track()}">${inner(id)}</div>\n`]; };
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
odef("underline", "callouts", "Hand-drawn underline scribble drawn under a word (x,y,w)", { d: 1.6, x: 240, y: 1180, w: 600, color: "#ff2a2a" },
  (o, c) => { const [id, html] = box(c, o, (i) => `<svg style="position:absolute;left:${o.x}px;top:${o.y}px;overflow:visible" width="${o.w}" height="60"><path id="${i}" d="M4 30 C ${o.w * 0.3} 6, ${o.w * 0.6} 54, ${o.w - 4} 22" fill="none" stroke="${o.color}" stroke-width="12" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`);
    return { above: html, js: tw(`#${id}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0 }, 0.35, o.t, "power2.out") }; });
odef("box", "callouts", "Rectangle drawn around an object (x,y,w,h)", { d: 1.6, x: 300, y: 700, w: 480, h: 360, color: "#ff2a2a" },
  (o, c) => { const [id, html] = box(c, o, (i) => `<svg style="position:absolute;left:${o.x}px;top:${o.y}px;overflow:visible" width="${o.w}" height="${o.h}"><rect id="${i}" x="6" y="6" width="${o.w - 12}" height="${o.h - 12}" rx="14" fill="none" stroke="${o.color}" stroke-width="12" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>`);
    return { above: html, js: tw(`#${id}`, { strokeDashoffset: 1 }, { strokeDashoffset: 0 }, 0.4, o.t, "power2.inOut") }; });
odef("label", "callouts", "Pointer line drawn out to a label (x,y = point; text)", { d: 2, x: 540, y: 900, text: "LOOK", color: "#ffe135" },
  (o, c) => { const id = c.id(), id2 = c.id();
    return { above: `<div id="${c.id()}w" class="clip mgl-ov" data-start="${r3(o.t)}" data-duration="${r3(o.d)}" data-track-index="${c.track()}"><div id="${id}" style="position:absolute;left:${o.x}px;top:${o.y}px;width:220px;height:8px;background:${o.color};transform-origin:left center;rotate:-35deg;border-radius:4px"></div><div id="${id2}" class="mgl-label" style="left:${o.x + 170}px;top:${o.y - 200}px;border-color:${o.color}">${esc(o.text)}</div></div>\n`,
      js: tw(`#${id}`, { scaleX: 0 }, { scaleX: 1 }, 0.25, o.t, "power2.out") + tw(`#${id2}`, { opacity: 0, y: 20 }, { opacity: 1, y: 0 }, 0.2, o.t + 0.2, "back.out(2)") }; });
odef("counter", "callouts", "Number counter from `from` to `to` with prefix/suffix", { d: 2, from: 0, to: 100, prefix: "", suffix: "", y: 760, dur: 1.2 },
  (o, c) => { const [id, html] = box(c, o, (i) => `<div class="mgl-counter" style="top:${o.y}px">${esc(o.prefix)}<span id="${i}">${o.from}</span>${esc(o.suffix)}</div>`);
    return { above: html, js: tw(`#${id}`, { innerText: o.from }, { innerText: o.to, snap: { innerText: 1 } }, o.dur, o.t, "power2.out") + tw(`#${id}`, { scale: 1.3 }, { scale: 1 }, 0.3, o.t + o.dur, "back.out(3)") }; });
odef("progress-bar", "callouts", "Bar filling to `pct` percent with a label", { d: 2.2, pct: 75, label: "", y: 1300, color: "#39E75F" },
  (o, c) => { const id = c.id();
    return { above: `<div id="${c.id()}w" class="clip mgl-ov" data-start="${r3(o.t)}" data-duration="${r3(o.d)}" data-track-index="${c.track()}"><div class="mgl-bar" style="top:${o.y}px"><div id="${id}" style="height:100%;width:100%;background:${o.color};transform-origin:left center;border-radius:14px"></div></div>${o.label ? `<div class="mgl-barlabel" style="top:${o.y - 80}px">${esc(o.label)}</div>` : ""}</div>\n`,
      js: tw(`#${id}`, { scaleX: 0 }, { scaleX: o.pct / 100 }, 1, o.t + 0.1, "power2.out") }; });
odef("lower-third", "callouts", "Name/title lower third with an accent bar", { d: 3, title: "NAME", sub: "", y: 1450, color: "#ffe135" },
  (o, c) => { const id = c.id(), id2 = c.id();
    return { above: `<div id="${c.id()}w" class="clip mgl-ov" data-start="${r3(o.t)}" data-duration="${r3(o.d)}" data-track-index="${c.track()}"><div id="${id}" class="mgl-lt-bar" style="top:${o.y}px;background:${o.color}"></div><div id="${id2}" class="mgl-lt" style="top:${o.y}px"><div class="mgl-lt-t">${esc(o.title)}</div>${o.sub ? `<div class="mgl-lt-s">${esc(o.sub)}</div>` : ""}</div></div>\n`,
      js: tw(`#${id}`, { scaleY: 0 }, { scaleY: 1 }, 0.2, o.t, "power3.out") + tw(`#${id2}`, { x: -60, opacity: 0 }, { x: 0, opacity: 1 }, 0.3, o.t + 0.1, "power3.out") + tw(`#${id2}`, { opacity: 1 }, { opacity: 0 }, 0.2, o.t + o.d - 0.2) }; });
odef("notification", "callouts", "Phone-style notification card dropping in from the top", { d: 2.4, title: "New message", body: "", y: 140 },
  (o, c) => { const [id, html] = box(c, o, (i) => `<div id="${i}" class="mgl-notif" style="top:${o.y}px"><div class="mgl-notif-t">${esc(o.title)}</div>${o.body ? `<div class="mgl-notif-b">${esc(o.body)}</div>` : ""}</div>`);
    return { above: html, js: tw(`#${id}`, { y: -260 }, { y: 0 }, 0.4, o.t, "back.out(1.6)") + tw(`#${id}`, { y: 0 }, { y: -260 }, 0.3, o.t + o.d - 0.3, "power2.in") }; });
odef("speech-bubble", "callouts", "Comic speech bubble popping in (x,y,text)", { d: 2, x: 540, y: 600, text: "WHAT?!" },
  (o, c) => { const [id, html] = box(c, o, (i) => `<div id="${i}" class="mgl-bubble" style="left:${o.x}px;top:${o.y}px">${esc(o.text)}</div>`);
    return { above: html, js: tw(`#${id}`, { scale: 0, rotation: -8 }, { scale: 1, rotation: 0 }, 0.3, o.t, "back.out(2.5)") }; });
odef("spotlight", "emphasis", "Dims everything except a circle around the subject (x,y,r)", { d: 1.6, x: 540, y: 820, r: 300 },
  (o, c) => { const [id, html] = box(c, o, (i) => `<div id="${i}" class="mgl-fill" style="opacity:0;background:radial-gradient(circle ${o.r}px at ${o.x}px ${o.y}px,transparent 92%,rgba(0,0,0,.72) 100%)"></div>`);
    return { above: html, js: tw(`#${id}`, { opacity: 0 }, { opacity: 1 }, 0.25, o.t, "power2.out") + tw(`#${id}`, { opacity: 1 }, { opacity: 0 }, 0.3, o.t + o.d - 0.3) }; });
odef("vignette-pulse", "emphasis", "Dark vignette that breathes in for a tense beat", { d: 1.2 },
  (o, c) => { const [id, html] = box(c, o, (i) => `<div id="${i}" class="mgl-fill" style="opacity:0;background:radial-gradient(ellipse at 50% 45%,transparent 45%,rgba(0,0,0,.85) 100%)"></div>`);
    return { above: html, js: tw(`#${id}`, { opacity: 0 }, { opacity: 1 }, o.d / 2, o.t, "sine.inOut") + tw(`#${id}`, { opacity: 1 }, { opacity: 0 }, o.d / 2, o.t + o.d / 2, "sine.inOut") }; });
odef("freeze-frame", "emphasis", "Freezes the moment with a white outline and tilt, then releases", { d: 1.2 },
  (o, c) => { const id = c.id();
    return { above: c.freezeHtml(o.t + 0.04, o.d, id, "outline:14px solid #fff;outline-offset:-14px", "above", o.t), js: tw(`#${id}`, { scale: 1, rotation: 0 }, { scale: 0.9, rotation: -3 }, 0.18, o.t, "back.out(2)") }; });
odef("scale-pulse", "emphasis", "Quick scale pulse of the whole picture (a beat or a hit)", { d: 0.3 },
  (o) => ({ js: tw("#fx", { scale: 1 }, { scale: 1.07 }, o.d / 2, o.t, "power2.out") + tw("#fx", { scale: 1.07 }, { scale: 1 }, o.d / 2, o.t + o.d / 2, "power2.in") }));
odef("glow-pulse", "emphasis", "Brightness and saturation bloom on a highlight", { d: 0.5 },
  (o) => ({ js: tw("#fx", { filter: "brightness(1) saturate(1)" }, { filter: "brightness(1.35) saturate(1.5)" }, o.d / 2, o.t, "sine.out") + tw("#fx", { filter: "brightness(1.35) saturate(1.5)" }, { filter: "brightness(1) saturate(1)" }, o.d / 2, o.t + o.d / 2, "sine.in") }));
odef("handheld", "emphasis", "Subtle handheld camera drift for a whole shot", { d: 3 },
  (o) => { let js = "", px = 0, py = 0, pr = 0; const n = Math.max(2, Math.round(o.d / 0.6));
    for (let i = 1; i <= n; i++) { const nx = i === n ? 0 : r3(6 * Math.sin(i * 1.7)), ny = i === n ? 0 : r3(5 * Math.cos(i * 2.3)), nr = i === n ? 0 : r3(0.35 * Math.sin(i * 1.1));
      js += tw("#fx", { x: px, y: py, rotation: pr }, { x: nx, y: ny, rotation: nr }, o.d / n, o.t + (i - 1) * o.d / n, "sine.inOut"); px = nx; py = ny; pr = nr; }
    return { js }; });
odef("emoji", "callouts", "Emoji sticker that pops in and gently floats (e.g. 💀 on a payoff)", { d: 2, text: "💀", x: 540, y: 820, size: 220 },
  (o, c) => { const [id, html] = box(c, o, (i) => `<div id="${i}" style="position:absolute;left:${o.x}px;top:${o.y}px;translate:-50% -50%;font-size:${o.size}px;line-height:1;filter:drop-shadow(0 8px 14px rgba(0,0,0,.5))">${esc(o.text)}</div>`);
    return { above: html, js: tw(`#${id}`, { scale: 0, rotation: -12 }, { scale: 1, rotation: 0 }, 0.28, o.t, "back.out(2.6)") + tw(`#${id}`, { y: 0 }, { y: -26 }, Math.max(0.3, o.d - 0.3), o.t + 0.3, "sine.inOut") }; });
odef("warm-glow", "emphasis", "Warm orange glow grade with a soft bloom, for a comedic or dramatic payoff", { d: 2 },
  (o, c) => { const [id, html] = box(c, o, (i) => `<div id="${i}" class="mgl-fill" style="opacity:0;mix-blend-mode:soft-light;background:radial-gradient(ellipse at 50% 55%,rgba(255,190,90,.9),rgba(255,120,40,.85) 70%)"></div>`);
    return { above: html, js: tw(`#${id}`, { opacity: 0 }, { opacity: 1 }, 0.25, o.t, "power2.out") +
      tw("#fx", { filter: "saturate(1) brightness(1)" }, { filter: "saturate(1.35) brightness(1.08)" }, 0.25, o.t, "power2.out") + tw("#fx", { filter: "saturate(1.35) brightness(1.08)" }, { filter: "saturate(1) brightness(1)" }, 0.2, o.t + o.d - 0.2) }; });
odef("speed-lines", "emphasis", "Manga/anime speed lines bursting from the centre for a shock beat (radial, orange by default)", { d: 0.5, color: "#ff8a1f", n: 36, x: 540, y: 960 },
  (o, c) => { let rays = ""; for (let i = 0; i < o.n; i++) { const a = (i * 360) / o.n + ((i * 53) % 7), w = 4 + (i % 4) * 3;
      rays += `<polygon points="0,${-w} 1500,0 0,${w}" transform="rotate(${r3(a)})" />`; }
    const [id, html] = box(c, o, (i) => `<svg id="${i}" width="1080" height="1920" style="position:absolute;inset:0;opacity:0"><g transform="translate(${o.x} ${o.y})" fill="${o.color}">${rays}<circle r="300" fill="#000" fill-opacity="0"/></g></svg>`);
    return { above: html, js: tw(`#${id}`, { opacity: 0, scale: 1.25, transformOrigin: `${o.x}px ${o.y}px` }, { opacity: 0.9, scale: 1, transformOrigin: `${o.x}px ${o.y}px` }, 0.06, o.t, "power2.out") +
      tw(`#${id}`, { rotation: 0, transformOrigin: `${o.x}px ${o.y}px` }, { rotation: 4, transformOrigin: `${o.x}px ${o.y}px` }, o.d, o.t, "steps(4)") + tw(`#${id}`, { opacity: 0.9 }, { opacity: 0 }, 0.08, o.t + o.d - 0.08) }; });
odef("tint", "emphasis", "Full-frame colour tint for a few frames on a hit (red, green, pink…)", { d: 0.12, color: "#ff2020", strength: 0.55 },
  (o, c) => { const [id, html] = box(c, o, (i) => `<div id="${i}" class="mgl-fill" style="opacity:0;background:${o.color};mix-blend-mode:hard-light"></div>`);
    return { above: html, js: tw(`#${id}`, { opacity: 0 }, { opacity: o.strength }, 0.02, o.t) + tw(`#${id}`, { opacity: o.strength }, { opacity: 0 }, 0.02, o.t + o.d - 0.02) }; });
odef("gradient-bg", "backgrounds", "Moving colour gradient behind a title card (covers the frame)", { d: 3, colors: ["#ff2a6d", "#6a00ff", "#00c2ff"] },
  (o, c) => { const [id, html] = box(c, o, (i) => `<div id="${i}" class="mgl-fill" style="inset:-50%;background:linear-gradient(120deg,${o.colors.join(",")})"></div>`);
    return { above: html, js: tw(`#${id}`, { rotation: 0, scale: 1 }, { rotation: 40, scale: 1.2 }, o.d, o.t, "sine.inOut") }; });
odef("particles", "backgrounds", "Soft light particles drifting upward (decorative overlay)", { d: 3, n: 24, color: "rgba(255,255,255,.95)" },
  (o, c) => { let inner = "", js = ""; const ids = [];
    for (let i = 0; i < o.n; i++) { const id = c.id(); ids.push(id); const x = (i * 197) % 1080, y = 400 + ((i * 331) % 1400), sz = 12 + (i % 4) * 6;
      inner += `<div id="${id}" style="position:absolute;left:${x}px;top:${y}px;width:${sz}px;height:${sz}px;border-radius:50%;background:${o.color};box-shadow:0 0 14px 4px ${o.color}"></div>`;
      js += tw(`#${id}`, { y: 0, opacity: 0 }, { y: -(260 + (i % 5) * 80), opacity: 0.9 }, o.d, o.t + (i % 6) * 0.05, "none"); }
    return { above: `<div id="${c.id()}w" class="clip mgl-ov" data-start="${r3(o.t)}" data-duration="${r3(o.d)}" data-track-index="${c.track()}">${inner}</div>\n`, js }; });

const CSS = `
      #fx { position: absolute; inset: 0; transform-origin: 50% 45%; overflow: hidden; }
      .mgl-dup, .mgl-freeze { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .mgl-ov { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
      .mgl-fill { position: absolute; inset: 0; }
      .mgl-label, .mgl-bubble { position: absolute; font-family: "Montserrat", sans-serif; font-weight: 900; text-transform: uppercase; white-space: nowrap; }
      .mgl-label { font-size: 46px; color: #fff; background: rgba(0,0,0,.78); border: 5px solid; border-radius: 12px; padding: 8px 22px; }
      .mgl-bubble { font-size: 64px; color: #111; background: #fff; border-radius: 40px; padding: 18px 40px; translate: -50% 0; box-shadow: 0 10px 24px rgba(0,0,0,.45); }
      .mgl-bubble::after { content: ""; position: absolute; left: 40%; bottom: -34px; border: 20px solid transparent; border-top: 30px solid #fff; }
      .mgl-counter { position: absolute; left: 0; right: 0; text-align: center; font-family: "Montserrat", sans-serif; font-weight: 900; font-size: 170px; color: #fff; -webkit-text-stroke: 12px #000; paint-order: stroke fill; }
      .mgl-bar { position: absolute; left: 120px; right: 120px; height: 46px; background: rgba(255,255,255,.18); border: 4px solid #fff; border-radius: 18px; overflow: hidden; }
      .mgl-barlabel { position: absolute; left: 0; right: 0; text-align: center; font-family: "Montserrat", sans-serif; font-weight: 900; font-size: 52px; color: #fff; -webkit-text-stroke: 8px #000; paint-order: stroke fill; }
      .mgl-lt-bar { position: absolute; left: 60px; width: 14px; height: 130px; transform-origin: center top; }
      .mgl-lt { position: absolute; left: 92px; background: rgba(10,10,12,.82); padding: 14px 28px; border-radius: 6px; }
      .mgl-lt-t { font-family: "Oswald", sans-serif; font-weight: 700; font-size: 58px; color: #fff; text-transform: uppercase; white-space: nowrap; }
      .mgl-lt-s { font-family: "Montserrat", sans-serif; font-weight: 700; font-size: 28px; color: #ffe135; letter-spacing: .08em; white-space: nowrap; }
      .mgl-notif { position: absolute; left: 70px; right: 70px; background: rgba(245,245,247,.96); border-radius: 34px; padding: 26px 34px; box-shadow: 0 18px 40px rgba(0,0,0,.35); font-family: "Montserrat", sans-serif; }
      .mgl-notif-t { font-weight: 900; font-size: 40px; color: #111; }
      .mgl-notif-b { font-weight: 600; font-size: 34px; color: #333; margin-top: 6px; }
`;

// ctx: per-build helpers. video = composition path of the main footage; freezeFrame(t) -> composition path of a still
// of the frame just before t (the builder extracts it with ffmpeg); asset(repoPath) -> composition path or null.
function makeCtx({ video = "assets/base.mp4", freezeFrame, asset = () => null, trackBase = 40 } = {}) {
  let n = 0, track = trackBase;
  const c = {
    video, asset,
    id: () => `mgl${++n}`,
    track: () => track++,
    freezeHtml: (t, d, id, style = "", where = "below", start = t) =>
      `<div id="${c.id()}w" class="clip mgl-ov" data-start="${r3(start)}" data-duration="${r3(d)}" data-track-index="${c.track()}"><img id="${id}" class="mgl-freeze" src="${freezeFrame(t)}" style="${style}"></div>\n`,
    freeze: (t, d, id = c.id()) => c.freezeHtml(t, d, id),
  };
  return c;
}

// Build every requested transition/overlay. Returns { below, inFx, above, js } to splice into the composition.
// Throws on unknown names, duplicate transition types (one per scene change, never repeated), or bad times.
function apply({ transitions = [], overlays = [], D, ctx }) {
  const out = { below: "", inFx: "", above: "", js: "" }, used = new Set();
  const add = (r) => { if (!r) return; for (const k of Object.keys(out)) if (r[k]) out[k] += r[k]; };
  for (const x of transitions) {
    const p = T[x.type]; if (!p) throw new Error(`mgl: unknown transition "${x.type}" (see motion-graphics-library/EFFECTS_INDEX.md)`);
    if (used.has(x.type) && !x.allowRepeat) throw new Error(`mgl: transition "${x.type}" used twice; every scene change needs a different one`);
    used.add(x.type);
    const o = { intensity: 1, ...p.defaults, ...x };
    if (!(o.t > 0 && o.t < D)) throw new Error(`mgl: transition "${x.type}" at t=${o.t} is outside the clip (0, ${D})`);
    add(p.build(o, ctx));
  }
  for (const x of overlays) {
    const p = O[x.type]; if (!p) throw new Error(`mgl: unknown overlay "${x.type}" (see motion-graphics-library/EFFECTS_INDEX.md)`);
    const o = { intensity: 1, ...p.defaults, ...x };
    if (!(o.t >= 0 && o.t < D)) throw new Error(`mgl: overlay "${x.type}" at t=${o.t} is outside the clip`);
    o.d = Math.min(o.d, D - o.t);
    add(p.build(o, ctx));
  }
  return out;
}

module.exports = { TRANSITIONS: T, ANIMATIONS: A, OVERLAYS: O, CSS, makeCtx, apply, typeDuration, CAPCUT20, transitionSfx };

if (require.main === module && process.argv[2] === "--selftest") {
  const ctx = makeCtx({ freezeFrame: (t) => `assets/mgl/f${t}.jpg`, asset: (p) => `assets/mgl/${p.split("/").pop()}` });
  const names = Object.keys(T);
  const r = apply({ D: 60, ctx, transitions: names.map((type, i) => ({ type, t: 1 + i * 1.5 })), overlays: Object.keys(O).map((type, i) => ({ type, t: 2 + i })) });
  const sigs = new Set(names.map((n) => T[n].build({ intensity: 1, ...T[n].defaults, t: 5 }, makeCtx({ freezeFrame: () => "x.jpg", asset: () => "y.mp4" })).js));
  if (sigs.size !== names.length) throw new Error("two transitions produce identical animation");
  let threw = false; try { apply({ D: 10, ctx, transitions: [{ type: "whip", t: 2 }, { type: "whip", t: 4 }] }); } catch { threw = true; }
  if (!threw) throw new Error("repeat transition was not rejected");
  const strong = T["zoom-in"].build({ ...T["zoom-in"].defaults, t: 3, intensity: 2 }, ctx).js, weak = T["zoom-in"].build({ ...T["zoom-in"].defaults, t: 3, intensity: 0.5 }, ctx).js;
  if (strong === weak) throw new Error("intensity has no effect");
  const fs = require("fs"), path = require("path");
  if (CAPCUT20.length !== 20) throw new Error("CAPCUT20 must list 20 transitions");
  for (const x of CAPCUT20) { if (!T[x.type]) throw new Error(`CAPCUT20 "${x.capcut}" -> unknown preset ${x.type}`);
    if (!fs.existsSync(path.resolve(__dirname, "..", x.file))) throw new Error(`CAPCUT20 "${x.capcut}": missing sfx ${x.file}`); }
  console.log(`selftest ok: ${names.length} transitions, ${Object.keys(A).length} caption animations, ${Object.keys(O).length} overlays; ${r.js.split("\n").length} timeline lines`);
}

// Port reference for engines other than build-shorts (hand-built HyperFrames, Remotion, ffmpeg): every CapCut-20
// transition's sound, peak and volume, plus its exact motion (GSAP fromTo values, durations, eases) for a cut at t=1 s.
//   node motion-graphics-library/mgl.js --capcut20
if (require.main === module && process.argv[2] === "--capcut20") {
  const ctx = makeCtx({ freezeFrame: () => "<freeze-frame-of-outgoing-shot>.jpg", video: "<footage>.mp4" });
  for (const x of CAPCUT20) { const p = T[x.type], o = { intensity: 1, ...p.defaults, t: 1 }, r = p.build(o, ctx);
    console.log(`\n## ${x.capcut}  (preset ${x.type}, ${p.desc})\nsound: ${x.file}  peak ${x.peak} s on the cut, volume ${x.vol ?? "builder default (~0.2)"}\n` +
      `layers: #fx = the footage (incoming after the cut)${r.below ? "; frozen outgoing frame BELOW it" : ""}${r.above ? "; extra layer ABOVE it (freeze/overlay)" : ""}${r.inFx ? "; synced duplicate footage layers inside #fx" : ""}\n` +
      r.js.trim().split("\n").map((l) => "  " + l).join("\n")); }
}
