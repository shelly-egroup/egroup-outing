"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createEmbers, createFilmBurn, type BurnSeed } from "@/lib/film-burn";

export type BriefingAlarm = { armed: boolean; seconds: number; gone?: boolean };
type Stage = "typing" | "armed" | "glitch" | "burning" | "gone";
/** Paced to be read: a character every 46 ms, a breath at each line end, five seconds of countdown, a slow burn, and the
 *  ashes left alone for half a minute before the briefing comes in again (at once if it is scrolled away and back). */
const COUNTDOWN = 5, TYPE_MS = 46, LINE_MS = 340, GLITCH_MS = 700, BURN_MS = 2800, GONE_MS = 30000;
const BACKING: [number, number, number] = [10, 11, 13];
const SEEDS: BurnSeed[] = [{ x: .32, y: .52, delay: 0 }, { x: .8, y: .3, delay: .18 }, { x: .1, y: .16, delay: .32 }, { x: .6, y: .95, delay: .42 }];

/**
 * The console briefing, Mission: Impossible style, on a slow loop while it is on screen: the lines type themselves, "this
 * message will self-destruct" counts down five seconds while the console alarms, the screen glitches, it ignites and the
 * message burns away in a film burn with sparks, embers and smoke, "訊息已銷毀" stays a while — then it types itself again.
 * Its height never changes, so nothing below moves. With reduced motion it is a still briefing that says it will self-destruct.
 */
/** A briefing line: key, value, and optionally how the value reads — "ok" (green) or "wait" (amber, pulsing). */
export type BriefingLine = [string, string] | [string, string, "ok" | "wait"];

