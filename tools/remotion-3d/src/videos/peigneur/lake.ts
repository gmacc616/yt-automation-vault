// Lake Peigneur, 1980: terrain (lake bed, bank, Jefferson Island hill, the canal, and the collapse pit under the rig),
// the drilling rig, eleven barges and a tug, the peninsula that slides into the pit, plus three far-away sets: the
// cut-away diagram (lake -> clay -> salt -> mine levels), the salt-mine gallery with its elevator, and the night kitchen
// (sugar cube in tea, built 4x size so the lens never comes closer than ~1 m). Nothing here knows the timeline:
// world.ts poses everything from story.ts each frame.
import * as THREE from "three";
import { Batch, boxGeo, V, lam } from "./build";
import { ctex, grassHD } from "./paint";
import { twoTone } from "./shade";

export type V3 = [number, number, number];
export const BANK = 1.2;                 // bank top above the lake surface (m)
export const BED = -3;                   // lake bed: 10 ft deep
export const HOLE: V3 = [75, 0, -10];    // where the drill went in (pit centre)
export const PIT_IN = 55, PIT_OUT = 75, PIT_DEPTH = 55;
export const CANAL_Z = 0;                // Delcambre canal runs out east along z = 0
export const ISLE: V3 = [-30, 0, -205];  // Jefferson Island hill

const smooth = (a: number, b: number, x: number) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
/** lake shore radius by direction; the wooded peninsula juts toward the rig at theta 0.5 */
export const shoreR = (th: number) => 150 + 14 * Math.sin(3 * th + 1) + 7 * Math.sin(5 * th + 2) - 58 * Math.exp(-((((th - 0.5 + Math.PI * 3) % (Math.PI * 2) - Math.PI) / 0.2) ** 2));
export const pitY = (x: number, z: number) => { const d = Math.hypot(x - HOLE[0], z - HOLE[2]); return BED - PIT_DEPTH * (1 - smooth(PIT_IN, PIT_OUT, d)) - 6 * Math.max(0, 1 - d / 20); };
/** canal mouth: x where the canal meets the lake (shore at theta 0) */
export const CANAL_X0 = shoreR(0);
const inCanal = (x: number, z: number) => Math.abs(z - CANAL_Z) < 7 && x > CANAL_X0 - 4;
/** ground height (bank, bed, island, canal) WITHOUT the pit */
export const groundY = (x: number, z: number) => {
  const r = Math.hypot(x, z), rs = shoreR(Math.atan2(z, x));
  let y = r < rs - 12 ? BED : r > rs + 3 ? BANK : BED + (BANK - BED) * smooth(rs - 12, rs + 3, r);
  const di = Math.hypot(x - ISLE[0], z - ISLE[2]);
  if (di < 60) y = Math.max(y, BANK + 24 * Math.max(0, 1 - (di / 60) ** 2) ** 1.4);
  if (inCanal(x, z)) y = Math.min(y, BANK - 2.6 * smooth(7, 4.5, Math.abs(z - CANAL_Z)));
  return y;
};
export const terrainY = (x: number, z: number) => Math.min(groundY(x, z), pitY(x, z));

// ---------------- painted textures ----------------
const mudTex = () => ctex("mudHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#8a6a4c"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 90; i++) {
    const x = r() * 1024, y = r() * 1024, rad = 30 + r() * 120;
    for (const ox of [-1024, 0, 1024]) for (const oy of [-1024, 0, 1024]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, r() > 0.5 ? "rgba(70,50,36,0.35)" : "rgba(160,130,96,0.3)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
  g.strokeStyle = "rgba(50,34,26,0.5)"; g.lineWidth = 2;
  for (let i = 0; i < 70; i++) { // dried cracks
    let x = r() * 1024, y = r() * 1024; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); }
    g.stroke();
  }
});
const saltTex = () => ctex("saltHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#e9e6e0"; g.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 6 + r() * 14) { // banded rock salt
    g.fillStyle = `rgba(${150 + r() * 40},${150 + r() * 40},${160 + r() * 40},${0.12 + r() * 0.18})`;
    g.fillRect(0, y, 1024, 2 + r() * 6);
  }
  for (let i = 0; i < 260; i++) { // crystals / chisel marks
    const x = r() * 1024, y = r() * 1024, s = 4 + r() * 14;
    g.fillStyle = r() > 0.6 ? "rgba(255,255,255,0.7)" : "rgba(120,120,135,0.22)";
    g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.7, y); g.lineTo(x, y + s * 0.6); g.lineTo(x - s * 0.6, y); g.fill();
  }
});
const layerTex = (key: string, base: string, dots: string) => ctex(key, 512, 512, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 400; i++) { g.fillStyle = dots; const x = r() * 512, y = r() * 512; g.fillRect(x, y, 2 + r() * 6, 1.5 + r() * 3); }
  for (let y = 0; y < 512; y += 30 + r() * 50) { g.fillStyle = "rgba(0,0,0,0.08)"; g.fillRect(0, y, 512, 2 + r() * 4); }
});
const rustTex = () => ctex("bargeRust", 512, 512, (g, r) => {
  g.fillStyle = "#9a5a3a"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 140; i++) { g.fillStyle = r() > 0.5 ? "rgba(70,36,24,0.35)" : "rgba(190,120,70,0.3)"; const x = r() * 512, y = r() * 512; g.fillRect(x, y, 6 + r() * 40, 2 + r() * 20); }
  g.fillStyle = "#3a2a24"; for (let y = 64; y < 512; y += 128) g.fillRect(0, y, 512, 3);
});

