// Demo-only virtual balance. Values are stored as integer cents to avoid floating-point errors.
// The old conversion is preserved: 100 Duel Coins = €1.00.

export const STARTING_BALANCE = 10_000; // €100.00
export const WAGER_OPTIONS_EUR = [1, 2, 5, 10, 20, 30, 50] as const;
export const DEFAULT_WAGER_EUR = 1;
export const EUR_TO_UNITS = 100;

export function eurosToUnits(euros: number): number {
  return Math.round(euros * EUR_TO_UNITS);
}

export function canAfford(balance: number, wagerEur: number): boolean {
  return balance >= eurosToUnits(wagerEur);
}

/** Amount returned after a win. The original demo economics are preserved:
 * the stake is deducted up front, then stake + 1.9x stake are returned.
 */
export function settlementAmount(won: boolean, wagerEur: number): number {
  const stake = eurosToUnits(wagerEur);
  return won ? stake + Math.round(stake * 1.9) : 0;
}

/** Net balance change for display/history. */
export function balanceDelta(won: boolean, wagerEur: number): number {
  const stake = eurosToUnits(wagerEur);
  return won ? Math.round(stake * 1.9) : -stake;
}

export function formatEuro(valueInUnits: number, signed = false): string {
  const euros = valueInUnits / EUR_TO_UNITS;
  const formatted = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: signed ? "always" : "auto",
  }).format(euros);
  return formatted;
}
