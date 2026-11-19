// "The 10 days that never happened": a 1080x1920 Short. One setup per clause: the picture follows the words. Every setup, beat and event time comes from plan.gen.ts
// (plan/calendar_plan.py, anchored to the voice-over words). Setup changes inside the study are camera moves; changes
// of place or time are short dissolves. CalendarSub renders SUB sub-frames per frame for motion blur.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CAST } from "../../inkbeat/char/cast";
import { Character3D, headOf } from "../../inkbeat/char/Character3D";
import type { CharacterSpec, FaceState, Pose } from "../../inkbeat/char/Character3D";
import { CLOTH, ELDER_BUILD, HAIR, SKIN } from "../../inkbeat/char/family";
import { Captions, makeChunks } from "../../inkbeat/core/captions";
import type { Word } from "../../inkbeat/core/captions";
import { CastLight } from "../../inkbeat/core/castLight";
import { subFrame, useFonts } from "../../inkbeat/core/frame";
import { handWorld } from "../../inkbeat/core/ik";
import { moodOf } from "../../inkbeat/core/moods";
import { aim, poseAt, withShake } from "../../inkbeat/core/rig";
import type { Beat, BeatPrm, Cam } from "../../inkbeat/core/rig";
import { View } from "../../inkbeat/core/View";
import type { V3 } from "../../inkbeat/types";
import { BEATS, DURATION, EVENTS, SHOTS, WORDS } from "./plan.gen";
import { Bust, Card, Cell, Clock, DayBlocks, DayStrip, Flag, MarchWall, Orrery, PlaqueBoard, RedFlag, Shears, Study, Tablet, TearCalendar, Town, Veil, YearPlaque } from "./props";
import { boxG, M } from "../../inkbeat/core/kit";

export const CAL_FRAMES = DURATION;
const E = EVENTS;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ramp = (t: number, a: number, d = 0.3) => clamp((t - a) / d);
const XF = 0.33; // dissolve length (s)

// ------------------------------------------------------------------ cast (one family)
const POPE: CharacterSpec = {
  height: 1.64,
  build: ELDER_BUILD,
  look: {
    skin: SKIN.fair,
    outfit: "jacket",
    colors: { top: "#f4f4f8", inner: "#b8202a", bottom: "#e8e8ee", shoes: CLOTH.oxblood, accent: CLOTH.brass },
    hair: "sides",
    hairColor: HAIR.silver,
    hat: "beanie",
    hatColor: "#f4f0e8",
    face: { nose: "hook", blush: 0.25, lines: true, brow: 1.3, eyeColor: "#4a3a2a" },
    seed: 11,
  },
};
const MAN = CAST.adult;
const KID = CAST.kid;
const ELDER = CAST.elder;

// ------------------------------------------------------------------ places
const CAL_P: V3 = [0.4, 2.35, -5.12]; // the wall calendar on the brick house
const POPE_P: V3 = [0.6, 0, -2.05];
const MAN_P: V3 = [-0.3, 0.16, -2.1];
const KID_P: V3 = [1.0, 0.16, -2.2];
const ELDER_P: V3 = [-2.4, 0.16, -3.2];
const popeHead = headOf(POPE_P, POPE.height, POPE.build);
const manHead = headOf(MAN_P, MAN.height, MAN.build);
const elderHead = headOf(ELDER_P, ELDER.height, ELDER.build);
const BUST_P: V3 = [-2.5, 0, -2.4];
const ORR_P: V3 = [1.55, 0.87, -0.85];
const BLK_P: V3 = [1.0, 0.87, -0.72];
const MARCH_P: V3 = [0.2, 2.75, -3.8];

