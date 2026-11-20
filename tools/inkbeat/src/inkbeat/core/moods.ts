// Act moods: lights + fog + sky + toon tint + post, built by one factory `mk` that applies the crisp + PREMIUM pass:
// stronger key and rim, less ambient, a fresnel rim on the toon material, soft halation (bloom on cores only, threshold
// 1.15), no grain, ink settings that never crawl (wobble 0, depth-jump test off, object-id edges on, skip ink under
// 2.5 px, flat normals for double-sided cloth). Light follows the acts: give each act its own mood.
// Each act keeps its own palette, but no mood is a one-color wash: the hemisphere ground and the shadow tint are always
// a complementary (violet/plum/blue) color against a warm key, and the fill comes from the opposite side, cool vs warm.
import type { LookPreset } from "../lookdev/presets";
import type { V3 } from "../types";

export type MoodPreset = LookPreset & {
  /** soft no-shadow light from just above/beside the lens (faces read in every framing) */
  camFill: { color: string; intensity: number };
  /** the light rig a character gets in this mood (see core/castLight.tsx) */
  castLight: { rim: { color: string; intensity: number }; fill: { color: string; intensity: number } };
  note: string;
};

type Sky = LookPreset["sky"];
const sky = (top: string, mid: string, bottom: string, o: Partial<Sky> = {}): Sky => ({
  top, mid, bottom, cloudColor: mid, cloudLit: "#fff4e4", clouds: 0.3, stars: 0, rays: 0, horizon: 0.16, brush: 0.05,
  sun: { dir: [-0.6, 0.12, -1], color: "#ffd9a0", size: 7 }, sunOn: 0, moon: { dir: [-0.4, 0.45, -1], color: "#e6eaff", size: 4 }, moonOn: 0, ...o,
});

type MkOpts = {
  note: string;
  hemi: [string, string, number];
  key: [string, number, V3];
  rim: [string, number, V3];
  fill: [string, number, V3];
  prac: [string, number, string];
  fog: [string, number];
  sky: Sky;
  toon: { shadowTint: V3; hiTint: V3; rimColor: string };
  grade: { exposure: number; contrast: number; saturation: number; shadowTint: string; highlightTint: string; gain: string };
  bloomTint: string;
  ink: string;
  camFill: [string, number];
  cast: { rim: [string, number]; fill: [string, number] };
};
export const mk = (o: MkOpts): MoodPreset => ({
  note: o.note,
  lights: {
    hemi: { sky: o.hemi[0], ground: o.hemi[1], intensity: o.hemi[2] },
    key: { color: o.key[0], intensity: o.key[1], dir: o.key[2], castShadow: true, shadowBias: -0.0004, shadowNormalBias: 0.025, mapSize: 2048 },
    rim: { color: o.rim[0], intensity: o.rim[1], dir: o.rim[2] },
    fill: { color: o.fill[0], intensity: o.fill[1], dir: o.fill[2] },
    practical: { color: o.prac[0], intensity: o.prac[1], distance: 6, decay: 2, core: o.prac[2], coreIntensity: 2.4, glow: 0.3, glowSize: 3.5 },
    window: { color: o.prac[0], intensity: 0, distance: 0, decay: 2, core: o.prac[2], coreIntensity: 1.6, glow: 0.2, glowSize: 2 },
  },
  fog: { color: o.fog[0], density: o.fog[1] },
  sky: o.sky,
  toon: { shadowTint: o.toon.shadowTint, shadowAmt: 0.9, hiTint: o.toon.hiTint, hiAmt: 0.6, rimColor: o.toon.rimColor, rimAmt: 0.42, paint: 0.05 },
  post: {
    outline: { enabled: true, color: o.ink, widthPx: 3.2, depthThreshold: 0.07, normalThreshold: 0.34, strength: 0.95, fadeNear: 8, fadeFar: 30, farWidth: 0.6, farOpacity: 0.45, wobble: 0, jumpEdges: 0, idEdges: 1, minPx: 2.5, clothFlat: true },
    dof: { enabled: true, focusDistance: 3, focusRange: 4, maxBlurPx: 1.4 },
    bloom: { enabled: true, threshold: 1.15, strength: 0.5, radiusPx: 42, scatter: 0.45, tint: o.bloomTint },
    grade: { exposure: o.grade.exposure, contrast: o.grade.contrast, saturation: o.grade.saturation, lift: "#2f232e", gamma: "#808080", gain: o.grade.gain, shadowTint: o.grade.shadowTint, highlightTint: o.grade.highlightTint, splitAmount: 0.1, sharpen: 0.45 },
    vignette: { amount: 0.22, softness: 0.8, color: "#1a1020" },
    grain: 0,
  },
  camFill: { color: o.camFill[0], intensity: o.camFill[1] },
  castLight: { rim: { color: o.cast.rim[0], intensity: o.cast.rim[1] }, fill: { color: o.cast.fill[0], intensity: o.cast.fill[1] } },
});

