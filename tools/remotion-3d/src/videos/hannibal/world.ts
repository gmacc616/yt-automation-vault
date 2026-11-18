// The Alps, 218 BC, as one three.js scene: sky, the mountains with the ledge path and the landslide scar, the boulder
// (fire, glow, vinegar steam, cold skin, split), the log pile, the pine grove and the falling tree, the zigzag path,
// snowfall, and a night room far above (Livy's study / the kitchen for the glass dish).
// update(id, f, camera) poses everything for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile, getInputProps } from "remotion";
import { Batch, boxGeo, V, lam, Kit, Ray, setSight, prop } from "./build";
import { beamHD, planksHD, cloudHD } from "./paint";
import { Pen } from "./toon";
import { LIGHTS, LOOK, LightPreset, LightName } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, ShotDef, sceneAt, KIT, GROVE } from "./story";
import { Terrain, Rock, Logs, Zigzag, ROCK, groundY, pathZ, GAP0 } from "./alps";

// ---------------- assets ----------------
const KENNEY: string[] = [];
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
  private alps = new THREE.Group();
  private rock = new Rock(); private logs = new Logs(); private zig = new Zigzag();
  private tree = new THREE.Group();
  private kitchen = new THREE.Group(); private kLamp!: THREE.MeshBasicMaterial;
  private fireLight = new THREE.PointLight("#ff8a3a", 0, 22, 1.6);
  private smoke: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; k: number }[] = [];
  private snow: THREE.Points; private snowMat: THREE.PointsMaterial;

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
    this.buildAlps(kit);
    this.buildKitchen();
    setSight([]);
    for (let k = 0; k < 14; k++) {
      const mat = new THREE.MeshBasicMaterial({ map: smokeTex(), transparent: true, depthWrite: false, color: new THREE.Color(0.9, 0.85, 0.9) });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.layers.set(NOINK); m.visible = false;
      this.smoke.push({ m, mat, k: k / 14 }); R.add(m);
    }
    // snowfall: flakes in a 40 m box that travels with the lens (positions are a pure function of t)
    const n = 2400, pos = new Float32Array(n * 3);
    this.snowMat = new THREE.PointsMaterial({ map: flakeTex(), color: new THREE.Color(1.15, 1.15, 1.2), size: 0.11, transparent: true, depthWrite: false, alphaTest: 0.05 });
    this.snow = new THREE.Points(new THREE.BufferGeometry(), this.snowMat);
    this.snow.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.snow.frustumCulled = false; this.snow.layers.set(NOINK); this.snow.visible = false;
    R.add(this.snow);
  }

  // ---------------- static scenery ----------------
  private buildAlps(kit: Kit) {
    const A = this.alps, b = new Batch();
    A.add(new Terrain().group);
    // pines: a grove above the path (chopped for the fire), forests down on the valley floor and lower slopes
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let k = 0; k < 26; k++) {
      const x = GROVE - 14 + rnd() * 30, z = pathZ(x) - 6 - rnd() * 16;
      if (Math.abs(x - GROVE - 3) < 2.5 && z > pathZ(x) - 10) continue; // the one that falls is its own object
      prop(b, kit, "tree_cone", x, groundY(x, z) - 0.3, z, 7 + rnd() * 5, rnd() * 6);
    }
    for (let k = 0; k < 420; k++) {
      const x = -300 + rnd() * 700, z = 60 + rnd() * 220, y = groundY(x, z);
      if (y > -112) continue;
      prop(b, kit, "tree_cone", x, y - 0.3, z, 9 + rnd() * 7, rnd() * 6);
    }
    b.build(A);
    const t = new Batch();
    prop(t, kit, "tree_cone", 0, 0, 0, 10, 0.4);
    t.build(this.tree);
    this.tree.position.set(GROVE + 3, groundY(GROVE + 3, pathZ(GROVE + 3) - 7) - 0.3, pathZ(GROVE + 3) - 7);
    A.add(this.tree, this.rock.group, this.logs.group, this.zig.group, this.fireLight);
    this.root.add(A);
    void GAP0;
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
    untone(L.fog, this.fog.color); this.fog.near = S.place === "alps" ? Math.max(L.fogNear, 80) : L.fogNear; this.fog.far = S.place === "alps" ? Math.max(L.fogFar, 1000) : L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden" && S.place !== "kitchen";
    this.sunDisc.visible = showSun;
    if (showSun) { this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900); this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7))); }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i]; m.lookAt(cam.position.x, m.position.y, cam.position.z);
      (m.material as THREE.MeshBasicMaterial).map = this.cloudMaps[s.light][i % 4];
    }
    // ---- story props ----
    this.alps.visible = S.place === "alps";
    this.kitchen.visible = S.place === "kitchen";
    for (const m of this.clouds) m.visible = S.place === "alps";
    this.rock.pose({ glow: S.glow, core: S.core, cold: S.cold, split: S.split, swell: S.swell, wet: S.wet });
    this.logs.group.visible = S.logs > 0.02 && S.split < 0.5;
    this.logs.group.scale.set(1, Math.max(0.02, S.logs), 1);
    this.logs.group.position.y = ROCK[1] * (1 - Math.max(0.02, S.logs));
    this.logs.pose(S.char, S.ember);
    this.zig.pose(S.zig);
    // the falling pine: hinges at its foot toward the path (+z) and slightly along it
    this.tree.rotation.set(1.45 * S.tree ** 2, 0, -0.25 * S.tree ** 2);
    this.kLamp.color.setRGB(3.2, 2.5, 1.5);
    // fire light: warm flicker from the burning logs
    this.fireLight.intensity = S.fire * (12 + 3 * Math.sin(t * 23) + 2 * Math.sin(t * 37)) + S.glow * 5;
    this.fireLight.position.set(ROCK[0] - 4.5, ROCK[1] + 3, ROCK[2] + 1.5);
    const smk = Math.max(S.fire, S.steam * 0.8);
    for (const sm of this.smoke) {
      sm.m.visible = smk > 0.01 && S.place === "alps";
      if (!sm.m.visible) continue;
      const u = (t * 0.14 + sm.k) % 1, sz = 3 + u * 12;
      sm.m.position.set(ROCK[0] - 3 + (sm.k - 0.5) * 5 + u * 6, ROCK[1] + 5 + u * 20, ROCK[2] + (sm.k * 7 % 1 - 0.5) * 4);
      sm.m.scale.set(sz, sz, 1); sm.m.quaternion.copy(cam.quaternion);
      sm.mat.opacity = 0.75 * smk * (1 - u) ** 1.2;
      sm.mat.color.setRGB(0.9 + 0.1 * S.steam, 0.85 + 0.15 * S.steam, 0.9 + 0.1 * S.steam);
    }
    // snowfall around the lens
    this.snow.visible = S.snow > 0.01 && S.place === "alps";
    if (this.snow.visible) {
      const pa = this.snow.geometry.attributes.position as THREE.BufferAttribute, B = 40, c0 = cam.position;
      for (let i = 0; i < pa.count; i++) {
        const h1 = fract(Math.sin(i * 12.9898) * 43758.5453), h2 = fract(Math.sin(i * 78.233) * 12345.678), h3 = fract(Math.sin(i * 39.425) * 24634.6345);
        const fall = (t * (1.1 + 0.6 * h1)) % B;
        const w = (v: number, c: number) => c - B / 2 + mod(v - (c - B / 2), B); // wrap a fixed world flake into the box around the lens
        const x = w(h1 * B * 3 + Math.sin(t * 0.8 + i) * 0.6 + t * 1.3, c0.x);
        const y = w(h2 * B * 3 - fall, c0.y);
        const z = w(h3 * B * 3 + Math.cos(t * 0.7 + i) * 0.6, c0.z);
        pa.setXYZ(i, x, y, z);
      }
      pa.needsUpdate = true;
      this.snow.geometry.setDrawRange(0, Math.floor(pa.count * Math.min(1, S.snow)));
      this.snowMat.color.setScalar(s.light === "night" ? 0.9 : 1.15);
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

const fract = (x: number) => x - Math.floor(x);
const mod = (x: number, m: number) => ((x % m) + m) % m;
const flakeTex = () => {
  const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.55, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
};
