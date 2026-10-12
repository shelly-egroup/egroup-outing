/* The trailer's sound design for 秋遊特務, synthesised offline in the browser (Web Audio). The music is the two supplied
   recordings (007 and the Mission), laid by scripts/trailer/music.mjs; this is only what the picture does, on its own cues
   from scripts/trailer/timeline.json: the dots, the shot, the last card's wire, the match, the fuse that burns under the
   whole mission, the typing and the locks, the shots fired, the roll, the blast into the title, the agent's shot, the burn.
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
  function braam(t, root = "D1", dur = 3.6, open = false) {
    const o = out(0, 0.45, 0.16), ws = shaper(3), lp = filt("lowpass", 160, 1.2);
    lp.frequency.setValueAtTime(160, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 0.07); lp.frequency.exponentialRampToValueAtTime(420, t + 1.6); lp.frequency.exponentialRampToValueAtTime(160, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.02); g.gain.setTargetAtTime(0.55, t + 0.05, 0.4); g.gain.setTargetAtTime(0, t + dur * 0.55, dur * 0.18);
    ws.connect(lp).connect(g).connect(o);
    for (const [s, a] of [[0, 1], [12, 0.8], [19, 0.6], [24, 0.45], [27, 0.25]].slice(0, open ? 4 : 5)) for (const det of [-14, -4, 5, 15]) { const osc = ctx.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = semi(root, s); osc.detune.value = det; const og = ctx.createGain(); og.gain.value = a * 0.35; osc.connect(og).connect(ws); osc.start(t); osc.stop(t + dur + 0.2); }
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

  // ═══ The sound design ═══
  const M = Object.fromEntries(C.montage.map((m) => [m.shot, m.t])), M0 = C.montage[0].t;
  function crackle(t, len, vel = 0.5) { fuse(t, t + len, [[t + 0.01, vel], [t + len - 0.02, 0.0001]]); }
  /** a laser's thin electric hum, swelling a little, then gone */
  function hum(t0, t1, vel = 0.5) {
    const o = out(0, 0.25, 0.022 * vel);
    for (const [f, a] of [[1975, 1], [2960, 0.45], [987, 0.35]]) {
      const osc = ctx.createOscillator(); osc.frequency.value = f; const vib = ctx.createOscillator(); vib.frequency.value = 7; const vd = ctx.createGain(); vd.gain.value = f * 0.004; vib.connect(vd).connect(osc.frequency);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(a, t0 + 0.08); g.gain.setValueAtTime(a, t1 - 0.12); g.gain.linearRampToValueAtTime(0, t1);
      osc.connect(g).connect(o); osc.start(t0); osc.stop(t1 + 0.05); vib.start(t0); vib.stop(t1 + 0.05);
    }
  }

  // ── Act I: the dots tick in, the shot rings out over the band's entrance, the last card's wire hums and burns down ──
  C.dots.forEach((t, i) => tick(t, 0.32 + 0.06 * i, 2050 + i * 110));
  gunshot(C.fire); impact(C.fire, 0.9);
  hum(C.titles[3] + 0.05, C.button + 0.42, 0.9);
  whoosh(C.button + 0.02, 0.5, { f0: 4200, f1: 900, vel: 0.22, p0: 0.25, p1: 0.05, q: 2.2 });

  // ── Act II: the match struck in the dark, the flame taking, the fuse catching as the bass comes in and burning under
  //    everything until the title ──
  matchStrike(C.ignite);
  whoosh(C.flame - 0.04, 0.42, { f0: 180, f1: 900, vel: 0.28, p0: 0.1, p1: 0.1, q: 0.8 });
  revCymbal(C.catch, 1.1, 0.22); whoosh(C.catch - 0.45, 0.45, { f0: 300, f1: 2800, vel: 0.2, p0: -0.3, p1: 0.3, q: 0.9 });   // drawn in, into the bass
  impact(C.catch, 0.7);
  fuse(C.catch, C.suckout, [[C.catch + 0.12, 0.42], [C.mission - 0.2, 0.2], [C.mission + 0.3, 0.1], [M0, 0.09], [C.suckout - 0.35, 0.24]]);
  typing(C.typing[0][0], C.typing[0][1]); typing(C.typing[1][0], C.typing[1][1]);
  shutter(C.cardA); shutter(C.cardB); lock(C.cardA + 0.12); lock(C.cardB + 0.12);
  impact(C.missionLine, 0.6);
  crackle(M0, 0.42, 0.45);   // the burn wipe into the arena
  // the montage: only what is seen — shots fired, the target hit, the locks, the roll, the slide
  zap(M.fireA, 0.9, -0.2); zap(M.fireA2, 0.85, -0.1);
  impact(M.target, 0.9); crackle(M.target, 0.4, 0.4);
  zap(M.aimB2, 0.8, 0.25);
  lock(M.lockA); lock(M.lockB);
  if (C.rollBeats) { whoosh(C.rollBeats[0] - 0.05, 0.3, { f0: 260, f1: 2400, vel: 0.5, p0: -0.6, p1: 0.4 }); taiko(C.rollBeats[1], 0.7, 0.8, 0); whoosh(C.rollBeats[2] - 0.03, 0.16, { f0: 900, f1: 4000, vel: 0.35, p0: 0, p1: 0.5 }); }
  if (C.rollFire) zap(C.rollFire, 0.95, 0.4);
  whoosh(M.stuntB - 0.04, 0.5, { f0: 1200, f1: 300, vel: 0.3, p0: 0.5, p1: -0.3, q: 0.7 });
  if (C.slideFire) zap(C.slideFire, 0.9, -0.3);

  // ── Act III: the breath (the fuse gone, a swell drawn in), the title slammed out of the blast, the agent's shot, the date on
  //    the brass, the classic line typed, a two-beep warning, the self-destruct slammed in on the band's last chord, the burn ──
  revCymbal(C.title, C.title - C.suckout + 0.05, 0.42);
  whoosh(C.suckout + 0.02, C.title - C.suckout - 0.02, { f0: 140, f1: 1600, vel: 0.2, p0: 0, p1: 0, q: 0.7 });
  impact(C.title, 1.6); crash(C.title, 0.5, 2.8); braam(C.title, "G1", 2.8, true);
  zap(C.laser, 0.7, 0.1);
  revCymbal(C.date, 0.3, 0.2); impact(C.date, 1.15); crash(C.date, 0.32, 2.2);
  typing(C.disavow[0], C.disavow[1]);
  tick(C.destructEn, 0.3, 1700); tick(C.destructEn + 0.33, 0.3, 1700);
  impact(C.destruct, 1.25); lock(C.destruct + 0.02); crash(C.destruct, 0.28, 2.4);
  matchStrike(C.burn - 0.1);
  impact(C.burn + 0.02, 1.0);
  whoosh(C.burn + 0.04, 1.3, { f0: 160, f1: 2600, vel: 0.5, p0: -0.2, p1: 0.2, q: 0.7 });
  crackle(C.burn, 1.9, 0.72);
  whoosh(C.burn + 1.25, 1.0, { f0: 2600, f1: 240, vel: 0.3, p0: 0.5, p1: -0.5 });

  return ctx.startRendering();
};
