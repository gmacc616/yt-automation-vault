// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, craftsman, carthage, HANNIBAL, fxBurst, fxShadow, fxContact, INK,
  Outfit, Expr, FrontOpts, SideOpts, Prop,
} from "./toon";
import { FPS, SHOTS, V3, smooth, clamp01, W, L as LEADT, Scene, KIT, GROVE, P, RK, isEleph, columnX, C3X, lin } from "./story";
import { groundY, pathZ, SUMMIT, zigPoint, ROCK } from "./alps";
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
const ARMY = [0, 1, 2, 3, 4, 5].map((v) => carthage(v));
const CRAFTS = [0, 1, 2, 3, 4, 5].map((v) => craftsman(v));
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

// ---------------- animals and props ----------------
const GREY = "#9ca1ad", GREY_D = "#6f7482";
/** side-view elephant facing right in the 600 x 1000 design space (feet at 975): walk phase, mood, snow on its back */
const elephant = (p: Pen, ph: number, mood: "calm" | "stubborn" | "happy" | "shock", snow: number) => {
  const two = Math.PI * 2, walk = mood === "stubborn" ? 0 : 1;
  const leg = (x: number, off: number, col: string) => {
    const s = Math.sin(two * (ph + off)) * walk, fx = x + s * 34, lift = Math.max(0, Math.cos(two * (ph + off))) * 18 * walk;
    p.poly([[x - 30, 770], [x + 30, 770], [fx + 32, 965 - lift], [fx + 34, 975 - lift], [fx - 34, 975 - lift], [fx - 32, 965 - lift]], col, 9);
    for (const k of [-16, 0, 16]) p.ell(fx + k, 970 - lift, 7, 5, "#e8e2d6", 0);
  };
  leg(185, 0.5, GREY_D); leg(425, 0, GREY_D);
  p.line([[70, 700], [40, 790], [46, 812]], GREY, 12); // tail
  const body: [number, number][] = [];
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * two; body.push([280 + 215 * Math.cos(a), 715 + 150 * Math.sin(a) * (Math.sin(a) < 0 ? 1.05 : 0.95)]); }
  p.gradFill(body, GREY, GREY_D, -Math.PI / 2, 0.3); p.poly(body, null, 10);
  // red saddle cloth with gold trim
  p.poly([[180, 585], [380, 580], [395, 700], [170, 705]], "#c0353a", 8); p.stroke([[172, 690], [393, 686]], 10, "#f2c443");
  if (snow > 0) p.poly([[190, 585], [370, 580], [360, 560], [300, 548], [220, 556]], "#f4f7fc", 6);
  leg(125, 0, GREY); leg(370, 0.5, GREY);
  const tilt = mood === "stubborn" ? 14 : mood === "happy" ? -6 : 0;
  p.rot = [(tilt * Math.PI) / 180, 470, 640];
  const head: [number, number][] = [];
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * two; head.push([475 + 100 * Math.cos(a), 650 + 112 * Math.sin(a)]); }
  p.gradFill(head, GREY, GREY_D, -Math.PI / 2, 0.35); p.poly(head, null, 10);
  // trunk: hangs and curls forward
  const curl = mood === "happy" ? -60 : 0;
  p.line([[548, 700], [578, 790], [584, 880 + curl], [560, 930 + curl * 1.4], [532, 920 + curl * 1.2]], GREY, 52);
  for (const y of [770, 815, 860]) p.stroke([[560, y], [600, y + 6]], 4, GREY_D);
  p.line([[520, 770], [556, 812], [586, 818]], "#f6f1e4", 15); // tusk
  p.ell(400, 670, 82, 108, "#b8a2aa", 9); p.ell(412, 676, 50, 72, "#d9b9c0", 0); // ear
  // eye + brow
  const ey = 615, ex = 505;
  if (mood === "shock") { p.ell(ex, ey, 17, 20, "#ffffff", 5); p.dot(ex + 3, ey + 2, 8); p.stroke([[ex - 20, ey - 34], [ex + 18, ey - 40]], 7); }
  else if (mood === "happy") p.arc(ex, ey + 4, 14, 10, 200, 340, 7);
  else { p.dot(ex, ey, 9); }
  if (mood === "stubborn") { p.stroke([[ex - 26, ey - 30], [ex + 20, ey - 14]], 9); p.stroke([[490, 690], [522, 684]], 6); }
  p.rot = null;
};
/** a horse slipping on snow (side view, legs splayed) */
const horse = (p: Pen, k: number) => {
  const B = "#9a5a32", D = "#6a3a20";
  const legs: [number, number, number, number][] = [[150, 760, 60 + 40 * k, 965], [210, 760, 150 + 40 * k, 970], [400, 760, 470 + 50 * k, 960], [440, 760, 520 + 60 * k, 950]];
  legs.forEach(([x0, y0, x1, y1], i) => { p.line([[x0, y0], [x1, y1]], i % 2 ? B : D, 26); p.ell(x1, y1, 18, 10, "#2a2230", 0); });
  p.ell(290, 700, 180, 88, B, 10);
  p.poly([[410, 660], [470, 520], [520, 500], [540, 560], [470, 700]], B, 10); // neck
  p.ell(530, 520, 62, 36, B, 10, 0, 360, 30);
  p.poly([[452, 520], [500, 480], [470, 600], [430, 660]], "#3a2418", 0); // mane
  p.ell(538, 500, 13, 15, "#ffffff", 5); p.dot(541, 503, 6);
  p.stroke([[470, 455], [490, 485]], 8); p.line([[115, 670], [70, 760]], "#3a2418", 22);
  for (const [x, y] of [[90, 965], [520, 960], [580, 945]] as const) p.ell(x, y, 30, 12, "#f4f7fc", 5);
};
const rockBit = (p: Pen) => p.poly([[40, 100], [70, 40], [150, 30], [200, 80], [180, 160], [90, 180]], "#8e8a92", 9);
const scroll = (p: Pen) => { p.poly([[30, 80], [470, 80], [470, 170], [30, 170]], "#f1e2bd", 6); p.ell(30, 125, 24, 50, "#d8c49a", 6); p.ell(470, 125, 24, 50, "#d8c49a", 6);
  for (const y of [100, 120, 140]) p.stroke([[70, y], [420, y]], 3, "#8a7a6a"); };
