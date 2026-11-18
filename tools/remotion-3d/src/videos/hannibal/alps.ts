// The Alps, 218 BC: one heightfield (snowy peaks, a ledge path along the mountainside, the landslide scar where the
// path was swept away, the drop to a green valley = Italy), the boulder that blocks the path (four chunks that glow,
// cool and split), the log pile against it, and the zigzag path cut down the scar afterwards. Nothing here knows the
// timeline: world.ts poses everything from story.ts each frame.
import * as THREE from "three";
import { Batch, lam } from "./build";
import { ctex, grassHD } from "./paint";
import { twoTone } from "./shade";
export type V3 = [number, number, number];

const sm = (a: number, b: number, x: number) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const hash = (x: number, z: number) => { const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return v - Math.floor(v); };
const vnoise = (x: number, z: number) => {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), w = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
};
const fbm = (x: number, z: number, o = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, z * f); a *= 0.5; f *= 2.03; } return s; };

const ridged = (x: number, z: number) => { const v = 1 - Math.abs(2 * fbm(x, z, 4) - 1); return v * v; };
/** named peaks: sharp cones with ridged flanks (x, z, height, radius) */
const PEAKS: [number, number, number, number][] = [[-160, -270, 260, 170], [40, -320, 300, 190], [230, -270, 240, 160], [-330, -220, 220, 150], [400, -240, 210, 150],
  [110, 430, 260, 170], [-120, 400, 220, 160], [320, 380, 240, 160], [-330, 420, 200, 150]];
const peaks = (x: number, z: number) => {
  let h = 0;
  for (const [px, pz, ph, pr] of PEAKS) { const d = Math.hypot(x - px, z - pz) / pr; if (d < 1) h = Math.max(h, ph * (1 - d) ** 1.25 * (0.8 + 0.35 * ridged(x / 30, z / 30))); }
  return h;
};

// ---------------- layout ----------------
/** the path runs along +x (toward Italy), gently down; uphill is -z, the drop is +z */
export const pathZ = (x: number) => 5 * Math.sin(x / 70);
/** climbs to the summit of the pass at x = -230, then down toward Italy */
export const pathY = (x: number) => (x < -230 ? 9.2 - 0.12 * (-230 - x) : -0.04 * x);
export const LEDGE = 3.2;                       // half width of the ledge path
export const GAP0 = 27, GAP1 = 330;             // the landslide took the path from x = 27 to x = 330 (~1,000 ft)
export const ROCK: V3 = [20, pathY(20), pathZ(20)];
export const VALLEY = -150;                     // valley floor (Italy) far below the drop
export const SUMMIT: V3 = [-230, pathY(-230), pathZ(-230)];
/** how much of the ledge exists at x (0 inside the landslide scar) */
const ledgeK = (x: number) => 1 - sm(GAP0 - 2, GAP0 + 6, x) * (1 - sm(GAP1 - 6, GAP1 + 2, x));

/** ground height */
export const groundY = (x: number, z: number) => {
  const zc = pathZ(x), py = pathY(x), dz = z - zc, k = ledgeK(x);
  // uphill wall above the ledge, rising into the ridge and the peaks behind it
  const up = Math.max(0, -dz - LEDGE);
  let yUp = py + up * 0.75 + up * up * 0.002 + fbm(x / 22, z / 22) * 6 * sm(0, 10, up);
  yUp += 18 * ridged(x / 38, z / 38) * sm(8, 40, up) + 90 * sm(60, 260, -z) * (0.55 + 0.45 * fbm(x / 120, z / 120, 3)) + peaks(x, z) * sm(30, 120, -z);
  // the drop below the ledge, down to the valley
  const dn = Math.max(0, dz - LEDGE);
  let yDn = py - dn * 0.85 - fbm(x / 18 + 3, z / 18, 3) * 5 * sm(0, 8, dn);
  yDn = Math.max(yDn, VALLEY + fbm(x / 50, z / 50, 3) * 8);
  // the far side of the valley rises again into peaks
  yDn += peaks(x, z) * sm(200, 300, z) + 40 * sm(230, 420, z) * ridged(x / 50, z / 50);
  let y = dz < -LEDGE ? yUp : dz > LEDGE ? yDn : py + 0.15 * fbm(x / 3, z / 3, 2);
  // landslide scar: no ledge, one steep scree slope straight from the wall to the drop
  const scree = py - dz * 0.85 + fbm(x / 9, z / 9, 3) * 2.5;
  const yScar = dz < -LEDGE ? Math.min(yUp, Math.max(scree, yUp - 2)) : Math.max(VALLEY, Math.min(dz > LEDGE ? yDn + 1 : scree, scree));
  y = y * k + yScar * (1 - k);
  // the summit of the pass: a broad saddle where the army camps
  const ds = Math.hypot(x - SUMMIT[0], z - SUMMIT[2]);
  if (ds < 40) y = y + (SUMMIT[1] - y) * sm(40, 22, ds) * (dz > -LEDGE - 18 && dz < LEDGE + 14 ? 1 : 0);
  return y;
};

