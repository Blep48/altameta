import { useEffect, useState } from "react";

export function OpponentOutBanner({ opponentName, opponentScore, playerScore, outAfterMs, label = "points" }: {
  opponentName: string; opponentScore: number; playerScore: number; outAfterMs: number; label?: string;
}) {
  const [out, setOut] = useState(false);
  useEffect(() => {
    setOut(false);
    const timer = window.setTimeout(() => setOut(true), Math.max(500, outAfterMs));
    return () => window.clearTimeout(timer);
  }, [outAfterMs, opponentName]);
  if (!out) return null;
  const secured = playerScore > opponentScore;
  const needed = Math.max(0, opponentScore - playerScore + 1);
  return <div className="pointer-events-none absolute inset-x-3 top-3 z-30 rounded-xl border border-primary/40 bg-background/90 px-3 py-2 text-center shadow-lg backdrop-blur-sm">
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{opponentName} is out · {opponentScore} {label}</p>
    <p className="mt-0.5 text-xs font-semibold text-foreground">{secured ? "BET SECURED ✓ · Keep playing for your high score" : `${needed} ${label} ${needed === 1 ? "is" : "are"} all you need to secure the bet`}</p>
  </div>;
}
