"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Face, SAMPLE } from "./mission-accept";
import { useOuting } from "./outing-provider";
import { useInView } from "./use-in-view";
import { MARK_AGENT } from "@/lib/title-mark-paths";
import { assignTeams, captainOf, drawOne, otherTeam, pickTurn, TEAM_LABEL, teamCounts, TEAMS, withCaptains, type Captain, type Team, type TeamConfig, type TeamDraw, type TeamMap } from "@/lib/teams";
import type { PublicVote } from "@/lib/trips";

const pad = (n: number) => String(n).padStart(2, "0");
const EN: Record<Team, string> = { red: "RED TEAM", blue: "BLUE TEAM" };
type Board = { votes: Record<string, PublicVote>; teams: TeamMap; config: TeamConfig; me?: Team; admin: boolean; draw: TeamDraw | null | undefined };

/* ── The local scenario demo (?teams=demo, development only): every situation the draft can be in, played on sample data ── */
const demoVotes = Object.fromEntries(SAMPLE.concat([["demo7", { planId: "B", displayName: "周探員", photoURL: "", updatedAt: 7 } as PublicVote], ["demo8", { planId: "B", displayName: "吳特務", photoURL: "", updatedAt: 8 } as PublicVote]]));
const demoCaptains = { red: { email: "egroup.james@gmail.com", uid: "demo0", name: "王特務" }, blue: { email: "egroup.ivy@gmail.com", uid: "demo2", name: "陳隊長" } };
const base: TeamConfig = { published: true, picking: true, turns: true, firstPick: "red", captains: demoCaptains };
type Scenario = { key: string; label: string; note: string; config: TeamConfig; teams: TeamMap; me?: Team; rival?: boolean; admin?: boolean };
const SCENARIOS: Scenario[] = [
  { key: "hidden", label: "尚未公開", note: "主辦還沒打開「前台顯示分隊」：首頁不會出現這個面板，探員的檔案寫「分隊公布後顯示」。（這裡為了示範才顯示）", config: { ...base, published: false, picking: false }, teams: {} },
  { key: "draw", label: "主辦抽籤", note: "主辦分隊、你是主辦：按「抽一位」，燈在待分隊的卡片間跑、越跑越慢，停在被抽中的人，他飛進人數較少的一隊（一樣多就隨機）；按「一鍵隨機分隊」，剩下的人一個接一個飛進兩隊。也可以點一張卡片，在抽籤台直接指定紅隊或藍隊；隊上的人可以「放回」。看首頁的人都同步看到，抽籤台只有你看得到。", config: { ...base, picking: false, firstPick: null }, teams: {}, admin: true },
  { key: "assigned", label: "主辦分好隊", note: "主辦在後台手動指定或隨機分配，並公開：大家看到兩隊名單，不能選人。", config: { ...base, picking: false }, teams: { demo1: "red", demo4: "red", demo6: "red", demo3: "blue", demo5: "blue", demo7: "blue", demo8: "red" } },
  { key: "my-turn", label: "輪到你選", note: "你是紅隊隊長、輪到紅隊：你的抽籤台跟主辦一樣——「抽一位」幫自己隊抽、「一鍵隨機分隊」把剩下的人隨機分完；也可以點一張卡片，在抽籤台按「確認選入」。選完換藍隊（示範中藍隊會自動選）。FIRST PICK 抽中的隊伍先選，人數單數時也由它多選一位。", config: base, teams: { demo1: "red", demo3: "blue" }, me: "red", rival: true },
  { key: "their-turn", label: "輪到對方", note: "你是紅隊隊長，但現在輪到藍隊：卡片暫時不能點，藍隊選完就換你。", config: base, teams: { demo1: "red", demo3: "blue", demo4: "red" }, me: "red" },
  { key: "free", label: "不輪流", note: "主辦關掉「輪流選」：兩位隊長隨時都可以選（手動或抽籤），不用等對方。", config: { ...base, turns: false }, teams: { demo1: "red" }, me: "blue" },
  { key: "organiser", label: "主辦（隊長選人中）", note: "隊長選人的時候，主辦一樣有隊長的所有功能：「抽一位」幫輪到的那隊抽，點卡片可以直接編入任一隊，隊上的人可以放回，也能一鍵把剩下的人隨機分完。", config: base, teams: { demo1: "red", demo3: "blue" }, admin: true },
  { key: "spectator", label: "一般探員觀戰", note: "不是隊長：看得到即時的選人過程，被選走的卡片會飛進那一隊；自己的檔案會顯示隊伍。", config: { ...base, firstPick: "blue" }, teams: { demo1: "red", demo3: "blue", demo4: "blue" }, rival: true },
  { key: "captain-away", label: "隊長還沒登入", note: "藍隊隊長還沒登入過：位子先放待命中的特務剪影，她第一次登入就自動就位。", config: { ...base, picking: false, captains: { red: demoCaptains.red, blue: { email: "egroup.ivy@gmail.com" } } }, teams: { demo1: "red" } },
  { key: "done", label: "分隊完成", note: "每個人都有隊伍了：面板顯示「分隊完成」，雙方人數一樣（或差一人）。", config: base, teams: { demo1: "red", demo4: "red", demo6: "red", demo8: "red", demo3: "blue", demo5: "blue", demo7: "blue" } },
];

