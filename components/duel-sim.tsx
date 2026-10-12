"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Side-profile sprites (facing right) cut from one pose sheet per captain: foot = x of the feet centre, muzzle = pistol tip. */
const SPRITES = {
  a: { stand: { foot: .48 }, walk: { foot: .354 }, aim: { foot: .324, muzzle: [.99, .19] }, hit: { foot: .479 } },
  b: { stand: { foot: .466 }, walk: { foot: .366 }, aim: { foot: .241, muzzle: [.988, .204] }, hit: { foot: .55 } },
} as const;
type Side = "a" | "b";
type Pose = keyof typeof SPRITES.a;
type Phase = "idle" | "pacing" | "ready" | "draw" | "done";
const NAMES: Record<Side, string> = { a: "紅隊隊長", b: "藍隊隊長" };
const KEYS: Record<Side, string> = { a: "A", b: "L" };
const src = (side: Side, pose: Pose) => "/assets/mission/duel/" + side + "-" + pose + ".webp";
const PACE = .62, PACES = 3, START = .035;

/** Tiny synthesized cues, made on the first tap so browsers allow them. */
function useDuelSound() {
  const ctx = useRef<AudioContext | null>(null);
  const ensure = () => { try { ctx.current ??= new AudioContext(); if (ctx.current.state === "suspended") void ctx.current.resume(); } catch { ctx.current = null; } return ctx.current; };
  const tone = (type: OscillatorType, f0: number, f1: number, dur: number, gain: number, delay = 0) => {
    const c = ctx.current; if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .02);
  };
  return {
    ensure,
    step: () => tone("triangle", 150, 70, .09, .18),
    turn: () => tone("sawtooth", 300, 900, .14, .05),
    draw: () => { tone("square", 880, 880, .12, .08); tone("square", 1320, 1320, .18, .08, .12); },
    zap: () => { tone("sawtooth", 2400, 160, .28, .14); tone("square", 1200, 90, .22, .06, .02); },
    hit: () => { for (let k = 0; k < 4; k++) tone("square", 140, 120, .07, .1, .3 + k * .1); },
    foul: () => tone("sawtooth", 200, 60, .4, .12),
  };
}

