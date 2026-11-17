// The Kremlin as one three.js scene: sky, Cathedral Square with the casting pit and its wooden casting house (intact or
// burnt), the Tsar Bell, Ivan the Great's bell tower, a gold-domed cathedral, the red brick walls and towers, Moscow
// houses outside, the 1836 lifting tripod and granite stand, the two earlier bells (flashback) and a night kitchen for
// the explanation. update(id, f, camera) poses everything for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile, getInputProps } from "remotion";
import { Batch, boxGeo, V, lam, Kit, Ray, setSight, prop, house } from "./build";
import { beam, beamHD, planksHD, stoneHD, cobbleHD, grassHD, cloudHD, brick, rep, roofHD } from "./paint";
import { Pen } from "./toon";
import { LIGHTS, LOOK, LightPreset, LightName } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, V3, FOREGROUND, ShotDef, sceneAt, KIT, PED, FB1, FB2, PIT_D } from "./story";
import { Bell } from "./bell";

// ---------------- assets ----------------
const KENNEY = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "tree-high-round", "tree", "plant_bushLarge", "plant_bushDetailed",
  "plant_bush", "hedge", "lantern", "cart"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

const discTex = () => {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
};
const smokeTex = (() => { let t: THREE.CanvasTexture | null = null; return () => {
  if (t) return t;
  const c = document.createElement("canvas"); c.width = c.height = 256; const p = new Pen(c.getContext("2d")!);
  for (const [x, y, r, col] of [[90, 150, 60, "#5f5a66"], [150, 120, 70, "#736e7a"], [170, 165, 55, "#5f5a66"], [120, 100, 50, "#86818c"]] as const) p.ell(x, y, r, r * 0.85, col, 0);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}; })();

