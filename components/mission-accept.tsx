"use client";
import { useEffect, useState } from "react";
import LoadingIndicator from "./loading-indicator";
import { useOuting } from "./outing-provider";
import { initials, type PublicVote } from "@/lib/trips";
import { TEAM_LABEL, TEAMS, type Team } from "@/lib/teams";

function Face({ vote }: { vote: PublicVote }) {
  const [broken, setBroken] = useState(false);
  return <span className="agent-face" aria-hidden="true">
    {vote.photoURL && !broken ? <img src={vote.photoURL} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} /> : initials(vote.displayName || "特務")}
  </span>;
}

/** Everyone who has accepted the mission, by team once the organisers have drawn them. */
function AgentRoster({ me }: { me?: string }) {
  const { votes, votesReady, teams } = useOuting();
  const agents = Object.entries(votes).sort(([, a], [, b]) => (a.updatedAt || 0) - (b.updatedAt || 0));
  const drawn = agents.some(([uid]) => teams[uid]);
  const list = (rows: [string, PublicVote][]) => <ul className="roster-list">
    {rows.map(([uid, vote]) => <li key={uid} className={uid === me ? "is-me" : undefined}><Face vote={vote} /><span>{vote.displayName || "同事"}</span>{uid === me && <b>你</b>}</li>)}
  </ul>;
  return <div className="roster" aria-live="polite">
    <p className="roster-head"><span>AGENTS ON MISSION</span><b>{votesReady ? agents.length : "—"}</b><small>位特務已接受任務</small></p>
    {!votesReady ? <LoadingIndicator label="讀取特務名單" compact />
      : !agents.length ? <p className="roster-empty">還沒有人接受任務，第一位就是你。</p>
      : !drawn ? list(agents)
      : <div className="roster-teams">
          {TEAMS.map(team => { const rows = agents.filter(([uid]) => teams[uid] === team); return <div key={team} className="roster-team" data-team={team}>
            <p className="roster-team-name"><i />{TEAM_LABEL[team]}<span>{rows.length} 人</span></p>{list(rows)}
          </div>; })}
          {agents.some(([uid]) => !teams[uid]) && <div className="roster-team" data-team="open"><p className="roster-team-name"><i />待分隊<span>{agents.filter(([uid]) => !teams[uid]).length} 人</span></p>{list(agents.filter(([uid]) => !teams[uid]))}</div>}
        </div>}
  </div>;
}

/**
 * "Your mission, should you choose to accept it": sign in, add a note and family, accept. No vote any more — the trip is set;
 * this is how the people who never voted join, and how everyone keeps their note and family up to date.
 */
