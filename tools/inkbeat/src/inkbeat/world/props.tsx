// Reusable outdoor props at real scale (meters). Each one is built from kit primitives with painted toon materials,
// parts that only touch (never overlap → no ink blobs), and an optional practical light. Check ASSETS.md before
// building a new prop: extend one of these with a flag (defaulting to the old look) instead of copying it.
//   Fence        posts + rails along a line, follows the terrain (heightAt), optional gaps
//   StreetLight  pole, arm, lamp head; `on` lights an unlit core (+ a real point light when `light`)
//   RoadSign     post + plate with a painted label (key objects only: sound-off readability)
//   Rock         a lumpy stone (seeded)
//   Building     a procedural facade block: floors × bays of windows, a door, a cornice, a roof; lit windows at night
import React from "react";
import { boxG, coreMat, cylG, Label, M, sphG } from "../core/kit";
import type { TexKind } from "../mat/materials";
import { toonMaterial } from "../mat/materials";
import type { V3 } from "../types";
import { mix } from "../util";
import { hash2, noise2 } from "./noise";
import * as THREE from "three";

export const Fence: React.FC<{ from: V3; to: V3; post?: number; height?: number; rails?: number; color?: string; heightAt?: (x: number, z: number) => number; gaps?: number[]; kind?: "wood" | "wire" }> = ({
  from,
  to,
  post = 2.4,
  height = 1.15,
  rails = 2,
  color = "#8a6a4a",
  heightAt,
  gaps = [],
  kind = "wood",
}) => {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const L = Math.hypot(dx, dz);
  const n = Math.max(1, Math.round(L / post));
  const yaw = Math.atan2(dx, dz);
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    const x = from[0] + dx * u;
    const z = from[2] + dz * u;
    return [x, heightAt ? heightAt(x, z) : from[1], z] as V3;
  });
  const seg = L / n;
  return (
    <group>
      {pts.map((p, i) => (
        <M key={`p${i}`} g={boxG(0.12, height + 0.15, 0.12)} c={mix(color, "#000000", hash2(i, 3) * 0.15)} tex="wood" p={[p[0], p[1] + (height + 0.15) / 2 - 0.15, p[2]]} r={[0, yaw + (hash2(i, 4) - 0.5) * 0.1, (hash2(i, 5) - 0.5) * 0.05]} />
      ))}
      {pts.slice(0, -1).map((p, i) => {
        if (gaps.includes(i)) return null;
        const q = pts[i + 1];
        const mid: V3 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
        const pitch = Math.atan2(q[1] - p[1], seg);
        return Array.from({ length: rails }, (_, r) => {
          const y = height * (0.35 + (0.6 * r) / Math.max(1, rails - 1)) - 0.05;
          // rails sit in front of the posts (touching, 1 cm proud): never sharing volume with a post
          return kind === "wire" ? (
            <M key={`r${i}|${r}`} g={cylG(0.008, 0.008, seg, 4)} c="#6a6a70" p={[mid[0], mid[1] + y, mid[2]]} r={[Math.PI / 2 - pitch, yaw, 0]} cast={false} />
          ) : (
            <M key={`r${i}|${r}`} g={boxG(0.05, 0.11, seg + 0.02)} c={color} tex="wood" p={[mid[0] + Math.cos(yaw) * 0.085, mid[1] + y, mid[2] - Math.sin(yaw) * 0.085]} r={[-pitch, yaw, 0]} />
          );
        });
      })}
    </group>
  );
};

