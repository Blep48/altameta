import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/duel/audio";
import { useDuel } from "@/lib/duel/provider";
import { ladderPrizeUnits } from "@/lib/duel/ladder";
import { settlementAmount } from "@/lib/duel/economy";

export function OpponentOutBanner({
  opponentName,
  opponentScore,
  playerScore,
  outAfterMs,
  wagerEur,
  securedEur,
  label = "points",
}: {
  opponentName: string;
  opponentScore: number;
  playerScore: number;
  outAfterMs: number;
  wagerEur: number;
  securedEur?: number | undefined;
  label?: string | undefined;
}) {
  const { activeMatch, ladder } = useDuel();
  const [out, setOut] = useState(false);
  const announced = useRef(false);
  useEffect(() => {
    setOut(false);
    announced.current = false;
    const timer = window.setTimeout(
      () => setOut(true),
      Math.max(500, outAfterMs),
    );
    return () => window.clearTimeout(timer);
  }, [outAfterMs, opponentName]);
  const secured = out && playerScore > opponentScore;
  useEffect(() => {
    if (secured && !announced.current) {
      announced.current = true;
      sfx.secured();
    }
  }, [secured]);
  if (!out || activeMatch?.mode === "friend") return null;
  const needed = Math.max(0, opponentScore - playerScore + 1);
  const total =
    activeMatch?.mode === "ladder" && ladder?.active
      ? ladderPrizeUnits({ ...ladder, streak: ladder.streak + 1 })
      : settlementAmount(true, wagerEur);
  const winnings = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(total / 100);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.45rem,env(safe-area-inset-top))] z-50 mx-auto w-fit max-w-[calc(100vw-1rem)] rounded-full border border-primary/35 bg-background/92 px-3 py-1.5 text-center shadow-lg backdrop-blur-md animate-pop">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-primary">
        {opponentName} OUT · {opponentScore} {label}
      </p>
      {secured ? (
        <p className="text-[11px] leading-tight text-foreground">
          SECURED ✓ ·{" "}
          <strong className="font-black text-primary">{winnings}</strong> · KEEP
          PLAYING
        </p>
      ) : (
        <p className="text-[11px] font-semibold leading-tight text-foreground">
          {needed} MORE TO SECURE
        </p>
      )}
    </div>
  );
}
