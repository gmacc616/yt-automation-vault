// A Persian desert town with its yakhchal: the stepped mud dome (ice house), a square dense with market props, flat-roofed
// adobe houses with windcatchers, palms, the long east-west shade wall with the shallow ice pool on its north side, the
// qanat channel, dunes and snowy mountains far away; plus the dome's inside (the ice pit) and a night kitchen with a
// freezer, both floating far away. Nothing here knows the timeline: world.ts poses everything from story.ts each frame.
import * as THREE from "three";
import { Batch, lam, boxGeo } from "./build";
import { ctex, grassHD } from "./paint";
import { twoTone } from "./shade";
export type V3 = [number, number, number];
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const sm = (a: number, b: number, x: number) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const hash = (x: number, z: number) => { const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return v - Math.floor(v); };
const vnoise = (x: number, z: number) => {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), w = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
};
const fbm = (x: number, z: number, o = 4) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, z * f); a *= 0.5; f *= 2.03; } return s; };

// ---------------- layout ----------------
export const DOME: V3 = [0, 0, -6];
export const DOME_R = 9, DOME_H = 17;
export const DOOR: V3 = [0, 0, DOME[2] + DOME_R - 0.4];       // the dome's door (south)
export const WALL_Z = -40, WALL_H = 11, WALL_X0 = -70, WALL_X1 = 30; // shade wall, its south face at WALL_Z
export const POOL_Z0 = -51, POOL_Z1 = -42.5, POOL_D = 0.5;           // the ice pool along the wall's north side
export const PIT: V3 = [0, 800, 0];   // inside the dome (ice pit), far away
export const KIT: V3 = [0, 600, 0];   // night kitchen with the freezer
const inPool = (x: number, z: number) => x > WALL_X0 + 5 && x < WALL_X1 - 5 && z > POOL_Z0 && z < POOL_Z1;
export const groundY = (x: number, z: number) => {
  if (inPool(x, z)) return -POOL_D;
  const r = Math.hypot(x, z);
  return 7 * sm(140, 320, r) * (fbm(x / 60, z / 60, 3) - 0.3) + 0.05 * fbm(x / 2, z / 2, 2);
};

