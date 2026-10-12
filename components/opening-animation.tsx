"use client";
import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createOpeningAudio, watchOpeningAudioReady, type OpeningAudioState } from "@/lib/opening-audio";
import ShowLogo from "./show-logo";
import { openingHistory } from "@/lib/opening-history";
import { OPENING_SCORE, TRAILER_FONTS, TRAILER_IMAGES } from "@/lib/opening-assets";
import T from "@/lib/opening-timeline.json";
import { drawFuse, type FilmRect } from "@/lib/trailer-fuse";
import LoadingIndicator from "./loading-indicator";

const IMG = TRAILER_IMAGES;
const SCORE = OPENING_SCORE;
const DURATION = T.duration;
// One entry per cut, in seconds on the score's timeline; sub-cuts inside a shot run on that shot's own clock.
const SHOTS = [
  ["dots", 0], ["barrel", T.irisOpen], ["title-1", T.titles[0]], ["title-2", T.titles[1]], ["title-3", T.titles[2]], ["title-4", T.titles[3]],
  ["ignite", T.ignite], ["dossier", T.mission], ["brief-a", T.briefA], ["brief-b", T.briefB], ["montage", T.montage], ["result", T.result],
  ["riser", T.riser], ["blackout", T.blackout], ["logo", T.logo], ["destruct", T.destruct],
] as const;
type ShotId = (typeof SHOTS)[number][0];
const LAST = SHOTS.length - 1;
const shotIndex = (time: number) => Math.max(0, SHOTS.findLastIndex(([, at]) => at <= time));
/** [plan A, plan B] short names; plan B (熱血對戰派) is the trip that was decided. */
type Plans = [string, string];

// Every animation inside a shot runs on that shot's own clock, so a late frame can be re-synced to the score.
function Shot({ at, id, children, style }: { at: number; id: ShotId; children?: ReactNode; style?: CSSProperties }) {
  return <div className={"shot sh-" + id} data-at={at} style={style}>{children}</div>;
}
function Img({ src, className = "" }: { src: string; className?: string }) {
  return <img className={"cut " + className} src={src} alt="" draggable={false} />;
}
/** A full-bleed picture that appears for [from, to) seconds of its shot. */
function Cut({ src, from, to, className = "", children }: { src: string; from: number; to: number; className?: string; children?: ReactNode }) {
  return <div className={"tr-cut " + className} style={{ ["--cin" as string]: from + "s", ["--cout" as string]: to + "s" }}>
    <Img src={src} className="tr-plate" />
    {children}
  </div>;
}
/** A cut-out reduced to its outline, filled with the element's own colour. */
function Silhouette({ src, ratio, className }: { src: string; ratio: number; className: string }) {
  return <i className={className} style={{ ["--src" as string]: "url(" + src + ")", ["--ar" as string]: ratio }} />;
}
/** Characters land one by one, in step with the typewriter clicks in the score. */
function Typed({ text, at, step = 0.05 }: { text: string; at: number; step?: number }) {
  return <span className="tr-typed" aria-label={text}>
    {[...text].map((char, i) => <span key={i} className="tr-ch" style={{ animationDelay: at + i * step + "s" }}>{char}</span>)}
  </span>;
}
/** Mission copy: a chip, one big word, one line under it — each line rises out of its own mask. */
function Caption({ chip, big, sub, tone, at = 0 }: { chip?: string; big: string; sub?: string; tone?: "red" | "blue" | "amber"; at?: number }) {
  return <div className={"tr-cap" + (tone ? " tone-" + tone : "")} style={{ ["--at" as string]: at + "s" }}>
    {chip && <span className="tr-line"><span className="tr-chip">{chip}</span></span>}
    <span className="tr-line"><strong className="tr-big">{big}</strong></span>
    {sub && <span className="tr-line"><span className="tr-sub">{sub}</span></span>}
  </div>;
}
// Rifling: six grooves that spiral as they recede, and the bore's turned rings.
const GROOVES = Array.from({ length: 6 }, (_, k) => {
  const pts = Array.from({ length: 9 }, (_, i) => { const r = 58 + i * 5.25, a = (k * 60 + (r - 58) * 1.9) * Math.PI / 180; return `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`; });
  return "M" + pts.join(" L");
});
const DRIP = "M0 0H200V196C193 196 191 214 186 230 183 240 175 240 173 229 170 214 170 199 163 199 156 199 156 210 152 216 148 222 142 220 141 211 140 200 136 196 128 196 120 196 121 228 116 246 113 256 104 256 102 244 99 222 100 199 91 198 83 198 83 207 79 212 75 217 69 214 68 206 67 199 63 197 55 197 47 197 47 222 42 236 39 245 31 245 29 234 27 220 28 199 20 198 12 198 9 206 6 210 3 214 0 211 0 206Z";

