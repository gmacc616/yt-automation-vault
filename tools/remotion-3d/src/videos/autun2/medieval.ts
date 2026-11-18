// Autun, around 1510: a cobbled square with half-timbered houses, the church front with steps and a rose window,
// market stalls, barrels, crates, sacks, flower pots, lamp posts (warm practical lights at night), wet-weather variants
// (dark shiny cobbles, reflecting puddles, rain); the barley field outside town with a windmill; the court room inside
// the church; the night lane lined with walls (for the cats); a party room for the analogy. Nothing here knows the
// timeline: world.ts poses everything from story.ts each frame.
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { Batch, lam, boxGeo, prop, house, Kit } from "./build";
import { ctex, cobbleHD, grassHD, stoneHD, planksHD, beamHD, roofHD } from "./paint";
import { twoTone } from "./shade";
import { NOINK } from "./ink";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** murky puddle water: the mirror image is broken up by rain ripples and wind wobble, mixed with muddy brown water by a
 *  Fresnel term (looking down you see the dirty water, at a grazing angle more of the sky and lamps), dark muddy rim */
export const WATER = { t: { value: 0 }, rain: { value: 1 } };
const PuddleShader = {
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: WATER.t, uRain: WATER.rain },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec2 vLocal; varying vec3 vWorld;
    void main(){ vUv = textureMatrix * vec4(position, 1.0); vLocal = position.xy; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float uTime, uRain; varying vec4 vUv; varying vec2 vLocal; varying vec3 vWorld;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec2 p = vWorld.xz;
      // rain rings: one drop per 0.35 m cell, restarting every ~0.7 s at a random phase
      vec2 off = vec2(0.0);
      vec2 cell = floor(p / 0.35);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 c = cell + vec2(float(i), float(j)); float r0 = h(c); vec2 ctr = (c + vec2(h(c + 3.1), h(c + 7.7))) * 0.35;
        float age = fract(uTime * 1.4 + r0); vec2 d = p - ctr; float dist = length(d);
        float ring = sin((dist - age * 0.3) * 60.0) * exp(-abs(dist - age * 0.3) * 30.0) * (1.0 - age);
        off += normalize(d + 1e-4) * ring * 0.015 * uRain;
      }
      off += vec2(sin(p.x * 3.0 + uTime * 1.3), cos(p.y * 2.6 + uTime * 1.1)) * 0.004;
      vec4 refl = texture2DProj(tDiffuse, vUv + vec4(off * vUv.w, 0.0, 0.0));
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = 0.08 + 0.55 * pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
      vec3 mud = vec3(0.16, 0.13, 0.11);
      vec3 col = mix(mud, refl.rgb * color, fres);
      float r = length(vLocal);
      col = mix(col, mud * 0.8, smoothstep(0.75, 1.0, r));
      gl_FragColor = vec4(col, smoothstep(1.0, 0.86, r));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};
const aoTex = () => ctex("aoBlob", 128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, "rgba(20,14,24,0.55)"); gr.addColorStop(0.6, "rgba(20,14,24,0.25)"); gr.addColorStop(1, "rgba(20,14,24,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
let AOM: THREE.MeshBasicMaterial | null = null;
const aoMat = () => (AOM ??= new THREE.MeshBasicMaterial({ map: aoTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
/** soft contact shadow / ambient occlusion pool under a prop (a darkening decal on the ground) */
export const AO: THREE.Mesh[] = [];
export const ao = (x: number, y: number, z: number, rx: number, rz = rx) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), aoMat());
  m.position.set(x, y + 0.012, z); m.scale.set(rx, 1, rz); m.renderOrder = 0.4; m.layers.set(NOINK); AO.push(m);
};
const grassCardTex = () => ctex("weedCard", 128, 128, (g, r) => {
  g.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 14; i++) { const x = 20 + r() * 88, hh = 50 + r() * 70; g.strokeStyle = r() > 0.5 ? "#5a9a3c" : "#7ab54a"; g.lineWidth = 6; g.beginPath(); g.moveTo(x, 128); g.quadraticCurveTo(x + (r() - 0.5) * 30, 128 - hh * 0.6, x + (r() - 0.5) * 40, 128 - hh); g.stroke(); }
});
export type V3 = [number, number, number];
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const hash = (x: number, z: number) => { const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return v - Math.floor(v); };

// ---------------- layout ----------------
export const CHURCH: V3 = [0, 0, -22];     // church front (steps face +z)
export const FIELD: V3 = [0, 0, -400];     // barley field centre, north of town
export const COURT: V3 = [0, 500, 0];      // court room (inside the church), far away
export const PARTY: V3 = [0, 700, 0];      // analogy room
export const LANE: V3 = [60, 0, 20];       // the night lane east of the square, running along +x
export const LAMPS: V3[] = [[-7, 0, 6], [7, 0, 6], [-7, 0, -10], [7, 0, -10]];
export const PUDDLES: [number, number, number, number][] = [[-2.5, 3.0, 2.2, 1.4], [3.4, -2.0, 1.8, 1.2], [0.8, 9.5, 2.6, 1.6], [-4.5, -6, 1.6, 1.1], [LANE[0] + 6, LANE[2] + 0.4, 2.2, 1.0], [LANE[0] + 16, LANE[2] - 0.5, 1.8, 1.0]];

