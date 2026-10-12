"use client";
import { useEffect, useRef, useState } from "react";

/** Side-profile sprites (facing right) cut from one pose sheet per captain: foot = x of the feet centre, muzzle = pistol tip. */
const SPRITES = {
  a: { stand: { foot: .48 }, walk: { foot: .354 }, aim: { foot: .324, muzzle: [.99, .19] }, hit: { foot: .479 } },
  b: { stand: { foot: .466 }, walk: { foot: .366 }, aim: { foot: .241, muzzle: [.988, .204] }, hit: { foot: .55 } },
} as const;
type Side = "a" | "b";
type Pose = keyof typeof SPRITES.a;
type Mode = "cpu" | "duo";
type Phase = "ready" | "intro" | "fight" | "over";
const NAMES: Record<Side, string> = { a: "紅隊隊長", b: "藍隊隊長" };
const LIVES = 3, FIRE_GAP = .32, BOLT_SPEED = 1.05, COVER_MAX = 1.3, COVER_RECHARGE = 1.6, STAGGER = .34, PACE = .3;
const src = (side: Side, pose: Pose) => "/assets/mission/duel/" + side + "-" + pose + ".webp";
const other = (side: Side): Side => side === "a" ? "b" : "a";

type Fighter = { lives: number; want: boolean; cover: boolean; energy: number; lockedUntil: number; fireAt: number; hitUntil: number; shots: number; hits: number; brain: number };
type Bolt = { from: Side; x: number; el: HTMLElement; read?: boolean };
const fresh = (): Fighter => ({ lives: LIVES, want: false, cover: false, energy: 1, lockedUntil: 0, fireAt: 0, hitUntil: 0, shots: 0, hits: 0, brain: 0 });

/** Tiny synthesized cues, made on the first tap so browsers allow them. */
function useDuelSound() {
  const ctx = useRef<AudioContext | null>(null);
  const ensure = () => { try { ctx.current ??= new AudioContext(); if (ctx.current.state === "suspended") void ctx.current.resume(); } catch { ctx.current = null; } };
  const tone = (type: OscillatorType, f0: number, f1: number, dur: number, gain: number, delay = 0) => {
    const c = ctx.current; if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + .006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .02);
  };
  return {
    ensure,
    step: () => tone("triangle", 150, 70, .08, .16),
    fight: () => { tone("square", 660, 660, .1, .07); tone("square", 990, 990, .22, .08, .1); },
    zap: (side: Side) => tone("sawtooth", side === "a" ? 2200 : 2600, 180, .2, .1),
    block: () => { tone("square", 900, 600, .05, .06); tone("triangle", 300, 120, .12, .1); },
    hit: () => { for (let k = 0; k < 3; k++) tone("square", 150, 120, .06, .09, k * .07); },
    duck: () => tone("sine", 500, 180, .1, .05),
    win: () => { tone("triangle", 523, 523, .18, .1); tone("triangle", 784, 784, .3, .1, .16); },
  };
}

/**
 * The training sim at the bottom of the page: a laser duel. The captains start back to back, take three paces, turn — and
 * it is on at once: fire, or drop behind your bunker so the shot flies over. Every vest has three lives. One player takes on
 * the computer — dealt the red or the blue captain at random each round — or two share a keyboard (A/S and L/K) or a phone.
 */
