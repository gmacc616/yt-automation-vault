// The cinematic camera library. Every preset is a function of its options that returns a camera path `(t) => Cam`,
// a pure function of time, with eased acceleration and deceleration (inertia), subject tracking with lag, and lens
// choice in millimetres. Pick the preset from WHAT the shot must communicate (see references/cinematic-system.md,
// "Choosing the camera"), then tune its numbers; never pick at random and never reuse one move for a whole film.
//
// All presets share: t0 (start, s), dur (s), ease ("inOut" default, power 2-5 = how heavy the camera feels),
// mm (lens, 9:16 full-frame equivalent: 18 = very wide, 24-28 wide, 35 normal, 50 medium, 85 close), face (where
// the subject sits from the top of the frame, 0.32-0.42 keeps it clear of the 70% caption line).
// Subjects are points or tracks: `V3 | (t) => V3` (feed a walker's or a car's follow().pos).
//
// Use a preset as the setup's main move, and lay plan beats (core/rig.ts poseAt) over it for the Shorts cadence:
//   const base = PRESETS.slowPush({...})(t);  const p = poseAt(base, beats, t0, t, prms);
import { aim } from "../core/rig";
import type { Cam } from "../core/rig";
import type { V3 } from "../types";
import { EASE } from "../anim/motion";
import type { EaseName } from "../anim/motion";

export type Track = V3 | ((t: number) => V3);
export type CamPath = (t: number) => Cam;
const at = (s: Track, t: number): V3 => (typeof s === "function" ? s(t) : s);

const D2R = Math.PI / 180;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const mixV = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);

/** lens mm → vertical fov for a 9:16 frame (the long side ≙ 36 mm) */
export const mm = (f: number) => (2 * Math.atan(18 / f)) / D2R;

type Common = { t0?: number; dur?: number; ease?: EaseName; power?: number; mm?: number; face?: number; minY?: number };
const prog = (o: Common, t: number) => {
  const u = clamp((t - (o.t0 ?? 0)) / (o.dur ?? 3));
  const e = o.ease ?? "inOut";
  return e === "inOut" ? EASE.inOut(u, o.power ?? 3) : e === "in" ? EASE.in(u, o.power ?? 2) : e === "out" ? EASE.out(u, o.power ?? 2) : e === "back" ? EASE.back(u) : u;
};
/** never under the ground or a floor (check the WHOLE move, not only its keys) */
const guard = (c: Cam, minY = 0.25): Cam => (c.pos[1] < minY ? { ...c, pos: [c.pos[0], minY, c.pos[2]] } : c);
/** a point `dist` from `target` at compass angle `ang` (rad, 0 = +z) and height `h` above it */
const around = (target: V3, ang: number, dist: number, h: number): V3 => [target[0] + Math.sin(ang) * dist, target[1] + h, target[2] + Math.cos(ang) * dist];
/** a lagged subject: the average of its positions over the last `lag` s (camera inertia: no jitter, no snap) */
const lagged = (s: Track, t: number, lag: number): V3 => {
  if (typeof s !== "function" || lag <= 0) return at(s, t);
  let acc: V3 = [0, 0, 0];
  const N = 6;
  for (let i = 0; i < N; i++) acc = add(acc, s(t - (lag * i) / (N - 1)), 1 / N);
  return acc;
};
/** heading of a track at t (rad, 0 = +z) */
const heading = (s: Track, t: number, fallback = 0) => {
  if (typeof s !== "function") return fallback;
  const d = sub(s(t + 0.1), s(t - 0.1));
  return Math.hypot(d[0], d[2]) < 1e-4 ? fallback : Math.atan2(d[0], d[2]);
};

// ------------------------------------------------------------------ establishing and reveals
/** a moving establishing shot: starts high and far, cranes down and pushes toward the subject while the frame
 * arcs a little (parallax reveals the depth layers). Opening shots, new locations. */
export const establish = (o: Common & { target: Track; from?: { dist: number; h: number }; to?: { dist: number; h: number }; ang?: number; arc?: number }): CamPath => (t) => {
  const u = prog(o, t);
  const f = o.from ?? { dist: 38, h: 16 };
  const e = o.to ?? { dist: 14, h: 3.2 };
  const tg = at(o.target, t);
  const a = (o.ang ?? 0.5) + (o.arc ?? 12) * D2R * u;
  return guard(aim(around(tg, a, lerp(f.dist, e.dist, u), lerp(f.h, e.h, u)), tg, mm(o.mm ?? 24), o.face ?? 0.45), o.minY);
};
/** a reveal: starts low behind something near the lens (or tilted down), rises and tilts up to show the subject */
export const reveal = (o: Common & { target: Track; ang?: number; dist?: number; rise?: [number, number]; lookDrop?: number }): CamPath => (t) => {
  const u = prog(o, t);
  const tg = at(o.target, t);
  const [h0, h1] = o.rise ?? [0.4, 2.6];
  const pos = around(tg, o.ang ?? 0, o.dist ?? 8, lerp(h0, h1, u));
  const look: V3 = [tg[0], tg[1] + lerp(-(o.lookDrop ?? 2.5), 1.2, u), tg[2]];
  return guard({ pos, look, fov: mm(o.mm ?? 28), roll: 0 }, o.minY);
};

