// Animals at real scale, built from toon primitives in the character family's style (round, soft, inked).
//   Camel   dromedary, ~2.1 m at the hump; walk cycle tied to distance (`walk` = distance in m: no foot slide),
//           pacing gait (both legs of a side swing together), head bob, optional load (salt slabs, bags) and a rope
// Front = +z. Drive it with anim/motion.ts follow(): <Camel p={s.pos} yaw={s.yaw} walk={s.dist} t={t} />
import React from "react";
import { taperTube } from "../char/geometry";
import { boxG, coreMat, cylG, M, sphG } from "../core/kit";
import { toonMaterial } from "../mat/materials";
import type { V3 } from "../types";
import { mix } from "../util";
import * as THREE from "three";

const neckCache = new Map<string, THREE.BufferGeometry>();
const neckGeo = (bob: number) => {
  const k = bob.toFixed(2);
  let g = neckCache.get(k);
  if (!g) {
    if (neckCache.size > 64) neckCache.clear();
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    // an S-curve: down and forward from the chest, then up to the head
    g = taperTube([V(0, 1.45, 0.7), V(0, 1.25, 1.05), V(0, 1.45 + bob * 0.3, 1.35), V(0, 1.85 + bob, 1.45)], 0.2, 0.13, 20, 12);
    neckCache.set(k, g);
  }
  return g;
};

export type CamelProps = {
  p: V3;
  yaw?: number;
  /** distance walked (m): drives the legs; omit for a standing camel */
  walk?: number;
  t?: number;
  color?: string;
  load?: "salt" | "bags" | "none";
  /** 0..1 head turned toward its left (+) or right (-) */
  look?: number;
  scale?: number;
};

const STRIDE = 1.7; // m per full gait cycle
const legCache = new Map<string, THREE.BufferGeometry>();
/** leg tubes cached by their rounded joint positions (bounded: a fresh tube per frame would leak memory) */
const legGeo = (hip: THREE.Vector3, knee: THREE.Vector3, foot: THREE.Vector3) => {
  const k = [hip, knee, foot].map((v) => `${v.x.toFixed(2)},${v.y.toFixed(3)},${v.z.toFixed(3)}`).join("|");
  let g = legCache.get(k);
  if (!g) {
    if (legCache.size > 400) legCache.clear();
    g = taperTube([hip, knee, foot], 0.15, 0.08, 14, 8);
    legCache.set(k, g);
  }
  return g;
};