// ---------------- painted textures ----------------
const sandTex = () => ctex("sandHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#e2b77c"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 90; i++) {
    const x = r() * 1024, y = r() * 1024, rad = 40 + r() * 150;
    for (const ox of [-1024, 0, 1024]) for (const oy of [-1024, 0, 1024]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, r() > 0.5 ? "rgba(196,140,84,0.3)" : "rgba(246,214,160,0.35)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
  g.strokeStyle = "rgba(170,116,66,0.32)"; g.lineWidth = 3; // wind ripples
  for (let i = 0; i < 160; i++) { const x = r() * 1024, y = r() * 1024; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 30, y - 10, x + 60, y + 8, x + 100, y - 2); g.stroke(); }
  for (let i = 0; i < 700; i++) { g.fillStyle = r() > 0.5 ? "rgba(120,84,52,0.45)" : "rgba(255,240,210,0.6)"; g.fillRect(r() * 1024, r() * 1024, 2 + r() * 3, 2 + r() * 3); }
});
/** sun-dried mud plaster: warm ochre, straw flecks, trowel smears, cracks */
export const mudTex = (key = "mudHD", base = "#c98d58") => ctex(key, 1024, 1024, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 120; i++) {
    const x = r() * 1024, y = r() * 1024, rx = 50 + r() * 140, ry = 20 + r() * 60;
    g.fillStyle = r() > 0.5 ? "rgba(236,190,130,0.22)" : "rgba(140,90,52,0.18)";
    g.beginPath(); g.ellipse(x, y, rx, ry, r() * 0.6 - 0.3, 0, 7); g.fill();
  }
  g.strokeStyle = "rgba(240,210,140,0.55)"; g.lineWidth = 2;
  for (let i = 0; i < 500; i++) { const x = r() * 1024, y = r() * 1024, a = r() * 6.3, l = 6 + r() * 12; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  g.strokeStyle = "rgba(90,56,34,0.45)"; g.lineWidth = 2;
  for (let i = 0; i < 26; i++) { let x = r() * 1024, y = r() * 1024; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 50; y += r() * 40; g.lineTo(x, y); } g.stroke(); }
});
/** the dome's stepped bands: horizontal brick courses under the plaster */
const domeTex = () => ctex("domeHD", 1024, 1024, (g, r) => {
  g.drawImage(mudTex().image as HTMLCanvasElement, 0, 0);
  for (let y = 0; y < 1024; y += 64) { g.fillStyle = "rgba(110,70,40,0.35)"; g.fillRect(0, y, 1024, 6); g.fillStyle = "rgba(250,220,170,0.3)"; g.fillRect(0, y + 6, 1024, 4); }
  void r;
});
/** facade with an arched door and small windows, for the adobe houses */
const facadeTex = (key: string, w: number, h: number, col: string) => ctex(key, 512, Math.round(512 * h / w), (g, r) => {
  const W = 512, H = Math.round(512 * h / w);
  g.drawImage(mudTex("mud_" + col, col).image as HTMLCanvasElement, 0, 0, W, H);
  const px = W / w;
  const arch = (cx: number, by: number, aw: number, ah: number, fill: string, frame: string) => {
    g.fillStyle = frame; g.beginPath(); g.moveTo(cx - aw / 2 - 6, by); g.lineTo(cx - aw / 2 - 6, by - ah + aw / 2); g.arc(cx, by - ah + aw / 2, aw / 2 + 6, Math.PI, 0); g.lineTo(cx + aw / 2 + 6, by); g.fill();
    g.fillStyle = fill; g.beginPath(); g.moveTo(cx - aw / 2, by); g.lineTo(cx - aw / 2, by - ah + aw / 2); g.arc(cx, by - ah + aw / 2, aw / 2, Math.PI, 0); g.lineTo(cx + aw / 2, by); g.fill();
  };
  const doorX = W * (0.3 + 0.4 * r());
  arch(doorX, H, 1.2 * px, 2.3 * px, ["#3f6fb5", "#7a3a2a", "#2f6f6a", "#6a4a2a"][Math.floor(r() * 4)], "rgba(120,74,44,0.85)");
  g.strokeStyle = "rgba(240,210,150,0.6)"; g.lineWidth = 3; g.strokeRect(doorX - 0.3 * px, H - 1.3 * px, 0.6 * px, 0.6 * px);
  const nwin = Math.max(1, Math.floor(w / 3));
  for (let i = 0; i < nwin; i++) {
    const cx = W * ((i + 0.5) / nwin), wy = H - Math.min(h - 0.8, 3.6) * px;
    if (Math.abs(cx - doorX) < 1.4 * px) continue;
    arch(cx, wy + 1.0 * px, 0.6 * px, 1.0 * px, "#2a2340", "rgba(120,74,44,0.85)");
  }
  g.fillStyle = "rgba(120,80,50,0.45)"; g.fillRect(0, 0, W, 0.18 * px);
});
const ventTex = () => ctex("ventHD", 256, 512, (g) => {
  g.drawImage(mudTex().image as HTMLCanvasElement, 0, 0, 256, 512);
  for (let i = 0; i < 4; i++) { g.fillStyle = "#3a2a2a"; g.fillRect(20 + i * 58, 40, 34, 200); g.fillStyle = "rgba(240,200,150,0.6)"; g.fillRect(16 + i * 58, 36, 42, 6); }
});
const rugTex = (k: number) => ctex("rug" + k, 256, 384, (g) => {
  const cols = [["#a8302e", "#f2c443", "#2f4f8a"], ["#2f4f8a", "#e8dcc4", "#a8302e"], ["#5a2a5a", "#e8a03a", "#2f6f6a"]][k % 3];
  g.fillStyle = cols[0]; g.fillRect(0, 0, 256, 384);
  g.strokeStyle = cols[1]; g.lineWidth = 10; g.strokeRect(14, 14, 228, 356);
  g.fillStyle = cols[2]; g.beginPath(); g.moveTo(128, 70); g.lineTo(210, 192); g.lineTo(128, 314); g.lineTo(46, 192); g.closePath(); g.fill();
  g.fillStyle = cols[1]; g.beginPath(); g.moveTo(128, 130); g.lineTo(170, 192); g.lineTo(128, 254); g.lineTo(86, 192); g.closePath(); g.fill();
  for (let y = 30; y < 384; y += 40) { g.fillStyle = cols[1]; g.fillRect(24, y, 10, 10); g.fillRect(222, y, 10, 10); }
});
const strawTex = () => ctex("strawHD", 512, 512, (g, r) => {
  g.fillStyle = "#d9b25a"; g.fillRect(0, 0, 512, 512);
  g.lineWidth = 3;
  for (let i = 0; i < 900; i++) { g.strokeStyle = r() > 0.5 ? "rgba(150,110,40,0.6)" : "rgba(250,220,130,0.7)"; const x = r() * 512, y = r() * 512, a = (r() - 0.5) * 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30); g.stroke(); }
});
const iceTex = (frost: number) => ctex("ice" + frost, 1024, 1024, (g, r) => {
  g.fillStyle = frost ? "#d9eef8" : "#9fd2ec"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 60; i++) {
    const x = r() * 1024, y = r() * 1024, rad = 40 + r() * 160, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, frost ? "rgba(255,255,255,0.55)" : "rgba(220,244,255,0.4)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.strokeStyle = "rgba(90,150,190,0.55)"; g.lineWidth = 2.5;
  for (let i = 0; i < 40; i++) { let x = r() * 1024, y = r() * 1024; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 120; y += (r() - 0.5) * 120; g.lineTo(x, y); } g.stroke(); }
});
const waterTex = () => ctex("poolWater", 512, 512, (g, r) => {
  g.fillStyle = "#3f86b8"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(200,236,255,0.5)"; g.lineWidth = 3;
  for (let i = 0; i < 60; i++) { const x = r() * 512, y = r() * 512; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 20, y - 6, x + 44, y); g.stroke(); }
});
const leafTex = () => ctex("palmLeaf", 256, 64, (g) => {
  g.clearRect(0, 0, 256, 64);
  g.fillStyle = "#4f9a3c"; g.beginPath(); g.moveTo(0, 32);
  for (let x = 0; x <= 256; x += 16) g.lineTo(x, 32 - 26 * Math.sin((x / 256) * Math.PI) * (x % 32 ? 0.6 : 1));
  for (let x = 256; x >= 0; x -= 16) g.lineTo(x, 32 + 26 * Math.sin((x / 256) * Math.PI) * (x % 32 ? 0.6 : 1));
  g.fill(); g.strokeStyle = "#2f6a2a"; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 32); g.lineTo(256, 32); g.stroke();
});

