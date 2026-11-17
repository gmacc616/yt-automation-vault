// The whole film as one three.js scene: sky, Lake Peigneur (terrain, water with the whirlpool, rig, barges, tug, skiff,
// the falling spit, banks with trees, Jefferson Island, the canal and its waterfall) and three far sets (cut-away,
// salt mine, night kitchen) plus the cast. update(id, f, camera) poses everything for shot `id` at frame f.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile, getInputProps } from "remotion";
import { Batch, V, Kit, Ray, kitClone, prop, house, setSight, boxGeo, lam } from "./build";
import { ctex, waterNear, waterFar, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset, LightName } from "./lights";
import { TONE, CHAR, LFB, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, SHOTS, camAt, V3, FOREGROUND, ShotDef, stateOf, rigMatrix, bargeAt, cutAt, kitchenAt, mineAt, SKIFF, LakeState } from "./story";
import {
  Terrain, Spit, Rig, makeBarge, makeTug, makeSkiff, Cutaway, Mine, Kitchen, HOLE, BANK, BED, ISLE, CANAL_X0, CANAL_Z, PIT_OUT, PIT_IN, MINE,
  shoreR, groundY, onSpit, pitY, CUT_LEVELS, CUT,
} from "./lake";

// ---------------- assets ----------------
const KENNEY = ["tree_oak", "tree_default", "tree_fat", "tree-high-round", "plant_bushLarge"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
/** falling-water streaks for the waterfall / mine pour (scrolled along v) */
const fallTex = () => ctex("fallStreaks", 256, 512, (g, r) => {
  g.fillStyle = "#4aa6d6"; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 90; i++) {
    const x = r() * 256, w = 2 + r() * 8, y = r() * 512, h = 40 + r() * 160;
    g.fillStyle = r() > 0.4 ? "rgba(225,245,255,0.55)" : "rgba(20,80,140,0.35)";
    for (const oy of [-512, 0, 512]) g.fillRect(x, y + oy, w, h);
  }
});
const mistTex = () => ctex("mist", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,0.8)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});

