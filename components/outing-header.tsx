"use client";
import Link from "next/link";
import TitleMark from "./title-mark";
import AccountMenu from "./account-menu";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useScrollReveal } from "./use-scroll-reveal";

// On phones the quick nav only drops down while scrolling up, so it never covers what is being read.
const MOBILE_NAV_IDLE_MS = 2000;
// Wide screens keep the quick nav inside the bar; narrower ones drop it to a second row once the hero buttons scroll away.
const INLINE_NAV_QUERY = "(min-width: 1101px)";

type TickerItem = { key: string; text: string; content?: ReactNode };

/** The mission page's four parts; phones show the short labels. */
const SECTIONS = [
  { id: "mission", label: "任務流程", short: "流程" },
  { id: "accept", label: "接受任務", short: "接受" },
  { id: "arena", label: "作戰場地", short: "場地" },
  { id: "tea", label: "戰後下午茶", short: "下午茶" },
  { id: "manual", label: "行前須知", short: "須知" },
];
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

export default function OutingHeader({ active, heroActions, title, eventDate }: {
  active: boolean; heroActions: RefObject<HTMLDivElement | null>; title: string; eventDate: string;
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
      for (const { id } of SECTIONS) {
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

  const [month, day] = eventDate.slice(5).split("-");
  const weekday = eventDate ? new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Taipei" }).format(new Date(eventDate + "T12:00:00+08:00")).toUpperCase() : "";
  const ticker: TickerItem[] = [
    { key: "任務", text: (month && day ? Number(month) + "/" + Number(day) + " " : "") + "中午 12:00・六度空間 LazerTreks 雷射對戰" },
    { key: "戰後", text: "飯店下午茶 Buffet" },
  ];
  ticker.push({ key: "集合", text: title + "・台北市中山區中山北路二段 185 號 B1，自行前往" });

  const quickNavRetracted = compact && mobile && !quickNavRevealed;
  const hideQuickNav = !inlineNav && (!compact || quickNavRetracted);
  return <div className={"outing-header" + (compact ? " is-compact" : "") + (quickNavRetracted ? " is-nav-retracted" : "")} ref={bar}>
    <OutingTicker items={ticker} />
    <div className="topbar wrap">
      <Link href="/" className="brand" aria-label="秋遊特務 首頁"><TitleMark className="brand-mark" /></Link>
      <div className="header-event">
        {month && day && <span className="header-date" aria-label={"活動日期 " + Number(month) + " 月 " + Number(day) + " 日"}>{month}/{day} {weekday}</span>}
      </div>
      <nav ref={quickNav} className="outing-quick-nav" aria-label="任務導覽" aria-hidden={hideQuickNav} inert={hideQuickNav}>
        {SECTIONS.map(({ id, label, short }) => <a key={id} href={"#" + id} aria-label={label} className={"header-link" + (section === id ? " is-current" : "")} aria-current={section === id ? "location" : undefined}>
          <span className="header-link-full">{label}</span><span className="header-link-short" aria-hidden="true">{short}</span>
        </a>)}
      </nav>
      <div className="header-actions"><AccountMenu organizerInMenu agent /></div>
    </div>
  </div>;
}
