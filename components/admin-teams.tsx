"use client";
import { useEffect, useState } from "react";
import { Avatar } from "./account-menu";
import LoadingIndicator from "./loading-indicator";
import { useOuting } from "./outing-provider";
import { assignTeams, drawFirstPick, isEmail, normalEmail, otherTeam, TEAM_LABEL, TEAMS, teamCounts, withCaptains, type Captain, type Team, type TeamConfig, type TeamMap } from "@/lib/teams";
import { familyCount } from "@/lib/vote-summary";
import type { PublicVote, VoteDetails } from "@/lib/trips";

/** A switch that saves itself: the label, what it does, and on/off. */
function Toggle({ label, hint, on, disabled, onChange }: { label: string; hint: string; on: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return <label className="admin-teams-toggle" data-on={on} data-disabled={disabled || undefined}>
    <input type="checkbox" role="switch" checked={on} disabled={disabled} onChange={event => onChange(event.target.checked)} />
    <span className="admin-teams-toggle-track" aria-hidden="true"><i /></span>
    <span><strong>{label}</strong><small>{hint}</small></span>
  </label>;
}

/** One team's captain: who it is, whether they have signed in and accepted, and how to hand the role to someone else. */
function CaptainCard({ team, captain, rival, people, emails, accepted, saving, onChange }: {
  team: Team; captain: Captain; rival: Captain; people: [string, PublicVote][]; emails: Record<string, string | null>;
  accepted: boolean; saving: boolean; onChange: (captain: Captain) => void;
}) {
  const [choice, setChoice] = useState(""), [typed, setTyped] = useState(""), [problem, setProblem] = useState("");
  const vote = captain.uid ? people.find(([uid]) => uid === captain.uid)?.[1] : undefined;
  const name = captain.name || vote?.displayName || "", photo = captain.photoURL || vote?.photoURL || "";
  const status = !captain.uid ? "尚未登入，第一次登入時會自動成為隊長" : accepted ? "已登入・已接受任務" : "已登入，尚未接受任務";
  function choose(uid: string) {
    const vote = people.find(([id]) => id === uid)?.[1], email = normalEmail(emails[uid]);
    if (!vote) return;
    if (!email) { setProblem("讀不到這位的 Email，請改用下方輸入 Email。"); return; }
    if (uid === rival.uid || email === rival.email) { setProblem("這位已經是" + TEAM_LABEL[otherTeam(team)] + "隊長了。"); return; }
    setProblem(""); setChoice("");
    const next: Captain = { email, uid };
    if (vote.displayName) next.name = vote.displayName;
    if (vote.photoURL?.startsWith("https://")) next.photoURL = vote.photoURL;
    onChange(next);
  }
  function byEmail() {
    const email = normalEmail(typed);
    if (!isEmail(email)) { setProblem("請輸入完整的 Email，例如 egroup.xxx@gmail.com。"); return; }
    if (email === rival.email) { setProblem("這位已經是" + TEAM_LABEL[otherTeam(team)] + "隊長了。"); return; }
    // someone already signed in with this email: take their uid, name and photo now
    const known = people.find(([uid]) => normalEmail(emails[uid]) === email);
    setProblem(""); setTyped("");
    if (known) { choose(known[0]); return; }
    onChange({ email });
  }
  return <div className="admin-captain" data-team={team}>
    <p className="admin-captain-role">{TEAM_LABEL[team]}隊長</p>
    <div className="admin-captain-who">
      <Avatar name={name || captain.email} src={photo} />
      <div><strong>{name || captain.email.split("@")[0]}</strong><small>{captain.email}</small><em data-ok={!!captain.uid}>{status}</em></div>
    </div>
    <div className="admin-captain-change">
      <label><span>換成已接受任務的探員</span>
        <select value={choice} disabled={saving} onChange={event => { setChoice(event.target.value); if (event.target.value) choose(event.target.value); }}>
          <option value="">選擇探員…</option>
          {people.filter(([uid]) => uid !== captain.uid && uid !== rival.uid).map(([uid, vote]) => <option key={uid} value={uid}>{vote.displayName || "探員"}{emails[uid] ? "（" + emails[uid] + "）" : ""}</option>)}
        </select>
      </label>
      <form onSubmit={event => { event.preventDefault(); byEmail(); }}>
        <label><span>或輸入 Email（還沒登入的人也可以）</span><input type="email" inputMode="email" value={typed} disabled={saving} placeholder="egroup.xxx@gmail.com" onChange={event => setTyped(event.target.value)} /></label>
        <button type="submit" className="button button-white" disabled={saving || !typed.trim()}>設為隊長</button>
      </form>
      {problem && <p className="notice notice-error" role="alert">{problem}</p>}
    </div>
  </div>;
}

/**
 * The teams, in the back office: whether the front page shows them and whether the captains may pick their people there;
 * who the two captains are (by default egroup.james for red and egroup.ivy for blue, changeable here); and the team sheet
 * itself — everyone who has accepted, picked by hand or drawn at random, with the captains fixed to their teams.
 */
export default function AdminTeams({ votes, details, emails, ready }: { votes: Record<string, PublicVote>; details: Record<string, VoteDetails>; emails: Record<string, string | null>; ready: boolean }) {
  const { teams, teamsReady, saveTeams, teamConfig, teamConfigReady, saveTeamConfig, connected } = useOuting();
  const [draft, setDraft] = useState<TeamMap>({}), [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(""), [failed, setFailed] = useState("");
  const [configSaving, setConfigSaving] = useState(false), [configMessage, setConfigMessage] = useState(""), [configFailed, setConfigFailed] = useState("");
  useEffect(() => { if (!dirty) setDraft(teams); }, [teams, dirty]);
  const { captains } = teamConfig;
  const people = Object.entries(votes).sort(([, a], [, b]) => (a.displayName || "").localeCompare(b.displayName || "", "zh-Hant"));
  const uids = people.map(([uid]) => uid), fixed = withCaptains({}, captains), placed = withCaptains(draft, captains), counts = teamCounts(uids, placed);
  const captainTeam = (uid: string) => TEAMS.find(team => captains[team].uid === uid);
  const guests = (team: Team) => people.filter(([uid]) => placed[uid] === team).reduce((sum, [uid]) => sum + (familyCount(details[uid]) || 0), 0);
  const change = (next: TeamMap) => { setDraft(next); setDirty(true); setMessage(""); setFailed(""); };
  const pick = (uid: string, team: Team) => { if (captainTeam(uid)) return; const next = { ...draft }; if (next[uid] === team) delete next[uid]; else next[uid] = team; change(next); };
  async function save() {
    setSaving(true); setFailed("");
    try { await saveTeams(draft); setDirty(false); setMessage(teamConfig.published ? "分隊已儲存，首頁的特務名單同步更新。" : "分隊已儲存。首頁目前不顯示分隊，打開「前台顯示分隊」後才會公布。"); }
    catch (error) { setFailed(error instanceof Error ? error.message : "分隊沒有儲存，請稍後再試。"); }
    finally { setSaving(false); }
  }
  async function saveConfig(next: TeamConfig, done: string) {
    setConfigSaving(true); setConfigFailed(""); setConfigMessage("");
    try { await saveTeamConfig(next); setConfigMessage(done); }
    catch (error) { setConfigFailed(error instanceof Error ? error.message : "設定沒有儲存，請稍後再試。"); }
    finally { setConfigSaving(false); }
  }
  if (!ready || !teamsReady || !teamConfigReady) return <section className="admin-teams"><LoadingIndicator label="讀取名單" /></section>;
  return <section className="admin-teams">
    <div className="admin-teams-head">
      <div>
        <h2>分隊</h2>
        <p className="quiet">分組預設不公開：先在這裡設定隊長與隊伍，準備好再打開「前台顯示分隊」。分隊可以由主辦人手動指定、隨機分配，或打開「開放隊長選人」讓兩位隊長在首頁的接受任務區選人（可設定是否輪流）；主辦人隨時可以在這裡調整。</p>
      </div>
    </div>

    <div className="admin-teams-config">
      <Toggle label="前台顯示分隊" hint={teamConfig.published ? "首頁名單依紅隊／藍隊顯示，隊長有標記，本人看得到自己的隊伍。" : "關閉中：首頁不顯示任何分隊資訊。"} on={teamConfig.published} disabled={configSaving || !connected}
        onChange={on => saveConfig({ ...teamConfig, published: on, picking: on && teamConfig.picking }, on ? "已公開分隊。" : "已關閉分隊顯示。")} />
      <Toggle label="開放隊長選人" hint={!teamConfig.published ? "需要先打開「前台顯示分隊」。" : teamConfig.picking ? "隊長登入首頁後，可以點未分隊的探員把他選進自己的隊。" : "關閉中：只有主辦人能分隊。"} on={teamConfig.picking} disabled={configSaving || !connected || !teamConfig.published}
        onChange={on => { const firstPick = on && teamConfig.turns && !teamConfig.firstPick ? drawFirstPick() : teamConfig.firstPick; saveConfig({ ...teamConfig, picking: on, firstPick }, on ? "已開放隊長選人。" + (firstPick && !teamConfig.firstPick ? "抽籤結果：" + TEAM_LABEL[firstPick] + "先選。" : "") : "已停止隊長選人。"); }} />
      <Toggle label="隊長輪流選" hint={!teamConfig.picking ? "開放隊長選人後才會用到。" : teamConfig.turns ? "兩隊輪流：從先選的隊伍開始，一隊選一個。" : "不輪流：兩位隊長隨時都可以選人。"} on={teamConfig.turns} disabled={configSaving || !connected || !teamConfig.picking}
        onChange={on => { const firstPick = on && !teamConfig.firstPick ? drawFirstPick() : teamConfig.firstPick; saveConfig({ ...teamConfig, turns: on, firstPick }, on ? "已改為兩隊輪流選。" : "已改為隨時都可以選。"); }} />
      {teamConfig.picking && teamConfig.turns && <div className="admin-teams-first">
        <span><strong>先選的隊伍</strong><small>{teamConfig.firstPick ? TEAM_LABEL[teamConfig.firstPick] + "先選，之後兩隊輪流。" : "還沒決定，預設紅隊先選。"}</small></span>
        <div className="admin-teams-switch" role="group" aria-label="先選的隊伍">
          {TEAMS.map(team => <button key={team} type="button" data-team={team} aria-pressed={teamConfig.firstPick === team} disabled={configSaving || !connected} onClick={() => saveConfig({ ...teamConfig, firstPick: team }, "已指定" + TEAM_LABEL[team] + "先選。")}>{TEAM_LABEL[team]}先選</button>)}
        </div>
        <button type="button" className="button button-white" disabled={configSaving || !connected} onClick={() => { const firstPick = drawFirstPick(); saveConfig({ ...teamConfig, firstPick }, "抽籤結果：" + TEAM_LABEL[firstPick] + "先選。"); }}>抽籤決定</button>
      </div>}
      {configMessage && <p className="notice" role="status">{configMessage}</p>}
      {configFailed && <p className="notice notice-error" role="alert">{configFailed}</p>}
    </div>

    <div className="admin-captains">
      {TEAMS.map(team => <CaptainCard key={team + captains[team].email} team={team} captain={captains[team]} rival={captains[otherTeam(team)]} people={people} emails={emails}
        accepted={!!captains[team].uid && !!votes[captains[team].uid as string]} saving={configSaving || !connected}
        onChange={next => saveConfig({ ...teamConfig, captains: { ...captains, [team]: next } }, TEAM_LABEL[team] + "隊長已更新。")} />)}
    </div>

    <div className="admin-teams-head admin-teams-sheet">
      <h3>隊伍名單</h3>
      <div className="admin-teams-tools">
        <button type="button" className="button button-white" disabled={saving || !uids.length} onClick={() => change(assignTeams(uids, draft, { keep: true, fixed }))}>隨機分配其餘的人</button>
        <button type="button" className="button button-white" disabled={saving || !uids.length} onClick={() => change(assignTeams(uids, draft, { keep: false, fixed }))}>全部重新抽籤</button>
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
        const guestsOf = familyCount(details[uid]) || 0, note = details[uid]?.note?.trim(), leads = captainTeam(uid);
        return <li key={uid} data-team={placed[uid] || "open"}>
          <Avatar name={vote.displayName || "探員"} src={vote.photoURL} />
          <div className="admin-teams-who">
            <strong>{vote.displayName || "探員"}{leads && <span className="admin-teams-captain" data-team={leads}>隊長</span>}</strong>
            {(guestsOf > 0 || note) && <small>{guestsOf > 0 ? "帶 " + guestsOf + " 位家眷" : ""}{guestsOf > 0 && note ? "・" : ""}{note ? "備註：" + note : ""}</small>}
          </div>
          <div className="admin-teams-switch" role="group" aria-label={(vote.displayName || "探員") + " 的隊伍"}>
            {TEAMS.map(team => <button key={team} type="button" data-team={team} aria-pressed={placed[uid] === team} disabled={saving || !!leads} title={leads ? "隊長固定在自己的隊上" : undefined} onClick={() => pick(uid, team)}>{TEAM_LABEL[team]}</button>)}
          </div>
        </li>;
      })}
    </ul>}
  </section>;
}
