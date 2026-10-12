"use client";
import { useId, type CSSProperties } from "react";

/** The word mark is drawn in a 430 × 100 box: four glyphs on a 110 pitch, baseline at 88. A laser cut crosses it on a slant. */
const GLYPHS = "秋遊特務", XS = "0 110 220 330", BASE = 88;
const cutY = (x: number) => 60 - 14 * x / 430;
const L = -120, R = 550;
const TOP = `${L},-60 ${R},-60 ${R},${cutY(R).toFixed(2)} ${L},${cutY(L).toFixed(2)}`;
const BOTTOM = `${L},${cutY(L).toFixed(2)} ${R},${cutY(R).toFixed(2)} ${R},160 ${L},160`;
/** Sparks thrown off the cut as the laser passes: x on the cut, drift, fall, life (fixed, so server and client agree). */
const SPARKS = [[-24, -8, 26, .52], [8, 6, 40, .62], [40, -14, 30, .5], [72, 10, 46, .7], [104, -4, 34, .56], [136, 14, 52, .66], [168, -12, 28, .5], [200, 4, 44, .72],
  [232, -6, 36, .58], [264, 12, 50, .68], [296, -10, 30, .52], [328, 8, 42, .64], [360, -4, 34, .56], [392, 16, 54, .74], [424, -8, 38, .6], [456, 6, 30, .5]] as const;

function Word({ fill, className, transform }: { fill: string; className?: string; transform?: string }) {
  return <text className={className} x={XS} y={BASE} fill={fill} transform={transform}>{GLYPHS}</text>;
}

/**
 * 秋遊特務, the site's mark: brushed-chrome serif sliced by a laser on a slant, the upper half slipped along the cut, the cut
 * glowing red-hot, red rim light from the left and blue from the right (the two teams). `motion="cut"` plays the cut once —
 * the laser crosses with a spark, etching the letters as it goes, then the halves slip and the edges cool; `motion="scan"`
 * keeps the laser sweeping (loading). Without motion, or with reduced motion, it is the finished mark.
 */
