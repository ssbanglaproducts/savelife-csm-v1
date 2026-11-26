import type { MemberStatus } from "@/lib/viewer";

/** Pure rules that decide which storefront purchase experience a member sees. */
export type BuyNowMode = "activation" | "delivery" | "hidden";

/**
 * INACTIVE members activate by buying any in-stock product with office pickup.
 * ACTIVE members buy any product with delivery. Guests and SUSPENDED accounts
 * keep the legacy storefront behaviour (no direct Buy Now flow).
 */
export function buyNowMode(status: MemberStatus | null | undefined): BuyNowMode {
  if (status === "INACTIVE") return "activation";
  if (status === "ACTIVE") return "delivery";
  return "hidden";
}

export type ActivationGuidanceState = "empty" | "insufficient" | "ready";

/** Chooses the activation guidance shown before an inactive member shops. */
export function activationGuidanceState(
  availablePaisa: bigint,
  requiredPaisa?: bigint,
): ActivationGuidanceState {
  if (availablePaisa <= 0n) return "empty";
  if (requiredPaisa !== undefined && availablePaisa < requiredPaisa) return "insufficient";
  return "ready";
}

/** Cart and checkout are only available to ACTIVE members and guests. */
export function canUseCart(status: MemberStatus | null | undefined): boolean {
  return status !== "INACTIVE" && status !== "SUSPENDED";
}

/** Remaining Available Balance after a purchase. Never negative for a valid purchase. */
export function remainingBalancePaisa(availablePaisa: bigint, totalPaisa: bigint): bigint {
  return availablePaisa - totalPaisa;
}

/** True only when the Available Balance covers the full order total. */
export function hasSufficientBalance(availablePaisa: bigint, totalPaisa: bigint): boolean {
  return totalPaisa > 0n && availablePaisa >= totalPaisa;
}
