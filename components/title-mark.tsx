"use client";
import { useId, type CSSProperties } from "react";
import { MARK_AGENT, MARK_AGENT_AIM, MARK_DOT, MARK_GLYPHS, MARK_MUZZLE, MARK_MUZZLE_UP } from "@/lib/title-mark-paths";

/** Each character's centre in the 430 × 100 box (glyph i spans 110 i … 110 i + 100). */
const CENTRES = MARK_GLYPHS.map((_, i) => i * 110 + 50);
/** The red glow sits just inside the raised pistol's muzzle (the barrel points straight up). */
const TIP = { x: MARK_MUZZLE_UP.cx, y: +(MARK_MUZZLE_UP.cy + .9).toFixed(2) };

/**
 * 秋遊特務, the site's mark, with the agent inside the type: in 遊 the 子 is a gunmetal agent in a dinner jacket, outlined in
 * chrome, his pistol raised beside his face, its muzzle glowing red; the dot of 特's 寸 is where his laser landed. Brushed chrome
 * with red and blue rim light. `motion="intro"` plays it like the 007 opening: four white dots slide in and each irises open
 * into a character; the agent, arm out, fires at 特 — the beam leaves the red dot — and then raises his pistol. `motion="scan"`
 * (loading) keeps aiming, firing and raising. Without motion, or with reduced motion, it is the finished mark.
 */
