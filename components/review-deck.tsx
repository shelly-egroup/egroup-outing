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
 * The venue's Google reviews right on the page: the rating and count, then every review the site has captured (the newest
 * five), each in full, and a clear way to the rest of them on Google Maps.
 */
export default function ReviewDeck({ id }: { id?: string }) {
  const { stores } = useOuting();
  const snapshot = id ? stores[id]?.reviews : undefined;
  if (!snapshot) return null;
  const reviews = snapshot.reviews;
  const captured = new Date(snapshot.capturedAt);
  const safe = /^https:\/\/www\.google\.com\//.test(snapshot.sourceUrl);
  const total = snapshot.reviewCount.toLocaleString("zh-TW");
  return <div className="reviews">
    <div className="reviews-head">
      <p className="reviews-score"><b>{snapshot.rating.toFixed(1)}</b><Stars value={snapshot.rating} /><span>Google・{total} 則評論</span></p>
      <p className="reviews-note">{!Number.isNaN(captured.getTime()) ? `最新 ${reviews.length} 則・擷取於 ${captured.getMonth() + 1}/${captured.getDate()}` : `最新 ${reviews.length} 則`}</p>
    </div>
    {reviews.length > 0 && <ul className="reviews-list">
      {reviews.map((review, index) => <li key={index} className="review">
        <p className="review-meta"><strong>{review.author}</strong><Stars value={review.rating} /><span>{review.relativeTimeAtCapture}</span></p>
        {review.text?.trim() ? <p className="review-text">{review.text.trim()}</p> : <p className="review-text is-empty">只留下星等，沒有文字</p>}
      </li>)}
    </ul>}
    {safe && <a className="reviews-all" href={snapshot.sourceUrl} target="_blank" rel="noopener noreferrer">
      <span>其餘評論在 Google 地圖</span><b>看全部 {total} 則 ↗</b><span className="sr-only">（另開分頁）</span>
    </a>}
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
