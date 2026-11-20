// Deterministic randomness for procedural sets: every frame is a pure function of the frame number, so nothing here
// may use Math.random. A seeded PRNG for placement, and smooth 2D value noise / fbm for terrain and color variation.

/** mulberry32: a small seeded PRNG; the same seed gives the same sequence in every render tab */
export const rng = (seed: number) => {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** an integer-lattice hash in 0..1 */
export const hash2 = (x: number, y: number, seed = 0) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

const fade = (u: number) => u * u * (3 - 2 * u);

/** smooth value noise in 0..1 */
export const noise2 = (x: number, y: number, seed = 0) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

/** fractal value noise in about 0..1 (octaves halve in size and weight) */
export const fbm = (x: number, y: number, seed = 0, oct = 4) => {
  let s = 0;
  let w = 0.5;
  let f = 1;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += noise2(x * f, y * f, seed + i * 17) * w;
    n += w;
    w *= 0.5;
    f *= 2;
  }
  return s / n;
};

/** a smooth wind field: sway angle (radians) at a place and time; gusts travel across the set */
export const wind = (x: number, z: number, t: number, strength = 1) => {
  const gust = 0.5 + 0.5 * Math.sin(t * 0.7 + x * 0.08 + z * 0.05);
  return strength * (0.05 * Math.sin(t * 1.6 + x * 0.35 + z * 0.22) + 0.03 * gust * Math.sin(t * 3.1 + x * 0.9));
};
