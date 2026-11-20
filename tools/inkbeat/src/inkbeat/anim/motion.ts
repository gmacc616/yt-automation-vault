// Motion with weight: paths walked or driven at a speed that ramps (no instant starts or stops), the walk phase tied
// to the distance covered (feet never slide), damped springs for follow-through and overshoot, anticipation curves,
// and pose blending so a character never snaps between poses. Everything is a pure function of t.
import * as THREE from "three";
import type { ArmPose } from "../char/skeleton";
import type { V3 } from "../types";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// ------------------------------------------------------------------ easing (the camera presets use these too)
export const EASE = {
  linear: (u: number) => clamp(u),
  in: (u: number, p = 2) => Math.pow(clamp(u), p),
  out: (u: number, p = 2) => 1 - Math.pow(1 - clamp(u), p),
  /** symmetric in-out; p = 2 gentle, 3 the beat rig's default, 4-5 heavy inertia */
  inOut: (u: number, p = 3) => {
    const x = clamp(u);
    return x < 0.5 ? Math.pow(2 * x, p) / 2 : 1 - Math.pow(2 - 2 * x, p) / 2;
  },
  /** overshoot then settle (a landing, a head snap); k = overshoot amount (0.1 subtle, 0.3 cartoony) */
  back: (u: number, k = 0.18) => {
    const x = clamp(u) - 1;
    const c = 1.70158 * (k / 0.1);
    return 1 + (c + 1) * x * x * x + c * x * x;
  },
};
export type EaseName = "linear" | "in" | "out" | "inOut" | "back";
export const ease = (name: EaseName, u: number, p?: number) => (EASE[name] as (u: number, p?: number) => number)(u, p);

/** a damped spring step response at time s after a change (0 → 1, overshoots then settles): follow-through */
export const spring = (s: number, freq = 2.2, damp = 0.35) => {
  if (s <= 0) return 0;
  const w = 2 * Math.PI * freq;
  return 1 - Math.exp(-damp * w * s) * Math.cos(w * Math.sqrt(1 - damp * damp) * s);
};
/** anticipation: dips to -amt before rising to 1 (a crouch before a jump, a wind-up before a throw) */
export const anticipate = (u: number, amt = 0.15, split = 0.3) => {
  const x = clamp(u);
  if (x < split) return -amt * Math.sin((x / split) * Math.PI * 0.5);
  return -amt + (1 + amt) * EASE.inOut((x - split) / (1 - split), 3);
};

// ------------------------------------------------------------------ speed profiles: [time s, speed m/s] keys
export type SpeedKeys = [number, number][];
/** distance covered by t along piecewise-linear speed keys (exact integral) */
export const distanceAt = (keys: SpeedKeys, t: number) => {
  if (!keys.length || t <= keys[0][0]) return 0;
  let d = 0;
  for (let i = 0; i < keys.length - 1; i++) {
    const [ta, va] = keys[i];
    const [tb, vb] = keys[i + 1];
    if (t <= ta) break;
    const te = Math.min(t, tb);
    const vEnd = va + ((vb - va) * (te - ta)) / (tb - ta || 1);
    d += ((va + vEnd) / 2) * (te - ta);
    if (t <= tb) return d;
  }
  const [tl, vl] = keys[keys.length - 1];
  return d + vl * Math.max(0, t - tl);
};
export const speedAt = (keys: SpeedKeys, t: number) => {
  if (!keys.length) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [ta, va] = keys[i];
    const [tb, vb] = keys[i + 1];
    if (t <= tb) return va + ((vb - va) * (t - ta)) / (tb - ta || 1);
  }
  return keys[keys.length - 1][1];
};
/** a start-cruise-stop profile: ramps up over `accel` s, cruises, ramps down to stop at `t1` */
export const startStop = (t0: number, t1: number, v: number, accel = 0.6): SpeedKeys => [
  [t0, 0],
  [t0 + accel, v],
  [Math.max(t0 + accel, t1 - accel), v],
  [t1, 0],
];

// ------------------------------------------------------------------ paths
const pathCache = new Map<string, { c: THREE.CatmullRomCurve3; L: number }>();
const curveOf = (pts: V3[]) => {
  const k = JSON.stringify(pts);
  let hit = pathCache.get(k);
  if (!hit) {
    if (pathCache.size > 60) pathCache.clear();
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "centripetal");
    c.arcLengthDivisions = 400;
    hit = { c, L: c.getLength() };
    pathCache.set(k, hit);
  }
  return hit;
};
export type PathState = { pos: V3; yaw: number; dist: number; speed: number; accel: number; yawRate: number; done: boolean };
/** where a mover is on a path at t, with its heading (yaw, 0 = +z), speed, acceleration and turn rate */
export const follow = (pts: V3[], keys: SpeedKeys, t: number, ground?: (x: number, z: number) => number): PathState => {
  const { c, L } = curveOf(pts);
  const at = (tt: number) => {
    const d = Math.min(distanceAt(keys, tt), L);
    const u = L > 0 ? d / L : 0;
    const p = c.getPointAt(u);
    const tan = c.getTangentAt(Math.min(0.999, Math.max(0.001, u)));
    return { p, d, yaw: Math.atan2(tan.x, tan.z) };
  };
  const a = at(t);
  const b = at(t + 1 / 30);
  const dt = 1 / 30;
  const v = speedAt(keys, t);
  let dy = b.yaw - a.yaw;
  dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const y = ground ? ground(a.p.x, a.p.z) : a.p.y;
  return { pos: [a.p.x, y, a.p.z], yaw: a.yaw, dist: a.d, speed: v, accel: (speedAt(keys, t + dt) - speedAt(keys, t - dt)) / (2 * dt), yawRate: dy / dt, done: a.d >= L - 1e-3 };
};