/** The agent from the mark: standing in for a captain who has not signed in yet, or a ghost in an empty slot. */
function Silhouette({ className }: { className: string }) {
  return <svg className={className} viewBox="176 19 38 64" aria-hidden="true"><path d={MARK_AGENT} /></svg>;
}

/**
 * Who picks first, drawn like a selector light: it hops between red and blue, slows, settles on the winner, which lights up.
 * With an odd number of agents the winner also picks the one left over (that is how turns from the first pick work out).
 */
function FirstPick({ team, extra }: { team: Team; extra: boolean }) {
  return <div className="draft-first" data-team={team}>
    <span className="draft-first-label">FIRST PICK・抽籤</span>
    <span className="draft-first-track" aria-hidden="true"><span data-side="red">紅隊</span><span data-side="blue">藍隊</span><i className="draft-first-cursor" /></span>
    <b className="draft-first-result">{TEAM_LABEL[team]}先選</b>
    {extra && <small className="draft-first-note">人數單數：{TEAM_LABEL[team]}多選一位</small>}
  </div>;
}

/**
 * The team draft, under the accept console once the organisers publish the teams. Staged like the captains' face-off: each
 * team as one squad — the captain's tile first and largest, the people taken beside it, empty slots waiting — on either side
 * of the agents still to be placed, with a scoreboard and VS on top. Whoever may act gets one desk above the cards: the
 * captain on the clock (in turn from the first pick, drawn by lot and played as a selector light, if the organisers want
 * turns) and the organisers, who can do everything a captain can for either team, any time. The desk draws one agent — a
 * light runs over the cards, slows and stops on the one drawn — or everyone left at once; a card clicked locks onto the
 * desk to be placed by hand. Every pick and draw plays on every open page. With ?teams=demo (development only) a switcher
 * plays every scenario on sample data (&scene=<key> opens one).
 */
