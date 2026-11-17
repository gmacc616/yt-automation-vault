// minimal DOM/2D-canvas stub so world.ts can build its painted textures in Node (check.ts only; nothing is drawn)
const grad = { addColorStop() {} };
const ctx = new Proxy({}, { get: (_t, k) => k === "createImageData" || k === "getImageData" ? (w, h) => ({ data: new Uint8ClampedArray((w.width ?? w) * (h ?? w.height ?? 1) * 4), width: w, height: h })
  : k === "createLinearGradient" || k === "createRadialGradient" || k === "createPattern" ? () => grad
  : k === "measureText" ? () => ({ width: 0 }) : k === "canvas" ? { width: 2, height: 2 } : () => {}, set: () => true });
globalThis.document = { createElement: () => ({ width: 2, height: 2, style: {}, getContext: () => ctx, addEventListener() {} }) };
globalThis.window = globalThis; globalThis.self = globalThis;
