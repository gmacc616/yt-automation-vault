// Sets and props of "The loneliest tree" (Tree of Ténéré). The desert world reuses the inkbeat kit (Terrain, Hills,
// Tree kind "acacia", Camel, Car kinds vintage/truck, Burst); this file holds what only this film needs: the hero tree
// with its damage and fall, the well, the shaft cross-section, the museum room, the metal sculpture and the tags.
import React from "react";
import * as THREE from "three";
import { taperTube } from "../../inkbeat/char/geometry";
import { boxG, coreMat, cylG, Label, M, sphG } from "../../inkbeat/core/kit";
import { toonMaterial } from "../../inkbeat/mat/materials";
import type { V3 } from "../../inkbeat/types";
import { Hills, Terrain, heightAt } from "../../inkbeat/world/terrain";
import type { TerrainSpec } from "../../inkbeat/world/terrain";
import { Rock } from "../../inkbeat/world/props";
import { Tree } from "../../inkbeat/world/trees";
import { hash2 } from "../../inkbeat/world/noise";

export const TREE_P: V3 = [0, 0, 0];
export const TREE_H = 8.5;
export const SAND = { base: "#d8bc90", light: "#e8d2aa", dark: "#c2a076", dirt: "#b89a70" };
// night sand: the same dunes, cooler and darker (moonlight), so a night frame is not a day frame with a dark sky
export const SAND_NIGHT = { base: "#6e6a86", light: "#85809c", dark: "#56526e", dirt: "#605a70" };
// dunes everywhere, flat hard ground around the tree (the caravan route, the well, the tracks)
export const DESERT: TerrainSpec = { size: [900, 900], center: [0, 0], amp: 3.2, scale: 38, seed: 8, seg: 220, colors: SAND, flat: [{ x0: -26, z0: -26, x1: 26, z1: 26, soft: 22 }] };
export const DESERT_NIGHT: TerrainSpec = { ...DESERT, colors: SAND_NIGHT };
export const H = (x: number, z: number) => heightAt(DESERT, x, z);

/** the desert: dunes, far dune ring and a mesa ring (both with baked haze), a few rocks, the 400 KM marker */
export const Desert: React.FC<{ night?: boolean; dusk?: boolean }> = ({ night, dusk }) => {
  const haze = night ? "#2a3460" : dusk ? "#f0a070" : "#cfe0f4";
  return (
    <>
      <Terrain spec={night ? DESERT_NIGHT : DESERT} />
      <Hills spec={{ radius: 330, height: [8, 26], color: night ? "#3a3c60" : "#c8a47a", haze, hazeAmt: 0.45, seed: 3 }} />
      <Hills spec={{ radius: 430, height: [20, 48], color: night ? "#2e3058" : "#a88468", haze, hazeAmt: 0.6, kind: "peaks", seed: 12 }} />
      {[[9, -7, 0.5, 1], [-11, 5, 0.7, 2], [14, 12, 0.4, 3], [-6, -15, 0.6, 4]].map(([x, z, s, sd], i) => (
        <Rock key={i} p={[x, H(x, z), z]} size={s} seed={sd} color="#a8825a" />
      ))}
    </>
  );
};

/** a painted tag on a marker stone (sound-off readability: 1-3 words, unlit text) */
export const TagStone: React.FC<{ p: V3; text: string; yaw?: number; w?: number; color?: string }> = ({ p, text, yaw = 0, w = 1.3, color = "#b8432a" }) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <M g={boxG(w + 0.2, 0.9, 0.35)} c="#d8c8a8" tex="stone" p={[0, 0.45, 0]} />
    <Label text={text} p={[0, 0.5, 0.18]} w={w} h={0.5} bg="none" fg={color} font={0.72} />
  </group>
);
/** a date board on a post */
export const DateBoard: React.FC<{ p: V3; text: string; yaw?: number; bg?: string }> = ({ p, text, yaw = 0, bg = "#f4ecd8" }) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <M g={cylG(0.05, 0.05, 1.7, 8)} c="#6a4a2a" tex="wood" p={[0, 0.85, -0.05]} />
    <M g={boxG(1.36, 0.66, 0.05)} c="#3a2a20" p={[0, 1.75, 0]} />
    <Label text={text} p={[0, 1.75, 0.03]} w={1.26} h={0.56} bg={bg} fg="#2a1a14" font={0.7} />
  </group>
);