// ------------------------------------------------------------------ pushes and pulls
/** a push-in along the lens line: slow (story weight, explanation: 12-25% of the distance over 3-5 s) or fast
 * (a realisation, a shock: 35-55% in 0.4-0.7 s, ease "out") */
export const push = (o: Common & { target: Track; ang?: number; h?: number; from: number; to: number; aimH?: number }): CamPath => (t) => {
  const u = prog(o, t);
  const tg = add(at(o.target, t), [0, o.aimH ?? 0, 0]);
  return guard(aim(around(tg, o.ang ?? 0.4, lerp(o.from, o.to, u), o.h ?? 0.2), tg, mm(o.mm ?? 35), o.face ?? 0.4), o.minY);
};
export const slowPush = (o: Omit<Parameters<typeof push>[0], "to"> & { to?: number }) => push({ dur: 4, power: 2, ...o, to: o.to ?? o.from * 0.8 });
export const fastPush = (o: Omit<Parameters<typeof push>[0], "to"> & { to?: number }) => push({ dur: 0.55, ease: "out", power: 3, mm: 28, ...o, to: o.to ?? o.from * 0.5 });
/** a pull-back: the context arrives (from a detail out to the situation); rises as it pulls */
export const pullBack = (o: Common & { target: Track; ang?: number; from: number; to: number; h?: [number, number] }): CamPath => (t) => {
  const u = prog(o, t);
  const tg = at(o.target, t);
  const [h0, h1] = o.h ?? [0.3, 2.2];
  return guard(aim(around(tg, o.ang ?? 0.3, lerp(o.from, o.to, u), lerp(h0, h1, u)), tg, mm(o.mm ?? 28), o.face ?? 0.42), o.minY);
};

// ------------------------------------------------------------------ orbits, overheads, low angles
/** an orbit around the subject (a decision, a reveal of the surroundings, a hero moment); deg 25-90 per 2-4 s,
 * with a small roll into the turn */
export const orbit = (o: Common & { target: Track; dist: number; h?: number; from: number; deg: number; rollDeg?: number }): CamPath => (t) => {
  const u = prog(o, t);
  const tg = at(o.target, t);
  const a = (o.from + o.deg * u) * D2R;
  const c = aim(around(tg, a, o.dist, o.h ?? 0.4), tg, mm(o.mm ?? 32), o.face ?? 0.4);
  return guard({ ...c, roll: (o.rollDeg ?? 2.5) * Math.sin(Math.PI * u) * Math.sign(o.deg) }, o.minY);
};
/** a top-down / bird's-eye view: maps, chases, patterns, scale. `tilt` 0 = straight down (kept ≥ 4° so it never
 * flips), slow yaw spin for life */
export const overhead = (o: Common & { target: Track; h: [number, number]; tilt?: number; spin?: number; ang?: number }): CamPath => (t) => {
  const u = prog(o, t);
  const tg = at(o.target, t);
  const h = lerp(o.h[0], o.h[1], u);
  const tilt = Math.max(4, o.tilt ?? 10) * D2R;
  const a = (o.ang ?? 0) + (o.spin ?? 15) * D2R * u;
  const off = Math.tan(tilt) * h;
  return guard({ pos: [tg[0] - Math.sin(a) * off, tg[1] + h, tg[2] - Math.cos(a) * off], look: tg, fov: mm(o.mm ?? 28), roll: 0 }, o.minY);
};
/** a low hero angle: the lens near the ground looking up (power, scale, a towering object); slow creep in */
export const lowAngle = (o: Common & { target: Track; ang?: number; dist: number; lensH?: number; aimH?: number; creep?: number }): CamPath => (t) => {
  const u = prog(o, t);
  const tg = at(o.target, t);
  const look: V3 = [tg[0], tg[1] + (o.aimH ?? 1.2), tg[2]];
  const pos = around(tg, o.ang ?? 0.35, o.dist * (1 - (o.creep ?? 0.12) * u), o.lensH ?? 0.35);
  return guard({ pos, look, fov: mm(o.mm ?? 22), roll: 0 }, o.minY ?? 0.12);
};

