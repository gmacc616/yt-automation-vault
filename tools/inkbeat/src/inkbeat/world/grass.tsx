// Instanced grass: tufts of tapered, bent blades on a fixed world grid (cells never move, so nothing shimmers),
// placed only near the lens (density thins with distance, tufts GROW in at the edge of the radius instead of popping),
// swaying in a slow wind field (≤ 0.5 Hz, under the strobing limit). Blades skip the ink pass (thousands of thin
// blades would ink as noise): the painted terrain carries the far field, tufts carry the near and middle ground.
// Use `exclude` for roads, paths and floors; `heightAt` (terrain.tsx) so tufts sit on rolling ground.
import React, { useMemo } from "react";
import * as THREE from "three";
import { toonMaterial } from "../mat/materials";
import type { V3 } from "../types";
import { hash2, wind } from "./noise";
import type { FlatZone } from "./terrain";

const tuftCache = new Map<string, THREE.BufferGeometry>();
/** one tuft: `n` blades in a small ring, each a tapered strip of 3 segments bending outward; root dark → tip light */
const tuftGeo = (n = 7, seed = 0) => {
  const key = `${n}|${seed}`;
  const hit = tuftCache.get(key);
  if (hit) return hit;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const root = new THREE.Color("#a8b890").convertSRGBToLinear();
  const tip = new THREE.Color("#ffffff").convertSRGBToLinear();
  for (let b = 0; b < n; b++) {
    const a = (b / n) * Math.PI * 2 + hash2(b, seed) * 1.2;
    const r0 = 0.03 + hash2(b, seed + 1) * 0.05;
    const h = 0.55 + hash2(b, seed + 2) * 0.55;
    const bend = 0.18 + hash2(b, seed + 3) * 0.25;
    const w = 0.035 + hash2(b, seed + 4) * 0.02;
    const ox = Math.sin(a);
    const oz = Math.cos(a);
    const px = Math.cos(a); // blade width direction (perpendicular to the lean)
    const pz = -Math.sin(a);
    const base = pos.length / 3;
    const S = 3;
    for (let s = 0; s <= S; s++) {
      const u = s / S;
      const lean = bend * u * u;
      const cx = ox * (r0 + lean);
      const cz = oz * (r0 + lean);
      const y = h * u * (1 - 0.15 * u);
      const hw = s === S ? 0 : w * (1 - u * 0.85);
      pos.push(cx - px * hw, y, cz - pz * hw, cx + px * hw, y, cz + pz * hw);
      const c = root.clone().lerp(tip, Math.pow(u, 0.8));
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (s < S) {
        const i = base + s * 2;
        idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // blades light like the ground below them (up normals), so tufts never read as dark speckle against the field
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  if (tuftCache.size > 16) tuftCache.clear();
  tuftCache.set(key, g);
  return g;
};

export type GrassProps = {
  /** the ground point the field is centered on (usually the subject's feet or the look point) */
  center: V3;
  /** blades appear within this radius (m); keep it ~1.2× the farthest point where tufts still read */
  radius?: number;
  /** grid cell (m): one tuft candidate per cell; 0.35-0.6 */
  cell?: number;
  /** 0..1 at the center; thins to ~25% at the radius */
  density?: number;
  /** tuft height scale (1 ≈ 0.6-1.1 m blades after the scale range; use 0.35-0.6 for lawns, 0.7-1 for meadows) */
  height?: number;
  colors?: string[];
  exclude?: FlatZone[];
  heightAt?: (x: number, z: number) => number;
  t: number;
  windStrength?: number;
  seed?: number;
  /** hard cap on instances (memory and render time) */
  max?: number;
};

const inZone = (x: number, z: number, zs: FlatZone[]) => zs.some((f) => x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1);
const M4 = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const E = new THREE.Euler();
const P = new THREE.Vector3();
const S = new THREE.Vector3();
const C = new THREE.Color();

export const GrassField: React.FC<GrassProps> = ({ center, radius = 14, cell = 0.45, density = 0.85, height = 0.55, colors = ["#5fae3a", "#74bf42", "#4e9a34", "#8cc94c"], exclude = [], heightAt, t, windStrength = 1, seed = 7, max = 24000 }) => {
  const geo = tuftGeo(11, seed);
  const mat = toonMaterial({ color: "#ffffff", vertexColors: true, side: THREE.DoubleSide });
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, max);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = false;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.userData.outline = false;
    return m;
  }, [geo, mat, max]);
  // a fixed world grid: cell (i, j) always holds the same tuft
  const i0 = Math.floor((center[0] - radius) / cell);
  const i1 = Math.ceil((center[0] + radius) / cell);
  const j0 = Math.floor((center[2] - radius) / cell);
  const j1 = Math.ceil((center[2] + radius) / cell);
  let n = 0;
  for (let i = i0; i <= i1 && n < max; i++) {
    for (let j = j0; j <= j1 && n < max; j++) {
      const x = (i + hash2(i, j, seed)) * cell;
      const z = (j + hash2(j, i, seed + 1)) * cell;
      const d = Math.hypot(x - center[0], z - center[2]);
      if (d > radius) continue;
      const keep = density * (1 - 0.75 * (d / radius));
      if (hash2(i, j, seed + 2) > keep) continue;
      if (inZone(x, z, exclude)) continue;
      const grow = Math.min(1, (radius - d) / (radius * 0.18)); // grows in at the edge instead of popping
      const s = height * (0.6 + hash2(i, j, seed + 3) * 0.7) * grow;
      const sway = wind(x, z, t, windStrength);
      E.set(sway, hash2(i, j, seed + 4) * Math.PI * 2, sway * 0.6);
      Q.setFromEuler(E);
      P.set(x, heightAt ? heightAt(x, z) : center[1], z);
      S.set(s, s, s);
      M4.compose(P, Q, S);
      mesh.setMatrixAt(n, M4);
      C.set(colors[Math.floor(hash2(i, j, seed + 5) * colors.length) % colors.length]);
      mesh.setColorAt(n, C);
      n++;
    }
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return <primitive object={mesh} />;
};

// ------------------------------------------------------------------ flowers / small clutter (instanced, static)
export const Flowers: React.FC<{ center: V3; radius?: number; count?: number; colors?: string[]; exclude?: FlatZone[]; heightAt?: (x: number, z: number) => number; seed?: number }> = ({
  center,
  radius = 10,
  count = 120,
  colors = ["#ffd21a", "#ffffff", "#ff4a8a", "#9a5cff"],
  exclude = [],
  heightAt,
  seed = 11,
}) => {
  const geo = useMemo(() => new THREE.IcosahedronGeometry(0.032, 1), []);
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, toonMaterial({ color: "#ffffff" }), count);
    m.userData.outline = false;
    m.frustumCulled = false;
    let n = 0;
    for (let k = 0; k < count * 3 && n < count; k++) {
      const a = hash2(k, seed) * Math.PI * 2;
      const r = Math.sqrt(hash2(seed, k)) * radius;
      const x = center[0] + Math.sin(a) * r;
      const z = center[2] + Math.cos(a) * r;
      if (inZone(x, z, exclude)) continue;
      P.set(x, (heightAt ? heightAt(x, z) : center[1]) + 0.18 + hash2(k, seed + 2) * 0.12, z);
      M4.compose(P, Q.identity(), S.set(1, 0.7, 1));
      m.setMatrixAt(n, M4);
      m.setColorAt(n, C.set(colors[k % colors.length]));
      n++;
    }
    m.count = n;
    return m;
  }, [geo, count, radius, seed, center[0], center[1], center[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  return <primitive object={mesh} />;
};
