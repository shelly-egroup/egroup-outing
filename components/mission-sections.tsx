"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import TitleMark from "./title-mark";
import StoreLinks from "./store-links";
import DuelSim from "./duel-sim";
import { useOuting } from "./outing-provider";
import { lazerTreksStore, choiceStore } from "@/lib/store-references";
import { sortedChoices, sortedGroups, type TripPlan } from "@/lib/trips";
import { ARENA_FACTS, ARENA_TRANSIT, FIELD_MANUAL, MISSION_IMAGES, MISSION_MODES, missionCalendarUrl, missionClock, type ManualIcon } from "@/lib/mission-brief";

const pad = (value: number) => String(value).padStart(2, "0");
const LOADOUT_KEY = "egroup-outing:loadout";
/** What each stop of the day is called on the IMF console, by its position in the schedule. */
const PHASES = ["RENDEZVOUS", "ENGAGE", "TRANSIT", "EXTRACT"];

/** Becomes true once the element scrolls into view (at once when motion is reduced). */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null), [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setSeen(true); return; }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: "0px 0px -12% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

/** A console window: title bar with the file name and a status lamp, scanlines over the body. */
function Terminal({ name, status, tone = "amber", className = "", children }: { name: string; status: string; tone?: "amber" | "red" | "blue" | "green"; className?: string; children: ReactNode }) {
  return <div className={"term " + className} data-tone={tone}>
    <div className="term-bar">
      <span className="term-lights" aria-hidden="true"><i /><i /><i /></span>
      <span className="term-name">{name}</span>
      <span className="term-status"><i aria-hidden="true" />{status}</span>
    </div>
    <div className="term-body">{children}</div>
  </div>;
}

const DESTRUCT_SECONDS = 5;
/** The briefing: lines typed out one character at a time once on screen, then — Mission: Impossible style — a five-second
 *  countdown and the message burns itself away; its height is held so nothing below moves. Reduced motion keeps it static. */
