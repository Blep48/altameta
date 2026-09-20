import type { MatchMode, MatchOutcome, PlayerProfile } from "./types";
import type { LadderRun } from "./ladder";
import { eurosToUnits, WAGER_OPTIONS_EUR } from "./economy";

export interface Entry {
  id: string;
  units: number;
  mode: MatchMode;
}
export interface Account {
  version: 1;
  profile: PlayerProfile;
  history: MatchOutcome[];
  ladder: LadderRun | null;
  entry: Entry | null;
  reserved: Record<string, number>;
  settled: string[];
}
export const newAccount = (profile: PlayerProfile): Account => ({
  version: 1,
  profile,
  history: [],
  ladder: null,
  entry: null,
  reserved: {},
  settled: [],
});
export function validWager(amount: number) {
  return (
    Number.isFinite(amount) &&
    (WAGER_OPTIONS_EUR as readonly number[]).includes(amount)
  );
}
export function chargeEntry(
  account: Account,
  id: string,
  wager: number,
  mode: MatchMode,
): Account {
  if (account.entry) throw new Error("A match is already in progress");
  if (!validWager(wager)) throw new Error("Invalid stake");
  const units = eurosToUnits(wager);
  if (account.profile.coins < units) throw new Error("Not enough demo balance");
  return {
    ...account,
    profile: { ...account.profile, coins: account.profile.coins - units },
    entry: { id, units, mode },
  };
}
export function refundEntry(account: Account, id?: string): Account {
  if (!account.entry || (id && account.entry.id !== id)) return account;
  return {
    ...account,
    profile: {
      ...account.profile,
      coins: account.profile.coins + account.entry.units,
    },
    ladder:
      account.entry.mode === "ladder" && account.ladder?.streak === 0
        ? null
        : account.ladder,
    entry: null,
  };
}
export function reserveFriend(
  account: Account,
  code: string,
  wager: number,
): Account {
  if (account.reserved[code] != null || account.settled.includes(code))
    return account;
  if (!validWager(wager)) throw new Error("Invalid stake");
  const units = eurosToUnits(wager);
  if (account.profile.coins < units) throw new Error("Not enough demo balance");
  return {
    ...account,
    profile: { ...account.profile, coins: account.profile.coins - units },
    reserved: { ...account.reserved, [code]: units },
  };
}
export function releaseFriend(account: Account, code: string): Account {
  const units = account.reserved[code];
  if (units == null) return account;
  const reserved = { ...account.reserved };
  delete reserved[code];
  return {
    ...account,
    reserved,
    profile: { ...account.profile, coins: account.profile.coins + units },
  };
}
/** A single snapshot is persisted for balance + history + settlement marker. */
export function recordOutcome(
  account: Account,
  outcome: MatchOutcome,
  profile: PlayerProfile,
): Account {
  if (account.history.some((x) => x.id === outcome.id)) return account;
  return {
    ...account,
    profile,
    entry: null,
    history: [outcome, ...account.history].slice(0, 50),
  };
}