/** the hero acacia: `damage` 0..1 (broken limbs on the sand, a scar), `fall` 0..1 (topples away from the impact) */
export const HeroTree: React.FC<{ t: number; damage?: number; fall?: number; hitAt?: number; shakeAt?: number[] }> = ({ t, damage = 0, fall = 0, hitAt, shakeAt = [] }) => {
  const f = THREE.MathUtils.clamp(fall, 0, 1);
  const ang = (Math.PI / 2 - 0.12) * f * f; // accelerates as it goes
  const lastShake = shakeAt.filter((s) => t >= s).pop();
  return (
    <group position={TREE_P}>
      <group rotation={[0, 0, ang]} position={[0, 0, 0]}>
        <Tree p={[0, 0, 0]} kind="acacia" height={TREE_H} seed={5} t={f > 0 ? 0 : t} windStrength={0.6} hitAt={f > 0 ? undefined : lastShake ?? hitAt} bark="#7a5a3e" />
        {damage > 0 ? <M g={sphG(1, 14)} c="#e8d0a8" p={[0.32, 1.1, 0.25]} s={[0.12, 0.3, 0.06]} cast={false} /> : null}
      </group>
      {damage > 0
        ? [[1.6, -0.8, 0.6], [-1.2, 1.4, -0.9], [0.4, 2.1, 1.9]].map(([x, z, r], i) => (
            <group key={i} position={[x, 0.08, z]} rotation={[0, r, 1.45]}>
              <mesh geometry={limbGeo(i)} material={toonMaterial({ color: "#6a4a32", tex: "wood" })} castShadow />
            </group>
          ))
        : null}
      {f >= 1 ? <M g={cylG(0.4, 0.5, 0.45, 18)} c="#7a5a3e" tex="wood" p={[0, 0.22, 0]} /> : null}
    </group>
  );
};
const limbCache = new Map<number, THREE.BufferGeometry>();
const limbGeo = (i: number) => {
  let g = limbCache.get(i);
  if (!g) {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    g = taperTube([V(0, 0, 0), V(0.1, 0.7, 0.05), V(-0.05, 1.5 + i * 0.2, 0.1)], 0.09, 0.03, 12, 8);
    limbCache.set(i, g);
  }
  return g;
};

/** the 1938 well: a stone ring, a wooden windlass, a rope and a bucket that rises with `lift` 0..1, a spoil heap */
export const Well: React.FC<{ p: V3; lift?: number }> = ({ p, lift = 0 }) => (
  <group position={p}>
    <mesh geometry={cylG(0.85, 0.9, 0.7, 24, true)} material={toonMaterial({ color: "#c8b08a", tex: "stone", side: THREE.DoubleSide })} position={[0, 0.35, 0]} castShadow receiveShadow />
    <mesh geometry={cylG(0.7, 0.7, 0.02, 24)} material={coreMat("#1a1412", 0.8)} position={[0, 0.66, 0]} />
    {[-1, 1].map((s) => (
      <M key={s} g={boxG(0.12, 1.7, 0.12)} c="#7a5a3a" tex="wood" p={[s * 1.0, 0.85, 0]} />
    ))}
    <M g={cylG(0.08, 0.08, 2.1, 12)} c="#8a6a48" tex="wood" p={[0, 1.6, 0]} r={[0, 0, Math.PI / 2]} />
    <M g={cylG(0.012, 0.012, 1.0 - lift * 0.8, 6)} c="#b89a6a" p={[0, 1.6 - (1.0 - lift * 0.8) / 2, 0]} cast={false} />
    <M g={cylG(0.14, 0.11, 0.24, 14)} c="#6a5038" tex="wood" p={[0, 0.48 + lift * 0.8, 0]} />
    <M g={sphG(1, 16)} c="#d8b47a" tex="sand" p={[1.9, 0, 0.6]} s={[1.1, 0.45, 0.8]} />
  </group>
);

