/**
 * One shared Web Audio context for the site's sound effects (the team draft, the CAM-01 feed). Browsers only start audio
 * after the visitor touches the page, so it is created on the first press anywhere; a cue fired from a press of its own can
 * schedule straight away (it plays the moment the context resumes), while cues the visitor did not trigger wait for it.
 */
let ctx: AudioContext | null = null, out: GainNode | null = null, noise: AudioBuffer | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export function onAudioState(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export const audioRunning = () => ctx?.state === "running";

/** The context, created and resumed if need be (call it from a press to be sure it may start). */
export function unlockAudio(): { c: AudioContext; out: GainNode } | null {
  if (!ctx) {
    try { ctx = new AudioContext({ latencyHint: "interactive" }); } catch { return null; }
    out = ctx.createGain(); out.gain.value = .55; out.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    ctx.addEventListener("statechange", notify);
  }
  if (ctx.state === "suspended") void ctx.resume().then(notify, () => {});
  notify();
  return ctx.state === "closed" ? null : { c: ctx, out: out! };
}
/** The context only when it is already running (for cues the visitor did not trigger). */
export function runningAudio(): { c: AudioContext; out: GainNode } | null { return ctx && out && ctx.state === "running" ? { c: ctx, out } : null; }

if (typeof window !== "undefined") {
  const first = () => { unlockAudio(); window.removeEventListener("pointerdown", first, true); window.removeEventListener("keydown", first, true); };
  window.addEventListener("pointerdown", first, true);
  window.addEventListener("keydown", first, true);
}

/** An oscillator with a pitch glide and a percussive envelope. */
export function tone(c: AudioContext, dest: AudioNode, at: number, type: OscillatorType, from: number, to: number, length: number, volume: number, attack = .004) {
  const osc = c.createOscillator(), gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + length);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + attack);
  gain.gain.exponentialRampToValueAtTime(.0001, at + length);
  osc.connect(gain); gain.connect(dest);
  osc.start(at); osc.stop(at + length + .03);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}
/** Filtered noise with a swept filter and a swell. */
export function hiss(c: AudioContext, dest: AudioNode, at: number, length: number, volume: number, filter: BiquadFilterType, from: number, to: number, q = 1) {
  const src = c.createBufferSource(), band = c.createBiquadFilter(), gain = c.createGain();
  src.buffer = noise; src.loop = true;
  band.type = filter; band.Q.value = q;
  band.frequency.setValueAtTime(from, at);
  band.frequency.exponentialRampToValueAtTime(to, at + length);
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(volume, at + length * .35);
  gain.gain.exponentialRampToValueAtTime(.0001, at + length);
  src.connect(band); band.connect(gain); gain.connect(dest);
  src.start(at, Math.random() * .5); src.stop(at + length + .03);
  src.onended = () => { src.disconnect(); band.disconnect(); gain.disconnect(); };
}
export const noiseBuffer = () => noise;