export const StreetLight: React.FC<{ p: V3; yaw?: number; height?: number; on?: number; light?: boolean; color?: string; pole?: string }> = ({ p, yaw = 0, height = 6, on = 0, light = false, color = "#ffd08a", pole = "#3a3f4a" }) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <M g={cylG(0.1, 0.13, 0.5, 12)} c={pole} tex="metal" p={[0, 0.25, 0]} />
    <M g={cylG(0.06, 0.08, height, 12)} c={pole} tex="metal" p={[0, height / 2, 0]} />
    <M g={boxG(0.07, 0.07, 1.3)} c={pole} tex="metal" p={[0, height - 0.08, 0.65]} />
    <M g={boxG(0.34, 0.12, 0.6)} c={pole} tex="metal" p={[0, height - 0.12, 1.25]} />
    <mesh geometry={boxG(0.26, 0.02, 0.48)} material={on > 0 ? coreMat(color, 0.6 + 0.5 * on) : toonMaterial({ color: "#c8ccd4" })} position={[0, height - 0.19, 1.25]} userData={{ outline: false }} />
    {light && on > 0 ? <pointLight position={[0, height - 0.45, 1.25]} intensity={18 * on} distance={height * 2.5} decay={2} color={color} /> : null}
  </group>
);

export const RoadSign: React.FC<{ p: V3; yaw?: number; text: string; sub?: string; w?: number; h?: number; bg?: string; fg?: string; postH?: number }> = ({ p, yaw = 0, text, sub, w = 1.0, h = 0.75, bg = "#f4f2e8", fg = "#1a1a22", postH = 2.0 }) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <M g={cylG(0.04, 0.04, postH, 10)} c="#8a8e98" tex="metal" p={[0, postH / 2, -0.03]} />
    <M g={boxG(w + 0.06, h + 0.06, 0.03)} c="#2a2a30" p={[0, postH + h / 2 - 0.1, 0.02]} />
    <Label text={text} p={[0, postH + h / 2 - 0.1 + (sub ? h * 0.12 : 0), 0.037]} w={w} h={sub ? h * 0.7 : h} bg={bg} fg={fg} font={0.55} />
    {sub ? <Label text={sub} p={[0, postH + h / 2 - 0.1 - h * 0.35, 0.037]} w={w} h={h * 0.3} bg={bg} fg={fg} font={0.6} /> : null}
  </group>
);

const rockCache = new Map<number, THREE.BufferGeometry>();
export const Rock: React.FC<{ p: V3; size?: number; seed?: number; color?: string; yaw?: number }> = ({ p, size = 0.6, seed = 1, color = "#8a8478", yaw = 0 }) => {
  const k = ((seed % 5) + 5) % 5;
  let g = rockCache.get(k);
  if (!g) {
    g = new THREE.IcosahedronGeometry(1, 1);
    const a = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i);
      const y = a.getY(i);
      const z = a.getZ(i);
      const r = 0.75 + noise2(x * 1.7 + k, z * 1.7 + y, k) * 0.5;
      a.setXYZ(i, x * r * 1.2, Math.max(-0.2, y * r * 0.7), z * r);
    }
    g.computeVertexNormals();
    rockCache.set(k, g);
  }
  return <M g={g} c={color} tex="rock" p={[p[0], p[1] + size * 0.15, p[2]]} r={[0, yaw, 0]} s={size} />;
};

export type BuildingProps = {
  p: V3;
  yaw?: number;
  w: number;
  d: number;
  floors?: number;
  floorH?: number;
  wall?: string;
  tex?: TexKind;
  trim?: string;
  roof?: "flat" | "gable";
  roofColor?: string;
  /** 0..1 share of lit windows (night); deterministic per window */
  lit?: number;
  /** a shop front on the ground floor: awning color + sign text */
  shop?: { awning: string; sign?: string };
  seed?: number;
};

/** a facade block; its front faces +z. Windows are inset frames with glass that reflects the sky tint (day) or glows
 * (lit). Every part is ≥ 1 cm proud of the wall. */
