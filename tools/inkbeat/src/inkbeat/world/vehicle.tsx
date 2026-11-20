// A toy-scale-correct cartoon car (kinds: sedan, hatch, pickup, van, vintage 1930s, truck 1970s lorry) that behaves like one: wheels roll by the distance covered (never slide or spin in
// place), the body pitches back on acceleration and dips on braking (suspension), rolls out of turns, brake lights
// glow while decelerating, headlights on at dusk/night, glass with a sky-reflection stripe. Front = +z.
// Drive it with anim/motion.ts: const s = follow(path, keys, t); <Car p={s.pos} yaw={s.yaw} dist={s.dist}
// accel={s.accel} yawRate={s.yawRate} speed={s.speed} />
import React, { useMemo } from "react";
import * as THREE from "three";
import { boxG, coreMat, cylG, M, sphG, torG } from "../core/kit";
import { toonMaterial } from "../mat/materials";
import type { V3 } from "../types";
import { mix } from "../util";

export type CarKind = "sedan" | "hatch" | "pickup" | "van" | "vintage" | "truck";
export type CarProps = {
  p: V3;
  yaw?: number;
  kind?: CarKind;
  color?: string;
  /** distance driven (m): turns the wheels */
  dist?: number;
  speed?: number;
  accel?: number;
  yawRate?: number;
  /** 0..1 headlights */
  lights?: number;
  /** force brake lights (otherwise on while decelerating) */
  brake?: boolean;
  /** steering angle of the front wheels (rad); defaults to the turn rate */
  steer?: number;
  /** 0..1 crumple at the front (after a crash) */
  damage?: number;
  stripe?: string;
  /** dashboard, steering wheel, pillars and a roof liner, for cameras inside the car (cam/presets inCar) */
  interior?: boolean;
};

const DIM: Record<CarKind, { L: number; W: number; H: number; cab: [number, number, number]; r: number }> = {
  // length, width, roof height; cabin [front z, rear z, roof y]; wheel radius
  sedan: { L: 4.5, W: 1.85, H: 1.45, cab: [0.55, -1.25, 1.45], r: 0.35 },
  hatch: { L: 3.9, W: 1.75, H: 1.5, cab: [0.45, -1.7, 1.5], r: 0.33 },
  pickup: { L: 5.3, W: 2.0, H: 1.85, cab: [1.1, -0.35, 1.85], r: 0.42 },
  van: { L: 4.9, W: 1.95, H: 2.0, cab: [1.45, -2.3, 2.0], r: 0.37 },
  // a 1930s expedition car: tall upright cabin, big wheels, running boards, round lamps, a spare wheel on the back
  vintage: { L: 4.1, W: 1.7, H: 1.85, cab: [0.25, -1.35, 1.85], r: 0.4 },
  // a 1970s desert lorry: a short cab at the front, a tall tarp-covered cargo box behind it
  truck: { L: 7.2, W: 2.4, H: 2.9, cab: [3.3, 1.85, 2.75], r: 0.52 },
};

const shapeCache = new Map<string, THREE.BufferGeometry>();
/** a side profile (shape x = along the car, +x = front; y up) extruded across `width` with a rounded bevel: the soft
 * toy-car body. The bevel grows OUTWARD, so shapes are drawn inset by `bevel` and the width is reduced by 2·bevel:
 * the finished body is exactly L × W (bumpers, lights and glass placed at ±L/2 sit ON it, not inside it). */