type SetName = "town" | "study" | "snow" | "cell";
// the nuns (Teresa lies in bed; a sister prays beside her)
const NUN: CharacterSpec = {
  height: 1.6,
  build: ELDER_BUILD,
  look: { skin: SKIN.fair, outfit: "sweater", colors: { top: "#4a3226", inner: "#f4f0e6", bottom: "#3a2a20", shoes: "#2a1e18", accent: CLOTH.brass }, hair: "none", face: { nose: "button", blush: 0.2, lines: true, brow: 1.1, eyeColor: "#4a3a2a" }, seed: 21 },
};
const SISTER: CharacterSpec = { ...NUN, height: 1.58, look: { ...NUN.look, face: { nose: "hook", blush: 0.3, brow: 1.2 }, seed: 23 } };
const VEIL_R = 0.135 * 1.6 * 1.05;
const nunHeadLocal = headOf([0, 0, 0], NUN.height, NUN.build);
const sisHeadLocal = headOf([0, 0, 0], SISTER.height, SISTER.build);
const TERESA_P: V3 = [0, 0.78, -0.22]; // soles at the foot of the bed; she lies on her back, head toward -z
const SIS_P: V3 = [-1.05, 0, -1.25];
const teresaHead: V3 = [0, 0.78 + nunHeadLocal[2], -0.22 - nunHeadLocal[1]];
const sisHead: V3 = [SIS_P[0], sisHeadLocal[1], SIS_P[2]];
const TABLET_P: V3 = [-1.3, 0, -2.75];
const CLOCK_P: V3 = [1.0, 0.87, -1.4];
const EGG_P: V3 = [0.45, 2.95, -3.7];
const FLAGS = [
  { x: -2.3, name: "SPAIN", stripes: ["#c8202a", "#f4c020", "#f4c020", "#c8202a"], v: false, at: E.spain },
  { x: -0.95, name: "PORTUGAL", stripes: ["#1a7a3a", "#c8202a", "#c8202a"], v: true, at: E.portugal },
  { x: 1.75, name: "POLAND", stripes: ["#f4f4f4", "#d02030"], v: false, at: E.poland },
  { x: 3.1, name: "ITALY", stripes: ["#1a8a4a", "#f4f4f4", "#d02030"], v: true, at: E.italy },
];

/** the base lens and the depth-of-field focus of each setup (one per clause) */
const SETUP: Record<string, { cam: Cam; focus: V3; blur: number }> = {
  A01: { cam: aim([1.0, 2.2, -2.0], CAL_P, 44, 0.42), focus: CAL_P, blur: 1.2 },
  A02: { cam: aim([1.7, 2.4, 0.8], [-0.35, 0.95, -1.35], 50, 0.45), focus: [-0.2, 1.0, -1.4], blur: 1.0 },
  A03: { cam: aim([0.75, 1.75, -1.15], [teresaHead[0], teresaHead[1] + 0.12, teresaHead[2]], 40, 0.45), focus: teresaHead, blur: 2.0 },
  A04: { cam: aim([1.4, 1.45, 2.4], [0.1, 1.95, -3.6], 50, 0.42), focus: manHead, blur: 1.0 },
  A05: { cam: aim([0.7, 1.3, 1.3], [0.35, 1.25, -2.2], 48, 0.42), focus: [0.35, 1.3, -2.2], blur: 1.4 },
  A06: { cam: aim([-0.2, 1.4, 0.55], popeHead, 46, 0.42), focus: popeHead, blur: 1.6 },
  A07: { cam: aim([-1.0, 1.75, 0.2], [BUST_P[0], 1.55, BUST_P[2]], 44, 0.4), focus: [BUST_P[0], 1.6, BUST_P[2]], blur: 2.0 },
  A08: { cam: aim([-0.9, 1.5, -0.5], [TABLET_P[0], 1.25, TABLET_P[2]], 42, 0.45), focus: [TABLET_P[0], 1.25, TABLET_P[2]], blur: 2.0 },
  A09: { cam: aim([2.0, 1.5, 0.7], [1.3, 1.15, -1.1], 44, 0.45), focus: [1.3, 1.15, -1.1], blur: 2.2 },
  A10: { cam: aim([-0.8, 1.45, 1.6], popeHead, 44, 0.42), focus: popeHead, blur: 1.8 },
  A11: { cam: aim([0.3, 1.5, 0.75], [0.85, 1.15, -0.75], 44, 0.45), focus: [0.85, 1.15, -0.75], blur: 2.2 },
  A12: { cam: aim([0.6, 2.2, 1.6], MARCH_P, 46, 0.42), focus: MARCH_P, blur: 1.0 },
  A13: { cam: aim([0.75, 2.65, -1.7], EGG_P, 40, 0.45), focus: EGG_P, blur: 2.0 },
  A14: { cam: aim([0.3, 1.35, 1.1], popeHead, 46, 0.42), focus: popeHead, blur: 1.8 },
  A15: { cam: aim([3.2, 1.45, 1.7], [3.45, 1.35, -2.9], 52, 0.5), focus: [3.45, 1.35, -2.9], blur: 1.0 },
  A16: { cam: aim([0.4, 1.7, 3.3], [0.4, 1.95, -3.4], 56, 0.42), focus: [0.4, 1.6, -3.0], blur: 0.6 },
  A17: { cam: aim([-3.3, 1.35, -0.9], elderHead, 46, 0.4), focus: elderHead, blur: 1.6 },
  A18: { cam: aim([2.2, 1.6, 0.9], CAL_P, 50, 0.38), focus: CAL_P, blur: 0.8 },
  A19: { cam: aim([0.6, 1.6, 2.6], [0.0, 1.9, -3.4], 50, 0.42), focus: manHead, blur: 1.0 },
  A20: { cam: aim([1.6, 1.6, 1.6], CAL_P, 48, 0.4), focus: CAL_P, blur: 0.8 },
  A21: { cam: aim([0.6, 1.5, 3.2], [0.3, 1.8, -3.4], 54, 0.42), focus: [0.3, 1.4, -2.4], blur: 0.8 },
};

