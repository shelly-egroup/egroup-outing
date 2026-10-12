"use client";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import TitleMark from "./title-mark";
import StoreLinks from "./store-links";
import DuelSim from "./duel-sim";
import MissionBriefing, { type BriefingAlarm } from "./mission-briefing";
import MissionProtocols from "./mission-protocols";
import MissionAccept from "./mission-accept";
import ReviewDeck, { useTopChoice } from "./review-deck";
import CaptainsFaceOff from "./captains-faceoff";
import TeamBoard, { useTeamBoardVisible } from "./team-board";
import ReconTargets from "./recon-targets";
import { useOuting } from "./outing-provider";
import { useInView } from "./use-in-view";
import { lazerTreksStore, choiceStore } from "@/lib/store-references";
import { sortedGroups, type TripPlan } from "@/lib/trips";
import { ARENA_FACTS, ARENA_TRANSIT, MISSION_IMAGES, MISSION_MODES, TEA_WINNER, missionCalendarUrl, missionClock } from "@/lib/mission-brief";

const pad = (value: number) => String(value).padStart(2, "0");
/** What each stop of the day is called on the IMF console, by its position in the schedule. */
const PHASES = ["RENDEZVOUS", "ENGAGE", "TRANSIT", "EXTRACT"];


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


/**
 * T-minus to the meet-up as a mission clock, ticking with the page clock: four cells whose digits roll in as they change,
 * blinking separators, the meet-up underneath. Under a day to go it turns red and pulses; once the day starts it says where
 * the mission stands.
 */
function MissionCountdown({ eventDate, start, now }: { eventDate: string; start: string; now: number }) {
  const clock = missionClock(eventDate, start, now);
  if (!clock) return null;
  const when = eventDate.slice(5).replace("-", ".") + " " + (/^\d{1,2}:\d{2}/.exec(start)?.[0] || "12:00");
  if (clock.state !== "counting") return <div className="ms-clock" data-state={clock.state}>
    <p className="ms-clock-head"><i aria-hidden="true" />{clock.state === "live" ? "MISSION LIVE・任務進行中" : "MISSION COMPLETE・任務完成"}</p>
  </div>;
  const cells: [string, string, string][] = [[pad(clock.days), "天", "DAYS"], [pad(clock.hours), "時", "HRS"], [pad(clock.minutes), "分", "MIN"], [pad(clock.seconds), "秒", "SEC"]];
  return <div className="ms-clock" data-state={clock.days < 1 ? "close" : "counting"} role="timer" aria-label={"距離集合還有 " + clock.days + " 天 " + clock.hours + " 小時 " + clock.minutes + " 分"}>
    <p className="ms-clock-head" aria-hidden="true"><i />T-MINUS<span>距離集合</span></p>
    <div className="ms-clock-cells" aria-hidden="true">
      {cells.map(([value, unit, en], i) => <Fragment key={en}>
        {i > 0 && <span className="ms-clock-sep">:</span>}
        <span className="ms-clock-cell" data-unit={en}>
          <span className="ms-clock-num">{[...value].map((digit, k) => <b key={k + digit}>{digit}</b>)}</span>
          <small>{unit}<em>{en}</em></small>
        </span>
      </Fragment>)}
    </div>
    <p className="ms-clock-foot" aria-hidden="true">{when}・六度空間 LAZERTREKS</p>
  </div>;
}

