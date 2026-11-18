// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, craftsman, fxBurst, fxShadow, fxContact, INK,
  Outfit, Expr, FrontOpts, SideOpts, Prop,
} from "./toon";
import { FPS, SHOTS, V3, smooth, clamp01, W, L as LEADT, Scene, lin, SPOT } from "./story";
import { COURT, PARTY, LANE, CHURCH, FIELD } from "./medieval";
import { RMS } from "./rms";
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
const FOLKM = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
const FARM = [0, 1, 2, 3].map((v) => craftsman(v));
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

// ---------------- people ----------------
const LAWYER: Outfit = { jacket: "#3f4a78", pants: "#2a2630", boots: "#1e1a22", dress: "#3f4a78", hat: "cap", cap: "#a8302e", skin: "#f5c9a0", buttons: "#e8c45a", sash: "#a8302e" };
const JUDGE: Outfit = { jacket: "#a8302e", pants: "#5a2028", boots: "#2a1c22", dress: "#a8302e", hat: "cap", cap: "#f4f1ea", skin: "#ffe2c2", moustache: "#e8e2d6", build: "stout", buttons: "#f2c443" };
const PRIEST = (v: number): Outfit => ({ jacket: "#1e1c26", pants: "#1e1c26", boots: "#1e1a22", dress: "#1e1c26", hat: "hair", hair: ["#8a8a92", "#5a3b2a", "#2a201a"][v % 3], skin: ["#ffe2c2", "#f5c9a0", "#ecd0b6"][v % 3], buttons: "#f4f1ea" });
const CRIER: Outfit = { jacket: "#3f6fb5", pants: "#e8c45a", boots: "#2a1c22", hat: "cavalier", cap: "#2e2a36", hair: "#f2c443", skin: "#f5c9a0", buttons: "#f2c443", moustache: "#4a3426" };
const ENEMY: Outfit = { jacket: "#4a3a5a", pants: "#2a2a3a", boots: "#1e1a22", hat: "hair", hair: "#2a201a", skin: "#f5c9a0", moustache: "#2a201a", build: "stout" };
const GUEST: Outfit = { jacket: "#e08a3c", pants: "#3b4a6a", boots: "#4a3426", hat: "hair", hair: "#c98a4a", skin: "#ffe2c2" };

// ---------------- life: idle motion, swap hits, mouth flaps ----------------
/** expression by beat words; also returns the time since the last swap (for the swap "hit") */
const beatT = (t: number, steps: [number, Expr][]): [Expr, number] => { let e = steps[0][1], since = 99; for (const [t0, x] of steps) if (t >= t0 - LEADT) { e = x; since = t - (t0 - LEADT); } return [e, since]; };
/** mouth flap 0/1/2 from the voice level, changing every 2 frames, only inside [a, b) */
const talkAt = (t: number, a: number, b: number) => {
  if (t < a || t >= b) return 0;
  const f = Math.floor(t * FPS / 2) * 2, r = RMS[Math.min(RMS.length - 1, f)] ?? 0;
  return r < 0.04 ? 0 : r < 0.12 ? 1 : 2;
};
type Life = { steps: [number, Expr][]; talk?: [number, number]; prop?: Prop | ((t: number) => Prop); facing?: -1 | 0 | 1; look?: number; knee?: number; stance?: number; calm?: number };
/** a standing character that is alive every frame: breathing bob, head drift, weight shifts, a 4-frame hit on every
 *  expression swap, mouth flaps on its lines (reference: animated on 1s, swaps hidden by moving heads) */
const actor = (cam: CamInfo, t: number, i: number, o: Outfit, okey: string, x: number, y: number, z: number, L: Life, out: Stage, sc = 1) => {
  const s = hh(i, 3) * 6.28, k = 1 - (L.calm ?? 0);
  const [expr, since] = beatT(t, L.steps), hit = Math.exp(-since * 12);
  const headTilt = k * (2.6 * Math.sin(t * 1.9 + s) + 1.3 * Math.sin(t * 3.3 + 2 * s)) + 7 * hit * Math.sin(since * 30);
  const tilt = k * (1.4 * Math.sin(t * 0.9 + s)) - 4 * hit;
  const shift = k * Math.sin(t * 0.45 + s) * 0.9;
  const prop = typeof L.prop === "function" ? L.prop(t) : L.prop ?? null;
  const fo: FrontOpts = { expr, facing: L.facing ?? 0, look: L.look ?? 0, prop, headTilt, tilt, shift, knee: (L.knee ?? 0) + 0.15 * hit, stance: L.stance ?? (0.9 + 0.3 * hh(i, 5)),
    talk: L.talk ? talkAt(t, L.talk[0], L.talk[1]) : 0 };
  front(cam, i, o, okey, x, y, z, fo, sc * (1 + 0.035 * hit + 0.008 * Math.sin(t * 2.4 + s)), true, out);
};

