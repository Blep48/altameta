import { useEffect, useRef } from "react";
import { sfx } from "@/lib/duel/audio";
import { formatEuro } from "@/lib/duel/economy";
import { SCORE_UNITS } from "@/lib/duel/arena-presentation";
import type { ArenaView } from "@/lib/duel/arena-client";

export function OpponentOutBanner({
  opponentName,
  progress,
  game,
}: {
  opponentName: string;
  progress: ArenaView["opponent"];
  game: string;
}) {
  const announced = useRef(false);
  useEffect(() => {
    if (progress?.ahead && !announced.current) {
      announced.current = true;
      sfx.secured();
    }
  }, [progress?.ahead]);
  if (!progress) return <div aria-hidden="true" className="h-12 shrink-0" />;
  return (
    <aside
      aria-label="Opponent result"
      className="pointer-events-none h-12 shrink-0 border-y border-primary/30 bg-primary/10 px-3 py-1.5 text-center"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
        {opponentName} {progress.forfeited ? "FORFEITED" : "OUT"} ·{" "}
        {progress.score} {SCORE_UNITS[game]}
      </p>
      <p className="text-[11px]">
        {progress.ahead ? (
          <>
            AHEAD ✓{" "}
            {progress.prizeUnits > 0 && (
              <>
                · Prize{" "}
                <strong className="text-primary">
                  {formatEuro(progress.prizeUnits)}
                </strong>
              </>
            )}{" "}
            · FINISH THE RUN
          </>
        ) : progress.needed != null ? (
          <>{progress.needed} MORE TO TAKE THE LEAD</>
        ) : (
          <>BEAT {progress.score} ms AVERAGE</>
        )}
      </p>
    </aside>
  );
}
