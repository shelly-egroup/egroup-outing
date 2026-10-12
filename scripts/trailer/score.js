/* Original trailer score for 秋遊特務, synthesised offline in the browser (Web Audio). No film theme is quoted.
   Act I: spy-jazz cold open (E minor, 120 bpm, swung). Act II: a 5/4 mission ostinato (150 bpm, climbing D→E→F→G) with
   bongos and flute flicks, montage hits, a strobe riser, silence. Act III: the title burns in on a braam and choir, the
   date, the stinger's double shot and the last hit. Every cue comes from scripts/trailer/timeline.json.
   window.composeScore({ sr, cues }) resolves to a stereo AudioBuffer. Deterministic: seeded noise, no Math.random. */
window.composeScore = async function composeScore({ sr = 48000, cues: C }) {
  const DUR = C.duration + 0.15;
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * DUR), sr);
  let seed = 1029;
  const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const NOTE = { C: -9, "C#": -8, Db: -8, D: -7, "D#": -6, Eb: -6, E: -5, F: -4, "F#": -3, Gb: -3, G: -2, "G#": -1, Ab: -1, A: 0, "A#": 1, Bb: 1, B: 2 };
  const hz = (n) => { if (typeof n === "number") return n; const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(n); return 440 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) - 4) * 12) / 12); };
  const semi = (n, s) => hz(n) * Math.pow(2, s / 12);

  // ── Buses ──
  // Master: clear the sub rumble, lean out the low-mids and lift presence so phone speakers carry the score.
  const master = ctx.createGain(); master.gain.value = 0.9;
  const eq = [["highpass", 32, 0.7, 0], ["lowshelf", 140, 0.7, -2.5], ["peaking", 2600, 0.8, 3], ["highshelf", 9000, 0.7, 1.5]].map(([type, f, q, gain]) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; });
  const glue = ctx.createDynamicsCompressor(); glue.threshold.value = -20; glue.knee.value = 10; glue.ratio.value = 2.6; glue.attack.value = 0.008; glue.release.value = 0.22;
  const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -5; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.06;
  // The choke empties everything (tails included) for the blackout before the braam, and fades the very end.
  const choke = ctx.createGain();
  choke.gain.setValueAtTime(1, C.blackout - 0.012); choke.gain.linearRampToValueAtTime(0, C.blackout + 0.004);
  choke.gain.setValueAtTime(0, C.title - 0.2); choke.gain.linearRampToValueAtTime(1, C.title - 0.19);
  choke.gain.setValueAtTime(1, C.duration - 0.35); choke.gain.linearRampToValueAtTime(0, C.duration + 0.12);
  eq.reduce((a, b) => a.connect(b), master).connect(glue).connect(limiter).connect(choke).connect(ctx.destination);
  const duck = ctx.createGain(); duck.connect(master);
  const dry = ctx.createGain(); dry.connect(duck);
  const impacts = ctx.createGain(); impacts.connect(master);
  function impulse(seconds, decay, tone) {
    const len = Math.floor(sr * seconds), b = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len, k = tone + (1 - tone) * (1 - x); // darker as it decays
        lp += k * ((rand() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - x, decay) * (i < sr * 0.012 ? i / (sr * 0.012) : 1);
      }
    }
    return b;
  }
  const hall = ctx.createConvolver(); hall.buffer = impulse(3.2, 3.4, 0.35);
  const hallIn = ctx.createGain(); const hallHp = ctx.createBiquadFilter(); hallHp.type = "highpass"; hallHp.frequency.value = 160;
  hallIn.connect(hallHp).connect(hall); const hallOut = ctx.createGain(); hallOut.gain.value = 0.55; hall.connect(hallOut).connect(duck);
  const plate = ctx.createConvolver(); plate.buffer = impulse(1.3, 2.2, 0.7);
  const plateIn = ctx.createGain(); const plateOut = ctx.createGain(); plateOut.gain.value = 0.5; plateIn.connect(plate).connect(plateOut).connect(master);

  function out(pan = 0, send = 0.2, gain = 1, plateSend = 0) {
    const g = ctx.createGain(); g.gain.value = gain;
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    g.connect(p); p.connect(dry);
    if (send > 0) { const s = ctx.createGain(); s.gain.value = send; p.connect(s); s.connect(hallIn); }
    if (plateSend > 0) { const s = ctx.createGain(); s.gain.value = plateSend; p.connect(s); s.connect(plateIn); }
    return g;
  }
  const noise = (() => { const b = ctx.createBuffer(2, sr * 4, sr); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1; } return b; })();
  function noiseSrc(t, dur) { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(t, rand() * 3, dur + 0.05); return s; }
  function filt(type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  function env(t, a, peak, d, floor = 0.0001) { const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(floor, t + a + d); return g; }
  const shaper = (k) => { const w = ctx.createWaveShaper(), n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } w.curve = c; w.oversample = "2x"; return w; };

  // ── Plucked strings (Karplus–Strong, computed here so tuning and tone are exact) ──
  function ks(f, dur, bright, damp) {
    const len = Math.ceil(sr * dur), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    const N = Math.max(2, Math.round(sr / f - 0.5)), line = new Float32Array(N);
    let lp = 0; for (let i = 0; i < N; i++) { lp += bright * ((rand() * 2 - 1) - lp); line[i] = lp; }
    let idx = 0;
    for (let i = 0; i < len; i++) { const cur = line[idx], nxt = line[(idx + 1) % N]; line[idx] = damp * 0.5 * (cur + nxt); d[i] = cur; idx = (idx + 1) % N; }
    return b;
  }
  function guitar(t, n, dur = 1.4, { vel = 0.8, pan = 0 } = {}) {
    const s = ctx.createBufferSource(); s.buffer = ks(hz(n), dur + 0.4, 0.55, 0.9975);
    const drive = shaper(2.2), twang = filt("peaking", 2400, 1.1); twang.gain.value = 7;
    const body = filt("lowshelf", 220); body.gain.value = -6;
    const trem = ctx.createGain(); trem.gain.value = 0.82; const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2; const depth = ctx.createGain(); depth.gain.value = 0.16; lfo.connect(depth).connect(trem.gain); lfo.start(t); lfo.stop(t + dur + 0.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(vel * 0.5, t); g.gain.setTargetAtTime(0, t + dur, 0.08);
    s.connect(drive).connect(twang).connect(body).connect(trem).connect(g).connect(out(pan, 0.18, 1, 0.55));
    s.start(t); s.stop(t + dur + 0.5);
  }
  function bass(t, n, dur = 0.45, vel = 0.8) {
    const s = ctx.createBufferSource(); s.buffer = ks(hz(n), dur + 0.3, 0.3, 0.993);
    const lp = filt("lowpass", 900); const thump = filt("peaking", 110, 1); thump.gain.value = 5;
    const g = ctx.createGain(); g.gain.setValueAtTime(vel * 1.3, t); g.gain.setTargetAtTime(0, t + dur, 0.05);
    s.connect(lp).connect(thump).connect(g).connect(out(0, 0.05));
    s.start(t); s.stop(t + dur + 0.4);
  }

  // ── Brass and strings: detuned saw ensembles ──
  function brass(t, notes, dur, { vel = 0.7, attack = 0.035, release = 0.3, bright = 1, pan = 0, send = 0.28, gain = 0.07, glideTo = null, glideAt = 0 } = {}) {
    const o = out(pan, send, gain);
    notes.forEach((n, k) => {
      const f = hz(n), lp = filt("lowpass", Math.min(f * 1.5, 700), 0.9);
      const open = Math.min(f * 1.5 + vel * 3800 * bright, 11000);
      lp.frequency.setValueAtTime(Math.min(f * 1.5, 700), t);
      lp.frequency.linearRampToValueAtTime(open, t + attack * 1.6);
      lp.frequency.setTargetAtTime(Math.min(f * 1.5, 700) + vel * 1500 * bright, t + attack * 1.6, 0.22);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + attack); g.gain.setTargetAtTime(vel * 0.62, t + attack, 0.18); g.gain.setTargetAtTime(0, t + dur, release / 3);
      const pp = ctx.createStereoPanner(); pp.pan.value = notes.length > 1 ? (k / (notes.length - 1) - 0.5) * 0.7 : 0;
      lp.connect(g).connect(pp).connect(o);
      for (const det of [-9, -2, 7]) {
        const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.setValueAtTime(f, t); osc.detune.value = det + (rand() - 0.5) * 5;
        if (glideTo) { osc.frequency.setValueAtTime(f, t + glideAt); osc.frequency.exponentialRampToValueAtTime(semi(n, glideTo), t + dur); }
        const vib = ctx.createOscillator(); vib.frequency.value = 4.8 + rand(); const vd = ctx.createGain(); vd.gain.setValueAtTime(0, t); vd.gain.linearRampToValueAtTime(9, t + 0.6); vib.connect(vd).connect(osc.detune); vib.start(t); vib.stop(t + dur + release * 2);
        osc.connect(lp); osc.start(t); osc.stop(t + dur + release * 2);
      }
    });
  }
  function strings(t, notes, dur, { vel = 0.5, attack = 0.25, release = 0.4, tremolo = 0, pan = 0, send = 0.45, gain = 0.045, cutoff = 3200, cresc = 0 } = {}) {
    const o = out(pan, send, gain);
    notes.forEach((n, k) => {
      const f = hz(n), lp = filt("lowpass", cutoff, 0.6), hp = filt("highpass", 90);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + attack);
      if (cresc) g.gain.linearRampToValueAtTime(vel * cresc, t + dur);
      g.gain.setTargetAtTime(0, t + dur, release / 3);
      let tail = g;
      if (tremolo) {
        const tr = ctx.createGain(); tr.gain.value = 0.6; const lfo = ctx.createOscillator(); lfo.type = "triangle"; lfo.frequency.value = tremolo; const dep = ctx.createGain(); dep.gain.value = 0.4; lfo.connect(dep).connect(tr.gain); lfo.start(t); lfo.stop(t + dur + release * 2);
        g.connect(tr); tail = tr;
      }
      const pp = ctx.createStereoPanner(); pp.pan.value = notes.length > 1 ? (k / (notes.length - 1) - 0.5) * 0.9 : 0;
      lp.connect(hp).connect(g); tail.connect(pp).connect(o);
      for (const det of [-12, -5, 0, 6, 13]) {
        const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = f; osc.detune.value = det + (rand() - 0.5) * 6;
        const vib = ctx.createOscillator(); vib.frequency.value = 5.2 + rand() * 0.8; const vd = ctx.createGain(); vd.gain.value = 7; vib.connect(vd).connect(osc.detune); vib.start(t); vib.stop(t + dur + release * 2);
        osc.connect(lp); osc.start(t); osc.stop(t + dur + release * 2);
      }
    });
  }
  // Short bowed note (ostinato / spiccato).
  function stacc(t, n, { vel = 0.6, len = 0.13, pan = 0, gain = 0.06, cutoff = 2200, send = 0.22 } = {}) {
    const f = hz(n), o = out(pan, send, gain), lp = filt("lowpass", cutoff, 0.8);
    lp.frequency.setValueAtTime(cutoff * 1.6, t); lp.frequency.exponentialRampToValueAtTime(cutoff * 0.6, t + len);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.006); g.gain.exponentialRampToValueAtTime(vel * 0.35, t + len * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.08);
    lp.connect(g).connect(o);
    for (const det of [-8, 0, 9]) { const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = f; osc.detune.value = det; osc.connect(lp); osc.start(t); osc.stop(t + len + 0.12); }
    const bow = noiseSrc(t, 0.03), bp = filt("bandpass", Math.min(f * 6, 5000), 1.2), bg = env(t, 0.002, vel * 0.25, 0.025);
    bow.connect(bp).connect(bg).connect(o);
  }
  function synthBass(t, n, len, vel = 0.8) {
    const f = hz(n), o = out(0, 0.03, 0.11), lp = filt("lowpass", 220, 1.4), sat = shaper(2.4);
    lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(180, t + len);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05);
    lp.connect(g).connect(sat).connect(o);
    const a = ctx.createOscillator(); a.type = "sawtooth"; a.frequency.value = f; a.connect(lp); a.start(t); a.stop(t + len + 0.1);
    const s = ctx.createOscillator(); s.type = "sine"; s.frequency.value = f; const sg = ctx.createGain(); sg.gain.value = 0.8; s.connect(sg).connect(g); s.start(t); s.stop(t + len + 0.1);
  }
  function pluck(t, n, vel = 0.7, gain = 0.04) {
    const f = hz(n), o = out(0.35, 0.25, gain, 0.2), lp = filt("lowpass", 3200, 2);
    lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(900, t + 0.12);
    const g = env(t, 0.002, vel, 0.13); lp.connect(g).connect(o);
    for (const det of [-6, 6]) { const osc = ctx.createOscillator(); osc.type = "square"; osc.frequency.value = f; osc.detune.value = det; osc.connect(lp); osc.start(t); osc.stop(t + 0.2); }
  }
  function clap(t, vel = 0.6) {
    const o = out(-0.1, 0.3, 0.3 * vel);
    for (const [dt, a] of [[0, 0.6], [0.011, 0.7], [0.023, 1]]) { const h = noiseSrc(t + dt, 0.2), bp = filt("bandpass", 1300, 0.9), g = env(t + dt, 0.001, a, dt === 0.023 ? 0.14 : 0.01); h.connect(bp).connect(g).connect(o); }
  }
  function vibes(t, n, dur = 2.4, vel = 0.5, pan = 0.2) {
    const f = hz(n), o = out(pan, 0.4, 0.12, 0.3);
    const trem = ctx.createGain(); trem.gain.value = 0.75; const lfo = ctx.createOscillator(); lfo.frequency.value = 5; const dep = ctx.createGain(); dep.gain.value = 0.25; lfo.connect(dep).connect(trem.gain); lfo.start(t); lfo.stop(t + dur);
    trem.connect(o);
    [[1, 1], [4, 0.18], [10.1, 0.04]].forEach(([r, a]) => { const osc = ctx.createOscillator(); osc.frequency.value = f * r; const g = env(t, 0.002, vel * a, dur / (r > 1 ? 4 : 1)); osc.connect(g).connect(trem); osc.start(t); osc.stop(t + dur); });
  }
  function pianoHit(t, n, vel = 1, dur = 3) {
    const f = hz(n), o = out(0, 0.5, 0.3);
    [[1, 1], [2, 0.5], [3, 0.22], [4.02, 0.12], [0.5, 0.6]].forEach(([r, a]) => { const osc = ctx.createOscillator(); osc.type = r === 0.5 ? "sine" : "triangle"; osc.frequency.value = f * r; const g = env(t, 0.003, vel * a, dur / (r > 2 ? 3 : 1)); osc.connect(g).connect(o); osc.start(t); osc.stop(t + dur + 0.1); });
    const h = noiseSrc(t, 0.05), lp = filt("lowpass", 1800), g = env(t, 0.001, vel * 0.4, 0.04); h.connect(lp).connect(g).connect(o);
  }

  // ── Percussion ──
  function timp(t, n, vel = 1, dur = 1.8) {
    const f = hz(n), o = out(0, 0.4, 0.55 * vel);
    [[1, 1], [1.504, 0.5], [1.742, 0.32], [2, 0.22], [2.245, 0.12]].forEach(([r, a], k) => { const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(f * r * 1.03, t); osc.frequency.exponentialRampToValueAtTime(f * r, t + 0.07); const g = env(t, 0.004, a, k ? dur * 0.45 : dur); osc.connect(g).connect(o); osc.start(t); osc.stop(t + dur + 0.1); });
    const h = noiseSrc(t, 0.12), lp = filt("lowpass", 1100), g = env(t, 0.001, 0.5, 0.09); h.connect(lp).connect(g).connect(o);
  }
  function timpRoll(t0, t1, n, v0, v1) { for (let t = t0, i = 0; t < t1; t += 0.045, i++) { const x = (t - t0) / (t1 - t0); timp(t, n, (v0 + (v1 - v0) * x) * (0.85 + rand() * 0.3), 0.6); } }
  function taiko(t, vel = 1, pitch = 1, pan = 0) {
    const o = out(pan, 0.35, 0.55 * vel);
    const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(98 * pitch, t); osc.frequency.exponentialRampToValueAtTime(46 * pitch, t + 0.16);
    const g = env(t, 0.003, 1, 0.75); osc.connect(g).connect(o); osc.start(t); osc.stop(t + 0.9);
    const h = noiseSrc(t, 0.2), lp = filt("lowpass", 380), hg = env(t, 0.002, 0.7, 0.16); h.connect(lp).connect(hg).connect(o);
    const sl = noiseSrc(t, 0.04), bp = filt("bandpass", 1300, 1.5), sg = env(t, 0.001, 0.35, 0.025); sl.connect(bp).connect(sg).connect(o);
  }
  function snare(t, vel = 0.7, pan = 0.1) {
    const o = out(pan, 0.22, 0.42 * vel);
    const h = noiseSrc(t, 0.25), bp = filt("bandpass", 3200, 0.5), hp = filt("highpass", 1200), g = env(t, 0.001, 0.9, 0.17); h.connect(bp).connect(hp).connect(g).connect(o);
    const osc = ctx.createOscillator(); osc.type = "triangle"; osc.frequency.setValueAtTime(230, t); osc.frequency.exponentialRampToValueAtTime(175, t + 0.05); const og = env(t, 0.001, 0.6, 0.07); osc.connect(og).connect(o); osc.start(t); osc.stop(t + 0.15);
  }
  function snareRoll(t0, t1, v0, v1, step = 0.05) { for (let t = t0; t < t1; t += step) { const x = (t - t0) / (t1 - t0); snare(t, (v0 + (v1 - v0) * x * x) * (0.8 + rand() * 0.3), (rand() - 0.5) * 0.3); } }
  function hat(t, vel = 0.4, open = false, pan = 0.25) { const o = out(pan, 0.08, 0.2 * vel); const h = noiseSrc(t, 0.4), hp = filt("highpass", 7600), g = env(t, 0.001, 1, open ? 0.28 : 0.035); h.connect(hp).connect(g).connect(o); }
  function metal(t, dur, vel, pan, base = 2.65) {
    const o = out(pan, 0.25, 0.08 * vel), bp = filt("bandpass", 8000, 0.6), hp = filt("highpass", 4800), g = env(t, 0.001, 1, dur);
    bp.connect(hp).connect(g).connect(o);
    for (const r of [205.3, 304.4, 369.6, 522.7, 540, 800]) { const osc = ctx.createOscillator(); osc.type = "square"; osc.frequency.value = r * base; osc.connect(bp); osc.start(t); osc.stop(t + dur + 0.05); }
  }
  function ride(t, vel = 0.5) { metal(t, 0.9, vel, 0.35); const h = noiseSrc(t, 0.3), hp = filt("highpass", 9000), g = env(t, 0.001, 0.05 * vel, 0.2); h.connect(hp).connect(g).connect(out(0.35, 0.1, 1)); }
  function brush(t, vel = 0.5, len = 0.22) { const o = out(-0.2, 0.15, 0.16 * vel), h = noiseSrc(t, len + 0.1), bp = filt("bandpass", 4200, 0.6), g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + len * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + len); h.connect(bp).connect(g).connect(o); }
  function crash(t, vel = 0.6, dur = 2.6) { metal(t, dur, vel * 1.4, -0.2, 3.1); const o = out(-0.15, 0.3, 0.32 * vel), h = noiseSrc(t, dur), hp = filt("highpass", 3600), g = env(t, 0.002, 1, dur); h.connect(hp).connect(g).connect(o); }
  function revCymbal(tEnd, len, vel = 0.3) { const t = tEnd - len, o = out(0.1, 0.2, vel), h = noiseSrc(t, len), hp = filt("highpass", 2500), lp = filt("lowpass", 3000); lp.frequency.setValueAtTime(2500, t); lp.frequency.exponentialRampToValueAtTime(14000, tEnd); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, tEnd - 0.005); g.gain.linearRampToValueAtTime(0, tEnd); h.connect(hp).connect(lp).connect(g).connect(o); }
  function tick(t, vel = 0.4, f = 1650) { const o = out(0.3, 0.1, 0.25 * vel); const osc = ctx.createOscillator(); osc.frequency.value = f; const g = env(t, 0.001, 1, 0.03); osc.connect(g).connect(o); osc.start(t); osc.stop(t + 0.06); const h = noiseSrc(t, 0.02), bp = filt("bandpass", 3000, 2), hg = env(t, 0.0005, 0.6, 0.012); h.connect(bp).connect(hg).connect(o); }
  function tom(t, f, vel = 0.7, pan = 0) { const o = out(pan, 0.3, 0.6 * vel), osc = ctx.createOscillator(); osc.frequency.setValueAtTime(f * 1.6, t); osc.frequency.exponentialRampToValueAtTime(f, t + 0.06); const g = env(t, 0.002, 1, 0.4); osc.connect(g).connect(o); osc.start(t); osc.stop(t + 0.5); const h = noiseSrc(t, 0.06), lp = filt("lowpass", 2000), hg = env(t, 0.001, 0.4, 0.05); h.connect(lp).connect(hg).connect(o); }

  // ── Sound design ──
  // A cut's impact: transient crack, a sub drop and a short room, with the music ducked for a beat underneath.
  function impact(t, size = 1) {
    duck.gain.setValueAtTime(1, t - 0.004); duck.gain.linearRampToValueAtTime(0.55, t + 0.006); duck.gain.setTargetAtTime(1, t + 0.05, 0.09);
    const room = ctx.createGain(); room.gain.value = 0.35 * size; room.connect(hallIn);
    const o = ctx.createGain(); o.gain.value = size; o.connect(impacts); o.connect(room);
    const c = noiseSrc(t, 0.06), bp = filt("bandpass", 2400, 0.7), cg = env(t, 0.0008, 0.9, 0.035); c.connect(bp).connect(cg).connect(o);
    const b = noiseSrc(t, 0.25), lp = filt("lowpass", 700), bg = env(t, 0.002, 0.8, 0.16); b.connect(lp).connect(bg).connect(o);
    const sub = ctx.createOscillator(); sub.frequency.setValueAtTime(110, t); sub.frequency.exponentialRampToValueAtTime(38, t + 0.35); const sg = env(t, 0.003, 0.9, 0.5); sub.connect(sg).connect(o); sub.start(t); sub.stop(t + 0.7);
  }
  function whoosh(t, len, { f0 = 350, f1 = 4200, vel = 0.5, p0 = -0.8, p1 = 0.8, q = 1.1 } = {}) {
    const o = ctx.createGain(); o.gain.value = vel * 0.55; const p = ctx.createStereoPanner(); p.pan.setValueAtTime(p0, t); p.pan.linearRampToValueAtTime(p1, t + len); o.connect(p).connect(dry); const s = ctx.createGain(); s.gain.value = 0.3; p.connect(s).connect(hallIn);
    const h = noiseSrc(t, len), bp = filt("bandpass", f0, q); bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + len);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    h.connect(bp).connect(g).connect(o);
  }
  function zap(t, vel = 0.6, pan = 0) {
    const o = out(pan, 0.3, 0.16 * vel), car = ctx.createOscillator(); car.type = "sawtooth"; car.frequency.setValueAtTime(2600, t); car.frequency.exponentialRampToValueAtTime(190, t + 0.22);
    const mod = ctx.createOscillator(); mod.frequency.value = 85; const md = ctx.createGain(); md.gain.value = 480; mod.connect(md).connect(car.frequency);
    const lp = filt("lowpass", 5000), g = env(t, 0.002, 1, 0.24); car.connect(lp).connect(g).connect(o); car.start(t); car.stop(t + 0.3); mod.start(t); mod.stop(t + 0.3);
  }
  function gunshot(t) {
    const o = out(0, 0.6, 1);
    const c = noiseSrc(t, 0.02), cg = env(t, 0.0005, 1.4, 0.006); c.connect(cg).connect(o);
    const b = noiseSrc(t, 0.25), bp = filt("bandpass", 900, 0.8), bg = env(t, 0.001, 1.1, 0.14); b.connect(bp).connect(bg).connect(o);
    const boom = ctx.createOscillator(); boom.frequency.setValueAtTime(75, t); boom.frequency.exponentialRampToValueAtTime(32, t + 0.4); const og = env(t, 0.002, 1.6, 0.5); boom.connect(og).connect(o); boom.start(t); boom.stop(t + 0.6);
    const tail = noiseSrc(t, 1.6), lp = filt("lowpass", 1400), tg = env(t + 0.01, 0.02, 0.35, 1.4); tail.connect(lp).connect(tg).connect(o);
    zap(t + 0.004, 1.3);
  }
  function matchStrike(t) {
    const o = out(-0.4, 0.25, 0.7), h = noiseSrc(t, 0.2), bp = filt("bandpass", 2600, 1.6), g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    for (let k = 0; k < 18; k++) { const tt = t + k * 0.008; g.gain.setValueAtTime(0.3 + rand() * 0.9, tt); }
    g.gain.setValueAtTime(0, t + 0.16); h.connect(bp).connect(g).connect(o);
    const f = noiseSrc(t + 0.12, 0.7), lp = filt("lowpass", 220, 0.9); lp.frequency.setValueAtTime(220, t + 0.12); lp.frequency.exponentialRampToValueAtTime(2400, t + 0.32); lp.frequency.exponentialRampToValueAtTime(600, t + 0.8);
    const fg = env(t + 0.12, 0.03, 0.9, 0.6); f.connect(lp).connect(fg).connect(o);
  }
  // Fuse: hiss plus a crackle of tiny pops; pans with the spark across Act II.
  function fuse(t0, t1, levels) {
    const len = t1 - t0, o = ctx.createGain(); o.gain.setValueAtTime(0.0001, t0);
    for (const [tt, v] of levels) o.gain.linearRampToValueAtTime(v, tt);
    const p = ctx.createStereoPanner(); p.pan.setValueAtTime(-0.7, t0); p.pan.linearRampToValueAtTime(0.7, t1); o.connect(p).connect(dry);
    const h = noiseSrc(t0, len), bp = filt("bandpass", 6200, 0.7); h.connect(bp).connect(o);
    const cb = ctx.createBuffer(1, Math.ceil(sr * len), sr), d = cb.getChannelData(0);
    for (let k = 0; k < len * 55; k++) { const at = Math.floor(rand() * (d.length - 200)), a = (0.3 + rand() * 0.7) * (rand() < 0.1 ? 2.2 : 1), n = 40 + Math.floor(rand() * 120); for (let i = 0; i < n; i++) d[at + i] += (rand() * 2 - 1) * a * Math.exp(-i / (n / 4)); }
    const cs = ctx.createBufferSource(); cs.buffer = cb; const hp = filt("highpass", 1800), cg = ctx.createGain(); cg.gain.value = 0.9; cs.connect(hp).connect(cg).connect(o); cs.start(t0);
  }
  function typing(t0, t1) { for (let t = t0; t < t1; t += 0.045 + rand() * 0.03) tick(t, 0.5 + rand() * 0.4, 2100 + rand() * 600); }
  function shutter(t) { for (const dt of [0, 0.045]) { const o = out(0.2, 0.1, 0.35), h = noiseSrc(t + dt, 0.03), bp = filt("bandpass", 2300, 1.4), g = env(t + dt, 0.0008, 1, 0.018); h.connect(bp).connect(g).connect(o); } }
  function lock(t) { for (const [dt, f] of [[0, 1760], [0.09, 2350]]) { const o = out(0, 0.15, 0.07), osc = ctx.createOscillator(); osc.type = "square"; osc.frequency.value = f; const lp = filt("lowpass", 6000), g = env(t + dt, 0.002, 1, 0.06); osc.connect(lp).connect(g).connect(o); osc.start(t + dt); osc.stop(t + dt + 0.1); } }
  function stamp(t) { taiko(t, 0.5, 1.6); const o = out(0, 0.2, 0.5), h = noiseSrc(t, 0.08), lp = filt("lowpass", 900), g = env(t, 0.001, 1, 0.07); h.connect(lp).connect(g).connect(o); }
  function beep(t, f = 1046.5, len = 0.16, vel = 0.5) { const o = out(0, 0.25, 0.11 * vel); for (const [r, a] of [[1, 1], [2, 0.18], [3, 0.06]]) { const osc = ctx.createOscillator(); osc.frequency.value = f * r; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.004); g.gain.setValueAtTime(a, t + len - 0.02); g.gain.linearRampToValueAtTime(0, t + len); osc.connect(g).connect(o); osc.start(t); osc.stop(t + len + 0.02); } }
  function braam(t, root = "D1", dur = 3.6) {
    const o = out(0, 0.45, 0.16), ws = shaper(3), lp = filt("lowpass", 160, 1.2);
    lp.frequency.setValueAtTime(160, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 0.07); lp.frequency.exponentialRampToValueAtTime(420, t + 1.6); lp.frequency.exponentialRampToValueAtTime(160, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.02); g.gain.setTargetAtTime(0.55, t + 0.05, 0.4); g.gain.setTargetAtTime(0, t + dur * 0.55, dur * 0.18);
    ws.connect(lp).connect(g).connect(o);
    for (const [s, a] of [[0, 1], [12, 0.8], [19, 0.6], [24, 0.45], [27, 0.25]]) for (const det of [-14, -4, 5, 15]) { const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = semi(root, s); osc.detune.value = det; const og = ctx.createGain(); og.gain.value = a * 0.35; osc.connect(og).connect(ws); osc.start(t); osc.stop(t + dur + 0.2); }
    const sub = ctx.createOscillator(); sub.frequency.setValueAtTime(hz(root) * 1.6, t); sub.frequency.exponentialRampToValueAtTime(hz(root), t + 0.25); const sg = env(t, 0.004, 0.9, dur * 0.8); sub.connect(sg).connect(out(0, 0, 0.5)); sub.start(t); sub.stop(t + dur);
    for (const [dt, p] of [[0, 1], [0.012, 0.85], [0.026, 1.18]]) taiko(t + dt, 1.1, p, (p - 1) * 2);
    crash(t, 0.9, 3.2);
    const hit = noiseSrc(t, 0.5), hl = filt("lowpass", 3000), hg = env(t, 0.001, 0.9, 0.35); hit.connect(hl).connect(hg).connect(out(0, 0.5, 0.5));
  }
  function riser(t0, t1, root) {
    const len = t1 - t0;
    whoosh(t0, len, { f0: 300, f1: 9000, vel: 0.9, p0: -0.3, p1: 0.3, q: 0.8 });
    const o = out(0, 0.35, 0.05), lp = filt("lowpass", 1200, 0.8); lp.frequency.setValueAtTime(1200, t0); lp.frequency.exponentialRampToValueAtTime(9000, t1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.2, t0); g.gain.exponentialRampToValueAtTime(1, t1 - 0.01); g.gain.linearRampToValueAtTime(0, t1);
    const trem = ctx.createGain(); trem.gain.value = 0.5; const lfo = ctx.createOscillator(); lfo.frequency.setValueAtTime(6, t0); lfo.frequency.exponentialRampToValueAtTime(22, t1); const dep = ctx.createGain(); dep.gain.value = 0.5; lfo.connect(dep).connect(trem.gain); lfo.start(t0); lfo.stop(t1);
    lp.connect(g).connect(trem).connect(o);
    for (const s of [0, 7, 12, 19, 24]) for (const det of [-10, 10]) { const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.setValueAtTime(semi(root, s), t0); osc.frequency.exponentialRampToValueAtTime(semi(root, s + 12), t1); osc.detune.value = det; osc.connect(lp); osc.start(t0); osc.stop(t1); }
    for (let t = t0, k = 0; t < t1 - 0.02; k++) { taiko(t, 0.35 + 0.65 * ((t - t0) / len), 1.3, 0); t += Math.max(0.05, 0.2 * (1 - (t - t0) / len)); }
  }
  function pshh(t) {
    const o = out(0, 0.4, 0.6), h = noiseSrc(t, 1.6), hp = filt("highpass", 3200), lp = filt("lowpass", 9000); hp.frequency.setValueAtTime(3200, t); hp.frequency.exponentialRampToValueAtTime(500, t + 1.2);
    const g = env(t, 0.01, 0.8, 1.3); h.connect(hp).connect(lp).connect(g).connect(o);
    const th = ctx.createOscillator(); th.frequency.setValueAtTime(110, t); th.frequency.exponentialRampToValueAtTime(40, t + 0.3); const tg = env(t, 0.002, 0.9, 0.45); th.connect(tg).connect(out(0, 0.3, 0.6)); th.start(t); th.stop(t + 0.6);
    fuse(t, t + 0.9, [[t + 0.02, 0.4], [t + 0.8, 0.0001]]);
  }

  // hand drums: a pitched skin that drops into place, with a slap on top
  function bongo(t, vel = 0.6, which = "hi") {
    const f = which === "hi" ? 420 : 300, o = out(which === "hi" ? 0.35 : -0.25, 0.18, 0.32 * vel);
    const osc = ctx.createOscillator(); osc.frequency.setValueAtTime(f * 1.45, t); osc.frequency.exponentialRampToValueAtTime(f, t + 0.016);
    const g = env(t, 0.001, 1, 0.12); osc.connect(g).connect(o); osc.start(t); osc.stop(t + 0.2);
    const h = noiseSrc(t, 0.04), bp = filt("bandpass", 2200, 1.2), hg = env(t, 0.0006, 0.5, 0.016); h.connect(bp).connect(hg).connect(o);
  }
  // a breathy staccato flute note
  function flute(t, n, vel = 0.5, len = 0.09) {
    const f = hz(n), o = out(0.2, 0.35, 0.05 * vel, 0.3);
    for (const [r, a] of [[1, 1], [2, 0.18], [3, 0.05]]) { const osc = ctx.createOscillator(); osc.frequency.value = f * r; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.014); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.06); osc.connect(g).connect(o); osc.start(t); osc.stop(t + len + 0.1); }
    const b = noiseSrc(t, len + 0.05), bp = filt("bandpass", f * 1.02, 6), bg = env(t, 0.006, 0.6, len); b.connect(bp).connect(bg).connect(o);
  }
  // an "ah" choir: saw stacks through two vowel formants, slow swell
  function choir(t, notes, dur, { vel = 0.5, attack = 0.5, gain = 0.035 } = {}) {
    const o = out(0, 0.6, gain), f1 = filt("bandpass", 760, 4), f2 = filt("bandpass", 1180, 5), g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + attack); g.gain.setTargetAtTime(0, t + dur, 0.35);
    const mixer = ctx.createGain(); mixer.connect(f1); mixer.connect(f2); f1.connect(g); f2.connect(g); g.connect(o);
    for (const n of notes) for (const det of [-14, -5, 4, 13]) { const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = hz(n); osc.detune.value = det; const vib = ctx.createOscillator(); vib.frequency.value = 4.6 + rand(); const vd = ctx.createGain(); vd.gain.value = 9; vib.connect(vd).connect(osc.detune); vib.start(t); vib.stop(t + dur + 1.5); osc.connect(mixer); osc.start(t); osc.stop(t + dur + 1.5); }
  }

  // ═══ ACT I — cold open ═══
  ["E4", "G4", "B4", "D5", "F#5"].forEach((n, i) => guitar(C.dots[i], n, 1.9 - i * 0.18, { vel: 0.78 + i * 0.05, pan: -0.55 + i * 0.27 }));
  strings(C.irisOpen, ["E3", "B3", "D#4", "G4"], C.barrel - C.irisOpen, { attack: 0.9, tremolo: 11, vel: 0.5, release: 0.25, gain: 0.05 });
  timpRoll(C.irisOpen + 0.25, C.barrel - 0.02, "E2", 0.08, 0.55);
  revCymbal(C.barrel, 0.95, 0.22);
  // the barrel finds him: walking bass, swung ride, brushes, a twangy riff
  timp(C.barrel, "E2", 0.7); pianoHit(C.barrel, "E1", 0.55, 2.2);
  bass(C.barrel, "E2", 0.46); bass(C.barrel + 0.5, "G2", 0.3); bass(C.barrel + 0.833, "A2", 0.16);
  ride(C.barrel, 0.55); ride(C.barrel + 0.5, 0.4); ride(C.barrel + 0.833, 0.3); brush(C.barrel + 0.5, 0.6);
  guitar(C.barrel, "E3", 0.32, { vel: 0.7, pan: -0.3 }); guitar(C.barrel + 0.333, "G3", 0.16, { vel: 0.55, pan: -0.3 }); guitar(C.barrel + 0.5, "B3", 0.32, { vel: 0.7, pan: -0.3 }); guitar(C.barrel + 0.833, "C4", 0.4, { vel: 0.75, pan: -0.3 });
  // he turns
  whoosh(C.turn - 0.32, 0.34, { f0: 600, f1: 5200, vel: 0.55, p0: 0.6, p1: -0.4 });
  brass(C.turn, ["E3", "G3", "B3", "D#4", "F#4"], 0.2, { vel: 0.95, attack: 0.014, release: 0.2, gain: 0.08 });
  snare(C.turn, 0.6); ride(C.turn, 0.45);
  for (let k = 0; k < 4; k++) bass(C.turn + 0.25 * k, "B1", 0.2, 0.7 + 0.08 * k);
  strings(C.turn, ["B2", "F3", "A3", "C4"], C.fire - C.turn - 0.06, { attack: 0.5, tremolo: 15, vel: 0.35, cresc: 1.9, release: 0.02, gain: 0.05 });
  snareRoll(C.turn + 0.3, C.fire - 0.07, 0.08, 0.55, 0.045);
  timpRoll(C.turn + 0.4, C.fire - 0.07, "B1", 0.08, 0.6);
  revCymbal(C.fire - 0.06, 0.8, 0.3);
  // FIRE — the shot, the orchestra, then the fall
  gunshot(C.fire);
  brass(C.fire, ["E2", "B2", "E3", "G3", "B3", "D#4", "F#4"], 1.3, { vel: 1, attack: 0.012, release: 1.1, bright: 1.15, gain: 0.075 });
  strings(C.fire, ["E1", "E2", "B2"], 1.8, { attack: 0.02, vel: 0.6, release: 0.8, gain: 0.06, cutoff: 1400 });
  timp(C.fire, "E2", 1.1, 2.4); crash(C.fire, 0.7, 2.8); pianoHit(C.fire, "E1", 0.9, 3);
  brass(C.fire + 0.32, ["B3", "G3"], 1.05, { vel: 0.62, attack: 0.05, release: 0.35, glideTo: -7, glideAt: 0.18, gain: 0.06, pan: 0.15 });
  whoosh(C.drop, 0.55, { f0: 2200, f1: 260, vel: 0.5, p0: 0.2, p1: -0.2 });
  whoosh(C.irisClose - 0.05, 0.42, { f0: 4800, f1: 500, vel: 0.6, p0: -0.5, p1: 0.5 });
  revCymbal(C.titles[0], 0.4, 0.2);
  // title sequence: the theme
  const chords = [["E2", "B2", "G3", "D#4"], ["C2", "G2", "E3", "B3", "F#4"], ["A1", "E2", "C3", "G3", "B3"], ["B1", "F#2", "D#3", "A3", "C4"]];
  const bassLine = [["E2", "B1"], ["C2", "G2"], ["A1", "E2"], ["B1", "A#1"]];
  const tune = [[0, "B4", 0.72], [0.75, "A4", 0.25], [1, "G4", 0.48], [1.5, "F#4", 0.48], [2, "E4", 0.72], [2.75, "G4", 0.25], [3, "F#4", 0.48], [3.5, "D#4", 0.45]];
  C.titles.forEach((t, i) => {
    strings(t, chords[i], 0.98, { attack: 0.06, vel: 0.5, release: 0.25, gain: 0.04 });
    timp(t, chords[i][0].replace(/\d/, "2"), 0.8, 1.4); pianoHit(t, chords[i][0].replace(/\d/, "1"), 0.6, 1.8);
    whoosh(t - 0.18, 0.2, { f0: 900, f1: 6000, vel: 0.35, p0: i % 2 ? 0.7 : -0.7, p1: i % 2 ? -0.7 : 0.7 });
    bass(t, bassLine[i][0], 0.46, 0.85); bass(t + 0.5, bassLine[i][1], 0.46, 0.7);
    ride(t, 0.45); ride(t + 0.5, 0.35); ride(t + 0.833, 0.28); brush(t + 0.5, 0.5); hat(t + 0.5, 0.3);
  });
  tune.forEach(([dt, n, len]) => { brass(C.titles[0] + dt, [n], len, { vel: 0.55, attack: 0.05, release: 0.18, gain: 0.07, bright: 0.7, pan: -0.15 }); vibes(C.titles[0] + dt, n.replace(/\d/, (d) => String(Number(d) + 1)), 1.2, 0.35, 0.3); });
  revCymbal(C.ignite, 0.55, 0.3);
  whoosh(C.ignite - 0.5, 0.5, { f0: 250, f1: 7000, vel: 0.5, p0: 0.5, p1: -0.6 });

  // ═══ ACT II — the mission (5/4, eighths of 0.2s, bars of 2s) ═══
  const E8 = 0.2, BAR = 2, roots = ["D2", "D2", "D2", "E2", "F2", "G2"];
  const pat = [0, 0, 3, 0, 0, 5, 0, 6, 5, 3], accents = new Set([0, 2, 5, 7]);
  const M0 = C.montage[0].t, S0 = C.strobe[0];
  matchStrike(C.ignite);
  whoosh(C.typing[0][0] - 0.06, 0.16, { f0: 1800, f1: 7500, vel: 0.5, p0: -0.5, p1: 0.2 }); impact(C.typing[0][0], 0.45);
  fuse(C.ignite, C.blackout, [[C.ignite + 0.15, 0.22], [C.mission, 0.12], [M0, 0.06], [S0, 0.06], [C.blackout - 0.05, 0.4]]);
  roots.forEach((root, b) => {
    const t0 = C.ignite + b * BAR;
    pat.forEach((s, i) => {
      const t = t0 + i * E8, acc = accents.has(i), n = semi(root, s);
      if (t >= C.blackout - 0.02) return;
      stacc(t, n, { vel: acc ? 0.95 : 0.55, gain: 0.045 + b * 0.004, pan: -0.25, cutoff: 2600 });
      stacc(t, n * 2, { vel: acc ? 0.85 : 0.5, gain: b ? 0.08 + b * 0.01 : 0.05, pan: 0.25, cutoff: 3800 });
      if (b >= 1) pluck(t, n * 4, acc ? 0.9 : 0.55, b >= 3 ? 0.05 : 0.035);
      if (b >= 1) synthBass(t, n / 2, acc ? 0.18 : 0.12, acc ? 0.95 : 0.6);
      if (b === 0) tick(t, acc ? 0.6 : 0.35, acc ? 1500 : 1900);
      if (b >= 1 && acc) taiko(t, 0.55 + b * 0.08 + (i === 0 ? 0.2 : 0), i === 0 ? 1 : 1.12, (i % 3 - 1) * 0.3);
      if (b === 0 && i === 0) taiko(t, 0.5);
      // the mission's own colour: bongos chatter in sixteenths, flutes flick the off-beats
      if (b >= 1) { bongo(t, acc ? 0.85 : 0.5, i % 2 ? "hi" : "lo"); bongo(t + 0.1, 0.32 + 0.06 * b, (i + 1) % 3 ? "hi" : "lo"); }
      if (b >= 2 && !acc && i % 2) flute(t + 0.1, semi(root, s + 36), 0.5);
      if (b >= 2) { hat(t, acc ? 0.5 : 0.3); hat(t + 0.1, 0.22); if (i === 5) snare(t, 0.55 + b * 0.04); }
      if (b >= 2) stacc(t + 0.1, semi(root, s + 24 + (i % 2 ? 7 : 0)), { vel: 0.45, gain: b >= 4 ? 0.055 : 0.04, len: 0.08, pan: 0.45, cutoff: 5200, send: 0.3 });
      if (b >= 2 && acc) clap(t, 0.5 + b * 0.08);
    });
    if (b >= 2 && b < 5) { tom(t0 + 8 * E8, 160, 0.6, 0.3); tom(t0 + 8.5 * E8, 130, 0.65, 0); tom(t0 + 9 * E8, 105, 0.7, -0.3); tom(t0 + 9.5 * E8, 90, 0.75, -0.4); }
    strings(t0, [semi(root, 12), semi(root, 19), semi(root, 24)], Math.min(BAR, C.blackout - t0) - 0.05, { attack: 0.4, vel: 0.35 + b * 0.05, gain: b ? 0.05 : 0.035, release: 0.1, cutoff: 2800 + b * 300 });
    if (b >= 2) brass(t0, [semi(root, 12), semi(root, 19), semi(root, 24)], 0.75, { vel: 0.9, attack: 0.02, release: 0.25, gain: 0.085 });
    if (b >= 1) whoosh(t0 - 0.3, 0.32, { f0: 500, f1: 6500, vel: 0.4, p0: b % 2 ? 0.7 : -0.7, p1: b % 2 ? -0.7 : 0.7 });
  });
  typing(...C.typing[0]); typing(...C.typing[1]);
  shutter(C.cardA); shutter(C.cardB); lock(C.cardA + 0.12); lock(C.cardB + 0.12);
  impact(C.mission, 0.8);
  brass(C.missionLine, ["D3", "A3", "D4", "F4"], 0.3, { vel: 0.95, attack: 0.012, release: 0.2, gain: 0.08 }); pianoHit(C.missionLine, "D1", 0.7, 1.6); impact(C.missionLine, 1);
  const rootAt = (t) => roots[Math.min(roots.length - 1, Math.max(0, Math.floor((t - C.ignite) / BAR)))];
  // a burst of crackle for the fuse's burn wipe and the target hit
  function crackle(t, len, vel = 0.5) { fuse(t, t + len, [[t + 0.01, vel], [t + len - 0.02, 0.0001]]); }
  crackle(M0, 0.42, 0.5);
  for (const { t, fx } of C.montage) {
    const r = rootAt(t);
    if (fx === "hit") { crash(t, 0.4, 1.6); pianoHit(t, r.replace(/\d/, "1"), 0.6, 1.6); impact(t, 1); brass(t, [semi(r, 12), semi(r, 19), semi(r, 24), semi(r, 27)], 0.4, { vel: 1, attack: 0.012, release: 0.3, gain: 0.075 }); }
    if (fx === "stab") { brass(t, [semi(r, 12), semi(r, 15), semi(r, 19), semi(r, 24)], 0.18, { vel: 0.95, attack: 0.012, release: 0.15, gain: 0.095 }); taiko(t, 0.6, 1.05); clap(t, 0.8); impact(t, 0.7); }
    if (fx === "zap") { zap(t, 1, (t * 7 % 2) - 1); snare(t, 0.45); impact(t, 0.55); }
    if (fx === "impact") { impact(t, 1.3); taiko(t, 0.9, 0.9); crackle(t, 0.5, 0.55); zap(t, 0.6, 0.3); }
    if (fx === "lock") { lock(t); taiko(t, 0.45, 1.2); impact(t, 0.55); }
  }
  C.titles.forEach((t) => impact(t, 0.6));
  impact(C.fire, 1.2); impact(C.turn, 0.5);
  // strobe: each flash cut is a drum, the riser climbs to the cut-off
  C.strobe.forEach((t, i) => { taiko(t, 0.55 + i * 0.06, 1 + i * 0.03, (i % 2 ? 0.3 : -0.3)); impact(t, 0.35 + i * 0.05); });
  snareRoll(S0, C.blackout - 0.02, 0.2, 0.95, 0.05);
  riser(S0, C.blackout, "A2");
  revCymbal(C.blackout, 0.6, 0.25);

  // ═══ ACT III — the title burns in, the date, the stinger ═══
  revCymbal(C.title, 0.19, 0.45); whoosh(C.title - 0.17, 0.17, { f0: 200, f1: 3000, vel: 0.55, p0: 0, p1: 0 });
  braam(C.title, "D1", 3.6);
  brass(C.title, ["D2", "A2", "D3", "F3", "A3", "D4"], 1.6, { vel: 1, attack: 0.015, release: 1.2, bright: 1.1, gain: 0.06 });
  strings(C.title, ["D2", "A2", "F3"], 3.2, { attack: 0.05, vel: 0.5, release: 1.2, gain: 0.05, cutoff: 2200 });
  choir(C.title + 0.05, ["D3", "A3", "F4", "A4"], C.date - C.title + 0.8, { vel: 0.6, attack: 0.6 });
  // the 007 dots tick into the title, then the agent fires and the laser sight lands on 特
  for (let i = 0; i < 4; i++) tick(C.title + 0.38 + i * 0.1, 0.9, 2300 + i * 180);
  zap(C.title + 1.2, 0.75, 0.1);
  vibes(C.title + 0.9, "D6", 2.4, 0.35, 0.3); vibes(C.title + 0.95, "A6", 2.2, 0.25, -0.3);
  pianoHit(C.date, "D4", 0.5, 2.4); pianoHit(C.date, "A3", 0.35, 2.4); pianoHit(C.date, "D1", 0.6, 2.4); vibes(C.date + 0.05, "F5", 2.2, 0.35, -0.2);
  strings(C.date, ["D3", "A3", "D4", "E4"], C.stinger - C.date + 0.2, { attack: 0.6, vel: 0.35, release: 0.3, gain: 0.04, cutoff: 3200 });
  // the stinger: drums gather, both captains fire, the last hit, then the room rings out
  for (let t = C.stinger, k = 0; t < C.stingerFire - 0.02; k++) { const x = (t - C.stinger) / (C.stingerFire - C.stinger); taiko(t, 0.45 + 0.5 * x, 1.05, k % 2 ? 0.25 : -0.25); bongo(t + 0.05, 0.4 + 0.4 * x, k % 2 ? "hi" : "lo"); t += 0.2 - 0.1 * x; }
  strings(C.stinger, ["D3", "A3", "D4"], C.stingerFire - C.stinger, { attack: 0.3, vel: 0.3, tremolo: 14, cresc: 2.2, release: 0.02, gain: 0.05 });
  revCymbal(C.stingerFire, 0.5, 0.3);
  zap(C.stingerFire, 1.3, -0.4); zap(C.stingerFire + 0.03, 1.3, 0.4); impact(C.stingerFire, 1.3); brass(C.stingerFire, ["D3", "A3", "D4", "F4"], 0.25, { vel: 1, attack: 0.01, release: 0.2, gain: 0.08 });
  revCymbal(C.cut, 0.3, 0.35);
  braam(C.cut, "D1", 2.4); crash(C.cut, 0.9, 3); timp(C.cut, "D2", 1.2, 2.6); impact(C.cut, 1.6);
  pianoHit(C.end, "D1", 0.55, 2.2); choir(C.end, ["D3", "A3", "D4"], C.duration - C.end - 0.6, { vel: 0.4, attack: 0.4, gain: 0.03 });
  // self-destruct: the line types itself, a match strikes, the frame catches with a deep fwoomp, the fire runs through it
  // crackling and roaring, and what is left drifts off as smoke
  typing(C.disavow[0], C.disavow[1]);   // as always, the organisers will disavow any knowledge
  typing(C.destruct, C.destruct + 0.6);
  matchStrike(C.burn - 0.1);
  revCymbal(C.burn, 0.32, 0.22);
  impact(C.burn + 0.02, 1.1); timp(C.burn + 0.02, "D1", 0.85, 2.4);
  whoosh(C.burn + 0.04, 1.3, { f0: 160, f1: 2600, vel: 0.55, p0: -0.2, p1: 0.2, q: 0.7 });
  crackle(C.burn, 1.9, 0.78);
  whoosh(C.burn + 1.25, 1.0, { f0: 2600, f1: 240, vel: 0.34, p0: 0.5, p1: -0.5 });
  impact(C.burn + 1.7, 0.45);

  return ctx.startRendering();
};
