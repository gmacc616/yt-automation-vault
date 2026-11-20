// Procedural trees with real structure: a curved, tapering trunk that splits into branches (2-3 levels), foliage as
// lumpy clumps at the branch ends (toon banding + ink on each clump silhouette reads as hand-drawn leaf masses), and
// a few sky gaps so light falls through. Clumps cast shadows → dappled light on the ground under the crown.
// Wind moves the clumps (and the branch tips a little) as a pure function of t. Same seed → same tree in every tab.
//   <Tree kind="oak" p={onGround(T, 4, -12)} seed={3} t={t} />    kinds: oak (broad), round, pine, birch, acacia (flat umbrella)
//   <Bush p={...} seed={2} />                                        a low clump cluster for verges and gardens
import React, { useMemo } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { taperTube } from "../char/geometry";
import { toonMaterial } from "../mat/materials";
import type { V3 } from "../types";
import { mix } from "../util";
import { noise2, rng, wind } from "./noise";

export type TreeKind = "oak" | "round" | "pine" | "birch" | "acacia";
type Limb = { pts: THREE.Vector3[]; r0: number; r1: number };
type Clump = { c: THREE.Vector3; r: number; shade: number };
type TreeData = { limbs: Limb[]; clumps: Clump[]; height: number };

const lumpCache = new Map<string, THREE.BufferGeometry>();
/** a lumpy foliage blob: an icosphere pushed out by smooth noise (seeded), flat-ish base */
const lumpGeo = (anySeed: number) => {
  // 6 variants; the shape depends only on the variant, so the cache can never differ between render tabs
  const seed = ((anySeed % 6) + 6) % 6;
  const k = `${seed}`;
  const hit = lumpCache.get(k);
  if (hit) return hit;
  // indexed (merged) so normals are smooth: a non-indexed icosphere shades as flat facets
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 12).deleteAttribute("normal").deleteAttribute("uv"));
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    // two octaves: broad lobes + small leaf bunches on the surface
    const n = noise2(v.x * 2.2 + v.z * 1.3 + seed, v.y * 2.2 + seed * 0.7, seed) * 0.75 + noise2(v.x * 6.5 - v.z * 4.1, v.y * 6.5 + v.z * 3.3, seed + 3) * 0.25;
    const r = 0.8 + n * 0.4;
    v.multiplyScalar(r);
    if (v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.4; // flatter underside
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  lumpCache.set(k, g);
  return g;
};