const GRASS = () => lam("grassHD", () => ({ map: grassHD() }));
const MUD = () => lam("mudHD", () => ({ map: mudTex() }));

// ---------------- terrain meshes ----------------
/** polar height mesh from r0 to r1 (by direction), nr x nth cells, y = fy(x, z); uv = world xz / tile */
const polar = (r0: (th: number) => number, r1: (th: number) => number, nr: number, nth: number, fy: (x: number, z: number) => number, tile: number, rpow = 1) => {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= nth; j++) {
    const th = (j / nth) * Math.PI * 2, a = r0(th), b = r1(th);
    for (let i = 0; i <= nr; i++) {
      const r = a + (b - a) * (i / nr) ** rpow, x = r * Math.cos(th), z = r * Math.sin(th);
      pos.push(x, fy(x, z), z); uv.push(x / tile, z / tile);
    }
  }
  for (let j = 0; j < nth; j++) for (let i = 0; i < nr; i++) {
    const a = j * (nr + 1) + i, b = a + 1, c = a + nr + 2, d = a + nr + 1;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  // the cells wind clockwise seen from above with this ordering: flip so the top faces up
  const ix = g.index!.array as Uint32Array | Uint16Array;
  for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; }
  g.computeVertexNormals();
  return g;
};
/** peninsula patch (the land that falls in): everything of the wooded spit within PIT_OUT + 6 of the hole */
export const onSpit = (x: number, z: number) => Math.hypot(x - HOLE[0], z - HOLE[2]) < PIT_OUT + 6 && groundY(x, z) > BED + 0.5;

export class Terrain {
  group = new THREE.Group();
  constructor() {
    const b = new Batch();
    const grass = GRASS();
    const mud = MUD();
    // lake bed + pit (mud), out to just past the shore; the bank / island / canal (grass) beyond
    b.add(polar(() => 0, (th) => shoreR(th) + 4, 90, 360, terrainY, 6, 0.8), mud);
    b.add(polar((th) => shoreR(th) - 1, () => 900, 70, 360, (x, z) => (onSpit(x, z) ? pitY(x, z) : groundY(x, z)), 4, 2.2), grass);
    b.build(this.group);
  }
}
/** the wooded spit that slides into the pit: its own mesh (grass top + mud skirt), posed by world.ts */
export class Spit {
  group = new THREE.Group();
  constructor() {
    const b = new Batch();
    const grass = GRASS();
    const mud = MUD();
    const N = 40, pos: number[] = [], uv: number[] = [];
    const C = (x: number, z: number) => onSpit(x, z);
    const s = 2.2;
    for (let i = -N; i < N; i++) for (let k = -N; k < N; k++) {
      const x = HOLE[0] + i * s, z = HOLE[2] + k * s;
      const cs = [[x, z], [x + s, z], [x + s, z + s], [x, z + s]];
      if (!cs.every(([a, c]) => C(a, c))) continue;
      const P = cs.map(([a, c]) => [a, groundY(a, c), c]);
      for (const t of [0, 1, 2, 0, 2, 3]) { pos.push(...P[t]); uv.push(P[t][0] / 4, P[t][2] / 4); }
    }
    const top = new THREE.BufferGeometry();
    top.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); top.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    // winding: quads listed x then z -> faces point down; flip
    const p = top.attributes.position.array as Float32Array, u = top.attributes.uv.array as Float32Array;
    for (let t = 0; t < p.length; t += 9) for (let c = 0; c < 3; c++) { const a = p[t + 3 + c]; p[t + 3 + c] = p[t + 6 + c]; p[t + 6 + c] = a; }
    for (let t = 0; t < u.length; t += 6) for (let c = 0; c < 2; c++) { const a = u[t + 2 + c]; u[t + 2 + c] = u[t + 4 + c]; u[t + 4 + c] = a; }
    top.computeVertexNormals();
    b.add(top, grass);
    // a thick mud skirt under the patch so the falling chunk reads as solid ground
    const sk = new THREE.CylinderGeometry(30, 22, 14, 24, 1, true).translate(0, -7.3, 0);
    b.add(sk, mud, new THREE.Matrix4().makeTranslation(HOLE[0] + 16, 0, HOLE[2] + 52));
    b.build(this.group);
  }
}

