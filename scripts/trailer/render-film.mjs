// Renders the trailer composition to video: parallel headless Chrome workers capture SUB sub-frames per frame across a
// 180° shutter, ffmpeg averages them (motion blur), adds a soft highlight bloom, and the pieces are joined with the score.
//   FFMPEG_PATH=... node scripts/trailer/render-film.mjs --ar 16x9 [--workers 6] [--from 0] [--to 30] [--audio score.wav]
//     [--out public/assets/trailer/trailer-16x9.mp4] [--crf 23] [--grain 0]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright-core";
import { ROOT, startServer } from "./film-server.mjs";

const arg = (name, fallback) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : fallback; };
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ar = arg("ar", "16x9"), [W, H] = ar === "9x16" ? [1080, 1920] : [1920, 1080];
const timeline = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/trailer/timeline.json"), "utf8"));
const FPS = timeline.fps, SUB = 8, SHUTTER = .5;
const from = Number(arg("from", 0)), to = Math.min(Number(arg("to", timeline.duration)), timeline.duration);
const WORKERS = Number(arg("workers", Math.max(2, Math.min(8, os.cpus().length - 2))));
const out = path.resolve(ROOT, arg("out", `public/assets/trailer/trailer-${ar}.mp4`));
const tmp = path.join(os.tmpdir(), "trailer-render-" + ar);
fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });

const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS), total = f1 - f0, per = Math.ceil(total / WORKERS);
console.log(`${ar}: frames ${f0}–${f1} @${FPS}fps × ${SUB} sub-frames, ${WORKERS} workers`);
const server = await startServer();
let done = 0; const started = Date.now();
const progress = setInterval(() => process.stdout.write(`\r  ${done}/${total} frames, ${((Date.now() - started) / 1000).toFixed(0)}s   `), 1000);

// motion blur: average each group of SUB captures, keep one frame per group; then a gentle bloom on the highlights
const blurAndBloom = `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB,format=gbrp,split[a][b];[b]curves=all='0/0 0.62/0 1/1',gblur=sigma=${Math.round(W / 110)}[g];[a][g]blend=all_mode=screen:all_opacity=0.32,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv`;
// The captures are JPEGs (BT.601, full range): convert explicitly to BT.709 limited range and tag it, so every ffmpeg build
// produces the same, correctly labelled colours.
const COLOR = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"];

async function work(w) {
  const a = f0 + w * per, b = Math.min(f1, a + per); if (a >= b) return null;
  const file = path.join(tmp, `seg-${String(w).padStart(2, "0")}.mp4`);
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--hide-scrollbars", "--force-color-profile=srgb", "--disable-lcd-text", "--mute-audio"] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on("pageerror", (e) => console.error("\n[film]", e.message));
  await page.goto(server.url + "?ar=" + ar);
  await page.waitForFunction(() => window.FILM?.isReady, null, { timeout: 180000 });
  const cdp = await page.context().newCDPSession(page);
  const ff = spawn(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS * SUB), "-c:v", "mjpeg", "-i", "-",
    "-filter_complex", blurAndBloom, "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p", ...COLOR, "-r", String(FPS), file], { stdio: ["pipe", "inherit", "inherit"] });
  const write = (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once("drain", res)));
  for (let f = a; f < b; f++) {
    for (let s = 0; s < SUB; s++) {
      const t = f / FPS + ((s + .5) / SUB) * SHUTTER / FPS;   // forward shutter: a cut on the frame never bleeds back
      await page.evaluate((x) => window.FILM.seek(x), t);
      const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 95, optimizeForSpeed: true, fromSurface: true });
      await write(Buffer.from(data, "base64"));
    }
    done++;
  }
  ff.stdin.end(); await new Promise((res) => ff.on("close", res));
  await browser.close();
  return file;
}
const segments = (await Promise.all(Array.from({ length: WORKERS }, (_, w) => work(w)))).filter(Boolean);
clearInterval(progress); server.close();
console.log(`\n  captured in ${((Date.now() - started) / 1000).toFixed(0)}s`);

const list = path.join(tmp, "list.txt");
fs.writeFileSync(list, segments.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
const audio = arg("audio", null), grain = Number(arg("grain", 0)), crf = arg("crf", "23");
const args = ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list];
if (audio) args.push("-i", path.resolve(ROOT, audio));
if (grain) args.push("-vf", `noise=alls=${grain}:allf=t`);
args.push("-map", "0:v"); if (audio) args.push("-map", "1:a", "-c:a", "aac", "-b:a", "160k", "-shortest");
args.push("-c:v", "libx264", "-preset", "slow", "-crf", crf, "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart",
  ...COLOR, out);
fs.mkdirSync(path.dirname(out), { recursive: true });
await new Promise((res, rej) => { const pr = spawn(FFMPEG, args, { stdio: "inherit" }); pr.on("close", (c) => (c === 0 ? res() : rej(new Error("encode failed " + c)))); });
console.log("→", path.relative(ROOT, out), (fs.statSync(out).size / 1e6).toFixed(1) + " MB");
