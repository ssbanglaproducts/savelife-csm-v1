import { Prisma, type PrismaClient } from "@/generated/prisma/client";

type Client = PrismaClient | Prisma.TransactionClient;

export function normalizeMemberId(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Reserve the next permanent Savelife Member ID.
 *
 * The upsert runs as one statement so concurrent registrations cannot receive
 * the same number. Draft reservations use this too, which is why an abandoned
 * draft can leave a harmless gap in the sequence.
 */
export async function allocateMemberId(client: Client): Promise<string> {
  const rows = await client.$queryRaw<Array<{ lastValue: number }>>`
    INSERT INTO "MemberSequence" ("id", "lastValue", "updatedAt")
    VALUES (1, 1, NOW())
    ON CONFLICT ("id") DO UPDATE
    SET "lastValue" = "MemberSequence"."lastValue" + 1, "updatedAt" = NOW()
    RETURNING "lastValue"
  `;

  const lastValue = rows[0]?.lastValue;
  if (!Number.isInteger(lastValue)) throw new Error("MEMBER_SEQUENCE_FAILED");
  return `SL${String(lastValue).padStart(6, "0")}`;
}
