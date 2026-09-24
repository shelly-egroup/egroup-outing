"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { StoreReviewSnapshot } from "@/lib/store-reviews";
import { reviewTimeFromNow } from "@/lib/review-time";

export default function StoreReviews({ snapshot, compact = false, tone = "yellow" }: { snapshot: StoreReviewSnapshot; compact?: boolean; tone?: "yellow" | "coral" }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [open]);
  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
    };
  }, [open]);
  const capturedDate = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(snapshot.capturedAt));

  return <>
    <button ref={trigger} type="button" className={"store-review-trigger" + (compact ? " is-compact" : "")} onClick={() => { setNow(Date.now()); setOpen(true); }} aria-haspopup="dialog" aria-label={`${snapshot.storeName} Google 評分 ${snapshot.rating} 分，${snapshot.reviewCount} 則評價，查看評論`}>
      <span className="store-rating-copy">
        <span className="store-rating-line"><span className="store-rating-star" aria-hidden="true">★</span><b>{snapshot.rating.toFixed(1)}</b><span>Google</span><span className="store-rating-count">{snapshot.reviewCount.toLocaleString("en-US")} 則評價</span></span>
        {!compact && <small><time dateTime={snapshot.capturedAt}>{capturedDate}</time> 擷取</small>}
      </span>
      <span className="store-reviews-toggle">{!compact && "看評論"}<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg></span>
    </button>
    {open && createPortal(<dialog ref={dialog} className="store-reviews-dialog" data-team-tone={tone} aria-labelledby={titleId} onCancel={() => setOpen(false)} onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
    <header className="store-reviews-header"><div><span className="eyebrow">GOOGLE REVIEWS</span><h2 id={titleId}>{snapshot.storeName}</h2><p><span className="store-rating-star" aria-hidden="true">★</span> <b>{snapshot.rating.toFixed(1)}</b><span> · {snapshot.reviewCount.toLocaleString("en-US")} 則評價</span></p><small><time dateTime={snapshot.capturedAt}>{capturedDate}</time> 擷取・每日更新</small></div><button type="button" className="store-reviews-close" aria-label="關閉評論" onClick={() => setOpen(false)} autoFocus><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></header>
    <div className="store-reviews-content" tabIndex={0} aria-label="最新五則評論內容">
      <p className="store-reviews-note">擷取當時最新 {snapshot.reviews.length} 則，依 Google「最新」排序。評論時間已換算至現在，依 Google 資料估算。</p>
      <ol className="store-review-list">
        {snapshot.reviews.map(review => <li key={review.authorUrl}>
          <div className="store-review-heading">
            <a href={review.authorUrl} target="_blank" rel="noopener noreferrer" aria-label={`${review.author} 的 Google 評論（另開分頁）`}>{review.author}</a>
            <span className="store-review-stars" role="img" aria-label={`${review.rating} 顆星，滿分 5 顆星`}><span aria-hidden="true">{"★".repeat(review.rating)}<span className="empty-stars">{"☆".repeat(5 - review.rating)}</span></span></span>
          </div>
          <small className="store-review-time" title={`${capturedDate} 擷取時，Google 標示：${review.relativeTimeAtCapture}`}>{reviewTimeFromNow(review.relativeTimeAtCapture, snapshot.capturedAt, now)}</small>
          {review.text ? <blockquote>{review.text}{review.excerpt && "…"}</blockquote> : <p className="store-review-empty">這位顧客只留下評分。</p>}
          {(review.translated || review.excerpt) && <small className="store-review-attribution">{[review.translated && "Google 翻譯", review.excerpt && "節錄"].filter(Boolean).join("・")}{review.excerpt && <> · <a href={review.authorUrl} target="_blank" rel="noopener noreferrer">查看全文<span className="sr-only">（另開分頁）</span></a></>}</small>}
        </li>)}
      </ol>
    </div>
    <footer className="store-reviews-footer"><span>來源：Google 公開評論</span><a href={snapshot.sourceUrl} target="_blank" rel="noopener noreferrer">到 Google 看更多評論 ↗<span className="sr-only">（另開分頁）</span></a></footer>
    </dialog>, document.body)}
  </>;
}