const profileGeo = (key: string, make: () => THREE.Shape, width: number, bevel: number) => {
  const k = `${key}|${width}|${bevel}`;
  let g = shapeCache.get(k);
  if (!g) {
    if (shapeCache.size > 40) shapeCache.clear();
    const eg = new THREE.ExtrudeGeometry(make(), { depth: width - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 10 });
    eg.translate(0, 0, -(width - bevel * 2) / 2);
    eg.rotateY(-Math.PI / 2); // shape x → world z (front = +z)
    eg.computeVertexNormals();
    g = eg;
    shapeCache.set(k, g);
  }
  return g;
};
/** the lower body with wheel arches cut over both axles */
const bodyShape = (L: number, clear: number, h: number, wz: number, ar: number, b: number) => () => {
  const s = new THREE.Shape();
  const x0 = -L / 2 + b;
  const x1 = L / 2 - b;
  const y0 = clear + b;
  const y1 = clear + h - b;
  s.moveTo(x0, y0);
  // bottom edge, rear arch, middle, front arch (arches open downward over the wheel centers at y = clear)
  s.lineTo(-wz - ar, y0);
  s.absarc(-wz, y0, ar, Math.PI, 0, true);
  s.lineTo(wz - ar, y0);
  s.absarc(wz, y0, ar, Math.PI, 0, true);
  s.lineTo(x1, y0);
  s.lineTo(x1, y0 + (y1 - y0) * 0.55);
  s.quadraticCurveTo(x1, y1, x1 - 0.45, y1);
  s.lineTo(x0 + 0.25, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - 0.15);
  s.closePath();
  return s;
};
/** the cabin (greenhouse): raked windscreen and rear window */
const cabinShape = (front: number, rear: number, y0: number, top: number, b: number, rake: number) => () => {
  const s = new THREE.Shape();
  s.moveTo(rear - 0.1, y0);
  s.lineTo(front + rake * 0.5, y0);
  s.lineTo(front - rake * 0.5, top - b);
  s.lineTo(rear + 0.28, top - b);
  s.closePath();
  return s;
};

const Wheel: React.FC<{ p: V3; r: number; spin: number; steer: number; side: number }> = ({ p, r, spin, steer, side }) => (
  <group position={p} rotation={[0, steer, 0]}>
    <group rotation={[spin, 0, 0]}>
      <mesh geometry={cylG(r, r, 0.26, 24)} material={toonMaterial({ color: "#26262c", tex: "fabric", texScale: 3 })} rotation={[0, 0, Math.PI / 2]} castShadow />
      <mesh geometry={cylG(r * 0.58, r * 0.58, 0.27, 18)} material={toonMaterial({ color: "#c8ccd6", tex: "metal" })} rotation={[0, 0, Math.PI / 2]} position={[side * 0.006, 0, 0]} />
      {/* spokes make the roll readable (and its speed): 5 bars, only touching the hub */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} geometry={boxG(0.02, r * 0.95, 0.06)} material={toonMaterial({ color: "#8a8e98" })} position={[side * 0.14, 0, 0]} rotation={[(i * Math.PI * 2) / 5, 0, 0]} />
      ))}
    </group>
  </group>
);

