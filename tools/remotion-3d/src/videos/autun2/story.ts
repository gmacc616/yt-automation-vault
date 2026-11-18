// Timeline of the Autun short: shots timed to the voice (words.ts), the state per shot (place, weather) and the camera
// rebuilt from the 2026-11-18 gap study (GAP_2026-11-18.md): full-body framing (character ~55-65 % of the frame
// height, feet low, floor visible), asymmetric eases (fast attack, slow settle, a small overshoot on a third of the
// moves), slow creeps that pull out as often as they push in, a sideways arc for parallax, dead-still holds on
// punchlines, hard cut-ins inside one place and dissolves only on place/time changes, look DIRECTION interpolation.
import { W } from "./words";
import type { Expr } from "./toon";
import { COURT, FIELD, CHURCH, LANE, PARTY } from "./medieval";
export const FPS = 30;
export const TOTAL = Math.ceil((W.end + 0.45) * FPS);
export const D0 = 0;
export type V3 = [number, number, number];
export const SPOT = {};

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * smooth((x - x0) / (x1 - x0)); }
  return pts[pts.length - 1][1];
};
const fr = (s: number) => Math.round(s * FPS);
export const L = 2 / FPS;

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: string; sunAz?: number; sunEl?: number; wide?: boolean; wideFrom?: number };
const S = (id: number, a: number, b: number, light: Light, crowd: string, more: Partial<ShotDef> = {}): ShotDef => ({ id, a: fr(a), b: fr(b), light, crowd, ...more });
const E = 0.1;
export const SHOTS: ShotDef[] = [
  S(1, 0, W.yousee1 - E, "day", "hook", { sunAz: 140, sunEl: 35 }),
  S(2, W.yousee1 - E, W.eaten - E, "day", "field", { sunAz: 120, sunEl: 40 }),
  S(3, W.eaten - E, W.so1 - E, "day", "eaten", { sunAz: 120, sunEl: 40 }),
  S(4, W.so1 - E, W.qrats - E, "day", "trial", { sunAz: 130, sunEl: 45 }),
  S(5, W.qrats - E, W.their - E, "day", "doubters", { sunAz: 130, sunEl: 45 }),
  S(6, W.their - E, W.so2 - E, "day", "hero", { sunAz: 130, sunEl: 45 }),
  S(7, W.so2 - E, W.but - E, "day", "empty", { sunAz: 130, sunEl: 45, wideFrom: fr(W.dont) - 2 }),
  S(8, W.but - E, W.so3 - E, "day", "plea", { sunAz: 130, sunEl: 45 }),
  S(9, W.so3 - E, W.sohow - E, "night", "priests"),
  S(10, W.sohow - E, W.well - E, "night", "ponder"),
  S(11, W.well - E, W.yousee2 - E, "night", "lane"),
  S(12, W.yousee2 - E, W.like - E, "night", "explain"),
  S(13, W.like - E, W.so4 - E, "golden", "party", { sunAz: 140, sunEl: 25 }),
  S(14, W.so4 - E, W.nobody - E, "day", "cats", { sunAz: 120, sunEl: 35 }),
  S(15, W.nobody - E, W.walked - E, "day", "stopped", { sunAz: 130, sunEl: 45 }),
  S(16, W.walked - E, W.end + 0.45, "golden", "free", { sunAz: 160, sunEl: 10 }),
];
SHOTS[SHOTS.length - 1].b = TOTAL;
/** dissolves only where the place or the time changes; everything else is a hard cut */
export const XFADE: Record<number, number> = { 2: 8, 4: 8, 9: 10, 12: 8, 13: 8, 14: 8, 15: 8, 16: 10 };
export const FLASH_AT = SHOTS[1].a;
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- story state ----------------
export type Scene = { place: "town" | "field" | "court" | "party"; wet: boolean; rain: number };
export const sceneAt = (id: number, t: number): Scene => {
  void t;
  if (id === 2 || id === 3) return { place: "field", wet: false, rain: 0 };
  if (id === 9 || id === 10 || id === 11) return { place: "town", wet: true, rain: 1 };
  if (id === 14) return { place: "town", wet: true, rain: 0 };
  if (id === 16) return { place: "town", wet: true, rain: 0 };
  if (id === 13) return { place: "party", wet: false, rain: 0 };
  return { place: "court", wet: false, rain: 0 };
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; over?: number; reveal?: boolean; s: (f: number) => Shot };
/** the reference's opening pull-out: short ease-in, long ease-out (velocity ~ t(1-t)^1.5), no overshoot */
export const easeReveal = (t: number) => { const u = clamp01(t); return 1 - Math.pow(1 - u, 2.5) * (1 + 2.5 * u); };
const easeSine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t));
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const scl = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
/** fast attack (~3 f of a 10 f move), slow settle, optional overshoot (easeOutBack on a softened start) */
export const ease = (u: number, over = 0) => {
  const x = Math.pow(clamp01(u), 1.3) - 1, c1 = over, c3 = over + 1;
  return 1 + c3 * x * x * x + c1 * x * x;
};
const full = (c: Shot): Cam => ({ fov: 46, roll: 0, ...c });
/** blend two cameras: positions linearly, the look DIRECTION and distance separately (even turn speed) */
const mix = (a: Cam, b: Cam, k: number): Cam => {
  const pos = add(a.pos, scl(sub(b.pos, a.pos), k));
  const da = sub(a.look, a.pos), db = sub(b.look, b.pos), la = len(da), lb = len(db);
  const dir = add(scl(da, (1 - k) / la), scl(db, k / lb)), dl = len(dir) || 1;
  const d = la + (lb - la) * k;
  return { pos, look: add(pos, scl(dir, d / dl)), fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k };
};
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    const u = (f - k.f) / (k.dur ?? 14);
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), k.reveal ? easeReveal(u) : k.over ? ease(u, k.over) : easeSine(u));
  }
  return cur;
};
/** full-body framing: feet point P, the character fills `frac` of the frame height (2.16 m card), the lens `yaw` deg
 *  around it (0 = from +z), at camY above the feet, looking at lookY; `side` shifts the subject off centre (m) */
