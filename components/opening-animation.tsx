"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createOpeningAudio, watchOpeningAudioReady, type OpeningAudioState } from "@/lib/opening-audio";
import OpeningSplash from "./opening-splash";
import ShowLogo from "./show-logo";
import { openingHistory } from "@/lib/opening-history";
import { OPENING_IMAGES } from "@/lib/opening-assets";
import LoadingIndicator from "./loading-indicator";

// Cut points follow the show package this score was cut for (seconds on the audio timeline).
const CUES = [0, 0.033, 0.1, 0.133, 0.2, 1, 1.05, 2.133, 3.7, 5.267, 5.3, 5.8, 7.433, 8, 8.617];
const LAST = CUES.length - 1;
const DURATION = 10.85;
const IMG = OPENING_IMAGES;
type Plans = [string, string];

// Every animation inside a shot runs on that shot's own clock, so a late frame can be re-synced to the score.
function Shot({ at, className, children, style }: { at: number; className: string; children?: ReactNode; style?: CSSProperties }) {
  return <div className={"shot " + className} data-at={at} style={style}>{children}</div>;
}
function Cut({ src, className = "" }: { src: string; className?: string }) {
  return <img className={"cut " + className} src={src} alt="" draggable={false} />;
}
// Horizontal bands of the same cut-out, displaced for the digital tear between hosts.
function Glitch({ src }: { src: string }) {
  return <div className="glitch" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <Cut key={i} src={src} className={"band band-" + i} />)}</div>;
}
function Cross() {
  return <i className="crosshair" aria-hidden="true"><i /><i /></i>;
}
// Two worlds in one frame: the B layer lives on the far side of a rotating split line.
function Split({ a, b, children }: { a: ReactNode; b: ReactNode; children?: ReactNode }) {
  return <>
    <div className="split-layer sd-field-blue">{a}</div>
    <div className="split-rotor"><div className="split-counter sd-field-pink">{b}</div></div>
    {children}
  </>;
}
const BOLT = "M25 2 3 41h15l-7 29 26-44H21l8-24z";
const VS_PATHS = <>
  <path className="vs-v" pathLength={1} d="M18 14 52 106 98 14" />
  <path className="vs-s" pathLength={1} d="M196 14h-62l-12 46h58l-12 46h-66" />
