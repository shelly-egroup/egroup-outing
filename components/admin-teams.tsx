"use client";
import { useEffect, useState } from "react";
import { Avatar } from "./account-menu";
import LoadingIndicator from "./loading-indicator";
import { useOuting } from "./outing-provider";
import { assignTeams, TEAM_LABEL, TEAMS, teamCounts, type Team, type TeamMap } from "@/lib/teams";
import { familyCount } from "@/lib/vote-summary";
import type { PublicVote, VoteDetails } from "@/lib/trips";

/** The team draft: everyone who has accepted the mission, picked by hand or drawn at random into red and blue. */
export default function AdminTeams({ votes, details, ready }: { votes: Record<string, PublicVote>; details: Record<string, VoteDetails>; ready: boolean }) {
  const { teams, teamsReady, saveTeams, connected } = useOuting();
  const [draft, setDraft] = useState<TeamMap>({}), [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(""), [failed, setFailed] = useState("");
  useEffect(() => { if (!dirty) setDraft(teams); }, [teams, dirty]);
  const people = Object.entries(votes).sort(([, a], [, b]) => (a.displayName || "").localeCompare(b.displayName || "", "zh-Hant"));
  const uids = people.map(([uid]) => uid), counts = teamCounts(uids, draft);
  const guests = (team: Team) => people.filter(([uid]) => draft[uid] === team).reduce((sum, [uid]) => sum + (familyCount(details[uid]) || 0), 0);
  const change = (next: TeamMap) => { setDraft(next); setDirty(true); setMessage(""); setFailed(""); };
  const pick = (uid: string, team: Team) => { const next = { ...draft }; if (next[uid] === team) delete next[uid]; else next[uid] = team; change(next); };
  async function save() {
    setSaving(true); setFailed("");
    try { await saveTeams(draft); setDirty(false); setMessage("分隊已儲存，首頁的特務名單同步更新。"); }
    catch (error) { setFailed(error instanceof Error ? error.message : "分隊沒有儲存，請稍後再試。"); }
    finally { setSaving(false); }
  }
  if (!ready || !teamsReady) return <section className="admin-teams"><LoadingIndicator label="讀取名單" /></section>;
  return <section className="admin-teams">
    <div className="admin-teams-head">
      <div>
        <h2>分隊</h2>
        <p className="quiet">已接受任務的同事（包含先前投過票的人）都在這裡。可以先指定特定的人，再「隨機分配其餘的人」；兩隊人數會盡量平均。儲存後首頁的特務名單依隊伍顯示，本人登入也會看到自己的隊伍。</p>
      </div>
      <div className="admin-teams-tools">
        <button type="button" className="button button-white" disabled={saving || !uids.length} onClick={() => change(assignTeams(uids, draft, { keep: true }))}>隨機分配其餘的人</button>
        <button type="button" className="button button-white" disabled={saving || !uids.length} onClick={() => change(assignTeams(uids, draft, { keep: false }))}>全部重新抽籤</button>
        <button type="button" className="button button-white" disabled={saving || !Object.keys(draft).length} onClick={() => change({})}>清空</button>
        <button type="button" className="button button-dark" disabled={!dirty || saving || !connected} onClick={save}>{saving ? <LoadingIndicator label="儲存中" compact /> : "儲存分隊"}</button>
      </div>
    </div>
    <p className="admin-teams-count">
      {TEAMS.map(team => <b key={team} data-team={team}>{TEAM_LABEL[team]} {counts[team]} 人{guests(team) > 0 && <small>＋家眷 {guests(team)}</small>}</b>)}
      <span>未分隊 {counts.open} 人</span>
      {dirty && <em>有變更尚未儲存</em>}
    </p>
    {message && <p className="notice" role="status">{message}</p>}
    {failed && <p className="notice notice-error" role="alert">{failed}</p>}
    {!uids.length ? <p className="state-box">還沒有人接受任務。</p> : <ul className="admin-teams-list">
      {people.map(([uid, vote]) => {
        const guestsOf = familyCount(details[uid]) || 0, note = details[uid]?.note?.trim();
        return <li key={uid} data-team={draft[uid] || "open"}>
          <Avatar name={vote.displayName || "同事"} src={vote.photoURL} />
          <div className="admin-teams-who">
            <strong>{vote.displayName || "同事"}</strong>
            {(guestsOf > 0 || note) && <small>{guestsOf > 0 ? "帶 " + guestsOf + " 位家眷" : ""}{guestsOf > 0 && note ? "・" : ""}{note ? "備註：" + note : ""}</small>}
          </div>
          <div className="admin-teams-switch" role="group" aria-label={(vote.displayName || "同事") + " 的隊伍"}>
            {TEAMS.map(team => <button key={team} type="button" data-team={team} aria-pressed={draft[uid] === team} disabled={saving} onClick={() => pick(uid, team)}>{TEAM_LABEL[team]}</button>)}
          </div>
        </li>;
      })}
    </ul>}
  </section>;
}
