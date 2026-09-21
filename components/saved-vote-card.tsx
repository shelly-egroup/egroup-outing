import type { TripPlan } from "@/lib/trips";
export default function SavedVoteCard({ plan, justSaved, changingSide, pendingChanges, connected }: { plan?: TripPlan; justSaved: boolean; changingSide: boolean; pendingChanges: boolean; connected: boolean }) {
  return <div className={"vote-receipt" + (justSaved ? " just-saved" : "")} data-team-tone={plan?.color || "yellow"} role="status" aria-live="polite" aria-atomic="true">
    <div className="vote-receipt-top"><span className="vote-receipt-check" aria-hidden="true">✓</span><strong>{justSaved ? "這一票，收到了！" : "你的這一票"}</strong><span className="vote-receipt-state">已儲存</span></div>
    <div className="vote-receipt-team"><span aria-hidden="true">{plan?.code || "—"}</span><div><b>{plan?.shortName || "原方案"}</b><p>{plan?.title || "已下架方案"}</p></div></div>
    <p className="vote-receipt-foot">{changingSide ? "目前票數仍計在這一派，確認改票後才會更新。" : pendingChanges ? "新偏好尚未儲存，按「更新選擇」後才會更新。" : connected ? "已加入陣營，戰況即時同步。" : "這是上次儲存的選擇，連線恢復後會同步戰況。"}</p>
  </div>;
}
