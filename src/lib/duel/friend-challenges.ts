const URL =
  "https://uhazmkzewagtalbyzgcj.supabase.co/functions/v1/friend-challenge";
const KEY = "sb_publishable_Onsx-GUCZWzWmb93TsMbwQ_5hfJJCw3";
export interface FriendChallenge {
  id: string;
  code: string;
  game_id: string;
  seed: number;
  wager_eur: number;
  creator_name: string;
  creator_avatar: string;
  creator_score: number | null;
  creator_finished_at: string | null;
  guest_name: string | null;
  guest_avatar: string | null;
  guest_score: number | null;
  guest_finished_at: string | null;
  created_at: string;
  expires_at: string;
  score_mode: "high" | "low";
  payment_mode: "demo" | "in_person";
}
export interface FriendSession {
  code: string;
  token: string;
  role: "creator" | "guest";
  seed: number;
}
async function call(body: unknown) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Friend challenge error");
  return j;
}
export async function createFriendChallenge(i: {
  gameId: string;
  wagerEur: number;
  paymentMode: "demo" | "in_person";
  name: string;
  avatar: string;
}) {
  return call({ action: "create", ...i }) as Promise<{
    challenge: FriendChallenge;
    token: string;
  }>;
}
export async function getFriendChallenge(code: string) {
  return (await call({ action: "get", code }))
    .challenge as FriendChallenge | null;
}
export async function joinFriendChallenge(
  code: string,
  name: string,
  avatar: string,
) {
  return call({ action: "join", code, name, avatar }) as Promise<{
    challenge: FriendChallenge;
    token: string;
  }>;
}
export async function submitFriendScore(
  code: string,
  token: string,
  score: number,
) {
  return call({ action: "submit", code, token, score }) as Promise<{
    challenge: FriendChallenge;
    winner: null | "creator" | "guest" | "tie";
  }>;
}
const SESSIONS = "altameta:friendSessions:v1";
export function getFriendSessions(): Record<string, FriendSession> {
  if (typeof window === "undefined") return {};
  try {
    const all = JSON.parse(localStorage.getItem(SESSIONS) || "{}");
    const old = JSON.parse(
      localStorage.getItem("altameta:friendChallenge") || "null",
    );
    if (old?.code && !all[old.code]) all[old.code] = old;
    return all;
  } catch {
    return {};
  }
}
export function getFriendSession(code?: string): FriendSession | null {
  const all = getFriendSessions();
  if (code) return all[code] ?? null;
  try {
    const old = JSON.parse(
      localStorage.getItem("altameta:friendChallenge") || "null",
    );
    return old?.code
      ? (all[old.code] ?? null)
      : (Object.values(all).at(-1) ?? null);
  } catch {
    return null;
  }
}
export function setFriendSession(s: FriendSession) {
  localStorage.setItem(
    SESSIONS,
    JSON.stringify({ ...getFriendSessions(), [s.code]: s }),
  );
  localStorage.setItem("altameta:friendChallenge", JSON.stringify(s));
}
export function clearFriendSessions() {
  localStorage.removeItem(SESSIONS);
  localStorage.removeItem("altameta:friendChallenge");
  for (const k of Object.keys(localStorage))
    if (k.startsWith("altameta:pendingScore:")) localStorage.removeItem(k);
}
