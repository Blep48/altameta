import { createFileRoute } from "@tanstack/react-router";
import { Screen, TopBar } from "@/components/duel/Screen";
import { useEffect, useState } from "react";
import type { LeaderboardEntry } from "@/lib/duel/types";
import { fetchLeaderboard } from "@/lib/duel/leaderboard";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Global leaderboard — DUEL" },
      {
        name: "description",
        content: "The top DUEL duelists by rating. See where you rank.",
      },
      { property: "og:title", content: "Global leaderboard — DUEL" },
      {
        property: "og:description",
        content: "The top DUEL duelists by rating.",
      },
    ],
  }),
  component: Leaderboard,
});

function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    void fetchLeaderboard()
      .then((rows) => {
        if (live) setEntries(rows);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  const myRank = entries.findIndex((e) => e.isPlayer) + 1;

  return (
    <Screen>
      <TopBar title="LEADERBOARD" back="/" />
      <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {error ||
          (myRank
            ? `You are #${myRank} in the top ${entries.length}`
            : "Top 100 · server-verified results")}
      </p>

      <ul className="mt-5 space-y-2">
        {entries.map((e, i) => (
          <li
            key={e.id}
            className={`grid grid-cols-[2rem_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3 py-3 ${
              e.isPlayer
                ? "border-primary bg-primary/10 neon-glow"
                : "border-border bg-card"
            }`}
          >
            <span
              className={`text-center font-display text-sm font-bold tabular-nums ${
                i < 3 ? "text-gold" : "text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span className="text-xl">{e.avatar}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {e.username}
                {e.isPlayer && (
                  <span className="ml-2 text-[10px] text-primary">YOU</span>
                )}
              </span>
              <span className="block text-[11px] text-muted-foreground tabular-nums">
                {e.wins} wins
              </span>
            </span>
            <span className="shrink-0 font-display text-sm font-bold tabular-nums text-primary">
              {e.rating}
            </span>
          </li>
        ))}
      </ul>
    </Screen>
  );
}