// ---------------- the rig ----------------
/** inland drilling barge: pontoon hull, deck, derrick (lattice), drawworks house, pipe rack, the drill string. Rig
 *  space: origin at the drill hole on the water line, derrick over the origin, deck at y = 3. */
export const RIG_DECK = 3.0;
export class Rig {
  group = new THREE.Group();
  pipe: THREE.Mesh;
  private rotary: THREE.Mesh;
  constructor() {
    const b = new Batch();
    const hull = lam("rigHull", () => ({ color: "#5f6f86" })), deck = lam("rigDeck", () => ({ color: "#9a9a96" }));
    const red = lam("rigRed", () => ({ color: "#d4483a" })), white = lam("rigWhite", () => ({ color: "#ece6da" })), yel = lam("rigYel", () => ({ color: "#f2c443" }));
    const dark = lam("rigDark", () => ({ color: "#3a3d47" }));
    const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: THREE.Material) => b.add(boxGeo(V(x0, y0, z0), V(x1, y1, z1)), m);
    box(-18, -1.6, -9, 14, RIG_DECK - 0.4, 9, hull);
    box(-18, RIG_DECK - 0.4, -9, 14, RIG_DECK, 9, deck);
    for (const z of [-9, 8.8]) box(-18, RIG_DECK, z, 14, RIG_DECK + 1.0, z + 0.2, yel); // rails
    // derrick: 4 tapered legs + braces, 30 m
    const H = 30, w0 = 3.4, w1 = 0.9, leg = (x: number, z: number, x2: number, z2: number, y0: number, y1: number, r: number, m: THREE.Material) => {
      const a = V(x, y0, z), c = V(x2, y1, z2), L = a.distanceTo(c);
      const g = new THREE.CylinderGeometry(r, r, L, 6).translate(0, L / 2, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize());
      b.add(g, m, new THREE.Matrix4().compose(a, q, V(1, 1, 1)));
    };
    const at = (s: number, y: number) => { const w = w0 + (w1 - w0) * (y / H); return [s * w, s * w] as const; };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) leg(sx * w0, sz * w0, sx * w1, sz * w1, RIG_DECK, RIG_DECK + H, 0.22, red);
    for (let k = 0; k < 8; k++) {
      const y0 = (k * H) / 8, y1 = ((k + 1) * H) / 8, a0 = w0 + (w1 - w0) * (y0 / H), a1 = w0 + (w1 - w0) * (y1 / H);
      const m = k % 2 ? red : white;
      for (const s of [-1, 1]) {
        leg(-a0, s * a0, a1, s * a1, RIG_DECK + y0, RIG_DECK + y1, 0.1, m); leg(s * a0, -a0, s * a1, a1, RIG_DECK + y0, RIG_DECK + y1, 0.1, m);
        leg(-a1, s * a1, a1, s * a1, RIG_DECK + y1, RIG_DECK + y1 + 0.001, 0.1, m); leg(s * a1, -a1, s * a1, a1, RIG_DECK + y1, RIG_DECK + y1 + 0.001, 0.1, m);
      }
    }
    void at;
    box(-1.6, RIG_DECK + H, -1.6, 1.6, RIG_DECK + H + 1.2, 1.6, red); // crown block
    box(-4, RIG_DECK, -4, 4, RIG_DECK + 2.2, 4, white);                  // drill floor
    box(-13, RIG_DECK, -6, -5.5, RIG_DECK + 4.5, 2, white);              // doghouse / drawworks
    box(-13, RIG_DECK + 4.5, -6, -5.5, RIG_DECK + 4.8, 2, red);
    for (const z of [-5, -3.6]) box(-12.4, RIG_DECK + 1.6, z, -11.2, RIG_DECK + 2.8, z + 0.9, dark); // windows
    box(6, RIG_DECK, -7, 13, RIG_DECK + 3.4, -1, yel);                   // mud tanks
    for (let k = 0; k < 6; k++) b.add(new THREE.CylinderGeometry(0.25, 0.25, 12, 8).rotateZ(Math.PI / 2), dark, new THREE.Matrix4().makeTranslation(-2 - k * 0.0, RIG_DECK + 0.3 + (k % 3) * 0.5, 4 + Math.floor(k / 3) * 0.5 + (k % 3) * 0.55)); // pipe rack
    b.build(this.group);
    this.rotary = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 16), yel);
    this.rotary.position.set(0, RIG_DECK + 2.45, 0);
    this.pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1, 10).translate(0, -0.5, 0), dark);
    this.pipe.position.set(0, RIG_DECK + 2.7, 0);
    for (const m of [this.rotary, this.pipe]) { m.castShadow = true; m.receiveShadow = true; this.group.add(m); }
  }
  /** drill string length below the drill floor (m) and its spin */
  pose(len: number, spin: number) { this.pipe.scale.set(1, Math.max(0.01, len), 1); this.rotary.rotation.y = spin; this.pipe.rotation.y = spin; }
}

