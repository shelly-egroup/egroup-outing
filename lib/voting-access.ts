export type VoteReview = {
  status: "approved" | "rejected";
  email: string;
  reviewedBy: string;
  reviewedAt: number;
};
export type RegisteredUser = {
  email: string;
  displayName: string;
  photoURL: string;
  role: string;
  createdAt: number;
  updatedAt: number;
  voteReview?: VoteReview;
};
export type VotingAccess = "automatic" | "approved" | "pending" | "rejected";
export const votingAccessLabels: Record<VotingAccess, string> = {
  automatic: "公司帳號", approved: "審核通過", pending: "待審核", rejected: "未通過",
};
export function normalizedEmail(email: string | null | undefined) { return (email || "").trim().toLowerCase(); }
export function isCompanyAccount(email: string | null | undefined) {
  return /^egroup\.[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail(email));
}
export function getVotingAccess(email: string | null | undefined, review?: VoteReview | null): VotingAccess {
  if (isCompanyAccount(email)) return "automatic";
  if (normalizedEmail(email) && normalizedEmail(review?.email) === normalizedEmail(email)) {
    if (review?.status === "approved" || review?.status === "rejected") return review.status;
  }
  return "pending";
}
export function isVotingAllowed(access: VotingAccess) { return access === "automatic" || access === "approved"; }
export function votingAccessMessage(access: VotingAccess) {
  return access === "rejected" ? "這個帳號尚未通過審核，請聯絡主辦人，或改用 egroup. 開頭的 Google 帳號。" : "已送交主辦人審核，通過後這裡會自動開放投票。你可以先看方案、選好偏好。";
}
