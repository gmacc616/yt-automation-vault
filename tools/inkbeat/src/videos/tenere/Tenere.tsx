// "The loneliest tree": a 1080x1920 Short about the Tree of Ténéré. One setup per clause (the picture follows the
// words); every setup, beat and event time comes from plan.gen.ts (plan/tenere_plan.py, anchored to the voice-over).
// Each setup = a camera preset (cam/presets.ts) + plan beats (core/rig.ts) on top. Setups in the same place and light
// travel into each other with a camera blend; a change of place or time is a short dissolve. TenereSub = motion blur.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CAST } from "../../inkbeat/char/cast";
import { Character3D, headOf } from "../../inkbeat/char/Character3D";
import type { CharacterSpec } from "../../inkbeat/char/Character3D";
import { CLOTH } from "../../inkbeat/char/family";
import { Captions, makeChunks } from "../../inkbeat/core/captions";
import type { Word } from "../../inkbeat/core/captions";
import { CastLight } from "../../inkbeat/core/castLight";
import { subFrame, useFonts } from "../../inkbeat/core/frame";
import { Label } from "../../inkbeat/core/kit";
import { moodOf } from "../../inkbeat/core/moods";
import { poseAt, withShake } from "../../inkbeat/core/rig";
import type { Beat, Cam } from "../../inkbeat/core/rig";
import { View } from "../../inkbeat/core/View";
import type { V3 } from "../../inkbeat/types";
import { EXPR, GESTURE } from "../../inkbeat/anim/acting";
import { EASE, follow, idle, startStop, walkPhase } from "../../inkbeat/anim/motion";
import { PRESETS } from "../../inkbeat/cam/presets";
import type { CamPath } from "../../inkbeat/cam/presets";
import { Burst } from "../../inkbeat/fx/particles";
import { Camel } from "../../inkbeat/world/animals";
import { Beams, Car } from "../../inkbeat/world/vehicle";
import { BEATS, DURATION, EVENTS, SHOTS, WORDS } from "./plan.gen";
import { DateBoard, Desert, H, HeroTree, Museum, SIGN, Sculpture, Shaft, TagStone, TREE_H, Well } from "./props";

export const TENERE_FRAMES = DURATION;
const E = EVENTS;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ramp = (t: number, a: number, d = 0.3) => clamp((t - a) / d);
const XF = 0.33; // dissolve (s)
const BL = 0.6; // camera blend between setups in the same place and light (s)
type Shot = (typeof SHOTS)[number];
const S = (id: string) => SHOTS.find((s) => s.id === id)!;

// ------------------------------------------------------------------ cast (one family)
const EXPLORER: CharacterSpec = {
  ...CAST.adult,
  look: { ...CAST.adult.look, outfit: "jacket", colors: { top: "#c8b088", inner: "#f0e6d0", bottom: "#8a7050", shoes: CLOTH.oxblood, accent: CLOTH.brass }, hat: "sunhat", hatColor: "#e8dcc0", mustache: true, seed: 21 },
};
const DIGGER: CharacterSpec = { ...CAST.adult, look: { ...CAST.adult.look, outfit: "shirt", colors: { top: "#e8e0d0", inner: "#e8e0d0", bottom: "#7a6a5a", shoes: CLOTH.oxblood, accent: CLOTH.horn }, hat: "cap", hatColor: "#c8b490", seed: 31 } };
const DIGGER2: CharacterSpec = { ...CAST.elder, look: { ...CAST.elder.look, outfit: "vest", hat: "flat", hatColor: "#8a6a4a", seed: 32 } };
const DRIVER: CharacterSpec = { ...CAST.adult, look: { ...CAST.adult.look, outfit: "shirt", colors: { top: "#3a5a9a", inner: "#3a5a9a", bottom: "#e8e0d0", shoes: CLOTH.oxblood, accent: CLOTH.horn }, hat: "flat", hatColor: "#2a3a6a", seed: 41 } };

