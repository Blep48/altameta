const SUPABASE_URL = "https://uhazmkzewagtalbyzgcj.supabase.co";
const SUPABASE_KEY = "sb_publishable_Onsx-GUCZWzWmb93TsMbwQ_5hfJJCw3";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

export interface FriendChallenge {
 id:string; code:string; game_id:string; seed:number; wager_eur:number; creator_name:string; creator_avatar:string;
 creator_score:number|null; creator_finished_at:string|null; guest_name:string|null; guest_avatar:string|null;
 guest_score:number|null; guest_finished_at:string|null; created_at:string; expires_at:string;
}
function code(){return Array.from(crypto.getRandomValues(new Uint8Array(6))).map(n=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[n%32]).join("")}
export async function createFriendChallenge(input:{gameId:string;wagerEur:number;name:string;avatar:string}){
 const body={code:code(),game_id:input.gameId,seed:crypto.getRandomValues(new Uint32Array(1))[0],wager_eur:input.wagerEur,creator_name:input.name,creator_avatar:input.avatar};
 const r=await fetch(`${SUPABASE_URL}/rest/v1/friend_challenges`,{method:"POST",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify(body)});
 if(!r.ok)throw new Error("Could not create challenge"); return (await r.json())[0] as FriendChallenge;
}
export async function getFriendChallenge(challengeCode:string){const r=await fetch(`${SUPABASE_URL}/rest/v1/friend_challenges?code=eq.${encodeURIComponent(challengeCode)}&select=*`,{headers});if(!r.ok)throw new Error("Could not load challenge");return ((await r.json())[0]??null) as FriendChallenge|null}
export async function joinFriendChallenge(challengeCode:string,name:string,avatar:string){const r=await fetch(`${SUPABASE_URL}/rest/v1/friend_challenges?code=eq.${encodeURIComponent(challengeCode)}&guest_name=is.null`,{method:"PATCH",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify({guest_name:name,guest_avatar:avatar})});if(!r.ok)throw new Error("Could not join challenge");return ((await r.json())[0]??null) as FriendChallenge|null}
