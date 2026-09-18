import type { Opponent } from "../types";
import { createRng } from "./rhythm";
export function simulateStackOpponent(seed:number,opponent:Opponent){const rng=createRng(seed^0x6a09e667),skill=Math.min(1,Math.max(0,(opponent.rating-850)/700));for(let i=0;i<100;i++){const miss=Math.min(.48,(.018+i*.009)*(1.35-skill*.58));if(rng()<miss)return i;}return 100;}
export function penaltyKeeper(seed:number,round:number){const rng=createRng((seed^0xbb67ae85)+round*7919);return Math.floor(rng()*3);}
export function penaltyBotShot(seed:number,round:number,opponent:Opponent){const rng=createRng((seed^0x3c6ef372)+round*104729),skill=Math.min(1,Math.max(0,(opponent.rating-850)/700));return rng()<(.58+skill*.22);}

export function simulateKnifeOpponent(seed:number,opponent:Opponent){const rng=createRng(seed^0x510e527f),skill=Math.min(1,Math.max(0,(opponent.rating-850)/700));for(let i=0;i<120;i++){const miss=Math.min(.52,(.015+i*.0075)*(1.38-skill*.6));if(rng()<miss)return i;}return 120;}
