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
    // Reveal once the top clears the bottom 8% of the screen, or once the item is fully on screen:
    // a short line at the very end of the page may never clear that band.
    const observer = new IntersectionObserver(entries => {
      const entering = entries.filter(entry => entry.isIntersecting &&
        (entry.intersectionRatio > .98 || entry.boundingClientRect.top < window.innerHeight * .92)).map(entry => entry.target);
      entering.forEach((el, i) => {
        (el as HTMLElement).style.setProperty("--reveal-delay", Math.min(i, 5) * 80 + "ms");
        el.classList.add("is-revealed");
        observer.unobserve(el);
      });
    }, { threshold: [0, .05, .1, .2, .35, .5, .75, .99] });
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
    // At the end of the page nothing can scroll further, so whatever is on screen is shown.
    const atEnd = () => {
      if (window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 4) return;
      page.querySelectorAll(".reveal-item:not(.is-revealed)").forEach(el => {
        if (el.getBoundingClientRect().top >= window.innerHeight) return;
        el.classList.add("is-revealed");
        observer.unobserve(el);
      });
    };
    window.addEventListener("scroll", atEnd, { passive: true });
    return () => { observer.disconnect(); mutations.disconnect(); window.removeEventListener("scroll", atEnd); };
  }, [root, enabled]);
}
