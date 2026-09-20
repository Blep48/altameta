import {
  getFriendChallenge,
  submitFriendScore,
  type FriendSession,
} from "./friend-challenges";
export interface PendingScore extends FriendSession {
  score: number;
}
const key = (code: string) => "altameta:pendingScore:" + code;
const memory = new Map<string, PendingScore>();
export function getPendingScore(code: string): PendingScore | null {
  try {
    return (
      memory.get(code) ?? JSON.parse(localStorage.getItem(key(code)) || "null")
    );
  } catch {
    return memory.get(code) ?? null;
  }
}
export function savePendingScore(pending: PendingScore) {
  // Preserve the first completed run even if a request or navigation is retried.
  if (getPendingScore(pending.code)) return;
  memory.set(pending.code, pending);
  try {
    localStorage.setItem(key(pending.code), JSON.stringify(pending));
  } catch {
    /* Keep the run recoverable in this tab. */
  }
}
const inFlight = new Map<string, Promise<boolean>>();
export function retryPendingScore(code: string): Promise<boolean> {
  const existing = inFlight.get(code);
  if (existing) return existing;
  const pending = getPendingScore(code);
  if (!pending) return Promise.resolve(true);
  const task = (async () => {
    try {
      const ch = await getFriendChallenge(code);
      const recorded =
        pending.role === "creator" ? ch?.creator_score : ch?.guest_score;
      if (recorded == null)
        await submitFriendScore(code, pending.token, pending.score);
      else if (recorded !== pending.score)
        throw new Error("A different run has already been submitted");
      memory.delete(code);
      localStorage.removeItem(key(code));
      return true;
    } catch {
      return false;
    } finally {
      inFlight.delete(code);
    }
  })();
  inFlight.set(code, task);
  return task;
}
export function clearPendingScores() {
  memory.clear();
  inFlight.clear();
}
