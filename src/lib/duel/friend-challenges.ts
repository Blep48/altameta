import { accountStorage, accountKeys, accountScope } from "../account/store";
import { arenaCall } from "./arena-client";
export interface FriendChallenge {
  winner: "creator" | "guest" | "tie" | null;
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
  expiresAt?: string;
  code: string;
  token: string;
  role: "creator" | "guest";
  seed: number;
}
async function call(body: { action: string; [key: string]: unknown }) {
  const { action, ...fields } = body;
  let result;
  try {
    result = await arenaCall(action, fields);
  } catch (e) {
    throw new FriendChallengeError(
      e instanceof Error ? e.message : "Unavailable",
      (e as { status?: number }).status ?? 503,
    );
  }
  const c = result.challenge;
  if (c?.role)
    setFriendSession({
      code: c.code,
      token: "account",
      role: c.role,
      seed: c.seed,
      expiresAt: c.expires_at,
    });
  return { challenge: c, token: "account", winner: c?.winner ?? null };
}
export class FriendChallengeError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function isSessionCurrent(session: FriendSession, now = Date.now()) {
  return !!session.expiresAt && new Date(session.expiresAt).getTime() > now;
}

/** Refresh legacy sessions without treating a network error as expiration. */
export async function refreshFriendExpirations() {
  const scope = accountScope();
  const sessions = getFriendSessions();
  await Promise.all(
    Object.values(sessions).map(async (session) => {
      if (session.expiresAt) return;
      try {
        const challenge = await getFriendChallenge(session.code);
        if (accountScope() !== scope) return;
        setFriendSession({
          ...session,
          expiresAt: challenge?.expires_at ?? new Date(0).toISOString(),
        });
      } catch (e) {
        if (
          accountScope() === scope &&
          e instanceof FriendChallengeError &&
          e.status === 404
        )
          setFriendSession({
            ...session,
            expiresAt: new Date(0).toISOString(),
          });
      }
    }),
  );
}
export async function createFriendChallenge(i: {
  gameId: string;
  wagerEur: number;
  paymentMode: "demo" | "in_person";
  name: string;
  avatar: string;
}) {
  return call({
    action: "create",
    gameId: i.gameId,
    wagerEur: i.wagerEur,
    paymentMode: i.paymentMode,
  }) as Promise<{
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
  return call({ action: "join", code }) as Promise<{
    challenge: FriendChallenge;
    token: string;
  }>;
}
export async function submitFriendScore(
  _code: string,
  _token: string,
  _score: number,
): Promise<{
  challenge: FriendChallenge;
  winner: null | "creator" | "guest" | "tie";
}> {
  throw new Error("Score uploads are disabled. Play a server-verified match.");
}
const SESSIONS = "altameta:friendSessions:v1";
export function getFriendSessions(): Record<string, FriendSession> {
  if (typeof window === "undefined") return {};
  try {
    const all = JSON.parse(accountStorage.getItem(SESSIONS) || "{}");
    const old = JSON.parse(
      accountStorage.getItem("altameta:friendChallenge") || "null",
    );
    if (old?.code && !all[old.code]) all[old.code] = old;
    return Object.fromEntries(
      Object.entries(all).filter(
        ([, value]) => (value as FriendSession).token === "account",
      ),
    ) as Record<string, FriendSession>;
  } catch {
    return {};
  }
}
export function getFriendSession(code?: string): FriendSession | null {
  const all = getFriendSessions();
  if (code) return all[code] ?? null;
  try {
    const old = JSON.parse(
      accountStorage.getItem("altameta:friendChallenge") || "null",
    );
    return old?.code
      ? (all[old.code] ?? null)
      : (Object.values(all).at(-1) ?? null);
  } catch {
    return null;
  }
}
export function setFriendSession(s: FriendSession) {
  accountStorage.setItem(
    SESSIONS,
    JSON.stringify({ ...getFriendSessions(), [s.code]: s }),
  );
  accountStorage.setItem("altameta:friendChallenge", JSON.stringify(s));
}
export function clearFriendSessions() {
  accountStorage.removeItem(SESSIONS);
  accountStorage.removeItem("altameta:friendChallenge");
  for (const k of accountKeys())
    if (k.startsWith("altameta:pendingScore:")) accountStorage.removeItem(k);
}
