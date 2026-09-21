export type OpeningAudioState = "idle" | "loading" | "playing" | "blocked" | "error";
type Options = {
  getTime: () => number | null;
  duration: number;
  onState: (state: OpeningAudioState) => void;
  onPlaybackStart?: (position: number) => void;
};

/** Preload on the cover without consuming the visitor's playback gesture. */
export function watchOpeningAudioReady(audio: HTMLMediaElement, onReady: (ready: boolean) => void) {
  const events = ["loadedmetadata", "loadeddata", "canplay", "canplaythrough", "progress", "emptied", "error"];
  const update = () => onReady(!audio.error && audio.readyState >= 3);
  audio.preload = "auto";
  for (const event of events) audio.addEventListener(event, update);
  // Do not restart an existing download when React remounts effects in development.
  if (audio.networkState === 0) audio.load();
  update();
  return () => { for (const event of events) audio.removeEventListener(event, update); };
}

/** Keep media recovery independent of the visual clock and browser permission. */
export function createOpeningAudio(audio: HTMLMediaElement, options: Options) {
  let active = true, requested = false, pending = false, playbackStarted = false;
  let state: OpeningAudioState = "idle";
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners: [string, EventListener][] = [];

  function report(next: OpeningAudioState) {
    if (!active || next === state) return;
    state = next;
    if (next === "playing" && !playbackStarted) {
      playbackStarted = true;
      options.onPlaybackStart?.(audio.currentTime);
    }
    options.onState(next);
  }
  function clearRetry() {
    clearTimeout(retryTimer);
    retryTimer = undefined;
  }
  function finished() {
    const time = options.getTime();
    return time !== null && time >= options.duration;
  }
  function align() {
    const time = options.getTime();
    // Setting currentTime before metadata exists can throw in some browsers.
    if (time === null || audio.readyState < 1 || Math.abs(audio.currentTime - time) < .12) return;
    try { audio.currentTime = Math.min(time, options.duration); } catch { /* Retry after media is ready. */ }
  }
  function retry() {
    if (!active || !requested || finished() || retryTimer) return;
    // Retry for the duration of this intro, never after skip or the ending.
    retryTimer = setTimeout(() => { retryTimer = undefined; play(false); }, audio.error ? 1000 : 500);
  }
  function play(gesture: boolean) {
    if (!active || finished() || (!requested && !gesture)) return;
    if (!gesture && pending) return;
    if (state === "playing" && !audio.paused) return;
    clearRetry();
    if (audio.error) audio.load();
    const token = ++attempt;
    pending = true;
    // A real early click can prime this same media element without playing early.
    audio.muted = false;
    audio.volume = requested ? .55 : 0;
    if (requested) {
      // Keep the optional prompt stable while retries happen in the background.
      if (state !== "blocked" && state !== "error") report("loading");
      align();
    }
    function failed(error: unknown) {
      if (!active || token !== attempt) return;
      pending = false;
      if ((error as { name?: string }).name === "NotAllowedError") {
        report("blocked");
      } else if (audio.error || (error as { name?: string }).name === "NotSupportedError") {
        report("error");
      } else {
        report("loading");
      }
      retry();
    }
    try {
      // Keep play() directly in a trusted click call stack; never await readiness first.
      void audio.play().then(() => {
        if (!active || token !== attempt) return;
        pending = false;
        if (finished()) { audio.pause(); return; }
        if (!requested) {
          audio.pause();
          if (audio.readyState >= 1) { try { audio.currentTime = 0; } catch { /* start() will realign. */ } }
          audio.volume = .55;
          report("idle");
          return;
        }
        audio.volume = .55;
        clearRetry();
        align();
        report("playing");
      }, failed);
    } catch (error) { failed(error); }
  }
  function listen(name: string, handler: () => void) {
    audio.addEventListener(name, handler);
    listeners.push([name, handler]);
  }
  listen("playing", () => {
    if (!active || !requested || finished()) return;
    clearRetry();
    align();
    report("playing");
  });
  listen("canplay", () => {
    if (!active || !requested || finished()) return;
    if (audio.paused && !pending) play(false);
  });
  for (const event of ["waiting", "stalled"]) listen(event, () => {
    if (requested && state !== "blocked" && state !== "error" && !finished()) report("loading");
  });
  listen("pause", () => {
    if (!requested || finished() || audio.ended) return;
    report("loading");
    retry();
  });
  listen("error", () => {
    ++attempt;
    pending = false;
    clearRetry();
    report("error");
    retry();
  });
  return {
    start() {
      if (!active || requested) return;
      requested = true;
      audio.volume = .55;
      // Called directly by START; play() must stay in the trusted click call stack.
      play(false);
    },
    interact() {
      if (state === "playing" && !audio.paused) return;
      play(true);
    },
    resume() {
      if (!active || !requested || !audio.paused) return;
      play(false);
    },
    dispose() {
      active = false;
      ++attempt;
      clearRetry();
      for (const [name, listener] of listeners) audio.removeEventListener(name, listener);
      audio.pause();
    },
  };
}
