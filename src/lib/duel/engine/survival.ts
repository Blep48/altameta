import { createRng } from "./rhythm";
export interface Obstacle { index:number; x:number; size:number; gapY:number; gap:number; }
export function createObstacleFeed(seed:number,count=240):Obstacle[]{const rng=createRng(seed^0x51ed270b);const out:Obstacle[]=[];let x=110;for(let i=0;i<count;i++){const d=Math.min(1,i/90);x+=48+rng()*34-d*10;out.push({index:i,x,size:8+rng()*5,gapY:28+rng()*42,gap:30-d*9});}return out;}
