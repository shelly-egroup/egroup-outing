import { useEffect, useState } from "react";
import { audioRunning, hiss, onAudioState, runningAudio, tone, unlockAudio } from "./sfx-core";

/**
 * The team draft's sound, in the trailer's two languages: the selector light hops on hand drums, high and low like the
 * Mission's percussion; when it stops, a target lock and then the closing 007 chord from the trailer's score (a short
 * clip, /assets/draft/lock.m4a; a synthesised chord stands in until it has loaded). A whoosh as a card flies across, a
 * stamp when it lands, a falling blip when it goes back to the pool. Everyone watching hears the draw, so cues wait for
 * the shared audio context to be running (lib/sfx-core.ts) and are skipped until then. Off/on is remembered per browser.
 */
type Team = "red" | "blue";
const PREF = "draft-sound";
const LOCK_CLIP = "/assets/draft/lock.m4a";
let lockClip: AudioBuffer | null = null, loading = false;

function readPref() { try { return localStorage.getItem(PREF) !== "off"; } catch { return true; } }
let enabled = typeof window === "undefined" ? true : readPref();

/** The running context when the draft's sound is on (the closing-chord clip is fetched the first time), else null. */
function live() {
  const a = enabled ? runningAudio() : null;
  if (a && !lockClip && !loading) {
    loading = true;
    void fetch(LOCK_CLIP).then(r => r.arrayBuffer()).then(data => a.c.decodeAudioData(data)).then(buffer => { lockClip = buffer; }, () => { loading = false; });
  }
  return a;
}

export const draftSound = {
  /** One hop of the selector light, on a hand drum: high and low in turn, the last hops a touch heavier as it slows. */
  hop(step: number, steps: number) {
    const a = live(); if (!a) return;
    const { c, out } = a, at = c.currentTime, k = step / Math.max(1, steps - 1), f = step % 2 === 0 ? 420 : 300;
    tone(c, out, at, "sine", f * 1.45, f, .14, .34 + k * .14, .001);
    hiss(c, out, at, .03, .16 + k * .06, "bandpass", 2200, 2000, 1.2);
  },
  /** The light stops on the one drawn: a target lock, then the closing 007 chord (or a chord in the team's colour). */
  lock(team?: Team) {
    const a = live(); if (!a) return;
    const { c, out } = a, at = c.currentTime;
    tone(c, out, at, "square", 1760, 1760, .06, .06); tone(c, out, at + .09, "square", 2350, 2350, .07, .06);
    if (lockClip) {
      const src = c.createBufferSource(), gain = c.createGain();
      src.buffer = lockClip; gain.gain.value = 1.3;
      src.connect(gain); gain.connect(out); src.start(at + .17);
      src.onended = () => { src.disconnect(); gain.disconnect(); };
      tone(c, out, at + .17, "sine", 140, 48, .5, .3, .002);
      return;
    }
    tone(c, out, at + .17, "sine", 140, 48, .5, .55, .002);
    hiss(c, out, at + .17, .35, .18, "lowpass", 1800, 200);
    const chord = team === "red" ? [110, 164.81, 220, 261.63] : [146.83, 220, 293.66, 369.99];
    chord.forEach((f, i) => { tone(c, out, at + .17, "sawtooth", f, f, 1.1, .05 - i * .006, .01); tone(c, out, at + .17, "triangle", f * 2, f * 2, .9, .035, .01); });
  },
  /** A card flying across to its team (quieter when many fly at once). */
  whoosh(volume = 1) {
    const a = live(); if (!a) return;
    hiss(a.c, a.out, a.c.currentTime, .55, .22 * volume, "bandpass", 380, 2600, 1.4);
  },
  /** A card landing on its team: the ASSIGNED stamp. */
  stamp(volume = 1) {
    const a = live(); if (!a) return;
    const { c, out } = a, at = c.currentTime;
    tone(c, out, at, "sine", 170, 55, .2, .5 * volume, .002);
    hiss(c, out, at, .09, .3 * volume, "lowpass", 2400, 400);
    tone(c, out, at + .01, "triangle", 2350, 2300, .16, .05 * volume);
  },
  /** A card going back to the pool. */
  release() {
    const a = live(); if (!a) return;
    tone(a.c, a.out, a.c.currentTime, "triangle", 880, 330, .28, .12);
  },
};

/** The board's sound switch: "on", "off", or "locked" (on, but the browser still waits for the first press). */
export function useDraftSound() {
  const [, refresh] = useState(0);
  useEffect(() => { enabled = readPref(); refresh(n => n + 1); return onAudioState(() => refresh(n => n + 1)); }, []);
  const state: "on" | "off" | "locked" = !enabled ? "off" : audioRunning() ? "on" : "locked";
  function toggle() {
    if (state === "locked") { unlockAudio(); return; }
    enabled = state === "off";
    try { localStorage.setItem(PREF, enabled ? "on" : "off"); } catch { /* the choice just is not remembered */ }
    if (enabled) unlockAudio();
    refresh(n => n + 1);
  }
  return { state, toggle };
}