// ---------------- animals ----------------
/** side-view rat facing right (design space 600 x 1000, feet at 975): walk phase, mood */
const rat = (p: Pen, ph: number, mood: "smug" | "shock" | "happy" | "sly") => {
  const G = "#8a8492", D = "#6a6474", two = Math.PI * 2;
  const leg = (x: number, o: number, c: string) => { const sw = Math.sin(two * (ph + o)) * 22; p.line([[x, 900], [x + sw, 968]], c, 16); };
  leg(250, 0.5, D); leg(380, 0, D);
  p.line([[150, 880], [80, 860], [40, 900], [20, 960]], "#e8a0a8", 10); // tail
  const body: [number, number][] = []; for (let i = 0; i <= 36; i++) { const a = (i / 36) * two; body.push([300 + 160 * Math.cos(a), 870 + 82 * Math.sin(a)]); }
  p.gradFill(body, G, D, -Math.PI / 2, 0.3); p.poly(body, null, 9);
  leg(220, 0, G); leg(350, 0.5, G);
  p.poly([[420, 820], [540, 860], [560, 880], [470, 925], [400, 910]], G, 9); // snout
  p.dot(560, 878, 11, "#e86e78");
  p.ell(420, 790, 42, 46, "#b8aab8", 8); p.ell(422, 794, 24, 28, "#e8a0a8", 0); // ear
  for (const dy of [-6, 6]) p.stroke([[540, 875 + dy], [590, 868 + dy * 2]], 2.5, "#2a2230");
  if (mood === "shock") { p.ell(480, 845, 15, 17, "#ffffff", 5); p.dot(484, 847, 7); }
  else if (mood === "happy") p.arc(482, 850, 12, 8, 200, 340, 6);
  else { p.dot(484, 846, 7); p.stroke([[466, 828], [500, 836]], 6); }
  if (mood === "smug" || mood === "sly") p.arc(520, 902, 22, 10, 20, 150, 5);
};
/** a sitting cat, front view, glowing eyes at night */
const cat = (p: Pen, col: string, glow: boolean, blink: number) => {
  p.ell(300, 880, 120, 100, col, 9); p.ell(300, 760, 92, 82, col, 9);
  p.poly([[226, 720], [240, 640], [282, 700]], col, 8); p.poly([[374, 720], [360, 640], [318, 700]], col, 8);
  p.line([[410, 940], [480, 900], [470, 820]], col, 18);
  for (const s of [-1, 1]) {
    if (blink > 0.5) p.stroke([[300 + s * 34 - 14, 752], [300 + s * 34 + 14, 752]], 6);
    else { p.ell(300 + s * 34, 750, 18, 20, glow ? "#f6f05a" : "#f2e8a0", 5); p.ell(300 + s * 34, 750, 5, 14, "#1a1a1a", 0); }
  }
  p.poly([[290, 782], [310, 782], [300, 794]], "#e86e78", 3);
  for (const s of [-1, 1]) for (const dy of [-6, 6]) p.stroke([[300 + s * 20, 795 + dy], [300 + s * 80, 788 + dy * 2]], 2.5, "#2a2230");
};
const ratCard = (cam: CamInfo, t: number, i: number, x: number, y: number, z: number, dx: number, mood: "smug" | "shock" | "happy" | "sly", out: Stage, walking = true, sc = 0.42) => {
  const ph = walking ? Math.round(((t * 2.4 + hh(i, 2)) % 1) * 8) / 8 : 0;
  const v = viewOf(cam, x, z, dx, 0), d = cam.pos.distanceTo(tmp.set(x, y + 0.3, z)) / sc, [w, h, k] = tier(d);
  const bob = walking ? 0.02 * Math.abs(Math.sin(t * 15 + i)) : 0.01 * Math.sin(t * 3 + i);
  out.places.push({ key: `rat|${ph}|${mood}`, draw: (p) => rat(p, ph, mood), x, y: y + bob, z, scale: sc, mirror: v.mirror, size: [w, h, k] });
  blob(out, x, y, z, sc * 1.6);
};
const catCard = (cam: CamInfo, t: number, i: number, x: number, y: number, z: number, col: string, glow: boolean, out: Stage, sc = 0.5) => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 0.4, z)) / sc, [w, h, k] = tier(d), bl = lidAt(t, i);
  out.places.push({ key: `cat|${col}|${glow ? 1 : 0}|${bl > 0.5 ? 1 : 0}`, draw: (p) => cat(p, col, glow, bl), x, y, z, scale: sc, size: [w, h, k] });
};
const paper = (p: Pen) => { p.poly([[30, 40], [220, 30], [226, 230], [36, 236]], "#f1e2bd", 6); for (const y of [80, 110, 140, 170]) p.stroke([[60, y], [190, y - 3]], 4, "#8a7a6a"); p.ell(170, 205, 22, 22, "#a8302e", 4); };
const card = (out: Stage, key: string, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h = w, rot = 0, soft = false) =>
  out.fx.push({ key, cw: 256, ch: 256, draw, x, y, z, w, h, rot, soft });