export default function TitleMark({ className = "", sub, motion = "none", play = true }: { className?: string; sub?: string; motion?: "none" | "intro" | "scan"; play?: boolean }) {
  const u = "tm" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = (name: string) => `url(#${u}${name})`;
  const [en1, en2] = (sub || "").split(" ");
  // 遊 carries the agent: pistol raised (the finished mark) and, for the intro, aiming at 特
  const shape = (i: number, fill: string, className?: string, transform?: string) => <>
    <path className={className} d={MARK_GLYPHS[i]} fill={fill} transform={transform} />
    {i === 1 && <>
      <path className={(className ? className + " " : "") + "tm-agent tm-pose-up"} d={MARK_AGENT} fill={fill === ref("c") ? ref("g") : fill} transform={transform} />
      {motion !== "none" && <path className={(className ? className + " " : "") + "tm-agent tm-pose-aim"} d={MARK_AGENT_AIM} fill={fill === ref("c") ? ref("g") : fill} transform={transform} />}
    </>}
  </>;
  return <div className={"title-mark " + className} data-motion={motion} data-play={play} role="img" aria-label={sub ? "秋遊特務 " + sub : "秋遊特務"}>
    <svg className="tm-word" viewBox="0 0 430 100" focusable="false" aria-hidden="true">
      <defs>
        <linearGradient id={u + "c"} gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="98">
          <stop offset="0" stopColor="#ffffff" /><stop offset=".3" stopColor="#e9ecef" /><stop offset=".47" stopColor="#9aa1aa" /><stop offset=".53" stopColor="#f6f7f8" /><stop offset=".7" stopColor="#c4c9cf" /><stop offset="1" stopColor="#5f666f" />
        </linearGradient>
        <linearGradient id={u + "rr"} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="430" y2="0">
          <stop offset="0" stopColor="#ff2a4a" stopOpacity=".9" /><stop offset=".4" stopColor="#ff2a4a" stopOpacity=".55" /><stop offset=".56" stopColor="#ff2a4a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={u + "rb"} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="430" y2="0">
          <stop offset=".44" stopColor="#2f74ff" stopOpacity="0" /><stop offset=".6" stopColor="#2f74ff" stopOpacity=".55" /><stop offset="1" stopColor="#4a8bff" stopOpacity=".9" />
        </linearGradient>
        <linearGradient id={u + "sh"} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".95" /><stop offset=".56" stopColor="#ffd6dc" stopOpacity=".8" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={u + "g"} gradientUnits="userSpaceOnUse" x1="0" y1="18" x2="0" y2="86">
          <stop offset="0" stopColor="#d9dde2" /><stop offset=".28" stopColor="#7d848d" /><stop offset=".5" stopColor="#2c3036" /><stop offset=".52" stopColor="#5a6068" /><stop offset="1" stopColor="#1d2025" />
        </linearGradient>
        <radialGradient id={u + "glow"}><stop offset="0" stopColor="#ff2a4a" stopOpacity=".85" /><stop offset=".45" stopColor="#ff2a4a" stopOpacity=".28" /><stop offset="1" stopColor="#ff2a4a" stopOpacity="0" /></radialGradient>
        <radialGradient id={u + "dot"}><stop offset="0" stopColor="#fff" /><stop offset=".28" stopColor="#ff9aa8" /><stop offset=".62" stopColor="#ff2a4a" /><stop offset="1" stopColor="#c2102a" /></radialGradient>
        {CENTRES.map((cx, i) => <clipPath key={i} id={u + "i" + i}><circle className="tm-iris" cx={cx} cy="50" r="76" style={{ "--i": i } as CSSProperties} /></clipPath>)}
        <clipPath id={u + "w"}>{MARK_GLYPHS.map((d, i) => <path key={i} d={d} />)}<path d={MARK_AGENT} /></clipPath>
        <filter id={u + "ds"} x="-10%" y="-30%" width="120%" height="170%"><feDropShadow dx="0" dy="2.6" stdDeviation="3.2" floodColor="#000" floodOpacity=".62" /></filter>
        <filter id={u + "rim"} x="-5%" y="-10%" width="110%" height="120%"><feGaussianBlur stdDeviation=".9" /></filter>
      </defs>
      <g filter={ref("ds")}>
        {MARK_GLYPHS.map((_, i) => <g key={i} clipPath={ref("i" + i)}>
          <g filter={ref("rim")}>{shape(i, ref("rr"), undefined, "translate(-1.6 -.3)")}{shape(i, ref("rb"), undefined, "translate(1.6 -.3)")}</g>
          {shape(i, ref("c"))}
          {shape(i, "none", "tm-edge")}
          {i === 1 && <><path className="tm-agent-line tm-pose-up" d={MARK_AGENT} fill="none" stroke={ref("c")} />
            {motion !== "none" && <path className="tm-agent-line tm-pose-aim" d={MARK_AGENT_AIM} fill="none" stroke={ref("c")} />}
            <g className="tm-muzzle"><circle cx={TIP.x} cy={TIP.y} r="3.6" fill={ref("glow")} /><circle cx={TIP.x} cy={TIP.y} r="1.2" fill={ref("dot")} /></g></>}
        </g>)}
      </g>
      <g clipPath={ref("w")}><rect className="tm-sheen" x="-120" y="-10" width="120" height="120" fill={ref("sh")} /></g>
      {/* the agent's shot and the laser sight it leaves on 特 */}
      <line className="tm-shot" x1={MARK_MUZZLE.cx} y1={MARK_MUZZLE.cy} x2={MARK_DOT.cx} y2={MARK_DOT.cy} pathLength={1} />
      <circle className="tm-flash" cx={MARK_MUZZLE.cx} cy={MARK_MUZZLE.cy} r="7" fill={ref("glow")} />
      <circle className="tm-halo" cx={MARK_DOT.cx} cy={MARK_DOT.cy} r={MARK_DOT.r * 2.4} fill={ref("glow")} />
      <circle className="tm-laser" cx={MARK_DOT.cx} cy={MARK_DOT.cy} r={MARK_DOT.r * .74} fill={ref("dot")} />
      {motion !== "none" && CENTRES.map((cx, i) => <circle key={i} className="tm-dot" cx={cx} cy="50" r="9" style={{ "--i": i } as CSSProperties} />)}
    </svg>
    {sub && <span className="tm-sub" aria-hidden="true">{en2 ? <><span>{en1}</span><i className="tm-pip" /><span>{en2}</span></> : <span>{sub}</span>}</span>}
  </div>;
}
