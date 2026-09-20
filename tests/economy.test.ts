import { describe,it,expect,vi,afterEach } from "vitest";
import { settlementAmount,balanceDelta,WAGER_OPTIONS_EUR } from "../src/lib/duel/economy";
import { newAccount,chargeEntry,refundEntry,reserveFriend,releaseFriend } from "../src/lib/duel/ledger";
import { createDefaultProfile } from "../src/lib/duel/player";
import { ladderPrizeUnits } from "../src/lib/duel/ladder";
import { createMonkeyBoard } from "../src/lib/duel/engine/monkey";
import { hitsKnife,impactAngle } from "../src/lib/duel/engine/knife";
import { botRatingWindow } from "../src/lib/duel/leagues";
import { createTimerGroup } from "../src/lib/duel/timers";
import { createObstacleFeed } from "../src/lib/duel/engine/survival";
afterEach(()=>vi.useRealTimers());
describe("economy",()=>{
 it.each(WAGER_OPTIONS_EUR)("returns 95%% of the pool for €%s",w=>{expect(settlementAmount(true,w)).toBe(w*190);expect(balanceDelta(true,w)).toBe(w*90);expect(balanceDelta(false,w)).toBe(-w*100)});
 it("refunds a pending entry once, without an ActiveMatch",()=>{const a=newAccount(createDefaultProfile());const charged=chargeEntry(a,"search",50,"ladder");expect(charged.profile.coins).toBe(5000);const refunded=refundEntry(charged);expect(refunded.profile.coins).toBe(10000);expect(refundEntry(refunded)).toBe(refunded)});
 it("cannot refund a different pending search",()=>{const a=chargeEntry(newAccount(createDefaultProfile()),"new",1,"duel");expect(refundEntry(a,"old")).toBe(a)});
 it("rejects invalid stakes",()=>{for(const value of [NaN,-1,0,Infinity,3])expect(()=>chargeEntry(newAccount(createDefaultProfile()),"x",value,"duel")).toThrow()});
 it("reserves and releases friends exactly once",()=>{const a=newAccount(createDefaultProfile());const b=reserveFriend(a,"A",1);expect(reserveFriend(b,"A",1)).toBe(b);const c=releaseFriend(b,"A");expect(c.profile.coins).toBe(10000);expect(releaseFriend(c,"A")).toBe(c)});
 it("Ladder commission is once on the total pool",()=>{expect(ladderPrizeUnits({gameId:"stack",wagerEur:1,streak:1,active:true})).toBe(190);expect(ladderPrizeUnits({gameId:"stack",wagerEur:1,streak:3,active:true})).toBe(760)});
});
describe("game regressions",()=>{
 it("Monkey cells are deterministic and don't overlap on mobile",()=>{for(let seed=0;seed<500;seed++){const board=createMonkeyBoard(seed,10);expect(board).toEqual(createMonkeyBoard(seed,10));for(let i=0;i<board.length;i++)for(let j=i+1;j<board.length;j++){const a=board[i]!,b=board[j]!;expect(Math.abs(a.x-b.x)*3.2>=48||Math.abs(a.y-b.y)*4>=48).toBe(true)}}});
 it("Knife collision uses rotation at impact, not launch",()=>{expect(impactAngle(0)).toBe(180);expect(hitsKnife([180],0)).toBe(true);expect(hitsKnife([180],30)).toBe(false);expect(hitsKnife([150],30)).toBe(true)});
 it("matchmaking windows stay ordered after rating falls",()=>{const [min,max]=botRatingWindow(500,6);expect(min).toBeLessThanOrEqual(max)});
 it("cancels stale green/countdown timers after false starts",()=>{vi.useFakeTimers();const group=createTimerGroup(),old=vi.fn(),next=vi.fn();group.later(old,1500);group.later(old,2400);group.clear();group.later(next,1200);vi.runAllTimers();expect(old).not.toHaveBeenCalled();expect(next).toHaveBeenCalledTimes(1)});
 it("course has a deterministic finite finish",()=>{const a=createObstacleFeed(1);expect(a).toHaveLength(240);expect(a).toEqual(createObstacleFeed(1));expect(a.every((x,i)=>i===0||x.x>a[i-1]!.x)).toBe(true)});
});
