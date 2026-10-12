"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Scroll-in animations that play every time: `inView` turns true when the element comes on screen (past `rootMargin`) and
 * false again only once it has left the screen completely, so scrolling back to it replays the animation. `round` counts the
 * entrances — use it as a React key to restart animations that cannot simply be switched off and on. With reduced motion the
 * element is simply in view.
 */
export function useInView<T extends Element>(rootMargin = "0px 0px -15% 0px") {
  const ref = useRef<T>(null), [state, setState] = useState({ inView: false, round: 0 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setState({ inView: true, round: 1 }); return; }
    const enter = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setState(s => s.inView ? s : { inView: true, round: s.round + 1 }); }, { rootMargin });
    const leave = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) setState(s => s.inView ? { ...s, inView: false } : s); });
    enter.observe(el); leave.observe(el);
    return () => { enter.disconnect(); leave.disconnect(); };
  }, [rootMargin]);
  return [ref, state.inView, state.round] as const;
}
