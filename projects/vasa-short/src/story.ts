// Timeline of the Vasa short: shots timed to the voice (words.ts, from ~/vasa-short/voice/words.json), story physics
// (ship pose: position, heel, sink, sails; the stability-test run; the bus analogy) and the camera grammar from the
// reference study: continuous slow push-ins, smootherstep glides 18-40 f, crossfades at place changes, 7-frame kicks.
import * as THREE from "three";
import { W } from "./words";
import type { Expr, Prop } from "./toon";
export const FPS = 30;
export const TOTAL = Math.ceil((W.end + 0.45) * FPS);
export const D0 = 6.0; // quay top above the water (m)
export type V3 = [number, number, number];
export const BUS: V3 = [0, 400, 0];
const QD = 8.2, DQ = 5.2; // quarterdeck / main deck heights in ship space (ship.ts)

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + (y1 - y0) * smooth((x - x0) / (x1 - x0));
  }
  return pts[pts.length - 1][1];
};
const fr = (s: number) => Math.round(s * FPS);
const L = 2 / FPS; // reactions land ~2 f before the word

// ---------------- ship physics ----------------
export type ShipPose = { x: number; z: number; heel: number; sink: number; pitch: number; billow: number; set: number };
export const DOCK_Z = -21;
/** ship-space -> world: p' = Rz(pitch) Rx(heel) p + (x, -sink, z) */
export const toWorld = (P: ShipPose, p: V3): V3 => {
  const ch = Math.cos(P.heel), sh = Math.sin(P.heel), cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
  const y1 = p[1] * ch - p[2] * sh, z1 = p[1] * sh + p[2] * ch;
  const x2 = p[0] * cp - y1 * sp, y2 = p[0] * sp + y1 * cp;
  return [x2 + P.x, y2 - P.sink, z1 + P.z];
};
export const shipMatrix = (P: ShipPose) => new THREE.Matrix4()
  .makeTranslation(P.x, -P.sink, P.z)
  .multiply(new THREE.Matrix4().makeRotationZ(P.pitch))
  .multiply(new THREE.Matrix4().makeRotationX(P.heel));

/** the stability test: crew position across the deck (-1 port .. +1 starboard), null outside the test */
const RUNS: [number, number, number][] = [[W.once - 0.35, -1, 1], [W.twice - 0.35, 1, -1], [W.three - 0.35, -1, 1]];
export const runZ = (t: number): { z: number } | null => {
  if (t < W.problem || t > W.fix - 0.2) return null;
  let z = -smooth((t - W.thirty) / 1.2); // stand in rows, then line up along the port rail before the first run
  for (const [t0, a, b] of RUNS) if (t >= t0) z = a + (b - a) * smooth((t - t0) / 1.05);
  return { z };
};
const testHeel = (t: number) => {
  const amp = lin([[W.once - 0.4, 0.0], [W.once + 0.6, 0.07], [W.twice + 0.6, 0.15], [W.three + 0.6, 0.27], [W.stop + 0.4, 0.22], [W.fix + 1.5, 0.03]], t);
  const r = runZ(t);
  const z = r ? r.z : 1;
  const after = t > W.stop ? Math.cos((t - W.stop) * 2.6) * Math.exp(-(t - W.stop) * 0.7) : 1;
  return amp * z * after;
};
/** sailing day: speed along +x, a gust tips her, she rights, a second gust lays her over and she fills */
const sailX = (t: number) => 3.0 * Math.max(0, t - W.august + 1.5);
const sailHeel = (t: number) => lin([[W.tipped - 0.5, -0.03], [W.tipped + 0.25, -0.36], [W.cameback + 0.05, -0.36], [W.cameback + 0.85, -0.07],
  [W.second + 0.2, -0.08], [W.water - 0.05, -0.58], [W.twenty, -0.68], [W.gone, -0.8]], t) + 0.012 * Math.sin(t * 1.7);
