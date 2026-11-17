// The Tsar Bell (1735): a lathed bronze bell 6.14 m tall, 6.6 m across, with raised bands, an orb and cross on top,
// a painted ornament / crack overlay, and the 11.5-tonne piece that broke off in 1737 as its own group.
// Outer and inner surfaces have their own materials so the outside can cool while the inside still glows.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex } from "./paint";
import { twoTone } from "./shade";
import { NOINK } from "./ink";

export const BELL_H = 6.2;
type P = [number, number];
// outer profile, lip -> crown (r, y)
const OUT: P[] = [[3.3, 0], [3.36, 0.14], [3.2, 0.42], [2.95, 0.9], [2.66, 1.6], [2.48, 2.4], [2.34, 3.3], [2.24, 4.2], [2.14, 4.9], [1.95, 5.35], [1.55, 5.68], [0.9, 5.85], [0.001, 5.9]];
// inner surface, crown -> lip
const INN: P[] = [[0.001, 5.45], [0.9, 5.38], [1.55, 5.1], [1.82, 4.5], [1.93, 3.6], [2.05, 2.4], [2.28, 1.4], [2.62, 0.5], [2.86, 0]];
export const CUT_Y = 2.4;               // the broken piece spans the lip up to this height
export const PIECE_PHI = 0.62;          // its width (rad, ~2 m at the lip)
export const PIECE_AT = Math.PI * 0.08; // its start angle (rad, measured like the lathe: x = r sin(phi), z = r cos(phi))

