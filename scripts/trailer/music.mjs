// The trailer's score: the two supplied recordings (007 and the Mission) laid under the picture, with the sound design stem
// (render-score.mjs) mixed in, mastered to the WAV that render-film.mjs muxes.
//   CHROME_PATH=... node scripts/trailer/render-score.mjs                                   (→ .trailer-build/sfx.wav)
//   FFMPEG_PATH=... node scripts/trailer/music.mjs --007 path/to/007.m4a --mission path/to/Mission.m4a   (→ .trailer-build/score.wav)
// (FFMPEG_PATH needs ffmpeg with rubberband and afir — the ffmpeg-static build has them.) The recordings are not in the
// repo; keep them next to it.
//
// The picture is cut to the music, not the music stretched to the picture: every event in scripts/trailer/timeline.json
// sits on a beat measured in these takes, so the recordings play at their own tempo, untouched. timeline.json "music":
//   bond     007 2.6–13.3 s → 0 s: the dark intro under the dots and the barrel; the band comes in on the shot (7.64 s → 5.04 s);
//            the cards change with its chords (every 0.83 s); its accent at 13.04 s is the last card's button (→ 10.44 s), where
//            the wire catches: from there the band fades away over a second and a half and its accent rings in a hall…
//   mission  …while the Mission comes up underneath, one take with no stops from 8.6 s (→ 10.44 s): its bongos rise from
//            almost nothing to full as the wire burns in, and its bass (12.07 s → 13.91 s) is the flash and the fuse catching;
//            the briefing runs on its beats, the montage starts on the drum fill (17.28 s → 19.12 s), the action on the full band
//            (21.05 s → 22.89 s), the stunts on its strongest accent (26.16 s → 28.01 s), the title on the accent at 28.73 s
//            (→ 30.57 s, the fuse reaching its end) and the date on 30.02 s (→ 31.86 s); the classic line holds as its melody
//            returns (34.92 s → 36.76 s), the self-destruct counts down one per two beats while that phrase is sung out, and the
//            end is its own 燈燈 — the next section's first two hits: 燈 (42.90 s → 44.74 s) the count hits zero and ignites,
//            燈 (43.22 s → 45.06 s) the frame catches fire — where it stops (before the third) and rings in the room.
// No black and no silence anywhere: the songs cross under a build, and the end is the loudest place.
// 007 is in F♯ minor and moves up a semitone (pitch only, the tempo stays) to G minor — the Mission's key — so the two meet
// without a clash.
//
// The takes are quiet mono phone captures (AAC, peaks near −20 dBFS, a steady low-mid noise floor near −52 dBFS), so each is
// restored before anything else: the few clicks in 007's intro are lifted out (only their top end, under 2 ms), then a
// spectral Wiener denoiser (decision-directed, with a gain floor so nothing pumps or twinkles) takes the floor down by
// ~18 dB using the noise print of the Mission take's silent first seconds; then rumble out, the room's 200 Hz box down, a
// little presence and air back. The stems are balanced by loudness, given a stereo hall to sit in, glued, and mastered like
// a trailer: gain into a look-ahead limiter until the whole sits at −11 LUFS.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FF = process.env.FFMPEG_PATH || "ffmpeg";
const arg = (name) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : null; };
const SRC = { bond: arg("007"), mission: arg("mission") };
if (!SRC.bond || !SRC.mission) { console.error("usage: node scripts/trailer/music.mjs --007 <file> --mission <file>"); process.exit(1); }
const T = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/trailer/timeline.json"), "utf8")), MU = T.music;
const BUILD = path.join(ROOT, ".trailer-build"), W = path.join(BUILD, "music");
fs.mkdirSync(W, { recursive: true });
const SR = 48000, SEMI = (n) => Math.pow(2, n / 12);
const NOISE_PRINT = { take: "mission", from: 0.5, to: 2.8 };   // room tone only, before the Mission's first note
const f = (name) => path.join(W, name);

function run(args) {
  const r = spawnSync(FF, ["-hide_banner", "-y", ...args], { encoding: "utf8", maxBuffer: 1 << 26 });
  if (r.status !== 0) { console.error(r.stderr.slice(-3000)); process.exit(1); }
  return r.stderr;
}
function decode(file) {
  const r = spawnSync(FF, ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) { console.error(String(r.stderr)); process.exit(1); }
  return new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length));
}
function writeWav(file, channels) {
  const n = channels[0].length, ch = channels.length, data = Buffer.alloc(n * ch * 4);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) data.writeFloatLE(channels[c][i], (i * ch + c) * 4);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4 * ch, 28); h.writeUInt16LE(4 * ch, 32); h.writeUInt16LE(32, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}
