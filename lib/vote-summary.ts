import { choiceGroupMode, sortedChoices, sortedGroups, sortedPlans, type Catalog, type PublicVote, type TripPlan, type VoteDetails } from "./trips";
export function currentVoteDetails(vote: PublicVote, detail?: VoteDetails) {
  return detail && detail.planId === vote.planId && detail.updatedAt === vote.updatedAt ? detail : undefined;
}
export function familyCount(detail?: VoteDetails) {
  return detail && Number.isSafeInteger(detail.familyCount) && detail.familyCount! >= 0 ? detail.familyCount : undefined;
}
export function hasNotes(detail?: VoteDetails) {
  return !!detail?.note?.trim() || ((familyCount(detail) || 0) > 0 && !!detail?.familyNote?.trim());
}
export type ChoiceTally = { id: string; label: string; count: number; percent: number; leading: boolean };
export type GroupTally = { mode: "group" | "individual"; id: string; label: string; choices: ChoiceTally[]; total: number; selected: number; arranged: number; unknown: number; removed: number; leaders: string[]; high: number };
/** One matching voter per question; family members never multiply preference votes. */
export function preferenceTallies(planId: string, plan: TripPlan, votes: Record<string, PublicVote>, details: Record<string, VoteDetails>): GroupTally[] {
  const voters = Object.entries(votes).filter(([, vote]) => vote.planId === planId);
  return sortedGroups(plan).map(([id, group]) => {
    const counts = Object.fromEntries(Object.keys(group.choices || {}).map(id => [id, 0]));
    let arranged = 0, unknown = 0, removed = 0;
    for (const [uid, vote] of voters) {
      const detail = currentVoteDetails(vote, details[uid]);
      if (!detail) { unknown++; continue; }
      const choice = detail.preferences?.[id];
      if (!choice) arranged++;
      else if (Object.hasOwn(counts, choice)) counts[choice]++;
      else removed++;
    }
    const high = Math.max(0, ...Object.values(counts));
    const choices = sortedChoices(group).map(([choiceId, choice]) => ({ id: choiceId, label: choice.label, count: counts[choiceId], percent: voters.length ? Math.round(counts[choiceId] / voters.length * 100) : 0, leading: high > 0 && counts[choiceId] === high }));
    return { mode: choiceGroupMode(planId, id, group), id, label: group.label, choices, total: voters.length, selected: Object.values(counts).reduce((a, b) => a + b, 0), arranged, unknown, removed, high, leaders: choices.filter(c => c.leading).map(c => c.label) };
  });
}
// A freshness checksum, not an identity map. Public payloads contain no per-user keys.
export function choiceSourceVersion(catalog: Catalog, votes: Record<string, PublicVote>) {
  const source = JSON.stringify([catalog.updatedAt, Object.entries(votes).sort(([a], [b]) => a.localeCompare(b)).map(([uid, v]) => [uid, v.planId, v.updatedAt])]);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return "portraits-v5:" + catalog.updatedAt + ":" + Object.keys(votes).length + ":" + (hash >>> 0).toString(16);
}
export type ChoiceSupporter = { displayName: string; photoURL: string };
export type ChoiceSupporters = Record<string, Record<string, Record<string, ChoiceSupporter[]>>>;
export type ChoiceCountSummary = { version: string; plans: Record<string, GroupTally[]> };
export type PublicChoiceSummary = ChoiceCountSummary & { supporters: ChoiceSupporters; arrangedSupporters: Record<string, Record<string, ChoiceSupporter[]>> };
/** Call on the server. Only anonymous counts and public catalog labels leave this function. */
export function anonymousChoiceSummary(catalog: Catalog, votes: Record<string, PublicVote>, details: Record<string, VoteDetails>): ChoiceCountSummary {
  return { version: choiceSourceVersion(catalog, votes), plans: Object.fromEntries(sortedPlans(catalog).map(([id, plan]) => [id, preferenceTallies(id, plan, votes, details)])) };
}
export function organizerSnapshot(catalog: Catalog, votes: Record<string, PublicVote>, details: Record<string, VoteDetails>) {
  const rows = Object.entries(votes).map(([uid, vote]) => {
    const detail = currentVoteDetails(vote, details[uid]);
    return { uid, vote, plan: catalog.plans[vote.planId], detail, family: familyCount(detail), hasNotes: hasNotes(detail), pendingReason: !detail ? "投票明細尚未同步" : familyCount(detail) === undefined ? "舊資料尚未記錄同行人數" : "" };
  }).sort((a, b) => a.vote.displayName.localeCompare(b.vote.displayName, "zh-Hant"));
  const guests = rows.reduce((sum, row) => sum + (row.family || 0), 0);
  const plans = sortedPlans(catalog).filter(([id, p]) => p.active || rows.some(row => row.vote.planId === id)).map(([id, plan]) => {
    const members = rows.filter(row => row.vote.planId === id);
    return { id, plan, count: members.length, guests: members.reduce((sum, row) => sum + (row.family || 0), 0), notes: members.filter(row => row.hasNotes).length, groups: preferenceTallies(id, plan, votes, details) };
  });
  return { rows, plans, total: rows.length, guests, attendees: rows.length + guests, notes: rows.filter(row => row.hasNotes), incomplete: rows.filter(row => !row.detail || row.family === undefined).length };
}

