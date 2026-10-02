"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createOpeningAudio, watchOpeningAudioReady, type OpeningAudioState } from "@/lib/opening-audio";
import OpeningSplash from "./opening-splash";
import { openingHistory } from "@/lib/opening-history";
import { OPENING_IMAGES } from "@/lib/opening-assets";
import LoadingIndicator from "./loading-indicator";

// Source video is 60 fps. These cuts are seconds on the extracted audio timeline.
const CUES = [0, 0.183333, 1, 2.116667, 2.983333, 6.133333, 8.616667];
const DURATION = 10.85;
const { hosts: HOSTS, fishing: FISHING, laser: LASER } = OPENING_IMAGES;
type Plans = [string, string];
function HostShot({side, plans}: {side: "A" | "B"; plans: Plans}) {
  const laser = side === "B";
  return <div className={"film-shot " + (laser ? "shot-chill" : "shot-walk")}>
    <span className="film-kicker">{laser ? "BATTLE / TEAM B" : "FISHING / TEAM A"}</span>
    <div className={"film-host " + (laser ? "film-host-woman" : "film-host-man")} role="img" aria-label={"老闆為" + plans[laser ? 1 : 0] + "登場"}><img src={HOSTS} alt="" /></div>
    <div className="film-vertical"><strong>{laser ? "槍戰" : "釣蝦"}</strong><span>{laser ? "BATTLE" : "FISHING"}</span></div>
    <span className="film-corner">{plans[laser ? 1 : 0]}</span><i className="film-cross" />
  </div>;
}
export default function OpeningAnimation({onFinish, plans}: {onFinish: () => void; plans: Plans}) {
  const [step, setStep] = useState(0), [started, setStarted] = useState(false), [holdOutro, setHoldOutro] = useState(false);
  const [audioState, setAudioState] = useState<OpeningAudioState>("idle");
  const [soundReady, setSoundReady] = useState(false), [imagesReady, setImagesReady] = useState(false);
  const [imagesLagging, setImagesLagging] = useState(false), [imagesSlow, setImagesSlow] = useState(false);
  const [startAttempts, setStartAttempts] = useState(0), [slowStart, setSlowStart] = useState(false);
  const requested = useRef(false), skipButtonRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null), stageRef = useRef<HTMLDivElement>(null), progressRef = useRef<HTMLDivElement>(null);
  const finishRef = useRef(onFinish), sceneRef = useRef(-1);
  const mounted = useRef(false), playbackStarted = useRef(false), startedAt = useRef<number | null>(null), bufferedAt = useRef<number | null>(null);
  const outroHeld = useRef(false), silent = useRef(false);
  const sound = useRef<ReturnType<typeof createOpeningAudio> | null>(null);
  // Keep both portraits and the plan shot mounted across their shared turn.
  const shotGroup = step <= 4 ? 1 : step;
  finishRef.current = onFinish;

  function elapsed() {
    return startedAt.current === null ? 0 : Math.max(0, ((bufferedAt.current ?? performance.now()) - startedAt.current) / 1000);
  }

  useEffect(() => {
    mounted.current = true;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const audio = audioRef.current;
    if (!audio) return;
    const controller = createOpeningAudio(audio, {
      getTime: () => startedAt.current === null ? null : elapsed(),
      duration: DURATION,
      onState: (state) => {
        if (playbackStarted.current && !silent.current) {
          if (state === "playing" && bufferedAt.current !== null) {
            startedAt.current = (startedAt.current ?? performance.now()) + performance.now() - bufferedAt.current;
            bufferedAt.current = null;
            stageRef.current?.removeAttribute("data-buffering");
          } else if (state !== "playing" && bufferedAt.current === null) {
            bufferedAt.current = performance.now();
            stageRef.current?.setAttribute("data-buffering", "true");
          }
        }
        setAudioState(state);
      },
      onPlaybackStart: (position) => {
        if (!mounted.current || playbackStarted.current) return;
        playbackStarted.current = true;
        startedAt.current = performance.now() - Math.max(0, position) * 1000;
        sceneRef.current = -1;
        openingHistory.markSeen();
        setStarted(true);
      },
    });
    sound.current = controller;
    const stopWatchingReadiness = watchOpeningAudioReady(audio, setSoundReady);
    // Decode and prepaint while the visitor is on the START cover, without
    // delaying the original sound-first start button.
    // A failed image must not lock the cover, so errors also count as settled.
    void Promise.all([HOSTS, FISHING, LASER].map(src => {
      const picture = new Image();
      picture.src = src;
      return picture.decode().catch(() => {});
    })).then(() => { if (mounted.current) setImagesReady(true); });
    const unlockSound = (event: Event) => {
      if (!playbackStarted.current) return;
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
      stopWatchingReadiness();
      controller.dispose();
      audioRef.current = null;
      if (sound.current === controller) sound.current = null;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("click", unlockSound);
      window.removeEventListener("keydown", key);
      document.body.style.overflow = previous;
    };
  }, []);

  function startFromClick() {
    const controller = sound.current;
    if (!controller || playbackStarted.current) return;
    setSlowStart(false);
    setStartAttempts(value => value + 1);
    // No timer or await here: audio starts inside the actual button click.
    if (!requested.current) { requested.current = true; controller.start(); }
    else controller.interact();
  }
  // Visuals first when the score is slow: the shared clock lets the music align and join once it can play.
  function startSilently() {
    if (playbackStarted.current) return;
    silent.current = true;
    playbackStarted.current = true;
    startedAt.current = performance.now();
    sceneRef.current = -1;
    openingHistory.markSeen();
    if (!requested.current) { requested.current = true; sound.current?.start(); }
    setStarted(true);
  }
  useEffect(() => {
    if (started) skipButtonRef.current?.focus({ preventScroll: true });
  }, [started]);
  useEffect(() => {
    if (imagesReady) return;
    const lagging = setTimeout(() => setImagesLagging(true), 3000), slow = setTimeout(() => setImagesSlow(true), 10000);
    return () => { clearTimeout(lagging); clearTimeout(slow); };
  }, [imagesReady]);
  useEffect(() => {
    if (!startAttempts || started) return;
    const timer = setTimeout(() => setSlowStart(true), 3000);
    return () => clearTimeout(timer);
  }, [startAttempts, started]);

  useEffect(() => {
    if (!started) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0, active = true;
    const tick = () => {
      if (!active) return;
      const time = elapsed();
      const audio = audioRef.current;
      const mediaTime = audio?.currentTime ?? 0;
      const mediaDuration = audio && Number.isFinite(audio.duration) ? audio.duration : DURATION;
      const fadeAt = DURATION - .3;
      // On a slower device, hold only the final fade until the original score catches up.
      if (!silent.current && time >= fadeAt && !outroHeld.current && mediaTime < fadeAt - .12 && !audio?.ended) {
        outroHeld.current = true;
        setHoldOutro(true);
      } else if (outroHeld.current && (mediaTime >= fadeAt - .03 || audio?.ended)) {
        outroHeld.current = false;
        setHoldOutro(false);
      }
      if (audio?.ended || (time >= DURATION && (silent.current || mediaTime >= mediaDuration - .015)) || time >= DURATION + 4) {
        finishRef.current();
        return;
      }
      const current = reduced ? 6 : Math.max(0, CUES.findLastIndex(cue => cue <= time));
      if (sceneRef.current !== current) { sceneRef.current = current; setStep(current); }
      if (progressRef.current) progressRef.current.style.transform = "scaleX(" + Math.min(time / DURATION, 1) + ")";
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [started]);

  // Start the original smooth visual clock when the score is genuinely playing.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !started) return;
    const offset = Math.max(0, elapsed() - (shotGroup === 1 ? 0 : CUES[shotGroup])) * 1000;
    for (const animation of stage.getAnimations({ subtree: true })) animation.currentTime = offset;
  }, [shotGroup, started]);

  // The cover stays tappable while the score preloads; a tap starts as soon as the music can play.
  // Browsers only allow sound from play() inside the click itself, so the button waits for the
  // shots instead of deferring playback; a very slow network unlocks it anyway.
  const waitingForImages = !imagesReady && !imagesSlow;
  const waitingForPlayback = startAttempts > 0 && audioState === "loading" && !slowStart;
  const preparing = waitingForImages || waitingForPlayback;
  // Playing without music only helps once the shots are ready; slow images just keep preparing.
  const offerSilent = (imagesReady || imagesSlow) && (slowStart || audioState === "error" || (startAttempts > 0 && audioState === "blocked"));

  return <section className="film-opening" data-audio-state={audioState} role="dialog" aria-modal="true" aria-label="揪是要對決開場動畫">
    <audio ref={audioRef} src="/assets/autumn-opening-score.m4a?v=2" preload="auto" />
    <div className="film-controls">
      <button ref={skipButtonRef} type="button" onClick={onFinish}>跳過動畫 ↗</button>
    </div>
    {started && audioState === "blocked" && <button className="film-audio-note film-sound-prompt" onClick={(event) => { event.stopPropagation(); sound.current?.interact(); }}>音樂自動重試中，也可點一下接上</button>}
    {started && audioState === "error" && <button className="film-audio-note film-sound-prompt" onClick={(event) => { event.stopPropagation(); sound.current?.interact(); }}>音樂自動重試中，也可點一下重試</button>}
    {started && audioState === "loading" && <div className="film-audio-note"><LoadingIndicator label="音樂載入中" compact /></div>}
    {!started && <OpeningSplash>
      <div className="film-start-match" aria-label={plans.join("對決")}><span>{plans[0]}</span><b aria-hidden="true">VS</b><span>{plans[1]}</span></div>
      <button type="button" className="film-start-button" onClick={startFromClick} disabled={preparing} aria-busy={preparing} aria-describedby="film-start-hint">
        {preparing
          ? <LoadingIndicator label={!imagesReady ? "畫面準備中" : soundReady ? "準備開場" : "音樂準備中"} compact />
          : <><span>{startAttempts > 0 ? "再試一次" : "開始對決"}</span><span className="film-start-play" aria-hidden="true">▶</span></>}
      </button>
      <p id="film-start-hint" className="film-start-hint" role="status">{waitingForImages && imagesLagging ? "網路較慢，畫面還在載入，也可以右上跳過。" : audioState === "error" ? "音樂暫時沒載入，可以先看動畫，或再試一次。" : audioState === "blocked" ? "瀏覽器尚未允許播放，請再點一次，或先看動畫。" : slowStart ? "音樂還在路上，可以先看動畫，音樂稍後接上。" : "點一下，精彩即刻開場。"}</p>
      {offerSilent && <button type="button" className="film-start-silent" onClick={startSilently}>先看動畫，音樂稍後接上 ▶</button>}
      <span className="film-start-partners">馴錢師 <b>×</b> Egroup</span>
    </OpeningSplash>}
      <div ref={stageRef} className={"film-stage film-step-" + shotGroup} key={shotGroup} data-scene={step} data-playing={started} data-buffering={bufferedAt.current !== null} aria-hidden="true">
        {step === 0 && <div className="film-type-flash"><span>揪是</span><strong>要對決</strong></div>}
        {shotGroup === 1 && <div className="film-host-sequence">
          <div className="film-plan-shot">
            <div className="film-diagonal" />
            <span className="film-object-label object-walk">FISHING <small>{plans[0]}</small></span>
            <div className="film-object-composite">
              <img className="object-fishing" src={FISHING} alt="" />
              <img className="object-laser" src={LASER} alt="" />
            </div>
            <span className="film-object-label object-chill"><small>{plans[1]}</small> BATTLE</span>
            <i className="film-cross" />
          </div>
          <HostShot side="A" plans={plans} />
          <HostShot side="B" plans={plans} />
          <div className="film-orbit" aria-hidden="true">
            <div className="faceoff-host faceoff-a"><img src={HOSTS} alt="" /></div>
            <div className="faceoff-host faceoff-b"><img src={HOSTS} alt="" /></div>
            <i className="faceoff-flash" />
          </div>
        </div>}
        {step === 5 && <div className="film-montage">
          <div className="montage-block block-pink" /><div className="montage-block block-blue" />
          <div className="montage-host montage-woman"><img src={HOSTS} alt="" /></div>
          <div className="montage-host montage-man"><img src={HOSTS} alt="" /></div>
            <div className="montage-versus"><span>{plans[0]}<small>釣蝦 · 村民食堂</small></span><b>VS</b><span>{plans[1]}<small>雷射槍戰 · 飯店 Buffet</small></span></div>
        </div>}
        {step === 6 && <div className="film-ending" data-hold-outro={holdOutro}>
          <span className="ending-eyebrow">THE AUTUMN OUTING</span>
          <h2 className="ending-logo"><span>揪是</span><strong>要對決</strong></h2>
          <p className="ending-message">你的一票，<strong>決定秋遊去哪！</strong></p>
          <div className="ending-partnership" aria-label="馴錢師與 Egroup 聯名"><span className="partner-name partner-trainer">馴錢師</span><b className="partner-cross" aria-hidden="true">×</b><span className="partner-name partner-egroup">Egroup</span></div>
        </div>}
      </div>
    {started && <div ref={progressRef} className="film-progress" />}
  </section>;
}