// ------------------------------------------------------------------ walking and running without foot slide
/** the walk phase for Character3D's `pose.walk`: one full cycle (2π) per stride; a stride of the starter rig is
 * ~0.34 × height (two steps of 0.17 h). Running: pass run = true (longer stride, more lean and bob, see gait()) */
export const walkPhase = (dist: number, height: number, run = false) => (dist / (height * (run ? 0.6 : 0.34))) * Math.PI * 2;

/** body extras for a gait: forward lean (deg) and a bob, scaled by speed (m/s); a run leans in and bounces */
export const gait = (speed: number, accel: number, height: number, run = false): Pick<ArmPose, "lean" | "bob"> => {
  const rel = speed / height; // body heights per second
  const lean = (run ? 9 : 3) * clamp(rel / (run ? 2.2 : 0.9)) + clamp(accel * 2.5, -6, 6); // leans into a start, back on a stop
  return { lean, bob: run ? 2 : 0 };
};

/** footstep times (s) for a walker: one per half cycle, for dust puffs and footstep SFX on the exact contact */
export const footsteps = (keys: SpeedKeys, height: number, t0: number, t1: number, run = false) => {
  const out: number[] = [];
  const step = Math.PI;
  let last = Math.floor(walkPhase(distanceAt(keys, t0), height, run) / step);
  for (let tt = t0; tt <= t1; tt += 1 / 60) {
    const k = Math.floor(walkPhase(distanceAt(keys, tt), height, run) / step);
    if (k !== last) {
      out.push(tt);
      last = k;
    }
  }
  return out;
};

// ------------------------------------------------------------------ jumps and hops
/** a jump with anticipation and landing squash: returns the height offset (m) and a squash (scale y, 1 = none);
 * crouch 0.18 s, air `air` s, land settle 0.25 s */
export const jump = (t: number, t0: number, peak = 0.6, air = 0.55) => {
  const crouch = 0.18;
  const s = t - t0;
  if (s < 0) return { y: 0, squash: 1 };
  if (s < crouch) return { y: 0, squash: 1 - 0.12 * Math.sin((s / crouch) * Math.PI * 0.5) };
  const a = s - crouch;
  if (a < air) {
    const u = a / air;
    return { y: 4 * peak * u * (1 - u), squash: 1 + 0.08 * Math.sin(u * Math.PI) };
  }
  const l = a - air;
  if (l < 0.25) return { y: 0, squash: 1 - 0.14 * Math.exp(-l * 14) * Math.cos(l * 30) };
  return { y: 0, squash: 1 };
};

// ------------------------------------------------------------------ pose blending (no snaps between poses)
type Num = number | undefined;
const lerpN = (a: Num, b: Num, u: number) => (a === undefined && b === undefined ? undefined : (a ?? 0) + ((b ?? 0) - (a ?? 0)) * u);
const lerp2 = (a: [number, number] | undefined, b: [number, number] | undefined, u: number): [number, number] | undefined =>
  a === undefined && b === undefined ? undefined : [lerpN(a?.[0] ?? 8, b?.[0] ?? 8, u)!, lerpN(a?.[1] ?? 8, b?.[1] ?? 8, u)!];
export type BodyPose = ArmPose & { headTilt?: number; headNod?: number; headYaw?: number };
export const blendPose = (a: BodyPose, b: BodyPose, u: number): BodyPose => ({
  armL: lerp2(a.armL, b.armL, u),
  armR: lerp2(a.armR, b.armR, u),
  armLFwd: lerpN(a.armLFwd, b.armLFwd, u),
  armRFwd: lerpN(a.armRFwd, b.armRFwd, u),
  lean: lerpN(a.lean, b.lean, u),
  bob: lerpN(a.bob, b.bob, u),
  headTilt: lerpN(a.headTilt, b.headTilt, u),
  headNod: lerpN(a.headNod, b.headNod, u),
  headYaw: lerpN(a.headYaw, b.headYaw, u),
});
/** a pose track: keys [time s, pose]; each change eases over `blend` s with a little overshoot on the arms (overlap) */
export const poseTrack = (keys: [number, BodyPose][], t: number, blend = 0.35): BodyPose => {
  if (!keys.length) return {};
  let cur = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [tk, pk] = keys[i];
    if (t < tk) break;
    const u = (t - tk) / blend;
    cur = u >= 1 ? pk : blendPose(cur, pk, EASE.back(u, 0.08));
  }
  return cur;
};

/** idle life for a standing character: a slow weight shift and a breath-sized head drift (never a frozen statue) */
export const idle = (t: number, seed = 0): BodyPose => ({
  lean: 0.8 * Math.sin(t * 0.55 + seed),
  headTilt: 2.2 * Math.sin(t * 0.37 + seed * 1.7),
  headYaw: 4 * Math.sin(t * 0.23 + seed * 0.9),
});