export default function TeamBoard() {
  const outing = useOuting();
  const [scenario, setScenario] = useState<Scenario | null>(null), [demoTeams, setDemoTeams] = useState<TeamMap>({}), [demoDraw, setDemoDraw] = useState<TeamDraw | null>(null);
  const [armed, setArmed] = useState(""), [busy, setBusy] = useState(""), [problem, setProblem] = useState(""), [news, setNews] = useState("");
  const [spot, setSpot] = useState(""), [won, setWon] = useState(false), [revealed, setRevealed] = useState(0), [confirmAll, setConfirmAll] = useState(false);
  const [ref, seen, round] = useInView<HTMLDivElement>("0px 0px -12% 0px");
  const deskRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const query = new URLSearchParams(window.location.search), key = query.get("teams");
    if (key !== "demo" && key !== "draft") return;
    const first = SCENARIOS.find(s => s.key === query.get("scene")) || SCENARIOS[1];
    setScenario(first); setDemoTeams(first.teams);
  }, []);
  const board: Board = scenario
    ? { votes: demoVotes, teams: demoTeams, config: scenario.config, me: scenario.me, admin: !!scenario.admin, draw: demoDraw }
    : { votes: outing.votes, teams: outing.teams, config: outing.teamConfig, me: outing.user ? captainOf(outing.teamConfig.captains, outing.user.uid, outing.user.email) : undefined, admin: outing.isAdmin, draw: outing.teamDraw };
  const { votes, teams, config, me, admin, draw } = board, { captains, picking, turns } = config;
  const uids = Object.keys(votes), placedNow = withCaptains(teams, captains);

  // a draw run before the board first heard from the database is not replayed; a newer one-agent draw keeps that agent in
  // the pool (once they are on the team drawn) until the light has run and stopped on them
  const baseline = useRef<number | null>(null);
  if (baseline.current === null && draw !== undefined) baseline.current = draw?.seq ?? 0;
  const pending = draw?.uid && draw.team && baseline.current !== null && draw.seq > Math.max(baseline.current, revealed) && votes[draw.uid] && placedNow[draw.uid] === draw.team ? draw : null;
  const held = pending?.uid || "", rolling = !!pending;
  const placed: TeamMap = held ? Object.fromEntries(Object.entries(placedNow).filter(([uid]) => uid !== held)) : placedNow;

  const counts = teamCounts(uids, placed);
  const isCaptain = (uid: string) => !!captainOf(captains, uid);
  const byName = (a: string, b: string) => (votes[a].displayName || "").localeCompare(votes[b].displayName || "", "zh-Hant");
  const members = (team: Team) => uids.filter(uid => placed[uid] === team && !isCaptain(uid)).sort(byName);
  const pool = uids.filter(uid => !placed[uid]).sort(byName);
  const turn = picking && turns && pool.length ? pickTurn(uids, placed, captains, config.firstPick || "red") : null;
  // a captain acts for their own team while picking is open (on their turn); an organiser acts for either team, any time
  const onClock = !!me && picking && pool.length > 0 && (!turns || turn === me);
  const actor = admin && pool.length > 0 ? "admin" : onClock ? "captain" : null;
  const locked = actor && !rolling && armed && pool.includes(armed) ? armed : "";
  const target = Math.ceil(uids.length / 2);
  const codes = Object.fromEntries(Object.entries(votes).sort(([, a], [, b]) => (a.updatedAt || 0) - (b.updatedAt || 0)).map(([uid], i) => [uid, pad(i + 1)]));
  const name = (uid: string) => votes[uid]?.displayName || "探員";

  // the cards fly: remember where every card sits (relative to the board), and when one changes team, fly it from there —
  // one after another, in reading order, when many move at once
  const cards = useRef(new Map<string, HTMLElement>()), spots = useRef(new Map<string, { x: number; y: number }>()), last = useRef<TeamMap>({});
  const fx = useRef<HTMLDivElement>(null);
  const reg = (uid: string) => (el: HTMLElement | null) => { if (el) cards.current.set(uid, el); else cards.current.delete(uid); };
  useLayoutEffect(() => {
    const host = ref.current; if (!host) return;
    const box = host.getBoundingClientRect(), now = new Map<string, { x: number; y: number }>();
    cards.current.forEach((el, uid) => { const r = el.getBoundingClientRect(); now.set(uid, { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 }); });
    const moved = [...now.keys()].filter(uid => spots.current.has(uid) && last.current[uid] !== placed[uid]);
    moved.sort((a, b) => { const p = spots.current.get(a)!, q = spots.current.get(b)!; return p.y - q.y || p.x - q.x; });
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) moved.forEach((uid, i) => {
      const from = spots.current.get(uid)!, at = now.get(uid)!, el = cards.current.get(uid), team = placed[uid], delay = i * 120;
      if (!el) return;
      el.animate([{ transform: `translate(${from.x - at.x}px, ${from.y - at.y}px) scale(1.1)`, filter: "brightness(2.2)" }, { transform: "none", filter: "none" }], { duration: 680, delay, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
      window.setTimeout(() => { el.classList.remove("is-landed"); void el.offsetWidth; el.classList.add("is-landed"); }, delay + 320);
      // the laser it rides on
      const layer = fx.current;
      if (layer && team) {
        const trail = document.createElement("i"), dx = at.x - from.x, dy = at.y - from.y;
        trail.className = "draft-trail"; trail.dataset.team = team;
        Object.assign(trail.style, { left: from.x + "px", top: from.y + "px", width: Math.hypot(dx, dy) + "px", rotate: Math.atan2(dy, dx) + "rad" });
        layer.appendChild(trail);
        trail.animate([{ scale: "0 1", opacity: 1 }, { scale: "1 1", opacity: 1, offset: .45 }, { scale: "1 1", opacity: 0 }], { duration: 720, delay, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }).finished.then(() => trail.remove(), () => trail.remove());
      }
    });
    if (moved.length) setNews(moved.map(uid => name(uid) + (placed[uid] ? " 加入" + TEAM_LABEL[placed[uid]] : " 回到待分隊")).join("，"));
    spots.current = now; last.current = placed;
  });

  // a one-agent draw: the light hops over the pool, fast then slower and slower, and stops on the one drawn, who lights up
  // in their new team's colour; a beat later they fly across
  useEffect(() => {
    if (!pending?.uid) return;
    const drawn = pending.uid, seq = pending.seq;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setRevealed(seq); return; }
    const field = uids.filter(uid => !placedNow[uid] || uid === drawn), timers: number[] = [], STEPS = 16;
    let t = 150, at = "";
    for (let i = 0; i < STEPS; i++) {
      t += 60 + i * i * .9;
      const options = i === STEPS - 1 ? [drawn] : field.filter(uid => uid !== at && (i < STEPS - 2 || uid !== drawn));
      const next = options.length ? options[Math.floor(Math.random() * options.length)] : at ? "" : drawn;
      at = next;
      timers.push(window.setTimeout(() => setSpot(next), t));
    }
    timers.push(window.setTimeout(() => setWon(true), t));
    timers.push(window.setTimeout(() => { setRevealed(seq); setSpot(""); setWon(false); }, t + 950));
    return () => { timers.forEach(clearTimeout); setSpot(""); setWon(false); };
  }, [pending?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // the demo's rival captain answers each pick after a beat
  useEffect(() => {
    if (!scenario?.rival || !turns || !turn || turn === me || !pool.length || rolling) return;
    const timer = setTimeout(() => setDemoTeams(t => ({ ...t, [pool[(Math.random() * pool.length) | 0]]: turn })), 1500);
    return () => clearTimeout(timer);
  }, [scenario, turn, me, turns, pool.length, rolling]); // eslint-disable-line react-hooks/exhaustive-deps
  // a lock lifts when the turn passes or the card is taken; a lock brings the desk into view; the draw-everyone confirmation lapses
  useEffect(() => { if (armed && (!actor || !pool.includes(armed))) setArmed(""); }, [armed, actor, pool]);
  useEffect(() => { if (locked) deskRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [locked]);
  useEffect(() => { if (!confirmAll) return; const timer = setTimeout(() => setConfirmAll(false), 4000); return () => clearTimeout(timer); }, [confirmAll]);

  async function run(key: string, job: () => Promise<unknown> | void) {
    setBusy(key); setProblem("");
    try { await job(); }
    catch (error) { setProblem(error instanceof Error ? error.message : "沒有完成，請再試一次。"); }
    finally { setBusy(""); }
  }
  /** Onto a team (an organiser names the team; a captain takes for their own), or back to the pool (`null`). */
  const act = (uid: string, team: Team | null) => { setArmed(""); return run(uid, () => scenario
    ? setDemoTeams(t => { const next = { ...t }; if (team) next[uid] = team; else delete next[uid]; return next; })
    : team ? outing.pickAgent(uid, admin ? team : undefined) : outing.releaseAgent(uid)); };
  /** One at random: an organiser's to the team on the clock (captains picking in turn) or the smaller team; a captain's to their own. */
  const drawNext = () => { setArmed(""); return run("draw", () => {
    const into = admin ? (turn || undefined) : me;
    if (!scenario) return outing.drawAgent(into);
    const next = admin ? drawOne(uids, placedNow, captains) : pool.length && me ? { uid: pool[Math.floor(Math.random() * pool.length)], team: me } : null;
    if (!next) return;
    if (into) next.team = into;
    setDemoTeams(t => ({ ...t, [next.uid]: next.team }));
    setDemoDraw(d => ({ seq: (d?.seq || 0) + 1, uid: next.uid, team: next.team, at: Date.now() }));
  }); };
  /** Everyone left, at random, balanced (the one left over to either team). */
  const drawAll = () => {
    if (!confirmAll) { setConfirmAll(true); return; }
    setConfirmAll(false); setArmed("");
    return run("all", () => {
      if (!scenario) return outing.drawEveryone();
      setDemoTeams(assignTeams(uids, placedNow, { keep: true, fixed: withCaptains({}, captains) }));
      setDemoDraw(d => ({ seq: (d?.seq || 0) + 1, all: true, at: Date.now() }));
    });
  };
  function play(next: Scenario) {
    setScenario(next); setDemoTeams(next.teams); setDemoDraw(null); setRevealed(0); baseline.current = null;
    setArmed(""); setProblem(""); setConfirmAll(false); spots.current = new Map(); last.current = {};
  }

  const status = rolling ? "抽籤中" : !pool.length ? "分隊完成" : !picking ? "主辦分隊中" : !turns ? "隊長自由選人中" : TEAM_LABEL[turn || "red"] + "選人中";
  const guide = actor || !me || !picking ? "" : !pool.length ? "你的隊伍已經到齊。" : rolling ? "抽籤中…" : "等" + TEAM_LABEL[otherTeam(me)] + "隊長選完就換你。";
  const extra = picking && turns && uids.filter(uid => !isCaptain(uid)).length % 2 === 1;
  // one desk for whoever may act: draw one, draw everyone, or place the card locked on it
  const desk = actor && <div ref={deskRef} className="draft-desk" data-team={actor === "captain" ? me : undefined} data-locked={locked ? "" : undefined} role="group" aria-label={actor === "admin" ? "主辦抽籤台" : "隊長抽籤台"}>
    {locked ? <>
      <span className="draft-desk-pick"><Face vote={votes[locked]} /><span><small>已鎖定・AGENT {codes[locked]}</small>{name(locked)}</span></span>
      {actor === "admin" ? TEAMS.map(team => <button key={team} type="button" className="draft-go" data-team={team} disabled={!!busy} onClick={() => act(locked, team)}>編入{TEAM_LABEL[team]}</button>)
        : me && <button type="button" className="draft-go" data-team={me} disabled={!!busy} onClick={() => act(locked, me)}>確認選入{TEAM_LABEL[me]}</button>}
      <button type="button" className="draft-cancel" onClick={() => setArmed("")}>取消</button>
    </> : <>
      <span className="draft-desk-label"><small>{actor === "admin" ? "只有主辦看得到" : "輪到你・只有你看得到"}</small>{actor === "admin" ? "主辦抽籤台" : "隊長抽籤台"}</span>
      <button type="button" className="draft-desk-one" disabled={rolling || !!busy} onClick={drawNext}>{actor === "admin" && turn ? "幫" + TEAM_LABEL[turn] + "抽一位" : "抽一位"}</button>
      <button type="button" className="draft-desk-all" data-confirm={confirmAll || undefined} disabled={rolling || !!busy} onClick={drawAll}>{confirmAll ? "再按一次確認" : "一鍵隨機分隊"}</button>
      <p className="draft-desk-hint">{rolling ? "抽籤中…" : confirmAll ? "剩下的人會隨機分進兩隊，多出的一位隨機。" : actor === "admin" ? "或點一張卡片，直接編入任一隊。" : "或點一張卡片，親手選人。"}</p>
    </>}
  </div>;
  const side = (team: Team) => {
    const captain: Captain = captains[team], cv = captain.uid ? votes[captain.uid] : undefined, list = members(team);
    const empty = pool.length ? Math.max(0, target - list.length - 1) : 0, mayRelease = admin || (me === team && picking);
    const note = !captain.uid ? "尚未登入・登入後自動就位" : !cv ? "尚未接受任務" : me === team ? "這是你" : "";
    return <section className="draft-side" data-team={team} data-active={turn === team || undefined} data-mine={me === team || undefined} aria-label={TEAM_LABEL[team]}>
      <p className="draft-side-name"><span>{TEAM_LABEL[team]}</span><em>{EN[team]}</em></p>
      <ol className="draft-roster">
        <li className="draft-member is-captain">
          <span className="draft-member-no">01</span><b className="draft-member-badge">CAPTAIN</b>
          {cv || captain.photoURL ? <Face vote={cv || { planId: "B", displayName: captain.name || "隊長", photoURL: captain.photoURL || "", updatedAt: 0 } as PublicVote} size="lg" /> : <Silhouette className="draft-standin" />}
          <strong>{cv?.displayName || captain.name || captain.email.split("@")[0]}</strong>
          {note && <small>{note}</small>}
        </li>
        {list.map((uid, i) => <li key={uid} ref={reg(uid)} className="draft-member">
          <span className="draft-member-no">{pad(i + 2)}</span><Face vote={votes[uid]} /><strong>{name(uid)}</strong>
          {mayRelease && <button type="button" className="draft-release" disabled={!!busy || rolling} onClick={() => act(uid, null)} aria-label={"把" + name(uid) + "放回待分隊"}>放回</button>}
        </li>)}
        {Array.from({ length: empty }, (_, i) => <li key={"empty" + i} className="draft-member is-empty"><span className="draft-member-no">{pad(list.length + i + 2)}</span><Silhouette className="draft-ghost" /><strong>待命</strong></li>)}
      </ol>
    </section>;
  };

  return <div ref={ref} className="draft" data-seen={seen} data-picking={picking} data-lock={admin ? "admin" : me} data-rolling={rolling || undefined}>
    {scenario && <div className="draft-demo" role="group" aria-label="情境示範">
      <p><b>情境示範</b>只在本機預覽，不會寫入資料庫</p>
      <div className="draft-demo-tabs">{SCENARIOS.map((s, i) => <button key={s.key} type="button" aria-pressed={scenario.key === s.key} onClick={() => play(s)}><span>{i + 1}</span>{s.label}</button>)}</div>
      <p className="draft-demo-note">{scenario.note}</p>
    </div>}
    <div key={round} className="draft-stage" data-hidden={!config.published || undefined}>
      <i className="draft-bg" aria-hidden="true" />
      <div className="draft-head">
        <p className="draft-kicker"><i data-state={rolling || (picking && pool.length) ? "live" : "done"} />TEAM DRAFT<span>{status}</span></p>
        <div className="draft-score" aria-label={"紅隊 " + counts.red + " 人，藍隊 " + counts.blue + " 人"}>
          <span data-team="red"><b key={"r" + counts.red}>{pad(counts.red)}</b><small>紅隊</small></span>
          <span className="draft-vs" aria-hidden="true">VS</span>
          <span data-team="blue"><b key={"b" + counts.blue}>{pad(counts.blue)}</b><small>藍隊</small></span>
        </div>
        {picking && turns && config.firstPick && <FirstPick key={config.firstPick} team={config.firstPick} extra={extra} />}
        {picking && !turns && <span className="draft-tag">不輪流・隊長隨時可選</span>}
        {!picking && <span className="draft-tag">主辦分隊</span>}
      </div>
      <div className="draft-field">
        {side("red")}
        <section className="draft-pool" aria-label="待分隊">
          <p className="draft-pool-head"><span>待分隊</span><b>{pool.length}</b>
            {turn && <em className="draft-arrow" data-team={turn}>{turn === "red" ? "◀ " : ""}{TEAM_LABEL[turn]}選人中{turn === "blue" ? " ▶" : ""}</em>}
          </p>
          {desk}
          {guide && <p className="draft-guide" data-team={me}>{guide}</p>}
          {pool.length ? <ul className="draft-cards">
            {pool.map((uid, i) => <li key={uid} ref={reg(uid)} className="draft-card" data-armed={locked === uid || undefined} data-pickable={actor && !rolling || undefined} data-spot={spot === uid || undefined} data-won={won && spot === uid ? pending?.team : undefined} style={{ "--i": i } as CSSProperties}>
              {actor && !rolling ? <button type="button" className="draft-card-face" onClick={() => setArmed(locked === uid ? "" : uid)} aria-pressed={locked === uid} aria-label={"鎖定 " + name(uid)}>
                <span className="draft-card-no">AGENT {codes[uid]}</span><Face vote={votes[uid]} /><strong>{name(uid)}</strong>
              </button> : <div className="draft-card-face"><span className="draft-card-no">AGENT {codes[uid]}</span><Face vote={votes[uid]} /><strong>{name(uid)}</strong></div>}
              <span className="draft-lock" aria-hidden="true"><i /><i /><i /><i /></span>
              {won && spot === uid && pending?.team && <span className="draft-drawn"><b>抽中</b>{TEAM_LABEL[pending.team]}</span>}
            </li>)}
          </ul> : <p className="draft-done"><b>ALL AGENTS ASSIGNED</b>{uids.length ? "每位探員都有隊伍了，10.29 戰場見。" : "還沒有人接受任務。"}</p>}
        </section>
        {side("blue")}
      </div>
      <div ref={fx} className="draft-fx" aria-hidden="true" />
    </div>
    <p className="sr-only" aria-live="polite">{rolling ? "抽籤中" : news}</p>
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
