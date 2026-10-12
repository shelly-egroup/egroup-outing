import { useId } from "react";

/**
 * A spy's fedora for an agent's photo, worn low on the head: a teardrop crown in brushed felt with front pinches and a centre
 * crease, a crimson grosgrain band with a bow, and a snap brim lowered at the front. Red and blue rim light pick out its
 * edges like the mark's chrome. The brim stops at the hairline (the wrapper shades the forehead beneath it) so the face is
 * never covered. Positioned by its `.hat-wrap` parent.
 */
export default function AgentHat() {
  const id = "hat" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const crown = "M26 36C25 28 26.5 19 30.5 13.5 33 10 37 8.4 41 8.8 44.5 9.2 47 11.2 50 11.4 53 11.2 55.5 9.2 59 8.8 63 8.4 67 10 69.5 13.5 73.5 19 75 28 74 36Z";
  const brim = "M6 40.5C14 35.6 32 34.2 50 34.2S86 35.6 94 40.5C90 46.5 72 50.4 50 50.4S10 46.5 6 40.5Z";
  return <svg className="agent-hat" viewBox="0 0 100 56" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={id + "c"} x1=".1" y1="0" x2=".55" y2="1"><stop offset="0" stopColor="#5b626e" /><stop offset=".35" stopColor="#2a2e35" /><stop offset=".75" stopColor="#15171b" /><stop offset="1" stopColor="#090a0c" /></linearGradient>
      <radialGradient id={id + "b"} cx=".5" cy=".15" r=".75"><stop offset="0" stopColor="#3b4049" /><stop offset=".55" stopColor="#1b1e23" /><stop offset="1" stopColor="#07080a" /></radialGradient>
      <linearGradient id={id + "r"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff6a7e" /><stop offset=".35" stopColor="#d8173a" /><stop offset="1" stopColor="#6e0716" /></linearGradient>
      <linearGradient id={id + "s"} x1="0" y1="0" x2="1" y2=".4"><stop offset="0" stopColor="#fff" stopOpacity=".26" /><stop offset=".45" stopColor="#fff" stopOpacity=".05" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
      <pattern id={id + "g"} width="1.6" height="8" patternUnits="userSpaceOnUse"><rect width=".7" height="8" fill="#000" opacity=".22" /></pattern>
      <clipPath id={id + "k"}><path d={crown} /></clipPath>
    </defs>
    {/* the brim's far edge, behind the crown */}
    <path d={brim} fill={`url(#${id}b)`} />
    <path d="M9.5 40C18 36.4 33 35.4 50 35.4S82 36.4 90.5 40" fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth=".7" strokeLinecap="round" />
    {/* the crown, with its sheen, pinches and crease */}
    <path d={crown} fill={`url(#${id}c)`} />
    <g clipPath={`url(#${id}k)`}>
      <path d={crown} fill={`url(#${id}s)`} />
      <ellipse cx="36.5" cy="19" rx="3.6" ry="7.4" transform="rotate(12 36.5 19)" fill="#000" opacity=".34" />
      <ellipse cx="63.5" cy="19" rx="3.6" ry="7.4" transform="rotate(-12 63.5 19)" fill="#000" opacity=".34" />
      <path d="M50 11.8c-.6 3.6-.6 7.2 0 10.4" fill="none" stroke="#000" strokeOpacity=".45" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M51.2 12.4c-.4 3.2-.4 6.4 0 9.2" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth=".7" strokeLinecap="round" />
    </g>
    {/* rim light: red on the left, blue on the right, as on the mark */}
    <path d="M26 36C25 28 26.5 19 30.5 13.5 33 10 37 8.4 41 8.8" fill="none" stroke="#ff2a4a" strokeOpacity=".7" strokeWidth=".9" strokeLinecap="round" />
    <path d="M59 8.8C63 8.4 67 10 69.5 13.5 73.5 19 75 28 74 36" fill="none" stroke="#4a8bff" strokeOpacity=".65" strokeWidth=".9" strokeLinecap="round" />
    {/* the grosgrain band and its bow */}
    <path d="M26.2 30C38 32.6 62 32.6 73.8 30L74 36C62 38.8 38 38.8 26 36Z" fill={`url(#${id}r)`} />
    <path d="M26.2 30C38 32.6 62 32.6 73.8 30L74 36C62 38.8 38 38.8 26 36Z" fill={`url(#${id}g)`} />
    <path d="M26.6 30.4C38 32.9 62 32.9 73.4 30.4" fill="none" stroke="#ffb3be" strokeOpacity=".6" strokeWidth=".5" />
    <path d="M30.6 31.2c-2.6-1.6-4.2-.6-3.8 1.6.4 2 2.4 2.4 3.8 1.4M30.6 31.2c1.6-1.8 3.6-1.4 3.6.6s-2 2.4-3.6 1.6" fill="#a10d24" stroke="#5a0512" strokeWidth=".4" />
    <rect x="29.9" y="31" width="1.5" height="3.2" rx=".4" fill="#c2142f" />
    {/* the snap brim's front, lowered over the brow, its edge catching the light */}
    <path d="M6 40.5C10 46.5 28 50.4 50 50.4S90 46.5 94 40.5C88 43.8 70 46.4 50 46.4S12 43.8 6 40.5Z" fill="#050607" opacity=".85" />
    <path d="M8 41.6C14 46 30 49.2 50 49.2S86 46 92 41.6" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth=".6" strokeLinecap="round" />
  </svg>;
}
