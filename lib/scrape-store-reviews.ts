import { chromium as playwright, type Browser } from "playwright-core";
import { parseReviewSnapshot } from "./store-directory";
import type { StoreReviewSnapshot } from "./store-reviews";

// Run only on the server after authenticating an administrator. Never solve a challenge.
export async function scrapeStoreReviews(previous: StoreReviewSnapshot): Promise<StoreReviewSnapshot> {
  let browser: Browser | undefined;
  let timedOut = false;
  const deadline = setTimeout(() => { timedOut = true; void browser?.close().catch(() => {}); }, 45000);
  try {
    if (process.env.PLAYWRIGHT_BROWSER_MODE === "installed") {
      browser = await playwright.launch({ headless: true, timeout: 10000 });
    } else if (process.platform === "linux") {
      const chromium = (await import("@sparticuz/chromium")).default;
      browser = await playwright.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true, timeout: 10000 });
    } else {
      browser = await playwright.launch({ ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : { channel: "msedge" }), headless: true, timeout: 10000 });
    }
    if (timedOut) throw new Error("擷取逾時，已保留上一版評論。");
    const page = await browser.newPage({ locale: "zh-TW", viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(12000);
    await page.goto(previous.sourceUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    const latest = page.getByRole("radio", { name: "最新", exact: true });
    try { await latest.waitFor({ state: "visible" }); }
    catch {
      const state = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          host: location.hostname,
          path: location.pathname,
          challenge: location.pathname.startsWith("/sorry/") || Boolean(document.querySelector('iframe[src*="recaptcha"], #captcha-form')),
          consent: location.hostname === "consent.google.com",
          partial: /目前只顯示部分內容|目前僅顯示部分內容|Only showing some content/i.test(text),
          reviewRows: document.querySelectorAll(".bwb7ce").length,
          sortOptions: Array.from(document.querySelectorAll('[role="radio"]')).slice(0, 8).map(el => (el.textContent || "").slice(0, 40)),
        };
      });
      // Log only public page structure; never log cookies, response bodies, or credentials.
      console.warn("Google review page unavailable:", JSON.stringify(state));
      if (state.challenge) throw new Error("Google 要求驗證，暫時阻擋自動擷取；已保留上一版評論。");
      if (state.consent) throw new Error("Google 顯示同意設定頁，未提供評論列表；已保留上一版評論。");
      if (state.partial) throw new Error("Google 在此環境僅提供部分內容，未提供評論列表；已保留上一版評論。");
      throw new Error("Google 未提供可讀取的最新評論列表，已保留上一版。請稍後再試。");
    }
    const before = await page.locator(".bwb7ce:visible").evaluateAll(rows => rows.slice(0, 5).map(row => row.getAttribute("data-id")).join("|"));
    if (await latest.getAttribute("aria-checked") !== "true") {
      await latest.click();
      await page.waitForFunction(old => {
        const rows = Array.from(document.querySelectorAll(".bwb7ce")).filter(row => row.getClientRects().length);
        return rows.length >= 5 && rows.slice(0, 5).map(row => row.getAttribute("data-id")).join("|") !== old;
      }, before);
    }
    if (await latest.getAttribute("aria-checked") !== "true") throw new Error("無法確認最新排序，已保留上一版。");
    const panel = page.getByRole("dialog").filter({ has: latest });
    const headingText = await panel.innerText();
    const ratingLabel = await panel.getByRole("img", { name: /^評等/ }).first().getAttribute("aria-label");
    const rating = Number(ratingLabel?.match(/評等[：:]\s*([\d.]+)/)?.[1]);
    const reviewCount = Number(headingText.match(/([\d,]+)\s*則評論/)?.[1].replaceAll(",", ""));
    const rows = page.locator(".bwb7ce:visible");
    if (await rows.count() < 5) throw new Error("這次未取得完整五則評論，已保留上一版。");
    for (let index = 0; index < 5; index++) {
      const more = rows.nth(index).getByRole("button", { name: /^查看.+的其他評論$/ });
      if (await more.count() && await more.first().isVisible()) await more.first().click();
    }
    const reviews = await rows.evaluateAll(elements => elements.slice(0, 5).map(el => {
      const stars = Array.from(el.querySelectorAll(".h3PQJ svg path")).map(node => node.getAttribute("fill"));
      const fullText = Array.from(el.querySelectorAll(".d83Iyc")).filter(node => node.getClientRects().length && !node.closest(".PdaDLc")).map(node => Array.from(node.childNodes).map(child => child.nodeType === 3 ? child.textContent : child.nodeName === "BR" ? "\n" : "").join("")).join("\n").trim();
      const characters = Array.from(fullText);
      const text = characters.slice(0, 50).join("");
      return {
        author: el.querySelector(".rhtdWc")?.textContent,
        authorUrl: el.querySelector("a.yC3ZMb")?.getAttribute("href"),
        rating: stars.length === 5 && stars.every(fill => fill === "#fabb05" || fill === "#dadce0") ? stars.filter(fill => fill === "#fabb05").length : 0,
        relativeTimeAtCapture: el.querySelector(".m6Mr5d")?.textContent,
        text,
        ...(characters.length > 50 ? { excerpt: true } : {}),
        ...(Array.from(el.querySelectorAll("button")).some(node => !node.closest(".PdaDLc") && node.innerText.includes("由 Google 提供翻譯")) ? { translated: true } : {}),
      };
    }));
    const snapshot = parseReviewSnapshot({ storeName: previous.storeName, rating, reviewCount, capturedAt: new Date().toISOString(), sourceUrl: previous.sourceUrl, reviews });
    if (!snapshot) throw new Error("這次評論的評分或內容不完整，已保留上一版。");
    return snapshot;
  } catch (error) {
    if (timedOut) throw new Error("擷取逾時，已保留上一版評論。請稍後再試。");
    if (error instanceof Error && error.message.includes("已保留")) throw error;
    throw new Error("這次無法完成 Google 評論擷取，已保留上一版。請稍後再試。", { cause: error });
  } finally {
    clearTimeout(deadline);
    await browser?.close().catch(() => {});
  }
}