const grow = (kind: TreeKind, seed: number, H: number): TreeData => {
  const R = rng(seed * 31 + 7);
  const limbs: Limb[] = [];
  const clumps: Clump[] = [];
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  if (kind === "pine") {
    limbs.push({ pts: [V(0, 0, 0), V(0.05, H * 0.5, 0), V(0, H * 0.95, 0)], r0: H * 0.035, r1: H * 0.008 });
    const tiers = 6;
    for (let i = 0; i < tiers; i++) {
      const u = i / tiers;
      // pine tiers are flattened clumps getting smaller toward the top
      clumps.push({ c: V(0, H * (0.28 + u * 0.66), 0), r: H * (0.26 - u * 0.034), shade: u });
    }
    return { limbs, clumps, height: H };
  }
  if (kind === "acacia") {
    // savanna/desert acacia: a short trunk that forks low into 3-4 long limbs leaning outward, and a FLAT umbrella
    // crown of wide, thin leaf pads at one height
    const tt = H * 0.3;
    const lean0 = (R() - 0.5) * 0.12 * H;
    const trunk = [V(0, 0, 0), V(lean0 * 0.4, tt * 0.5, 0), V(lean0, tt, (R() - 0.5) * 0.06 * H)];
    const r0 = H * 0.06;
    limbs.push({ pts: trunk, r0, r1: r0 * 0.7 });
    const n = 3 + Math.floor(R() * 2);
    const crownY = H * 0.86;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R() * 0.7;
      const reach = H * (0.32 + R() * 0.14);
      const end = V(trunk[2].x + Math.sin(a) * reach, crownY - H * 0.06, trunk[2].z + Math.cos(a) * reach);
      const mid = trunk[2].clone().lerp(end, 0.5).add(V(0, H * 0.08, 0));
      limbs.push({ pts: [trunk[2].clone(), mid, end], r0: r0 * 0.62, r1: r0 * 0.3 });
      // pads along the limb's top end, overlapping into one flat canopy
      for (let k = 0; k < 3; k++) {
        const u = 0.55 + k * 0.22;
        const c = trunk[2].clone().lerp(end, u);
        clumps.push({ c: V(c.x + (R() - 0.5) * H * 0.08, crownY + (R() - 0.5) * H * 0.04, c.z + (R() - 0.5) * H * 0.08), r: H * (0.17 + R() * 0.06), shade: R() });
      }
    }
    clumps.push({ c: V(trunk[2].x, crownY + H * 0.02, trunk[2].z), r: H * 0.24, shade: 0.5 });
    return { limbs, clumps, height: H };
  }
  const trunkTop = H * (kind === "birch" ? 0.55 : kind === "round" ? 0.42 : 0.38);
  const lean = (R() - 0.5) * 0.18 * H;
  const trunk = [V(0, 0, 0), V(lean * 0.3, trunkTop * 0.45, (R() - 0.5) * 0.1 * H), V(lean, trunkTop, (R() - 0.5) * 0.12 * H)];
  const r0 = H * (kind === "birch" ? 0.03 : 0.055);
  limbs.push({ pts: trunk, r0, r1: r0 * 0.62 });
  const branch = (from: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
    const end = from.clone().addScaledVector(dir, len);
    const mid = from.clone().lerp(end, 0.5).add(V((R() - 0.5) * len * 0.25, len * 0.08, (R() - 0.5) * len * 0.25));
    limbs.push({ pts: [from, mid, end], r0: r, r1: r * 0.55 });
    if (depth === 0) {
      const cr = len * (kind === "round" ? 1.05 : 0.9) * (0.85 + R() * 0.3);
      const c0 = end.clone().add(V(0, cr * 0.25, 0));
      clumps.push({ c: c0, r: cr, shade: R() });
      // satellite leaf masses break the silhouette into many small lobes (reads as foliage, not balls on sticks)
      for (let k = 0; k < 3; k++) {
        const a = R() * Math.PI * 2;
        const off = cr * (0.55 + R() * 0.25);
        clumps.push({ c: c0.clone().add(V(Math.sin(a) * off, (R() - 0.3) * cr * 0.5, Math.cos(a) * off)), r: cr * (0.42 + R() * 0.2), shade: R() });
      }
      return;
    }
    const kids = depth === 2 ? 2 + Math.floor(R() * 2) : 2;
    for (let i = 0; i < kids; i++) {
      const a = R() * Math.PI * 2;
      const up = kind === "oak" ? 0.35 + R() * 0.4 : 0.6 + R() * 0.35;
      const d = dir.clone().multiplyScalar(0.5).add(V(Math.sin(a) * (1 - up), up, Math.cos(a) * (1 - up))).normalize();
      branch(end, d, len * (0.62 + R() * 0.14), r * 0.58, depth - 1);
    }
  };
  const top = trunk[2];
  const main = kind === "oak" ? 4 : 3;
  for (let i = 0; i < main; i++) {
    const a = (i / main) * Math.PI * 2 + R() * 0.8;
    const up = kind === "oak" ? 0.45 + R() * 0.25 : 0.7 + R() * 0.2;
    const d = V(Math.sin(a) * (1 - up), up, Math.cos(a) * (1 - up)).normalize();
    branch(top, d, H * (kind === "oak" ? 0.3 : 0.24), r0 * 0.6, 2);
  }
  // a core clump fills the crown center so it never reads as separate balls on sticks
  clumps.push({ c: top.clone().add(V(0, H * 0.28, 0)), r: H * (kind === "oak" ? 0.3 : 0.26), shade: 0.5 });
  return { limbs, clumps, height: H };
};

const treeCache = new Map<string, { data: TreeData; geos: THREE.BufferGeometry[] }>();
const treeOf = (kind: TreeKind, seed: number, H: number) => {
  const key = `${kind}|${seed}|${H}`;
  let hit = treeCache.get(key);
  if (!hit) {
    if (treeCache.size > 40) treeCache.clear();
    const data = grow(kind, seed, H);
    const geos = data.limbs.map((l) => taperTube(l.pts, l.r0, l.r1, 12, 8));
    hit = { data, geos };
    treeCache.set(key, hit);
  }
  return hit;
};

export type TreeProps = {
  p: V3;
  kind?: TreeKind;
  /** total height (m); oaks 8-14, pines 10-18, roadside round trees 5-8 */
  height?: number;
  seed?: number;
  yaw?: number;
  t?: number;
  windStrength?: number;
  leaf?: [string, string, string];
  bark?: string;
  /** reaction to an impact: a decaying shake that starts at this time (s) */
  hitAt?: number;
};

