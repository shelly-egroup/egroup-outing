"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import AccountMenu from "./account-menu";
import { useScrollReveal } from "./use-scroll-reveal";
import type { VoteReminder } from "@/lib/vote-reminder";

// On phones the quick nav only drops down while scrolling up, so it never covers what is being read.
const MOBILE_NAV_IDLE_MS = 2000;

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
  const [mobile, setMobile] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const quickNav = useRef<HTMLElement>(null);
  const [quickNavRevealed] = useScrollReveal(active && compact && mobile, MOBILE_NAV_IDLE_MS,
    () => !!quickNav.current?.contains(document.activeElement));
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
    const query = window.matchMedia("(max-width: 600px)");
    const sync = () => setMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const header = bar.current;
    if (!active || !header) return;
    const sync = () => {
      const extra = window.matchMedia("(max-width: 1100px)").matches ? 62 : 0;
      // Phones stick the header at -ticker height, so the ticker scrolls away and only the brand bar stays pinned.
      const ticker = header.querySelector<HTMLElement>(".ticker")?.offsetHeight ?? 0;
      header.style.setProperty("--ticker-height", ticker + "px");
      const hidden = window.matchMedia("(max-width: 600px)").matches ? ticker : 0;
      document.documentElement.style.setProperty("--outing-header-offset", header.offsetHeight - hidden + extra + 24 + "px");
    };
    const observer = new ResizeObserver(sync); observer.observe(header);
    window.addEventListener("resize",sync); sync();
    return () => { observer.disconnect();window.removeEventListener("resize",sync);document.documentElement.style.removeProperty("--outing-header-offset"); };
  }, [active, compact]);
  const quickNavRetracted = compact && mobile && !quickNavRevealed;
  const hideQuickNav = !compact || quickNavRetracted;
  return <div className={"outing-header" + (compact ? " is-compact" : "") + (quickNavRetracted ? " is-nav-retracted" : "")} ref={bar}>
    <OutingTicker announcement={announcement} />
    <div className="topbar wrap">
      <Link href="/" className="brand">揪是要對決<span>2026</span></Link>
      <div className="header-actions">
        {vote && <a className="header-vote" href={vote.target} data-tone={vote.tone} data-pending={vote.pending} title={"我的投票：" + vote.label + " · " + vote.status} aria-label={"我的投票，" + vote.label + "，" + vote.status + "。查看你的選擇"}>
          <span className="header-vote-code" aria-hidden="true">{vote.code}</span>
          <span className="header-vote-copy"><small>{vote.pending ? "變更未儲存" : "我的投票"}</small><strong>{vote.label}</strong></span>
          <span className="sr-only" role="status">{vote.status}</span>
        </a>}
        <nav ref={quickNav} className="outing-quick-nav" aria-label="秋遊導覽" aria-hidden={hideQuickNav} inert={hideQuickNav}>
          <a href="#plans" className="button button-dark">看方案，選陣營</a>
          <a href="#results" className="button button-white">看即時戰況</a>
        </nav>
        <AccountMenu />
      </div>
    </div>
  </div>;
}
