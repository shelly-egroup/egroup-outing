"use client";
import { useEffect, useRef, useState } from "react";
import { interpolateScore, scoreDelta, type ScoreValue } from "../lib/score-motion";

export function useScoreMotion(count: number, percent: number, active: boolean, available: boolean) {
  const [display, setDisplay] = useState<ScoreValue>({ count: 0, percent: 0 });
  const [hit, setHit] = useState({ revision: 0, delta: 0 });
  const current = useRef(display);
  const previous = useRef<ScoreValue | null>(null);
  const wasActive = useRef(false);
  useEffect(() => {
    const target = { count, percent };
    const before = previous.current;
    const entering = active && !wasActive.current;
    wasActive.current = active;
    previous.current = available ? target : null;
    function show(value: ScoreValue) { current.current = value; setDisplay(value); }
    if (!available || !active) {
      show(available ? target : { count: 0, percent: 0 });
      setHit(hit => ({ ...hit, delta: 0 }));
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { show(target); setHit(hit => ({ ...hit, delta: 0 })); return; }
    // An effect can restart after its animation was cancelled (Strict Mode / refresh).
    // Matching targets do not mean the visible score has reached that target.
    if (!entering && before?.count === count && before?.percent === percent && current.current.count === count && current.current.percent === percent) return;
    const from = entering || !before ? { count: 0, percent: 0 } : current.current;
    show(from);
    setHit(hit => ({ revision: hit.revision + 1, delta: scoreDelta(before?.count ?? null, count, entering) }));
    const duration = entering ? 1050 : 720;
    let frame = 0;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      show(interpolateScore(from, target, progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [count, percent, active, available]);
  return { ...display, ...hit };
}
