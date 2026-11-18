// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, persian, pkid, fxBurst, fxShadow, fxContact, INK,
  Outfit, Expr, FrontOpts, SideOpts, Prop,
} from "./toon";
import { FPS, SHOTS, V3, smooth, clamp01, W, L as LEADT, Scene, lin, SPOT } from "./story";
import { groundY, KIT, PIT, DOOR, WALL_Z, POOL_Z0, POOL_Z1, WALL_X0, DOME } from "./desert";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 1;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean; hdr?: number };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
const vOf = (i: number) => (i * 7 + (i >> 2)) % 4;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" | "night" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const SWAPS: Record<number, number[]> = {};
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden" | "night", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], night: [0.3, 0.28, 0.5] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- crowd by shot ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };
const FOLKP = [0, 1, 2, 3, 4, 5, 6, 7].map((v) => persian(v));
const KIDS = [0, 1, 2, 3].map((v) => pkid(v));
let NOW = 0;
const front = (cam: CamInfo, i: number, o: Outfit, okey: string, x: number, y: number, z: number, fo: FrontOpts, sc = 1, shadow = true, out?: Stage) => {
  const pl = person(cam, { i, o, okey }, x, y, z, { side: false, mirror: false }, { blink: lidAt(NOW, i), ...fo }, {}, sc);
  if (out) { out.places.push(pl); if (shadow) blob(out, x, y, z, sc); }
  return pl;
};

// ---------------- effect drawings ----------------
/** a flame tongue cluster, phase u 0..1 (flicker loops) */
const flame = (p: Pen, u: number, k: number) => {
  const tongue = (cx: number, by: number, w: number, h: number, sway: number, col: string, ol: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      const up = c > 0 ? 0 : -c; // top half
      const yy = by - h * 0.5 + c * h * 0.5;
      const xx = cx + s * w * (0.35 + 0.65 * (1 - up) ** 0.7) + sway * up * up * w;
      pts.push([xx, yy]);
    }
    p.poly(pts, col, ol);
  };
  const ph = u * Math.PI * 2;
  for (const [dx, hh2, s] of [[-70, 0.72, 1.3], [70, 0.8, -1.1], [0, 1.0, 0.6]] as const) {
    const sw = Math.sin(ph * 2 + dx * 0.05 + k) * 0.5 * s;
    tongue(256 + dx, 490, 95, 430 * hh2 * (0.9 + 0.1 * Math.sin(ph * 3 + k)), sw, "#ff7a1e", 10);
    tongue(256 + dx * 0.9, 490, 60, 300 * hh2 * (0.9 + 0.1 * Math.sin(ph * 3 + 1 + k)), sw * 1.2, "#ffc23a", 0);
    tongue(256 + dx * 0.85, 490, 30, 160 * hh2, sw * 1.4, "#fff3b0", 0);
  }
};
const flameCard = (out: Stage, t: number, x: number, y: number, z: number, h: number, i: number, k = 1) => {
  if (k <= 0.02) return;
  const u = Math.round((((t * 2.2 + i * 0.37) % 1) * 12)) / 12, v = i % 3;
  out.fx.push({ key: `flame${u}_${v}`, cw: 512, ch: 512, draw: (p) => flame(p, u, v), x, y: y + (h * k) / 2 - 0.1, z, w: h * k, h: h * k, hdr: 1.6 });
};
const puff = (p: Pen, col: string) => { for (const [x, y, r] of [[100, 150, 70], [160, 120, 80], [180, 170, 62], [130, 100, 56]] as const) p.ell(x, y, r, r * 0.85, col, 0); };
const steamCard = (out: Stage, t: number, x: number, y: number, z: number, n: number, k: number, size = 2.4) => {
  for (let i = 0; i < n; i++) {
    const u = ((t * 0.55 + i / n) % 1);
    const sz = (0.8 + u * 1.6) * size * k;
    out.fx.push({ key: "steam", cw: 256, ch: 256, draw: (p) => puff(p, "#f4f2f8"), x: x + Math.sin(i * 2.3) * 1.6 + u * 0.6, y: y + u * 4.5, z: z + Math.cos(i * 1.7) * 1.4, w: sz, h: sz, soft: true });
  }
};
/** falling water from a bucket: a bent blue ribbon with white streaks */
const stream = (p: Pen) => {
  p.poly([[200, 20], [300, 30], [290, 300], [250, 500], [190, 500], [210, 290]], "#7fb8ea", 9);
  p.stroke([[240, 60], [244, 260], [228, 460]], 9, "#e8f6ff");
  for (const [x, y] of [[170, 470], [300, 480], [150, 420], [320, 430]] as const) p.ell(x, y, 14, 18, "#a8d4f5", 5);
};
const drip = (p: Pen) => { p.ell(32, 40, 14, 18, "#7fb8ea", 4); };
/** the glass dish on the table: hot (orange glow), ice water splashing, cracked, split */
const dish = (p: Pen, hot: number, cracked: number, split: number) => {
  const glow = `rgb(${255},${Math.round(120 + 100 * (1 - hot))},${Math.round(40 + 170 * (1 - hot))})`;
  const half = (s: number) => {
    const off = s * split * 40, rot = s * split * 0.25;
    p.rot = split ? [rot, 300 + s * 150, 520, off, split * 10] : null;
    const pts: [number, number][] = s < 0 ? [[60, 380], [300, 380], [300, 520], [120, 520]] : [[300, 380], [540, 380], [480, 520], [300, 520]];
    p.poly(pts, glow, 10);
    p.poly(s < 0 ? [[85, 395], [300, 395], [300, 420], [92, 420]] : [[300, 395], [515, 395], [508, 420], [300, 420]], "#fffbe8", 0);
    p.rot = null;
  };
  if (!split) { p.poly([[60, 380], [540, 380], [480, 520], [120, 520]], glow, 10); p.ell(300, 395, 230, 22, "#fffbe8", 0); }
  else { half(-1); half(1); }
  if (cracked && !split) p.stroke([[300, 382], [285, 420], [312, 455], [292, 490], [305, 518]], 8);
};
const crackPop = (out: Stage, t: number, t0: number, x: number, y: number, z: number, s = 1.6) => {
  const u = Math.round(clamp01((t - t0) / 0.3) * 20) / 20;
  if (t >= t0 && u < 1) out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u, "#fff3b0", 10, 40, 230), x, y, z, w: s, h: s, hdr: 1.3 });
};

