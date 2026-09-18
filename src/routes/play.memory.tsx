import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDuel } from "@/lib/duel/provider";
import { MatchBalance } from "@/components/duel/MatchBalance";
import { sfx } from "@/lib/duel/audio";
import { createMonkeyBoard, simulateMonkeyOpponent } from "@/lib/duel/engine/monkey";

export const Route = createFileRoute("/play/memory")({ component: MonkeyTest });

function MonkeyTest() {
  const navigate = useNavigate();
  const { activeMatch, finishMonkeyMatch, ready, profile, wagerEur } = useDuel();
  const [level, setLevel] = useState(0);
  const [next, setNext] = useState(1);
  const [covered, setCovered] = useState(false);
  const [phase, setPhase] = useState<"preview"|"sequence"|"playing"|"over">("preview");
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const finished = useRef(false);
  const seed = activeMatch?.seed ?? 1;
  const board = useMemo(() => createMonkeyBoard(seed, level), [seed, level]);
  const opponentLevels = useMemo(() => activeMatch ? simulateMonkeyOpponent(seed, activeMatch.opponent) : 0, [seed, activeMatch]);

  useEffect(() => { if (ready && !activeMatch) navigate({to:"/"}); }, [ready, activeMatch, navigate]);
  useEffect(() => {
    if (!activeMatch || phase === "over") return;
    setCovered(false); setNext(1); setHighlighted(null); setPhase("preview");
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Give the player a full second to read the complete board.
    timers.push(setTimeout(() => {
      setPhase("sequence");
      board.forEach((tile, index) => {
        timers.push(setTimeout(() => setHighlighted(tile.number), index * 220));
        timers.push(setTimeout(() => setHighlighted(null), index * 220 + 150));
      });
      timers.push(setTimeout(() => {
        setHighlighted(null);
        setCovered(true);
        setPhase("playing");
      }, board.length * 220 + 120));
    }, 1000));
    return () => timers.forEach(clearTimeout);
  }, [activeMatch, level, board]);

  const end = () => {
    if (finished.current) return;
    finished.current = true; setPhase("over"); sfx.miss();
    const outcome = finishMonkeyMatch({playerLevels:level, opponentLevels});
    setTimeout(() => { if(outcome){outcome.won?sfx.win():sfx.lose();navigate({to:"/result"});}else navigate({to:"/"}); }, 1000);
  };
  const press = (n:number) => {
    if (phase !== "playing") return;
    if (n !== next) { end(); return; }
    sfx.tap();
    if (n === board.length) { setPhase("preview"); setTimeout(() => setLevel((v)=>v+1), 220); }
    else setNext(n+1);
  };
  if(!activeMatch) return null;
  return <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden overscroll-none bg-background">
    <MatchBalance coins={profile.coins} wagerEur={wagerEur}/>
    <header className="grid shrink-0 grid-cols-3 gap-2 px-5 pt-2 text-center">
      <Meter label="Level" value={String(level+1)}/><Meter label="Tiles" value={String(board.length)}/><Meter label="Cleared" value={String(level)}/>
    </header>
    <div className="px-5 pt-2 text-center text-xs text-muted-foreground">Memorize the numbers. After 1 second they flash in order, then disappear. Tap every square from 1 upward.</div>
    <section className="relative mx-4 mb-4 mt-3 min-h-0 flex-1 overflow-hidden rounded-3xl border border-border bg-card">
      {board.map(tile => <button key={tile.number} type="button" onPointerDown={()=>press(tile.number)}
        className={`absolute grid h-12 w-12 place-items-center rounded-lg border font-display text-xl font-black text-foreground transition-all duration-100 active:scale-90 ${highlighted === tile.number ? "scale-110 border-primary bg-primary text-primary-foreground shadow-[0_0_24px_hsl(var(--primary))]" : "border-primary/50 bg-secondary"}`}
        style={{left:`${tile.x}%`,top:`${tile.y}%`}}>
        {!covered || tile.number < next ? tile.number : ""}
      </button>)}
      {(phase==="preview" || phase==="sequence") && <span className="absolute bottom-4 left-0 right-0 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{phase === "sequence" ? "WATCH THE ORDER" : "MEMORIZE"}</span>}
      {phase==="over" && <div className="absolute inset-0 grid place-items-center bg-background/85"><p className="font-display text-3xl font-bold text-destructive">WRONG!</p></div>}
    </section>
  </main>;
}
function Meter({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-border bg-card p-2"><p className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p><p className="font-display text-lg font-bold">{value}</p></div>}
