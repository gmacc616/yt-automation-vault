// Timeline of the Lake Peigneur short: shots timed to the voice (words.ts), the story physics (drill, rig tilt and sink,
// the whirlpool, barges spiralling in, the wooded spit falling into the pit, the lake draining, the canal waterfall,
// barges popping back up) and the camera grammar of the reference study: slow push-ins, smootherstep glides 18-40 f,
// crossfades at place changes, 7-frame kicks.
import * as THREE from "three";
import { W } from "./words";
import type { Expr } from "./toon";
import { HOLE, BANK, CUT, MINE, KIT, KS, CUT_LEVELS, Mine, RIG_DECK, CANAL_X0, PIT_OUT } from "./lake";
export const FPS = 30;
export const TOTAL = Math.ceil((W.end + 0.45) * FPS);
export const D0 = BANK;
export type V3 = [number, number, number];

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
const L = 2 / FPS; // reactions land ~2 f before the word

// ---------------- story physics ----------------
export type Phase = "calm" | "tilt" | "swirl" | "drained" | "fall" | "refill" | "set";
export type LakeState = {
  wl: number; vd: number; vr: number; swirl: number; spit: number; rigTilt: number; rigSink: number; rigOn: boolean; pipe: number; spin: number;
  barges: "moored" | "swirl" | "gone" | "pop"; t: number; fall: number;
};
/** the rig: tilt from "tilt", sinks from "sank", gone into the whirlpool by "whirl" */
const rigTilt = (t: number) => lin([[W.tilt - 0.5, 0], [W.tilt + 0.3, 0.1], [W.sank - 0.05, 0.16], [W.then3, 0.34], [W.whirl, 0.6]], t);
const rigSink = (t: number) => lin([[W.sank - 0.1, 0], [W.then3, 7], [W.spin, 16], [W.rig3 + 0.3, 60]], t);
const vDepth = (t: number) => lin([[W.sank, 0], [W.spin + 0.2, 7], [W.whirl, 16], [W.land, 28]], t);
const vRad = (t: number) => lin([[W.sank, 12], [W.spin + 0.2, 22], [W.land, 34]], t);
const wLevel = (t: number) => lin([[W.spin, 0], [W.land + 0.4, -1.6]], t);
export const lakeAt = (phase: Phase, t: number): LakeState => {
  const base: LakeState = { wl: 0, vd: 0, vr: 20, swirl: 0, spit: 0, rigTilt: 0, rigSink: 0, rigOn: true, pipe: lin([[W.drilling, 0.5], [W.stuck, 40]], t), spin: t * 4,
    barges: "moored", t, fall: 0 };
  switch (phase) {
    case "calm": return base;
    case "tilt": case "swirl": {
      const s = rigSink(t);
      return { ...base, wl: wLevel(t), vd: vDepth(t), vr: vRad(t), swirl: smooth((t - W.sank) / 2), spit: lin([[W.acres - 0.1, 0], [W.land + 0.5, 1]], t),
        rigTilt: rigTilt(t), rigSink: s, rigOn: s < 50, spin: 0, barges: "swirl" };
    }
    case "drained": return { ...base, wl: -50, spit: 1, rigOn: false, barges: "gone" };
    case "fall": return { ...base, wl: -50 + 3 * smooth((t - W.empty) / 6), spit: 1, rigOn: false, barges: "gone", fall: smooth((t - W.empty + 0.2) / 1.0) };
    case "refill": return { ...base, wl: 0, spit: 1, rigOn: false, barges: "pop" };
    default: return { ...base, rigOn: false };
  }
};
/** rig space -> world: heels about the z axis (rolls on screen for the deck camera on +z), sinks */
export const rigMatrix = (S: LakeState) => new THREE.Matrix4().makeTranslation(HOLE[0], -S.rigSink, HOLE[2]).multiply(new THREE.Matrix4().makeRotationZ(S.rigTilt));
export const rigToWorld = (S: LakeState, p: V3): V3 => { const v = new THREE.Vector3(...p).applyMatrix4(rigMatrix(S)); return [v.x, v.y, v.z]; };

