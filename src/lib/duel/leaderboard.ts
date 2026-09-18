import type { LeaderboardEntry, PlayerProfile } from "./types";

// Deterministic seeded field so rankings are stable between visits.
const SEEDED: LeaderboardEntry[] = [
  { id: "s1", username: "APEX_ZERO", avatar: "🐉", rating: 1687, wins: 412 },
  { id: "s2", username: "kenji.exe", avatar: "🦊", rating: 1642, wins: 388 },
  { id: "s3", username: "VOLTAGE", avatar: "⚡", rating: 1610, wins: 355 },
  { id: "s4", username: "ghostpixel", avatar: "👾", rating: 1574, wins: 331 },
  { id: "s5", username: "RAZOR_9", avatar: "🦈", rating: 1541, wins: 309 },
  { id: "s6", username: "milo_sniper", avatar: "🎯", rating: 1508, wins: 288 },
  { id: "s7", username: "ZEN0", avatar: "🧘", rating: 1476, wins: 266 },
  { id: "s8", username: "BlueFangs", avatar: "🐺", rating: 1449, wins: 251 },
  { id: "s9", username: "quickdraw77", avatar: "🤠", rating: 1421, wins: 233 },
  { id: "s10", username: "AXIOM", avatar: "🤖", rating: 1398, wins: 214 },
  { id: "s11", username: "neonwolf", avatar: "🌙", rating: 1372, wins: 198 },
  { id: "s12", username: "TRIGGER", avatar: "🔫", rating: 1345, wins: 181 },
  { id: "s13", username: "Sora_TT", avatar: "🦅", rating: 1318, wins: 167 },
  { id: "s14", username: "PULSEBOY", avatar: "💗", rating: 1291, wins: 152 },
  { id: "s15", username: "hexgrid", avatar: "🧩", rating: 1263, wins: 140 },
  { id: "s16", username: "viper_ix", avatar: "🐍", rating: 1237, wins: 126 },
  { id: "s17", username: "NITRO", avatar: "🔥", rating: 1211, wins: 113 },
  { id: "s18", username: "lumen", avatar: "💡", rating: 1184, wins: 99 },
  { id: "s19", username: "skarn", avatar: "🦂", rating: 1156, wins: 84 },
  { id: "s20", username: "BYTEKNIGHT", avatar: "🛡️", rating: 1129, wins: 71 },
  { id: "s21", username: "echo_04", avatar: "🎧", rating: 1103, wins: 58 },
  { id: "s22", username: "rookie_rin", avatar: "🌱", rating: 1068, wins: 40 },
];

export function buildLeaderboard(profile: PlayerProfile): LeaderboardEntry[] {
  const me: LeaderboardEntry = {
    id: profile.id,
    username: profile.username,
    avatar: profile.avatar,
    rating: profile.rating,
    wins: profile.wins,
    isPlayer: true,
  };
  return [...SEEDED, me].sort((a, b) => b.rating - a.rating || b.wins - a.wins);
}
