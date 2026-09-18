import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/duel/audio";

export function OpponentOutBanner({ opponentName, opponentScore, playerScore, outAfterMs, wagerEur, label = "points" }: {
  opponentName: string; opponentScore: number; playerScore: number; outAfterMs: number; wagerEur: number; label?: string;
}) {
  const [out, setOut] = useState(false);
  const announced = useRef(false);
  useEffect(() => {
    setOut(false); announced.current = false;
    const timer = window.setTimeout(() => setOut(true), Math.max(500, outAfterMs));
    return () => window.clearTimeout(timer);
  }, [outAfterMs, opponentName]);
  const secured = out && playerScore > opponentScore;
  useEffect(() => {
    if (secured && !announced.current) { announced.current = true; sfx.secured(); }
  }, [secured]);
  if (!out) return null;
  const needed = Math.max(0, opponentScore - playerScore + 1);
  const winnings = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(wagerEur * 1.9);
  return <div className="pointer-events-none absolute inset-x-3 top-3 z-30 rounded-xl border border-primary/40 bg-background/90 px-3 py-2 text-center shadow-lg backdrop-blur-sm">
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{opponentName} is out · {opponentScore} {label}</p>
    {secured ? <p className="mt-0.5 text-xs text-foreground">BET SECURED ✓ · WIN <strong className="text-sm font-black text-primary">{winnings}</strong> · Keep playing</p>
      : <p className="mt-0.5 text-xs font-semibold text-foreground">{needed} {label} {needed === 1 ? "is" : "are"} all you need to secure the bet</p>}
  </div>;
}