export const SAND = () => lam("sandHD", () => ({ map: sandTex() }));
const MUD = (k = 0) => lam("mudM" + k, () => ({ map: mudTex("mudHD" + k, ["#c98d58", "#d49a62", "#bd8150", "#d8a874"][k % 4]) }));
const DOMEM = () => lam("domeM", () => ({ map: domeTex() }));
const DARK = () => lam("darkDoor", () => ({ color: "#2a1c22" }));
const WOOD = () => lam("woodM", () => ({ color: "#8a5a36" }));
const STRAW = () => lam("strawM", () => ({ map: strawTex() }));
const CLOTH = (c: string) => lam("cloth" + c, () => ({ color: c, side: THREE.DoubleSide }));
const POT = (c: string) => lam("pot" + c, () => ({ color: c }));

// ---------------- helpers ----------------
const lathe = (pts: [number, number][], segs = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);
const at = (x: number, y: number, z: number, yaw = 0, s = 1) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(s, s, s));
/** a clay pot / jar */
const pot = (b: Batch, x: number, z: number, h: number, col: string, yaw = 0) => {
  const pts: [number, number][] = [[0.001, 0], [0.22, 0.02], [0.36, 0.25], [0.4, 0.5], [0.33, 0.78], [0.18, 0.9], [0.2, 1.0], [0.001, 1.0]];
  b.add(lathe(pts.map(([r, y]) => [r * h, y * h]), 16), POT(col), at(x, groundY(x, z), z, yaw));
};
const basket = (b: Batch, x: number, z: number, s = 1) => {
  b.add(lathe([[0.001, 0], [0.32, 0], [0.42, 0.35], [0.4, 0.36], [0.3, 0.02], [0.001, 0.02]].map(([r, y]) => [r * s, y * s]), 16), STRAW(), at(x, groundY(x, z), z));
  b.add(new THREE.SphereGeometry(0.3 * s, 10, 6), POT(["#e2453c", "#f2c443", "#8ac43a"][Math.floor(Math.abs(x * 7 + z * 3)) % 3]), at(x, groundY(x, z) + 0.3 * s, z, 0, 1));
};
const crate = (b: Batch, x: number, z: number, s = 0.8, yaw = 0) => b.add(new THREE.BoxGeometry(s, s, s), WOOD(), at(x, groundY(x, z) + s / 2, z, yaw));
const sack = (b: Batch, x: number, z: number, s = 1) => b.add(new THREE.SphereGeometry(0.4 * s, 10, 8).scale(1, 1.25, 0.9), POT("#d9c49a"), at(x, groundY(x, z) + 0.45 * s, z));
const bale = (b: Batch, x: number, z: number, yaw = 0) => b.add(new THREE.BoxGeometry(1.4, 0.7, 0.8), STRAW(), at(x, groundY(x, z) + 0.35, z, yaw));
/** a market awning: four poles, a sloped striped cloth */
const awning = (b: Batch, x: number, z: number, yaw: number, col: string) => {
  const m = at(x, groundY(x, z), z, yaw);
  for (const [px, pz, h] of [[-1.6, -1, 2.6], [1.6, -1, 2.6], [-1.6, 1, 2.2], [1.6, 1, 2.2]]) b.add(new THREE.CylinderGeometry(0.05, 0.05, h, 6).translate(px, h / 2, pz), WOOD(), m);
  const cl = new THREE.PlaneGeometry(3.6, 2.4, 4, 1); cl.rotateX(-Math.PI / 2 + 0.17); cl.translate(0, 2.45, 0);
  b.add(cl, CLOTH(col), m);
};
/** a palm: curved trunk of stacked cylinders, a crown of drooping fronds */
export const palm = (b: Batch, x: number, z: number, h: number, seed: number) => {
  const y0 = groundY(x, z), lean = 0.12 + 0.1 * hash(seed, 2), dir = hash(seed, 5) * 6.28;
  const bark = lam("palmBark", () => ({ color: "#8a6a48" })), leaf = lam("palmLeaf", () => ({ map: leafTex(), alphaTest: 0.5, side: THREE.DoubleSide }));
  let px = x, py = y0, pz = z;
  const n = 8;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n, nx = x + Math.cos(dir) * Math.sin(lean * t * 3) * h * 0.35 * t, nz = z + Math.sin(dir) * Math.sin(lean * t * 3) * h * 0.35 * t, ny = y0 + h * t;
    const seg = new THREE.Vector3(nx - px, ny - py, nz - pz), len = seg.length();
    const g = new THREE.CylinderGeometry(0.17 - 0.05 * t, 0.2 - 0.05 * t, len * 1.05, 7);
    const m = new THREE.Matrix4().compose(V((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), seg.clone().normalize()), V(1, 1, 1));
    b.add(g, bark, m); px = nx; py = ny; pz = nz;
  }
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * 6.28 + seed, L = 2.6 + 0.6 * hash(seed, k);
    const g = new THREE.PlaneGeometry(L, 0.7, 6, 1);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + L / 2) / L; p.setY(i, p.getY(i) * 0.6); p.setZ(i, -1.1 * u * u * L * 0.35); p.setX(i, u * L); }
    g.rotateX(Math.PI / 2); g.computeVertexNormals();
    const m = new THREE.Matrix4().compose(V(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0.25)), V(1, 1, 1));
    b.add(g, leaf, m);
  }
};
/** flat-roofed adobe house with a parapet; optional small dome or a windcatcher */
const house = (b: Batch, x: number, z: number, yaw: number, w: number, d: number, h: number, k: number, extra: "none" | "dome" | "tower") => {
  const col = ["#c98d58", "#d8a874", "#bd8150", "#d49a62"][k % 4];
  const m = at(x, 0, z, yaw), side = MUD(k);
  const front = lam(`hfac${k}_${w}_${h}`, () => ({ map: facadeTex(`hfac${k}_${w}_${h}`, w, h, col) }));
  const hw = w / 2, hd = d / 2;
  b.add(new THREE.PlaneGeometry(w, h).translate(0, h / 2, hd + 0.001), front, m);
  b.add(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), side, m);
  for (const [px, pz, sx, sz] of [[0, hd - 0.15, w, 0.3], [0, -hd + 0.15, w, 0.3], [hw - 0.15, 0, 0.3, d], [-hw + 0.15, 0, 0.3, d]] as const)
    b.add(new THREE.BoxGeometry(sx, 0.6, sz).translate(px, h + 0.3, pz), side, m);
  if (extra === "dome") b.add(new THREE.SphereGeometry(Math.min(w, d) * 0.32, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, h, 0), side, m);
  if (extra === "tower") {
    const tw = 1.8, th = h + 5;
    b.add(new THREE.BoxGeometry(tw, th, tw).translate(hw * 0.4, th / 2, -hd * 0.3), lam("ventM", () => ({ map: ventTex() })), m);
    b.add(new THREE.BoxGeometry(tw + 0.3, 0.35, tw + 0.3).translate(hw * 0.4, th + 0.15, -hd * 0.3), side, m);
  }
  // beams poking out under the roof, a wooden lintel over the door line
  for (let i = 0; i < Math.floor(w / 1.4); i++) b.add(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6).rotateX(Math.PI / 2).translate(-hw + 0.7 + i * 1.4, h - 0.35, hd + 0.25), WOOD(), m);
};

