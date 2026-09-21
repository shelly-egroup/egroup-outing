import type { DrawBeat } from "./light-draw";

export type DrawSound = { elapsed: () => number; stop: () => void };

/** Create/resume directly from the draw button's click, before waiting on any timers. */
export async function startDrawSound(beats: DrawBeat[], signal: AbortSignal): Promise<DrawSound | null> {
  let context: AudioContext;
  try { context = new AudioContext({ latencyHint: "interactive" }); } catch { return null; }
  let stopped = false;
  let cancelReady: (() => void) | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let tail: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelReady?.();
    clearTimeout(timeout);
    clearTimeout(tail);
    signal.removeEventListener("abort", stop);
    void context.close().catch(() => {});
  };
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) { stop(); return null; }
  try {
    const ready = await Promise.race([
      context.resume().then(() => true),
      new Promise<false>(resolve => { cancelReady = () => resolve(false); timeout = setTimeout(cancelReady, 450); }),
    ]);
    clearTimeout(timeout);
    cancelReady = undefined;
    if (!ready || stopped || context.state !== "running") { stop(); return null; }
    const startAt = context.currentTime + .06;
    const performanceStart = performance.now() + 60;
    function tone(at: number, frequency: number, length: number, volume: number, type: OscillatorType, hold = .012) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(volume, at + .006);
      gain.gain.setValueAtTime(volume, at + .006 + hold);
      gain.gain.exponentialRampToValueAtTime(.0001, at + length);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + length + .02);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
    beats.forEach((beat, index) => {
      const at = startAt + beat.at;
      if (index === beats.length - 1) {
        // The landing chord starts on the same beat as the final highlighted choice.
        // A warmer, sustained major chord makes the result distinct from the light steps.
        [523.25, 659.25, 783.99].forEach((frequency, voice) =>
          tone(at, frequency, .6, [.24, .19, .16][voice], "triangle", .075));
      } else {
        // Rounded plucks in a major pentatonic palette, without sharp square-wave buzz.
        const notes = [440, 523.25, 587.33, 659.25];
        tone(at, notes[index % notes.length], .11, .32, "triangle", .024);
      }
    });
    tail = setTimeout(stop, (beats.at(-1)!.at + .9) * 1000);
    return {
      elapsed() {
        if (!stopped && context.state === "running") {
          // Match the sound reaching the speakers where the browser exposes that clock.
          const stamp = context.getOutputTimestamp?.();
          if (stamp && typeof stamp.contextTime === "number" && typeof stamp.performanceTime === "number" && stamp.contextTime > 0 && stamp.performanceTime > 0)
            return stamp.contextTime + (performance.now() - stamp.performanceTime) / 1000 - startAt;
          return context.currentTime - startAt - context.baseLatency;
        }
        if (!stopped) stop();
        return (performance.now() - performanceStart) / 1000;
      },
      stop,
    };
  } catch { stop(); return null; }
}