const drop = (p: Pen) => { p.poly([[32, 4], [52, 40], [32, 60], [12, 40]], "#9fd6f6", 4); };
const CATCOL = ["#e8a050", "#3a3a42", "#f4f1ea", "#8a8492", "#c98a4a"];
const RATS = 7;

// ---------------- crowd by shot ----------------
const [CX, CY, CZ] = COURT;
const DOCK: V3 = [CX + 4.5, CY, CZ - 4.1];
const ratsInDock = (cam: CamInfo, t: number, out: Stage, mood: "smug" | "shock" | "happy" | "sly") => {
  for (let i = 0; i < RATS; i++) ratCard(cam, t, 700 + i, DOCK[0] - 1.1 + (i % 4) * 0.72, CY + 0.25, DOCK[2] - 0.6 + (i > 3 ? 0.8 : 0) + (i % 2) * 0.15, -1, mood, out, false, 0.42);
};
const hook = (t: number, cam: CamInfo, out: Stage) => {
  actor(cam, t, 800, LAWYER, "law", CX + 1.9, CY, CZ - 3.2, { steps: [[0, "grin"], [W.clients, "smile"], [W.never, "laugh"]], prop: (tt) => tt > W.never - LEADT ? "armsUp" : "point", facing: 1 }, out);
  ratsInDock(cam, t, out, t > W.never - LEADT ? "happy" : "smug");
  actor(cam, t, 801, JUDGE, "judge", CX, CY + 0.8, CZ - 9.6, { steps: [[0, "stern"], [W.never, "shock"]], calm: 0.5 }, out);
};
const field = (t: number, cam: CamInfo, out: Stage, eaten: boolean) => {
  const [fx, , fz] = FIELD;
  if (eaten) {
    for (let i = 0; i < 9; i++) ratCard(cam, t, 710 + i, fx - 3.2 + (i % 5) * 1.5 + Math.sin(t * 2 + i) * 0.3, 0, fz + 5.2 + Math.floor(i / 5) * 1.1, i % 2 ? 1 : -1, i % 3 ? "smug" : "happy", out, true, 0.45);
    actor(cam, t, 820, FARM[0], "fa0", fx - 1.3, 0, fz + 2.2, { steps: [[W.eaten, "shock"], [W.barley, "pained"]], prop: "armsUp", facing: 1 }, out);
    actor(cam, t, 821, FARM[1], "fa1", fx + 1.3, 0, fz + 2.6, { steps: [[W.eaten, "nervous"], [W.barley, "shock"]], prop: "point", facing: -1 }, out);
  } else {
    actor(cam, t, 822, FARM[2], "fa2", fx - 1.0, 0, fz + 18, { steps: [[0, "grin"], [W.autun, "smile_closed"]], facing: 1 }, out);
  }
};
const courtWide = (t: number, cam: CamInfo, out: Stage, phase: "trial" | "empty" | "plea" | "explain" | "stopped") => {
  const judgeE: [number, Expr][] = phase === "trial" ? [[0, "stern"], [W.judge, "smile"]] : phase === "empty" ? [[0, "stern"], [W.dont, "nervous"], [W.big, "dazed"]]
    : phase === "plea" ? [[0, "dazed"], [W.villages, "nervous"]] : phase === "explain" ? [[0, "nervous"], [W.killed, "shock"]] : [[0, "dazed"], [W.stopped, "pained"]];
  actor(cam, t, 830, JUDGE, "judge", CX, CY + 0.8, CZ - 9.6, { steps: judgeE, prop: phase === "stopped" ? "shrug" : null }, out);
  actor(cam, t, 831, LAWYER, "law", CX + 1.9, CY, CZ - 3.2, {
    steps: phase === "plea" ? [[0, "smile"], [W.my, "grin"], [W.one, "smile"]] : phase === "explain" ? [[0, "grin"], [W.killed, "stern"]] : phase === "stopped" ? [[0, "smile"], [W.stopped, "laugh"]] : [[0, "neutral"], [W.reallawyer, "grin"]],
    talk: phase === "plea" ? [W.my, W.so3 - 0.15] : undefined, prop: phase === "plea" || phase === "explain" ? "point" : null, facing: 1 }, out);
  if (phase !== "empty") ratsInDock(cam, t, out, phase === "stopped" ? "happy" : "sly");
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
    const i = r * 4 + k, x = CX + (k < 2 ? -6.4 + k * 2.2 : 3.0 + (k - 2) * 2.2), z = CZ + 4.0 + r * 2.2;
    actor(cam, t, 840 + i, FOLKM[i % 6], `fm${i % 6}`, x, CY, z, { steps: [[0, "neutral"], [phase === "empty" ? W.dont : W.realcourt, (["shock", "laugh", "dazed", "grin"] as Expr[])[i % 4]]], facing: (k < 2 ? 1 : -1), calm: 0.3 }, out, 0.95);
  }
  if (phase === "empty") actor(cam, t, 860, CRIER, "crier", CX + 2.2, CY, CZ - 6.2, { steps: [[0, "stern"], [W.dont, "nervous"]], prop: (tt) => (tt < W.dont ? "point" : "shrug") }, out);
};
const doubters = (t: number, cam: CamInfo, out: Stage) => {
  actor(cam, t, 870, FOLKM[1], "fm1", CX - 0.9, CY, CZ + 2.0, { steps: [[W.qrats, "shock"], [W.qcourt, "dazed"]], talk: [W.qrats, W.qcourt], prop: "point", facing: 1 }, out);
  actor(cam, t, 871, FOLKM[2], "fm2", CX + 0.9, CY, CZ + 1.6, { steps: [[W.qrats, "nervous"], [W.qcourt, "shock"]], talk: [W.qcourt, W.their], facing: -1 }, out);
};
const hero = (t: number, cam: CamInfo, out: Stage) => {
  actor(cam, t, 880, LAWYER, "law", CX + 1.9, CY, CZ - 3.2, { steps: [[W.their, "smile"], [W.job, "stern"], [W.defend, "grin"]], prop: (tt) => (tt > W.defend - LEADT ? "point" : null), facing: 1 }, out);
  ratsInDock(cam, t, out, "sly");
};
const priests = (t: number, cam: CamInfo, out: Stage) => {
  const [cx, , cz] = CHURCH;
  for (let i = 0; i < 3; i++) actor(cam, t, 890 + i, PRIEST(i), `pr${i}`, cx - 2.2 + i * 2.2, 0.66, cz + 1.2, { steps: [[W.so3, "stern"], [W.still, i % 2 ? "dazed" : "nervous"]], talk: [W.so3, W.still - 0.1], prop: (tt) => (tt < W.still ? "scroll" : "shrug") }, out);
  for (let i = 0; i < 6; i++) actor(cam, t, 893 + i, FOLKM[(i + 2) % 6], `fm${(i + 2) % 6}`, cx - 5 + i * 2, 0, cz + 6 + (i % 2) * 1.2, { steps: [[W.so3, "neutral"], [W.still, "laugh"]], facing: (i % 3 - 1) as -1 | 0 | 1, calm: 0.4 }, out, 0.95);
  for (let i = 0; i < 3; i++) ratCard(cam, t, 720 + i, -11.4 + i * 0.5, 0, 7.8 + i * 0.3, 1, t > W.still - LEADT ? "smug" : "sly", out, false, 0.36);
};
const ponder = (t: number, cam: CamInfo, out: Stage) => {
  actor(cam, t, 900, LAWYER, "law", 1.5, 0, 6.5, { steps: [[W.sohow, "dazed"], [W.sohow + 0.8, "smile"]], facing: 0, look: -1 }, out);
  for (let k = 0; k < 3; k++) { const u = ((t * 1.6 + k * 0.33) % 1); card(out, "drop", drop, 1.5 + (k - 1) * 0.3, 2.3 - u * 0.4, 6.7, 0.1, 0.13); }
};
const lane = (t: number, cam: CamInfo, out: Stage) => {
  for (let i = 0; i < 12; i++) {
    const x = LANE[0] - 4 + i * 4.2, s = i % 2 ? 1 : -1;
    catCard(cam, t, 910 + i, x, 1.4, LANE[2] + s * 5.0, CATCOL[i % 5], true, out, 0.55);
  }
  for (let i = 0; i < 3; i++) ratCard(cam, t, 730 + i, LANE[0] - 8 + i * 0.6, 0, LANE[2] + (i - 1) * 0.5, 1, t > W.cats - LEADT ? "shock" : "sly", out, false, 0.42);
  actor(cam, t, 925, LAWYER, "law", LANE[0] - 9.5, 0, LANE[2] + 2.4, { steps: [[W.well, "smile"], [W.dangerous, "nervous"], [W.cats, "shock"]], prop: (tt) => (tt > W.cats - LEADT ? "point" : null), facing: 1 }, out);
};
const party = (t: number, cam: CamInfo, out: Stage) => {
  const [px, py, pz] = PARTY;
  actor(cam, t, 930, ENEMY, "enemy", px + 1.8, py, pz - 5.2, { steps: [[W.like, "stern"], [W.enemy, "stern"]], prop: "shrug", calm: 0.4 }, out);
  actor(cam, t, 931, GUEST, "guest", px - 0.6, py, pz - 1.0, { steps: [[W.like, "grin"], [W.enemy, "shock"], [W.door, "nervous"]], facing: 1, look: 1 }, out);
};
const cats = (t: number, cam: CamInfo, out: Stage) => {
  for (let i = 0; i < 5; i++) {
    const x = -5 + i * 2.5, z = 7 + (i % 2) * 1.2;
    actor(cam, t, 940 + i, FOLKM[i % 6], `fm${i % 6}`, x, 0, z, { steps: [[W.so4, "neutral"], [W.lock, i % 2 ? "shock" : "pained"], [W.nobody, "stern"]], prop: "hold", facing: (i % 3 - 1) as -1 | 0 | 1 }, out);
    catCard(cam, t, 950 + i, x + 0.02, 0.95, z + 0.25, CATCOL[i % 5], false, out, 0.42);
  }
};
const free = (t: number, cam: CamInfo, out: Stage) => {
  for (let i = 0; i < RATS; i++) ratCard(cam, t, 760 + i, LANE[0] - 6 + i * 0.9 + (t - W.walked) * 1.2, 0, LANE[2] + (i % 2 ? 0.5 : -0.5), 1, i % 2 ? "happy" : "smug", out, true, 0.55);
  for (let i = 0; i < 4; i++) catCard(cam, t, 970 + i, LANE[0] - 2 + i * 6, 1.4, LANE[2] + (i % 2 ? 5 : -5), CATCOL[i], false, out, 0.55);
  actor(cam, t, 980, LAWYER, "law", LANE[0] - 11, 0, LANE[2] - 1.6, { steps: [[W.walked, "smile"], [W.least, "grin"], [W.story, "smile_closed"]], prop: (tt) => (tt > W.least - LEADT ? "shrug" : null), facing: 1 }, out);
};

