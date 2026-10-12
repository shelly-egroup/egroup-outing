"use client";
import Link from "next/link";
import TitleMark from "./title-mark";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import AccountMenu from "./account-menu";
import { useScrollReveal } from "./use-scroll-reveal";
import { getVoteCountdown } from "@/lib/vote-countdown";
import type { VoteReminder } from "@/lib/vote-reminder";

// On phones the quick nav only drops down while scrolling up, so it never covers what is being read.
const MOBILE_NAV_IDLE_MS = 2000;
// Wide screens keep the quick nav inside the bar; narrower ones drop it to a second row once the hero buttons scroll away.
const INLINE_NAV_QUERY = "(min-width: 1101px)";

type TickerItem = { key: string; text: string; content?: ReactNode };

const pad = (value: number) => String(value).padStart(2, "0");
const BOLT = "M25 2 3 41h15l-7 29 26-44H21l8-24z";

function OutingTicker({ items }: { items: TickerItem[] }) {
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
    <p className="sr-only">{items.map(item => item.key + "：" + item.text).join("　　")}</p>
    <span className="ticker-live" aria-hidden="true"><i />LIVE</span>
    <div className="ticker-window" aria-hidden="true">
      <div className="ticker-track" style={{ animationDuration: duration + "s" }}>
        {[0, 1].map(repeat => <div className="ticker-cycle" ref={repeat === 0 ? cycle : undefined} key={repeat}>
          {items.map(item => <span className="ticker-message" key={item.key}>
            <svg className="ticker-bolt" width="9" height="16" viewBox="0 0 40 72"><path d={BOLT} /></svg>
            <b className="ticker-key">{item.key}</b>
            <span>{item.content ?? item.text}</span>
          </span>)}
        </div>)}
      </div>
    </div>
  </div>;
}

