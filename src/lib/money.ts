/**
 * All monetary values are integer paisa (1 SP = 100 paisa) stored as bigint.
 * One Save Point (SP) is equal to one taka; amounts are always shown in SP.
 * Never use floating point for money calculations.
 */

export type Paisa = bigint;

export function spToPaisa(sp: number | string): Paisa {
  const value = typeof sp === "string" ? sp.trim() : sp.toString();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error(`Invalid SP amount: ${sp}`);
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0") || "0");
}

export function paisaToSP(paisa: Paisa): string {
  const negative = paisa < 0n;
  const absolute = negative ? -paisa : paisa;
  const whole = absolute / 100n;
  const fraction = absolute % 100n;
  // Intl.NumberFormat accepts bigint directly, so grouping stays exact for
  // amounts larger than Number.MAX_SAFE_INTEGER.
  const grouped = new Intl.NumberFormat("en-BD", { useGrouping: true }).format(whole);
  const decimals = fraction === 0n ? "" : `.${fraction.toString().padStart(2, "0")}`;
  return `${negative ? "-" : ""}${grouped}${decimals}`;
}

/** Formats an amount for display as Save Points, e.g. 50000n -> "500 SP". */
export function formatSP(paisa: Paisa): string {
  return `${paisaToSP(paisa)} SP`;
}

/**
 * Formats a catalog price in Bangladeshi taka. SP balances stay in SP; only
 * product prices use the taka symbol, e.g. 50000n -> "৳500" in both locales.
 */
export function formatTaka(paisa: Paisa, locale: string): string {
  const value = formatSP(paisa).replace(/ SP$/, "");
  void locale; // The ৳ symbol is shared by English and Bangla Store locales.
  return `৳${value}`;
}

/** Plain, ungrouped SP value for form payloads, e.g. 10000000n -> "100000". */
export function paisaToSPInput(paisa: Paisa): string {
  const fraction = paisa % 100n;
  return `${paisa / 100n}${fraction === 0n ? "" : `.${fraction.toString().padStart(2, "0")}`}`;
}

/** Basis points: 10000 = 100%, 1000 = 10%, 500 = 5%. */
export function applyBps(amount: Paisa, bps: number): Paisa {
  return (amount * BigInt(bps)) / 10000n;
}

export function sumPaisa(values: Paisa[]): Paisa {
  return values.reduce((total, value) => total + value, 0n);
}

/**
 * Proportional allocation using the largest-remainder method.
 * Guarantees the returned shares sum exactly to `total`.
 * Deterministic: ties are resolved by original index order.
 */
export function allocateProportionally(total: Paisa, weights: Paisa[]): Paisa[] {
  if (weights.length === 0) return [];
  const totalWeight = sumPaisa(weights);
  if (totalWeight <= 0n) throw new Error("Total weight must be positive");

  const numerators = weights.map((weight) => weight * total);
  const shares = numerators.map((numerator) => numerator / totalWeight);
  const remainders = numerators.map((numerator, i) => numerator - shares[i] * totalWeight);

  const ordered = remainders
    .map((remainder, index) => ({ remainder, index }))
    .sort((a, b) => (a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1));

  let leftover = total - sumPaisa(shares);
  for (const { index } of ordered) {
    if (leftover <= 0n) break;
    shares[index] += 1n;
    leftover -= 1n;
  }

  return shares;
}
