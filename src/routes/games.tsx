import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { startMusic } from "@/lib/duel/audio";
import { createFriendChallenge } from "@/lib/duel/friend-challenges";
import { Screen, TopBar } from "@/components/duel/Screen";
import { MINIGAMES } from "@/lib/duel/games";
import { useDuel } from "@/lib/duel/provider";
import { formatEuro, WAGER_OPTIONS_EUR } from "@/lib/duel/economy";
import type { MinigameMeta } from "@/lib/duel/types";

export const Route = createFileRoute("/games")({ component: GameSelection });

const RULES: Record<string,string> = {
 reaction: "Wait for the arena to turn green, then tap as fast as possible. You play 5 rounds. Tapping too early gives a penalty.",
 rhythm: "Tap the left or right lane when each note reaches the hit line. A wrong lane or missed note ends your run.",
 direction: "Swipe in the direction shown by the lowest falling arrow. A wrong swipe or an arrow reaching the danger line ends your run.",
 memory: "Memorize the numbered squares. After 0.5 seconds the numbers are hidden. Tap every square in order, starting from 1. Each cleared level adds another square.",
 precision: "Press STOP while the moving marker is inside the target. The inner zone scores double. One miss ends the duel.",
 flappy: "Tap anywhere to flap upward and pass through the gaps. Touching a pipe, ceiling or floor ends the run. Every match generates a new course from its seed.",
 dash: "Run automatically through a seeded obstacle course. Use JUMP to clear obstacles and FAST FALL to slam back to the ground quickly. The speed increases as your score rises.",
 stack: "Tap to drop each moving block. Only the overlapping part survives. Miss completely and your run ends.",
 knife: "Tap to throw a knife into the spinning target. Hitting an existing knife ends the run. The target gets faster as your score rises.",
};