/** every lens position looking at its subject (houses / trees there are left out) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 2) {
    const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

/** onion dome, base radius R, height H, base at y = 0 */
const onion = (R: number, H: number) => {
  const pts: [number, number][] = [[R * 0.82, 0], [R * 1.0, 0.12 * H], [R * 1.12, 0.3 * H], [R * 1.02, 0.48 * H], [R * 0.7, 0.66 * H], [R * 0.32, 0.82 * H], [R * 0.1, 0.93 * H], [0.001, H]];
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 28);
};
const cyl = (r0: number, r1: number, h: number, n: number, x: number, y: number, z: number) => new THREE.CylinderGeometry(r1, r0, h, n).translate(x, y + h / 2, z);

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<LightName, THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();
  // story props
  private bell = new Bell(); private bell1 = new Bell(); private bell2 = new Bell();
  private pit = new THREE.Group(); private lid = new THREE.Group();
  private shed = new THREE.Group(); private burnt = new THREE.Group();
  private weeds = new THREE.Group(); private tripod = new THREE.Group(); private ropes: THREE.Mesh[] = [];
  private pedestal = new THREE.Group(); private fb1 = new THREE.Group(); private fb2 = new THREE.Group();
  private kitchen = new THREE.Group(); private kLamp!: THREE.MeshBasicMaterial;
  private fireLight = new THREE.PointLight("#ff8a3a", 0, 60, 1.6);
  private smoke: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; base: V3; k: number }[] = [];
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];

  constructor(kit: Kit) {
    const R = this.root;
    // ---- sky + light ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunDisc.renderOrder = -0.5; this.sunDisc.frustumCulled = false; this.sunDisc.layers.set(NOINK); R.add(this.sunDisc);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    const ip = getInputProps() as { post?: { shadow?: number }; draft?: boolean };
    const shadowPx = ip.post?.shadow ?? (ip.draft ? 1024 : 2048);
    this.sun.castShadow = shadowPx > 0;
    this.sun.shadow.mapSize.set(Math.max(256, shadowPx), Math.max(256, shadowPx));
    R.add(this.hemi, this.sun, this.sun.target, this.fireLight);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)), night: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.night.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    }
    setSight(sightLines());
    this.buildSquare(kit);
    this.buildPit();
    this.buildShed();
    this.buildBurnt();
    this.buildTripod();
    this.buildPedestal();
    this.buildFlashback();
    this.buildKitchen();
    setSight([]);
    for (const g of [this.bell.group, this.bell1.group, this.bell2.group]) R.add(g);
    this.bell1.group.scale.setScalar(0.42); this.bell2.group.scale.setScalar(0.72);
    for (let k = 0; k < 14; k++) {
      const mat = new THREE.MeshBasicMaterial({ map: smokeTex(), transparent: true, depthWrite: false, color: new THREE.Color(0.9, 0.85, 0.9) });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.layers.set(NOINK); m.visible = false;
      this.smoke.push({ m, mat, base: [0, 0, 0], k: k / 14 }); R.add(m);
    }
    for (const fg of FOREGROUND) void fg;
  }

  // ---------------- static scenery ----------------
  private buildSquare(kit: Kit) {
    const b = new Batch(), R = this.root;
    const grassM = lam("grassHD", () => ({ map: grassHD() })), cobM = lam("cobbleHD", () => ({ map: cobbleHD() }));
    const white = lam("kWhite", () => ({ map: stoneHD("tstoneHD") })), whitePlain = lam("kWhite2", () => ({ color: "#f0e9dc" }));
    const brickM = lam("kBrick", () => ({ map: rep(brick(), 1, 1) })), darkM = lam("kDark", () => ({ color: "#2a2230" }));
    const green = lam("kGreen", () => ({ color: "#3e8a62" })), cream = lam("kCream", () => ({ color: "#efe0b8" }));
    const gold = twoTone(new THREE.MeshPhongMaterial({ color: "#e8b445", specular: "#fff0b0", shininess: 60 }), 0.25);
    // ground: grass far out, cobbled square (the pit hole at |x|,|z| < 7 is left open)
    const H = 7, S = 75;
    for (const [x0, x1, z0, z1] of [[-S, S, -S, -H], [-S, S, H, S], [-S, -H, -H, H], [H, S, -H, H]]) b.add(flat(x0, x1, z0, z1, 0, 4), cobM);
    for (const [x0, x1, z0, z1] of [[-900, 900, -900, -S], [-900, 900, S, 900], [-900, -S, -S, S], [S, 900, -S, S]]) b.add(flat(x0, x1, z0, z1, -0.02, 4), grassM);
    // Ivan the Great bell tower (white octagonal tiers, arched openings, golden onion dome)
    const [ix, iz] = [-26, -34];
    const tiers: [number, number, number][] = [[8.4, 0, 21], [7.0, 21, 15], [6.0, 36, 13], [4.6, 49, 9]];
    for (const [r, y, h] of tiers) {
      b.add(cyl(r, r * 0.97, h, 8, ix, y, iz), white);
      b.add(cyl(r + 0.5, r + 0.5, 0.9, 8, ix, y + h - 0.9, iz), whitePlain); // cornice
      for (let k = 0; k < 8; k++) { // arches
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8, rr = r * 0.93;
        const g = new THREE.BoxGeometry(1.6, h * 0.42, 0.3).translate(0, y + h * 0.48, 0).rotateY(-a).translate(ix + Math.sin(a) * rr, 0, iz + Math.cos(a) * rr);
        b.add(g, darkM);
      }
    }
    b.add(cyl(3.6, 3.6, 4, 16, ix, 58, iz), white);
    b.add(onion(4.2, 8.5).translate(ix, 62, iz), gold);
    b.add(new THREE.BoxGeometry(0.35, 4, 0.35).translate(ix, 72.5, iz), gold); b.add(new THREE.BoxGeometry(2.0, 0.3, 0.35).translate(ix, 73.4, iz), gold);
    // Assumption Cathedral: white block, five golden domes on drums
    const [cx, cz] = [24, -38];
    b.add(boxGeo(V(cx - 13, 0, cz - 11), V(cx + 13, 16, cz + 11), 4), white);
    for (let k = -2; k <= 2; k++) b.add(boxGeo(V(cx + k * 5.2 - 1.6, 4, cz + 11), V(cx + k * 5.2 + 1.6, 12, cz + 11.25)), darkM); // tall windows
    b.add(boxGeo(V(cx - 13.4, 15.4, cz - 11.4), V(cx + 13.4, 16.4, cz + 11.4)), whitePlain);
    for (const [dx, dz, r] of [[0, 0, 3.2], [-7, -6, 2.3], [7, -6, 2.3], [-7, 6, 2.3], [7, 6, 2.3]]) {
      b.add(cyl(r, r, 6, 16, cx + dx, 16.4, cz + dz), cream);
      b.add(onion(r * 1.15, r * 2.6).translate(cx + dx, 22.4, cz + dz), gold);
      b.add(new THREE.BoxGeometry(0.22, 2.4, 0.22).translate(cx + dx, 22.4 + r * 2.6 + 1.0, cz + dz), gold);
    }
    // a smaller church on the right (Annunciation-like): cream with green roof and gold domes
    const [ax, az] = [52, -12];
    b.add(boxGeo(V(ax - 8, 0, az - 7), V(ax + 8, 11, az + 7), 4), cream);
    b.add(new THREE.ConeGeometry(11, 4, 4).rotateY(Math.PI / 4).translate(ax, 13, az), green);
    for (const [dx, dz] of [[0, 0], [-4, -3], [4, -3]]) { b.add(cyl(1.4, 1.4, 4, 12, ax + dx, 13, az + dz), cream); b.add(onion(1.7, 4).translate(ax + dx, 17, az + dz), gold); }
    // Kremlin walls: red brick, swallowtail merlons, tent-roofed towers
    const WALL = 12, T = 3;
    const wallRun = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0);
      const m = new THREE.Matrix4().makeRotationY(a).setPosition(x0, 0, z0);
      b.add(boxGeo(V(-T / 2, 0, 0), V(T / 2, WALL, len), 4), brickM, m);
      for (let s = 1.2; s < len - 1; s += 2.6) {
        b.add(boxGeo(V(-T / 2 + 0.6, WALL, s - 0.65), V(-T / 2 + 1.4, WALL + 1.3, s + 0.65)), brickM, m);
        for (const o of [-0.65, 0.25]) b.add(boxGeo(V(-T / 2 + 0.6, WALL + 1.3, s + o), V(-T / 2 + 1.4, WALL + 2.1, s + o + 0.4)), brickM, m);
      }
    };
    const tower = (x: number, z: number, h = 22, w = 10) => {
      b.add(boxGeo(V(x - w / 2, 0, z - w / 2), V(x + w / 2, h, z + w / 2), 4), brickM);
      b.add(boxGeo(V(x - w / 2 - 0.4, h - 1, z - w / 2 - 0.4), V(x + w / 2 + 0.4, h, z + w / 2 + 0.4)), whitePlain);
      b.add(new THREE.ConeGeometry(w * 0.72, h * 0.55, 4).rotateY(Math.PI / 4).translate(x, h + h * 0.275, z), green);
      b.add(new THREE.BoxGeometry(0.3, 3, 0.3).translate(x, h + h * 0.55 + 1.4, z), gold);
    };
    const X = 95, Zb = -90, Zf = 85;
    wallRun(-X, Zb, X, Zb); wallRun(-X, Zb, -X, Zf); wallRun(X, Zb, X, Zf); wallRun(-X, Zf, X, Zf);
    for (const [x, z, h] of [[-X, Zb, 24], [X, Zb, 24], [0, Zb, 30], [-X, Zf, 24], [X, Zf, 24], [-X, 0, 20], [X, 0, 20], [0, Zf, 34]]) tower(x, z, h, h === 34 ? 13 : 10);
    // Moscow beyond the walls: rows of houses for the wide shots, onion domes peeking up
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2, d = 140 + (k % 3) * 22;
      house(b, Math.cos(a) * d * 1.1, Math.sin(a) * d, -a + Math.PI / 2, 9, 8, 8.4 + (k % 3) * 1.4, k, 0);
    }
    for (const [x, z] of [[-150, -170], [170, -150], [-190, 60], [120, 190]]) { b.add(cyl(3, 3, 18, 12, x, 0, z), cream); b.add(onion(3.6, 8).translate(x, 18, z), gold); }
    // trees inside the walls and around the square
    const trees = ["tree_oak", "tree_default", "tree_fat", "tree_detailed"];
    for (let k = 0; k < 22; k++) {
      const x = -85 + ((k * 37) % 170), z = k % 2 ? -80 + ((k * 13) % 8) : 70 + ((k * 11) % 9);
      prop(b, kit, trees[k % 4], x, 0, z, 9 + (k % 3) * 2, k);
    }
    for (const [x, z] of [[-60, -40], [-62, 20], [64, 30], [60, -50], [-40, 50], [40, 52]]) prop(b, kit, "tree_oak", x, 0, z, 10, x);
    b.build(R);
  }

  private buildPit() {
    const b = new Batch(), D = PIT_D;
    const wood = lam("pitPlank", () => ({ map: planksHD() })), dirt = lam("pitDirt", () => ({ color: "#8a6a4a" }));
    // walls lined with planks, facing in
    b.add(boxGeo(V(-7, -D, -7.4), V(7, 0, -7)), wood); b.add(boxGeo(V(-7, -D, 7), V(7, 0, 7.4)), wood);
    b.add(boxGeo(V(-7.4, -D, -7.4), V(-7, 0, 7.4)), wood); b.add(boxGeo(V(7, -D, -7.4), V(7.4, 0, 7.4)), wood);
    b.add(flat(-7, 7, -7, 7, -D, 3), dirt);
    // a ladder on the back wall
    const lw = lam("ladder", () => ({ map: beam() }));
    for (const x of [-1.6, -0.9]) b.add(boxGeo(V(x - 0.06, -D, -6.95), V(x + 0.06, 0.8, -6.8)), lw);
    for (let y = -D + 0.4; y < 0.6; y += 0.45) b.add(boxGeo(V(-1.6, y, -6.92), V(-0.9, y + 0.07, -6.84)), lw);
    b.build(this.pit);
    this.root.add(this.pit);
    const c = new Batch();
    c.add(flat(-7, 7, -7, 7, 0.005, 4), lam("cobbleHD", () => ({ map: cobbleHD() })));
    c.build(this.lid); this.root.add(this.lid);
  }

  /** the wooden casting house over the pit: posts, beams, plank platforms around the bell, a gable roof */
  private buildShed() {
    const b = new Batch(), D = PIT_D, wood = lam("shedBeam", () => ({ map: beamHD() })), deck = lam("shedDeck", () => ({ map: planksHD() }));
    const roof = lam("shedRoof", () => ({ map: roofHD("#9a6a44") }));
    const post = (x: number, z: number, y0: number, y1: number, w = 0.45) => b.add(boxGeo(V(x - w / 2, y0, z - w / 2), V(x + w / 2, y1, z + w / 2)), wood);
    for (const x of [-7.6, 0, 7.6]) for (const z of [-7.6, 7.6]) post(x, z, -D, 8);
    for (const z of [0]) for (const x of [-7.6, 7.6]) post(x, z, -D, 8);
    for (const y of [0.4, 8]) {
      b.add(boxGeo(V(-7.9, y - 0.4, -7.9), V(7.9, y, -7.3)), wood); b.add(boxGeo(V(-7.9, y - 0.4, 7.3), V(7.9, y, 7.9)), wood);
      b.add(boxGeo(V(-7.9, y - 0.4, -7.9), V(-7.3, y, 7.9)), wood); b.add(boxGeo(V(7.3, y - 0.4, -7.9), V(7.9, y, 7.9)), wood);
    }
    // scaffold platforms around the bell (the craftsmen stand here), with posts down to the pit floor
    for (const y of [-3.0]) {
      for (const [x0, x1, z0, z1] of [[-6.9, 6.9, -6.9, -4.3], [-6.9, 6.9, 4.3, 6.9], [-6.9, -4.3, -4.3, 4.3], [4.3, 6.9, -4.3, 4.3]]) b.add(boxGeo(V(x0, y - 0.18, z0), V(x1, y, z1), 3), deck);
      for (const [x, z] of [[-4.4, -4.4], [4.4, -4.4], [-4.4, 4.4], [4.4, 4.4]]) post(x, z, -D, y, 0.3);
      for (const [x0, x1, z0, z1] of [[-4.4, 4.4, -4.45, -4.3], [-4.4, 4.4, 4.3, 4.45]]) b.add(boxGeo(V(x0, y + 0.95, z0), V(x1, y + 1.05, z1)), wood); // rails
    }
    // gable roof along x, ridge at y 12, open gable ends
    const ridge = 12.5, eave = 8;
    const slope = (s: number) => {
      const g = new THREE.BufferGeometry(), z0 = s * 8.6, pos = [-8.6, eave, z0, 8.6, eave, z0, 8.6, ridge, 0, -8.6, eave, z0, 8.6, ridge, 0, -8.6, ridge, 0];
      if (s < 0) for (let i = 0; i < pos.length; i += 9) { const t = pos.slice(i + 3, i + 6); pos.splice(i + 3, 3, ...pos.slice(i + 6, i + 9)); pos.splice(i + 6, 3, ...t); }
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 4, 0, 4, 2, 0, 0, 4, 2, 0, 2].map((v) => v), 2));
      g.computeVertexNormals(); return g;
    };
    const roofMat = roof; roofMat.side = THREE.DoubleSide;
    b.add(slope(1), roofMat); b.add(slope(-1), roofMat);
    for (const x of [-7.6, 0, 7.6]) b.add(boxGeo(V(x - 0.2, eave, -0.2), V(x + 0.2, ridge, 0.2)), wood);
    b.build(this.shed);
    this.root.add(this.shed);
  }
  private buildBurnt() {
    const b = new Batch(), D = PIT_D, ch = lam("char", () => ({ color: "#3a2e30" })), ash = lam("ash", () => ({ color: "#6a6068" }));
    let s = 3;
    const rr = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (const x of [-7.6, 0, 7.6]) for (const z of [-7.6, 7.6]) b.add(boxGeo(V(x - 0.22, -D, z - 0.22), V(x + 0.22, -D + 2 + rr() * 6, z + 0.22)), ch);
    for (const x of [-7.6, 7.6]) b.add(boxGeo(V(x - 0.22, -D, -0.22), V(x + 0.22, -D + 2 + rr() * 5, 0.22)), ch);
    // fallen beams lying across the pit floor
    for (let k = 0; k < 7; k++) {
      const a = rr() * Math.PI, x = (rr() - 0.5) * 10, z = (rr() - 0.5) * 10;
      if (Math.hypot(x, z) < 4) continue;
      b.add(new THREE.BoxGeometry(5 + rr() * 3, 0.35, 0.35).rotateZ((rr() - 0.5) * 0.4).rotateY(a).translate(x, -D + 0.3, z), ch);
    }
    b.add(flat(-7, 7, -7, 7, -D + 0.01, 3), ash);
    b.build(this.burnt);
    this.root.add(this.burnt, this.weeds);
    const wb = new Batch(), leaf = lam("weed", () => ({ color: "#4f8a3c" })), leaf2 = lam("weed2", () => ({ color: "#3f7a33" }));
    for (let k = 0; k < 40; k++) {
      const x = (rr() - 0.5) * 13, z = (rr() - 0.5) * 13;
      if (Math.hypot(x, z) < 3.6) continue;
      const h = 0.6 + rr() * 1.6;
      wb.add(new THREE.ConeGeometry(0.35 + rr() * 0.4, h, 5).translate(x, -D + h / 2, z), k % 2 ? leaf : leaf2);
      if (k % 5 === 0) wb.add(new THREE.SphereGeometry(0.7 + rr() * 0.6, 8, 6).translate(x, -D + 0.5, z), leaf);
    }
    wb.build(this.weeds);
  }
  private buildTripod() {
    const b = new Batch(), wood = lam("shedBeam", () => ({ map: beamHD() })), apex = V(0, 17, 0);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4, foot = V(Math.sin(a) * 10.5, 0, Math.cos(a) * 10.5);
      const len = foot.distanceTo(apex), mid = foot.clone().add(apex).multiplyScalar(0.5);
      const g = new THREE.CylinderGeometry(0.28, 0.36, len, 8);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), apex.clone().sub(foot).normalize())); g.translate(mid.x, mid.y, mid.z);
      b.add(g, wood);
    }
    b.add(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 12).rotateZ(Math.PI / 2).translate(0, 17, 0), wood);
    for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.6, 0.6, 3, 12).rotateX(Math.PI / 2).translate(s * 12, 0.9, 6), wood); // winches
    b.build(this.tripod);
    const rope = lam("rope", () => ({ color: "#6a5232" }));
    for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6), rope); this.ropes.push(m); this.tripod.add(m); }
    this.root.add(this.tripod);
  }
  private buildPedestal() {
    const b = new Batch(), g = lam("granite", () => ({ map: stoneHD("wallHD") }));
    const [x, z] = PED;
    b.add(cyl(5.2, 5.2, 0.5, 8, x, 0, z), g); b.add(cyl(4.4, 4.2, 1.4, 8, x, 0.5, z), g); b.add(cyl(4.6, 4.6, 0.3, 8, x, 1.9, z), g);
    b.build(this.pedestal); this.root.add(this.pedestal);
  }
  private buildFlashback() {
    const wood = lam("shedBeam", () => ({ map: beamHD() })), roof = lam("fbRoof", () => ({ color: "#7a4a32" }));
    { // 1600: a wooden belfry, bell hanging under its roof
      const b = new Batch(), [x, z] = FB1;
      for (const [dx, dz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) b.add(boxGeo(V(x + dx - 0.25, 0, z + dz - 0.25), V(x + dx + 0.25, 9, z + dz + 0.25)), wood);
      b.add(boxGeo(V(x - 2.6, 8.6, z - 0.25), V(x + 2.6, 9.1, z + 0.25)), wood);
      b.add(new THREE.ConeGeometry(4.2, 3.2, 4).rotateY(Math.PI / 4).translate(x, 10.7, z), roof);
      for (const y of [3, 6]) b.add(boxGeo(V(x - 2.5, y, z - 2.5), V(x + 2.5, y + 0.25, z - 2.0)), wood);
      b.build(this.fb1);
    }
    { // 1655: a heavy timber frame by the old bell tower
      const b = new Batch(), [x, z] = FB2;
      for (const dx of [-4, 4]) for (const dz of [-1.2, 1.2]) b.add(boxGeo(V(x + dx - 0.35, 0, z + dz - 0.35), V(x + dx + 0.35, 9.5, z + dz + 0.35)), wood);
      b.add(boxGeo(V(x - 4.6, 9.3, z - 0.5), V(x + 4.6, 10.1, z + 0.5)), wood);
      b.build(this.fb2);
    }
    this.root.add(this.fb1, this.fb2);
  }
  private buildKitchen() {
    const b = new Batch(), [kx, ky, kz] = KIT;
    const plank = lam("kFloor", () => ({ map: planksHD() })), wall = lam("kWall", () => ({ color: "#e9d9bc" })), wood = lam("kTable", () => ({ map: beamHD() }));
    const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: THREE.Material) => b.add(boxGeo(V(kx + x0, ky + y0, kz + z0), V(kx + x1, ky + y1, kz + z1)), m);
    box(-6, -0.2, -4, 6, 0, 4, plank);
    box(-6, 0, -4.2, 6, 4, -4, wall); box(-6.2, 0, -4.2, -6, 4, 4, wall);
    box(-1.3, 2.4, -4.25, 1.3, 3.6, -4.05, lam("kWin", () => ({ color: "#2a2d6a" }))); // night window
    box(-1.45, 2.3, -4.0, 1.45, 2.4, -3.85, wood);
    box(-1.6, 0.85, -1.6, 1.6, 0.97, 0.2, wood);
    for (const [x, z] of [[-1.45, -1.45], [1.45, -1.45], [-1.45, 0.05], [1.45, 0.05]]) box(x - 0.07, 0, z - 0.07, x + 0.07, 0.85, z + 0.07, wood);
    box(-5.8, 0, -3.9, -3.6, 1.0, -2.9, wood); box(-5.8, 1.9, -4.0, -3.4, 2.0, -3.6, wood); // stove bench + shelf
    b.build(this.kitchen);
    this.kLamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.5, 1.5), fog: false });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), this.kLamp); lamp.position.set(kx, ky + 3.1, kz - 0.7); lamp.layers.set(NOINK);
    this.kitchen.add(lamp);
    this.root.add(this.kitchen);
  }

  /** camera-relative sun, frozen per shot */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light], S = sceneAt(id, t);
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden") Rr = Math.max(Rr, 30);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden" && S.place !== "kitchen";
    this.sunDisc.visible = showSun;
    if (showSun) { this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900); this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7))); }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i]; m.lookAt(cam.position.x, m.position.y, cam.position.z);
      (m.material as THREE.MeshBasicMaterial).map = this.cloudMaps[s.light][i % 4];
    }
    // ---- story props ----
    this.pit.visible = S.pit; this.lid.visible = !S.pit;
    this.shed.visible = S.shed; this.burnt.visible = S.burnt;
    this.weeds.visible = S.weeds > 0.02; this.weeds.scale.set(1, Math.max(0.02, S.weeds), 1); this.weeds.position.y = -PIT_D * (1 - Math.max(0.02, S.weeds));
    this.tripod.visible = S.tripod; this.pedestal.visible = S.pedestal;
    this.fb1.visible = this.bell1.group.visible = S.place === "flash";
    this.fb2.visible = this.bell2.group.visible = S.place === "flash";
    this.kitchen.visible = S.place === "kitchen";
    const B = this.bell;
    B.group.visible = S.place !== "kitchen" && S.place !== "flash";
    B.group.position.set(...S.bellPos);
    B.group.rotation.set(0, S.bellYaw, 0);
    B.pose({ cracks: S.cracks, glow: S.glow, cold: S.cold, fall: S.fall, scale: S.bellScale, innerGlow: S.innerGlow });
    if (S.detach) {
      const [out, down, lean] = S.detach, mid = 0.08 * Math.PI + 0.31;
      B.piece.rotation.set(0, 0, 0); B.piece.quaternion.identity();
      B.piece.position.set(Math.sin(mid) * out, -down, Math.cos(mid) * out);
      B.piece.rotateOnAxis(V(Math.cos(mid), 0, -Math.sin(mid)), -lean);
    }
    for (let k = 0; k < this.ropes.length; k++) {
      const a = (k / 4) * Math.PI * 2, top = V(Math.sin(a) * 0.7, 17, Math.cos(a) * 0.7);
      const bot = V(S.bellPos[0] + Math.sin(a) * 1.2, S.bellPos[1] + 5.9, S.bellPos[2] + Math.cos(a) * 1.2);
      const r = this.ropes[k], len = top.distanceTo(bot);
      r.position.copy(top).add(bot).multiplyScalar(0.5); r.scale.set(1, len, 1);
      r.quaternion.setFromUnitVectors(V(0, 1, 0), top.clone().sub(bot).normalize());
    }
    if (S.place === "flash") {
      this.bell1.group.position.set(FB1[0] + S.fb1[0], S.fb1[1], FB1[1] + S.fb1[2]); this.bell1.group.rotation.set(S.fb1[3], 0, S.fb1[3] * 0.4);
      this.bell1.pose({ cracks: S.fb1[3] > 0.2 ? 6 : 0, glow: S.fb1[4], scale: 0.42 });
      this.bell2.group.position.set(FB2[0] + S.fb2[0], S.fb2[1], FB2[1] + S.fb2[2]); this.bell2.group.rotation.set(0, 0, -S.fb2[3]);
      this.bell2.pose({ cracks: S.fb2[3] > 0.2 ? 9 : 0, glow: S.fb2[4], scale: 0.72 });
    }
    this.kLamp.color.setRGB(3.2, 2.5, 1.5);
    // fire light: warm flicker from the burning casting house
    this.fireLight.intensity = S.fire * (34 + 8 * Math.sin(t * 23) + 5 * Math.sin(t * 37));
    this.fireLight.position.set(...S.firePos);
    // smoke columns over the fire
    for (const sm of this.smoke) {
      sm.m.visible = S.smoke > 0.01;
      if (!sm.m.visible) continue;
      const u = (t * 0.12 + sm.k) % 1, sz = 5 + u * 16;
      sm.m.position.set(S.firePos[0] + (sm.k - 0.5) * 8 + u * 10, S.firePos[1] + 4 + u * 26, S.firePos[2] + (sm.k * 7 % 1 - 0.5) * 6);
      sm.m.scale.set(sz, sz, 1); sm.m.quaternion.copy(cam.quaternion);
      sm.mat.opacity = 0.8 * S.smoke * (1 - u) ** 1.2;
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, S, { pos: cam.position, right });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5 * sc2))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(!!p.soft);
      e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1);
      (e.mesh.material as THREE.MeshBasicMaterial).color.setScalar(p.hdr ?? 1);
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    return focus;
  }
}

/** horizontal quad facing up at height y covering x0..x1, z0..z1, texture every `tile` metres */
function flat(x0: number, x1: number, z0: number, z1: number, y: number, tile: number) {
  const g = new THREE.BufferGeometry(), u = (x1 - x0) / tile, v = (z1 - z0) / tile;
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}
