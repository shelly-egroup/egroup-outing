// Renders the trailer's sound design (scripts/trailer/score.js) in headless Chrome (OfflineAudioContext) on the cues in
// scripts/trailer/timeline.json, as an unmastered stem; scripts/trailer/music.mjs lays the two recordings, mixes this
// under them and masters the whole to the score render-film.mjs muxes.
//   CHROME_PATH=... node scripts/trailer/render-score.mjs [--out .trailer-build/sfx.wav]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const outArg = process.argv.indexOf("--out");
const OUT = path.resolve(ROOT, outArg > 0 ? process.argv[outArg + 1] : ".trailer-build/sfx.wav");
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const SR = 48000;

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
fs.writeFileSync(OUT, Buffer.concat([header, pcm]));
let peak = 0; for (let i = 0; i < pcm.length; i += 4) peak = Math.max(peak, Math.abs(pcm.readFloatLE(i)));
console.log("wrote", path.relative(ROOT, OUT), "peak dBFS", (20 * Math.log10(peak)).toFixed(2));
