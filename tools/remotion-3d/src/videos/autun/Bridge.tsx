// "The Bridge That Fell for a Song": our original 67 s short in the flat-characters-in-a-3D-toon-world style.
// One three.js world (world.ts) posed per frame from the story timeline (story.ts). Post chain (look-match pass):
//   InkPass (world ink lines, own pass) -> lens blur pre + main (thin-lens DOF per shot from dofAt) ->
//   [bloom (emissive only) + NEUTRAL tone mapping + colour grade] (one merged EffectPass), MSAA 4.
// Ink runs before the DOF so lines blur with what they belong to; bloom after the DOF so glows defocus with their
// source; the grade is display-referred, so it comes after tone mapping. Every pixel-sized parameter is specified at
// 1080x1920 and scaled with the output size, so stills at --scale 0.5 and the 1440x2560 final match.
// Place changes crossfade by stacking a second canvas for the fade frames; the hook ends on a 4-frame white flash.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree, useFrame } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode, FXAAEffect } from "postprocessing";
import { World, loadKit } from "./world";
import { InkPass, noInkFallback } from "./ink";
import { LensBlur, GrainEffect } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH, gradeFor } from "./grade";
import { Kit } from "./build";
import { TOTAL, FLASH_AT, SHOTS, layersAt, dofAt } from "./story";

export const AUTUN_FRAMES = TOTAL;

/** A/B switches for test stills only (Remotion inputProps `{ post: { ink: false, ... } }`); everything is on by default. */
type PostToggles = { ink: boolean; lens: boolean; pre: boolean; bloom: boolean; grade: boolean; grain: boolean; msaa: number; shadow: number; aniso: number; fxaa: boolean };
/** inputProps `{ draft: true }` = cheap look-check preset (540x960 buffer, small shadow map): ~1-2 s/frame in
 *  software GL, for draft sheets only. The final render uses the defaults. */
const DRAFT: Partial<PostToggles> & { dpr?: number } = { msaa: 4, shadow: 1024, dpr: 0.5 }; // never msaa 0 here: with frameloop "never" it left later frames blank
const isDraft = () => !!(getInputProps() as { draft?: boolean }).draft;
export const toggles = (): PostToggles => ({ ink: true, lens: true, pre: true, bloom: true, grade: true, grain: false, msaa: 4, shadow: 2048, aniso: 8, fxaa: false,
  ...(isDraft() ? DRAFT : {}), ...((getInputProps() as { post?: Partial<PostToggles> }).post ?? {}) });

/** Bloom for emissive sources only (depth.md 6.4). Its MIP chain always starts at 540x960 (half of 1080x1920),
 *  whatever the output size, so the glow keeps the same size relative to the frame (e-fold ~30 px at 1080p,
 *  ~1.5 % of the frame height) at 540, 1080 and 1440 widths. ADD blend: HDR-safe (SCREEN darkens values > 1). */
const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.35, luminanceThreshold: 0.85, luminanceSmoothing: 0.25, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("tsar kit"));
  useEffect(() => { loadKit().then((k) => setKit(k)); }, []);
  // release only after the shot views mounted and registered their own per-frame holds (else the first frame is blank)
  useEffect(() => { if (kit) continueRender(handle); }, [kit, handle]);
  return kit;
};

