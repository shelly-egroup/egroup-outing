"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import AccountMenu from "./account-menu";
import type { VoteReminder } from "@/lib/vote-reminder";
export default function OutingHeader({ active, heroActions, vote }: { active: boolean; heroActions: RefObject<HTMLDivElement | null>; vote?: VoteReminder }) {
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
  return <div className={"outing-header" + (compact ? " is-compact" : "")}>
    <div className="topbar wrap" ref={bar}>
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
