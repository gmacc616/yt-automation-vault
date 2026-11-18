import React from "react";
import { Composition } from "remotion";
import { VasaShort, VASA_FRAMES } from "./videos/vasa/Bridge";
import { TsarBellShort, TSAR_FRAMES } from "./videos/tsarbell/Bridge";
import { PeigneurShort, PEIGNEUR_FRAMES } from "./videos/peigneur/Bridge";
import { HannibalShort, HANNIBAL_FRAMES } from "./videos/hannibal/Bridge";
// one <Composition> per short; copy src/videos/vasa (or the skill's templates/bridge) to src/videos/<name> and register it here
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="TsarBellShort" component={TsarBellShort} durationInFrames={TSAR_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="VasaShort" component={VasaShort} durationInFrames={VASA_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="HannibalShort" component={HannibalShort} durationInFrames={HANNIBAL_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="PeigneurShort" component={PeigneurShort} durationInFrames={PEIGNEUR_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
