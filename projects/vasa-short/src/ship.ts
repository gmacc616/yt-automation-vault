// The Vasa (1628) as one three.js group in ship space: bow toward +x, port side toward -z, waterline at y = 0.
// Hull lofted from stations (tumblehome above the waterline, rounded bilge below), two gun-port rows with red lids
// and bronze barrels, a carved gold-and-red stern, decks, three masts with yards, set/furled sails that billow,
// shrouds and flags. world.ts poses the group per frame from story.ts shipPose(); nothing here knows the timeline.
import * as THREE from "three";
import { Batch, boxGeo, V, lam } from "./build";
import { ctex, rng, beamHD, planksHD } from "./paint";
import { twoTone } from "./shade";

export const HL = 24; // half length of the hull (m)
export const DECK = 5.2, QDECK = 8.2, FDECK = 7.2; // main deck, quarterdeck (x < -13), forecastle (x > 15)
export const keelY = (x: number) => -4.6 + 1.1 * Math.max(0, (x - 12) / 12) ** 2;
export const topY = (x: number) => 6.4 + 5.1 * Math.max(0, (-x - 13) / 11) ** 1.4 + 1.6 * Math.max(0, (x - 15) / 9) ** 1.5;
export const beamAt = (x: number) => 5.85 * (x < 0 ? 1 - 0.24 * (x / HL) ** 2 : Math.sqrt(Math.max(0, 1 - (x / (HL + 0.3)) ** 2.4)));
/** half width of the hull at ship-space (x, y) */
export const halfW = (x: number, y: number) => {
  const y0 = keelY(x), b = beamAt(x);
  if (y < 0.6) { const s = Math.max(0, Math.min(1, (y - y0) / (0.6 - y0))); return b * (0.06 + 0.94 * Math.sin((s * Math.PI) / 2) ** 0.55); }
  const t = (y - 0.6) / Math.max(1, topY(x) - 0.6);
  return b * (1 - 0.13 * t ** 1.25);
};
export const deckAt = (x: number) => (x < -13 ? QDECK : x > 15 ? FDECK : DECK);
export const MASTS: { x: number; top: number; yards: number[] }[] = [
  { x: 12.5, top: 40, yards: [17, 27, 35] },
  { x: 0.5, top: 47, yards: [19, 31, 41] },
  { x: -15, top: 31, yards: [18, 25] },
];
/** which sails Vasa set on 10 Aug 1628 (fore course, fore + main topsails, mizzen): [mast, yard index] */
const SET: [number, number][] = [[0, 0], [0, 1], [1, 1], [2, 0]];
export const PORTS_LO = Array.from({ length: 12 }, (_, i) => -14.4 + i * 2.45); // lower gun deck, y 1.55
export const PORTS_HI = Array.from({ length: 12 }, (_, i) => -13.2 + i * 2.45); // upper gun deck, y 3.45
export const PORT_Y = [1.55, 3.45];