export const Car: React.FC<CarProps> = ({ p, yaw = 0, kind = "sedan", color = "#b8322a", dist = 0, speed = 0, accel = 0, yawRate = 0, lights = 0, brake, steer, damage = 0, stripe, interior = false }) => {
  const D = DIM[kind];
  const { L, W, r } = D;
  const clear = r * 0.95; // body bottom above the ground (the wheels fill the arches below it)
  const wz = L / 2 - 0.85;
  const bodyH = 0.62;
  const body = useMemo(() => profileGeo(`body${kind}`, bodyShape(L, clear, bodyH, wz, r + 0.07, 0.08), W, 0.08), [kind, L, W, clear, wz, r]);
  const cabY = clear + bodyH - 0.02;
  const cabin = useMemo(() => profileGeo(`cab${kind}`, cabinShape(D.cab[0], D.cab[1], cabY, D.cab[2], 0.07, kind === "van" ? 0.25 : 0.55), W * 0.84, 0.07), [kind, D.cab, W, cabY]);
  // suspension: pitch back under acceleration, nose-dive on braking; roll out of a turn; a speed-scaled shimmy
  const pitch = THREE.MathUtils.clamp(-accel * 0.012, -0.06, 0.06);
  const roll = THREE.MathUtils.clamp(-yawRate * speed * 0.004, -0.06, 0.06);
  const spin = dist / r;
  const st = steer ?? THREE.MathUtils.clamp(yawRate * 0.35, -0.5, 0.5);
  const braking = brake ?? accel < -0.4;
  const paint = toonMaterial({ color });
  const dark = mix(color, "#101018", 0.55);
  const glass = toonMaterial({ color: "#2a3a5a" });
  const winY = (cabY + D.cab[2]) / 2;
  const winLen = Math.abs(D.cab[0] - D.cab[1]) * 0.72;
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      {/* contact shadows come from the key light; the body rides on the suspension above the wheels */}
      <group position={[0, 0, 0]} rotation={[pitch, 0, roll]}>
        <mesh geometry={body} material={paint} castShadow receiveShadow scale={[1, 1 - damage * 0.08, 1]} />
        <mesh geometry={cabin} material={kind === "pickup" || kind === "van" ? paint : toonMaterial({ color: mix(color, "#ffffff", 0.06) })} castShadow receiveShadow />
        {/* glass: side windows and a windscreen, 1 cm proud of the cabin, with a sky-reflection stripe */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh geometry={boxG(0.01, (D.cab[2] - cabY) * 0.62, winLen)} material={glass} position={[s * (W * 0.42 + 0.012), winY, (D.cab[0] + D.cab[1]) / 2 - 0.05]} />
            <mesh geometry={boxG(0.005, (D.cab[2] - cabY) * 0.55, 0.12)} material={coreMat("#c8dcff", 0.5, 0.6)} position={[s * (W * 0.42 + 0.02), winY, (D.cab[0] + D.cab[1]) / 2 + 0.25]} rotation={[0.5, 0, 0]} userData={{ outline: false }} />
          </group>
        ))}
        {/* bumpers, grille, lights */}
        <M g={boxG(W * 0.98, 0.16, 0.14)} c="#3a3a42" p={[0, clear + 0.06, L / 2 + 0.06]} />
        <M g={boxG(W * 0.98, 0.16, 0.14)} c="#3a3a42" p={[0, clear + 0.06, -L / 2 - 0.06]} />
        <M g={boxG(W * 0.4, 0.16, 0.04)} c={dark} p={[0, clear + 0.3, L / 2 + 0.02]} />
        {[-1, 1].map((s) => (
          <group key={`l${s}`}>
            <mesh geometry={boxG(0.3, 0.13, 0.04)} material={lights > 0 ? coreMat("#fff6d8", 0.75 + 0.45 * lights) : toonMaterial({ color: "#e8eef8" })} position={[s * (W / 2 - 0.3), clear + 0.36, L / 2 + 0.02]} userData={{ outline: lights > 0 ? false : undefined }} />
            <mesh geometry={boxG(0.32, 0.12, 0.04)} material={coreMat("#ff2a2a", braking ? 1.15 : lights > 0 ? 0.75 : 0.45)} position={[s * (W / 2 - 0.28), clear + 0.42, -L / 2 - 0.02]} userData={{ outline: false }} />
          </group>
        ))}
        {interior ? (
          <group>
            {/* dashboard under the windscreen, a steering wheel at the driver's seat (+x), A-pillars and a roof liner */}
            <M g={boxG(W * 0.8, 0.2, 0.55)} c="#2e2e36" tex="fabric" p={[0, cabY - 0.04, D.cab[0] + 0.02]} />
            <mesh geometry={boxG(0.26, 0.08, 0.02)} material={coreMat("#8ad0ff", 0.55)} position={[0.38, cabY + 0.065, D.cab[0] - 0.255]} rotation={[-0.35, 0, 0]} userData={{ outline: false }} />
            <mesh geometry={torG(0.17, 0.022)} material={toonMaterial({ color: "#1e1e24" })} position={[0.38, cabY - 0.02, D.cab[0] - 0.4]} rotation={[-0.45, 0, 0]} />
            <M g={boxG(0.05, 0.05, 0.26)} c="#1e1e24" p={[0.38, cabY - 0.05, D.cab[0] - 0.28]} r={[-0.45, 0, 0]} />
            {/* the cabin floor and seat backs: the body's top never shows inside */}
            <M g={boxG(W * 0.8, 0.03, Math.abs(D.cab[0] - D.cab[1]) * 0.95)} c="#3a3540" tex="fabric" p={[0, clear + bodyH + 0.012, (D.cab[0] + D.cab[1]) / 2 - 0.05]} />
            {[-1, 1].map((s2) => (
              <M key={`ap${s2}`} g={boxG(0.07, D.cab[2] - cabY, 0.07)} c={color} p={[s2 * W * 0.41, (cabY + D.cab[2]) / 2, D.cab[0]]} r={[-0.55 * (kind === "van" ? 0.45 : 1), 0, 0]} />
            ))}
            <M g={boxG(W * 0.82, 0.03, Math.abs(D.cab[0] - D.cab[1]) * 0.9)} c="#c8c2b4" p={[0, D.cab[2] - 0.05, (D.cab[0] + D.cab[1]) / 2 - 0.1]} side={THREE.DoubleSide} />
          </group>
        ) : null}
        {kind === "truck" ? (
          <group>
            {/* the cargo box: wooden sides, a canvas tarp roof, sitting on the chassis behind the cab */}
            <M g={boxG(W * 0.98, 1.5, D.cab[1] + L / 2 - 0.25)} c="#8a6a48" tex="planks" p={[0, clear + bodyH + 0.75, (D.cab[1] - 0.25 - L / 2) / 2]} />
            <M g={boxG(W * 1.0, 0.5, D.cab[1] + L / 2 - 0.2)} c="#b8a07a" tex="fabric" p={[0, clear + bodyH + 1.75, (D.cab[1] - 0.25 - L / 2) / 2]} />
          </group>
        ) : null}
        {kind === "vintage" ? (
          <group>
            {[-1, 1].map((s2) => (
              <group key={`rb${s2}`}>
                <M g={boxG(0.22, 0.05, L * 0.55)} c="#2a2a30" p={[s2 * (W / 2 + 0.1), clear + 0.02, 0]} />
                <mesh geometry={sphG(0.13, 16)} material={lights > 0 ? coreMat("#fff2c8", 1.0) : toonMaterial({ color: "#e8e4d8", tex: "metal" })} position={[s2 * (W / 2 - 0.25), clear + bodyH + 0.05, L / 2 - 0.15]} userData={{ outline: lights > 0 ? false : undefined }} />
              </group>
            ))}
            <mesh geometry={cylG(r * 0.95, r * 0.95, 0.22, 20)} material={toonMaterial({ color: "#26262c", tex: "fabric", texScale: 3 })} position={[0, clear + bodyH * 0.7, -L / 2 - 0.16]} rotation={[Math.PI / 2, 0, 0]} />
          </group>
        ) : null}
        {stripe ? <M g={boxG(W + 0.005, 0.1, L * 0.9)} c={stripe} p={[0, clear + 0.5, 0]} cast={false} /> : null}
        {lights > 0 ? (
          <>
            <pointLight position={[0, clear + 0.45, L / 2 + 1.5]} intensity={14 * lights} distance={14} decay={2} color="#fff0d0" />
            {braking ? <pointLight position={[0, clear + 0.5, -L / 2 - 0.8]} intensity={4} distance={5} decay={2} color="#ff3020" /> : null}
          </>
        ) : null}
      </group>
      {[-1, 1].map((s) =>
        [1, -1].map((f) => <Wheel key={`${s}${f}`} p={[s * (W / 2 - 0.15), r, f * wz]} r={r} spin={spin} steer={f > 0 ? st : 0} side={s} />),
      )}
      {damage > 0 ? <mesh geometry={torG(0.25, 0.03)} material={toonMaterial({ color: "#5a5a60" })} position={[0.3, clear + 0.75, L / 2 - 0.2]} rotation={[1.2, 0.4, 0]} /> : null}
    </group>
  );
};

/** headlight beams on a dark/wet road: two soft additive cones ahead of the car (no ink). Night and rain only. */
export const Beams: React.FC<{ p: V3; yaw?: number; on?: number; length?: number; width?: number }> = ({ p, yaw = 0, on = 1, length = 14, width = 1.85 }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff2c8").multiplyScalar(0.07 * on), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), [on]);
  return (
    <group position={p} rotation={[0, yaw, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={coneBeam(length)} material={mat} position={[s * (width / 2 - 0.3), 0.6, 0]} userData={{ outline: false }} />
      ))}
    </group>
  );
};
const beamCache = new Map<number, THREE.BufferGeometry>();
const coneBeam = (len: number) => {
  let g = beamCache.get(len);
  if (!g) {
    g = new THREE.ConeGeometry(len * 0.22, len, 20, 1, true);
    g.translate(0, -len / 2, 0);
    g.rotateX(-Math.PI / 2);
    g.rotateX(0.06); // aim slightly down at the road
    beamCache.set(len, g);
  }
  return g;
};
