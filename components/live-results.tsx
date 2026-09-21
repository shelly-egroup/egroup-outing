"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useOuting } from "./outing-provider";
import { Avatar } from "./account-menu";
import LoadingIndicator from "./loading-indicator";
import { isVotingOpen, sortedPlans, type Catalog, type PublicVote } from "@/lib/trips";

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
  const stateLabel = votesError ? "連線異常" : !connected ? "重新連線中" : !votesReady ? "讀取戰況中" : open ? "即時連線中" : "投票已截止";
  const matchLabel = !available ? "等待戰況" : !total ? "誰先拿下第一票？" : leaders > 1 ? (open ? "勢均力敵，等你這一票" : "最終平手") : (open ? "對決進行中" : "最終戰況");
  return <section className={"live-section arcade-section" + (battleActive ? " battle-active" : "")} id="results" aria-labelledby="results-title" data-motion={battleActive ? "playing" : "paused"}>
    <div className="battle-fx" aria-hidden="true"><i className="battle-grid-flow" /><i className="battle-scan" /><i className="battle-pixel pixel-one" /><i className="battle-pixel pixel-two" /><i className="battle-pixel pixel-three" /></div>
    <div className="section-heading">
      <div><span className="eyebrow">LIVE BATTLE / 即時對決</span><h2 id="results-title">目前戰況</h2></div>
      <span className={"live-state " + (connected && available ? "is-live" : "is-waiting")}><i aria-hidden="true" />{stateLabel}</span>
    </div>
    <div className="battle-summary">
      <div className="vote-total" aria-live="polite" aria-atomic="true"><strong key={available ? total : "loading"}>{available ? String(total).padStart(2, "0") : "—"}</strong><span>人已投票{catalog.settings.expectedVoters > 0 && <small>預計 {catalog.settings.expectedVoters} 人</small>}</span></div>
      <div className="battle-caption"><b>{matchLabel}</b><p>免登入看戰況，登入就能加入對決。</p></div>
    </div>
    {votesError ? <p className="battle-notice" role="alert">{votesError}</p> : !votesReady ? <div className="battle-notice"><LoadingIndicator label="正在同步最新票數" /></div> : !connected ? <div className="battle-notice"><LoadingIndicator label="重新連線中，先顯示上次戰況" compact /></div> : null}
    <div ref={boardRef} className="results-grid" data-duel={teams.length === 2} style={boardStyle}>
      {teams.length === 2 && <span className="score-versus" aria-hidden="true"><b>VS</b><i className="vs-streak vs-streak-left" /><i className="vs-streak vs-streak-right" /></span>}
      {teams.map(([id, plan], index) => {
        const supporters = list.filter(([, vote]) => vote.planId === id).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
        const percent = total ? Math.round(supporters.length / total * 100) : 0;
        const leading = available && high > 0 && leaders === 1 && supporters.length === high;
        return <article className={"score-card score-" + plan.color + (leading ? " is-leading" : "")} key={id}>
          <span className="score-aura" aria-hidden="true"><i className="score-rail-right" /><i className="score-rail-left" /></span>
          {available && <span key={supporters.length} className="score-hit" aria-hidden="true" />}
          <div className="score-team-meta"><span>PLAYER {String(index + 1).padStart(2, "0")} / {plan.code}</span><span className="leader-label">{!available ? "等待同步" : !plan.active ? "已下架" : leading ? (open ? "目前領先" : "最高票") : high > 0 && leaders > 1 && supporters.length === high ? "平手" : "集氣中"}</span></div>
          <div className="score-title"><div><h3>{plan.shortName}</h3><p>{plan.title}</p></div><span className="score-count"><b key={available ? supporters.length : "loading"}>{available ? String(supporters.length).padStart(2, "0") : "—"}</b><small>票</small></span></div>
          <div className="score-track" role="progressbar" aria-label={plan.title + "得票比例"} aria-valuenow={available ? percent : undefined} aria-valuetext={available ? percent + "%" : "讀取中"} aria-valuemin={0} aria-valuemax={100}><span style={{transform: "scaleX(" + (available ? percent / 100 : 0) + ")"}} /></div>
          <div className="score-footer"><span>支持度</span><b>{available ? percent + "%" : "—"}</b></div>
          {available && <Supporters supporters={supporters} currentUid={user?.uid} name={plan.shortName} />}
        </article>;
      })}
    </div>
    <p className="battle-footnote">票數即時同步 · 每人一票 · 截止前可改票</p>
  </section>;
}
