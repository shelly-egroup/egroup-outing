"use client";
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
  ref,
  update,
  serverTimestamp,
  runTransaction,
} from "firebase/database";
import { adminEmails, getFirebase } from "@/lib/firebase";
import {
  cleanPreferences,
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
  saveCatalog: (catalog: Catalog, version: number | null) => Promise<void>;
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
  const [profile, setProfile] = useState<{ uid: string; role: string } | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const isAdmin = !!user && profile?.uid === user.uid && profile.role === "admin";
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
      setProfile(value ? { uid: user.uid, role: value.role || "member" } : null);
    }, () => {
      if (!active) return;
      setProfileReady(true);
      setError("無法讀取使用者資料，請重新整理後再試。");
    });
    void user.getIdTokenResult().then(async ({ claims }) => {
      if (!active) return;
      await runTransaction(profileRef, (current) => ({
        ...current,
        email: user.email || "",
        displayName: typeof claims.name === "string" ? claims.name : "同事",
        photoURL: typeof claims.picture === "string" ? claims.picture : "",
        role: adminEmails.includes(user.email?.toLowerCase() || "") ? "admin" : current?.role || "member",
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
  async function login() {
    setSigningIn(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(getFirebase().auth, provider);
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
    }
  }
  async function submitVote(draft: VoteDraft) {
    if (!user) throw new Error("請先使用 Google 登入。");
    if (!connected) throw new Error("目前連線中斷，請恢復連線後再送出。");
    if (!catalog || catalogStatus !== "ready")
      throw new Error("方案尚未準備好，請稍後再試。");
    if (!isVotingOpen(catalog, Date.now() + offset))
      throw new Error("投票已截止，這次變更沒有送出。");
    const plan = catalog.plans[draft.planId];
    if (!plan?.active) throw new Error("這個方案已停止接受投票，請重新選擇。");
    if (draft.note.length > 1000) throw new Error("備註請控制在 1000 字以內。");
    const preferences = cleanPreferences(plan, draft.preferences);
    const token = await user.getIdTokenResult();
    const publicVote = {
      planId: draft.planId,
      displayName:
        typeof token.claims.name === "string" ? token.claims.name : "同事",
      photoURL:
        typeof token.claims.picture === "string" ? token.claims.picture : "",
      updatedAt: serverTimestamp(),
    };
    const details = {
      planId: draft.planId,
      preferences,
      note: draft.note.trim(),
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
  async function saveCatalog(next: Catalog, version: number | null) {
    if (!isAdmin) throw new Error("只有主辦人可以管理方案。");
    if (!connected) throw new Error("連線中斷，尚未儲存。");
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
    </OutingContext.Provider>
  );
}
