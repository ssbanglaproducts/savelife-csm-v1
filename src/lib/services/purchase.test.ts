import { describe, expect, it } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { LedgerEntryType as LedgerType } from "../../generated/prisma/enums";
import {
  createPaidOrder,
  type CreatePaidOrderInput,
  type PurchaseAddressSnapshot,
} from "./purchase";

type Data = Record<string, unknown>;
type MemberStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

type WalletRecord = {
  id: string;
  memberId: string;
  availablePaisa: bigint;
};

type MemberRecord = {
  id: string;
  memberId: string;
  fullName: string;
  phone: string;
  status: MemberStatus;
  activationDate?: Date | null;
};

type ProductRecord = { id: string; stock: number };

type AddressRecord = {
  id: string;
  memberId: string;
  label: string | null;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  thana: string | null;
  district: string | null;
  postalCode: string | null;
  country: string;
  isDefault: boolean;
};

type OrderRecord = {
  id: string;
  orderNumber: string;
  memberId: string;
  status: string;
  fulfillmentType: string;
  pickupStatus: string | null;
  requestKey: string | null;
  addressSnapshot: PurchaseAddressSnapshot;
  subtotalPaisa: bigint;
  totalPaisa: bigint;
  notes: string | null;
};

type OrderItemRecord = {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  unitPricePaisa: bigint;
  quantity: number;
  lineTotalPaisa: bigint;
};

type LedgerRecord = {
  id: string;
  walletId: string;
  memberId: string;
  amountPaisa: bigint;
  balanceAfterPaisa: bigint;
  idempotencyKey: string;
  type: string;
  category: string;
  direction: string;
  referenceType: string | null;
  referenceId: string | null;
};

type PaymentProofRecord = {
  id: string;
  orderId: string;
  memberId: string;
  method: string;
  transactionRef: string;
  amountPaisa: bigint;
  status: string;
};

type ActivationRecord = {
  id: string;
  memberId: string;
  orderId: string;
  activatedBy: string;
  note: string | null;
};

function applyUpdate(record: object, data: Data): void {
  const target = record as Data;
  for (const [field, value] of Object.entries(data)) {
    if (value && typeof value === "object" && !(value instanceof Date)) {
      const operation = value as Data;
      const current = target[field];
      if (typeof current === "bigint" && typeof operation.increment === "bigint") {
        target[field] = current + operation.increment;
      } else if (typeof current === "bigint" && typeof operation.decrement === "bigint") {
        target[field] = current - operation.decrement;
      } else if (typeof current === "number" && typeof operation.decrement === "number") {
        target[field] = current - operation.decrement;
      } else {
        target[field] = value;
      }
    } else {
      target[field] = value;
    }
  }
}

function selectFields<T extends object>(record: T, select: Data | undefined): Partial<T> {
  if (!select) return { ...record };
  return Object.fromEntries(
    Object.keys(select).filter((key) => select[key]).map((key) => [key, (record as Data)[key]]),
  ) as Partial<T>;
}

function uniqueViolation(): Error & { code: string } {
  return Object.assign(new Error("unique violation"), { code: "P2002" });
}

/** In-memory stand-in with transaction rollback, so failures leave no partial order. */
class FakePrisma {
  wallets: WalletRecord[] = [];
  members: MemberRecord[] = [];
  products: ProductRecord[] = [];
  addresses: AddressRecord[] = [];
  orders: OrderRecord[] = [];
  orderItems: OrderItemRecord[] = [];
  ledgerEntries: LedgerRecord[] = [];
  paymentProofs: PaymentProofRecord[] = [];
  activations: ActivationRecord[] = [];
  private sequence = 0;

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  asClient(): PrismaClient {
    return this as unknown as PrismaClient;
  }

  private snapshot() {
    return {
      wallets: this.wallets.map((item) => ({ ...item })),
      members: this.members.map((item) => ({ ...item })),
      products: this.products.map((item) => ({ ...item })),
      addresses: this.addresses.map((item) => ({ ...item })),
      orders: this.orders.map((item) => ({ ...item })),
      orderItems: this.orderItems.map((item) => ({ ...item })),
      ledgerEntries: this.ledgerEntries.map((item) => ({ ...item })),
      paymentProofs: this.paymentProofs.map((item) => ({ ...item })),
      activations: this.activations.map((item) => ({ ...item })),
      sequence: this.sequence,
    };
  }

