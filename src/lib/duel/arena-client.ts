import { supabase, SUPABASE_KEY, SUPABASE_URL } from "../account/client";
import { accountScope } from "../account/store";
import type { Account } from "./ledger";
import type { ActiveMatch, MatchOutcome } from "./types";
import type { Engine } from "../../../supabase/functions/_shared/arena-engine";
import type { FriendChallenge } from "./friend-challenges";
export interface ArenaView {
  revision: number;
  sessions?: {
    code: string;
    token: string;
    role: "creator" | "guest";
    seed: number;
    expiresAt: string;
  }[];
  serverTime: number;
  account: Account;
  activeMatch: ActiveMatch | null;
  lastOutcome: MatchOutcome | null;
  engine: Engine | null;
  seq: number;
  challenge:
    | (FriendChallenge & {
        role: "creator" | "guest" | null;
        token: string | null;
        winner: "creator" | "guest" | "tie" | null;
      })
    | null;
}
const listeners = new Set<(view: ArenaView) => void>();
export const publishArenaView = (view: ArenaView) => {
  for (const listener of listeners) listener(view);
};
export const onArenaView = (listener: (view: ArenaView) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export async function arenaCall(
  action: string,
  fields: Record<string, unknown> = {},
  requestId = crypto.randomUUID(),
): Promise<ArenaView> {
  const scope = accountScope();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session || session.user.id !== scope)
    throw new Error("Please log in again");
  const body = JSON.stringify({ ...fields, id: requestId, action });
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (accountScope() !== scope) throw new Error("Account changed");
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/arena`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body,
        signal: AbortSignal.timeout(12000),
      });
      const result = await response.json();
      if (!response.ok) {
        const error = new Error(result.error || "Server unavailable");
        if (
          response.status >= 500 ||
          result.error?.startsWith("Concurrent update")
        ) {
          last = error;
          continue;
        }
        throw Object.assign(error, { terminal: true, status: response.status });
      }
      if (accountScope() !== scope)
        throw Object.assign(new Error("Account changed"), { terminal: true });
      if (result.account) publishArenaView(result);
      return result;
    } catch (e) {
      last = e;
      if ((e as { terminal?: boolean }).terminal) throw e;
    }
  }
  throw last instanceof Error ? last : new Error("Connection unavailable");
}