/** 11 barges + the tug (index 11): moored layout around the rig (offset from the hole, yaw) */
export const MOOR: [number, number, number][] = Array.from({ length: 12 }, (_, i) => {
  if (i === 11) return [-26, 20, 0.4];
  const a = 1.75 + i * 0.36, r = 36 + (i % 2) * 13;
  return [r * Math.cos(a), r * Math.sin(a), -a + Math.PI / 2];
});
/** where the nine barges came back up (offset from the hole, yaw), in front of the shot-18 lens */
const POP: [number, number, number][] = [[-8, 22, 0.3], [6, 6, 1.4], [-24, 6, 2.2], [14, 34, 0.9], [-4, -10, 2.8], [24, 14, 0.1], [30, -5, 1.8], [10, -22, 0.6], [28, 40, 2.5]];
export type BargePose = { x: number; y: number; z: number; yaw: number; roll: number; on: boolean };
export const bargeAt = (S: LakeState, i: number): BargePose => {
  const [mx, mz, myaw] = MOOR[i];
  if (S.barges === "moored") return { x: HOLE[0] + mx, y: 0.04 * Math.sin(S.t * 1.3 + i), z: HOLE[2] + mz, yaw: myaw, roll: 0, on: true };
  if (S.barges === "gone") return { x: 0, y: -99, z: 0, yaw: 0, roll: 0, on: false };
  if (S.barges === "pop") {
    if (i >= 9) return { x: 0, y: -99, z: 0, yaw: 0, roll: 0, on: false }; // nine came back
    const t0 = W.popped - 0.35 + [0, 0.5, 0.15, 0.8, 0.3, 1.05, 0.6, 0.9, 0.45][i];
    const P = POP[i], u = clamp01((S.t - t0) / 0.55), a = P[2];
    const bob = u >= 1 ? 0.35 * Math.exp(-(S.t - t0 - 0.55) * 2.2) * Math.sin((S.t - t0) * 9) : 0;
    return { x: HOLE[0] + P[0], y: -9 + 9.4 * Math.sin(u * Math.PI * 0.5) ** 0.6 + bob + 0.04 * Math.sin(S.t * 1.3 + i), z: HOLE[2] + P[1], yaw: a, roll: (1 - u) * 0.5, on: S.t > t0 - 0.1 };
  }
  // swirl: start turning from "spin", spiral inward (outer ones later), tip over and sink near the middle
  const k = Math.max(0, S.t - W.spin + 0.6) * (1 + (i % 3) * 0.25);
  const r0 = Math.hypot(mx, mz), a0 = Math.atan2(mz, mx), r = r0 * Math.exp(-k * 0.16), a = a0 + k * (0.35 + 9 / Math.max(6, r));
  const sink = Math.max(0, 20 - r) * 1.4 + (S.vd * Math.exp(-((r / S.vr) ** 2)));
  return { x: HOLE[0] + r * Math.cos(a), y: S.wl - sink, z: HOLE[2] + r * Math.sin(a), yaw: -a + Math.PI / 2 + k * 0.4, roll: Math.min(0.9, sink * 0.05), on: sink < 30 };
};

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type Place = "lake" | "cut" | "mine" | "kitchen";
export type ShotDef = {
  id: number; a: number; b: number; light: Light; crowd: string; phase: Phase; place: Place;
  tau?: (t: number) => number; mood?: (t: number, i: number) => Expr; sunAz?: number; sunEl?: number;
  /** wide scene shot: the subject is the place, not a character (check.ts skips the subject test) */ wide?: boolean; wideFrom?: number;
};
const S = (id: number, a: number, b: number, light: Light, place: Place, phase: Phase, crowd: string, more: Partial<ShotDef> = {}): ShotDef =>
  ({ id, a: fr(a), b: fr(b), light, place, phase, crowd, ...more });
