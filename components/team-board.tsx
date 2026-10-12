"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Face } from "./mission-accept";
import { useOuting } from "./outing-provider";
import { useInView } from "./use-in-view";
import { draftSound, useDraftSound } from "@/lib/draft-sound";
import { MARK_AGENT_WHOLE } from "@/lib/title-mark-paths";
import { captainOf, otherTeam, pickTurn, TEAM_LABEL, teamCounts, TEAMS, withCaptains, type Captain, type Team, type TeamMap } from "@/lib/teams";
import type { PublicVote } from "@/lib/trips";

const pad = (n: number) => String(n).padStart(2, "0");
const EN: Record<Team, string> = { red: "RED TEAM", blue: "BLUE TEAM" };

/** The agent from the mark: standing in for a captain who has not signed in yet, or a ghost in an empty slot. */
function Silhouette({ className }: { className: string }) {
  return <svg className={className} viewBox="176 19 38 64" aria-hidden="true"><path d={MARK_AGENT_WHOLE} /></svg>;
}

/**
 * Who picks first, drawn like a selector light: it hops between red and blue, slows, settles on the winner, which lights up.
 * With an odd number of agents the winner also picks the one left over (that is how turns from the first pick work out).
 */
function FirstPick({ team, extra }: { team: Team; extra: boolean }) {
  return <div className="draft-first" data-team={team}>
    <span className="draft-first-label">FIRST PICK・抽籤</span>
    <span className="draft-first-track" aria-hidden="true"><span data-side="red">{TEAM_LABEL.red}</span><span data-side="blue">{TEAM_LABEL.blue}</span><i className="draft-first-cursor" /></span>
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
 * light runs over the cards, slows and stops on the one drawn — and, for the organisers only, everyone left at once; a card
 * clicked locks onto the desk to be placed by hand. Every pick and draw plays, with its sound, on every open page.
 */
export default function TeamBoard() {
  const outing = useOuting();
  const [armed, setArmed] = useState(""), [busy, setBusy] = useState(""), [problem, setProblem] = useState(""), [news, setNews] = useState("");
  const [spot, setSpot] = useState(""), [won, setWon] = useState(false), [revealed, setRevealed] = useState(0), [confirmAll, setConfirmAll] = useState(false);
  const [ref, seen, round] = useInView<HTMLDivElement>("0px 0px -12% 0px");
  const deskRef = useRef<HTMLDivElement>(null);
  const sound = useDraftSound();
  const { votes, teams, teamConfig: config, isAdmin: admin, teamDraw: draw, user } = outing, { captains, picking, turns } = config;
  const me = user ? captainOf(captains, user.uid, user.email) : undefined;
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

  // the cards fly: remember where every card sits (relative to the board), and when one changes team, throw it from there in
  // an arc, glowing in its new colour — one after another, in reading order, when many move at once
  const cards = useRef(new Map<string, HTMLElement>()), spots = useRef(new Map<string, { x: number; y: number }>()), last = useRef<TeamMap>({});
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
      const dx = from.x - at.x, dy = from.y - at.y, tilt = dx > 0 ? 5 : dx < 0 ? -5 : 0, lift = Math.min(70, Math.abs(dx) * .14 + 18);
      const glow = team === "red" ? "rgb(255 42 74 / .9)" : team === "blue" ? "rgb(61 125 255 / .9)" : "rgb(255 255 255 / .6)";
      el.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(1.06) rotate(${tilt}deg)`, filter: `brightness(1.7) drop-shadow(0 0 18px ${glow})` },
        { transform: `translate(${dx * .42}px, ${dy * .42 - lift}px) scale(1.14) rotate(${tilt * .5}deg)`, filter: `brightness(1.45) drop-shadow(0 0 22px ${glow})`, offset: .5 },
        { transform: "none", filter: "brightness(1) drop-shadow(0 0 0 transparent)" },
      ], { duration: 760, delay, easing: "cubic-bezier(.3,.7,.2,1)", fill: "backwards" });
      const loud = moved.length > 4 ? .45 : 1;
      window.setTimeout(() => draftSound.whoosh(loud), delay);
      window.setTimeout(() => { el.classList.remove("is-landed"); void el.offsetWidth; el.classList.add("is-landed"); if (team) draftSound.stamp(loud); else draftSound.release(); }, delay + 700);
    });
    if (moved.length) setNews(moved.map(uid => name(uid) + (placed[uid] ? " 加入" + TEAM_LABEL[placed[uid]] : " 回到待分隊")).join("，"));
    spots.current = now; last.current = placed;
  });

  // a one-agent draw: the light hops over the pool, fast then slower and slower, and stops on the one drawn, who lights up
  // in their new team's colour; a beat later they fly across
  useEffect(() => {
    if (!pending?.uid) return;
    const drawn = pending.uid, seq = pending.seq;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { draftSound.lock(pending.team); setRevealed(seq); return; }
    const field = uids.filter(uid => !placedNow[uid] || uid === drawn), timers: number[] = [], STEPS = 16;
    let t = 150, at = "";
    for (let i = 0; i < STEPS; i++) {
      t += 60 + i * i * .9;
      const options = i === STEPS - 1 ? [drawn] : field.filter(uid => uid !== at && (i < STEPS - 2 || uid !== drawn));
      const next = options.length ? options[Math.floor(Math.random() * options.length)] : at ? "" : drawn;
      at = next;
      const hop = i;
      timers.push(window.setTimeout(() => { setSpot(next); draftSound.hop(hop, STEPS); }, t));
    }
    const team = pending.team;
    timers.push(window.setTimeout(() => { setWon(true); draftSound.lock(team); }, t));
    timers.push(window.setTimeout(() => { setRevealed(seq); setSpot(""); setWon(false); }, t + 950));
    return () => { timers.forEach(clearTimeout); setSpot(""); setWon(false); };
  }, [pending?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const act = (uid: string, team: Team | null) => { setArmed(""); return run(uid, () => team ? outing.pickAgent(uid, admin ? team : undefined) : outing.releaseAgent(uid)); };
  /** One at random: an organiser's to the team on the clock (captains picking in turn) or the smaller team; a captain's to their own. */
  const drawNext = () => { setArmed(""); return run("draw", () => outing.drawAgent(admin ? (turn || undefined) : me)); };
  /** Everyone left, at random, balanced (the one left over to either team). */
  const drawAll = () => {
    if (!confirmAll) { setConfirmAll(true); return; }
    setConfirmAll(false); setArmed("");
    return run("all", () => outing.drawEveryone());
  };

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
      {actor === "admin" && <button type="button" className="draft-desk-all" data-confirm={confirmAll || undefined} disabled={rolling || !!busy} onClick={drawAll}>{confirmAll ? "再按一次確認" : "一鍵隨機分隊"}</button>}
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
    <div key={round} className="draft-stage" data-hidden={!config.published || undefined}>
      <i className="draft-bg" aria-hidden="true" />
      <div className="draft-head">
        <p className="draft-kicker"><i data-state={rolling || (picking && pool.length) ? "live" : "done"} />TEAM DRAFT<span>{status}</span>
          <button type="button" className="draft-sound" data-state={sound.state} aria-pressed={sound.state !== "off"} onClick={sound.toggle}>{sound.state === "locked" ? "點一下開啟音效" : sound.state === "on" ? "音效 開" : "音效 關"}</button>
        </p>
        <div className="draft-score" aria-label={TEAM_LABEL.red + " " + counts.red + " 人，" + TEAM_LABEL.blue + " " + counts.blue + " 人"}>
          <span data-team="red"><b key={"r" + counts.red}>{pad(counts.red)}</b><small>{TEAM_LABEL.red}</small></span>
          <span className="draft-vs" aria-hidden="true">VS</span>
          <span data-team="blue"><b key={"b" + counts.blue}>{pad(counts.blue)}</b><small>{TEAM_LABEL.blue}</small></span>
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
    </div>
    <p className="sr-only" aria-live="polite">{rolling ? "抽籤中" : news}</p>
    {problem && <p className="draft-problem" role="alert">{problem}</p>}
  </div>;
}

/** Whether the board shows at all: the organisers published the teams. */
export function useTeamBoardVisible() {
  return useOuting().teamConfig.published;
}