// ---------------- the town ----------------
export class Town {
  group = new THREE.Group();
  dome = new THREE.Group();
  constructor() {
    const b = new Batch();
    // ground: one grid, sand everywhere, the pool hole cut by groundY
    const N = 220, X = (u: number) => 900 * (0.18 * u + 0.82 * u * u * u);
    const pos: number[] = [], uv: number[] = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const x = X(-1 + (2 * i) / N), z = X(-1 + (2 * j) / N); pos.push(x, groundY(x, z), z); uv.push(x / 7, z / 7); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    const idx: number[] = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i; idx.push(a, a + N + 2, a + 1, a, a + N + 1, a + N + 2); }
    g.setIndex(idx); g.computeVertexNormals();
    const gm = new THREE.Mesh(g, SAND()); gm.receiveShadow = true; this.group.add(gm);
    // the pool: its own bed (dark mud) under the water, a little rim
    b.add(new THREE.PlaneGeometry(WALL_X1 - WALL_X0 - 10, POOL_Z1 - POOL_Z0).rotateX(-Math.PI / 2).translate((WALL_X0 + WALL_X1) / 2, -POOL_D + 0.02, (POOL_Z0 + POOL_Z1) / 2),
      lam("poolBed", () => ({ color: "#7a5a40" })));
    for (const z of [POOL_Z0 - 0.3, POOL_Z1 + 0.3]) b.add(new THREE.BoxGeometry(WALL_X1 - WALL_X0 - 9, 0.35, 0.6).translate((WALL_X0 + WALL_X1) / 2, 0.1, z), MUD(1));
    // shade wall: tall, thick, buttressed, along x on the pool's south side
    b.add(boxGeo(V(WALL_X0, 0, WALL_Z - 2.4), V(WALL_X1, WALL_H, WALL_Z), 4), MUD(2));
    for (let x = WALL_X0 + 4; x < WALL_X1; x += 9) b.add(new THREE.BoxGeometry(1.4, WALL_H * 0.7, 1.6).translate(x, WALL_H * 0.35, WALL_Z + 0.8), MUD(2));
    b.add(new THREE.BoxGeometry(WALL_X1 - WALL_X0, 0.5, 2.8).translate((WALL_X0 + WALL_X1) / 2, WALL_H + 0.25, WALL_Z - 1.2), MUD(0));
    // qanat: a channel running west into the pool, shaft mounds out into the desert
    b.add(new THREE.BoxGeometry(60, 0.2, 1.2).translate(WALL_X0 - 25, -0.05, POOL_Z0 + 4), lam("qanatWater", () => ({ map: waterTex() })));
    for (let k = 0; k < 9; k++) {
      const x = WALL_X0 - 60 - k * 22, z = POOL_Z0 + 4 + 6 * Math.sin(k);
      b.add(new THREE.TorusGeometry(1.6, 0.8, 6, 14).rotateX(Math.PI / 2).translate(x, 0.2, z), MUD(3));
    }
    b.add(new THREE.BoxGeometry(1.6, 1.2, 2.2).translate(WALL_X0 + 3, 0.6, POOL_Z0 + 4), WOOD()); // sluice box
    // the dome (its own group so it can grow for "they built")
    const dm = new Batch();
    const prof: [number, number][] = [[DOME_R + 1.2, 0], [DOME_R + 1.2, 1.2], [DOME_R, 1.2]];
    for (let i = 1; i <= 16; i++) { const t = i / 16, r = DOME_R * (1 - t ** 1.35) + 0.6 * (1 - t), y = 1.2 + (DOME_H - 1.2) * t; const r0 = prof[prof.length - 1][0]; prof.push([r0, y - 0.3]); prof.push([Math.max(0.6, r), y]); }
    prof.push([0.001, DOME_H + 0.2]);
    dm.add(lathe(prof, 64), DOMEM());
    dm.add(new THREE.CylinderGeometry(0.7, 0.9, 1.4, 12).translate(0, DOME_H + 0.6, 0), MUD(0)); // vent cap
    // door: an arched recess with a deep dark inside and a wooden frame
    const arch = new THREE.Shape(); arch.moveTo(-1.2, 0); arch.lineTo(-1.2, 2.2); arch.absarc(0, 2.2, 1.2, Math.PI, 0, true); arch.lineTo(1.2, 0); arch.lineTo(-1.2, 0);
    dm.add(new THREE.ShapeGeometry(arch, 10).translate(0, 0.02, DOME_R + 1.25), DARK());
    dm.add(new THREE.BoxGeometry(3.4, 4.2, 1.6).translate(0, 2.1, DOME_R + 0.7), MUD(0));
    dm.build(this.dome);
    this.dome.position.set(...DOME);
    this.group.add(this.dome);
    // houses around the square and along two lanes
    let k = 0;
    const H = (x: number, z: number, yaw: number, w: number, d: number, h: number, e: "none" | "dome" | "tower") => house(b, x, z, yaw, w, d, h, k++, e);
    for (const [x, z, w, h, e] of [[-26, 10, 8, 5, "tower"], [-27, 22, 7, 4.2, "none"], [-26, 34, 8, 6, "dome"], [-30, 46, 9, 4.6, "none"], [-40, 18, 8, 5.5, "none"], [-40, 32, 8, 4.2, "tower"]] as const) H(x, z, Math.PI / 2, w, 7, h, e);
    for (const [x, z, w, h, e] of [[26, 8, 8, 5.2, "none"], [27, 20, 7, 4.4, "tower"], [26, 32, 8, 5.8, "none"], [30, 45, 9, 4.4, "dome"], [40, 14, 8, 6, "none"], [40, 28, 8, 4.6, "none"]] as const) H(x, z, -Math.PI / 2, w, 7, h, e);
    for (const [x, z, w, h, e] of [[-12, 52, 9, 5, "none"], [0, 54, 8, 6.2, "tower"], [12, 52, 9, 4.6, "dome"], [-18, 64, 9, 5, "none"], [18, 64, 9, 5.4, "tower"]] as const) H(x, z, Math.PI, w, 7, h, e);
    for (let i = 0; i < 40; i++) { const a = i * 2.4, r = 75 + (i % 5) * 9, x = r * Math.cos(a), z = r * Math.sin(a); if (z < -30 && Math.abs(x) < 80) continue; H(x, z, -a - Math.PI / 2, 8, 7, 4 + (i % 3), i % 4 === 0 ? "tower" : i % 5 === 1 ? "dome" : "none"); }
    // the square: market awnings, pots, baskets, crates, sacks, rugs hung on walls, a fountain basin, benches
    for (const [x, z, yaw, c] of [[-18, 12, Math.PI / 2, "#c0453c"], [-18, 24, Math.PI / 2, "#2f6f6a"], [18, 14, -Math.PI / 2, "#e8a03a"], [18, 26, -Math.PI / 2, "#3f6fb5"]] as const) {
      awning(b, x, z, yaw, c);
      for (let i = 0; i < 5; i++) { const dz = -1.6 + i * 0.8; basket(b, x + (x < 0 ? 0.6 : -0.6), z + dz, 0.8 + 0.2 * (i % 2)); }
    }
    for (let i = 0; i < 26; i++) {
      const sx = i % 2 ? 1 : -1, x = sx * (14 + (i % 3) * 1.2), z = 6 + i * 1.6;
      [() => pot(b, x, z, 0.8 + 0.4 * (i % 3), ["#b5653f", "#a85a38", "#c98a4a"][i % 3], i), () => crate(b, x, z, 0.7, i), () => sack(b, x, z, 0.9), () => pot(b, x, z, 1.4, "#3f6fb5", i)][i % 4]();
    }
    b.add(lathe([[0.001, 0], [2.4, 0], [2.4, 0.7], [2.1, 0.7], [2.1, 0.25], [0.001, 0.25]], 32), lam("tileBlue", () => ({ color: "#2f7fae" })), at(0, 0, 24));
    b.add(new THREE.CylinderGeometry(2.05, 2.05, 0.05, 32).translate(0, 0.55, 24), lam("fountainW", () => ({ map: waterTex() })));
    for (const [x, z, k2] of [[-25.6, 14, 0], [-25.6, 26, 1], [25.6, 12, 2], [25.6, 30, 0]] as const)
      b.add(new THREE.PlaneGeometry(1.6, 2.4).rotateY(x < 0 ? Math.PI / 2 : -Math.PI / 2).translate(x * 0.98 + (x < 0 ? 4.1 : -4.1), 2.0, z), lam("rugM" + k2, () => ({ map: rugTex(k2), side: THREE.DoubleSide })));
    for (const [x, z] of [[-8, 34], [8, 34], [-10, 8], [10, 8]]) b.add(new THREE.BoxGeometry(2.6, 0.45, 0.6).translate(x, 0.45, z), WOOD());
    // the mud trough by the dome, tools, buckets; a dense market cluster between the square spot and the dome
    b.add(new THREE.BoxGeometry(2.4, 0.7, 1.2).translate(6, 0.35, 8.4), WOOD());
    b.add(new THREE.BoxGeometry(2.2, 0.08, 1.0).translate(6, 0.68, 8.4), lam("mudFill", () => ({ color: "#8a5a3a" })));
    for (const [x, z, h, c] of [[-3.2, 10.6, 1.1, "#b5653f"], [-4.0, 9.6, 0.7, "#3f6fb5"], [3.4, 10.8, 0.9, "#c98a4a"], [4.4, 11.6, 1.3, "#a85a38"], [-5.5, 8.4, 1.0, "#c98a4a"], [8.6, 7.0, 0.8, "#3f6fb5"]] as const) pot(b, x, z, h, c);
    for (const [x, z] of [[-2.2, 9.4], [2.6, 9.8], [-6.2, 10.4], [9.2, 9.6]]) basket(b, x, z, 0.9);
    for (const [x, z] of [[-6.8, 7.4], [7.6, 10.6]]) { crate(b, x, z, 0.8, 0.3); crate(b, x + 0.2, z + 0.1, 0.6, 0.9); }
    for (const [x, z] of [[5.0, 11.2], [-4.6, 11.8]]) sack(b, x, z, 1);
    awning(b, -6, 9, 0.2, "#c0453c"); awning(b, 9.5, 11, -0.3, "#2f6f6a");
    // palms, around the square and along the pool road
    [[-9, 6], [12, 4], [-12, 40], [12, 40], [-21, 4], [21, 2], [-6, 44], [16, 44], [-34, -20], [-46, -24], [24, -24], [38, -10], [-58, 6], [56, 4]].forEach(([x, z], i) => palm(b, x, z, 7 + (i % 3) * 1.5, i * 1.7));
    // at the pool: straw bales, baskets, shovels leaned on the wall, a sled, lantern posts, ladders
    for (let i = 0; i < 10; i++) bale(b, WALL_X0 + 10 + i * 8.5, POOL_Z0 - 9 - (i % 2) * 0.9, (i % 3) * 0.3);
    for (let i = 0; i < 8; i++) basket(b, WALL_X0 + 14 + i * 10, POOL_Z0 - 10.5, 0.9);
    for (let i = 0; i < 6; i++) { const x = WALL_X0 + 12 + i * 13; b.add(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6).rotateZ(0.3).translate(x, 1.1, WALL_Z - 2.6), WOOD()); b.add(new THREE.BoxGeometry(0.4, 0.5, 0.06).translate(x + 0.4, 0.15, WALL_Z - 2.6), lam("iron", () => ({ color: "#6a6a72" }))); }
    for (let i = 0; i < 6; i++) { const x = WALL_X0 + 16 + i * 14; b.add(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6).translate(x, 1.6, POOL_Z0 - 7), WOOD()); }
    b.build(this.group);
    // mountains on the horizon with snow caps (the "nearest snow")
    const mb = new Batch();
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, r = 760 + 60 * hash(i, 1), h = 120 + 140 * hash(i, 3), w = 160 + 90 * hash(i, 4), x = r * Math.cos(a), z = r * Math.sin(a);
      mb.add(new THREE.ConeGeometry(w, h, 7).translate(x, h / 2 - 10, z), lam("mtn", () => ({ color: "#9a7a8a" })));
      mb.add(new THREE.ConeGeometry(w * 0.32, h * 0.32, 7).translate(x, h - h * 0.16 - 9.5, z), lam("mtnSnow", () => ({ color: "#f4f6fb" })));
    }
    mb.build(this.group, false);
  }
}

