"use client";
import { useEffect } from "react";

const TARGETS = [
  ".journey > li",
  "#plans .section-heading",
  ".plan-grid > .plan-card",
  "#selection .section-heading",
  ".quick-plan-option",
  ".plan-draw-panel",
  ".selection-hint",
  "#results",
  ".site-footer-inner > *",
].join(",");

/** Staggered entrance as content scrolls in; content stays visible if this never runs. */
export function useSectionReveal(root: React.RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const page = root.current;
    if (!enabled || !page || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver(entries => {
      const entering = entries.filter(entry => entry.isIntersecting).map(entry => entry.target);
      entering.forEach((el, i) => {
        (el as HTMLElement).style.setProperty("--reveal-delay", Math.min(i, 5) * 80 + "ms");
        el.classList.add("is-revealed");
        observer.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    const scan = () => page.querySelectorAll(TARGETS).forEach(el => {
      if (seen.has(el)) return;
      seen.add(el);
      // Anything already above the fold appears instantly, so nothing the visitor is reading blinks out.
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
      el.classList.add("reveal-item");
      observer.observe(el);
    });
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(page, { childList: true, subtree: true });
    return () => { observer.disconnect(); mutations.disconnect(); };
  }, [root, enabled]);
}