const hullTex = () => ctex("vasaHull", 1024, 1024, (g, r) => {
  // dark oiled oak strakes with near-black seams, a few lighter boards
  const H = 32;
  for (let y = 0; y < 1024; y += H) {
    let x = -Math.floor(r() * 300);
    while (x < 1024) {
      const w = 220 + r() * 260, l = 30 + r() * 10;
      g.fillStyle = `hsl(${22 + r() * 8}, ${38 + r() * 10}%, ${l}%)`; g.fillRect(x, y, w, H);
      g.fillStyle = "rgba(0,0,0,0.18)"; for (let k = 0; k < 4; k++) g.fillRect(x, y + r() * H, w, 1.5);
      g.fillStyle = "#1a0f0c"; g.fillRect(x + w - 3, y, 3, H);
      x += w;
    }
    g.fillStyle = "#170d0a"; g.fillRect(0, y, 1024, 4);
  }
});
/** carved stern: red field, gold frames, two lions holding a crest, windows */
const sternTex = () => ctex("vasaStern", 1024, 1024, (g) => {
  g.fillStyle = "#8f2a2a"; g.fillRect(0, 0, 1024, 1024);
  const gold = "#e8b84a", dk = "#5a3a12";
  g.strokeStyle = dk; g.lineWidth = 6;
  const frame = (x: number, y: number, w: number, h: number) => { g.fillStyle = gold; g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h); };
  for (const y of [120, 420, 700]) frame(40, y, 944, 26);
  for (const x of [60, 300, 580, 840]) frame(x, 140, 22, 560);
  // windows
  for (const [x, y] of [[130, 470], [360, 470], [640, 470], [880, 470]]) { g.fillStyle = "#1e2638"; g.fillRect(x - 50, y, 100, 150); g.strokeStyle = gold; g.lineWidth = 14; g.strokeRect(x - 50, y, 100, 150); }
  // crest with two lions
  g.fillStyle = "#2f5aa8"; g.beginPath(); g.moveTo(512, 170); g.lineTo(612, 190); g.lineTo(600, 330); g.lineTo(512, 400); g.lineTo(424, 330); g.lineTo(412, 190); g.closePath(); g.fill();
  g.strokeStyle = gold; g.lineWidth = 16; g.stroke();
  g.fillStyle = gold; g.beginPath(); g.arc(512, 270, 34, 0, Math.PI * 2); g.fill();
  for (const s of [-1, 1]) {
    const cx = 512 + s * 200;
    g.fillStyle = gold; g.strokeStyle = dk; g.lineWidth = 6;
    g.beginPath(); g.ellipse(cx, 300, 70, 95, s * 0.3, 0, Math.PI * 2); g.fill(); g.stroke(); // body
    g.beginPath(); g.arc(cx - s * 30, 200, 52, 0, Math.PI * 2); g.fill(); g.stroke(); // mane
    g.fillStyle = "#c98f2a"; g.beginPath(); g.arc(cx - s * 34, 205, 28, 0, Math.PI * 2); g.fill();
    g.fillStyle = dk; g.beginPath(); g.arc(cx - s * 42, 198, 5, 0, Math.PI * 2); g.fill();
  }
  // bottom carvings band
  for (let x = 70; x < 1000; x += 110) { g.fillStyle = gold; g.beginPath(); g.ellipse(x, 840, 36, 60, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = dk; g.lineWidth = 5; g.stroke(); }
});
/** red upper works band with gold carving pattern (top strakes of the hull) */
const bandTex = () => ctex("vasaBand", 1024, 128, (g) => {
  g.fillStyle = "#9a2f2c"; g.fillRect(0, 0, 1024, 128);
  g.fillStyle = "#e8b84a"; g.fillRect(0, 0, 1024, 14); g.fillRect(0, 114, 1024, 14);
  for (let x = 32; x < 1024; x += 64) { g.beginPath(); g.ellipse(x, 64, 18, 34, 0, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = "#5a3a12"; g.lineWidth = 3; for (let x = 32; x < 1024; x += 64) { g.beginPath(); g.ellipse(x, 64, 18, 34, 0, 0, Math.PI * 2); g.stroke(); }
});
const sailTex = () => ctex("vasaSail", 512, 512, (g, r) => {
  g.fillStyle = "#efe4c8"; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 64) { g.fillStyle = "rgba(120,95,60,0.22)"; g.fillRect(x, 0, 3, 512); }
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(150,120,80,${0.04 + r() * 0.05})`; g.fillRect(r() * 512, r() * 512, 2 + r() * 20, 1 + r() * 3); }
  g.fillStyle = "rgba(110,85,50,0.35)"; g.fillRect(0, 0, 512, 8); g.fillRect(0, 504, 512, 8);
});
export const flagTexSE = () => ctex("flagSE", 256, 160, (g) => {
  g.fillStyle = "#2a5ca8"; g.fillRect(0, 0, 256, 160);
  g.fillStyle = "#f2c443"; g.fillRect(72, 0, 30, 160); g.fillRect(0, 65, 256, 30);
});

const SECT = 22, STN = 49;
const xs = Array.from({ length: STN }, (_, i) => -HL + (2 * HL * i) / (STN - 1));
/** one side of the hull as a grid (stations x rows keel..gunwale); s = -1 port, +1 starboard */
const hullSide = (s: number) => {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i < STN; i++) {
    const x = xs[i], y0 = keelY(x), y1 = topY(x);
    for (let j = 0; j <= SECT; j++) {
      const v = j / SECT, y = y0 + (y1 - y0) * v;
      pos.push(x, y, s * halfW(x, y));
      uv.push(x / 6, y / 4);
    }
  }
  for (let i = 0; i < STN - 1; i++) for (let j = 0; j < SECT; j++) {
    const a = i * (SECT + 1) + j, b = a + 1, c = a + SECT + 1, d = c + 1;
    if (s > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
/** gold-and-red band along the top 1.2 m of the hull (slightly proud of the planking) */
const bandSide = (s: number) => {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i < STN; i++) {
    const x = xs[i], yt = topY(x);
    for (const [k, y] of [[0, yt - 1.25], [1, yt]] as const) { pos.push(x, y, s * (halfW(x, y) + 0.04)); uv.push(x / 4, k); }
  }
  for (let i = 0; i < STN - 1; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; if (s > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
/** deck polygon between x0..x1 at height y, inset from the hull wall */
const deckGeo = (x0: number, x1: number, y: number) => {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [], n = 16;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, w = Math.max(0.05, halfW(x, y) - 0.25);
    pos.push(x, y, -w, x, y, w); uv.push(x / 5, -w / 5, x / 5, w / 5);
  }
  for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
};
/** wall across the ship at x from y0 to y1 */
const bulkhead = (x: number, y0: number, y1: number, face: number) => {
  const w0 = halfW(x, y0) - 0.1, w1 = halfW(x, y1) - 0.1;
  const g = new THREE.BufferGeometry();
  const p = face > 0 ? [x, y0, -w0, x, y0, w0, x, y1, w1, x, y0, -w0, x, y1, w1, x, y1, -w1] : [x, y0, w0, x, y0, -w0, x, y1, -w1, x, y0, w0, x, y1, -w1, x, y1, w1];
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 2, 1, 0, 0, 2, 1, 0, 1], 2));
  g.computeVertexNormals();
  return g;
};
const beamBetween = (a: THREE.Vector3, b: THREE.Vector3, th: number, round = false) => {
  const len = a.distanceTo(b);
  const g = round ? new THREE.CylinderGeometry(th / 2, th / 2, len, 8) : new THREE.BoxGeometry(th, len, th);
  return g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()), V(1, 1, 1)));
};

export type ShipLook = { billow: number; set: number; t: number };

export class Ship {
  group = new THREE.Group();
  private sails: { mesh: THREE.Mesh; base: Float32Array; w: number; h: number; yard: number; x: number }[] = [];
  private flags: { mesh: THREE.Mesh; len: number }[] = [];
  lids: THREE.InstancedMesh;

  constructor() {
    const G = this.group, b = new Batch(), r = rng(5);
    const hullM = lam("vasaHullM", () => ({ map: hullTex(), side: THREE.DoubleSide }));
    if (hullM.map) { hullM.map.wrapS = hullM.map.wrapT = THREE.RepeatWrapping; hullM.map.anisotropy = 16; }
    const bandM = lam("vasaBandM", () => ({ map: bandTex(), side: THREE.DoubleSide }));
    if (bandM.map) { bandM.map.wrapS = THREE.RepeatWrapping; }
    const deckM = lam("vasaDeck", () => ({ map: planksHD(), side: THREE.DoubleSide }));
    if (deckM.map) { deckM.map.wrapS = deckM.map.wrapT = THREE.RepeatWrapping; deckM.map.anisotropy = 16; }
    const woodM = lam("vasaWood", () => ({ map: beamHD() }));
    const sternM = lam("vasaSternM", () => ({ map: sternTex(), side: THREE.DoubleSide }));
    const goldM = twoTone(new THREE.MeshPhongMaterial({ color: "#e0aa3e", specular: "#ffe6a0", shininess: 50 }), 0.2);
    const portM = lam("vasaPort", () => ({ color: "#1c1214" }));
    const bronzeM = twoTone(new THREE.MeshPhongMaterial({ color: "#6b5428", specular: "#c8a860", shininess: 40 }), 0.15);
    const ropeM = lam("vasaRope", () => ({ color: "#4a3a2a" }));
    for (const s of [-1, 1]) { b.add(hullSide(s), hullM); b.add(bandSide(s), bandM); }
    // transom (flat stern) with the carved panel above the waterline
    {
      const x = -HL, y0 = keelY(x), y1 = topY(x), pos: number[] = [], uv: number[] = [];
      const rows = 16, pts: [number, number][] = [];
      for (let j = 0; j <= rows; j++) { const y = y0 + ((y1 - y0) * j) / rows; pts.push([y, halfW(x, y)]); }
      for (let j = 0; j < rows; j++) {
        const [ya, wa] = pts[j], [yb, wb] = pts[j + 1];
        const v = (y: number) => Math.max(0, (y - 1.5) / (y1 - 1.5));
        pos.push(x - 0.02, ya, -wa, x - 0.02, ya, wa, x - 0.02, yb, wb, x - 0.02, ya, -wa, x - 0.02, yb, wb, x - 0.02, yb, -wb);
        uv.push(0.5 - wa / 12, v(ya), 0.5 + wa / 12, v(ya), 0.5 + wb / 12, v(yb), 0.5 - wa / 12, v(ya), 0.5 + wb / 12, v(yb), 0.5 - wb / 12, v(yb));
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
      b.add(g, sternM);
    }
    // decks + bulkheads (the castles' fronts carry doors as dark rectangles)
    b.add(deckGeo(-13, 15, DECK), deckM);
    b.add(deckGeo(-HL + 0.2, -13, QDECK), deckM);
    b.add(deckGeo(15, 21.5, FDECK), deckM);
    b.add(bulkhead(-13, DECK, QDECK, 1), woodM);
    b.add(bulkhead(15, DECK, FDECK, -1), woodM);
    for (const z of [-1.6, 1.6]) b.add(boxGeo(V(-13.06, DECK, z - 0.55), V(-12.98, DECK + 2.0, z + 0.55)), portM);
    // deck rails of the castles (gold-capped), hatch, capstan, wheel-less 1628 deck: whipstaff housing as a box
    b.add(boxGeo(V(-2.5, DECK, -1.4), V(1.5, DECK + 0.25, 1.4)), woodM);
    b.add(new THREE.CylinderGeometry(0.45, 0.55, 1.1, 10), woodM, new THREE.Matrix4().makeTranslation(-7, DECK + 0.55, 0));
    for (const x of [-12.9, 15.1]) b.add(boxGeo(V(x - 0.15, x < 0 ? QDECK : FDECK, -halfW(x, QDECK) + 0.3), V(x + 0.15, (x < 0 ? QDECK : FDECK) + 0.18, halfW(x, QDECK) - 0.3)), goldM);
    // gun ports: dark openings, bronze barrels poking out (lids are instanced so the story can open them)
    const lidG = new THREE.BoxGeometry(0.86, 0.86, 0.08).translate(0, -0.43, 0);
    const lidM = lam("vasaLid", () => ({ color: "#b8332c" }));
    let nl = 0;
    const portList: [number, number, number][] = [];
    for (const [k, row] of [[0, PORTS_LO], [1, PORTS_HI]] as const) for (const x of row) for (const s of [-1, 1]) portList.push([x, PORT_Y[k], s]);
    this.lids = new THREE.InstancedMesh(lidG, lidM, portList.length);
    for (const [x, y, s] of portList) {
      const w = halfW(x, y), n = V(0, -(halfW(x, y + 0.3) - halfW(x, y - 0.3)) / 0.6, s).normalize();
      const c = V(x, y, s * (w + 0.02));
      b.add(new THREE.BoxGeometry(0.78, 0.78, 0.06), portM, new THREE.Matrix4().compose(c, new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n), V(1, 1, 1)));
      b.add(beamBetween(c.clone().addScaledVector(n, -0.2), c.clone().addScaledVector(n, 0.75), 0.26, true), bronzeM);
      // lid hinged on the top edge, swung up ~65 deg
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), n).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), s * 0 - 1.15));
      this.lids.setMatrixAt(nl++, new THREE.Matrix4().compose(c.clone().add(V(0, 0.43, 0)).addScaledVector(n, 0.03), q, V(1, 1, 1)));
    }
    this.lids.castShadow = true; this.lids.receiveShadow = true;
    G.add(this.lids);
    // beakhead + gold lion figurehead + bowsprit
    b.add(boxGeo(V(HL - 1.5, 4.6, -0.5), V(HL + 3.4, 5.4, 0.5)), woodM);
    const lion = new THREE.SphereGeometry(1, 16, 12);
    b.add(lion, goldM, new THREE.Matrix4().compose(V(HL + 3.1, 5.0, 0), new THREE.Quaternion(), V(1.4, 1.1, 0.75)));
    b.add(new THREE.SphereGeometry(0.7, 14, 10), goldM, new THREE.Matrix4().makeTranslation(HL + 4.2, 5.9, 0));
    b.add(beamBetween(V(HL - 2, FDECK + 0.6, 0), V(HL + 14, 13.5, 0), 0.6, true), woodM);
    // gold statues along the stern quarters (rows of small figures) + lanterns on the stern
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
      const x = -HL + 0.6 + i * 1.6, y = topY(x) - 1.9;
      b.add(new THREE.CapsuleGeometry(0.22, 0.6, 4, 8), goldM, new THREE.Matrix4().makeTranslation(x, y, s * (halfW(x, y) + 0.12)));
    }
    for (const z of [-2.4, 0, 2.4]) b.add(new THREE.CylinderGeometry(0.28, 0.2, 0.9, 8), goldM, new THREE.Matrix4().makeTranslation(-HL + 0.4, topY(-HL) + 0.6, z));
    // masts, tops, yards
    for (const m of MASTS) {
      const base = deckAt(m.x) - 0.1;
      b.add(new THREE.CylinderGeometry(0.32, 0.55, m.top - base, 10), woodM, new THREE.Matrix4().makeTranslation(m.x, (m.top + base) / 2, 0));
      for (const yy of m.yards.slice(0, -1)) b.add(new THREE.CylinderGeometry(1.5, 1.2, 0.45, 12), woodM, new THREE.Matrix4().makeTranslation(m.x, yy + 2.2, 0));
      m.yards.forEach((yy, k) => {
        const half = (k === 0 ? 10 : k === 1 ? 7.5 : 5) * (m.x < -10 ? 0.75 : 1);
        b.add(beamBetween(V(m.x + 0.4, yy, -half), V(m.x + 0.4, yy, half), 0.28, true), woodM);
      });
      // shrouds: 5 per side from below the first top to the hull side
      for (const s of [-1, 1]) for (let k = 0; k < 5; k++) {
        const x = m.x - 1.6 + k * 0.8;
        b.add(beamBetween(V(m.x, m.yards[0] + 1.9, s * 1.2), V(x, topY(x) - 0.1, s * (halfW(x, topY(x)) + 0.1)), 0.07), ropeM);
      }
      b.add(beamBetween(V(m.x, m.top - 0.5, 0), V(m.x + (m.x > 5 ? 13 : 12), m.x > 5 ? 13 : deckAt(m.x + 12) + 0.5, 0), 0.08), ropeM);
    }
    b.build(G);
    G.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // sails: billowed grids under their yards (rebuilt per frame from billow/set)
    const sm = lam("vasaSailM", () => ({ map: sailTex(), side: THREE.DoubleSide }));
    for (const [mi, yi] of SET) {
      const m = MASTS[mi], yard = m.yards[yi], next = yi === 0 ? m.yards[0] - (deckAt(m.x) + 3) : m.yards[yi] - m.yards[yi - 1] - 0.6;
      const w = 2 * (yi === 0 ? 9.4 : 7) * (m.x < -10 ? 0.75 : 1), h = Math.max(4, next);
      const g = new THREE.PlaneGeometry(w, h, 12, 8);
      g.rotateY(Math.PI / 2); // plane in z-y, facing +x
      const mesh = new THREE.Mesh(g, sm); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      mesh.position.set(m.x + 0.7, yard - h / 2, 0);
      G.add(mesh);
      this.sails.push({ mesh, base: Float32Array.from(g.attributes.position.array as Float32Array), w, h, yard, x: m.x + 0.7 });
    }
    // flags: pennants at the mast heads, the big flag on the stern staff
    const fm = lam("vasaFlag", () => ({ map: flagTexSE(), side: THREE.DoubleSide }));
    for (const m of MASTS) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.9, 12, 1), fm); f.position.set(m.x, m.top + 0.3, 0); f.frustumCulled = false;
      G.add(f); this.flags.push({ mesh: f, len: 4.5 });
    }
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 6), woodM); staff.position.set(-HL - 0.3, topY(-HL) + 3, 0); G.add(staff);
    const big = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.6, 12, 1), fm); big.position.set(-HL - 0.3, topY(-HL) + 4.7, 0); big.frustumCulled = false;
    G.add(big); this.flags.push({ mesh: big, len: 4.2 });
    void r;
  }

  /** sails (set 0 = furled on the yards .. 1 = full) and their billow toward the bow, flags waving */
  pose(L: ShipLook) {
    for (const s of this.sails) {
      const p = s.mesh.geometry.attributes.position as THREE.BufferAttribute, B = s.base;
      const hh = Math.max(0.06, L.set) * s.h;
      for (let i = 0; i < p.count; i++) {
        const z = B[i * 3 + 2], y0 = B[i * 3 + 1];
        const v = (s.h / 2 - y0) / s.h; // 0 at the yard .. 1 at the foot
        const u = z / (s.w / 2);
        const belly = L.billow * 1.9 * Math.sin(Math.PI * Math.min(1, v * 1.05)) * (1 - 0.55 * u * u) + 0.08 * Math.sin(L.t * 2.3 + u * 3 + v * 2) * (0.4 + L.billow);
        p.setXYZ(i, belly * L.set, s.h / 2 - v * hh, z * (1 - 0.06 * v));
      }
      p.needsUpdate = true; s.mesh.geometry.computeVertexNormals();
      s.mesh.position.y = s.yard - s.h / 2;
    }
    for (const f of this.flags) {
      const p = f.mesh.geometry.attributes.position as THREE.BufferAttribute, hgt = f.len > 4.4 ? 0.45 : 1.3;
      for (let i = 0; i < p.count; i++) {
        const u = (i % 13) / 12, y = i < 13 ? hgt : -hgt;
        p.setXYZ(i, -u * f.len, y * (f.len > 4.4 ? 1 - 0.8 * u : 1) + 0.06 * u * Math.sin(L.t * 4 - u * 3), 0.3 * u * Math.sin(L.t * 5.5 - u * 5 + f.mesh.position.x));
      }
      p.needsUpdate = true;
    }
  }
}