// small, safe move sizes for every beat (pushes never reach the subject)
const PRM: Record<string, BeatPrm> = {
  PUSH: { frac: 0.1 }, PULL: { frac: -0.09 }, ORBIT_L: { deg: 12 }, ORBIT_R: { deg: 12 }, DOLLY_L: { side: 0.35 }, DOLLY_R: { side: 0.35 },
  CRANE_UP: { up: 0.3, tilt: 0.5 }, TILT_UP: { deg: 6 },
};
type Shot = (typeof SHOTS)[number];
const setOf = (s: Shot) => s.set as SetName;
const shot = (id: string) => SHOTS.find((x) => x.id === id)!;
// dissolve in where one camera move would be too far (A17) or the props change (A21: another calendar)
const DISSOLVE_IN = new Set(["A17", "A21"]);
const sameSet = (a: Shot, b: Shot) => setOf(a) === setOf(b) && a.mood === b.mood && !DISSOLVE_IN.has(b.id);

const camAt = (i: number, t: number): { cam: Cam; shake: number } => {
  const s = SHOTS[i];
  const base = SETUP[s.id];
  const own = BEATS.filter((b) => b.shot === s.id);
  const beats: Beat[] = own.map((b) => ({ t: b.t, move: b.move, dur: 0.63, word: b.word }));
  const prms: BeatPrm[] = own.map((b) => PRM[b.move] ?? {});
  // a setup change inside the same place is a camera move from where the last setup ended
  if (i > 0 && sameSet(SHOTS[i - 1], s)) {
    const from = camAt(i - 1, s.t).cam;
    beats.unshift({ t: s.t, move: "TO", dur: 0.7 });
    prms.unshift({ to: base.cam, dur: 0.7 });
    const p = poseAt(from, beats, s.t, t, prms);
    return { cam: withShake(p, p.shake), shake: p.shake };
  }
  const p = poseAt(base.cam, beats, s.t, t, prms);
  return { cam: withShake(p, p.shake), shake: p.shake };
};

