// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, NOBLE, KID, EMPRESS, guard, craftsman, gent1836, fxBurst, fxStars, fxShadow, fxContact, INK,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import { FPS, SHOTS, V3, smooth, clamp01, W, L as LEADT, Scene, pourAt, PED, KIT, FB1, FB2, PIT_D, crackCount } from "./story";
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
const GUARDS = [0, 1, 2, 3, 4, 5].map((v) => guard(v));
const CRAFTS = [0, 1, 2, 3, 4, 5].map((v) => craftsman(v));
const GENTS = [0, 1, 2, 3, 4, 5].map((v) => gent1836(v));
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
const giraffe = (p: Pen) => {
  const Y = "#f2b84a", SP = "#b8662c";
  // legs, body, neck, head (600 x 1000 design space, soles at 975)
  for (const x of [150, 205, 395, 450]) p.line([[x, 640], [x, 975]], Y, 26);
  p.ell(300, 600, 190, 95, Y, 12);
  p.poly([[400, 580], [455, 590], [440, 140], [395, 130]], Y, 12);
  p.ell(445, 115, 62, 38, Y, 11, 0, 360, -20);
  p.ell(495, 132, 30, 22, "#e7a03a", 8);
  for (const [x, y] of [[230, 580], [320, 560], [380, 620], [270, 640], [200, 610], [420, 420], [415, 300], [425, 200]] as const) p.ell(x, y, 26, 20, SP, 0);
  p.stroke([[420, 80], [410, 40]], 9); p.stroke([[450, 76], [452, 36]], 9);
  p.ell(410, 38, 11, 11, SP, 6); p.ell(452, 34, 11, 11, SP, 6);
  p.ell(440, 105, 9, 11, INK, 0);
  p.stroke([[115, 600], [80, 700]], 10, Y);
};
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