// ------------------------------------------------------------------ following a moving subject
/** follow from behind and above (a walker, a car): lags the subject (inertia), looks a little ahead of it */
export const follow = (o: Common & { subject: Track; dist?: number; h?: number; lag?: number; lead?: number; side?: number; aimH?: number }): CamPath => (t) => {
  const s = lagged(o.subject, t, o.lag ?? 0.35);
  const hd = heading(o.subject, t);
  const back = o.dist ?? 6;
  const pos = add(around(s, hd + Math.PI + (o.side ?? 12) * D2R, back, o.h ?? 2.2), [0, 0, 0]);
  const ahead = at(o.subject, t + (o.lead ?? 0.4));
  return guard({ pos, look: [ahead[0], ahead[1] + (o.aimH ?? 1), ahead[2]], fov: mm(o.mm ?? 30), roll: 0 }, o.minY);
};
/** a side-tracking shot: the lens travels parallel to the subject at `offset` m (walking talks, cars on a road),
 * framing it slightly behind center so it moves INTO the frame */
export const sideTrack = (o: Common & { subject: Track; offset?: number; h?: number; lag?: number; lead?: number; side?: 1 | -1; aimH?: number }): CamPath => (t) => {
  const s = lagged(o.subject, t, o.lag ?? 0.25);
  const hd = heading(o.subject, t);
  const sd = o.side ?? 1;
  const off = o.offset ?? 5;
  const pos: V3 = [s[0] + Math.cos(hd) * off * sd, s[1] + (o.h ?? 1.3), s[2] - Math.sin(hd) * off * sd];
  const ahead = at(o.subject, t + (o.lead ?? 0.3));
  return guard({ pos, look: [ahead[0], ahead[1] + (o.aimH ?? 1), ahead[2]], fov: mm(o.mm ?? 35), roll: 0 }, o.minY);
};
/** a chase/tracking shot of a vehicle: low behind a bumper, wide lens, slight sway */
export const chase = (o: Common & { subject: Track; dist?: number; h?: number }): CamPath => (t) => {
  const c = follow({ ...o, dist: o.dist ?? 7.5, h: o.h ?? 1.4, lag: 0.22, lead: 0.8, side: 8, mm: o.mm ?? 24, aimH: 0.8 })(t);
  return { ...c, roll: 1.2 * Math.sin(t * 0.9) };
};

// ------------------------------------------------------------------ people: close-ups, over-the-shoulder, POV
/** a reaction close-up: head and shoulders, 3/4, a short settle-in push (6% in 0.5 s) so it lands on the face */
export const reaction = (o: Common & { head: Track; facing: number; side?: number; dist?: number }): CamPath => (t) => {
  const u = EASE.out(clamp((t - (o.t0 ?? 0)) / (o.dur ?? 0.5)), 3);
  const h = at(o.head, t);
  const d = (o.dist ?? 2.4) * (1 - 0.06 * u); // 2.4 m at 70 mm ≈ head and shoulders
  return aim(around(h, o.facing + (o.side ?? 28) * D2R, d, 0.05), h, mm(o.mm ?? 70), o.face ?? 0.38);
};
/** over the shoulder of A toward B: A's shoulder soft at a lower corner, B's face at ~38% */
export const overShoulder = (o: Common & { from: Track; to: Track; heightA?: number; side?: 1 | -1; back?: number }): CamPath => (t) => {
  const A = at(o.from, t);
  const B = at(o.to, t);
  const dir = sub(B, A);
  const L = Math.hypot(dir[0], dir[2]) || 1;
  const fx = dir[0] / L;
  const fz = dir[2] / L;
  const s = o.side ?? 1;
  const hA = o.heightA ?? 1.7;
  const pos: V3 = [A[0] - fx * (o.back ?? 0.9) + fz * 0.45 * s, A[1] + hA * 0.92, A[2] - fz * (o.back ?? 0.9) - fx * 0.45 * s];
  const look: V3 = [B[0], B[1] + hA * 0.86, B[2]];
  return aim(pos, look, mm(o.mm ?? 50), o.face ?? 0.38);
};
/** first person: from a head, looking at a target, with a walk bob tied to `walkPhase` (or a breath when still) */
export const pov = (o: Common & { eye: Track; look: Track; walkPhase?: number | ((t: number) => number) }): CamPath => (t) => {
  const e = at(o.eye, t);
  const ph = typeof o.walkPhase === "function" ? o.walkPhase(t) : o.walkPhase;
  const bob = ph !== undefined ? Math.abs(Math.sin(ph)) * 0.035 : Math.sin(t * 1.4) * 0.006;
  const sway = ph !== undefined ? Math.sin(ph) * 0.6 : 0;
  return { pos: [e[0], e[1] + bob, e[2]], look: at(o.look, t), fov: mm(o.mm ?? 24), roll: sway };
};
/** inside a vehicle: the driver's eye, attached to the car's transform (pos, yaw), looking down the road */
export const inCar = (o: Common & { car: (t: number) => { pos: V3; yaw: number }; seat?: V3; ahead?: number }): CamPath => (t) => {
  const c = o.car(t);
  const [sx, sy, sz] = o.seat ?? [0.38, 1.22, -0.62]; // driver eye: ~0.75 m behind the wheel, just under the roof
  const cs = Math.cos(c.yaw);
  const sn = Math.sin(c.yaw);
  const pos: V3 = [c.pos[0] + sx * cs + sz * sn, c.pos[1] + sy, c.pos[2] - sx * sn + sz * cs];
  const a = o.ahead ?? 20;
  return { pos, look: [pos[0] + sn * a, pos[1] - 0.7, pos[2] + cs * a], fov: mm(o.mm ?? 22), roll: 0.4 * Math.sin(t * 2.1) };
};