const snowball = (p: Pen) => p.ell(64, 64, 52, 46, "#f4f7fc", 6);
const splashArc = (p: Pen) => { p.poly([[20, 300], [200, 120], [420, 60], [480, 110], [260, 190], [80, 330]], "#8fc4f0", 9); p.stroke([[60, 290], [230, 150], [430, 85]], 9, "#e8f6ff"); };
const vinegarStream = (p: Pen) => {
  // an arc of vinegar from the jar mouth (top left) onto the rock (right), splashing at the end
  const arc: [number, number][] = [[40, 120], [160, 60], [300, 90], [400, 200], [450, 330]];
  p.line(arc, "#d9a24a", 38);
  p.stroke([[60, 112], [170, 70], [290, 98], [380, 190]], 10, "#ffe2a0");
  for (const [x, y, r] of [[430, 380, 22], [480, 360, 16], [400, 400, 14], [470, 420, 12]] as const) p.ell(x, y, r, r * 1.2, "#e9b864", 6);
};
const chips = (p: Pen) => { for (const [x, y, a] of [[60, 60, 0.3], [180, 40, 1.2], [140, 140, 2], [40, 160, 0.8]] as const) { p.rot = [a, x, y]; p.poly([[x - 22, y - 8], [x + 22, y - 8], [x + 22, y + 8], [x - 22, y + 8]], "#e8cfa4", 4); } p.rot = null; };

