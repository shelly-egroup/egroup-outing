import { hiss, noiseBuffer, tone, unlockAudio } from "./sfx-core";

/**
 * The CAM-01 feed's sound (components/recon-targets.tsx): every press fires the laser rifle; a miss rings off the maze, a
 * hit crackles and the captain cries out — a man's yell for the red captain, a woman's for the blue. The cries are
 * synthesised voices (a rough buzz through the formants of 啊, the pitch leaping up and falling away), so no recordings
 * ship. Fired from the visitor's own press, the cues may start the audio themselves.
 */
type Who = "a" | "b";

/** The laser rifle: a falling zap with a sub thump and a click. */
function shot() {
  const a = unlockAudio(); if (!a) return;
  const { c, out } = a, at = c.currentTime + .005;
  const car = c.createOscillator(), mod = c.createOscillator(), depth = c.createGain(), lp = c.createBiquadFilter(), g = c.createGain();
  car.type = "sawtooth"; car.frequency.setValueAtTime(2700, at); car.frequency.exponentialRampToValueAtTime(170, at + .2);
  mod.frequency.value = 92; depth.gain.value = 520; mod.connect(depth); depth.connect(car.frequency);
  lp.type = "lowpass"; lp.frequency.value = 5200;
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.22, at + .003); g.gain.exponentialRampToValueAtTime(.0001, at + .24);
  car.connect(lp); lp.connect(g); g.connect(out);
  car.start(at); mod.start(at); car.stop(at + .27); mod.stop(at + .27);
  car.onended = () => { car.disconnect(); mod.disconnect(); depth.disconnect(); lp.disconnect(); g.disconnect(); };
  tone(c, out, at, "sine", 120, 42, .2, .45, .002);
  hiss(c, out, at, .03, .25, "highpass", 3500, 5000);
}

/** A miss: the beam pings off a bunker. */
function miss() {
  const a = unlockAudio(); if (!a) return;
  const { c, out } = a, at = c.currentTime + .07;
  tone(c, out, at, "sine", 3400, 2450, .3, .07, .002);
  tone(c, out, at, "triangle", 5100, 3900, .18, .03, .002);
  hiss(c, out, at, .05, .07, "bandpass", 4200, 3000, 2);
}

function rasp(amount: number) {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * amount) / Math.tanh(amount); }
  return curve;
}
/**
 * A cry of surprise: a buzzing source whose pitch leaps up, wavers, cracks and falls away, through the formants of an open
 * "ah" — with an aspirated onset, breath, a rough flutter in the loudness, a creaky undertone an octave down (the voice
 * straining) and a little rasp. The man's is lower, rougher and longer; the woman's higher, brighter and quicker.
 */