/** A photo shown as a live surveillance feed: camera id, REC, a Taipei timestamp from the page clock, scanlines.
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
    </span>
    {game && <ReconTargets />}
  </figure>;
}

/** The walk from the MRT, drawn as a route trace. */
function RouteMap({ address }: { address: string }) {
  const label = "捷運民權西路站 9 號出口步行約 8 分鐘到 " + address;
  return <>
    <WideRoute label={label} />
    {/* phones: the same walk, drawn taller so the words stay readable */}
    <svg className="route route-tall" viewBox="0 0 360 286" role="img" aria-label={label}>
      <defs><pattern id="route-grid-tall" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="currentColor" strokeOpacity=".08" /></pattern></defs>
      <rect width="360" height="286" fill="url(#route-grid-tall)" />
      <path className="route-road" d="M0 176H360" />
      <text className="route-road-name" x="180" y="206" textAnchor="middle">中山北路二段</text>
      <path className="route-path" d="M66 112C102 112 112 176 150 176H214C254 176 262 112 294 112" />
      <g className="route-mrt" transform="translate(48 112)"><circle r="20" /><text y="6" textAnchor="middle">M</text></g>
      <text className="route-label" x="18" y="42">捷運民權西路站</text>
      <text className="route-sub" x="18" y="66">9 號出口</text>
      <g className="route-target" transform="translate(310 112)"><circle r="22" /><circle r="9" /><path d="M0-33V-25M0 25V33M-33 0H-25M25 0H33" /></g>
      <text className="route-label" x="342" y="42" textAnchor="end">六度空間 B1</text>
      <text className="route-sub" x="342" y="66" textAnchor="end">185 號</text>
      <text className="route-eta" x="180" y="250" textAnchor="middle">步行約 8 分鐘</text>
    </svg>
  </>;
}