/** the cross-section diorama under the tree: sand strata, the well shaft, roots down to a glinting water table */
export const Shaft: React.FC<{ p: V3; t: number; reveal?: number }> = ({ p, t, reveal = 1 }) => {
  const layers = ["#e8bc7c", "#d8a868", "#c89458", "#b88250", "#a87448", "#986a44", "#8a5e40"];
  const D = 14; // diorama depth (m), stylized: tags give the real 35 m
  return (
    <group position={p}>
      {layers.map((c, i) => (
        <M key={i} g={boxG(9, D / layers.length - 0.01, 3)} c={c} tex="sand" p={[0, -((i + 0.5) * D) / layers.length, -1.5]} />
      ))}
      <M g={boxG(9, 6, 3)} c="#6a4a3a" tex="rock" p={[0, -D - 3.8, -1.5]} />
      <M g={boxG(40, 40, 0.2)} c="#3a2a24" p={[0, -D / 2, -3.2]} />
      {/* the water table: a blue band with moving glints */}
      <M g={boxG(9, 0.8, 3.02)} c="#3a7ac0" p={[0, -D - 0.4, -1.5]} />
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} geometry={boxG(0.5, 0.06, 0.02)} material={coreMat("#c8f0ff", 0.9)} position={[-3.5 + i * 1.4 + Math.sin(t * 0.8 + i) * 0.2, -D - 0.2, 0.02]} userData={{ outline: false }} />
      ))}
      {/* the shaft: a dark slot from the surface to the water */}
      <mesh geometry={boxG(1.2, D * reveal, 0.02)} material={coreMat("#24180f", 0.85)} position={[2.6, -(D * reveal) / 2, 0.01]} />
      {/* roots: tapering tubes from the trunk base down to the water */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={`r${i}`} geometry={rootGeo(i, D)} material={toonMaterial({ color: "#6a4a32", tex: "wood" })} position={[-0.6, 0, 0.05]} />
      ))}
      {/* the trunk base above the surface */}
      <M g={cylG(0.35, 0.45, 2.5, 18)} c="#7a5a3e" tex="wood" p={[-0.6, 1.25, -0.4]} />
      <M g={boxG(9, 0.1, 3)} c={SAND.light} tex="sand" p={[0, 0.0, -1.5]} />
    </group>
  );
};
const rootCache = new Map<string, THREE.BufferGeometry>();
const rootGeo = (i: number, D: number) => {
  const k = `${i}|${D}`;
  let g = rootCache.get(k);
  if (!g) {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const sx = (hash2(i, 3) - 0.5) * 5;
    const deep = i < 3 ? D + 0.2 : D * (0.3 + hash2(i, 4) * 0.4);
    g = taperTube([V(0, 0, 0), V(sx * 0.3, -deep * 0.3, 0), V(sx * 0.7 + Math.sin(i) * 0.4, -deep * 0.65, 0), V(sx, -deep, 0)], 0.55 - i * 0.05, 0.08, 30, 8);
    rootCache.set(k, g);
  }
  return g;
};

