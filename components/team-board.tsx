"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Face, SAMPLE } from "./mission-accept";
import { useOuting } from "./outing-provider";
import { useInView } from "./use-in-view";
import { MARK_AGENT } from "@/lib/title-mark-paths";
import { captainOf, otherTeam, pickTurn, TEAM_LABEL, teamCounts, withCaptains, type Captain, type Team, type TeamConfig, type TeamMap } from "@/lib/teams";
import type { PublicVote } from "@/lib/trips";

const pad = (n: number) => String(n).padStart(2, "0");
type Board = { votes: Record<string, PublicVote>; teams: TeamMap; config: TeamConfig; me?: Team };

/* ── The local scenario demo (?teams=demo, development only): every situation the draft can be in, played on sample data ── */
const demoVotes = Object.fromEntries(SAMPLE.concat([["demo7", { planId: "B", displayName: "周探員", photoURL: "", updatedAt: 7 } as PublicVote], ["demo8", { planId: "B", displayName: "吳特務", photoURL: "", updatedAt: 8 } as PublicVote]]));
const demoCaptains = { red: { email: "egroup.james@gmail.com", uid: "demo0", name: "王特務" }, blue: { email: "egroup.ivy@gmail.com", uid: "demo2", name: "陳隊長" } };
const base: TeamConfig = { published: true, picking: true, turns: true, firstPick: "red", captains: demoCaptains };
type Scenario = { key: string; label: string; note: string; config: TeamConfig; teams: TeamMap; me?: Team; rival?: boolean };
const SCENARIOS: Scenario[] = [
  { key: "hidden", label: "尚未公開", note: "主辦還沒打開「前台顯示分隊」：首頁不會出現這個面板，探員的檔案寫「分隊公布後顯示」。（這裡為了示範才顯示）", config: { ...base, published: false, picking: false }, teams: {} },
  { key: "assigned", label: "主辦分好隊", note: "主辦在後台手動指定或隨機分配，並公開：大家看到兩隊名單，不能選人。", config: { ...base, picking: false }, teams: { demo1: "red", demo4: "red", demo6: "red", demo3: "blue", demo5: "blue", demo7: "blue", demo8: "red" } },
  { key: "my-turn", label: "輪到你選", note: "你是紅隊隊長、輪到紅隊：點一張探員卡鎖定，再按「確認選入」。選完換藍隊，藍隊隊長選完又換你（示範中藍隊會自動選）。", config: base, teams: { demo1: "red", demo3: "blue" }, me: "red", rival: true },
  { key: "their-turn", label: "輪到對方", note: "你是紅隊隊長，但現在輪到藍隊：卡片暫時不能點，藍隊選完就換你。", config: base, teams: { demo1: "red", demo3: "blue", demo4: "red" }, me: "red" },
  { key: "free", label: "不輪流", note: "主辦關掉「隊長輪流選」：兩位隊長隨時都可以選，不用等對方。", config: { ...base, turns: false }, teams: { demo1: "red" }, me: "blue" },
  { key: "spectator", label: "一般探員觀戰", note: "不是隊長：看得到即時的選人過程，被選走的卡片會飛進那一隊；自己的檔案會顯示隊伍。", config: base, teams: { demo1: "red", demo3: "blue", demo4: "red" }, rival: true },
  { key: "captain-away", label: "隊長還沒登入", note: "藍隊隊長還沒登入過：位子先放待命中的特務剪影，她第一次登入就自動就位。", config: { ...base, picking: false, captains: { red: demoCaptains.red, blue: { email: "egroup.ivy@gmail.com" } } }, teams: { demo1: "red" } },
  { key: "done", label: "選人完成", note: "每個人都有隊伍了：面板顯示「分隊完成」，雙方人數一樣（或差一人）。", config: base, teams: { demo1: "red", demo4: "red", demo6: "red", demo8: "red", demo3: "blue", demo5: "blue", demo7: "blue" } },
];

/** Captain not signed in yet: the agent from the mark stands in, waiting. */
function StandIn() {
  return <svg className="draft-standin" viewBox="176 19 38 64" aria-hidden="true"><path d={MARK_AGENT} /></svg>;
}