/** lathe with explicit uv (u = phi / 2pi, v = y / BELL_H) and smooth normals */
const lathe = (pts: P[], phi0: number, len: number, segs: number) => {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const ph = phi0 + (len * i) / segs, s = Math.sin(ph), c = Math.cos(ph);
    for (const [r, y] of pts) { pos.push(r * s, y, r * c); uv.push(ph / (2 * Math.PI), y / BELL_H); }
  }
  const n = pts.length;
  for (let i = 0; i < segs; i++) for (let j = 0; j < n - 1; j++) {
    const a = i * n + j, b = (i + 1) * n + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g.toNonIndexed();
};
/** split a profile at CUT_Y: below keeps the points under it plus the cut point, above the rest */
const split = (pts: P[], rising: boolean): [P[], P[]] => {
  const lo: P[] = [], hi: P[] = [];
  for (const p of pts) (p[1] <= CUT_Y + 1e-6 ? lo : hi).push(p);
  const cut = pts.find((p) => Math.abs(p[1] - CUT_Y) < 1e-6)!;
  return rising ? [lo, [cut, ...hi]] : [lo, [...hi, cut]];
};
/** flat cap across the wall of the lower ring at angle phi (the broken faces) */
const cap = (phi: number) => {
  const lo = [...OUT.filter((p) => p[1] <= CUT_Y), ...INN.filter((p) => p[1] <= CUT_Y).reverse()];
  const sh = new THREE.Shape(lo.map(([r, y]) => new THREE.Vector2(r, y)));
  const g = new THREE.ShapeGeometry(sh);
  g.rotateY(phi - Math.PI / 2);
  return g.toNonIndexed();
};
const ring = (y: number, rr: number, phi0: number, len: number, segs: number, prof: P[]) => {
  // small round bead around the outer surface at height y
  const r = rOut(y, prof) + rr * 0.4, pts: P[] = [];
  for (let k = 0; k <= 8; k++) { const a = -Math.PI / 2 + (Math.PI * k) / 8; pts.push([r + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  return lathe(pts, phi0, len, segs);
};
const rOut = (y: number, prof: P[] = OUT) => {
  for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0); }
  return 0;
};

// ---------------- overlay: ornament bands, figure panels, and the cracks ----------------
/** crack paths in uv space (u 0..1 around, v 0..1 up); the first two outline the piece */
const CRACKS: [number, number][][] = (() => {
  const out: [number, number][][] = [];
  const u0 = PIECE_AT / (2 * Math.PI), u1 = (PIECE_AT + PIECE_PHI) / (2 * Math.PI), vt = CUT_Y / BELL_H;
  const zig = (ua: number, va: number, ub: number, vb: number, seed: number, n = 7): [number, number][] => {
    const p: [number, number][] = [];
    for (let i = 0; i <= n; i++) { const k = i / n, w = i && i < n ? Math.sin(seed * 12.9 + i * 7.3) * 0.006 : 0; p.push([ua + (ub - ua) * k + w, va + (vb - va) * k]); }
    return p;
  };
  // cracks 1-2 (the "Crack! Then another."): the sides of the piece; the piece itself breaks along their top
  out.push(zig(u0, 0, u0 + 0.004, vt, 1), zig(u1, 0, u1 - 0.004, vt, 2));
  out.push(zig(u0 + 0.004, vt, u1 - 0.004, vt, 3, 5));
  for (let i = 0; i < 8; i++) { const u = (u1 + 0.07 + i * 0.105) % 1, h = 0.22 + 0.25 * ((i * 37) % 10) / 10; out.push(zig(u, 0, u + 0.01 * Math.sin(i), h, 4 + i)); }
  return out;
})();
const overlayTex = (cracks: number, cold: number) => ctex(`bellOv_${cracks}_${cold}`, 2048, 1024, (g) => {
  const W = 2048, H = 1024, y = (v: number) => H * (1 - v);
  g.clearRect(0, 0, W, H);
  // ornament bands as lighter bronze relief lines + rows of beads
  g.strokeStyle = cold ? "rgba(150,170,190,0.9)" : "rgba(214,176,98,0.95)";
  for (const v of [0.075, 0.27, 0.69, 0.81]) { g.lineWidth = 9; g.beginPath(); g.moveTo(0, y(v)); g.lineTo(W, y(v)); g.stroke(); }
  g.fillStyle = cold ? "rgba(150,170,190,0.85)" : "rgba(214,176,98,0.9)";
  for (const v of [0.3, 0.66]) for (let x = 8; x < W; x += 26) { g.beginPath(); g.arc(x, y(v), 6, 0, 7); g.fill(); }
  // zigzag band near the top
  g.lineWidth = 6; g.beginPath();
  for (let x = 0; x <= W; x += 32) g.lineTo(x, y(0.745) + ((x / 32) % 2 ? -14 : 14));
  g.stroke();
  // four framed panels between the bands, each with a small crown
  for (let k = 0; k < 4; k++) {
    const cx = W * (k / 4 + 0.155), cy = y(0.48);
    g.lineWidth = 9; g.strokeRect(cx - 110, cy - 120, 220, 240);
    g.lineWidth = 6; g.beginPath(); g.moveTo(cx - 50, cy + 20); g.lineTo(cx - 50, cy - 35); g.lineTo(cx - 25, cy - 5); g.lineTo(cx, cy - 50); g.lineTo(cx + 25, cy - 5); g.lineTo(cx + 50, cy - 35); g.lineTo(cx + 50, cy + 20); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(cx - 60, cy + 60); g.lineTo(cx + 60, cy + 60); g.stroke();
  }
  // cracks: near-black, thick, with a lighter lip
  for (let i = 0; i < Math.min(cracks, CRACKS.length); i++) {
    const c = CRACKS[i];
    for (const [lw, col] of [[16, "rgba(20,10,12,1)"], [5, "rgba(255,190,120,0.9)"]] as const) {
      if (col.startsWith("rgba(255") && !cold) continue;
      g.lineWidth = lw; g.strokeStyle = col; g.lineJoin = "round"; g.beginPath();
      c.forEach(([u, v], j) => (j ? g.lineTo(u * W, y(v)) : g.moveTo(u * W, y(v))));
      g.stroke();
    }
  }
});

export class Bell {
  group = new THREE.Group();
  piece = new THREE.Group();
  outerM: THREE.MeshPhongMaterial; innerM: THREE.MeshPhongMaterial; ovM: THREE.MeshLambertMaterial;
  private ovMeshes: THREE.Mesh[] = [];
  private glowAt = -1;

  constructor() {
    this.outerM = twoTone(new THREE.MeshPhongMaterial({ color: "#6d8768", specular: "#c8b888", shininess: 38, side: THREE.DoubleSide }), 0.15);
    this.innerM = twoTone(new THREE.MeshPhongMaterial({ color: "#6e6448", specular: "#8a7a58", shininess: 20, side: THREE.DoubleSide }), 0.15);
    this.ovM = twoTone(new THREE.MeshLambertMaterial({ map: overlayTex(0, 0), alphaTest: 0.5, side: THREE.DoubleSide }));
    const S = 96, two = 2 * Math.PI, a0 = PIECE_AT, w = PIECE_PHI;
    const [oLo, oHi] = split(OUT, true), [iLo, iHi] = split(INN, false);
    const lipO: P[] = [[INN[INN.length - 1][0], 0], OUT[0]];
    const add = (grp: THREE.Group, geos: THREE.BufferGeometry[], m: THREE.Material, ink = true) => {
      const mesh = new THREE.Mesh(mergeGeometries(geos, false), m);
      mesh.castShadow = true; mesh.receiveShadow = true;
      if (!ink) mesh.layers.set(NOINK);
      grp.add(mesh);
      return mesh;
    };
    const bodyAt = (phi0: number, len: number, segs: number) => [lathe(oLo, phi0, len, segs), lathe(lipO, phi0, len, segs)];
    // main bell: full top + the lower ring minus the piece
    add(this.group, [lathe(oHi, 0, two, S), ...bodyAt(a0 + w, two - w, S - 10), lathe([[2.05, CUT_Y], [2.48, CUT_Y]], 0, two, S),
      ring(0.47, 0.09, a0 + w, two - w, S - 10, OUT), ring(1.68, 0.08, a0 + w, two - w, S - 10, OUT), ring(4.28, 0.08, 0, two, S, OUT), ring(5.02, 0.08, 0, two, S, OUT)], this.outerM);
    add(this.group, [lathe(iHi, 0, two, S), lathe(iLo, a0 + w, two - w, S - 10), cap(a0), cap(a0 + w)], this.innerM);
    // crown: four loops ("ears"), the orb and the cross
    const crown: THREE.BufferGeometry[] = [];
    crown.push(new THREE.CylinderGeometry(0.5, 0.62, 0.3, 20).translate(0, 6.02, 0).toNonIndexed());
    const orb = new THREE.SphereGeometry(0.42, 16, 12); orb.translate(0, 6.55, 0); crown.push(orb.toNonIndexed());
    for (const [x0, y0, x1, y1] of [[-0.07, 6.9, 0.07, 7.75], [-0.3, 7.35, 0.3, 7.48]]) crown.push(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.14).translate((x0 + x1) / 2, (y0 + y1) / 2, 0).toNonIndexed());
    add(this.group, crown, this.outerM);
    // the piece (its own group so it can fall away)
    add(this.piece, [...bodyAt(a0, w, 10), ring(0.47, 0.09, a0, w, 10, OUT), ring(1.68, 0.08, a0, w, 10, OUT)], this.outerM);
    add(this.piece, [lathe(iLo, a0, w, 10), cap(a0), cap(a0 + w)], this.innerM);
    // overlay skin, 1 % outside the outer surface (main + piece)
    const ov = (phi0: number, len: number, segs: number, prof: P[]) => { const g = lathe(prof.map(([r, y]) => [r * 1.012 + 0.006, y]), phi0, len, segs); return g; };
    this.ovMeshes.push(add(this.group, [ov(0, two, S, OUT.filter((p) => p[1] >= CUT_Y - 1e-6)), ov(a0 + w, two - w, S - 10, oLo)], this.ovM, false));
    this.ovMeshes.push(add(this.piece, [ov(a0, w, 10, oLo)], this.ovM, false));
    this.group.add(this.piece);
  }

  /** cracks 0..11, glow 0..1 (white-hot orange, HDR for bloom), cold 0..1 outside cooled to blue-grey (explanation),
   *  fall 0..1 the piece tipping outward onto the ground, scale ("grows when hot") */
  pose(o: { cracks: number; glow: number; cold?: number; fall?: number; scale?: number; innerGlow?: number }) {
    const cold = o.cold ?? 0;
    const key = Math.round(o.cracks) * 10 + (cold > 0.5 ? 1 : 0);
    if (key !== this.glowAt) { this.glowAt = key; this.ovM.map = overlayTex(Math.round(o.cracks), cold > 0.5 ? 1 : 0); this.ovM.needsUpdate = true; }
    const hot = new THREE.Color(2.2, 0.75, 0.2);
    this.outerM.emissive.copy(hot).multiplyScalar(o.glow * (1 - cold));
    this.outerM.color.set(cold > 0 ? new THREE.Color("#6d8768").lerp(new THREE.Color("#6a86b0"), cold) : new THREE.Color("#6d8768"));
    this.innerM.emissive.copy(hot).multiplyScalar(o.innerGlow ?? o.glow);
    this.ovM.emissive.set(0, 0, 0);
    this.group.scale.setScalar(o.scale ?? 1);
    // the piece hinges on its lip edge and tips outward, then lies on the floor
    const f = o.fall ?? 0, mid = PIECE_AT + PIECE_PHI / 2, r = 3.3;
    this.piece.position.set(0, 0, 0); this.piece.rotation.set(0, 0, 0);
    if (f > 0) {
      const ax = new THREE.Vector3(Math.cos(mid), 0, -Math.sin(mid)); // tangent at the piece = hinge axis
      const pivot = new THREE.Vector3(r * Math.sin(mid), 0, r * Math.cos(mid));
      const ang = -1.35 * f, out = 1.7 * f;
      const q = new THREE.Quaternion().setFromAxisAngle(ax, ang);
      const p = pivot.clone().sub(pivot.clone().applyQuaternion(q));
      this.piece.quaternion.copy(q);
      this.piece.position.copy(p).add(new THREE.Vector3(Math.sin(mid) * out, 0.05 * f, Math.cos(mid) * out));
    }
  }
}
export const pieceDir = () => { const mid = PIECE_AT + PIECE_PHI / 2; return [Math.sin(mid), Math.cos(mid)] as [number, number]; };