// ---------------- staging helpers ----------------
const LIVY: Outfit = { jacket: "#f4f1ea", pants: "#f4f1ea", boots: "#7a4a2a", hat: "hair", hair: "#6a4a32", sash: "#8a3a7a", skin: "#f5c9a0" };
const TRIBE = (v: number): Outfit => ({ jacket: ["#7a5a3a", "#5d6e48", "#8a6a4a"][v % 3], pants: "#5a4a3a", boots: "#3a2a20", hat: "hair", hair: ["#c98a4a", "#5a3b2a", "#e8c45a"][v % 3], skin: "#f5c9a0", moustache: "#a86a3a" });
/** someone walking along (dx, dz): side view when the lens sees them from the side, front otherwise */
const walker = (cam: CamInfo, t: number, i: number, o: Outfit, okey: string, x: number, z: number, dx: number, dz: number, expr: Expr, out: Stage, sc = 1) => {
  const y = groundY(x, z), v = viewOf(cam, x, z, dx, dz), ph = (t * 1.0 + hh(i, 4)) % 1;
  const pl = person(cam, { i, o, okey }, x, y, z, v, { blink: lidAt(NOW, i), expr, mode: "march", phase: ph }, { blink: lidAt(NOW, i), expr, mode: "march", phase: ph, stride: 0.75 * Math.max(0.3, v.fs) }, sc);
  out.places.push(pl); blob(out, x, y, z, sc);
};
const stander = (cam: CamInfo, i: number, o: Outfit, okey: string, x: number, z: number, fo: FrontOpts, out: Stage, sc = 1) => front(cam, i, o, okey, x, groundY(x, z), z, fo, sc, true, out);
const sideStand = (cam: CamInfo, i: number, o: Outfit, okey: string, x: number, z: number, dx: number, expr: Expr, out: Stage) => {
  const y = groundY(x, z), v = viewOf(cam, x, z, dx, 0);
  out.places.push(person(cam, { i, o, okey }, x, y, z, { side: true, mirror: v.mirror }, {}, { blink: lidAt(NOW, i), expr, mode: "stand" }));
  blob(out, x, y, z);
};
const ELEPH = 2.7;
const eleph = (cam: CamInfo, t: number, i: number, x: number, z: number, dx: number, dz: number, mood: "calm" | "stubborn" | "happy" | "shock", out: Stage, snow = 0) => {
  const y = groundY(x, z), v = viewOf(cam, x, z, dx, dz), d = cam.pos.distanceTo(tmp.set(x, y + 2, z)) / ELEPH, [w, h, k] = tier(d);
  const ph = Math.round(((t * 0.8 + hh(i, 2)) % 1) * 12) / 12;
  out.places.push({ key: `el|${ph}|${mood}|${snow > 0 ? 1 : 0}`, draw: (p) => elephant(p, ph, mood, snow), x, y, z, scale: ELEPH, mirror: v.mirror, size: [w, h, k] });
  blob(out, x, y, z, ELEPH * 1.2);
};
/** the column on the ledge: n slots, head at headX at time t0 */
const column = (cam: CamInfo, t: number, out: Stage, headX: number, t0: number, n: number, skip: (x: number) => boolean = () => false, expr: Expr = "neutral") => {
  for (let i = 0; i < n; i++) {
    const x = columnX(t - t0, headX, i);
    if (skip(x)) continue;
    const dzdx = (pathZ(x + 1) - pathZ(x - 1)) / 2;
    if (isEleph(i)) { eleph(cam, t, i, x, pathZ(x) - 0.3, 1, dzdx, "calm", out, SNOWY); continue; }
    const z = pathZ(x) + (i % 2 ? -0.95 : 0.95);
    walker(cam, t, i, i === 0 ? HANNIBAL : ARMY[vOf(i) + (i % 2) * 2], i === 0 ? "han" : `a${vOf(i) + (i % 2) * 2}`, x, z, 1, dzdx, expr, out);
  }
};
/** the column on the zigzag: slot i at u = head - i * du */
const zigColumn = (cam: CamInfo, t: number, out: Stage, head: number, n: number, hanAt = 1) => {
  for (let i = 0; i < n; i++) {
    const u = head - i * 0.0085;
    if (u < 0.002) continue;
    const p0 = zigPoint(u), p1 = zigPoint(Math.min(1, u + 0.002)), dx = p1[0] - p0[0], dz = p1[2] - p0[2];
    if (isEleph(i)) { eleph(cam, t, i, p0[0], p0[2], dx, dz, "happy", out, SNOWY); continue; }
    const o = i === hanAt ? HANNIBAL : ARMY[vOf(i)];
    walker(cam, t, i, o, i === hanAt ? "han" : `a${vOf(i)}`, p0[0], p0[2], dx, dz, i === hanAt ? "grin" : "neutral", out);
  }
};
let SNOWY = 0;
const flames = (t: number, out: Stage, k: number) => {
  const spots: [number, number, number, number][] = [[-3.9, 0.1, -1.8, 1.7], [-3.8, 0.1, 0, 2.1], [-3.9, 0.1, 1.8, 1.7], [-3.1, 1.2, -1.0, 1.6], [-3.0, 1.3, 0.9, 1.6],
    [-2.6, 2.2, 0, 1.4], [-4.4, 0.0, 0.9, 1.3], [-4.4, 0.0, -0.9, 1.3]];
  spots.forEach(([dx, dy, dz, h], i) => flameCard(out, t, ROCK[0] + dx, ROCK[1] + dy, ROCK[2] + dz, h * Math.max(1, k), i, clamp01(k * 1.6 - i * 0.07)));
};