const sailSink = (t: number) => lin([[W.water, 0], [W.twenty, 2.2], [W.thirteen, 5.5], [W.gone - 0.2, 16], [W.gone + 0.1, 70]], t);

export const shipPose = (id: number, t: number): ShipPose => {
  const s = SHOTS[id - 1];
  const docked: ShipPose = { x: 0, z: DOCK_Z, heel: 0.006 * Math.sin(t * 0.9), sink: 0, pitch: 0.003 * Math.sin(t * 0.7), billow: 0, set: 0 };
  switch (s.phase) {
    case "test": return { ...docked, heel: testHeel(t) };
    case "sail": {
      const tt = s.tau ? s.tau(t) : t;
      return { x: sailX(tt), z: DOCK_Z + 24 * smooth((tt - W.august) / 8), heel: sailHeel(tt), sink: sailSink(tt), pitch: lin([[W.water, 0], [W.gone, -0.12]], tt),
        billow: lin([[W.breeze - 0.3, 0.25], [W.breeze + 0.6, 1.0], [W.cameback, 0.55], [W.second, 1.0]], tt), set: 1 };
    }
    case "night": return { ...docked, heel: 0.05 * Math.sin((t - W.vasa2) * 2.2) * smooth((t - W.vasa2) / 0.5) };
    case "raise": return { ...docked, heel: 0, sink: lin([[W.pulled - 0.2, 13], [W.pulled + 1.9, 0]], t) };
    case "gone": return { ...docked, sink: 99 };
    default: return docked;
  }
};

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type ShotDef = {
  id: number; a: number; b: number; light: Light; crowd: string; phase: "dock" | "test" | "sail" | "night" | "raise" | "gone";
  tau?: (t: number) => number; mood?: (t: number, i: number) => Expr; sunAz?: number; sunEl?: number;
  /** wide scene shot: the subject is the place/ship, not a character (check.ts skips the subject test); wideFrom = from that frame on */ wide?: boolean; wideFrom?: number;
};
const S = (id: number, a: number, b: number, light: Light, crowd: string, phase: ShotDef["phase"], more: Partial<ShotDef> = {}): ShotDef => ({ id, a: fr(a), b: fr(b), light, crowd, phase, ...more });
const happy = (_t: number, i: number): Expr => (["smile", "grin", "smile_closed", "neutral"] as Expr[])[i % 4];
const testMood = (t: number, i: number): Expr => t < W.once - L ? "neutral" : t < W.three - L ? (i % 3 ? "grin" : "laugh") : t < W.stop - L ? "nervous" : "shock";
const sinkMood = (t: number, i: number): Expr => t < W.tipped - L ? happy(t, i) : t < W.cameback + 0.6 ? "shock" : t < W.second - L ? "nervous" : "shock";
const HOOK_T0 = W.water + 0.4;
export const SHOTS: ShotDef[] = [
  S(1, 0, W.stockholm - 0.1, "golden", "deck pour", "sail", { tau: (t) => HOOK_T0 + t * 0.32, mood: () => "shock", wide: true }),
  S(2, W.stockholm - 0.1, W.king - 0.1, "day", "royals", "dock", { wide: true }),
  S(3, W.king - 0.1, W.so - 0.08, "day", "royals", "dock"),
  S(4, W.so - 0.08, W.sixty - 0.1, "day", "deck", "dock", { mood: happy }),
  S(5, W.sixty - 0.1, W.golden - 0.1, "day", "none", "dock"),
  S(6, W.golden - 0.1, W.problem - 0.1, "day", "none", "dock"),
  S(7, W.problem - 0.1, W.once - 0.45, "day", "deck admiral", "test", { mood: testMood }),
  S(8, W.once - 0.45, W.stop - 0.1, "day", "deck admiral", "test", { mood: testMood }),
  S(9, W.stop - 0.1, W.fix - 0.1, "day", "deck admiral", "test", { mood: testMood }),
  S(10, W.fix - 0.1, W.nobody - 0.1, "day", "deck admiral", "dock", { mood: () => "nervous" }),
  S(11, W.nobody - 0.1, W.august - 0.12, "day", "royals", "dock"),
  S(12, W.august - 0.12, W.breeze - 0.12, "golden", "cheer", "sail", { mood: happy, sunAz: 155, sunEl: 12 }),
  S(13, W.breeze - 0.12, W.second - 0.12, "golden", "deck", "sail", { mood: sinkMood }),
  S(14, W.second - 0.12, W.twenty - 0.12, "golden", "deck pour", "sail", { mood: sinkMood }),
  S(15, W.twenty - 0.12, W.lucky - 0.12, "golden", "deck wreck", "sail", { mood: () => "shock", wide: true }),
  S(16, W.lucky - 0.12, W.unlucky - 0.12, "golden", "survivors", "gone", { sunAz: 140, sunEl: 14 }),
  S(17, W.unlucky - 0.12, W.yousee - 0.12, "golden", "shock", "gone", { sunAz: 155, sunEl: 12 }),
  S(18, W.yousee - 0.12, W.vasa2 - 0.12, "night", "bus", "gone"),
  S(19, W.vasa2 - 0.12, W.inquiry - 0.12, "night", "deck", "night", { mood: () => "neutral" }),
  S(20, W.inquiry - 0.12, W.but - 0.12, "night", "inquiry", "gone"),
  S(21, W.but - 0.12, W.million - 0.12, "day", "", "raise"),
  S(22, W.million - 0.12, W.end + 0.45, "day", "tourists", "dock", { wideFrom: fr(W.still) - 20 }),
];
SHOTS[SHOTS.length - 1].b = TOTAL;
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 4: 6, 7: 8, 11: 6, 12: 8, 16: 8, 18: 8, 19: 8, 20: 8, 21: 8, 22: 8 };
export const FLASH_AT = SHOTS[1].a;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- characters' beats ----------------
export const CREW: [number, number, number][] = Array.from({ length: 30 }, (_, i) => {
  const h = (k: number) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  return [-11 + (i % 10) * 2.5 + (h(1) - 0.5) * 0.8, (Math.floor(i / 10) - 1) * 1.6 + (h(2) - 0.5) * 0.6, h(3)];
});
export const admiralAt = (t: number): { expr: Expr; prop: Prop; look: number; yell?: number } => {
  if (t < W.once - L) return { expr: "stern", prop: null, look: 0 };
  if (t < W.three - L) return { expr: "neutral", prop: null, look: 1 };
  if (t < W.stop - L) return { expr: "nervous", prop: null, look: 0 };
  if (t < W.fix - L) return { expr: "shock", prop: "armsUp", look: 0, yell: W.stop };
  if (t < W.nope - L) return { expr: "nervous", prop: null, look: -1 };
  return { expr: "nervous", prop: "shrug", look: 0 };
};
export const busState = (t: number) => {
  const up = t >= W.over - L;
  const bump = t > W.bump ? Math.exp(-(t - W.bump) * 4) * Math.sin((t - W.bump) * 18) : 0;
  const fall = smooth((t - W.turn - 0.15) / 0.55);
  const tilt = up ? lin([[W.over, 0], [W.turn, 5], [W.turn + 0.3, 40]], t) : 4 * bump;
  const expr: Expr = t < W.over - L ? "smile" : t < W.turn - L ? "nervous" : "shock";
  return { up, fall, tilt, expr, x: 1.0 * fall, y: 0 };
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
const T = (f: number) => f / FPS;
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
/** offset from the ship's position (not its heel): the lens follows a sailing ship without rolling with it */
const sp = (id: number, f: number) => shipPose(id, T(f));
const rel = (id: number, f: number, p: V3): V3 => { const P = sp(id, f); return [P.x + p[0], p[1], P.z + p[2]]; };
const onDeck = (id: number, f: number, p: V3): V3 => toWorld(sp(id, f), p);
const a = (id: number) => SHOTS[id - 1].a;
const at = (s: number) => fr(s);

const CAMS: Record<number, Key[]> = {
  // hook: flash-forward, low over the water by the quay: the heeled ship fills the frame, then down onto the drowning ports
  1: [
    { f: 0, s: (f) => dolly(rel(1, f, [95, 5, -20]), rel(1, f, [0, 6, -6]), pushK(f, 0, 0.0035, 0.007, 40), { fov: 38, roll: 0.04 }) },
  ],
  // Stockholm aerial, ship at the quay
  2: [
    { f: a(2), s: (f) => zoom([-62, 42, -82], [2, 6, -18], 44, pushK(f, a(2), 0.002)) },
    { f: a(2) + 20, dur: 30, s: (f) => zoom([-46, 30, -66], [0, 7, -19], 42, pushK(f, a(2) + 50, 0.0025)) },
  ],
  // the king on the quay, pointing at his ship (lens over the water by the hull)
  3: [
    { f: a(3), s: (f) => dolly([1.5, D0 + 2.0, -27.4], [-2.2, D0 + 1.7, -32.6], pushK(f, a(3), 0.0025), { fov: 40 }) },
    { f: at(W.terrify) - 8, dur: 22, s: (f) => dolly([0.3, D0 + 1.9, -28.9], [-2.2, D0 + 1.85, -32.6], pushK(f, at(W.terrify) + 14, 0.003), { fov: 38, roll: 0.04 }) },
  ],
  // "So they built Vasa": glide along the starboard side, bow to midships, low over the water
  4: [
    { f: a(4), s: (f) => dolly([34, 2.6, -7], [12, 6, -18], pushK(f, a(4), 0.002), { fov: 46 }) },
    { f: a(4) + 2, dur: 26, s: (f) => dolly([10, 2.8, -6], [-6, 7, -19], pushK(f, a(4) + 28, 0.002), { fov: 46, roll: -0.04 }) },
  ],
  // sixty-four cannons: the gun-port rows
  5: [
    { f: a(5), s: (f) => dolly([2.5, 2.9, -9.6], [-5, 2.6, -15.4], pushK(f, a(5), 0.003, 0.006, 30), { fov: 38, roll: 0.03 }) },
  ],
  // golden lions: the carved stern
  6: [
    { f: a(6), s: (f) => dolly([-45, 8.5, -9], [-24.2, 8.8, -21], pushK(f, a(6), 0.003), { fov: 38 }) },
    { f: a(6) + 30, dur: 30, s: (f) => dolly([-38, 9.5, -13], [-24.2, 9.6, -21], pushK(f, a(6) + 60, 0.0025), { fov: 36, roll: -0.04 }) },
  ],
  // the deck from the forecastle: crew lined up, the admiral on the quarterdeck
  7: [
    { f: a(7), s: (f) => dolly([8, 20, -36], [-4, 6, -21], pushK(f, a(7), 0.0025), { fov: 44 }) },
    { f: at(W.thirty) - 10, dur: 26, s: (f) => dolly([5, 17, -33], [-5, 6, -21], pushK(f, at(W.thirty) + 16, 0.002), { fov: 44, roll: 0.03 }) },
  ],
  // the test, seen along the hull (heel reads as roll): high over the bow
  8: [
    { f: a(8), s: (f) => dolly([42, 20, -23], [-4, 6, -21], pushK(f, a(8), 0.0018), { fov: 38 }) },
    { f: at(W.three) - 8, dur: 24, s: (f) => dolly([34, 17, -23], [-4, 6, -21], pushK(f, at(W.three) + 16, 0.003), { fov: 38, roll: -0.04 }) },
  ],
  // "stop!": the admiral
  9: [
    { f: a(9), s: (f) => dolly(onDeck(9, a(9), [-8.4, QD + 2.0, 0.4]), onDeck(9, f, [-12.4, QD + 1.75, 0.4]), pushK(f, a(9), 0.003, 0.007, 30), { fov: 40 }) },
  ],
  // "did anyone fix it? Nope.": admiral and crew, shrug
  10: [
    { f: a(10), s: (f) => dolly([-6.5, 10.4, -23.8], [-12.4, 9.6, -20.8], pushK(f, a(10), 0.0025), { fov: 40, roll: -0.03 }) },
  ],
  // nobody wanted to tell the king: the beaming king
  11: [
    { f: a(11), s: (f) => dolly([-0.3, D0 + 1.95, -28.6], [-2.2, D0 + 1.85, -32.6], pushK(f, a(11), 0.003, 0.006, 30), { fov: 38, roll: -0.04 }) },
  ],
  // August tenth: the cheering crowd on the quay
  12: [
    { f: a(12), s: (f) => dolly([4, D0 + 3.4, -24.5], [0, D0 + 1.7, -33], pushK(f, a(12), 0.0025), { fov: 44 }) },
    { f: at(W.crowds) + 4, dur: 26, s: (f) => dolly([1, D0 + 2.6, -26.5], [-1, D0 + 1.6, -33], pushK(f, at(W.crowds) + 30, 0.002), { fov: 42, roll: 0.03 }) },
  ],
  // the breeze fills the sails (from the deck) -> wide from the quay side: she tips, comes back up
  13: [
    { f: a(13), s: (f) => dolly(rel(13, f, [30, 2.5, 22]), rel(13, f, [2, 21, 0]), pushK(f, a(13), 0.002), { fov: 50 }) },
    { f: at(W.tipped) - 16, cut: true, s: (f) => dolly(rel(13, f, [-30, 10, -25]), rel(13, f, [2, 9, 0]), pushK(f, at(W.tipped) - 16, 0.002), { fov: 44, roll: 0.04 }) },
  ],
  // the second gust: water floods the open ports (low by the hull)
  14: [
    { f: a(14), s: (f) => dolly(rel(14, f, [-32, 1.8, -27]), rel(14, f, [0, 3, -2]), pushK(f, a(14), 0.0025), { fov: 44 }) },
    { f: at(W.water) - 10, dur: 22, s: (f) => dolly(rel(14, f, [-16, 1.3, -17]), rel(14, f, [0, 1.2, -4]), pushK(f, at(W.water) + 12, 0.003), { fov: 42, roll: -0.05 }) },
  ],
  // twenty minutes, thirteen hundred metres, gone: high wide over the harbour
  15: [
    { f: a(15), s: (f) => zoom(rel(15, a(15), [-42, 30, -48]), rel(15, f, [0, 3, 0]), 42, pushK(f, a(15), 0.0025)) },
    { f: at(W.gone) - 10, dur: 22, s: (f) => zoom(rel(15, at(W.gone), [-30, 21, -36]), rel(15, at(W.gone), [0, 0, 0]), 40, pushK(f, at(W.gone) + 12, 0.002)) },
  ],
  // luckily: the crew climbing out at the quay steps
  16: [
    { f: a(16), s: (f) => dolly([-33.5, 3.0, -21], [-37.5, 3.4, -29], pushK(f, a(16), 0.0025), { fov: 46 }) },
  ],
  // unluckily: the whole city watched
  17: [
    { f: a(17), s: (f) => dolly([0, D0 + 2.6, -25.5], [0, D0 + 1.7, -33], pushK(f, a(17), 0.0025, 0.006, 30), { fov: 46 }) },
    { f: at(W.watched) - 8, dur: 22, s: (f) => dolly([2.5, D0 + 2.0, -28.6], [1.5, D0 + 1.8, -33], pushK(f, at(W.watched) + 14, 0.003), { fov: 40, roll: 0.04 }) },
  ],
  // you see: the night bus
  18: [
    { f: a(18), s: (f) => dolly([BUS[0] + 3.9, BUS[1] + 1.55, BUS[2] + 0.35], [BUS[0], BUS[1] + 1.25, BUS[2]], pushK(f, a(18), 0.0022), { fov: 50 }) },
    { f: at(W.over) - 10, dur: 22, s: (f) => dolly([BUS[0] + 3.1, BUS[1] + 1.8, BUS[2] + 0.5], [BUS[0], BUS[1] + 1.55, BUS[2]], pushK(f, at(W.over) + 12, 0.0025), { fov: 50, roll: 0.03 }) },
    { f: at(W.turn) - 6, dur: 18, s: (f) => dolly([BUS[0] + 3.4, BUS[1] + 1.6, BUS[2] + 0.4], [BUS[0] + 0.8, BUS[1] + 1.1, BUS[2]], pushK(f, at(W.turn) + 12, 0.003), { fov: 50, roll: -0.06 }) },
  ],
  // the ship at night: tilt up from the waterline to the guns high in the hull
  19: [
    { f: a(19), s: (f) => dolly([9, 1.4, -5], [-2, 2.8, -17], pushK(f, a(19), 0.002), { fov: 48 }) },
    { f: at(W.high) - 24, dur: 34, s: (f) => dolly([9, 1.6, -5], [-2, 10, -18], pushK(f, at(W.high) + 10, 0.002), { fov: 48, roll: 0.04 }) },
  ],
  // the inquiry: officials on the lamp-lit quay
  20: [
    { f: a(20), s: (f) => dolly([0.4, D0 + 2.6, -24.6], [0.2, D0 + 1.6, -33], pushK(f, a(20), 0.0025), { fov: 46 }) },
    { f: at(W.nobody2) - 8, dur: 22, s: (f) => dolly([0.2, D0 + 2.2, -26.4], [0.2, D0 + 1.7, -33], pushK(f, at(W.nobody2) + 14, 0.003), { fov: 44, roll: -0.04 }) },
  ],
  // 1961: she rises out of the harbour
  21: [
    { f: a(21), s: (f) => dolly([-48, 15, -38], [0, 3, -21], pushK(f, a(21), 0.002), { fov: 44 }) },
    { f: at(W.pulled) - 10, dur: 30, s: (f) => dolly([-42, 13, -36], [0, 5, -21], pushK(f, at(W.pulled) + 20, 0.002), { fov: 44, roll: 0.03 }) },
  ],
  // twenty-nine million visitors -> crane out: she still hasn't left Stockholm
  22: [
    { f: a(22), s: (f) => dolly([-3, D0 + 2.5, -26.4], [-3, D0 + 1.8, -33], pushK(f, a(22), 0.0025), { fov: 44 }) },
    { f: at(W.still) - 20, dur: Math.max(30, TOTAL - at(W.still) + 10), s: (f) => zoom([-64, 50, -98], [2, 5, -20], 44, pushK(f, TOTAL, 0.002)) },
  ],
};

const KICKS: [number, number][] = [[W.stop, 0.8], [W.tipped, 0.7], [W.water, 1.0], [W.gone, 1.2], [W.bump, 0.9], [W.flying, 1.0], [W.most + 0.05, 0.5]];
export const kickAt = (t: number) => {
  let k = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) k += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return k;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), k = kickAt(T(f));
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
  { f: 0, cInf: 6 },
  { f: sa(2), cInf: 0 },
  { f: sa(3), cInf: 12 },
  { f: sa(4), cInf: 0 },
  { f: sa(5), cInf: 12 },
  { f: sa(6), cInf: 13 },
  { f: sa(7), cInf: 0 },
  { f: sa(9), cInf: 14 },
  { f: sa(10), cInf: 9 },
  { f: sa(11), cInf: 13 },
  { f: sa(12), cInf: 9 },
  { f: sa(13), cInf: 0 },
  { f: sa(16), cInf: 8 },
  { f: sa(17), cInf: 10 },
  { f: sa(18), cInf: 10 },
  { f: sa(19), cInf: 0 },
  { f: sa(20), cInf: 11 },
  { f: sa(21), cInf: 0 },
  { f: sa(22), cInf: 9 },
  { f: at(W.still) - 20, dur: 30, cInf: 0 },
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
export { W };