// ---------------- materials ----------------
const barrelTex = () => ctex("barrelHD", 512, 512, (g, r) => {
  g.fillStyle = "#8a5a36"; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 42) { g.fillStyle = `rgba(${60 + r() * 30},${36 + r() * 20},20,0.5)`; g.fillRect(x, 0, 4, 512); g.fillStyle = "rgba(255,210,150,0.15)"; g.fillRect(x + 6, 0, 10, 512); }
  for (const y of [70, 240, 420]) { g.fillStyle = "#3a3a42"; g.fillRect(0, y, 512, 26); g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(0, y + 3, 512, 4); }
});
const clothTex = (c1: string, c2: string) => ctex("stripe" + c1 + c2, 256, 256, (g) => { for (let x = 0; x < 256; x += 32) { g.fillStyle = (x / 32) % 2 ? c1 : c2; g.fillRect(x, 0, 32, 256); } });
const roseTex = () => ctex("roseWin", 512, 512, (g) => {
  g.fillStyle = "#1a1530"; g.fillRect(0, 0, 512, 512);
  const cols = ["#e2453c", "#3f6fb5", "#f2c443", "#7cc36a", "#b57ad0", "#3fa0d0"];
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.fillStyle = cols[k % 6]; g.beginPath(); g.moveTo(256, 256); g.arc(256, 256, 240, a, a + Math.PI / 6); g.fill(); }
  g.fillStyle = "#f2c443"; g.beginPath(); g.arc(256, 256, 60, 0, 7); g.fill();
  g.strokeStyle = "#1a1530"; g.lineWidth = 14; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.moveTo(256, 256); g.lineTo(256 + 250 * Math.cos(a), 256 + 250 * Math.sin(a)); g.stroke(); }
  g.beginPath(); g.arc(256, 256, 244, 0, 7); g.stroke(); g.beginPath(); g.arc(256, 256, 60, 0, 7); g.stroke();
});
const glassTex = () => ctex("tallWin", 256, 512, (g) => {
  const cols = ["#e2453c", "#3f6fb5", "#f2c443", "#7cc36a", "#b57ad0"];
  for (let y = 0; y < 512; y += 64) for (let x = 0; x < 256; x += 64) { g.fillStyle = cols[(x / 64 + y / 64) % 5]; g.fillRect(x, y, 64, 64); }
  g.strokeStyle = "#1a1530"; g.lineWidth = 8; for (let y = 0; y <= 512; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); } for (let x = 0; x <= 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
});
export const COBBLE_DRY = () => lam("cobbleHD", () => ({ map: cobbleHD() }));
/** rain-soaked cobbles: darker, glossy (specular streaks from the lamps), still two-tone shaded */
export const COBBLE_WET = (() => { let m: THREE.MeshPhongMaterial | null = null; return () => {
  if (!m) m = twoTone(new THREE.MeshPhongMaterial({ map: cobbleHD(), color: new THREE.Color(0.62, 0.58, 0.56), specular: new THREE.Color(0.32, 0.31, 0.33), shininess: 45 }), 0.4);
  return m; }; })();
const WOOD = () => lam("woodM", () => ({ map: beamHD() }));
const STONE = () => lam("stoneM", () => ({ map: stoneHD("churchStone", ["#cdbfa8", "#c2b49c", "#d6c9b2", "#bba98f"], "#8f8270") }));
const IRON = () => lam("ironM", () => ({ color: "#3a3a42" }));
const C = (c: string) => lam("col" + c, () => ({ color: c }));

// ---------------- props ----------------
const at = (x: number, y: number, z: number, yaw = 0, s = 1) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(s, s, s));
export const barrel = (b: Batch, x: number, y: number, z: number, s = 1) => {
  const g = new THREE.LatheGeometry([[0.001, 0], [0.36, 0], [0.42, 0.25], [0.44, 0.5], [0.42, 0.75], [0.36, 1.0], [0.001, 1.0]].map(([r, h]) => new THREE.Vector2(r * s, h * s)), 18);
  b.add(g, lam("barrelM", () => ({ map: barrelTex() })), at(x, y, z, hash(x, z) * 6)); ao(x, y, z, 0.7 * s);
};
export const crate = (b: Batch, x: number, y: number, z: number, s = 0.7, yaw = 0) => {
  b.add(new RoundedBoxGeometry(s, s, s, 2, s * 0.06).translate(0, s / 2, 0), WOOD(), at(x, y, z, yaw)); ao(x, y, z, s * 0.9);
};
export const sack = (b: Batch, x: number, y: number, z: number, s = 1) => { b.add(new THREE.SphereGeometry(0.34 * s, 12, 8).scale(1, 1.3, 0.9).translate(0, 0.42 * s, 0), C("#d9c49a"), at(x, y, z)); ao(x, y, z, 0.55 * s); };
export const pot = (b: Batch, x: number, y: number, z: number, h = 0.6, col = "#b5653f", flower = "#e2453c") => {
  b.add(new THREE.LatheGeometry([[0.001, 0], [0.18, 0], [0.24, 0.5], [0.28, 1.0], [0.001, 1.0]].map(([r, hh]) => new THREE.Vector2(r * h * 1.4, hh * h)), 14), C(col), at(x, y, z));
  b.add(new THREE.SphereGeometry(0.28 * h * 1.3, 10, 8).translate(0, h + 0.05, 0), C(flower), at(x, y, z));
};
/** market stall: four posts, a counter, a striped sloped awning, goods on the counter */
const stall = (b: Batch, x: number, z: number, yaw: number, c1: string, c2: string, goods: string[]) => {
  const m = at(x, 0, z, yaw);
  for (const [px, pz, h] of [[-1.3, -0.7, 2.5], [1.3, -0.7, 2.5], [-1.3, 0.7, 2.1], [1.3, 0.7, 2.1]]) b.add(new THREE.CylinderGeometry(0.06, 0.06, h, 6).translate(px, h / 2, pz), WOOD(), m);
  b.add(new RoundedBoxGeometry(2.8, 0.1, 0.65, 2, 0.03).translate(0, 0.9, 0.52), WOOD(), m);
  b.add(new RoundedBoxGeometry(2.7, 0.85, 0.1, 2, 0.03).translate(0, 0.425, 0.78), WOOD(), m); ao(x, 0, z, 1.9, 1.3);
  const cl = new THREE.PlaneGeometry(3.0, 1.9, 1, 1); cl.rotateX(-Math.PI / 2 + 0.2); cl.translate(0, 2.35, 0);
  b.add(cl, lam("aw" + c1, () => ({ map: clothTex(c1, c2), side: THREE.DoubleSide })), m);
  goods.forEach((g2, i) => b.add(new THREE.SphereGeometry(0.13, 10, 8).translate(-1.1 + (i % 9) * 0.27, 1.05, 0.35 + Math.floor(i / 9) * 0.25), C(g2), m));
};
export const lampPost = (b: Batch, x: number, z: number) => {
  ao(x, 0, z, 0.35);
  b.add(new THREE.CylinderGeometry(0.07, 0.1, 3.2, 8).translate(x, 1.6, z), IRON());
  b.add(boxGeo(V(x - 0.04, 3.1, z - 0.04), V(x + 0.55, 3.18, z + 0.04)), IRON());
  b.add(new THREE.CylinderGeometry(0.16, 0.12, 0.42, 6).translate(x + 0.5, 2.85, z), IRON());
};
const flowerBox = (b: Batch, x: number, y: number, z: number, yaw: number) => {
  b.add(boxGeo(V(-0.5, 0, -0.12), V(0.5, 0.2, 0.12)), WOOD(), at(x, y, z, yaw));
  for (let i = 0; i < 5; i++) b.add(new THREE.SphereGeometry(0.1, 8, 6).translate(-0.4 + i * 0.2, 0.28, 0), C(["#e2453c", "#f2c443", "#b57ad0", "#ffffff"][i % 4]), at(x, y, z, yaw));
};

