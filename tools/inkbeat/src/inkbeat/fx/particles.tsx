// Physical, deterministic effects (every particle is a closed-form function of t: no simulation state, identical in
// every render tab). Toon-shaded solids, not soft sprites, so they sit in the inked look:
//   Burst      debris / dust / sparks / leaves from an impact at t0: velocity cone, gravity, drag, ground bounce,
//              tumbling; dust puffs grow and dissolve; sparks are short unlit streaks
//   Rain       world-anchored streaks around the lens (they don't slide with the camera), optional ground splashes
//   Shockwave  a ground ring that races out and fades
//   FallingLeaves  leaves drifting and fluttering down through a volume
// Effects follow the story: an impact gets debris + dust + a shake on the same frame (and its SFX), not decoration.
import React, { useMemo } from "react";
import * as THREE from "three";
import { coreMat, torG } from "../core/kit";
import { toonMaterial } from "../mat/materials";
import type { V3 } from "../types";
import { hash2 } from "../world/noise";

const M4 = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const P = new THREE.Vector3();
const S = new THREE.Vector3();
const C = new THREE.Color();
const UPV = new THREE.Vector3(0, 1, 0);

const geoms = {
  debris: () => new THREE.BoxGeometry(1, 0.6, 0.8),
  dust: () => new THREE.IcosahedronGeometry(1, 1),
  spark: () => new THREE.BoxGeometry(0.15, 0.15, 1),
  leaf: () => {
    const g = new THREE.CircleGeometry(1, 6);
    g.scale(0.55, 1, 1);
    return g;
  },
};
const geoCache = new Map<string, THREE.BufferGeometry>();
const geoOf = (k: keyof typeof geoms) => {
  let g = geoCache.get(k);
  if (!g) {
    g = geoms[k]();
    geoCache.set(k, g);
  }
  return g;
};

export type BurstKind = "debris" | "dust" | "sparks" | "leaves";
export type BurstProps = {
  kind: BurstKind;
  /** impact time (s) and place */
  t0: number;
  t: number;
  at: V3;
  /** main direction (not normalized is fine) and cone spread (0 = a jet, 1 = a hemisphere) */
  dir?: V3;
  spread?: number;
  n?: number;
  /** launch speed range (m/s) */
  speed?: [number, number];
  /** particle size range (m) */
  size?: [number, number];
  colors?: string[];
  /** seconds each particle lives (dust and sparks fade by shrinking) */
  life?: number;
  gravity?: number;
  groundY?: number;
  seed?: number;
};

const DEFAULTS: Record<BurstKind, Partial<BurstProps>> = {
  debris: { n: 26, speed: [3, 8], size: [0.06, 0.2], colors: ["#7a5a3a", "#9a7a52", "#5a4a3a", "#c8b8a0"], life: 3.0, gravity: 9.8, spread: 0.7 },
  dust: { n: 14, speed: [0.6, 2.2], size: [0.15, 0.35], colors: ["#a8957a", "#8f7e68", "#bcab90"], life: 1.6, gravity: -0.3, spread: 1 },
  sparks: { n: 30, speed: [4, 10], size: [0.02, 0.04], colors: ["#ffd060", "#ffb030", "#fff0a0"], life: 0.55, gravity: 9.8, spread: 0.8 },
  leaves: { n: 24, speed: [1, 3.5], size: [0.06, 0.1], colors: ["#5aac36", "#7cc443", "#3f8f2e"], life: 4.0, gravity: 1.6, spread: 1 },
};