function useMedia(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setMatches(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

export default function OutingHeader({ active, heroActions, vote, title, eventDate, closesAt, votingEnabled, now, hasVoted }: {
  active: boolean; heroActions: RefObject<HTMLDivElement | null>; vote?: VoteReminder; title: string; eventDate: string;
  closesAt: number; votingEnabled: boolean; now: number; hasVoted: boolean;
}) {
  const [compact, setCompact] = useState(false);
  const [section, setSection] = useState("");
  const mobile = useMedia("(max-width: 600px)");
  const inlineNav = useMedia(INLINE_NAV_QUERY);
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
  // Light up the quick link for the part of the page being read.
  useEffect(() => {
    if (!active) { setSection(""); return; }
    let frame = 0;
    const sync = () => {
      frame = 0;
      const offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--outing-header-offset")) || 130;
      // A section counts once its top passes the upper 40% of the view, so entrance offsets do not delay it.
      const line = offset + (window.innerHeight - offset) * .4;
      let found = "";
      for (const id of ["plans", "selection", "results"]) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= line) found = id;
      }
      setSection(found);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    sync();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, [active]);
  useEffect(() => {
    const header = bar.current;
    if (!active || !header) return;
    const sync = () => {
      const extra = window.matchMedia("(max-width: 1100px)").matches ? 62 : 0;
      // The header sticks at -ticker height, so the ticker scrolls away and only the brand bar stays pinned.
      // Exact (sub-pixel) height: a rounded one leaves a sliver pinned, and the bar jitters by a pixel while scrolling.
      const ticker = header.querySelector<HTMLElement>(".ticker")?.getBoundingClientRect().height ?? 0;
      header.style.setProperty("--ticker-height", ticker + "px");
      document.documentElement.style.setProperty("--outing-header-offset", header.offsetHeight - ticker + extra + 24 + "px");
    };
    const observer = new ResizeObserver(sync); observer.observe(header);
    window.addEventListener("resize",sync); sync();
    return () => { observer.disconnect();window.removeEventListener("resize",sync);document.documentElement.style.removeProperty("--outing-header-offset"); };
  }, [active, compact]);

  // The countdown only shows while a vote is actually open; a closed vote is not news on the mission page.
  const open = getVoteCountdown(closesAt, now, votingEnabled);
  const countdown = open && open.state !== "closed" ? open : null;
  const votingLive = !!countdown;
  const [month, day] = eventDate.slice(5).split("-");
  const weekday = eventDate ? new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Taipei" }).format(new Date(eventDate + "T12:00:00+08:00")).toUpperCase() : "";
  const ticker: TickerItem[] = [
    { key: "任務", text: (month && day ? Number(month) + "/" + Number(day) + " " : "") + "中午 12:00・六度空間 LazerTreks 雷射對戰" },
    { key: "戰後", text: "飯店下午茶 Buffet" },
  ];
  if (countdown) ticker.push({ key: "倒數", text: countdown.days > 0 ? "截止還有 " + countdown.days + " 天 " + countdown.hours + " 小時" : "最後 " + countdown.hours + " 小時 " + countdown.minutes + " 分" });
  ticker.push({ key: "集合", text: title + "・台北市中山區中山北路二段 185 號 B1，自行前往" });

  const links = [
    { href: "#plans", label: "看任務行程", current: section === "plans" || section === "selection", todo: votingLive && !hasVoted },
  ];
  const quickNavRetracted = compact && mobile && !quickNavRevealed;
  const hideQuickNav = !inlineNav && (!compact || quickNavRetracted);
  return <div className={"outing-header" + (compact ? " is-compact" : "") + (quickNavRetracted ? " is-nav-retracted" : "")} ref={bar}>
    <OutingTicker items={ticker} />
    <div className="topbar wrap">
      <Link href="/" className="brand" aria-label="秋遊特務 首頁"><TitleMark className="brand-mark" /></Link>
      {/* Event facts sit together beside the logo: the date, then the vote countdown attached to it. */}
      <div className="header-event">
        {month && day && <span className="header-date" aria-label={"活動日期 " + Number(month) + " 月 " + Number(day) + " 日"}>{month}/{day} {weekday}</span>}
        {countdown && <span className="header-countdown" data-state={countdown.state} role="timer"
          aria-label={"投票倒數 " + countdown.days + " 天 " + countdown.hours + " 小時 " + countdown.minutes + " 分"}>
          {<><i aria-hidden="true" /><span className="header-countdown-label" aria-hidden="true">投票倒數</span>
            {/* Units, not colons: "12:52" alone reads as a clock time once phones drop the seconds. */}
            <b aria-hidden="true">{countdown.days > 0 && <>{countdown.days}<small>天</small></>}{pad(countdown.hours)}<small>時</small>{pad(countdown.minutes)}<small>分</small><span className="header-countdown-sec">{pad(countdown.seconds)}<small>秒</small></span></b></>}
        </span>}
      </div>
      <nav ref={quickNav} className="outing-quick-nav" aria-label="秋遊導覽" aria-hidden={hideQuickNav} inert={hideQuickNav}>
        {links.map(link => <a key={link.href} href={link.href} className={"header-link" + (link.current ? " is-current" : "")} aria-current={link.current ? "location" : undefined}>
          {link.label}{link.todo && <><i className="header-link-dot" aria-hidden="true" /><span className="sr-only">（你還沒投票）</span></>}
        </a>)}
      </nav>
      <div className="header-actions">
        {vote && <a className="header-vote" href={vote.target} data-tone={vote.tone} data-pending={vote.pending} title={"我的投票：" + vote.label + " · " + vote.status} aria-label={"我的投票，" + vote.label + "，" + vote.status + "。查看你的選擇"}>
          <span className="header-vote-code" aria-hidden="true">{vote.code}</span>
          <span className="header-vote-copy"><small>{vote.pending ? "變更未儲存" : "我的投票"}</small><strong>{vote.label}</strong></span>
          <span className="sr-only" role="status">{vote.status}</span>
        </a>}
        <AccountMenu organizerInMenu />
      </div>
    </div>
  </div>;
}