function BootLog({ lines }: { lines: [string, string][] }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const total = lines.reduce((sum, [k, v]) => sum + k.length + v.length, 0);
  const [count, setCount] = useState(0), [stage, setStage] = useState<"typing" | "armed" | "burning" | "gone">("typing");
  const [secs, setSecs] = useState(DESTRUCT_SECONDS), [height, setHeight] = useState<number>(), still = useRef(false);
  useEffect(() => {
    if (!seen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { still.current = true; setCount(total); return; }
    const timer = setInterval(() => setCount(c => { if (c >= total) { clearInterval(timer); return c; } return c + 1; }), 22);
    return () => clearInterval(timer);
  }, [seen, total]);
  useEffect(() => { if (count >= total && stage === "typing") setStage("armed"); }, [count, total, stage]);
  useLayoutEffect(() => { if (stage === "armed" && ref.current) setHeight(ref.current.offsetHeight); }, [stage, ref]);
  useEffect(() => {
    if (stage !== "armed" || still.current) return;
    const timer = setInterval(() => setSecs(s => s - 1), 1000);
    return () => clearInterval(timer);
  }, [stage]);
  useEffect(() => { if (stage === "armed" && secs <= 0) setStage("burning"); }, [stage, secs]);
  useEffect(() => { if (stage !== "burning") return; const timer = setTimeout(() => setStage("gone"), 1300); return () => clearTimeout(timer); }, [stage]);
  // once the smoke clears, the empty space folds away and the log closes up
  useEffect(() => { if (stage !== "gone") return; const timer = setTimeout(() => setHeight(0), 1500); return () => clearTimeout(timer); }, [stage]);
  let left = count;
  return <div ref={ref} className="boot" data-state={stage} style={height !== undefined ? { minHeight: height } : undefined}>
    <p className="sr-only">{lines.map(([k, v]) => k + "：" + v).join("；")}；本訊息將自動銷毀</p>
    {stage === "gone" ? <div className="boot-gone" aria-hidden="true">
      <p className="boot-line"><span className="boot-prompt">&gt;</span><span className="boot-key">訊息已銷毀</span><i className="boot-caret is-idle" /></p>
      <small>MESSAGE DESTROYED</small>
    </div> : <div className="boot-lines" aria-hidden="true">
      {lines.map(([key, value], index) => {
        const k = key.slice(0, Math.max(0, left)); left -= key.length;
        const v = value.slice(0, Math.max(0, left)); left -= value.length;
        const typing = left < 0 && left > -(key.length + value.length) - 1 && (k.length || index === 0);
        return <p key={key} className="boot-line" data-done={left >= 0}>
          <span className="boot-prompt">&gt;</span><span className="boot-key">{k}</span>{k.length === key.length && <span className="boot-dots" />}<b className="boot-value">{v}</b>{typing && <i className="boot-caret" />}
        </p>;
      })}
      {stage !== "typing" && <p className="boot-line boot-destruct"><span className="boot-prompt">&gt;</span><i className="boot-alarm" />
        <span>{still.current ? "本訊息將自動銷毀" : <>本訊息將在 <b>{Math.max(0, secs)}</b> 秒後自動銷毀</>}</span><i className="boot-caret is-idle" /></p>}
    </div>}
  </div>;
}

/** T-minus to the meet-up, ticking with the page clock; once the day starts it says where the mission stands. */
function MissionCountdown({ eventDate, start, now }: { eventDate: string; start: string; now: number }) {
  const clock = missionClock(eventDate, start, now);
  if (!clock) return null;
  if (clock.state !== "counting") return <p className="ms-countdown" data-state={clock.state}><span className="ms-countdown-label"><i aria-hidden="true" />{clock.state === "live" ? "任務進行中" : "任務完成"}</span></p>;
  return <p className="ms-countdown" role="timer" aria-label={"距離集合還有 " + clock.days + " 天 " + clock.hours + " 小時 " + clock.minutes + " 分"}>
    <span className="ms-countdown-label" aria-hidden="true"><i />T-MINUS・距離集合</span>
    <span className="ms-countdown-digits" aria-hidden="true">
      <b>{clock.days}</b><small>天</small><b>{pad(clock.hours)}</b><small>時</small><b>{pad(clock.minutes)}</b><small>分</small><b className="ms-countdown-sec">{pad(clock.seconds)}</b><small className="ms-countdown-sec">秒</small>
    </span>
  </p>;
}

/** A photo shown as a live surveillance feed: camera id, REC, a Taipei timestamp from the page clock, crosshair, scanlines. */
function ReconFeed({ src, cam, label, alt, now }: { src: string; cam: string; label: string; alt: string; now: number }) {
  const stamp = new Date(now + 8 * 3600000).toISOString();
  return <figure className="feed">
    <img src={src} width={1600} height={900} loading="lazy" decoding="async" alt={alt} />
    <span className="feed-hud" aria-hidden="true">
      <span className="feed-tl"><b>{cam}</b>{label}</span>
      <span className="feed-tr"><i />REC</span>
      <span className="feed-bl">{stamp.slice(0, 10).replaceAll("-", ".")} {stamp.slice(11, 19)}</span>
      <span className="feed-br">ZOOM 1.0×</span>
      <span className="feed-cross" />
    </span>
  </figure>;
}

/** A captain's face run through recognition: sweep, box, then the match. */
function FaceScan({ src, side, name }: { src: string; side: "red" | "blue"; name: string }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return <div ref={ref} className="scan" data-side={side} data-seen={seen}>
    <div className="scan-photo">
      <img src={src} width={640} height={720} loading="lazy" decoding="async" alt={name + "（主視覺照）"} />
      <span className="scan-box" aria-hidden="true"><i /><i /><i /><i /></span>
      <span className="scan-sweep" aria-hidden="true" />
    </div>
    <p className="scan-id"><span>{side === "red" ? "RED TEAM LEAD" : "BLUE TEAM LEAD"}</span><strong>{name}</strong><b>IDENTITY CONFIRMED</b></p>
  </div>;
}

/** The walk from the MRT, drawn as a route trace. */
function RouteMap({ address }: { address: string }) {
  return <svg className="route" viewBox="0 0 640 200" role="img" aria-label={"捷運民權西路站 9 號出口步行約 8 分鐘到 " + address}>
    <defs><pattern id="route-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="currentColor" strokeOpacity=".08" /></pattern></defs>
    <rect width="640" height="200" fill="url(#route-grid)" />
    <path className="route-road" d="M0 132H640" />
    <text className="route-road-name" x="320" y="156" textAnchor="middle">中山北路二段</text>
    <path className="route-path" d="M86 92C150 92 168 132 236 132H470C520 132 532 92 560 92" />
    <g className="route-mrt" transform="translate(70 92)"><circle r="17" /><text y="5" textAnchor="middle">M</text></g>
    <text className="route-label" x="70" y="44" textAnchor="middle">捷運民權西路站</text>
    <text className="route-sub" x="70" y="64" textAnchor="middle">9 號出口</text>
    <text className="route-eta" x="352" y="118" textAnchor="middle">步行約 8 分鐘</text>
    <g className="route-target" transform="translate(576 92)"><circle r="20" /><circle r="8" /><path d="M0-30V-22M0 22V30M-30 0H-22M22 0H30" /></g>
    <text className="route-label" x="576" y="44" textAnchor="middle">六度空間 B1</text>
    <text className="route-sub" x="576" y="64" textAnchor="middle">185 號</text>
  </svg>;
}

function Glyph({ icon }: { icon: ManualIcon }) {
  const paths: Record<ManualIcon, ReactNode> = {
    gear: <path d="M8 4 4 7l2 4 2-1v10h8V10l2 1 2-4-4-3c-.6 1.4-2.1 2.4-4 2.4S8.6 5.4 8 4Z" />,
    clock: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9 2h6" /></>,
    locker: <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M5 12h14M15 7v2M15 15v2" /></>,
    drink: <><path d="M10 2h4M10.5 2v3.5L8 9v12h8V9l-2.5-3.5V2" /><path d="M8 13h8" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.6 3 8.4 7 10 4-1.6 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  };
  return <svg className="ms-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[icon]}</svg>;
}

/** The field manual as a loadout check: tick what is ready; the ticks stay on this device. */
function LoadoutCheck() {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(LOADOUT_KEY) || "[]"); if (Array.isArray(saved)) setDone(saved.filter(key => typeof key === "string")); } catch { /* storage off: start empty */ } }, []);
  const toggle = (key: string) => setDone(current => {
    const next = current.includes(key) ? current.filter(item => item !== key) : [...current, key];
    try { localStorage.setItem(LOADOUT_KEY, JSON.stringify(next)); } catch { /* keep it for this visit only */ }
    return next;
  });
  const ready = FIELD_MANUAL.filter(item => done.includes(item.key)).length, all = ready === FIELD_MANUAL.length;
  return <div className="loadout" data-complete={all}>
    <div className="loadout-meter" role="status">
      <span>LOADOUT</span>
      <span className="loadout-bar" aria-hidden="true"><i style={{ width: ready / FIELD_MANUAL.length * 100 + "%" }} /></span>
      <b>{all ? "ALL CLEAR・準備完成" : "READY " + ready + " / " + FIELD_MANUAL.length}</b>
    </div>
    <ol className="ms-manual-list">
      {FIELD_MANUAL.map(item => {
        const checked = done.includes(item.key);
        return <li key={item.key} className="ms-manual-item" data-checked={checked}>
          <label>
            <input type="checkbox" checked={checked} onChange={() => toggle(item.key)} />
            <span className="loadout-box" aria-hidden="true" />
            <Glyph icon={item.icon} />
            <span className="ms-label">{item.key}</span>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </label>
        </li>;
      })}
    </ol>
  </div>;
}

