"use client";
import { useEffect, useState } from "react";
import { Avatar } from "./account-menu";
import LoadingIndicator from "./loading-indicator";
import { useOuting } from "./outing-provider";
import { assignTeams, drawFirstPick, isEmail, normalEmail, otherTeam, pickTurn, TEAM_LABEL, TEAMS, teamCounts, withCaptains, type Captain, type Team, type TeamConfig, type TeamMap } from "@/lib/teams";
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
 * The teams, in the back office, as three steps: the captains (by default egroup.james for red and egroup.ivy for blue,
 * changeable here); how the teams are made — by the organisers, or by the captains picking on the front page, in turn from a
 * first pick drawn by lot or named, or freely; going public; and, any time, live draws — one agent or everyone left — that
 * go straight onto the team sheet and play on the front page. A line on top says what the front page shows right now. The
 * team sheet below holds everyone who has accepted, picked by hand or drawn at random, the captains fixed to their teams.
 */
export default function AdminTeams({ votes, details, emails, ready }: { votes: Record<string, PublicVote>; details: Record<string, VoteDetails>; emails: Record<string, string | null>; ready: boolean }) {
  const { teams, teamsReady, saveTeams, teamConfig, teamConfigReady, saveTeamConfig, connected, drawAgent, drawEveryone } = useOuting();
  const [draft, setDraft] = useState<TeamMap>({}), [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(""), [failed, setFailed] = useState("");
  const [configSaving, setConfigSaving] = useState(false), [configMessage, setConfigMessage] = useState(""), [configFailed, setConfigFailed] = useState("");
  const [drawing, setDrawing] = useState(false), [confirmAll, setConfirmAll] = useState(false), [drawNote, setDrawNote] = useState(""), [drawFailed, setDrawFailed] = useState("");
  useEffect(() => { if (!dirty) setDraft(teams); }, [teams, dirty]);
  useEffect(() => { if (!confirmAll) return; const timer = setTimeout(() => setConfirmAll(false), 4000); return () => clearTimeout(timer); }, [confirmAll]);
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
  // the team on the clock, while the captains pick in turn: a live draw is made for them
  const onClock = teamConfig.picking && teamConfig.turns && counts.open ? pickTurn(uids, placed, captains, teamConfig.firstPick || "red") || undefined : undefined;
  async function liveDraw(all: boolean) {
    if (all && !confirmAll) { setConfirmAll(true); return; }
    setConfirmAll(false); setDrawing(true); setDrawNote(""); setDrawFailed("");
    try {
      if (all) { const placedNow = await drawEveryone(); setDrawNote(placedNow ? "剩下的 " + placedNow + " 人已隨機分進兩隊。" : "每個人都已經有隊伍了。"); }
      else { const next = await drawAgent(onClock); setDrawNote(next ? "抽中 " + (votes[next.uid]?.displayName || "探員") + "，編入" + TEAM_LABEL[next.team] + "。" : "每個人都已經有隊伍了。"); }
    } catch (error) { setDrawFailed(error instanceof Error ? error.message : "抽籤沒有完成，請稍後再試。"); }
    finally { setDrawing(false); }
  }
  async function saveConfig(next: TeamConfig, done: string) {
    setConfigSaving(true); setConfigFailed(""); setConfigMessage("");
    try { await saveTeamConfig(next); setConfigMessage(done); }
    catch (error) { setConfigFailed(error instanceof Error ? error.message : "設定沒有儲存，請稍後再試。"); }
    finally { setConfigSaving(false); }
  }
  const live = !teamConfig.published ? "不顯示分隊（探員看不到任何分隊資訊）" : !teamConfig.picking ? "顯示兩隊名單（主辦分隊）"
    : "隊長選人進行中・" + (teamConfig.turns ? "輪流，" + TEAM_LABEL[teamConfig.firstPick || "red"] + "先選" : "不輪流");
  if (!ready || !teamsReady || !teamConfigReady) return <section className="admin-teams"><LoadingIndicator label="讀取名單" /></section>;
  return <section className="admin-teams">
    <div className="admin-teams-head">
      <div>
        <h2>分隊</h2>
        <p className="quiet">三個步驟：設定隊長 → 選分隊方式 → 公開到首頁。公開前首頁看不到任何分隊資訊，可以先慢慢準備。</p>
      </div>
    </div>
    <p className="admin-teams-live" data-on={teamConfig.published}><i aria-hidden="true" /><span>首頁現在</span><strong>{live}</strong></p>
    {configMessage && <p className="notice" role="status">{configMessage}</p>}
    {configFailed && <p className="notice notice-error" role="alert">{configFailed}</p>}

    <ol className="admin-steps">
      <li className="admin-step">
        <span className="admin-step-no" aria-hidden="true">1</span>
        <div className="admin-step-body">
          <h3>隊長</h3>
          <p className="quiet">預設紅隊「紅不讓」是 egroup.james、藍隊「刀槍Blue」是 egroup.ivy。本人登入網站就自動就位，也可以在這裡換人。</p>
          <div className="admin-captains">
            {TEAMS.map(team => <CaptainCard key={team + captains[team].email} team={team} captain={captains[team]} rival={captains[otherTeam(team)]} people={people} emails={emails}
              accepted={!!captains[team].uid && !!votes[captains[team].uid as string]} saving={configSaving || !connected}
              onChange={next => saveConfig({ ...teamConfig, captains: { ...captains, [team]: next } }, TEAM_LABEL[team] + "隊長已更新。")} />)}
          </div>
        </div>
      </li>
      <li className="admin-step">
        <span className="admin-step-no" aria-hidden="true">2</span>
        <div className="admin-step-body">
          <h3>分隊方式</h3>
          <div className="admin-method" role="radiogroup" aria-label="分隊方式">
            <button type="button" role="radio" aria-checked={!teamConfig.picking} disabled={configSaving || !connected} onClick={() => teamConfig.picking && saveConfig({ ...teamConfig, picking: false }, "改為主辦分隊。")}>
              <strong>主辦分隊</strong><small>在下方「隊伍名單」手動指定，或隨機分配後儲存。</small>
            </button>
            <button type="button" role="radio" aria-checked={teamConfig.picking} disabled={configSaving || !connected} onClick={() => { if (teamConfig.picking) return; const firstPick = teamConfig.turns && !teamConfig.firstPick ? drawFirstPick() : teamConfig.firstPick; saveConfig({ ...teamConfig, picking: true, firstPick }, "改為隊長選人。" + (firstPick && !teamConfig.firstPick ? "抽籤結果：" + TEAM_LABEL[firstPick] + "先選。" : "")); }}>
              <strong>隊長選人</strong><small>兩位隊長在首頁「接受任務」下方的分隊面板挑人，主辦仍可在下方調整。</small>
            </button>
          </div>
          {teamConfig.picking && <div className="admin-method-options">
            <Toggle label="輪流選" hint={teamConfig.turns ? "兩隊輪流：從先選的隊伍開始，一隊選一個。" : "不輪流：兩位隊長隨時都可以選人。"} on={teamConfig.turns} disabled={configSaving || !connected}
              onChange={on => { const firstPick = on && !teamConfig.firstPick ? drawFirstPick() : teamConfig.firstPick; saveConfig({ ...teamConfig, turns: on, firstPick }, on ? "已改為兩隊輪流選。" : "已改為隨時都可以選。"); }} />
            {teamConfig.turns && <div className="admin-teams-first">
              <span><strong>誰先選</strong><small>{teamConfig.firstPick ? TEAM_LABEL[teamConfig.firstPick] + "先選，之後兩隊輪流；人數單數時也由" + TEAM_LABEL[teamConfig.firstPick] + "多選一位。" : "還沒決定。"}</small></span>
              <div className="admin-teams-switch" role="group" aria-label="先選的隊伍">
                {TEAMS.map(team => <button key={team} type="button" data-team={team} aria-pressed={teamConfig.firstPick === team} disabled={configSaving || !connected} onClick={() => saveConfig({ ...teamConfig, firstPick: team }, "已指定" + TEAM_LABEL[team] + "先選。")}>{TEAM_LABEL[team]}先選</button>)}
              </div>
              <button type="button" className="button button-white" disabled={configSaving || !connected} onClick={() => { const firstPick = drawFirstPick(); saveConfig({ ...teamConfig, firstPick }, "抽籤結果：" + TEAM_LABEL[firstPick] + "先選。"); }}>抽籤決定</button>
            </div>}
          </div>}
        </div>
      </li>
      <li className="admin-step">
        <span className="admin-step-no" aria-hidden="true">3</span>
        <div className="admin-step-body">
          <h3>公開到首頁</h3>
          <Toggle label="前台顯示分隊" hint={teamConfig.published ? (teamConfig.picking ? "首頁出現分隊面板，隊長登入後就能選人。" : "首頁出現分隊面板，顯示兩隊名單。") : "關閉中：首頁不顯示任何分隊資訊。"} on={teamConfig.published} disabled={configSaving || !connected}
            onChange={on => saveConfig({ ...teamConfig, published: on }, on ? "已公開到首頁。" : "已從首頁收回。")} />
        </div>
      </li>
      <li className="admin-step">
        <span className="admin-step-no" aria-hidden="true">4</span>
        <div className="admin-step-body">
          <h3>現場抽籤</h3>
          <p className="quiet">可選。結果直接寫進隊伍名單{teamConfig.published ? "，首頁分隊面板上的每個人同步看到抽籤動畫" : "；公開到首頁後，大家會在分隊面板上看到抽籤動畫"}。首頁的分隊面板上也有同樣的抽籤台，輪到的隊長也有。{onClock ? "現在輪到" + TEAM_LABEL[onClock] + "，抽一位會抽給" + TEAM_LABEL[onClock] + "。" : ""}</p>
          <div className="admin-draws">
            <button type="button" className="button button-dark" disabled={drawing || dirty || !connected || !counts.open} onClick={() => liveDraw(false)}>{onClock ? "幫" + TEAM_LABEL[onClock] + "抽一位" : "抽一位"}</button>
            <button type="button" className={"button " + (confirmAll ? "button-danger" : "button-white")} disabled={drawing || dirty || !connected || !counts.open} onClick={() => liveDraw(true)}>{confirmAll ? "再按一次確認" : "一鍵隨機分隊"}</button>
            <span>未分隊 {counts.open} 人</span>
          </div>
          {dirty && <p className="notice">下方隊伍名單有尚未儲存的變更，先儲存再抽籤。</p>}
          {drawNote && <p className="notice" role="status">{drawNote}</p>}
          {drawFailed && <p className="notice notice-error" role="alert">{drawFailed}</p>}
        </div>
      </li>
    </ol>

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