/** every lens position of the lake shots looking at its subject (trees and houses there are left out) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) if (s.place === "lake") for (let f = s.a - 8; f < s.b + 8; f += 2) {
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

/** a ribbon along a centre line (points with half widths), uv v = distance along it */
const ribbon = (pts: [number, number, number, number][], side = V(0, 0, 1)) => {
  const pos: number[] = [], uv: number[] = [];
  let v = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0, z0, w0] = pts[i], [x1, y1, z1, w1] = pts[i + 1], d = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    const a = [x0 - side.x * w0, y0, z0 - side.z * w0], b = [x0 + side.x * w0, y0, z0 + side.z * w0], c = [x1 + side.x * w1, y1, z1 + side.z * w1], e = [x1 - side.x * w1, y1, z1 - side.z * w1];
    pos.push(...a, ...b, ...c, ...a, ...c, ...e);
    uv.push(0, v / 20, 1, v / 20, 1, (v + d) / 20, 0, v / 20, 1, (v + d) / 20, 0, (v + d) / 20);
    v += d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  return g;
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private WU: Record<string, THREE.IUniform>;
  private water: THREE.Mesh;
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<LightName, THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private lake = new THREE.Group();
  private spit = new Spit();
  private rig = new Rig();
  private barges: THREE.Group[] = [];
  private skiff = makeSkiff();
  private cut = new Cutaway();
  private mine = new Mine();
  private kit = new Kitchen();
  private fall: THREE.Mesh; private pours: THREE.Mesh[] = []; private fallMap: THREE.Texture;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
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
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
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
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- the lake world ----
    const L = this.lake;
    L.add(new Terrain().group);
    setSight(sightLines());
    const b = new Batch();
    // trees around the shore (cypress-tall, oaks, bushes), none on the spit, in the canal or on the island top
    let seed = 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let k = 0; k < 520; k++) {
      const th = rnd() * Math.PI * 2, r = shoreR(th) + 5 + rnd() ** 1.6 * 70, x = r * Math.cos(th), z = r * Math.sin(th);
      if (onSpit(x, z) || (Math.abs(z - CANAL_Z) < 12 && x > CANAL_X0 - 6) || Math.hypot(x - ISLE[0], z - ISLE[2]) < 24) continue;
      const kind = ["tree-high-round", "tree_oak", "tree_fat", "plant_bushLarge", "tree-high-round"][k % 5];
      prop(b, kit, kind, x, groundY(x, z), z, kind === "plant_bushLarge" ? 2.2 : 9 + rnd() * 7, rnd() * 6);
    }
    // Jefferson Island: the mansion on the hill, live oaks around it
    house(b, ISLE[0], ISLE[2] + 4, 0, 14, 10, 7.5, 3, groundY(ISLE[0], ISLE[2]) - 0.3);
    for (let k = 0; k < 26; k++) {
      const a = k * 2.4, r = 14 + (k % 5) * 6, x = ISLE[0] + r * Math.cos(a), z = ISLE[2] + r * Math.sin(a);
      prop(b, kit, k % 3 ? "tree_oak" : "tree_fat", x, groundY(x, z), z, 10 + (k % 4) * 2, a);
    }
    // a few houses of Delcambre out along the canal
    [[215, 34], [240, -40], [262, 30], [290, -34], [228, 70]].forEach(([x, z], i) => house(b, x, z, z > 0 ? Math.PI : 0, 9, 8, 7, i + 1, BANK));
    // the canal walls: short timber piling at the mouth
    for (const s of [-1, 1]) for (let k = 0; k < 9; k++) b.add(new THREE.CylinderGeometry(0.3, 0.3, 3.2, 8), lam("piling", () => ({ color: "#7a5a3a" })), new THREE.Matrix4().makeTranslation(CANAL_X0 + 2 + k * 3.5, BANK - 1.2, CANAL_Z + s * 7.3));
    b.build(L);
    // the spit and its trees (posed when it falls)
    for (let k = 0; k < 40; k++) {
      const a = k * 2.399, r = 4 + Math.sqrt(k) * 4.2, x = 104 + r * Math.cos(a), z = 52 + r * Math.sin(a);
      if (!onSpit(x, z)) continue;
      const o = kitClone(kit, ["tree-high-round", "tree_oak", "tree_fat"][k % 3], 9 + (k % 4) * 2);
      if (o) { o.position.set(x, groundY(x, z), z); o.rotation.y = a; o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) m.castShadow = true; }); this.spit.group.add(o); }
    }
    L.add(this.spit.group);
    // water: polar disc over the lake with the whirlpool (vertex funnel + swirling marks)
    const wNear = waterNear(), wFar = waterFar();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.56, 0.72) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 },
      uHole: { value: new THREE.Vector2(HOLE[0], HOLE[2]) }, uVd: { value: 0 }, uVr: { value: 20 }, uSw: { value: 0 },
    };
    const waterM = new THREE.MeshLambertMaterial({ color: 0xffffff });
    waterM.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.WU);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWP;\nuniform vec2 uHole; uniform float uVd, uVr;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\n{ float d = distance(position.xz, uHole); transformed.y -= uVd * exp(-pow(d / uVr, 2.0)) * (1.0 - smoothstep(48.0, 66.0, d)); }")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", WATER_DECL)
        .replace("#include <map_fragment>", WATER_COL)
        .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
        .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n  reflectedLight.directDiffuse = diffuseColor.rgb * mix(wShade, vec3(1.0), sunVis);\n  reflectedLight.indirectDiffuse = vec3(0.0);");
    };
    waterM.customProgramCacheKey = () => "lake1";
    const wg = (() => {
      const pos: number[] = [], idx: number[] = [], NR = 70, NT = 300;
      for (let j = 0; j <= NT; j++) { const th = (j / NT) * Math.PI * 2, rr = shoreR(th) + 8; for (let i = 0; i <= NR; i++) { const r = rr * (i / NR) ** 0.9; pos.push(r * Math.cos(th), 0, r * Math.sin(th)); } }
      for (let j = 0; j < NT; j++) for (let i = 0; i < NR; i++) { const a = j * (NR + 1) + i, b2 = a + 1, c = a + NR + 2, d = a + NR + 1; idx.push(a, c, b2, a, d, c); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    })();
    this.water = new THREE.Mesh(wg, waterM);
    this.water.receiveShadow = true; this.water.frustumCulled = false;
    L.add(this.water);
    L.add(this.rig.group);
    for (let i = 0; i < 12; i++) { const g = i === 11 ? makeTug() : makeBarge(i); this.barges.push(g); L.add(g); }
    L.add(this.skiff);
    // the canal flowing backwards and the waterfall into the pit (a ribbon from the canal over the bed and down the wall)
    this.fallMap = fallTex();
    const fallM = new THREE.MeshBasicMaterial({ map: this.fallMap, side: THREE.DoubleSide, color: new THREE.Color(1.05, 1.05, 1.05) });
    const lipX = HOLE[0] + Math.sqrt(PIT_OUT ** 2 - HOLE[2] ** 2) - 1, botX = HOLE[0] + Math.sqrt(PIT_IN ** 2 - HOLE[2] ** 2);
    const path: [number, number, number, number][] = [[CANAL_X0 + 70, -0.3, CANAL_Z, 6.5], [CANAL_X0 + 2, -0.5, CANAL_Z, 6.5], [CANAL_X0 - 12, BED + 0.25, CANAL_Z, 7.5], [lipX + 2, BED + 0.2, CANAL_Z, 8]];
    for (let k = 1; k <= 10; k++) { const u = k / 10, x = lipX + (botX - lipX) * u ** 0.6; path.push([x, Math.min(pitY(x, CANAL_Z), BED) + 0.4 - 0 * u, CANAL_Z, 8 + u * 5]); }
    this.fall = new THREE.Mesh(ribbon(path), fallM);
    this.fall.receiveShadow = true;
    L.add(this.fall);
    R.add(L);

    // ---- far sets ----
    R.add(this.cut.group, this.mine.group, this.kit.group);
    // water pouring through the mine roof: two crossed sheets
    for (const r of [0, Math.PI / 2]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 14).translate(0, -7, 0), fallM);
      m.rotation.y = r; this.pours.push(m); this.mine.group.add(m);
    }
    for (const fg of FOREGROUND) {
      const o = kitClone(kit, fg.kit, fg.s ?? 1);
      if (!o) continue;
      o.position.set(...fg.pos); o.rotation.y = fg.yaw ?? 0; o.visible = false;
      this.fgs.push({ o, a: fg.a, b: fg.b }); R.add(o);
    }
    void boxGeo; void mistTex;
  }

  /** camera-relative sun, frozen per shot: the shot's mean view direction turned by az toward screen right, lifted by el */
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

  private poseLake(S: LakeState, t: number) {
    this.water.position.y = S.wl;
    this.WU.uVd.value = S.vd; this.WU.uVr.value = S.vr; this.WU.uSw.value = S.swirl;
    // rig
    this.rig.group.visible = S.rigOn;
    this.rig.group.matrixAutoUpdate = false; this.rig.group.matrix.copy(rigMatrix(S)); this.rig.group.matrixWorldNeedsUpdate = true;
    this.rig.pose(S.pipe, S.spin);
    // barges + tug
    this.barges.forEach((g, i) => {
      const p = bargeAt(S, i);
      g.visible = p.on;
      g.position.set(p.x, p.y, p.z); g.rotation.set(p.roll, p.yaw, 0, "YXZ");
    });
    // skiff: drifting by the rig before, gone after
    // skiff: drifting by the rig before; stranded on the mud when the lake has gone
    const stranded = S.barges === "gone";
    this.skiff.visible = S.barges === "moored" || stranded;
    if (stranded) { this.skiff.position.set(18, BED + 0.25, 40); this.skiff.rotation.set(0.12, 0.7, 0.18); }
    else { this.skiff.position.set(SKIFF[0], 0.05 * Math.sin(t * 1.5), SKIFF[2]); this.skiff.rotation.set(0.02 * Math.sin(t * 1.1), 0.7, 0.03 * Math.sin(t * 1.4)); }
    // the spit: slides toward the hole, tips in and drops
    const k = S.spit, sp = this.spit.group;
    if (k > 0) {
      const pv = V(100, BANK, 46), dir = V(HOLE[0] - pv.x, 0, HOLE[2] - pv.z).normalize(), ax = V(0, 1, 0).cross(dir).normalize();
      sp.matrixAutoUpdate = false;
      sp.matrix.makeTranslation(pv.x + dir.x * 26 * k, pv.y - 58 * k ** 1.6, pv.z + dir.z * 26 * k)
        .multiply(new THREE.Matrix4().makeRotationAxis(ax, 1.0 * k)).multiply(new THREE.Matrix4().makeTranslation(-pv.x, -pv.y, -pv.z));
      sp.matrixWorldNeedsUpdate = true;
    } else { sp.matrixAutoUpdate = false; sp.matrix.identity(); sp.matrixWorldNeedsUpdate = true; }
    sp.visible = k < 0.999;
    if (!sp.visible) sp.matrix.makeTranslation(0, -900, 0); // gone: out of every ray (check.ts casts against hidden meshes too)
    // the waterfall
    this.fall.visible = S.fall > 0.05;
    this.fallMap.offset.y = -t * 1.6;
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light], S = stateOf(id, t);
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 140);
    if (s.light === "golden" && s.place === "lake") Rr = Math.max(Rr, 30);
    this.sun.position.copy(focus).addScaledVector(sunDir, 260); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 560; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = s.place === "lake" ? 140 : L.fogNear; this.fog.far = s.place === "lake" ? 1050 : L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden" && s.place === "lake";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z); m.visible = s.place === "lake";
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    const W = this.WU, wc = K.water;
    untone(wc.near, W.wNearC.value); untone(wc.mid, W.wMidC.value); untone(wc.far, W.wFarC.value);
    untone(wc.crest, W.wCrest.value); untone(wc.trough, W.wTrough.value); untone(wc.glint, W.wGlint.value);
    W.wShade.value.set(...wc.shade); W.wTime.value = t;
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b && g.a < s.b && g.b > s.a;
    // ---- places ----
    this.lake.visible = s.place === "lake";
    this.cut.group.visible = s.place === "cut";
    this.mine.group.visible = s.place === "mine";
    this.kit.group.visible = s.place === "kitchen";
    if (s.place === "lake") this.poseLake(S, s.tau ? s.tau(t) : t);
    if (s.place === "cut") { const q = cutAt(id, t); this.cut.pose(q.tip, q.cav, q.lake, q.funnel, q.rig, q.bit); }
    if (s.place === "mine") {
      const q = mineAt(id, t), [mx, my, mz] = MINE;
      this.mine.floodM.position.set(mx, my + 0.06, mz); this.mine.floodM.scale.setScalar(q.flood); this.mine.floodM.visible = q.flood > 0.5;
      this.mine.cage.position.set(mx + Mine.SHAFT[0], my + q.cage, mz + Mine.SHAFT[2]);
      for (const p of this.pours) { p.position.set(mx, my + Mine.CEIL, mz); p.scale.set(1, Math.max(0.01, q.pour), 1); p.visible = q.pour > 0.01; }
      this.fallMap.offset.y = -t * 1.6;
    }
    if (s.place === "kitchen") { const q = kitchenAt(t); this.kit.pose(q.drop, q.melt); }
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
      a.mesh.castShadow = L.actorShadow && s.place === "lake";
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
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    void CUT; void CUT_LEVELS;
    return focus;
  }
}