export function matchesRosterSearch(query: string, ...fields: (string | undefined | null)[]) {
  const term = query.trim().toLocaleLowerCase();
  return !term || fields.some(value => value?.toLocaleLowerCase().includes(term));
}
export function organizerSummaryText(catalog: Catalog, votes: Record<string, PublicVote>, details: Record<string, VoteDetails>) {
  const s = organizerSnapshot(catalog, votes, details);
  const people = choiceSupporterLists(catalog, votes, details);
  const names = (members?: ChoiceSupporter[]) => members?.length ? "（" + members.map(person => person.displayName).join("、") + "）" : "";
  return [catalog.settings.title + "｜" + catalog.settings.eventDate,
    "已投票 " + s.total + " 人／預計 " + catalog.settings.expectedVoters + " 人；家眷 " + s.guests + " 位，已知同行共 " + s.attendees + " 人。",
    ...s.plans.flatMap(p => ["", p.plan.code + " · " + p.plan.shortName + "：" + p.count + " 票，家眷 " + p.guests + " 位。",
      ...p.groups.map(g => g.label + "｜" + (g.mode === "individual" ? "各自選擇：" : "偏好票數：") + (g.choices.filter(c=>c.count).map(c=>c.label + " " + c.count + (g.mode === "individual" ? " 人" : " 票") + names(people.supporters[p.id]?.[g.id]?.[c.id])).join("、") || "尚無選擇") + "；主辦安排 " + g.arranged + " 人" + names(people.arrangedSupporters[p.id]?.[g.id]) + (g.unknown ? "；待同步 " + g.unknown + " 人" : "") + (g.removed ? "；原選項已移除 " + g.removed + " 人" : ""))]),
    "", "備註（" + s.notes.length + " 人）",
    ...s.notes.map(r=>r.vote.displayName + "：" + [r.detail?.note?.trim(), (r.family || 0) > 0 && r.detail?.familyNote?.trim() ? "家眷：" + r.detail.familyNote.trim() : ""].filter(Boolean).join("；")),
    ...(s.incomplete ? ["", "待確認資料：" + s.rows.filter(r=>r.pendingReason).map(r=>r.vote.displayName + "（" + r.pendingReason + "）").join("、")] : []),
    "", "按摩與足湯依各人選擇安排；餐廳偏好供主辦參考。家眷不額外計票。"
  ].join("\n");
}

/** Public option portraits are explicitly limited to names/photos already shown in the battle board. */
export function choiceSupporterLists(catalog: Catalog, votes: Record<string, PublicVote>, details: Record<string, VoteDetails>) {
  const supporters: ChoiceSupporters = {};
  const arrangedSupporters: Record<string, Record<string, ChoiceSupporter[]>> = {};
  const ordered = Object.entries(votes).sort(([idA,a],[idB,b]) => b.updatedAt - a.updatedAt || idA.localeCompare(idB));
  for (const [planId, plan] of sortedPlans(catalog)) {
    supporters[planId] = {};
    arrangedSupporters[planId] = {};
    for (const [groupId, group] of sortedGroups(plan)) {
      const perChoice: Record<string, ChoiceSupporter[]> = {};
      arrangedSupporters[planId][groupId] = [];
      for (const [uid, vote] of ordered) {
        if (vote.planId !== planId) continue;
        const detail = currentVoteDetails(vote, details[uid]);
        if (!detail) continue;
        const choiceId = detail.preferences?.[groupId];
        if (!choiceId) { arrangedSupporters[planId][groupId].push({ displayName: vote.displayName, photoURL: vote.photoURL }); continue; }
        if (!Object.hasOwn(group.choices || {},choiceId)) continue;
        perChoice[choiceId] ||= [];
        perChoice[choiceId].push({ displayName: vote.displayName, photoURL: vote.photoURL });
      }
      supporters[planId][groupId] = perChoice;
    }
  }
  return { supporters, arrangedSupporters };
}

export function publicChoiceResults(catalog: Catalog, votes: Record<string, PublicVote>, details: Record<string, VoteDetails>): PublicChoiceSummary {
  return { ...anonymousChoiceSummary(catalog, votes, details), ...choiceSupporterLists(catalog, votes, details) };
}
