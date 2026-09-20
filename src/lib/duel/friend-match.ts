import type { ActiveMatch } from "./types";
import { savePendingScore, retryPendingScore } from "./pending-score";
export async function submitIfFriend(match: ActiveMatch | null, score: number) {
  if (!match?.friend) return false;
  savePendingScore({ ...match.friend, seed: match.seed, score });
  return retryPendingScore(match.friend.code);
}