export default function DuelSim() {
  const stage = useRef<HTMLDivElement>(null), bolts = useRef<HTMLDivElement>(null);
  const boss = { a: useRef<HTMLDivElement>(null), b: useRef<HTMLDivElement>(null) }, img = { a: useRef<HTMLImageElement>(null), b: useRef<HTMLImageElement>(null) };
  const meter = { a: useRef<HTMLElement>(null), b: useRef<HTMLElement>(null) };
  const [mode, setMode] = useState<Mode>("cpu"), [phase, setPhase] = useState<Phase>("ready"), [call, setCall] = useState("雙方就位"), [result, setResult] = useState("");
  const [lives, setLives] = useState({ a: LIVES, b: LIVES }), [reach, setReach] = useState(.32), [human, setHuman] = useState<Side>("a");
  const game = useRef({ phase: "ready" as Phase, mode: "cpu" as Mode, human: "a" as Side, a: fresh(), b: fresh(), bolts: [] as Bolt[], reach: .32, last: 0, frame: 0, timers: [] as number[] });
  const sound = useDuelSound();
  const reduced = useRef(false);

  const go = (next: Phase) => { game.current.phase = next; setPhase(next); };
  const later = (ms: number, fn: () => void) => { game.current.timers.push(window.setTimeout(fn, ms)); };
  const spot = (side: Side) => side === "a" ? .5 - game.current.reach : .5 + game.current.reach;
  /** Pose a captain: foot anchor at x (fraction of the stage), facing right (1) or left (-1), sunk by `sink` of its height. */
  const pose = (side: Side, p: Pose, x: number, dir: 1 | -1, lift = 0, sink = 0) => {
    const box = boss[side].current, el = img[side].current; if (!box || !el) return;
    const foot = SPRITES[side][p].foot;
    if (!el.src.endsWith(src(side, p))) el.src = src(side, p);
    box.style.left = (x * 100).toFixed(3) + "%";
    el.style.transformOrigin = (foot * 100).toFixed(1) + "% 100%";
    el.style.translate = (-foot * 100).toFixed(1) + "% calc(" + (sink * 100).toFixed(1) + "% - " + lift.toFixed(1) + "px)";
    el.style.scale = dir + " 1";
  };
  function spark(xPx: number, yPx: number, side: Side, big = false) {
    const layer = bolts.current; if (!layer || reduced.current) return;
    for (let k = 0; k < (big ? 12 : 7); k++) {
      const s = document.createElement("i"); s.className = "duel-spark is-" + side; s.style.left = xPx + "px"; s.style.top = yPx + "px"; layer.appendChild(s);
      const ang = Math.random() * Math.PI * 2, d = (big ? 40 : 22) + Math.random() * (big ? 50 : 26);
      s.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: `translate(calc(-50% + ${(Math.cos(ang) * d).toFixed(1)}px), calc(-50% + ${(Math.sin(ang) * d - 10).toFixed(1)}px)) scale(.3)`, opacity: 0 }], { duration: 380 + Math.random() * 260, easing: "cubic-bezier(.2,.8,.3,1)" }).onfinish = () => s.remove();
    }
  }
  function clearField() {
    const g = game.current; g.timers.forEach(clearTimeout); g.timers = []; cancelAnimationFrame(g.frame);
    g.bolts.forEach(b => b.el.remove()); g.bolts = [];
    for (const side of ["a", "b"] as Side[]) { const el = img[side].current; el?.getAnimations().forEach(a => a.cancel()); if (el) { el.style.rotate = "0deg"; el.style.filter = ""; } }
  }
  function reset() {
    clearField();
    const g = game.current; g.a = fresh(); g.b = fresh(); setLives({ a: LIVES, b: LIVES });
    g.human = g.mode === "cpu" && Math.random() < .5 ? "b" : "a"; setHuman(g.human);
    pose("a", "stand", .5 - .035, -1); pose("b", "stand", .5 + .035, 1);
    go("ready"); setCall("雙方就位"); setResult("");
  }
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const side of ["a", "b"] as Side[]) for (const p of Object.keys(SPRITES.a) as Pose[]) { const i = new Image(); i.src = src(side, p); }
    reset();
    return clearField;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start(nextMode = game.current.mode) {
    sound.ensure(); reset();
    const g = game.current; g.mode = nextMode; setMode(nextMode);
    // pace far enough that a fallen captain still lands inside the stage
    const width = stage.current?.clientWidth || 800, tall = boss.a.current?.clientHeight || 220;
    g.reach = Math.max(.24, Math.min(.36, .5 - tall * 1.04 / width)); setReach(g.reach);
    go("intro");
    const deal = g.mode === "cpu" && !reduced.current ? 900 : 0;
    if (deal) setCall("你是" + NAMES[g.human]); else setCall("一");
    const t0 = performance.now() + deal, total = PACE * 3;
    let step = -1;
    const walk = (now: number) => {
      if (now < t0) { g.frame = requestAnimationFrame(walk); return; }
      const s = Math.min(total, (now - t0) / 1000), k = Math.min(2, Math.floor(s / PACE)), u = (s - k * PACE) / PACE;
      if (k !== step && s < total) { step = k; setCall(["一", "二", "三"][k]); sound.step(); }
      const ease = u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2, dist = .035 + (reduced.current ? 3 : k + ease) / 3 * (g.reach - .035);
      const p: Pose = s < total && u > .1 && u < .8 ? "walk" : "stand", lift = s < total ? Math.sin(Math.PI * u) * 4 : 0;
      pose("a", p, .5 - dist, -1, lift); pose("b", p, .5 + dist, 1, lift);
      if (s < total && !reduced.current) { g.frame = requestAnimationFrame(walk); return; }
      // turn — and it is on, no waiting
      pose("a", "aim", spot("a"), 1); pose("b", "aim", spot("b"), -1);
      sound.fight(); setCall("開打！"); go("fight");
      later(700, () => { if (game.current.phase === "fight") setCall(""); });
      g.last = performance.now() / 1000; g.frame = requestAnimationFrame(loop);
    };
    g.frame = requestAnimationFrame(walk);
  }

  function fire(side: Side) {
    const g = game.current, f = g[side], t = performance.now() / 1000;
    if (g.phase !== "fight" || f.cover || t < f.fireAt || t < f.hitUntil) return;
    const st = stage.current, el = img[side].current, layer = bolts.current; if (!st || !el || !layer) return;
    f.fireAt = t + FIRE_GAP; f.shots++;
    const r = el.getBoundingClientRect(), sr = st.getBoundingClientRect(), [mx, my] = SPRITES[side].aim.muzzle;
    const x = (side === "a" ? r.left + mx * r.width : r.right - mx * r.width) - sr.left, y = r.top + my * r.height - sr.top;
    const b = document.createElement("i"); b.className = "duel-bolt is-" + side; b.style.top = y + "px"; b.style.left = x + "px"; layer.appendChild(b);
    g.bolts.push({ from: side, x: x / sr.width, el: b });
    const flash = document.createElement("i"); flash.className = "duel-flash is-" + side; flash.style.left = x + "px"; flash.style.top = y + "px"; layer.appendChild(flash);
    flash.animate([{ opacity: 1, transform: "translate(-50%,-50%) scale(.4)" }, { opacity: 0, transform: "translate(-50%,-50%) scale(1.3)" }], { duration: 160 }).onfinish = () => flash.remove();
    sound.zap(side);
  }
  function setCover(side: Side, down: boolean) {
    const g = game.current; if (g.phase !== "fight" && down) return;
    if (down && !g[side].want) sound.duck();
    g[side].want = down;
  }
  function fall(side: Side) {
    const el = img[side].current;
    pose(side, "hit", spot(side), side === "a" ? 1 : -1);
    if (!el) return;
    el.style.filter = side === "a" ? "drop-shadow(0 0 14px rgb(255 42 74 / .9))" : "drop-shadow(0 0 14px rgb(61 125 255 / .9))";
    const tip = side === "a" ? -1 : 1;
    if (reduced.current) { el.style.rotate = tip * 80 + "deg"; return; }
    el.animate([{ rotate: "0deg" }, { rotate: tip * 6 + "deg", offset: .25 }, { rotate: tip * 84 + "deg", offset: .82 }, { rotate: tip * 76 + "deg", offset: .91 }, { rotate: tip * 81 + "deg" }],
      { duration: 1000, delay: 120, easing: "cubic-bezier(.45,0,.8,.4)", fill: "forwards" });
  }
  function finish(winner: Side) {
    const g = game.current; go("over");
    // shots still in the air fade out with the round
    g.bolts.forEach(b => b.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).onfinish = () => b.el.remove()); g.bolts = [];
    fall(other(winner)); sound.win();
    const f = g[winner], rate = f.shots ? Math.round(f.hits / f.shots * 100) : 0;
    setCall(NAMES[winner] + " 勝");
    setResult(g.mode === "cpu" ? (winner === g.human ? "你贏了電腦！命中率 " + rate + "%" : "電腦贏了，再來一局？") : "命中率 " + rate + "%・剩 " + f.lives + " 條命");
  }

  /** the computer (whichever captain you were not dealt): drops behind cover when a shot is coming (not always in time), pops
   *  up and fires at a nervous rhythm */
  function think(t: number) {
    const g = game.current, cpu = other(g.human), me = g[cpu], foe = g[g.human];
    const eta = (b: Bolt) => Math.abs(spot(cpu) - b.x) / BOLT_SPEED;
    const incoming = g.bolts.filter(b => b.from === g.human).map(eta);
    const soon = incoming.length ? Math.min(...incoming) : 9;
    for (const b of g.bolts) if (b.from === g.human && !b.read && eta(b) < .3) { b.read = true; if (Math.random() < .58 && me.energy > .25) me.want = true; }
    if (me.want && soon > .32 && t > me.brain) { me.want = false; me.brain = t + .15; }
    if (!me.want && !me.cover && t > me.fireAt && t > me.brain) {
      fire(cpu); me.brain = t + .45 + Math.random() * .7 + (foe.cover ? .35 : 0);
    }
  }

  function loop(nowMs: number) {
    const g = game.current, t = nowMs / 1000, dt = Math.min(.05, t - g.last); g.last = t;
    const st = stage.current; if (!st) return;
    const width = st.clientWidth;
    if (g.phase === "fight") {
      for (const side of ["a", "b"] as Side[]) {
        const f = g[side];
        f.cover = f.want && f.energy > 0 && t >= f.lockedUntil;
        if (f.cover) { f.energy -= dt / COVER_MAX; if (f.energy <= 0) { f.energy = 0; f.cover = false; f.want = false; f.lockedUntil = t + .6; } }
        else f.energy = Math.min(1, f.energy + dt / COVER_RECHARGE);
      }
      if (g.mode === "cpu") think(t);
      for (let i = g.bolts.length - 1; i >= 0; i--) {
        const b = g.bolts[i], target = other(b.from), dir = b.from === "a" ? 1 : -1;
        b.x += dir * BOLT_SPEED * dt; b.el.style.left = (b.x * width).toFixed(1) + "px";
        const tx = spot(target), reached = dir > 0 ? b.x >= tx - .02 : b.x <= tx + .02;
        if (reached && b.x > -.05 && b.x < 1.05) {
          const f = g[target], y = parseFloat(b.el.style.top);
          if (f.cover) {
            // stopped by the bunker in front of the target
            const bunker = (target === "a" ? spot("a") + .07 : spot("b") - .07) * width;
            spark(bunker, y + 8, b.from); sound.block();
          } else {
            f.lives--; f.hitUntil = t + STAGGER; g[b.from].hits++; setLives({ a: g.a.lives, b: g.b.lives });
            spark(tx * width, y + 6, b.from, true); sound.hit();
            img[target].current?.animate([{ filter: `brightness(2.2) drop-shadow(0 0 18px ${b.from === "a" ? "#ff2a4a" : "#3d7dff"})` }, { filter: "none" }], { duration: 420 });
            if (f.lives <= 0) { b.el.remove(); g.bolts.splice(i, 1); finish(b.from); break; }
          }
          b.el.remove(); g.bolts.splice(i, 1); continue;
        }
        if (b.x < -.1 || b.x > 1.1) { b.el.remove(); g.bolts.splice(i, 1); }
      }
    }
    if (g.phase === "fight") for (const side of ["a", "b"] as Side[]) {
      const f = g[side];
      pose(side, f.cover ? "stand" : t < f.hitUntil ? "hit" : "aim", spot(side), side === "a" ? 1 : -1, 0, f.cover ? .42 : 0);
      const m = meter[side].current; if (m) { m.style.transform = "scaleX(" + f.energy.toFixed(3) + ")"; m.dataset.low = String(f.energy < .3 || t < f.lockedUntil); }
    }
    if (g.phase === "fight" || g.bolts.length) g.frame = requestAnimationFrame(loop);
  }

  // keyboard while the sim is on screen: A fire / S duck (red), L fire / K duck (blue), Enter starts
  const handlers = useRef({ fire, setCover, start });
  handlers.current = { fire, setCover, start };
  useEffect(() => {
    const shown = () => { const r = stage.current?.getBoundingClientRect(); return !!r && Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0) > r.height * .4; };
    const down = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || !shown()) return;
      const k = event.key.toLowerCase(), g = game.current, h = handlers.current, duo = g.mode === "duo", me: Side = duo ? "a" : g.human;
      if (k === "a") { event.preventDefault(); if (!event.repeat) h.fire(me); }
      else if (k === "s") { event.preventDefault(); h.setCover(me, true); }
      else if (k === "l" && duo) { event.preventDefault(); if (!event.repeat) h.fire("b"); }
      else if (k === "k" && duo) { event.preventDefault(); h.setCover("b", true); }
      else if (k === "enter" && (g.phase === "ready" || g.phase === "over") && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); h.start(); }
    };
    const up = (event: KeyboardEvent) => {
      const k = event.key.toLowerCase(), h = handlers.current;
      if (k === "s") h.setCover(game.current.mode === "duo" ? "a" : game.current.human, false);
      else if (k === "k" && game.current.mode === "duo") h.setCover("b", false);
    };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const live = phase === "fight";
  const hold = (side: Side) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); setCover(side, true); },
    onPointerUp: () => setCover(side, false), onPointerCancel: () => setCover(side, false), onLostPointerCapture: () => setCover(side, false),
  });
  const pad = (side: Side, keys: [string, string]) => <div className={"duel-pad is-" + side}>
    <button type="button" className="duel-duck" disabled={!live} {...hold(side)}>躲<kbd>{keys[1]}</kbd></button>
    <button type="button" className="duel-fire" disabled={!live} onPointerDown={event => { event.preventDefault(); fire(side); }}
      onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fire(side); } }}>開槍<kbd>{keys[0]}</kbd></button>
  </div>;
  return <div className="duel" data-phase={phase} data-mode={mode}>
    <div className="duel-modes" role="group" aria-label="對戰模式">
      <button type="button" aria-pressed={mode === "cpu"} disabled={phase === "intro" || live} onClick={() => { game.current.mode = "cpu"; setMode("cpu"); reset(); }}>單人・挑戰電腦</button>
      <button type="button" aria-pressed={mode === "duo"} disabled={phase === "intro" || live} onClick={() => { game.current.mode = "duo"; setMode("duo"); reset(); }}>雙人・同機對戰</button>
    </div>
    <div ref={stage} className="duel-stage">
      {(["a", "b"] as Side[]).map(side => <div key={side} className={"duel-hud is-" + side}>
        <span className="duel-hud-name">{(mode === "cpu" ? (side === human ? "你・" : "電腦・") : "") + (side === "a" ? "紅隊" : "藍隊")}</span>
        <span className="duel-lives" role="img" aria-label={NAMES[side] + " 剩 " + lives[side] + " 條命"}>{Array.from({ length: LIVES }, (_, i) => <i key={i} data-on={i < lives[side]} />)}</span>
        <span className="duel-meter" aria-hidden="true"><i ref={meter[side]} /></span>
      </div>)}
      {call && <p key={call} className="duel-call" aria-live="assertive">{call}</p>}
      {result && <p className="duel-result" role="status">{result}</p>}
      <div ref={boss.a} className="duel-boss"><img ref={img.a} alt="紅隊隊長" draggable={false} /></div>
      <div ref={boss.b} className="duel-boss"><img ref={img.b} alt="藍隊隊長" draggable={false} /></div>
      {(phase === "fight" || phase === "over") && <>
        <i className="duel-bunker is-a" style={{ left: ((.5 - reach + .07) * 100) + "%" }} aria-hidden="true" />
        <i className="duel-bunker is-b" style={{ left: ((.5 + reach - .07) * 100) + "%" }} aria-hidden="true" />
      </>}
      <div ref={bolts} className="duel-fx" aria-hidden="true" />
      <i className="duel-floor" aria-hidden="true" />
    </div>
    <div className="duel-controls">
      {pad(mode === "cpu" ? human : "a", ["A", "S"])}
      <button type="button" className="duel-start" disabled={phase === "intro" || live} onClick={() => start()}>{phase === "over" ? "再來一局" : "開始對決"}</button>
      {mode === "duo" ? pad("b", ["L", "K"]) : <span className="duel-pad-gap" aria-hidden="true" />}
    </div>
    <p className="duel-rules">{mode === "cpu"
      ? "每局隨機分配你是紅隊或藍隊隊長。轉身就開打：按 A 開槍、按住 S 躲到掩體後（雷射會從頭上飛過），手機用下面的按鈕。躲太久會被拉起來，每人 3 條命。"
      : "紅隊 A 開槍、S 躲；藍隊 L 開槍、K 躲。手機兩人各按一邊。躲太久會被拉起來，每人 3 條命，先打光對方的贏。"}</p>
  </div>;
}
