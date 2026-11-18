// Timeline of the Hannibal short: shots timed to the voice (words.ts), the story state per shot (the column on the
// ledge, snow, the boulder's fire / glow / vinegar steam / cold skin / split, the zigzag path) and the camera grammar:
// creep -> punch -> creep, smootherstep glides 18-40 f, crossfades at place/time changes, 7-frame kicks.
import { W } from "./words";
import type { Expr } from "./toon";
import { ROCK, SUMMIT, pathY, pathZ, zigPoint, groundY } from "./alps";
export const FPS = 30;
export const TOTAL = Math.ceil((W.end + 0.45) * FPS);
export type V3 = [number, number, number];
export const D0 = 0;
export const KIT: V3 = [0, 600, 0]; // night room (Livy's study / the kitchen), floating far above the Alps
export const GROVE = -50;            // pines on the mountainside, chopped for the fire

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
/** a point on the ledge path: x along it, dy above the path, dz off its centre line (+ = drop side) */
export const P = (x: number, dy: number, dz: number): V3 => [x, pathY(x) + dy, pathZ(x) + dz];
export const RK = (dx: number, dy: number, dz: number): V3 => [ROCK[0] + dx, ROCK[1] + dy, ROCK[2] + dz];

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = {
  id: number; a: number; b: number; light: Light; crowd: string; sunAz?: number; sunEl?: number;
  /** wide scene shot: the subject is the place, not a character (check.ts skips the subject test) */ wide?: boolean; wideFrom?: number;
};
const S = (id: number, a: number, b: number, light: Light, crowd: string, more: Partial<ShotDef> = {}): ShotDef => ({ id, a: fr(a), b: fr(b), light, crowd, ...more });
const E = 0.1;
export const SHOTS: ShotDef[] = [
  S(1, 0, W.yousee1 - E, "night", "hookPour hannibalHook"),                   // hook: fire + vinegar on the rock, Hannibal grinning
  S(2, W.yousee1 - E, W.with37 - E, "day", "column", { wide: true }),          // 218 BC: the army on the mountainside
  S(3, W.with37 - E, W.q_elephants - E, "day", "column"),                      // ...with thirty-seven elephants
  S(4, W.q_elephants - E, W.soclimb - E, "day", "doubters column"),            // "Elephants? Over the Alps? In the snow?"
  S(5, W.soclimb - E, W.finally - E, "day", "column tribes"),                  // nine days, ambushes, rockslides, wind
  S(6, W.finally - E, W.then1 - E, "day", "summit"),                           // the top... and it starts to snow
  S(7, W.then1 - E, W.horses - E, "day", "edge", { wideFrom: fr(W.landslide) - 10 }), // the path ends: a landslide, a thousand feet
  S(8, W.horses - E, W.sohannibal - E, "day", "hungry"),                       // horses slip, elephants won't budge, nothing to eat
  S(9, W.sohannibal - E, W.fire1 - E, "night", "torch"),                       // what any sane general would do
  S(10, W.fire1 - E, W.his - E, "night", "blaze", { wide: true }),             // he sets the mountain on fire
  S(11, W.his - E, W.stack - E, "night", "chop"),                              // chop down giant trees
  S(12, W.stack - E, W.then2 - E, "night", "stack", { wideFrom: fr(W.glows) }),                           // stack, burn, red hot
  S(13, W.then2 - E, W.least - E, "night", "pour"),                            // pour vinegar all over it
  S(14, W.least - E, W.sohow - E, "night", "livy"),                            // at least, that's what Livy swears
  S(15, W.sohow - E, W.well - E, "night", "puzzled"),                          // so how does salad dressing beat a mountain?
  S(16, W.well - E, W.like - E, "night", "explain", { wide: true }),           // thermal shock: hot swells, cold skin shrinks
  S(17, W.like - E, W.sorock - E, "night", "kitchen", { wideFrom: fr(W.cold2) - 4 }),                       // cold water over a hot glass dish
  S(18, W.sorock - E, W.zigzag - E, "golden", "split", { sunAz: 150, sunEl: 10, wideFrom: fr(W.cracks) }), // the rock cracks apart
  S(19, W.zigzag - E, W.four - E, "golden", "descent", { wide: true, sunAz: 150, sunEl: 14 }),        // they carve a zigzag path
  S(20, W.four - E, W.elephants3 - E, "golden", "descent hannibalWalk", { sunAz: 170, sunEl: 14 }),       // four days later, down into Italy
  S(21, W.elephants3 - E, W.end + 0.45, "golden", "finale", { sunAz: 140, sunEl: 12 }), // Elephants. Over the Alps. In the snow!
];
SHOTS[SHOTS.length - 1].b = TOTAL;
export const XFADE: Record<number, number> = { 3: 8, 5: 8, 6: 10, 7: 8, 9: 10, 11: 8, 12: 6, 14: 8, 15: 8, 16: 8, 17: 8, 18: 10, 19: 10, 20: 8, 21: 8 };
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
  place: "alps" | "kitchen";
  /** rock: outer glow, inside glow, cold skin, split, swell, wet */ glow: number; core: number; cold: number; split: number; swell: number; wet: number;
  logs: number; char: number; ember: number; fire: number; steam: number; snow: number; zig: number; tree: number;
};
const base = (): Scene => ({ place: "alps", glow: 0, core: 0, cold: 0, split: 0, swell: 1, wet: 0, logs: 0, char: 0, ember: 0, fire: 0, steam: 0, snow: 0, zig: 0, tree: 0 });
/** the rock's heat over the fire beats */
const heat = (t: number) => lin([[W.burn, 0], [W.glows, 0.6], [W.red + 0.3, 1.0]], t);
export const sceneAt = (id: number, t: number): Scene => {
  const s = base();
  const burnt = () => { s.logs = 1; s.char = 1; s.ember = 0.6; };
  switch (id) {
    case 1: burnt(); s.fire = 0.8; s.glow = 0.9; s.core = 0.6; s.steam = 1; s.wet = 0.6; s.snow = 0.5; break;
    case 2: case 3: case 4: break;
    case 5: s.snow = lin([[W.wind - 0.2, 0], [W.wind + 0.3, 0.35]], t); break;
    case 6: s.snow = lin([[W.snow1 - 0.25, 0], [W.snow1 + 0.6, 1]], t); break;
    case 7: case 8: s.snow = 1; break;
    case 9: s.snow = 0.5; s.logs = 1; s.fire = lin([[W.fire1 - 0.4, 0], [W.fire1, 0.4]], t); break;
    case 10: s.snow = 0.5; s.logs = 1; s.fire = lin([[W.fire1 - 0.1, 0.4], [W.fire1 + 0.4, 1]], t); s.char = 0.3; s.glow = 0.3; break;
    case 11: s.snow = 0.4; s.tree = lin([[W.trees - 0.3, 0], [W.trees + 0.6, 1]], t); break;
    case 12:
      s.snow = 0.4; s.logs = lin([[W.stack - 0.2, 0.15], [W.stack + 0.5, 1]], t); s.fire = lin([[W.burn - 0.25, 0], [W.burn + 0.3, 1]], t);
      s.char = lin([[W.burn, 0], [W.red + 0.6, 0.7]], t); s.glow = heat(t); s.core = heat(t) * 0.5; break;
    case 13: {
      s.snow = 0.4; s.logs = 1; s.char = 0.8; s.ember = 0.5; const p = clamp01((t - W.pour + L) / 0.4);
      s.fire = 1 - 0.5 * p; s.glow = 1 - 0.35 * p; s.core = 0.7; s.steam = p; s.wet = p * 0.7; break;
    }
    case 14: s.place = "kitchen"; break;
    case 15: burnt(); s.snow = 0.4; s.fire = 0.3; s.glow = 0.55; s.core = 0.7; s.steam = 0.8; s.wet = 0.7; break;
    case 16: {
      burnt(); s.ember = 0.3; s.fire = 0;
      // hot: glows and swells; the cold splash: the skin goes blue and shrinks, the inside still glows through the seams
      const hot = lin([[W.well, 0.3], [W.hot, 0.8], [W.swells, 1.0]], t), splash = t > W.splash - L;
      const k = smooth((t - W.cold + 0.1) / 0.5);
      s.glow = splash ? hot * (1 - k) : hot; s.core = splash ? 1 : hot * 0.8;
      s.cold = splash ? k : 0; s.wet = splash ? k : 0; s.steam = splash ? 0.6 * k : 0;
      s.swell = 1 + 0.06 * hot * (splash ? 1 - 0.7 * smooth((t - W.shrinks + 0.1) / 0.5) : smooth((t - W.swells + 0.1) / 0.5));
      break;
    }
    case 17: s.place = "kitchen"; break;
    case 18: burnt(); s.ember = 0; s.cold = 0.6; s.core = lin([[W.cracks - 0.3, 0.6], [W.cracks + 0.4, 0]], t); s.split = clamp01((t - W.cracks + L) / 0.9); s.snow = 0.25; break;
    case 19: s.split = 1; s.logs = 0; s.zig = lin([[W.zigzag - 0.1, 0.05], [W.four - 0.1, 1]], t); s.snow = 0.2; break;
    case 20: s.split = 1; s.zig = 1; s.snow = 0.2; break;
    case 21: s.split = 1; s.zig = 1; s.snow = lin([[W.insnow - 0.3, 0.3], [W.insnow + 0.2, 1]], t); break;
  }
  return s;
};