  private restore(snapshot: ReturnType<FakePrisma["snapshot"]>): void {
    this.wallets = snapshot.wallets;
    this.members = snapshot.members;
    this.products = snapshot.products;
    this.addresses = snapshot.addresses;
    this.orders = snapshot.orders;
    this.orderItems = snapshot.orderItems;
    this.ledgerEntries = snapshot.ledgerEntries;
    this.paymentProofs = snapshot.paymentProofs;
    this.activations = snapshot.activations;
    this.sequence = snapshot.sequence;
  }

  async $transaction<T>(callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    const snapshot = this.snapshot();
    try {
      return await callback(this.asClient());
    } catch (error) {
      this.restore(snapshot);
      throw error;
    }
  }

  addMember(id: string, status: MemberStatus, overrides: Partial<MemberRecord> = {}): MemberRecord {
    const member: MemberRecord = {
      id,
      memberId: id.toUpperCase(),
      fullName: "Test Member",
      phone: "01700000000",
      status,
      ...overrides,
    };
    this.members.push(member);
    return member;
  }

  addWallet(memberId: string, availablePaisa: bigint): WalletRecord {
    const wallet: WalletRecord = { id: `wallet-${memberId}`, memberId, availablePaisa };
    this.wallets.push(wallet);
    return wallet;
  }

  addProduct(id: string, stock: number): ProductRecord {
    const product = { id, stock };
    this.products.push(product);
    return product;
  }

  addAddress(memberId: string, overrides: Partial<AddressRecord> = {}): AddressRecord {
    const address: AddressRecord = {
      id: this.nextId("address"),
      memberId,
      label: "HOME",
      fullName: "Test Member",
      phone: "01700000000",
      street: "Original street",
      city: "Dhaka",
      thana: "Khilgaon",
      district: "Dhaka",
      postalCode: "1000",
      country: "Bangladesh",
      isDefault: false,
      ...overrides,
    };
    this.addresses.push(address);
    return address;
  }

  wallet = {
    findUnique: async ({
      where,
      select,
    }: {
      where: { memberId: string };
      select?: Data;
    }): Promise<Partial<WalletRecord> | null> => {
      const found = this.wallets.find((item) => item.memberId === where.memberId);
      return found ? selectFields(found, select) : null;
    },
    update: async ({ where, data }: { where: { memberId: string }; data: Data }) => {
      const found = this.wallets.find((item) => item.memberId === where.memberId);
      if (!found) throw new Error("wallet not found");
      applyUpdate(found, data);
      return { ...found };
    },
  };

  member = {
    findUnique: async ({
      where,
      select,
    }: {
      where: { id: string };
      select?: Data;
    }): Promise<Partial<MemberRecord> | null> => {
      const found = this.members.find((item) => item.id === where.id);
      return found ? selectFields(found, select) : null;
    },
    update: async ({ where, data }: { where: { id: string }; data: Data }) => {
      const found = this.members.find((item) => item.id === where.id);
      if (!found) throw new Error("member not found");
      applyUpdate(found, data);
      return { ...found };
    },
  };

