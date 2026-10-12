"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

type Who = "a" | "b";
type Pose = "aim" | "stand" | "walk";
/**
 * Where a captain can turn up in the CAM-01 picture (positions in % of the feed): leaning out from behind the big pillars,
 * rising from behind the barrel bunkers, standing far down the corridor, or sprinting across the foreground. Each spot has a
 * window (the part of the picture where he is not behind cover), where his feet are, how tall he stands there and the poses
 * that make sense. The sprites face right; `flip` turns them left.
 */
type Spot = { key: string; win: CSSProperties; feet: number; height: number; poses: Pose[]; flip?: boolean; from: "left" | "right" | "below" | "fade" | "run" };
const SPOTS: Spot[] = [
  { key: "pillar-l", win: { left: "16%", top: 0, width: "36%", height: "100%" }, feet: 77, height: 62, poses: ["aim", "stand"], from: "left" },
  { key: "pillar-r", win: { right: "17%", top: 0, width: "36%", height: "100%" }, feet: 85, height: 66, poses: ["aim", "stand"], flip: true, from: "right" },
  { key: "bunker-l", win: { left: "19%", top: 0, width: "22%", height: "44%" }, feet: 136, height: 78, poses: ["aim", "stand"], from: "below" },
  { key: "bunker-r", win: { left: "62%", top: 0, width: "22%", height: "43%" }, feet: 140, height: 80, poses: ["aim", "stand"], flip: true, from: "below" },
  { key: "corridor", win: { left: "43%", top: "28%", width: "14%", height: "26%" }, feet: 92, height: 56, poses: ["stand", "aim"], from: "fade" },
  { key: "dash", win: { left: 0, top: 0, width: "100%", height: "100%" }, feet: 99, height: 74, poses: ["walk"], from: "run" },
];
type Target = { id: number; who: Who; pose: Pose; spot: Spot; flip: boolean; state: "up" | "hit" | "gone" };
const SPRITE = (who: Who, pose: Pose | "hit") => `/assets/mission/duel/${who}-${pose}.webp`;
const RATIO: Record<string, number> = { "a-aim": .57, "a-stand": .255, "a-walk": .52, "a-hit": .398, "b-aim": .548, "b-stand": .287, "b-walk": .496, "b-hit": .439 };
/** How long a captain stays up, and the quiet between appearances (ms). A sprint takes its own time. */
const UP_MS = [1500, 2300], GAP_MS = [2200, 5200], RUN_MS = 1900;
const rand = ([a, b]: number[]) => a + Math.random() * (b - a);
const pick = <T,>(list: T[]) => list[(Math.random() * list.length) | 0];

/**
 * An easter egg in the arena's surveillance feed: now and then a captain turns up — leaning out from behind a pillar, rising
 * from behind the barrels, standing far down the corridor or sprinting across the floor, in a random pose — and a tap or
 * click fires the laser at them. A hit flashes them, throws sparks and knocks them out of the picture; the feed keeps count.
 * Only while the feed is on screen, and never with reduced motion.
 */
export default function ReconTargets() {
  const box = useRef<HTMLDivElement>(null), fx = useRef<HTMLDivElement>(null), sprite = useRef<HTMLImageElement>(null), win = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<Target | null>(null), [hits, setHits] = useState(0), [hint, setHint] = useState(false);
  const [live, setLive] = useState(false), [visible, setVisible] = useState(false);
  const shown = useRef(0), serial = useRef(0), lastSpot = useRef("");

  useEffect(() => {
    const el = box.current; if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setLive(true);
    for (const who of ["a", "b"] as Who[]) for (const pose of ["aim", "stand", "walk", "hit"] as const) { const i = new Image(); i.src = SPRITE(who, pose); }
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .45 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // the next captain: a spot (not the same as last time), a pose that suits it, either boss
  useEffect(() => {
    if (!live || !visible || target) return;
    const timer = setTimeout(() => {
      const spot = pick(SPOTS.filter(s => s.key !== lastSpot.current)); lastSpot.current = spot.key;
      const pose = pick(spot.poses), flip = spot.from === "run" ? Math.random() < .5 : !!spot.flip;
      setTarget({ id: ++serial.current, who: Math.random() < .5 ? "a" : "b", pose, spot, flip, state: "up" });
      if (shown.current++ === 0) { setHint(true); setTimeout(() => setHint(false), 3200); }
    }, shown.current === 0 ? 1500 : rand(GAP_MS));
    return () => clearTimeout(timer);
  }, [live, visible, target]);
  // unanswered, they duck back into cover (a sprinter is simply gone across the frame)
  useEffect(() => {
    if (!target || target.state !== "up") return;
    const timer = setTimeout(() => setTarget(t => t && t.id === target.id ? { ...t, state: "gone" } : t), target.spot.from === "run" ? RUN_MS : rand(UP_MS) + (target.spot.from === "fade" ? 400 : 0));
    return () => clearTimeout(timer);
  }, [target]);
  useEffect(() => {
    if (!target || target.state === "up") return;
    const timer = setTimeout(() => setTarget(t => t && t.id === target.id ? null : t), target.state === "hit" ? 950 : 380);
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
    // a hit lands on the visible body: the sprite's box, trimmed of its transparent edges, inside the spot's window
    const s = sprite.current?.getBoundingClientRect(), w = win.current?.getBoundingClientRect();
    const inBody = s && w && target?.state === "up" && event.clientX > Math.max(s.left + s.width * .14, w.left) && event.clientX < Math.min(s.right - s.width * .14, w.right)
      && event.clientY > Math.max(s.top + s.height * .02, w.top) && event.clientY < Math.min(s.bottom, w.bottom);
    if (inBody && target) {
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

  const t = target, pose = t ? (t.state === "hit" ? "hit" : t.pose) : "aim";
  return <div ref={box} className="rt" data-live={live} aria-hidden="true" onPointerDown={fire}>
    {t && <div key={t.id} ref={win} className="rt-win" data-from={t.spot.from} data-state={t.state} data-flip={t.flip} style={t.spot.win}>
      <div className="rt-body" style={{ "--feet": t.spot.feet + "%", "--h": t.spot.height + "%", "--ratio": RATIO[t.who + "-" + pose], "--run": RUN_MS + "ms" } as CSSProperties}>
        <img ref={sprite} className={"rt-sprite is-" + t.who} src={SPRITE(t.who, pose)} alt="" draggable={false} />
        <span className="rt-lock"><i /><i /><i /><i /></span>
      </div>
    </div>}
    <div ref={fx} className="rt-fx" />
    {live && <span className="rt-hits">HITS <b>{String(hits).padStart(2, "0")}</b></span>}
    {hint && <span className="rt-hint"><i />偵測到目標・點擊射擊</span>}
  </div>;
}