// ------------------------------------------------------------------ one setup's world at time t
const World: React.FC<{ i: number; t: number; cam: Cam }> = ({ i, t, cam }) => {
  const s = SHOTS[i];
  const id = s.id;
  const set = setOf(s);
  const m = moodOf(s.mood);
  const actors: React.ReactNode[] = [];
  const pope = (pose: Pose, face: FaceState, hold?: number) => {
    const p: Pose = { headTilt: -3, ...pose };
    const hand = handWorld({ position: POPE_P, yaw: 0, pose: p, side: "R", height: POPE.height, build: POPE.build });
    actors.push(<Character3D key="pope" {...POPE} position={POPE_P} yaw={0} t={t} face={face} pose={p} faceCamera={cam.pos} faceCameraAmount={0} />);
    if (hold !== undefined) actors.push(<Shears key="shears" p={[hand[0] + 0.02, hand[1] + 0.05, hand[2] + 0.06]} r={[0.2, 0, -0.5]} s={0.9} snip={hold} />);
  };
  // ---- the convent cell: Teresa dies (eyes close, the candle goes out, the room dims)
  if (set === "cell") {
    const gone = ramp(t, E.died, 0.5);
    return (
      <>
        <Cell t={t} candleOut={ramp(t, E.died + 0.15, 0.6)} />
        <group position={TERESA_P} rotation={[-Math.PI / 2, 0, 0]}>
          <Character3D {...NUN} position={[0, 0, 0]} yaw={0} t={t} face={{ eyes: gone > 0.5 ? "closed" : "half", mouth: "smile", brows: "neutral", blink: false }} pose={{ armL: [8, 20], armR: [8, 20], headTilt: gone * 12 }} />
          <Veil head={nunHeadLocal} r={VEIL_R} />
        </group>
        <M g={boxG(1.06, 0.14, 1.0)} c="#6a5a8a" tex="fabric" p={[0, 0.84, -0.62]} />
        <M g={boxG(1.08, 0.06, 0.16)} c="#f4efe4" tex="fabric" p={[0, 0.9, -1.1]} />
        <group position={SIS_P} rotation={[0, 1.15, 0]}>
          <Character3D {...SISTER} position={[0, 0, 0]} yaw={0} t={t} face={{ eyes: gone > 0.5 ? "closed" : "half", mouth: gone > 0.5 ? "frown" : "smile", brows: "worried" }} pose={{ armL: [38, 118], armR: [38, 118], armLFwd: 72, armRFwd: 72, headNod: 14 }} />
          <Veil head={sisHeadLocal} r={VEIL_R * 0.99} />
        </group>
        <CastLight at={id === "A03" ? teresaHead : sisHead} cam={cam.pos} mood={m} />
      </>
    );
  }
  if (set === "study") {
    const snip = id === "A06" ? ramp(t, E.deleted, 0.2) : id === "A14" ? ramp(t, E.cut, 0.2) : 0;
    if (["A06", "A07", "A09", "A10", "A11", "A14", "A15"].includes(id)) {
      if (id === "A10") pope({ armL: [70, 80], armR: [70, 80], armLFwd: 20, armRFwd: 20, headTilt: 8 }, { eyes: "half", mouth: "smirk", brows: "raised" });
      else pope({ armL: [12, 30], armR: [55, 95], armRFwd: 40 }, { eyes: snip > 0.5 ? "squint" : "open", mouth: snip > 0.5 ? "grin" : "smirk", brows: "raised", look: 0.1 }, snip);
    }
    const fall = id === "A06" ? ramp(t, E.deleted + 0.15, 1.2) : id === "A14" || id === "A15" ? ramp(t, E.cut + 0.15, 1.2) : 1;
    const strip = fall < 1 && ["A06", "A14"].includes(id) ? <DayStrip key="strip" p={[0.6, 1.08, -1.3]} fall={fall} /> : null;
    const a11 = shot("A11");
    const blocks = clamp((t - E.y128) / Math.max(0.5, a11.end - E.y128 - 0.3));
    const drift = clamp((t - E.spring) / Math.max(0.6, shot("A13").end - E.spring - 0.3));
    return (
      <>
        <Study t={t} />
        <Bust p={BUST_P} yaw={0.6} tag="CAESAR" />
        <Tablet p={TABLET_P} yaw={0.3} text="365.25" text2="DAYS" />
        <Orrery p={ORR_P} t={t} year={t * 0.22} s={0.5} />
        <Clock p={CLOCK_P} back={ramp(t, E.minutes, 0.7)} s={0.8} />
        <DayBlocks p={BLK_P} k={t < a11.t ? 0 : blocks} />
        {t >= E.y128 - 0.1 ? <Card p={[0.95, 0.87, -0.42]} text="128 YEARS" yaw={0.4} /> : null}
        <MarchWall p={MARCH_P} drift={drift} t={t} />
        {[["1700", "NO", E.skip + 0.35], ["1800", "NO", E.skip + 0.75], ["1900", "NO", E.wasnt], ["2000", "YES", E.was]].map(([y, st, at], k) => (
          <YearPlaque key={y as string} p={[2.93 + (k % 2) * 1.04, 1.72 - Math.floor(k / 2) * 0.74, -2.9]} year={y as string} stamp={st as "NO" | "YES"} on={t >= (at as number)} />
        ))}
        <PlaqueBoard />
        {strip}
        {actors}
        <CastLight at={id === "A07" ? [BUST_P[0], 1.7, BUST_P[2]] : popeHead} cam={cam.pos} mood={m} />
      </>
    );
  }
  // ---- town / snow
  let calendar: React.ReactNode = null;
  let sign = "CONVENT";
  let banner: string | undefined;
  let lamp = 0;
  let flags: React.ReactNode = null;
  let focusHead: V3 = manHead;
  const octPages = [{ month: "THURSDAY", day: "4", foot: "OCTOBER 1582" }, ...Array.from({ length: 10 }, (_, k) => ({ month: "OCTOBER", day: String(5 + k) })), { month: "FRIDAY", day: "15", foot: "OCTOBER 1582" }];
  if (id === "A01") {
    lamp = 1;
    focusHead = CAL_P;
    calendar = <TearCalendar p={CAL_P} t={t} pages={octPages} flipA={E.flipA} flipB={E.flipB} />;
  } else if (id === "A04" || id === "A05") {
    calendar = <TearCalendar p={CAL_P} t={t} pages={octPages} flipA={E.flipA} flipB={E.flipB} />;
    const shock = t >= E.flipB - 0.1;
    const count = id === "A05";
    actors.push(<Character3D key="man" {...MAN} position={MAN_P} yaw={0.3} t={t} face={{ eyes: count ? "squint" : shock ? "wide" : "open", mouth: count ? "frown" : shock ? "o" : "open", brows: count ? "worried" : "raised", look: count ? 0 : 0.5 }} pose={count ? { armL: [40, 100], armR: [40, 100], armLFwd: 70, armRFwd: 70, headNod: 10 } : { armL: [20, 40], armR: shock ? [80, 110] : [20, 40], armRFwd: 30, headYaw: shock ? 0 : 35, headNod: -8, lean: shock ? -4 : 0 }} faceCamera={cam.pos} />);
    if (count) actors.push(<Character3D key="kid" {...KID} position={KID_P} yaw={-0.3} t={t} face={{ eyes: "open", mouth: "o", brows: "worried", look: -0.4 }} pose={{ armL: [20, 30], armR: [150, 120], armRFwd: 30, headTilt: -10 }} faceCamera={cam.pos} />);
  } else if (id === "A16" || id === "A17") {
    sign = "PLAZA";
    calendar = <TearCalendar p={CAL_P} t={t} pages={[{ month: "OCTOBER", day: "15", foot: "1582" }]} />;
    flags = FLAGS.map((f) => <Flag key={f.name} p={[f.x, 0.16, -3.3]} stripes={f.stripes} vertical={f.v} name={f.name} up={ramp(t, f.at - 0.1, 0.45)} t={t} />);
    const cheer = t >= E.cheer - 0.2;
    actors.push(<Character3D key="kid" {...KID} position={KID_P} yaw={-0.3} t={t} face={{ eyes: "open", mouth: cheer ? "grin" : "smile", brows: "raised" }} pose={{ armL: cheer ? [150, 20] : [15, 20], armR: cheer ? [150, 20] : [15, 20], bob: cheer ? Math.abs(Math.sin(t * 6)) * 10 : 0 }} faceCamera={cam.pos} />);
    actors.push(<Character3D key="man" {...MAN} position={MAN_P} yaw={0.3} t={t} face={{ eyes: "open", mouth: cheer ? "grin" : "smile", brows: "raised" }} pose={{ armL: [20, 30], armR: cheer ? [140, 30] : [20, 30] }} faceCamera={cam.pos} />);
    const doze = id === "A17";
    if (doze) focusHead = elderHead;
    actors.push(<Character3D key="elder" {...ELDER} position={ELDER_P} yaw={0.6} t={t} face={doze ? { eyes: "closed", mouth: "o", brows: "neutral", blink: false } : { eyes: "open", mouth: "smile" }} pose={{ armL: [10, 60], armR: [10, 60], armLFwd: 50, armRFwd: 50, headTilt: doze ? 14 + Math.sin(t * 1.4) * 3 : 0, headNod: doze ? 12 : 0 }} faceCamera={cam.pos} />);
  } else if (id === "A18") {
    sign = "LONDON";
    banner = "1752";
    focusHead = CAL_P;
    const sept = Array.from({ length: 13 }, (_, k) => ({ month: "SEPTEMBER", day: String(k === 0 ? 2 : k + 2) }));
    calendar = <TearCalendar p={CAL_P} t={t} pages={sept} flipA={E.ukA - 0.1} flipB={E.ukB} head="#2a3a7a" />;
    actors.push(<Character3D key="man" {...MAN} position={MAN_P} yaw={0.3} t={t} face={{ eyes: t > E.ukA ? "wide" : "open", mouth: t > E.ukA ? "o" : "frown", brows: "worried", look: 0.5 }} pose={{ armL: [20, 40], armR: [20, 40], headYaw: 30, headNod: -10 }} faceCamera={cam.pos} />);
  } else if (id === "A19") {
    sign = "STOCKHOLM";
    banner = "1712";
    calendar = <TearCalendar p={CAL_P} t={t} pages={[{ month: "FEBRUARY", day: "29" }, { month: "FEBRUARY", day: "30" }]} flipA={E.feb} flipB={E.feb + 0.4} head="#2a5a8a" />;
    const huh = t >= E.feb + 0.3;
    actors.push(<Character3D key="man" {...MAN} position={MAN_P} yaw={0.3} t={t} face={{ eyes: huh ? "squint" : "open", mouth: huh ? "frown" : "open", brows: huh ? "worried" : "raised", look: 0.5 }} pose={{ armL: [20, 40], armR: huh ? [150, 120] : [20, 40], armRFwd: 30, headTilt: huh ? -10 : 0, headYaw: huh ? 0 : 30 }} faceCamera={cam.pos} />);
  } else if (id === "A20") {
    sign = "PETROGRAD";
    banner = "RUSSIA";
    lamp = 1;
    focusHead = CAL_P;
    calendar = <TearCalendar p={CAL_P} t={t} pages={[{ month: "JANUARY", day: "31", foot: "1918" }, { month: "FEBRUARY", day: "14", foot: "1918" }]} flipA={E.r1918 - 0.1} flipB={E.r1918 + 0.3} head="#8a1a2a" />;
    actors.push(<Character3D key="elder" {...ELDER} position={[0.9, 0.16, -2.5]} yaw={-0.2} t={t} face={{ eyes: t > E.r1918 ? "wide" : "open", mouth: t > E.r1918 ? "o" : "smile", brows: "raised", look: 0.6 }} pose={{ armL: [10, 30], armR: [10, 30], headYaw: 35 }} faceCamera={cam.pos} />);
  } else if (id === "A21") {
    sign = "PETROGRAD";
    banner = "1917";
    lamp = 1;
    focusHead = [0.3, 1.4, -2.4];
    calendar = <TearCalendar p={CAL_P} t={t} pages={[{ month: "OCTOBER", day: "25", foot: "1917" }, { month: "NOVEMBER", day: "7", foot: "1917" }]} flipA={E.nov - 0.15} flipB={E.nov + 0.25} head="#8a1a2a" />;
    const marchers: [CharacterSpec, V3, number][] = [[MAN, [-1.8, 0.16, -2.3], 0.2], [KID, [-0.9, 0.16, -1.8], 0.1], [ELDER, [1.7, 0.16, -2.3], -0.25]];
    marchers.forEach(([c, pos, yaw], k) => {
      const turn = t >= E.nov;
      const pose: Pose = { armL: [12, 25], armR: [55, 80], armRFwd: 35, walk: turn ? 0 : t * 6 + k, bob: turn ? 0 : Math.abs(Math.sin(t * 6 + k)) * 6 };
      const hand = handWorld({ position: pos, yaw, pose, side: "R", height: c.height, build: c.build });
      actors.push(<Character3D key={`m${k}`} {...c} position={pos} yaw={yaw} t={t} face={{ eyes: turn ? "wide" : "open", mouth: turn ? "o" : "grin", brows: "raised", look: turn ? 0.5 : 0 }} pose={{ ...pose, headYaw: turn ? 30 : 0 }} faceCamera={cam.pos} />);
      actors.push(<RedFlag key={`f${k}`} p={hand} t={t} seed={k} />);
    });
  }
  return (
    <>
      <Town sign={sign} banner={banner} lamp={lamp} snow={set === "snow"} t={t} noPost={id === "A16" || id === "A17"} />
      {calendar}
      {flags}
      {actors}
      <CastLight at={focusHead} cam={cam.pos} mood={m} />
    </>
  );
};