// ---------------- barges + tug ----------------
/** one deck barge (local: bow +x, 20 x 7 m, deck 1.1 m above the water) with a cargo of pipe, drums or crates */
export const BARGE_DECK = 1.1;
const bargeGeo = (b: Batch, kind: number) => {
  const hull = lam("bargeHull", () => ({ map: rustTex() })), deck = lam("bargeDeck", () => ({ color: "#6a5a4e" }));
  const pipeM = lam("bargePipe", () => ({ color: "#3a4a5a" })), drum = lam("bargeDrum", () => ({ color: ["#3f6fb5", "#d4483a", "#f2c443"][kind % 3] })), crate = lam("bargeCrate", () => ({ color: "#c49a5a" }));
  b.add(boxGeo(V(-10, -1.4, -3.5), V(10, BARGE_DECK - 0.15, 3.5), 2), hull);
  b.add(boxGeo(V(-10, BARGE_DECK - 0.15, -3.5), V(10, BARGE_DECK, 3.5)), deck);
  // raked bow and stern
  for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(1.2, 1.2, 7, 3, 1).rotateX(Math.PI / 2).rotateZ(s > 0 ? 0 : Math.PI), hull, new THREE.Matrix4().makeTranslation(s * 10.3, -0.2, 0));
  if (kind % 3 === 0) for (let k = 0; k < 9; k++) b.add(new THREE.CylinderGeometry(0.3, 0.3, 15, 8).rotateZ(Math.PI / 2), pipeM, new THREE.Matrix4().makeTranslation(0, BARGE_DECK + 0.3 + Math.floor(k / 3) * 0.55, -1.2 + (k % 3) * 0.65 + (Math.floor(k / 3) % 2) * 0.3));
  else if (kind % 3 === 1) for (let k = 0; k < 12; k++) b.add(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 12), drum, new THREE.Matrix4().makeTranslation(-6 + (k % 6) * 2.2, BARGE_DECK + 0.6, -1.4 + Math.floor(k / 6) * 2.6));
  else for (let k = 0; k < 4; k++) b.add(boxGeo(V(-7 + k * 3.8, BARGE_DECK, -2.2), V(-4.4 + k * 3.8, BARGE_DECK + 2 + (k % 2) * 0.6, 2.2)), crate);
};
export const makeBarge = (kind: number) => { const g = new THREE.Group(), b = new Batch(); bargeGeo(b, kind); b.build(g); return g; };
export const makeTug = () => {
  const g = new THREE.Group(), b = new Batch();
  const hull = lam("tugHull", () => ({ color: "#2f4f8a" })), top = lam("tugTop", () => ({ color: "#f4f1ea" })), red = lam("rigRed", () => ({ color: "#d4483a" })), dark = lam("rigDark", () => ({ color: "#3a3d47" }));
  b.add(boxGeo(V(-5.5, -1.2, -2.2), V(4.5, 1.0, 2.2)), hull);
  b.add(new THREE.CylinderGeometry(2.2, 2.2, 2.2, 3).rotateX(Math.PI / 2), hull, new THREE.Matrix4().makeTranslation(4.6, -0.1, 0).multiply(new THREE.Matrix4().makeScale(1.2, 1, 1)));
  b.add(boxGeo(V(-5.5, 1.0, -2.25), V(5.0, 1.3, 2.25)), red); // rub rail
  b.add(boxGeo(V(-3, 1.0, -1.6), V(2, 3.0, 1.6)), top);
  b.add(boxGeo(V(-1.5, 3.0, -1.4), V(1.6, 4.8, 1.4)), top); // wheelhouse
  for (const z of [-1.41, 1.41]) b.add(boxGeo(V(-1.0, 3.6, z - 0.02), V(1.2, 4.4, z + 0.02)), dark);
  b.add(new THREE.CylinderGeometry(0.45, 0.5, 2.0, 12), red, new THREE.Matrix4().makeTranslation(-2.2, 4.0, 0));
  b.build(g);
  return g;
};
/** small aluminium fishing skiff (local bow +x) */
export const makeSkiff = () => {
  const g = new THREE.Group(), b = new Batch();
  const al = twoTone(new THREE.MeshPhongMaterial({ color: "#b8bcc4", specular: "#ffffff", shininess: 40 }), 0.15), seat = lam("skiffSeat", () => ({ color: "#8a6a4a" }));
  b.add(boxGeo(V(-2.2, -0.25, -0.75), V(2.2, 0.45, -0.68)), al); b.add(boxGeo(V(-2.2, -0.25, 0.68), V(2.2, 0.45, 0.75)), al);
  b.add(boxGeo(V(-2.2, -0.3, -0.75), V(2.2, -0.2, 0.75)), al);
  b.add(boxGeo(V(-2.3, -0.25, -0.75), V(-2.2, 0.45, 0.75)), al);
  b.add(new THREE.CylinderGeometry(0.75, 0.75, 0.7, 3).rotateX(Math.PI / 2), al, new THREE.Matrix4().makeTranslation(2.5, 0.1, 0).multiply(new THREE.Matrix4().makeScale(0.5, 1, 1)));
  b.add(boxGeo(V(-0.3, 0.15, -0.7), V(0.3, 0.25, 0.7)), seat);
  b.add(boxGeo(V(-2.6, -0.05, -0.15), V(-2.3, 0.45, 0.15)), lam("rigDark", () => ({ color: "#3a3d47" }))); // outboard
  b.build(g);
  return g;
};

