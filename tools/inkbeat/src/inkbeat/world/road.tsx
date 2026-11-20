// Roads and paths with real surface detail: a painted asphalt texture (aggregate speckle, tar seams, patches, wear
// darkening in the wheel tracks), crisp markings as decals 4 mm proud (no z-fighting), gravel shoulders, and an
// optional WET mode: darker, tinted asphalt plus stretched light glints under every light you pass in (headlights,
// streetlights, signs). Glints are a cheap, stable stand-in for screen-space reflections and read as "wet road" in a
// toon look. Roads run along +z from z0 to z1 at x = cx (rotate the group for other directions).
import React from "react";
import * as THREE from "three";
import { canvasTex, coreMat } from "../core/kit";
import { toonMaterial } from "../mat/materials";
import type { V3 } from "../types";
import { hash2 } from "./noise";
import type { FlatZone } from "./terrain";

export type RoadSpec = {
  cx?: number;
  z0: number;
  z1: number;
  /** carriageway width (m): country road 6.5, town street 7-9, path 1.6-2.5 */
  width?: number;
  shoulder?: number;
  /** "double-yellow" center + white edges (US country), "dashed-white" (EU), "none" (lane, path) */
  marking?: "double-yellow" | "dashed-white" | "none";
  surface?: "asphalt" | "dirt" | "cobble";
  wet?: boolean;
  y?: number;
};

/** the zone a road occupies (flatten the terrain and keep grass off it) */
export const roadZone = (r: RoadSpec, pad = 0.6): FlatZone => {
  const w = (r.width ?? 6.5) / 2 + (r.shoulder ?? 1.2) + pad;
  const cx = r.cx ?? 0;
  return { x0: cx - w, z0: Math.min(r.z0, r.z1), x1: cx + w, z1: Math.max(r.z0, r.z1), soft: 5 };
};

/** a painted asphalt tile: 512 px ≙ 4 m; speckle, darker wheel tracks, a crack or two, patch squares */
const asphaltTex = (wet: boolean, surface: RoadSpec["surface"]) =>
  canvasTex(`asphalt|${wet}|${surface}`, 512, 512, (g, W, H) => {
    const base = surface === "dirt" ? (wet ? "#4e3e2e" : "#7e6446") : surface === "cobble" ? (wet ? "#4a4650" : "#8a8490") : wet ? "#26282f" : "#45474f";
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    // wheel tracks: two darker bands per lane (polished, oil)
    if (surface !== "cobble") {
      g.fillStyle = surface === "dirt" ? "rgba(70,50,30,0.25)" : "rgba(20,20,26,0.18)";
      for (const x of [0.18, 0.36, 0.64, 0.82]) g.fillRect(x * W - W * 0.04, 0, W * 0.08, H);
    }
    // aggregate speckle (seeded, so every tab paints the same texture)
    for (let i = 0; i < 9000; i++) {
      const x = hash2(i, 1) * W;
      const y = hash2(i, 2) * H;
      const v = hash2(i, 3);
      g.fillStyle = v > 0.5 ? `rgba(255,255,255,${0.05 + v * 0.07})` : `rgba(0,0,0,${0.06 + v * 0.1})`;
      g.fillRect(x, y, 1.5 + v * 1.5, 1.5 + v * 1.5);
    }
    if (surface === "cobble") {
      g.strokeStyle = "rgba(30,26,34,0.55)";
      g.lineWidth = 3;
      for (let r = 0; r < 16; r++) {
        const y = (r * H) / 16;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
        for (let c = 0; c < 12; c++) {
          const x = ((c + (r % 2) * 0.5) * W) / 12;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + H / 16);
          g.stroke();
        }
      }
    } else {
      // tar-sealed cracks and a patch
      g.strokeStyle = "rgba(15,15,20,0.5)";
      g.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        let x = hash2(k, 7) * W;
        let y = hash2(k, 8) * H;
        g.beginPath();
        g.moveTo(x, y);
        for (let s = 0; s < 8; s++) {
          x += (hash2(k, s + 10) - 0.5) * 50;
          y += hash2(s, k + 20) * 30;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.fillStyle = "rgba(0,0,0,0.12)";
      g.fillRect(W * 0.55, H * 0.2, W * 0.16, H * 0.12);
    }
  });

const surfMats = new Map<string, THREE.Material>();
const roadMat = (wet: boolean, surface: RoadSpec["surface"], len: number, width: number) => {
  const k = `${wet}|${surface}|${len}|${width}`;
  let m = surfMats.get(k);
  if (!m) {
    if (surfMats.size > 24) surfMats.clear();
    const tex = asphaltTex(wet, surface).clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(width / 4, len / 4);
    tex.needsUpdate = true;
    // a toon material of its own (unique seed in the cache key keeps the toon patch, unlike Material.clone)
    let h = 0;
    for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    m = toonMaterial({ color: "#ffffff", mapping: "uv", seed: 90000 + (h % 100000) });
    (m as THREE.MeshToonMaterial).map = tex;
    m.needsUpdate = true;
    surfMats.set(k, m);
  }
  return m;
};

