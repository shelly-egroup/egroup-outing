import type { TripPlan } from "@/lib/trips";

export default function VotePlanSummary({ plan }: { plan: TripPlan }) {
  const firstStop = plan.schedule?.[0];

  return <div className="review-plan">
    <span className="team-label">{plan.code} · {plan.shortName}</span>
    <strong className="review-plan-title">{plan.title}</strong>
    <p className="review-plan-description">{plan.description}</p>
    {firstStop && <div className="review-plan-start" aria-label={`行程第一站：${firstStop.time} ${firstStop.title}`}>
      <strong>{firstStop.time}</strong>
      <span>{firstStop.title}</span>
    </div>}
  </div>;
}