// ---------------- the pool: water, frost, ice, broken slabs ----------------
export class Pool {
  group = new THREE.Group();
  water: THREE.Mesh; ice: THREE.Mesh; iceMat: THREE.MeshLambertMaterial; slabs: THREE.Mesh[] = [];
  constructor() {
    const L = WALL_X1 - WALL_X0 - 10, D = POOL_Z1 - POOL_Z0, cx = (WALL_X0 + WALL_X1) / 2, cz = (POOL_Z0 + POOL_Z1) / 2;
    const wt = waterTex(); wt.repeat.set(L / 6, D / 6);
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(L, D).rotateX(-Math.PI / 2), twoTone(new THREE.MeshLambertMaterial({ map: wt })));
    this.water.position.set(cx, -0.15, cz); this.water.receiveShadow = true;
    const it = iceTex(1); it.repeat.set(L / 12, D / 12); it.wrapS = it.wrapT = THREE.RepeatWrapping;
    this.iceMat = twoTone(new THREE.MeshLambertMaterial({ map: it, transparent: true, opacity: 0 }));
    this.ice = new THREE.Mesh(new THREE.PlaneGeometry(L, D).rotateX(-Math.PI / 2), this.iceMat);
    this.ice.position.set(cx, -0.1, cz); this.ice.receiveShadow = true;
    this.group.add(this.water, this.ice);
    const sm2 = twoTone(new THREE.MeshLambertMaterial({ map: iceTex(0) }));
    for (let i = 0; i < 70; i++) {
      const w = 1.4 + hash(i, 1) * 1.2, d = 1.1 + hash(i, 2) * 0.9;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), sm2);
      m.position.set(WALL_X0 + 8 + (i % 35) * 2.4 + hash(i, 3) * 0.4, -0.12, POOL_Z0 + 1.5 + Math.floor(i / 35) * 4 + hash(i, 4) * 1.2);
      m.rotation.y = (hash(i, 5) - 0.5) * 0.5; m.castShadow = m.receiveShadow = true; m.visible = false;
      this.slabs.push(m); this.group.add(m);
    }
  }
  /** fill 0..1 water level, frost 0..1 ice over the water, broken 0..1 the sheet smashed into slabs (taken away later) */
  pose(fill: number, frost: number, broken: number) {
    this.water.visible = fill > 0.01 && broken < 0.5;
    this.water.position.y = -POOL_D + 0.05 + (POOL_D - 0.2) * fill;
    this.ice.visible = frost > 0.01 && broken < 0.5;
    this.iceMat.opacity = Math.min(1, frost * 1.2);
    this.ice.position.y = this.water.position.y + 0.04;
    this.slabs.forEach((m, i) => { m.visible = broken >= 0.5 && hash(i, 9) > 0.15; });
  }
}

