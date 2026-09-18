"use client";
import { useEffect, useRef, useState } from "react";
export default function VersusBadge() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const inset = Math.round(window.innerHeight * .1);
    const entrance = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true);
    }, { threshold: .5, rootMargin: "-" + inset + "px 0px -" + inset + "px 0px" });
    // Rearm only after leaving the screen, so a small scroll cannot cut the impact short.
    const exit = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) setVisible(false);
    });
    entrance.observe(node);
    exit.observe(node);
    return () => { entrance.disconnect(); exit.disconnect(); };
  }, []);
  return <div ref={ref} className={"plan-versus" + (visible ? " is-visible" : "")} aria-hidden="true">
    <i className="versus-streak streak-blue" /><i className="versus-streak streak-pink" />
    <span className="versus-shockwave" />
    <div className="versus-emblem"><span>VS</span></div>
  </div>;
}