function loudness(file, filter = "") {
  const text = run(["-i", file, "-af", (filter ? filter + "," : "") + "loudnorm=print_format=json", "-f", "null", "-"]);
  const json = JSON.parse(text.slice(text.lastIndexOf("{"), text.lastIndexOf("}") + 1));
  return { i: Number(json.input_i), tp: Number(json.input_tp) };
}

// ── restoration ──
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < h; j++) { const a = i + j, b = a + h, vr = re[b] * cr - im[b] * ci, vi = re[b] * ci + im[b] * cr; re[b] = re[a] - vr; im[b] = im[a] - vi; re[a] += vr; im[a] += vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; }
    }
  }
}
const N = 2048, HOP = 512, K = N / 2 + 1;
const WIN = new Float64Array(N).map((_, i) => Math.sqrt(0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)));   // sqrt-Hann in and out: 75 % overlap sums to 2
function stft(x, each) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let s = -N + HOP; s < x.length; s += HOP) {
    for (let i = 0; i < N; i++) { const k = s + i; re[i] = (k >= 0 && k < x.length ? x[k] : 0) * WIN[i]; im[i] = 0; }
    fft(re, im); each(s, re, im);
  }
}
function noisePrint(x) {
  const lambda = new Float64Array(K); let frames = 0;
  stft(x, (s, re, im) => { if (s < 0 || s + N > x.length) return; for (let k = 0; k < K; k++) lambda[k] += re[k] * re[k] + im[k] * im[k]; frames++; });
  return lambda.map((v) => v / frames);
}
/** Wiener gain per bin from a decision-directed a-priori SNR; over-subtract the print a little, never below the floor */
function denoise(x, lambda, { over = 1.4, floorDb = -18, alpha = 0.98 } = {}) {
  const y = new Float64Array(x.length), floor = Math.pow(10, floorDb / 20), lam = lambda.map((v) => v * over + 1e-20);
  const last = new Float64Array(K), G = new Float64Array(K), re2 = new Float64Array(N), im2 = new Float64Array(N);
  stft(x, (s, re, im) => {
    for (let k = 0; k < K; k++) {
      const P = re[k] * re[k] + im[k] * im[k], xi = Math.max(alpha * last[k] / lam[k] + (1 - alpha) * Math.max(P / lam[k] - 1, 0), 1e-3);
      G[k] = Math.max(xi / (1 + xi), floor);
    }
    for (let k = 0; k < K; k++) {
      const g = Math.max((G[Math.max(0, k - 1)] + 2 * G[k] + G[Math.min(K - 1, k + 1)]) / 4, floor);
      last[k] = g * g * (re[k] * re[k] + im[k] * im[k]); re2[k] = re[k] * g; im2[k] = -im[k] * g;
    }
    for (let k = K; k < N; k++) { re2[k] = re2[N - k]; im2[k] = -im2[N - k]; }
    fft(re2, im2);                                                     // conj in, real part out = inverse
    for (let i = 0; i < N; i++) { const k = s + i; if (k >= 0 && k < x.length) y[k] += re2[i] / N * WIN[i] / 2; }
  });
  return Float32Array.from(y);
}
/** clicks: a spike in the second difference far above its 50 ms surroundings; only its top end (>2 kHz) is faded out */
function declick(x, ratio = 15) {
  const d = new Float32Array(x.length); for (let i = 2; i < x.length; i++) d[i] = x[i] - 2 * x[i - 1] + x[i - 2];
  const found = [];
  for (let c = 0; c < x.length; c += 240) {
    let peak = 0, at = c; for (let i = c; i < Math.min(c + 240, x.length); i++) if (Math.abs(d[i]) > peak) { peak = Math.abs(d[i]); at = i; }
    let e = 0, n = 0; for (let i = Math.max(0, at - 2400); i < Math.min(x.length, at + 2400); i++) { if (Math.abs(i - at) >= 48) { e += d[i] * d[i]; n++; } }
    if (n && peak / (Math.sqrt(e / n) + 1e-9) > ratio) found.push(at);
  }
  // zero-phase 2 kHz low-pass (biquad, forward and back) around each click; the rest above it is the click
  const w0 = 2 * Math.PI * 2000 / SR, al = Math.sin(w0) / (2 * Math.SQRT1_2), cw = Math.cos(w0), a0 = 1 + al;
  const b = [(1 - cw) / 2 / a0, (1 - cw) / a0, (1 - cw) / 2 / a0], a = [-2 * cw / a0, (1 - al) / a0];
  const lp = (seg) => { const o = new Float64Array(seg.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < seg.length; i++) { const v = b[0] * seg[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2; x2 = x1; x1 = seg[i]; y2 = y1; y1 = v; o[i] = v; } return o; };
  for (const at of found) {
    const from = Math.max(0, at - 960), seg = x.slice(from, Math.min(x.length, at + 960));
    const low = lp(lp(seg).reverse()).reverse();
    for (let i = -96; i <= 96; i++) {
      const k = at + i - from; if (k < 0 || k >= seg.length) continue;
      const w = 0.5 + 0.5 * Math.cos(Math.PI * i / 96);
      x[from + k] = low[k] + (seg[k] - low[k]) * (1 - w);
    }
  }
  return found.map((s) => +(s / SR).toFixed(3));
}

// 1 · restore each take once
const raw = { bond: decode(SRC.bond), mission: decode(SRC.mission) };
const print = noisePrint(raw[NOISE_PRINT.take].slice(NOISE_PRINT.from * SR, NOISE_PRINT.to * SR));
const TONE = "highpass=f=35,equalizer=f=210:t=q:w=1.2:g=-2.5,equalizer=f=3400:t=q:w=1:g=2.5,highshelf=f=9000:g=1.5";
for (const [k, x] of Object.entries(raw)) {
  const clicks = declick(x);
  writeWav(f(k + "-restored.wav"), [denoise(x, print)]);
  run(["-i", f(k + "-restored.wav"), "-af", TONE, "-c:a", "pcm_f32le", f(k + "-clean.wav")]);
  console.log(k, "restored; clicks lifted at", clicks.join(", ") || "—");
}

// 2 · a hall to ring out in: stereo, darkening as it decays
{
  const len = Math.round(SR * 2.8), pre = Math.round(SR * 0.018), L = new Float32Array(len), R = new Float32Array(len);
  let seed = 29; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  const lp = [0, 0];
  for (let i = 0; i < len; i++) for (let c = 0; c < 2; c++) {
    const x = i / len, tone = 0.55 * (1 - x) + 0.08;
    lp[c] += tone * (rnd() - lp[c]);
    (c ? R : L)[i] = i < pre ? 0 : lp[c] * Math.pow(1 - x, 3.2) * Math.min(1, (i - pre) / (SR * 0.01));
  }
  // unit energy per channel, so the wet signal sits about as loud as what goes in (afir's own auto gain is turned off: it
  // normalises a long IR's peak response and leaves the tail some 50 dB down)
  for (const ch of [L, R]) { let e = 0; for (const v of ch) e += v * v; const k = 1 / Math.sqrt(e); for (let i = 0; i < len; i++) ch[i] *= k; }
  writeWav(f("hall.wav"), [L, R]);
}
const inHall = (from, to) => run(["-i", f(from), "-i", f("hall.wav"), "-filter_complex", "[0]apad=pad_dur=2.8,pan=stereo|c0=c0|c1=c0[x];[x][1]afir=dry=1:wet=1:gtype=none[y]", "-map", "[y]", "-c:a", "pcm_f32le", f(to)]);

// 3 · the pieces
const pitch = (n) => n ? `,rubberband=pitch=${SEMI(n).toFixed(7)}:pitchq=quality:transients=crisp` : "";
const piece = (src, { from, to, semitones = 0 }, extra, out) =>
  run(["-i", f(src + "-clean.wav"), "-af", `atrim=start=${from}:end=${to},asetpts=PTS-STARTPTS${pitch(semitones)},${extra}`, "-c:a", "pcm_f32le", f(out)]);
const B = MU.bond, M = MU.mission;
const bondButton = T.button - B.at;                       // where 007's last accent falls, relative to the piece
// its last accent holds one chord for 0.8 s and its next phrase starts at 13.87 s: the chord rings out whole, the band stops just
// before that phrase, and the chord's own reverb carries the tail on under the Mission's rising bongos
const HOLD = 0.8;
piece("bond", B, `afade=t=in:d=0.25,afade=t=out:st=${(bondButton + HOLD - 0.2).toFixed(3)}:d=0.3:curve=hsin`, "bond.wav");
piece("bond", { ...B, from: B.from + bondButton - 0.1, to: B.from + bondButton + HOLD }, `afade=t=in:d=0.04,afade=t=out:st=${(HOLD - 0.02).toFixed(3)}:d=0.12`, "bond-ring.wav");
const missionEnd = M.to - M.from;
piece("mission", M, `afade=t=in:d=0.04,afade=t=out:st=${(missionEnd - 0.07).toFixed(3)}:d=0.07`, "mission.wav");
/** a gain envelope (piece time → linear gain), smooth to the sample, applied in place */
function shape(file, gainAt) { const x = decode(f(file)); for (let i = 0; i < x.length; i++) x[i] *= gainAt(i / SR); writeWav(f(file), [x]); }
const ramp = (t, a, b, from, to) => t <= a ? from : t >= b ? to : from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * (t - a) / (b - a)));
// the Mission's bongos rise from 8 dB under to 7 dB over their own level (about the band's) while the wire burns, slow at first; the music never stops for the end,
// it draws breath: a fifth of a second down before the title and (less) before the date, and from the title on it plays 3 dB
// up — the end frame is the loudest place in the film
{
  const tc = T.catch - M.at, tt = T.title - M.at, td = T.date - M.at, UP = 1.41, DIP = 0.5;
  shape("mission.wav", (t) => t < tc ? Math.pow(10, (-8 + 15 * Math.pow(t / tc, 1.5)) / 20)
    : t < tt - 0.3 ? 1 : t < tt ? (t < tt - 0.06 ? ramp(t, tt - 0.3, tt - 0.22, 1, DIP) : ramp(t, tt - 0.06, tt, DIP, UP))
    : t < td - 0.22 ? UP : t < td ? (t < td - 0.05 ? ramp(t, td - 0.22, td - 0.16, UP, UP * 0.7) : ramp(t, td - 0.05, td, UP * 0.7, UP)) : UP);
}
piece("mission", { ...M, from: M.to - 0.4, to: M.to }, "afade=t=in:d=0.02,afade=t=out:st=0.33:d=0.07", "mission-ring.wav");
// each cut-off runs into the hall; and every piece gets a quiet stereo send into it, for width and a room to sit in
for (const k of ["bond-ring", "mission-ring", "bond", "mission"]) inHall(k + ".wav", k + "-hall.wav");

