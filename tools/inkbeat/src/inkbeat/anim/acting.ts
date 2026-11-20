// Acting presets: named expressions (face + a matching head/body attitude) and gestures (arm poses), so every
// character in every film reacts the same recognizable way. Combine with motion.ts: poseTrack() eases between keys,
// idle() keeps standing characters alive, express() changes the face ON the word (a face change is a beat too).
//   const e = EXPR.surprised;  <Character3D face={e.face} pose={{ ...GESTURE.handsUp, ...e.body }} />
import type { FaceState } from "../char/Character3D";
import type { BodyPose } from "./motion";
import { blendPose, EASE } from "./motion";

export type Expression = { face: FaceState; body: BodyPose };

export const EXPR: Record<string, Expression> = {
  neutral: { face: { eyes: "open", mouth: "flat", brows: "neutral" }, body: {} },
  happy: { face: { eyes: "open", mouth: "smile", brows: "raised" }, body: { headTilt: -4 } },
  excited: { face: { eyes: "wide", mouth: "grin", brows: "raised" }, body: { lean: 4, bob: 3, headNod: -4 } },
  surprised: { face: { eyes: "wide", mouth: "o", brows: "raised" }, body: { lean: -5, headNod: -6 } },
  shocked: { face: { eyes: "wide", mouth: "yell", brows: "raised", sweat: true }, body: { lean: -8, headNod: -8 } },
  scared: { face: { eyes: "wide", mouth: "frown", brows: "worried", sweat: true }, body: { lean: -6, headNod: 6 } },
  angry: { face: { eyes: "angry", mouth: "yell", brows: "angry", flush: 0.6 }, body: { lean: 6, headNod: 5 } },
  annoyed: { face: { eyes: "half", mouth: "flat", brows: "angry" }, body: { headTilt: 6 } },
  sad: { face: { eyes: "half", mouth: "frown", brows: "worried" }, body: { lean: 3, headNod: 12 } },
  confused: { face: { eyes: "squint", mouth: "smirk", brows: "worried", look: 0.4 }, body: { headTilt: 12 } },
  thinking: { face: { eyes: "half", mouth: "flat", brows: "raised", look: -0.5 }, body: { headTilt: 6, headNod: -5 } },
  smug: { face: { eyes: "half", mouth: "smirk", brows: "raised" }, body: { lean: -3, headTilt: -6 } },
  embarrassed: { face: { eyes: "closed", mouth: "smile", brows: "worried", flush: 0.8 }, body: { headNod: 10, headTilt: 8 } },
  tired: { face: { eyes: "half", mouth: "flat", brows: "worried" }, body: { lean: 4, headNod: 14 } },
  asleep: { face: { eyes: "closed", mouth: "flat", brows: "neutral" }, body: { headNod: 18, headTilt: 10 } },
};
export type ExprName = keyof typeof EXPR;

/** arm gestures (degrees, see char/skeleton.ts ArmPose): read clearly in silhouette from a 3/4 lens */
export const GESTURE: Record<string, BodyPose> = {
  rest: { armL: [8, 8], armR: [8, 8] },
  pointR: { armL: [8, 10], armR: [84, 6], armRFwd: 62 },
  pointL: { armR: [8, 10], armL: [84, 6], armLFwd: 62 },
  waveR: { armL: [8, 8], armR: [150, 60], armRFwd: 10 },
  handsUp: { armL: [150, 25], armR: [150, 25], armLFwd: 15, armRFwd: 15 },
  shrug: { armL: [38, 95], armR: [38, 95], armLFwd: 30, armRFwd: 30, headTilt: 10 },
  facepalm: { armL: [8, 8], armR: [72, 150], armRFwd: 82, headNod: 14 },
  handsOnHips: { armL: [32, 70], armR: [32, 70], armLFwd: -40, armRFwd: -40 },
  thinkChin: { armL: [20, 70], armLFwd: 40, armR: [52, 135], armRFwd: 62, headTilt: 6 },
  armsCrossed: { armL: [30, 115], armR: [30, 115], armLFwd: 75, armRFwd: 75 },
  reachR: { armL: [8, 10], armR: [70, 12], armRFwd: 55, lean: 6 },
  holdFront: { armL: [42, 70], armR: [42, 70], armLFwd: 60, armRFwd: 60 },
  cheer: { armL: [165, 15], armR: [165, 15], armLFwd: 5, armRFwd: 5, bob: 4 },
  cower: { armL: [70, 120], armR: [70, 120], armLFwd: 70, armRFwd: 70, lean: -8, headNod: 10 },
};

/** an expression change on a word: the face switches at `at` (a blink on the switch hides the snap) and the body
 * attitude eases in over 0.3 s with a small overshoot. Returns { face, body } for time t. */
export const express = (t: number, from: Expression, to: Expression, at: number): Expression => {
  if (t < at) return from;
  const u = (t - at) / 0.3;
  return {
    face: { ...to.face, blink: t - at < 0.07 ? true : to.face.blink },
    body: u >= 1 ? to.body : blendPose(from.body, to.body, EASE.back(u, 0.1)),
  };
};

/** talking: a mouth that opens and closes on the voice's words (pass the word list [text, onset, end]); the base
 * mouth shows between words. Syllable-rate flaps at ~5 Hz inside words (open / o / flat), deterministic. */
export const talkMouth = (t: number, words: [string, number, number][], base: FaceState["mouth"] = "smile"): FaceState["mouth"] => {
  for (const [w, a, b] of words) {
    if (t >= a && t < b) {
      const syl = Math.max(1, Math.round(w.length / 3));
      const ph = ((t - a) / (b - a)) * syl;
      const f = ph - Math.floor(ph);
      return f < 0.55 ? (w.length % 2 ? "open" : "o") : "flat";
    }
  }
  return base;
};
