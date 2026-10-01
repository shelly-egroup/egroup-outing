"use client";

import { activeReviewStoreIds, isCurrentItineraryReview } from "@/lib/store-directory";
import { useOuting } from "./outing-provider";
import StoreReviews from "./store-reviews";

export default function VenueReviews({ id, tone, compact = true }: { id: string; tone: "yellow" | "coral"; compact?: boolean }) {
  const { stores } = useOuting();
  if (!activeReviewStoreIds.some(active => active === id)) return null;
  const record = stores[id];
  if (!record) return null;
  if (isCurrentItineraryReview(record.reviews)) return <StoreReviews snapshot={record.reviews} tone={tone} compact={compact} />;

  const url = record.info.mapsUrl || "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(record.info.mapsQuery);
  return <a className={"store-review-trigger is-external" + (compact ? " is-compact" : "")} href={url} target="_blank" rel="noopener noreferrer" aria-label={record.info.name + "，到 Google 查看評論（另開分頁）"}>
    <span className="store-rating-copy"><span className="store-rating-line"><span className="store-rating-star" aria-hidden="true">★</span><b>Google 評論</b></span><small>本站最新評論整理中，先到 Google 查看</small></span>
    <span className="store-reviews-toggle">↗</span>
  </a>;
}
