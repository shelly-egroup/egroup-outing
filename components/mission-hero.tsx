import type { RefObject } from "react";
import TitleMark from "./title-mark";
import { TRAILER_IMAGES } from "@/lib/opening-assets";
import type { TripPlan } from "@/lib/trips";

const WEEKDAYS = "日一二三四五六";

/** The trip as the site's key visual: the trailer's poster, the mission facts, and the way into the page. */
export default function MissionHero({ eventDate, plan, ready, cued, actionsRef, primaryRef, onReplay }: {
  eventDate: string;
  plan?: TripPlan;
  ready: boolean;
  cued: boolean;
  actionsRef: RefObject<HTMLDivElement | null>;
  primaryRef: RefObject<HTMLAnchorElement | null>;
  onReplay: () => void;
}) {
  const date = eventDate.slice(5).replace("-", ".");
  const weekday = WEEKDAYS[new Date(eventDate + "T12:00:00Z").getUTCDay()];
  const meet = plan?.schedule[0];
  const address = meet?.description.replace(/，?自行前往。?$/, "") || "台北市中山區中山北路二段 185 號 B1";
  return <header className="mission-hero" data-ready={ready}>
    <div className="mh-art">
      <img className="mh-art-img" src={TRAILER_IMAGES.keyArt} width={1600} height={900} fetchPriority="high"
        alt="兩位老闆背靠背舉著雷射槍，站在六度空間紅藍光的雷射迷宮裡" />
      <i className="mh-beam mh-beam-a" aria-hidden="true" /><i className="mh-beam mh-beam-b" aria-hidden="true" />
      <i className="mh-scrim" aria-hidden="true" />
      <span className="mh-frame" aria-hidden="true"><i /><i /><i /><i /></span>
    </div>
    <div className="mh-body">
      <p className="mh-kicker"><span className="mh-rec"><i />REC</span><span>MISSION {date}</span></p>
      <TitleMark className="mh-lockup" sub="AUTUMN AGENTS" motion="cut" play={ready} />
      <h1 className="mh-title">熱血對戰，<em>正式開打！</em></h1>
      <p className="mh-sub">{plan?.title.replaceAll("\n", "") || "雷射對戰＋下午茶"}</p>
      <dl className="mh-intel">
        <div><dt>集合</dt><dd>{date}（{weekday}）{meet?.time || "12:00"}</dd></div>
        <div><dt>地點</dt><dd>六度空間 LazerTreks<small>{address}</small></dd></div>
        <div><dt>戰後</dt><dd>飯店下午茶 Buffet</dd></div>
      </dl>
      <div className="mh-actions" ref={actionsRef}>
        <a ref={primaryRef} href="#accept" className={"mh-cta" + (cued ? " is-cued" : "")}>接受任務</a>
        <a href="#mission" className="mh-ghost">看任務流程</a>
        <button type="button" className="mh-replay" onClick={onReplay}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>
          重播預告
        </button>
      </div>
    </div>
  </header>;
}
