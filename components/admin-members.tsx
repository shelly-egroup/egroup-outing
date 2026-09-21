"use client";
import { useState } from "react";
import { ref, runTransaction, serverTimestamp } from "firebase/database";
import { getFirebase } from "@/lib/firebase";
import { getVotingAccess, isCompanyAccount, isVotingAllowed, normalizedEmail, votingAccessLabels, type RegisteredUser } from "@/lib/voting-access";
import type { Catalog, PublicVote } from "@/lib/trips";
import { useOuting } from "./outing-provider";
import { Avatar } from "./account-menu";
import LoadingPanel from "./loading-panel";
import LoadingIndicator from "./loading-indicator";

type Filter = "all" | "pending" | "eligible" | "unvoted" | "rejected";
function dateLabel(value: number) {
  return value ? new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(value) : "—";
}
export default function AdminMembers({ members, ready, error, votes, votesReady, catalog }: { members: Record<string, RegisteredUser>; ready: boolean; error: string; votes: Record<string, PublicVote>; votesReady: boolean; catalog: Catalog | null }) {
  const { isAdmin, user, connected } = useOuting();
  const [filter, setFilter] = useState<Filter>("all"), [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null), [failed, setFailed] = useState(""), [message, setMessage] = useState("");
  const entries = Object.entries(members).map(([uid, member]) => ({ ...member, uid, access: getVotingAccess(member.email, member.voteReview) }));
  const pending = entries.filter(member => member.access === "pending").length;
  const eligible = entries.filter(member => isVotingAllowed(member.access)).length;
  const voted = entries.filter(member => !!votes[member.uid]).length;
  const needsVote = (member: typeof entries[number]) => votesReady && isVotingAllowed(member.access) && !votes[member.uid];
  const unvoted = entries.filter(needsVote).length;
  const waitingForVotes = filter === "unvoted" && !votesReady;
  const query = search.trim().toLowerCase();
  const visible = entries.filter(member => (filter === "all" || (filter === "eligible" ? isVotingAllowed(member.access) : filter === "unvoted" ? needsVote(member) : member.access === filter)) && (!query || [member.displayName, member.email].some(value => (value || "").toLowerCase().includes(query))))
    .sort((a, b) => Number(b.access === "pending") - Number(a.access === "pending") || (b.createdAt || 0) - (a.createdAt || 0) || (a.email || "").localeCompare(b.email || ""));
  async function review(uid: string, status: "approved" | "rejected") {
    if (!isAdmin || !user || !ready || busy || !connected) return;
    const member = members[uid];
    if (!member || isCompanyAccount(member.email)) return;
    const email = normalizedEmail(member.email);
    setBusy(uid); setFailed(""); setMessage("");
    try {
      const result = await runTransaction(ref(getFirebase().database, "users/" + uid), current => {
        if (!current) return current;
        if (normalizedEmail(current.email) !== email || isCompanyAccount(current.email)) return;
        return { ...current, voteReview: { status, email, reviewedBy: user.uid, reviewedAt: serverTimestamp() } };
      }, { applyLocally: false });
      if (!result.committed || !result.snapshot.exists()) throw new Error("帳號資料已變更，請確認最新名單後再審核。");
      setMessage((member.displayName || member.email) + (status === "approved" ? " 已通過審核，可以投票。" : " 已標記為未通過。"));
    } catch (error) {
      setFailed(error instanceof Error && error.message.includes("帳號資料") ? error.message : "審核尚未儲存，請確認連線後再試。");
    } finally { setBusy(null); }
  }
  if (!ready) return error ? <p className="notice notice-error" role="alert">{error}</p> : <LoadingPanel label="正在整理帳號名單" description="已登入的隊友與審核狀態即將就緒。" />;
  return <section className="admin-members" aria-labelledby="members-title">
    <div className="organizer-overview-heading"><div><span className="eyebrow">THE GUEST LIST</span><h2 id="members-title">帳號與審核</h2><p>首次登入就會列入名單，還沒投票也看得到。公司帳號直接開放，其他帳號由主辦審核。</p></div></div>
    <div className="member-metrics">
      <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}><span>已註冊</span><strong>{entries.length}<small>人</small></strong></button>
      <button type="button" aria-pressed={filter === "pending"} onClick={() => setFilter("pending")}><span>待審核</span><strong>{pending}<small>人</small></strong></button>
      <button type="button" aria-pressed={filter === "eligible"} onClick={() => setFilter("eligible")}><span>可投票</span><strong>{eligible}<small>人</small></strong></button>
      <div><span>已投票</span><strong>{votesReady ? voted : "—"}<small>人</small></strong></div>
      <button type="button" className="member-unvoted" aria-pressed={filter === "unvoted"} disabled={!votesReady} onClick={() => setFilter("unvoted")}><span>可投票 · 未投票</span><strong>{votesReady ? unvoted : "—"}<small>人</small></strong></button>
    </div>
    <div className="member-toolbar"><label><span className="sr-only">搜尋帳號姓名或 Email</span><input type="search" placeholder="搜尋姓名或 Email" value={search} onChange={event => setSearch(event.target.value)} /></label><label><span className="sr-only">帳號狀態</span><select value={filter} onChange={event => setFilter(event.target.value as Filter)}><option value="all">全部帳號</option><option value="pending">待審核</option><option value="eligible">可投票</option><option value="unvoted" disabled={!votesReady}>可投票但尚未投票</option><option value="rejected">未通過</option></select></label><span>{waitingForVotes ? "同步中" : visible.length + " 位"}</span></div>
    {filter === "unvoted" && <p className="member-filter-note" role="status">只列出公司帳號或審核通過、且尚未送出投票的人。送出投票後會即時從這份名單移除。</p>}
    {waitingForVotes && <LoadingIndicator label="正在確認尚未投票名單" />}
    {(failed || error) && <p className="notice notice-error" role="alert">{failed || error}</p>}
    {message && <p className="notice" role="status">{message}</p>}
    {!connected && <p className="quiet">連線中斷，恢復連線後才能審核。</p>}
    <ul className="member-list">{visible.map(member => <li key={member.uid}>
      <div className="member-identity"><Avatar name={member.displayName || "同事"} src={member.photoURL || ""} /><div><strong>{member.displayName || "同事"}{member.role === "admin" && <small>主辦人</small>}</strong><a href={"mailto:" + member.email}>{member.email || "未提供 Email"}</a></div></div>
      <div className="member-meta"><span className={"member-status status-" + member.access}>{votingAccessLabels[member.access]}</span><small>{votesReady ? votes[member.uid] ? "已投 · " + (catalog?.plans[votes[member.uid].planId]?.shortName || "已選方案") : "尚未投票" : "投票同步中"}</small><small>註冊 {dateLabel(member.createdAt)}</small></div>
      <div className="member-actions">{member.access === "pending" ? <><button type="button" className="button button-white" disabled={!!busy || !connected} onClick={() => review(member.uid, "rejected")}>不通過</button><button type="button" className="button button-yellow" disabled={!!busy || !connected} onClick={() => review(member.uid, "approved")}>{busy === member.uid ? <LoadingIndicator label="儲存中" compact /> : "通過 ✓"}</button></> : member.access === "rejected" ? <button type="button" className="text-button" disabled={!!busy || !connected} onClick={() => review(member.uid, "approved")}>{busy === member.uid ? "儲存中…" : "改為通過"}</button> : <span>{member.access === "automatic" ? "自動開放投票" : "已開放投票"}</span>}</div>
    </li>)}</ul>
    {!waitingForVotes && !visible.length && <p className="member-empty">{query ? "找不到符合的帳號，試試其他姓名或 Email。" : filter === "pending" ? "目前沒有待審核的帳號。" : filter === "unvoted" ? "目前沒有可投票但尚未投票的帳號。" : "目前沒有符合的帳號。"}</p>}
  </section>;
}
