"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Who = "a" | "b";
type Spot = "left" | "right" | "far";
type Target = { id: number; who: Who; spot: Spot; state: "up" | "hit" | "gone" };
const SPRITE = (who: Who, pose: "aim" | "hit") => `/assets/mission/duel/${who}-${pose}.webp`;
/** How long a captain stays up, and the quiet between appearances (ms). */
const UP_MS = [1500, 2300], GAP_MS = [2600, 6200];
const rand = ([a, b]: number[]) => a + Math.random() * (b - a);

/**
 * An easter egg in the arena's surveillance feed: now and then a captain leans out from behind cover — from either edge, or
 * far down the corridor — and a tap or click fires the laser at them. A hit flashes them, throws sparks and knocks them back
 * out of frame; the feed keeps count. Only while the feed is on screen, and never with reduced motion.
 */
export default function ReconTargets() {
  const box = useRef<HTMLDivElement>(null), fx = useRef<HTMLDivElement>(null), sprite = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<Target | null>(null), [hits, setHits] = useState(0), [hint, setHint] = useState(false);
  const [live, setLive] = useState(false), [visible, setVisible] = useState(false);
  const shown = useRef(0), serial = useRef(0);

  useEffect(() => {
    const el = box.current; if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setLive(true);
    for (const who of ["a", "b"] as Who[]) for (const pose of ["aim", "hit"] as const) { const i = new Image(); i.src = SPRITE(who, pose); }
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .45 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // the next captain: from the left edge (red), the right edge (blue) or far down the corridor (either)
  useEffect(() => {
    if (!live || !visible || target) return;
    const timer = setTimeout(() => {
      const roll = Math.random(), spot: Spot = roll < .4 ? "left" : roll < .8 ? "right" : "far";
      const who: Who = spot === "left" ? "a" : spot === "right" ? "b" : Math.random() < .5 ? "a" : "b";
      setTarget({ id: ++serial.current, who, spot, state: "up" });
      if (shown.current++ === 0) { setHint(true); setTimeout(() => setHint(false), 3200); }
    }, shown.current === 0 ? 1600 : rand(GAP_MS));
    return () => clearTimeout(timer);
  }, [live, visible, target]);
  // unanswered, they duck back into cover
  useEffect(() => {
    if (!target || target.state !== "up") return;
    const timer = setTimeout(() => setTarget(t => t && t.id === target.id ? { ...t, state: "gone" } : t), rand(UP_MS) + (target.spot === "far" ? 300 : 0));
    return () => clearTimeout(timer);
  }, [target]);
  useEffect(() => {
    if (!target || target.state === "up") return;
    const timer = setTimeout(() => setTarget(t => t && t.id === target.id ? null : t), target.state === "hit" ? 900 : 380);
    return () => clearTimeout(timer);
  }, [target]);

  /** Transient effects (beam, flash, sparks, labels) are plain elements that animate once and remove themselves. */
  const burst = useCallback((cls: string, x: number, y: number, keyframes: Keyframe[], options: KeyframeAnimationOptions, style: Partial<CSSStyleDeclaration> = {}) => {
    const layer = fx.current; if (!layer) return;
    const e = document.createElement("i"); e.className = cls; Object.assign(e.style, { left: x + "px", top: y + "px", ...style });
    layer.appendChild(e); e.animate(keyframes, options).finished.then(() => e.remove(), () => e.remove());
  }, []);

  function fire(event: React.PointerEvent<HTMLDivElement>) {
    const el = box.current; if (!el || !live) return;
    const r = el.getBoundingClientRect(), x = event.clientX - r.left, y = event.clientY - r.top;
    // the shot: from the gun at the bottom of the frame to where it was aimed
    const gx = r.width / 2, gy = r.height + 6, len = Math.hypot(x - gx, y - gy), ang = Math.atan2(y - gy, x - gx);
    burst("rt-beam", gx, gy, [{ opacity: 1, transform: `rotate(${ang}rad) scaleX(0)` }, { opacity: 1, transform: `rotate(${ang}rad) scaleX(1)`, offset: .25 }, { opacity: 0, transform: `rotate(${ang}rad) scaleX(1)` }], { duration: 220, easing: "ease-out" }, { width: len + "px" });
    burst("rt-muzzle", gx, r.height - 4, [{ opacity: 1, transform: "translate(-50%, -50%) scale(.6)" }, { opacity: 0, transform: "translate(-50%, -50%) scale(1.6)" }], { duration: 220, easing: "ease-out" });
    const body = sprite.current?.getBoundingClientRect();
    const hit = target?.state === "up" && body && event.clientX > body.left + body.width * .18 && event.clientX < body.right - body.width * .18 && event.clientY > body.top + body.height * .04 && event.clientY < body.bottom;
    if (hit && target) {
      setTarget({ ...target, state: "hit" }); setHits(h => h + 1);
      burst("rt-flash", x, y, [{ opacity: .95, transform: "translate(-50%, -50%) scale(.3)" }, { opacity: 0, transform: "translate(-50%, -50%) scale(2.4)" }], { duration: 380, easing: "ease-out" });
      for (let k = 0; k < 14; k++) {
        const a = Math.random() * Math.PI * 2, d = 26 + Math.random() * 60;
        burst("rt-spark", x, y, [{ opacity: 1, transform: "translate(-50%, -50%)" }, { opacity: 0, transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 18}px)) scale(.4)` }], { duration: 420 + Math.random() * 260, easing: "cubic-bezier(.2, .7, .4, 1)" });
      }
      burst("rt-score", x, y - 18, [{ opacity: 0, transform: "translate(-50%, 0) scale(.6)" }, { opacity: 1, transform: "translate(-50%, -16px) scale(1.1)", offset: .2 }, { opacity: 0, transform: "translate(-50%, -46px) scale(1)" }], { duration: 900, easing: "ease-out" });
    } else {
      // a miss ricochets off the maze
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (Math.random() - .5) * 2.2, d = 10 + Math.random() * 22;
        burst("rt-spark is-miss", x, y, [{ opacity: 1, transform: "translate(-50%, -50%)" }, { opacity: 0, transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px))` }], { duration: 260 + Math.random() * 160, easing: "ease-out" });
      }
    }
  }

  return <div ref={box} className="rt" data-live={live} aria-hidden="true" onPointerDown={fire}>
    {target && <div key={target.id} className={`rt-target is-${target.spot} is-${target.who}`} data-state={target.state}>
      <div ref={sprite} className="rt-sprite">
        <img src={SPRITE(target.who, target.state === "hit" ? "hit" : "aim")} alt="" draggable={false} />
        <span className="rt-lock"><i /><i /><i /><i /></span>
      </div>
    </div>}
    <div ref={fx} className="rt-fx" />
    {live && <span className="rt-hits">HITS <b>{String(hits).padStart(2, "0")}</b></span>}
    {hint && <span className="rt-hint"><i />偵測到目標・點擊射擊</span>}
  </div>;
}