const LEAF: Record<TreeKind, [string, string, string]> = {
  oak: ["#3f8f2e", "#5aac36", "#7cc443"],
  round: ["#4a9a32", "#68b83c", "#8ccd4a"],
  pine: ["#1f6a3a", "#2c7e44", "#3f9450"],
  birch: ["#6fb83c", "#8ccc48", "#a8dc5a"],
  acacia: ["#5e7f32", "#76963c", "#90ad4a"],
};

export const Tree: React.FC<TreeProps> = ({ p, kind = "oak", height = 10, seed = 1, yaw = 0, t = 0, windStrength = 1, leaf, bark, hitAt }) => {
  const { data, geos } = treeOf(kind, seed, height);
  const L = leaf ?? LEAF[kind];
  const barkC = bark ?? (kind === "birch" ? "#e8e4da" : "#6a4a32");
  const barkM = toonMaterial({ color: barkC, tex: kind === "birch" ? "plaster" : "wood", texScale: 1.6 });
  const hit = hitAt !== undefined && t >= hitAt ? Math.exp(-(t - hitAt) * 2.2) * Math.sin((t - hitAt) * 14) * 0.06 : 0;
  // a painted leaf texture (the grass paint at a large scale) gives the masses a dappled, hand-painted surface
  const leafMats = useMemo(() => L.map((c) => toonMaterial({ color: c, tex: "grass", texScale: 2.4 })), [L[0], L[1], L[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group position={p} rotation={[hit, yaw, hit * 0.5]}>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={barkM} castShadow receiveShadow />
      ))}
      {data.clumps.map((c, i) => {
        const w = wind(p[0] + c.c.x, p[2] + c.c.z, t, windStrength) * (c.c.y / data.height);
        const sx = c.r * (kind === "pine" ? 1 : kind === "acacia" ? 1.25 : 1.08);
        const sy = c.r * (kind === "pine" ? 0.42 : kind === "acacia" ? 0.3 : 0.78);
        const shade = c.shade < 0.33 ? 0 : c.shade < 0.7 ? 1 : 2;
        return (
          <mesh
            key={`c${i}`}
            geometry={lumpGeo(seed + i)}
            material={leafMats[shade]}
            position={[c.c.x + w * c.c.y * 0.6, c.c.y, c.c.z + w * c.c.y * 0.3]}
            rotation={[w * 0.6, i * 1.7, w * 0.4]}
            scale={[sx, sy, sx]}
            castShadow
            receiveShadow
          />
        );
      })}
    </group>
  );
};

/** a low shrub: 3-6 lumps hugging the ground */
export const Bush: React.FC<{ p: V3; size?: number; seed?: number; color?: string; t?: number }> = ({ p, size = 1, seed = 1, color = "#4f9a34", t = 0 }) => {
  const R = rng(seed * 13 + 5);
  const n = 3 + Math.floor(R() * 4);
  const shades = [color, mix(color, "#000000", 0.18), mix(color, "#fff8c0", 0.2)];
  return (
    <group position={p}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + R();
        const r = size * (0.35 + R() * 0.3);
        const d = i === 0 ? 0 : size * 0.35;
        const w = wind(p[0], p[2], t, 0.5);
        return (
          <mesh
            key={i}
            geometry={lumpGeo(seed + i * 3)}
            material={toonMaterial({ color: shades[i % 3] })}
            position={[Math.sin(a) * d + w * 0.2, r * 0.62, Math.cos(a) * d]}
            scale={[r, r * 0.8, r]}
            castShadow
            receiveShadow
          />
        );
      })}
    </group>
  );
};

/** scatter positions for a tree line or orchard (deterministic), skipping zones; returns [x, z, seed] */
export const scatter = (n: number, area: { x0: number; z0: number; x1: number; z1: number }, seed: number, minGap = 3, avoid: { x0: number; z0: number; x1: number; z1: number }[] = []) => {
  const R = rng(seed);
  const out: [number, number, number][] = [];
  for (let k = 0; k < n * 12 && out.length < n; k++) {
    const x = area.x0 + R() * (area.x1 - area.x0);
    const z = area.z0 + R() * (area.z1 - area.z0);
    if (avoid.some((a) => x > a.x0 && x < a.x1 && z > a.z0 && z < a.z1)) continue;
    if (out.some(([px, pz]) => Math.hypot(px - x, pz - z) < minGap)) continue;
    out.push([x, z, Math.floor(R() * 1000)]);
  }
  return out;
};