// ---------------- crowd by shot ----------------
const hookPour = (t: number, cam: CamInfo, out: Stage) => {
  flames(t, out, 0.8);
  for (let i = 0; i < 3; i++) {
    const x = ROCK[0] - 6.5 + i * 0.4, z = ROCK[2] - 2.6 + i * 2.6;
    stander(cam, 600 + i, ARMY[i * 2], `a${i * 2}`, x, z, { expr: i === 1 ? "grin" : "stern", prop: "jarPour", facing: 1 }, out);
    out.fx.push({ key: "vin", cw: 512, ch: 512, draw: vinegarStream, x: x + 1.4, y: groundY(x, z) + 1.5, z: z - 0.3, w: 1.8, h: 1.8 });
  }
  steamCard(out, t, ROCK[0] - 2.5, ROCK[1] + 3, ROCK[2], 6, 1, 2.6);
};
const hannibalHook = (t: number, cam: CamInfo, out: Stage) => {
  stander(cam, 601, HANNIBAL, "han", ROCK[0] - 9.2, ROCK[2] + 2.6, { expr: t > W.vinegar1 - LEADT ? "grin" : "smile" as Expr, prop: t > W.vinegar1 - LEADT ? "point" : null, facing: 1 }, out);
};
const doubters = (t: number, cam: CamInfo, out: Stage) => {
  const e1: Expr = t < W.q_alps - LEADT ? "shock" : t < W.q_snow - LEADT ? "nervous" : "dazed";
  const e2: Expr = t < W.q_alps - LEADT ? "nervous" : t < W.q_snow - LEADT ? "shock" : "shock";
  stander(cam, 610, ARMY[1], "a1", -120.6, pathZ(-120.6) + 0.9, { expr: e1, facing: 1, prop: t > W.q_snow - LEADT ? "shrug" : "spear" }, out);
  stander(cam, 611, ARMY[2], "a2", -119.1, pathZ(-119.1) + 1.25, { expr: e2, facing: -1, look: -1, prop: t > W.q_alps - LEADT ? "point" : null }, out);
};
const tribes = (t: number, cam: CamInfo, out: Stage) => {
  for (let i = 0; i < 4; i++) {
    const x = -301 + i * 2.6, z = pathZ(x) - 13 - (i % 2) * 1.5;
    stander(cam, 620 + i, TRIBE(i), `tr${i}`, x, z, { expr: t > W.ambushes - LEADT ? "grin" : "stern", prop: "armsUp", facing: 1 }, out);
  }
  for (let k = 0; k < 6; k++) {
    const t0 = W.ambushes + 0.2 + k * 0.28, u = (t - t0) / 1.1;
    if (u < 0 || u > 1) continue;
    const x0 = -300 + k * 1.3, z0 = pathZ(x0) - 12.5, x1 = -296 + k * 1.8, z1 = pathZ(x1) + 1;
    const x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u, y = groundY(x0, z0) + (groundY(x1, z1) - groundY(x0, z0)) * u + 1.2 * Math.abs(Math.sin(u * Math.PI * 3)) + 0.4;
    out.fx.push({ key: "rockbit", cw: 256, ch: 256, draw: rockBit, x, y, z, w: 0.9, h: 0.9, rot: u * 9 + k });
  }
};
const summit = (t: number, cam: CamInfo, out: Stage) => {
  const sx = SUMMIT[0], snowing = t > W.snow1 - LEADT;
  stander(cam, 630, HANNIBAL, "han", sx, pathZ(sx) + 0.8, { expr: snowing ? "dazed" : "laugh", prop: snowing ? null : "armsUp", look: snowing ? 0 : 0 }, out);
  for (let i = 0; i < 9; i++) {
    const x = sx - 2.6 - (i % 5) * 1.3 + (i > 4 ? 0.6 : 0), z = pathZ(sx) + 2.6 - (i % 5) * 1.25 - (i > 4 ? 1.6 : 0);
    stander(cam, 631 + i, ARMY[i % 6], `a${i % 6}`, x, z, { expr: snowing ? (["nervous", "dazed", "shock"] as Expr[])[i % 3] : (["laugh", "grin", "laugh"] as Expr[])[i % 3],
      prop: snowing ? null : i % 2 ? "armsUp" : "spear", facing: (i % 3 - 1) as -1 | 0 | 1 }, out);
  }
  eleph(cam, t, 640, sx - 9, pathZ(sx) - 2.5, 1, 0, snowing ? "shock" : "happy", out, snowing ? 1 : 0);
};
const edge = (t: number, cam: CamInfo, out: Stage) => {
  const ended = t > W.ends - LEADT;
  sideStand(cam, 650, HANNIBAL, "han", 14.4, pathZ(14.4) + 0.4, 1, ended ? "shock" : "neutral", out);
  for (let i = 0; i < 4; i++) sideStand(cam, 651 + i, ARMY[i + 1], `a${i + 1}`, 13.2 - i * 1.2, pathZ(10) + (i % 2 ? -1.1 : 1.0), 1, ended ? (i % 2 ? "shock" : "nervous") : "neutral", out);
  eleph(cam, t, 655, 2, pathZ(2) - 0.4, 1, 0, ended ? "shock" : "calm", out, 1);
};
const hungry = (t: number, cam: CamInfo, out: Stage) => {
  const k = clamp01((t - W.slip + 0.2) / 0.4), wob = Math.sin(t * 9) * 0.06 * k;
  const hx = 8, hz = pathZ(8) + 2.4, hy = groundY(hx, hz), v = viewOf(cam, hx, hz, 1, 0);
  const d = cam.pos.distanceTo(tmp.set(hx, hy + 1.2, hz)) / 2.0, [w, h, kk] = tier(d);
  out.places.push({ key: `horse${Math.round(k * 4)}`, draw: (p) => horse(p, Math.round(k * 4) / 4), x: hx, y: hy, z: hz, scale: 2.0, mirror: v.mirror, roll: wob, size: [w, h, kk] });
  blob(out, hx, hy, hz, 2.4);
  eleph(cam, t, 661, 3.5, pathZ(3.5) + 0.4, 1, 0, t > W.budge - LEADT ? "stubborn" : "calm", out, 1);
  // a soldier pulls on the elephant, another eats a handful of snow
  stander(cam, 662, ARMY[3], "a3", 1.2, pathZ(1.2) + 2.0, { expr: t > W.budge - LEADT ? "shock" : "stern", prop: "point", facing: 1 }, out);
  const ex = 10.6, ez = pathZ(10.6) - 1.5, eating = t > W.eat - LEADT;
  stander(cam, 663, ARMY[0], "a0", ex, ez, { expr: eating ? "grin" : "nervous", facing: -1 }, out);
  if (eating) out.fx.push({ key: "snowball", cw: 128, ch: 128, draw: snowball, x: ex + 0.02, y: groundY(ex, ez) + 1.42, z: ez + 0.3, w: 0.16, h: 0.16 });
};
const torch = (t: number, cam: CamInfo, out: Stage) => {
  stander(cam, 670, HANNIBAL, "han", 12.6, pathZ(12.6) + 1.4, { expr: t < W.sets - LEADT ? "stern" : "grin", prop: t > W.sets - LEADT ? "point" : null, facing: 0 }, out);
  if (t > W.fire1 - 0.45) flames(t, out, 0.4);
};
const blaze = (t: number, cam: CamInfo, out: Stage, S: Scene) => {
  flames(t, out, S.fire * 1.3);
  for (let i = 0; i < 4; i++) stander(cam, 680 + i, i === 1 ? HANNIBAL : ARMY[i], i === 1 ? "han" : `a${i}`, 7 + i * 1.5, pathZ(7) + 1.2 + (i % 2) * 1.2, { expr: i === 1 ? "grin" : "shock", prop: i === 2 ? "armsUp" : null, facing: 1 }, out);
};
const chop = (t: number, cam: CamInfo, out: Stage) => {
  for (let i = 0; i < 3; i++) {
    const x = GROVE - 2.4 + i * 2.2, z = pathZ(x) - 3.4 - (i % 2) * 0.5, k = 0.5 - 0.5 * Math.cos(Math.PI * 2 * ((t * 1.8 + i * 0.37) % 1));
    stander(cam, 690 + i, ARMY[i + 2], `a${i + 2}`, x, z, { expr: "stern", prop: ["axe", Math.round(k * 6) / 6] as Prop, facing: (i - 1) as -1 | 0 | 1 }, out);
    if (k > 0.85) out.fx.push({ key: "chips", cw: 256, ch: 256, draw: chips, x: x + 0.7, y: groundY(x, z) + 1.0, z: z - 0.4, w: 0.7, h: 0.7 });
  }
  if (t > W.trees + 0.5 && t < W.trees + 0.9) crackPop(out, t, W.trees + 0.5, GROVE + 3, groundY(GROVE + 3, pathZ(GROVE) - 2) + 0.6, pathZ(GROVE) - 1, 3);
};
const stack = (t: number, cam: CamInfo, out: Stage, S: Scene) => {
  flames(t, out, S.fire);
  stander(cam, 700, ARMY[4], "a4", 13.6, pathZ(13.6) + 3.4, { expr: t > W.glows - LEADT ? "shock" : "grin", prop: t < W.burn ? "armsUp" : null, facing: 1 }, out);
  stander(cam, 701, ARMY[1], "a1", 14.6, pathZ(14.6) + 1.6, { expr: t > W.glows - LEADT ? "shock" : "stern", facing: 1 }, out);
};
const pour = (t: number, cam: CamInfo, out: Stage, S: Scene) => {
  flames(t, out, S.fire);
  for (let i = 0; i < 4; i++) {
    const x = ROCK[0] - 7.2 + (i % 2) * 0.5, z = ROCK[2] - 2.4 + i * 1.6, pouring = t > W.pour - LEADT + i * 0.08;
    stander(cam, 710 + i, ARMY[i + 1], `a${i + 1}`, x, z, { expr: pouring ? (i % 2 ? "grin" : "stern") : "neutral", prop: pouring ? "jarPour" : "jarLow", facing: 1 }, out);
    if (pouring) out.fx.push({ key: "vin", cw: 512, ch: 512, draw: vinegarStream, x: x + 1.4, y: groundY(x, z) + 1.5, z: z - 0.3, w: 1.8, h: 1.8 });
  }
  if (S.steam > 0) steamCard(out, t, ROCK[0] - 3, ROCK[1] + 2.5, ROCK[2], 7, S.steam, 2.8);
};
const livy = (t: number, cam: CamInfo, out: Stage) => {
  const [kx, ky, kz] = KIT, sw = t > W.swears - LEADT;
  front(cam, 720, LIVY, "livy", kx - 0.25, ky, kz - 2.1, { expr: sw ? "grin" : "stern", prop: sw ? "point" : null, facing: 0 }, 1, true, out);
  out.fx.push({ key: "scroll", cw: 512, ch: 256, draw: scroll, x: kx + 0.05, y: ky + 0.99, z: kz - 0.8, w: 0.9, h: 0.45, flat: true, rot: 0.1 });
};
const puzzled = (t: number, cam: CamInfo, out: Stage) => {
  stander(cam, 730, ARMY[2], "a2", 13.0, pathZ(13) + 1.6, { expr: "dazed", prop: "shrug", facing: -1 }, out);
  stander(cam, 731, HANNIBAL, "han", 14.4, pathZ(14.4) + 0.6, { expr: t > W.mountain - LEADT ? "smile" as Expr : "stern", facing: -1, look: -1 }, out);
  steamCard(out, t, ROCK[0] - 2, ROCK[1] + 3, ROCK[2], 5, 0.8, 2.4);
};
const explain = (t: number, cam: CamInfo, out: Stage, S: Scene) => {
  const u = (t - W.splash + LEADT) / 0.5;
  if (u > 0 && u < 1) { const k = Math.round(u * 8) / 8; out.fx.push({ key: "splash", cw: 512, ch: 512, draw: splashArc, x: ROCK[0] - 4 + k * 2, y: ROCK[1] + 2.5 + k, z: ROCK[2] + 3 - k * 2, w: 4, h: 4 }); }
  if (S.steam > 0) steamCard(out, t, ROCK[0] - 1, ROCK[1] + 4, ROCK[2] + 1, 6, S.steam, 2.4);
};
const kitchen = (t: number, cam: CamInfo, out: Stage) => {
  const [kx, ky, kz] = KIT;
  const pourT = W.cold2 - 0.25, give = W.dish - 0.05;
  const pouring = t > pourT - LEADT, cracked = t > give - 0.3, split = clamp01((t - give) / 0.25);
  front(cam, 740, CRAFTS[3], "c3", kx - 0.75, ky, kz - 1.7, { expr: split > 0 ? "shock" : pouring ? "grin" : "neutral", prop: pouring ? "bucketPour" : "bucketLow", facing: 0 }, 1, true, out);
  const hot = pouring ? 1 - 0.3 * clamp01((t - pourT) / 1) : 1;
  out.fx.push({ key: `dish${q(hot, 10)}_${cracked ? 1 : 0}_${q(split, 10)}`, cw: 600, ch: 600, draw: (p) => dish(p, hot, cracked ? 1 : 0, split), x: kx + 0.15, y: ky + 1.25, z: kz - 0.75, w: 1.3, h: 1.3, hdr: 1.0 });
  if (pouring && split <= 0) out.fx.push({ key: "stream", cw: 512, ch: 512, draw: stream, x: kx - 0.25, y: ky + 1.75, z: kz - 0.7, w: 0.5, h: 1.0 });
  if (pouring) steamCard(out, t, kx + 0.15, ky + 1.0, kz - 0.9, 4, clamp01((t - pourT) / 0.4), 0.22);
  crackPop(out, t, give, kx + 0.15, ky + 1.3, kz - 0.6, 1.2);
};
const split = (t: number, cam: CamInfo, out: Stage) => {
  const done = t > W.cracks - LEADT;
  stander(cam, 750, HANNIBAL, "han", 13.0, pathZ(13) + 4.4, { expr: done ? "laugh" : "nervous", prop: done ? "armsUp" : null, facing: 1 }, out);
  stander(cam, 751, ARMY[0], "a0", 14.6, pathZ(14.6) + 2.4, { expr: done ? "laugh" : "nervous", prop: done ? "armsUp" : "jarLow", facing: 1 }, out);
  crackPop(out, t, W.cracks - LEADT, ROCK[0] - 1, ROCK[1] + 3, ROCK[2] + 1.5, 5);
};
const finale = (t: number, cam: CamInfo, out: Stage) => {
  const p = zigPoint(0.1);
  eleph(cam, t, 760, p[0], p[2], 1, 0.4, t > W.insnow - LEADT ? "happy" : "calm", out, 1);
  const h = zigPoint(0.125);
  stander(cam, 761, HANNIBAL, "han", h[0], h[2], { expr: "grin", prop: t > W.insnow - LEADT ? "armsUp" : null, facing: 1 }, out);
};

