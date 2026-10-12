// Quick stills of the trailer composition for review (no motion blur).
//   node scripts/trailer/film-frames.mjs --ar 16x9 --times 1.5,4.02 --out frames/
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { startServer } from "./film-server.mjs";

const arg = (name, fallback) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : fallback; };
const ar = arg("ar", "16x9"), out = arg("out", "frames"), times = arg("times", "1").split(",").map(Number);
const [W, H] = ar === "9x16" ? [1080, 1920] : [1920, 1080];
fs.mkdirSync(out, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", args: ["--hide-scrollbars", "--force-color-profile=srgb", "--disable-lcd-text"] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("pageerror", (e) => console.error("[film]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("[film console]", m.text()); });
page.on("response", (r) => { if (r.status() >= 400) console.error("[film 404]", r.url()); });
await page.goto(server.url + "?ar=" + ar);
await page.waitForFunction(() => window.FILM?.isReady, null, { timeout: 120000 });
for (const t of times) {
  await page.evaluate((x) => window.FILM.seek(x), t);
  await page.screenshot({ path: path.join(out, `${ar}-t${t.toFixed(2).padStart(5, "0")}.jpg`), type: "jpeg", quality: 88 });
}
await browser.close(); server.close();
console.log("stills:", times.length);
