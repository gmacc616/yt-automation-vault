// Sets and props for "The 10 days that never happened". Everything is a pure function of t (no state, no random).
import React from "react";
import { boxG, coneG, coreMat, cylG, h1, Label, M, sphG, torG } from "../../inkbeat/core/kit";
import type { V3 } from "../../inkbeat/types";
import { Barrel, Crate, House, LampPost, Planter } from "../../demo/Street";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

/** one tear-off page: header strip (month) + a big number */
const Page: React.FC<{ month: string; day: string; w: number; h: number; head?: string }> = ({ month, day, w, h, head = "#c8323a" }) => (
  <group>
    <M g={boxG(w, h, 0.02)} c="#f6efe0" tex="paper" />
    <Label text={month} p={[0, h / 2 - h * 0.13, 0.012]} w={w * 0.96} h={h * 0.22} fg="#f8f0e2" bg={head} font={0.66} />
    <Label text={day} p={[0, -h * 0.1, 0.012]} w={w * 0.9} h={h * 0.62} fg="#1e1a22" bg="none" font={0.92} />
  </group>
);

/** a big wall calendar on a board; pages flip up and fly off between `flipA` and `flipB` (s), from `pages[0]` to the last page */
export const TearCalendar: React.FC<{ p: V3; r?: V3; s?: number; t: number; pages: { month: string; day: string }[]; flipA?: number; flipB?: number; head?: string }> = ({ p, r, s = 1, t, pages, flipA = 1e9, flipB = 1e9, head }) => {
  const w = 1.5;
  const h = 1.7;
  const n = pages.length - 1; // pages that fly off
  const per = n > 0 ? (flipB - flipA) / n : 1;
  return (
    <group position={p} rotation={r} scale={s}>
      <M g={boxG(w + 0.24, h + 0.3, 0.1)} c="#6a3a2a" tex="wood" p={[0, -0.04, -0.06]} />
      <M g={cylG(0.05, 0.05, w + 0.1, 12)} c="#c9a24a" tex="metal" p={[0, h / 2 + 0.03, 0.03]} r={[0, 0, Math.PI / 2]} />
      {/* the page that stays (last) */}
      <group position={[0, 0, 0.02]} visible={n === 0 || t >= flipA + (n - 1) * per}>
        <Page month={pages[n].month} day={pages[n].day} w={w} h={h} head={head} />
      </group>
      {pages.slice(0, n).map((pg, i) => {
        const u = clamp((t - (flipA + i * per)) / Math.max(0.35, per * 1.6));
        if (u >= 1) return null;
        // only the top unflipped page is drawn (pages under it would z-fight with its painted number)
        const top = pages.slice(0, n).findIndex((_, j) => t < flipA + j * per);
        if (u <= 0 && i !== top) return null;
        const e = ease(u);
        const side = h1(i + 3) - 0.5;
        // flip up about the top edge, then fly off sideways, tumbling
        return (
          <group key={i} position={[side * 3.2 * e, h / 2 + 2.2 * e * e, 0.04 + (n - i) * 0.004 + 0.9 * e]} rotation={[-Math.PI * 0.9 * clamp(u * 2), side * 4 * e, side * 2 * e]}>
            <group position={[0, -h / 2, 0]}>
              <Page month={pg.month} day={pg.day} w={w} h={h} head={head} />
            </group>
          </group>
        );
      })}
    </group>
  );
};

/** big shears (open/close with `snip` 0..1, 1 = closed) */
export const Shears: React.FC<{ p: V3; r?: V3; s?: number; snip: number }> = ({ p, r, s = 1, snip }) => {
  const a = 0.38 * (1 - snip);
  const blade = (sgn: number) => (
    <group rotation={[0, 0, sgn * a]}>
      <M g={boxG(0.06, 0.62, 0.02)} c="#c8ccd4" tex="metal" p={[0, 0.31, sgn * 0.012]} />
      <M g={torG(0.09, 0.025)} c="#c83a3a" p={[0, -0.14, sgn * 0.012]} />
    </group>
  );
  return (
    <group position={p} rotation={r} scale={s}>
      {blade(1)}
      {blade(-1)}
      <M g={cylG(0.03, 0.03, 0.06, 10)} c="#2a3238" p={[0, 0, 0]} r={[Math.PI / 2, 0, 0]} />
    </group>
  );
};

