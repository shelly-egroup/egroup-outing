"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import TitleMark from "./title-mark";
import LoadingIndicator from "./loading-indicator";
import { openingHistory } from "@/lib/opening-history";
import { TRAILER_IMAGES, TRAILER_VIDEO } from "@/lib/opening-assets";

type Phase = "cover" | "starting" | "playing" | "blocked";

/** The opening: a teaser-poster cover, then the pre-rendered trailer (16:9 or 9:16 to suit the screen) with its own score. */
export default function OpeningAnimation({ onFinish, autoStart = false }: { onFinish: () => void; autoStart?: boolean }) {
  const [tall, setTall] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("cover");
  const [ready, setReady] = useState(false), [slow, setSlow] = useState(false), [stalled, setStalled] = useState(false), [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null), bar = useRef<HTMLDivElement>(null), skip = useRef<HTMLButtonElement>(null);
  const finish = useRef(onFinish), started = useRef(false);
  finish.current = onFinish;

  // Portrait phones get the vertical cut; everything else the widescreen one. Chosen once, before the first paint.
  useLayoutEffect(() => { setTall(window.matchMedia("(max-aspect-ratio: 4/5)").matches); }, []);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") finish.current(); };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = previous; };
  }, []);
  // A network that never delivers must not lock the cover: after 8 s the button works and the browser streams.
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [ready]);
  useEffect(() => { if (phase === "playing") skip.current?.focus({ preventScroll: true }); }, [phase]);
  // The progress hairline follows the film itself.
  useEffect(() => {
    if (phase !== "playing") return;
    let frame = 0;
    const tick = () => {
      const v = video.current;
      if (v && bar.current && v.duration) bar.current.style.transform = "scaleX(" + Math.min(1, v.currentTime / v.duration) + ")";
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  // play() runs inside the tap itself, unmuted; only a browser refusal asks for a second tap.
  function play() {
    const v = video.current;
    if (!v || phase === "playing") return;
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
  const locked = !ready && !slow && phase === "cover", waiting = locked || (phase === "starting" && !ready);
  const src = tall === null ? undefined : tall ? TRAILER_VIDEO.tall : TRAILER_VIDEO.wide;

  return <section className="film-opening" data-phase={phase} role="dialog" aria-modal="true" aria-label="秋遊特務 預告片">
    <video ref={video} className="trailer-video" src={src} preload="auto" playsInline
      onCanPlay={() => setReady(true)} onLoadedData={() => setReady(true)} onError={() => setFailed(true)}
      onWaiting={() => setStalled(true)} onPlaying={() => setStalled(false)} onEnded={() => finish.current()} />
    <div className="trailer-cover" inert={phase === "playing"}>
      <picture>
        <source media="(max-aspect-ratio: 4/5)" srcSet={TRAILER_IMAGES.keyArtTall} />
        <img className="trailer-cover-art" src={TRAILER_IMAGES.keyArt} alt="" draggable={false} />
      </picture>
      <p className="trailer-credit">馴錢師 <b>×</b> EGROUP</p>
      <div className="trailer-cover-body">
        <p className="trailer-eyebrow">OFFICIAL TRAILER<b>官方預告</b></p>
        <TitleMark className="trailer-mark" sub="AUTUMN AGENTS" />
        <p className="trailer-mission">MISSION 10.29</p>
        <button type="button" className="trailer-play" disabled={locked} aria-busy={waiting || phase === "starting"} aria-describedby="trailer-hint" onClick={play}>
          {waiting
            ? <LoadingIndicator label="影片準備中" compact />
            : <><span className="trailer-play-ring" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" /></svg></span><span>{phase === "blocked" ? "再點一下播放" : "播放預告"}</span></>}
        </button>
        <p id="trailer-hint" className="trailer-hint" role="status">
          {failed ? "影片暫時無法播放，可以先跳過。" : phase === "blocked" ? "瀏覽器需要再點一次，才能播放聲音。" : "建議開啟聲音・全長 30 秒"}
        </p>
      </div>
    </div>
    <i className="trailer-grain" aria-hidden="true" />
    {phase === "playing" && stalled && <div className="trailer-note"><LoadingIndicator label="影片緩衝中" compact /></div>}
    <div className="film-controls"><button ref={skip} type="button" onClick={() => finish.current()}>跳過預告 ↗</button></div>
    {phase === "playing" && <div ref={bar} className="film-progress" />}
  </section>;
}
