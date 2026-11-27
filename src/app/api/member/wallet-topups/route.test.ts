import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  notifyTopUpRequested: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    walletTopUp: {
      findFirst: mocks.findFirst,
      create: mocks.create,
    },
  },
}));
vi.mock("@/lib/services/notification-events", () => ({
  notifyTopUpRequested: mocks.notifyTopUpRequested,
}));

import { POST } from "./route";

const MEMBER_ID = "member-1";
const BODY = {
  amount: "100.00",
  method: "BKASH",
  transactionRef: "TX-123456",
  proofImageUrl: "",
  note: "",
};

function request(body: unknown = BODY) {
  return new Request("http://localhost/api/member/wallet-topups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/member/wallet-topups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: MEMBER_ID, role: "MEMBER" } });
    mocks.findFirst.mockResolvedValue(null);
    mocks.create.mockResolvedValue({
      id: "topup-1",
      requestNumber: "SL-TU-1",
      status: "PENDING",
    });
  });

  it("rejects a replayed pending or approved payment reference with 409 DUPLICATE", async () => {
    mocks.findFirst.mockResolvedValue({ id: "existing-topup" });

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "DUPLICATE" });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        memberId: MEMBER_ID,
        method: "BKASH",
        transactionRef: "TX-123456",
        status: { in: ["PENDING", "APPROVED"] },
      },
      select: { id: true },
    });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.notifyTopUpRequested).not.toHaveBeenCalled();
  });

  it("maps a concurrent unique-index collision to the same stable error", async () => {
    mocks.create.mockRejectedValue(Object.assign(new Error("duplicate key"), { code: "P2002" }));

    const response = await POST(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "DUPLICATE" });
    expect(mocks.notifyTopUpRequested).not.toHaveBeenCalled();
  });

  it("creates a new request and sends the notification for an unused reference", async () => {
    const response = await POST(request());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      request: { requestNumber: "SL-TU-1", status: "PENDING" },
    });
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memberId: MEMBER_ID,
          method: "BKASH",
          transactionRef: "TX-123456",
          amountPaisa: 10_000n,
        }),
      }),
    );
    expect(mocks.notifyTopUpRequested).toHaveBeenCalledWith(MEMBER_ID, "SL-TU-1", 10_000n);
  });
});