// ---------------- far sets ----------------
export const CUT: V3 = [2600, 0, 0];      // cut-away diagram (front face at z = CUT z, looking -z)
export const MINE: V3 = [-2600, 0, 0];    // salt gallery, floor y = 0
export const KIT: V3 = [0, 600, 0];       // night kitchen (4x scale), floor y = KIT y
export const KS = 4;
/** cut-away depths (diagram metres, compressed): lake 0..-4, clay to -30, cap rock to -40, salt below; galleries */
export const CUT_W = 80;
export const CUT_LAKE = -4, CUT_CLAY = -30, CUT_CAP = -40, CUT_BOT = -150;
export const CUT_LEVELS = [-78, -102, -126];   // mine galleries (the drill hits the top one)
export const CUT_HOLE_X = 0;
export class Cutaway {
  group = new THREE.Group();
  water: THREE.Mesh; funnel: THREE.Mesh; cavity: THREE.Mesh; pipe: THREE.Mesh; rig: Rig;
  constructor() {
    const b = new Batch(), [cx, , cz] = CUT, W = CUT_W / 2, Dp = 40;
    const clay = lam("cutClay", () => ({ map: layerTex("cutClayT", "#a8643c", "rgba(70,40,24,0.4)") }));
    const clay2 = lam("cutClay2", () => ({ map: layerTex("cutClay2T", "#c98a52", "rgba(100,60,30,0.35)") }));
    const cap = lam("cutCap", () => ({ map: layerTex("cutCapT", "#7d7a86", "rgba(40,40,50,0.4)") }));
    const salt = lam("saltHD", () => ({ map: saltTex() }));
    const grass = GRASS();
    const dark = lam("cutGallery", () => ({ color: "#5a4a6a" })), lamp = lam("cutLamp", () => ({ color: "#ffe6a0" }));
    const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: THREE.Material, tile = 0) => b.add(boxGeo(V(cx + x0, y0, cz + z0), V(cx + x1, y1, cz + z1), tile), m);
    box(-W, CUT_LAKE, -Dp, W, CUT_LAKE + 0.01, 0, clay2);                      // lake floor (seen through the water)
    box(-W, (CUT_LAKE + CUT_CLAY) / 2, -Dp, W, CUT_LAKE, 0, clay2, 8);
    box(-W, CUT_CLAY, -Dp, W, (CUT_LAKE + CUT_CLAY) / 2, 0, clay, 8);
    box(-W, CUT_CAP, -Dp, W, CUT_CLAY, 0, cap, 8);
    box(-W, CUT_BOT, -Dp, W, CUT_CAP, 0, salt, 16);
    for (const s of [-1, 1]) box(s > 0 ? W : -W - 30, BANK, -Dp, s > 0 ? W + 30 : -W, BANK + 0.01, 0, grass); // banks either side, at the lake top
    for (const s of [-1, 1]) box(s > 0 ? W : -W - 30, CUT_BOT, -Dp, s > 0 ? W + 30 : -W, BANK, 0, clay, 8);
    // mine galleries: dark rooms in section with pillars, a lamp in each
    CUT_LEVELS.forEach((y, i) => {
      for (let k = -3; k <= 3; k++) {
        const x = k * 11 + (i % 2) * 5;
        box(x - 4, y, -0.6, x + 4, y + 7, 0.02, dark);
        box(x - 0.25, y + 5.4, -0.5, x + 0.25, y + 5.9, 0.08, lamp);
      }
    });
    b.build(this.group);
    // the lake water: a box whose height world.ts sets (scale y), plus the funnel (cone) and the dissolving cavity
    const wm = new THREE.MeshLambertMaterial({ color: "#2f9fe0" });
    this.water = new THREE.Mesh(new THREE.BoxGeometry(CUT_W, 1, Dp).translate(0, -0.5, -Dp / 2), twoTone(wm));
    this.water.position.set(cx, 0, cz);
    this.funnel = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 40, 1, true).rotateX(Math.PI).translate(0, -0.5, 0), twoTone(new THREE.MeshLambertMaterial({ color: "#2a7fb8", side: THREE.DoubleSide })));
    this.cavity = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), twoTone(new THREE.MeshLambertMaterial({ color: "#2a6aa8" })));
    this.pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1, 10).translate(0, -0.5, 0), lam("cutPipe", () => ({ color: "#e2453c" })));
    this.rig = new Rig();
    this.rig.group.scale.setScalar(0.55);
    for (const m of [this.water, this.funnel, this.cavity, this.pipe]) { m.castShadow = false; m.receiveShadow = true; this.group.add(m); }
    this.group.add(this.rig.group);
  }
  /** drill tip depth (m, negative), cavity radius, lake water depth (top layer), funnel depth (0 = none), rig shown */
  pose(tip: number, cav: number, lake: number, funnel: number, rig: boolean, bit = false) {
    const [cx, , cz] = CUT;
    this.rig.group.position.set(cx + CUT_HOLE_X, 0, cz - 6); this.rig.group.visible = rig;
    this.pipe.position.set(cx + CUT_HOLE_X, 3, cz + 0.45); this.pipe.scale.set(1, Math.max(0.01, 3 - tip), 1); this.pipe.visible = rig && tip < 0;
    if (!rig && bit) { // the little drill left at the bottom of the new lake
      this.pipe.visible = true; this.pipe.position.set(cx + CUT_HOLE_X + 1.2, CUT_LEVELS[0] + 7.6, cz - 4); this.pipe.scale.set(1.4, 5, 1.4); this.pipe.rotation.z = 1.2;
    } else this.pipe.rotation.z = 0;
    this.water.scale.set(1, Math.max(0.01, lake), 1); this.water.visible = lake > 0.02;
    this.cavity.visible = cav > 0.05; this.cavity.position.set(cx + CUT_HOLE_X, CUT_LEVELS[0] + 3, cz + 0.2); this.cavity.scale.set(cav, cav * 1.15, Math.min(cav, 5));
    this.funnel.visible = funnel > 0.05;
    this.funnel.position.set(cx + CUT_HOLE_X, 0.02, cz - 6); this.funnel.scale.set(8 + funnel * 0.25, funnel, 8 + funnel * 0.25);
  }
}