const WATER_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint, wShade;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime, uSw, uVr, uVd;
uniform vec2 uHole;`;
// swirl: the marks rotate around the hole, faster near it; the funnel throat darkens
const WATER_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 rel = vWP.xz - uHole;
  float rd = length(rel);
  float ang = uSw * wTime * 3.0 * (14.0 / (rd + 6.0));
  float ca = cos(ang), sa = sin(ang);
  vec2 wp = uHole + vec2(ca * rel.x - sa * rel.y, sa * rel.x + ca * rel.y) + vec2(0.15 * wTime, 0.0) * (1.0 - uSw);
  vec2 tang = normalize(vec2(-rel.y, rel.x) + 1e-4);
  vec2 sw = vec2(dot(rel, normalize(rel + 1e-4)) * 0.6, atan(rel.y, rel.x) * rd * 0.25);
  vec4 mk = mix(texture2D(wNearTex, wp / 8.0), texture2D(wFarTex, wp / 40.0 + 0.37), smoothstep(25.0, 90.0, wd));
  vec4 mk2 = texture2D(wFarTex, vec2(sw.x / 12.0, sw.y / 10.0 - wTime * 0.6));
  mk = mix(mk, max(mk, mk2 * 1.4), uSw * exp(-pow(rd / (uVr * 1.6), 2.0)));
  wc = mix(wc, wTrough, mk.g * 0.6);
  wc = mix(wc, wCrest, mk.r * 0.7);
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  wc = mix(wc, wTrough * 0.55, uSw * smoothstep(0.35, 1.0, exp(-pow(rd / max(uVr * 0.35, 1.0), 2.0))) * step(1.0, uVd));
  diffuseColor.rgb = wc;
  float _u = tang.x; _u += 0.0;`;
