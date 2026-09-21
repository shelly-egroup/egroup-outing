import { choiceGroupMode, type Catalog, type PublicVote, type VoteDetails } from "./trips";
export type CatalogImpact = {
  planId: string; groupId: string; choiceId: string;
  plan: string; group: string; choice: string; removed: boolean;
  changes: { field: string; before: string; after: string }[];
  people: { uid: string; name: string }[];
};
export function choiceSelectionCounts(planId: string, votes: Record<string, PublicVote>, details: Record<string, VoteDetails>) {
  const counts: Record<string, Record<string, number>> = {};
  for (const [uid, detail] of Object.entries(details)) {
    if (detail.planId !== planId || votes[uid]?.planId !== planId) continue;
    for (const [groupId, choiceId] of Object.entries(detail.preferences || {})) {
      if (!choiceId) continue;
      counts[groupId] ||= {};
      counts[groupId][choiceId] = (counts[groupId][choiceId] || 0) + 1;
    }
  }
  return counts;
}
/** Conservatively protect stored choices even while the matching vote timestamp is syncing. */
export function catalogImpacts(before: Catalog, after: Catalog, votes: Record<string, PublicVote>, details: Record<string, VoteDetails>): CatalogImpact[] {
  const impacts: CatalogImpact[] = [];
  for (const [planId, plan] of Object.entries(before.plans)) {
    for (const [groupId, group] of Object.entries(plan.groups || {})) {
      for (const [choiceId, choice] of Object.entries(group.choices || {})) {
        const people = Object.entries(details).filter(([uid, detail]) => detail.planId === planId && votes[uid]?.planId === planId && detail.preferences?.[groupId] === choiceId)
          .map(([uid]) => ({ uid, name: votes[uid].displayName || "同事" })).sort((a, b) => a.uid.localeCompare(b.uid));
        if (!people.length) continue;
        const nextGroup = after.plans[planId]?.groups?.[groupId];
        const next = nextGroup?.choices?.[choiceId];
        const changes: CatalogImpact["changes"] = [];
        if (next && nextGroup) {
          const fields = [["名稱／時長", choice.label, next.label], ["補充說明", choice.description, next.description], ["價格", choice.price, next.price], ["題目", group.label, nextGroup.label], ["安排方式", choiceGroupMode(planId, groupId, group), choiceGroupMode(planId, groupId, nextGroup)]];
          for (const [field, oldValue, newValue] of fields) {
            if ((oldValue || "").trim() !== (newValue || "").trim()) {
              const readable = (value: string) => field === "安排方式" ? value === "individual" ? "各自選擇" : "共同安排" : value || "（未填）";
              changes.push({ field, before: readable(oldValue), after: readable(newValue) });
            }
          }
        }
        if (!next || changes.length) impacts.push({ planId, groupId, choiceId, plan: plan.shortName, group: group.label, choice: choice.label, removed: !next, changes, people });
      }
    }
  }
  return impacts;
}
export function catalogImpactKey(impacts: CatalogImpact[]) {
  return JSON.stringify(impacts.map(({ planId, groupId, choiceId, removed, changes, people }) => ({ planId, groupId, choiceId, removed, changes, people: people.map(person => person.uid) })).sort((a, b) => (a.planId + "/" + a.groupId + "/" + a.choiceId).localeCompare(b.planId + "/" + b.groupId + "/" + b.choiceId)));
}
