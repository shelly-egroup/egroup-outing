"use client";
import { useEffect, useRef, useState } from "react";
import { sortedPlans, type Catalog, type PublicVote } from "@/lib/trips";
import { choiceSourceVersion, type PublicChoiceSummary } from "@/lib/vote-summary";
import ChoiceRankings from "./choice-rankings";
import LoadingIndicator from "./loading-indicator";
export default function PublicChoiceResults({ catalog, votes, ready, connected, motionEnabled, votingOpen }: { votingOpen: boolean; catalog: Catalog; votes: Record<string, PublicVote>; ready: boolean; connected: boolean; motionEnabled: boolean }) {
  const [selectedId, setSelectedId] = useState("");
  const [active, setActive] = useState(false);
  const [data, setData] = useState<PublicChoiceSummary | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const container = useRef<HTMLElement>(null);
  const version = choiceSourceVersion(catalog, votes);
  useEffect(() => {
    if (!ready || !connected) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setError("");
    async function refresh(attempt = 0) {
      try {
        const response = await fetch("/api/choice-results", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unavailable");
        const result = await response.json() as PublicChoiceSummary;
        if (result.version !== version || !result.supporters || !result.arrangedSupporters) throw new Error("Snapshot changed");
        if (!controller.signal.aborted) setData(result);
      } catch {
        if (controller.signal.aborted) return;
        if (attempt < 3) timer = setTimeout(() => void refresh(attempt + 1), 700 * (attempt + 1));
        else setError("細項票數暫時無法同步。");
      }
    }
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [version, ready, connected, retry]);
  useEffect(() => {
    const node = container.current;
    if (!node || !motionEnabled) { setActive(false); return; }
    let visible = false;
    const sync = () => setActive(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: .05 });
    observer.observe(node);document.addEventListener("visibilitychange",sync);
    return () => { observer.disconnect();document.removeEventListener("visibilitychange",sync); };
  }, [motionEnabled]);
  const plans = sortedPlans(catalog).filter(([id, plan]) => plan.active || Object.values(votes).some(vote => vote.planId === id));
  const current = plans.find(([id]) => id === selectedId) || plans[0];
  const synced = ready && data?.version === version;
  return <section className="public-choice-results" ref={container} aria-label="餐廳與體驗人氣榜">
    <div className="preference-results-heading"><div><span className="eyebrow">NEXT ROUND / 細項人氣榜</span><h3>這一派，都想選什麼？</h3></div><p>餐廳看人氣，按摩與足湯各自選。</p></div>
    <div className="preference-plan-tabs" role="group" aria-label="查看哪一派的偏好">{plans.map(([id, plan]) => <button key={id} type="button" className={"preference-plan-tab score-" + plan.color} aria-pressed={current?.[0] === id} onClick={() => setSelectedId(id)}><b>{plan.code}</b><span>{plan.shortName}</span><small>{ready ? Object.values(votes).filter(vote => vote.planId === id).length + " 票" : "—"}</small></button>)}</div>
    {error ? <p className="battle-notice" role="status">{error} <button className="rank-retry" type="button" onClick={() => setRetry(n => n + 1)}>重新整理</button></p> : !synced ? <LoadingIndicator label={connected ? "正在統計各選項" : "等待連線恢復"} /> : current ? <div className={"preference-rankings-grid score-" + current[1].color}>
      {(data.plans[current[0]] || []).map(group => <ChoiceRankings key={current[0] + group.id} group={group} active={active} inviteToVote={votingOpen && current[1].active} supporters={data.supporters?.[current[0]]?.[group.id]} arrangedSupporters={data.arrangedSupporters?.[current[0]]?.[group.id]} />)}
      {!Object.keys(current[1].groups || {}).length && <p className="battle-notice">這一派沒有另外的選配項目。</p>}
    </div> : <p className="battle-notice">方案準備好後，就能在這裡看細項票數。</p>}
    <p className="preference-results-note">餐廳偏好供主辦參考；按摩與足湯依每個人的選擇安排。家眷不額外計票。</p>
  </section>;
}
