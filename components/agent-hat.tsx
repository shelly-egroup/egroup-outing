import { useId } from "react";

/** A spy's fedora for an agent's photo: dark felt, a red band, worn at an angle. Sits on top of its `.hat-wrap` parent. */
export default function AgentHat() {
  const felt = "hat" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return <svg className="agent-hat" viewBox="0 0 64 40" aria-hidden="true" focusable="false">
    <defs><linearGradient id={felt} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#454b55" /><stop offset=".45" stopColor="#1c1f25" /><stop offset="1" stopColor="#07080a" /></linearGradient></defs>
    <path d="M15 27c-1-9 2-18 8-21 3 2 6 3 9 3s6-1 9-3c6 3 9 12 8 21-6 2-28 2-34 0Z" fill={`url(#${felt})`} />
    <path d="M15.4 22.6c6.6 2.6 26.6 2.6 33.2 0l.4 4.4c-6 2-28 2-34 0Z" fill="#ff2a4a" />
    <path d="M3 30c7-4 17-5 29-5s22 1 29 5c-4 4-15 5-29 5S7 34 3 30Z" fill={`url(#${felt})`} />
    <path d="M18.5 23c0-7 2-13 5.5-16" fill="none" stroke="rgb(255 255 255 / .24)" strokeWidth="1.2" strokeLinecap="round" />
  </svg>;
}