// ------------------------------------------------------------------ places and motion
const CROWN: V3 = [0, TREE_H * 0.82, 0];
const TRUNK: V3 = [0, 1.4, 0];
const EXPL_P: V3 = [-2.6, 0, 3.6];
const EXPL_YAW = Math.atan2(-EXPL_P[0], -EXPL_P[2]);
const explHead = headOf(EXPL_P, EXPLORER.height, EXPLORER.build);
// the caravan: four camels and a driver walk +z past the tree, 7 m to its side, at a camel's pace
const CAR_T0 = S("S06").t;
const CARAVAN_KEYS = startStop(CAR_T0 - 6, CAR_T0 + 30, 1.25, 0.8);
const CARAVAN_PTS: V3[] = [[7, 0, -30], [7, 0, 0], [7, 0, 40]];
const camelAt = (t: number, k: number) => follow(CARAVAN_PTS, CARAVAN_KEYS, t - k * 2.6, H);
// the 1930s car: crosses the sand and stops near the tree
const VCAR_PTS: V3[] = [[-70, 0, -50], [-30, 0, -14], [-6.5, 0, 6.5]];
const vcar = (t: number) => follow(VCAR_PTS, startStop(E.cars - 4.5, E.y1934 - 0.3, 16, 1.6), t, H);
// the 1973 truck: straight at the trunk, arriving on "knocked"
const TRUCK_DIR: V3 = [0.747, 0, 0.664];
const TRUCK_END: V3 = [TRUCK_DIR[0] * 4.1, 0, TRUCK_DIR[2] * 4.1];
const TRUCK_PTS: V3[] = [[TRUCK_DIR[0] * 70, 0, TRUCK_DIR[2] * 70], [TRUCK_DIR[0] * 30, 0, TRUCK_DIR[2] * 30], TRUCK_END];
const truck = (t: number) => {
  const tt = Math.min(t, E.knocked);
  const s = follow(TRUCK_PTS, [[E.knocked - 8, 8.2], [E.knocked, 8.2]], tt, H);
  return t < E.knocked ? s : { ...s, speed: 0, accel: -12 };
};
const SHAFT_P: V3 = [-300, 0, 0];
const MUSEUM_P: V3 = [300, 0, 0];

