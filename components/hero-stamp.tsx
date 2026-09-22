"use client";
import { useEffect, useRef, useState } from "react";

export default function HeroStamp({ active }: { active: boolean }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [stamped, setStamped] = useState(false);

  useEffect(() => {
    setStamped(false);
    const node = anchor.current;
    if (!active || !node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio >= .6) setStamped(true);
      else if (!entry.isIntersecting) setStamped(false);
    }, { threshold: [0, .6], rootMargin: "-120px 0px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);

  return <div ref={anchor} className={"hero-art-stamp" + (stamped ? " is-stamped" : "")}>
    <div className="hero-art-badge">
      <span>秋遊</span>
      <b>對決中</b>
    </div>
  </div>;
}
