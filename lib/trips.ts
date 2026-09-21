export type Choice = { label: string; description: string; price: string };
export type ChoiceGroup = { label: string; choices: Record<string, Choice>; selectionMode?: "group" | "individual" };
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
