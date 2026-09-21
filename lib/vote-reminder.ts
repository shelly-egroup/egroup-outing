import type { TripPlan } from "./trips";

type Input = { ready: boolean; hasVoted: boolean; savedPlan?: TripPlan; draftPlan?: TripPlan; hasChanges: boolean };
export function voteReminder({ ready, hasVoted, savedPlan, draftPlan, hasChanges }: Input) {
  const target = hasVoted || draftPlan ? "#selection" : "#plans";
  if (!ready) return { label: "同步中", status: "正在讀取", code: "…", tone: "none", message: "你的一票，決定秋遊去哪！", pending: false, target };
  if (hasVoted) return {
    label: savedPlan?.shortName || "已投票", code: savedPlan?.code || "✓", tone: savedPlan?.color || "none",
    status: hasChanges ? "變更未儲存" : "已投票",
    message: "你已投給 " + (savedPlan ? savedPlan.code + "・" + savedPlan.shortName : "原方案") + (hasChanges ? "，新選擇還沒送出，記得確認更新" : "，截止前都能修改選擇"),
    pending: hasChanges, target,
  };
  return {
    label: "尚未投票", code: "?", tone: draftPlan?.color || "none",
    status: draftPlan ? "已選 " + draftPlan.code + "・待送出" : "選個陣營吧",
    message: draftPlan ? "你已選擇 " + draftPlan.code + "・" + draftPlan.shortName + "，記得送出這一票" : "選好陣營，記得送出你的一票",
    pending: !!draftPlan, target,
  };
}
export type VoteReminder = ReturnType<typeof voteReminder>;