/** a long strip of 10 day squares (5..14 October), cut out by the Pope */
export const DayStrip: React.FC<{ p: V3; r?: V3; fall: number }> = ({ p, r, fall }) => (
  <group position={[p[0], p[1] - 2.2 * fall * fall, p[2] + 0.4 * fall]} rotation={[(r?.[0] ?? 0) + fall * 1.2, r?.[1] ?? 0, (r?.[2] ?? 0) + fall * 0.5]}>
    {Array.from({ length: 10 }, (_, i) => (
      <group key={i} position={[(i - 4.5) * 0.24, 0, 0]}>
        <M g={boxG(0.22, 0.28, 0.01)} c="#f6efe0" tex="paper" />
        <Label text={String(5 + i)} p={[0, 0, 0.007]} w={0.2} h={0.2} fg="#1e1a22" bg="none" font={0.8} />
      </group>
    ))}
  </group>
);

/** a marble bust on a plinth (Julius Caesar), laurel wreath; `tag` painted on the plinth */
export const Bust: React.FC<{ p: V3; yaw?: number; tag?: string }> = ({ p, yaw = 0, tag }) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <M g={boxG(0.7, 1.1, 0.7)} c="#d8d0c4" tex="stone" p={[0, 0.55, 0]} />
    <M g={boxG(0.8, 0.1, 0.8)} c="#c8beb0" tex="stone" p={[0, 1.15, 0]} />
    <M g={cylG(0.26, 0.36, 0.32, 20)} c="#ece6dc" tex="stone" p={[0, 1.36, 0]} />
    <M g={cylG(0.09, 0.11, 0.16, 14)} c="#ece6dc" p={[0, 1.58, 0]} />
    <M g={sphG(0.2, 20)} c="#ece6dc" p={[0, 1.78, 0.02]} s={[0.9, 1.1, 1]} />
    <M g={coneG(0.05, 0.1, 8)} c="#e2dcd2" p={[0, 1.77, 0.21]} r={[Math.PI / 2, 0, 0]} />
    {Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 1.6 - Math.PI * 0.8;
      return <M key={i} g={sphG(0.03, 8)} c="#5a8a3a" p={[Math.sin(a) * 0.185, 1.86, Math.cos(a) * 0.185 + 0.02]} s={[1, 0.55, 1.7]} r={[0, a, 0]} />;
    })}
    {tag ? <Label text={tag} p={[0, 0.7, 0.352]} w={0.62} h={0.36} fg="#7a1a1a" bg="none" font={0.8} /> : null}
  </group>
);

/** a brass orrery: the Sun at the centre, the Earth runs the ring (`year` = laps), a marker shows where the year should end */
export const Orrery: React.FC<{ p: V3; t: number; year: number; s?: number }> = ({ p, t, year, s = 1 }) => {
  const a = year * Math.PI * 2;
  const R = 0.62;
  return (
    <group position={p} scale={s}>
      <M g={cylG(0.06, 0.12, 0.5, 12)} c="#b08a3a" tex="metal" p={[0, 0.25, 0]} />
      <M g={torG(R, 0.015)} c="#c9a24a" p={[0, 0.62, 0]} r={[Math.PI / 2, 0, 0]} />
      <mesh geometry={sphG(0.16, 24)} material={coreMat("#ffb43a", 1.0)} position={[0, 0.62, 0]} />
      <pointLight position={[0, 0.62, 0]} color="#ffb860" intensity={2.5} distance={3} decay={2} />
      <group rotation={[0, a, 0]}>
        <M g={cylG(0.008, 0.008, R, 6)} c="#c9a24a" p={[R / 2, 0.62, 0]} r={[0, 0, Math.PI / 2]} />
        <M g={sphG(0.08, 18)} c="#3a7ac8" p={[R, 0.62, 0]} r={[0, t * 2, 0]} />
        <M g={sphG(0.05, 10)} c="#5aa04a" p={[R + 0.035, 0.66, 0.03]} />
      </group>
      {/* the "true year" flag on the ring: the Earth overshoots it a little */}
      <M g={boxG(0.012, 0.22, 0.012)} c="#2a2a30" p={[R, 0.74, 0]} />
      <M g={boxG(0.12, 0.07, 0.01)} c="#c8323a" p={[R + 0.06, 0.82, 0]} />
    </group>
  );
};