// ---------------- the column on the march ----------------
/** who walks where: slot i of the column; elephants every 6th slot (one per slot, wider spacing) */
export const isEleph = (i: number) => i % 6 === 3;
export const columnX = (t: number, x0: number, i: number, v = 1.15) => x0 + v * t - i * 2.4 - Math.floor((i + 3) / 6) * 3.6;

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
const K3 = (dx: number, y: number, dz: number): V3 => [KIT[0] + dx, KIT[1] + y, KIT[2] + dz];
const add = (p: V3, dx: number, dy: number, dz: number): V3 => [p[0] + dx, p[1] + dy, p[2] + dz];
/** column members in shot 3 pass the lens here */
export const C3X = -100;
const zp = (u: number, dy = 0) => add(zigPoint(u), 0, dy, 0);
const SX = SUMMIT[0];

const CAMS: Record<number, Key[]> = {
  // hook: across the fire, Hannibal in front, soldiers pouring jars on the glowing rock
  1: [{ f: 0, s: (f) => dolly(P(7.5, 2.0, 9.5), RK(-4, 2.4, -0.6), pushK(f, 0, 0.004, 0.009, 40), { fov: 46, roll: 0.04 }) }],
  // 218 BC: high over the drop, the tiny column on the ledge, the peaks behind
  2: [
    { f: a(2), s: (f) => dolly(P(-60, 40, 120), P(-125, 40, -60), pushK(f, a(2), 0.003), { fov: 50 }) },
    { f: at(W.alps1) - 8, dur: 30, s: (f) => dolly(P(-40, 60, 150), P(-140, 80, -180), pushK(f, at(W.alps1) + 22, 0.0025), { fov: 54, roll: -0.03 }) },
  ],
  // with thirty-seven elephants: low at the edge, elephants file past
  3: [
    { f: a(3), s: (f) => dolly(P(C3X + 6, 1.4, 10), P(C3X, 2.2, 0), pushK(f, a(3), 0.003), { fov: 46 }) },
    { f: at(W.elephants1) - 6, dur: 12, s: (f) => dolly(P(C3X + 3.5, 1.5, 7.5), P(C3X, 2.3, 0), pushK(f, at(W.elephants1) + 6, 0.003), { fov: 44, roll: 0.03 }) },
  ],
  // the doubters: two soldiers, an elephant behind them; a punch per question
  4: [
    { f: a(4), s: (f) => dolly(P(-121, 1.75, 6.5), P(-120.3, 1.65, 1.0), pushK(f, a(4), 0.003, 0.008, 12), { fov: 42 }) },
    { f: at(W.q_alps) - 4, dur: 10, s: (f) => dolly(P(-121.8, 1.8, 5.4), P(-121.0, 1.7, 1.1), pushK(f, at(W.q_alps) + 6, 0.003), { fov: 40, roll: -0.04 }) },
    { f: at(W.q_snow) - 4, dur: 10, s: (f) => dolly(P(-119.4, 1.7, 4.6), P(-119.3, 1.7, 1.0), pushK(f, at(W.q_snow) + 6, 0.004), { fov: 38, roll: 0.05 }) },
  ],
  // the climb: low behind the column looking up the path, the ridge with the ambushers, wind
  5: [
    { f: a(5), s: (f) => dolly(P(-322, 1.4, 5), P(-296, 5, 0), pushK(f, a(5), 0.003, 0.008, 14), { fov: 46, roll: 0.08 }) },
    { f: at(W.ambushes) - 8, dur: 14, s: (f) => dolly(P(-306, 3.0, 7), P(-298, 14, -14), pushK(f, at(W.ambushes) + 6, 0.003), { fov: 48, roll: -0.06 }) },
    { f: at(W.rockslides) - 6, dur: 12, s: (f) => dolly(P(-303, 2.2, 7.5), P(-296, 3, -2), pushK(f, at(W.rockslides) + 6, 0.004), { fov: 46, roll: 0.1 }) },
    { f: at(W.wind) - 6, dur: 14, s: (f) => dolly(P(-300, 1.8, 6.5), P(-292, 2.2, 0), pushK(f, at(W.wind) + 8, 0.003), { fov: 44, roll: -0.12 }) },
  ],
  // the top: the army cheers on the saddle; it starts to snow
  6: [
    { f: a(6), s: (f) => dolly(P(SX + 9, 1.7, 7), P(SX - 1, 1.9, 0), pushK(f, a(6), 0.003), { fov: 46 }) },
    { f: at(W.snow1) - 8, dur: 20, s: (f) => dolly(P(SX + 4.5, 1.8, 4.5), P(SX - 0.5, 1.8, 0.4), pushK(f, at(W.snow1) + 12, 0.004), { fov: 42, roll: 0.04 }) },
  ],
  // the path just ends: behind the soldiers toward the rock and the gap; crane out over the scar
  7: [
    { f: a(7), s: (f) => dolly(P(4, 2.2, 1.2), P(26, 1.2, 0.5), pushK(f, a(7), 0.003, 0.007, 12), { fov: 46 }) },
    { f: at(W.ends) - 4, dur: 10, s: (f) => dolly(P(5.5, 2.3, 1.4), P(28, 0.8, 0.8), pushK(f, at(W.ends) + 6, 0.003), { fov: 44, roll: 0.04 }) },
    { f: at(W.landslide) - 10, dur: 34, s: (f) => dolly(P(-20, 22, 45), P(60, 0, 0), pushK(f, at(W.landslide) + 24, 0.002), { fov: 55 }) },
    { f: at(W.thousand) - 6, dur: 14, s: (f) => dolly(P(-5, 18, 38), P(80, -4, 0), pushK(f, at(W.thousand) + 8, 0.004), { fov: 52, roll: -0.04 }) },
  ],
  // horses slip, elephants won't budge, nothing to eat but snow
  8: [
    { f: a(8), s: (f) => dolly(P(10.5, 1.5, 7.5), P(8, 1.0, 2.4), pushK(f, a(8), 0.003, 0.009, 12), { fov: 44, roll: -0.1 }) },
    { f: at(W.elephants2) - 6, dur: 12, s: (f) => dolly(P(-0.5, 2.0, 9.5), P(3.5, 2.2, 0.4), pushK(f, at(W.elephants2) + 6, 0.003), { fov: 44 }) },
    { f: at(W.nothing) - 6, dur: 12, s: (f) => dolly(P(11, 1.75, 2.0), P(10.6, 1.55, -1.5), pushK(f, at(W.nothing) + 6, 0.004), { fov: 40, roll: 0.03 }) },
  ],
  // what any sane general would do: Hannibal close-up, deadpan, then a grin
  9: [
    { f: a(9), s: (f) => dolly(P(13.2, 1.8, 4.6), P(12.6, 1.95, 1.4), pushK(f, a(9), 0.003, 0.008, 12), { fov: 40 }) },
    { f: at(W.sets) - 6, dur: 10, s: (f) => dolly(P(13.0, 1.95, 3.2), P(12.6, 2.0, 1.4), pushK(f, at(W.sets) + 4, 0.004), { fov: 38, roll: 0.05 }) },
  ],
  // he sets the mountain on fire: the blaze against the rock
  10: [{ f: a(10), s: (f) => dolly(P(8, 3, 9.5), RK(-2, 2.5, 0), pushK(f, a(10), 0.004, 0.012, 14), { fov: 48, roll: -0.04 }) }],
  // chop down giant trees: the pine grove above the path
  11: [
    { f: a(11), s: (f) => dolly(P(GROVE - 1, 1.9, 0.8), P(GROVE, 2.2, -4.5), pushK(f, a(11), 0.003, 0.008, 12), { fov: 46 }) },
    { f: at(W.trees) - 6, dur: 16, s: (f) => dolly(P(GROVE - 5, 2.6, 2.5), P(GROVE + 3, 4, -8), pushK(f, at(W.trees) + 10, 0.003), { fov: 50, roll: 0.06 }) },
  ],
  // stack them against the rock, burn them, red hot
  12: [
    { f: a(12), s: (f) => dolly(P(8.5, 2.6, 8), RK(-2.5, 2.4, 0), pushK(f, a(12), 0.003), { fov: 46 }) },
    { f: at(W.burn) - 6, dur: 12, s: (f) => dolly(P(10.5, 2.2, 6.6), RK(-2, 2.6, 0), pushK(f, at(W.burn) + 6, 0.003), { fov: 44, roll: -0.04 }) },
    { f: at(W.glows) - 6, dur: 14, s: (f) => dolly(P(13, 3.0, 5.6), RK(0, 3.0, 0), pushK(f, at(W.glows) + 8, 0.004, 0.01, 14), { fov: 40, roll: 0.03 }) },
  ],
  // pour vinegar all over it: steam everywhere
  13: [
    { f: a(13), s: (f) => dolly(P(9.5, 2.0, 7), RK(-3.5, 2.0, 0), pushK(f, a(13), 0.003, 0.009, 12), { fov: 46 }) },
    { f: at(W.vinegar2) - 6, dur: 10, s: (f) => dolly(P(12, 2.3, 5.4), RK(-2.5, 2.6, 0), pushK(f, at(W.vinegar2) + 4, 0.004), { fov: 44, roll: 0.06 }) },
  ],
  // Livy at his desk, swearing it's true
  14: [
    { f: a(14), s: (f) => dolly(K3(0.6, 1.75, 2.6), K3(-0.2, 1.55, -1.2), pushK(f, a(14), 0.003), { fov: 40 }) },
    { f: at(W.swears) - 6, dur: 10, s: (f) => dolly(K3(0.3, 1.8, 1.4), K3(-0.25, 1.75, -1.2), pushK(f, at(W.swears) + 4, 0.004), { fov: 38, roll: 0.04 }) },
  ],
  // so how does salad dressing beat a mountain?
  15: [{ f: a(15), s: (f) => dolly(P(10.6, 1.8, 6.2), P(13.6, 1.75, 1.2), pushK(f, a(15), 0.003, 0.008, 14), { fov: 42, roll: -0.03 }) }],
  // thermal shock: the rock alone, glow, swell, splash, cold skin
  16: [
    { f: a(16), s: (f) => dolly(P(7, 5, 13), RK(0, 2.8, 0), pushK(f, a(16), 0.003), { fov: 46 }) },
    { f: at(W.hot) - 8, dur: 16, s: (f) => dolly(P(9, 3.5, 9.5), RK(0, 2.8, 0), pushK(f, at(W.hot) + 8, 0.004), { fov: 44, roll: 0.03 }) },
    { f: at(W.splash) - 6, dur: 10, s: (f) => dolly(P(11, 3.0, 8), RK(0, 3.0, 0), pushK(f, at(W.splash) + 4, 0.003), { fov: 44, roll: -0.04 }) },
    { f: at(W.inside) - 8, dur: 14, s: (f) => dolly(P(15, 3.4, 6.4), RK(0.5, 3.2, 0), pushK(f, at(W.inside) + 6, 0.005), { fov: 40 }) },
  ],
  // kitchen: cold water over the hot dish -> crack
  17: [
    { f: a(17), s: (f) => dolly(K3(0.4, 1.7, 2.4), K3(-0.25, 1.3, -0.9), pushK(f, a(17), 0.0025), { fov: 46 }) },
    { f: at(W.cold2) - 4, dur: 20, s: (f) => dolly(K3(0.4, 1.5, 1.5), K3(0.15, 1.1, -0.75), pushK(f, at(W.dish), 0.003, 0.008, 30), { fov: 44, roll: 0.04 }) },
  ],
  // the rock cracks apart at sunrise
  18: [{ f: a(18), s: (f) => dolly(P(8, 2.8, 9.5), RK(0, 2.6, 0.5), pushK(f, a(18), 0.003, 0.012, 14), { fov: 48, roll: 0.03 }) }],
  // the zigzag path being cut down the scar, from the air
  19: [
    { f: a(19), s: (f) => dolly([ROCK[0] + 50, 45, 150], [ROCK[0] + 45, -35, 45], pushK(f, a(19), 0.003), { fov: 56 }) },
  ],
  // four days later: walking down the zigzag with the elephants, green Italy below
  20: [
    { f: a(20), s: (f) => dolly(add(zp(0.3), -6, 6.5, -5), add(zp(0.3), 2, 1.2, 3), pushK(f, a(20), 0.003), { fov: 48 }) },
    { f: at(W.italy) - 8, dur: 24, s: (f) => dolly(add(zp(0.3), -6, 14, -6), add(zp(0.95), 0, -60, 60), pushK(f, at(W.italy) + 16, 0.003), { fov: 54, roll: -0.03 }) },
  ],
  // Elephants. Over the Alps. In the snow!
  21: [
    { f: a(21), s: (f) => dolly(add(zp(0.1), -4.5, 5.6, -5), add(zp(0.1), 0, 1.8, 0), pushK(f, a(21), 0.004, 0.01, 12), { fov: 42 }) },
    { f: at(W.over2) - 6, dur: 18, s: (f) => dolly(add(zp(0.1), -20, 40, -30), add(zp(0.1), 40, 20, 160), pushK(f, at(W.over2) + 12, 0.003), { fov: 54, roll: 0.03 }) },
    { f: at(W.insnow) - 6, dur: 14, s: (f) => dolly(add(zp(0.1), -4, 5.2, -4.6), add(zp(0.1), 0, 1.9, 0), pushK(f, TOTAL, 0.0035), { fov: 40, roll: -0.02 }) },
  ],
};

