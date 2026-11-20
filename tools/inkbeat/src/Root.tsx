import React from "react";
import { Composition } from "remotion";
import { Demo, DEMO_MOODS } from "./demo/Demo";
import { DemoCast } from "./demo/DemoCast";
import { DemoMove, MOVE_FRAMES } from "./demo/DemoMove";
import { SUB } from "./inkbeat/core/frame";
import { CAL_FRAMES, Calendar } from "./videos/calendar/Calendar";
import { TENERE_FRAMES, Tenere, TenereLook, TenereSeg, segFrames } from "./videos/tenere/Tenere";
import { SHOTS as TENERE_SHOTS } from "./videos/tenere/plan.gen";

// DemoHero: a low hero framing with foreground props. Demo: one still. Demo-<mood>: the same frame in each act light. DemoWide: the whole set.
// DemoCast: the three example characters in a row (a landscape family sheet).
// DemoMove: a 3 s beat-rig move (sharp). DemoMoveSub: the same at SUB × fps for motion blur (average with ffmpeg tmix).
export const Root: React.FC = () => (
  <>
    <Composition id="Demo" component={Demo} durationInFrames={30} fps={30} width={1080} height={1920} defaultProps={{ mood: "day", wide: false }} />
    <Composition id="DemoHero" component={Demo} durationInFrames={30} fps={30} width={1080} height={1920} defaultProps={{ mood: "dusk", wide: false, hero: true }} />
    <Composition id="DemoWide" component={Demo} durationInFrames={30} fps={30} width={1080} height={1920} defaultProps={{ mood: "day", wide: true }} />
    {DEMO_MOODS.map((m) => (
      <Composition key={m} id={`Demo-${m}`} component={Demo} durationInFrames={30} fps={30} width={1080} height={1920} defaultProps={{ mood: m, wide: false }} />
    ))}
    <Composition id="DemoCast" component={DemoCast} durationInFrames={30} fps={30} width={1920} height={1080} defaultProps={{ mood: "day" }} />
    <Composition id="DemoMove" component={DemoMove} durationInFrames={MOVE_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ sub: false }} />
    <Composition id="DemoMoveSub" component={DemoMove} durationInFrames={MOVE_FRAMES * SUB} fps={30 * SUB} width={1080} height={1920} defaultProps={{ sub: true }} />
    <Composition id="CalendarShort" component={Calendar} durationInFrames={CAL_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ sub: false }} />
    <Composition id="TenereShort" component={Tenere} durationInFrames={TENERE_FRAMES} fps={30} width={1080} height={1920} defaultProps={{ sub: false }} />
    <Composition id="TenereShortSub" component={Tenere} durationInFrames={TENERE_FRAMES * SUB} fps={30 * SUB} width={1080} height={1920} defaultProps={{ sub: true }} />
    <Composition
      id="TenereSegSub"
      component={TenereSeg}
      fps={30 * SUB}
      width={1080}
      height={1920}
      defaultProps={{ ranges: [[0, 9]] as [number, number][] }}
      durationInFrames={segFrames([[0, 9]]) * SUB}
      calculateMetadata={({ props }) => ({ durationInFrames: segFrames(props.ranges) * SUB })}
    />
    {TENERE_SHOTS.map((s) => (
      <Composition key={s.id} id={`TenereLook-${s.id}`} component={TenereLook} durationInFrames={1} fps={30} width={1080} height={1920} defaultProps={{ shot: s.id as string }} />
    ))}
    <Composition id="CalendarShortSub" component={Calendar} durationInFrames={CAL_FRAMES * SUB} fps={30 * SUB} width={1080} height={1920} defaultProps={{ sub: true }} />
  </>
);
