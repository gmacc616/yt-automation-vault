// Ground that reads as land, not a flat plane: gently rolling height (fbm), painted color variation (light and dark
// grass patches, worn dirt), and FLAT ZONES where roads, buildings and the action sit (heights blend to 0 there, so
// feet, wheels and props always meet the ground). `heightAt` is exported so every prop and character can be placed ON
// the terrain. Distant hills/mountains are a separate far layer (`Hills`) with aerial perspective baked into color.
import React, { useMemo } from "react";
import * as THREE from "three";
import { toonMaterial } from "../mat/materials";
import type { V3 } from "../types";
import { mix, smooth } from "../util";
import { fbm, noise2 } from "./noise";

/** an axis-aligned flat zone [x0, z0, x1, z1]; `soft` = blend width in m */
export type FlatZone = { x0: number; z0: number; x1: number; z1: number; soft?: number };
export type TerrainSpec = {
  /** size in m along x and z, centered on `center` */
  size: [number, number];
  center?: [number, number];
  /** height amplitude in m (rolling fields 0.6-1.5, hills 3-8) */
  amp?: number;
  /** feature size in m (bigger = broader swells) */
  scale?: number;
  flat?: FlatZone[];
  seed?: number;
  colors?: { base: string; light: string; dark: string; dirt: string };
  /** grid cells per side (detail); 160 is plenty for 200 m */
  seg?: number;
};

const DEFAULT_COLORS = { base: "#56a238", light: "#7cbd46", dark: "#3e8430", dirt: "#9a7a52" };

const zoneMask = (x: number, z: number, zones: FlatZone[]) => {
  let m = 1;
  for (const f of zones) {
    const s = f.soft ?? 4;
    const dx = Math.max(f.x0 - x, 0, x - f.x1);
    const dz = Math.max(f.z0 - z, 0, z - f.z1);
    m = Math.min(m, smooth(Math.hypot(dx, dz), 0, s));
  }
  return m;
};

/** the ground height at (x, z) for a terrain spec (0 inside flat zones) */
export const heightAt = (spec: TerrainSpec, x: number, z: number) => {
  const amp = spec.amp ?? 1;
  const sc = spec.scale ?? 40;
  const seed = spec.seed ?? 1;
  const h = (fbm(x / sc, z / sc, seed, 4) - 0.5) * 2 * amp;
  return h * zoneMask(x, z, spec.flat ?? []);
};

/** place a point on the terrain */
export const onGround = (spec: TerrainSpec, x: number, z: number, lift = 0): V3 => [x, heightAt(spec, x, z) + lift, z];

const terrainCache = new Map<string, THREE.BufferGeometry>();
const terrainGeo = (spec: TerrainSpec) => {
  const key = JSON.stringify(spec);
  const hit = terrainCache.get(key);
  if (hit) return hit;
  if (terrainCache.size > 12) terrainCache.clear();
  const [W, D] = spec.size;
  const [cx, cz] = spec.center ?? [0, 0];
  const seg = spec.seg ?? 160;
  const g = new THREE.PlaneGeometry(W, D, seg, Math.max(8, Math.round((seg * D) / W)));
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const C = spec.colors ?? DEFAULT_COLORS;
  const seed = spec.seed ?? 1;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx;
    const z = pos.getZ(i) + cz;
    pos.setXYZ(i, x, heightAt(spec, x, z), z);
    // painted variation: broad light/dark patches, a fine mottling, worn dirt only in flat (used) ground edges
    const patch = fbm(x / 9, z / 9, seed + 5, 3);
    const fine = noise2(x * 0.9, z * 0.9, seed + 9);
    let hex = patch > 0.56 ? mix(C.base, C.light, smooth(patch, 0.56, 0.7)) : mix(C.base, C.dark, smooth(0.5 - patch, 0, 0.14));
    hex = mix(hex, C.dark, (fine - 0.5) * 0.25 + 0.05);
    const worn = (1 - zoneMask(x, z, spec.flat ?? [])) * smooth(fbm(x / 3, z / 3, seed + 13, 2), 0.5, 0.75);
    hex = mix(hex, C.dirt, worn * 0.7);
    c.set(hex).convertSRGBToLinear();
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  terrainCache.set(key, g);
  return g;
};

