// Autun around 1510 as one three.js scene: sky (stars at night), the cobbled square with houses, church front, market,
// lamp posts (warm practicals at night), wet-weather variants (glossy cobbles, mirror puddles, rain); the barley field;
// the court room; the analogy party room. update(id, f, camera) poses everything for shot `id` at frame f.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile, getInputProps } from "remotion";
import { V, Kit, Ray, setSight } from "./build";
import { cloudHD } from "./paint";
import { Pen } from "./toon";
import { LIGHTS, LOOK, LightPreset, LightName } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, ShotDef, sceneAt } from "./story";
import { Town, Field, Court, Party, LAMPS, LANE, COURT, WATER } from "./medieval";

// ---------------- assets ----------------
const KENNEY = ["cart", "lantern", "stall-bench", "banner-red", "banner-green", "windmill", "tree_oak", "tree_default", "plant_bushLarge"];
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
  private town!: Town; private field!: Field; private court = new Court(); private party = new Party();
  private stars: THREE.Points;
  private lamps = [0, 1, 2, 3].map(() => new THREE.PointLight("#ffb060", 0, 16, 1.5));
  private rain: THREE.LineSegments; private rainMat: THREE.LineBasicMaterial;
  private moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!; const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64); gr.addColorStop(0, "rgba(255,250,230,1)"); gr.addColorStop(0.42, "rgba(255,245,220,1)"); gr.addColorStop(0.5, "rgba(200,210,255,0.35)"); gr.addColorStop(1, "rgba(120,140,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })(), color: new THREE.Color(1.8, 1.8, 1.9), fog: false, depthWrite: false }));

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
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)), night: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.night.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK); this.clouds.push(m); R.add(m);
    }
    setSight(sightLines());
    this.town = new Town(kit); this.field = new Field(kit);
    R.add(this.town.group, this.field.group, this.court.group, this.party.group, ...this.lamps);
    this.moon.layers.set(NOINK); this.moon.renderOrder = -0.6; this.moon.frustumCulled = false; R.add(this.moon);
    // rain: short falling streaks in a box around the lens (pure function of t)
    const rp = new Float32Array(1800 * 6);
    this.rainMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.75, 0.8, 0.95), transparent: true, opacity: 0.55, fog: false, depthWrite: false });
    this.rain = new THREE.LineSegments(new THREE.BufferGeometry(), this.rainMat);
    this.rain.geometry.setAttribute("position", new THREE.BufferAttribute(rp, 3));
    this.rain.frustumCulled = false; this.rain.layers.set(NOINK); R.add(this.rain);
    setSight([]);
    // night sky: stars on a far dome
    const sp: number[] = [];
    for (let i = 0; i < 1600; i++) { const u = Math.random() * 2 - 1, a2 = Math.random() * 6.283, y = Math.abs(u) * 0.95 + 0.05, r2 = Math.sqrt(1 - y * y); sp.push(r2 * Math.cos(a2) * 1000, y * 1000, r2 * Math.sin(a2) * 1000); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: new THREE.Color(1.6, 1.6, 1.8), size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false; this.stars.layers.set(NOINK); this.stars.renderOrder = -0.8; R.add(this.stars);
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
    untone(L.fog, this.fog.color); this.fog.near = s.light === "night" ? 14 : s.light === "golden" ? 50 : 30; this.fog.far = s.light === "night" ? 170 : s.light === "golden" ? 420 : 320;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden" && (S.place === "town" || S.place === "field");
    this.sunDisc.visible = showSun;
    if (showSun) { this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900); this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7))); }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i]; m.lookAt(cam.position.x, m.position.y, cam.position.z);
      (m.material as THREE.MeshBasicMaterial).map = this.cloudMaps[s.light][i % 4];
    }
    // ---- story props ----
    const outside = S.place === "town" || S.place === "field";
    this.town.group.visible = S.place === "town";
    this.field.group.visible = S.place === "field";
    this.court.group.visible = S.place === "court";
    this.party.group.visible = S.place === "party";
    const night = s.light === "night";
    for (const m of this.clouds) m.visible = outside && !night;
    this.stars.visible = outside && night && !S.wet;
    this.stars.position.copy(cam.position);
    this.town.setWeather(S.wet, night, S.rain); WATER.t.value = t;
    if (S.place === "field") this.field.sway(t);
    if (S.place === "court") { this.court.dust.position.set(0.15 * Math.sin(t * 0.3), -0.05 * t % 1, 0.1 * Math.cos(t * 0.27)); }
    this.moon.visible = outside && night && S.rain < 0.01; if (this.moon.visible) { this.moon.position.copy(cam.position).add(this.v.set(-0.35, 0.5, -0.8).normalize().multiplyScalar(800)); this.moon.scale.setScalar(75); }
    // practical lights: the four lamp posts nearest the lens (night), candles in the court
    const lampPts = S.place === "court" ? [[COURT[0] - 2.8, COURT[1] + 2.4, COURT[2] - 8.8], [COURT[0] + 2.8, COURT[1] + 2.4, COURT[2] - 8.8], [COURT[0] - 9.4, COURT[1] + 3.2, COURT[2]], [COURT[0] + 9.4, COURT[1] + 3.2, COURT[2]]]
      : [...LAMPS, ...Array.from({ length: 5 }, (_, i) => [LANE[0] - 6 + i * 11, 0, LANE[2] + (i % 2 ? 4 : -4)])].map((p) => [p[0] + 0.5, 2.8, p[2]])
        .sort((p, q) => Math.hypot(p[0] - cam.position.x, p[2] - cam.position.z) - Math.hypot(q[0] - cam.position.x, q[2] - cam.position.z)).slice(0, 4);
    this.lamps.forEach((l, i) => { const p = lampPts[i]; l.position.set(p[0], p[1], p[2]); l.intensity = S.place === "court" ? 9 : night && S.place === "town" ? 14 : 0; });
    // rain
    this.rain.visible = S.rain > 0.01 && outside;
    if (this.rain.visible) {
      const pa = this.rain.geometry.attributes.position as THREE.BufferAttribute, B = 18, c0 = cam.position;
      const w = (v: number, c: number) => c - B / 2 + (((v - (c - B / 2)) % B) + B) % B;
      for (let i = 0; i < 1800; i++) {
        const h1 = Math.sin(i * 12.9898) * 43758.5453 % 1, h2 = Math.sin(i * 78.233) * 12345.678 % 1, h3 = Math.sin(i * 39.425) * 24634.6345 % 1;
        const x = w(Math.abs(h1) * B * 4 + t * 1.5, c0.x), y = w(Math.abs(h2) * B * 4 - t * 14, c0.y), z = w(Math.abs(h3) * B * 4, c0.z);
        pa.setXYZ(2 * i, x, y, z); pa.setXYZ(2 * i + 1, x - 0.04, y - 0.55, z);
      }
      pa.needsUpdate = true;
      this.rain.geometry.setDrawRange(0, Math.floor(3600 * Math.min(1, S.rain)));
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, S, { pos: cam.position, right });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (cam.position.distanceTo(this.v.set(p.x, p.y + 1.0 * sc2, p.z)) < 1.4 * sc2) continue; // never fly through a character
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
