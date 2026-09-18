export type Choice = { label: string; description: string; price: string };
export type ChoiceGroup = { label: string; choices: Record<string, Choice> };
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
  updatedAt: number;
};
export type VoteDraft = {
  planId: string;
  preferences: Record<string, string>;
  note: string;
};
export const emptyDraft: VoteDraft = { planId: "", preferences: {}, note: "" };
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
