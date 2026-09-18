export interface LadderRun { gameId:string; wagerEur:number; streak:number; active:boolean; lost?:boolean }
const KEY="altameta:ladder";
export const ladderMultiplier=(streak:number)=>Math.pow(2,Math.max(0,streak))-.5;
export const ladderEliminations=(streak:number)=>Math.pow(2,Math.max(0,streak))-1;
export const ladderPrizeUnits=(run:LadderRun)=>Math.round(run.wagerEur*100*ladderMultiplier(run.streak));
export function readLadder():LadderRun|null{if(typeof window==="undefined")return null;try{const x=JSON.parse(localStorage.getItem(KEY)||"null");return x&&typeof x.gameId==="string"?x:null}catch{return null}}
export function writeLadder(run:LadderRun|null){if(typeof window==="undefined")return;if(run)localStorage.setItem(KEY,JSON.stringify(run));else localStorage.removeItem(KEY)}
