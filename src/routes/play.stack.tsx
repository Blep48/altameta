import { submitIfFriend } from "@/lib/duel/friend-match";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDuel } from "@/lib/duel/provider";
import { MatchBalance } from "@/components/duel/MatchBalance";
import { OpponentOutBanner } from "@/components/duel/OpponentOutBanner";
import { sfx, startMusic } from "@/lib/duel/audio";
import { simulateStackOpponent } from "@/lib/duel/engine/casual";

export const Route = createFileRoute("/play/stack")({ component: Stack });
type Block = { x: number; width: number };

function Stack() {
  useEffect(() => startMusic("stack"), []);
  const nav = useNavigate();
  const { activeMatch, finishSurvivalMatch, ready, profile, wagerEur } = useDuel();
  const [score, setScore] = useState(0), [over, setOver] = useState(false), [perfect, setPerfect] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement|null>(null), arenaRef = useRef<HTMLElement|null>(null);
  const x = useRef(14), dir = useRef(1), width = useRef(72), baseX = useRef(14), scoreRef = useRef(0);
  const blocks = useRef<Block[]>([{x:14,width:72}]), done = useRef(false), raf = useRef<number|null>(null), last = useRef(0);
  const seed = activeMatch?.seed ?? 1;
  const bot = useMemo(() => activeMatch ? simulateStackOpponent(seed, activeMatch.opponent) : 0, [seed, activeMatch]);

  useEffect(() => { if (ready && !activeMatch) nav({to:"/"}); }, [ready, activeMatch, nav]);

  const end = () => {
    if (done.current || !activeMatch) return;
    done.current=true; setOver(true); if(raf.current)cancelAnimationFrame(raf.current); sfx.miss();
    if(activeMatch.friend){void submitIfFriend(activeMatch,scoreRef.current).then(()=>nav({to:"/challenge/$code",params:{code:activeMatch.friend!.code}}));return}
    const o=finishSurvivalMatch({playerScore:scoreRef.current,opponentScore:bot});
    setTimeout(()=>{if(o){o.won?sfx.win():sfx.lose();nav({to:"/result"})}else nav({to:"/"})},650);
  };

  useEffect(()=>{
    if(!activeMatch)return; const canvas=canvasRef.current,arena=arenaRef.current;if(!canvas||!arena)return;const ctx=canvas.getContext("2d");if(!ctx)return;
    const resize=()=>{const r=arena.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);canvas.style.width=r.width+"px";canvas.style.height=r.height+"px";ctx.setTransform(d,0,0,d,0,0)};
    resize();const ro=new ResizeObserver(resize);ro.observe(arena);last.current=performance.now();
    const tick=(t:number)=>{if(done.current)return;const dt=Math.min(1/30,(t-last.current)/1000);last.current=t;const speed=38+Math.min(82,scoreRef.current*3.6);let nx=x.current+dir.current*speed*dt;if(nx<=0){nx=0;dir.current=1}else if(nx+width.current>=100){nx=100-width.current;dir.current=-1}x.current=nx;
      const w=arena.clientWidth,h=arena.clientHeight,unit=w/100,bh=Math.max(13,Math.min(19,h*.032)),gap=2,visible=18;ctx.clearRect(0,0,w,h);
      const shown=blocks.current.slice(-visible);shown.forEach((b,i)=>{const yy=h-34-(shown.length-i)* (bh+gap);ctx.globalAlpha=.55+i/shown.length*.35;ctx.fillStyle="#8b5cf6";ctx.fillRect(b.x*unit,yy,b.width*unit,bh)});
      ctx.globalAlpha=1;ctx.fillStyle=perfect.current?"#f5c542":"#a78bfa";ctx.fillRect(x.current*unit,h-34-(shown.length+1)*(bh+gap),width.current*unit,bh);
      raf.current=requestAnimationFrame(tick)};
    raf.current=requestAnimationFrame(tick);return()=>{ro.disconnect();if(raf.current)cancelAnimationFrame(raf.current)}
  },[activeMatch]);

  if(!activeMatch)return null;
  const drop=()=>{
    if(done.current)return;
    const left=Math.max(x.current,baseX.current),right=Math.min(x.current+width.current,baseX.current+width.current),overlap=right-left;
    if(overlap<=1){end();return}
    const isPerfect=overlap>=width.current*.97;
    scoreRef.current++;setScore(scoreRef.current);setPerfect(isPerfect);setTimeout(()=>setPerfect(false),100);
    if(isPerfect){const snap=baseX.current;x.current=snap;sfx.go()}else{width.current=overlap;baseX.current=left;x.current=left;sfx.tap()}
    blocks.current.push({x:x.current,width:width.current});
    baseX.current=x.current;
    dir.current*=-1;
    x.current=dir.current>0?0:100-width.current;
    if(scoreRef.current>=100)end();
  };

  return <main className="mx-auto flex h-[100dvh] w-full max-w-md touch-none select-none flex-col overflow-hidden bg-background">
    <MatchBalance coins={profile.coins} wagerEur={wagerEur}/><div className="flex justify-between px-5 py-2 text-xs"><b>STACK · {score}</b><span>vs {activeMatch.opponent.username}</span></div>
    <section ref={arenaRef} onPointerDown={drop} className="relative min-h-0 flex-1 overflow-hidden bg-card">
      <OpponentOutBanner opponentName={activeMatch.opponent.username} opponentScore={bot} playerScore={score} wagerEur={wagerEur} outAfterMs={Math.max(1600,bot*720)} label="blocks"/>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0"/>
      <p className="pointer-events-none absolute bottom-2 inset-x-0 text-center text-xs text-muted-foreground">{over?"MISSED":perfect?"PERFECT":"TAP TO DROP · PERFECT DROPS SNAP INTO PLACE"}</p>
    </section>
  </main>;
}
