// Renders the trailer score: scripts/trailer/score.js runs in headless Chrome (OfflineAudioContext) on the cues in
// scripts/trailer/timeline.json; ffmpeg masters it (gain into a look-ahead limiter) to a WAV that render-film.mjs muxes.
//   CHROME_PATH=... FFMPEG_PATH=... node scripts/trailer/render-score.mjs [--out .trailer-build/score.wav]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const outArg = process.argv.indexOf("--out");
const OUT = path.resolve(ROOT, outArg > 0 ? process.argv[outArg + 1] : ".trailer-build/score.wav");
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const SR = 48000;
const wavOut = OUT.replace(/.wav$/, "") + ".raw.wav";

const cues = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/trailer/timeline.json"), "utf8"));
const browser = await chromium.launch({ executablePath: CHROME, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
page.on("pageerror", (error) => console.error("[score]", error.message));
await page.setContent("<!doctype html><title>score</title>");
await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, "scripts/trailer/score.js"), "utf8") });
const started = Date.now();
const length = await page.evaluate(async ({ sr, cues }) => {
  const buffer = await window.composeScore({ sr, cues });
  window.__score = buffer;
  return buffer.length;
}, { sr: SR, cues });
console.log(`rendered ${(length / SR).toFixed(2)}s in ${((Date.now() - started) / 1000).toFixed(1)}s`);

const CHUNK = SR * 5, parts = [];
for (let offset = 0; offset < length; offset += CHUNK) {
  const b64 = await page.evaluate(({ offset, size }) => {
    const b = window.__score, L = b.getChannelData(0), R = b.getChannelData(1), n = Math.min(size, b.length - offset);
    const pcm = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { pcm[i * 2] = L[offset + i]; pcm[i * 2 + 1] = R[offset + i]; }
    const u8 = new Uint8Array(pcm.buffer); let s = "";
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }, { offset, size: CHUNK });
  parts.push(Buffer.from(b64, "base64"));
}
await browser.close();

const pcm = Buffer.concat(parts);
const header = Buffer.alloc(44);
header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVE", 8); header.write("fmt ", 12);
header.writeUInt32LE(16, 16); header.writeUInt16LE(3, 20); header.writeUInt16LE(2, 22); header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 8, 28); header.writeUInt16LE(8, 32); header.writeUInt16LE(32, 34); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(wavOut, Buffer.concat([header, pcm]));
let peak = 0; for (let i = 0; i < pcm.length; i += 4) peak = Math.max(peak, Math.abs(pcm.readFloatLE(i)));
console.log("raw peak dBFS", (20 * Math.log10(peak)).toFixed(2));

// Master like a trailer: gain into a look-ahead limiter until the whole piece sits at the target loudness.
const TARGET = -11;
const run = (args) => { const r = spawnSync(FFMPEG, args, { encoding: "utf8" }); if (r.status !== 0) { console.error(r.stderr); process.exit(1); } return r.stderr; };
const loudness = (filter) => {
  const text = run(["-hide_banner", "-i", wavOut, "-af", (filter ? filter + "," : "") + "loudnorm=print_format=json", "-f", "null", "-"]);
  const json = JSON.parse(text.slice(text.lastIndexOf("{"), text.lastIndexOf("}") + 1));
  return { i: Number(json.input_i), tp: Number(json.input_tp) };
};
const master = (gain) => `volume=${gain.toFixed(2)}dB,alimiter=limit=0.87:attack=4:release=90:level=false`;
let gain = TARGET - loudness("").i;
for (let pass = 0; pass < 3; pass++) {
  const result = loudness(master(gain));
  console.log(`pass ${pass}: +${gain.toFixed(2)} dB → ${result.i} LUFS, TP ${result.tp}`);
  if (Math.abs(result.i - TARGET) < 0.2) break;
  gain += TARGET - result.i;
}
run(["-hide_banner", "-y", "-i", wavOut, "-af", master(gain), "-ar", "48000", "-c:a", "pcm_s16le", OUT]);
console.log("wrote", path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1024).toFixed(0) + " KB");
