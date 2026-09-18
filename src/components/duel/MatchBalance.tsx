import { formatEuro } from "@/lib/duel/economy";

export function MatchBalance({ coins, wagerEur }: { coins: number; wagerEur: number }) {
  return (
    <div className="mx-5 mt-3 flex items-center justify-between rounded-xl border border-border bg-card/90 px-3 py-2 text-[11px]">
      <span className="font-semibold uppercase tracking-[0.16em] text-muted-foreground">Balance</span>
      <span className="font-display font-bold tabular-nums text-primary">
        {formatEuro(coins)}
        <span className="ml-2 text-[9px] font-medium text-muted-foreground">stake €{wagerEur}</span>
      </span>
    </div>
  );
}
