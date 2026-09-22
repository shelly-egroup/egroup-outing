import { deadlineLabel } from "@/lib/trips";
import { getVoteCountdown } from "@/lib/vote-countdown";

export default function VoteCountdown({ closesAt, now, votingEnabled }: { closesAt: number; now: number; votingEnabled: boolean }) {
  const countdown = getVoteCountdown(closesAt, now, votingEnabled);
  if (!countdown) return null;
  const units = [
    { label: "天", value: countdown.days },
    { label: "時", value: countdown.hours },
    { label: "分", value: countdown.minutes },
    { label: "秒", value: countdown.seconds },
  ];
  const remainingLabel = "距離投票截止還有 " + units.map(unit => unit.value + unit.label).join(" ");
  return <div className="vote-countdown" data-state={countdown.state}>
    <div className="countdown-heading">
      <span><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></svg>{countdown.state === "closed" ? "投票截止" : countdown.state === "urgent" ? "把握最後時間" : "截止倒數"}</span>
      <time dateTime={new Date(closesAt).toISOString()}>{deadlineLabel(closesAt)} 截止</time>
    </div>
    {countdown.state === "closed" ? <strong className="countdown-closed" role="status">投票已截止</strong> : <div className="countdown-digits" role="timer" aria-live="off" aria-label={remainingLabel}>
      {units.map(unit => <span className="countdown-unit" key={unit.label} aria-hidden="true"><b><span key={unit.value}>{String(unit.value).padStart(2, "0")}</span></b><small>{unit.label}</small></span>)}
    </div>}
  </div>;
}