// ---------------- painted textures ----------------
const snowTex = () => ctex("snowHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#e9eef6"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 80; i++) {
    const x = r() * 1024, y = r() * 1024, rad = 40 + r() * 140;
    for (const ox of [-1024, 0, 1024]) for (const oy of [-1024, 0, 1024]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, r() > 0.5 ? "rgba(170,190,225,0.22)" : "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
  g.strokeStyle = "rgba(150,170,210,0.3)"; g.lineWidth = 3; // wind ripples
  for (let i = 0; i < 40; i++) { const x = r() * 1024, y = r() * 1024; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 40, y - 8, x + 90, y + 2); g.stroke(); }
});
const rockTex = () => ctex("alpRockHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#7d7680"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 70; i++) { // soft mottling
    const x = r() * 1024, y = r() * 1024, rad = 60 + r() * 160;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, r() > 0.5 ? "rgba(150,140,140,0.35)" : "rgba(70,62,76,0.3)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 160; i++) { // facets
    const x = r() * 1024, y = r() * 1024, s = 20 + r() * 70;
    g.fillStyle = r() > 0.5 ? "rgba(175,170,180,0.35)" : "rgba(60,56,70,0.28)";
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y + s * 0.3); g.lineTo(x + s * 0.6, y + s); g.closePath(); g.fill();
  }
  g.strokeStyle = "rgba(30,24,34,0.6)"; g.lineWidth = 3;
  for (let i = 0; i < 50; i++) { let x = r() * 1024, y = r() * 1024; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 70; y += r() * 50; g.lineTo(x, y); } g.stroke(); }
});
const trailTex = () => ctex("trailHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#b9a58e"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 500; i++) { g.fillStyle = r() > 0.5 ? "rgba(110,90,74,0.35)" : "rgba(235,232,240,0.5)"; const x = r() * 1024, y = r() * 1024; g.beginPath(); g.ellipse(x, y, 6 + r() * 26, 4 + r() * 12, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 90; i++) { g.fillStyle = "rgba(80,66,56,0.4)"; const x = r() * 1024, y = r() * 1024; g.beginPath(); g.ellipse(x, y, 9, 13, 0, 0, 7); g.fill(); } // footprints
});
const barkTex = () => ctex("logBark", 512, 512, (g, r) => {
  g.fillStyle = "#7a5236"; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 8 + r() * 14) { g.fillStyle = `rgba(${40 + r() * 30},${26 + r() * 20},${20},${0.4 + r() * 0.3})`; g.fillRect(x, 0, 2 + r() * 4, 512); }
});
export const SNOW = () => lam("snowHD", () => ({ map: snowTex() }));
export const ROCKM = () => lam("alpRockHD", () => ({ map: rockTex() }));
const TRAIL = () => lam("trailHD", () => ({ map: trailTex() }));
const GRASS = () => lam("grassHD", () => ({ map: grassHD() }));

// ---------------- terrain ----------------
/** stretched grid: ~1 m cells near the path, ~10 m far away; faces sorted into snow / rock / trail / grass */
export class Terrain {
  group = new THREE.Group();
  constructor() {
    const N = 300, X = (u: number) => 60 + 520 * (0.22 * u + 0.78 * u * u * u), Z = (u: number) => 520 * (0.22 * u + 0.78 * u * u * u);
    const pos: number[] = [], uv: number[] = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = X(-1 + (2 * i) / N), z = Z(-1 + (2 * j) / N), y = groundY(x, z);
      pos.push(x, y, z); uv.push(x / 9, (z - 0.8 * y) / 9);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    const all: number[] = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 2, d = a + N + 1; all.push(a, c, b, a, d, c); }
    g.setIndex(all); g.computeVertexNormals();
    const nrm = g.attributes.normal as THREE.BufferAttribute;
    const lists: Record<string, number[]> = { snow: [], rock: [], trail: [], grass: [] };
    for (let t = 0; t < all.length; t += 3) {
      const ia = all[t], ib = all[t + 1], ic = all[t + 2];
      const cx = (pos[ia * 3] + pos[ib * 3] + pos[ic * 3]) / 3, cy = (pos[ia * 3 + 1] + pos[ib * 3 + 1] + pos[ic * 3 + 1]) / 3, cz = (pos[ia * 3 + 2] + pos[ib * 3 + 2] + pos[ic * 3 + 2]) / 3;
      const ny = (nrm.getY(ia) + nrm.getY(ib) + nrm.getY(ic)) / 3, dz = cz - pathZ(cx);
      let kind = ny < 0.62 + 0.18 * fbm(cx / 14, cz / 14, 2) ? "rock" : "snow";
      if (Math.abs(dz) < LEDGE - 0.3 && ledgeK(cx) > 0.5 && cx > -420) kind = "trail";
      if (cy < VALLEY + 28 + 10 * fbm(cx / 40, cz / 40, 2) && ny > 0.55 && cz > 0) kind = "grass";
      lists[kind].push(ia, ib, ic);
    }
    const mats: Record<string, THREE.Material> = { snow: SNOW(), rock: ROCKM(), trail: TRAIL(), grass: GRASS() };
    for (const [k, idx] of Object.entries(lists)) {
      const sub = new THREE.BufferGeometry();
      sub.setAttribute("position", g.attributes.position); sub.setAttribute("normal", g.attributes.normal); sub.setAttribute("uv", g.attributes.uv);
      sub.setIndex(idx);
      const m = new THREE.Mesh(sub, mats[k]);
      m.receiveShadow = true; m.castShadow = true; m.matrixAutoUpdate = false;
      this.group.add(m);
    }
  }
}

