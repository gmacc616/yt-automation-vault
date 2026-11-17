// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, PASSENGER, TOURIST, KID, MINER, ROUGHNECK, FISHER, SUIT, fxBurst, fxSplash, fxStars, fxRing, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import { FPS, SHOTS, V3, clamp01, W, LakeState, rigToWorld, bargeAt, SKIFF, SUITS, mineAt, kitchenAt } from "./story";
import { RIG_DECK, MINE, Mine, KIT, KS, groundY, BANK } from "./lake";
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
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
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
const stand = (cam: CamInfo, out: Stage, who: Who, x: number, y: number, z: number, fo: FrontOpts, scale = 1, shadow = 1) => {
  const pl = person(cam, who, x, y, z, { side: false, mirror: false }, fo, {}, scale);
  out.places.push(pl);
  if (shadow > 0) blob(out, x, y, z, scale, shadow);
  return pl;
};
const ROUGH = [0, 1, 2, 3].map((v) => ROUGHNECK(v));
const MINERS = [0, 1, 2, 3, 4, 5].map((v) => MINER(v));
const TOUR = [0, 1, 2, 3, 4].map((v) => TOURIST(v));
const SUITS_O = [0, 1, 2, 3, 4].map((v) => SUIT(v));

/** the fisherman in his skiff */
const fisher = (t: number, cam: CamInfo, out: Stage) => {
  const [x, , z] = SKIFF;
  stand(cam, out, { i: 1, o: FISHER, okey: "fisher" }, x - 0.2, 0.18 + 0.05 * Math.sin(t * 1.5), z, { mode: "sit", expr: t < W.quiet - L2 ? "smile_closed" : "whistle", blink: lidAt(t, 1), facing: 1 }, 1, 0);
  const u = q(((t * 0.7) % 1.4) / 1.4, 30);
  out.fx.push({ key: `ring${u}`, cw: 600, ch: 600, draw: (p) => fxRing(p, u), x: x + 2.6, y: 0.03, z: z - 1.6, w: 1.6, h: 1.6, flat: true });
};
const L2 = 2 / FPS;
/** roughnecks on the rig deck: working, then thrown off balance when she heels */
const rigCrew = (id: number, t: number, S: LakeState, cam: CamInfo, out: Stage) => {
  const spots: V3[] = [[4.5, RIG_DECK, 6.6], [-2.4, RIG_DECK, 7.2], [8.5, RIG_DECK, 5.2], [1.2, RIG_DECK + 2.2, 3.2]];
  const tilted = id === 7 && t > W.tilt - L2;
  spots.forEach((sp, i) => {
    const [x, y, z] = rigToWorld(S, sp);
    const expr: Expr = tilted ? (["shock", "nervous", "shock", "dazed"] as Expr[])[i] : (["grin", "neutral", "smile", "whistle"] as Expr[])[i];
    const pl = stand(cam, out, { i: 10 + i, o: ROUGH[i], okey: `rn${i}` }, x, y, z,
      { mode: "stand", expr, blink: lidAt(t, 10 + i), prop: tilted && i % 2 === 0 ? "armsUp" : !tilted && i === 2 ? "point" : null, facing: (i % 2 ? -1 : 1) as -1 | 1, tilt: tilted ? -S.rigTilt * 40 : 0 }, 1, S.rigTilt < 0.05 ? 0.8 : 0);
    pl.roll = S.rigTilt * 0.85;
  });
  if (id === 7 && t > W.tilt - 0.1) { // spray at the hull as she heels
    const u = q(((t * 1.5) % 1), 30), [x, y, z] = rigToWorld(S, [-6, 0, 9.5]);
    out.fx.push({ key: `splash${u}`, cw: 800, ch: 800, draw: (p) => fxSplash(p, u), x, y: Math.max(0.6, y + 0.8), z, w: 3.2, h: 3.2 });
  }
};
/** rings where the rig went down and around the whirlpool rim; splashes on sinking barges */
const lakeFx = (t: number, S: LakeState, out: Stage) => {
  if (S.barges === "swirl") {
    for (let i = 0; i < 12; i++) {
      const b = bargeAt(S, i);
      if (!b.on || b.roll < 0.15) continue;
      const u = q(((t * 1.4 + i * 0.17) % 1), 30);
      out.fx.push({ key: `splash${u}`, cw: 800, ch: 800, draw: (p) => fxSplash(p, u), x: b.x, y: Math.max(S.wl - 2, b.y + 1.5), z: b.z, w: 5, h: 5 });
    }
  }
  if (S.fall > 0.3) for (let k = 0; k < 4; k++) { // spray where the canal water hits the pool in the pit
    const u = q(((t * 1.3 + k / 4) % 1), 30);
    out.fx.push({ key: `splash${u}`, cw: 800, ch: 800, draw: (p) => fxSplash(p, u), x: 129 + (k - 1.5) * 3, y: S.wl + 3, z: (k % 2) * 3 - 1.5, w: 12, h: 12 });
  }
  if (S.barges === "pop") for (let i = 0; i < 9; i++) {
    const b = bargeAt(S, i);
    if (!b.on || b.y < -3) continue;
    const k = clamp01((b.y + 3) / 3.4);
    if (k > 0.05 && b.roll > 0.02) {
      const u = q(1 - b.roll * 2, 30);
      out.fx.push({ key: `splash${u}`, cw: 800, ch: 800, draw: (p) => fxSplash(p, clamp01(u)), x: b.x, y: 1.8, z: b.z, w: 9, h: 9 });
    }
  }
};
/** salt miners: working, see the water, run for the shaft */
const miners = (t: number, cam: CamInfo, out: Stage) => {
  const [mx, my, mz] = MINE, seen = t > W.water - L2, go = t > W.tunnels - 0.3;
  for (let i = 0; i < 8; i++) {
    const bx = -15 + (i % 4) * 3.2 + (i > 3 ? 1.6 : 0), bz = 6 + Math.floor(i / 4) * 3.4;
    const run = go ? Math.max(0, t - W.tunnels + 0.3 - (i % 3) * 0.12) * 4.2 : 0;
    const x = mx + bx + run, z = mz + bz - run * 0.25;
    const expr: Expr = seen ? (["shock", "shock", "nervous", "shock", "dazed", "shock", "nervous", "shock"] as Expr[])[i] : (["whistle", "neutral", "smile", "grin"] as Expr[])[i % 4];
    if (run > 0.1) {
      const v = viewOf(cam, x, z, 1, -0.25), ph = (t * 2.8 + i * 0.3) % 1;
      out.places.push(person(cam, { i: 30 + i, o: MINERS[i % 6], okey: `mn${i % 6}` }, x, my, z, v, { phase: ph, expr, mode: "march", blink: lidAt(t, 30 + i) }, { phase: ph, expr, mode: "march", blink: lidAt(t, 30 + i), stride: 1.4 * v.fs }));
      blob(out, x, my, z, 1, 0.9);
    } else stand(cam, out, { i: 30 + i, o: MINERS[i % 6], okey: `mn${i % 6}` }, x, my, z, { mode: "stand", expr, blink: lidAt(t, 30 + i), prop: seen && i % 3 === 0 ? "point" : seen && i % 3 === 1 ? "armsUp" : null, facing: (i % 2 ? -1 : 1) as -1 | 1 });
  }
  const m = mineAt(12, t);
  if (m.pour > 0.5) for (let k = 0; k < 3; k++) {
    const u = q(((t * 1.8 + k / 3) % 1), 30);
    out.fx.push({ key: `splash${u}`, cw: 800, ch: 800, draw: (p) => fxSplash(p, u), x: mx + (k - 1) * 1.2, y: my + 1.2, z: mz + 0.5, w: 4.5, h: 4.5 });
  }
};
/** everyone in the cage on the way up */
const cage = (t: number, cam: CamInfo, out: Stage) => {
  const [mx, my, mz] = MINE, y = my + mineAt(13, t).cage, [sx, , sz] = Mine.SHAFT;
  [[-0.9, 0.9], [0.9, 0.9], [0, 0.2], [-1.1, -0.6], [1.1, -0.6], [0, -1.2]].forEach(([ox, oz], i) => {
    const expr: Expr = t < W.every - L2 ? "nervous" : (["relief", "relief_open", "grin", "relief", "laugh", "relief_open"] as Expr[])[i];
    stand(cam, out, { i: 40 + i, o: MINERS[(i + 2) % 6], okey: `mn${(i + 2) % 6}` }, mx + sx + ox, y + 0.2, mz + sz + oz,
      { mode: "stand", expr, blink: lidAt(t, 40 + i), wave: t > W.every && i === 2 ? q(Math.sin(t * 8), 30) : undefined, facing: (i % 2 ? -1 : 1) as -1 | 1 }, 1, 0);
  });
};
/** locals on the bank staring at the empty lake */
const shore = (t: number, cam: CamInfo, out: Stage) => {
  const pts: [number, number][] = [[-136.5, 101], [-134, 96.5], [-138.5, 96], [-132, 101.5], [-135.5, 92.5], [-139.5, 104.5]];
  pts.forEach(([x, z], i) => {
    const kid = i === 3;
    stand(cam, out, { i: 60 + i, o: kid ? KID : TOUR[i % 5], okey: kid ? "kid" : `t${i % 5}` }, x, groundY(x, z), z,
      { mode: "stand", expr: (["shock", "dazed", "shock", "shock", "nervous", "dazed"] as Expr[])[i], blink: lidAt(t, 60 + i), prop: i === 1 ? "point" : i === 4 ? "armsUp" : null, facing: (i % 3 - 1) as -1 | 0 | 1 },
      kid ? 0.72 : 1);
  });
};
/** sugar in tea: the person at the kitchen table */
const tea = (t: number, cam: CamInfo, out: Stage) => {
  const [kx, ky, kz] = KIT, k = kitchenAt(t);
  const expr: Expr = t < W.sugar - L2 ? "smile_closed" : k.melt < 0.2 ? "smile" : "shock";
  stand(cam, out, { i: 80, o: PASSENGER, okey: "pass" }, kx + 0.05 * KS, ky + 0.08 * KS, kz - 0.72 * KS, { mode: "sit", expr, blink: lidAt(t, 80), prop: t > W.tea - L2 ? "point" : null, facing: 0 }, KS * 0.82, 0.9);
  if (k.drop >= 1) {
    const u = q(((t - W.sugar) * 0.9) % 1, 30);
    out.fx.push({ key: `ring${u}`, cw: 600, ch: 600, draw: (p) => fxRing(p, u), x: kx + 0.008 * KS, y: ky + 0.78 * KS + 0.067 * KS, z: kz + 0.004 * KS, w: 0.08 * KS, h: 0.08 * KS, flat: true });
  }
};
/** the oilmen and lawyers on the bank: each points at the next, then they all shrug; then the money */
const suits = (t: number, cam: CamInfo, out: Stage) => {
  const shrug = t > W.drillers - 0.4;
  for (let i = 0; i < 5; i++) {
    const o = (i - 2) * 1.25, x = SUITS[0] + o * 0.707, z = SUITS[2] + o * 0.707;
    const pointing = !shrug && t > W.nobody + i * 0.22;
    stand(cam, out, { i: 90 + i, o: SUITS_O[i], okey: `su${i}` }, x, groundY(x, z), z,
      { mode: "stand", expr: shrug ? (t > W.paid ? "nervous" : "smile_closed") : pointing ? "stern" : "neutral", blink: lidAt(t, 90 + i), prop: shrug ? "shrug" : pointing ? "point" : null, facing: shrug ? 0 : 1 });
  }
  if (t > W.paid - 0.1) {
    const u = q(clamp01((t - W.paid + 0.1) / 0.5), 30);
    out.fx.push({ key: `burst${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u, "#fff3b0", 10, 60, 200), x: SUITS[0], y: BANK + 3.0, z: SUITS[2], w: 1.8, h: 1.8 });
    for (let k = 0; k < 7; k++) {
      const v = clamp01((t - W.paid - k * 0.07) / 1.4);
      if (v <= 0) continue;
      out.fx.push({ key: "bills", cw: 240, ch: 120, draw: bills, x: SUITS[0] + (k - 3) * 0.55 + Math.sin(k * 2.1 + t * 2) * 0.2, y: BANK + 3.4 + v * 0.6 - v * v * 2.6, z: SUITS[2] + (k % 2) * 0.4, w: 0.55, h: 0.27, rot: Math.sin(t * 3 + k) * 0.6 });
    }
  }
};
const bills = (p: Pen) => { p.poly([[10, 15], [230, 15], [230, 105], [10, 105]], "#7cb36a", 6); p.ell(120, 60, 28, 28, "#5a9a4a", 4); p.poly([[32, 32], [208, 32], [208, 88], [32, 88]], null, 3); };

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, S: LakeState, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  const c = s.crowd;
  if (c === "fisher") fisher(t, cam, out);
  if (c === "rigcrew") rigCrew(id, t, S, cam, out);
  if (c === "miners") miners(t, cam, out);
  if (c === "cage") cage(t, cam, out);
  if (c === "shore") shore(t, cam, out);
  if (c === "tea") tea(t, cam, out);
  if (c === "suits") suits(t, cam, out);
  if (s.place === "lake") lakeFx(t, S, out);
  return out;
};
export { FPS };
