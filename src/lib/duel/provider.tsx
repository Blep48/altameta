import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { arenaCall, onArenaView, type ArenaView } from "./arena-client";
import { newAccount } from "./ledger";
import { createDefaultProfile } from "./player";
import { storage, STORAGE_KEYS } from "./storage";
import { setMuted as setAudioMuted } from "./audio";
import { WAGER_OPTIONS_EUR } from "./economy";
import type { PlayerProfile } from "./types";
import { setFriendSession } from "./friend-challenges";

function useDuelState() {
  const [view, setView] = useState<ArenaView | null>(null),
    [error, setError] = useState("");
  const current = useRef(view),
    busy = useRef(false);
  const [empty] = useState(() => newAccount(createDefaultProfile()));
  const [wagerEur, setWager] = useState(1),
    wager = useRef(1);
  const [muted, setMuted] = useState(false);
  const refresh = useCallback(async () => {
    const result = await arenaCall("account");
    setError("");
    return result;
  }, []);
  useEffect(() => {
    let live = true;
    const off = onArenaView((v) => {
      if (
        live &&
        (!current.current || v.revision >= current.current.revision)
      ) {
        current.current = v;
        for (const session of v.sessions ?? []) setFriendSession(session);
        setView(v);
        setError("");
      }
    });
    void refresh().catch((e) => {
      if (live) setError(e.message);
    });
    const m = storage.read<boolean>(STORAGE_KEYS.muted) ?? false;
    setMuted(m);
    setAudioMuted(m);
    const online = () => {
      void refresh().catch((e) => {
        if (live) setError(e.message);
      });
    };
    window.addEventListener("online", online);
    window.addEventListener("focus", online);
    const poll = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !window.location.pathname.startsWith("/play/")
      )
        online();
    }, 15000);
    return () => {
      live = false;
      off();
      window.removeEventListener("online", online);
      window.removeEventListener("focus", online);
      clearInterval(poll);
    };
  }, [refresh]);
  const perform = useCallback(
    async (action: string, fields: Record<string, unknown> = {}) => {
      try {
        return await arenaCall(action, fields);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Server unavailable");
        throw e;
      }
    },
    [],
  );
  const start = useCallback(
    async (gameId: string, mode: string, code?: string) => {
      if (busy.current) throw new Error("A request is already in progress");
      busy.current = true;
      try {
        const result = await perform("start", {
          gameId,
          mode,
          wagerEur: wager.current,
          ...(code ? { code } : {}),
        });
        if (!result.activeMatch) throw new Error("Match unavailable");
        return result.activeMatch;
      } finally {
        busy.current = false;
      }
    },
    [perform],
  );
  const findMatch = useCallback((g: string) => start(g, "duel"), [start]);
  const startLadder = useCallback((g: string) => start(g, "ladder"), [start]);
  const continueLadder = useCallback(() => {
    const l = current.current?.account.ladder;
    if (!l?.active) return Promise.reject(new Error("No active ladder"));
    return start(l.gameId, "ladder");
  }, [start]);
  const startFriendMatch = useCallback(
    (args: { gameId: string; code: string; [key: string]: unknown }) =>
      start(args.gameId, "friend", args.code),
    [start],
  );
  const leaveGame = useCallback(() => {
    const match = current.current?.activeMatch;
    if (!match) return;
    void perform("leave", {
      matchId: match.id,
      ...(match.friend ? { code: match.friend.code } : {}),
    }).catch(() => {});
  }, [perform]);
  const updateProfile = useCallback(
    (patch: Partial<Pick<PlayerProfile, "username" | "avatar" | "coins">>) => {
      if (patch.avatar)
        void perform("avatar", { avatar: patch.avatar }).catch(() => {});
    },
    [perform],
  );
  const cashOutLadder = useCallback(() => perform("cashout"), [perform]);
  const withdrawDemoBalance = useCallback(
    (amountUnits: number) => perform("withdraw", { amountUnits }),
    [perform],
  );
  const setWagerEur = useCallback((n: number) => {
    if ((WAGER_OPTIONS_EUR as readonly number[]).includes(n)) {
      wager.current = n;
      setWager(n);
    }
  }, []);
  const toggleMuted = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
    storage.write(STORAGE_KEYS.muted, next);
  };
  const account = view?.account ?? empty;
  return {
    ready: !!view,
    error,
    refresh,
    profile: account.profile,
    history: account.history,
    ladder: account.ladder,
    activeMatch: view?.activeMatch ?? null,
    lastOutcome: view?.lastOutcome ?? null,
    muted,
    toggleMuted,
    updateProfile,
    findMatch,
    startLadder,
    continueLadder,
    startFriendMatch,
    cashOutLadder,
    withdrawDemoBalance,
    leaveGame,
    cancelMatch: leaveGame,
    wagerEur: view?.activeMatch?.wagerEur ?? wagerEur,
    setWagerEur,
    canPlay: !!view && account.profile.coins >= wagerEur * 100,
  };
}
const DuelContext = createContext<ReturnType<typeof useDuelState> | null>(null);
export function DuelProvider({ children }: { children: ReactNode }) {
  const value = useDuelState();
  if (value.error && !value.ready)
    return (
      <main className="p-8 text-center">
        <p role="alert">{value.error}</p>
        <button onClick={() => void value.refresh().catch(() => {})}>
          Retry connection
        </button>
      </main>
    );
  return (
    <DuelContext.Provider value={value}>
      {value.error && (
        <div
          role="alert"
          className="fixed bottom-0 z-50 bg-destructive p-3 text-sm"
        >
          {value.error}
        </div>
      )}
      {children}
    </DuelContext.Provider>
  );
}
export function useDuel() {
  const value = useContext(DuelContext);
  if (!value) throw new Error("useDuel must be used inside DuelProvider");
  return value;
}
