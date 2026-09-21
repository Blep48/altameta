import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { register, supabase, usernameEmail } from "@/lib/account/client";
import { bindAccount, SaveQueue, type SavedData } from "@/lib/account/store";
import { clearPendingScores } from "@/lib/duel/pending-score";
import { stopMusic } from "@/lib/duel/audio";

const Context = createContext<{
  username: string;
  logout: () => Promise<void>;
} | null>(null);
export const useAccount = () => useContext(Context);
const cacheKey = (id: string) => `altameta:cloud:${id}`;

export function AccountGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState(0);
  const [boundId, setBoundId] = useState<string | null>(null);
  const queue = useRef<SaveQueue | null>(null);
  const currentId = useRef<string | null>(null);
  const saveNow = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let live = true;
    void supabase.auth.getSession().then(({ data, error: authError }) => {
      if (!live) return;
      if (authError) setError(authError.message);
      setUser(data.session?.user ?? null);
      setLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (live) {
        setUser(session?.user ?? null);
        setLoaded(true);
      }
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let data: SavedData = {};
    const id = user?.id ?? null;
    currentId.current = id;
    setStatus("loading");
    setBoundId(null);
    setError("");
    bindAccount(null);
    clearPendingScores();
    queue.current = null;
    if (!id) {
      setStatus("signed-out");
      return;
    }
    const persist = () => {
      if (!queue.current) return;
      localStorage.setItem(
        cacheKey(id),
        JSON.stringify({
          data,
          revision: queue.current.revision,
          pending: queue.current.dirty,
        }),
      );
    };
    const flush = async () => {
      if (!live || !queue.current) return;
      setStatus("saving");
      try {
        await queue.current.flush();
        if (!live) return;
        persist();
        setStatus("saved");
        setError("");
      } catch (e) {
        if (!live) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "Unable to save progress");
        throw e;
      }
    };
    saveNow.current = flush;
    void (async () => {
      const { data: row, error: readError } = await supabase
        .from("demo_accounts")
        .select("state,revision,username")
        .eq("user_id", id)
        .single();
      if (readError) throw readError;
      if (!live) return;
      const cached = JSON.parse(localStorage.getItem(cacheKey(id)) || "null");
      if (cached?.pending && cached.revision !== row.revision)
        throw new Error(
          "Progress changed on another device. Reload the cloud save to continue.",
        );
      data = cached?.pending ? cached.data : row.state;
      const q = new SaveQueue(row.revision, async (state, revision) => {
        const { data: auth } = await supabase.auth.getSession();
        if (!live || auth.session?.user.id !== id)
          throw new Error("Account changed. Sign in again before saving.");
        const { data: rows, error: saveError } = await supabase
          .rpc("save_demo_account", {
            expected_revision: revision,
            next_state: state,
          })
          .setHeader("Authorization", `Bearer ${auth.session.access_token}`);
        if (saveError) throw saveError;
        if (!rows?.length)
          throw new Error(
            "Progress changed on another device. Reload the cloud save to continue.",
          );
        return rows[0].revision as number;
      });
      queue.current = q;
      bindAccount({
        id,
        username: row.username,
        data,
        changed: () => {
          if (!live || currentId.current !== id) return;
          q.enqueue(data);
          try {
            persist();
          } catch {
            /* Server save still proceeds if local quota is full. */
          }
          setStatus("saving");
          clearTimeout(timer);
          timer = setTimeout(() => {
            void flush().catch(() => {});
          }, 150);
        },
      });
      setBoundId(id);
      if (cached?.pending) {
        q.enqueue(data);
        await flush();
      }
      if (live) {
        setBoundId(id);
        setStatus("saved");
      }
    })().catch((e) => {
      if (live) {
        setError(e.message || "Unable to load account");
        setStatus("error");
      }
    });
    const online = () => {
      if (queue.current?.dirty) void flush().catch(() => {});
    };
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (queue.current?.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      live = false;
      clearTimeout(timer);
      bindAccount(null);
      clearPendingScores();
      stopMusic();
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [loaded, user?.id, generation]);

  const logout = async () => {
    try {
      await saveNow.current();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign out");
      setStatus("error");
    }
  };
  if (!loaded || status === "loading")
    return (
      <main className="grid min-h-dvh place-items-center bg-background text-primary">
        Loading account…
      </main>
    );
  if (!user) return <LoginForm />;
  const errorPanel =
    status === "error" ? (
      <main className="fixed inset-0 z-[100] mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 bg-background p-6">
        <h1 className="font-display text-2xl font-bold">Progress not synced</h1>
        <p role="alert">{error}</p>
        <button
          className="rounded-xl bg-primary p-3 text-primary-foreground"
          onClick={() =>
            queue.current
              ? void saveNow.current().catch(() => {})
              : setGeneration((x) => x + 1)
          }
        >
          Retry
        </button>
        <button
          className="rounded-xl border border-border p-3"
          onClick={() => {
            if (
              confirm(
                "Discard unsynced changes on this device and load the saved cloud progress?",
              )
            ) {
              localStorage.removeItem(cacheKey(user.id));
              setGeneration((x) => x + 1);
            }
          }}
        >
          Reload cloud save
        </button>
      </main>
    ) : null;
  return (
    <Context.Provider
      value={{ username: user.email?.split("@")[0] ?? "", logout }}
    >
      <div
        className="fixed right-2 top-1 z-50 rounded bg-background/90 px-2 text-[10px] text-muted-foreground"
        role="status"
      >
        {status === "saving" ? "Saving…" : "Saved to account"}
      </div>
      {errorPanel}
      {boundId === user.id && (
        <div key={`${user.id}:${generation}`}>{children}</div>
      )}
    </Context.Provider>
  );
}

function LoginForm() {
  const [signup, setSignup] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <h1 className="font-display text-4xl font-bold tracking-widest text-primary">
        ALTAMETA
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Your balance, scores and challenges. On every device.
      </p>
      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            if (signup) await register(username.trim(), password);
            const { error } = await supabase.auth.signInWithPassword({
              email: usernameEmail(username),
              password,
            });
            if (error)
              throw new Error(
                "Incorrect username or password. Please try again.",
              );
            setPassword("");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to sign in");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-sm">
          Username
          <input
            required
            pattern="[A-Za-z0-9_]{3,20}"
            minLength={3}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-card p-3"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          3–20 letters, numbers or underscores. Case-insensitive.
        </p>
        <label className="block text-sm">
          Password
          <input
            required
            type="password"
            minLength={8}
            maxLength={72}
            autoComplete={signup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-card p-3"
          />
        </label>
        {signup && (
          <p className="text-xs text-muted-foreground">
            At least 8 characters. No email needed. Keep your password: recovery
            is not available in this demo. New accounts start with €100 demo
            credit.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="w-full rounded-xl bg-primary p-4 font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Please wait…" : signup ? "CREATE ACCOUNT" : "LOG IN"}
        </button>
        <button
          type="button"
          disabled={busy}
          className="w-full p-2 text-sm text-muted-foreground"
          onClick={() => {
            setSignup(!signup);
            setError("");
          }}
        >
          {signup ? "Already registered? Log in" : "New here? Create account"}
        </button>
      </form>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Demo only · No real money
      </p>
    </main>
  );
}