export const SHOTS: ShotDef[] = [
  S(1, 0, W.november - 0.1, "golden", "lake", "swirl", "none", { tau: (t) => W.spin + 0.4 + t * 0.4, wide: true }),
  S(2, W.november - 0.1, W.ten - 0.1, "day", "lake", "calm", "none", { wide: true }),
  S(3, W.ten - 0.1, W.sitting - 0.1, "day", "lake", "calm", "fisher"),
  S(4, W.sitting - 0.1, W.out - 0.1, "day", "cut", "set", "none", { wide: true }),
  S(5, W.out - 0.1, W.down1 - 0.1, "day", "lake", "calm", "rigcrew"),
  S(6, W.down1 - 0.1, W.then1 - 0.1, "day", "cut", "set", "none", { wide: true }),
  S(7, W.then1 - 0.1, W.then2 - 0.1, "golden", "lake", "tilt", "rigcrew", { sunAz: 150, sunEl: 12 }),
  S(8, W.then2 - 0.1, W.then3 - 0.1, "golden", "lake", "tilt", "none", { wide: true }),
  S(9, W.then3 - 0.1, W.whirl - 0.1, "golden", "lake", "swirl", "none", { wide: true }),
  S(10, W.whirl - 0.1, W.acres - 0.1, "golden", "lake", "swirl", "none", { wide: true }),
  S(11, W.acres - 0.1, W.mine - 0.1, "golden", "lake", "swirl", "none", { wide: true }),
  S(12, W.mine - 0.1, W.lucky - 0.1, "day", "mine", "set", "miners", { sunAz: 140, sunEl: 55 }),
  S(13, W.lucky - 0.1, W.unlucky - 0.1, "day", "mine", "set", "cage", { sunAz: 140, sunEl: 55 }),
  S(14, W.unlucky - 0.1, W.yousee - 0.1, "golden", "lake", "drained", "none", { sunAz: 140, sunEl: 26, wide: true }),
  S(15, W.yousee - 0.1, W.tiny - 0.1, "night", "kitchen", "set", "tea", { wideFrom: fr(W.sugar) - 12 }),
  S(16, W.tiny - 0.1, W.empty - 0.1, "night", "cut", "set", "none", { wide: true }),
  S(17, W.empty - 0.1, W.days - 0.1, "golden", "lake", "fall", "none", { wide: true }),
  S(18, W.days - 0.1, W.nobody - 0.1, "day", "lake", "refill", "none", { wide: true }),
  S(19, W.nobody - 0.1, W.andlake - 0.1, "day", "lake", "refill", "suits"),
  S(20, W.andlake - 0.1, W.end + 0.45, "day", "cut", "set", "none", { wide: true }),
];
SHOTS[SHOTS.length - 1].b = TOTAL;
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 3: 6, 4: 8, 5: 8, 6: 8, 7: 8, 8: 6, 9: 6, 10: 6, 11: 6, 12: 8, 13: 6, 14: 8, 15: 8, 16: 8, 17: 8, 18: 8, 19: 6, 20: 8 };
export const FLASH_AT = SHOTS[1].a;
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};
export const stateOf = (id: number, t: number) => { const s = SHOTS[id - 1]; return lakeAt(s.phase, s.tau ? s.tau(t) : t); };