export const MOODS: Record<string, MoodPreset> = {
  /** bright crisp day: warm sun, blue sky fill, violet shade (L* ≈ 50–54) */
  day: mk({
    note: "bright crisp day", hemi: ["#cfe0ff", "#7a6a8a", 0.95], key: ["#fff0d6", 4.6, [0.55, 0.65, 0.45]], rim: ["#fff4dc", 1.8, [-0.6, 0.45, -0.7]],
    fill: ["#a8b8ff", 0.45, [-0.7, 0.3, 0.5]], prac: ["#ffd8a0", 3, "#fff0d0"], fog: ["#d0dcf0", 0.004],
    sky: sky("#3f7ae6", "#8ab8f4", "#e4f0ff", { sunOn: 0.7, clouds: 0.35, sun: { dir: [0.55, 0.5, -0.6], color: "#fff1c9", size: 6 } }),
    toon: { shadowTint: [0.88, 0.86, 1.14], hiTint: [1.06, 1.02, 0.92], rimColor: "#fff0d8" },
    grade: { exposure: 0.88, contrast: 1.14, saturation: 1.14, shadowTint: "#4a4aa0", highlightTint: "#fff2d8", gain: "#fbfcff" }, bloomTint: "#fff0d8", ink: "#1a1424",
    camFill: ["#eef2ff", 0.25], cast: { rim: ["#fff0d0", 1.8], fill: ["#e0e8ff", 0.6] },
  }),
  /** dusk: a warm practical against a violet-blue sky */
  dusk: mk({
    note: "dusk, warm practicals", hemi: ["#b8a0e0", "#5a3040", 0.75], key: ["#ff9a50", 4.2, [-0.7, 0.35, -0.4]], rim: ["#ffb060", 2.6, [0.6, 0.4, -0.8]],
    fill: ["#7a80ff", 0.5, [0.8, 0.3, 0.5]], prac: ["#ff8a30", 9, "#ffc070"], fog: ["#b07a90", 0.006],
    sky: sky("#3a3a9a", "#c070a0", "#ffb070", { sunOn: 0.7, rays: 0.25, clouds: 0.35, cloudLit: "#ffb880" }),
    toon: { shadowTint: [0.95, 0.75, 1.1], hiTint: [1.12, 0.98, 0.84], rimColor: "#ffc080" },
    grade: { exposure: 0.92, contrast: 1.16, saturation: 1.2, shadowTint: "#5a2a7a", highlightTint: "#ffd0a0", gain: "#fff6ea" }, bloomTint: "#ffb070", ink: "#1e0f14",
    camFill: ["#ffd8c0", 0.25], cast: { rim: ["#ffb060", 2.2], fill: ["#d8c8ff", 0.6] },
  }),
  /** night: blue moon key, a warm lamp / lantern practical */
  night: mk({
    note: "night, moon key, warm practical", hemi: ["#4a5ac8", "#1e1630", 0.82], key: ["#a8b8ff", 2.8, [-0.5, 0.6, -0.6]], rim: ["#d8e0ff", 2.4, [0.6, 0.45, -0.7]],
    fill: ["#ffb060", 0.45, [0.6, 0.2, 0.7]], prac: ["#ffb050", 7, "#ffd890"], fog: ["#2a3070", 0.006],
    sky: sky("#141a5a", "#2a3a9a", "#5a6ad0", { moonOn: 0.9, clouds: 0.25, cloudColor: "#222a7a", cloudLit: "#6a7ae0" }),
    toon: { shadowTint: [0.82, 0.86, 1.2], hiTint: [1.0, 1.02, 1.1], rimColor: "#cdd6ff" },
    grade: { exposure: 0.72, contrast: 1.14, saturation: 1.12, shadowTint: "#2a3a9a", highlightTint: "#ffe0b0", gain: "#e8ecff" }, bloomTint: "#ffd8a0", ink: "#0c0c1e",
    camFill: ["#c8d0ff", 0.3], cast: { rim: ["#d8e0ff", 2.0], fill: ["#ffc890", 0.7] },
  }),
  /** a cold interior: cool white key, cyan fill */
  cold: mk({
    note: "cold interior", hemi: ["#c8e4f8", "#4a6a8a", 0.7], key: ["#f4fbff", 3.6, [0.4, 0.8, 0.45]], rim: ["#a8f0ff", 2.2, [-0.6, 0.5, -0.7]],
    fill: ["#6ad8ff", 0.6, [-0.8, 0.3, 0.4]], prac: ["#c8f0ff", 5, "#f0fcff"], fog: ["#c8e8f4", 0.006],
    sky: sky("#8ac0e8", "#c8e4f4", "#eef8ff"), toon: { shadowTint: [0.8, 0.95, 1.18], hiTint: [1.0, 1.04, 1.08], rimColor: "#c8f8ff" },
    grade: { exposure: 0.62, contrast: 1.16, saturation: 1.12, shadowTint: "#1a5a8a", highlightTint: "#f0faff", gain: "#f6fcff" }, bloomTint: "#d8f4ff", ink: "#0a1420",
    camFill: ["#e8f8ff", 0.3], cast: { rim: ["#b8f4ff", 1.8], fill: ["#e0f0ff", 0.6] },
  }),
  /** a warm lamp-lit interior at night */
  lamp: mk({
    note: "lamp-lit interior at night", hemi: ["#7a6ab0", "#2a1a24", 0.7], key: ["#ffc070", 4.2, [0.5, 0.75, 0.3]], rim: ["#8a9aff", 1.6, [-0.6, 0.4, -0.7]],
    fill: ["#6a70d0", 0.35, [-0.8, 0.3, 0.4]], prac: ["#ffb050", 8, "#ffe0a0"], fog: ["#2a1a30", 0.004],
    sky: sky("#101030", "#181a40", "#20204a"), toon: { shadowTint: [0.9, 0.78, 1.12], hiTint: [1.12, 1.0, 0.82], rimColor: "#b0b8ff" },
    grade: { exposure: 1.0, contrast: 1.18, saturation: 1.15, shadowTint: "#3a1a5a", highlightTint: "#ffd8a0", gain: "#fff4e4" }, bloomTint: "#ffc070", ink: "#160c10",
    camFill: ["#ffe0c0", 0.25], cast: { rim: ["#ffc070", 1.8], fill: ["#c0c8ff", 0.5] },
  }),
  /** golden hour: low warm sun, long shadows, violet shade */
  golden: mk({
    note: "golden hour", hemi: ["#ffe0b0", "#6a4a7a", 0.9], key: ["#ffc060", 5.2, [-0.7, 0.3, 0.45]], rim: ["#ffe090", 2.8, [0.6, 0.35, -0.8]],
    fill: ["#a090e0", 0.5, [0.8, 0.3, 0.4]], prac: ["#ffb050", 6, "#ffe0a0"], fog: ["#e0a070", 0.005],
    sky: sky("#5a7ae0", "#ffb070", "#ffe0a0", { sunOn: 0.9, rays: 0.3, clouds: 0.3, cloudLit: "#ffd8a0" }),
    toon: { shadowTint: [0.95, 0.82, 1.08], hiTint: [1.14, 1.02, 0.8], rimColor: "#ffd890" },
    grade: { exposure: 0.85, contrast: 1.14, saturation: 1.12, shadowTint: "#5a3a7a", highlightTint: "#ffe0a0", gain: "#fff4e0" }, bloomTint: "#ffd080", ink: "#1e1008",
    camFill: ["#ffe8c8", 0.25], cast: { rim: ["#ffd070", 2.2], fill: ["#e0d8ff", 0.5] },
  }),
  // ---- cinematic-upgrade moods (inkbeat): natural outdoor light for deep sets with sky, grass and roads. The classic
  // moods above keep a warm, stylized cast; these read as real weather while staying toon (banded, inked, clean).
  /** sunny day: neutral-white sun high and to the side, clear blue sky, green bounce from fields, crisp blue shade.
   * The default for outdoor worlds (it never washes a scene orange). */
  sunny: mk({
    note: "sunny day, neutral sun, blue sky", hemi: ["#c4dcff", "#6f8a58", 1.0], key: ["#fff7ea", 4.4, [0.5, 0.75, 0.35]], rim: ["#ffffff", 1.4, [-0.6, 0.5, -0.7]],
    fill: ["#9fc0ff", 0.4, [-0.7, 0.3, 0.5]], prac: ["#ffd8a0", 3, "#fff0d0"], fog: ["#cfe2f8", 0.0018],
    sky: sky("#2f72e8", "#7fb6f6", "#e6f2ff", { sunOn: 0.6, clouds: 0.55, cloudColor: "#e8f0fc", cloudLit: "#ffffff", horizon: 0.2, sun: { dir: [0.5, 0.6, -0.6], color: "#fffbe8", size: 5 } }),
    toon: { shadowTint: [0.84, 0.9, 1.16], hiTint: [1.04, 1.03, 0.97], rimColor: "#ffffff" },
    grade: { exposure: 0.9, contrast: 1.1, saturation: 1.1, shadowTint: "#33458f", highlightTint: "#fffaf0", gain: "#fbfdff" }, bloomTint: "#fff6e0", ink: "#18202a",
    camFill: ["#eef4ff", 0.22], cast: { rim: ["#ffffff", 1.5], fill: ["#dce8ff", 0.55] },
  }),
  /** cloudy day: soft, almost shadowless key, bright sky dome, low contrast but still saturated greens */
  cloudy: mk({
    note: "overcast day, soft light", hemi: ["#dfe6f0", "#7a8a6a", 1.5], key: ["#f4f6fa", 1.9, [0.3, 0.9, 0.3]], rim: ["#e8eef8", 0.9, [-0.6, 0.5, -0.7]],
    fill: ["#c8d4e8", 0.6, [-0.7, 0.3, 0.5]], prac: ["#ffd8a0", 4, "#fff0d0"], fog: ["#c8d0dc", 0.006],
    sky: sky("#8a9ab4", "#b8c4d4", "#dce2ea", { clouds: 1.0, cloudColor: "#a8b4c4", cloudLit: "#e8ecf2", horizon: 0.25 }),
    toon: { shadowTint: [0.9, 0.93, 1.08], hiTint: [1.0, 1.0, 1.0], rimColor: "#eef2f8" },
    grade: { exposure: 0.95, contrast: 1.04, saturation: 1.06, shadowTint: "#4a5470", highlightTint: "#f4f6fa", gain: "#f8faff" }, bloomTint: "#f0f4f8", ink: "#1c2028",
    camFill: ["#f0f4fa", 0.3], cast: { rim: ["#f0f4fa", 1.0], fill: ["#e8ecf4", 0.7] },
  }),
  /** sunset: the sun on the horizon, red-orange key raking the set, magenta-violet sky and shade, long shadows */
  sunset: mk({
    note: "sunset, raking red-orange sun", hemi: ["#d890c0", "#4a2a4a", 0.7], key: ["#ff8040", 4.8, [-0.8, 0.16, -0.4]], rim: ["#ffb070", 3.0, [0.7, 0.25, -0.7]],
    fill: ["#8a70e0", 0.55, [0.8, 0.3, 0.5]], prac: ["#ffa040", 8, "#ffd090"], fog: ["#c07090", 0.006],
    sky: sky("#2a2a80", "#e06a8a", "#ffa050", { sunOn: 1.0, rays: 0.4, clouds: 0.45, cloudColor: "#a04a7a", cloudLit: "#ffb070", horizon: 0.22, sun: { dir: [-0.8, 0.05, -0.6], color: "#ffb060", size: 9 } }),
    toon: { shadowTint: [0.95, 0.72, 1.12], hiTint: [1.16, 0.95, 0.78], rimColor: "#ffa060" },
    grade: { exposure: 0.88, contrast: 1.16, saturation: 1.18, shadowTint: "#4a2070", highlightTint: "#ffc890", gain: "#fff2e4" }, bloomTint: "#ff9a50", ink: "#1a0c18",
    camFill: ["#ffd0b8", 0.22], cast: { rim: ["#ffa050", 2.4], fill: ["#d0c0ff", 0.5] },
  }),
  /** rain at night: dark blue-gray storm, weak cool key, strong warm practicals and headlights (they make the wet
   * road read), dense fog for depth; pair with fx Rain + a wet Road + WetGlints */
  rain: mk({
    note: "rainy night, storm blue, warm practicals", hemi: ["#5a6a8a", "#1a1e28", 0.85], key: ["#b8c8e8", 1.6, [-0.4, 0.8, -0.5]], rim: ["#c8d8ff", 2.0, [0.6, 0.45, -0.7]],
    fill: ["#ffb060", 0.35, [0.6, 0.2, 0.7]], prac: ["#ffc070", 10, "#ffe0a8"], fog: ["#3a4458", 0.012],
    sky: sky("#1a1e2e", "#2e3648", "#4a5468", { clouds: 1.0, cloudColor: "#262c3c", cloudLit: "#4a5470", horizon: 0.3 }),
    toon: { shadowTint: [0.86, 0.9, 1.14], hiTint: [1.0, 1.02, 1.08], rimColor: "#c8d8ff" },
    grade: { exposure: 0.82, contrast: 1.14, saturation: 0.98, shadowTint: "#2a3450", highlightTint: "#ffe2b8", gain: "#e8eef8" }, bloomTint: "#ffd8a0", ink: "#0a0e16",
    camFill: ["#c8d4f0", 0.3], cast: { rim: ["#c8d8ff", 1.8], fill: ["#ffc890", 0.6] },
  }),
  /** dramatic: one hard key from the side and behind, little ambient, a strong rim; tension, reveals, villains */
  dramatic: mk({
    note: "dramatic hard side key", hemi: ["#5a5a8a", "#1a1420", 0.45], key: ["#ffe2b0", 5.5, [-0.9, 0.45, -0.2]], rim: ["#a8c0ff", 3.2, [0.7, 0.4, -0.7]],
    fill: ["#5060c0", 0.25, [0.8, 0.2, 0.5]], prac: ["#ffb050", 8, "#ffe0a0"], fog: ["#1a1830", 0.006],
    sky: sky("#141838", "#2a2a5a", "#4a4a7a", { clouds: 0.5, cloudColor: "#222448", cloudLit: "#5a5a90" }),
    toon: { shadowTint: [0.82, 0.8, 1.2], hiTint: [1.12, 1.04, 0.9], rimColor: "#b8c8ff" },
    grade: { exposure: 0.8, contrast: 1.26, saturation: 1.08, shadowTint: "#20184a", highlightTint: "#ffe0b0", gain: "#fff8ee" }, bloomTint: "#ffd8a0", ink: "#0a0810",
    camFill: ["#c8c8ff", 0.15], cast: { rim: ["#b8c8ff", 2.6], fill: ["#8890d0", 0.35] },
  }),
  /** indoor daylight: a window key (soft, cool-neutral), warm bounce from the floor, readable faces */
  indoor: mk({
    note: "indoor daylight through windows", hemi: ["#e8eef8", "#8a6a50", 1.1], key: ["#f6f8ff", 3.4, [0.7, 0.55, 0.3]], rim: ["#ffe8c8", 1.4, [-0.6, 0.45, -0.7]],
    fill: ["#ffd8b0", 0.5, [-0.7, 0.2, 0.5]], prac: ["#ffd090", 5, "#fff0c8"], fog: ["#e8e4dc", 0.004],
    sky: sky("#8ab8f0", "#c8e0fa", "#eef6ff"), toon: { shadowTint: [0.9, 0.88, 1.08], hiTint: [1.04, 1.02, 0.98], rimColor: "#fff0d8" },
    grade: { exposure: 0.95, contrast: 1.1, saturation: 1.08, shadowTint: "#4a4070", highlightTint: "#fff8ec", gain: "#fdfcfa" }, bloomTint: "#fff4e0", ink: "#1a1418",
    camFill: ["#fff4e8", 0.28], cast: { rim: ["#ffe8c8", 1.4], fill: ["#f0f0ff", 0.6] },
  }),
};
export const moodOf = (id: string): MoodPreset => MOODS[id] ?? MOODS.day;
/** every lighting preset by name (classic: day dusk night cold lamp golden; outdoor worlds: sunny cloudy sunset rain
 * dramatic indoor). Pick by story and act, never one light for a whole film. */
export const LIGHTING = Object.keys(MOODS);