function GameSelection() {
 useEffect(() => startMusic("menu"), []);
 const navigate=useNavigate();
 const {profile,wagerEur,setWagerEur,reserveFriendWager}=useDuel();
 const [selected,setSelected]=useState<MinigameMeta|null>(null);
 const [creating,setCreating]=useState(false); const [friendPayment,setFriendPayment]=useState<"demo"|"in_person">("demo"); const [share,setShare]=useState<{url:string;code:string}|null>(null);
 const affordable=profile.coins>=wagerEur*100;
 if(selected) return <Screen><TopBar title={selected.name}/>
   <button type="button" onClick={()=>{setSelected(null);setShare(null)}} aria-label="Back to game selection" className="absolute left-5 top-6 grid h-10 w-10 place-items-center rounded-xl border border-border bg-card text-lg text-muted-foreground">←</button>
   <div className="mt-4 flex items-center gap-4 rounded-3xl border border-border bg-card p-5">
    <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-secondary text-5xl">{selected.icon}</span>
    <div className="min-w-0"><p className="font-display text-xl font-bold tracking-[0.16em]">{selected.name}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{selected.tagline}</p></div>
   </div>
   <section className="mt-4 rounded-2xl border border-border bg-card p-4">
    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">How to play</p>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{RULES[selected.id]}</p>
   </section>
   <section className="mt-4 rounded-2xl border border-border bg-card p-4">
    <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Choose stake</p><p className="text-xs text-muted-foreground">Balance <span className="font-bold text-primary">{formatEuro(profile.coins)}</span></p></div>
    <div className="mt-3 grid grid-cols-4 gap-2">{WAGER_OPTIONS_EUR.map(a=><button key={a} type="button" disabled={profile.coins<a*100} onClick={()=>setWagerEur(a)} className={`rounded-xl border px-2 py-3 font-display text-sm font-bold disabled:opacity-30 ${wagerEur===a?"border-primary bg-primary/15 text-primary":"border-border bg-background"}`}>€{a}</button>)}</div>
   </section>
   <button type="button" disabled={!affordable} onClick={()=>navigate({to:"/match",search:{game:selected.id,friend:"",ladder:"start"}})} className="mt-3 w-full rounded-3xl border border-primary bg-primary/10 py-4 font-display text-sm font-bold tracking-[0.18em] text-primary disabled:opacity-30">∞ PLAY THE LADDER · €{wagerEur} DEMO</button>
   <p className="mt-2 text-center text-[10px] leading-relaxed text-muted-foreground">Win, then cash out or face another survivor at your streak. One loss ends the run.</p>
   <div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setFriendPayment("demo")} className={`rounded-xl border py-3 text-[10px] font-bold tracking-[.12em] ${friendPayment==="demo"?"border-primary bg-primary/15 text-primary":"border-border"}`}>FRIEND · DEMO</button><button type="button" onClick={()=>setFriendPayment("in_person")} className={`rounded-xl border py-3 text-[10px] font-bold tracking-[.12em] ${friendPayment==="in_person"?"border-primary bg-primary/15 text-primary":"border-border"}`}>FRIEND · IN PERSON</button></div>\n   <button type="button" disabled={(friendPayment==="demo"&&!affordable)||creating} onClick={async()=>{setCreating(true);try{const {challenge:ch,token}=await createFriendChallenge({gameId:selected.id,wagerEur,paymentMode:friendPayment,name:profile.username,avatar:profile.avatar});if(friendPayment==="demo"&&!reserveFriendWager(ch.code,wagerEur))throw new Error("Not enough demo balance");const url=`${window.location.origin}/challenge/${ch.code}`;localStorage.setItem("altameta:friendChallenge",JSON.stringify({code:ch.code,token,role:"creator",seed:ch.seed}));setShare({url,code:ch.code})}finally{setCreating(false)}}} className="mt-3 w-full rounded-3xl border border-primary/50 bg-card py-4 font-display text-sm font-bold tracking-[0.18em] text-primary disabled:opacity-30">{creating?"CREATING…":"CHALLENGE A FRIEND · 24H"}</button>
   {share&&<div className="mt-3 rounded-2xl border border-border bg-card p-4 text-center"><p className="text-[10px] uppercase tracking-[.2em] text-muted-foreground">Challenge code · valid for 24 hours</p><p className="mt-1 font-display text-2xl font-black tracking-[.2em] text-primary">{share.code}</p><button onClick={async()=>{if(navigator.share)await navigator.share({title:"ALTAMETA challenge",text:`Beat me at ${selected.name}!`,url:share.url});else await navigator.clipboard.writeText(share.url);navigate({to:"/challenge/$code",params:{code:share.code}})}} className="mt-3 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-primary-foreground">SHARE INVITE</button><button onClick={()=>navigate({to:"/challenge/$code",params:{code:share.code}})} className="ml-2 mt-3 rounded-xl border border-primary px-5 py-3 text-xs font-bold text-primary">PLAY NOW</button><p className="mt-2 break-all text-[10px] text-muted-foreground">{share.url}</p></div>}
 </Screen>;
 return <Screen><TopBar title="SELECT GAME" back="/"/><p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">Balance {formatEuro(profile.coins)}</p>
  <ul className="mt-6 space-y-3">{MINIGAMES.map((g,i)=><li key={g.id} className="animate-rise" style={{animationDelay:`${i*50}ms`}}><button type="button" disabled={!g.available} onClick={()=>setSelected(g)} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card px-3 py-4 text-left active:scale-[0.98] disabled:opacity-45">
   <span className="flex shrink-0 items-center gap-2"><span className="grid h-12 w-12 place-items-center rounded-xl bg-secondary text-2xl">{g.icon}</span><GamePreview id={g.id}/></span>
   <span className="min-w-0"><span className="block font-display text-base font-bold tracking-[0.12em]">{g.name}</span><span className="block truncate text-xs text-muted-foreground">{g.tagline}</span></span>
   <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase text-primary-foreground">{g.available?"Open":"Soon"}</span>
  </button></li>)}</ul>
 </Screen>;
}
function GamePreview({id}:{id:string}){const b="relative h-12 w-16 overflow-hidden rounded-xl border border-border bg-background";
 if(id==="reaction")return <span className={b}><span className="absolute inset-2 rounded-lg bg-primary/70"/><span className="absolute inset-0 grid place-items-center text-[8px] font-black">TAP</span></span>;
 if(id==="rhythm")return <span className={b}><span className="absolute inset-y-0 left-1/2 w-px bg-border"/><span className="absolute bottom-2 left-1 right-1 h-px bg-primary"/><span className="absolute left-2 top-2 h-2 w-5 rounded bg-primary"/><span className="absolute right-2 top-6 h-2 w-5 rounded bg-primary"/></span>;
 if(id==="direction")return <span className={b}><span className="absolute inset-0 grid place-items-center text-2xl font-bold text-primary">↓</span></span>;
 if(id==="memory")return <span className={b}><span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded bg-secondary text-[9px] font-bold">1</span><span className="absolute right-1 top-3 grid h-5 w-5 place-items-center rounded bg-secondary text-[9px] font-bold">3</span><span className="absolute bottom-1 left-6 grid h-5 w-5 place-items-center rounded bg-primary/30 text-[9px] font-bold">2</span></span>;
 if(id==="flappy")return <span className={b}><span className="absolute left-2 top-5 inline-block -scale-x-100 text-base">🐤</span><span className="absolute right-3 top-0 h-4 w-2 bg-primary"/><span className="absolute right-3 bottom-0 h-4 w-2 bg-primary"/></span>;
 if(id==="dash")return <span className={b}><span className="absolute bottom-1 left-2 inline-block -scale-x-100 text-xl">🦖</span><span className="absolute bottom-1 right-2 text-xl">🌵</span></span>;
 if(id==="stack")return <span className={b}><span className="absolute bottom-1 left-3 h-2 w-10 bg-primary/40"/><span className="absolute bottom-4 left-4 h-2 w-8 bg-primary/60"/><span className="absolute bottom-7 left-2 h-2 w-9 bg-primary"/></span>;
 if(id==="knife")return <span className={b}><span className="absolute left-1/2 top-1 h-5 w-px -translate-x-1/2 bg-foreground"/><span className="absolute bottom-1 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full border-4 border-primary/70"/></span>;
 if(id==="precision")return <span className={b}><span className="absolute left-2 right-2 top-1/2 h-3 -translate-y-1/2 rounded bg-primary/25"/><span className="absolute left-1/2 top-2 bottom-2 w-px bg-foreground"/></span>;
 return <span className={b}/>;
}
