import React from "react";
import { Composition } from "remotion";
import { VasaShort, VASA_FRAMES } from "./videos/vasa/Bridge";
// one <Composition> per short; copy src/videos/vasa (or the skill's templates/bridge) to src/videos/<name> and register it here
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="VasaShort" component={VasaShort} durationInFrames={VASA_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
