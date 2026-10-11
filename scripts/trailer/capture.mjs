// Frame review for the opening trailer (development server only: it relies on ?filmSeek).
//   node scripts/trailer/capture.mjs --size 1600x900 --times 0.5,4.02,13.4 --out frames/
//   node scripts/trailer/capture.mjs --size 1280x720 --fps 30 --out frames/   (every frame, for a preview video)
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const arg = (name, fallback) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : fallback; };
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const url = arg("url", "http://localhost:3008/?filmSeek&standings=3,9");
const [width, height] = arg("size", "1600x900").split("x").map(Number);
const out = arg("out", "frames");
const scale = Number(arg("scale", "1"));
const fps = Number(arg("fps", "0"));
const timeline = JSON.parse(fs.readFileSync(new URL("../../lib/opening-timeline.json", import.meta.url), "utf8"));
const times = fps ? Array.from({ length: Math.ceil(timeline.duration * fps) }, (_, i) => i / fps) : arg("times", "0.5").split(",").map(Number);
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ["--hide-scrollbars", "--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale, isMobile: width < height, hasTouch: width < height });
page.on("pageerror", (error) => console.error("[page]", error.message));
await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => typeof window.__filmSeek === "function", null, { timeout: 60000 });
// Give the cover time to fetch and decode every shot and face (the film's own preload runs meanwhile).
await page.waitForTimeout(4000);
await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
for (const [i, t] of times.entries()) {
  await page.evaluate((time) => window.__filmSeek(time), t);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const name = fps ? String(i).padStart(5, "0") + ".jpg" : "t" + t.toFixed(2).padStart(5, "0") + ".jpg";
  await page.screenshot({ path: path.join(out, name), type: "jpeg", quality: 88 });
  if (!fps) console.log("frame", t);
}
await browser.close();
console.log("captured", times.length, "frames to", out);