// ---------------- the far sets' state ----------------
/** cut-away: drill tip depth, cavity size, lake layer thickness, funnel depth, rig shown, drill bit at the funnel bottom */
export const cutAt = (id: number, t: number) => {
  const top = CUT_LEVELS[0] + 7;
  if (id === 4) return { tip: 0, cav: 0, lake: 4, funnel: 0, rig: true, bit: false };
  if (id === 6) return { tip: lin([[W.down1 - 0.2, 0], [W.down1 + 0.5, -14], [W.down2 + 0.5, -38], [W.down3 + 0.5, -58], [W.stuck - 0.05, top]], t), cav: 0, lake: 4, funnel: 0, rig: true, bit: false };
  if (id === 16) return { tip: top, cav: lin([[W.tiny, 0.6], [W.wider1 + 0.3, 3.5], [W.wider2 + 0.3, 7], [W.fell, 9]], t), lake: lin([[W.fell - 0.25, 4], [W.fell + 0.5, 0]], t),
    funnel: lin([[W.fell - 0.3, 0], [W.fell + 0.4, 74]], t), rig: t < W.fell + 0.1, bit: false };
  // the twist: the funnel is the new lake, 200 ft
  return { tip: top, cav: 0, lake: lin([[W.now - 0.3, 4], [W.now + 0.3, 4]], t), funnel: lin([[W.now - 0.3, 0], [W.two00 + 0.3, 74]], t), rig: false, bit: true };
};
export const kitchenAt = (t: number) => ({ drop: clamp01((t - (W.sugar - 0.15)) / 0.45), melt: lin([[W.tea, 0], [W.tiny + 0.4, 0.7]], t) });
export const mineAt = (id: number, t: number) => ({
  flood: id === 12 ? lin([[W.water - 0.2, 2], [W.lucky, 20]], t) : 26,
  pour: id === 12 ? clamp01((t - W.water + 0.3) / 0.4) : 1,
  cage: id === 13 ? lin([[W.every + 0.6, 0], [W.unlucky - 0.2, 18]], t) : 0,
});

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
const H = (x: number, y: number, z: number): V3 => [HOLE[0] + x, y, HOLE[2] + z];
const C = (x: number, y: number, z: number): V3 => [CUT[0] + x, CUT[1] + y, CUT[2] + z];
const M = (x: number, y: number, z: number): V3 => [MINE[0] + x, MINE[1] + y, MINE[2] + z];
const K = (x: number, y: number, z: number): V3 => [KIT[0] + x * KS, KIT[1] + y * KS, KIT[2] + z * KS];
const a = (id: number) => SHOTS[id - 1].a;
const at = (s: number) => fr(s);
const tipOf = (f: number) => cutAt(6, T(f)).tip;
const cageY = (f: number) => mineAt(13, T(f)).cage;
const SX = Mine.SHAFT;
export const SKIFF: V3 = [35, 0, 32];
export const SUITS: V3 = [-139, BANK, 84];