// ---------------- the town square ----------------
export class Town {
  group = new THREE.Group();
  ground: THREE.Mesh;
  puddles: THREE.Object3D[] = [];
  lampMats: THREE.MeshBasicMaterial; windowMat: THREE.MeshBasicMaterial;
  winLit = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.85, 0.6) });
  constructor(kit: Kit) {
    const b = new Batch();
    const g = new THREE.PlaneGeometry(260, 260, 1, 1).rotateX(-Math.PI / 2); const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 52, uv.getY(i) * 52);
    this.ground = new THREE.Mesh(g, COBBLE_DRY()); this.ground.receiveShadow = true; this.group.add(this.ground);
    // the church front: stone block with a gable, steps, a big arched door, the rose window, two towers
    const [cx, , cz] = CHURCH;
    b.add(boxGeo(V(cx - 9, 0, cz - 14), V(cx + 9, 15, cz), 3), STONE());
    b.add(new THREE.CylinderGeometry(0.001, 12.7, 7, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.75).translate(cx, 18.5, cz - 7), lam("churchRoof", () => ({ map: roofHD("#6a7486", true) })));
    for (const s of [-1, 1]) { b.add(boxGeo(V(cx + s * 9 - 2.5, 0, cz - 3), V(cx + s * 9 + 2.5, 24, cz + 1), 3), STONE()); b.add(new THREE.ConeGeometry(3.6, 7, 4).rotateY(Math.PI / 4).translate(cx + s * 9, 27.5, cz - 1), lam("spire", () => ({ map: roofHD("#5a6476", true) }))); }
    for (let i = 0; i < 4; i++) b.add(boxGeo(V(cx - 6 + i * 0.4, 0, cz + 0.1), V(cx + 6 - i * 0.4, 0.22 * (i + 1), cz + 2.6 - i * 0.6)), STONE());
    const arch = new THREE.Shape(); arch.moveTo(-1.8, 0); arch.lineTo(-1.8, 3.2); arch.absarc(0, 3.2, 1.8, Math.PI, 0, true); arch.lineTo(1.8, 0);
    b.add(new THREE.ShapeGeometry(arch, 12).translate(cx, 0.9, cz + 0.02), lam("doorWood", () => ({ map: planksHD() })));
    this.windowMat = new THREE.MeshBasicMaterial({ map: roseTex(), color: new THREE.Color(1, 1, 1) });
    const rose = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), this.windowMat); rose.position.set(cx, 10, cz + 0.05); rose.layers.set(NOINK); this.group.add(rose);
    // houses around the square (half-timbered, from build.ts), with gaps for the lane east
    let k = 0;
    for (const [x, z, yaw, w, h] of [[-14, -6, Math.PI / 2, 9, 7], [-14, 4, Math.PI / 2, 8, 8.4], [-14, 13, Math.PI / 2, 9, 7], [-15, 23, Math.PI / 2, 9, 9.8],
      [14, -6, -Math.PI / 2, 9, 8.4], [14, 4, -Math.PI / 2, 8, 7], [15, 32, -Math.PI / 2, 9, 8.4],
      [-6, 30, Math.PI, 9, 8.4], [4, 31, Math.PI, 8, 7], [-12, -18, 0.4, 8, 7], [12, -18, -0.4, 8, 8.4]] as const) house(b, x, z, yaw, w, 8, h, k++);
    // lane east: two rows of houses with low walls along it
    for (let i = 0; i < 6; i++) { house(b, LANE[0] - 8 + i * 9, LANE[2] - 10, 0, 8, 7, 7 + (i % 3) * 1.4, k++); house(b, LANE[0] - 8 + i * 9, LANE[2] + 10, Math.PI, 8, 7, 7 + ((i + 1) % 3) * 1.4, k++); }
    for (const s of [-1, 1]) b.add(boxGeo(V(LANE[0] - 12, 0, LANE[2] + s * 4.6), V(LANE[0] + 50, 1.4, LANE[2] + s * 5.4), 2), STONE());
    b.add(new THREE.PlaneGeometry(80, 9.2).rotateX(-Math.PI / 2).translate(LANE[0] + 18, 0.01, LANE[2]), COBBLE_DRY());
    // market: stalls, barrels, crates, sacks, pots, carts, benches, banners, flower boxes, a well
    stall(b, -8, 10, 0.25, "#c0453c", "#f4e9d0", ["#e2453c", "#f2c443", "#8ac43a", "#e2453c", "#f2a03a", "#8ac43a", "#e2453c", "#f2c443", "#b57ad0"]);
    stall(b, 8.5, 11, -0.3, "#2f6f6a", "#f4e9d0", ["#d9a24a", "#f2c443", "#d9a24a", "#c98a4a", "#e8d6a0", "#d9a24a", "#f2c443", "#c98a4a", "#e8d6a0"]);
    stall(b, -9, -3, 0.5, "#3f6fb5", "#f2c443", ["#ffffff", "#f4f1ea", "#d9cfc0", "#ffffff", "#f4f1ea", "#d9cfc0"]);
    for (const [x, z] of [[-11, 7], [-10.4, 7.6], [10.8, 8], [11.4, 7.3], [-11.5, -1], [6, -7], [-3, -12.5], [11, -12]]) barrel(b, x, 0, z, 1);
    for (const [x, z, s] of [[-6.5, 12.8, 0.7], [-6.2, 13.5, 0.5], [10.5, 13.6, 0.8], [11.2, 14.2, 0.6], [-12, 0.5, 0.7], [5.5, -12.5, 0.8], [12, 2, 0.7]]) crate(b, x, 0, z, s, x * 0.3);
    for (const [x, z] of [[-7.2, 13.4], [9.4, 13.8], [-12.4, 2.2], [12.4, -2.4], [3, 14]]) sack(b, x, 0, z);
    for (const [x, z, c, f] of [[-4.2, -12.4, "#b5653f", "#e2453c"], [4.2, -12.4, "#b5653f", "#f2c443"], [-12.5, 9.5, "#3f6fb5", "#b57ad0"], [12.5, 18, "#b5653f", "#e2453c"], [-3, 15.5, "#c98a4a", "#f2c443"]] as [number, number, string, string][]) pot(b, x, 0, z, 0.7, c, f);
    for (const [x, z, yaw] of [[3.5, 14.5, 0.4], [-14, 18, 1.4]]) prop(b, kit, "cart", x, 0, z, 1.6, yaw);
    for (const [x, z, yaw] of [[-5, -8, 0], [5, -8, 0]]) prop(b, kit, "stall-bench", x, 0, z, 0.9, yaw);
    for (const [x, z] of [[-6, -14], [6, -14]]) prop(b, kit, "banner-red", x, 0, z, 4.6, 0);
    for (let i = 0; i < 10; i++) flowerBox(b, (i % 2 ? 9.8 : -9.8), 2.4 + (i % 3) * 2.8, -8 + i * 3.6, i % 2 ? -Math.PI / 2 : Math.PI / 2);
    b.add(new THREE.CylinderGeometry(1.4, 1.5, 0.9, 20).translate(0, 0.45, 4), STONE()); ao(0, 0, 4, 2.0);
    for (const [x, z] of [[3.5, 14.5], [-14, 18]]) ao(x, 0, z, 1.6, 1.0);
    for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6).translate(s * 1.2, 1.6, 4), WOOD());
    b.add(boxGeo(V(-1.4, 2.7, 3.7), V(1.4, 2.9, 4.3)), WOOD());
    for (const p of LAMPS) lampPost(b, p[0], p[2]);
    for (let i = 0; i < 5; i++) lampPost(b, LANE[0] - 6 + i * 11, LANE[2] + (i % 2 ? 4 : -4));
    // trees and hedges outside the square (green accents)
    for (const [x, z] of [[-22, 0], [22, 10], [-24, 30], [24, -14], [0, 40], [-18, -30], [20, -30]]) prop(b, kit, "tree_oak", x, 0, z, 8, x);
    // midground + far backdrop (reference: 4-5 depth layers): rows of simple houses with gable roofs and chimneys out to
    // 150 m, church towers, then wooded hills; the fog (= horizon colour) fades them like the reference's haze
    const ringWall = ["#e2c49a", "#d8a95f", "#c47a5c", "#ecdab2", "#cc9a6c", "#ddbd78"], ringRoof = ["#b8644f", "#8f97a8", "#c9775a", "#8e7aa0"];
    for (let i = 0; i < 230; i++) {
      const a2 = hash(i, 11) * Math.PI * 2, r2 = 34 + hash(i, 12) ** 0.7 * 120, x = r2 * Math.cos(a2), z = r2 * Math.sin(a2);
      if (Math.abs(x) < 26 && z > -26 && z < 40) continue; // the square itself
      if (Math.abs(z - LANE[2]) < 14 && x > LANE[0] - 16 && x < LANE[0] + 54) continue; // the lane
      const w = 6 + hash(i, 13) * 4, d = 6 + hash(i, 14) * 3, h = 6 + hash(i, 15) * 5, yaw = Math.round(hash(i, 16) * 4) * Math.PI / 2 + (hash(i, 17) - 0.5) * 0.3;
      const m = at(x, 0, z, yaw);
      b.add(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), C(ringWall[i % 6]), m);
      b.add(new THREE.CylinderGeometry(0.001, Math.hypot(w, d) * 0.5, d * 0.45, 4, 1).rotateY(Math.PI / 4).scale(w / Math.hypot(w, d) * 1.42, 1, d / Math.hypot(w, d) * 1.42).translate(0, h + d * 0.22, 0), C(ringRoof[i % 4]), m);
      if (i % 3 === 0) b.add(new THREE.BoxGeometry(0.7, 2.2, 0.7).translate(w * 0.25, h + 1.4, 0), C("#9a5a42"), m);
      for (let k = 0; k < 3; k++) for (const sy of [0.35, 0.68]) b.add(new THREE.PlaneGeometry(0.8, 1.1).translate(-w / 2 + (k + 0.5) * (w / 3), h * sy, d / 2 + 0.02), (i + k) % 4 === 0 ? this.winLit : C("#3a3448"), m);
    }
    for (const [x, z, h] of [[-70, -120, 30], [95, -60, 26], [-110, 60, 24]]) { b.add(new THREE.BoxGeometry(6, h, 6).translate(x, h / 2, z), STONE()); b.add(new THREE.ConeGeometry(4.6, 12, 4).rotateY(Math.PI / 4).translate(x, h + 6, z), lam("spire", () => ({ map: roofHD("#5a6476", true) }))); }
    for (let i = 0; i < 40; i++) { const a2 = (i / 40) * Math.PI * 2, r2 = 330 + 60 * hash(i, 21), h = 30 + 50 * hash(i, 22); b.add(new THREE.SphereGeometry(70 + 40 * hash(i, 23), 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / 90, 1).translate(r2 * Math.cos(a2), -4, r2 * Math.sin(a2)), C(i % 2 ? "#5d8a4a" : "#6f9a52")); }
    for (let i = 0; i < 90; i++) { const a2 = hash(i, 31) * Math.PI * 2, r2 = 170 + hash(i, 32) * 120; prop(b, kit, i % 3 ? "tree_oak" : "tree_default", r2 * Math.cos(a2), 0, r2 * Math.sin(a2), 9 + hash(i, 33) * 6, a2); }
    // clusters of props at the wall bases (no bare wall: reference)
    for (let i = 0; i < 16; i++) {
      const sx = i % 2 ? 1 : -1, z = -12 + i * 2.6, x = sx * 9.2;
      if (i % 4 === 0) barrel(b, x, 0, z, 0.9); else if (i % 4 === 1) { crate(b, x, 0, z, 0.6, i); sack(b, x - sx * 0.1, 0, z + 0.6, 0.8); } else if (i % 4 === 2) pot(b, x, 0, z, 0.6, "#b5653f", ["#e2453c", "#f2c443", "#b57ad0"][i % 3]); else { crate(b, x, 0, z, 0.7, i); crate(b, x, 0.7, z, 0.5, i + 1); }
    }
    // weeds in the cobble gaps along the walls and around props (green accents, reference ground cover)
    const wm = new THREE.MeshLambertMaterial({ map: grassCardTex(), alphaTest: 0.5, side: THREE.DoubleSide });
    const wg = new THREE.PlaneGeometry(0.5, 0.45).translate(0, 0.22, 0), wg2 = wg.clone().rotateY(Math.PI / 2);
    const wi = new THREE.InstancedMesh(wg, wm, 700), wi2 = new THREE.InstancedMesh(wg2, wm, 700);
    let n = 0;
    const tuft = (x: number, z: number, s2: number) => { if (n >= 700) return; const m = new THREE.Matrix4().compose(V(x, 0, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), hash(x, z) * 6), V(s2, s2, s2)); wi.setMatrixAt(n, m); wi2.setMatrixAt(n, m); n++; };
    for (let i = 0; i < 260; i++) { const side = i % 2 ? 1 : -1, z = -14 + hash(i, 1) * 40; tuft(side * (9.7 + hash(i, 2) * 0.6), z, 0.6 + hash(i, 3) * 0.8); }
    for (let i = 0; i < 160; i++) { const x = LANE[0] - 12 + hash(i, 4) * 60, s3 = i % 2 ? 1 : -1; tuft(x, LANE[2] + s3 * (4.3 + hash(i, 5) * 0.3), 0.7 + hash(i, 6) * 0.8); }
    for (let i = 0; i < 120; i++) { const x = -12 + hash(i, 7) * 24, z = -12 + hash(i, 8) * 30; if (Math.abs(x) < 6 && z > -2 && z < 12) continue; tuft(x, z, 0.4 + hash(i, 9) * 0.4); }
    wi.count = wi2.count = n; for (const w of [wi, wi2]) { w.receiveShadow = true; this.group.add(w); }
    for (const [x, z, w2, d2] of [[-9.8, 5, 0.6, 18], [9.8, 5, 0.6, 18], [LANE[0] + 18, LANE[2] - 4.4, 31, 0.5], [LANE[0] + 18, LANE[2] + 4.4, 31, 0.5]] as const) ao(x, 0, z, w2, d2);
    b.build(this.group);
    for (const m of AO) this.group.add(m);
    AO.length = 0;
    // lamp glass (HDR, blooms) at every lamp post
    this.lampMats = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.4, 1.2), fog: false });
    for (const p of [...LAMPS, ...Array.from({ length: 5 }, (_, i) => [LANE[0] - 6 + i * 11, 0, LANE[2] + (i % 2 ? 4 : -4)] as V3)]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), this.lampMats); m.position.set(p[0] + 0.5, 2.85, p[2]); m.layers.set(NOINK); this.group.add(m);
    }
    // puddles: real mirrors (half resolution) for the rain shots
    for (const [x, z, w, d] of PUDDLES) {
      const r = new Reflector(new THREE.CircleGeometry(1, 40), { textureWidth: 384, textureHeight: 384, color: new THREE.Color(0.8, 0.82, 0.9), shader: PuddleShader });
      (r.material as THREE.ShaderMaterial).transparent = true;
      r.rotation.x = -Math.PI / 2; r.scale.set(w, d, 1); r.position.set(x, 0.015, z); r.visible = false; r.layers.set(NOINK);
      this.puddles.push(r); this.group.add(r);
    }
  }
  setWeather(wet: boolean, night: boolean, rain = 0) {
    WATER.rain.value = rain;
    this.ground.material = wet ? COBBLE_WET() : COBBLE_DRY();
    for (const p of this.puddles) p.visible = wet;
    this.lampMats.color.setRGB(night ? 3.4 : 1.1, night ? 2.4 : 0.95, night ? 1.2 : 0.8);
    this.windowMat.color.setScalar(night ? 1.6 : 0.9);
    this.winLit.color.setRGB(night ? 2.6 : 0.35, night ? 1.8 : 0.33, night ? 0.9 : 0.4);
  }
}