// ---------------- groups ----------------
const visitors = (t: number, cam: CamInfo, out: Stage, cheer: boolean) => {
  const spots: [number, number][] = [[4.0, 7.6], [6.6, 8.2], [-5.8, 2.2], [6.4, 0.6], [-3.8, 8.6], [-6.4, 6.0], [8.6, 5.2], [-8.2, 3.6], [9.4, 8.2], [-9.6, 7.4]];
  spots.forEach(([dx, dz], i) => {
    const x = PED[0] + dx, z = PED[1] + dz, kid = i % 5 === 3;
    const look = Math.max(-1, Math.min(1, Math.round(Math.sin(t * 0.7 + i * 1.9))));
    const expr: Expr = cheer ? (["laugh", "grin", "smile", "laugh"] as Expr[])[i % 4] : (["smile", "neutral", "smile_closed", "grin"] as Expr[])[i % 4];
    front(cam, 600 + i, kid ? KID : GENTS[i % 6], kid ? "kid" : `g${i % 6}`, x, 0, z, { expr, look, prop: i % 4 === 1 ? "point" : null,
      wave: cheer && i % 3 !== 1 ? q(Math.sin(t * 8 + i), 30) : undefined, facing: dx < 0 ? 1 : -1 }, kid ? 0.72 : 1, true, out);
  });
};
const crowd1836 = (t: number, cam: CamInfo, out: Stage) => {
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1, x = side * (10.5 + (i % 3) * 1.3), z = -4 + (i >> 1) * 1.6;
    const up = t > (SHOTS[14].a / FPS) + 1.6;
    front(cam, 700 + i, i % 6 === 4 ? KID : GENTS[i % 6], i % 6 === 4 ? "kid" : `g${i % 6}`, x, 0, z, { expr: up ? (["grin", "laugh", "smile"] as Expr[])[i % 3] : "neutral",
      look: side > 0 ? -1 : 1, wave: up && i % 3 === 0 ? q(Math.sin(t * 8 + i), 30) : undefined, facing: side > 0 ? -1 : 1 }, i % 6 === 4 ? 0.72 : 1, true, out);
  }
};
const empress = (t: number, cam: CamInfo, out: Stage) => {
  const big = t > W.biggest2 - LEADT, small = t > W.not - LEADT && !big;
  front(cam, 80, EMPRESS, "emp", -1.0, 0, 11.2, { expr: big ? "laugh" : small ? "stern" : "smile", prop: big ? "armsUp" : small ? "shrug" : t > W.kremlin - LEADT ? "point" : null, facing: 1 }, 1.06, true, out);
  ([[-3.4, 12.0, "smile_closed"], [1.4, 12.2, "nervous"], [-5.2, 11.0, "neutral"]] as const).forEach(([x, z, e], i) =>
    front(cam, 81 + i, NOBLE, "noble", x, 0, z, { expr: big ? "shock" : e, facing: i % 2 ? -1 : 1, look: big ? -1 : 0 }, 1, true, out));
  front(cam, 85, GUARDS[2], "gd2", 3.6, 0, 11.4, { expr: big ? "shock" : "stern", facing: -1 }, 1, true, out);
};
const crafts = (t: number, cam: CamInfo, out: Stage) => {
  const spots: [number, number, number][] = [[-5.4, -3.0, 5.4], [5.6, -3.0, 0.8], [-5.8, -3.0, -1.6], [2.6, -3.0, 5.6], [-2.4, -PIT_D, 4.0], [-4.0, -3.0, -5.6]];
  spots.forEach(([x, y, z], i) => {
    const hit = Math.round(((t * 1.6 + i * 0.29) % 1) * 8) / 8;
    front(cam, 100 + i, CRAFTS[i % 6], `c${i % 6}`, x, y, z, { expr: (["grin", "neutral", "smile", "whistle"] as Expr[])[i % 4], prop: i % 3 === 2 ? null : ["hammer", hit], facing: x < 0 ? 1 : -1 }, 1, true, out);
  });
};
const giraffeCard = (t: number, out: Stage) => {
  const u = clamp01((t - W.giraffe + 0.25) / 0.2);
  if (u <= 0) return;
  const pop = u < 1 ? 0.6 + 0.5 * Math.sin(u * Math.PI * 0.5) + 0.1 * Math.sin(u * 9) : 1;
  out.places.push({ key: "giraffe", draw: giraffe, x: 25.6, y: 0, z: 10.6, scale: 2.6 * pop, size: [1080, 1800, 1.8] });
  blob(out, 25.6, 0, 10.6, 2.4);
  if (u < 1) { const k = Math.round(u * 10) / 10; out.fx.push({ key: `burst${k}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, k, "#ffffff", 10, 40, 230), x: 25.6, y: 3, z: 10.6, w: 5, h: 5 }); }
};
/** flames on the casting house: roof, posts, platform edges; k = 0..1 how far the fire has spread */
const shedFlames = (t: number, out: Stage, k: number) => {
  const spots: [number, number, number, number][] = [[-5, 9.5, 4.5, 4], [2, 10.5, 3, 5], [6, 9.2, -4, 4], [-6.5, 9, -3, 3.5], [0, 11.5, -1, 4.5],
    [-7.6, 2, 7.6, 3], [7.6, 3, 7.6, 3.2], [7.6, 1, -7.6, 3], [-7.6, -1, -7.6, 2.8], [0, -2.6, 6.2, 2.4], [-5.5, -2.6, 0, 2.2], [5.5, -2.6, -3, 2.2], [0, -2.6, -6, 2.4]];
  spots.forEach(([x, y, z, h], i) => flameCard(out, t, x, y, z, h, i, clamp01(k * 1.6 - i * 0.05)));
};
const fireCrowd = (t: number, cam: CamInfo, out: Stage) => {
  for (let i = 0; i < 16; i++) {
    const x = -8 + ((i * 0.618) % 1) * 15, z = 13 + (i % 4) * 1.6 + ((i * 7) % 3) * 0.3;
    const seen = t > W.fire - LEADT + (i % 5) * 0.06;
    const o = i % 4 === 0 ? GUARDS[i % 6] : i % 7 === 3 ? KID : FOLK[i % 6];
    front(cam, 200 + i, o, i % 4 === 0 ? `gd${i % 6}` : i % 7 === 3 ? "kid" : `f${i % 6}`, x, 0, z, { expr: seen ? (["shock", "nervous", "shock", "dazed"] as Expr[])[i % 4] : "neutral",
      prop: seen ? (i % 3 === 0 ? "point" : i % 3 === 1 ? "armsUp" : null) : null, facing: (i % 3 - 1) as -1 | 0 | 1 }, i % 7 === 3 ? 0.72 : 1, true, out);
  }
};
const guardsPour = (t: number, cam: CamInfo, out: Stage, always: boolean) => {
  for (let i = 0; i < 5; i++) {
    const x = -3.2 + i * 1.6, z = 5.5 + (i % 2) * 0.5, y = -3.0;
    const pouring = always || pourAt(t, i), grabbed = always || t > W.grab - LEADT;
    const expr: Expr = pouring ? (i % 2 ? "grin" : "stern") : grabbed ? "neutral" : "stern";
    front(cam, 300 + i, GUARDS[i % 6], `gd${i % 6}`, x, y, z, { expr, prop: pouring ? "bucketPour" : grabbed ? "bucketLow" : null, facing: 0 }, 1, true, out);
    if (pouring) {
      const sx = x * 0.85, sz = z - 1.1;
      out.fx.push({ key: "stream", cw: 512, ch: 512, draw: stream, x: sx, y: y - 1.0, z: sz, w: 1.0, h: 2.0 });
    }
  }
  const t0 = always ? 0 : W.pour + 0.25;
  if (always || t > t0) steamCard(out, t, 0.6, -5.2, 1.4, 4, clamp01(always ? 1 : (t - t0) / 0.5), 0.75);
};
const rimGuard = (t: number, cam: CamInfo, out: Stage) => {
  front(cam, 320, GUARDS[1], "gd1", 0.8, 0, 8.7, { expr: t < W.luckily + 0.6 ? "nervous" : "relief", look: -1, facing: -1 }, 1, true, out);
  front(cam, 321, GUARDS[3], "gd3", 2.6, 0, 9.1, { expr: "relief_open", prop: "bucketLow", facing: -1 }, 1, true, out);
  steamCard(out, t, 0.5, -6.5, 0.8, 4, 0.6, 2.0);
};
const kitchen = (t: number, cam: CamInfo, out: Stage) => {
  const [kx, ky, kz] = KIT;
  const pour = t > W.ice - LEADT, cracked = t > W.give - 0.35, split = clamp01((t - W.give - 0.05) / 0.25);
  front(cam, 400, CRAFTS[3], "c3", kx - 1.15, ky, kz - 1.6, { expr: split > 0 ? "shock" : pour ? "grin" : "neutral", prop: pour ? "bucketPour" : "bucketLow", facing: 0 }, 1, true, out);
  const hot = pour ? 1 - 0.3 * clamp01((t - W.ice) / 1) : 1;
  out.fx.push({ key: `dish${q(hot, 10)}_${cracked ? 1 : 0}_${q(split, 10)}`, cw: 600, ch: 600, draw: (p) => dish(p, hot, cracked ? 1 : 0, split), x: kx + 0.15, y: ky + 1.25, z: kz - 0.75, w: 1.3, h: 1.3, hdr: 1.0 });
  for (let k = 0; k < 6; k++) {
    const u = clamp01((t - W.ice - 0.1 - k * 0.07) / 0.35);
    if (u <= 0 || split > 0) continue;
    const bounce = u >= 1 ? 0.02 * Math.abs(Math.sin((t - W.ice) * 12 + k)) : 0;
    out.fx.push({ key: "ice", cw: 64, ch: 64, draw: (p) => p.poly([[8, 8], [56, 10], [54, 56], [10, 54]], "#d8f0ff", 5), x: kx + 0.15 + (k - 2.5) * 0.12, y: ky + 2.1 - u * 0.95 + bounce, z: kz - 0.7, w: 0.11, h: 0.11, rot: k + u * 3 });
  }
  if (pour) steamCard(out, t, kx + 0.15, ky + 1.0, kz - 0.9, 4, clamp01((t - W.ice) / 0.4), 0.22);
  crackPop(out, t, W.give - 0.05, kx + 0.15, ky + 1.3, kz - 0.6, 1.2);
};
const flashFolk = (t: number, cam: CamInfo, out: Stage) => {
  ([[FB1[0] - 3.5, FB1[1] + 6, 0], [FB1[0] + 3.2, FB1[1] + 7, 1], [FB2[0] - 3.2, FB2[1] + 6.5, 2], [FB2[0] + 3.6, FB2[1] + 6, 3]] as const).forEach(([x, z, i]) =>
    front(cam, 500 + i, FOLK[i * 2 % 6], `f${i * 2 % 6}`, x, 0, z, { expr: "shock", prop: i % 2 ? "armsUp" : "point", facing: i % 2 ? -1 : 1 }, 1, true, out));
  const fl = (cx: number, cz: number, k: number, s: number) => [[-2.2, 1, -2.2], [2.2, 3, -2.2], [-2.2, 5, 2.2], [2.2, 2, 2.2], [0, 8.5, 0], [-1.5, 9.5, 0], [1.6, 10, 0]].forEach(([dx, y, dz], i) =>
    flameCard(out, t, cx + dx * s, y, cz + dz, 2.6, i + 20 * s, k));
  fl(FB1[0], FB1[1], 1, 1);
  fl(FB2[0], FB2[1], clamp01((t - W.first - 1.2) / 1.0), 1.8);
  crackPop(out, t, W.first + 1.4, FB1[0] + 0.6, 1.0, FB1[1] + 0.8, 3);
  crackPop(out, t, W.second + 0.75, FB2[0] - 0.5, 1.2, FB2[1] + 0.8, 3.6);
};
const guardEnd = (t: number, cam: CamInfo, out: Stage) => {
  const x = PED[0] + 5.8, z = PED[1] + 2.4;
  const got = t > W.got - LEADT, seen = t > W.water2 - LEADT;
  front(cam, 330, GUARDS[0], "gd0", x, 0, z, { expr: got ? "smile_closed" : seen ? "nervous" : "neutral", prop: got ? "shrug" : "bucketLow", look: seen ? 0 : -1, facing: -1 }, 1, true, out);
  if (!got) { const u = (t * 1.4) % 1; out.fx.push({ key: "drip", cw: 64, ch: 64, draw: drip, x: x + 0.05, y: 0.55 - u * 0.5, z: z + 0.25, w: 0.1, h: 0.1 }); }
  out.fx.push({ key: "puddleE", cw: 300, ch: 150, draw: (p) => { p.ell(150, 75, 140, 58, "#6f97c6", 0); p.ell(120, 62, 60, 16, "#a9c9ea", 0); }, x, y: 0.02, z: z + 0.2, w: 1.3, h: 0.6, flat: true });
};

/** everything with a face, flames, water and steam in shot `id` at time t */
export const stage = (id: number, t: number, S: Scene, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light; NOW = t;
  findSun(cam, SUN);
  const c = s.crowd;
  if (c.includes("visitors")) visitors(t, cam, out, c.includes("cheer"));
  if (c.includes("crowd1836")) crowd1836(t, cam, out);
  if (c.includes("empress")) empress(t, cam, out);
  if (c.includes("crafts")) crafts(t, cam, out);
  if (c.includes("giraffe")) giraffeCard(t, out);
  if (c.includes("fireCrowd")) { fireCrowd(t, cam, out); shedFlames(t, out, S.fire); }
  if (c.includes("flames") || c.includes("pourHook")) shedFlames(t, out, S.fire);
  if (c.includes("guards")) guardsPour(t, cam, out, false);
  if (c.includes("pourHook")) guardsPour(t, cam, out, true);
  if (c.includes("steam")) {
    shedFlames(t, out, 1);
    steamCard(out, t, 0.5, -5.0, 1.0, 6, 1, 2.4);
    for (const [t0, k] of [[W.crack, 1], [W.another, 2]] as const) if (crackCount(t) >= k) crackPop(out, t, t0 - LEADT, 1.3 + k * 0.3, -8.6 + k * 0.5, 2.9, 1.4);
    crackPop(out, t, W.off - 0.05, 2.6, -9.5, 4.2, 2.6);
  }
  if (c.includes("rimGuard")) rimGuard(t, cam, out);
  if (c.includes("kitchen")) kitchen(t, cam, out);
  if (c.includes("flash")) flashFolk(t, cam, out);
  if (c.includes("guardEnd")) guardEnd(t, cam, out);
  return out;
};
export { FPS };
