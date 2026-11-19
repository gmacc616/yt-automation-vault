// "The 10 days that never happened": a 1080x1920 Short. Every setup, beat and event time comes from plan.gen.ts
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
import { Bust, DayBlocks, DayStrip, MarchWall, Orrery, Shears, Study, TearCalendar, Town, YearPlaque } from "./props";

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
    outfit: "sweater",
    colors: { top: "#f2eee6", inner: CLOTH.cream, bottom: "#ece6da", shoes: CLOTH.oxblood, accent: CLOTH.brass },
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
const MAN_P: V3 = [-0.7, 0.16, -2.2];
const KID_P: V3 = [1.0, 0.16, -2.2];
const ELDER_P: V3 = [-2.4, 0.16, -3.2];
const popeHead = headOf(POPE_P, POPE.height, POPE.build);
const manHead = headOf(MAN_P, MAN.height, MAN.build);
const elderHead = headOf(ELDER_P, ELDER.height, ELDER.build);
const BUST_P: V3 = [-2.5, 0, -2.4];
const ORR_P: V3 = [1.55, 0.87, -0.85];
const BLK_P: V3 = [0.4, 0.87, -0.95];
const MARCH_P: V3 = [0.2, 2.75, -3.8];

type SetName = "town" | "study" | "snow";
/** the base lens and the depth-of-field focus of each setup */
const SETUP: Record<string, { cam: Cam; focus: V3; blur: number }> = {
  S01: { cam: aim([3.6, 1.9, 4.6], CAL_P, 50, 0.36), focus: CAL_P, blur: 0.8 },
  S02: { cam: aim([1.2, 1.35, 0.6], [manHead[0] + 0.5, manHead[1] + 0.35, manHead[2]], 50, 0.42), focus: manHead, blur: 1.6 },
  S03: { cam: aim([0.9, 1.5, 0.75], popeHead, 46, 0.36), focus: popeHead, blur: 1.6 },
  S04: { cam: aim([-1.0, 1.75, 0.2], [BUST_P[0], 1.55, BUST_P[2]], 44, 0.4), focus: [BUST_P[0], 1.6, BUST_P[2]], blur: 2.0 },
  S05: { cam: aim([2.1, 1.45, 0.35], [ORR_P[0], ORR_P[1] + 0.31, ORR_P[2]], 42, 0.45), focus: [ORR_P[0], ORR_P[1] + 0.31, ORR_P[2]], blur: 2.4 },
  S06: { cam: aim([-0.8, 1.45, 1.6], popeHead, 44, 0.36), focus: popeHead, blur: 1.8 },
  S07: { cam: aim([0.0, 1.55, 0.55], [BLK_P[0], 1.2, BLK_P[2]], 44, 0.45), focus: [BLK_P[0], 1.2, BLK_P[2]], blur: 2.2 },
  S08: { cam: aim([0.6, 2.2, 1.6], MARCH_P, 46, 0.42), focus: MARCH_P, blur: 1.0 },
  S09: { cam: aim([1.5, 1.4, 1.2], popeHead, 44, 0.36), focus: popeHead, blur: 1.8 },
  S10: { cam: aim([3.4, 1.5, 1.6], [3.7, 1.0, -2.9], 46, 0.48), focus: [3.7, 1.0, -2.9], blur: 1.0 },
  S11: { cam: aim([0.4, 1.45, 3.4], [0.4, 1.8, -3.4], 54, 0.42), focus: [0.4, 1.5, -3.0], blur: 0.8 },
  S12: { cam: aim([-1.0, 1.35, -0.6], elderHead, 46, 0.36), focus: elderHead, blur: 1.6 },
  S13: { cam: aim([2.2, 1.6, 0.9], CAL_P, 50, 0.38), focus: CAL_P, blur: 0.8 },
  S14: { cam: aim([0.6, 1.6, 2.6], [0.0, 1.9, -3.4], 50, 0.42), focus: manHead, blur: 1.0 },
  S15: { cam: aim([-0.8, 1.5, 2.6], [-0.3, 1.9, -3.6], 50, 0.4), focus: CAL_P, blur: 0.9 },
};

