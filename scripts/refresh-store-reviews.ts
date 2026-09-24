import { appendFile } from "node:fs/promises";
import { cert, deleteApp, initializeApp } from "firebase-admin/app";
import { getDatabase, ServerValue } from "firebase-admin/database";
import { defaultStoreDirectory, nextReviewRecord, seedMissingStores } from "../lib/store-directory";
import { scrapeStoreReviews } from "../lib/scrape-store-reviews";

type Result = { name: string; state: "成功" | "失敗" | "保留較新版"; message: string };
const projectId = "autumn-outing";
const databaseURL = "https://autumn-outing-default-rtdb.asia-southeast1.firebasedatabase.app";

function credential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!json) throw new Error("請先設定 GitHub Actions Secret：FIREBASE_SERVICE_ACCOUNT。沒有憑證時不會抓取或寫入資料。");
  try {
    const value = JSON.parse(json);
    if (value.project_id !== projectId || typeof value.client_email !== "string" || typeof value.private_key !== "string") throw new Error();
    return cert(value);
  } catch { throw new Error("FIREBASE_SERVICE_ACCOUNT 必須是 autumn-outing 專案的有效服務帳戶 JSON。請勿將憑證放進程式碼或執行紀錄。"); }
}

async function writeSummary(results: Result[]) {
  const updated = results.filter(result => result.state === "成功").length;
  const failed = results.filter(result => result.state === "失敗").length;
  const escape = (text: string) => text.replace(/[|\r\n<>]/g, " ");
  const summary = ["## Google 評論每日更新", "", `完成時間：${new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })}（台灣時間）`, "", `成功更新 ${updated} 家、失敗 ${failed} 家。未成功更新的店家保留原有評論。`, "", "| 店家 | 結果 | 說明 |", "| --- | --- | --- |", ...results.map(result => `| ${escape(result.name)} | ${result.state} | ${escape(result.message)} |`), ""].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(`成功更新 ${updated} 家、失敗 ${failed} 家。`);
}

async function main() {
  const app = initializeApp({ credential: credential(), projectId, databaseURL }, "daily-store-reviews");
  const database = getDatabase(app);
  const results: Result[] = [];
  try {
    try {
      const stores = database.ref("outing/stores");
      const existing = await stores.get();
      if (Object.keys(defaultStoreDirectory).some(id => !existing.child(id + "/info").exists() || !existing.child(id + "/reviews").exists())) {
        await stores.transaction(seedMissingStores);
        console.log("Firebase 連線成功；先前已取得的店家資料已自動補存，既有資料保持不變。");
      } else {
        console.log("Firebase 連線成功；七家店已有資料，開始擷取最新評論。");
      }
    } catch {
      throw new Error("Firebase 連線或資料同步未完成，請檢查 FIREBASE_SERVICE_ACCOUNT 是否有 autumn-outing 的 Realtime Database 存取權限。");
    }
    for (const [id, seed] of Object.entries(defaultStoreDirectory)) {
      if (!seed.reviews) continue;
      console.log(`正在擷取：${seed.info.name}`);
      let phase: "capture" | "save" = "capture";
      try {
        const reviews = await scrapeStoreReviews(seed.reviews);
        phase = "save";
        // The transaction retries against current data, preserving edited links and newer captures.
        const transaction = await database.ref("outing/stores/" + id).transaction(current => {
          const previous = { ...seed, ...(current || {}) };
          const next = nextReviewRecord(previous, reviews);
          return next === previous ? undefined : { ...next, updatedAt: ServerValue.TIMESTAMP };
        });
        const result: Result = { name: seed.info.name, state: transaction.committed ? "成功" : "保留較新版", message: transaction.committed ? `評分 ${reviews.rating}、${reviews.reviewCount} 則評價、最新五則已自動儲存。` : "資料庫已有更新的評論，未覆蓋。" };
        results.push(result);
        console.log(`${result.state}：${result.name}，${result.message}`);
      } catch (error) {
        const message = phase === "capture" && error instanceof Error ? error.message : "Firebase 儲存未完成，請檢查服務帳戶權限與連線。";
        results.push({ name: seed.info.name, state: "失敗", message });
        console.log(`失敗：${seed.info.name}，${message}`);
      }
    }
    await writeSummary(results);
    if (results.some(result => result.state === "失敗")) process.exitCode = 1;
  } finally { await deleteApp(app); }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.message : "評論更新工作未完成。");
  process.exitCode = 1;
});