/** Below the key visual, only the trip itself, on the IMF console: the day's log, the arena recon, the tea extraction, the loadout. */
export default function MissionSections({ plan, eventDate, title, now }: { plan?: TripPlan; eventDate: string; title: string; now: number }) {
  const { stores } = useOuting();
  const schedule = plan?.schedule || [];
  const meet = schedule[0];
  const teaStop = schedule.find(stop => stop.title.includes("下午茶"));
  const transfer = schedule.find(stop => stop.title.includes("飯店") && stop !== teaStop);
  const address = meet?.description.replace(/，?自行前往。?$/, "") || "台北市中山區中山北路二段 185 號 B1";
  const date = eventDate.slice(5).replace("-", ".");
  const teaGroup = plan ? sortedGroups(plan).find(([, group]) => group.label.includes("下午茶")) : undefined;
  const hotels = teaGroup ? sortedChoices(teaGroup[1]).map(([id, choice]) => {
    const storeId = choice.store?.id || choiceStore(choice.label)?.id;
    return { id, choice, storeId, store: (storeId && stores[storeId]?.info) || choiceStore(choice.label) };
  }) : [];
  const arenaStore = stores[lazerTreksStore.id]?.info || lazerTreksStore;
  const venue = { ...arenaStore, mapsQuery: "六度空間 LazerTreks " + address.replace(/\s/g, "") };
  return <div className="mission-sections">
    <section id="mission" className="ms-section ms-timeline" aria-labelledby="ms-mission-title">
      <div className="wrap">
        <SectionHead no="01" en="MISSION TIMELINE" id="ms-mission-title" title={<>{date} <em>任務流程</em></>}
          lead={plan?.description} aside={meet && <MissionCountdown eventDate={eventDate} start={meet.time} now={now} />} />
        <Terminal name="MISSION_TIMELINE.LOG" status="SECURE LINK" tone="green">
          <BootLog lines={[["SECURE LINK", "OK"], ["AGENTS", "全體同仁"], ["MISSION FILE", "秋遊特務 / " + date], ["STATUS", "ACCEPTED"]]} />
          <ol className="ms-log">
            {schedule.map((stop, index) => <li key={index} className="ms-log-row">
              <span className="ms-log-node" aria-hidden="true"><i /></span>
              <time className="ms-log-time">{stop.time}</time>
              <span className="ms-log-code">{PHASES[index] || "STEP " + pad(index + 1)}</span>
              <div className="ms-log-copy"><h3>{stop.title}</h3>{stop.description && <p>{stop.description}</p>}</div>
            </li>)}
          </ol>
          {!!plan?.tags?.length && <ul className="ms-tags" aria-label="行程特色">{plan.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}
        </Terminal>
      </div>
    </section>

    <section id="arena" className="ms-section ms-arena" aria-labelledby="ms-arena-title">
      <div className="wrap">
        <SectionHead no="02" en="THE ARENA" id="ms-arena-title" title={<>作戰場地 <em>六度空間 LazerTreks</em></>}
          lead="霓虹迷宮裡穿上感應背心、拿起雷射槍，分隊攻防、電腦即時計分；教練先教裝備，再從暖身個人賽打到團隊對抗。" />
        <div className="ms-arena-grid">
          <Terminal name="RECON_FEED // CAM-01" status="LIVE" tone="red">
            <ReconFeed src={MISSION_IMAGES.arena} cam="CAM-01" label="LAZERTREKS B1" alt="雷射迷宮裡的紅藍霓虹燈、碉堡與感應基地" now={now} />
          </Terminal>
          <Terminal name="TARGET_INTEL.DAT" status="VERIFIED">
            <dl className="ms-facts">
              {ARENA_FACTS.map(fact => <div key={fact.label} className="ms-fact"><dt>{fact.label}</dt><dd>{fact.value}<small>{fact.note}</small></dd></div>)}
            </dl>
          </Terminal>
        </div>
        <Terminal name="TEAM_CAPTAINS.DB" status="2 MATCHES" className="ms-captains-term">
          <div className="ms-captains">
            <FaceScan src={MISSION_IMAGES.captainRed} side="red" name="紅隊隊長" />
            <p className="ms-versus" aria-hidden="true"><span>VS</span></p>
            <FaceScan src={MISSION_IMAGES.captainBlue} side="blue" name="藍隊隊長" />
          </div>
        </Terminal>
        <Terminal name="MISSION_MODES.EXE" status={MISSION_MODES.length + " PROGRAMS"} className="ms-modes-term">
          <p className="ms-term-note">這個方案的任務，教練會依現場安排</p>
          <ol className="ms-modes">
            {MISSION_MODES.map(mode => <li key={mode.code} className="ms-mode">
              <span className="ms-mode-code">{mode.code}</span>
              <strong>{mode.name}</strong>
              <p>{mode.line}</p>
              <svg className="ms-mode-reticle" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="13" /><path d="M20 2v9M20 29v9M2 20h9M29 20h9" /></svg>
            </li>)}
          </ol>
        </Terminal>
        <Terminal name="NAV_ROUTE.MAP" status="ROUTE LOCKED" tone="blue" className="ms-route-term">
          <div className="ms-venue">
            <RouteMap address={address} />
            <div className="ms-venue-where">
              <span className="ms-label">集合地點</span>
              <strong>{address}</strong>
              <ul className="ms-transit">
                {ARENA_TRANSIT.map(item => <li key={item.mode}><b>{item.mode}</b><span>{item.text}</span></li>)}
              </ul>
              <div className="ms-venue-links"><VenueRating id={lazerTreksStore.id} /><StoreLinks store={venue} /></div>
            </div>
          </div>
        </Terminal>
      </div>
    </section>

    <section id="tea" className="ms-section ms-tea" aria-labelledby="ms-tea-title">
      <div className="wrap">
        <SectionHead no="03" en="AFTER ACTION" id="ms-tea-title" title={<>戰後補給 <em>飯店下午茶 Buffet</em></>} lead={teaStop?.description} />
        <div className="ms-tea-grid">
          <Terminal name="EXTRACTION // CAM-02" status="STANDBY" tone="amber">
            <ReconFeed src={MISSION_IMAGES.tea} cam="CAM-02" label="AFTERNOON TEA" alt="飯店下午茶的三層點心架與紅茶" now={now} />
          </Terminal>
          {hotels.length > 0 && <Terminal name="EXTRACTION_POINTS.DAT" status={hotels.length > 1 ? hotels.length + " 選 1" : "LOCKED"}>
            <p className="ms-term-note">{transfer?.description || "訂位確認後公布"}</p>
            <ol className="ms-hotels">
              {hotels.map(({ id, choice, storeId, store }, index) => <li key={id} className="ms-hotel">
                <span className="ms-hotel-no" aria-hidden="true">{pad(index + 1)}</span>
                <div className="ms-hotel-copy">
                  <strong>{choice.label}</strong>
                  {choice.description && <p>{choice.description}</p>}
                  <div className="ms-hotel-links"><VenueRating id={storeId} />{store && <StoreLinks store={store} compact />}</div>
                </div>
              </li>)}
            </ol>
          </Terminal>}
        </div>
      </div>
    </section>

    <section id="manual" className="ms-section ms-manual" aria-labelledby="ms-manual-title">
      <div className="wrap">
        <SectionHead no="04" en="FIELD MANUAL" id="ms-manual-title" title={<>行前須知 <em>出發前逐項打勾</em></>} />
        <Terminal name="LOADOUT_CHECK.EXE" status="AGENT READINESS" tone="green">
          <LoadoutCheck />
        </Terminal>
        <p className="ms-source">依六度空間官網說明整理，現場以教練說明為準。</p>
      </div>
    </section>
  </div>;
}

function SectionHead({ no, en, id, title, lead, aside }: { no: string; en: string; id: string; title: ReactNode; lead?: ReactNode; aside?: ReactNode }) {
  return <header className="ms-head">
    <div className="ms-head-copy">
      <p className="ms-eyebrow"><b>{no}</b><span>{en}</span></p>
      <h2 id={id} className="ms-title">{title}</h2>
      {lead && <p className="ms-lead">{lead}</p>}
    </div>
    {aside}
  </header>;
}

/** Google rating from the dated review snapshot, linking to the reviews themselves. */
function VenueRating({ id }: { id?: string }) {
  const { stores } = useOuting();
  const reviews = id ? stores[id]?.reviews : undefined;
  if (!reviews || !/^https:\/\/www\.google\.com\//.test(reviews.sourceUrl)) return null;
  return <a className="ms-rating" href={reviews.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={"Google 評分 " + reviews.rating.toFixed(1) + "，" + reviews.reviewCount + " 則評論（另開分頁）"}>
    <span className="ms-rating-star" aria-hidden="true">★</span><b>{reviews.rating.toFixed(1)}</b><span>Google・{reviews.reviewCount.toLocaleString("zh-TW")} 則評論</span><i aria-hidden="true">↗</i>
  </a>;
}

/** The closing card, and under it — easy to miss — the captains' training sim. */
export function MissionFooter({ plan, eventDate, title, onReplay }: { plan?: TripPlan; eventDate: string; title: string; onReplay: () => void }) {
  const [duel, setDuel] = useState(false);
  const duelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (duel) duelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [duel]);
  const meet = plan?.schedule[0];
  const address = meet?.description.replace(/，?自行前往。?$/, "") || "台北市中山區中山北路二段 185 號 B1";
  const start = /^\d{1,2}:\d{2}/.exec(meet?.time || "")?.[0].padStart(5, "0") || "12:00";
  const calendar = missionCalendarUrl({
    title: "秋遊特務｜" + title, eventDate, start, end: "16:30", location: "六度空間 LazerTreks，" + address,
    details: start + " 六度空間集合（自行前往）→ LazerTreks 雷射對戰 → 戰後飯店下午茶 Buffet。",
  });
  return <footer className="ms-footer">
    <img className="ms-footer-art" src={MISSION_IMAGES.squad} width={1920} height={1081} loading="lazy" decoding="async" alt="" />
    <i className="ms-footer-scrim" aria-hidden="true" />
    <div className="wrap ms-footer-inner">
      <p className="ms-footer-kicker"><span>SEE YOU ON</span><b>{eventDate.slice(5).replace("-", ".")}</b></p>
      <TitleMark className="ms-footer-mark" sub="AUTUMN AGENTS" />
      <h2 className="ms-footer-title">全員出動</h2>
      <div className="ms-footer-actions">
        <a className="ms-cta" href={calendar} target="_blank" rel="noopener noreferrer">加入 Google 日曆<span className="sr-only">（另開分頁）</span></a>
        <button type="button" className="ms-ghost" onClick={onReplay}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>重播預告
        </button>
      </div>
      <p className="ms-footer-meta">{title}・{start} 六度空間集合，自行前往</p>
      <p className="ms-footer-partners">馴錢師 <b>×</b> EGROUP</p>
    </div>
    <div className="wrap ms-secret">
      {duel
        ? <div ref={duelRef}><Terminal name="TRAINING_SIM // DUEL.EXE" status="CLASSIFIED" tone="red" className="ms-duel-term"><DuelSim onClose={() => setDuel(false)} /></Terminal>
            <button type="button" className="ms-secret-close" onClick={() => setDuel(false)}>結束模擬</button></div>
        : <button type="button" className="ms-secret-open" onClick={() => setDuel(true)} aria-label="開啟隱藏的隊長決鬥模擬">
            <span aria-hidden="true">&gt; run duel.exe</span><i aria-hidden="true" />
          </button>}
    </div>
  </footer>;
}
