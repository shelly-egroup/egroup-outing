"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createOpeningAudio, type OpeningAudioState } from "@/lib/opening-audio";
import OpeningSplash from "./opening-splash";
import LoadingIndicator from "./loading-indicator";

// Source video is 60 fps. These cuts are seconds on the extracted audio timeline.
const CUES = [0, 0.183333, 1, 2.116667, 2.983333, 6.133333, 8.616667];
const DURATION = 10.85;
const START_DELAY_MS = 800;
type Plans = [string, string];
function HostShot({side, plans}: {side: "chill" | "walk"; plans: Plans}) {
  const chill = side === "chill";
  return <div className={"film-shot shot-" + side}>
    <span className="film-kicker">{chill ? "CHILL OUT / TEAM B" : "EXPLORE MORE / TEAM A"}</span>
    <div className={"film-host " + (chill ? "film-host-woman" : "film-host-man")} role="img" aria-label={chill ? "老闆為放鬆派登場" : "老闆為走讀派登場"}><img src="/assets/intro-hosts.png" alt="" /></div>
    <div className="film-vertical"><strong>{chill ? "放鬆" : "走讀"}</strong><span>{chill ? "CHILL OUT" : "WALK & EXPLORE"}</span></div>
    <span className="film-corner">{plans[chill ? 1 : 0]}</span><i className="film-cross" />
  </div>;
}
export default function OpeningAnimation({onFinish, plans}: {onFinish: () => void; plans: Plans}) {
  const [step, setStep] = useState(0), [started, setStarted] = useState(false);
  const [audioState, setAudioState] = useState<OpeningAudioState>("idle");
  const audioRef = useRef<HTMLAudioElement>(null), stageRef = useRef<HTMLDivElement>(null), progressRef = useRef<HTMLDivElement>(null);
  const finishRef = useRef(onFinish), sceneRef = useRef(-1);
  const mounted = useRef(false), startedAt = useRef<number | null>(null);
  const sound = useRef<ReturnType<typeof createOpeningAudio> | null>(null);
  // Keep both portraits and the plan shot mounted across their shared turn.
  const shotGroup = step <= 4 ? 1 : step;
  finishRef.current = onFinish;

  function elapsed() {
    return startedAt.current === null ? 0 : Math.max(0, (performance.now() - startedAt.current) / 1000);
  }

  useEffect(() => {
    mounted.current = true;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const audio = audioRef.current;
    if (!audio) return;
    const controller = createOpeningAudio(audio, {
      getTime: () => startedAt.current === null ? null : elapsed(),
      duration: DURATION, onState: setAudioState,
    });
    sound.current = controller;
    // Decode and prepaint under the title card during the 800 ms entrance hold.
    for (const src of ["/assets/intro-hosts.png", "/assets/intro-outing-props-v2.png", "/assets/intro-ganbanyoku-v3.png"]) {
      const img = new Image();
      img.src = src;
      void img.decode().catch(() => {});
    }
    const timer = setTimeout(() => {
      if (!mounted.current) return;
      startedAt.current = performance.now();
      sceneRef.current = -1;
      setStarted(true);
      controller.start();
    }, START_DELAY_MS);
    const unlockSound = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(".film-controls")) return;
      controller.interact();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishRef.current();
      else if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key.length === 1 || event.key === "Enter")) unlockSound(event);
    };
    const resume = () => { if (document.visibilityState === "visible") controller.resume(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("click", unlockSound);
    window.addEventListener("keydown", key);
    return () => {
      mounted.current = false;
      clearTimeout(timer);
      controller.dispose();
      if (sound.current === controller) sound.current = null;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("click", unlockSound);
      window.removeEventListener("keydown", key);
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!started) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0, active = true;
    const tick = () => {
      if (!active) return;
      const time = elapsed();
      if (time >= DURATION) { finishRef.current(); return; }
      const current = reduced ? 6 : Math.max(0, CUES.findLastIndex(cue => cue <= time));
      if (sceneRef.current !== current) { sceneRef.current = current; setStep(current); }
      if (progressRef.current) progressRef.current.style.transform = "scaleX(" + Math.min(time / DURATION, 1) + ")";
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [started]);

  // One timeline drives visuals even when a browser blocks or delays the audio.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !started) return;
    const offset = Math.max(0, elapsed() - (shotGroup === 1 ? 0 : CUES[shotGroup])) * 1000;
    for (const animation of stage.getAnimations({ subtree: true })) animation.currentTime = offset;
  }, [shotGroup, started]);

  return <section className="film-opening" data-audio-state={audioState} role="dialog" aria-modal="true" aria-label="揪是要對決開場動畫">
    <audio ref={audioRef} src="/assets/autumn-opening-score.m4a" preload="auto" />
    <div className="film-controls">
      <button type="button" onClick={onFinish} autoFocus>跳過動畫 ↗</button>
    </div>
    {audioState === "blocked" && <button className="film-audio-note film-sound-prompt" onClick={(event) => { event.stopPropagation(); sound.current?.interact(); }}>音樂自動重試中，也可點一下接上</button>}
    {audioState === "error" && <button className="film-audio-note film-sound-prompt" onClick={(event) => { event.stopPropagation(); sound.current?.interact(); }}>音樂自動重試中，也可點一下重試</button>}
    {started && audioState === "loading" && <div className="film-audio-note"><LoadingIndicator label="音樂載入中" compact /></div>}
    {!started && <OpeningSplash />}
      <div ref={stageRef} className={"film-stage film-step-" + shotGroup} key={shotGroup} data-scene={step} data-playing={started} aria-hidden="true">
        {step === 0 && <div className="film-type-flash"><span>揪是</span><strong>要對決</strong></div>}
        {shotGroup === 1 && <div className="film-host-sequence">
          <div className="film-plan-shot">
            <div className="film-diagonal" />
            <span className="film-object-label object-walk">WALK <small>{plans[0]}</small></span>
            <div className="film-object-composite"><img className="object-massage" src="/assets/intro-ganbanyoku-v3.png" alt="老街走讀與趴臥暖石床的高級 SPA 放鬆意象" /><img className="object-tea" src="/assets/intro-outing-props-v2.png" alt="老街走讀與精緻下午茶" /></div>
            <span className="film-object-label object-chill"><small>按摩 ＋ 飯店下午茶</small> CHILL</span>
            <i className="film-cross" />
          </div>
          <HostShot side="walk" plans={plans} />
          <HostShot side="chill" plans={plans} />
          <div className="film-orbit" aria-hidden="true">
            <div className="orbit-ring orbit-outer"><HostShot side="walk" plans={plans} /></div>
            <div className="orbit-ring orbit-middle"><HostShot side="chill" plans={plans} /></div>
            <div className="orbit-ring orbit-inner"><HostShot side="walk" plans={plans} /></div>
          </div>
        </div>}
        {step === 5 && <div className="film-montage">
          <div className="montage-block block-pink" /><div className="montage-block block-blue" />
          <div className="montage-host montage-woman"><img src="/assets/intro-hosts.png" alt="" /></div>
          <div className="montage-host montage-man"><img src="/assets/intro-hosts.png" alt="" /></div>
          <div className="montage-versus"><span>{plans[0]}<small>老街走讀 · 餐敘 · 手作</small></span><b>VS</b><span>{plans[1]}<small>按摩舒壓 · 飯店下午茶</small></span></div>
        </div>}
        {step === 6 && <div className="film-ending">
          <span className="ending-eyebrow">THE AUTUMN SHOWDOWN</span>
          <h2 className="ending-logo"><span>揪是</span><strong>要對決</strong></h2>
          <p className="ending-message">你的一票，<strong>決定秋遊去哪！</strong></p>
          <div className="ending-partnership" aria-label="馴錢師與 Egroup 聯名"><span className="partner-name partner-trainer">馴錢師</span><b className="partner-cross" aria-hidden="true">×</b><span className="partner-name partner-egroup">Egroup</span></div>
        </div>}
      </div>
    {started && <div ref={progressRef} className="film-progress" />}
  </section>;
}