function WideRoute({ label }: { label: string }) {
  return <svg className="route route-wide" viewBox="0 0 640 200" role="img" aria-label={label}>
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


/** The fuse from the briefing to accepting the mission, as in Mission: Impossible's titles: a cord runs from the log's last
 *  prompt down into the accept section's number, and as the page scrolls a spark burns along it; when it arrives the accept
 *  console ignites. It only burns forward, and re-arms once it is below the screen again, to burn the next time down. With
 *  reduced motion the cord is simply there and the console already lit. */
function MissionFuse({ onLit }: { onLit: (lit: boolean) => void }) {
  const svg = useRef<SVGSVGElement>(null), cord = useRef<SVGPathElement>(null), ash = useRef<SVGPathElement>(null), spark = useRef<SVGGElement>(null);
  const [geo, setGeo] = useState<{ top: number; left: number; width: number; height: number; d: string } | null>(null);
  const lit = useRef(onLit); lit.current = onLit;
  // from the prompt under the log to the accept section's number, wherever the layout puts them
  useEffect(() => {
    const host = svg.current?.parentElement; if (!host) return;
    const measure = () => {
      const from = host.querySelector<HTMLElement>(".ms-handoff-prompt"), to = host.querySelector<HTMLElement>("#accept .ms-eyebrow b");
      if (!from || !to) return;
      const h = host.getBoundingClientRect(), a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      const x1 = a.left + a.width / 2 - h.left, y1 = a.bottom - h.top + 8, x2 = b.left + b.width / 2 - h.left, y2 = b.top - h.top - 10;
      const left = Math.min(x1, x2) - 48, width = Math.abs(x2 - x1) + 96, height = Math.max(40, y2 - y1), ax = x1 - left, bx = x2 - left;
      // a cord that hangs and swings a little on the way down
      const d = `M${ax.toFixed(1)} 0C${ax.toFixed(1)} ${(height * .3).toFixed(1)} ${(bx + 34).toFixed(1)} ${(height * .34).toFixed(1)} ${(bx + 16).toFixed(1)} ${(height * .58).toFixed(1)}S${bx.toFixed(1)} ${(height * .84).toFixed(1)} ${bx.toFixed(1)} ${height.toFixed(1)}`;
      setGeo(g => g && g.top === y1 && g.left === left && g.width === width && g.height === height ? g : { top: y1, left, width, height, d });
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(host);
    return () => ro.disconnect();
  }, []);
  // the burn follows the scroll: the spark sits where the cord crosses 62% of the window, eased, and never goes back
  useEffect(() => {
    const el = svg.current, path = cord.current; if (!geo || !el || !path) return;
    const draw = (p: number) => {
      path.style.strokeDashoffset = String(-p); ash.current?.style.setProperty("stroke-dasharray", p + " 2");
      const at = path.getPointAtLength(p * path.getTotalLength()); spark.current?.setAttribute("transform", `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.dataset.state = "still"; draw(0); lit.current(true); return; }
    let shown = Number(el.dataset.p || 0), frame = 0, done = shown >= 1;
    const tick = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      // scrolled back above the fuse: a fresh cord, ready to burn again
      if (r.top > window.innerHeight && (done || shown > 0)) { shown = 0; done = false; el.dataset.state = "idle"; el.dataset.p = "0"; draw(0); lit.current(false); return; }
      if (done) return;
      const target = Math.max(0, Math.min(1, (window.innerHeight * .62 - r.top) / r.height));
      if (target > shown) shown = Math.min(target, shown + Math.max(.004, (target - shown) * .16));
      if (shown >= .995) { shown = 1; done = true; el.dataset.state = "done"; lit.current(true); }
      else el.dataset.state = shown > 0 ? "burning" : "idle";
      el.dataset.p = String(shown); draw(shown);
      if (!done && target > shown) frame = requestAnimationFrame(tick);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(tick); };
    draw(shown); schedule();
    window.addEventListener("scroll", schedule, { passive: true }); window.addEventListener("resize", schedule);
    return () => { window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); cancelAnimationFrame(frame); };
  }, [geo]);
  return <svg ref={svg} className="ms-fuse" data-state="idle" aria-hidden="true" style={geo ? { top: geo.top, left: geo.left, width: geo.width, height: geo.height } : { display: "none" }} viewBox={geo ? `0 0 ${geo.width} ${geo.height}` : undefined}>
    <defs><radialGradient id="ms-fuse-glow"><stop offset="0" stopColor="#fff7e6" /><stop offset=".22" stopColor="#ffc86b" stopOpacity=".95" /><stop offset=".55" stopColor="#ff6a3d" stopOpacity=".35" /><stop offset="1" stopColor="#ff2a4a" stopOpacity="0" /></radialGradient></defs>
    {geo && <>
      <path ref={ash} className="ms-fuse-ash" d={geo.d} pathLength={1} />
      <path ref={cord} className="ms-fuse-cord" d={geo.d} pathLength={1} />
      <g ref={spark} className="ms-fuse-spark">
        <circle className="ms-fuse-halo" r="26" fill="url(#ms-fuse-glow)" />
        <g className="ms-fuse-rays"><path d="M0-12V-5M0 5V12M-12 0H-5M5 0H12M-8.5-8.5l4 4M4.5 4.5l4 4M-8.5 8.5l4-4M4.5-4.5l4-4" /></g>
        {[0, 1, 2, 3, 4, 5].map(i => <circle key={i} className="ms-fuse-ember" r="1.5" style={{ "--a": i * 60 + 15 + "deg", animationDelay: i * -.09 + "s" } as React.CSSProperties} />)}
        <circle r="2.8" fill="#fff" />
      </g>
    </>}
  </svg>;
}

/** Below the key visual, only the trip itself, on the IMF console: the day's log, which hands straight over to accepting the
 *  mission, then the arena recon, the tea extraction and the protocols. */
export default function MissionSections({ plan, planId, eventDate, now }: { plan?: TripPlan; planId?: string; eventDate: string; now: number }) {
  const { stores, user, votes, teamConfig, declines } = useOuting();
  const boardVisible = useTeamBoardVisible();
  // the briefing's status follows this agent: waiting for an answer, or accepted
  const accepted = !!(user && votes[user.uid]), dormant = !accepted && !!(user && declines[user.uid]);
  const [alarm, setAlarm] = useState<BriefingAlarm>({ armed: false, seconds: 5 }), [lit, setLit] = useState(false);
  const schedule = plan?.schedule || [];
  const meet = schedule[0];
  const teaStop = schedule.find(stop => stop.title.includes("下午茶"));
  const address = meet?.description.replace(/，?自行前往。?$/, "") || "台北市中山區中山北路二段 185 號 B1";
  const date = eventDate.slice(5).replace("-", ".");
  const teaGroup = plan ? sortedGroups(plan).find(([, group]) => group.label.includes("下午茶")) : undefined;
  const top = useTopChoice(planId, teaGroup?.[0]);
  // the hotel(s) with the most votes — normally one; on a tie, each of them
  // until the live tally answers (or if it cannot), the organisers' known winner stands in, so the hotel is always there
  const fallbackId = teaGroup ? Object.entries(teaGroup[1].choices).find(([, choice]) => choice.label.includes(TEA_WINNER))?.[0] : undefined;
  const topIds = top.status === "ready" ? top.choiceIds : fallbackId ? [fallbackId] : [];
  const hotels = teaGroup ? topIds.flatMap(choiceId => {
    const choice = teaGroup[1].choices[choiceId]; if (!choice) return [];
    const storeId = choice.store?.id || choiceStore(choice.label)?.id, [name, venue] = choice.label.split("｜");
    return [{ choiceId, name, venue, time: choice.description.split("｜")[0], storeId, store: (storeId && stores[storeId]?.info) || choiceStore(choice.label) }];
  }) : [];
  const hotel = hotels[0];
  // the log names the hotel the agents chose instead of the old "one of three"
  const stopNote = (stop: (typeof schedule)[number]) => stop === teaStop && hotel ? hotel.name + (hotel.venue ? "・" + hotel.venue : "") + "・平日下午茶 Buffet" : stop.description;
  const arenaStore = stores[lazerTreksStore.id]?.info || lazerTreksStore;
  const venue = { ...arenaStore, mapsQuery: "六度空間 LazerTreks " + address.replace(/\s/g, "") };
  return <div className="mission-sections">
    <section id="mission" className="ms-section ms-timeline" aria-labelledby="ms-mission-title">
      <div className="wrap">
        <SectionHead no="01" en="MISSION TIMELINE" id="ms-mission-title" title={<>{date} <em>任務流程</em></>}
          lead={plan?.description} aside={meet && <MissionCountdown eventDate={eventDate} start={meet.time} now={now} />} />
        <Terminal name="MISSION_TIMELINE.LOG" status={alarm.armed ? "SELF-DESTRUCT T-" + alarm.seconds : alarm.gone ? "MESSAGE DESTROYED" : "SECURE LINK"} tone={alarm.armed ? "red" : alarm.gone ? "amber" : "green"} className={alarm.armed ? "is-alarm" : ""}>
          <MissionBriefing lines={[["SECURE LINK", "OK"], ["AGENTS", "全體探員"], ["MISSION FILE", "秋遊特務 / " + date], accepted ? ["STATUS", "ACCEPTED・任務已接受", "ok"] : dormant ? ["STATUS", "DORMANT・另有要務", "off"] : ["STATUS", "等待特務接受", "wait"]]} onAlarm={setAlarm} />
          <ol className="ms-log">
            {schedule.map((stop, index) => <li key={index} className="ms-log-row">
              <span className="ms-log-node" aria-hidden="true"><i /></span>
              <time className="ms-log-time">{stop.time}</time>
              <span className="ms-log-code">{PHASES[index] || "STEP " + pad(index + 1)}</span>
              <div className="ms-log-copy"><h3>{stop.title}</h3>{stopNote(stop) && <p>{stopNote(stop)}</p>}</div>
            </li>)}
          </ol>
          {!!plan?.tags?.length && <ul className="ms-tags" aria-label="行程特色">{plan.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}
          <a className="ms-handoff" href="#accept" data-accepted={accepted}>
            <span className="ms-handoff-prompt" aria-hidden="true">&gt;</span>
            {accepted
              ? <span className="ms-handoff-copy"><small aria-hidden="true">MISSION ACCEPTED</small>你已接受任務——10.29 戰場見</span>
              : <span className="ms-handoff-copy"><small aria-hidden="true">YOUR MISSION, SHOULD YOU CHOOSE TO ACCEPT IT</small>你的任務，如果你選擇接受——</span>}
            <b className="ms-handoff-cta">{accepted ? "查看特務檔案" : "接受任務"}<svg aria-hidden="true" width="12" height="14" viewBox="0 0 12 14"><path d="M6 1v11M1 7.5 6 12.5l5-5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg></b>
          </a>
        </Terminal>
      </div>
    </section>

    <section id="accept" className="ms-section ms-accept" data-lit={lit} aria-labelledby="ms-accept-title">
      <div className="wrap">
        <SectionHead no="02" en="ACCEPT THE MISSION" id="ms-accept-title" title={<>接受任務 <em>登記備註與家眷</em></>} />
        <Terminal name="MISSION_ACCEPTANCE.EXE" status="AWAITING AGENTS" tone="red" className="ms-accept-term">
          <MissionAccept />
        </Terminal>
        {/* the teams, right under accepting: shown once the organisers publish them */}
        {boardVisible && <Terminal name="TEAM_DRAFT.EXE" status={teamConfig.picking ? "CAPTAINS PICKING" : "TEAMS"} tone="blue" className="ms-teams-term">
          <TeamBoard />
        </Terminal>}
      </div>
    </section>

    <section id="arena" className="ms-section ms-arena" aria-labelledby="ms-arena-title">
      <div className="wrap">
        <SectionHead no="03" en="THE ARENA" id="ms-arena-title" title={<>作戰場地 <em>六度空間 LazerTreks</em></>}
          lead="霓虹迷宮裡穿上感應背心、拿起雷射槍，分隊攻防、電腦即時計分；教練先教裝備，接著就是團隊對抗。" />
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
        <SectionHead no="04" en="AFTER ACTION" id="ms-tea-title" title={<>戰後補給 <em>飯店下午茶 Buffet</em></>} lead={hotel ? "雷射槍戰結束後，移動到飯店享用平日下午茶 Buffet。" : teaStop?.description} />
        <div className="ms-tea-grid">
          <Terminal name="EXTRACTION // CAM-02" status={hotel ? "LOCKED" : "STANDBY"} tone="amber">
            <ReconFeed src={MISSION_IMAGES.tea} cam="CAM-02" label={hotel ? (hotel.name || "").toUpperCase() : "AFTERNOON TEA"} alt="飯店下午茶的三層點心架與紅茶" now={now} />
          </Terminal>
          <Terminal name="EXTRACTION_POINT.DAT" status={hotel ? "最高票" : "STANDBY"}>
            {hotel ? <div className="ms-hotels">{hotels.map(item => <div key={item.choiceId} className="ms-hotel">
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
        <SectionHead no="05" en="FIELD MANUAL" id="ms-manual-title" title={<>行前須知 <em>特務守則五條</em></>} />
        <MissionProtocols />
        <p className="ms-source">依六度空間官網說明整理，現場以教練說明為準。</p>
      </div>
    </section>
    <MissionFuse onLit={setLit} />
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


/** The closing card over the two captains walking off into the arena, and at the very bottom their training sim — a laser
 *  duel anyone can play. */
export function MissionFooter({ plan, eventDate, title, onReplay }: { plan?: TripPlan; eventDate: string; title: string; onReplay: () => void }) {
  const meet = plan?.schedule[0];
  const address = meet?.description.replace(/，?自行前往。?$/, "") || "台北市中山區中山北路二段 185 號 B1";
  const start = /^\d{1,2}:\d{2}/.exec(meet?.time || "")?.[0].padStart(5, "0") || "12:00";
  const calendar = missionCalendarUrl({
    title: "秋遊特務｜" + title, eventDate, start, end: "16:30", location: "六度空間 LazerTreks，" + address,
    details: start + " 六度空間集合（自行前往）→ LazerTreks 雷射對戰 → 戰後飯店下午茶 Buffet。",
  });
  const [markRef, markSeen, markRound] = useInView<HTMLDivElement>("0px 0px -12% 0px");
  return <footer className="ms-footer">
    <div className="ms-footer-card">
    <img className="ms-footer-art" src={MISSION_IMAGES.walkout} width={1672} height={941} loading="lazy" decoding="async" alt="" />
    <i className="ms-footer-scrim" aria-hidden="true" />
    <div className="wrap ms-footer-inner">
      <p className="ms-footer-kicker"><span>SEE YOU ON</span><b>{eventDate.slice(5).replace("-", ".")}</b></p>
      <div ref={markRef} className="ms-footer-markbox"><TitleMark key={markRound} className="ms-footer-mark" sub="AUTUMN AGENTS" motion="intro" play={markSeen} /></div>
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
    </div>
    <section id="duel" className="wrap ms-sim" aria-labelledby="ms-sim-title">
      <p className="ms-eyebrow"><b>06</b><span>TRAINING SIM</span></p>
      <h2 id="ms-sim-title" className="ms-sim-title">隊長對決<em>先練手感，10.29 再上真的戰場</em></h2>
      <Terminal name="TRAINING_SIM // LASER_DUEL.EXE" status="READY" tone="red" className="ms-duel-term"><DuelSim /></Terminal>
    </section>
  </footer>;
}