  product = {
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; stock?: { gte: number } };
      data: Data;
    }): Promise<{ count: number }> => {
      const found = this.products.find((item) => item.id === where.id);
      if (!found || (where.stock && found.stock < where.stock.gte)) return { count: 0 };
      applyUpdate(found, data);
      return { count: 1 };
    },
  };

  address = {
    findFirst: async ({
      where,
      select,
    }: {
      where: { id: string; memberId: string };
      select?: Data;
    }): Promise<Partial<AddressRecord> | null> => {
      const found = this.addresses.find(
        (item) => item.id === where.id && item.memberId === where.memberId,
      );
      return found ? selectFields(found, select) : null;
    },
    updateMany: async ({ where, data }: { where: { memberId: string }; data: Data }) => {
      const matches = this.addresses.filter((item) => item.memberId === where.memberId);
      for (const item of matches) applyUpdate(item, data);
      return { count: matches.length };
    },
    create: async ({ data, select }: { data: Data; select?: Data }) => {
      const address: AddressRecord = {
        id: this.nextId("address"),
        memberId: String(data.memberId),
        label: (data.label as string | null | undefined) ?? null,
        fullName: String(data.fullName),
        phone: String(data.phone),
        street: String(data.street),
        city: String(data.city),
        thana: (data.thana as string | null | undefined) ?? null,
        district: (data.district as string | null | undefined) ?? null,
        postalCode: (data.postalCode as string | null | undefined) ?? null,
        country: String(data.country ?? "Bangladesh"),
        isDefault: Boolean(data.isDefault),
      };
      this.addresses.push(address);
      return selectFields(address, select);
    },
  };

  order = {
    findUnique: async ({
      where,
      select,
    }: {
      where: { requestKey?: string; id?: string };
      select?: Data;
    }): Promise<Partial<OrderRecord> | null> => {
      const found = this.orders.find((item) =>
        where.requestKey !== undefined
          ? item.requestKey === where.requestKey
          : item.id === where.id,
      );
      return found ? selectFields(found, select) : null;
    },
    create: async ({ data, select }: { data: Data; select?: Data }) => {
      const order: OrderRecord = {
        id: this.nextId("order"),
        orderNumber: String(data.orderNumber),
        memberId: String(data.memberId),
        status: String(data.status),
        fulfillmentType: String(data.fulfillmentType),
        pickupStatus: (data.pickupStatus as string | null | undefined) ?? null,
        requestKey: (data.requestKey as string | null | undefined) ?? null,
        addressSnapshot: data.addressSnapshot as PurchaseAddressSnapshot,
        subtotalPaisa: data.subtotalPaisa as bigint,
        totalPaisa: data.totalPaisa as bigint,
        notes: (data.notes as string | null | undefined) ?? null,
      };
      this.orders.push(order);

      const items = ((data.items as Data)?.create ?? []) as Data[];
      for (const item of items) {
        this.orderItems.push({
          id: this.nextId("item"),
          orderId: order.id,
          productId: (item.productId as string | null | undefined) ?? null,
          productName: String(item.productName),
          unitPricePaisa: item.unitPricePaisa as bigint,
          quantity: item.quantity as number,
          lineTotalPaisa: item.lineTotalPaisa as bigint,
        });
      }

      const proof = (data.paymentProofs as Data)?.create as Data | undefined;
      if (proof) {
        this.paymentProofs.push({
          id: this.nextId("proof"),
          orderId: order.id,
          memberId: String(proof.memberId),
          method: String(proof.method),
          transactionRef: String(proof.transactionRef),
          amountPaisa: proof.amountPaisa as bigint,
          status: String(proof.status),
        });
      }

      return selectFields(order, select);
    },
  };

  ledgerEntry = {
    findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
      this.ledgerEntries.find((entry) => entry.idempotencyKey === where.idempotencyKey) ?? null,
    create: async ({ data }: { data: Data }) => {
      if (this.ledgerEntries.some((entry) => entry.idempotencyKey === data.idempotencyKey)) {
        throw uniqueViolation();
      }
      const entry: LedgerRecord = {
        id: this.nextId("ledger"),
        walletId: String(data.walletId),
        memberId: String(data.memberId),
        amountPaisa: data.amountPaisa as bigint,
        balanceAfterPaisa: data.balanceAfterPaisa as bigint,
        idempotencyKey: String(data.idempotencyKey),
        type: String(data.type),
        category: String(data.category),
        direction: String(data.direction),
        referenceType: (data.referenceType as string | null | undefined) ?? null,
        referenceId: (data.referenceId as string | null | undefined) ?? null,
      };
      this.ledgerEntries.push(entry);
      return entry;
    },
  };

  activationHistory = {
    findUnique: async ({ where }: { where: { memberId: string } }) =>
      this.activations.find((item) => item.memberId === where.memberId) ?? null,
    create: async ({ data }: { data: Data }) => {
      const activation: ActivationRecord = {
        id: this.nextId("activation"),
        memberId: String(data.memberId),
        orderId: String(data.orderId),
        activatedBy: String(data.activatedBy),
        note: (data.note as string | null | undefined) ?? null,
      };
      this.activations.push(activation);
      return activation;
    },
  };
}