// ---------------- the barley field ----------------
export class Field {
  group = new THREE.Group();
  stalks: THREE.InstancedMesh;
  private base: THREE.Matrix4[] = [];
  constructor(kit: Kit) {
    const [fx, , fz] = FIELD, b = new Batch();
    const g = new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2).translate(fx, 0, fz); const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 70, uv.getY(i) * 70);
    b.add(g, lam("fieldGrass", () => ({ map: grassHD(), color: "#b8c890" })));
    b.add(new THREE.PlaneGeometry(46, 30).rotateX(-Math.PI / 2).translate(fx, 0.02, fz), lam("fieldDirt", () => ({ map: ctex("dirtHD", 512, 512, (gg, r) => {
      gg.fillStyle = "#9a7048"; gg.fillRect(0, 0, 512, 512);
      for (let y = 0; y < 512; y += 22) { gg.fillStyle = "rgba(70,46,28,0.4)"; gg.fillRect(0, y, 512, 6); }
      for (let i = 0; i < 300; i++) { gg.fillStyle = r() > 0.5 ? "rgba(214,176,90,0.6)" : "rgba(90,60,36,0.4)"; gg.fillRect(r() * 512, r() * 512, 3, 8); }
    }) })));
    // fence around the field, a farm house, a windmill on the hill, trees, hay stacks, a cart
    for (let i = 0; i <= 24; i++) for (const zz of [fz - 15.5, fz + 15.5]) b.add(new THREE.CylinderGeometry(0.06, 0.07, 1.2, 6).translate(fx - 24 + i * 2, 0.6, zz), lam("woodM", () => ({ map: beamHD() })));
    for (const zz of [fz - 15.5, fz + 15.5]) for (const y of [0.5, 0.95]) b.add(boxGeo(V(fx - 24, y, zz - 0.03), V(fx + 24, y + 0.07, zz + 0.03)), lam("woodM", () => ({ map: beamHD() })));
    house(b, fx - 34, fz - 4, Math.PI / 2, 9, 7, 6, 3);
    prop(b, kit, "windmill", fx + 40, 0, fz - 30, 14, -0.6);
    for (let i = 0; i < 30; i++) { const a2 = (i / 30) * Math.PI * 2, r2 = 260 + 80 * hash(i, 51); b.add(new THREE.SphereGeometry(90 + 50 * hash(i, 52), 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35 + 0.3 * hash(i, 53), 1).translate(fx + r2 * Math.cos(a2), -6, fz + r2 * Math.sin(a2)), C(i % 2 ? "#7aa05a" : "#8aac62")); }
    for (let i = 0; i < 60; i++) { const a2 = hash(i, 54) * Math.PI * 2, r2 = 90 + hash(i, 55) * 120; prop(b, kit, i % 3 ? "tree_oak" : "tree_default", fx + r2 * Math.cos(a2), 0, fz + r2 * Math.sin(a2), 8 + hash(i, 56) * 5, a2); }
    for (let i = 0; i < 18; i++) prop(b, kit, i % 3 ? "tree_oak" : "tree_default", fx - 70 + i * 9 + hash(i, 1) * 4, 0, fz - 40 - hash(i, 2) * 30, 7 + hash(i, 3) * 4, i);
    for (const [x, z] of [[fx + 28, fz + 4], [fx + 31, fz + 8], [fx - 28, fz + 12]]) b.add(new THREE.ConeGeometry(1.6, 2.8, 12).translate(x, 1.4, z), lam("hay", () => ({ color: "#d9b25a" })));
    prop(b, kit, "cart", fx + 26, 0, fz + 13, 1.6, 0.7);
    for (let i = 0; i < 6; i++) sack(b, fx - 20 + i * 0.8, 0, fz + 16.6);
    b.build(this.group);
    // barley: instanced stalks with ear heads, gold, swaying; an eaten patch in the middle is bare stubble
    const stalk = new THREE.CylinderGeometry(0.012, 0.02, 1.0, 4).translate(0, 0.5, 0);
    const head = new THREE.ConeGeometry(0.045, 0.22, 5).rotateX(Math.PI).translate(0, 1.08, 0);
    const geo = mergeTwo(stalk, head);
    this.stalks = new THREE.InstancedMesh(geo, twoTone(new THREE.MeshLambertMaterial({ color: "#e0b54e" })), 9000);
    let n = 0;
    for (let i = 0; i < 9000; i++) {
      const x = fx - 22 + hash(i, 7) * 44, z = fz - 14 + hash(i, 8) * 28;
      const eaten = Math.hypot((x - fx) / 1.3, z - fz) < 9 + 2 * Math.sin(x * 0.7);
      const h = eaten ? 0.12 + hash(i, 9) * 0.1 : 0.8 + hash(i, 9) * 0.4;
      const m = new THREE.Matrix4().compose(V(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((hash(i, 3) - 0.5) * 0.3, hash(i, 4) * 6, (hash(i, 5) - 0.5) * 0.3)), V(1, h, 1));
      this.base.push(m); this.stalks.setMatrixAt(n++, m);
    }
    this.stalks.count = n; this.stalks.castShadow = true; this.stalks.receiveShadow = true;
    this.group.add(this.stalks);
  }
  sway(t: number) {
    const q = new THREE.Quaternion(), e = new THREE.Euler(), m = new THREE.Matrix4(), p = V(0, 0, 0), s = V(1, 1, 1), r = new THREE.Quaternion();
    for (let i = 0; i < this.base.length; i++) {
      this.base[i].decompose(p, r, s);
      e.set(0.08 * Math.sin(t * 1.6 + p.x * 0.4 + p.z * 0.2), 0, 0.06 * Math.sin(t * 1.3 + p.z * 0.5));
      q.setFromEuler(e).multiply(r);
      m.compose(p, q, s); this.stalks.setMatrixAt(i, m);
    }
    this.stalks.instanceMatrix.needsUpdate = true;
  }
}
const mergeTwo = (a: THREE.BufferGeometry, b2: THREE.BufferGeometry) => {
  const A = a.toNonIndexed(), B = b2.toNonIndexed(), g = new THREE.BufferGeometry();
  for (const k of ["position", "normal"]) {
    const x = A.attributes[k].array as Float32Array, y = B.attributes[k].array as Float32Array, z = new Float32Array(x.length + y.length);
    z.set(x); z.set(y, x.length); g.setAttribute(k, new THREE.BufferAttribute(z, 3));
  }
  return g;
};