// ------------------------------------------------------------------ the camera of each setup (presets, tuned)
const CAMS: Record<string, CamPath> = {
  S01: PRESETS.lowAngle({ target: [0, 0, 0], ang: 0.5, dist: 13, lensH: 0.35, aimH: 4.2, mm: 20, face: 0.46, t0: 0, dur: 3.2, creep: 0.18 }),
  S02: PRESETS.fastPush({ target: TRUNK, ang: 0.9, h: 0.6, from: 7, to: 3.4, t0: E.thud1 - 0.25, dur: 0.6, mm: 28, face: 0.42 }),
  S03: PRESETS.overhead({ target: [0, 0, 3], h: [44, 30], tilt: 8, spin: 18, ang: Math.PI, t0: S("S03").t, dur: S("S03").end - S("S03").t + 0.6 }),
  S04: PRESETS.orbit({ target: [0, 3.5, 0], dist: 24, h: 1.5, from: 20, deg: 75, t0: S("S04").t, dur: S("S04").end - S("S04").t + 0.6, mm: 22, face: 0.48 }),
  S05: PRESETS.slowPush({ target: [0, 3.5, 0], ang: -0.6, h: 0.6, from: 22, to: 16, t0: S("S05").t, dur: S("S05").end - S("S05").t, mm: 24, face: 0.46 }),
  S06: PRESETS.sideTrack({ subject: (t) => camelAt(t, 1).pos, offset: 9, side: 1, h: 1.6, aimH: 1.6, mm: 28, lead: 0.6 }),
  S07: PRESETS.reveal({ target: [0, 4.5, 0], ang: 2.2, dist: 6.5, rise: [6.5, 1.4], lookDrop: -3.2, t0: S("S07").t, dur: S("S07").end - S("S07").t, mm: 28 }),
  S08: PRESETS.slowPush({ target: [2.6, 0.9, 1.4], ang: 0.4, h: 1.2, from: 7, to: 5.6, t0: S("S08").t, dur: S("S08").end - S("S08").t, mm: 32, face: 0.42 }),
  S09: (t) => {
    const u = EASE.inOut(clamp((t - S("S09").t) / (E.roots - S("S09").t + 0.6)), 3);
    const y = 2.5 - 16.5 * u;
    return { pos: [SHAFT_P[0] + 0.6, y + 0.4, 14], look: [SHAFT_P[0] + 0.6, y - 1.6, 0], fov: 50, roll: 0 };
  },
  S10: PRESETS.chase({ subject: (t) => vcar(t).pos, dist: 9, h: 2.4 }),
  S11: (t) => PRESETS.reaction({ head: explHead, facing: EXPL_YAW, side: -38, t0: E.y1934 - 0.2, dur: 0.6, mm: 38, dist: 3.6, face: 0.36 })(t),
  S12: PRESETS.lowAngle({ target: [-2.4, 0, 2.6], ang: 0.35, dist: 8.5, lensH: 0.45, aimH: 2.6, mm: 22, face: 0.44, t0: S("S12").t, dur: 4 }),
  S13: PRESETS.chase({ subject: (t) => truck(t).pos, dist: 10, h: 2.6 }),
  S14: PRESETS.action({ target: [0, 0, 0], ang: -0.6, dist: 13, slide: 22, impact: E.knocked, shake: 1.3, mm: 20, t0: S("S14").t - 0.4, dur: 3 }),
  S15: PRESETS.pullBack({ target: [-2.5, 0.6, -0.5], ang: 0.9, from: 7, to: 18, h: [0.8, 4.5], t0: S("S15").t, dur: S("S15").end - S("S15").t, mm: 26 }),
  S16: PRESETS.slowPush({ target: [MUSEUM_P[0], 1.2, MUSEUM_P[2] - 2.5], ang: 0.35, h: 1.4, from: 9, to: 7, t0: S("S16").t, dur: S("S16").end - S("S16").t, mm: 28, face: 0.44 }),
  S17: PRESETS.pullBack({ target: [0, 4.5, 0], ang: 2.4, from: 11, to: 28, h: [0.3, 5], t0: S("S17").t, dur: DURATION / 30 - S("S17").t, mm: 26 }),
};

const placeOf = (s: Shot) => s.set;
const sameRoom = (a: Shot, b: Shot) => placeOf(a) === placeOf(b) && a.mood === b.mood;
const camAt = (i: number, t: number): Cam & { shake: number; roll: number } => {
  const s = SHOTS[i];
  const beats = (BEATS as unknown as (Beat & { shot: string })[]).filter((b) => b.shot === s.id);
  // the moving preset is the base; plan beats add the Shorts cadence on top (smaller moves on moving presets)
  const base = CAMS[s.id](t);
  // beats on top of a moving preset stay small: they add cadence without throwing the subject out of frame
  const prm = beats.map((b) => {
    const d = Math.hypot(base.pos[0] - base.look[0], base.pos[1] - base.look[1], base.pos[2] - base.look[2]);
    if (b.move === "PUSH") return { frac: 0.06 };
    if (b.move === "PULL") return { frac: -0.06 };
    if (b.move.startsWith("ORBIT")) return { deg: 8 };
    if (b.move.startsWith("DOLLY")) return { side: 0.05 * d };
    if (b.move.startsWith("TILT")) return { deg: 4 };
    if (b.move.startsWith("CRANE")) return { up: 0.06 * d };
    return undefined;
  });
  let p = poseAt(base, beats, s.t, t, prm);
  if (i > 0 && sameRoom(SHOTS[i - 1], s) && t < s.t + BL) {
    // travel from the previous setup's camera into this one (no cut)
    const prev = CAMS[SHOTS[i - 1].id](t);
    const u = EASE.inOut((t - s.t) / BL, 3);
    const mix = (a: V3, b: V3): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    p = { ...p, pos: mix(prev.pos, p.pos), look: mix(prev.look, p.look), fov: prev.fov + (p.fov - prev.fov) * u };
  }
  return p as Cam & { shake: number; roll: number };
};