export default function TitleMark({ className = "", sub, motion = "none", play = true }: { className?: string; sub?: string; motion?: "none" | "cut" | "scan"; play?: boolean }) {
  const u = "tm" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = (name: string) => `url(#${u}${name})`;
  const [en1, en2] = (sub || "").split(" ");
  return <div className={"title-mark " + className} data-motion={motion} data-play={play} role="img" aria-label={sub ? "秋遊特務 " + sub : "秋遊特務"}>
    <span className="tm-art" aria-hidden="true">
      <svg className="tm-word" viewBox="0 0 430 100" focusable="false">
        <defs>
          <linearGradient id={u + "c1"} gradientUnits="userSpaceOnUse" x1="0" y1="4" x2="0" y2="62">
            <stop offset="0" stopColor="#ffffff" /><stop offset=".42" stopColor="#e7eaee" /><stop offset=".78" stopColor="#9aa2ac" /><stop offset="1" stopColor="#767e88" />
          </linearGradient>
          <linearGradient id={u + "c2"} gradientUnits="userSpaceOnUse" x1="0" y1="44" x2="0" y2="98">
            <stop offset="0" stopColor="#fcfcfd" /><stop offset=".34" stopColor="#ccd1d7" /><stop offset=".7" stopColor="#8d949d" /><stop offset="1" stopColor="#5a616b" />
          </linearGradient>
          {/* heat from the cut, outward: white, amber, orange-red, gone */}
          <linearGradient id={u + "h1"} gradientUnits="userSpaceOnUse" x1="215" y1="53" x2="214.6" y2="40">
            <stop offset="0" stopColor="#fff7e6" /><stop offset=".16" stopColor="#ffc065" /><stop offset=".46" stopColor="#ff4a1c" stopOpacity=".7" /><stop offset="1" stopColor="#ff2a1a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={u + "h2"} gradientUnits="userSpaceOnUse" x1="215" y1="53" x2="215.4" y2="66">
            <stop offset="0" stopColor="#fff7e6" /><stop offset=".16" stopColor="#ffc065" /><stop offset=".46" stopColor="#ff4a1c" stopOpacity=".7" /><stop offset="1" stopColor="#ff2a1a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={u + "rr"} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="430" y2="0">
            <stop offset="0" stopColor="#ff2a4a" stopOpacity=".9" /><stop offset=".4" stopColor="#ff2a4a" stopOpacity=".6" /><stop offset=".56" stopColor="#ff2a4a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={u + "rb"} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="430" y2="0">
            <stop offset=".44" stopColor="#2f74ff" stopOpacity="0" /><stop offset=".6" stopColor="#2f74ff" stopOpacity=".6" /><stop offset="1" stopColor="#4a8bff" stopOpacity=".9" />
          </linearGradient>
          <linearGradient id={u + "sh"} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".95" /><stop offset=".56" stopColor="#ffd6dc" stopOpacity=".8" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={u + "t"}><polygon points={TOP} /></clipPath>
          <clipPath id={u + "b"}><polygon points={BOTTOM} /></clipPath>
          <clipPath id={u + "w"}><text x={XS} y={BASE}>{GLYPHS}</text></clipPath>
          <filter id={u + "ds"} x="-10%" y="-30%" width="120%" height="170%"><feDropShadow dx="0" dy="2.6" stdDeviation="3.2" floodColor="#000" floodOpacity=".62" /></filter>
          <filter id={u + "rim"} x="-5%" y="-10%" width="110%" height="120%"><feGaussianBlur stdDeviation=".9" /></filter>
        </defs>
        <g filter={ref("ds")}>
          <g className="tm-piece tm-bottom" clipPath={ref("b")}>
            <g filter={ref("rim")}><Word fill={ref("rr")} transform="translate(-1.6 -.3)" /><Word fill={ref("rb")} transform="translate(1.6 -.3)" /></g>
            <Word fill={ref("c2")} />
            <Word className="tm-hot" fill={ref("h2")} />
            <Word className="tm-edge" fill="none" />
          </g>
          <g className="tm-piece tm-top" clipPath={ref("t")}>
            <g filter={ref("rim")}><Word fill={ref("rr")} transform="translate(-1.6 -.3)" /><Word fill={ref("rb")} transform="translate(1.6 -.3)" /></g>
            <Word fill={ref("c1")} />
            <Word className="tm-hot" fill={ref("h1")} />
            <Word className="tm-edge" fill="none" />
          </g>
        </g>
        <g clipPath={ref("w")}><rect className="tm-sheen" x="-120" y="-10" width="120" height="120" fill={ref("sh")} /></g>
      </svg>
      <svg className="tm-laser" viewBox="0 0 430 100" focusable="false">
        <defs>
          <linearGradient id={u + "bf"} gradientUnits="userSpaceOnUse" x1={L} y1="0" x2={R} y2="0">
            <stop offset="0" stopColor="#ff2a4a" stopOpacity="0" /><stop offset=".16" stopColor="#ff2a4a" /><stop offset=".84" stopColor="#ff2a4a" /><stop offset="1" stopColor="#ff2a4a" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={u + "bc"} gradientUnits="userSpaceOnUse" x1={L} y1="0" x2={R} y2="0">
            <stop offset=".05" stopColor="#fff" stopOpacity="0" /><stop offset=".2" stopColor="#fff" /><stop offset=".8" stopColor="#fff" /><stop offset=".95" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={u + "sp"}>
            <stop offset="0" stopColor="#fff" /><stop offset=".18" stopColor="#ffe2b0" /><stop offset=".45" stopColor="#ff6a2a" stopOpacity=".5" /><stop offset="1" stopColor="#ff2a1a" stopOpacity="0" />
          </radialGradient>
          <filter id={u + "gl"} x="-10%" y="-400%" width="120%" height="900%"><feGaussianBlur stdDeviation="3.2" /></filter>
        </defs>
        <g className="tm-beam">
          <line className="tm-beam-glow" x1={L} y1={cutY(L)} x2={R} y2={cutY(R)} stroke={ref("bf")} strokeWidth="7" filter={ref("gl")} pathLength={1} />
          <line className="tm-beam-red" x1={L} y1={cutY(L)} x2={R} y2={cutY(R)} stroke={ref("bf")} strokeWidth="1.8" pathLength={1} />
          <line className="tm-beam-core" x1={L} y1={cutY(L)} x2={R} y2={cutY(R)} stroke={ref("bc")} strokeWidth=".7" pathLength={1} />
          {motion === "scan" && <line className="tm-beam-pulse" x1={L} y1={cutY(L)} x2={R} y2={cutY(R)} stroke="#fff" strokeWidth="2.4" filter={ref("gl")} pathLength={1} />}
        </g>
        {motion !== "none" && <>
          <g className="tm-sparks">
            {SPARKS.map(([x, dx, dy, d], i) => <circle key={i} r={i % 3 ? .9 : 1.3} style={{ "--x": x, "--y": cutY(x), "--dx": dx, "--dy": dy, "--t": d, "--at": +(Math.acos(1 - 2 * (x - L) / (R - L)) / Math.PI).toFixed(3) } as CSSProperties} />)}
          </g>
          <g className="tm-spark"><circle r="16" fill={ref("sp")} /><circle r="2.4" fill="#fff" /></g>
        </>}
      </svg>
    </span>
    {sub && <span className="tm-sub" aria-hidden="true">{en2 ? <><span>{en1}</span><i className="tm-pip" /><span>{en2}</span></> : <span>{sub}</span>}</span>}
  </div>;
}
