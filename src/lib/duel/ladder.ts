import { accountStorage, accountKeys } from "../account/store";
import { PAYOUT_RATE } from "./economy";
export interface LadderRun {
  gameId: string;
  wagerEur: number;
  streak: number;
  active: boolean;
  lost?: boolean;
}
const KEY = "altameta:ladder";
export const LADDER_PAYOUT_RATE = PAYOUT_RATE;
export const LADDER_FEE_RATE = 1 - LADDER_PAYOUT_RATE;
export const ladderGrossMultiplier = (streak: number) =>
  Math.pow(2, Math.max(0, streak));
export const ladderMultiplier = (streak: number) =>
  ladderGrossMultiplier(streak) * LADDER_PAYOUT_RATE;
export const ladderEliminations = (streak: number) =>
  ladderGrossMultiplier(streak) - 1;
export const ladderPrizeUnits = (run: LadderRun) =>
  Math.round(run.wagerEur * 100 * ladderMultiplier(run.streak));
export const ladderFeeUnits = (run: LadderRun) =>
  Math.round(
    run.wagerEur * 100 * ladderGrossMultiplier(run.streak) * LADDER_FEE_RATE,
  );
export function readLadder(): LadderRun | null {
  if (typeof window === "undefined") return null;
  try {
    const x = JSON.parse(accountStorage.getItem(KEY) || "null");
    return x && typeof x.gameId === "string" ? x : null;
  } catch {
    return null;
  }
}
export function writeLadder(run: LadderRun | null) {
  if (typeof window === "undefined") return;
  if (run) accountStorage.setItem(KEY, JSON.stringify(run));
  else accountStorage.removeItem(KEY);
}