const TAN = (fov: number) => Math.tan((fov * Math.PI) / 360);
export const frame = (P: V3, frac: number, yaw = 0, o: { fov?: number; camY?: number; lookY?: number; side?: number; roll?: number } = {}): Shot => {
  // tighter than the first pass: the reference fills the frame (less empty space)
  const fov = o.fov ?? 46, d = 2.16 / Math.min(0.92, frac * 1.2) / (2 * TAN(fov)), a = (yaw * Math.PI) / 180;
  const fx = Math.sin(a), fz = Math.cos(a), sd = o.side ?? 0;
  return { pos: [P[0] + fx * d, P[1] + (o.camY ?? 1.35), P[2] + fz * d], look: [P[0] - fz * sd, P[1] + (o.lookY ?? 1.0), P[2] + fx * sd], fov, roll: o.roll ?? 0 };
};
/** a living hold: creep (+ push in, - pull out, per frame), a sideways arc (deg per second) around the look point */
const hold = (sh: Shot, f: number, f0: number, creep = 0.0015, arc = 3): Shot => {
  const u = Math.max(0, f - f0), k = Math.exp(-creep * 1.3 * u), a = (arc * 1.7 * u / FPS) * Math.PI / 180;
  const d = sub(sh.pos, sh.look), c = Math.cos(a), s = Math.sin(a);
  const r: V3 = [d[0] * c - d[2] * s, d[1], d[0] * s + d[2] * c];
  // a slow truck of the whole rig (lens and look point together): real parallax between near and far layers
  const h = Math.hypot(d[0], d[2]) || 1, tr = Math.sign(arc || 1) * 0.12 * u / FPS, side: V3 = [d[2] / h * tr, 0.02 * Math.sin(u / 40), -d[0] / h * tr];
  // the look point stays locked on the subject (never lose it); only the lens trucks a little
  return { ...sh, pos: add(add(sh.look, scl(r, k)), scl(side, 0.6)) };
};
const still = (sh: Shot): Shot => sh;
const a = (id: number) => SHOTS[id - 1].a;
const at = (s: number) => fr(s);
/** key helpers: a move (14 f ease, overshoot on every third), a hard cut-in, a dead-still hold */
let nth = 0;
const MV = (t: number, sh: () => Shot, creep = 0.0015, arc = 3, dur = 22): Key => { const over = nth++ % 6 === 0 ? 0.4 : 0; const f0 = at(t) - 3; return { f: f0, dur, over, s: (f) => hold(sh(), f, f0 + dur, creep, arc) }; };
const CUT = (t: number, sh: () => Shot, creep = -0.0012, arc = -3): Key => { const f0 = at(t) - 1; return { f: f0, cut: true, s: (f) => hold(sh(), f, f0, creep, arc) }; };
const STILL = (t: number, sh: () => Shot, dur = 10): Key => ({ f: at(t) - 3, dur, s: (f) => hold(still(sh()), f, at(t) + dur, 0.001, 0.5) });

