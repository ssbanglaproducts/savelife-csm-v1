import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { PlacementSlot } from "./services/placement";

type Client = PrismaClient | Prisma.TransactionClient;

export type CloneSource = {
  email: string;
  phone: string;
  passwordHash: string;
  tPinHash: string | null;
  tPinUpdatedAt: Date | null;
};

/**
 * Explicit allowlist for clone creation. Sign-in credentials are carried over,
 * while the member name and optional profile picture come from the clone form.
 * Activation status and every relationship/balance are deliberately reset;
 * clones start INACTIVE and use the same activation purchase as registrations.
 */
export function buildCloneMemberData({
  source,
  memberId,
  fullName,
  profileImage = null,
  sponsorId,
  placementId,
  placementSlot,
}: {
  source: CloneSource;
  memberId: string;
  fullName: string;
  profileImage?: string | null;
  sponsorId: string;
  placementId: string;
  placementSlot: PlacementSlot;
}) {
  return {
    memberId,
    fullName,
    email: source.email,
    phone: source.phone,
    passwordHash: source.passwordHash,
    tPinHash: source.tPinHash,
    tPinUpdatedAt: source.tPinUpdatedAt,
    profileImage,
    role: "MEMBER" as const,
    status: "INACTIVE" as const,
    activationDate: null,
    sponsorId,
    placementParentId: placementId,
    placementSlot,
  };
}

/** Internal owner id that stays stable while the active account changes. */
export async function getAccountOwnerId(client: Client, accountId: string): Promise<string> {
  const link = await client.accountOwnership.findUnique({
    where: { accountId },
    select: { ownerId: true },
  });
  return link?.ownerId ?? accountId;
}

/** Only accounts explicitly linked to the authenticated owner can be selected. */
export async function canAccessAccount(
  client: Client,
  ownerId: string,
  accountId: string,
): Promise<boolean> {
  const link = await client.accountOwnership.findUnique({
    where: { accountId },
    select: { ownerId: true },
  });
  if (link) return link.ownerId === ownerId;
  // A member created before the ownership migration still owns themselves.
  return ownerId === accountId;
}