/** a wooden desk with books, an inkwell, a candle */
export const Desk: React.FC<{ p: V3; yaw?: number; t: number }> = ({ p, yaw = 0, t }) => (
  <group position={p} rotation={[0, yaw, 0]}>
    <M g={boxG(2.4, 0.1, 1.1)} c="#8a5232" tex="wood" p={[0, 0.82, 0]} />
    {[[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.45], [1.1, 0.45]].map(([x, z], i) => (
      <M key={i} g={boxG(0.1, 0.8, 0.1)} c="#6a3a22" tex="wood" p={[x, 0.4, z]} />
    ))}
    {[["#7a2a3a", 0.16], ["#2a4a7a", 0.12], ["#3a6a3a", 0.14]].map(([c, th], i) => (
      <M key={i} g={boxG(0.5, th as number, 0.36)} c={c as string} tex="fabric" p={[-0.85, 0.87 + 0.15 * i + (th as number) / 2 - 0.03, 0.15]} r={[0, 0.2 * i - 0.2, 0]} />
    ))}
    <M g={cylG(0.07, 0.08, 0.12, 14)} c="#1e2a3a" p={[0.2, 0.93, 0.32]} />
    <M g={boxG(0.01, 0.34, 0.01)} c="#f2ead8" p={[0.24, 1.08, 0.32]} r={[0, 0, -0.35]} />
    <M g={cylG(0.05, 0.05, 0.3, 12)} c="#f4ead6" p={[0.95, 1.02, -0.25]} />
    <mesh geometry={sphG(0.04, 10)} material={coreMat("#ffc860", 1.0)} position={[0.95, 1.2 + 0.01 * Math.sin(t * 9), -0.25]} scale={[1, 1.6, 1]} />
    <pointLight position={[0.95, 1.35, -0.1]} color="#ffb05a" intensity={3} distance={5} decay={2} />
  </group>
);

/** a March wall calendar grid; a flower marker slides from day 21 to day 11 as `drift` goes 0..1, an Easter egg follows */
export const MarchWall: React.FC<{ p: V3; drift: number; t: number }> = ({ p, drift, t }) => {
  const cw = 0.36;
  const cell = (d: number): V3 => {
    const i = d - 1; // March 1582 laid out in 7 columns from day 1
    return [(i % 7 - 3) * cw, 0.62 - Math.floor(i / 7) * cw, 0.03];
  };
  const day = 21 - 10 * ease(clamp(drift));
  const a = cell(Math.floor(day));
  const b = cell(Math.min(31, Math.floor(day) + 1));
  const f = day - Math.floor(day);
  const fl: V3 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 0.08];
  return (
    <group position={p}>
      <M g={boxG(2.8, 2.5, 0.06)} c="#f4ecd8" tex="paper" />
      <Label text="MARCH" p={[0, 1.02, 0.035]} w={2.7} h={0.36} fg="#f8f0e2" bg="#2a6a4a" font={0.7} />
      {Array.from({ length: 31 }, (_, i) => {
        const c = cell(i + 1);
        const hot = i + 1 === 21 || i + 1 === 11;
        return (
          <group key={i} position={c}>
            <M g={boxG(cw * 0.92, cw * 0.92, 0.01)} c={hot ? "#f8dca0" : "#efe6d2"} />
            <Label text={String(i + 1)} p={[0, 0, 0.007]} w={cw * 0.8} h={cw * 0.8} fg="#2a2228" bg="none" font={0.62} />
          </group>
        );
      })}
      {/* the spring flower (the equinox) */}
      <group position={fl}>
        <M g={cylG(0.012, 0.012, 0.22, 6)} c="#3a7a3a" p={[0, -0.08, 0.05]} />
        {Array.from({ length: 6 }, (_, k) => (
          <M key={k} g={sphG(0.065, 10)} c="#f2a8c8" p={[Math.cos(k + t) * 0.09, 0.05 + Math.sin(k + t) * 0.09, 0.06]} />
        ))}
        <M g={sphG(0.05, 10)} c="#ffd04a" p={[0, 0.05, 0.09]} />
      </group>
      {/* Easter egg trailing the flower */}
      <M g={sphG(0.08, 16)} c="#8ac8f0" p={[fl[0] + 0.24, fl[1] - 0.06, 0.12]} s={[0.8, 1.05, 0.8]} r={[0, 0, drift * 9]} />
    </group>
  );
};