export const Burst: React.FC<BurstProps> = (props) => {
  const o = { ...DEFAULTS[props.kind], ...props } as Required<BurstProps>;
  const { kind, t0, t, at, n, seed = 1 } = o;
  const dir = new THREE.Vector3(...(o.dir ?? [0, 1, 0])).normalize();
  const groundY = o.groundY ?? at[1];
  const geo = geoOf(kind === "sparks" ? "spark" : kind === "leaves" ? "leaf" : kind === "dust" ? "dust" : "debris");
  const mat = useMemo(() => (kind === "sparks" ? coreMat("#ffffff", 1.1) : toonMaterial({ color: "#ffffff", side: kind === "leaves" ? THREE.DoubleSide : THREE.FrontSide })), [kind]);
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.frustumCulled = false;
    m.castShadow = kind === "debris" || kind === "dust";
    m.userData.outline = kind === "debris" || kind === "dust" ? undefined : false;
    return m;
  }, [geo, mat, n, kind]);
  const s = t - t0;
  let shown = 0;
  if (s >= 0) {
    // a basis around `dir` for the cone
    const ax = Math.abs(dir.y) < 0.9 ? UPV : new THREE.Vector3(1, 0, 0);
    const b1 = new THREE.Vector3().crossVectors(dir, ax).normalize();
    const b2 = new THREE.Vector3().crossVectors(dir, b1);
    for (let i = 0; i < n; i++) {
      const delay = hash2(i, seed + 9) * (kind === "dust" ? 0.15 : 0.04);
      const a = s - delay;
      const life = o.life * (0.7 + hash2(i, seed + 8) * 0.6);
      if (a < 0 || a > life) continue;
      const th = hash2(i, seed) * Math.PI * 2;
      const sp = o.spread * Math.sqrt(hash2(i, seed + 1));
      const v = new THREE.Vector3().copy(dir).multiplyScalar(Math.sqrt(Math.max(0, 1 - sp * sp))).addScaledVector(b1, Math.cos(th) * sp).addScaledVector(b2, Math.sin(th) * sp);
      const spd = o.speed[0] + (o.speed[1] - o.speed[0]) * hash2(i, seed + 2);
      v.multiplyScalar(spd);
      // drag: v(t) = v0·e^(-k t)  →  x = v0 (1 - e^(-k t)) / k ; gravity added as a plain parabola (cartoon physics)
      const k = kind === "dust" ? 2.4 : kind === "leaves" ? 1.6 : 0.35;
      const f = (1 - Math.exp(-k * a)) / k;
      let x = at[0] + v.x * f;
      let y = at[1] + v.y * f - 0.5 * o.gravity * a * a * (kind === "leaves" ? 0.15 : 1);
      let z = at[2] + v.z * f;
      if (kind === "leaves") {
        x += Math.sin(a * 2.2 + i) * 0.4;
        z += Math.cos(a * 1.7 + i) * 0.3;
        y = Math.max(y, groundY + 0.01);
      }
      if (kind === "debris" && y < groundY) {
        // one damped bounce, then rest on the ground (it stays: debris doesn't vanish)
        y = groundY + Math.abs(Math.sin(a * 6)) * Math.exp(-a * 3) * 0.15 + 0.03;
      }
      if (kind === "sparks" && y < groundY) y = groundY + 0.01;
      const size = o.size[0] + (o.size[1] - o.size[0]) * hash2(i, seed + 3);
      let sc = size;
      if (kind === "dust") sc = size * (0.4 + 1.6 * Math.min(1, a / 0.5)) * (1 - Math.pow(a / life, 2.5));
      if (kind === "sparks") sc = size * (1 - a / life);
      const resting = kind === "debris" && y <= groundY + 0.04 && a > 0.4;
      const spin = resting ? hash2(i, seed + 4) * 6 : a * (6 + hash2(i, seed + 5) * 10);
      if (kind === "sparks") {
        const vel = new THREE.Vector3(v.x * Math.exp(-k * a), v.y * Math.exp(-k * a) - o.gravity * a, v.z * Math.exp(-k * a));
        Q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vel.normalize());
        S.set(sc, sc, Math.max(0.05, sc * 10));
      } else {
        E.set(spin, spin * 0.7 + i, kind === "leaves" ? Math.sin(a * 5 + i) : spin * 0.3);
        Q.setFromEuler(E);
        S.set(sc, sc, sc);
      }
      P.set(x, y, z);
      M4.compose(P, Q, S);
      mesh.setMatrixAt(shown, M4);
      mesh.setColorAt(shown, C.set(o.colors[i % o.colors.length]));
      shown++;
    }
  }
  mesh.count = shown;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return <primitive object={mesh} />;
};

/** a dust kick on each footstep / tyre touch: small low puffs (pass the step times from anim/motion.ts footsteps()) */
export const StepDust: React.FC<{ steps: { t: number; at: V3 }[]; t: number; color?: string; size?: number }> = ({ steps, t, color = "#d8c8a8", size = 0.6 }) => (
  <>
    {steps
      .filter((s) => t >= s.t && t < s.t + 1.2)
      .map((s, i) => (
        <Burst key={i} kind="dust" t0={s.t} t={t} at={s.at} dir={[0, 0.3, 0]} n={4} speed={[0.3, 0.8]} size={[0.06 * size, 0.14 * size]} colors={[color]} life={0.9} seed={Math.round(s.t * 100)} />
      ))}
  </>
);

export type RainProps = {
  cam: V3;
  t: number;
  /** drops in the volume (3000 light, 6000 heavy) */
  n?: number;
  /** the volume around the lens (m) */
  box?: number;
  speed?: number;
  /** wind slant (m/s sideways) */
  slant?: number;
  groundY?: number;
  color?: string;
  splashes?: number;
};
/** rain: streaks fixed in WORLD space inside a box that wraps around the lens (moving the camera moves through the
 * rain, the rain does not move with the camera); length tied to fall speed per frame so motion blur reads right */