/** The hidden training sim: back to back, three paces, turn — and the first captain to fire after the call wins. */
export default function DuelSim({ onClose }: { onClose?: () => void }) {
  const stage = useRef<HTMLDivElement>(null), boss = { a: useRef<HTMLDivElement>(null), b: useRef<HTMLDivElement>(null) };
  const img = { a: useRef<HTMLImageElement>(null), b: useRef<HTMLImageElement>(null) }, beam = useRef<HTMLElement>(null), burst = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<Phase>("idle"), [call, setCall] = useState("背對背站好"), [result, setResult] = useState("");
  const phaseRef = useRef<Phase>("idle"), drawAt = useRef(0), timers = useRef<number[]>([]), frame = useRef(0);
  // how far each captain paces, sized so the loser still lands inside the stage when they topple outwards
  const stride = useRef(.1);
  const spot = (side: Side) => side === "a" ? .5 - START - PACES * stride.current : .5 + START + PACES * stride.current;
  const sound = useDuelSound();
  const reduced = useRef(false);
  const go = (next: Phase) => { phaseRef.current = next; setPhase(next); };
  const later = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; cancelAnimationFrame(frame.current); };

  /** Pose a captain: foot anchor at x (fraction of the stage), facing right (1) or left (-1). */
  const pose = useCallback((side: Side, p: Pose, x: number, dir: 1 | -1, lift = 0) => {
    const box = boss[side].current, el = img[side].current; if (!box || !el) return;
    const foot = SPRITES[side][p].foot;
    if (!el.src.endsWith(src(side, p))) el.src = src(side, p);
    box.style.left = (x * 100).toFixed(3) + "%";
    el.style.transformOrigin = (foot * 100).toFixed(1) + "% 100%";
    el.style.translate = (-foot * 100).toFixed(1) + "% " + (-lift).toFixed(1) + "px";
    el.style.scale = dir + " 1";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const reset = useCallback(() => {
    clear();
    for (const side of ["a", "b"] as Side[]) { const el = img[side].current; el?.getAnimations().forEach(a => a.cancel()); if (el) { el.style.rotate = "0deg"; el.style.filter = ""; } }
    for (const fx of [beam.current, burst.current]) { fx?.getAnimations().forEach(a => a.cancel()); if (fx) fx.style.opacity = "0"; }
    pose("a", "stand", .5 - START, -1); pose("b", "stand", .5 + START, 1);
    go("idle"); setCall("背對背站好"); setResult("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose]);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const side of ["a", "b"] as Side[]) for (const p of Object.keys(SPRITES.a) as Pose[]) { const i = new Image(); i.src = src(side, p); }
    reset();
    return clear;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start() {
    sound.ensure(); reset(); go("pacing"); setCall("一");
    const width = stage.current?.clientWidth || 800, tall = boss.a.current?.clientHeight || 220;
    stride.current = Math.max(.04, (Math.min(.36, .5 - tall * 1.04 / width) - START) / PACES);
    const t0 = performance.now(), total = PACE * PACES;
    let lastStep = -1;
    const tick = (now: number) => {
      const s = Math.min(total, (now - t0) / 1000), k = Math.min(PACES - 1, Math.floor(s / PACE)), u = (s - k * PACE) / PACE;
      if (k !== lastStep && s < total) { lastStep = k; setCall(["一", "二", "三"][k]); sound.step(); }
      const ease = u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2, dist = (reduced.current ? PACES : k + ease) * stride.current;
      const stepPose: Pose = s < total && u > .12 && u < .78 ? "walk" : "stand", lift = s < total ? Math.sin(Math.PI * u) * 5 : 0;
      pose("a", stepPose, .5 - START - dist, -1, lift); pose("b", stepPose, .5 + START + dist, 1, lift);
      if (s < total && !reduced.current) { frame.current = requestAnimationFrame(tick); return; }
      // turn and aim, then hold until the call
      sound.turn(); pose("a", "aim", spot("a"), 1); pose("b", "aim", spot("b"), -1);
      go("ready"); setCall("轉身…穩住");
      later(900 + Math.random() * 1900, () => { if (phaseRef.current !== "ready") return; drawAt.current = performance.now(); go("draw"); setCall("開槍！"); sound.draw();
        later(4000, () => { if (phaseRef.current === "draw") { go("done"); setCall("平手"); setResult("兩位隊長都沒開槍……再來一局？"); } }); });
    };
    frame.current = requestAnimationFrame(tick);
  }

  function fall(side: Side) {
    const el = img[side].current, x = spot(side);
    // the loser staggers back (hit pose faces its shooter), then topples over the heels
    pose(side, "hit", x, side === "a" ? 1 : -1);
    if (!el) return;
    el.style.filter = side === "a" ? "drop-shadow(0 0 14px rgb(255 42 74 / .9))" : "drop-shadow(0 0 14px rgb(61 125 255 / .9))";
    const tip = side === "a" ? -1 : 1;
    if (reduced.current) { el.style.rotate = tip * 80 + "deg"; return; }
    el.animate([{ rotate: "0deg" }, { rotate: tip * 6 + "deg", offset: .25 }, { rotate: tip * 84 + "deg", offset: .82 }, { rotate: tip * 76 + "deg", offset: .91 }, { rotate: tip * 81 + "deg" }],
      { duration: 1100, delay: 180, easing: "cubic-bezier(.45,0,.8,.4)", fill: "forwards" });
  }

  function shoot(side: Side) {
    const now = phaseRef.current;
    if (now === "idle" || now === "done") return;
    sound.ensure();
    const other: Side = side === "a" ? "b" : "a";
    if (now === "pacing" || now === "ready") {
      // fired before the call: the pistol goes off into the floor, and the other captain takes it
      clear(); go("done"); sound.foul(); setCall("走火！");
      setResult(NAMES[side] + "太心急，走火了 — " + NAMES[other] + "勝");
      pose("a", "aim", spot("a"), 1); pose("b", "aim", spot("b"), -1);
      return;
    }
    if (now !== "draw") return;
    clear(); go("done");
    const ms = Math.round(performance.now() - drawAt.current);
    sound.zap(); sound.hit();
    // the beam: from the shooter's muzzle to the other's chest
    const st = stage.current?.getBoundingClientRect(), from = img[side].current?.getBoundingClientRect(), to = img[other].current?.getBoundingClientRect();
    if (st && from && to && beam.current && burst.current) {
      const [mx, my] = SPRITES[side].aim.muzzle, facing = side === "a" ? 1 : -1;
      const x1 = (facing === 1 ? from.left + mx * from.width : from.right - mx * from.width) - st.left, y1 = from.top + my * from.height - st.top;
      const x2 = to.left + to.width / 2 - st.left, y2 = to.top + to.height * .3 - st.top;
      const len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      const b = beam.current; b.className = "duel-beam is-" + side;
      Object.assign(b.style, { left: x1 + "px", top: y1 + "px", width: len + "px", rotate: ang + "deg", opacity: "1" });
      b.animate([{ scale: "0 1", opacity: 1 }, { scale: "1 1", opacity: 1, offset: .25 }, { scale: "1 1", opacity: 0 }], { duration: 420, easing: "ease-out", fill: "forwards" });
      const f = burst.current; f.className = "duel-burst is-" + side; Object.assign(f.style, { left: x2 + "px", top: y2 + "px" });
      f.animate([{ scale: ".2", opacity: 1 }, { scale: "1.4", opacity: 0 }], { duration: 520, easing: "ease-out", fill: "forwards" });
    }
    fall(other);
    setCall(NAMES[side] + " 勝");
    setResult("反應時間 " + (ms / 1000).toFixed(3) + " 秒");
  }

  // keyboard: A fires red, L fires blue, Enter starts — only while the sim is on screen (measured at the key press)
  const handlers = useRef({ shoot, start, onClose });
  handlers.current = { shoot, start, onClose };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const root = stage.current; if (!root || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const r = root.getBoundingClientRect(), shown = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
      if (shown < r.height * .4) return;
      const k = event.key.toLowerCase(), { shoot: fire, start: begin, onClose: close } = handlers.current;
      if (k === "a") { event.preventDefault(); fire("a"); }
      else if (k === "l") { event.preventDefault(); fire("b"); }
      else if ((k === "enter" || k === "r") && (phaseRef.current === "idle" || phaseRef.current === "done") && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); begin(); }
      else if (k === "escape") close?.();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const armed = phase === "pacing" || phase === "ready" || phase === "draw";
  return <div className="duel" data-phase={phase}>
    <div ref={stage} className="duel-stage">
      <span className="duel-hud duel-hud-l" aria-hidden="true">RED · {KEYS.a}</span>
      <span className="duel-hud duel-hud-r" aria-hidden="true">{KEYS.b} · BLUE</span>
      <p className="duel-call" aria-live="assertive">{call}</p>
      {result && <p className="duel-result" role="status">{result}</p>}
      <div ref={boss.a} className="duel-boss"><img ref={img.a} alt="紅隊隊長" draggable={false} /></div>
      <div ref={boss.b} className="duel-boss"><img ref={img.b} alt="藍隊隊長" draggable={false} /></div>
      <i ref={beam} className="duel-beam" aria-hidden="true" />
      <i ref={burst} className="duel-burst" aria-hidden="true" />
      <i className="duel-floor" aria-hidden="true" />
    </div>
    <div className="duel-controls">
      <button type="button" className="duel-fire is-a" disabled={!armed} onPointerDown={event => { event.preventDefault(); shoot("a"); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); shoot("a"); } }}>
        紅隊開槍<kbd>A</kbd>
      </button>
      <button type="button" className="duel-start" disabled={armed} onClick={start}>{phase === "done" ? "再來一局" : "開始決鬥"}</button>
      <button type="button" className="duel-fire is-b" disabled={!armed} onPointerDown={event => { event.preventDefault(); shoot("b"); }} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); shoot("b"); } }}>
        <kbd>L</kbd>藍隊開槍
      </button>
    </div>
    <p className="duel-rules">背對背走三步、轉身，聽到「開槍！」才能扣板機；搶先開槍會走火判輸。紅隊按 A、藍隊按 L，手機直接點按鈕。</p>
  </div>;
}