export const Building: React.FC<BuildingProps> = ({ p, yaw = 0, w, d, floors = 2, floorH = 3.2, wall = "#c8a07a", tex = "brick", trim = "#efe4d0", roof = "flat", roofColor = "#7a4a3a", lit = 0, shop, seed = 1 }) => {
  const H = floors * floorH;
  const bays = Math.max(1, Math.floor(w / 2.2));
  const bw = w / bays;
  const glassDay = toonMaterial({ color: "#5a7ab8" });
  const win = (x: number, y: number, k: number) => {
    const on = hash2(k, seed) < lit;
    return (
      <group key={`w${k}`} position={[x, y, d / 2]}>
        <mesh geometry={boxG(1.0, 1.4, 0.02)} material={on ? coreMat("#ffd38a", 0.95) : glassDay} position={[0, 0, 0.012]} userData={{ outline: on ? false : undefined }} />
        {/* a sky-reflection stripe: a cheap read of glass */}
        {!on ? <mesh geometry={boxG(0.22, 1.3, 0.005)} material={coreMat("#c8dcff", 0.55, 0.55)} position={[-0.2, 0, 0.025]} rotation={[0, 0, 0.35]} userData={{ outline: false }} /> : null}
        <M g={boxG(1.12, 0.07, 0.06)} c={trim} p={[0, 0.735, 0.03]} />
        <M g={boxG(1.12, 0.07, 0.06)} c={trim} p={[0, -0.735, 0.03]} />
        <M g={boxG(0.07, 1.4, 0.06)} c={trim} p={[-0.525, 0, 0.03]} />
        <M g={boxG(0.07, 1.4, 0.06)} c={trim} p={[0.525, 0, 0.03]} />
        <M g={boxG(1.3, 0.1, 0.2)} c={trim} p={[0, -0.82, 0.1]} />
      </group>
    );
  };
  const wins: React.ReactNode[] = [];
  let k = 0;
  for (let f = shop ? 1 : 0; f < floors; f++) for (let b = 0; b < bays; b++) if (shop || f > 0 || b !== Math.floor(bays / 2)) wins.push(win(-w / 2 + bw * (b + 0.5), f * floorH + floorH * 0.55, k++));
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      <M g={boxG(w, H, d)} c={wall} tex={tex} p={[0, H / 2, 0]} />
      <M g={boxG(w + 0.02, 0.5, d + 0.02)} c={mix(wall, "#2a1a20", 0.35)} tex="stone" p={[0, 0.25, 0]} />
      {Array.from({ length: floors - 1 }, (_, f) => (
        <M key={`b${f}`} g={boxG(w + 0.08, 0.14, 0.12)} c={trim} p={[0, (f + 1) * floorH, d / 2 + 0.05]} />
      ))}
      <M g={boxG(w + 0.3, 0.3, d + 0.3)} c={trim} p={[0, H + 0.15, 0]} />
      {roof === "gable"
        ? [-1, 1].map((s) => <M key={`r${s}`} g={boxG(w + 0.6, 0.14, d * 0.62)} c={roofColor} tex="roofTiles" p={[0, H + 0.3 + d * 0.17, s * d * 0.25]} r={[s * 0.6, 0, 0]} />)
        : null}
      {wins}
      {shop ? (
        <group>
          <mesh geometry={boxG(w * 0.7, floorH * 0.62, 0.02)} material={lit > 0 ? coreMat("#ffe0a8", 0.9) : glassDay} position={[0, floorH * 0.4, d / 2 + 0.012]} />
          <M g={boxG(w * 0.74, 0.08, 0.08)} c={trim} p={[0, floorH * 0.72, d / 2 + 0.04]} />
          <M g={boxG(w * 0.78, 0.08, 1.1)} c={shop.awning} tex="fabric" p={[0, floorH * 0.86, d / 2 + 0.55]} r={[0.28, 0, 0]} />
          {shop.sign ? <Label text={shop.sign} p={[0, floorH * 1.0 + 0.2, d / 2 + 0.02]} w={Math.min(w * 0.7, 4)} h={0.55} bg="#2a2030" fg="#ffe6b0" font={0.6} /> : null}
        </group>
      ) : (
        <group position={[bw * 0.5 - w / 2 + bw * Math.floor(bays / 2), 0, d / 2]}>
          <M g={boxG(1.1, 2.2, 0.06)} c="#6a3a2a" tex="planks" p={[0, 1.1, 0.03]} />
          <M g={sphG(0.04, 10)} c="#e8c050" p={[0.4, 1.05, 0.08]} />
          <M g={boxG(1.4, 0.12, 0.3)} c={trim} p={[0, 2.32, 0.15]} />
        </group>
      )}
    </group>
  );
};
