import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Re-authorizes a sensitive admin mutation with the current account password.
 * Callers must already have verified the session is an ADMIN.
 */
export async function verifyAdminPassword(
  memberId: string,
  password: string,
): Promise<boolean> {
  if (!password) return false;
  const admin = await prisma.member.findUnique({
    where: { id: memberId },
    select: { passwordHash: true },
  });
  return Boolean(admin && (await bcrypt.compare(password, admin.passwordHash)));
}