/** stacked "extra day" blocks: n grows with `k` (0..1), up to 10 */
export const DayBlocks: React.FC<{ p: V3; k: number }> = ({ p, k }) => {
  const n = Math.round(clamp(k) * 10);
  return (
    <group position={p}>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} position={[(i % 2) * 0.26 - 0.13, 0.07 + Math.floor(i / 2) * 0.135, 0]} rotation={[0, (h1(i) - 0.5) * 0.4, 0]}>
          <M g={boxG(0.22, 0.13, 0.22)} c="#f4ead6" tex="paper" />
          <M g={boxG(0.23, 0.035, 0.23)} c="#c8323a" p={[0, 0.05, 0]} />
        </group>
      ))}
    </group>
  );
};

/** a stone plaque with a year and a stamp that appears at `stampAt` */
export const YearPlaque: React.FC<{ p: V3; year: string; stamp: "NO" | "YES"; on: boolean }> = ({ p, year, stamp, on }) => (
  <group position={p}>
    <M g={boxG(0.9, 0.6, 0.12)} c="#d8d0c4" tex="stone" />
    <Label text={year} p={[0, 0.02, 0.062]} w={0.8} h={0.4} fg="#2a2228" bg="none" font={0.85} />
    {on ? <Label text={stamp} p={[0, -0.05, 0.075]} r={[0, 0, -0.25]} w={0.7} h={0.3} fg={stamp === "NO" ? "#c8202a" : "#1a8a3a"} bg="none" font={0.8} stamp /> : null}
  </group>
);

