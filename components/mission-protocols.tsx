"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FIELD_MANUAL, type ManualIcon } from "@/lib/mission-brief";

const HALF = "#%&*+=<>/\\|01░▒▓";
const FULL = "囗回田目甲申由日曰口品器畐冂亠十丿乂入凵匚";
const isWide = (ch: string) => ch.charCodeAt(0) > 0x2e80;

/** Text that decrypts in place: unresolved characters cycle through glyphs of the same width, resolving left to right. */
function Decrypt({ text, run, delay = 0, speed = 34 }: { text: string; run: boolean; delay?: number; speed?: number }) {
  const span = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = span.current; if (!el) return;
    if (!run) { el.textContent = [...text].map(ch => ch === " " ? " " : (isWide(ch) ? FULL : HALF)[(Math.random() * 8) | 0]).join(""); return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = text; return; }
    const chars = [...text], t0 = performance.now() + delay;
    let frame = 0;
    const tick = (now: number) => {
      const done = Math.floor((now - t0) / speed);
      el.textContent = chars.map((ch, i) => i < done || ch === " " || ch === "\n" ? ch : (isWide(ch) ? FULL : HALF)[(Math.random() * (isWide(ch) ? FULL.length : HALF.length)) | 0]).join("");
      if (done < chars.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, run, delay, speed]);
  return <><span className="sr-only">{text}</span><span ref={span} aria-hidden="true" /></>;
}

const ICONS: Record<ManualIcon, ReactNode> = {
  gear: <><path d="M10 30c0-3 2-5 5-5h10l6-9c2-3 6-3 8 0l2 3c3 5 8 7 14 7 3 0 5 2 5 5v3c0 2-1 3-3 3H13c-2 0-3-1-3-3Z" /><path d="M10 33h50M24 25l3 4M30 21l3 4M36 18l3 4" /></>,
  clock: <><circle cx="32" cy="36" r="20" /><path d="M32 24v12l8 6M26 10h12M32 10v6M48 18l4-4" /></>,
  locker: <><rect x="16" y="8" width="32" height="50" rx="2" /><path d="M16 33h32M24 16h4M24 20h4M24 41h4M24 45h4" /><circle cx="40" cy="22" r="3" /><path d="M40 25v4" /></>,
  drink: <><path d="M27 6h10M28 6v8l-6 8v34a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V22l-6-8V6" /><path d="M22 32h20M22 44h20" /></>,
  shield: <><path d="M32 6 12 14v14c0 13 8 24 20 30 12-6 20-17 20-30V14Z" /><path d="m23 32 6 6 12-13" /></>,
};

const STORE = "egroup-outing:protocols";
/** A fingerprint, drawn in arcs. */
const PRINT = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true"><path d="M7.2 19.5C5.8 17.7 5 15.4 5 13a7 7 0 0 1 14 0" /><path d="M9.5 21c-1.2-2-1.9-4.4-1.9-7a4.4 4.4 0 0 1 8.8 0c0 1.3-.2 2.6-.5 3.8" /><path d="M12 14c0 2.7.6 5.2 1.7 7.4" /><path d="M17.8 19.6c.4-1.2.6-2.6.6-4" /><path d="M4.6 8.7A9 9 0 0 1 19.4 8.7" /></svg>;

/**
 * The field manual as five agent protocols. Each card decrypts as it comes on screen, its icon drawn in line by line; each
 * agent then confirms the protocols themselves — a press on the card's scanner stamps it CLEARED — and the console counts
 * them off until the agent is ready to deploy. Kept on this device.
 */
export default function MissionProtocols() {
  const list = useRef<HTMLOListElement>(null), [on, setOn] = useState(false);
  const [done, setDone] = useState<boolean[]>(() => FIELD_MANUAL.map(() => false));
  useEffect(() => {
    const el = list.current; if (!el) return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: "0px 0px -15% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(STORE) || "[]") as string[]; setDone(FIELD_MANUAL.map(item => saved.includes(item.key))); } catch {}
  }, []);
  const toggle = (index: number) => setDone(current => {
    const next = current.map((value, i) => i === index ? !value : value);
    try { localStorage.setItem(STORE, JSON.stringify(FIELD_MANUAL.filter((_, i) => next[i]).map(item => item.key))); } catch {}
    return next;
  });
  const count = done.filter(Boolean).length, all = count === FIELD_MANUAL.length;
  return <div className="protocols-wrap" data-all={all}>
    <div className="protocols-status" role="status">
      <span className="protocols-label">{all ? "READY FOR DEPLOYMENT" : "AGENT CHECK"}</span>
      <span className="protocols-meter" aria-hidden="true">{done.map((value, i) => <i key={i} data-on={value} />)}</span>
      <strong>{all ? "守則全數確認，準備出動" : <>已確認 <b>{count}</b> / {FIELD_MANUAL.length}</>}</strong>
    </div>
    <ol ref={list} className="protocols" data-on={on}>
      {FIELD_MANUAL.map((item, index) => <li key={item.key} className="protocol" data-done={done[index]} style={{ "--i": index } as React.CSSProperties}>
        <div className="protocol-top"><span>PROTOCOL {String(index + 1).padStart(2, "0")}</span><b>{item.key}</b></div>
        <span className="protocol-no" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <svg className="protocol-icon" viewBox="0 0 64 64" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <g>{ICONS[item.icon]}</g>
        </svg>
        <h3><Decrypt text={item.title} run={on} delay={180 + index * 140} /></h3>
        <p><Decrypt text={item.body} run={on} delay={420 + index * 140} speed={14} /></p>
        <button type="button" className="protocol-confirm" aria-pressed={done[index]} onClick={() => toggle(index)}>
          <span className="protocol-print">{PRINT}</span>
          <span>{done[index] ? "已確認" : "確認這條守則"}</span>
          <span className="sr-only">：{item.title}</span>
        </button>
        <span className="protocol-stamp" aria-hidden="true">CLEARED</span>
        <i className="protocol-scan" aria-hidden="true" />
      </li>)}
    </ol>
  </div>;
}
