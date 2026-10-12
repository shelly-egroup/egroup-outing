"use client";
import { useEffect, useState } from "react";
import { Face, SAMPLE } from "./mission-accept";
import { useOuting } from "./outing-provider";
import { captainOf, pickTurn, TEAM_LABEL, TEAMS, teamCounts, withCaptains, type Captain, type Team, type TeamConfig, type TeamMap } from "@/lib/teams";
import type { PublicVote } from "@/lib/trips";

type Board = { votes: Record<string, PublicVote>; teams: TeamMap; config: TeamConfig; me?: Team };
/** The local preview (?teams=draft, development only): a sample roster mid-draft, you as the red captain. */
const DEMO: Board = {
  votes: Object.fromEntries(SAMPLE),
  teams: { demo1: "red", demo3: "blue" },
  config: { published: true, picking: true, turns: true, firstPick: "red", captains: { red: { email: "red@example.test", uid: "demo0", name: "王特務" }, blue: { email: "blue@example.test", uid: "demo2", name: "陳隊長" } } },
  me: "red",
};

/** A captain at the head of the team: their photo (in the fedora) once they have accepted, or their name / account until then. */
function CaptainSlot({ team, captain, vote }: { team: Team; captain: Captain; vote?: PublicVote }) {
  const name = vote?.displayName || captain.name || captain.email.split("@")[0];
  return <div className="draft-captain" data-team={team}>
    <Face vote={vote || { planId: "B", displayName: name, photoURL: captain.photoURL || "", updatedAt: 0 } as PublicVote} />
    <span><b>{TEAM_LABEL[team]}隊長</b><strong>{name}</strong>{!captain.uid ? <small>還沒登入</small> : !vote ? <small>還沒接受任務</small> : null}</span>
  </div>;
}

/**
 * The team draft, under the accept console once the organisers publish the teams: red and blue with their captains on
 * either side and the agents still to be placed in the middle. When the organisers open the picking, a signed-in captain
 * takes people from the middle — in turn from the first pick, if the organisers want turns — and can put back someone they
 * took; everyone sees the board change live.
 */
export default function TeamBoard() {
  const outing = useOuting();
  const [demo, setDemo] = useState<Board | null>(null), [busy, setBusy] = useState(""), [problem, setProblem] = useState("");
  useEffect(() => { if (process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).get("teams") === "draft") setDemo(DEMO); }, []);
  const board: Board = demo || { votes: outing.votes, teams: outing.teams, config: outing.teamConfig, me: outing.user ? captainOf(outing.teamConfig.captains, outing.user.uid, outing.user.email) : undefined };
  const { votes, teams, config, me } = board, { captains, picking, turns } = config;
  const uids = Object.keys(votes), placed = withCaptains(teams, captains);
  const isCaptain = (uid: string) => !!captainOf(captains, uid);
  const byName = (a: string, b: string) => (votes[a].displayName || "").localeCompare(votes[b].displayName || "", "zh-Hant");
  const members = (team: Team) => uids.filter(uid => placed[uid] === team && !isCaptain(uid)).sort(byName);
  const pool = uids.filter(uid => !placed[uid]).sort(byName), counts = teamCounts(uids, placed);
  const turn = picking && turns ? pickTurn(uids, placed, captains, config.firstPick || "red") : null;
  const mayPick = !!me && picking && pool.length > 0 && (!turns || turn === me);
  async function act(uid: string, take: boolean) {
    setBusy(uid); setProblem("");
    try {
      if (demo) { const next = { ...demo.teams }; if (take && me) next[uid] = me; else delete next[uid]; setDemo({ ...demo, teams: next }); }
      else await (take ? outing.pickAgent(uid) : outing.releaseAgent(uid));
    } catch (error) { setProblem(error instanceof Error ? error.message : "沒有完成，請再試一次。"); }
    finally { setBusy(""); }
  }
  const status = !picking ? "隊伍由主辦安排" : !pool.length ? "選人完成" : !turns ? "隊長隨時可以選人" : "輪到" + TEAM_LABEL[turn || "red"] + "選人";
  const column = (team: Team) => <div className="draft-team" data-team={team} data-turn={turn === team || undefined}>
    <p className="draft-team-head"><span>{TEAM_LABEL[team]}</span><b>{counts[team]}</b><small>人</small></p>
    <CaptainSlot team={team} captain={captains[team]} vote={captains[team].uid ? votes[captains[team].uid as string] : undefined} />
    <ul className="draft-list">
      {members(team).map(uid => <li key={uid}>
        <Face vote={votes[uid]} /><span>{votes[uid].displayName || "探員"}</span>
        {me === team && picking && <button type="button" className="draft-release" disabled={!!busy} onClick={() => act(uid, false)}>放回</button>}
      </li>)}
      {!members(team).length && <li className="draft-empty">還沒有隊員</li>}
    </ul>
  </div>;
  return <div className="draft" data-picking={picking}>
    <div className="draft-status" role="status">
      <span className="draft-state"><i />{status}</span>
      {picking && turns && config.firstPick && <span className="draft-first" data-team={config.firstPick}>抽籤・{TEAM_LABEL[config.firstPick]}先選</span>}
      {me && picking && <span className="draft-me" data-team={me}>你是{TEAM_LABEL[me]}隊長{mayPick ? "，點中間的探員把他選進" + TEAM_LABEL[me] : turns && pool.length ? "，等對方選完" : ""}</span>}
    </div>
    <div className="draft-grid">
      {column("red")}
      <div className="draft-pool">
        <p className="draft-team-head"><span>待分隊</span><b>{pool.length}</b><small>人</small></p>
        {pool.length ? <ul className="draft-list">
          {pool.map(uid => <li key={uid} data-pickable={mayPick || undefined}>
            <Face vote={votes[uid]} /><span>{votes[uid].displayName || "探員"}</span>
            {mayPick && me && <button type="button" className="draft-pick" data-team={me} disabled={busy === uid} onClick={() => act(uid, true)}>選入{TEAM_LABEL[me]}</button>}
          </li>)}
        </ul> : <p className="draft-done">{uids.length ? "所有探員都有隊伍了。" : "還沒有人接受任務。"}</p>}
      </div>
      {column("blue")}
    </div>
    {problem && <p className="draft-problem" role="alert">{problem}</p>}
  </div>;
}

/** Whether the board shows at all: the organisers published the teams (or the local preview is on). */
export function useTeamBoardVisible() {
  const { teamConfig } = useOuting();
  const [demo, setDemo] = useState(false);
  useEffect(() => { if (process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).get("teams") === "draft") setDemo(true); }, []);
  return teamConfig.published || demo;
}