const Inner: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => {
  const f = useCurrentFrame();
  const { camera, scene, gl } = useThree();
  const advance = useThree((st) => st.advance);
  const world = useMemo(() => {
    const w = new World(kit);
    const an = toggles().aniso;
    if (an !== undefined) w.root.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined; if (m && !Array.isArray(m)) for (const k of ["map"] as const) { const t = m[k]; if (t && t.anisotropy !== an) { t.anisotropy = an; t.needsUpdate = true; } } });
    if ((getInputProps() as { prof?: boolean }).prof) {
      const rows: [number, string, number][] = [];
      w.root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const g = m.geometry; const n = (g.index ? g.index.count : g.attributes.position.count) / 3; const inst = (m as THREE.InstancedMesh).count ?? 1; rows.push([n * inst, (m.material as THREE.Material).type + ":" + ((m.material as THREE.MeshLambertMaterial).map?.name ?? "") + ":" + (m.parent?.type ?? ""), inst]); });
      rows.sort((a, b) => b[0] - a[0]);
      console.log("PROF meshes " + rows.length + " total " + rows.reduce((a, r) => a + r[0], 0) + " | " + rows.slice(0, 12).map((r) => r[0] + " " + r[1] + " x" + r[2]).join(" | "));
    }
    return w;
  }, [kit]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const on = useMemo(toggles, []);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, GRADE_STRENGTH.day),
    fxaa: new FXAAEffect(),
    grain: new GrainEffect({ amount: 0.025, cellPx: 1.5 }), // film grain, OFF by default (inputProps post.grain): the reference measures no grain and it quadruples the file size
  }), [camera, scene]);
  useEffect(() => () => { (fx.ink as unknown as { dispose?: () => void }).dispose?.(); }, [fx]);
  const post = useMemo(() => (
    <EffectComposer multisampling={on.msaa}>
      {on.ink ? <primitive object={fx.ink} dispose={null} /> : null}
      {on.lens && on.pre ? <primitive object={fx.lens.pre} dispose={null} /> : null}
      {on.lens ? <primitive object={fx.lens.main} dispose={null} /> : null}
      {on.bloom ? <primitive object={fx.bloom} dispose={null} /> : null}
      <primitive object={fx.tone} dispose={null} />
      {on.grade ? <primitive object={fx.grade} dispose={null} /> : null}
      {on.grain ? <primitive object={fx.grain} dispose={null} /> : null}
      {on.fxaa ? <primitive object={fx.fxaa} dispose={null} /> : null}
    </EffectComposer>
  ), [fx, on]);
  const cam = camera as THREE.PerspectiveCamera;
  const _t0 = performance.now();
  const G = gl as THREE.WebGLRenderer & { _cnt?: Record<string, number>; _wrapped?: boolean };
  if (!G._wrapped) { G._wrapped = true; G._cnt = {}; const orig = G.render.bind(G); G.render = (sc: THREE.Object3D, c: THREE.Camera) => { const k = sc === scene ? (scene.overrideMaterial ? "sceneOverride" : "scene") : "fs"; G._cnt![k] = (G._cnt![k] ?? 0) + 1; return orig(sc, c); }; }
  if ((getInputProps() as { prof?: boolean }).prof) { console.log("PROF renders " + JSON.stringify(G._cnt)); G._cnt = {}; }
  target.copy(world.update(id, f, cam, scene));
  if ((getInputProps() as { prof?: boolean }).prof) { console.log(`PROF update ${f} ${(performance.now() - _t0).toFixed(0)}ms tris ${gl.info.render.triangles} calls ${gl.info.render.calls} progs ${gl.info.programs?.length} tex ${gl.info.memory.textures} geo ${gl.info.memory.geometries}`); gl.info.autoReset = false; gl.info.reset(); }
  noInkFallback(world.root);
  // thin-lens focus: distance along the view axis to the shot's focus point (default: the camera's look target)
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  gradeFor(fx.grade, SHOTS[id - 1].light);
  fx.grain.seed = f; // deterministic per frame
  // frameloop "never": render exactly once per Remotion frame (the default "always" loop re-rendered the whole post chain
  // ~10x per frame while software GL was busy)
  // frameloop "demand": one R3F render per Remotion frame (the default "always" loop redrew the whole post chain ~10x per
  // frame while software GL was busy); hold the frame until that render has happened
  const invalidate = useThree((st) => st.invalidate);
  const hold = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (hold.current !== null) continueRender(hold.current);
    hold.current = delayRender(`draw ${f}`);
    invalidate();
  }, [f, id, invalidate]);
  useFrame(() => { if (hold.current !== null) { const h = hold.current; hold.current = null; requestAnimationFrame(() => continueRender(h)); } }, 2);
  return (
    <>
      <primitive object={world.root} dispose={null} />
      {post}
    </>
  );
};

/** test stills only: inputProps `{ post: { dpr: 0.5 } }` forces the WebGL buffer size (R3F clamps dpr to >= 1 by default) */
const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr ?? (isDraft() ? DRAFT.dpr : undefined);
const ShotView: React.FC<{ id: number; kit: Kit; alpha: number }> = ({ id, kit, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas frameloop="demand" width={1080} height={1920} {...(dprOverride() ? { dpr: dprOverride() } : {})} shadows gl={{ antialias: false, stencil: false, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.2, far: 1500 }}>
      <Inner id={id} kit={kit} />
    </ThreeCanvas>
  </AbsoluteFill>
);

export const AutunShort: React.FC = () => {
  const f = useCurrentFrame();
  const kit = useKit();
  if (!kit) return null;
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      {layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} kit={kit} alpha={l.alpha} />)}
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
    </AbsoluteFill>
  );
};