const CAMS: Record<number, Key[]> = {
  // hook: high over the whirlpool at sunset, barges and the tug circling the drain, push in
  1: [{ f: 0, s: (f) => dolly(H(40, 24, 52), H(0, -5, 0), pushK(f, 0, 0.004, 0.008, 40), { fov: 52, roll: 0.05 }) }],
  // November 1980: the whole lake from the air, island and rig
  2: [
    { f: a(2), s: (f) => dolly([200, 95, 200], [20, 0, -30], pushK(f, a(2), 0.003), { fov: 48 }) },
    { f: at(W.peigneur) - 6, dur: 30, s: (f) => dolly([165, 62, 160], [35, 0, -20], pushK(f, at(W.peigneur) + 24, 0.0025), { fov: 46, roll: -0.03 }) },
  ],
  // ten feet deep, a quiet fishing lake: low over the water at the skiff, rig far behind
  3: [
    { f: a(3), s: (f) => dolly([SKIFF[0] - 9, 2.2, SKIFF[2] + 11], [SKIFF[0], 1.1, SKIFF[2]], pushK(f, a(3), 0.003), { fov: 42 }) },
    { f: at(W.quiet) - 6, dur: 28, s: (f) => dolly([SKIFF[0] - 6.5, 1.8, SKIFF[2] + 8.5], [SKIFF[0] + 0.3, 1.0, SKIFF[2]], pushK(f, at(W.quiet) + 22, 0.003), { fov: 40, roll: 0.03 }) },
  ],
  // sitting on top of a giant salt mine: from the lake surface down the cut-away to the galleries
  4: [
    { f: a(4), s: (f) => dolly(C(0, 14, 75), C(0, -2, -6), pushK(f, a(4), 0.002), { fov: 46 }) },
    { f: a(4) + 6, dur: 40, s: (f) => dolly(C(0, -60, 95), C(0, -86, -2), pushK(f, a(4) + 46, 0.0025), { fov: 46 }) },
  ],
  // the rig drilling, roughnecks on deck
  5: [
    { f: a(5), s: (f) => dolly(H(10, 5.6, 14.5), H(2.5, 4.6, 5), pushK(f, a(5), 0.003, 0.006, 30), { fov: 44 }) },
  ],
  // down... and down... and down: follow the drill tip through the layers to the gallery roof
  6: [{ f: a(6), s: (f) => { const y = Math.max(tipOf(f), CUT_LEVELS[0] + 7); return dolly(C(0, y + 5, 42), C(0, y - 2, -6), pushK(f, a(6), 0.002, at(W.stuck) < f ? 0.006 : 0, 20), { fov: 44 }); } }],
  // the rig tilts: same deck view at sunset
  7: [{ f: a(7), s: (f) => dolly(H(10, 5.6, 14.5), H(2.5, 4.2, 5), pushK(f, a(7), 0.003, 0.006, 30), { fov: 46, roll: -0.05 }) }],
  // it sank: from far out on the lake
  8: [{ f: a(8), s: (f) => dolly(H(-85, 10, 75), H(0, 6, 0), pushK(f, a(8), 0.003), { fov: 40 }) }],
  // the whole lake starts to spin: rise over the vortex
  9: [
    { f: a(9), s: (f) => dolly(H(-60, 30, 80), H(0, -4, 0), pushK(f, a(9), 0.002), { fov: 46 }) },
    { f: a(9) + 4, dur: 32, s: (f) => dolly(H(-30, 70, 55), H(0, -8, 0), pushK(f, a(9) + 36, 0.003), { fov: 46, roll: 0.04 }) },
  ],
  // the whirlpool swallowed the rig, the tug, eleven barges: low over the water as they spiral past
  10: [
    { f: a(10), s: (f) => dolly(H(60, 9, 46), H(4, -3, 2), pushK(f, a(10), 0.0025), { fov: 48 }) },
    { f: at(W.tug) - 8, dur: 30, s: (f) => dolly(H(48, 14, 52), H(0, -6, 0), pushK(f, at(W.tug) + 22, 0.003), { fov: 48, roll: -0.04 }) },
  ],
  // and sixty-five acres of land: the wooded spit slides into the pit
  11: [{ f: a(11), s: (f) => dolly([30, 24, 128], [92, -4, 36], pushK(f, a(11), 0.0025), { fov: 44 }) }],
  // down in the mine: miners and the water pouring through the roof
  12: [
    { f: a(12), s: (f) => dolly(M(-19, 2.6, 18), M(-5, 3.0, 3), pushK(f, a(12), 0.0025), { fov: 48 }) },
    { f: at(W.water) - 8, dur: 24, s: (f) => dolly(M(-17, 2.4, 16), M(-3, 3.6, 2), pushK(f, at(W.water) + 16, 0.003), { fov: 48, roll: 0.04 }) },
  ],
  // luckily: the cage rising up the shaft, everyone in it
  13: [{ f: a(13), s: (f) => { const y = cageY(f); return dolly(M(SX[0] + 6.5, 2.6 + y * 0.9, SX[2] + 8), M(SX[0], 1.7 + y, SX[2]), pushK(f, a(13), 0.002), { fov: 46 }); } }],
  // unluckily the lake didn't: the empty bed and the pit from the bank, people staring
  14: [
    { f: a(14), s: (f) => dolly([-20, 52, 92], [72, -26, -10], pushK(f, a(14), 0.0025), { fov: 48 }) },
    { f: at(W.didnt) - 10, dur: 26, s: (f) => dolly([-6, 42, 80], [74, -34, -10], pushK(f, at(W.didnt) + 16, 0.003), { fov: 44, roll: 0.04 }) },
  ],
  // you see: sugar in tea, at night
  15: [
    { f: a(15), s: (f) => dolly(K(0.24, 1.04, 1.0), K(0, 0.93, -0.3), pushK(f, a(15), 0.0025), { fov: 36 }) },
    { f: at(W.sugar) - 12, dur: 26, s: (f) => dolly(K(0.14, 0.98, 0.64), K(0.01, 0.88, -0.12), pushK(f, at(W.sugar) + 14, 0.003, 0.006, 30), { fov: 34, roll: 0.03 }) },
  ],
  // the hole kept melting wider: the cut-away at night, then the lake falls through
  16: [
    { f: a(16), s: (f) => dolly(C(0, -64, 44), C(0, -72, -2), pushK(f, a(16), 0.002), { fov: 46 }) },
    { f: at(W.fell) - 16, dur: 34, s: (f) => dolly(C(0, -20, 105), C(0, -40, -6), pushK(f, at(W.fell) + 18, 0.002), { fov: 48, roll: -0.03 }) },
  ],
  // the canal ran backwards: the waterfall into the pit
  17: [
    { f: a(17), s: (f) => dolly([CANAL_X0 + 60, 50, 60], [CANAL_X0 - 50, -35, 0], pushK(f, a(17), 0.0025), { fov: 46 }) },
    { f: at(W.waterfall) - 14, cut: true, s: (f) => dolly([HOLE[0] + 18, -36, 22], [HOLE[0] + 62, -6, 0], pushK(f, at(W.waterfall) + 20, 0.0025), { fov: 52, roll: 0.04 }) },
  ],
  // days later, nine barges popped back up
  18: [{ f: a(18), s: (f) => dolly(H(-48, 10, 62), H(4, 0, 4), pushK(f, a(18), 0.003, 0.006, 30), { fov: 46 }) }],
  // nobody could prove it: the oilmen on the bank, pointing, then shrugging; money
  19: [
    { f: a(19), s: (f) => dolly([SUITS[0] - 7.5, BANK + 2.0, SUITS[2] + 7.5], [SUITS[0], BANK + 1.7, SUITS[2]], pushK(f, a(19), 0.0025), { fov: 44 }) },
    { f: at(W.paid) - 8, dur: 24, s: (f) => dolly([SUITS[0] - 5.2, BANK + 1.9, SUITS[2] + 5.2], [SUITS[0], BANK + 1.8, SUITS[2]], pushK(f, at(W.paid) + 16, 0.003), { fov: 42, roll: -0.03 }) },
  ],
  // the twist: ten feet becomes two hundred; down the funnel to the little drill
  20: [
    { f: a(20), s: (f) => dolly(C(0, 6, 72), C(0, -3, -6), pushK(f, a(20), 0.0025), { fov: 46 }) },
    { f: at(W.now) - 6, dur: 36, s: (f) => dolly(C(0, -24, 92), C(0, -40, -6), pushK(f, at(W.now) + 30, 0.002), { fov: 48 }) },
    { f: at(W.thanks) - 10, dur: Math.max(30, TOTAL - at(W.thanks) + 10), s: (f) => dolly(C(0, -64, 22), C(0, -70, -6), pushK(f, TOTAL, 0.003), { fov: 44 }) },
  ],
};

const KICKS: [number, number][] = [[W.stuck, 1.0], [W.sank, 0.8], [W.spin, 0.7], [W.land, 0.9], [W.water, 0.7], [W.fell, 1.0], [W.popped, 0.6]];
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

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const sa = (id: number) => SHOTS[id - 1].a;
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },
  { f: sa(3), cInf: 12 },
  { f: sa(4), cInf: 0 },
  { f: sa(5), cInf: 11 },
  { f: sa(6), cInf: 0 },
  { f: sa(7), cInf: 10 },
  { f: sa(8), cInf: 0 },
  { f: sa(12), cInf: 10 },
  { f: sa(13), cInf: 9 },
  { f: sa(14), cInf: 0 },
  { f: sa(15), cInf: 14 },
  { f: sa(16), cInf: 0 },
  { f: sa(19), cInf: 11 },
  { f: sa(20), cInf: 0 },
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
export { W, RIG_DECK };
void L;
