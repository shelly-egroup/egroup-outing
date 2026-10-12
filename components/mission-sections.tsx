"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import TitleMark from "./title-mark";
import StoreLinks from "./store-links";
import DuelSim from "./duel-sim";
import MissionBriefing, { type BriefingAlarm } from "./mission-briefing";
import MissionProtocols from "./mission-protocols";
import MissionAccept from "./mission-accept";
import ReviewDeck, { useTopChoice } from "./review-deck";
import CaptainsFaceOff from "./captains-faceoff";
import ReconTargets from "./recon-targets";
import { useOuting } from "./outing-provider";
import { lazerTreksStore, choiceStore } from "@/lib/store-references";
import { sortedGroups, type TripPlan } from "@/lib/trips";
import { ARENA_FACTS, ARENA_TRANSIT, MISSION_IMAGES, MISSION_MODES, missionCalendarUrl, missionClock } from "@/lib/mission-brief";

const pad = (value: number) => String(value).padStart(2, "0");
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

/** A photo shown as a live surveillance feed: camera id, REC, a Taipei timestamp from the page clock, crosshair, scanlines.
 *  With `game`, the captains' shooting-gallery easter egg plays in it. */
function ReconFeed({ src, cam, label, alt, now, game = false }: { src: string; cam: string; label: string; alt: string; now: number; game?: boolean }) {
  const stamp = new Date(now + 8 * 3600000).toISOString();
  return <figure className="feed">
    <img src={src} width={1600} height={900} loading="lazy" decoding="async" alt={alt} />
    <span className="feed-hud" aria-hidden="true">
      <span className="feed-tl"><b>{cam}</b>{label}</span>
      <span className="feed-tr"><i />REC</span>
      <span className="feed-bl">{stamp.slice(0, 10).replaceAll("-", ".")} {stamp.slice(11, 19)}</span>
      {!game && <span className="feed-br">ZOOM 1.0×</span>}
      <span className="feed-cross" />
    </span>
    {game && <ReconTargets />}
  </figure>;
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


/** Below the key visual, only the trip itself, on the IMF console: the day's log, the arena recon, the tea extraction, the
 *  protocols, and accepting the mission. */
export default function MissionSections({ plan, planId, eventDate, now }: { plan?: TripPlan; planId?: string; eventDate: string; now: number }) {
  const { stores } = useOuting();
  const [alarm, setAlarm] = useState<BriefingAlarm>({ armed: false, seconds: 5 });
  const schedule = plan?.schedule || [];
  const meet = schedule[0];
  const teaStop = schedule.find(stop => stop.title.includes("下午茶"));
  const address = meet?.description.replace(/，?自行前往。?$/, "") || "台北市中山區中山北路二段 185 號 B1";
  const date = eventDate.slice(5).replace("-", ".");
  const teaGroup = plan ? sortedGroups(plan).find(([, group]) => group.label.includes("下午茶")) : undefined;
  const top = useTopChoice(planId, teaGroup?.[0]);
  // the hotel(s) with the most votes — normally one; on a tie, each of them
  const hotels = top.status === "ready" && teaGroup ? top.choiceIds.flatMap(choiceId => {
    const choice = teaGroup[1].choices[choiceId]; if (!choice) return [];
    const storeId = choice.store?.id || choiceStore(choice.label)?.id, [name, venue] = choice.label.split("｜");
    return [{ choiceId, name, venue, time: choice.description.split("｜")[0], storeId, store: (storeId && stores[storeId]?.info) || choiceStore(choice.label) }];
  }) : [];
  const hotel = hotels[0];
  const arenaStore = stores[lazerTreksStore.id]?.info || lazerTreksStore;
  const venue = { ...arenaStore, mapsQuery: "六度空間 LazerTreks " + address.replace(/\s/g, "") };
  return <div className="mission-sections">
    <section id="mission" className="ms-section ms-timeline" aria-labelledby="ms-mission-title">
      <div className="wrap">
        <SectionHead no="01" en="MISSION TIMELINE" id="ms-mission-title" title={<>{date} <em>任務流程</em></>}
          lead={plan?.description} aside={meet && <MissionCountdown eventDate={eventDate} start={meet.time} now={now} />} />
        <Terminal name="MISSION_TIMELINE.LOG" status={alarm.armed ? "SELF-DESTRUCT T-" + alarm.seconds : alarm.gone ? "MESSAGE DESTROYED" : "SECURE LINK"} tone={alarm.armed ? "red" : alarm.gone ? "amber" : "green"} className={alarm.armed ? "is-alarm" : ""}>
          <MissionBriefing lines={[["SECURE LINK", "OK"], ["AGENTS", "全體同仁"], ["MISSION FILE", "秋遊特務 / " + date], ["STATUS", "ACCEPTED"]]} onAlarm={setAlarm} />
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
            <ReconFeed src={MISSION_IMAGES.arena} cam="CAM-01" label="LAZERTREKS B1" alt="雷射迷宮裡的紅藍霓虹燈、碉堡與感應基地" now={now} game />
          </Terminal>
          <Terminal name="TARGET_INTEL.DAT" status="VERIFIED">
            <dl className="ms-facts">
              {ARENA_FACTS.map(fact => <div key={fact.label} className="ms-fact"><dt>{fact.label}</dt><dd>{fact.value}<small>{fact.note}</small></dd></div>)}
            </dl>
          </Terminal>
        </div>
        <Terminal name="TEAM_CAPTAINS.DB" status="2 MATCHES" className="ms-captains-term">
          <CaptainsFaceOff red={MISSION_IMAGES.captainRed} blue={MISSION_IMAGES.captainBlue} backdrop={MISSION_IMAGES.arena} smoke={MISSION_IMAGES.smoke} />
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
        <div className="ms-route-grid">
          <Terminal name="NAV_ROUTE.MAP" status="ROUTE LOCKED" tone="blue">
            <div className="ms-venue">
              <RouteMap address={address} />
              <div className="ms-venue-where">
                <span className="ms-label">集合地點</span>
                <strong>{address}</strong>
                <ul className="ms-transit">
                  {ARENA_TRANSIT.map(item => <li key={item.mode}><b>{item.mode}</b><span>{item.text}</span></li>)}
                </ul>
                <div className="ms-venue-links"><StoreLinks store={venue} /></div>
              </div>
            </div>
          </Terminal>
          <Terminal name="FIELD_REPORTS.DB // LAZERTREKS" status="GOOGLE REVIEWS" className="ms-reviews-term">
            <ReviewDeck id={lazerTreksStore.id} />
          </Terminal>
        </div>
      </div>
    </section>

    <section id="tea" className="ms-section ms-tea" aria-labelledby="ms-tea-title">
      <div className="wrap">
        <SectionHead no="03" en="AFTER ACTION" id="ms-tea-title" title={<>戰後補給 <em>飯店下午茶 Buffet</em></>} lead={hotel ? "雷射槍戰結束後，移動到飯店享用平日下午茶 Buffet。" : teaStop?.description} />
        <div className="ms-tea-grid">
          <Terminal name="EXTRACTION // CAM-02" status={hotel ? "LOCKED" : "STANDBY"} tone="amber">
            <ReconFeed src={MISSION_IMAGES.tea} cam="CAM-02" label={hotel ? (hotel.name || "").toUpperCase() : "AFTERNOON TEA"} alt="飯店下午茶的三層點心架與紅茶" now={now} />
          </Terminal>
          <Terminal name="EXTRACTION_POINT.DAT" status={top.status === "ready" ? "最高票" : top.status === "loading" ? "LOADING" : "STANDBY"}>
            {top.status === "loading" ? <p className="ms-term-note">讀取最高票的飯店…</p>
              : hotel ? <div className="ms-hotels">{hotels.map(item => <div key={item.choiceId} className="ms-hotel">
                <span className="ms-label">EXTRACTION POINT・{hotels.length > 1 ? "同票最高" : "最高票"}</span>
                <strong className="ms-hotel-name">{item.name}{item.venue && <small>{item.venue}</small>}</strong>
                {item.time && <p className="ms-hotel-time">{item.time}・平日下午茶 Buffet</p>}
                {item.store && <div className="ms-venue-links"><StoreLinks store={item.store} /></div>}
              </div>)}</div>
              : <p className="ms-term-note">{teaStop?.description || "飯店確認後公布。"}</p>}
          </Terminal>
        </div>
        {hotels.map(item => item.storeId && <Terminal key={item.choiceId} name={"FIELD_REPORTS.DB // " + item.name} status="GOOGLE REVIEWS" className="ms-reviews-term">
          <ReviewDeck id={item.storeId} />
        </Terminal>)}
      </div>
    </section>

    <section id="manual" className="ms-section ms-manual" aria-labelledby="ms-manual-title">
      <div className="wrap">
        <SectionHead no="04" en="FIELD MANUAL" id="ms-manual-title" title={<>行前須知 <em>特務守則五條</em></>} />
        <MissionProtocols />
        <p className="ms-source">依六度空間官網說明整理，現場以教練說明為準。</p>
      </div>
    </section>

    <section id="accept" className="ms-section ms-accept" aria-labelledby="ms-accept-title">
      <div className="wrap">
        <SectionHead no="05" en="ACCEPT THE MISSION" id="ms-accept-title" title={<>接受任務 <em>登記備註與家眷</em></>} />
        <Terminal name="MISSION_ACCEPTANCE.EXE" status="AWAITING AGENTS" tone="red" className="ms-accept-term">
          <MissionAccept />
        </Terminal>
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


/** The closing card, and at the very bottom the captains' training sim — a laser duel anyone can play. */
export function MissionFooter({ plan, eventDate, title, onReplay }: { plan?: TripPlan; eventDate: string; title: string; onReplay: () => void }) {
  const meet = plan?.schedule[0];
  const address = meet?.description.replace(/，?自行前往。?$/, "") || "台北市中山區中山北路二段 185 號 B1";
  const start = /^\d{1,2}:\d{2}/.exec(meet?.time || "")?.[0].padStart(5, "0") || "12:00";
  const calendar = missionCalendarUrl({
    title: "秋遊特務｜" + title, eventDate, start, end: "16:30", location: "六度空間 LazerTreks，" + address,
    details: start + " 六度空間集合（自行前往）→ LazerTreks 雷射對戰 → 戰後飯店下午茶 Buffet。",
  });
  const [markRef, markSeen] = useSeen<HTMLDivElement>();
  return <footer className="ms-footer">
    <img className="ms-footer-art" src={MISSION_IMAGES.squad} width={1920} height={1081} loading="lazy" decoding="async" alt="" />
    <i className="ms-footer-scrim" aria-hidden="true" />
    <div className="wrap ms-footer-inner">
      <p className="ms-footer-kicker"><span>SEE YOU ON</span><b>{eventDate.slice(5).replace("-", ".")}</b></p>
      <div ref={markRef} className="ms-footer-markbox"><TitleMark className="ms-footer-mark" sub="AUTUMN AGENTS" motion="cut" play={markSeen} /></div>
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
    <section id="duel" className="wrap ms-sim" aria-labelledby="ms-sim-title">
      <p className="ms-eyebrow"><b>06</b><span>TRAINING SIM</span></p>
      <h2 id="ms-sim-title" className="ms-sim-title">隊長對決<em>先練手感，10.29 再上真的戰場</em></h2>
      <Terminal name="TRAINING_SIM // LASER_DUEL.EXE" status="READY" tone="red" className="ms-duel-term"><DuelSim /></Terminal>
    </section>
  </footer>;
}
