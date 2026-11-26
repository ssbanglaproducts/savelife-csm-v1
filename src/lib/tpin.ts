import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export function isTPin(value: string): boolean {
  return /^\d{6}$/.test(value);
}

export type TPinVerification =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: "TPIN_NOT_SET" | "INVALID_TPIN" };

/**
 * Shared financial PIN check. Withdrawals, Send SP and wallet checkout all
 * use this so the credential has exactly the same rules everywhere.
 */
export async function verifyMemberTPin(
  memberId: string,
  tPin: string,
): Promise<TPinVerification> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { tPinHash: true },
  });

  if (!member?.tPinHash) return { ok: false, code: "TPIN_NOT_SET" };
  if (!isTPin(tPin) || !(await bcrypt.compare(tPin, member.tPinHash))) {
    return { ok: false, code: "INVALID_TPIN" };
  }
  return { ok: true };
}
