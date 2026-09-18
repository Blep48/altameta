import type { Opponent } from "../types";
import { createRng } from "./rhythm";
export interface Obstacle { index:number; x:number; size:number; gapY:number; gap:number; }
export function createObstacleFeed(seed:number,count=240):Obstacle[]{const rng=createRng(seed^0x51ed270b);const out:Obstacle[]=[];let x=110;for(let i=0;i<count;i++){const d=Math.min(1,i/90);x+=48+rng()*34-d*10;out.push({index:i,x,size:8+rng()*5,gapY:28+rng()*42,gap:34-d*10});}return out;}
export function simulateSurvivalOpponent(seed:number,opponent:Opponent,mode:"flappy"|"dash"){const rng=createRng(seed^(mode==="flappy"?0xa341316c:0xc8013ea4));const skill=Math.min(1,Math.max(0,(opponent.rating-850)/700));let score=0;for(let i=0;i<180;i++){const fail=(0.018+i*.0018)*(1.45-skill*.72);if(rng()<fail)break;score++;}return score;}