// ---------------- props and effect drawings ----------------
const goat = (p: Pen, ph: number) => {
  const B = "#f1ece2", D = "#cfc6b6";
  for (const [x, o] of [[200, 0.5], [380, 0]] as const) { const sw = Math.sin(Math.PI * 2 * (ph + o)) * 18; p.line([[x, 760], [x + sw, 960]], D, 16); }
  p.ell(300, 720, 150, 75, B, 9);
  for (const [x, o] of [[170, 0], [410, 0.5]] as const) { const sw = Math.sin(Math.PI * 2 * (ph + o)) * 18; p.line([[x, 760], [x + sw, 965]], B, 16); }
  p.poly([[420, 690], [470, 600], [520, 590], [540, 640], [470, 720]], B, 9);
  p.ell(520, 610, 48, 34, B, 8, 0, 360, 20);
  p.poly([[505, 575], [470, 520], [520, 560]], "#8a7a6a", 6); p.poly([[530, 575], [540, 515], [550, 570]], "#8a7a6a", 6);
  p.poly([[540, 640], [552, 690], [528, 660]], "#b8ae9e", 5); // beard
  p.dot(530, 600, 7); p.stroke([[150, 700], [128, 670]], 10, B);
};
const egg = (p: Pen, k: number) => {
  if (k < 0.5) { p.ell(128, 140, 64, 84, "#fbf6ea", 7); return; }
  p.poly([[64, 150], [90, 120], [110, 150], [140, 118], [170, 150], [192, 130], [190, 200], [128, 230], [66, 200]], "#fbf6ea", 7);
  p.ell(128, 250, 80, 26, "#f6f2e8", 5); p.ell(128, 250, 24, 18, "#f2c443", 4);
};
const pile = (col: string) => (p: Pen) => { p.ell(128, 190, 110, 60, col, 7, 180, 360); p.stroke([[22, 190], [234, 190]], 7); for (let i = 0; i < 12; i++) p.dot(40 + i * 16, 170 - (i % 3) * 12, 4, "rgba(0,0,0,0.25)"); };
const hairTuft = (p: Pen) => { for (let i = 0; i < 9; i++) p.stroke([[60 + i * 16, 220], [80 + i * 14, 60 + (i % 3) * 20]], 6, "#e8e2d6"); };
const heatArrow = (p: Pen) => {
  const pts: [number, number][] = []; for (let i = 0; i <= 20; i++) { const y = 480 - i * 20; pts.push([128 + Math.sin(i * 0.9) * 30, y]); }
  p.line(pts, "#ff8a3a", 26); p.poly([[78, 90], [128, 10], [178, 90]], "#ff8a3a", 8);
};
const shimmer = (p: Pen) => { for (let k = 0; k < 3; k++) { const pts: [number, number][] = []; for (let i = 0; i <= 16; i++) pts.push([60 + k * 70 + Math.sin(i) * 12, 400 - i * 22]); p.stroke(pts, 7, "rgba(255,240,210,0.9)"); } };
const sweat = (p: Pen) => { p.poly([[32, 4], [52, 40], [32, 60], [12, 40]], "#9fd6f6", 4); p.ell(26, 30, 5, 8, "#ffffff", 0); };
const chips = (p: Pen) => { for (const [x, y, a] of [[60, 60, 0.3], [180, 40, 1.2], [140, 140, 2], [40, 160, 0.8]] as const) { p.rot = [a, x, y]; p.poly([[x - 22, y - 10], [x + 22, y - 10], [x + 18, y + 10], [x - 18, y + 10]], "#e4f4fc", 4); } p.rot = null; };
const splashW = (p: Pen) => { for (const [x, y, r] of [[60, 200, 22], [120, 120, 28], [190, 170, 20], [150, 60, 16]] as const) p.ell(x, y, r, r * 1.3, "#7fc0ea", 5); };

