import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Screen } from "@/components/duel/Screen";
import { useDuel } from "@/lib/duel/provider";
import { formatEuro } from "@/lib/duel/economy";
import { ladderEliminations, ladderMultiplier, ladderPrizeUnits } from "@/lib/duel/ladder";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [
      { title: "Match result — DUEL" },
      { name: "description", content: "See how your reaction times stacked up against your opponent." },
      { property: "og:title", content: "Match result — DUEL" },
      { property: "og:description", content: "Reaction duel results, coin and rating changes." },
    ],
  }),
  component: Result,
});

function ladderCelebrationName(streak: number): string {
  if (streak >= 6) return "ALTAMETA";
  if (streak >= 5) return "ULTRAMETA";
  if (streak >= 4) return "MEGAMETA";
  if (streak >= 3) return "SUPERMETA";
  if (streak >= 2) return "POGGAMETA";
  return "SIUMMAMETA";
}

function Result() {
  const { lastOutcome, profile, ready, canPlay, ladder, cashOutLadder } = useDuel();
  const navigate = useNavigate();
  const [animatedWin, setAnimatedWin] = useState(0);
  const [cashout, setCashout] = useState<{amount:number;streak:number;eliminations:number}|null>(null);
  const [animatedCashout, setAnimatedCashout] = useState(0);

  useEffect(() => {
    if (ready && !lastOutcome) navigate({ to: "/" });
  }, [ready, lastOutcome, navigate]);

  const won = lastOutcome?.won ?? false;
  const rhythm = lastOutcome?.rhythm;
  const precision = lastOutcome?.precision;
  const direction = lastOutcome?.direction;
  const monkey = lastOutcome?.monkey;
  const survival = lastOutcome?.survival;
  const ladderMatch = lastOutcome?.ladderStreak != null;
  const ladderShownPrize =
    lastOutcome && ladderMatch && won && ladder?.active && ladder.gameId === lastOutcome.gameId
      ? ladderPrizeUnits(ladder)
      : (lastOutcome?.ladderPrizeUnits ?? 0);

  useEffect(() => {
    if (!lastOutcome?.won) { setAnimatedWin(0); return; }
    const target = Math.max(0, ladderShownPrize || lastOutcome.coinDelta);
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const duration = ladderMatch
        ? Math.min(4200, Math.max(2200, 1700 + Math.log10(Math.max(10, target)) * 420))
        : Math.min(1800, Math.max(850, 700 + Math.log10(Math.max(10, target)) * 260));
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedWin(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [lastOutcome, ladderShownPrize]);

  useEffect(() => {
    if (!cashout) return;
    const started=performance.now(); let frame=0;
    const tick=(now:number)=>{const p=Math.min(1,(now-started)/1600);const eased=1-Math.pow(1-p,4);setAnimatedCashout(Math.round(cashout.amount*eased));if(p<1)frame=requestAnimationFrame(tick)};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[cashout]);

  if (!lastOutcome) return null;

  if(cashout) {
    const checkpoints=Array.from({length:Math.min(cashout.streak,12)},(_,i)=>cashout.streak-Math.min(cashout.streak,12)+i+1);
    const progress=cashout.amount ? Math.min(1,animatedCashout/cashout.amount) : 0;
    return <Screen className="justify-center">
      <div className="animate-pop rounded-[2rem] border border-primary bg-primary/10 px-5 py-7 text-center neon-glow">
        <p className="text-[11px] font-black uppercase tracking-[.32em] text-primary">∞ LADDER CASH OUT</p>
        <div className="mx-auto mt-6 flex h-64 max-w-xs items-stretch gap-4 text-left">
          <div className="relative w-5 shrink-0 rounded-full bg-secondary">
            <div className="absolute bottom-0 left-0 w-full rounded-full bg-primary transition-[height] duration-75" style={{height:`${progress*100}%`}}/>
            {checkpoints.map((streak,i)=><span key={streak} className="absolute left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border border-primary bg-background" style={{bottom:`${((i+1)/checkpoints.length)*100}%`,transform:"translate(-50%,50%)"}}/> )}
          </div>
          <div className="relative flex-1">
            {checkpoints.map((streak,i)=>{const reached=progress>=((i+1)/checkpoints.length);return <div key={streak} className="absolute left-0 right-0 -translate-y-1/2" style={{bottom:`${((i+1)/checkpoints.length)*100}%`}}><span className={`text-[10px] font-bold uppercase tracking-[.12em] ${reached?"text-primary":"text-muted-foreground"}`}>{ladderEliminations(streak)} players · {formatEuro(Math.round(lastOutcome.wagerEur*100*ladderMultiplier(streak)))}</span></div>})}
          </div>
        </div>
        <p className="mt-5 text-[10px] uppercase tracking-[.2em] text-muted-foreground">{cashout.streak} wins · cash out secured</p>
        <p className="mt-2 break-all font-display text-4xl font-black tabular-nums text-primary text-glow">{formatEuro(animatedCashout)}</p>
      </div>
      <button type="button" onClick={()=>navigate({to:"/"})} className="mt-6 w-full rounded-2xl bg-primary py-5 font-display text-lg font-black tracking-[.22em] text-primary-foreground">BACK TO HOME</button>
    </Screen>;
  }

  return (
    <Screen>
      <div
        className={`animate-pop rounded-3xl border px-5 py-6 text-center ${
          won ? "border-primary bg-primary/10 neon-glow" : "border-destructive bg-destructive/10"
        }`}
      >
        <h1
          className={`font-display text-4xl font-bold tracking-[0.3em] ${
            won ? "text-primary text-glow" : "text-destructive"
          }`}
        >
          {won ? (ladderMatch ? ladderCelebrationName(lastOutcome.ladderStreak ?? 1) : "ALTAMETA") : "BASSAMETA"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {won ? (ladderMatch ? `${ladderMultiplier(lastOutcome.ladderStreak ?? 1).toFixed(1)}× LADDER MULTIPLIER` : "You took the duel.") : "Opponent takes this one."}
        </p>
      </div>

      <div className="mt-5 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{ladderMatch ? (won ? `Ladder cash out · ${lastOutcome.ladderStreak} win${lastOutcome.ladderStreak===1?"":"s"}` : "Ladder run lost") : won ? "Winnings" : "Lost"}</p>
        <p className={`mt-2 font-display text-6xl font-black tabular-nums transition-transform ${won ? "text-primary text-glow" : "text-destructive"}`}>
          {ladderMatch ? (won ? formatEuro(animatedWin) : formatEuro(-lastOutcome.wagerEur*100, true)) : won ? formatEuro(animatedWin, true) : formatEuro(lastOutcome.coinDelta, true)}
        </p>
      </div>

      <section className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Side
          avatar={profile.avatar}
          name="YOU"
          value={
            survival
              ? `${survival.playerScore}`
              : monkey
              ? `${monkey.playerLevels}`
              : direction
                ? `${direction.playerArrows}`
              : precision
                ? `${precision.playerPoints}`
                : rhythm
                ? `${rhythm.playerNotes}`
                : `${lastOutcome.playerAvgMs} ms`
          }
          highlight={won}
        />
        <span className="font-display text-xl font-bold text-accent">VS</span>
        <Side
          avatar={lastOutcome.opponentAvatar}
          name={lastOutcome.opponentName}
          value={
            survival
              ? `${survival.opponentScore}`
              : monkey
              ? `${monkey.opponentLevels}`
              : direction
                ? `${direction.opponentArrows}`
              : precision
                ? `${precision.opponentPoints}`
                : rhythm
                ? `${rhythm.opponentNotes}`
                : `${lastOutcome.opponentAvgMs} ms`
          }
          highlight={!won}
        />
      </section>
      {(rhythm || precision || direction || monkey || survival) && (
        <p className="mt-2 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {survival ? (lastOutcome.gameId === "knife" ? "Knives landed" : lastOutcome.gameId === "stack" ? "Blocks stacked" : lastOutcome.gameId === "flappy" ? "Pipes cleared" : "Obstacles cleared") : monkey ? "Levels cleared" : direction ? "Arrows survived" : precision ? "Points scored" : "Notes survived"}
        </p>
      )}


      <section className="mt-6 grid grid-cols-2 gap-3">
        <Delta
          label={`Stake €${lastOutcome.wagerEur}`}
          value={ladderMatch && won ? formatEuro(ladderShownPrize) : formatEuro(lastOutcome.coinDelta, true)}
          positive={won}
        />
        <Delta
          label="Rating"
          value={`${lastOutcome.ratingDelta > 0 ? "+" : ""}${lastOutcome.ratingDelta}`}
          positive={won}
        />
      </section>

      <p className="mt-3 text-center text-xs text-muted-foreground tabular-nums">
        Balance {formatEuro(profile.coins)} · Rating {profile.rating}
        {survival
          ? ` · ${survival.playerScore} ${lastOutcome.gameId === "knife" ? "knives" : lastOutcome.gameId === "stack" ? "blocks" : lastOutcome.gameId === "flappy" ? "pipes" : "obstacles"} · Opponent ${survival.opponentScore} · Seed #${survival.seed.toString(36).slice(-6)}`
          : monkey
          ? ` · ${monkey.playerLevels} levels · Opponent ${monkey.opponentLevels}`
          : direction
            ? ` · ${direction.playerArrows} arrows · Opponent ${direction.opponentArrows}`
          : precision
            ? ` · ${precision.playerStops} stops · ${precision.perfects} perfect · Opponent ${precision.opponentStops} stops`
          : rhythm
            ? ` · Avg timing ${rhythm.avgOffsetMs} ms · Track #${rhythm.seed.toString(36).slice(-6)}`
            : ` · Best round ${lastOutcome.playerBestMs} ms`}
        {!rhythm &&
          !precision &&
          !direction &&
          !monkey &&
          !survival &&
          lastOutcome.falseStarts > 0 &&
          ` · ${lastOutcome.falseStarts} false start(s)`}
      </p>

      {!rhythm && !precision && !direction && !monkey && !survival && (
        <section className="mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Round breakdown
          </h2>
          <ul className="mt-3 space-y-2">
            {lastOutcome.rounds.map((r) => (
              <li
                key={r.round}
                className="grid grid-cols-[auto_1fr_1fr] items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 text-sm tabular-nums"
              >
                <span className="text-muted-foreground">R{r.round}</span>
                <span className={r.falseStart ? "text-destructive" : "text-primary"}>
                  {r.falseStart ? "FALSE START" : `${r.playerMs} ms`}
                </span>
                <span className="text-right text-muted-foreground">{r.opponentMs} ms</span>
              </li>
            ))}
          </ul>
        </section>
      )}


      {ladder && lastOutcome.gameId===ladder.gameId && (
        <section className="mt-7 rounded-3xl border border-primary/60 bg-primary/10 p-5 text-center">
          {ladder.active && won ? <>
            <p className="text-[10px] font-bold uppercase tracking-[.25em] text-primary">∞ THE LADDER · STREAK {ladder.streak}</p>
            <p className="mt-2 font-display text-4xl font-black text-primary">{ladderMultiplier(ladder.streak).toFixed(1)}×</p>
            <p className="mt-1 text-xs text-muted-foreground">{ladderEliminations(ladder.streak)} players represented · DEMO prize {formatEuro(ladderPrizeUnits(ladder))}</p>
            <p className="mt-3 text-[11px] text-muted-foreground">Next win → {ladderMultiplier(ladder.streak+1).toFixed(1)}× · {formatEuro(Math.round(ladder.wagerEur*100*ladderMultiplier(ladder.streak+1)))}</p>
            <button type="button" onClick={()=>navigate({to:"/match",search:{game:ladder.gameId,ladder:"continue"}})} className="mt-4 w-full rounded-2xl bg-primary py-4 font-display text-sm font-black tracking-[.16em] text-primary-foreground">CONTINUE · RISK THE RUN</button>
            <button type="button" onClick={()=>{const amount=ladderPrizeUnits(ladder);const streak=ladder.streak;const eliminations=ladderEliminations(streak);cashOutLadder();setCashout({amount,streak,eliminations})}} className="mt-2 w-full rounded-2xl border border-primary py-4 font-display text-sm font-black tracking-[.16em] text-primary">CASH OUT · {formatEuro(ladderPrizeUnits(ladder))}</button>
          </> : <>
            <p className="font-display text-xl font-black text-destructive">LADDER RUN OVER</p>
            <p className="mt-2 text-xs text-muted-foreground">The accumulated DEMO prize was lost.</p>
          </>}
        </section>
      )}

      <div className="mt-8 space-y-3">
        <Link
          to="/games"
          className={`block rounded-2xl bg-primary py-5 text-center font-display text-xl font-bold tracking-[0.25em] text-primary-foreground ${
            canPlay ? "" : "pointer-events-none opacity-40"
          }`}
        >
          REMATCH
        </Link>
        <Link
          to="/"
          className="block rounded-2xl border border-border bg-card py-4 text-center font-display text-sm font-bold tracking-[0.25em]"
        >
          BACK TO HOME
        </Link>
      </div>
    </Screen>
  );
}

function Side({
  avatar,
  name,
  value,
  highlight,
}: {
  avatar: string;
  name: string;
  value: string;
  highlight: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border px-3 py-5 text-center ${
        highlight ? "border-primary bg-card" : "border-border bg-card"
      }`}
    >
      <span className="text-3xl">{avatar}</span>
      <span className="mt-1 block truncate text-xs uppercase tracking-[0.15em] text-muted-foreground">
        {name}
      </span>
      <span
        className={`mt-1 block font-display text-2xl font-bold tabular-nums ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Delta({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`font-display text-2xl font-bold tabular-nums ${
          positive ? "text-primary" : "text-destructive"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
