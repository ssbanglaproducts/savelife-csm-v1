import { describe, expect, it } from "vitest";
import {
  activationGuidanceState,
  buyNowMode,
  canUseCart,
  hasSufficientBalance,
  remainingBalancePaisa,
} from "./purchase-rules";
import { orderStatusKey } from "@/components/member/status-labels";

describe("status-driven storefront rules", () => {
  it("lets inactive members buy any product for activation", () => {
    expect(buyNowMode("INACTIVE")).toBe("activation");
  });

  it("offers direct delivery to active members", () => {
    expect(buyNowMode("ACTIVE")).toBe("delivery");
  });

  it("hides direct purchase for guests and suspended members", () => {
    expect(buyNowMode(null)).toBe("hidden");
    expect(buyNowMode("SUSPENDED")).toBe("hidden");
  });

  it("restricts cart and checkout to active members and guests", () => {
    expect(canUseCart("INACTIVE")).toBe(false);
    expect(canUseCart("SUSPENDED")).toBe(false);
    expect(canUseCart("ACTIVE")).toBe(true);
    expect(canUseCart(null)).toBe(true);
  });
});

describe("activation guidance", () => {
  it("asks for SP when the balance is zero", () => {
    expect(activationGuidanceState(0n)).toBe("empty");
    expect(activationGuidanceState(0n, 100n)).toBe("empty");
  });

  it("asks for more SP when a chosen item costs more than the balance", () => {
    expect(activationGuidanceState(500n, 1_000n)).toBe("insufficient");
  });

  it("sends funded members to the store", () => {
    expect(activationGuidanceState(1_000n, 1_000n)).toBe("ready");
    expect(activationGuidanceState(1_000n)).toBe("ready");
  });
});

describe("wallet balance checks", () => {
  it("requires the full order total to be covered", () => {
    expect(hasSufficientBalance(1_000n, 1_000n)).toBe(true);
    expect(hasSufficientBalance(999n, 1_000n)).toBe(false);
    expect(hasSufficientBalance(1_000n, 0n)).toBe(false);
  });

  it("never reports a negative remaining balance for a valid purchase", () => {
    expect(remainingBalancePaisa(1_500n, 1_000n)).toBe(500n);
    expect(remainingBalancePaisa(1_000n, 1_000n)).toBe(0n);
  });
});

describe("fulfillment-aware status labels", () => {
  it("labels delivery and pickup milestones distinctly", () => {
    expect(orderStatusKey("OUT_FOR_DELIVERY")).toBe("orderStatusOutForDelivery");
    expect(orderStatusKey("PICKED_UP")).toBe("pickedUp");
    expect(orderStatusKey("SHIPPED")).toBe("orderStatusShipped");
  });
});