/** the Pope's study: plastered walls, a window, bookshelves, a rug */
export const Study: React.FC<{ t: number }> = ({ t }) => (
  <group>
    <M g={boxG(14, 0.2, 12)} c="#8a5a3a" tex="planks" p={[0, -0.1, 0]} cast={false} />
    <M g={boxG(14, 6, 0.3)} c="#c89a70" tex="plaster" p={[0, 3, -4]} />
    <M g={boxG(0.3, 6, 12)} c="#b88a64" tex="plaster" p={[-5.2, 3, 1.5]} />
    <M g={boxG(0.3, 6, 12)} c="#b88a64" tex="plaster" p={[5.2, 3, 1.5]} />
    <M g={boxG(14, 0.3, 12)} c="#c8b08a" tex="planks" p={[0, 6.1, 1.5]} cast={false} />
    <M g={boxG(14.02, 0.5, 0.36)} c="#8a5a3a" tex="wood" p={[0, 0.25, -3.84]} />
    {/* rug */}
    <M g={boxG(5, 0.02, 3.4)} c="#9a2a3a" tex="fabric" p={[0, 0.01, 0.2]} cast={false} />
    <M g={boxG(4.4, 0.022, 2.8)} c="#c88a3a" tex="fabric" p={[0, 0.012, 0.2]} cast={false} />
    {/* arched window with night-blue glass */}
    <group position={[-3.2, 3.2, -3.84]}>
      <mesh geometry={boxG(1.4, 2.2, 0.02)} material={coreMat("#4a6ab0", 0.8)} />
      <mesh geometry={cylG(0.7, 0.7, 0.02, 24, false, 0, Math.PI)} material={coreMat("#4a6ab0", 0.8)} position={[0, 1.1, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <M g={boxG(1.6, 0.12, 0.2)} c="#c8b8a0" p={[0, -1.15, 0.08]} />
      <M g={boxG(0.06, 2.2, 0.05)} c="#5a3a2a" p={[0, 0, 0.02]} />
    </group>
    {/* bookshelf */}
    <group position={[3.4, 0, -3.6]}>
      <M g={boxG(2.2, 3.6, 0.5)} c="#6a3a22" tex="wood" p={[0, 1.8, 0]} />
      {[0.5, 1.3, 2.1, 2.9].map((y, r) =>
        Array.from({ length: 8 }, (_, i) => (
          <M key={`${r}-${i}`} g={boxG(0.2, 0.55 + h1(i + r * 9) * 0.15, 0.36)} c={["#7a2a3a", "#2a4a7a", "#3a6a3a", "#b88a3a", "#5a3a6a"][(i + r) % 5]} tex="fabric" p={[-0.85 + i * 0.24, y + 0.3, 0.1]} />
        )),
      )}
    </group>
    {/* a hanging lamp */}
    <M g={cylG(0.01, 0.01, 1.4, 6)} c="#2a2a30" p={[0, 5.3, 0.5]} />
    <mesh geometry={sphG(0.18, 16)} material={coreMat("#ffd890", 1.0)} position={[0, 4.5, 0.5]} />
    <pointLight position={[0, 4.4, 0.5]} color="#ffc070" intensity={4} distance={9} decay={2} />
    <Desk p={[0.6, 0, -1.2]} t={t} />
  </group>
);

/** falling snow (Sweden) */
export const Snow: React.FC<{ t: number; c: V3; n?: number }> = ({ t, c, n = 140 }) => (
  <group position={c}>
    {Array.from({ length: n }, (_, i) => {
      const x = (h1(i) - 0.5) * 9;
      const z = (h1(i + 500) - 0.5) * 6 - 0.5;
      const y = 7 - ((t * (0.6 + h1(i + 900) * 0.5) + h1(i + 77) * 7) % 7);
      return <mesh key={i} geometry={sphG(0.045, 8)} material={coreMat("#ffffff", 0.95)} position={[x + Math.sin(t + i) * 0.2, y, z]} />;
    })}
  </group>
);

/** the town square: the demo street, re-dressed per scene (sign text, snow, a banner) */
export const Town: React.FC<{ sign: string; lamp?: number; snow?: boolean; banner?: string; t: number }> = ({ sign, lamp = 0, snow, banner, t }) => (
  <group>
    <M g={boxG(60, 0.2, 60)} c={snow ? "#e8eef4" : "#8a8290"} tex={snow ? "sand" : "stone"} ts={1.5} p={[0, -0.1, 0]} cast={false} />
    <M g={boxG(30, 0.16, 3.2)} c={snow ? "#f0f4f8" : "#c8bcae"} tex="stone" p={[0, 0.08, -3.6]} cast={false} />
    <House p={[-3.6, 0.16, -7]} w={5} h={5.2} d={4} wall="#f0c89a" tex="plaster" roof={snow ? "#e8eef4" : "#9a4a3a"} windows={2} lit={lamp ? [0, 1] : [1]} />
    <House p={[1.8, 0.16, -7.4]} w={5.4} h={6.4} d={4.2} wall="#b8604a" tex="brick" roof={snow ? "#e8eef4" : "#4a4a6a"} windows={3} lit={lamp ? [1] : []} />
    <House p={[7.6, 0.16, -6.8]} w={5} h={4.6} d={4} wall="#9ab8c8" tex="plaster" roof={snow ? "#e8eef4" : "#7a3a3a"} windows={2} />
    <House p={[-9.2, 0.16, -6.6]} w={5} h={5.8} d={4} wall="#e8dca8" tex="planks" roof={snow ? "#e8eef4" : "#5a4a6a"} windows={2} />
    <Label text={sign} p={[1.8, 3.7, -5.05]} w={2.6} h={0.5} fg="#f4ead6" bg="#3a2a4a" font={0.6} />
    {banner ? <Label text={banner} p={[-3.6, 4.2, -4.98]} w={3.2} h={0.7} fg="#f8f0e2" bg="#c8323a" font={0.6} /> : null}
    <LampPost p={[-1.2, 0.16, -2.4]} on={lamp} />
    <Crate p={[3.6, 0.16, -4.6]} yaw={0.3} />
    <Crate p={[4.2, 0.16, -4.4]} s={0.45} yaw={-0.2} />
    <Crate p={[3.85, 0.76, -4.55]} s={0.4} yaw={0.6} />
    <Barrel p={[-2.6, 0.16, -4.4]} />
    <Planter p={[-5.0, 0.16, -4.6]} />
    <Crate p={[2.4, 0, 2.2]} s={0.55} yaw={0.5} />
    {snow ? <Snow t={t} c={[0, 0, -1]} n={260} /> : null}
  </group>
);