// ---------------- a sled loaded with ice blocks ----------------
export class Sled {
  group = new THREE.Group();
  constructor() {
    const b = new Batch();
    b.add(new THREE.BoxGeometry(2.4, 0.15, 1.2).translate(0, 0.25, 0), WOOD());
    for (const z of [-0.5, 0.5]) b.add(new THREE.BoxGeometry(2.8, 0.12, 0.12).translate(0, 0.1, z), WOOD());
    b.build(this.group);
    const sm2 = twoTone(new THREE.MeshLambertMaterial({ map: iceTex(0) }));
    for (const [x, y, z] of [[-0.6, 0.6, -0.25], [0.6, 0.6, -0.25], [-0.6, 0.6, 0.3], [0.6, 0.6, 0.3], [0, 1.1, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.5), sm2); m.position.set(x, y, z); m.castShadow = true; this.group.add(m);
    }
  }
}

// ---------------- inside the dome: the pit with stacked ice and straw ----------------
export class Inside {
  group = new THREE.Group();
  stack: THREE.Group[] = [];
  lamps: THREE.MeshBasicMaterial;
  constructor() {
    const b = new Batch(), [px, py, pz] = PIT;
    const shell = lathe([[0.001, 17], [2, 16], [5, 13], [7.5, 8], [8.6, 3], [9, 0], [9.2, -0.1]], 48);
    b.add(shell, lam("insideM", () => ({ map: domeTex(), side: THREE.BackSide })), at(px, py, pz));
    // floor ring around the pit, the pit walls, a ladder, shelves of tools
    const ring = new THREE.RingGeometry(5, 9.2, 48).rotateX(-Math.PI / 2);
    b.add(ring, MUD(1), at(px, py, pz));
    b.add(new THREE.CylinderGeometry(5, 5, 7, 40, 1, true).translate(0, -3.5, 0), lam("pitWall", () => ({ map: mudTex("pitHD", "#a87048"), side: THREE.BackSide })), at(px, py, pz));
    for (let i = 0; i < 9; i++) b.add(new THREE.BoxGeometry(1.2, 0.08, 0.08).translate(0, -6 + i * 0.75, 0), WOOD(), at(px + 4.6, py, pz + 0.8, 0.2));
    for (const s of [-1, 1]) b.add(new THREE.BoxGeometry(0.1, 7, 0.1).translate(s * 0.6, -3.2, 0), WOOD(), at(px + 4.6, py, pz + 0.8, 0.2));
    for (let i = 0; i < 6; i++) { const a = 2.2 + i * 0.35; bale(b, px + 7.6 * Math.cos(a), pz + 7.6 * Math.sin(a), a); }
    for (let i = 0; i < 6; i++) { const a = -0.6 + i * 0.32, x = px + 7.8 * Math.cos(a), z = pz + 7.8 * Math.sin(a); b.add(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6).rotateZ(0.25).translate(x, py + 1.1, z), WOOD()); }
    b.build(this.group);
    // the doorway glowing with daylight
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.1, 1.5), fog: false }));
    door.position.set(px, py + 1.7, pz + 8.85); door.rotation.y = Math.PI; this.group.add(door);
    this.lamps = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 1.1), fog: false });
    for (const a of [0.5, 2.6, 4.4]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), this.lamps); m.position.set(px + 8.3 * Math.cos(a), py + 3.2, pz + 8.3 * Math.sin(a)); this.group.add(m); }
    // ice layers with straw between: 6 layers, each its own group (shown as the stack grows)
    const im = twoTone(new THREE.MeshLambertMaterial({ map: iceTex(0) }));
    for (let L = 0; L < 6; L++) {
      const g = new THREE.Group(), y = py - 6.6 + L * 0.95;
      for (let i = -3; i <= 3; i++) for (let k = -3; k <= 3; k++) {
        if (i * i + k * k > 11) continue;
        const m = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.6, 1.15), im); m.position.set(px + i * 1.22, y + 0.3, pz + k * 1.22); m.castShadow = m.receiveShadow = true; g.add(m);
      }
      const st = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.25, 32), lam("strawLayer", () => ({ map: strawTex() })));
      st.position.set(px, y - 0.1, pz); g.add(st);
      this.stack.push(g); this.group.add(g);
    }
  }
  /** layers 0..6 */
  pose(layers: number) { this.stack.forEach((g, i) => { g.visible = i < layers; }); }
}

