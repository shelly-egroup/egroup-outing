"use client";
import ChoiceAvatarPile from "./choice-avatar-pile";
import { Avatar } from "./account-menu";
import type { GroupTally, ChoiceTally, ChoiceSupporter } from "../lib/vote-summary";
import { useScoreMotion } from "./use-score-motion";
function SupporterNames({ people, label }: { people: ChoiceSupporter[]; label: string }) {
  if (!people.length) return null;
  return <ul className="choice-member-list" aria-label={label}>{people.map((person, index) => <li key={person.photoURL + person.displayName + index}><Avatar name={person.displayName} src={person.photoURL} /><span>{person.displayName || "未提供姓名"}</span></li>)}</ul>;
}
function ChoiceRow({ choice, rank, active, individual, supporters, showNames }: { showNames: boolean; supporters?: ChoiceSupporter[]; individual: boolean; choice: ChoiceTally; rank: number; active: boolean }) {
  const motion = useScoreMotion(choice.count, choice.percent, active, true);
  return <li className={"choice-rank-row" + (!individual && choice.leading ? " is-top" : "")}>
    <span className="choice-rank-place" aria-hidden="true">{individual ? "•" : String(rank).padStart(2, "0")}</span>
    <div className="choice-rank-copy"><div className="choice-rank-heading"><span className="choice-rank-label">{choice.label}</span><span className="choice-rank-meta">
      {!showNames && supporters?.length ? <ChoiceAvatarPile people={supporters} total={choice.count} label={choice.label + "的隊友"} /> : null}
      <b aria-label={choice.count + (individual ? " 人" : " 票")} key={motion.revision}>{motion.count}<small>{individual ? "人" : "票"}</small></b>
    </span></div>
      <div className="choice-rank-meter" role="meter" aria-label={choice.label + (individual ? "選擇比例" : "支持度")} aria-valuenow={choice.percent} aria-valuemin={0} aria-valuemax={100} aria-valuetext={choice.count + (individual ? " 人，" : " 票，") + choice.percent + "%"}><i style={{ transform: "scaleX(" + motion.percent / 100 + ")" }} /></div>
      {showNames && supporters?.length ? <SupporterNames people={supporters} label={choice.label + "的參加者"} /> : null}
    </div>
  </li>;
}
export default function ChoiceRankings({ group, active = true, supporters, arrangedSupporters, showNames = false }: { showNames?: boolean; arrangedSupporters?: ChoiceSupporter[]; group: GroupTally; active?: boolean; supporters?: Record<string, ChoiceSupporter[]> }) {
  const individual = group.mode === "individual";
  const shown = group.choices;
  return <section className="choice-ranking" aria-label={group.label + "票數"}>
    <div className="choice-ranking-heading"><h4>{group.label}</h4><span>{group.selected} 人已選</span></div>
    {individual ? <p className="choice-individual"><span>各自選擇</span>大家都能按自己選的，依人數安排。</p> : group.high > 0 ? <p className="choice-winner"><span>{group.leaders.length > 1 ? "並列第一" : "目前最多"}</span><b>{group.leaders.join("、")}</b></p> : <p className="choice-ranking-empty">{group.total ? "等大家選出心頭好。" : "還沒有偏好票，等第一位隊友！"}</p>}
    <ol className="choice-rank-list">{shown.map((choice, index) => <ChoiceRow key={choice.id} choice={choice} rank={index + 1} active={active} individual={individual} supporters={supporters?.[choice.id]} showNames={showNames} />)}</ol>
    <div className="choice-ranking-foot"><div className={"choice-arranged" + (showNames ? " with-member-names" : "")}><span>主辦安排</span><span className="choice-arranged-meta">{!showNames && arrangedSupporters?.length ? <ChoiceAvatarPile people={arrangedSupporters} total={group.arranged} label="交給主辦安排的隊友" /> : null}<span><b>{group.arranged}</b> 人</span></span>{showNames && arrangedSupporters?.length ? <SupporterNames people={arrangedSupporters} label="交給主辦安排的參加者" /> : null}</div>{group.unknown > 0 && <span>偏好待同步 <b>{group.unknown}</b> 人</span>}{group.removed > 0 && <span>原選項已移除 <b>{group.removed}</b> 人</span>}</div>
  </section>;
}