export const Road: React.FC<{ spec: RoadSpec }> = ({ spec }) => {
  const { z0, z1, wet = false, surface = "asphalt" } = spec;
  const cx = spec.cx ?? 0;
  const y = spec.y ?? 0;
  const W = spec.width ?? 6.5;
  const sh = spec.shoulder ?? 1.2;
  const L = Math.abs(z1 - z0);
  const zc = (z0 + z1) / 2;
  const marking = spec.marking ?? (surface === "asphalt" ? "double-yellow" : "none");
  const white = coreMat(wet ? "#d8dce8" : "#f2f2ee", 0.95);
  const yellow = coreMat("#f2c21a", 0.95);
  const dash = (x: number, len: number, gap: number, w: number, m: THREE.Material) => {
    const n = Math.floor(L / (len + gap));
    return Array.from({ length: n }, (_, i) => (
      <mesh key={`${x}|${i}`} position={[cx + x, y + 0.016, Math.min(z0, z1) + i * (len + gap) + len / 2]} rotation={[-Math.PI / 2, 0, 0]} material={m} userData={{ outline: false }}>
        <planeGeometry args={[w, len]} />
      </mesh>
    ));
  };
  const line = (x: number, w: number, m: THREE.Material) => (
    <mesh key={`l${x}`} position={[cx + x, y + 0.016, zc]} rotation={[-Math.PI / 2, 0, 0]} material={m} userData={{ outline: false }}>
      <planeGeometry args={[w, L]} />
    </mesh>
  );
  return (
    <group>
      {/* the carriageway sits 2 cm above the shoulders so the edge inks as a curb line, never z-fights */}
      <mesh position={[cx, y - 0.04, zc]} material={roadMat(wet, surface, L, W)} receiveShadow>
        <boxGeometry args={[W, 0.1, L]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[cx + s * (W / 2 + sh / 2), y - 0.06, zc]} material={toonMaterial({ color: wet ? "#5a5650" : "#a49a88", tex: "sand", texScale: 2 })} receiveShadow>
          <boxGeometry args={[sh, 0.1, L]} />
        </mesh>
      ))}
      {marking === "double-yellow" ? [line(-0.09, 0.1, yellow), line(0.09, 0.1, yellow), line(-W / 2 + 0.25, 0.14, white), line(W / 2 - 0.25, 0.14, white)] : null}
      {marking === "dashed-white" ? [...dash(0, 3, 6, 0.12, white), line(-W / 2 + 0.25, 0.14, white), line(W / 2 - 0.25, 0.14, white)] : null}
    </group>
  );
};

/** wet-road glints: for each light, a vertical streak on the road between the light's foot and the lens (where its
 * mirror image lands), length ∝ the light's height. Additive, no ink. Use only with a wet road and at dusk / night. */
export const WetGlints: React.FC<{ lights: { p: V3; color: string; k?: number }[]; cam: V3; roadY?: number; width?: number }> = ({ lights, cam, roadY = 0.012, width = 0.5 }) => (
  <group>
    {lights.map((l, i) => {
      const dx = cam[0] - l.p[0];
      const dz = cam[2] - l.p[2];
      const d = Math.hypot(dx, dz) || 1;
      const h = Math.max(0.2, l.p[1] - roadY);
      const len = Math.min(d * 0.8, h * 3.2);
      const yaw = Math.atan2(dx, dz);
      const mid: V3 = [l.p[0] + (dx / d) * len * 0.5, roadY + 0.006, l.p[2] + (dz / d) * len * 0.5];
      const m = glintMat(l.color, l.k ?? 0.9);
      return (
        <mesh key={i} position={mid} rotation={[-Math.PI / 2, 0, yaw]} material={m} userData={{ outline: false }}>
          <planeGeometry args={[width, len]} />
        </mesh>
      );
    })}
  </group>
);
const glintMats = new Map<string, THREE.MeshBasicMaterial>();
const glintMat = (color: string, k: number) => {
  const key = `${color}|${k.toFixed(2)}`;
  let m = glintMats.get(key);
  if (!m) {
    if (glintMats.size > 40) glintMats.clear();
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, map: glintTex() });
    glintMats.set(key, m);
  }
  return m;
};
const glintTex = () =>
  canvasTex("glint", 64, 256, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "rgba(255,255,255,0)");
    gr.addColorStop(0.35, "rgba(255,255,255,0.6)");
    gr.addColorStop(0.85, "rgba(255,255,255,1)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    const gx = g.createLinearGradient(0, 0, W, 0);
    gx.addColorStop(0, "rgba(0,0,0,1)");
    gx.addColorStop(0.5, "rgba(0,0,0,0)");
    gx.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = gx;
    g.fillRect(0, 0, W, H);
  });