export const Terrain: React.FC<{ spec: TerrainSpec; tex?: boolean }> = ({ spec, tex = true }) => {
  const g = terrainGeo(spec);
  const m = toonMaterial({ color: "#ffffff", vertexColors: true, tex: tex ? "grass" : undefined, texScale: 0.5 });
  return <mesh geometry={g} material={m} receiveShadow />;
};

// ------------------------------------------------------------------ the far layer: hills and mountains
export type HillsSpec = {
  /** distance from `center` to the ridge line (m) */
  radius: number;
  /** ridge height range (m) */
  height: [number, number];
  /** the arc covered (radians, default a full ring), centered on `facing`; a partial ring tapers into the ground */
  arc?: number;
  facing?: number;
  center?: [number, number];
  color: string;
  /** the sky horizon color: the ridge is mixed toward it (aerial perspective, 0..1) */
  haze?: string;
  hazeAmt?: number;
  /** "rolling" = soft hills, "peaks" = sharper mountains with snow caps */
  kind?: "rolling" | "peaks";
  seed?: number;
};

// the far layer carries its own aerial perspective (haze baked into the vertex colors): scene fog would wash it out
let hillsM: THREE.Material | null = null;
const hillsMat = () => {
  if (!hillsM) {
    hillsM = toonMaterial({ color: "#ffffff", vertexColors: true, side: THREE.DoubleSide, seed: 77001 });
    (hillsM as THREE.MeshToonMaterial).fog = false;
  }
  return hillsM;
};
const hillsCache = new Map<string, THREE.BufferGeometry>();
export const Hills: React.FC<{ spec: HillsSpec }> = ({ spec }) => {
  const key = JSON.stringify(spec);
  const g = useMemo(() => {
    const hit = hillsCache.get(key);
    if (hit) return hit;
    if (hillsCache.size > 12) hillsCache.clear();
    const n = 220;
    const arc = spec.arc ?? Math.PI * 2;
    const f0 = (spec.facing ?? Math.PI) - arc / 2;
    const [cx, cz] = spec.center ?? [0, 0];
    const seed = spec.seed ?? 3;
    const peaks = spec.kind === "peaks";
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const base = new THREE.Color(spec.color);
    const hz = new THREE.Color(spec.haze ?? spec.color);
    const snow = new THREE.Color("#f4f6ff");
    const full = arc >= Math.PI * 2 - 1e-3;
    for (let i = 0; i <= n; i++) {
      const a = f0 + (arc * i) / n;
      const u = i / n;
      // noise sampled on a circle: a full ring closes without a seam
      const cx2 = Math.cos(a) * 3;
      const cz2 = Math.sin(a) * 3;
      let h = fbm(cx2 + 7, cz2 + 7, seed, 4);
      if (peaks) h = Math.pow(1 - Math.abs(noise2(cx2 * 1.6 + 3, cz2 * 1.6 + 3, seed) * 2 - 1), 1.6) * 0.75 + h * 0.35;
      // a partial ring sinks into the ground at both ends (never a cut-off wall when the camera turns)
      if (!full) h *= Math.min(1, Math.min(u, 1 - u) / 0.12);
      const H = spec.height[0] * (full ? 1 : Math.min(1, Math.min(u, 1 - u) / 0.12)) + (spec.height[1] - spec.height[0]) * h;
      const R = spec.radius * (1 + (noise2(cx2 + 11, cz2 + 11, seed + 2) - 0.5) * 0.12);
      const x = cx + Math.sin(a) * R;
      const z = cz + Math.cos(a) * R;
      // a 3-row skirt: foot (below ground), a mid band, the ridge
      for (const [y, k] of [[-4, 0], [H * 0.55, 0.5], [H, 1]] as [number, number][]) {
        pos.push(x, y, z);
        const c = base.clone().lerp(hz, (spec.hazeAmt ?? 0.45) * (0.6 + 0.4 * k));
        if (peaks && k === 1 && h > 0.55) c.lerp(snow, 0.7);
        c.convertSRGBToLinear();
        col.push(c.r, c.g, c.b);
      }
      if (i < n) {
        const b = i * 3;
        for (let r = 0; r < 2; r++) idx.push(b + r, b + 3 + r, b + r + 1, b + r + 1, b + 3 + r, b + 4 + r);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    hillsCache.set(key, geo);
    return geo;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <mesh geometry={g} material={hillsMat()} />;
};
