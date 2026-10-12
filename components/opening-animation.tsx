"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import TitleMark from "./title-mark";
import LoadingIndicator from "./loading-indicator";
import { openingHistory } from "@/lib/opening-history";
import { TRAILER_BURN_AT, TRAILER_IMAGES, TRAILER_VIDEO } from "@/lib/opening-assets";
import { createEmbers, createFilmBurn, type BurnSeed } from "@/lib/film-burn";

type Phase = "cover" | "starting" | "playing" | "blocked" | "leaving" | "handoff";
type Exit = "film" | "skip" | "cover";
/** Where the picture catches fire. The film's end card burns from its self-destruct line outwards. */
const FILM_SEEDS: BurnSeed[] = [{ x: .5, y: .76, delay: 0 }, { x: .18, y: .28, delay: .16 }, { x: .86, y: .22, delay: .24 }, { x: .9, y: .86, delay: .34 }, { x: .06, y: .9, delay: .4 }];
const QUICK_SEEDS: BurnSeed[] = [{ x: .46, y: .52, delay: 0 }, { x: .84, y: .24, delay: .12 }, { x: .14, y: .2, delay: .2 }, { x: .76, y: .9, delay: .28 }];

/** Draw an image into a box the way CSS object-fit does, with object-position as fractions. */
function fit(ctx: CanvasRenderingContext2D, image: CanvasImageSource, iw: number, ih: number, box: [number, number, number, number], mode: "cover" | "contain", px = .5, py = .5) {
  const [x, y, w, h] = box, scale = mode === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih), dw = iw * scale, dh = ih * scale;
  ctx.drawImage(image, x + (w - dw) * px, y + (h - dh) * py, dw, dh);
}

/**
 * The opening: a teaser-poster cover, then the pre-rendered trailer (16:9 or 9:16 to suit the screen) with its own score.
 * It never just cuts to the page. When the film reaches its self-destruct the frame freezes and burns away live — holes eat
 * through it, white-hot at the edges, throwing sparks and smoke — and the mission page is underneath, coming up as it burns,
 * while the score plays out. Skipping burns the current frame (or the poster) the same way, only quicker.
 */
