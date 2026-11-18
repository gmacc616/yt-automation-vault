// Timeline of the yakhchal short: shots timed to the voice (words.ts), the story state per shot (the dome rising, the
// pool filling / freezing / smashed, the sled, the ice stack in the pit, the freezer) and a character-first camera
// (study 2026-11-18 §4-5): low lenses at chest height, heads big in frame, a new framing every 1.5-2.5 s, creep ->
// punch -> creep, dissolves at sentence changes, dutch on the drama, prop inserts on the nouns.
import { W } from "./words";
import type { Expr } from "./toon";
import { DOOR, DOME, PIT, KIT, POOL_Z0, POOL_Z1, WALL_Z } from "./desert";
export const FPS = 30;
export const TOTAL = Math.ceil((W.end + 0.45) * FPS);
export const D0 = 0;
export type V3 = [number, number, number];
/** where the action happens: [x, z] */
export const SPOT = { square: [0, 14] as [number, number], trough: [6, 8] as [number, number], pool: [-20, (POOL_Z0 + POOL_Z1) / 2] as [number, number] };

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + (y1 - y0) * smooth((x - x0) / (x1 - x0));
  }
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
  S(1, 0, W.yousee1 - E, "day", "hook", { sunAz: 120, sunEl: 55 }),
  S(2, W.yousee1 - E, W.so1 - E, "day", "heat", { sunAz: 110, sunEl: 60, wideFrom: fr(W.snow1) - 6 }),
  S(3, W.so1 - E, W.andmud - E, "day", "build", { sunAz: 70, sunEl: 40 }),
  S(4, W.andmud - E, W.eggs - E, "day", "mix", { sunAz: 80, sunEl: 45 }),
  S(5, W.eggs - E, W.then1 - E, "day", "doubters", { sunAz: 80, sunEl: 45 }),
  S(6, W.then1 - E, W.atnight - E, "day", "dig", { sunAz: 120, sunEl: 30 }),
  S(7, W.atnight - E, W.morning - E, "night", "flood"),
  S(8, W.morning - E, W.sohow - E, "golden", "frost", { sunAz: 60, sunEl: 8 }),
  S(9, W.sohow - E, W.well - E, "golden", "puzzled", { sunAz: 60, sunEl: 8 }),
  S(10, W.well - E, W.like - E, "night", "explain", { wideFrom: fr(W.sky1) - 6 }),
  S(11, W.like - E, W.so2 - E, "night", "freezer", { wideFrom: fr(W.whole) }),
  S(12, W.so2 - E, W.stack - E, "golden", "smash", { sunAz: 70, sunEl: 8 }),
  S(13, W.stack - E, W.dome2 - E, "night", "stack"),
  S(14, W.dome2 - E, W.then2 - E, "day", "vent", { sunAz: 90, sunEl: 40 }),
  S(15, W.then2 - E, W.turns - E, "day", "summer", { sunAz: 110, sunEl: 55 }),
  S(16, W.turns - E, W.end + 0.45, "golden", "finale", { sunAz: 140, sunEl: 14, wideFrom: fr(W.skyend) - 4 }),
];
SHOTS[SHOTS.length - 1].b = TOTAL;
export const XFADE: Record<number, number> = { 2: 8, 3: 10, 4: 8, 5: 6, 6: 10, 7: 10, 8: 12, 9: 8, 10: 10, 11: 10, 12: 12, 13: 10, 14: 10, 15: 8, 16: 10 };
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
export type Scene = {
  place: "town" | "inside" | "kitchen";
  dome: number; fill: number; frost: number; broken: number; layers: number; stars: boolean; open: number;
  sled: [number, number, number, number] | null; lamp: number; lampPos: V3;
};
const [PX, PZ] = SPOT.pool;
export const sledAt = (t: number): [number, number, number, number] => [PX + 3 + Math.max(0, t - W.drag + 0.3) * 1.3, 0, POOL_Z0 - 3.2, 0];
export const sceneAt = (id: number, t: number): Scene => {
  const s: Scene = { place: "town", dome: 1, fill: 0, frost: 0, broken: 0, layers: 0, stars: false, open: 1, sled: null, lamp: 0, lampPos: [0, 0, 0] };
  switch (id) {
    case 3: s.dome = lin([[W.so1, 0.05], [W.dome1 + 0.4, 1]], t); break;
    case 6: s.fill = 0; break;
    case 7: s.fill = lin([[W.flood - 0.1, 0], [W.water + 0.9, 1]], t); s.lamp = 9; s.lampPos = [PX + 1.0, 2.0, POOL_Z0 - 2.2]; break;
    case 8: s.fill = 1; s.frost = lin([[W.morning - 0.3, 0.35], [W.ice1, 1]], t); break;
    case 9: s.fill = 1; s.frost = 1; break;
    case 10: s.fill = 1; s.frost = 0.2; s.lamp = 6; s.lampPos = [PX + 0.5, 2.0, POOL_Z0 - 2.4]; break;
    case 11: s.place = "kitchen"; s.stars = t > W.whole - 0.15; s.open = lin([[W.like, 0.2], [W.like + 0.6, 1]], t); break;
    case 12: s.fill = 1; s.frost = 1; s.broken = t > W.smash - L ? 1 : 0; s.sled = t > W.drag - 0.6 ? sledAt(t) : null; break;
    case 13: s.place = "inside"; s.layers = Math.min(6, 2 + Math.floor(Math.max(0, t - W.stack + 0.2) * 2.6)); break;
    case 15: s.place = "town"; break;
  }
  return s;
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
/** creep (rate per frame) with an optional punch (8 f ramps) over the first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 12) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 4, (n - i - 0.5) / 4));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const a = (id: number) => SHOTS[id - 1].a;
const at = (s: number) => fr(s);
/** a key on a beat word: a fast 10 f reframe, then a slow creep with a small punch */
const K = (t: number, pos: V3, look: V3, fov = 46, roll = 0, dur = 10, punch = 0.02): Key =>
  ({ f: at(t) - 4, dur, s: (f) => dolly(pos, look, pushK(f, at(t) + dur - 4, 0.0035, punch), { fov, roll }) });
const [SX, SZ] = SPOT.square, [TX, TZ] = SPOT.trough;
const DZ = DOOR[2];
const P3 = (dx: number, y: number, dz: number): V3 => [PIT[0] + dx, PIT[1] + y, PIT[2] + dz];
const K3 = (dx: number, y: number, dz: number): V3 => [KIT[0] + dx, KIT[1] + y, KIT[2] + dz];
const sledCam = (f: number): V3 => { const p = sledAt(f / FPS); return [p[0], 0.9, p[2]]; };

const CAMS: Record<number, Key[]> = {
  // hook: low on the kid eating faloodeh in the hot square, the dome behind; punch on "freezer"
  1: [
    { f: 0, s: (f) => dolly([SX + 1.0, 1.0, SZ + 3.6], [SX, 1.2, SZ], pushK(f, 0, 0.004, 0.01), { fov: 50, roll: 0.03 }) },
    K(W.desert, [SX - 1.6, 1.3, SZ + 3.4], [SX + 0.4, 1.4, SZ - 1.0], 50, -0.04, 14),
    K(W.freezer, [SX + 0.35, 1.05, SZ + 1.55], [SX, 1.25, SZ], 44, 0.06, 8, 0.03),
  ],
  // heat: Dad sweating, punch on the number; crane up to the town and the snowy mountains
  2: [
    { f: a(2), s: (f) => dolly([SX + 1.2, 1.6, SZ + 4.0], [SX + 0.2, 1.75, SZ + 0.4], pushK(f, a(2), 0.004), { fov: 46 }) },
    K(W.hundred, [SX + 0.5, 1.75, SZ + 2.3], [SX + 0.2, 1.8, SZ + 0.4], 42, 0.1, 8, 0.03),
    { f: at(W.snow1) - 8, dur: 30, s: (f) => dolly([SX + 25, 34, SZ + 55], [SX - 10, -25, SZ - 320], pushK(f, at(W.snow1) + 22, 0.002), { fov: 54 }) },
  ],
  // they built a dome: low at the door, the dome grows; tilt up on "sixty"; door CU on "thick"
  3: [
    { f: a(3), s: (f) => dolly([DOOR[0] + 6, 0.7, DZ + 12], [DOME[0], 6, DOME[2]], pushK(f, a(3), 0.003), { fov: 56 }) },
    K(W.sixty, [DOOR[0] + 3, 0.5, DZ + 8], [DOME[0], 12, DOME[2]], 58, -0.08, 14),
    K(W.thick, [DOOR[0] + 0.6, 1.4, DZ + 5.0], [DOOR[0] + 0.1, 1.5, DZ + 1.4], 46, 0.04, 10),
  ],
  // the mud: an insert on the trough, a reframe per ingredient
  4: [
    { f: a(4), s: (f) => dolly([TX + 0.4, 1.7, TZ + 3.4], [TX - 0.2, 0.9, TZ + 0.3], pushK(f, a(4), 0.004), { fov: 48 }) },
    K(W.lime, [TX - 0.6, 1.4, TZ + 2.8], [TX - 0.1, 0.9, TZ + 0.3], 46, 0.04, 8),
    K(W.goat, [TX + 2.2, 1.2, TZ + 4.2], [TX + 1.3, 0.9, TZ + 0.5], 48, -0.05, 10),
    K(W.egg, [TX + 0.7, 1.35, TZ + 1.9], [TX + 0.5, 1.05, TZ + 0.6], 40, 0.06, 8, 0.03),
  ],
  // the doubters: two-shot, then a punch on "wall"
  5: [
    { f: a(5), s: (f) => dolly([TX + 0.1, 1.55, TZ + 3.0], [TX + 0.05, 1.5, TZ], pushK(f, a(5), 0.004, 0.012), { fov: 44 }) },
    K(W.wall1, [TX + 0.6, 1.6, TZ + 1.9], [TX + 0.6, 1.65, TZ - 0.2], 40, -0.1, 8, 0.03),
  ],
  // winter: digging the long pool; tilt up the giant wall against the sun
  6: [
    { f: a(6), s: (f) => dolly([PX + 1.2, 0.6, PZ - 3.6], [PX, 0.8, PZ + 0.3], pushK(f, a(6), 0.004), { fov: 50 }) },
    K(W.pool, [PX - 6, 0.8, POOL_Z0 - 2.2], [PX + 4, 0.6, PZ + 1], 54, 0.05, 14),
    K(W.wall2, [PX + 2, 1.0, POOL_Z0 - 6], [PX, 9, WALL_Z], 58, -0.06, 16),
  ],
  // night: flooding the pool by lantern light
  7: [
    { f: a(7), s: (f) => dolly([PX + 3.6, 1.4, POOL_Z0 - 5.6], [PX, 1.0, POOL_Z0 - 0.5], pushK(f, a(7), 0.004), { fov: 48 }) },
    K(W.water, [PX - 3, 0.8, POOL_Z0 - 2.4], [PX + 3, 0.0, PZ], 52, 0.06, 12),
  ],
  // by morning: ice! an insert on the ice, then the shrug
  8: [
    { f: a(8), s: (f) => dolly([PX + 1.0, 1.25, POOL_Z0 - 4.8], [PX, 1.1, POOL_Z0 - 1.2], pushK(f, a(8), 0.004), { fov: 46 }) },
    K(W.ice1, [PX + 0.5, 1.0, POOL_Z0 + 0.4], [PX + 0.2, -0.3, POOL_Z0 + 3], 44, 0.08, 8, 0.03),
    K(W.even, [PX + 0.6, 1.4, POOL_Z0 - 3.6], [PX + 0.2, 1.5, POOL_Z0 - 1.5], 42, -0.05, 10),
  ],
  // so how does a puddle freeze? a dutch CU
  9: [{ f: a(9), s: (f) => dolly([PX + 0.6, 1.0, POOL_Z0 - 3.0], [PX, 1.1, POOL_Z0 - 0.9], pushK(f, a(9), 0.005, 0.014), { fov: 42, roll: 0.16 }) }],
  // radiative cooling: heat rising from the pool; crane up with it to the stars
  10: [
    { f: a(10), s: (f) => dolly([PX + 4, 1.2, POOL_Z0 - 7], [PX, 1.6, PZ], pushK(f, a(10), 0.003), { fov: 50 }) },
    K(W.throws, [PX + 6, 4.5, POOL_Z0 - 11], [PX, 9, PZ], 54, 0.05, 18),
    { f: at(W.sky1) - 6, dur: 22, s: (f) => dolly([PX + 3, 2.0, POOL_Z0 - 9], [PX - 2, 40, PZ - 20], pushK(f, at(W.sky1) + 16, 0.003), { fov: 62 }) },
  ],
  // the freezer: someone in front of it; push into it on "the whole night sky"
  11: [
    { f: a(11), s: (f) => dolly(K3(1.6, 1.45, 0.4), K3(0.9, 1.35, -1.8), pushK(f, a(11), 0.004), { fov: 48 }) },
    K(W.freezer2, K3(1.1, 1.5, -0.6), K3(0.9, 1.5, -1.8), 42, 0.06, 8, 0.03),
    { f: at(W.whole) - 6, dur: 18, s: (f) => dolly(K3(0.95, 1.25, -2.0), K3(0.9, 1.2, -2.9), pushK(f, at(W.whole) + 12, 0.006), { fov: 44 }) },
  ],
  // sunrise: smashing the ice, then follow the sled
  12: [
    { f: a(12), s: (f) => dolly([PX + 3.6, 1.3, POOL_Z0 - 3.2], [PX, 0.5, POOL_Z0 + 2], pushK(f, a(12), 0.004, 0.01), { fov: 50, roll: 0.05 }) },
    K(W.smash, [PX + 1.2, 1.0, POOL_Z0 - 1.6], [PX, 0.2, POOL_Z0 + 2.2], 46, -0.08, 8, 0.03),
    { f: at(W.drag) - 6, dur: 14, s: (f) => { const p = sledCam(f); return dolly([p[0] - 3.5, 1.3, p[2] - 4.2], [p[0] + 1.2, 0.9, p[2]], 1, { fov: 50 }); } },
  ],
  // inside: stacking in the pit with straw
  13: [
    { f: a(13), s: (f) => dolly(P3(3.8, 1.7, 5.6), P3(0.2, -1.6, 0.2), pushK(f, a(13), 0.004), { fov: 52 }) },
    K(W.straw, P3(2.6, 1.2, 4.2), P3(0.2, -2.2, 0.2), 48, 0.06, 10),
  ],
  // the dome works like a chimney: low on a kid, tilt up the dome to the vent
  14: [
    { f: a(14), s: (f) => dolly([DOOR[0] + 4.5, 1.0, DZ + 8.5], [DOOR[0] + 2.4, 1.2, DZ + 5], pushK(f, a(14), 0.004), { fov: 48 }) },
    K(W.warm, [DOOR[0] + 8, 1.0, DZ + 14], [DOME[0], 11, DOME[2]], 56, -0.05, 16),
    K(W.chimney, [DOOR[0] + 5, 4, DZ + 10], [DOME[0], 19, DOME[2]], 54, 0.04, 12),
  ],
  // summer: the ice comes out of the door, kids cheer
  15: [
    { f: a(15), s: (f) => dolly([DOOR[0] + 1.6, 1.0, DZ + 9.5], [DOOR[0], 1.4, DZ + 3], pushK(f, a(15), 0.004), { fov: 50 }) },
    K(W.comes, [DOOR[0] + 0.8, 1.2, DZ + 7.0], [DOOR[0], 1.6, DZ + 3.2], 46, 0.06, 8, 0.03),
    K(W.iceout, [DOOR[0] - 2.5, 1.0, DZ + 9.0], [DOOR[0] + 0.5, 1.2, DZ + 5.5], 50, -0.05, 10),
  ],
  // it was the sky: the family eating; crane up to the sky
  16: [
    { f: a(16), s: (f) => dolly([SX + 1.0, 1.1, SZ + 3.8], [SX, 1.2, SZ - 0.5], pushK(f, a(16), 0.004), { fov: 50 }) },
    K(W.it, [SX + 0.4, 1.1, SZ + 2.2], [SX, 1.25, SZ], 44, 0.05, 8, 0.03),
    { f: at(W.skyend) - 4, dur: Math.max(24, TOTAL - at(W.skyend) + 4), s: (f) => dolly([SX + 1.5, 4, SZ + 7], [SX, 60, SZ - 40], pushK(f, TOTAL, 0.003), { fov: 58, roll: 0.03 }) },
  ],
};

const KICKS: [number, number][] = [[W.freezer, 0.6], [W.dome1, 0.7], [W.egg, 0.6], [W.ice1, 0.8], [W.smash, 1.1], [W.comes, 0.5]];
export const kickAt = (t: number) => {
  let k = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) k += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
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

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const sa = (id: number) => SHOTS[id - 1].a;
export const DOF: Dof[] = [
  { f: 0, cInf: 13 }, { f: sa(2), cInf: 12 }, { f: at(W.snow1) - 6, dur: 14, cInf: 0 }, { f: sa(3), cInf: 6 }, { f: at(W.thick), cInf: 12 }, { f: sa(4), cInf: 13 },
  { f: sa(5), cInf: 14 }, { f: sa(6), cInf: 9 }, { f: sa(7), cInf: 11 }, { f: sa(8), cInf: 12 }, { f: sa(9), cInf: 15 }, { f: sa(10), cInf: 8 }, { f: at(W.sky1) - 6, dur: 12, cInf: 0 },
  { f: sa(11), cInf: 13 }, { f: sa(12), cInf: 10 }, { f: sa(13), cInf: 4 }, { f: sa(14), cInf: 10 }, { f: at(W.warm), dur: 12, cInf: 4 }, { f: sa(15), cInf: 11 },
  { f: sa(16), cInf: 13 }, { f: at(W.skyend) - 4, dur: 14, cInf: 0 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => { const d = dofAt(f); return d.focus ? d.focus(f) : camAt(id, f).look; };
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
export const moodOf = (e: Expr) => e;
export { W };
