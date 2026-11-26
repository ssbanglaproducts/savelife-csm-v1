import { prisma } from "@/lib/prisma";

export type ActiveSettings = {
  id: string | null;
  version: number;
  installmentDurationMonths: number;
  profitOnlyLockInMonths: number;
  withdrawalFeeBps: number;
  minWithdrawalPaisa: bigint;
};

export const fallbackSettings: ActiveSettings = {
  id: null,
  version: 1,
  installmentDurationMonths: 14,
  profitOnlyLockInMonths: 12,
  withdrawalFeeBps: 1000,
  minWithdrawalPaisa: 50000n,
};

export async function getActiveSettings(): Promise<ActiveSettings> {
  try {
    const settings = await prisma.investmentSettings.findFirst({
      where: { isActive: true },
      orderBy: { version: "desc" },
    });

    if (!settings) return fallbackSettings;

    return {
      id: settings.id,
      version: settings.version,
      installmentDurationMonths: settings.installmentDurationMonths,
      profitOnlyLockInMonths: settings.profitOnlyLockInMonths,
      withdrawalFeeBps: settings.withdrawalFeeBps,
      minWithdrawalPaisa: settings.minWithdrawalPaisa,
    };
  } catch {
    return fallbackSettings;
  }
}