export default function OpeningAnimation({ onFinish, onReveal, autoStart = false }: { onFinish: () => void; onReveal?: () => void; autoStart?: boolean }) {
  const [tall, setTall] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("cover");
  const [ready, setReady] = useState(false), [slow, setSlow] = useState(false), [stalled, setStalled] = useState(false), [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null), bar = useRef<HTMLDivElement>(null), skip = useRef<HTMLButtonElement>(null);
  const burnRef = useRef<HTMLCanvasElement>(null), art = useRef<HTMLImageElement>(null);
  const finish = useRef(onFinish), reveal = useRef(onReveal), started = useRef(false), leaving = useRef(false), phaseRef = useRef(phase);
  finish.current = onFinish; reveal.current = onReveal; phaseRef.current = phase;

  // Portrait phones get the vertical cut; everything else the widescreen one. Chosen once, before the first paint.
  useLayoutEffect(() => { setTall(window.matchMedia("(max-aspect-ratio: 4/5)").matches); }, []);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") exit(phaseRef.current === "playing" ? "skip" : "cover"); };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = previous; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A network that never delivers must not lock the cover: after 8 s the button works and the browser streams.
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [ready]);
  useEffect(() => { if (phase === "playing") skip.current?.focus({ preventScroll: true }); }, [phase]);
  // The progress hairline follows the film itself, and the film hands over to the page at its self-destruct.
  useEffect(() => {
    if (phase !== "playing") return;
    let frame = 0;
    const tick = () => {
      const v = video.current;
      if (v && bar.current && v.duration) bar.current.style.transform = "scaleX(" + Math.min(1, v.currentTime / v.duration) + ")";
      if (v && v.currentTime >= TRAILER_BURN_AT - .03) { exit("film"); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // play() runs inside the tap itself, unmuted; only a browser refusal asks for a second tap.
  function play() {
    const v = video.current;
    if (!v || phase === "playing" || leaving.current) return;
    started.current = true;
    v.muted = false;
    v.volume = 1;
    setPhase("starting");
    v.play().then(() => { openingHistory.markSeen(); setPhase("playing"); }, (error: { name?: string }) => {
      if (error?.name === "NotAllowedError") setPhase("blocked");
      else { setFailed(true); setPhase("cover"); }
    });
  }
  // A replay comes from a tap on the page already, so it rolls at once where the browser allows it.
  useEffect(() => { if (autoStart && tall !== null && !started.current) play(); });

  /** Leave for the page: freeze what is on screen into the canvas, show the page underneath, burn the frame away. */
  function exit(kind: Exit) {
    if (leaving.current) return;
    leaving.current = true;
    const canvas = burnRef.current, v = video.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { v?.pause(); finish.current(); return; }
    // the poster's billing fades first (it is not part of the picture that burns)
    if (kind === "cover") { setPhase("leaving"); setTimeout(() => ignite(kind, canvas, v), 260); }
    else ignite(kind, canvas, v);
  }

  function ignite(kind: Exit, canvas: HTMLCanvasElement, v: HTMLVideoElement | null) {
    // CSS-pixel resolution: the burn is soft by nature, and a full-screen canvas stays light enough for any phone
    const W = window.innerWidth, H = window.innerHeight, dpr = 1;
    const frame = document.createElement("canvas");
    frame.width = Math.round(W * dpr); frame.height = Math.round(H * dpr);
    const f = frame.getContext("2d"), ctx = canvas.getContext("2d");
    if (!f || !ctx) { v?.pause(); finish.current(); return; }
    f.scale(dpr, dpr); f.fillStyle = "#030304"; f.fillRect(0, 0, W, H);
    const poster = art.current;
    if (kind === "cover") {
      if (poster?.complete && poster.naturalWidth) {
        const r = poster.getBoundingClientRect(), [ox, oy] = getComputedStyle(poster).objectPosition.split(" ").map(part => parseFloat(part) / 100);
        fit(f, poster, poster.naturalWidth, poster.naturalHeight, [r.left, r.top, r.width, r.height], "cover", Number.isFinite(ox) ? ox : .5, Number.isFinite(oy) ? oy : .5);
      }
      // the poster's grade: the billing area sinks into black
      const g = f.createLinearGradient(0, H, 0, 0);
      g.addColorStop(.06, "rgba(3,3,4,1)"); g.addColorStop(.3, "rgba(3,3,4,.86)"); g.addColorStop(.58, "rgba(3,3,4,.2)"); g.addColorStop(.7, "rgba(3,3,4,0)"); g.addColorStop(1, "rgba(3,3,4,.55)");
      f.fillStyle = g; f.fillRect(0, 0, W, H);
    } else if (v && v.videoWidth) fit(f, v, v.videoWidth, v.videoHeight, [0, 0, W, H], "contain");
    canvas.width = frame.width; canvas.height = frame.height;
    ctx.drawImage(frame, 0, 0);
    setPhase("handoff");
    reveal.current?.();
    // the film's score plays on under the burn; a skip fades the sound out instead
    if (v && kind !== "film") {
      const v0 = v.volume, t0 = performance.now();
      const fade = (now: number) => { const k = Math.min(1, (now - t0) / 450); try { v.volume = v0 * (1 - k); } catch {} if (k < 1) requestAnimationFrame(fade); else v.pause(); };
      if (!v.paused) requestAnimationFrame(fade);
    }
    const film = kind === "film", BURN = film ? 2000 : 1400, LINGER = 900, seeds = film ? FILM_SEEDS : QUICK_SEEDS;
    const burn = createFilmBurn(W, H, seeds, film ? 7 : 11), fire = createEmbers(W, H);
    const start = performance.now();
    let last = start;
    const tick = (now: number) => {
      const t = now - start, dt = Math.min(.05, (now - last) / 1000); last = now;
      // paced on the burn field: the end card catches at 0.3 s, is two-thirds gone by 1.1 s and gone by 1.7 s (a skip: 1.15 s)
      const p = Math.min(1, t / BURN), spread = film ? .08 + .28 * t / 1000 : .1 + .38 * t / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
      const front = p < 1 ? burn.draw(ctx, spread, { mode: "reveal", source: frame }, t / 1000) : [];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // ignition flash where it catches
      if (t < 420) {
        const k = t / 420, x = seeds[0].x * W, y = seeds[0].y * H, r = Math.max(W, H) * (.08 + .35 * k);
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(255,244,222,${(.85 * (1 - k)).toFixed(3)})`); gr.addColorStop(.35, `rgba(255,160,70,${(.35 * (1 - k)).toFixed(3)})`); gr.addColorStop(1, "rgba(255,90,30,0)");
        ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over";
      }
      if (p < 1) fire.spawn(front, 16, .2);
      fire.step(ctx, dt, .1);
      if (t < BURN + LINGER || (t < BURN + 2600 && fire.count)) requestAnimationFrame(tick);
      else { v?.pause(); finish.current(); }
    };
    requestAnimationFrame(tick);
  }

  const locked = !ready && !slow && phase === "cover", waiting = locked || (phase === "starting" && !ready);
  const src = tall === null ? undefined : tall ? TRAILER_VIDEO.tall : TRAILER_VIDEO.wide;

  return <section className="film-opening" data-phase={phase} role="dialog" aria-modal="true" aria-label="秋遊特務 預告片">
    <video ref={video} className="trailer-video" src={src} preload="auto" playsInline
      onCanPlay={() => setReady(true)} onLoadedData={() => setReady(true)} onError={() => setFailed(true)}
      onWaiting={() => setStalled(true)} onPlaying={() => setStalled(false)} onEnded={() => exit("film")} />
    <div className="trailer-cover" inert={phase !== "cover" && phase !== "starting" && phase !== "blocked"}>
      <picture>
        <source media="(max-aspect-ratio: 4/5)" srcSet={TRAILER_IMAGES.keyArtTall} />
        <img ref={art} className="trailer-cover-art" src={TRAILER_IMAGES.keyArt} alt="" draggable={false} />
      </picture>
      <p className="trailer-credit">馴錢師 <b>×</b> EGROUP</p>
      <div className="trailer-cover-body">
        <p className="trailer-eyebrow">OFFICIAL TRAILER<b>官方預告</b></p>
        <TitleMark className="trailer-mark" sub="AUTUMN AGENTS" motion="cut" />
        <p className="trailer-mission">MISSION 10.29</p>
        <button type="button" className="trailer-play" disabled={locked} aria-busy={waiting || phase === "starting"} aria-describedby="trailer-hint" onClick={play}>
          {waiting
            ? <LoadingIndicator label="影片準備中" compact />
            : <><span className="trailer-play-ring" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" /></svg></span><span>{phase === "blocked" ? "再點一下播放" : "播放預告"}</span></>}
        </button>
        <p id="trailer-hint" className="trailer-hint" role="status">
          {failed ? "影片暫時無法播放，可以先跳過。" : phase === "blocked" ? "瀏覽器需要再點一次，才能播放聲音。" : "建議開啟聲音・全長 32 秒"}
        </p>
      </div>
    </div>
    <i className="trailer-grain" aria-hidden="true" />
    <canvas ref={burnRef} className="film-handoff" aria-hidden="true" />
    {phase === "playing" && stalled && <div className="trailer-note"><LoadingIndicator label="影片緩衝中" compact /></div>}
    <div className="film-controls"><button ref={skip} type="button" onClick={() => exit(phase === "playing" ? "skip" : "cover")}>跳過預告 ↗</button></div>
    {phase === "playing" && <div ref={bar} className="film-progress" />}
  </section>;
}