const [CX, CY, CZ] = COURT, [FX, , FZ] = FIELD, [KX, , KZ] = CHURCH, [LX, , LZ] = LANE, [PX, PY, PZ] = PARTY;
const LAWYER: V3 = [CX + 1.9, CY, CZ - 3.2], JUDGE: V3 = [CX, CY + 0.8, CZ - 9.6], DOCK: V3 = [CX + 4.5, CY, CZ - 4.1];
const mid = (p: V3, q: V3, k = 0.42): V3 => [p[0] + (q[0] - p[0]) * k, Math.min(p[1], q[1]), p[2] + (q[2] - p[2]) * k];

const CAMS: Record<number, Key[]> = {
  // hook: lawyer and his clients in the dock, full body two-shot; cut-in to the rats on "never"
  1: [
    // the reference opening: on the hero first (chest-height lens looking slightly up), then one long pull-out that
    // reveals the place on its noun ("court"), settling in ~32 f; the hero stays in frame on a third
    { f: 0, s: (f) => hold(frame(LAWYER, 0.45, 20, { fov: 35, camY: 1.0, lookY: 1.55 }), f, 0, 0.001, 1.5) },
    { f: at(W.court1) - 2, dur: 32, reveal: true, s: (f) => hold({ pos: [CX + 0.6, CY + 3.0, CZ + 8.6], look: [CX + 2.6, CY + 1.0, CZ - 4.2], fov: 35 }, f, at(W.court1) + 30, 0.001, 1) },
    CUT(W.never, () => ({ pos: add(DOCK, [0.4, 0.55, 2.4]), look: add(DOCK, [0, 0.35, 0]), fov: 46, roll: 0.06 }), 0.002, 4),
  ],
  // France 1510: the barley field and the windmill, a farmer in the foreground
  2: [
    // on the farmer first, then the big crane-out over the barley on "Autun" (town hazy on the horizon)
    { f: a(2), s: (f) => hold(frame([FX - 1.2, 0, FZ + 4.6], 0.45, 200, { fov: 35, camY: 1.0, lookY: 1.5 }), f, a(2), 0.001, 1.5) },
    { f: at(W.autun) - 2, dur: 34, reveal: true, s: (f) => hold({ pos: [FX - 4, 7, FZ - 12], look: [FX - 1, 1.0, FZ + 6], fov: 35 }, f, at(W.autun) + 32, 0.001, 1) },
  ],
  // the rats in the eaten patch, the farmers behind them
  3: [
    { f: a(3), s: (f) => hold(frame([FX, 0, FZ + 2.4], 0.42, -6, { camY: 0.9, lookY: 0.9 }), f, a(3), 0.0015, -3) },
    MV(W.barley, () => frame([FX - 1.2, 0, FZ + 2.4], 0.6, 10, { camY: 1.3 }), 0.0012, 3),
  ],
  // the trial: the room from the back, then the judge, then the lawyer
  4: [
    { f: a(4), s: (f) => hold({ pos: [CX + 0.6, CY + 1.7, CZ + 11.5], look: [CX + 1.8, CY + 1.0, CZ - 5], fov: 52 }, f, a(4), 0.0016, 2) },
    CUT(W.judge, () => frame(JUDGE, 0.62, -4, { camY: 1.1, lookY: 1.0 }), -0.0012, 3),
    CUT(W.reallawyer, () => frame(mid(LAWYER, DOCK, 0.3), 0.5, 10), 0.0015, -3),
  ],
  // "Rats? In court?": two doubters full body, a cut-in on the second
  5: [
    { f: a(5), s: (f) => hold(frame([CX, CY, CZ + 1.8], 0.5, 0, { camY: 1.3 }), f, a(5), 0.0018, 3) },
    CUT(W.qcourt, () => frame([CX + 0.9, CY, CZ + 1.6], 0.72, -8, { lookY: 1.1, roll: -0.12 }), 0.002, -3),
  ],
  // Chasseneuz: hero full body, 3/4 view with the dock behind; push on "defend"
  6: [
    { f: a(6), s: (f) => hold(frame(mid(LAWYER, DOCK, 0.3), 0.46, -18, { camY: 1.25 }), f, a(6), 0.0015, 3) },
    MV(W.defend, () => frame(mid(LAWYER, DOCK, 0.2), 0.55, -14, { camY: 1.2 }), 0.0012, 2),
  ],
  // the summons, the empty dock, "Big surprise." (dead still on the judge)
  7: [
    { f: a(7), s: (f) => hold(frame([CX - 1.6, CY, CZ - 6.4], 0.55, 12, { camY: 1.3 }), f, a(7), 0.0015, 3) },
    CUT(W.dont, () => ({ pos: add(DOCK, [-1.0, 1.5, 5.6]), look: add(DOCK, [-0.6, 0.6, 0]), fov: 46 }), 0.0015, 3),
    CUT(W.big, () => frame(JUDGE, 0.7, 6, { camY: 1.0, lookY: 1.05 }), 0, 0),
  ],
  // the plea: the lawyer talking, judge in the back
  8: [
    { f: a(8), s: (f) => hold(frame(mid(LAWYER, JUDGE, 0.25), 0.42, -24, { camY: 1.3, lookY: 1.2 }), f, a(8), 0.0016, -3) },
    MV(W.one, () => frame(mid(LAWYER, DOCK, 0.25), 0.52, -20, { camY: 1.2 }), 0.0014, 2),
  ],
  // rainy night: priests read the summons on the church steps, the crowd in front; the rats behind a barrel
  9: [
    { f: a(9), s: (f) => hold({ pos: [KX + 3, 1.4, KZ + 12], look: [KX, 2.2, KZ + 1], fov: 50 }, f, a(9), 0.0016, -2) },
    CUT(W.every, () => frame([KX, 0.66, KZ + 1.2], 0.5, 6, { camY: 1.3 }), 0.0015, 3),
    CUT(W.still, () => ({ pos: [-10.0, 0.55, 10.2], look: [-11.0, 0.35, 7.9], fov: 46, roll: 0.08 }), 0.002, 3),
  ],
  // so how does he get them out of that? the lawyer in the rain, a puddle in front (still)
  10: [
    { f: a(10), s: (f) => hold(frame([1.5, 0, 6.5], 0.55, 18, { camY: 1.0, lookY: 1.0 }), f, a(10), 0.0008, 1.5) },
  ],
  // the lane of cats: down the lane past the lawyer; cut to the glowing eyes on "cats"
  11: [
    { f: a(11), s: (f) => hold({ pos: [LX - 14.5, 1.35, LZ + 0.4], look: [LX - 9.5, 1.1, LZ + 2.4], fov: 50 }, f, a(11), 0.0016, -2) },
    MV(W.dangerous, () => ({ pos: [LX - 12.5, 1.3, LZ + 1.4], look: [LX + 6, 1.4, LZ - 0.2], fov: 46, roll: 0.1 }), 0.0018, -3),
    CUT(W.cats, () => ({ pos: [LX + 2.6, 1.95, LZ + 2.0], look: [LX + 4.4, 1.85, LZ + 5.0], fov: 46, roll: -0.08 }), 0.002, 4),
  ],
  // you didn't have to answer if the trip could kill you: the lawyer pleading at night
  12: [
    { f: a(12), s: (f) => hold(frame(mid(LAWYER, JUDGE, 0.25), 0.42, -24, { camY: 1.3, lookY: 1.2 }), f, a(12), 0.0016, 3) },
    MV(W.killed, () => frame(mid(LAWYER, DOCK, 0.2), 0.55, -16, { camY: 1.2, roll: 0.15 }), 0.0014, 2),
  ],
  // the party: a guest, the worst enemy waiting at the door behind
  13: [
    { f: a(13), s: (f) => hold({ pos: [PX + 1.2, PY + 1.4, PZ + 3.4], look: [PX + 0.4, PY + 1.1, PZ - 3.2], fov: 48 }, f, a(13), 0.0015, -2) },
    CUT(W.enemy, () => frame([PX + 1.8, PY, PZ - 5.2], 0.62, 8, { camY: 1.25 }), 0.002, 3),
    CUT(W.door, () => frame([PX - 0.6, PY, PZ - 1.0], 0.6, -10, { camY: 1.3 }), 0.0015, -3),
  ],
  // the town holds on to its cats: group wide after the rain, cut-in on "lock"
  14: [
    { f: a(14), s: (f) => hold(frame([0, 0, 7.6], 0.36, 0, { camY: 1.4 }), f, a(14), 0.0016, 3) },
    CUT(W.lock, () => frame([2.5, 0, 8.8], 0.62, -6, { roll: -0.14 }), 0.0015, -3),
  ],
  // nobody could promise that: the judge shrugs (still), the case stops
  15: [
    { f: a(15), s: () => frame(JUDGE, 0.62, 4, { camY: 1.1, lookY: 1.0 }) },
    CUT(W.stopped, () => frame(mid(LAWYER, DOCK), 0.4, 4, { fov: 50, camY: 1.2, lookY: 0.9 }), 0.0015, -3),
  ],
  // the rats walk free down the lane at sunset, past sleeping cats; a slow pull-out to end
  16: [
    { f: a(16), s: (f) => hold({ pos: [LX + 2.5, 1.0, LZ + 1.6], look: [LX - 4, 0.6, LZ], fov: 48 }, f, a(16), 0.0012, 2) },
    MV(W.least, () => ({ pos: [LX + 6, 1.4, LZ + 2.0], look: [LX - 8, 1.0, LZ - 0.4], fov: 50 }), -0.0015, -2, 20),
  ],
};