// ---------------- the boulder ----------------
/** a lumpy rock chunk: displaced icosphere, flattened bottom */
const lump = (r: number, seed: number, sx = 1, sy = 1, sz = 1) => {
  const g = new THREE.IcosahedronGeometry(r, 3);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize(), k = 1 + 0.16 * (fbm(n.x * 2.2 + seed, n.y * 2.2 + n.z * 1.7 + seed * 3, 3) - 0.5) * 2 + 0.06 * Math.sin(n.x * 9 + seed);
    v.multiplyScalar(k); v.set(v.x * sx, Math.max(-r * 0.55, v.y) * sy, v.z * sz);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
};
/** chunk offsets (from ROCK) and where each one ends up after the split (dx, dy, dz, roll) */
const CHUNKS: { off: V3; r: number; s: V3; out: [number, number, number, number] }[] = [
  { off: [-1.2, 2.3, -1.4], r: 3.0, s: [1.0, 0.95, 1.0], out: [-2.5, -1.4, -1.5, 0.5] },
  { off: [1.5, 2.0, -0.9], r: 2.8, s: [1.0, 0.9, 1.05], out: [2.8, -1.0, -0.8, -0.6] },
  { off: [-0.6, 1.9, 1.6], r: 2.6, s: [1.1, 0.85, 1.0], out: [7, -12, 9, 2.4] },
  { off: [1.2, 4.6, 0.3], r: 2.3, s: [1.0, 0.85, 1.0], out: [10, -16, 10, -3.0] },
];
export class Rock {
  group = new THREE.Group();
  chunks: THREE.Mesh[] = [];
  mat: THREE.MeshLambertMaterial; core: THREE.MeshBasicMaterial;
  private coreMesh: THREE.Mesh;
  constructor() {
    this.mat = twoTone(new THREE.MeshLambertMaterial({ map: rockTex(), color: "#b8b2b8" }), 0.3);
    CHUNKS.forEach((c, i) => {
      const m = new THREE.Mesh(lump(c.r, i * 1.7 + 0.4, ...c.s), this.mat);
      m.castShadow = m.receiveShadow = true;
      this.chunks.push(m); this.group.add(m);
    });
    // the glowing inside, seen through the cracks between chunks (a smaller hot core)
    this.core = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
    this.coreMesh = new THREE.Mesh(lump(2.9, 9.1, 1.05, 1.0, 1.0), this.core);
    this.coreMesh.position.set(0, 2.6, 0);
    this.group.add(this.coreMesh);
    this.group.position.set(...ROCK);
  }
  /** glow 0..1 outer surface red-hot (HDR), core 0..1 the inside glow, cold 0..1 outside cooled to blue-grey,
   *  split 0..1 the chunks breaking away (two tumble down the drop), swell = scale */
  pose(o: { glow: number; core: number; cold: number; split: number; swell: number; wet: number }) {
    const hot = new THREE.Color(1.25, 0.28, 0.05);
    this.mat.emissive.copy(hot).multiplyScalar(o.glow * (1 - o.cold) * 0.55);
    this.mat.color.set("#b8b2b8").lerp(new THREE.Color("#5f7fb8"), o.cold * 0.7).multiplyScalar(1 - 0.3 * o.wet);
    this.core.color.setRGB(2.4 * o.core, 0.6 * o.core, 0.1 * o.core);
    this.coreMesh.visible = o.core > 0.01 && o.split < 0.5;
    this.group.scale.setScalar(o.swell);
    CHUNKS.forEach((c, i) => {
      const m = this.chunks[i], u = o.split, fall = i >= 2 ? u * u : Math.min(1, u * 1.6);
      m.position.set(c.off[0] + c.out[0] * fall, c.off[1] + c.out[1] * fall - (i >= 2 ? 6 * fall * fall : 0), c.off[2] + c.out[2] * fall);
      m.rotation.set(c.out[3] * fall, 0.3 * i, c.out[3] * 0.4 * fall);
      m.visible = !(i >= 2 && u > 0.98);
    });
  }
}