/** the museum room in Niamey: plank floor, plaster walls, a skylight, the trunk on a plinth behind a rope */
export const Museum: React.FC<{ p: V3 }> = ({ p }) => (
  <group position={p}>
    <M g={boxG(14, 0.1, 14)} c="#b88a5a" tex="planks" p={[0, -0.05, 0]} />
    <M g={boxG(14, 6, 0.2)} c="#e8dcc4" tex="plaster" p={[0, 3, -7]} />
    <M g={boxG(0.2, 6, 14)} c="#e2d4b8" tex="plaster" p={[-7, 3, 0]} />
    <M g={boxG(0.2, 6, 14)} c="#e2d4b8" tex="plaster" p={[7, 3, 0]} />
    <M g={boxG(14.4, 0.3, 14.4)} c="#d8ccb4" tex="plaster" p={[0, 6.15, 0]} />
    <mesh geometry={boxG(5, 0.02, 5)} material={coreMat("#e8f4ff", 1.0)} position={[0, 6.0, -1]} />
    {/* the plinth and the remains: a broken trunk lying on supports */}
    <M g={boxG(5.2, 0.7, 1.8)} c="#8a6a4a" tex="wood" p={[0, 0.35, -2.5]} />
    <group position={[0, 1.05, -2.5]} rotation={[0, 0, Math.PI / 2 - 0.05]}>
      <M g={cylG(0.5, 0.62, 4.6, 20)} c="#7a5a3e" tex="wood" />
      <M g={cylG(0.12, 0.2, 1.2, 10)} c="#6a4a32" tex="wood" p={[0.2, 1.4, 0.3]} r={[0.6, 0, 0.5]} />
    </group>
    {[-2.8, -0.9, 0.9, 2.8].map((x) => (
      <M key={x} g={cylG(0.05, 0.07, 0.95, 10)} c="#c8a040" tex="metal" p={[x, 0.47, -0.8]} />
    ))}
    <M g={cylG(0.025, 0.025, 5.6, 6)} c="#8a1a24" p={[0, 0.85, -0.8]} r={[0, 0, Math.PI / 2]} cast={false} />
    <Label text="TREE OF TÉNÉRÉ" p={[0, 3.4, -6.88]} w={4.4} h={0.7} bg="#2a2030" fg="#f4e6c0" font={0.55} />
    <Label text="NIAMEY" p={[0, 2.6, -6.88]} w={2.2} h={0.5} bg="#2a2030" fg="#f4e6c0" font={0.55} />
  </group>
);

/** the metal sculpture that marks the spot: a pipe trunk, pipe limbs, a flat ring of steel discs for the crown */
export const Sculpture: React.FC<{ p: V3 }> = ({ p }) => {
  const steel = "#8a8e98";
  return (
    <group position={p}>
      <M g={cylG(0.12, 0.16, 3.2, 14)} c={steel} tex="metal" p={[0, 1.6, 0]} />
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        return <M key={i} g={cylG(0.06, 0.08, 2.4, 10)} c={steel} tex="metal" p={[Math.sin(a) * 0.8, 3.9, Math.cos(a) * 0.8]} r={[Math.cos(a) * 0.75, 0, -Math.sin(a) * 0.75]} />;
      })}
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        const r = i % 3 === 0 ? 0.6 : 1.6;
        return <M key={`d${i}`} g={cylG(0.75, 0.75, 0.08, 18)} c="#9aa0aa" tex="metal" p={[Math.sin(a) * r, 4.9 + hash2(i, 2) * 0.3, Math.cos(a) * r]} />;
      })}
      <M g={boxG(1.2, 0.3, 1.2)} c="#c8b08a" tex="stone" p={[0, 0.15, 0]} />
    </group>
  );
};

export const SIGN = (text: string, p: V3, yaw = 0) => (
  <group key={text} position={p} rotation={[0, yaw, 0]}>
    <M g={cylG(0.05, 0.05, 1.9, 8)} c="#6a4a2a" tex="wood" p={[0, 0.95, -0.04]} />
    <Label text={text} p={[0, 1.75, 0]} w={1.5} h={0.42} bg="#2f6a3a" fg="#ffffff" font={0.6} />
  </group>
);
