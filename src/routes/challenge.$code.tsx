import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Screen, TopBar } from "@/components/duel/Screen";
import { useDuel } from "@/lib/duel/provider";
import {
  getFriendChallenge,
  joinFriendChallenge,
  getFriendSession,
  setFriendSession,
  type FriendChallenge,
} from "@/lib/duel/friend-challenges";
import { getPendingScore, retryPendingScore } from "@/lib/duel/pending-score";
import { MINIGAMES } from "@/lib/duel/games";
export const Route = createFileRoute("/challenge/$code")({
  component: Challenge,
});
function Challenge() {
  const { code } = Route.useParams(),
    {
      ready,
      profile,
      reserveFriendWager,
      settleFriendChallenge,
      releaseFriendWager,
      leaveGame,
    } = useDuel(),
    nav = useNavigate();
  const [c, setC] = useState<FriendChallenge | null>(null),
    [loading, setLoading] = useState(true),
    [err, setErr] = useState(""),
    [now, setNow] = useState(Date.now());
  const [retrying, setRetrying] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const acceptLock = useRef(false);
  useEffect(() => {
    if (ready) leaveGame();
  }, [ready, leaveGame]);
  const pending = getPendingScore(code);
  const retry = async () => {
    setRetrying(true);
    const ok = await retryPendingScore(code);
    setRetrying(false);
    if (ok) {
      setC(await getFriendChallenge(code));
      setErr("");
    } else setErr("Score saved. Check your connection and retry.");
  };
  useEffect(() => {
    let live = true;
    let busy = false;
    const load = () => {
      if (busy || document.hidden) return;
      busy = true;
      return getFriendChallenge(code)
        .then((x) => {
          if (live) {
            setC(x);
            setLoading(false);
          }
        })
        .catch(() => {
          if (live) {
            setErr("Challenge unavailable");
            setLoading(false);
          }
        })
        .finally(() => {
          busy = false;
        });
    };
    void load();
    const clock = setInterval(() => setNow(Date.now()), 1000),
      poll = setInterval(load, 3000);
    return () => {
      live = false;
      clearInterval(clock);
      clearInterval(poll);
    };
  }, [code]);
  useEffect(() => {
    const session = getFriendSession(code);
    if (
      ready &&
      c &&
      session?.code === code &&
      c.creator_score != null &&
      c.guest_score != null
    )
      settleFriendChallenge(c, session.role);
  }, [ready, c, code, settleFriendChallenge]);
  if (loading || !ready)
    return (
      <Screen>
        <TopBar title="FRIEND CHALLENGE" back="/" />
        <p className="mt-20 text-center text-muted-foreground">
          Loading challenge…
        </p>
      </Screen>
    );
  if (!c)
    return (
      <Screen>
        <TopBar title="FRIEND CHALLENGE" back="/" />
        <p className="mt-20 text-center text-destructive">
          {err || "Challenge not found or expired."}
        </p>
        {pending && (
          <button
            disabled={retrying}
            onClick={() => void retry().catch(() => setRetrying(false))}
          >
            Score saved · retry upload
          </button>
        )}
      </Screen>
    );
  const session = getFriendSession(code),
    mine = session?.code === code ? session : null,
    left = Math.max(0, new Date(c.expires_at).getTime() - now),
    expired = left <= 0,
    h = Math.floor(left / 3600000),
    m = Math.floor((left % 3600000) / 60000),
    s = Math.floor((left % 60000) / 1000),
    game = MINIGAMES.find((g) => g.id === c.game_id),
    both = c.creator_score != null && c.guest_score != null;
  let winner: "creator" | "guest" | "tie" | null = null;
  if (both) {
    winner =
      c.creator_score === c.guest_score
        ? "tie"
        : c.score_mode === "low"
          ? c.creator_score! < c.guest_score!
            ? "creator"
            : "guest"
          : c.creator_score! > c.guest_score!
            ? "creator"
            : "guest";
  }
  const myWon = winner && winner !== "tie" && mine?.role === winner;
  const accept = async () => {
    if (acceptLock.current) return;
    acceptLock.current = true;
    setAccepting(true);
    try {
      if (c.payment_mode === "demo" && profile.coins < c.wager_eur * 100) {
        setErr("Not enough demo balance for this challenge.");
        return;
      }
      if (c.payment_mode === "demo" && !reserveFriendWager(code, c.wager_eur))
        throw new Error("Not enough demo balance");
      const joined = await joinFriendChallenge(
        code,
        profile.username,
        profile.avatar,
      );
      setFriendSession({
        expiresAt: joined.challenge.expires_at,
        code,
        token: joined.token,
        role: "guest",
        seed: c.seed,
      });
      setC(joined.challenge);
      nav({
        to: "/match",
        search: { game: c.game_id, friend: code, ladder: "" },
      });
    } catch (error) {
      if (!getFriendSession(code)) releaseFriendWager(code);
      setErr(
        error instanceof Error ? error.message : "Unable to accept challenge",
      );
    } finally {
      acceptLock.current = false;
      setAccepting(false);
    }
  };
  const play = () =>
    nav({
      to: "/match",
      search: { game: c.game_id, friend: code, ladder: "" },
    });
  return (
    <Screen>
      <TopBar title="FRIEND CHALLENGE" back="/" />
      {pending && (
        <div role="status" className="rounded-xl border border-primary p-4">
          <p>Your score ({pending.score}) is saved on this device.</p>
          <button
            disabled={retrying}
            onClick={() =>
              void retry().catch(() => {
                setRetrying(false);
                setErr("Connection unavailable");
              })
            }
            className="mt-2 rounded bg-primary p-3 text-primary-foreground"
          >
            {retrying ? "SENDING…" : "RETRY SCORE UPLOAD"}
          </button>
        </div>
      )}
      <div className="mt-5 rounded-3xl border border-primary/40 bg-card p-5 text-center">
        <div className="text-5xl">{game?.icon ?? "🎮"}</div>
        <h1 className="mt-2 font-display text-2xl font-black tracking-[.18em]">
          {game?.name ?? c.game_id.toUpperCase()}
        </h1>
        <p className="mt-2 text-sm">
          <b>{c.creator_name}</b> vs{" "}
          <b>{c.guest_name || "waiting for friend…"}</b> · €{c.wager_eur}{" "}
          {c.payment_mode === "in_person" ? "IN PERSON" : "demo"}
        </p>
        <p className="mt-4 text-[10px] uppercase tracking-[.2em] text-muted-foreground">
          Challenge expires in
        </p>
        <p className="font-display text-2xl font-black tabular-nums text-primary">
          {expired
            ? "EXPIRED"
            : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Score
          name={c.creator_name}
          score={c.creator_score}
          mode={c.score_mode}
        />
        <Score
          name={c.guest_name || "FRIEND"}
          score={c.guest_score}
          mode={c.score_mode}
        />
      </div>
      {both && (
        <div className="mt-4 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-center">
          <p className="font-display text-xl font-black text-primary">
            {winner === "tie"
              ? "TIE"
              : myWon
                ? "YOU WIN ✓"
                : mine
                  ? "YOU LOSE"
                  : `${winner === "creator" ? c.creator_name : c.guest_name} WINS`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Final result · same seeded challenge
          </p>
        </div>
      )}
      {err && (
        <p className="mt-3 text-center text-xs text-destructive">{err}</p>
      )}
      {!expired &&
        !pending &&
        !both &&
        mine &&
        ((mine.role === "creator" && c.creator_score == null) ||
          (mine.role === "guest" && c.guest_score == null)) && (
          <button
            onClick={play}
            className="mt-5 w-full rounded-2xl bg-primary py-5 font-display text-lg font-black tracking-[.18em] text-primary-foreground"
          >
            PLAY YOUR RUN
          </button>
        )}
      {!expired && !mine && !c.guest_name && (
        <button
          disabled={accepting}
          onClick={accept}
          className="mt-5 w-full rounded-2xl bg-primary py-5 font-display text-lg font-black tracking-[.18em] text-primary-foreground"
        >
          ACCEPT & PLAY
        </button>
      )}
      {!expired && !mine && c.guest_name && (
        <p className="mt-5 text-center text-sm text-muted-foreground">
          This challenge has already been accepted.
        </p>
      )}
      {!both &&
        mine &&
        ((mine.role === "creator" && c.creator_score != null) ||
          (mine.role === "guest" && c.guest_score != null)) && (
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Your run is locked in. Waiting for the other player…
          </p>
        )}
      <Link
        to="/games"
        className="mt-5 block text-center text-xs text-muted-foreground"
      >
        Back to games
      </Link>
    </Screen>
  );
}
function Score({
  name,
  score,
  mode,
}: {
  name: string;
  score: number | null;
  mode: "high" | "low";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <p className="truncate text-xs font-bold">{name}</p>
      <p className="mt-2 font-display text-2xl font-black tabular-nums">
        {score == null ? "—" : score}
      </p>
      <p className="text-[9px] uppercase tracking-[.16em] text-muted-foreground">
        {score == null ? "not played" : mode === "low" ? "lower wins" : "score"}
      </p>
    </div>
  );
}