// ---------------- logs against the rock ----------------
export class Logs {
  group = new THREE.Group();
  burnt: THREE.MeshLambertMaterial;
  constructor() {
    this.burnt = twoTone(new THREE.MeshLambertMaterial({ map: barkTex() }));
    const b = new Batch();
    for (let i = 0; i < 11; i++) {
      const a = -0.9 + (i / 10) * 1.8, h = 2.8 + (i % 3) * 0.5, r = 0.16 + (i % 3) * 0.03;
      const g = new THREE.CylinderGeometry(r, r * 1.1, h, 9);
      const m = new THREE.Matrix4().makeTranslation(ROCK[0] - 3.6 + Math.abs(a) * 0.9, ROCK[1] + h * 0.4, ROCK[2] + a * 2.6)
        .multiply(new THREE.Matrix4().makeRotationZ(-0.5 - (i % 2) * 0.12)).multiply(new THREE.Matrix4().makeRotationX(a * 0.3));
      b.add(g, this.burnt, m);
    }
    for (let i = 0; i < 6; i++) { // a heap of cross logs at the foot
      const g = new THREE.CylinderGeometry(0.18, 0.18, 3.2, 9);
      b.add(g, this.burnt, new THREE.Matrix4().makeTranslation(ROCK[0] - 4.4 - (i % 2) * 0.4, ROCK[1] + 0.2 + Math.floor(i / 2) * 0.3, ROCK[2] + (i - 3) * 0.3).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
    }
    b.build(this.group);
  }
  /** char 0..1: fresh bark -> black charcoal with embers */
  pose(char: number, ember: number) {
    this.burnt.color.set("#ffffff").lerp(new THREE.Color("#2a2228"), char);
    this.burnt.emissive.setRGB(0.5 * ember, 0.12 * ember, 0.02 * ember);
  }
}

// ---------------- the zigzag path cut down the scar ----------------
export const ZIG: [number, number][] = [[24, 3], [62, 14], [36, 26], [76, 40], [46, 54], [88, 70], [58, 88], [104, 108], [80, 130]];
export const zigPoint = (u: number): V3 => {
  const n = ZIG.length - 1, s = Math.max(0, Math.min(n - 1e-6, u * n)), i = Math.floor(s), k = s - i;
  const x = ZIG[i][0] + (ZIG[i + 1][0] - ZIG[i][0]) * k, z = ZIG[i][1] + (ZIG[i + 1][1] - ZIG[i][1]) * k;
  return [x, groundY(x, z) + 0.05, z];
};
export class Zigzag {
  group = new THREE.Group();
  private mesh: THREE.Mesh; private total: number;
  constructor() {
    const pos: number[] = [], uv: number[] = [];
    let v = 0;
    const W = 3.0, steps = 240;
    let prev = zigPoint(0);
    for (let k = 1; k <= steps; k++) {
      const p = zigPoint(k / steps), dx = p[0] - prev[0], dz = p[2] - prev[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
      const ya = (x: number, z: number) => groundY(x, z) + 0.9;
      const a = [prev[0] - nx * W, ya(prev[0] - nx * W, prev[2] - nz * W), prev[2] - nz * W], b = [prev[0] + nx * W, ya(prev[0] + nx * W, prev[2] + nz * W), prev[2] + nz * W];
      const c = [p[0] + nx * W, ya(p[0] + nx * W, p[2] + nz * W), p[2] + nz * W], d = [p[0] - nx * W, ya(p[0] - nx * W, p[2] - nz * W), p[2] - nz * W];
      pos.push(...a, ...c, ...b, ...a, ...d, ...c);
      uv.push(0, v / 6, 1, (v + l) / 6, 1, v / 6, 0, v / 6, 0, (v + l) / 6, 1, (v + l) / 6);
      v += l; prev = p;
    }
    this.total = pos.length / 3;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
    this.mesh = new THREE.Mesh(g, lam("zigPath", () => ({ color: "#efe6d6", side: THREE.DoubleSide })));
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
  }
  /** reveal 0..1 of its length */
  pose(k: number) { this.mesh.visible = k > 0.01; this.mesh.geometry.setDrawRange(0, Math.floor((this.total / 6) * Math.min(1, k)) * 6); }
}
