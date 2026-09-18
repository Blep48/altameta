const URL="https://uhazmkzewagtalbyzgcj.supabase.co/functions/v1/friend-challenge";const KEY="sb_publishable_Onsx-GUCZWzWmb93TsMbwQ_5hfJJCw3";
export interface FriendChallenge{id:string;code:string;game_id:string;seed:number;wager_eur:number;creator_name:string;creator_avatar:string;creator_score:number|null;creator_finished_at:string|null;guest_name:string|null;guest_avatar:string|null;guest_score:number|null;guest_finished_at:string|null;created_at:string;expires_at:string;score_mode:"high"|"low"}
export interface FriendSession{code:string;token:string;role:"creator"|"guest";seed:number}
async function call(body:unknown){const r=await fetch(URL,{method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(j.error||"Friend challenge error");return j}
export async function createFriendChallenge(i:{gameId:string;wagerEur:number;name:string;avatar:string}){return call({action:"create",...i}) as Promise<{challenge:FriendChallenge;token:string}>}
export async function getFriendChallenge(code:string){try{return (await call({action:"get",code})).challenge as FriendChallenge}catch{return null}}
export async function joinFriendChallenge(code:string,name:string,avatar:string){return call({action:"join",code,name,avatar}) as Promise<{challenge:FriendChallenge;token:string}>}
export async function submitFriendScore(code:string,token:string,score:number){return call({action:"submit",code,token,score}) as Promise<{challenge:FriendChallenge;winner:null|"creator"|"guest"|"tie"}>}
export function getFriendSession():FriendSession|null{if(typeof window==="undefined")return null;try{return JSON.parse(localStorage.getItem("altameta:friendChallenge")||"null")}catch{return null}}
export function setFriendSession(s:FriendSession){localStorage.setItem("altameta:friendChallenge",JSON.stringify(s))}
export function clearFriendSession(){localStorage.removeItem("altameta:friendChallenge")}
