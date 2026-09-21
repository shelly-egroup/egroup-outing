"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useOuting } from "./outing-provider";
import { Avatar } from "./account-menu";
import LoadingIndicator from "./loading-indicator";
import PublicChoiceResults from "./public-choice-results";
import { useScoreMotion } from "./use-score-motion";
import { isVotingOpen, sortedPlans, type Catalog, type PublicVote, type TripPlan } from "@/lib/trips";

function Supporters({ supporters, currentUid, name }: { supporters: [string, PublicVote][]; currentUid?: string; name: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  function showAll() { if (detailsRef.current) detailsRef.current.open = true; }
  return <>
    <div className="score-supporters">
      <span>{supporters.length ? "這一派的隊友" : "等你加入陣營"}</span>
      <div className="avatar-stack" aria-label={name + "投票同事"}>
        {supporters.slice(0, 8).map(([uid, vote]) => (
          <span key={uid} className="supporter-avatar" tabIndex={0} aria-label={vote.displayName + (uid === currentUid ? "（你）" : "")}>
            <Avatar name={vote.displayName} src={vote.photoURL} />
            <span className="avatar-tooltip" aria-hidden="true">{vote.displayName}{uid === currentUid ? "（你）" : ""}</span>
          </span>
        ))}
        {supporters.length > 8 && <button type="button" className="avatar-more" onClick={showAll} aria-label={"查看全部 " + supporters.length + " 位隊友"}>+{supporters.length - 8}</button>}
        {!supporters.length && <span className="empty-avatar" aria-hidden="true">?</span>}
      </div>
    </div>
    {supporters.length > 0 && <details ref={detailsRef} className="supporters">
      <summary>所有隊友 · {supporters.length}</summary>
      <ul>{supporters.map(([uid, vote]) => <li key={uid}><Avatar name={vote.displayName} src={vote.photoURL} /><span>{vote.displayName}{uid === currentUid ? "（你）" : ""}</span></li>)}</ul>
    </details>}
  </>;
}
function ScoreDigits({ value }: { value: number }) {
  return <>{String(value).padStart(2, "0").split("").map((digit, index) => <span className="score-digit" key={index + ":" + digit}>{digit}</span>)}</>;
}
function VoteTotal({ total, active, available, expected }: { total: number; active: boolean; available: boolean; expected: number }) {
  const motion = useScoreMotion(total, 0, active, available);
  return <div className="vote-total"><strong key={motion.revision} aria-hidden="true">{available ? <ScoreDigits value={motion.count} /> : "—"}</strong><span className="sr-only" aria-live="polite">{available ? total + " 人已投票" : "讀取總票數中"}</span><span aria-hidden="true">人已投票{expected > 0 && <small>預計 {expected} 人</small>}</span></div>;
}
function LiveScoreCard({ plan, index, supporters, total, available, loading, leading, tied, open, active, currentUid }: {
  plan: TripPlan; index: number; supporters: [string, PublicVote][]; total: number; available: boolean; loading: boolean; leading: boolean; tied: boolean; open: boolean; active: boolean; currentUid?: string;
}) {
  const count = supporters.length;
  const percent = total ? Math.round(count / total * 100) : 0;
  const motion = useScoreMotion(count, percent, active, available);
  return <article className={"score-card score-" + plan.color + (leading ? " is-leading" : "")}>
    <span className="score-aura" aria-hidden="true"><i className="score-rail-right" /><i className="score-rail-left" /></span>
    {available && active && <span key={motion.revision} className="score-hit" aria-hidden="true" />}
    <div className="score-team-meta"><span>PLAYER {String(index + 1).padStart(2, "0")} / {plan.code}</span><span className="leader-label">{!available ? "等待同步" : !plan.active ? "已下架" : leading ? (open ? "目前領先" : "最高票") : tied ? "平手" : "集氣中"}</span></div>
    <div className="score-title"><div><h3>{plan.shortName}</h3><p>{plan.title}</p></div>
      <span className={"score-count" + (loading ? " is-loading" : "")}>
        <span className="sr-only" aria-live="polite" aria-atomic="true">{plan.shortName} {available ? count + " 票" : "讀取中"}</span>
        <b key={motion.revision} aria-hidden="true">{available ? <ScoreDigits value={motion.count} /> : "—"}</b><small aria-hidden="true">票</small>
        {motion.delta !== 0 && active && <span key={"delta-" + motion.revision} className={"score-delta" + (motion.delta < 0 ? " is-minus" : "")} aria-hidden="true">{motion.delta > 0 ? "+" : ""}{motion.delta} 票</span>}
      </span>
    </div>
    <div className="score-track score-track-animated" role="progressbar" aria-label={plan.title + "得票比例"} aria-valuenow={available ? percent : undefined} aria-valuetext={available ? percent + "%" : "讀取中"} aria-valuemin={0} aria-valuemax={100}><span style={{ transform: "scaleX(" + (available ? motion.percent / 100 : 0) + ")" }} /></div>
    <div className="score-footer"><span>支持度</span><b aria-label={available ? percent + "%" : "讀取中"}>{available ? Math.round(motion.percent) + "%" : "—"}</b></div>
    {available ? <Supporters supporters={supporters} currentUid={currentUid} name={plan.shortName} /> : <div className={"score-supporters score-supporters-placeholder" + (loading ? " is-loading" : "")} aria-hidden="true"><span className="loading-tile loading-supporter-label" /><span className="loading-avatar-stack"><i className="loading-tile" /><i className="loading-tile" /><i className="loading-tile" /></span></div>}
  </article>;
}

export default function LiveResults({ catalog, motionEnabled = true }: { catalog: Catalog; motionEnabled?: boolean }) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [battleActive, setBattleActive] = useState(false);
  useEffect(() => {
    const board = boardRef.current;
    if (!motionEnabled || !board) { setBattleActive(false); return; }
    let entered = false;
    const sync = () => setBattleActive(entered && !document.hidden);
    const inset = Math.round(window.innerHeight * .08);
    const entrance = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { entered = true; sync(); }
    }, { threshold: .18, rootMargin: "-" + inset + "px 0px -" + inset + "px 0px" });
    const exit = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) { entered = false; sync(); }
    });
    entrance.observe(board);
    exit.observe(board);
    document.addEventListener("visibilitychange", sync);
    return () => {
      entrance.disconnect();
      exit.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [motionEnabled]);
  const { user, votes, votesReady, votesError, connected, now } = useOuting();
  const list = Object.entries(votes);
  const total = list.length;
  const teams = sortedPlans(catalog).filter(([id, plan]) => plan.active || list.some(([, vote]) => vote.planId === id));
  const counts = teams.map(([id]) => list.filter(([, vote]) => vote.planId === id).length);
  const high = Math.max(0, ...counts);
  const leaders = counts.filter(count => count === high).length;
  // Keep a readable minimum at 0–100 while the main split follows vote share.
  const leftShare = votesReady && total && teams.length === 2 ? Math.min(70, Math.max(30, counts[0] / total * 100)) : 50;
  const boardStyle = teams.length === 2 ? { "--left-weight": leftShare + "fr", "--right-weight": (100 - leftShare) + "fr" } as CSSProperties : undefined;
  const open = isVotingOpen(catalog, now);
  const available = votesReady && !votesError;
  const loading = !votesReady && !votesError;
  const stateLabel = votesError ? "連線異常" : !connected ? "重新連線中" : !votesReady ? "讀取戰況中" : open ? "即時連線中" : "投票已截止";
  const matchLabel = !available ? "等待戰況" : !total ? "誰先拿下第一票？" : leaders > 1 ? (open ? "勢均力敵，等你這一票" : "最終平手") : (open ? "對決進行中" : "最終戰況");
  return <section className={"live-section arcade-section" + (battleActive ? " battle-active" : "")} id="results" aria-labelledby="results-title" data-motion={battleActive ? "playing" : "paused"}>
    <div className="battle-fx" aria-hidden="true"><i className="battle-grid-flow" /><i className="battle-scan" /><i className="battle-pixel pixel-one" /><i className="battle-pixel pixel-two" /><i className="battle-pixel pixel-three" /></div>
    <div className="section-heading">
      <div><span className="eyebrow">LIVE BATTLE / 即時對決</span><h2 id="results-title">目前戰況</h2></div>
      <span className={"live-state " + (connected && available ? "is-live" : "is-waiting")}><i aria-hidden="true" />{stateLabel}</span>
    </div>
    <div className="battle-summary">
      <VoteTotal total={total} active={battleActive} available={available} expected={catalog.settings.expectedVoters} />
      <div className="battle-caption">{loading ? <LoadingIndicator label="正在同步最新戰況" compact /> : <b>{matchLabel}</b>}<p>免登入看戰況，登入就能加入對決。</p></div>
    </div>
    {votesError ? <p className="battle-notice" role="alert">{votesError}</p> : !connected && votesReady ? <div className="battle-notice"><LoadingIndicator label="重新連線中，先顯示上次戰況" compact /></div> : null}
    <div ref={boardRef} className={"results-grid" + (loading ? " is-loading" : "")} data-duel={teams.length === 2} style={boardStyle} aria-busy={loading}>
      {teams.length === 2 && <span className="score-versus" aria-hidden="true"><b>VS</b><i className="vs-streak vs-streak-left" /><i className="vs-streak vs-streak-right" /></span>}
      {teams.map(([id, plan], index) => {
        const supporters = list.filter(([, vote]) => vote.planId === id).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
        return <LiveScoreCard key={id} plan={plan} index={index} supporters={supporters} total={total}
          available={available} loading={loading} leading={available && high > 0 && leaders === 1 && supporters.length === high}
          tied={high > 0 && leaders > 1 && supporters.length === high} open={open} active={battleActive} currentUid={user?.uid} />;
      })}
    </div>
    <p className="battle-footnote">票數即時同步 · 每人一票 · 截止前可改票</p>
    <PublicChoiceResults catalog={catalog} votes={votes} ready={available} connected={connected} motionEnabled={motionEnabled} />
  </section>;
}
