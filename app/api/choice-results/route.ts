import { publicChoiceResults } from "@/lib/vote-summary";
import type { Catalog, PublicVote, VoteDetails } from "@/lib/trips";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const base = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
    if (!base) throw new Error("Configuration unavailable");
    // Read on the server only. Return counts and the requested option portraits; never private notes, email or family data.
    const response = await fetch(base.replace(/\/$/, "") + "/outing.json", { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Snapshot unavailable");
    const snapshot = await response.json() as { catalog?: Catalog; votes?: Record<string, PublicVote>; voteDetails?: Record<string, VoteDetails> } | null;
    if (!snapshot?.catalog) return Response.json({ error: "方案尚未準備好。" }, { status: 503, headers });
    return Response.json(publicChoiceResults(snapshot.catalog, snapshot.votes || {}, snapshot.voteDetails || {}), { headers });
  } catch {
    return Response.json({ error: "細項票數暫時無法讀取，請稍後再試。" }, { status: 503, headers });
  }
}
