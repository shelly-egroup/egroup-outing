"use client";
import { useEffect, useState } from "react";
import { useOuting } from "./outing-provider";
import type { ChoiceCountSummary } from "@/lib/vote-summary";

function Stars({ value }: { value: number }) {
  return <span className="stars" role="img" aria-label={"評分 " + value.toFixed(1) + " 顆星"}>
    {[0, 1, 2, 3, 4].map(i => <i key={i} style={{ "--fill": Math.max(0, Math.min(1, value - i)) } as React.CSSProperties} />)}
  </span>;
}

/**
 * The venue's Google reviews as field reports: a score panel — the rating, the count, the way to every review on Google Maps —
 * beside the newest reviews the site has captured, each in full as a quote; reviews that left only stars share one line.
 */
export default function ReviewDeck({ id }: { id?: string }) {
  const { stores } = useOuting();
  const snapshot = id ? stores[id]?.reviews : undefined;
  if (!snapshot) return null;
  const written = snapshot.reviews.filter(review => review.text?.trim()), starsOnly = snapshot.reviews.filter(review => !review.text?.trim());
  const captured = new Date(snapshot.capturedAt);
  const safe = /^https:\/\/www\.google\.com\//.test(snapshot.sourceUrl);
  const total = snapshot.reviewCount.toLocaleString("zh-TW");
  return <div className="reviews">
    <div className="reviews-score">
      <span className="ms-label">FIELD SCORE</span>
      <p className="reviews-rating"><b>{snapshot.rating.toFixed(1)}</b><span>/ 5</span></p>
      <Stars value={snapshot.rating} />
      <p className="reviews-count"><b>{total}</b> 則 Google 評論</p>
      {safe && <a className="reviews-all" href={snapshot.sourceUrl} target="_blank" rel="noopener noreferrer">看全部評論<span aria-hidden="true">↗</span><span className="sr-only">（另開分頁）</span></a>}
      <p className="reviews-note">{!Number.isNaN(captured.getTime()) ? `這裡是最新 ${snapshot.reviews.length} 則，擷取於 ${captured.getMonth() + 1}/${captured.getDate()}` : `這裡是最新 ${snapshot.reviews.length} 則`}</p>
    </div>
    <div className="reviews-feed">
      {written.length > 0 && <ol className="reviews-list">
        {written.map((review, index) => <li key={index} className="review">
          <span className="review-no" aria-hidden="true">REPORT {String(index + 1).padStart(2, "0")}</span>
          <blockquote className="review-text">{review.text.trim()}</blockquote>
          <p className="review-meta"><span className="review-by" aria-hidden="true">{[...(review.author || "?")][0]}</span><strong>{review.author}</strong><Stars value={review.rating} /><span>{review.relativeTimeAtCapture}</span></p>
        </li>)}
      </ol>}
      {starsOnly.length > 0 && <p className="reviews-stars-only"><span>另有 {starsOnly.length} 位只留星等</span>{starsOnly.map((review, index) => <span key={index} className="reviews-chip"><strong>{review.author}</strong><Stars value={review.rating} /></span>)}</p>}
    </div>
  </div>;
}

/**
 * The leading choice(s) of a preference group, from the anonymous tally (`/api/choice-results`): the choice ids with the
 * highest count (more than one only on a tie). No counts are shown on the page.
 */
export function useTopChoice(planId: string | undefined, groupId: string | undefined) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; choiceIds: string[] }>({ status: "loading", choiceIds: [] });
  useEffect(() => {
    if (!planId || !groupId) { setState({ status: "error", choiceIds: [] }); return; }
    // local preview without the database: ?topTea=<choice id>
    const preview = process.env.NODE_ENV === "development" ? new URLSearchParams(window.location.search).get("topTea") : null;
    if (preview) { setState({ status: "ready", choiceIds: [preview] }); return; }
    let alive = true;
    fetch("/api/choice-results", { cache: "no-store" })
      .then(response => response.ok ? response.json() as Promise<ChoiceCountSummary> : Promise.reject(new Error("unavailable")))
      .then(summary => {
        const group = summary.plans?.[planId]?.find(item => item.id === groupId);
        const high = group ? Math.max(0, ...group.choices.map(choice => choice.count)) : 0;
        const choiceIds = group && high > 0 ? group.choices.filter(choice => choice.count === high).map(choice => choice.id) : [];
        if (alive) setState(choiceIds.length ? { status: "ready", choiceIds } : { status: "error", choiceIds: [] });
      })
      .catch(() => { if (alive) setState({ status: "error", choiceIds: [] }); });
    return () => { alive = false; };
  }, [planId, groupId]);
  return state;
}