// ---------------- the court room (inside the church) ----------------
export class Court {
  group = new THREE.Group();
  dust!: THREE.Points;
  candles: THREE.MeshBasicMaterial;
  constructor() {
    const b = new Batch(), [x0, y0, z0] = COURT;
    const box = (a: V3, c: V3, m: THREE.Material, tile = 2) => b.add(boxGeo(V(x0 + a[0], y0 + a[1], z0 + a[2]), V(x0 + c[0], y0 + c[1], z0 + c[2]), tile), m);
    box([-10, -0.2, -14], [10, 0, 10], lam("courtFloor", () => ({ map: planksHD() })));
    box([-10, 0, -14.2], [10, 9, -14], STONE()); box([-10.2, 0, -14], [-10, 9, 10], STONE()); box([10, 0, -14], [10.2, 9, 10], STONE());
    // judge's raised bench under a red canopy, the tall stained windows behind
    box([-3.5, 0, -11], [3.5, 0.8, -8.5], WOOD()); box([-3.2, 0.8, -9.0], [3.2, 1.45, -8.6], WOOD());
    box([-3.6, 4.6, -12], [3.6, 4.8, -9], lam("canopy", () => ({ color: "#a8302e" })));
    const gm = new THREE.MeshBasicMaterial({ map: glassTex(), color: new THREE.Color(1.3, 1.3, 1.3) });
    for (const s of [-6, 0, 6]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 5), gm); w.position.set(x0 + s, y0 + 5.5, z0 - 13.95); w.layers.set(NOINK); this.group.add(w); }
    // the dock: a little wooden pen with rails, the lawyer's table, benches with the townsfolk, banners, rugs
    box([3.0, 0, -5.4], [6.0, 1.1, -5.2], WOOD()); box([5.9, 0, -5.4], [6.1, 1.1, -3.0], WOOD()); box([2.9, 0, -5.4], [3.1, 1.1, -3.0], WOOD()); box([3.0, 0, -5.4], [6.0, 0.25, -3.0], WOOD()); // the dock: open to the room
    box([0.4, 0, -6.6], [2.6, 0.85, -5.8], WOOD());
    for (let r = 0; r < 3; r++) for (const s of [-1, 1]) box([s * 1.5 - (s < 0 ? 6.5 : 0), 0, 4.4 + r * 2.2], [s * 1.5 + (s > 0 ? 6.5 : 0), 0.5, 5.0 + r * 2.2], WOOD());
    for (const s of [-1, 1]) b.add(new THREE.PlaneGeometry(1.4, 4).translate(x0 + s * 9.9, y0 + 5, z0 - 6), lam("banR" + s, () => ({ color: s > 0 ? "#2f4f8a" : "#a8302e", side: THREE.DoubleSide })), new THREE.Matrix4().makeRotationY(0));
    box([-1.6, 0.001, -8], [1.6, 0.012, 6], lam("aisleRug", () => ({ color: "#8a2f3a" })));
    for (const [x, z] of [[-9, -12], [9, -12], [-9, 8], [9, 8]]) barrel(b, x0 + x, y0, z0 + z, 0.9);
    for (const [x, z] of [[0.9, -6.2], [2.0, -6.1]]) b.add(new THREE.BoxGeometry(0.5, 0.06, 0.36).translate(x0 + x, y0 + 0.9, z0 + z), lam("paper", () => ({ color: "#f1e2bd" })));
    // set dressing: stone pillars, shelves of books and scrolls, chests, crates, a rug under the dock, jugs, a chandelier
    for (const x of [-7.6, 7.6]) for (const z of [-7, -1, 5]) { b.add(new THREE.CylinderGeometry(0.42, 0.5, 9, 14).translate(x0 + x, y0 + 4.5, z0 + z), STONE()); ao(x0 + x, y0, z0 + z, 0.9); }
    for (const sx of [-1, 1]) {
      const bx = x0 + sx * 9.6;
      for (let k = 0; k < 4; k++) b.add(new RoundedBoxGeometry(0.5, 0.06, 3.2, 1, 0.02).translate(bx, y0 + 0.8 + k * 0.7, z0 - 10.5), WOOD());
      for (let k = 0; k < 4; k++) for (let j = 0; j < 9; j++) b.add(new THREE.BoxGeometry(0.34, 0.42 + 0.12 * hash(j, k), 0.12).translate(bx, y0 + 1.05 + k * 0.7, z0 - 11.8 + j * 0.3), C(["#a8302e", "#2f4f8a", "#5d7a3a", "#c98a4a", "#6a3a7a"][(j + k) % 5]));
    }
    for (const [x, z] of [[-8.6, -3], [8.6, 2], [-8.4, 8]]) { b.add(new RoundedBoxGeometry(1.1, 0.6, 0.7, 2, 0.05).translate(x0 + x, y0 + 0.3, z0 + z), lam("chest", () => ({ color: "#7a4a2a" }))); ao(x0 + x, y0, z0 + z, 0.8, 0.6); }
    for (const [x, z, sc] of [[6.8, -6.2, 0.6], [7.3, -6.0, 0.45], [-8.8, 1.2, 0.7], [8.9, -0.4, 0.55]]) crate(b, x0 + x, y0, z0 + z, sc, x);
    for (const [x, z] of [[2.5, -6.5], [6.6, -2.6], [-1.2, -7.0]]) pot(b, x0 + x, y0, z0 + z, 0.55, "#b5653f", "#f2c443");
    box([2.6, 0.001, -6.0], [6.6, 0.014, -2.6], lam("dockRug", () => ({ color: "#2f6f6a" })));
    b.add(new THREE.TorusGeometry(1.4, 0.06, 6, 24).rotateX(Math.PI / 2).translate(x0, y0 + 6.2, z0 - 4), IRON());
    b.build(this.group);
    for (const m of AO) this.group.add(m);
    AO.length = 0;
    this.candles = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 2.4, 1.0), fog: false });
    const shaft = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.9, 0.7), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (const sx of [-6, 0, 6]) { const g2 = new THREE.CylinderGeometry(1.1, 2.6, 11, 4, 1, true).rotateY(Math.PI / 4); const m2 = new THREE.Mesh(g2, shaft); m2.position.set(x0 + sx + 0.6, y0 + 3.5, z0 - 10.5); m2.rotation.x = 0.55; m2.layers.set(NOINK); this.group.add(m2); }
    const dp: number[] = []; for (let i = 0; i < 350; i++) dp.push(x0 + (hash(i, 41) - 0.5) * 14, y0 + 0.5 + hash(i, 42) * 6, z0 - 12 + hash(i, 43) * 14);
    const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.Float32BufferAttribute(dp, 3));
    const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: new THREE.Color(1.4, 1.25, 0.9), size: 2.0, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false }));
    dust.layers.set(NOINK); this.group.add(dust); this.dust = dust;
    for (const [x, y, z] of [[-2.8, 1.8, -8.8], [2.8, 1.8, -8.8], [-9.6, 3.2, -4], [9.6, 3.2, -4], [-9.6, 3.2, 4], [9.6, 3.2, 4], [1.5, 1.2, -6.2], ...Array.from({ length: 8 }, (_, i) => [1.4 * Math.cos(i * 0.785), 6.45, -4 + 1.4 * Math.sin(i * 0.785)] as [number, number, number])]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), new THREE.MeshLambertMaterial({ color: "#f4efe0" })); c.position.set(x0 + x, y0 + y - 0.2, z0 + z); this.group.add(c);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6).scale(1, 1.8, 1), this.candles); f.position.set(x0 + x, y0 + y, z0 + z); f.layers.set(NOINK); this.group.add(f);
    }
  }
}

