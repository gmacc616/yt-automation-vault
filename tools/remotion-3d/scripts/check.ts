// Pre-render check for a three.js short (no browser, no GPU, ~1-3 min): builds the real World in Node with a stubbed 2D
// canvas, then for every frame (every Nth for the geometry tests) of every layer:
//   1. logic: camera, ship/story pose and the cast staging run without throwing and give finite numbers
//   2. lens blocked: a 3x5 grid of rays through the frustum; flags frames where > 35 % hit geometry within 2.2 m
//      (camera inside a sail, a house, the hull, a tree)
//      + foreground: > 20 % of the rays hit something closer than 1/4 of the look distance (a tree or post in a wide)
//      + inside: the ray straight up hits the back of an upward-facing surface (lens under the quay, inside the hull)
//   3. subject: in shots that stage characters, flags frames where none is in frame or the biggest is < 6 % of the height
// Usage (from tools/remotion-3d): bash scripts/check.sh <video folder, e.g. vasa> [every Nth frame for 2-3, default 3]
import * as THREE from "three";
import * as story from "@video/story";
import { World } from "@video/world";

const STEP = Number(process.env.STEP || 3);
const S = story as unknown as {
  SHOTS: { id: number; a: number; b: number; crowd?: string; wide?: boolean; wideFrom?: number }[]; TOTAL: number; FPS: number;
  layersAt: (f: number) => { id: number; alpha: number }[]; XFADE?: Record<number, number>; FLASH_AT?: number; camAt: (id: number, f: number) => { pos: number[]; look: number[]; fov: number };
};
const world = new World({} as never);
const scene = new THREE.Scene();
scene.add(world.root);
const cam = new THREE.PerspectiveCamera(40, 1080 / 1920, 0.2, 1500);
const ray = new THREE.Raycaster();
ray.layers.set(0); // world geometry only (cards, sky, sprites live on other layers)
const solids: THREE.Object3D[] = [];
world.root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.layers.isEnabled(0) && m.renderOrder !== 1) solids.push(m); });
// both faces count here: a lens under the ground or inside a wall sees back faces, which the renderer culls (empty-looking frame)
for (const m of solids) for (const mat of ([] as THREE.Material[]).concat((m as THREE.Mesh).material as THREE.Material)) mat.side = THREE.DoubleSide;
const up = new THREE.Vector3(0, 1, 0), dn = new THREE.Vector3(0, -1, 0);
const problems: string[] = [];
let logicBad = 0;
const ndc = new THREE.Vector3();
const crowdShot = (id: number, f: number) => { const sh = S.SHOTS[id - 1]; if (sh.wide || (sh.wideFrom !== undefined && f >= sh.wideFrom)) return false; const c = S.SHOTS[id - 1].crowd ?? ""; return c !== "" && c !== "none" && !/^(pour|wreck)$/.test(c); };
const perShot: Record<number, { blocked: number[]; fg: number[]; inside: number[]; noSubject: number[]; n: number }> = {};

