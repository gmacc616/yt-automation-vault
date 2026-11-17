// Timeline of the Tsar Bell short: shots timed to the voice (words.ts, from ~/tsarbell-short/voice/words.json), the
// story state per shot (casting house intact / burning / burnt, the bell's glow, cracks and broken piece, the 1836 lift,
// the flashback bells) and the camera grammar: slow push-ins, smootherstep glides 18-40 f, crossfades, 7-frame kicks.
import { W } from "./words";
import type { Expr } from "./toon";
export const FPS = 30;
export const TOTAL = Math.ceil((W.end + 0.45) * FPS);
export const D0 = 0; // ground level (build.ts houses stand here)
export const PIT_D = 10; // the casting pit is ten metres deep
export type V3 = [number, number, number];
export const KIT: V3 = [0, 400, 0];   // night kitchen (explanation), floating far above the town
export const PED: [number, number] = [-14, -18]; // the 1836 granite stand
export const FB1: [number, number] = [-14, 24], FB2: [number, number] = [14, 24]; // the 1600 and 1655 bells (flashback)
export const PED_TOP = 2.2;

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
export const L = 2 / FPS; // reactions land ~2 f before the word

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = {
  id: number; a: number; b: number; light: Light; crowd: string; sunAz?: number; sunEl?: number;
  /** wide scene shot: the subject is the place, not a character (check.ts skips the subject test) */ wide?: boolean; wideFrom?: number;
};
const S = (id: number, a: number, b: number, light: Light, crowd: string, more: Partial<ShotDef> = {}): ShotDef => ({ id, a: fr(a), b: fr(b), light, crowd, ...more });
export const SHOTS: ShotDef[] = [
  S(1, 0, W.because - 0.1, "day", "visitors", { wide: true }),                                  // hook: the silent bell on its stand
  S(2, W.because - 0.1, W.moscow - 0.12, "golden", "pourHook", { sunAz: 160, sunEl: 38 }),                 // ...because somebody tried to save it
  S(3, W.moscow - 0.12, W.empress - 0.12, "day", "", { wide: true }),           // Moscow 1735: the Kremlin, the casting house
  S(4, W.empress - 0.12, W.two - 0.12, "day", "empress"),                       // Empress Anna: the biggest!
  S(5, W.two - 0.12, W.heavy - 0.12, "day", "giraffe", { wide: true }),                  // 200 tons, taller than a giraffe
  S(6, W.heavy - 0.12, W.may - 0.12, "day", "crafts", { wideFrom: fr(W.ten) }), // cast in a pit ten metres deep (crane up)
  S(7, W.may - 0.12, W.scaffolding - 0.12, "golden", "fireCrowd", { sunAz: 150, sunEl: 12 }), // 1737: fire in the Kremlin
  S(8, W.scaffolding - 0.12, W.guards - 0.12, "golden", "flames", { wide: true, sunAz: 160, sunEl: 38 }), // the scaffolding burns, the bell gets hot
  S(9, W.guards - 0.12, W.crack - 0.12, "golden", "guards flames", { sunAz: 160, sunEl: 38 }),            // guards, buckets, pour
  S(10, W.crack - 0.12, W.luckily - 0.12, "golden", "steam", { wide: true, sunAz: 160, sunEl: 38 }),  // crack, eleven cracks, the chunk breaks off
  S(11, W.luckily - 0.12, W.unluckily - 0.12, "golden", "rimGuard", { sunAz: 160, sunEl: 40 }),            // luckily: still in its pit
  S(12, W.unluckily - 0.12, W.yousee - 0.12, "day", "", { wide: true }),        // unluckily: ninety-nine years (weeds)
  S(13, W.yousee - 0.12, W.ice - 0.12, "night", "", { wide: true }),            // hot grows, cold shrinks, outside vs inside
  S(14, W.ice - 0.12, W.eighteen - 0.12, "night", "kitchen"),                   // ice water in a hot glass dish
  S(15, W.eighteen - 0.12, W.stone - 0.12, "day", "crowd1836"),                 // 1836: lifted out
  S(16, W.stone - 0.12, W.heres - 0.12, "day", "visitors cheer", { wide: true }),               // on a stone stand, broken piece and all
  S(17, W.heres - 0.12, W.first - 0.12, "day", "visitors", { wide: true }),                     // the third Tsar Bell
  S(18, W.first - 0.12, W.survived - 0.12, "golden", "flash", { wide: true, sunAz: 150, sunEl: 12 }), // the first and second bells burn
  S(19, W.survived - 0.12, W.end + 0.45, "day", "visitors guardEnd"),           // survived the fire... it was the water that got it
];
SHOTS[SHOTS.length - 1].b = TOTAL;
export const XFADE: Record<number, number> = { 7: 8, 12: 8, 13: 8, 14: 8, 15: 8, 16: 6, 18: 8, 19: 8 };
export const FLASH_AT = SHOTS[2].a;

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
  place: "square" | "kitchen" | "flash";
  pit: boolean; shed: boolean; burnt: boolean; weeds: number; tripod: boolean; pedestal: boolean;
  bellPos: V3; bellYaw: number; cracks: number; glow: number; cold: number; innerGlow: number; fall: number; bellScale: number;
  detach?: [number, number, number];
  fire: number; firePos: V3; smoke: number;
  /** flashback bells: [dx, y, dz, tilt, glow] */ fb1: number[]; fb2: number[];
};
const PIT_BELL: V3 = [0, -PIT_D, 0];
const PED_BELL: V3 = [PED[0], PED_TOP, PED[1]];
const base = (): Scene => ({
  place: "square", pit: true, shed: true, burnt: false, weeds: 0, tripod: false, pedestal: false, bellPos: PIT_BELL, bellYaw: 0,
  cracks: 0, glow: 0, cold: 0, innerGlow: 0, fall: 0, bellScale: 1, fire: 0, firePos: [0, 6, 0], smoke: 0, fb1: [0, 5.4, 0, 0, 0], fb2: [0, 4.4, 0, 0, 0],
});
/** bell heat during the fire: rises from "flames", "really hot" peaks, the water knocks the outside down */
export const heat = (t: number) => lin([[W.scaffolding + 0.3, 0.0], [W.hot, 0.55], [W.really, 1.0], [W.pour + 0.6, 0.9], [W.crack + 0.2, 0.32], [W.off + 1.0, 0.2], [W.unluckily, 0.1]], t);
export const crackCount = (t: number) => t < W.crack - L ? 0 : t < W.another - L ? 1 : t < W.eleven - L ? 2 : Math.min(11, 3 + Math.floor((t - W.eleven + L) * 18));
export const pieceFall = (t: number) => {
  const u = clamp01((t - (W.chunk + 0.15)) / Math.max(0.3, W.off - W.chunk + 0.1));
  return u * u; // accelerating tip, lands on "off"
};
/** "then the guards pour": bucket state per guard */
export const pourAt = (t: number, i: number) => t > W.pour - L + i * 0.08;
export const sceneAt = (id: number, t: number): Scene => {
  const s = base();
  const atPed = () => { s.pit = false; s.shed = false; s.pedestal = true; s.bellPos = PED_BELL; s.bellYaw = 0; s.cracks = 11; s.detach = [2.4, PED_TOP, 0.22]; };
  switch (id) {
    case 1: case 16: case 17: case 19: atPed(); break;
    case 2: { // flash-forward of the pour (same state as shot 9 at the pour)
      const tt = W.pour + 0.25 + (t - SHOTS[1].a / FPS) * 0.6;
      s.shed = true; s.fire = 1; s.smoke = 1; s.glow = 1.0; s.cracks = 0; void tt; break;
    }
    case 5: s.bellPos = [20, 0, 10]; break; // a side-by-side on the square: the bell next to a giraffe
    case 3: case 4: case 6: break;
    case 7: s.fire = smooth((t - W.fire + 0.2) / 1.0); s.smoke = s.fire; break;
    case 8: case 9: case 10: case 11:
      s.fire = id === 11 ? 0.35 : 1; s.smoke = 1; s.glow = heat(t); s.cracks = crackCount(t); s.fall = id >= 10 ? pieceFall(t) : 0;
      s.innerGlow = s.glow; s.shed = id <= 10; s.burnt = id === 11; break;
    case 12: s.shed = false; s.burnt = true; s.cracks = 11; s.fall = 1; s.weeds = smooth((t - W.unluckily - 0.3) / Math.max(1, W.yousee - W.unluckily - 0.6)); break;
    case 13: {
      s.shed = false; s.burnt = true; s.weeds = 0; s.cracks = 11; s.fall = 1;
      // hot: glows and swells; cold: blue and shrinks; then cold water: outside cold, inside still glowing
      const hot = lin([[W.yousee, 0.15], [W.grows - 0.2, 1.0], [W.shrinks - 0.2, 1.0], [W.shrinks + 0.4, 0.0]], t);
      const pour = t > W.shrank - 0.2;
      s.glow = pour ? 1.0 : hot; s.innerGlow = pour ? 1.0 : hot;
      s.cold = pour ? smooth((t - W.shrank + 0.2) / 0.6) : lin([[W.shrinks - 0.1, 0], [W.shrinks + 0.4, 1.0]], t) * (t < W.shrank - 0.2 ? 1 : 0);
      s.bellScale = pour ? 1.0 : 1 + 0.045 * hot - 0.03 * (1 - hot) * (t > W.shrinks ? 1 : 0);
      break;
    }
    case 14: s.place = "kitchen"; break;
    case 15: {
      s.shed = false; s.tripod = true; s.cracks = 11; s.fall = 1;
      const u = smooth((t - W.lifted + 0.4) / Math.max(1.2, W.stone - W.lifted - 0.2));
      s.bellPos = [0, -5.5 + u * 6.3, 0];
      break;
    }
    case 18: {
      s.place = "flash"; s.pit = false; s.shed = false; s.fire = 1; s.smoke = 1;
      const f1 = smooth((t - W.first - 1.0) / 0.45), f2 = smooth((t - W.second - 0.35) / 0.45);
      s.fb1 = [f1 * 0.6, 5.4 - f1 * 5.4, f1 * 0.4, f1 * 0.9, 0.6];
      s.fb2 = [-f2 * 0.5, 4.4 - f2 * 4.4, 0, f2 * 0.5, 0.6];
      s.firePos = t < W.second - 0.3 ? [FB1[0], 6, FB1[1]] : [FB2[0], 6, FB2[1]];
      break;
    }
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
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const a = (id: number) => SHOTS[id - 1].a;
const at = (s: number) => fr(s);
const P = (dx: number, y: number, dz: number): V3 => [PED[0] + dx, y, PED[1] + dz];
const K3 = (dx: number, y: number, dz: number): V3 => [KIT[0] + dx, KIT[1] + y, KIT[2] + dz];

const CAMS: Record<number, Key[]> = {
  // hook: low at the stand, the bell and its broken piece fill the frame
  1: [{ f: 0, s: (f) => dolly(P(5.0, 1.5, 15.5), P(0.8, 3.6, 0), pushK(f, 0, 0.0035, 0.007, 40), { fov: 46, roll: 0.03 }) }],
  // guards pour onto the glowing bell, seen across the pit from the back platform
  2: [{ f: a(2), s: (f) => dolly([-1.6, -0.8, -5.9], [0.2, -5.0, 2.4], pushK(f, a(2), 0.003, 0.006, 30), { fov: 60, roll: -0.04 }) }],
  // Moscow 1735: aerial over the walls, gliding toward the casting house
  3: [
    { f: a(3), s: (f) => dolly([70, 62, 120], [-2, 6, -12], pushK(f, a(3), 0.002), { fov: 44 }) },
    { f: a(3) + 16, dur: 34, s: (f) => dolly([46, 38, 82], [-2, 4, -8], pushK(f, a(3) + 50, 0.0025), { fov: 44, roll: 0.03 }) },
  ],
  // the Empress at the pit, casting house behind her
  4: [
    { f: a(4), s: (f) => dolly([1.6, 1.9, 19.5], [-1.0, 1.7, 11.2], pushK(f, a(4), 0.0025), { fov: 42 }) },
    { f: at(W.biggest2) - 8, dur: 18, s: (f) => dolly([0.4, 1.8, 16.4], [-1.2, 1.85, 11.2], pushK(f, at(W.biggest2) + 10, 0.003), { fov: 40, roll: -0.05 }) },
  ],
  // inside the pit, under the platform: the bell, then the giraffe beside it
  5: [
    { f: a(5), s: (f) => dolly([20.5, 1.6, 30], [20.5, 3.6, 10], pushK(f, a(5), 0.0025), { fov: 46 }) },
    { f: at(W.giraffe) - 14, dur: 26, s: (f) => dolly([22.8, 1.5, 31], [22.6, 3.5, 10.4], pushK(f, at(W.giraffe) + 12, 0.0025), { fov: 46, roll: 0.03 }) },
  ],
  // crane straight up the open corner of the pit: floor -> rim, ten metres
  6: [
    { f: a(6), s: (f) => ({ pos: [3.7, -8.4, 3.75], look: [0, -6.0, 0], fov: 60 }) },
    { f: at(W.pit) - 6, dur: Math.max(40, at(W.deep) - at(W.pit) + 10), s: (f) => dolly([3.7, 3.6, 3.75], [0, -9.5, 0], pushK(f, at(W.deep) + 4, 0.002), { fov: 60, roll: 0.02 }) },
  ],
  // May 1737: the crowd on the square, the casting house catching fire behind them
  7: [
    { f: a(7), s: (f) => dolly([-6, 2.4, 30], [0, 5, 2], pushK(f, a(7), 0.0025), { fov: 44 }) },
    { f: at(W.fire) - 6, dur: 24, s: (f) => dolly([-4.5, 2.1, 25.5], [0, 6, 2], pushK(f, at(W.fire) + 18, 0.003), { fov: 44, roll: 0.04 }) },
  ],
  // in the pit: the burning scaffold above, the bell starting to glow
  8: [
    { f: a(8), s: (f) => dolly([2.2, -9.0, 6.4], [0, -3.2, 0], pushK(f, a(8), 0.002), { fov: 58 }) },
    { f: at(W.hot) - 10, dur: 22, s: (f) => dolly([3.4, -8.4, 6.2], [0, -5.8, 0], pushK(f, at(W.really) - 2, 0.003, 0.008, 30), { fov: 60, roll: -0.04 }) },
  ],
  // the guards on the front platform with their buckets
  9: [
    { f: a(9), s: (f) => dolly([-1.8, -0.9, -5.9], [0.2, -4.6, 2.6], pushK(f, a(9), 0.0025), { fov: 60 }) },
    { f: at(W.pour) - 12, dur: 22, s: (f) => dolly([-1.2, -1.2, -5.8], [0.2, -5.0, 2.4], pushK(f, at(W.pour) + 10, 0.003), { fov: 60, roll: 0.04 }) },
  ],
  // the cracks run up the lip, the chunk tips out
  10: [
    { f: a(10), s: (f) => dolly([3.0, -5.8, 6.6], [0.8, -7.6, 1.2], pushK(f, a(10), 0.003, 0.008, 30), { fov: 60 }) },
    { f: at(W.eleven) - 8, dur: 20, s: (f) => dolly([2.4, -6.2, 6.6], [1.2, -8.6, 2.2], pushK(f, at(W.chunk), 0.0025), { fov: 60, roll: -0.04 }) },
  ],
  // luckily: a guard at the rim looks down at the bell sitting in its pit
  11: [{ f: a(11), s: (f) => dolly([1.9, 2.9, 11.6], [0, -8, 0.4], pushK(f, a(11), 0.0025), { fov: 52 }) }],
  // ninety-nine years: straight down into the pit, the weeds growing
  12: [
    { f: a(12), s: (f) => dolly([0.6, 16, 9.5], [0, -9, 0.3], pushK(f, a(12), 0.002), { fov: 50 }) },
    { f: at(W.ninety) - 8, dur: 30, s: (f) => dolly([0.4, 12, 7.0], [0, -9, 0.3], pushK(f, at(W.ninety) + 22, 0.002), { fov: 50, roll: 0.03 }) },
  ],
  // night: the bell glowing, swelling, cooling; then under the lip: cold outside, hot inside
  13: [
    { f: a(13), s: (f) => dolly([3.2, 1.6, 6.2], [0, -7.0, 0], pushK(f, a(13), 0.0022), { fov: 58 }) },
    { f: at(W.shrank) - 10, dur: 26, s: (f) => dolly([3.4, -8.2, 6.2], [1.4, -8.6, 2.2], pushK(f, at(W.shrank) + 16, 0.0025), { fov: 58, roll: -0.03 }) },
  ],
  // the kitchen table: ice water into a hot glass dish
  14: [
    { f: a(14), s: (f) => dolly(K3(0.4, 1.7, 2.4), K3(-0.25, 1.3, -0.9), pushK(f, a(14), 0.0025), { fov: 46 }) },
    { f: at(W.something) - 8, dur: 20, s: (f) => dolly(K3(0.4, 1.5, 1.5), K3(0.15, 1.1, -0.75), pushK(f, at(W.give), 0.003, 0.008, 30), { fov: 44, roll: 0.04 }) },
  ],
  // 1836: the bell comes up out of the pit on the tripod
  15: [
    { f: a(15), s: (f) => dolly([13, 4.8, 27], [0, 2.5, 0], pushK(f, a(15), 0.0022), { fov: 50 }) },
    { f: at(W.lifted) - 6, dur: 40, s: (f) => dolly([10, 3.0, 22], [0, 4.0, 0], pushK(f, at(W.lifted) + 34, 0.002), { fov: 50, roll: 0.03 }) },
  ],
  // the stand: broken piece and all
  16: [
    { f: a(16), s: (f) => dolly(P(7.5, 2.6, 17), P(0.8, 3.2, 0), pushK(f, a(16), 0.0025), { fov: 46 }) },
    { f: at(W.broken) - 8, dur: 22, s: (f) => dolly(P(6.0, 1.6, 12.5), P(2.0, 1.4, 3.8), pushK(f, at(W.broken) + 14, 0.003), { fov: 44, roll: -0.04 }) },
  ],
  // the third Tsar Bell
  17: [{ f: a(17), s: (f) => dolly(P(-4.5, 2.2, 13.5), P(0, 4.6, 0), pushK(f, a(17), 0.0035, 0.006, 30), { fov: 46, roll: 0.03 }) }],
  // flashback: the first bell's belfry burns and the bell falls; glide right: the second one too
  18: [
    { f: a(18), s: (f) => dolly([FB1[0] + 6, 4.2, FB1[1] + 15], [FB1[0], 4.6, FB1[1]], pushK(f, a(18), 0.0025), { fov: 46 }) },
    { f: at(W.second) - 12, dur: 22, s: (f) => dolly([FB2[0] - 5, 4.2, FB2[1] + 16], [FB2[0], 4.4, FB2[1]], pushK(f, at(W.second) + 10, 0.003), { fov: 46, roll: -0.03 }) },
  ],
  // survived the fire... it was the water: the guard and his bucket by the stand
  19: [
    { f: a(19), s: (f) => dolly(P(-2.5, 2.4, 15), P(0.5, 4.0, 0), pushK(f, a(19), 0.0025), { fov: 46 }) },
    { f: at(W.water2) - 16, dur: 26, s: (f) => dolly(P(8.4, 1.8, 9.6), P(5.4, 1.5, 2.0), pushK(f, at(W.water2) + 10, 0.003, 0.006, 30), { fov: 42, roll: 0.04 }) },
  ],
};

const KICKS: [number, number][] = [[W.biggest2, 0.6], [W.crack, 1.0], [W.another, 0.8], [W.eleven, 0.7], [W.off, 1.2], [W.give, 1.0], [W.first + 1.4, 0.8], [W.second + 0.75, 0.8]];
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
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const sa = (id: number) => SHOTS[id - 1].a;
export const DOF: Dof[] = [
  { f: 0, cInf: 10 }, { f: sa(2), cInf: 9 }, { f: sa(3), cInf: 0 }, { f: sa(4), cInf: 13 }, { f: sa(5), cInf: 7 }, { f: sa(6), cInf: 0 },
  { f: sa(7), cInf: 5, focus: () => [0, 1.5, 16] }, { f: sa(8), cInf: 0 }, { f: sa(9), cInf: 8 }, { f: sa(10), cInf: 12 }, { f: sa(11), cInf: 7 }, { f: sa(12), cInf: 0 },
  { f: sa(13), cInf: 7 }, { f: sa(14), cInf: 12 }, { f: sa(15), cInf: 0 }, { f: sa(16), cInf: 9 }, { f: sa(17), cInf: 10 }, { f: sa(18), cInf: 0 },
  { f: sa(19), cInf: 9 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
export const moodOf = (e: Expr) => e;
export { W };