type Props = { onFinish: () => void; plans: Plans; date?: string; standings?: [number, number] | null };
// The page re-renders every second for its countdown; the film only re-renders when what it shows changes.
export default memo(OpeningAnimation, (a: Props, b: Props) => a.onFinish === b.onFinish && a.date === b.date
  && a.plans[0] === b.plans[0] && a.plans[1] === b.plans[1] && a.standings?.[0] === b.standings?.[0] && a.standings?.[1] === b.standings?.[1]);

function OpeningAnimation({ onFinish, plans, date = "10.29", standings = null }: Props) {
  const [step, setStep] = useState(0), [started, setStarted] = useState(false);
  const [audioState, setAudioState] = useState<OpeningAudioState>("idle");
  const [soundReady, setSoundReady] = useState(false), [imagesReady, setImagesReady] = useState(false);
  const [imagesSlow, setImagesSlow] = useState(false);
  const [scoreSrc, setScoreSrc] = useState<string>(), [soundSlow, setSoundSlow] = useState(false);
  const [startAttempts, setStartAttempts] = useState(0);
  const [launching, setLaunching] = useState(false), [launchSlow, setLaunchSlow] = useState(false);
  const [reviewStandings, setReviewStandings] = useState<[number, number] | null>(null);
  const requested = useRef(false), skipButtonRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null), stageRef = useRef<HTMLDivElement>(null), progressRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null), canvasRef = useRef<HTMLCanvasElement>(null), rectRef = useRef<FilmRect | null>(null);
  const hudRef = useRef<HTMLDivElement>(null), hudText = useRef("");
  const finishRef = useRef(onFinish), sceneRef = useRef(-1);
  const mounted = useRef(false), playbackStarted = useRef(false), startedAt = useRef<number | null>(null), bufferedAt = useRef<number | null>(null);
  const outroHeld = useRef(false), silent = useRef(false), seekTime = useRef<number | null>(null);
  const sound = useRef<ReturnType<typeof createOpeningAudio> | null>(null);
  finishRef.current = onFinish;

  function elapsed() {
    if (seekTime.current !== null) return seekTime.current;
    return startedAt.current === null ? 0 : Math.max(0, ((bufferedAt.current ?? performance.now()) - startedAt.current) / 1000);
  }
  // The canvas covers the whole screen; the fuse needs to know where the letterbox bars are.
  function measure() {
    const canvas = canvasRef.current, frame = frameRef.current;
    if (!canvas || !frame) return;
    const box = frame.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    rectRef.current = { x: box.left, y: box.top, w: box.width, h: box.height, vw: window.innerWidth, vh: window.innerHeight };
    canvas.width = Math.round(window.innerWidth * dpr); canvas.height = Math.round(window.innerHeight * dpr);
  }
  function paint(time: number) {
    // REC timecode (24 fps) counts the mission from the moment the fuse is lit
    const mission = time >= T.ignite && time < T.blackout ? time - T.ignite : -1;
    const text = mission < 0 ? "" : "REC  00:00:" + String(Math.floor(mission)).padStart(2, "0") + ":" + String(Math.floor((mission % 1) * 24)).padStart(2, "0");
    if (hudRef.current && text !== hudText.current) { hudText.current = text; hudRef.current.textContent = text; }
    const canvas = canvasRef.current, rect = rectRef.current, g = canvas?.getContext("2d");
    if (!canvas || !rect || !g) return;
    drawFuse(g, time, rect, canvas.width / rect.vw);
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
    const stopWatchingReadiness = watchOpeningAudioReady(audio, ready => { if (ready) setSoundReady(true); });
    // Decode every shot and load every face while the visitor is on the cover, so no cut waits for a picture or a font.
    // A failed image or font must not lock the cover, so errors also count as settled.
    void Promise.all([
      ...Object.values(IMG).map(src => { const picture = new Image(); picture.src = src; return picture.decode().catch(() => {}); }),
      ...TRAILER_FONTS.map(font => document.fonts.load(font, "今年秋天兩位老闆路線任務簡報選出秋遊方案闖關雷射槍戰勝負未定最後一票銷毀 MISSION 0123456789").catch(() => {})),
    ]).then(() => { if (mounted.current) setImagesReady(true); });
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
    window.addEventListener("resize", measure);
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
      window.removeEventListener("resize", measure);
      document.body.style.overflow = previous;
    };
  }, []);

  // Development only: ?filmSeek opens the film paused, and window.__filmSeek(t) poses every layer at t for frame review.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (process.env.NODE_ENV === "production" || !params.has("filmSeek")) return;
    const counts = params.get("standings")?.split(",").map(Number);
    if (counts?.length === 2) setReviewStandings(counts as [number, number]);
    const seek = (time: number) => {
      seekTime.current = time;
      flushSync(() => { setStarted(true); setStep(shotIndex(time)); });
      measure();
      for (const animation of stageRef.current?.getAnimations({ subtree: true }) ?? []) {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        const shot = target?.closest<HTMLElement>("[data-at]");
        animation.currentTime = Math.max(0, time - Number(shot?.dataset.at ?? 0)) * 1000;
        animation.pause();
      }
      paint(time);
    };
    (window as unknown as { __filmSeek: typeof seek }).__filmSeek = seek;
    return () => { delete (window as unknown as { __filmSeek?: typeof seek }).__filmSeek; };
  }, []);

  // Called from the mouse press itself (no wait for release) and from every click; play() always runs inside the gesture.
  function launch() {
    const controller = sound.current;
    if (!controller || playbackStarted.current) return;
    if (!requested.current) {
      requested.current = true;
      setLaunching(true);
      setLaunchSlow(false);
      setStartAttempts(value => value + 1);
      controller.start();
      return;
    }
    if (audioState === "blocked" || audioState === "error") {
      setLaunchSlow(false);
      setStartAttempts(value => value + 1);
    }
    controller.interact();
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
  // The press is answered visually at once; only a genuinely slow start turns the button into a loader.
  useEffect(() => {
    if (!launching || started) return;
    const timer = setTimeout(() => setLaunchSlow(true), 700);
    return () => clearTimeout(timer);
  }, [launching, started, startAttempts]);
  useEffect(() => {
    if (imagesReady) return;
    const slow = setTimeout(() => setImagesSlow(true), 10000);
    return () => clearTimeout(slow);
  }, [imagesReady]);
  // Download the whole score once and play it from memory: iOS will not preload a media element before a tap, and
  // range requests would fetch it again. START unlocks when this copy can play, so the tap starts instantly.
  useEffect(() => {
    let url = "", alive = true;
    fetch(SCORE, { cache: "force-cache" })
      .then(response => response.ok ? response.blob() : Promise.reject(new Error(String(response.status))))
      .then(blob => { if (!alive) return; url = URL.createObjectURL(blob); setScoreSrc(url); })
      .catch(() => { if (alive) setScoreSrc(SCORE); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, []);
  const soundLoaded = soundReady;
  // A score that never arrives must not lock the cover forever; after 15s START works and the music joins when it can.
  useEffect(() => {
    if (soundLoaded) return;
    const slow = setTimeout(() => { setSoundSlow(true); setScoreSrc(current => current ?? SCORE); }, 15000);
    return () => clearTimeout(slow);
  }, [soundLoaded]);
  // A slow score never strands the visitor: at 8s the film starts and the music joins when it arrives.
  useEffect(() => {
    if (!startAttempts || started || audioState === "blocked") return;
    const fallback = setTimeout(startSilently, 8000);
    return () => clearTimeout(fallback);
  }, [startAttempts, started, audioState]);

  useEffect(() => {
    if (!started || seekTime.current !== null) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0, active = true;
    measure();
    const tick = () => {
      if (!active) return;
      const time = elapsed();
      const audio = audioRef.current;
      const mediaTime = audio?.currentTime ?? 0;
      const mediaDuration = audio && Number.isFinite(audio.duration) ? audio.duration : DURATION;
      const fadeAt = T.burn;
      // On a slower device, hold only the self-destruct until the score catches up, so the burn lands on its sound.
      if (!silent.current && time >= fadeAt && !outroHeld.current && mediaTime < fadeAt - .12 && !audio?.ended) outroHeld.current = true;
      else if (outroHeld.current && (mediaTime >= fadeAt - .03 || audio?.ended)) outroHeld.current = false;
      if (audio?.ended || (time >= DURATION && (silent.current || mediaTime >= mediaDuration - .015)) || time >= DURATION + 4) {
        finishRef.current();
        return;
      }
      const current = reduced ? LAST - 1 : shotIndex(time);
      if (sceneRef.current !== current) { sceneRef.current = current; setStep(current); }
      if (!reduced) paint(outroHeld.current ? Math.min(time, T.burn) : time);
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

  // One button only: it stays in a loading state until the shots and the score have both loaded, and again after
  // the tap until the music plays. play() still runs inside the tap; only a browser refusal asks for one more tap.
  const waitingForImages = !imagesReady && !imagesSlow;
  const waitingForSound = !soundLoaded && !soundSlow;
  const loadingAssets = waitingForImages || waitingForSound;
  const launchVisible = launching && audioState !== "blocked";
  const preparing = loadingAssets || (launchVisible && launchSlow);
  const loadingLabel = waitingForImages ? "畫面準備中" : waitingForSound ? "音效準備中" : audioState === "error" ? "音樂重新連線中" : "準備放映";
  const shot = SHOTS[step][0];
  const [votesA, votesB] = reviewStandings ?? standings ?? [0, 0];
  const total = votesA + votesB;
  // The tally only shows when it agrees with the decision; otherwise the card just announces the trip.
  const showTally = votesB > votesA;
  const share = (votes: number) => total ? Math.max(4, Math.round(votes / total * 100)) : 50;

  return <section className="film-opening" data-audio-state={audioState} role="dialog" aria-modal="true" aria-label="揪是要對決預告片">
    <audio ref={audioRef} src={scoreSrc} preload="auto" />
    <div className="film-controls">
      <button ref={skipButtonRef} type="button" onClick={onFinish}>跳過預告 ↗</button>
    </div>
    {started && audioState === "blocked" && <button className="film-audio-note film-sound-prompt" onClick={(event) => { event.stopPropagation(); sound.current?.interact(); }}>音樂自動重試中，也可點一下接上</button>}
    {started && audioState === "error" && <button className="film-audio-note film-sound-prompt" onClick={(event) => { event.stopPropagation(); sound.current?.interact(); }}>音樂自動重試中，也可點一下重試</button>}
    {started && audioState === "loading" && <div className="film-audio-note"><LoadingIndicator label="音樂載入中" compact /></div>}
    {!started && <div className={"tr-cover" + (launchVisible ? " is-launching" : "")}>
      <Img src={IMG.keyArt} className="tr-cover-art" />
      <div className="tr-cover-body">
        <span className="tr-cover-eyebrow">OFFICIAL TRAILER<b>官方預告</b></span>
        <ShowLogo title className="tr-cover-logo" />
        <div className="tr-cover-match"><b>行程定案</b><span>{plans[1]}・雷射槍戰＋飯店下午茶</span></div>
        <button type="button" className="tr-play" disabled={loadingAssets} aria-busy={preparing || launchVisible} aria-describedby="film-start-hint"
          onPointerDown={event => { if (event.pointerType === "mouse" && event.button === 0 && !loadingAssets) launch(); }} onClick={launch}>
          {preparing
            ? <LoadingIndicator label={loadingLabel} compact />
            : <><span className="tr-play-ring" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" /></svg></span><span>{audioState === "blocked" ? "再點一下播放" : "播放預告"}</span></>}
        </button>
        <p id="film-start-hint" className="tr-cover-hint" role="status">{audioState === "blocked" ? "瀏覽器需要再點一次，才能播放音樂。" : "建議開啟聲音・全長 28 秒"}</p>
        <span className="tr-cover-partners">馴錢師 <b>×</b> Egroup</span>
      </div>
    </div>}
    <div ref={stageRef} className="film-stage" data-shot={shot} data-playing={started} data-buffering={bufferedAt.current !== null} aria-hidden="true">
      <div className="prepaint">{Object.values(IMG).map(src => <Img key={src} src={src} />)}</div>
      <div ref={frameRef} className="tr-frame">
        {shot === "dots" && <Shot at={0} id="dots">{[0, 1, 2, 3, 4].map(i => <i key={i} className={"tr-dot d" + i} />)}</Shot>}
        {shot === "barrel" && <Shot at={T.irisOpen} id="barrel">
          {[0, 1, 2, 3].map(i => <i key={i} className={"tr-dot tr-dot-out d" + i} />)}
          <div className="tr-barrel">
            <div className="tr-world">
              <div className="tr-agent tr-walk"><Img src={IMG.agentWalk} /></div>
              <div className="tr-agent tr-aim"><Img src={IMG.agentAim} /><i className="tr-muzzle" /></div>
              <i className="tr-fireflash" />
            </div>
            <svg className="tr-bore" viewBox="-100 -100 200 200">
              <defs>
                <radialGradient id="tr-bore-shade">
                  <stop offset=".575" stopColor="#8d867b" stopOpacity="0" /><stop offset=".58" stopColor="#9a9388" /><stop offset=".64" stopColor="#4c4740" />
                  <stop offset=".8" stopColor="#24211e" /><stop offset="1" stopColor="#0b0a09" />
                </radialGradient>
              </defs>
              <circle r="100" fill="url(#tr-bore-shade)" />
              {[66, 74, 83, 92].map(r => <circle key={r} r={r} fill="none" stroke="#fff" strokeOpacity=".05" strokeWidth=".6" />)}
              <g className="tr-rifling">
                {GROOVES.map((d, k) => <path key={k} d={d} fill="none" stroke="#000" strokeOpacity=".62" strokeWidth="3.2" />)}
                {GROOVES.map((d, k) => <path key={"h" + k} d={d} transform="rotate(5)" fill="none" stroke="#b9b1a4" strokeOpacity=".28" strokeWidth="1.1" />)}
              </g>
            </svg>
            <svg className="tr-drip" viewBox="0 0 200 260" preserveAspectRatio="none"><path d={DRIP} /></svg>
            <i className="tr-bleed" />
          </div>
          <i className="tr-iris" />
        </Shot>}
        {shot === "title-1" && <Shot at={T.titles[0]} id="title-1">
          <i className="tr-redwipe" />
          <Silhouette src={IMG.agentWalk} ratio={592 / 1200} className="tr-sil tr-sil-a" />
          <div className="tr-title"><small>THIS AUTUMN</small><strong>今年秋天</strong></div>
        </Shot>}
        {shot === "title-2" && <Shot at={T.titles[1]} id="title-2">
          <Silhouette src={IMG.agentB} ratio={320 / 1200} className="tr-sil tr-sil-b" />
          <i className="tr-scan" />
          <div className="tr-title"><small>TWO BOSSES</small><strong>兩位老闆</strong></div>
        </Shot>}
        {shot === "title-3" && <Shot at={T.titles[2]} id="title-3">
          <div className="tr-duo"><Img src={IMG.arena} /><i /></div>
          <i className="tr-scan tr-scan-low" />
          <div className="tr-title"><small>ONE BATTLEFIELD</small><strong>一個戰場</strong></div>
        </Shot>}
        {shot === "title-4" && <Shot at={T.titles[3]} id="title-4">
          <i className="tr-wire" />
          <Silhouette src={IMG.agentWalk} ratio={592 / 1200} className="tr-face tr-face-a" />
          <Silhouette src={IMG.agentB} ratio={320 / 1200} className="tr-face tr-face-b" />
          <div className="tr-title"><small>ONLY ONE TEAM WINS</small><strong>只有一隊能贏</strong></div>
        </Shot>}
        {shot === "ignite" && <Shot at={T.ignite} id="ignite">
          <div className="tr-brief">
            <p className="tr-brief-title"><Typed text="任務簡報" at={T.typing[0][0] - T.ignite} step={0.12} /><i className="tr-caret" /></p>
            <p className="tr-brief-meta">MISSION BRIEFING<b>/</b>{date} 秋季員工旅遊</p>
          </div>
        </Shot>}
        {shot === "dossier" && <Shot at={T.mission} id="dossier">
          <i className="tr-grid" />
          <div className="tr-orders">
            <p className="tr-orders-typed"><Typed text="你的任務，如果你選擇接受——" at={0} step={0.042} /></p>
            <p className="tr-orders-big"><span>{date} 攻佔</span><span>六度空間</span></p>
          </div>
          <div className="tr-files">
            <figure className="tr-file tr-file-a"><div><Img src={IMG.hostA} /><i className="tr-lock" /></div><figcaption><b>紅</b>紅隊隊長<small>FILE 1029-RED</small></figcaption></figure>
            <figure className="tr-file tr-file-b"><div><Img src={IMG.hostB} /><i className="tr-lock" /></div><figcaption><b>藍</b>藍隊隊長<small>FILE 1029-BLUE</small></figcaption></figure>
            <span className="tr-stamp">定案<small>CONFIRMED</small></span>
          </div>
        </Shot>}
        {shot === "brief-a" && <Shot at={T.briefA} id="brief-a">
          <Cut src={IMG.arena} from={0} to={0.8} className="kb-push"><i className="tr-beams" /><Caption chip="任務地點" big="六度空間" sub="LazerTreks・中山北路二段 185 號 B1" tone="red" /></Cut>
          <Cut src={IMG.gear} from={0.8} to={1.2} className="kb-snap"><Caption chip="任務裝備" big="感應背心" sub="雷射槍上膛・中彈就亮燈" tone="blue" at={0.8} /></Cut>
          <Cut src={IMG.teams} from={1.2} to={2.1} className="kb-push kb-punch"><Caption chip="集合時間" big={date + " 12:00"} sub="週四中午・六度空間 B1 集合" tone="red" at={1.2} /></Cut>
          <i className="tr-flash" />
          <i className="tr-flash tr-flash-at" style={{ animationDelay: "1.6s" }} />
        </Shot>}
        {shot === "brief-b" && <Shot at={T.briefB} id="brief-b">
          <Cut src={IMG.squad} from={0} to={0.8} className="kb-push"><Caption chip="任務模式" big="團隊對戰" sub="堡壘攻防・團隊死鬥・300㎡ 煙霧迷宮" tone="blue" /></Cut>
          <Cut src={IMG.fireA} from={0.8} to={1.2} className="kb-snap"><i className="tr-shot-beam" /><Caption chip="VIP 模式" big="保護老闆" sub="老闆陣亡・全隊落敗" tone="red" at={0.8} /></Cut>
          <Cut src={IMG.target} from={1.2} to={1.6} className="kb-snap"><Caption chip="電腦計分" big="MVP" sub="每一槍都算數・當場揭曉" tone="blue" at={1.2} /></Cut>
          <Cut src={IMG.tea} from={1.6} to={2.1} className="kb-push"><Caption chip="戰後補給" big="下午茶 Buffet" sub="飯店下午茶・吃到飽" tone="amber" at={1.6} /></Cut>
          <i className="tr-flash" />
        </Shot>}
        {shot === "montage" && <Shot at={T.montage} id="montage">
          <Cut src={IMG.vault} from={0} to={0.8} className="kb-descend"><i className="tr-grid-lasers" /></Cut>
          <Cut src={IMG.targetA} from={0.8} to={1.2} className="kb-target"><i className="tr-reticle" /><span className="tr-tag">TARGET<b>紅隊隊長</b></span></Cut>
          <Cut src={IMG.targetB} from={1.2} to={1.6} className="kb-target kb-target-b"><i className="tr-reticle" /><span className="tr-tag">TARGET<b>藍隊隊長</b></span></Cut>
          <Cut src={IMG.keyArt} from={1.6} to={2.1} className="kb-keyart"><p className="tr-who">誰會是 MVP？</p></Cut>
          <i className="tr-flash" />
        </Shot>}
        {shot === "result" && <Shot at={T.result} id="result">
          <div className="tr-intel">
            <i className="tr-grid" />
            <p className="tr-intel-head"><i />FINAL RESULT<b>投票結果</b></p>
            {showTally ? [1, 0].map(i => <div key={i} className={"tr-intel-row row-" + (i ? "b" : "a")} style={{ ["--n" as string]: i ? votesB : votesA, ["--w" as string]: share(i ? votesB : votesA) + "%" }}>
              <span className="tr-intel-name"><b>{i ? "B" : "A"}</b>{plans[i]}</span>
              <span className="tr-intel-num" />
              <i className="tr-intel-bar" />
            </div>) : <p className="tr-intel-winner">{plans[1]}</p>}
            <p className="tr-intel-line">{showTally ? plans[1] + " 勝出・行程定案" : "雷射槍戰＋飯店下午茶・行程定案"}</p>
          </div>
          <div className="tr-verdict"><strong>行程定案</strong></div>
          <Cut src={IMG.vault} from={1.2} to={1.4} className="kb-strobe" />
          <Cut src={IMG.aimB} from={1.4} to={1.6} className="kb-strobe" />
          <Cut src={IMG.fireA} from={1.6} to={1.8} className="kb-strobe" />
          <Cut src={IMG.keyArt} from={1.8} to={2.1} className="kb-strobe" />
          <i className="tr-flash" />
        </Shot>}
        {shot === "riser" && <Shot at={T.riser} id="riser">
          <p className="tr-last tr-last-1">{date}</p>
          <p className="tr-last tr-last-2">全員出動</p>
          <i className="tr-whiteout" />
        </Shot>}
        {shot === "blackout" && <Shot at={T.blackout} id="blackout" />}
        {(shot === "logo" || shot === "destruct") && <Shot at={T.logo} id="logo">
          <Img src={IMG.arena} className="tr-logo-plate" />
          <i className="tr-logo-ray ray-a" /><i className="tr-logo-ray ray-b" />
          <div className="tr-logo-lockup"><ShowLogo className="tr-logo" tag={"MISSION " + date} /></div>
          <p className="tr-logo-code">任務代號 {date}<b>·</b>六度空間雷射對戰</p>
          <p className="tr-logo-line">熱血對戰，<strong>正式開打！</strong></p>
          <p className="tr-billing">馴錢師 × EGROUP 出品　主演 <b>兩位老闆</b>　特別演出 <b>全體同仁</b>　場地 六度空間 LazerTreks　{date}（四）12:00 集合・戰後飯店下午茶</p>
          {shot === "destruct" && <div className="tr-destruct" data-at={T.destruct}>
            <p><i /><Typed text="本訊息將於 3 秒後自動銷毀" at={0} step={0.03} /></p>
            <span className="tr-count">{[3, 2, 1].map(n => <b key={n} className={"n" + n}>{n}</b>)}</span>
          </div>}
        </Shot>}
      </div>
      <i className="tr-grain" />
      <canvas ref={canvasRef} className="tr-canvas" />
      <div ref={hudRef} className="tr-hud" />
    </div>
    {started && <div ref={progressRef} className="film-progress" />}
  </section>;
}
