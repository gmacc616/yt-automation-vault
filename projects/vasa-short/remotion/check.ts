import * as THREE from "three";
import { SHOTS, TOTAL, shotAt, layersAt, camAt, shipPose, focusAt } from "/root/remotion-3d/src/videos/vasa/story";
import { stage } from "/root/remotion-3d/src/videos/vasa/cast";
let bad = 0;
for (let f = 0; f < TOTAL; f++) for (const l of layersAt(f)) {
  try {
    const c = camAt(l.id, f); const P = shipPose(l.id, f / 30); focusAt(l.id, f);
    const pos = new THREE.Vector3(...c.pos);
    const st = stage(l.id, f / 30, P, { pos, right: new THREE.Vector3(1, 0, 0), sun: new THREE.Vector3(0, 1, 0) });
    for (const p of st.places) if (![p.x, p.y, p.z].every(Number.isFinite)) throw new Error("NaN place");
    if (![...c.pos, ...c.look, c.fov].every(Number.isFinite)) throw new Error("NaN cam");
  } catch (e) { if (bad++ < 5) console.log("frame", f, "shot", l.id, String(e)); }
}
console.log("checked", TOTAL, "bad", bad, "shots", SHOTS.length, shotAt(0).id);
