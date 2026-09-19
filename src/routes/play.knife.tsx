import { submitIfFriend } from "@/lib/duel/friend-match";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDuel } from "@/lib/duel/provider";
import { MatchBalance } from "@/components/duel/MatchBalance";
import { OpponentOutBanner } from "@/components/duel/OpponentOutBanner";
import { sfx, startMusic } from "@/lib/duel/audio";
import { simulateKnifeOpponent } from "@/lib/duel/engine/casual";

export const Route=createFileRoute("/play/knife")({component:Knife});
const angularDistance=(a:number,b:number)=>Math.abs(((a-b+540)%360)-180);

function Knife(){
  useEffect(()=>startMusic("knife"),[]);
  const nav=useNavigate(),{activeMatch,finishSurvivalMatch,ready,profile,wagerEur}=useDuel();
  const [score,setScore]=useState(0),[over,setOver]=useState(false);
  const canvasRef=useRef<HTMLCanvasElement|null>(null),arenaRef=useRef<HTMLElement|null>(null);
  const done=useRef(false),last=useRef(0),raf=useRef<number|null>(null),angle=useRef(0),scoreRef=useRef(0);
  const knives=useRef<number[]>([]),projectile=useRef<number|null>(null),queuedHit=useRef<number|null>(null);
  const seed=activeMatch?.seed??1,bot=useMemo(()=>activeMatch?simulateKnifeOpponent(seed,activeMatch.opponent):0,[seed,activeMatch]);
  useEffect(()=>{if(ready&&!activeMatch&&!done.current)nav({to:"/"});},[ready,activeMatch,nav]);

  const finish=()=>{if(done.current||!activeMatch)return;done.current=true;setOver(true);if(raf.current)cancelAnimationFrame(raf.current);sfx.miss();
    if(activeMatch.friend){void submitIfFriend(activeMatch,scoreRef.current).then(()=>nav({to:"/challenge/$code",params:{code:activeMatch.friend!.code}}));return}
    const o=finishSurvivalMatch({playerScore:scoreRef.current,opponentScore:bot});setTimeout(()=>{if(o){o.won?sfx.win():sfx.lose();nav({to:"/result"})}else nav({to:"/"})},650)};

  useEffect(()=>{
    if(!activeMatch)return;const canvas=canvasRef.current,arena=arenaRef.current;if(!canvas||!arena)return;const ctx=canvas.getContext("2d");if(!ctx)return;
    const resize=()=>{const r=arena.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);canvas.style.width=r.width+"px";canvas.style.height=r.height+"px";ctx.setTransform(d,0,0,d,0,0)};
    resize();const ro=new ResizeObserver(resize);ro.observe(arena);last.current=performance.now();
    const tick=(t:number)=>{if(done.current)return;const dt=Math.min(1/30,(t-last.current)/1000);last.current=t;angle.current=(angle.current+(105+Math.min(220,scoreRef.current*7))*dt)%360;
      if(projectile.current!==null){projectile.current=Math.min(1,projectile.current+dt*7.5);if(projectile.current>=1){const hit=queuedHit.current!;if(knives.current.some(a=>angularDistance(a,hit)<14)){finish();return}knives.current.push(hit);scoreRef.current++;setScore(scoreRef.current);sfx.tap();projectile.current=null;queuedHit.current=null}}
      const w=arena.clientWidth,h=arena.clientHeight,cx=w/2,cy=Math.max(125,h*.36),r=Math.min(82,w*.22);ctx.clearRect(0,0,w,h);
      ctx.save();ctx.translate(cx,cy);ctx.fillStyle="#25232d";ctx.strokeStyle="#8b5cf6";ctx.lineWidth=9;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.rotate(angle.current*Math.PI/180);ctx.strokeStyle="#eee";ctx.lineWidth=4;ctx.lineCap="round";
      for(const a of knives.current){ctx.save();ctx.rotate(a*Math.PI/180);ctx.beginPath();ctx.moveTo(0,-r+4);ctx.lineTo(0,-r-62);ctx.stroke();ctx.restore()}ctx.restore();
      if(projectile.current!==null){const start=h-38,end=cy+r+58,yy=start+(end-start)*projectile.current;ctx.strokeStyle="#eee";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx,yy);ctx.lineTo(cx,yy+58);ctx.stroke()}
      raf.current=requestAnimationFrame(tick)};
    raf.current=requestAnimationFrame(tick);return()=>{ro.disconnect();if(raf.current)cancelAnimationFrame(raf.current)}
  },[activeMatch]);

  if(!activeMatch)return null;
  const throwKnife=()=>{if(done.current||projectile.current!==null)return;projectile.current=0;queuedHit.current=(180-angle.current+360)%360;};

  return <main className="mx-auto flex h-[100dvh] w-full max-w-md touch-none select-none flex-col overflow-hidden bg-background">
    <MatchBalance coins={profile.coins} wagerEur={wagerEur}/><div className="flex justify-between px-5 py-2 text-xs"><b>KNIFE IT · {score}</b><span>vs {activeMatch.opponent.username}</span></div>
    <section ref={arenaRef} onPointerDown={throwKnife} className="relative min-h-0 flex-1 overflow-hidden bg-card">
      <OpponentOutBanner opponentName={activeMatch.opponent.username} opponentScore={bot} playerScore={score} wagerEur={wagerEur} outAfterMs={Math.max(1600,bot*620)} label="knives"/>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0"/>
      <p className="pointer-events-none absolute bottom-3 inset-x-0 text-center text-[10px] text-muted-foreground">{over?"CLANG · HIT A KNIFE":"TAP ANYWHERE TO THROW"}</p>
    </section>
  </main>;
}
