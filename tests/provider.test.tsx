import { beforeEach,afterEach,it,expect,vi } from "vitest";
import { renderHook,act,cleanup } from "@testing-library/react";
import { DuelProvider,useDuel } from "../src/lib/duel/provider";
import { localMatchmaking } from "../src/lib/duel/matchmaking";
import { setFriendSession,getFriendSession } from "../src/lib/duel/friend-challenges";
import type { ActiveMatch } from "../src/lib/duel/types";
import type { FriendChallenge } from "../src/lib/duel/friend-challenges";
vi.mock("../src/lib/duel/audio",()=>({setMuted:vi.fn()}));
vi.mock("../src/lib/duel/matchmaking",()=>({localMatchmaking:{find:vi.fn()}}));
const match:ActiveMatch={id:"x",gameId:"stack",mode:"duel",entryCharged:false,wagerEur:0,seed:1,startedAt:1,opponent:{id:"bot",username:"BOT",avatar:"🎮",rating:1200,meanReactionMs:250,varianceMs:20}};
const challenge={code:"ABC",game_id:"stack",wager_eur:1,payment_mode:"demo",creator_score:10,guest_score:2,score_mode:"high",creator_name:"A",creator_avatar:"A",guest_name:"B",guest_avatar:"B"} as FriendChallenge;
beforeEach(()=>{localStorage.clear();vi.mocked(localMatchmaking.find).mockReset();vi.mocked(localMatchmaking.find).mockResolvedValue(match)});
afterEach(cleanup);
const setup=()=>renderHook(()=>useDuel(),{wrapper:DuelProvider});
it("cancels before an opponent exists and refunds only once",async()=>{
 vi.mocked(localMatchmaking.find).mockImplementation(({signal})=>new Promise((_,reject)=>signal?.addEventListener("abort",()=>reject(new DOMException("abort","AbortError")))));
 const {result}=setup();let task!:Promise<unknown>;
 act(()=>{task=result.current.findMatch("stack").catch(()=>null)});
 expect(result.current.profile.coins).toBe(9900);
 await act(async()=>{result.current.cancelMatch();result.current.cancelMatch();await task});
 expect(result.current.profile.coins).toBe(10000);expect(result.current.activeMatch).toBeNull();
});
it("settles using the frozen stake, once, at 1.90 gross",async()=>{
 const {result}=setup();await act(async()=>{await result.current.findMatch("stack")});
 act(()=>{result.current.setWagerEur(50);result.current.finishSurvivalMatch({playerScore:10,opponentScore:1});result.current.finishSurvivalMatch({playerScore:10,opponentScore:1})});
 expect(result.current.profile.coins).toBe(10090);expect(result.current.history).toHaveLength(1);expect(result.current.lastOutcome?.wagerEur).toBe(1);expect(result.current.lastOutcome?.coinDelta).toBe(90);
});
it("Ladder continuation has no extra entry; cashout is idempotent",async()=>{
 const {result}=setup();await act(async()=>{await result.current.startLadder("stack")});
 act(()=>{result.current.finishSurvivalMatch({playerScore:10,opponentScore:1})});
 expect(result.current.profile.coins).toBe(9900);
 await act(async()=>{await result.current.continueLadder()});
 act(()=>{result.current.finishSurvivalMatch({playerScore:10,opponentScore:1})});
 act(()=>{result.current.cashOutLadder();result.current.cashOutLadder()});
 expect(result.current.profile.coins).toBe(10280);expect(result.current.ladder).toBeNull();
});
it.each([10,2,0])("IN PERSON score %s never changes demo balance",score=>{
 const {result}=setup();act(()=>{result.current.settleFriendChallenge({...challenge,payment_mode:"in_person",creator_score:score},"creator")});
 expect(result.current.profile.coins).toBe(10000);expect(result.current.lastOutcome?.coinDelta).toBe(0);
});
it("friend wins require an entry and are settled once",()=>{
 const {result}=setup();act(()=>result.current.settleFriendChallenge(challenge,"creator"));expect(result.current.profile.coins).toBe(10000);
 act(()=>{result.current.reserveFriendWager("ABC",1);result.current.settleFriendChallenge(challenge,"creator");result.current.settleFriendChallenge(challenge,"creator")});expect(result.current.profile.coins).toBe(10090);expect(result.current.history).toHaveLength(1);
});
it("reset clears Ladder, reservations and multiple friend sessions",async()=>{
 const {result}=setup();setFriendSession({code:"A",token:"a",role:"creator",seed:1});setFriendSession({code:"B",token:"b",role:"guest",seed:2});
 expect(getFriendSession("A")?.token).toBe("a");expect(getFriendSession("B")?.token).toBe("b");
 await act(async()=>{await result.current.startLadder("stack")});act(()=>result.current.resetProgress());
 expect(result.current.profile.coins).toBe(10000);expect(result.current.ladder).toBeNull();expect(getFriendSession("A")).toBeNull();expect(getFriendSession("B")).toBeNull();
});
