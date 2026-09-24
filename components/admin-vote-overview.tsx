"use client";
import { sortedGroups } from "@/lib/trips";
import { useRef, useState } from "react";
import type { Catalog, PublicVote, VoteDetails } from "@/lib/trips";
import { choiceSupporterLists, matchesRosterSearch, organizerSnapshot, organizerSummaryText } from "@/lib/vote-summary";
import ChoiceRankings from "./choice-rankings";
import LoadingPanel from "./loading-panel";
import { Avatar } from "./account-menu";
export default function AdminVoteOverview({ catalog, votes, details, emails, ready, error }: { catalog: Catalog; votes: Record<string, PublicVote>; details: Record<string, VoteDetails>; emails: Record<string, string | null>; ready: boolean; error: string }) {
  const [filter, setFilter] = useState<"all" | "notes" | "family" | "pending">("all");
  const [planFilter, setPlanFilter] = useState("");
  const [search, setSearch] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  async function copySummary() {
    try { await navigator.clipboard.writeText(organizerSummaryText(catalog, votes, details)); setCopyStatus("摘要已複製"); }
    catch { setCopyStatus("無法自動複製，請直接選取摘要文字。"); }
  }
  const tableRef = useRef<HTMLElement>(null);
  if (error) return <p className="notice notice-error" role="alert">{error}</p>;
  if (!ready) return <LoadingPanel label="正在整理主辦摘要" description="統計兩派戰況、選項偏好與同行安排。" />;
  const snapshot = organizerSnapshot(catalog, votes, details);
  const { supporters, arrangedSupporters } = choiceSupporterLists(catalog, votes, details);
  const effectiveFilter = filter === "pending" && !snapshot.incomplete ? "all" : filter;
  const high = Math.max(0, ...snapshot.plans.map(p => p.count));
  const leaders = snapshot.plans.filter(p => p.count === high && p.count > 0);
  const rows = snapshot.rows.filter(row => (!planFilter || row.vote.planId === planFilter)
    && (effectiveFilter === "all" || effectiveFilter === "notes" && row.hasNotes || effectiveFilter === "family" && (row.family || 0) > 0 || effectiveFilter === "pending" && !!row.pendingReason)
    && matchesRosterSearch(search, row.vote.displayName, emails[row.uid], row.detail?.note, row.detail?.familyNote));
  function focusNotes() { setFilter("notes"); setPlanFilter(""); setSearch(""); tableRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }
  return <div className="organizer-overview">
    <div className="organizer-overview-heading"><div><span className="eyebrow">THE BIG PICTURE</span><h2>秋遊，現在進行式</h2><p>{!snapshot.total ? "還沒有人投票，等大家加入對決。" : leaders.length === 1 ? leaders[0].plan.shortName + "暫時領先，細項偏好也幫你整理好了。" : "兩派勢均力敵，看看大家各自想選什麼。"}</p></div><div className="organizer-summary-actions"><span className="overview-date">{catalog.settings.eventDate}</span><button type="button" className="button button-white" onClick={copySummary}>複製摘要</button><small role="status">{copyStatus}</small></div></div>
    <div className="organizer-metrics">
      <div><span>已投票同事</span><strong>{snapshot.total}<small>／{catalog.settings.expectedVoters}</small></strong><p>預計還有 {Math.max(0,catalog.settings.expectedVoters - snapshot.total)} 人未投</p></div>
      <div><span>家眷同行</span><strong>{snapshot.guests}<small>位</small></strong><p>含同事，共 {snapshot.attendees} 人</p></div>
      <button type="button" onClick={focusNotes}><span>有備註的同事</span><strong>{snapshot.notes.length}<small>位</small></strong><p>點一下查看備註</p></button>
    </div>
    <p className="overview-count-note">票數以同事為單位；家眷另計。{snapshot.incomplete > 0 ? "同行合計暫依已填資料計算。" : "同行合計包含投票同事與家眷。"}</p>
    <div className="organizer-plan-summaries">{snapshot.plans.map(({ id, plan, count, guests, notes, groups }) => <section className="organizer-plan-summary" data-team-tone={plan.color} key={id}>
      <header><div><span className="eyebrow">{plan.code} · {plan.shortName}</span><h3>{plan.title}</h3></div><strong>{count}<small>票</small></strong></header>
      <div className="organizer-team-status"><b>{count && count === high ? leaders.length > 1 ? "並列領先" : "目前領先" : count ? "持續集氣中" : "等第一票"}</b><span>{snapshot.total ? Math.round(count / snapshot.total * 100) : 0}% 支持度</span><span>家眷 {guests} 位</span><span>{notes} 人有備註</span>{!plan.active && <span>已下架</span>}</div>
      <div className="organizer-group-rankings">{groups.map(group => <ChoiceRankings key={group.id} group={group} supporters={supporters[id]?.[group.id]} arrangedSupporters={arrangedSupporters[id]?.[group.id]} showNames />)}{!groups.length && <p className="quiet">這一派沒有另外的選配問題。</p>}</div>
    </section>)}</div>
    {snapshot.notes.length > 0 && <section className="organizer-note-board" aria-label="同事備註摘要"><div className="section-heading"><div><span className="eyebrow">DON’T MISS THESE</span><h2>這幾位有話想說</h2></div><button type="button" className="button button-white" onClick={focusNotes}>查看備註明細</button></div>
      <div className="organizer-note-grid">{snapshot.notes.map(row => <article key={row.uid} data-team-tone={row.plan?.color || "yellow"}>
        <header><Avatar name={row.vote.displayName} src={row.vote.photoURL} /><b>{row.vote.displayName}</b><span>{row.plan?.shortName || "原方案"}</span></header>
        {row.detail?.note?.trim() && <p><span>備註</span>{row.detail.note}</p>}
        {(row.family || 0) > 0 && row.detail?.familyNote?.trim() && <p><span>家眷 {row.family} 位</span>{row.detail.familyNote}</p>}
      </article>)}</div>
    </section>}
    <section className="organizer-roster" ref={tableRef} aria-label="投票明細"><div className="section-heading"><div><span className="eyebrow">THE CREW</span><h2>投票明細</h2></div><span className="quiet">符合條件 {rows.length} 人</span></div>
      <div className="organizer-filters"><div className="roster-filter-buttons" role="group" aria-label="明細篩選">{([ ["all","全部"],["notes","有備註"],["family","帶家眷"],["pending","待確認"] ] as const).filter(([value]) => value !== "pending" || snapshot.incomplete > 0).map(([value,label]) => <button type="button" key={value} aria-pressed={effectiveFilter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <label><span className="sr-only">篩選陣營</span><select value={planFilter} onChange={event => setPlanFilter(event.target.value)}><option value="">所有陣營</option>{snapshot.plans.map(p => <option value={p.id} key={p.id}>{p.plan.code} · {p.plan.shortName}</option>)}</select></label>
        <label><span className="sr-only">搜尋姓名、Email 或備註</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="姓名、Email 或備註" /></label>
      </div>
      <div className="table-scroll"><table className="organizer-roster-table"><thead><tr><th>同事</th><th>陣營</th><th>餐廳／體驗偏好</th><th>備註</th><th>同行安排</th></tr></thead><tbody>{rows.map(row => <tr key={row.uid}>
        <td><div className="roster-person"><Avatar name={row.vote.displayName} src={row.vote.photoURL} /><div><b>{row.vote.displayName}</b>{emails[row.uid] ? <a className="roster-email" title={emails[row.uid] || ""} href={"mailto:" + emails[row.uid]}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="2.5" y="4.5" width="15" height="11" rx="1"/><path d="m3 5 7 5 7-5"/></svg><span>{emails[row.uid]}</span></a> : <small className="roster-email">{emails[row.uid] === undefined ? "Email 讀取中…" : emails[row.uid] === null ? "Email 暫時無法讀取" : "未提供 Email"}</small>}</div></div></td>
        <td><span className="roster-team" data-team-tone={row.plan?.color || "yellow"}>{row.plan?.code || row.vote.planId} · {row.plan?.shortName || "已移除方案"}</span></td>
        <td>{!row.detail ? <span className="roster-pending">偏好尚未同步</span> : (row.plan ? sortedGroups(row.plan) : []).map(([id, group]) => <div className="roster-preference" key={id}><small>{group.label}</small><span>{row.detail!.preferences?.[id] ? group.choices[row.detail!.preferences![id]]?.label || "原選項已移除" : "請主辦安排"}</span></div>)}</td>
        <td className="private-note-text">{row.detail?.note?.trim() || "—"}</td>
        <td>{row.family === undefined ? <span className="roster-pending">{row.pendingReason}</span> : row.family > 0 ? <><b>＋{row.family} 位家眷</b><small>共 {row.family + 1} 人同行</small>{row.detail?.familyNote?.trim() && <p className="private-note-text">{row.detail.familyNote}</p>}</> : "自己參加"}</td>
      </tr>)}</tbody></table>{!rows.length && <p className="state-box">{snapshot.total ? "沒有符合條件的同事，試試其他篩選。" : "還沒有人投票。"}</p>}</div>
    </section>
  </div>;
}