</>;

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
    void Promise.all(Object.values(IMG).map(src => {
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
      const current = reduced ? LAST : Math.max(0, CUES.findLastIndex(cue => cue <= time));
      if (sceneRef.current !== current) { sceneRef.current = current; setStep(current); }
      if (progressRef.current) progressRef.current.style.transform = "scaleX(" + Math.min(time / DURATION, 1) + ")";
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(frame); };
  }, [started]);

  // At every cut, put each shot's animations exactly where the score is, measured from that shot's start.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !started) return;
    const now = elapsed();
    for (const animation of stage.getAnimations({ subtree: true })) {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      const shot = target?.closest<HTMLElement>("[data-at]");
      animation.currentTime = Math.max(0, now - Number(shot?.dataset.at ?? 0)) * 1000;
    }
  }, [step, started]);

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
      <p id="film-start-hint" className="film-start-hint" role="status">{waitingForImages && imagesLagging ? "網路較慢，畫面還在載入，也可以右上跳過。" : audioState === "error" ? "音樂暫時沒載入，可以先看動畫，或再試一次。" : audioState === "blocked" ? "瀏覽器尚未允許播放，請再點一次，或先看動畫。" : slowStart ? "音樂還在路上，可以先看動畫，音樂稍後接上。" : "建議開啟聲音・點一下開場"}</p>
      {offerSilent && <button type="button" className="film-start-silent" onClick={startSilently}>先看動畫，音樂稍後接上 ▶</button>}
      <span className="film-start-partners">馴錢師 <b>×</b> Egroup</span>
    </OpeningSplash>}
    <div ref={stageRef} className="film-stage" data-scene={step} data-playing={started} data-buffering={bufferedAt.current !== null} aria-hidden="true">
      {!started && <div className="prepaint">{Object.values(IMG).map(src => <Cut key={src} src={src} />)}</div>}
      {step === 1 && <Shot at={CUES[1]} className="shot-glyph glyph-white"><b>悠</b></Shot>}
      {step === 3 && <Shot at={CUES[3]} className="shot-glyph glyph-black"><b>閒</b></Shot>}
      {step === 4 && <Shot at={CUES[4]} className="shot-host host-a sd-field-blue">
        <Cut src={IMG.hostA} className="host sd-cutout" />
        <Glitch src={IMG.hostA} />
        <div className="host-word"><strong>悠<br />閒</strong><span className="sd-micro sd-vertical">LEISURE</span></div>
        <span className="host-team sd-micro">TEAM A — {plans[0]}</span>
        <Cross />
        <i className="x-wipe" />
      </Shot>}
      {step === 5 && <Shot at={CUES[5]} className="shot-equals"><i /><i /></Shot>}
      {step === 6 && <Shot at={CUES[6]} className="shot-host host-b sd-field-pink">
        <Cut src={IMG.hostB} className="host sd-cutout" />
        <Glitch src={IMG.hostB} />
        <div className="host-word"><span className="sd-micro sd-vertical">ADRENALINE</span><strong>熱<br />血</strong></div>
        <span className="host-team sd-micro">TEAM B — {plans[1]}</span>
        <Cross />
        <i className="fan sd-field-blue" />
      </Shot>}
      {step === 7 && <Shot at={CUES[7]} className="shot-split split-play">
        <Split a={<Cut src={IMG.photoA} className="prop sd-cutout" />} b={<Cut src={IMG.photoB} className="prop sd-cutout" />}>
          <span className="split-word word-top">FISHING</span>
          <span className="split-word word-bottom">LASER TAG</span>
        </Split>
      </Shot>}
      {step === 8 && <Shot at={CUES[8]} className="shot-split split-feast">
        <Split a={<Cut src={IMG.feastA} className="prop sd-cutout" />} b={<Cut src={IMG.feastB} className="prop sd-cutout" />}>
          <span className="vs-letter letter-v">V</span><i className="vs-rule rule-v" />
          <i className="vs-rule rule-s" /><span className="vs-letter letter-s">S</span>
          <span className="sd-micro sd-vertical feast-side">VERSUS</span>
          <span className="sd-micro feast-corner">R—02</span>
        </Split>
      </Shot>}
      {step === 9 && <Shot at={CUES[9]} className="shot-sweep" />}
      {step === 10 && <Shot at={CUES[10]} className="shot-rapid">
        <div className="beat beat-1"><Cut src={IMG.feastA} className="sd-cutout" /></div>
        <div className="beat beat-2 pair"><Cut src={IMG.feastA} className="sd-cutout" /><Cut src={IMG.feastB} className="sd-cutout" /></div>
        <div className="beat beat-3"><Cut src={IMG.photoB} className="sd-cutout" /></div>
        <div className="beat beat-4 pair"><Cut src={IMG.photoA} className="sd-cutout" /><Cut src={IMG.photoB} className="sd-cutout" /></div>
        <div className="beat beat-5 on-band"><div className="pair"><Cut src={IMG.hostA} className="sd-cutout" /><Cut src={IMG.hostB} className="sd-cutout" /></div></div>
        <div className="beat beat-6 on-band"><div className="pair"><Cut src={IMG.feastA} className="sd-cutout" /><Cut src={IMG.feastB} className="sd-cutout" /></div></div>
      </Shot>}
      {(step === 11 || step === 12) && <Shot at={CUES[11]} className="shot-studio sd-studio">
        <div className="studio-camera">
          <Cut src={IMG.hostA} className="studio-ghost ghost-a sd-cutout" />
          <Cut src={IMG.hostB} className="studio-ghost ghost-b sd-cutout" />
          <div className="studio-row">
            <i className="pillar pa1" /><i className="pillar pa2" /><i className="pillar pa3" />
            <i className="pillar-gap" />
            <i className="pillar pb3" /><i className="pillar pb2" /><i className="pillar pb1" />
          </div>
          <Cut src={IMG.photoA} className="studio-prop sp-photo-a sd-cutout" />
          <Cut src={IMG.feastA} className="studio-prop sp-feast-a sd-cutout" />
          <Cut src={IMG.photoB} className="studio-prop sp-photo-b sd-cutout" />
          <Cut src={IMG.feastB} className="studio-prop sp-feast-b sd-cutout" />
          <span className="sd-micro studio-versus">VERSUS</span>
        </div>
        {step === 12 && <div className="vs-draw" data-at={CUES[12]}>
          <i className="streak streak-a" /><i className="streak streak-b" />
          <svg viewBox="0 0 214 120">{VS_PATHS}</svg>
        </div>}
      </Shot>}
      {step === 13 && <Shot at={CUES[13]} className="shot-silhouette">
        <svg className="vs-solid" viewBox="0 0 214 120">{VS_PATHS}</svg>
        <Cut src={IMG.hostA} className="shade shade-a" />
        <Cut src={IMG.hostB} className="shade shade-b" />
        <svg className="swoop swoop-blue" viewBox="0 0 40 72"><path d={BOLT} /></svg>
        <svg className="swoop swoop-pink" viewBox="0 0 40 72"><path d={BOLT} /></svg>
        <svg className="swoop swoop-white" viewBox="0 0 40 72"><path d={BOLT} /></svg>
      </Shot>}
      {step === LAST && <Shot at={CUES[LAST]} className="shot-logo sd-stage-dark" style={{ ["--hold" as string]: holdOutro ? "paused" : "running" }}>
        <div className="assemble">
          <i className="bar bar-cyan" /><i className="bar bar-pink" /><i className="bar bar-white" />
          <ShowLogo className="ending-lockup" />
        </div>
        <p className="ending-line">你的一票，<strong>決定秋遊去哪！</strong></p>
        <p className="ending-partners sd-micro">馴錢師 <b>×</b> Egroup</p>
        <i className="ending-fade" />
      </Shot>}
    </div>
    {started && <div ref={progressRef} className="film-progress" />}
  </section>;
}