function cry(who: Who, at: number) {
  const a = unlockAudio(); if (!a) return;
  const { c, out } = a, woman = who === "b";
  const dur = woman ? .66 : .74;
  const pitch = woman ? [440, 960, 820, 360] : [180, 410, 350, 140];
  const formants: [number, number, number][] = woman
    ? [[880, 7, 1], [1250, 9, .55], [2900, 12, .32], [3950, 14, .16]]
    : [[720, 6, 1], [1100, 8, .6], [2450, 11, .3], [3350, 13, .14]];
  const src = c.createOscillator(); src.type = "sawtooth";
  src.frequency.setValueAtTime(pitch[0], at);
  src.frequency.exponentialRampToValueAtTime(pitch[1], at + .07);
  src.frequency.exponentialRampToValueAtTime(pitch[2], at + .24);
  // the voice cracks on the way down
  src.frequency.exponentialRampToValueAtTime(pitch[2] * .93, at + dur * .55);
  src.frequency.setValueAtTime(pitch[2] * .8, at + dur * .55 + .012);
  src.frequency.exponentialRampToValueAtTime(pitch[3], at + dur);
  // straining: a creaky undertone an octave below, following the same contour
  const creak = c.createOscillator(), creakGain = c.createGain();
  creak.type = "square";
  creak.frequency.setValueAtTime(pitch[0] / 2, at);
  creak.frequency.exponentialRampToValueAtTime(pitch[1] / 2, at + .07);
  creak.frequency.exponentialRampToValueAtTime(pitch[2] / 2, at + .24);
  creak.frequency.exponentialRampToValueAtTime(pitch[2] * .4, at + dur * .55 + .012);
  creak.frequency.exponentialRampToValueAtTime(pitch[3] / 2, at + dur);
  creakGain.gain.value = woman ? .12 : .28;
  const vib = c.createOscillator(), vibDepth = c.createGain();
  vib.frequency.value = woman ? 7.2 : 5.8; vibDepth.gain.value = woman ? 22 : 12;
  vib.connect(vibDepth); vibDepth.connect(src.frequency);
  // jitter: the pitch shakes the way a startled voice does
  const jitter = c.createBufferSource(), jitterLp = c.createBiquadFilter(), jitterDepth = c.createGain();
  jitter.buffer = noiseBuffer(); jitter.loop = true; jitterLp.type = "lowpass"; jitterLp.frequency.value = 40; jitterDepth.gain.value = woman ? 60 : 45;
  jitter.connect(jitterLp); jitterLp.connect(jitterDepth); jitterDepth.connect(src.frequency);
  const shaper = c.createWaveShaper(); shaper.curve = rasp(woman ? 2 : 3.6);
  const breath = c.createBufferSource(), breathHp = c.createBiquadFilter(), breathGain = c.createGain();
  breath.buffer = noiseBuffer(); breath.loop = true; breathHp.type = "highpass"; breathHp.frequency.value = 1200; breathGain.gain.value = woman ? .2 : .26;
  breath.connect(breathHp); breathHp.connect(breathGain);
  // an aspirated "h" before the voice catches
  breathGain.gain.setValueAtTime(woman ? .55 : .65, at); breathGain.gain.linearRampToValueAtTime(woman ? .2 : .26, at + .05);
  src.connect(shaper); creak.connect(creakGain); creakGain.connect(shaper);
  const voice = c.createGain(), env = c.createGain();
  for (const [f, q, g] of formants) {
    const bp = c.createBiquadFilter(), fg = c.createGain();
    bp.type = "bandpass"; bp.Q.value = q;
    bp.frequency.setValueAtTime(f * .92, at); bp.frequency.linearRampToValueAtTime(f * 1.06, at + .1); bp.frequency.linearRampToValueAtTime(f * .88, at + dur);
    fg.gain.value = g * 2.4;
    shaper.connect(bp); breathGain.connect(bp); bp.connect(fg); fg.connect(voice);
  }
  env.gain.setValueAtTime(0, at); env.gain.linearRampToValueAtTime(.5, at + .025); env.gain.setValueAtTime(.5, at + dur - .2);
  env.gain.exponentialRampToValueAtTime(.0001, at + dur);
  // roughness: the loudness flutters irregularly, faster than vibrato
  const flutter = c.createGain(), rough = c.createBufferSource(), roughBp = c.createBiquadFilter(), roughDepth = c.createGain();
  flutter.gain.value = 1; rough.buffer = noiseBuffer(); rough.loop = true; roughBp.type = "bandpass"; roughBp.frequency.value = woman ? 55 : 38; roughBp.Q.value = .8;
  roughDepth.gain.value = woman ? 1.6 : 2.4;
  rough.connect(roughBp); roughBp.connect(roughDepth); roughDepth.connect(flutter.gain);
  voice.connect(flutter); flutter.connect(env); env.connect(out);
  for (const node of [src, creak, vib, jitter, breath, rough]) { node.start(at); node.stop(at + dur + .05); }
  src.onended = () => { for (const node of [src, creak, creakGain, vib, vibDepth, jitter, jitterLp, jitterDepth, shaper, breath, breathHp, breathGain, voice, flutter, rough, roughBp, roughDepth, env]) node.disconnect(); };
}

/** A hit: the vest crackles, then the captain cries out. */
function hit(who: Who) {
  const a = unlockAudio(); if (!a) return;
  const { c, out } = a, at = c.currentTime + .005;
  hiss(c, out, at, .22, .3, "bandpass", 2600, 1200, 1.5);
  tone(c, out, at, "square", 980, 320, .16, .07, .002);
  tone(c, out, at, "sine", 160, 50, .22, .4, .002);
  cry(who, at + .06);
}

export const reconSound = { shot, miss, hit };
