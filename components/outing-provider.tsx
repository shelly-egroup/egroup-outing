"use client";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  onValue,
  get,
  ref,
  update,
  serverTimestamp,
  runTransaction,
} from "firebase/database";
import { adminEmails, getFirebase } from "@/lib/firebase";
import { catalogImpacts, catalogImpactKey } from "@/lib/catalog-impact";
import LoginDialog from "./login-dialog";
import { getVotingAccess, isVotingAllowed, normalizedEmail, votingAccessMessage, type RegisteredUser, type VotingAccess } from "@/lib/voting-access";
import {
  prepareVoteDetails,
  isVotingOpen,
  type Catalog,
  type PublicVote,
  type VoteDetails,
  type VoteDraft,
} from "@/lib/trips";
type ContextValue = {
  user: User | null;
  authReady: boolean;
  profileReady: boolean;
  signingIn: boolean;
  isAdmin: boolean;
  votingAccess: VotingAccess | null;
  canVote: boolean;
  catalog: Catalog | null;
  catalogStatus: "loading" | "ready" | "empty" | "error";
  votes: Record<string, PublicVote>;
  votesReady: boolean;
  votesError: string;
  myDetails: VoteDetails | null;
  detailsReady: boolean;
  connected: boolean;
  error: string;
  now: number;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  submitVote: (draft: VoteDraft) => Promise<void>;
  saveCatalog: (catalog: Catalog, version: number | null, acceptedImpacts?: string) => Promise<void>;
};
const OutingContext = createContext<ContextValue | null>(null);
export function useOuting() {
  const value = useContext(OutingContext);
  if (!value) throw new Error("OutingProvider required");
  return value;
}
function readableError(error: unknown) {
  const code = (error as { code?: string }).code || "";
  if (code.includes("popup-closed") || code.includes("cancelled-popup"))
    return "登入已取消，剛才選好的方案還在。";
  if (code.includes("popup-blocked"))
    return "瀏覽器擋住登入視窗，請允許彈出視窗後再試一次。";
  if (code.includes("unauthorized-domain"))
    return "這個網址尚未開放 Google 登入，請聯絡主辦人。";
  if (code.includes("operation-not-allowed"))
    return "Google 登入尚未開放，請聯絡主辦人。";
  if (code.includes("network")) return "連線暫時中斷，請確認網路後再試一次。";
  return "暫時無法完成操作，請稍後再試。";
}
export function OutingProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null),
    [authReady, setAuthReady] = useState(false),
    [signingIn, setSigningIn] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [catalogStatus, setCatalogStatus] =
      useState<ContextValue["catalogStatus"]>("loading");
  const [votes, setVotes] = useState<Record<string, PublicVote>>({}),
    [votesReady, setVotesReady] = useState(false);
  const [votesError, setVotesError] = useState("");
  const [myDetails, setMyDetails] = useState<VoteDetails | null>(null),
    [detailsReady, setDetailsReady] = useState(false);
  const [connected, setConnected] = useState(false),
    [error, setError] = useState(""),
    [offset, setOffset] = useState(0),
    [now, setNow] = useState(Date.now());
  const [profile, setProfile] = useState<(RegisteredUser & { uid: string }) | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const isAdmin = !!user && profile?.uid === user.uid && profile.role === "admin";
  const votingAccess = user && profileReady && profile?.uid === user.uid ? getVotingAccess(user.email, profile.voteReview) : null;
  const canVote = votingAccess !== null && isVotingAllowed(votingAccess);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(timer);
  }, [offset]);
  useEffect(() => {
    let cleanups: (() => void)[] = [];
    try {
      const { auth, database } = getFirebase();
      cleanups = [
        onAuthStateChanged(
          auth,
          (next) => {
            setUser(next);
            setAuthReady(true);
          },
          () => {
            setAuthReady(true);
            setError("登入狀態讀取失敗，請重新整理。");
          },
        ),
        onValue(ref(database, ".info/connected"), (snap) =>
          setConnected(snap.val() === true),
        ),
        onValue(ref(database, ".info/serverTimeOffset"), (snap) =>
          setOffset(snap.val() || 0),
        ),
        onValue(
          ref(database, "outing/catalog"),
          (snap) => {
            setCatalog(snap.val());
            setCatalogStatus(snap.exists() ? "ready" : "empty");
          },
          () => setCatalogStatus("error"),
        ),
      ];
    } catch {
      setAuthReady(true);
      setCatalogStatus("error");
      setError("網站連線設定尚未完成，請聯絡主辦人。");
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
  // Public scores are separate from each member's private preferences.
  useEffect(() => {
    if (!authReady) return;
    setVotesError("");
    try {
      return onValue(ref(getFirebase().database, "outing/votes"), (snap) => {
        setVotes(snap.val() || {});
        setVotesReady(true);
        setVotesError("");
      }, () => {
        setVotesReady(false);
        setVotesError("暫時無法讀取公開戰況，請稍後重新整理。");
      });
    } catch {
      setVotesReady(false);
      setVotesError("戰況連線尚未完成，請稍後再試。");
    }
  }, [authReady, user?.uid]);
  useEffect(() => {
    setMyDetails(null);
    setDetailsReady(false);
    if (!user) return;
    return onValue(ref(getFirebase().database, "outing/voteDetails/" + user.uid), (snap) => {
      setMyDetails(snap.val());
      setDetailsReady(true);
    }, () => {
      setDetailsReady(false);
      setError("目前無法讀取你的投票，請稍後再試。");
    });
  }, [user]);
  useEffect(() => {
    setProfile(null);
    setProfileReady(false);
    if (!user) { setProfileReady(true); return; }
    let active = true;
    const profileRef = ref(getFirebase().database, "users/" + user.uid);
    const unsubscribe = onValue(profileRef, (snapshot) => {
      if (!active) return;
      const value = snapshot.val();
      setProfile(value ? { ...value, uid: user.uid, role: value.role || "member" } : null);
    }, () => {
      if (!active) return;
      setProfile(null);
      setProfileReady(true);
      setError("無法讀取使用者資料，請重新整理後再試。");
    });
    void user.getIdTokenResult().then(async ({ claims }) => {
      if (!active) return;
      await runTransaction(profileRef, (current) => ({
        ...current,
        email: normalizedEmail(user.email),
        displayName: typeof claims.name === "string" ? claims.name : "同事",
        photoURL: typeof claims.picture === "string" ? claims.picture : "",
        role: adminEmails.includes(normalizedEmail(user.email)) ? "admin" : current?.role || "member",
        createdAt: current?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      }), { applyLocally: false });
      if (active) setProfileReady(true);
    }).catch(() => {
      if (!active) return;
      setProfileReady(true);
      setError("使用者資料尚未儲存，請確認資料庫連線後重新整理。");
    });
    return () => { active = false; unsubscribe(); };
  }, [user]);
  async function login() { setError(""); setLoginOpen(true); }
  async function startGoogleLogin() {
    setSigningIn(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(getFirebase().auth, provider);
      setLoginOpen(false);
    } catch (error) {
      setError(readableError(error));
    } finally {
      setSigningIn(false);
    }
  }
  async function logout() {
    try {
      await signOut(getFirebase().auth);
      setError("");
    } catch (error) {
      setError(readableError(error));
      throw error;
    }
    router.replace("/", { scroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
  async function submitVote(draft: VoteDraft) {
    if (!user) throw new Error("請先使用 Google 登入。");
    if (!votingAccess) throw new Error("投票資格尚未確認，請稍後再試。");
    if (!canVote) throw new Error(votingAccessMessage(votingAccess));
    if (!connected) throw new Error("目前連線中斷，請恢復連線後再送出。");
    if (!catalog || catalogStatus !== "ready")
      throw new Error("方案尚未準備好，請稍後再試。");
    if (!isVotingOpen(catalog, Date.now() + offset))
      throw new Error("投票已截止，這次變更沒有送出。");
    const plan = catalog.plans[draft.planId];
    if (!plan?.active) throw new Error("這個方案已停止接受投票，請重新選擇。");
    const privateDetails = prepareVoteDetails(plan, draft);
    const token = await user.getIdTokenResult();
    const latestProfile = (await get(ref(getFirebase().database, "users/" + user.uid))).val() as RegisteredUser | null;
    const access = getVotingAccess(user.email, latestProfile?.voteReview);
    if (!latestProfile || !isVotingAllowed(access)) throw new Error(votingAccessMessage(access));
    if (getFirebase().auth.currentUser?.uid !== user.uid) throw new Error("登入帳號已變更，請重新確認投票。");
    const publicVote = {
      planId: draft.planId,
      displayName:
        typeof token.claims.name === "string" ? token.claims.name : "同事",
      photoURL:
        typeof token.claims.picture === "string" ? token.claims.picture : "",
      updatedAt: serverTimestamp(),
    };
    const details = {
      ...privateDetails,
      updatedAt: serverTimestamp(),
    };
    try {
      await update(ref(getFirebase().database, "outing"), {
        ["votes/" + user.uid]: publicVote,
        ["voteDetails/" + user.uid]: details,
      });
    } catch {
      throw new Error("投票未完成。可能已截止或方案已更新，請確認後再試。");
    }
  }
  async function saveCatalog(next: Catalog, version: number | null, acceptedImpacts?: string) {
    if (!isAdmin) throw new Error("只有主辦人可以管理方案。");
    if (!connected) throw new Error("連線中斷，尚未儲存。");
    if (version !== null) {
      const latest = (await get(ref(getFirebase().database, "outing"))).val();
      if (!latest?.catalog || latest.catalog.updatedAt !== version) throw new Error("方案已被其他管理員更新，請重新載入後再編輯。");
      const impacts = catalogImpacts(latest.catalog, next, latest.votes || {}, latest.voteDetails || {});
      if (impacts.some(item => item.removed)) throw new Error("有隊友已選擇你要移除的項目，請保留原選項後再儲存。");
      if (impacts.length && acceptedImpacts !== catalogImpactKey(impacts)) throw new Error("受影響的投票已更新，請重新確認變更內容與名單後再儲存。");
    }
    const result = await runTransaction(
      ref(getFirebase().database, "outing/catalog"),
      (current) => {
        if (
          version === null ? current !== null : current?.updatedAt !== version
        )
          return;
        return { ...next, updatedAt: serverTimestamp() };
      },
      { applyLocally: false },
    );
    if (!result.committed)
      throw new Error("方案已被其他管理員更新，請重新載入後再編輯。");
  }
  return (
    <OutingContext.Provider
      value={{
        user,
        authReady,
        profileReady,
        signingIn,
        isAdmin,
        votingAccess,
        canVote,
        catalog,
        catalogStatus,
        votes,
        votesReady,
        votesError,
        myDetails,
        detailsReady,
        connected,
        error,
        now,
        login,
        logout,
        submitVote,
        saveCatalog,
      }}
    >
      {children}
      <LoginDialog open={loginOpen} busy={signingIn} error={error} onClose={() => setLoginOpen(false)} onContinue={startGoogleLogin} />
    </OutingContext.Provider>
  );
}
