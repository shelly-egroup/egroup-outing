import { defaultStoreDirectory } from "@/lib/store-directory";
import { scrapeStoreReviews } from "@/lib/scrape-store-reviews";

export const runtime = "nodejs";
export const maxDuration = 60;
const attempts = new Map<string, number>();
const active = new Set<string>();
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return reply({ error: "請先以主辦帳號登入。" }, 401);
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) return reply({ error: "Firebase 登入驗證尚未設定。" }, 503);
  // Firebase verifies the ID token; never trust an email or role sent by the client.
  let uid: string;
  try {
    const authResponse = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(key), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }), cache: "no-store", signal: AbortSignal.timeout(6000),
    });
    if (!authResponse.ok) return reply({ error: "登入已失效，請重新登入。" }, 401);
    const account = (await authResponse.json()).users?.[0];
    const admins = (process.env.FIREBASE_ADMIN_EMAILS || process.env.NEXT_PUBLIC_FIREBASE_ADMIN_EMAILS || "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
    if (!account?.localId || account.disabled || !account.emailVerified || !admins.includes(String(account.email).trim().toLowerCase())) return reply({ error: "只有指定主辦帳號可以重新擷取評論。" }, 403);
    uid = account.localId;
  } catch { return reply({ error: "暫時無法確認登入身分，請稍後再試。" }, 503); }
  const { id } = await params;
  if (!Object.hasOwn(defaultStoreDirectory, id) || !defaultStoreDirectory[id].reviews) return reply({ error: "這家店尚未設定可核對的 Google 評論來源。" }, 404);
  const attemptKey = uid + ":" + id;
  if (active.has(uid) || Date.now() - (attempts.get(attemptKey) || 0) < 60000) return reply({ error: "請等目前擷取完成，或一分鐘後再試。" }, 429);
  for (const [entry, time] of attempts) if (Date.now() - time > 60000) attempts.delete(entry);
  attempts.set(attemptKey, Date.now()); active.add(uid);
  try {
    const snapshot = await scrapeStoreReviews(defaultStoreDirectory[id].reviews!);
    return reply({ snapshot });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "擷取失敗，已保留上一版評論。" }, 502);
  } finally { active.delete(uid); }
}
