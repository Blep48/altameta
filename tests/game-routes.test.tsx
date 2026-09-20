import { beforeEach,afterEach,it,expect,vi } from "vitest";
import { render,fireEvent,act,cleanup,screen } from "@testing-library/react";
import type { ComponentType } from "react";
const mocks=vi.hoisted(()=>({navigate:vi.fn(),finish:vi.fn(),duel:{activeMatch:{id:"x",gameId:"dash",mode:"duel",entryCharged:true,wagerEur:1,seed:1,opponent:{id:"bot",username:"BOT",rating:1200,meanReactionMs:250,varianceMs:20}},ready:true,profile:{coins:9900},wagerEur:1,ladder:null}}));
vi.mock("@tanstack/react-router",()=>({createFileRoute:()=> (options:unknown)=>({options}),useNavigate:()=>mocks.navigate}));
vi.mock("@/lib/duel/provider",()=>({useDuel:()=>({...mocks.duel,finishMatch:mocks.finish,finishSurvivalMatch:mocks.finish})}));
vi.mock("@/components/duel/OpponentOutBanner",()=>({OpponentOutBanner:()=>null}));
vi.mock("@/lib/duel/audio",()=>({startMusic:()=>()=>{},sfx:{miss:vi.fn(),tap:vi.fn(),go:vi.fn(),win:vi.fn(),lose:vi.fn(),countdown:vi.fn(),falseStart:vi.fn()}}));
vi.mock("@/lib/duel/engine/survival",()=>({createObstacleFeed:()=>[{index:239,x:-1000,size:8,gapY:50,gap:30}],simulateSurvivalOpponent:()=>0}));
import { Route as ReactionRoute } from "../src/routes/play.reaction";
import { Route as DinoRoute } from "../src/routes/play.dash";
import { Route as FlappyRoute } from "../src/routes/play.flappy";
beforeEach(()=>{
 vi.useFakeTimers();mocks.finish.mockReset();mocks.finish.mockReturnValue({won:true});mocks.navigate.mockReset();
 vi.spyOn(Math,"random").mockReturnValue(0);
 vi.stubGlobal("ResizeObserver",class {observe(){}disconnect(){}});
 vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockReturnValue({width:390,height:600,x:0,y:0,top:0,left:0,bottom:600,right:390,toJSON(){return {}}});
 vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({setTransform:vi.fn(),clearRect:vi.fn(),fillRect:vi.fn(),save:vi.fn(),restore:vi.fn(),translate:vi.fn(),beginPath:vi.fn(),arc:vi.fn(),fill:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn()} as never);
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals()});
it("Reaction does not turn green from a cancelled round",()=>{
 const Game=ReactionRoute.options.component as ComponentType;render(<Game/>);
 act(()=>vi.advanceTimersByTime(3300));expect(screen.getByText("WAIT…")).toBeTruthy();
 fireEvent.pointerDown(screen.getByRole("button"));expect(screen.getByText("FALSE START")).toBeTruthy();
 act(()=>vi.advanceTimersByTime(1500));expect(screen.getByText("WAIT…")).toBeTruthy();
 act(()=>vi.advanceTimersByTime(1200));expect(screen.getByText("TAP!")).toBeTruthy();
});
it.each([["Dino",DinoRoute],["Flappy",FlappyRoute]])("%s finishes when the final obstacle has been cleared",(_,route)=>{
 const Game=route.options.component as ComponentType;render(<Game/>);
 act(()=>vi.advanceTimersByTime(20));expect(mocks.finish).toHaveBeenCalledExactlyOnceWith({playerScore:1,opponentScore:0});
 act(()=>vi.advanceTimersByTime(1000));expect(mocks.navigate).toHaveBeenCalledWith({to:"/result"});
});