/** everything with a face, flames, water and steam in shot `id` at time t */
export const stage = (id: number, t: number, S: Scene, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light; NOW = t; SNOWY = S.snow > 0.5 ? 1 : 0;
  findSun(cam, SUN);
  const c = s.crowd, a = s.a / FPS;
  if (c.includes("hookPour")) hookPour(t, cam, out);
  if (c.includes("hannibalHook")) hannibalHook(t, cam, out);
  if (id === 2 && c.includes("column")) column(cam, t, out, -70, a, 70);
  if (id === 3) column(cam, t, out, C3X + 10.8, W.elephants1, 26);
  if (id === 4) { column(cam, t, out, -112, a, 18, (x) => Math.abs(x + 120) < 4); eleph(cam, t, 612, -128 + 1.15 * (t - a), pathZ(-128) - 1.6, 1, 0, "calm", out); }
  if (id === 5) column(cam, t, out, -282, a, 22, () => false, t > W.wind - LEADT ? "nervous" : "neutral");
  if (c.includes("tribes")) tribes(t, cam, out);
  if (c.includes("doubters")) doubters(t, cam, out);
  if (c.includes("summit")) summit(t, cam, out);
  if (c.includes("edge")) edge(t, cam, out);
  if (c.includes("hungry")) hungry(t, cam, out);
  if (c.includes("torch")) torch(t, cam, out);
  if (c.includes("blaze")) blaze(t, cam, out, S);
  if (c.includes("chop")) chop(t, cam, out);
  if (c.includes("stack")) stack(t, cam, out, S);
  if (c.includes("pour")) pour(t, cam, out, S);
  if (c.includes("livy")) livy(t, cam, out);
  if (c.includes("puzzled")) puzzled(t, cam, out);
  if (c.includes("explain")) explain(t, cam, out, S);
  if (c.includes("kitchen")) kitchen(t, cam, out);
  if (c.includes("split")) split(t, cam, out);
  if (id === 19) zigColumn(cam, t, out, lin([[W.zigzag, 0.02], [W.four, 0.08]], t), 10);
  if (id === 20) zigColumn(cam, t, out, 0.34 + (t - W.four) * 0.0035, 12, 4);
  if (c.includes("finale")) finale(t, cam, out);
  return out;
};
void FOLK; void SWAPS; void LEAD; void smooth; void INK; void P; void RK; void bodyFront; void bodySide;
export { FPS };