// ---------------- night kitchen with the freezer ----------------
export class Kitchen {
  group = new THREE.Group();
  door = new THREE.Group();
  inner: THREE.MeshBasicMaterial;
  constructor() {
    const b = new Batch(), [kx, ky, kz] = KIT;
    const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: THREE.Material) => b.add(boxGeo(V(kx + x0, ky + y0, kz + z0), V(kx + x1, ky + y1, kz + z1)), m);
    box(-5, -0.2, -4, 5, 0, 4, lam("kTile", () => ({ map: rugTex(1) })));
    box(-5, 0, -4.2, 5, 3.6, -4, lam("kWallY", () => ({ color: "#e8c88a" })));
    box(-5.2, 0, -4.2, -5, 3.6, 4, lam("kWallY2", () => ({ color: "#d9b47a" })));
    box(-4.8, 0, -3.9, -2.4, 0.95, -3.0, WOOD()); box(-4.8, 1.6, -4.0, -2.2, 1.7, -3.6, WOOD());
    for (let i = 0; i < 4; i++) pot(b, kx - 4.4 + i * 0.6, kz - 3.75, 0.35, ["#b5653f", "#3f6fb5"][i % 2]);
    // the freezer: a tall white cabinet against the back wall, its door swung open toward +x
    box(0.2, 0, -3.95, 1.6, 2.4, -2.9, lam("frzBody", () => ({ color: "#eef2f6" })));
    b.build(this.group);
    this.inner = new THREE.MeshBasicMaterial({ map: starTex(), color: new THREE.Color(1.1, 1.15, 1.3), fog: false });
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.2), this.inner); inner.position.set(kx + 0.9, ky + 1.2, kz - 2.885); this.group.add(inner);
    const dg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.1).translate(0.7, 1.2, 0), twoTone(new THREE.MeshLambertMaterial({ color: "#e6ebf2" })));
    this.door.add(dg); this.door.position.set(kx + 1.6, ky, kz - 2.85); this.door.rotation.y = -1.9; this.group.add(this.door);
  }
}
const starTex = () => ctex("starsHD", 512, 1024, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 1024); gr.addColorStop(0, "#0b1440"); gr.addColorStop(1, "#283c9a");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 400; i++) { const s = r() < 0.08 ? 3 : 1.4; g.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`; g.beginPath(); g.arc(r() * 512, r() * 1024, s, 0, 7); g.fill(); }
});
export { starTex };
void grassHD;
