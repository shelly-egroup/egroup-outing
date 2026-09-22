export type VoteCountdown = {
  state: "running" | "urgent" | "closed";
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function getVoteCountdown(closesAt: number, now: number, votingEnabled: boolean): VoteCountdown | null {
  if (!Number.isFinite(closesAt) || closesAt <= 0 || !Number.isFinite(new Date(closesAt).getTime()) || !Number.isFinite(now)) return null;
  const remaining = votingEnabled ? Math.max(0, closesAt - now) : 0;
  const totalSeconds = Math.ceil(remaining / 1000);
  return {
    state: remaining === 0 ? "closed" : remaining <= 86_400_000 ? "urgent" : "running",
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor(totalSeconds / 3600) % 24,
    minutes: Math.floor(totalSeconds / 60) % 60,
    seconds: totalSeconds % 60,
  };
}
