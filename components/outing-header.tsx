"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import AccountMenu from "./account-menu";
import type { VoteReminder } from "@/lib/vote-reminder";

function OutingTicker({ announcement }: { announcement: string }) {
  const messages = ["10/29 秋季員旅・雙方案對決・你的一票決定全員行程", announcement];
  const cycle = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(60);

  useEffect(() => {
    const element = cycle.current;
    if (!element) return;
    const sync = () => {
      const width = element.getBoundingClientRect().width;
      if (width > 0) setDuration(width / 28);
    };
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    sync();
    return () => observer.disconnect();
  }, []);

  return <div className="ticker">
    <p className="sr-only">{messages.join("　　")}</p>
    <div className="ticker-track" aria-hidden="true" style={{ animationDuration: duration + "s" }}>
      {[0, 1].map(repeat => <div className="ticker-cycle" ref={repeat === 0 ? cycle : undefined} key={repeat}>
        {messages.map((message, index) => <span className="ticker-message" data-topic={index === 1 ? "travel" : "vote"} key={index}>
          <svg className="ticker-flag" width="15" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 18V3h12l-3 4 3 4H4" /></svg>
          <span>{message}</span>
        </span>)}
      </div>)}
    </div>
  </div>;
}
export default function OutingHeader({ active, heroActions, vote, announcement }: { active: boolean; heroActions: RefObject<HTMLDivElement | null>; vote?: VoteReminder; announcement: string }) {
  const [compact, setCompact] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) { setCompact(false); return; }
    const actions = heroActions.current;
    const header = bar.current;
    if (!actions || !header) return;
    const sync = () => setCompact(actions.getBoundingClientRect().bottom <= header.getBoundingClientRect().bottom);
    const observer = new IntersectionObserver(sync, { threshold: [0, 1] });
    const size = new ResizeObserver(sync);
    observer.observe(actions); size.observe(header);
    let frame = 0;
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; sync(); }); };
    window.addEventListener("scroll", schedule, { passive: true });
    sync();
    return () => { observer.disconnect();size.disconnect();cancelAnimationFrame(frame);window.removeEventListener("scroll",schedule); };
  }, [active, heroActions]);
  useEffect(() => {
    const header = bar.current;
    if (!active || !header) return;
    const sync = () => {
      const extra = window.matchMedia("(max-width: 1100px)").matches ? 62 : 0;
      document.documentElement.style.setProperty("--outing-header-offset", header.offsetHeight + extra + 24 + "px");
    };
    const observer = new ResizeObserver(sync); observer.observe(header);
    window.addEventListener("resize",sync); sync();
    return () => { observer.disconnect();window.removeEventListener("resize",sync);document.documentElement.style.removeProperty("--outing-header-offset"); };
  }, [active, compact]);
  return <div className={"outing-header" + (compact ? " is-compact" : "")} ref={bar}>
    <OutingTicker announcement={announcement} />
    <div className="topbar wrap">
      <Link href="/" className="brand">揪是要對決<span>2026</span></Link>
      <div className="header-actions">
        {vote && <a className="header-vote" href={vote.target} data-tone={vote.tone} data-pending={vote.pending} title={"我的投票：" + vote.label + " · " + vote.status} aria-label={"我的投票，" + vote.label + "，" + vote.status + "。查看你的選擇"}>
          <span className="header-vote-code" aria-hidden="true">{vote.code}</span>
          <span className="header-vote-copy"><small>{vote.pending ? "變更未儲存" : "我的投票"}</small><strong>{vote.label}</strong></span>
          <span className="sr-only" role="status">{vote.status}</span>
        </a>}
        <nav className="outing-quick-nav" aria-label="秋遊導覽" aria-hidden={!compact} inert={!compact}>
          <a href="#plans" className="button button-dark">看方案，選陣營</a>
          <a href="#results" className="button button-white">看即時戰況</a>
        </nav>
        <AccountMenu />
      </div>
    </div>
  </div>;
}