// ------------------------------------------------------------------ what is on screen in each setup
const World: React.FC<{ s: Shot; t: number; cam: Cam }> = ({ s, t, cam }) => {
  const id = s.id;
  const m = moodOf(s.mood);
  const after = (k: string) => SHOTS.findIndex((x) => x.id === id) >= SHOTS.findIndex((x) => x.id === k);
  if (s.set === "shaft") {
    return (
      <>
        <Shaft p={SHAFT_P} t={t} reveal={ramp(t, s.t, 1.2)} />
        <Label text="35 M" p={[SHAFT_P[0] + 2.0, -11.5, 0.05]} w={1.8} h={0.8} bg="none" fg="#ffffff" font={0.8} />
        <Label text="WATER" p={[SHAFT_P[0] - 2.4, -14.4, 0.05]} w={2.0} h={0.6} bg="none" fg="#e8f8ff" font={0.7} />
      </>
    );
  }
  if (s.set === "museum") {
    const kid = CAST.kid;
    const man = CAST.adult;
    return (
      <>
        <Museum p={MUSEUM_P} />
        <Character3D {...kid} position={[MUSEUM_P[0] - 2.6, 0, MUSEUM_P[2] + 0.4]} yaw={Math.PI + 0.15} t={t} face={{ ...EXPR.surprised.face, look: 0.2 }} pose={{ ...GESTURE.pointR, armRFwd: 70 }} />
        <Character3D {...man} position={[MUSEUM_P[0] - 1.6, 0, MUSEUM_P[2] + 1.0]} yaw={Math.PI - 0.2} t={t} face={EXPR.happy.face} pose={{ ...idle(t, 2), ...GESTURE.rest }} />
        <CastLight at={[MUSEUM_P[0], 1.6, MUSEUM_P[2] + 0.8]} cam={cam.pos} mood={m} />
      </>
    );
  }
  // ---- the desert
  const night = s.mood === "night";
  const damage = after("S12") ? 1 : 0;
  const fall = id === "S14" ? EASE.in(clamp((t - E.knocked - 0.08) / 1.5), 2) : after("S15") ? 1 : 0;
  const actors: React.ReactNode[] = [];
  let focus: V3 = [0, 3, 0];
  if (id === "S01" || id === "S02" || id === "S03") actors.push(<TagStone key="km" p={[-1.6, H(-1.6, 1.8), 1.8]} yaw={0.6} text="400 KM" />);
  if (id === "S03") actors.push(<Label key="niger" text="NIGER" p={[0, 0.06, 9]} r={[-Math.PI / 2, 0, 0]} w={14} h={4} bg="none" fg="#b8432a" font={0.8} />);
  if (id === "S05") actors.push(<TagStone key="300" p={[-3.6, H(-3.6, 3), 3]} yaw={-0.5} text="300 YEARS" w={1.9} />);
  if (id === "S06" || id === "S07") {
    actors.push(SIGN("AGADEZ ←", [9.8, 0, 1.5], -1.2), SIGN("BILMA →", [9.8, 0, 2.6], -1.2));
    for (let k = 0; k < 4; k++) {
      const c = camelAt(t, k);
      actors.push(<Camel key={`c${k}`} p={c.pos} yaw={c.yaw} walk={c.dist} t={t} load="salt" color={k % 2 ? "#c49a62" : "#d0a872"} />);
    }
    const lead = follow(CARAVAN_PTS, CARAVAN_KEYS, t + 2.4, H);
    const pointing = t > E.lose - 0.3 && t < E.lose + 1.6;
    actors.push(
      <Character3D key="drv" {...DRIVER} position={lead.pos} yaw={pointing ? lead.yaw - 1.4 : lead.yaw} t={t} face={pointing ? EXPR.excited.face : EXPR.happy.face} pose={{ ...(pointing ? GESTURE.pointR : GESTURE.rest), walk: walkPhase(lead.dist, DRIVER.height) }} />,
    );
    focus = camelAt(t, 1).pos;
  }
  if (id === "S08") {
    const lift = 0.5 + 0.5 * Math.sin((t - E.dug) * 1.4);
    actors.push(<Well key="well" p={[2.6, 0, 1.4]} lift={lift} />, <DateBoard key="d38" p={[-2.2, 0, 3.4]} yaw={0.3} text="1938" />);
    actors.push(
      <Character3D key="dg1" {...DIGGER} position={[1.5, 0, 1.6]} yaw={1.4} t={t} face={EXPR.happy.face} pose={{ armL: [60, 70], armR: [60, 70], armLFwd: 60, armRFwd: 60, lean: 6 + 4 * Math.sin((t - E.dug) * 2.8) }} />,
      <Character3D key="dg2" {...DIGGER2} position={[3.8, 0, 2.2]} yaw={-1.9} t={t} face={t > E.water ? EXPR.excited.face : EXPR.thinking.face} pose={t > E.water ? GESTURE.cheer : GESTURE.handsOnHips} />,
    );
    focus = [2.6, 1, 1.4];
  }
  if (id === "S10" || id === "S11" || id === "S12") {
    const c = id === "S10" ? vcar(t) : vcar(E.y1934 + 1);
    if (id !== "S12") actors.push(<Car key="vc" kind="vintage" color="#3a5a4a" p={c.pos} yaw={c.yaw} dist={c.dist} speed={c.speed} accel={c.accel} yawRate={c.yawRate} />);
    if (id === "S10") actors.push(<Burst key="dust" kind="dust" t0={t - 0.6} t={t} at={[c.pos[0], 0.2, c.pos[2]]} n={6} size={[0.3, 0.6]} colors={["#e0c08a"]} seed={Math.floor(t * 3)} />);
  }
  if (id === "S11" || id === "S12") {
    const back = id === "S12";
    const shocked = back && t > E.crashed59 - 0.15;
    const e = shocked ? EXPR.shocked : EXPR.happy;
    const tip = !back && t > E.y1934 && t < E.y1934 + 1.8;
    actors.push(
      <Character3D key="ex" {...EXPLORER} position={EXPL_P} yaw={EXPL_YAW} t={t} face={e.face} pose={{ ...idle(t, 4), ...(tip ? GESTURE.waveR : shocked ? GESTURE.handsUp : GESTURE.rest), ...e.body }} faceCamera={cam.pos} faceCameraAmount={0.25} />,
      <DateBoard key="date" p={[-4.4, 0, 4.8]} yaw={0.5} text={back ? "1959" : "1934"} />,
    );
    focus = explHead;
  }
  if (id === "S13" || id === "S14") {
    const tr = truck(t);
    actors.push(<Car key="tr" kind="truck" color="#b8622a" p={tr.pos} yaw={tr.yaw} dist={tr.dist} speed={tr.speed} accel={tr.accel} lights={1} damage={t > E.knocked ? 1 : 0} />, <Beams key="bm" p={tr.pos} yaw={tr.yaw} length={18} width={2.4} />);
    actors.push(<TagStone key="73" p={[4.5, H(4.5, 9.5), 9.5]} yaw={2.4} text="1973" color="#ffd060" />);
    focus = id === "S13" ? tr.pos : TRUNK;
    if (id === "S14") {
      const at: V3 = [TRUCK_DIR[0] * 0.9, 1.0, TRUCK_DIR[2] * 0.9];
      actors.push(
        <Burst key="db" kind="debris" t0={E.knocked} t={t} at={at} dir={[-0.5, 0.9, -0.4]} spread={0.8} n={28} colors={["#6a4a32", "#8a6a48", "#c8a878"]} groundY={0} />,
        <Burst key="du" kind="dust" t0={E.knocked} t={t} at={[at[0], 0.3, at[2]]} dir={[0, 0.5, 0]} n={18} size={[0.3, 0.6]} colors={["#c8a878", "#b89868", "#d8b888"]} groundY={0} seed={3} />,
        <Burst key="lv" kind="leaves" t0={E.knocked + 0.1} t={t} at={CROWN} dir={[-0.6, -0.2, -0.5]} n={50} colors={["#5e7f32", "#76963c", "#90ad4a"]} groundY={0} seed={7} />,
        <Burst key="dg" kind="dust" t0={E.knocked + 1.55} t={t} at={[-5, 0.2, -4]} dir={[0, 0.6, 0]} n={22} size={[0.4, 0.8]} colors={["#c8a878", "#b89868"]} groundY={0} seed={9} />,
      );
    }
  }
  const shakes = id === "S02" ? [E.thud1, E.twice] : [];
  return (
    <>
      <Desert night={night} dusk={s.mood === "sunset" || s.mood === "golden"} />
      {id === "S17" ? <group scale={1.7}><Sculpture p={[0, 0, 0]} /></group> : <HeroTree t={t} damage={damage} fall={fall} shakeAt={shakes} />}
      {actors}
      <CastLight at={focus} cam={cam.pos} mood={m} />
    </>
  );
};