export const Rain: React.FC<RainProps> = ({ cam, t, n = 4000, box = 24, speed = 9, slant = 1.2, groundY = 0, color = "#b8c8e8", splashes = 260 }) => {
  const geo = useMemo(() => new THREE.BoxGeometry(0.012, 0.42, 0.012), []);
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, coreMat(color, 0.55, 0.6), n);
    m.frustumCulled = false;
    m.userData.outline = false;
    return m;
  }, [geo, n, color]);
  const ringGeo = torG(0.07, 0.01);
  const rings = useMemo(() => {
    const m = new THREE.InstancedMesh(ringGeo, coreMat(color, 0.5, 0.5), splashes);
    m.frustumCulled = false;
    m.userData.outline = false;
    return m;
  }, [ringGeo, splashes, color]);
  const H = 12;
  const wrap = (v: number, c: number) => c - box / 2 + ((((v - c + box / 2) % box) + box) % box);
  const tilt = Math.atan2(slant, speed);
  E.set(0, 0, tilt);
  Q.setFromEuler(E);
  for (let i = 0; i < n; i++) {
    const fall = (t * speed + hash2(i, 3) * H) % H;
    const x0 = hash2(i, 1) * box * 4;
    const z0 = hash2(i, 2) * box * 4;
    const y = groundY + H - fall;
    P.set(wrap(x0 + slant * (fall / speed), cam[0]), y, wrap(z0, cam[2]));
    M4.compose(P, Q, S.set(1, 1, 1));
    mesh.setMatrixAt(i, M4);
  }
  mesh.instanceMatrix.needsUpdate = true;
  let r = 0;
  for (let i = 0; i < splashes; i++) {
    const per = 0.45;
    const ph = ((t + hash2(i, 7) * per) % per) / per;
    const x = wrap(hash2(i, 5) * box * 4, cam[0]);
    const z = wrap(hash2(i, 6) * box * 4, cam[2]);
    if (Math.hypot(x - cam[0], z - cam[2]) > box * 0.45) continue;
    const s = 0.3 + ph * 1.4;
    E.set(Math.PI / 2, 0, 0);
    M4.compose(P.set(x, groundY + 0.01, z), new THREE.Quaternion().setFromEuler(E), S.set(s, s, (1 - ph) * 1.0 + 0.01));
    rings.setMatrixAt(r++, M4);
  }
  rings.count = r;
  rings.instanceMatrix.needsUpdate = true;
  return (
    <>
      <primitive object={mesh} />
      <primitive object={rings} />
    </>
  );
};

/** an expanding ground ring (an impact, a landing, a magic hit) */
export const Shockwave: React.FC<{ at: V3; t0: number; t: number; radius?: number; dur?: number; color?: string }> = ({ at, t0, t, radius = 6, dur = 0.6, color = "#fff4d8" }) => {
  const u = (t - t0) / dur;
  if (u < 0 || u > 1) return null;
  const e = 1 - Math.pow(1 - u, 3);
  const op = Math.round((1 - u) * 10) / 10; // quantized: the core-material cache stays small
  return <mesh geometry={torG(1, 0.04)} material={coreMat(color, 0.9, Math.max(0.1, op))} position={[at[0], at[1] + 0.05, at[2]]} rotation={[Math.PI / 2, 0, 0]} scale={[radius * e, radius * e, 1 + 3 * (1 - u)]} userData={{ outline: false }} />;
};

/** leaves drifting down through a box (autumn, wind, a shaken tree) */
export const FallingLeaves: React.FC<{ center: V3; size?: number; height?: number; n?: number; t: number; colors?: string[] }> = ({ center, size = 10, height = 8, n = 60, t, colors = ["#e0a030", "#c86a2a", "#7cc443"] }) => {
  const geo = geoOf("leaf");
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, toonMaterial({ color: "#ffffff", side: THREE.DoubleSide }), n);
    m.frustumCulled = false;
    m.userData.outline = false;
    return m;
  }, [geo, n]);
  for (let i = 0; i < n; i++) {
    const per = 6 + hash2(i, 4) * 4;
    const ph = ((t + hash2(i, 3) * per) % per) / per;
    const y = center[1] + height * (1 - ph);
    const x = center[0] + (hash2(i, 1) - 0.5) * size + Math.sin(t * 1.3 + i) * 0.6;
    const z = center[2] + (hash2(i, 2) - 0.5) * size + Math.cos(t * 1.1 + i) * 0.4;
    E.set(Math.sin(t * 2.4 + i) * 1.2, t * 0.8 + i, Math.cos(t * 1.9 + i));
    Q.setFromEuler(E);
    M4.compose(P.set(x, y, z), Q, S.set(0.08, 0.08, 0.08));
    mesh.setMatrixAt(i, M4);
    mesh.setColorAt(i, C.set(colors[i % colors.length]));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return <primitive object={mesh} />;
};
