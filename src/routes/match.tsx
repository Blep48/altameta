import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Screen } from "@/components/duel/Screen";
import { useDuel } from "@/lib/duel/provider";
import { sfx } from "@/lib/duel/audio";
import type { ActiveMatch } from "@/lib/duel/types";

export const Route = createFileRoute("/match")({
  validateSearch: (search: Record<string, unknown>) => ({
    game: typeof search["game"] === "string" ? (search["game"] as string) : "reaction",
  }),
  head: () => ({
    meta: [
      { title: "Searching for an opponent — DUEL" },
      { name: "description", content: "Matchmaking in progress. Finding a DUEL opponent near your rating." },
      { property: "og:title", content: "Searching for an opponent — DUEL" },
      { property: "og:description", content: "Finding a DUEL opponent near your rating." },
    ],
  }),
  component: Matchmaking,
});

function Matchmaking() {
  const { game } = Route.useSearch();
  const navigate = useNavigate();
  const { profile, findMatch, cancelMatch } = useDuel();
  const [found, setFound] = useState<ActiveMatch | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const beeps = setInterval(() => sfx.search(), 700);
    if (started.current) return () => clearInterval(beeps);
    started.current = true;

    findMatch(game)
      .then((match) => {
        setFound(match);
        sfx.go();
        setTimeout(
          () =>
            navigate({
              to:
                game === "rhythm"
                  ? "/play/rhythm"
                  : game === "precision"
                    ? "/play/precision"
                    : "/play/reaction",
            }),
          1600,
        );
      })
      .catch(() => navigate({ to: "/" }));

    return () => clearInterval(beeps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abort = () => {
    cancelMatch();
    navigate({ to: "/" });
  };

  return (
    <Screen className="items-center justify-center px-6 pb-10 pt-6">
      {!found ? (
        <div className="flex flex-col items-center">
          <div className="relative grid h-56 w-56 place-items-center">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="absolute h-24 w-24 rounded-full border-2 border-primary animate-pulse-ring"
                style={{ animationDelay: `${i * 0.66}s` }}
              />
            ))}
            <span className="relative grid h-24 w-24 place-items-center rounded-full border border-border bg-card text-4xl">
              {profile.avatar}
            </span>
          </div>
          <h1 className="mt-8 font-display text-xl font-bold tracking-[0.25em] text-foreground">
            SEARCHING…
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Finding an opponent near {profile.rating} MMR</p>
          <button
            type="button"
            onClick={abort}
            className="mt-10 rounded-xl border border-border px-6 py-3 text-sm font-semibold text-muted-foreground"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="w-full animate-pop">
          <p className="text-center font-display text-sm tracking-[0.3em] text-primary">
            OPPONENT FOUND
          </p>
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Fighter avatar={profile.avatar} name={profile.username} rating={profile.rating} />
            <span className="font-display text-2xl font-bold text-accent">VS</span>
            <Fighter
              avatar={found.opponent.avatar}
              name={found.opponent.username}
              rating={found.opponent.rating}
            />
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">Loading arena…</p>
        </div>
      )}
    </Screen>
  );
}

function Fighter({ avatar, name, rating }: { avatar: string; name: string; rating: number }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card px-3 py-5 text-center">
      <span className="text-4xl">{avatar}</span>
      <span className="mt-2 block truncate text-sm font-semibold">{name}</span>
      <span className="block text-xs tabular-nums text-muted-foreground">{rating} MMR</span>
    </div>
  );
}