for (let f = 0; f < S.TOTAL; f++) for (const l of S.layersAt(f)) {
  try {
    const c = S.camAt(l.id, f);
    if (![...c.pos, ...c.look, c.fov].every(Number.isFinite)) throw new Error("camera NaN");
    world.update(l.id, f, cam, scene); // poses everything (ship, cast) exactly as the render does
  } catch (e) { if (logicBad++ < 8) problems.push(`LOGIC frame ${f} shot ${l.id}: ${String(e).slice(0, 160)}`); continue; }
  if (f % STEP) continue;
  const P = (perShot[l.id] ??= { blocked: [], fg: [], inside: [], noSubject: [], n: 0 });
  P.n++;
  cam.updateMatrixWorld(); scene.updateMatrixWorld();
  // 2. lens blocked (< 2.2 m) and unexpected foreground (closer than a quarter of the way to the look point, max 8 m)
  const c2 = S.camAt(l.id, f), lookD = Math.hypot(c2.look[0] - c2.pos[0], c2.look[1] - c2.pos[1], c2.look[2] - c2.pos[2]);
  const fgD = Math.min(8, 0.25 * lookD);
  let hit = 0, fg = 0, tot = 0;
  for (const sx of [-0.7, 0, 0.7]) for (const sy of [-0.8, -0.4, 0, 0.4, 0.8]) {
    ray.setFromCamera(new THREE.Vector2(sx, sy), cam);
    ray.far = Math.max(2.2, fgD); tot++;
    const h = ray.intersectObjects(solids, false)[0];
    if (h && h.distance < 2.2) hit++;
    else if (h && lookD > 12 && h.distance < fgD) fg++;
  }
  if (hit / tot > 0.35) P.blocked.push(f);
  // inside/under geometry: straight up we hit the back of a surface (ground, deck, roof) and straight down nothing solid
  ray.set(cam.position, up); ray.far = 40;
  const hu = ray.intersectObjects(solids, false)[0];
  if (hu && hu.face && hu.face.normal.clone().transformDirection(hu.object.matrixWorld).y > 0.5) {
    ray.set(cam.position, dn);
    const hd = ray.intersectObjects(solids, false)[0]; // a floor under the lens = a room (bus, cabin), not the inside of the ground
    if (!(hd && hd.face && hd.face.normal.clone().transformDirection(hd.object.matrixWorld).y > 0.5)) P.inside.push(f);
  }
  if (fg / tot > 0.2) P.fg.push(f);
  // 3. subject in frame (character cards: renderOrder 1, visible)
  if (crowdShot(l.id, f)) {
    let best = 0;
    world.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.renderOrder !== 1 || !m.visible) return;
      m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox!, s = m.scale.y;
      const top = ndc.set(m.position.x, m.position.y + bb.max.y * s, m.position.z).project(cam).clone();
      const bot = ndc.set(m.position.x, m.position.y + bb.min.y * s, m.position.z).project(cam).clone();
      if (top.z > 1 || bot.z > 1 || Math.abs(top.x) > 1 || (top.y < -1 && bot.y < -1) || (top.y > 1 && bot.y > 1)) return;
      best = Math.max(best, (top.y - bot.y) / 2);
    });
    if (best < 0.06) P.noSubject.push(f);
  }
}
const span = (fs: number[]) => fs.length ? `${fs.length} sampled frames (${fs[0]}..${fs[fs.length - 1]})` : "";
for (const [id, P] of Object.entries(perShot)) {
  if (P.blocked.length > P.n * 0.15) problems.push(`LENS shot ${id}: blocked by near geometry in ${span(P.blocked)}`);
  if (P.inside.length > P.n * 0.1) problems.push(`INSIDE shot ${id}: lens under the ground / inside geometry in ${span(P.inside)}`);
  if (P.fg.length > P.n * 0.15) problems.push(`FOREGROUND shot ${id}: something big between the lens and the subject in ${span(P.fg)}`);
  if (P.noSubject.length > P.n * 0.3) problems.push(`SUBJECT shot ${id}: no character in frame / too small in ${span(P.noSubject)}`);
}
import("node:fs").then((fs) => fs.writeFileSync("out/shots.json", JSON.stringify({ total: S.TOTAL, shots: S.SHOTS.map((x) => ({ id: x.id, a: x.a, b: x.b, light: (x as { light?: string }).light })),
  xfade: Object.entries(S.XFADE ?? {}).filter(([, n]) => n).map(([id, n]) => [S.SHOTS[Number(id) - 1].a - Math.floor(n / 2), S.SHOTS[Number(id) - 1].a + Math.ceil(n / 2)]),
  flash: S.FLASH_AT !== undefined ? [S.FLASH_AT, S.FLASH_AT + 4] : undefined })));
console.log(problems.length ? problems.join("\n") : "OK");
console.log(`checked ${S.TOTAL} frames, ${S.SHOTS.length} shots, logic errors ${logicBad}, problems ${problems.length}`);
setTimeout(() => process.exit(problems.length ? 1 : 0), 100);