/**
 * The team draft, under the accept console once the organisers publish the teams. Staged like the captains' face-off: red
 * and blue on either side under their captains, the agents still to be placed as dossier cards in the middle, a scoreboard
 * and VS on top. When picking is open, a signed-in captain locks onto a card and confirms — in turn from the first pick if
 * the organisers want turns — and the card flies across on a laser into the next slot of their team; everyone watching sees
 * the same flight live. A captain can put back someone they took. With ?teams=demo (development only) a switcher plays
 * every scenario on sample data.
 */
export default function TeamBoard() {
  const outing = useOuting();
  const [scenario, setScenario] = useState<Scenario | null>(null), [demoTeams, setDemoTeams] = useState<TeamMap>({});
  const [armed, setArmed] = useState(""), [busy, setBusy] = useState(""), [problem, setProblem] = useState(""), [news, setNews] = useState("");
  const [ref, seen, round] = useInView<HTMLDivElement>("0px 0px -12% 0px");
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const key = new URLSearchParams(window.location.search).get("teams");
    if (key === "demo" || key === "draft") { setScenario(SCENARIOS[2]); setDemoTeams(SCENARIOS[2].teams); }
  }, []);
  const board: Board = scenario
    ? { votes: demoVotes, teams: demoTeams, config: scenario.config, me: scenario.me }
    : { votes: outing.votes, teams: outing.teams, config: outing.teamConfig, me: outing.user ? captainOf(outing.teamConfig.captains, outing.user.uid, outing.user.email) : undefined };
  const { votes, teams, config, me } = board, { captains, picking, turns } = config;
  const uids = Object.keys(votes), placed = withCaptains(teams, captains), counts = teamCounts(uids, placed);
  const isCaptain = (uid: string) => !!captainOf(captains, uid);
  const byName = (a: string, b: string) => (votes[a].displayName || "").localeCompare(votes[b].displayName || "", "zh-Hant");
  const members = (team: Team) => uids.filter(uid => placed[uid] === team && !isCaptain(uid)).sort(byName);
  const pool = uids.filter(uid => !placed[uid]).sort(byName);
  const turn = picking && turns && pool.length ? pickTurn(uids, placed, captains, config.firstPick || "red") : null;
  const mayPick = !!me && picking && pool.length > 0 && (!turns || turn === me);
  const target = Math.ceil(uids.length / 2);
  const codes = Object.fromEntries(Object.entries(votes).sort(([, a], [, b]) => (a.updatedAt || 0) - (b.updatedAt || 0)).map(([uid], i) => [uid, pad(i + 1)]));
  const name = (uid: string) => votes[uid]?.displayName || "探員";

  // the cards fly: remember where every card sits (relative to the board), and when one changes team, fly it from there
  const cards = useRef(new Map<string, HTMLElement>()), spots = useRef(new Map<string, { x: number; y: number }>()), last = useRef<TeamMap>({});
  const fx = useRef<HTMLDivElement>(null);
  const reg = (uid: string) => (el: HTMLElement | null) => { if (el) cards.current.set(uid, el); else cards.current.delete(uid); };
  useLayoutEffect(() => {
    const host = ref.current; if (!host) return;
    const box = host.getBoundingClientRect(), now = new Map<string, { x: number; y: number }>();
    cards.current.forEach((el, uid) => { const r = el.getBoundingClientRect(); now.set(uid, { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 }); });
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches, moved: string[] = [];
    for (const [uid, at] of now) {
      const from = spots.current.get(uid), was = last.current[uid];
      if (!from || was === placed[uid]) continue;
      moved.push(uid);
      const el = cards.current.get(uid); if (!el || still) continue;
      const team = placed[uid];
      el.animate([{ transform: `translate(${from.x - at.x}px, ${from.y - at.y}px) scale(1.08)`, filter: "brightness(2)" }, { transform: "none", filter: "none" }], { duration: 640, easing: "cubic-bezier(.2,.8,.2,1)" });
      el.classList.remove("is-landed"); void el.offsetWidth; el.classList.add("is-landed");
      // the laser it rides on
      const layer = fx.current;
      if (layer && team) {
        const trail = document.createElement("i"), dx = at.x - from.x, dy = at.y - from.y;
        trail.className = "draft-trail"; trail.dataset.team = team;
        Object.assign(trail.style, { left: from.x + "px", top: from.y + "px", width: Math.hypot(dx, dy) + "px", rotate: Math.atan2(dy, dx) + "rad" });
        layer.appendChild(trail);
        trail.animate([{ scale: "0 1", opacity: 1 }, { scale: "1 1", opacity: 1, offset: .45 }, { scale: "1 1", opacity: 0 }], { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)" }).finished.then(() => trail.remove(), () => trail.remove());
      }
    }
    if (moved.length) setNews(moved.map(uid => name(uid) + (placed[uid] ? " 加入" + TEAM_LABEL[placed[uid]] : " 回到待分隊")).join("，"));
    spots.current = now; last.current = placed;
  });

  // the demo's rival captain answers each pick after a beat
  useEffect(() => {
    if (!scenario?.rival || !turns || !turn || turn === me || !pool.length) return;
    const timer = setTimeout(() => setDemoTeams(t => ({ ...t, [pool[(Math.random() * pool.length) | 0]]: turn })), 1500);
    return () => clearTimeout(timer);
  }, [scenario, turn, me, turns, pool.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // a lock on a card lifts when the turn passes or the card is taken
  useEffect(() => { if (armed && (!mayPick || !pool.includes(armed))) setArmed(""); }, [armed, mayPick, pool]);

  async function act(uid: string, take: boolean) {
    setBusy(uid); setProblem(""); setArmed("");
    try {
      if (scenario) setDemoTeams(t => { const next = { ...t }; if (take && me) next[uid] = me; else delete next[uid]; return next; });
      else await (take ? outing.pickAgent(uid) : outing.releaseAgent(uid));
    } catch (error) { setProblem(error instanceof Error ? error.message : "沒有完成，請再試一次。"); }
    finally { setBusy(""); }
  }
  function play(next: Scenario) { setScenario(next); setDemoTeams(next.teams); setArmed(""); setProblem(""); spots.current = new Map(); last.current = {}; }

  const status = !picking ? (pool.length ? "隊伍由主辦安排中" : "分隊完成") : !pool.length ? "分隊完成" : !turns ? "隊長自由選人中" : TEAM_LABEL[turn || "red"] + "選人中";
  const guide = !me || !picking ? "" : !pool.length ? "你的隊伍已經到齊。" : mayPick ? "輪到你了：點一張探員卡鎖定，再按確認，把他編入" + TEAM_LABEL[me] + "。" : "等" + TEAM_LABEL[otherTeam(me)] + "隊長選完就換你。";
  const side = (team: Team) => {
    const captain: Captain = captains[team], cv = captain.uid ? votes[captain.uid] : undefined, list = members(team);
    const empty = pool.length ? Math.max(0, target - list.length - 1) : 0;
    return <section className="draft-side" data-team={team} data-active={turn === team || undefined} data-mine={me === team || undefined} aria-label={TEAM_LABEL[team]}>
      <div className="draft-captain">
        <div className="draft-captain-photo">{cv || captain.photoURL ? <Face vote={cv || { planId: "B", displayName: captain.name || "隊長", photoURL: captain.photoURL || "", updatedAt: 0 } as PublicVote} size="lg" /> : <StandIn />}</div>
        <p className="draft-captain-badge">{TEAM_LABEL[team]}隊長・CAPTAIN</p>
        <strong>{cv?.displayName || captain.name || captain.email.split("@")[0]}</strong>
        <small>{!captain.uid ? "待命中・登入後自動就位" : !cv ? "已就位・尚未接受任務" : me === team ? "這是你" : "已就位"}</small>
      </div>
      <ol className="draft-slots">
        {list.map((uid, i) => <li key={uid} ref={reg(uid)} className="draft-slot">
          <span className="draft-slot-no">{pad(i + 2)}</span><Face vote={votes[uid]} /><span className="draft-slot-name">{name(uid)}</span>
          {me === team && picking && <button type="button" className="draft-release" disabled={!!busy} onClick={() => act(uid, false)} aria-label={"把" + name(uid) + "放回待分隊"}>放回</button>}
        </li>)}
        {Array.from({ length: empty }, (_, i) => <li key={"empty" + i} className="draft-slot is-empty"><span className="draft-slot-no">{pad(list.length + i + 2)}</span><span className="draft-slot-name">待命</span></li>)}
      </ol>
    </section>;
  };

  return <div ref={ref} className="draft" data-seen={seen} data-picking={picking} data-me={me}>
    {scenario && <div className="draft-demo" role="group" aria-label="情境示範">
      <p><b>情境示範</b>只在本機預覽，不會寫入資料庫</p>
      <div className="draft-demo-tabs">{SCENARIOS.map((s, i) => <button key={s.key} type="button" aria-pressed={scenario.key === s.key} onClick={() => play(s)}><span>{i + 1}</span>{s.label}</button>)}</div>
      <p className="draft-demo-note">{scenario.note}</p>
    </div>}
    <div key={round} className="draft-stage" data-hidden={!config.published || undefined}>
      <i className="draft-bg" aria-hidden="true" />
      <div className="draft-head">
        <p className="draft-kicker"><i data-state={picking && pool.length ? "live" : "done"} />TEAM DRAFT<span>{status}</span></p>
        <div className="draft-score" aria-label={"紅隊 " + counts.red + " 人，藍隊 " + counts.blue + " 人"}>
          <span data-team="red"><b key={"r" + counts.red}>{pad(counts.red)}</b><small>紅隊</small></span>
          <span className="draft-vs" aria-hidden="true">VS</span>
          <span data-team="blue"><b key={"b" + counts.blue}>{pad(counts.blue)}</b><small>藍隊</small></span>
        </div>
        <div className="draft-tags">
          {picking && turns && config.firstPick && <span className="draft-coin" data-team={config.firstPick}><i aria-hidden="true" />抽籤結果・{TEAM_LABEL[config.firstPick]}先選</span>}
          {picking && !turns && <span className="draft-tag">不輪流・隊長隨時可選</span>}
          {!picking && <span className="draft-tag">主辦分隊</span>}
        </div>
      </div>
      <div className="draft-field">
        {side("red")}
        <section className="draft-pool" aria-label="待分隊">
          <p className="draft-pool-head"><span>待分隊</span><b>{pool.length}</b>
            {turn && <em className="draft-arrow" data-team={turn}>{turn === "red" ? "◀ " : ""}{TEAM_LABEL[turn]}選人中{turn === "blue" ? " ▶" : ""}</em>}
          </p>
          {guide && <p className="draft-guide" data-team={me} data-go={mayPick || undefined}>{guide}</p>}
          {pool.length ? <ul className="draft-cards">
            {pool.map((uid, i) => <li key={uid} ref={reg(uid)} className="draft-card" data-armed={armed === uid || undefined} data-pickable={mayPick || undefined} style={{ "--i": i } as CSSProperties}>
              {mayPick ? <button type="button" className="draft-card-face" onClick={() => setArmed(armed === uid ? "" : uid)} aria-pressed={armed === uid} aria-label={"鎖定 " + name(uid)}>
                <span className="draft-card-no">AGENT {codes[uid]}</span><Face vote={votes[uid]} /><strong>{name(uid)}</strong>
              </button> : <div className="draft-card-face"><span className="draft-card-no">AGENT {codes[uid]}</span><Face vote={votes[uid]} /><strong>{name(uid)}</strong></div>}
              <span className="draft-lock" aria-hidden="true"><i /><i /><i /><i /></span>
              {armed === uid && me && <div className="draft-confirm">
                <button type="button" className="draft-go" data-team={me} disabled={busy === uid} onClick={() => act(uid, true)}>確認選入{TEAM_LABEL[me]}</button>
                <button type="button" className="draft-cancel" onClick={() => setArmed("")}>取消</button>
              </div>}
            </li>)}
          </ul> : <p className="draft-done"><b>ALL AGENTS ASSIGNED</b>{uids.length ? "每位探員都有隊伍了，10.29 戰場見。" : "還沒有人接受任務。"}</p>}
        </section>
        {side("blue")}
      </div>
      <div ref={fx} className="draft-fx" aria-hidden="true" />
    </div>
    <p className="sr-only" aria-live="polite">{news}</p>
    {problem && <p className="draft-problem" role="alert">{problem}</p>}
  </div>;
}

/** Whether the board shows at all: the organisers published the teams (or the local demo is on). */
export function useTeamBoardVisible() {
  const { teamConfig } = useOuting();
  const [demo, setDemo] = useState(false);
  useEffect(() => { if (process.env.NODE_ENV !== "development") return; const key = new URLSearchParams(window.location.search).get("teams"); if (key === "demo" || key === "draft") setDemo(true); }, []);
  return teamConfig.published || demo;
}
