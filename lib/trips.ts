import type { HighlightRange } from "./text-highlights";
export type Choice = { label: string; description: string; price: string; descriptionHighlights?: HighlightRange[]; subtitle?: string; ingredients?: string; order?: number };
export type ChoiceGroup = { order?: number; collapsibleDescriptions?: boolean; label: string; choices: Record<string, Choice>; selectionMode?: "group" | "individual" };
/** Legacy choices keep their current order until the organizer rearranges them. */
export function sortedChoices(group: ChoiceGroup) {
  return Object.entries(group.choices || {}).sort(([, a], [, b]) =>
    (Number.isFinite(a.order) ? a.order! : Number.MAX_SAFE_INTEGER) -
    (Number.isFinite(b.order) ? b.order! : Number.MAX_SAFE_INTEGER));
}
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return items;
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}
/** Persist positions, never change IDs referenced by existing votes. */
export function moveChoice(group: ChoiceGroup, from: number, to: number) {
  const choices = sortedChoices(group);
  const reordered = moveItem(choices, from, to);
  if (reordered === choices) return;
  reordered.forEach(([, choice], index) => { choice.order = index; });
}
export function appendChoice(group: ChoiceGroup, id: string, choice: Choice) {
  const choices = sortedChoices(group);
  choices.forEach(([, current], index) => { current.order = index; });
  group.choices[id] = { ...choice, order: choices.length };
}
export function choiceGroupMode(planId: string, groupId: string, group: ChoiceGroup) {
  // Existing catalogs predate this setting; B/g0 is the original massage question.
  return group.selectionMode || (planId === "B" && groupId === "g0" ? "individual" : "group");
}
export type TripPlan = {
  code: string;
  title: string;
  shortName: string;
  category: string;
  description: string;
  priceNote: string;
  color: "yellow" | "coral";
  tags: string[];
  schedule: { time: string; title: string; description: string }[];
  groups?: Record<string, ChoiceGroup>;
  order: number;
  active: boolean;
};
export type Catalog = {
  schemaVersion?: number;
  settings: {
    title: string;
    eventDate: string;
    expectedVoters: number;
    votingOpen: boolean;
    closesAt: number;
  };
  plans: Record<string, TripPlan>;
  updatedAt: number;
};
export type PublicVote = {
  planId: string;
  displayName: string;
  photoURL: string;
  updatedAt: number;
};
export type VoteDetails = {
  planId: string;
  preferences?: Record<string, string>;
  note: string;
  familyCount?: number;
  familyNote?: string;
  updatedAt: number;
};
export type VoteDraft = {
  planId: string;
  preferences: Record<string, string>;
  note: string;
  bringingFamily: boolean;
  familyCount: number;
  familyNote: string;
};
export const emptyDraft: VoteDraft = { planId: "", preferences: {}, note: "", bringingFamily: false, familyCount: 0, familyNote: "" };
export function voteDraftFromDetails(details: VoteDetails): VoteDraft {
  const count = details.familyCount ?? 0;
  const familyCount = Number.isSafeInteger(count) && count > 0 ? count : 0;
  return { planId: details.planId, preferences: details.preferences || {}, note: details.note || "", bringingFamily: familyCount > 0, familyCount, familyNote: familyCount > 0 ? details.familyNote || "" : "" };
}
export function prepareVoteDetails(plan: TripPlan, draft: VoteDraft): Omit<VoteDetails, "updatedAt"> {
  if (draft.note.length > 1000) throw new Error("方案備註請控制在 1000 字以內。");
  if (draft.bringingFamily && (!Number.isSafeInteger(draft.familyCount) || draft.familyCount < 1))
    throw new Error("請填寫家眷總人數，至少 1 位，不包含你自己。");
  if (draft.bringingFamily && draft.familyNote.length > 1000) throw new Error("家眷備註請控制在 1000 字以內。");
  return {
    planId: draft.planId, preferences: cleanPreferences(plan, draft.preferences), note: draft.note.trim(),
    familyCount: draft.bringingFamily ? draft.familyCount : 0,
    familyNote: draft.bringingFamily ? draft.familyNote.trim() : "",
  };
}
export function sortedGroups(plan: TripPlan) {
  return Object.entries(plan.groups || {}).sort(([, a], [, b]) =>
    (Number.isFinite(a.order) ? a.order! : Number.MAX_SAFE_INTEGER) -
    (Number.isFinite(b.order) ? b.order! : Number.MAX_SAFE_INTEGER));
}
export function sortedPlans(catalog: Catalog) {
  return Object.entries(catalog.plans || {}).sort(
    (a, b) => a[1].order - b[1].order,
  );
}
export function isVotingOpen(catalog: Catalog, now = Date.now()) {
  return (
    catalog.settings.votingOpen &&
    (!catalog.settings.closesAt || now < catalog.settings.closesAt)
  );
}
export function deadlineLabel(value: number) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}
export function initials(name: string) {
  return Array.from(name || "旅")
    .slice(0, 2)
    .join("");
}
export function cleanPreferences(
  plan: TripPlan,
  values: Record<string, string>,
) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([group, choice]) => !!plan.groups?.[group]?.choices?.[choice],
    ),
  );
}

export type VoteChange = "new" | "unchanged" | "switch" | "details";
/** Compare what will actually be saved, rather than whether a field was ever touched. */
export function getVoteChange(plan: TripPlan, draft: VoteDraft, savedPlanId?: string | null, savedDetails?: VoteDetails | null): VoteChange {
  if (!savedPlanId) return "new";
  if (draft.planId !== savedPlanId) return "switch";
  if (!savedDetails || savedDetails.planId !== savedPlanId) return "details";
  try {
    const next = prepareVoteDetails(plan, draft);
    const previous = prepareVoteDetails(plan, voteDraftFromDetails(savedDetails));
    const preferenceKey = (values: Record<string, string> = {}) => JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)));
    return next.note === previous.note && next.familyCount === previous.familyCount && next.familyNote === previous.familyNote && preferenceKey(next.preferences) === preferenceKey(previous.preferences) ? "unchanged" : "details";
  } catch {
    // Incomplete inputs remain editable; submission still uses prepareVoteDetails validation.
    return "details";
  }
}