const Shot1: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  const s = SHOTS[i];
  const { cam } = camAt(i, t);
  const base = SETUP[s.id];
  const indoor = setOf(s) === "study" || setOf(s) === "cell";
  const dim = setOf(s) === "cell" ? -0.45 * ramp(t, E.died + 0.2, 0.8) : 0;
  return (
    <View mood={moodOf(s.mood)} cam={cam} t={t} focus={base.focus} blur={base.blur} sky={!indoor} exposure={dim}>
      <World i={i} t={t} cam={cam} />
    </View>
  );
};

const CHUNKS = makeChunks(WORDS as unknown as Word[], DURATION / 30);
const LAST = E.end;

export const Calendar: React.FC<{ sub?: boolean }> = ({ sub = false }) => {
  const ready = useFonts();
  const g = useCurrentFrame();
  if (!ready) return <AbsoluteFill style={{ background: "#1a1220" }} />;
  const { n, fp } = sub ? subFrame(g) : { n: g, fp: g };
  const t = fp / 30;
  let i = SHOTS.findIndex((s) => t >= s.t && t < s.end);
  if (i < 0) i = SHOTS.length - 1;
  // a dissolve into a new place or time: the previous setup fades out over XF seconds
  const prevFade = i > 0 && !sameSet(SHOTS[i - 1], SHOTS[i]) && t < SHOTS[i].t + XF ? 1 - (t - SHOTS[i].t) / XF : 0;
  return (
    <AbsoluteFill style={{ background: "#1a1220" }}>
      <Shot1 i={i} t={t} />
      {prevFade > 0 ? (
        <AbsoluteFill style={{ opacity: prevFade }}>
          <Shot1 i={i - 1} t={t} />
        </AbsoluteFill>
      ) : null}
      <Captions chunks={CHUNKS} t={n / 30} until={LAST + 0.35} />
    </AbsoluteFill>
  );
};