/** everything with a face and the effects in shot `id` at time t */
export const stage = (id: number, t: number, S: Scene, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light; NOW = t;
  findSun(cam, SUN);
  const c = s.crowd;
  if (c === "hook") hook(t, cam, out);
  if (c === "field") field(t, cam, out, false);
  if (c === "eaten") field(t, cam, out, true);
  if (c === "trial") courtWide(t, cam, out, "trial");
  if (c === "doubters") doubters(t, cam, out);
  if (c === "hero") hero(t, cam, out);
  if (c === "empty") courtWide(t, cam, out, "empty");
  if (c === "plea") courtWide(t, cam, out, "plea");
  if (c === "priests") priests(t, cam, out);
  if (c === "ponder") ponder(t, cam, out);
  if (c === "lane") lane(t, cam, out);
  if (c === "explain") courtWide(t, cam, out, "explain");
  if (c === "party") party(t, cam, out);
  if (c === "cats") cats(t, cam, out);
  if (c === "stopped") courtWide(t, cam, out, "stopped");
  if (c === "free") free(t, cam, out);
  void paper; void S; void smooth; void lin; void clamp01; void SPOT; void bodySide; void bodyFront; void fxBurst; void INK; void FOLK; void SWAPS; void LEAD;
  return out;
};
export { FPS };