const KICKS: [number, number][] = [[W.bonfire, 0.5], [W.vinegar1, 0.8], [W.rockslides, 0.9], [W.ends, 0.6], [W.fire1, 1.0], [W.trees + 0.6, 0.7], [W.vinegar2, 0.8], [W.splash, 0.6],
  [W.dish + 0.2, 0.8], [W.cracks, 1.2]];
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
  { f: 0, cInf: 10 }, { f: sa(2), cInf: 0 }, { f: sa(3), cInf: 8 }, { f: sa(4), cInf: 13 }, { f: sa(5), cInf: 6 }, { f: sa(6), cInf: 9 },
  { f: sa(7), cInf: 3 }, { f: at(W.landslide), dur: 20, cInf: 0 }, { f: sa(8), cInf: 11 }, { f: sa(9), cInf: 14 }, { f: sa(10), cInf: 0 },
  { f: sa(11), cInf: 9 }, { f: sa(12), cInf: 8 }, { f: sa(13), cInf: 10 }, { f: sa(14), cInf: 13 }, { f: sa(15), cInf: 12 }, { f: sa(16), cInf: 0 },
  { f: sa(17), cInf: 14 }, { f: sa(18), cInf: 6 }, { f: sa(19), cInf: 0 }, { f: sa(20), cInf: 7 }, { f: sa(21), cInf: 11 }, { f: at(W.over2) - 6, dur: 12, cInf: 0 },
  { f: at(W.insnow) - 6, dur: 12, cInf: 11 },
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
export { W, groundY };