export default function MissionBriefing({ lines, onAlarm }: { lines: BriefingLine[]; onAlarm?: (alarm: BriefingAlarm) => void }) {
  const box = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const total = lines.reduce((sum, [k, v]) => sum + k.length + v.length, 0);
  const [stage, setStage] = useState<Stage>("typing"), [count, setCount] = useState(0), [secs, setSecs] = useState(COUNTDOWN);
  const [visible, setVisible] = useState(false), [still, setStill] = useState(false), [height, setHeight] = useState<number>();
  const alarm = useRef(onAlarm); alarm.current = onAlarm;
  // where each line's typing ends, for the breath between lines
  const ends = lines.reduce<number[]>((acc, [k, v]) => [...acc, (acc.at(-1) || 0) + k.length + v.length], []).join(",");

  useEffect(() => {
    const el = box.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStill(true); setCount(total); setVisible(true); return; }
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [total]);
  // typing
  useEffect(() => {
    if (still || !visible || stage !== "typing") return;
    if (count >= total) { const timer = setTimeout(() => { setSecs(COUNTDOWN); setStage("armed"); }, LINE_MS); return () => clearTimeout(timer); }
    const timer = setTimeout(() => setCount(c => c + 1), count > 0 && ends.split(",").includes(String(count)) ? LINE_MS : TYPE_MS);
    return () => clearTimeout(timer);
  }, [still, visible, stage, count, total, ends]);
  // the briefing at its tallest (with the countdown line) fixes the height for good
  useLayoutEffect(() => { if (stage === "armed" && box.current && height === undefined) setHeight(box.current.offsetHeight); }, [stage, height]);
  // the countdown, the glitch, the burn, the ashes, then again from the top
  useEffect(() => {
    if (still || !visible) return;
    const next = (ms: number, fn: () => void) => { const timer = setTimeout(fn, ms); return () => clearTimeout(timer); };
    if (stage === "armed") return next(1000, () => { if (secs > 1) setSecs(s => s - 1); else setStage("glitch"); });
    if (stage === "glitch") return next(GLITCH_MS, () => setStage("burning"));
    if (stage === "burning") return next(BURN_MS, () => setStage("gone"));
    if (stage === "gone") return next(GONE_MS, () => { setCount(0); setStage("typing"); });
  }, [still, visible, stage, secs]);
  // scrolled away while it lay in ashes: it comes back as a fresh transmission
  useEffect(() => { if (!visible && stage === "gone") { setCount(0); setStage("typing"); } }, [visible, stage]);
  useEffect(() => { alarm.current?.({ armed: !still && (stage === "armed" || stage === "glitch" || stage === "burning"), seconds: secs, gone: stage === "gone" }); }, [stage, secs, still]);

  // the film burn, sparks, embers and smoke on a canvas over the lines
  useEffect(() => {
    if (stage !== "burning" && stage !== "gone") return;
    const c = canvas.current, el = box.current; if (!c || !el) return;
    // the canvas reaches past the briefing into the console's margin, so the smoke has room to rise and fade out
    const dpr = Math.min(2, window.devicePixelRatio || 1), cr = c.getBoundingClientRect(), br = el.getBoundingClientRect();
    const W = br.width, H = br.height, ox = br.left - cr.left, oy = br.top - cr.top;
    c.width = Math.round(cr.width * dpr); c.height = Math.round(cr.height * dpr);
    const ctx = c.getContext("2d"); if (!ctx) return;
    const burn = createFilmBurn(W, H, SEEDS, 3), fire = createEmbers(W, H, ox, oy), rect: [number, number, number, number] = [ox * dpr, oy * dpr, W * dpr, H * dpr];
    const t0 = performance.now() - (stage === "gone" ? BURN_MS : 0);
    let frame = 0, last = t0;
    const tick = (now: number) => {
      const t = now - t0, dt = Math.min(.05, (now - last) / 1000); last = now;
      // paced so it catches at about 0.4 s, is half gone at 1.8 s and wholly gone by 2.8 s
      const p = Math.min(1, t / BURN_MS), spread = .1 + .22 * t / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
      // while it burns the canvas hides what is gone; afterwards only the smoke and the last embers remain over "訊息已銷毀"
      const front: [number, number][] = t < BURN_MS ? burn.draw(ctx, spread, { mode: "cover", backing: BACKING }, t / 1000, rect) : [];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // ignition: a flare where it catches
      if (t < 520) {
        const k = t / 520, x = ox + SEEDS[0].x * W, y = oy + SEEDS[0].y * H, r = (30 + 160 * k) * Math.max(.7, H / 220);
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(255,246,226,${(.9 * (1 - k)).toFixed(3)})`); gr.addColorStop(.3, `rgba(255,170,80,${(.45 * (1 - k)).toFixed(3)})`); gr.addColorStop(1, "rgba(255,90,30,0)");
        ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = gr; ctx.fillRect(0, 0, cr.width, cr.height); ctx.globalCompositeOperation = "source-over";
      }
      if (p < 1) fire.spawn(front, p < .8 ? 8 : 3, .22);
      fire.step(ctx, dt, .12);
      if (t < BURN_MS + 3200 || fire.count) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); };
  // a new canvas run per cycle; "gone" continues the same burn
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage === "burning" || stage === "gone"]);

  let left = count;
  const live = stage !== "gone";
  return <div ref={box} className="boot" data-state={still ? "still" : stage} style={height !== undefined ? { minHeight: height } : undefined}>
    <p className="sr-only">{lines.map(([k, v]) => k + "：" + v).join("；")}；本訊息將自動銷毀</p>
    <div className="boot-lines" aria-hidden="true" hidden={!live}>
      {lines.map(([key, value, tone], index) => {
        const k = key.slice(0, Math.max(0, left)); left -= key.length;
        const v = value.slice(0, Math.max(0, left)); left -= value.length;
        const typing = stage === "typing" && left < 0 && left > -(key.length + value.length) - 1 && (k.length || index === 0);
        return <p key={key} className="boot-line">
          <span className="boot-prompt">&gt;</span><span className="boot-key">{k}</span>{k.length === key.length && <span className="boot-dots" />}<b className="boot-value" data-tone={tone}>{v}</b>{typing && <i className="boot-caret" />}
        </p>;
      })}
      {(still || stage !== "typing") && <p className="boot-line boot-destruct">
        <span className="boot-prompt">&gt;</span><i className="boot-alarm" />
        <span>{still ? "本訊息將自動銷毀" : <>本訊息將在 <b key={secs}>{secs}</b> 秒後自動銷毀</>}</span><i className="boot-caret is-idle" />
      </p>}
    </div>
    {!live && <div className="boot-gone" aria-hidden="true">
      <p className="boot-line"><span className="boot-prompt">&gt;</span><span className="boot-key">訊息已銷毀</span><i className="boot-caret is-idle" /></p>
      <small>MESSAGE DESTROYED</small>
    </div>}
    <canvas ref={canvas} className="boot-burn" aria-hidden="true" />
  </div>;
}
