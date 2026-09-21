import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { startMusic } from "@/lib/duel/audio";
import { Screen, StatTile } from "@/components/duel/Screen";
import { useDuel } from "@/lib/duel/provider";
import { formatEuro } from "@/lib/duel/economy";
import { winRate } from "@/lib/duel/player";
import { leagueForIndex, peakLeagueIndex } from "@/lib/duel/leagues";
import { ladderPrizeUnits } from "@/lib/duel/ladder";
import {
  getFriendSessions,
  isSessionCurrent,
  refreshFriendExpirations,
} from "@/lib/duel/friend-challenges";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ALTAMETA — 1v1 Arcade Duels for Demo Balance" },
      {
        name: "description",
        content:
          "Challenge opponents in lightning-fast 1v1 reaction duels. Stake Demo Balance, climb the rating ladder. Play money only.",
      },
      { property: "og:title", content: "ALTAMETA — 1v1 Arcade Duels" },
      {
        property: "og:description",
        content:
          "Lightning-fast 1v1 reaction duels with play-money Demo Balance.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  useEffect(() => startMusic("menu"), []);
  const {
    ready,
    profile,
    history,
    muted,
    toggleMuted,
    canPlay,
    updateProfile,
    ladder,
    cashOutLadder,
    leaveGame,
  } = useDuel();
  const [sessions, setSessions] = useState<string[]>([]);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    leaveGame();
    const update = () => {
      if (live)
        setSessions(
          Object.values(getFriendSessions())
            .filter((s) => isSessionCurrent(s))
            .map((s) => s.code),
        );
    };
    update();
    void refreshFriendExpirations().then(update);
    const timer = setInterval(update, 1000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [ready, leaveGame]);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("50");
  const [paymentToast, setPaymentToast] = useState<number | null>(null);
  const fakeWithdraw = () => {
    const amount = Math.max(
      0,
      Math.min(Number(withdrawAmount) || 0, profile.coins / 100),
    );
    if (!amount) return;
    updateProfile({ coins: profile.coins - Math.round(amount * 100) });
    setWithdrawOpen(false);
    setPaymentToast(amount);
    window.setTimeout(() => setPaymentToast(null), 4200);
  };

  return (
    <Screen>
      {paymentToast != null && (
        <div className="fixed left-1/2 top-[max(12px,env(safe-area-inset-top))] z-50 w-[calc(100%-24px)] max-w-md -translate-x-1/2 animate-pop rounded-[1.35rem] border border-white/10 bg-[#25252b]/95 px-4 py-3 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-display text-sm font-black text-black">
              A
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">ALTAMETA DUELS</p>
              <p className="mt-0.5 text-sm">
                Payment received · {formatEuro(Math.round(paymentToast * 100))}
              </p>
            </div>
            <span className="self-start text-[10px] text-white/60">now</span>
          </div>
        </div>
      )}
      {withdrawOpen && (
        <div className="fixed inset-0 z-40 grid place-items-end bg-black/65 p-4 sm:place-items-center">
          <div className="w-full max-w-md rounded-[2rem] border border-border bg-card p-5">
            <p className="font-display text-xl font-black tracking-[.18em]">
              WITHDRAW
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose an amount from your Altameta balance.
            </p>
            <div className="mt-5 flex items-center rounded-2xl border border-border bg-background px-4">
              <span className="text-2xl text-primary">€</span>
              <input
                inputMode="decimal"
                value={withdrawAmount}
                onChange={(e) =>
                  setWithdrawAmount(
                    e.target.value.replace(/[^0-9.,]/g, "").replace(",", "."),
                  )
                }
                className="w-full bg-transparent px-3 py-5 font-display text-3xl font-black text-primary outline-none"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Available {formatEuro(profile.coins)}
            </p>
            <button
              type="button"
              onClick={fakeWithdraw}
              className="mt-5 w-full rounded-2xl bg-primary py-4 font-display font-black tracking-[.18em] text-primary-foreground"
            >
              WITHDRAW
            </button>
            <button
              type="button"
              onClick={() => setWithdrawOpen(false)}
              className="mt-2 w-full rounded-2xl border border-border py-3 text-xs font-bold tracking-[.18em]"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[2.05rem] font-bold tracking-[0.18em] text-primary text-glow">
            ALTAMETA
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            1v1 arcade · play money
          </p>
        </div>
        <button
          type="button"
          onClick={toggleMuted}
          aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-lg"
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </header>

      <section className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 neon-glow">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Demo Balance
          </p>
          <p className="font-display text-3xl font-bold tabular-nums text-primary">
            {formatEuro(profile.coins)}
          </p>
        </div>
        <Link
          to="/profile"
          className="flex shrink-0 items-center gap-3 rounded-xl bg-secondary px-3 py-2"
        >
          <span className="text-2xl">{profile.avatar}</span>
          <span className="min-w-0">
            <span className="block max-w-[7rem] truncate text-sm font-semibold">
              {profile.username}
            </span>
            <span className="block text-xs text-muted-foreground tabular-nums">
              {leagueForIndex(
                peakLeagueIndex(profile.rating, profile.peakLeagueIndex),
              )}{" "}
              · {profile.rating} MMR
            </span>
          </span>
        </Link>
      </section>

      <button
        type="button"
        onClick={() => {
          setWithdrawAmount(
            String(Math.min(50, Math.floor(profile.coins / 100))),
          );
          setWithdrawOpen(true);
        }}
        className="mt-3 w-full rounded-2xl border border-primary/60 bg-primary/10 py-3 font-display text-xs font-bold tracking-[.2em] text-primary"
      >
        WITHDRAW
      </button>

      <Link
        to="/games"
        className="mt-6 grid place-items-center rounded-3xl bg-primary py-8 font-display text-3xl font-bold tracking-[0.35em] text-primary-foreground transition-transform duration-150 active:scale-[0.97] neon-glow aria-disabled:opacity-40"
        aria-disabled={!canPlay}
      >
        PLAY
        <span className="mt-1 text-[11px] font-semibold tracking-[0.2em] opacity-80">
          CHOOSE YOUR STAKE
        </span>
      </Link>
      {!canPlay && (
        <p className="mt-3 text-center text-xs text-destructive">
          Not enough balance for the selected stake — reset your demo progress
          in Profile.
        </p>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3">
        {ladder?.active && (
          <div className="col-span-2 rounded-2xl border border-primary p-4">
            <p>
              LADDER · {ladder.streak} wins ·{" "}
              {formatEuro(ladderPrizeUnits(ladder))}
            </p>
            <Link
              to="/match"
              search={{ game: ladder.gameId, friend: "", ladder: "continue" }}
              className="mt-2 block text-primary"
            >
              RESUME LADDER
            </Link>
            {ladder.streak > 0 && (
              <button
                onClick={() => void cashOutLadder().catch(() => {})}
                className="mt-3 text-primary"
              >
                CASH OUT
              </button>
            )}
          </div>
        )}
        {sessions.length > 0 && (
          <div className="col-span-2 rounded-2xl border border-border p-4">
            <p>YOUR FRIEND CHALLENGES</p>
            {sessions.map((code) => (
              <Link
                key={code}
                to="/challenge/$code"
                params={{ code }}
                className="mt-2 block text-primary"
              >
                {code}
              </Link>
            ))}
          </div>
        )}
        <StatTile label="Rating" value={profile.rating} accent="primary" />
        <StatTile
          label="Win rate"
          value={`${winRate(profile)}%`}
          accent="accent"
        />
        <StatTile label="Matches" value={profile.gamesPlayed} />
        <StatTile
          label="Best reaction"
          value={profile.bestReactionMs ? `${profile.bestReactionMs} ms` : "—"}
        />
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <Link
          to="/leaderboard"
          className="rounded-2xl border border-border bg-card px-4 py-4 text-center font-display text-sm font-bold tracking-[0.2em]"
        >
          🏆 RANKS
        </Link>
        <Link
          to="/profile"
          className="rounded-2xl border border-border bg-card px-4 py-4 text-center font-display text-sm font-bold tracking-[0.2em]"
        >
          👤 PROFILE
        </Link>
      </section>

      <section className="mt-7">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Recent matches
        </h2>
        <ul className="mt-3 space-y-2">
          {history.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No duels yet. Hit PLAY to start your record.
            </li>
          )}
          {history.slice(0, 5).map((m) => (
            <li
              key={m.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
            >
              <span className="text-xl">{m.opponentAvatar}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {m.opponentName}
                </span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {m.gameId === "reaction"
                    ? `${m.playerAvgMs} ms vs ${m.opponentAvgMs} ms`
                    : `${m.playerAvgMs} vs ${m.opponentAvgMs}`}
                  {m.friendChallengeCode ? " · FRIEND" : ""}
                  {m.ladderStreak != null
                    ? ` · ∞ LADDER ${m.ladderStreak}`
                    : ""}
                </span>
              </span>
              <span
                className={`shrink-0 text-right font-display text-sm font-bold tabular-nums ${
                  m.tied
                    ? "text-accent"
                    : m.won
                      ? "text-primary"
                      : "text-destructive"
                }`}
              >
                {m.tied ? "TIE" : m.won ? "WIN" : "LOSS"}
                <span className="block text-[11px] font-medium">
                  {m.ladderStreak != null && m.won
                    ? `CASH ${formatEuro(m.ladderPrizeUnits ?? 0)}`
                    : formatEuro(m.coinDelta, true)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </Screen>
  );
}