export default function MissionAccept() {
  const { user, authReady, profileReady, signingIn, votingAccess, canVote, votes, myDetails, detailsReady, connected, teams, login, logout, acceptMission } = useOuting();
  const mine = user ? votes[user.uid] : undefined;
  const [editing, setEditing] = useState(false), [saving, setSaving] = useState(false), [failed, setFailed] = useState(""), [justAccepted, setJustAccepted] = useState(false);
  const [note, setNote] = useState(""), [family, setFamily] = useState(false), [familyCount, setFamilyCount] = useState(1), [familyNote, setFamilyNote] = useState("");
  // the form opens on what was saved before
  useEffect(() => {
    if (!detailsReady) return;
    const count = myDetails?.familyCount || 0;
    setNote(myDetails?.note || ""); setFamily(count > 0); setFamilyCount(Math.max(1, count)); setFamilyNote(count > 0 ? myDetails?.familyNote || "" : "");
  }, [detailsReady, myDetails]);
  useEffect(() => { setEditing(false); setJustAccepted(false); setFailed(""); }, [user?.uid]);
  const countValid = !family || (Number.isSafeInteger(familyCount) && familyCount >= 1 && familyCount <= 20);
  const team: Team | undefined = user ? teams[user.uid] : undefined;
  async function accept(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !countValid) return;
    setSaving(true); setFailed("");
    try {
      await acceptMission({ note: note.trim(), bringingFamily: family, familyCount: family ? familyCount : 0, familyNote: family ? familyNote.trim() : "" });
      setEditing(false); setJustAccepted(true);
    } catch (error) { setFailed(error instanceof Error ? error.message : "任務登記沒有送出，請稍後再試一次。"); }
    finally { setSaving(false); }
  }

  let panel: React.ReactNode;
  if (!authReady || (user && (!profileReady || !detailsReady))) panel = <LoadingIndicator label="確認特務身分" />;
  else if (!user) panel = <div className="accept-call">
    <button type="button" className="accept-button" disabled={signingIn} onClick={login}>{signingIn ? <LoadingIndicator label="正在登入" compact /> : <><i aria-hidden="true" />接受任務</>}</button>
    <p className="accept-hint">用公司 Google 帳號（egroup. 開頭）登入，再補上備註與家眷。已經投過票的同事也可以進來更新。</p>
  </div>;
  else if (!canVote) panel = <div className="accept-denied" role="status">
    <span className="ms-label">{votingAccess === "rejected" ? "ACCESS DENIED" : "CLEARANCE PENDING"}</span>
    <strong>{votingAccess === "rejected" ? "這個帳號沒有通過審核" : "等待主辦人確認身分"}</strong>
    <p>{votingAccess === "rejected" ? "請聯絡主辦人，或改用 egroup. 開頭的 Google 帳號。" : "主辦人確認後，這裡會自動開放接受任務。"}</p>
    <button type="button" className="accept-link" onClick={login}>改用公司 Google 帳號 →</button>
  </div>;
  else if (mine && !editing) panel = <div className={"accept-done" + (justAccepted ? " is-new" : "")}>
    <span className="accept-stamp" aria-hidden="true">ACCEPTED</span>
    <p className="accept-agent"><Face vote={mine} /><span><small>AGENT</small><strong>{mine.displayName || user.displayName || "特務"}</strong></span></p>
    <dl className="accept-facts">
      <div><dt>隊伍</dt><dd data-team={team}>{team ? TEAM_LABEL[team] : "分隊公布後顯示在這裡"}</dd></div>
      <div><dt>同行</dt><dd>{myDetails?.familyCount ? "帶 " + myDetails.familyCount + " 位家眷" : "自己參加"}</dd></div>
      <div><dt>備註</dt><dd>{myDetails?.note?.trim() || "無"}</dd></div>
    </dl>
    <p className="accept-actions"><button type="button" className="accept-link" onClick={() => { setEditing(true); setJustAccepted(false); }}>修改備註或家眷</button><button type="button" className="accept-link is-quiet" onClick={logout}>登出</button></p>
  </div>;
  else panel = <form className="accept-form" onSubmit={accept}>
    <p className="accept-who">特務 <strong>{user.displayName || user.email}</strong>，請確認你的任務資料<button type="button" className="accept-link is-quiet" onClick={logout}>不是你？登出</button></p>
    <label className="accept-field">
      <span>注意事項（選填）<small>健康狀況、飲食需求都可以寫，只有你和主辦看得到。</small></span>
      <textarea rows={2} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} placeholder="例如：膝蓋舊傷、不吃牛" />
    </label>
    <fieldset className="accept-field">
      <legend>會帶家眷一起來嗎？</legend>
      <div className="accept-toggle" role="group">
        <button type="button" aria-pressed={!family} onClick={() => setFamily(false)}>自己參加</button>
        <button type="button" aria-pressed={family} onClick={() => setFamily(true)}>帶家眷一起</button>
      </div>
      {family && <div className="accept-family">
        <label className="accept-count">家眷人數<span>
          <button type="button" aria-label="減少一位" disabled={familyCount <= 1} onClick={() => setFamilyCount(n => Math.max(1, n - 1))}>−</button>
          <input type="number" inputMode="numeric" min={1} max={20} value={familyCount} aria-invalid={!countValid} onChange={event => setFamilyCount(Number(event.target.value) || 0)} />
          <button type="button" aria-label="增加一位" disabled={familyCount >= 20} onClick={() => setFamilyCount(n => Math.min(20, n + 1))}>＋</button>
        </span><small>不含你自己，共 {countValid ? familyCount + 1 : "?"} 人出發</small></label>
        <label className="accept-field"><span>家眷備註（選填）</span><textarea rows={2} maxLength={1000} value={familyNote} onChange={event => setFamilyNote(event.target.value)} placeholder="例如：小朋友 8 歲、需要兒童椅" /></label>
      </div>}
    </fieldset>
    {failed && <p className="accept-error" role="alert">{failed}</p>}
    <p className="accept-actions">
      <button type="submit" className="accept-button" disabled={saving || !connected || !countValid}>{saving ? <LoadingIndicator label="傳送中" compact /> : <><i aria-hidden="true" />{mine ? "更新任務資料" : "確認接受任務"}</>}</button>
      {mine && <button type="button" className="accept-link is-quiet" onClick={() => setEditing(false)}>取消</button>}
      {!connected && <small>連線恢復後才能送出。</small>}
    </p>
  </form>;

  return <div className="accept">
    <div className="accept-brief">
      <p className="accept-line">你的任務，<br />如果你選擇接受——</p>
      <p className="accept-sub">10.29 中午十二點，六度空間集合。登記注意事項與同行家眷，主辦會依名單分成紅藍兩隊。</p>
      {panel}
    </div>
    <AgentRoster me={user?.uid} />
  </div>;
}