export const Camel: React.FC<CamelProps> = ({ p, yaw = 0, walk, t = 0, color = "#c9a06a", load = "none", look = 0, scale = 1 }) => {
  const walking = walk !== undefined;
  const ph = walking ? (walk / STRIDE) * Math.PI * 2 : 0;
  const bob = walking ? Math.sin(ph * 2) * 0.03 : Math.sin(t * 1.2) * 0.01;
  const headBob = walking ? Math.sin(ph * 2 + 0.6) * 0.06 : Math.sin(t * 0.8) * 0.02;
  const dark = mix(color, "#3a2410", 0.35);
  const light = mix(color, "#fff4dc", 0.25);
  const body = toonMaterial({ color, tex: "fabric", texScale: 2.5 });
  // pacing gait: the left legs swing together, then the right legs
  const leg = (x: number, z: number, side: number) => {
    const sw = walking ? Math.sin(ph + (side > 0 ? 0 : Math.PI)) : 0;
    const lift = walking ? Math.max(0, Math.cos(ph + (side > 0 ? 0 : Math.PI))) * 0.14 : 0;
    const hip = new THREE.Vector3(x * 1.2, 1.3, z);
    const foot = new THREE.Vector3(x * 1.1, 0.04 + lift, z + sw * 0.38);
    const knee = new THREE.Vector3(x * 1.15, 0.62 + lift * 0.6, z + sw * 0.2 + (z > 0 ? 0.04 : -0.06));
    return (
      <group key={`${x}|${z}`}>
        <mesh geometry={legGeo(hip, knee, foot)} material={body} castShadow />
        <M g={sphG(0.075, 12)} c={dark} p={[knee.x, knee.y, knee.z]} />
        <M g={cylG(0.09, 0.1, 0.06, 14)} c={dark} p={[foot.x, foot.y - 0.01, foot.z + 0.02]} />
      </group>
    );
  };
  return (
    <group position={p} rotation={[0, yaw, 0]} scale={scale}>
      <group position={[0, bob, 0]}>
        {/* barrel body, hump, chest */}
        <mesh geometry={sphG(1, 28)} material={body} position={[0, 1.42, 0]} scale={[0.5, 0.46, 0.95]} castShadow receiveShadow />
        <mesh geometry={sphG(1, 24)} material={body} position={[0, 1.86, -0.05]} scale={[0.38, 0.42, 0.5]} castShadow />
        <mesh geometry={sphG(1, 20)} material={toonMaterial({ color: light })} position={[0, 1.24, 0.55]} scale={[0.3, 0.28, 0.3]} castShadow />
        {/* neck + head (turns with `look`) */}
        <group rotation={[0, look * 0.6, 0]} position={[0, 0, 0.1]}>
          <mesh geometry={neckGeo(headBob)} material={body} castShadow />
          <group position={[0, 1.88 + headBob, 1.55]}>
            <mesh geometry={sphG(1, 20)} material={body} scale={[0.16, 0.15, 0.3]} castShadow />
            <mesh geometry={sphG(1, 16)} material={toonMaterial({ color: light })} position={[0, -0.05, 0.22]} scale={[0.13, 0.11, 0.14]} />
            {[-1, 1].map((s) => (
              <group key={s}>
                <mesh geometry={sphG(0.04, 12)} material={coreMat("#1a1012", 0.9)} position={[s * 0.12, 0.06, 0.08]} />
                <M g={sphG(0.05, 10)} c={dark} p={[s * 0.1, 0.15, -0.12]} s={[0.6, 1.2, 0.6]} />
              </group>
            ))}
            {load !== "none" ? <M g={cylG(0.012, 0.012, 1.4, 6)} c="#6a4a2a" p={[0.12, -0.25, -0.1]} r={[0.6, 0, 0.3]} cast={false} /> : null}
          </group>
        </group>
        {/* tail */}
        <M g={cylG(0.03, 0.015, 0.55, 8)} c={dark} p={[0, 1.2, -0.86]} r={[-0.25 + (walking ? Math.sin(ph) * 0.15 : 0), 0, 0]} />
        {/* load: a saddle pad and two hanging salt slabs (or bags) on each side; they touch the pad, never sink in */}
        {load !== "none" ? (
          <group>
            <M g={boxG(1.1, 0.08, 1.1)} c="#a8402a" tex="fabric" p={[0, 1.86, 0.25]} />
            {[-1, 1].map((s) =>
              load === "salt" ? (
                <group key={s} rotation={[0, 0, s * 0.12]}>
                  <M g={boxG(0.18, 0.5, 0.66)} c="#ece8de" tex="stone" p={[s * 0.58, 1.38, 0.22]} />
                  <M g={boxG(0.18, 0.5, 0.66)} c="#e2dccc" tex="stone" p={[s * 0.58, 1.38, -0.5]} />
                  <M g={cylG(0.01, 0.01, 0.9, 5)} c="#6a4a2a" p={[s * 0.58, 1.42, -0.14]} r={[Math.PI / 2, 0, 0]} cast={false} />
                </group>
              ) : (
                <M key={s} g={sphG(1, 16)} c="#8a6a4a" tex="fabric" p={[s * 0.48, 1.42, 0]} s={[0.18, 0.3, 0.4]} />
              ),
            )}
          </group>
        ) : null}
      </group>
      {leg(0.2, 0.55, 1)}
      {leg(-0.2, 0.55, -1)}
      {leg(0.2, -0.6, 1)}
      {leg(-0.2, -0.6, -1)}
    </group>
  );
};