export class Mine {
  group = new THREE.Group();
  cage: THREE.Group; floodM: THREE.Mesh; pour: THREE.Mesh[] = [];
  static CEIL = 14;
  static SHAFT: V3 = [36, 0, -12];
  constructor() {
    const b = new Batch(), [mx, my, mz] = MINE, C = Mine.CEIL;
    const salt = lam("saltHD", () => ({ map: saltTex() })), floor = lam("mineFloor", () => ({ color: "#bdb6ae" }));
    const steel = lam("rigDark", () => ({ color: "#3a3d47" })), yel = lam("rigYel", () => ({ color: "#f2c443" }));
    const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: THREE.Material, tile = 0) => b.add(boxGeo(V(mx + x0, my + y0, mz + z0), V(mx + x1, my + y1, mz + z1), tile), m);
    box(-120, -0.5, -120, 120, 0, 120, floor);
    b.add(boxGeo(V(mx - 120, my + C, mz - 120), V(mx + 120, my + C + 2, mz + 120), 20, true), salt); // roof (its underside is what we see)
    // room-and-pillar: 16 m pillars on a 34 m grid (tunnels 18 m wide), a back wall far away
    for (let i = -3; i <= 3; i++) for (let k = -3; k <= 3; k++) {
      const x = i * 34 + 17, z = k * 34 + 17;
      if (Math.hypot(x - Mine.SHAFT[0], z - Mine.SHAFT[2]) < 14) continue;
      box(x - 8, 0, z - 8, x + 8, C, z + 8, salt, 8);
    }
    for (const s of [-1, 1]) { box(-120, 0, s * 120 - 1, 120, C, s * 120 + 1, salt, 20); box(s * 120 - 1, 0, -120, s * 120 + 1, C, 120, salt, 20); }
    // elevator shaft frame (yellow steel) up through the roof
    const [sx, , sz] = Mine.SHAFT;
    for (const ox of [-2.2, 2.2]) for (const oz of [-2.2, 2.2]) box(sx + ox - 0.2, 0, sz + oz - 0.2, sx + ox + 0.2, C + 2, sz + oz + 0.2, yel);
    box(sx - 2.6, C - 0.6, sz - 2.6, sx + 2.6, C, sz + 2.6, steel);
    b.build(this.group, false);
    // wall lamps: emissive bulbs on the pillars (bloom picks them up)
    const bulb = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.9, 2.0), fog: false });
    for (let i = -2; i <= 2; i++) for (let k = -2; k <= 2; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), bulb);
      m.position.set(mx + i * 34 + 17 + 8.3, my + 9, mz + k * 34 + 17); this.group.add(m);
    }
    // the cage
    this.cage = new THREE.Group();
    const cb = new Batch();
    cb.add(boxGeo(V(-2, 0, -2), V(2, 0.2, 2)), steel); cb.add(boxGeo(V(-2, 3.4, -2), V(2, 3.6, 2)), steel);
    for (const ox of [-1.95, 1.95]) for (const oz of [-1.95, 1.95]) cb.add(boxGeo(V(ox - 0.08, 0, oz - 0.08), V(ox + 0.08, 3.5, oz + 0.08)), yel);
    for (const y of [1.1, 2.2]) for (const s of [-1, 1]) cb.add(boxGeo(V(-2, y, s * 1.95 - 0.05), V(2, y + 0.08, s * 1.95 + 0.05)), yel);
    cb.build(this.cage);
    this.group.add(this.cage);
    // flood water on the floor (scaled disc) + water pouring from the roof (scrolling sheets, see world.ts)
    this.floodM = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), twoTone(new THREE.MeshLambertMaterial({ color: "#2f8fc4" })));
    this.floodM.receiveShadow = true;
    this.group.add(this.floodM);
  }
}

