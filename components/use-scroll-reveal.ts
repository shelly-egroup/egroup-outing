"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Ignore scroll jitter (and iOS bounce) below this distance.
const SCROLL_INTENT_PX = 12;

/**
 * Floating controls that stay out of the way while reading: revealed when the
 * visitor scrolls up (looking for navigation), hidden on scroll down or after idle.
 */
export function useScrollReveal(enabled: boolean, idleMs: number, keepOpen?: () => boolean) {
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepOpenRef = useRef(keepOpen);
  keepOpenRef.current = keepOpen;

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const wake = useCallback(() => {
    clear();
    setRevealed(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!keepOpenRef.current?.()) setRevealed(false);
    }, idleMs);
  }, [idleMs]);

  useEffect(() => {
    if (!enabled) { clear(); setRevealed(false); return; }
    let anchor = window.scrollY;
    const onScroll = () => {
      const delta = window.scrollY - anchor;
      if (Math.abs(delta) < SCROLL_INTENT_PX) return;
      anchor = window.scrollY;
      if (delta < 0) wake();
      else if (!keepOpenRef.current?.()) { clear(); setRevealed(false); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); clear(); };
  }, [enabled, wake]);

  return [enabled && revealed, wake] as const;
}