const Setup: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  const s = SHOTS[i];
  const p = camAt(i, t);
  const cam = withShake(p, p.shake);
  const m = moodOf(s.mood);
  const indoor = s.set === "museum";
  const wide = s.id === "S03" || s.id === "S04" || s.id === "S15" || s.id === "S17";
  // S05: the sun travels across the sky (time passing): the key light swings and the shadow sweeps the sand
  const u = s.id === "S05" ? clamp((t - s.t) / (s.end - s.t)) : 0;
  const keyDir: V3 | undefined = s.id === "S05" ? [Math.cos(Math.PI * (0.15 + 0.7 * u)), 0.55 + 0.3 * Math.sin(Math.PI * u), 0.35] : undefined;
  const focus: V3 = s.set === "shaft" ? [SHAFT_P[0], cam.look[1], 0] : cam.look;
  return (
    <View mood={m} cam={cam} t={t} focus={focus} blur={wide ? 0.4 : 1.1} sky={!indoor && s.set !== "shaft"} shadowExtent={indoor || s.set === "shaft" ? undefined : wide ? 60 : 30} far={1000} keyDir={keyDir}>
      <World s={s} t={t} cam={cam} />
    </View>
  );
};

const CHUNKS = makeChunks(WORDS as unknown as Word[], DURATION / 30);
const LAST = WORDS[WORDS.length - 1][2];