// ---------------- the party room (analogy) ----------------
export class Party {
  group = new THREE.Group();
  constructor() {
    const b = new Batch(), [x0, y0, z0] = PARTY;
    const box = (a: V3, c: V3, m: THREE.Material) => b.add(boxGeo(V(x0 + a[0], y0 + a[1], z0 + a[2]), V(x0 + c[0], y0 + c[1], z0 + c[2])), m);
    box([-6, -0.2, -6], [6, 0, 6], lam("partyFloor", () => ({ map: planksHD() })));
    box([-6, 0, -6.2], [6, 4, -6], C("#e8c88a")); box([-6.2, 0, -6], [-6, 4, 6], C("#d9b47a"));
    box([1.0, 0, -6.05], [2.6, 2.6, -5.9], C("#7a4a2a")); // the door
    box([-3.5, 0, -3.5], [-0.5, 0.85, -1.5], WOOD());
    b.add(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 20).translate(x0 - 2, y0 + 1.03, z0 - 2.5), C("#f4e9d0"));
    b.add(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 20).translate(x0 - 2, y0 + 1.33, z0 - 2.5), C("#e86e9a"));
    for (let i = 0; i < 12; i++) b.add(new THREE.ConeGeometry(0.18, 0.32, 3).rotateX(Math.PI).translate(x0 - 5.5 + i * 0.9, y0 + 3.5 - 0.15 * Math.sin((i / 11) * Math.PI), z0 - 5.95), C(["#e2453c", "#f2c443", "#3f6fb5", "#7cc36a"][i % 4]));
    for (const [x, z, c] of [[-5, -5, "#e2453c"], [-4.4, -5.3, "#3fa0d0"], [4.5, -5.2, "#f2c443"]] as [number, number, string][]) b.add(new THREE.SphereGeometry(0.35, 14, 10).translate(x0 + x, y0 + 2.6, z0 + z), C(c));
    b.build(this.group);
  }
}
void THREE; void hash;
