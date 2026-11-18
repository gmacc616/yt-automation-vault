// frosty freezer inside (before the "whole night sky" line)
import { ctex } from "./paint";
export const iceSkin = () => ctex("frzFrost", 256, 512, (g, r) => {
  g.fillStyle = "#cfe8f6"; g.fillRect(0, 0, 256, 512);
  for (const y of [120, 250, 380]) { g.fillStyle = "#9cc4dc"; g.fillRect(10, y, 236, 10); }
  for (let i = 0; i < 160; i++) { g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.arc(r() * 256, r() * 512, 1 + r() * 3, 0, 7); g.fill(); }
});