export const Tenere: React.FC<{ sub?: boolean }> = ({ sub = false }) => {
  const ready = useFonts();
  const g = useCurrentFrame();
  if (!ready) return <AbsoluteFill style={{ background: "#1a1220" }} />;
  const { n, fp } = sub ? subFrame(g) : { n: g, fp: g };
  const t = fp / 30;
  let i = SHOTS.findIndex((s) => t >= s.t && t < s.end);
  if (i < 0) i = SHOTS.length - 1;
  const prevFade = i > 0 && !sameRoom(SHOTS[i - 1], SHOTS[i]) && t < SHOTS[i].t + XF ? 1 - (t - SHOTS[i].t) / XF : 0;
  return (
    <AbsoluteFill style={{ background: "#1a1220" }}>
      <Setup i={i} t={t} />
      {prevFade > 0 ? (
        <AbsoluteFill style={{ opacity: prevFade }}>
          <Setup i={i - 1} t={t} />
        </AbsoluteFill>
      ) : null}
      <Captions chunks={CHUNKS} t={n / 30} until={LAST + 0.35} />
    </AbsoluteFill>
  );
};

/** look-dev: one setup at a time, at its middle (or `at` s into it), for stills */
export const TenereLook: React.FC<{ shot: string; at?: number }> = ({ shot, at }) => {
  const ready = useFonts();
  if (!ready) return <AbsoluteFill style={{ background: "#1a1220" }} />;
  const i = SHOTS.findIndex((s) => s.id === shot);
  const s = SHOTS[i];
  const t = at !== undefined ? s.t + at : (s.t + s.end) / 2;
  return (
    <AbsoluteFill style={{ background: "#1a1220" }}>
      <Setup i={i} t={t} />
      <Captions chunks={CHUNKS} t={t} until={LAST + 0.35} />
    </AbsoluteFill>
  );
};