const memberId = "member-1";
const activationProductId = "product-activation";
const activationCost = 42_000n;

function activationInput(idempotencyKey: string): CreatePaidOrderInput {
  return {
    memberId,
    fulfillment: "OFFICE_PICKUP",
    idempotencyKey,
    address: { mode: "office", fullName: "Test Member", phone: "01700000000" },
    items: [
      {
        productId: activationProductId,
        productName: "Activation Pack",
        productImage: null,
        unitPricePaisa: activationCost,
        quantity: 1,
        dbProduct: { id: activationProductId, stock: 5 },
      },
    ],
  };
}

function inactiveDb(): FakePrisma {
  const db = new FakePrisma();
  db.addMember(memberId, "INACTIVE", { fullName: "Test Member", phone: "01700000000" });
  db.addWallet(memberId, 100_000n);
  db.addProduct(activationProductId, 5);
  return db;
}

describe("createPaidOrder", () => {
  it("debits SP, creates an office pickup order and activates the member atomically", async () => {
    const db = inactiveDb();

    const result = await createPaidOrder(db.asClient(), activationInput("activation-1"));

    expect(result.duplicate).toBe(false);
    expect(result.activated).toBe(true);
    expect(result.availablePaisa).toBe(58_000n);
    expect(result.totalPaisa).toBe(activationCost);

    const [order] = db.orders;
    expect(order).toMatchObject({
      status: "CONFIRMED",
      fulfillmentType: "OFFICE_PICKUP",
      pickupStatus: "PENDING",
      requestKey: "activation-1",
    });
    expect(order.addressSnapshot).toMatchObject({
      id: null,
      label: "OFFICE",
      fullName: "Test Member",
      phone: "01700000000",
    });
    expect(db.addresses).toHaveLength(0);
    expect(db.products[0].stock).toBe(4);
    expect(db.paymentProofs[0]).toMatchObject({
      method: "WALLET",
      status: "APPROVED",
      transactionRef: "order-wallet-payment:activation-1",
    });
    expect(db.ledgerEntries[0]).toMatchObject({
      type: LedgerType.ORDER_WALLET_PAYMENT,
      amountPaisa: activationCost,
      balanceAfterPaisa: 58_000n,
      idempotencyKey: "order-wallet-payment:activation-1",
    });
    expect(db.members[0].status).toBe("ACTIVE");
    expect(db.activations[0]).toMatchObject({ memberId, orderId: order.id });
  });

  it("rolls back the stock claim and never creates an order or charge when SP is short", async () => {
    const db = inactiveDb();
    db.wallets[0].availablePaisa = 1_000n;

    await expect(createPaidOrder(db.asClient(), activationInput("short-balance"))).rejects.toThrow(
      "INSUFFICIENT_BALANCE",
    );

    expect(db.orders).toHaveLength(0);
    expect(db.orderItems).toHaveLength(0);
    expect(db.paymentProofs).toHaveLength(0);
    expect(db.ledgerEntries).toHaveLength(0);
    expect(db.activations).toHaveLength(0);
    expect(db.wallets[0].availablePaisa).toBe(1_000n);
    expect(db.products[0].stock).toBe(5);
    expect(db.members[0].status).toBe("INACTIVE");
  });

  it("returns the original order for a replayed request without a second charge", async () => {
    const db = inactiveDb();
    const first = await createPaidOrder(db.asClient(), activationInput("duplicate-1"));
    const second = await createPaidOrder(db.asClient(), activationInput("duplicate-1"));

    expect(second.duplicate).toBe(true);
    expect(second.order).toEqual(first.order);
    expect(second.availablePaisa).toBe(first.availablePaisa);
    expect(second.activated).toBe(false);
    expect(db.orders).toHaveLength(1);
    expect(db.ledgerEntries).toHaveLength(1);
    expect(db.paymentProofs).toHaveLength(1);
    expect(db.activations).toHaveLength(1);
    expect(db.wallets[0].availablePaisa).toBe(58_000n);
    expect(db.products[0].stock).toBe(4);
  });

  it("keeps office pickup and home delivery eligibility separate", async () => {
    const activeDb = new FakePrisma();
    activeDb.addMember(memberId, "ACTIVE");
    activeDb.addWallet(memberId, 100_000n);
    activeDb.addProduct(activationProductId, 5);

    await expect(
      createPaidOrder(activeDb.asClient(), activationInput("wrong-pickup")),
    ).rejects.toThrow("ACTIVATION_NOT_ELIGIBLE");
    expect(activeDb.orders).toHaveLength(0);
    expect(activeDb.wallets[0].availablePaisa).toBe(100_000n);

    await expect(
      createPaidOrder(inactiveDb().asClient(), {
        ...activationInput("wrong-delivery"),
        fulfillment: "HOME_DELIVERY",
      }),
    ).rejects.toThrow("MEMBER_NOT_ACTIVE");
  });

  it("stores a permanent address snapshot that survives changes to the saved address", async () => {
    const db = new FakePrisma();
    db.addMember(memberId, "ACTIVE");
    db.addWallet(memberId, 100_000n);
    db.addProduct(activationProductId, 5);
    const address = db.addAddress(memberId, { id: "address-1", label: "HOME" });

    const result = await createPaidOrder(db.asClient(), {
      ...activationInput("delivery-1"),
      fulfillment: "HOME_DELIVERY",
      address: { mode: "existing", addressId: address.id },
    });

    expect(result.activated).toBe(false);
    const [order] = db.orders;
    expect(order).toMatchObject({
      fulfillmentType: "HOME_DELIVERY",
      pickupStatus: null,
      status: "CONFIRMED",
    });
    expect(result.addressSnapshot).toMatchObject({
      id: "address-1",
      label: "HOME",
      street: "Original street",
      thana: "Khilgaon",
      district: "Dhaka",
    });

    address.street = "Moved elsewhere";
    db.addresses.splice(0, 1);

    expect(order.addressSnapshot.street).toBe("Original street");
    expect(db.activations).toHaveLength(0);
  });

  it("uses one address snapshot for every line in a multi-product cart checkout", async () => {
    const db = new FakePrisma();
    db.addMember(memberId, "ACTIVE");
    db.addWallet(memberId, 100_000n);
    db.addProduct("product-a", 10);
    db.addProduct("product-b", 10);

    const result = await createPaidOrder(db.asClient(), {
      memberId,
      fulfillment: "HOME_DELIVERY",
      idempotencyKey: "cart-1",
      address: {
        mode: "new",
        label: "OFFICE",
        fullName: "Test Member",
        phone: "01700000000",
        street: "12 Office Road",
        thana: "Khilgaon",
        district: "Dhaka",
        postalCode: "1000",
        isMain: true,
      },
      items: [
        {
          productId: "product-a",
          productName: "First product",
          productImage: null,
          unitPricePaisa: 10_000n,
          quantity: 2,
          dbProduct: { id: "product-a", stock: 10 },
        },
        {
          productId: "product-b",
          productName: "Second product",
          productImage: null,
          unitPricePaisa: 5_000n,
          quantity: 1,
          dbProduct: { id: "product-b", stock: 10 },
        },
      ],
    });

    expect(result.totalPaisa).toBe(25_000n);
    expect(result.availablePaisa).toBe(75_000n);
    expect(db.orders).toHaveLength(1);
    expect(db.orderItems).toHaveLength(2);
    expect(db.orderItems.every((item) => item.orderId === db.orders[0].id)).toBe(true);
    expect(db.orderItems.map((item) => item.lineTotalPaisa)).toEqual([20_000n, 5_000n]);
    expect(db.addresses).toHaveLength(1);
    expect(db.addresses[0].isDefault).toBe(true);
    expect(result.addressSnapshot).toMatchObject({
      id: db.addresses[0].id,
      label: "OFFICE",
      street: "12 Office Road",
    });
    expect(db.ledgerEntries).toHaveLength(1);
    expect(db.activations).toHaveLength(0);
  });
});