// small, safe move sizes for every beat (pushes never reach the subject)
const PRM: Record<string, BeatPrm> = {
  PUSH: { frac: 0.1 }, PULL: { frac: -0.09 }, ORBIT_L: { deg: 12 }, ORBIT_R: { deg: 12 }, DOLLY_L: { side: 0.35 }, DOLLY_R: { side: 0.35 },
  CRANE_UP: { up: 0.3, tilt: 0.5 }, TILT_UP: { deg: 6 },
};
type Shot = (typeof SHOTS)[number];
const setOf = (s: Shot) => s.set as SetName;
const sameSet = (a: Shot, b: Shot) => setOf(a) === setOf(b) && a.mood === b.mood;

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
  let calendar: React.ReactNode = null;
  const octPages = Array.from({ length: 12 }, (_, k) => ({ month: "OCTOBER", day: String(4 + k) }));
  if (set === "study") {
    const snip = id === "S03" ? ramp(t, E.deleted, 0.2) : id === "S09" ? ramp(t, E.cut, 0.2) : 0;
    if (["S03", "S06", "S09"].includes(id) || id === "S04" || id === "S05" || id === "S07" || id === "S10") {
      if (id === "S06") pope({ armL: [70, 80], armR: [70, 80], armLFwd: 20, armRFwd: 20, headTilt: 8 }, { eyes: "half", mouth: "smirk", brows: "raised" });
      else pope({ armL: [12, 30], armR: [55, 95], armRFwd: 40 }, { eyes: snip > 0.5 ? "squint" : "open", mouth: snip > 0.5 ? "grin" : "smirk", brows: "raised", look: 0.1 }, snip);
    }
    const fall = id === "S03" ? ramp(t, E.deleted + 0.15, 1.2) : id === "S09" || id === "S10" ? ramp(t, E.cut + 0.15, 1.2) : id === "S06" || id === "S04" || id === "S05" || id === "S07" || id === "S08" ? 1 : 0;
    const strip = fall < 1 && ["S03", "S09"].includes(id) ? <DayStrip key="strip" p={[0.6, 1.08, -1.3]} fall={fall} /> : null;
    const s07 = SHOTS.find((x) => x.id === "S07")!;
    const s08 = SHOTS.find((x) => x.id === "S08")!;
    const blocks = clamp((t - s07.t) / Math.max(0.5, s07.end - s07.t - 0.4));
    const drift = clamp((t - E.spring) / Math.max(0.6, s08.end - E.spring - 0.6));
    return (
      <>
        <Study t={t} />
        <Bust p={BUST_P} yaw={0.6} tag="365.25" />
        <Orrery p={ORR_P} t={t} year={t * 0.22} s={0.5} />
        <DayBlocks p={BLK_P} k={id === "S07" ? blocks : t > s07.t ? 1 : 0} />
        <MarchWall p={MARCH_P} drift={id === "S08" ? drift : t > s08.t ? 1 : 0} t={t} />
        {[["1700", "NO", E.skip + 0.35], ["1800", "NO", E.skip + 0.75], ["1900", "NO", E.wasnt], ["2000", "YES", E.was]].map(([y, st, at], k) => (
          <YearPlaque key={y as string} p={[2.2 + k * 1.0, 0.95, -2.9]} year={y as string} stamp={st as "NO" | "YES"} on={t >= (at as number)} />
        ))}
        {strip}
        {actors}
        <CastLight at={id === "S04" ? [BUST_P[0], 1.7, BUST_P[2]] : popeHead} cam={cam.pos} mood={m} />
      </>
    );
  }
  // ---- town / snow
  let sign = "CONVENT";
  let banner: string | undefined;
  let lamp = 0;
  if (id === "S01") {
    lamp = 1;
    calendar = <TearCalendar p={CAL_P} t={t} pages={octPages} flipA={E.flipA} flipB={E.flipB} />;
  } else if (id === "S02") {
    calendar = <TearCalendar p={CAL_P} t={t} pages={octPages} flipA={E.flipA} flipB={E.flipB} />;
    const shock = t >= E.flipB - 0.1;
    actors.push(<Character3D key="man" {...MAN} position={MAN_P} yaw={0.3} t={t} face={{ eyes: shock ? "wide" : "open", mouth: shock ? "o" : "open", brows: "raised", look: 0.5 }} pose={{ armL: [20, 40], armR: shock ? [80, 110] : [20, 40], armRFwd: 30, headYaw: shock ? 0 : 35, headNod: -8, lean: shock ? -4 : 0 }} faceCamera={cam.pos} />);
  } else if (id === "S11" || id === "S12") {
    sign = "PLAZA";
    banner = "15 OCTOBER";
    calendar = <TearCalendar p={CAL_P} t={t} pages={[{ month: "OCTOBER", day: "15" }]} />;
    const cheer = t >= E.cheer - 0.2;
    actors.push(<Character3D key="kid" {...KID} position={KID_P} yaw={-0.3} t={t} face={{ eyes: "open", mouth: cheer ? "grin" : "smile", brows: "raised" }} pose={{ armL: cheer ? [150, 20] : [15, 20], armR: cheer ? [150, 20] : [15, 20], bob: cheer ? Math.abs(Math.sin(t * 6)) * 10 : 0 }} faceCamera={cam.pos} />);
    actors.push(<Character3D key="man" {...MAN} position={MAN_P} yaw={0.3} t={t} face={{ eyes: "open", mouth: cheer ? "grin" : "smile", brows: "raised" }} pose={{ armL: [20, 30], armR: cheer ? [140, 30] : [20, 30] }} faceCamera={cam.pos} />);
    const doze = id === "S12";
    actors.push(<Character3D key="elder" {...ELDER} position={ELDER_P} yaw={0.6} t={t} face={doze ? { eyes: "closed", mouth: "o", brows: "neutral", blink: false } : { eyes: "open", mouth: "smile" }} pose={{ armL: [10, 60], armR: [10, 60], armLFwd: 50, armRFwd: 50, headTilt: doze ? 14 + Math.sin(t * 1.4) * 3 : 0, headNod: doze ? 12 : 0 }} faceCamera={cam.pos} />);
  } else if (id === "S13") {
    sign = "LONDON";
    banner = "1752";
    const sept = Array.from({ length: 13 }, (_, k) => ({ month: "SEPTEMBER", day: String(k === 0 ? 2 : k + 2) }));
    calendar = <TearCalendar p={CAL_P} t={t} pages={sept} flipA={E.ukA - 0.1} flipB={E.ukB} head="#2a3a7a" />;
    actors.push(<Character3D key="man" {...MAN} position={MAN_P} yaw={0.3} t={t} face={{ eyes: t > E.ukA ? "wide" : "open", mouth: t > E.ukA ? "o" : "frown", brows: "worried", look: 0.5 }} pose={{ armL: [20, 40], armR: [20, 40], headYaw: 30, headNod: -10 }} faceCamera={cam.pos} />);
  } else if (id === "S14") {
    sign = "STOCKHOLM";
    banner = "1712";
    calendar = <TearCalendar p={CAL_P} t={t} pages={[{ month: "FEBRUARY", day: "29" }, { month: "FEBRUARY", day: "30" }]} flipA={E.feb} flipB={E.feb + 0.4} head="#2a5a8a" />;
    const huh = t >= E.feb + 0.3;
    actors.push(<Character3D key="man" {...MAN} position={MAN_P} yaw={0.3} t={t} face={{ eyes: huh ? "squint" : "open", mouth: huh ? "frown" : "open", brows: huh ? "worried" : "raised", look: 0.5 }} pose={{ armL: [20, 40], armR: huh ? [150, 120] : [20, 40], armRFwd: 30, headTilt: huh ? -10 : 0, headYaw: huh ? 0 : 30 }} faceCamera={cam.pos} />);
  } else if (id === "S15") {
    sign = "PETROGRAD";
    lamp = 1;
    calendar = <TearCalendar p={CAL_P} t={t} pages={[{ month: "OCTOBER", day: "25" }, { month: "NOVEMBER", day: "7" }]} flipA={E.nov - 0.15} flipB={E.nov + 0.25} head="#8a1a2a" />;
    const turn = t >= E.nov;
    actors.push(<Character3D key="elder" {...ELDER} position={[-1.3, 0.16, -2.6]} yaw={0.4} t={t} face={{ eyes: turn ? "wide" : "open", mouth: turn ? "o" : "smile", brows: "raised", look: 0.6 }} pose={{ armL: turn ? [70, 80] : [10, 30], armR: turn ? [70, 80] : [10, 30], armLFwd: 20, armRFwd: 20, headYaw: turn ? 0 : 35 }} faceCamera={cam.pos} />);
  }
  const focusHead = actors.length ? manHead : CAL_P;
  return (
    <>
      <Town sign={sign} banner={banner} lamp={lamp} snow={set === "snow"} t={t} />
      {calendar}
      {actors}
      <CastLight at={id === "S12" ? elderHead : focusHead} cam={cam.pos} mood={m} />
    </>
  );
};

const Shot1: React.FC<{ i: number; t: number }> = ({ i, t }) => {
  const s = SHOTS[i];
  const { cam } = camAt(i, t);
  const base = SETUP[s.id];
  const indoor = setOf(s) === "study";
  return (
    <View mood={moodOf(s.mood)} cam={cam} t={t} focus={base.focus} blur={base.blur} sky={!indoor}>
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