// ---------------- staging helpers ----------------
const stander = (cam: CamInfo, i: number, o: Outfit, okey: string, x: number, z: number, fo: FrontOpts, out: Stage, sc = 1, y?: number) => front(cam, i, o, okey, x, y ?? groundY(x, z), z, fo, sc, true, out);
const walker = (cam: CamInfo, t: number, i: number, o: Outfit, okey: string, x: number, z: number, dx: number, dz: number, expr: Expr, out: Stage, sc = 1) => {
  const y = groundY(x, z), v = viewOf(cam, x, z, dx, dz), ph = (t * 1.0 + hh(i, 4)) % 1;
  out.places.push(person(cam, { i, o, okey }, x, y, z, v, { blink: lidAt(NOW, i), expr, mode: "march", phase: ph }, { blink: lidAt(NOW, i), expr, mode: "march", phase: ph, stride: 0.75 * Math.max(0.3, v.fs) }, sc));
  blob(out, x, y, z, sc);
};
/** expression by beat: [time, expr] steps (swaps every 0.3-1 s on beat words, landing 2 f early) */
const beat = (t: number, steps: [number, Expr][]): Expr => { let e = steps[0][1]; for (const [t0, x] of steps) if (t >= t0 - LEADT) e = x; return e; };
const card = (out: Stage, key: string, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h = w, rot = 0, soft = false) =>
  out.fx.push({ key, cw: 256, ch: 256, draw, x, y, z, w, h, rot, soft });