// 4 · balance by loudness: the 007 cold open a touch under the Mission's action, the hits under all
const target = { bond: -17, mission: -15.5 };
const gain = {};
for (const [k, lufs] of Object.entries(target)) { const { i } = loudness(f(k + ".wav")); gain[k] = lufs - i; console.log(k, "measured", i, "LUFS → gain", gain[k].toFixed(2), "dB"); }
const sfx = path.join(BUILD, "sfx.wav");
if (!fs.existsSync(sfx)) { console.error("render the sound design first: node scripts/trailer/render-score.mjs"); process.exit(1); }
const sfxGain = -22 - loudness(sfx).i;

// 5 · lay everything on the timeline and mix
// [file, at, gain dB, mono, gone by (timeline s)?]: the Mission's last 燈 rings on in the room under the burn
const SEND = -15;   // the hall under the dry takes
const stems = [
  ["bond.wav", B.at, gain.bond, true],
  ["bond-hall.wav", B.at, gain.bond + SEND, false],
  ["bond-ring-hall.wav", B.at + bondButton - 0.1, gain.bond - 3, false],
  ["mission.wav", M.at, gain.mission, true],
  ["mission-hall.wav", M.at, gain.mission + SEND, false],
  ["mission-ring-hall.wav", M.at + missionEnd - 0.4, gain.mission - 5, false],
  [sfx, 0, sfxGain, false],
];
const inputs = stems.flatMap(([file]) => ["-i", path.isAbsolute(file) ? file : f(file)]);
const shut = (end) => end ? `,afade=t=out:st=${(end - 0.12).toFixed(3)}:d=0.12` : "";
const chains = stems.map(([, at, g, mono, end], i) => `[${i}]${mono ? "pan=stereo|c0=c0|c1=c0," : ""}aformat=sample_rates=${SR}:channel_layouts=stereo,volume=${g.toFixed(2)}dB,adelay=${Math.round(at * 1000)}:all=1,apad=whole_dur=${T.duration + 0.2}${shut(end)}[s${i}]`);
const mix = `${chains.join(";")};${stems.map((_, i) => `[s${i}]`).join("")}amix=inputs=${stems.length}:normalize=0:duration=longest,atrim=end=${T.duration + 0.15},acompressor=threshold=-17dB:ratio=1.7:attack=12:release=200:makeup=1[m]`;
run([...inputs, "-filter_complex", mix, "-map", "[m]", "-c:a", "pcm_f32le", f("mix.wav")]);

// 6 · master: gain into a look-ahead limiter until it sits at −11 LUFS
const TARGET = -11, master = (g) => `volume=${g.toFixed(2)}dB,alimiter=limit=0.8:attack=4:release=80:level=false`;   // −1.9 dBFS: the AAC encode overshoots ~1 dB
let g = TARGET - loudness(f("mix.wav")).i;
for (let pass = 0; pass < 3; pass++) {
  const r = loudness(f("mix.wav"), master(g));
  console.log(`master pass ${pass}: ${g.toFixed(2)} dB → ${r.i} LUFS, TP ${r.tp}`);
  if (Math.abs(r.i - TARGET) < 0.2) break;
  g += TARGET - r.i;
}
const OUT = path.join(BUILD, "score.wav");
run(["-i", f("mix.wav"), "-af", master(g), "-ar", String(SR), "-c:a", "pcm_s16le", OUT]);
console.log("wrote", path.relative(ROOT, OUT));
