"use client";
import { useEffect } from "react";

const GAP_PX = 16;

/**
 * A sticky side panel that may be taller than the window, without an inner scrollbar:
 * it scrolls with the page until its far edge is in view, then holds there; scrolling
 * back the other way reveals the near edge the same way. A panel that fits simply
 * sticks under the header.
 */
export function useTallSticky(panel: HTMLElement | null, query = "(min-width: 821px)") {
  useEffect(() => {
    if (!panel) return;
    const media = window.matchMedia(query);
    const headerOffset = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--outing-header-offset")) || 24;
    let top = headerOffset(), lastY = window.scrollY;
    function place(delta: number) {
      if (!media.matches) { panel!.style.removeProperty("top"); return; }
      const highest = headerOffset();
      const lowest = Math.min(highest, window.innerHeight - panel!.offsetHeight - GAP_PX);
      top = Math.min(highest, Math.max(lowest, top - delta));
      panel!.style.top = top + "px";
    }
    const scroll = () => { const y = window.scrollY; place(y - lastY); lastY = y; };
    const settle = () => place(0);
    const size = new ResizeObserver(settle);
    size.observe(panel);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", settle);
    media.addEventListener("change", settle);
    settle();
    return () => {
      size.disconnect();
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", settle);
      media.removeEventListener("change", settle);
      panel.style.removeProperty("top");
    };
  }, [panel, query]);
}