const pop = (t: number, t0: number) => { const u = clamp01((t - t0 + LEADT) / 0.18); return u <= 0 ? 0 : u < 1 ? 0.6 + 0.6 * Math.sin(u * Math.PI * 0.5) : 1; };
const hot = (o: Outfit): Outfit => ({ ...o, skin: "#f59a84" });
const cold = (o: Outfit): Outfit => ({ ...o, skin: "#a9cfee" });
const DAD = FOLKP[0], MOM = FOLKP[2], W1 = FOLKP[1], W2 = FOLKP[3], W3 = FOLKP[4], W4 = FOLKP[5];

// ---------------- crowd by shot ----------------
const [SX, SZ] = SPOT.square, [PX, PZ] = SPOT.pool;
const hook = (t: number, cam: CamInfo, out: Stage) => {
  stander(cam, 800, KIDS[0], "k0", SX, SZ, { expr: beat(t, [[0, "smile_closed"], [W.middle + 0.6, "grin"], [W.freezer, "laugh"]]), prop: "bowl", facing: 0 }, out, 1);
  stander(cam, 801, hot(DAD), "dadH", SX + 1.3, SZ - 1.6, { expr: beat(t, [[0, "pained"], [W.freezer, "shock"]]), facing: -1, look: -1 }, out);
  stander(cam, 802, KIDS[1], "k1", SX - 1.4, SZ - 1.0, { expr: beat(t, [[0, "grin"], [W.freezer, "laugh"]]), prop: "bowl", facing: 1 }, out, 0.95);
  card(out, "sweat", sweat, SX + 1.6, 1.95, SZ - 1.55, 0.14, 0.18);
  card(out, "shim", shimmer, SX - 0.5, 1.2, SZ - 6, 3.0, 4.0, 0, true);
};
const heat = (t: number, cam: CamInfo, out: Stage) => {
  const fan = Math.sin(t * 14) > 0;
  stander(cam, 810, hot(DAD), "dadH", SX + 0.2, SZ + 0.4, { expr: beat(t, [[W.yousee1, "pained"], [W.hundred, "shock"], [W.range, "dazed"]]), prop: fan ? "point" : "shrug", facing: 0 }, out);
  for (let k = 0; k < 3; k++) { const u = ((t * 1.3 + k * 0.33) % 1); card(out, "sweat", sweat, SX + 0.2 + (k - 1) * 0.22, 2.05 - u * 0.5, SZ + 0.6, 0.12, 0.16); }
  stander(cam, 811, MOM, "mom", SX - 1.6, SZ - 1.2, { expr: beat(t, [[W.yousee1, "nervous"], [W.hundred, "pained"]]), facing: 1 }, out);
};
const build = (t: number, cam: CamInfo, out: Stage) => {
  const [dx, , dz] = DOOR;
  stander(cam, 820, W1, "w1", dx - 2.4, dz + 3.5, { expr: beat(t, [[W.so1, "stern"], [W.sixty, "shock"], [W.thick, "grin"]]), look: -1, prop: t > W.sixty - LEADT && t < W.thick - LEADT ? "point" : null, facing: 1 }, out);
  stander(cam, 821, W2, "w2", dx + 2.2, dz + 3.0, { expr: beat(t, [[W.so1, "grin"], [W.sixty, "shock"], [W.thick, "laugh"]]), prop: t > W.thick - LEADT ? "shrug" : null, facing: -1 }, out);
  stander(cam, 822, W3, "w3", dx + 0.2, dz + 1.2, { expr: beat(t, [[W.thick, "grin"]]), prop: "shrug", facing: 0 }, out, 1);
  for (let k = 0; k < 6; k++) stander(cam, 823 + k, FOLKP[(k + 4) % 8], `f${(k + 4) % 8}`, -10 + k * 4, DOME[2] + 13 + (k % 2) * 2, { expr: beat(t, [[0, "neutral"], [W.sixty, "shock"]]), prop: k % 2 ? "point" : null, facing: (k % 3 - 1) as -1 | 0 | 1 }, out);
};
const mix = (t: number, cam: CamInfo, out: Stage) => {
  const [tx, tz] = SPOT.trough;
  stander(cam, 830, W1, "w1", tx - 1.4, tz - 0.8, { expr: beat(t, [[W.andmud, "stern"], [W.goat, "dazed"], [W.egg, "shock"]]), prop: ["pick", 0.5 + 0.5 * Math.sin(t * 9)] as Prop, facing: 1 }, out);
  const items: [number, string, (p: Pen) => void][] = [[W.sand, "sand", pile("#e2b77c")], [W.clay, "clay", pile("#b5653f")], [W.lime, "lime", pile("#f4f1ea")], [W.ash, "ash", pile("#8a8a92")], [W.goat, "hair", hairTuft]];
  items.forEach(([t0, k, d], i) => { const s = pop(t, t0); if (s > 0) card(out, k, d, tx - 0.9 + i * 0.45, 0.85 + (s < 1 ? (1 - s) * 0.6 : 0), tz + 0.4, 0.55 * s); });
  const gx = tx + 2.6 - clamp01((t - W.goat + 0.2) / 0.6) * 0.9;
  if (t > W.goat - 0.5) out.places.push({ key: `goat${Math.round((t * 2) % 1 * 8)}`, draw: (p) => goat(p, Math.round((t * 2) % 1 * 8) / 8), x: gx, y: 0, z: tz + 0.9, scale: 1.25, mirror: true, size: [480, 800, 0.8] });
  const e = clamp01((t - W.egg + 0.1) / 0.3);
  if (t > W.egg - 0.3) card(out, `egg${e > 0.5 ? 1 : 0}`, (p) => egg(p, e), tx + 0.5, 1.05, tz + 0.6, 0.5);
};
const doubters = (t: number, cam: CamInfo, out: Stage) => {
  const [tx, tz] = SPOT.trough;
  stander(cam, 840, W2, "w2", tx - 0.6, tz + 0.2, { expr: beat(t, [[W.eggs, "shock"], [W.wall1, "dazed"]]), facing: 1, prop: "point" }, out);
  stander(cam, 841, W3, "w3", tx + 0.7, tz - 0.2, { expr: beat(t, [[W.eggs, "nervous"], [W.wall1, "shock"]]), facing: -1, look: -1 }, out);
  card(out, "egg0", (p) => egg(p, 0), tx + 0.05, 1.55, tz + 0.5, 0.22);
};
const dig = (t: number, cam: CamInfo, out: Stage) => {
  for (let i = 0; i < 4; i++) {
    const x = PX - 3 + i * 2.6, z = PZ - 1.5 + (i % 2) * 2.5, k = 0.5 - 0.5 * Math.cos(Math.PI * 2 * ((t * 1.6 + i * 0.3) % 1));
    stander(cam, 850 + i, FOLKP[(i * 3 + 1) % 8], `f${(i * 3 + 1) % 8}`, x, z, { expr: beat(t, [[W.then1, "stern"], [W.sun, i % 2 ? "pained" : "dazed"]]), prop: ["pick", Math.round(k * 6) / 6] as Prop, facing: (i % 2 ? -1 : 1) }, out, 1, -0.5);
  }
};
const flood = (t: number, cam: CamInfo, out: Stage, S: Scene) => {
  stander(cam, 860, W1, "w1", PX - 1.2, POOL_Z0 - 1.8, { expr: beat(t, [[W.atnight, "neutral"], [W.flood, "grin"]]), prop: "point", facing: 1 }, out);
  stander(cam, 861, W4, "w4", PX + 1.5, POOL_Z0 - 2.2, { expr: beat(t, [[W.atnight, "dazed"], [W.water, "smile"]]), facing: -1 }, out);
  if (S.fill < 0.98 && t > W.flood - 0.2) for (let k = 0; k < 3; k++) card(out, "spl", splashW, WALL_X0 + 7 + k * 0.6, 0.2, POOL_Z0 + 4, 0.8);
};
const frost = (t: number, cam: CamInfo, out: Stage) => {
  stander(cam, 870, cold(W1), "w1c", PX + 0.2, POOL_Z0 - 1.6, { expr: beat(t, [[W.morning, "dazed"], [W.ice1, "shock"], [W.even, "nervous"], [W.froze, "dazed"]]), prop: t > W.even - LEADT ? "shrug" : "point", facing: 0 }, out);
  stander(cam, 871, W4, "w4", PX - 1.5, POOL_Z0 - 2.4, { expr: beat(t, [[W.morning, "neutral"], [W.ice1, "laugh"]]), facing: 1 }, out);
};
const puzzled = (t: number, cam: CamInfo, out: Stage) => {
  stander(cam, 880, W1, "w1", PX, POOL_Z0 - 0.9, { expr: beat(t, [[W.sohow, "dazed"], [W.frost, "nervous"]]), prop: "shrug", facing: 0 }, out);
};
const explain = (t: number, cam: CamInfo, out: Stage) => {
  stander(cam, 890, W1, "w1", PX - 0.4, POOL_Z0 - 1.2, { expr: beat(t, [[W.well, "neutral"], [W.throws, "shock"], [W.sky1, "laugh"]]), look: -1, prop: t > W.throws - LEADT ? "point" : null, facing: 1 }, out);
  for (let k = 0; k < 9; k++) {
    const t0 = W.throws - 0.2 + (k % 3) * 0.25, u = ((t - t0) * 0.7 + k * 0.11) % 1;
    if (t < t0) continue;
    card(out, "heat", heatArrow, PX - 6 + k * 1.6, 0.6 + u * 14, (POOL_Z0 + POOL_Z1) / 2 + (k % 2) * 1.5, 1.2, 2.4);
  }
};
const freezer = (t: number, cam: CamInfo, out: Stage) => {
  const [kx, ky, kz] = KIT;
  stander(cam, 900, cold(W2), "w2c", kx + 0.9, kz - 1.7, { expr: beat(t, [[W.like, "smile"], [W.freezer2, "dazed"], [W.whole, "shock"]]), prop: t > W.whole - LEADT ? "armsUp" : null, facing: 0 }, out, 1, ky);
};
const smash = (t: number, cam: CamInfo, out: Stage, S: Scene) => {
  for (let i = 0; i < 3; i++) {
    const x = PX - 2 + i * 2.2, z = POOL_Z0 + 1.6 + (i % 2) * 1.6, k = 0.5 - 0.5 * Math.cos(Math.PI * 2 * ((t * 1.9 + i * 0.37) % 1));
    if (t < W.drag) {
      stander(cam, 910 + i, FOLKP[(i * 2 + 1) % 8], `f${(i * 2 + 1) % 8}`, x, z, { expr: i === 1 ? "grin" : "stern", prop: ["pick", Math.round(k * 6) / 6] as Prop, facing: (i - 1) as -1 | 0 | 1 }, out, 1, -0.1);
      if (k > 0.85) card(out, "chips", chips, x + 0.6, 0.3, z + 0.2, 0.7);
    }
  }
  if (S.sled) for (let i = 0; i < 2; i++) walker(cam, t, 915 + i, FOLKP[i * 4 + 1], `f${i * 4 + 1}`, S.sled[0] + Math.cos(S.sled[3]) * 2.6, S.sled[2] - Math.sin(S.sled[3]) * 2.6 + (i - 0.5) * 1.1, Math.cos(S.sled[3]), -Math.sin(S.sled[3]), "stern", out);
  crackPop(out, t, W.smash, PX, 0.4, POOL_Z0 + 2, 2.4);
};
const stack = (t: number, cam: CamInfo, out: Stage) => {
  const [px, py, pz] = PIT;
  stander(cam, 920, W1, "w1", px + 1.6, pz + 5.6, { expr: beat(t, [[W.stack, "stern"], [W.straw, "grin"]]), prop: "iceLow", facing: -1 }, out, 1, py);
  stander(cam, 921, W3, "w3", px - 1.4, pz + 5.8, { expr: beat(t, [[W.stack, "grin"], [W.straw, "smile_closed"]]), prop: "bagsLow", facing: 1 }, out, 1, py);
};
const vent = (t: number, cam: CamInfo, out: Stage) => {
  for (let k = 0; k < 5; k++) { const u = ((t * 0.6 + k * 0.2) % 1); card(out, "heat", heatArrow, DOME[0] + (k - 2) * 0.8, 17 + u * 9, DOME[2], 1.1, 2.2); }
  stander(cam, 930, KIDS[2], "k2", DOOR[0] + 2.4, DOOR[2] + 5, { expr: beat(t, [[W.dome2, "dazed"], [W.chimney, "grin"]]), look: -1, prop: "point", facing: -1 }, out, 1);
};
const summer = (t: number, cam: CamInfo, out: Stage) => {
  const [dx, , dz] = DOOR, out1 = clamp01((t - W.comes + 0.3) / 0.8);
  stander(cam, 940, W1, "w1", dx, dz + 1.9 + out1 * 2.2, { expr: beat(t, [[W.then2, "neutral"], [W.comes, "grin"]]), prop: "iceUp", facing: 0 }, out);
  for (let k = 0; k < 4; k++) stander(cam, 941 + k, KIDS[k], `k${k}`, dx - 3 + k * 2 - (k > 1 ? -0.4 : 0), dz + 5.2 + (k % 2) * 0.8, { expr: beat(t, [[W.then2, "pained"], [W.comes, "shock"], [W.iceout, "laugh"]]), prop: t > W.iceout - LEADT ? "armsUp" : null, facing: (k < 2 ? 1 : -1) }, out, 1);
};
const finale = (t: number, cam: CamInfo, out: Stage) => {
  stander(cam, 950, KIDS[0], "k0", SX, SZ, { expr: beat(t, [[W.turns, "grin"], [W.it, "laugh"]]), prop: "bowl", facing: 0 }, out, 1);
  stander(cam, 951, DAD, "dad", SX + 1.4, SZ - 1.4, { expr: beat(t, [[W.turns, "smile_closed"], [W.skyend, "laugh"]]), prop: "bowl", facing: -1 }, out);
  stander(cam, 952, MOM, "mom", SX - 1.5, SZ - 1.2, { expr: beat(t, [[W.turns, "smile"], [W.skyend, "laugh"]]), prop: "bowl", facing: 1 }, out);
  for (let k = 0; k < 8; k++) stander(cam, 953 + k, k % 3 ? FOLKP[(k + 2) % 8] : KIDS[k % 4], k % 3 ? `f${(k + 2) % 8}` : `k${k % 4}`, SX - 7 + k * 2, SZ - 6 - (k % 2) * 2, { expr: k % 2 ? "laugh" : "grin", prop: "bowl", facing: (k % 3 - 1) as -1 | 0 | 1 }, out, k % 3 ? 1 : 0.8);
};

/** everything with a face and the effects in shot `id` at time t */
export const stage = (id: number, t: number, S: Scene, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light; NOW = t;
  findSun(cam, SUN);
  const c = s.crowd;
  if (c === "hook") hook(t, cam, out);
  if (c === "heat") heat(t, cam, out);
  if (c === "build") build(t, cam, out);
  if (c === "mix") mix(t, cam, out);
  if (c === "doubters") doubters(t, cam, out);
  if (c === "dig") dig(t, cam, out);
  if (c === "flood") flood(t, cam, out, S);
  if (c === "frost") frost(t, cam, out);
  if (c === "puzzled") puzzled(t, cam, out);
  if (c === "explain") explain(t, cam, out);
  if (c === "freezer") freezer(t, cam, out);
  if (c === "smash") smash(t, cam, out, S);
  if (c === "stack") stack(t, cam, out);
  if (c === "vent") vent(t, cam, out);
  if (c === "summer") summer(t, cam, out);
  if (c === "finale") finale(t, cam, out);
  return out;
};
void FOLK; void SWAPS; void LEAD; void smooth; void INK; void bodyFront; void bodySide; void lin; void WALL_Z;
export { FPS };