// ------------------------------------------------------------------ dynamic action
/** an action shot: a low wide lens sliding sideways past the event with a roll into the motion and a decaying shake
 * from `impact` (s). Crashes, falls, collapses: one per film act, not a habit. */
export const action = (o: Common & { target: Track; ang?: number; dist?: number; slide?: number; impact?: number; shake?: number }): CamPath => (t) => {
  const u = prog({ ease: "inOut", power: 2, ...o }, t);
  const tg = at(o.target, t);
  const a = (o.ang ?? 0.9) + ((o.slide ?? 30) * D2R * (u - 0.5));
  const base = aim(around(tg, a, o.dist ?? 7, 0.6), add(tg, [0, 0.9, 0]), mm(o.mm ?? 20), o.face ?? 0.45);
  let roll = -4 * (u - 0.5);
  let pos = base.pos;
  if (o.impact !== undefined && t >= o.impact) {
    const s = t - o.impact;
    const k = (o.shake ?? 1) * Math.exp(-s * 5);
    pos = add(pos, [Math.sin(s * 47) * 0.06 * k, Math.sin(s * 39 + 1) * 0.05 * k, 0]);
    roll += Math.sin(s * 31) * 2.5 * k;
  }
  return guard({ ...base, pos, roll }, o.minY);
};

// ------------------------------------------------------------------ transitions between two camera paths
/** a camera-move transition: ease from path A to path B over [t0, t0+dur] (position, look and lens all blend);
 * use it to travel between environments without a cut (route it past something so mid-move never frames empty sky) */
export const blend = (A: CamPath, B: CamPath, t0: number, dur = 1, power = 3): CamPath => (t) => {
  const u = EASE.inOut(clamp((t - t0) / dur), power);
  if (u <= 0) return A(t);
  if (u >= 1) return B(t);
  const a = A(t);
  const b = B(t);
  // look distance kept, so the look point doesn't swing through the lens
  return { pos: mixV(a.pos, b.pos, u), look: mixV(a.look, b.look, u), fov: lerp(a.fov, b.fov, u), roll: lerp(a.roll ?? 0, b.roll ?? 0, u) };
};
/** a whip pan: A pans fast off its subject, the cut happens at peak blur, B arrives panning in the same direction
 * (render with motion blur; pair with a whoosh SFX) */
export const whip = (A: CamPath, B: CamPath, tCut: number, half = 0.16, deg = 35): CamPath => (t) => {
  const yawOff = (c: Cam, d: number): Cam => {
    const v = sub(c.look, c.pos);
    const a = d * D2R;
    const r: V3 = [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
    return { ...c, look: add(c.pos, r) };
  };
  if (t < tCut - half) return A(t);
  if (t < tCut) return yawOff(A(t), -deg * EASE.in((t - (tCut - half)) / half, 3));
  if (t < tCut + half) return yawOff(B(t), deg * (1 - EASE.out((t - tCut) / half, 3)));
  return B(t);
};
/** a sequence of paths by start time: [[t0, path], ...] (hard cuts; Shorts prefer blend / whip between them) */
export const sequence = (parts: [number, CamPath][]): CamPath => (t) => {
  let p = parts[0][1];
  for (const [tk, path] of parts) if (t >= tk) p = path;
  return p(t);
};

/** distance from lens to look point: use it to check framing distance in the plan stats */
export const camDist = (c: Cam) => len(sub(c.look, c.pos));

export const PRESETS = { establish, reveal, push, slowPush, fastPush, pullBack, orbit, overhead, lowAngle, follow, sideTrack, chase, reaction, overShoulder, pov, inCar, action };
export type PresetName = keyof typeof PRESETS;