export class Kitchen {
  group = new THREE.Group();
  cube: THREE.Mesh; crumb: THREE.Mesh; tea: THREE.Mesh;
  static TABLE = 0.78 * KS;
  static CUP: V3 = [0, 0, 0];
  constructor() {
    const b = new Batch(), [kx, ky, kz] = KIT, S = KS;
    const wood = lam("kitTable", () => ({ color: "#b5784a" })), wall = lam("kitWall", () => ({ color: "#e8c88a" })), floor = lam("kitFloor", () => ({ color: "#8a5a3a" }));
    const cupM = lam("kitCup", () => ({ color: "#f4f1ea" })), cupband = lam("kitCupBand", () => ({ color: "#3f6fb5" })), frame = lam("kitFrame", () => ({ color: "#f4f1ea" }));
    const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: THREE.Material) => b.add(boxGeo(V(kx + x0 * S, ky + y0 * S, kz + z0 * S), V(kx + x1 * S, ky + y1 * S, kz + z1 * S)), m);
    box(-3, -0.1, -2, 3, 0, 2, floor);
    box(-3, 0, -2, 3, 2.6, -1.95, wall);
    box(-3, 0, -2, -2.95, 2.6, 2, wall);
    box(-0.8, 0.74, -0.5, 0.8, 0.78, 0.5, wood);
    for (const ox of [-0.72, 0.72]) for (const oz of [-0.42, 0.42]) box(ox - 0.03, 0, oz - 0.03, ox + 0.03, 0.74, oz + 0.03, wood);
    // night window in the back wall
    box(-0.9, 1.0, -1.96, 0.9, 2.1, -1.94, frame);
    b.build(this.group, false);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.7 * S, 1.0 * S), new THREE.MeshBasicMaterial({ color: "#2a2f78", fog: false }));
    glass.position.set(kx, ky + 1.55 * S, kz - 1.93 * S); this.group.add(glass);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(0.09 * S, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 1.7), fog: false }));
    moon.position.set(kx + 0.55 * S, ky + 1.85 * S, kz - 1.925 * S); this.group.add(moon);
    // lamp over the table
    const shadeM = lam("kitShade", () => ({ color: "#d4483a", side: THREE.DoubleSide }));
    const lampSh = new THREE.Mesh(new THREE.ConeGeometry(0.25 * S, 0.22 * S, 24, 1, true), shadeM); lampSh.position.set(kx, ky + 1.75 * S, kz); this.group.add(lampSh);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05 * S, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.3, 2.2), fog: false })); bulb.position.set(kx, ky + 1.66 * S, kz); this.group.add(bulb);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.005 * S, 0.005 * S, 0.8 * S, 6), lam("rigDark", () => ({ color: "#3a3d47" }))); cord.position.set(kx, ky + 2.2 * S, kz); this.group.add(cord);
    // the cup (lathe) with a band, saucer, tea, sugar cube
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2((0.034 + 0.016 * Math.sin(t * 1.4)) * S, t * 0.075 * S)); }
    for (let i = 10; i >= 0; i--) { const t = i / 10; prof.push(new THREE.Vector2((0.031 + 0.016 * Math.sin(t * 1.4)) * S, (0.004 + t * 0.07) * S)); }
    const cup = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), cupM); cup.position.set(kx, ky + 0.78 * S + 0.006 * S, kz); this.group.add(cup);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0485 * S, 0.046 * S, 0.012 * S, 40, 1, true), cupband); band.position.set(kx, ky + 0.78 * S + 0.06 * S, kz); this.group.add(band);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.018 * S, 0.005 * S, 8, 20), cupM); handle.position.set(kx + 0.055 * S, ky + 0.78 * S + 0.045 * S, kz); this.group.add(handle);
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * S, 0.06 * S, 0.012 * S, 40), cupM); saucer.position.set(kx, ky + 0.78 * S + 0.006 * S, kz); this.group.add(saucer);
    this.tea = new THREE.Mesh(new THREE.CircleGeometry(0.044 * S, 40).rotateX(-Math.PI / 2), lam("kitTea", () => ({ color: "#a8602c" })));
    this.tea.position.set(kx, ky + 0.78 * S + 0.066 * S, kz); this.group.add(this.tea);
    const sugar = lam("kitSugar", () => ({ color: "#fbfaf6" }));
    this.cube = new THREE.Mesh(new THREE.BoxGeometry(0.016 * S, 0.016 * S, 0.016 * S), sugar); this.group.add(this.cube);
    this.crumb = new THREE.Mesh(new THREE.SphereGeometry(0.01 * S, 12, 8), twoTone(new THREE.MeshLambertMaterial({ color: "#f0dcc0", transparent: true, opacity: 0.8 }))); this.group.add(this.crumb);
    this.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = m !== glass && m !== moon; m.receiveShadow = true; } });
  }
  /** drop 0..1 (cube falling into the cup), melt 0..1 (cube dissolving) */
  pose(drop: number, melt: number) {
    const [kx, ky, kz] = KIT, S = KS, top = ky + 0.78 * S + 0.066 * S;
    const y = drop < 1 ? top + 0.14 * S * (1 - drop * drop) : top - 0.004 * S * melt;
    const k = Math.max(0.02, 1 - melt);
    this.cube.position.set(kx + 0.008 * S, y + 0.004 * S * k, kz + 0.004 * S); this.cube.scale.setScalar(k);
    this.cube.rotation.set(0.3 * (1 - drop), 0.6, 0.2 * melt);
    this.crumb.visible = melt > 0.05; this.crumb.position.set(kx + 0.008 * S, top - 0.002 * S, kz + 0.004 * S); this.crumb.scale.set(0.4 + melt * 1.4, 0.12, 0.4 + melt * 1.4);
  }
}
