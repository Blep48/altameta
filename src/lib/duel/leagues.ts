export const LEAGUE_STEP = 200;
export const LEAGUES = [
  "BRONZE I",
  "BRONZE II",
  "BRONZE III",
  "SILVER I",
  "SILVER II",
  "SILVER III",
  "GOLD I",
  "GOLD II",
  "GOLD III",
  "PLATINUM I",
  "PLATINUM II",
  "PLATINUM III",
  "DIAMOND I",
  "DIAMOND II",
  "DIAMOND III",
  "ALTAMETA",
] as const;
export type LeagueName = (typeof LEAGUES)[number];
export function leagueIndexForRating(rating: number) {
  return Math.min(
    LEAGUES.length - 1,
    Math.max(0, Math.floor(Math.max(0, rating) / LEAGUE_STEP)),
  );
}
export function leagueForIndex(index: number): LeagueName {
  return LEAGUES[Math.min(LEAGUES.length - 1, Math.max(0, index))]!;
}
export function leagueForRating(rating: number): LeagueName {
  return leagueForIndex(leagueIndexForRating(rating));
}
export function leagueFloor(index: number) {
  return Math.max(0, index) * LEAGUE_STEP;
}
export function isEliteLeague(index: number) {
  return index >= LEAGUES.indexOf("DIAMOND I");
}
export function peakLeagueIndex(rating: number, storedPeak?: number) {
  return Math.max(storedPeak ?? 0, leagueIndexForRating(rating));
}
export function botRatingWindow(
  playerRating: number,
  peakIndex: number,
): [number, number] {
  if (isEliteLeague(peakIndex))
    return [
      leagueFloor(LEAGUES.indexOf("DIAMOND I")),
      leagueFloor(LEAGUES.length) + 199,
    ];
  const floor = leagueFloor(Math.max(0, peakIndex - 1)),
    ceiling = leagueFloor(Math.min(LEAGUES.length - 1, peakIndex + 1)) + 199;
  const min = Math.max(floor, Math.min(ceiling, playerRating - 140));
  return [min, Math.max(min, Math.min(ceiling, playerRating + 140))];
}
