import { arenaCall } from "./arena-client";
import type { LeaderboardEntry } from "./types";
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const response = (await arenaCall("leaderboard")) as unknown as {
    entries: LeaderboardEntry[];
  };
  return response.entries;
}