const KICKS: [number, number][] = [[W.never, 0.6], [W.big, 0.0], [W.cats, 0.8], [W.stopped, 0.5]];
export const kickAt = (t: number) => {
  let k = 0;
  for (const [t0, g] of KICKS) { const n = Math.floor((t - t0) * FPS + 1e-6); if (n >= 0 && n < 7) k += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5; }
  return k;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), k = kickAt(f / FPS);
  if (!k) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const Ld = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * Ld * k;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + k * 0.004 };
};

// ---------------- lens: blur the far background on full-body shots, wides sharp ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [{ f: 0, cInf: 9 }, { f: at(W.court1), dur: 30, cInf: 1 }, { f: at(W.never), cInf: 9 }, { f: a(2), cInf: 9 }, { f: at(W.autun), dur: 32, cInf: 0 }, { f: a(3), cInf: 8 }, { f: a(4), cInf: 2 }, { f: at(W.judge), cInf: 8 }, { f: a(5), cInf: 9 }, { f: a(6), cInf: 9 },
  { f: a(7), cInf: 7 }, { f: a(8), cInf: 9 }, { f: a(9), cInf: 3 }, { f: at(W.every), cInf: 8 }, { f: a(10), cInf: 9 }, { f: a(11), cInf: 4 }, { f: at(W.cats), cInf: 9 },
  { f: a(12), cInf: 9 }, { f: a(13), cInf: 7 }, { f: a(14), cInf: 5 }, { f: at(W.lock), cInf: 9 }, { f: a(15), cInf: 8 }, { f: a(16), cInf: 6 }];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: 1.35 * (p.cInf + (d.cInf - p.cInf) * k), focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => { const d = dofAt(f); return d.focus ? d.focus(f) : camAt(id, f).look; };
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
export const moodOf = (e: Expr) => e;
export { W };
void KZ; void FZ;
