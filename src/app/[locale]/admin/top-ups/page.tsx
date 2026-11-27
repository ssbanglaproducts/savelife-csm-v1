import { getLocale, getTranslations } from "next-intl/server";
import { Wallet } from "lucide-react";
import { getAdminAccess, hasAdminPermission } from "@/lib/admin-access";
import {
  AdminPageIntro,
  AdminSection,
} from "@/components/admin/admin-ui";
import {
  TopUpReview,
  type AdminTopUpRequest,
} from "@/components/admin/top-up-review";
import { redirect } from "@/i18n/navigation";
import { requireMemberId } from "@/lib/member-id";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminTopUpsPage() {
  const [session, locale, tn, ta] = await Promise.all([
    getAdminAccess(),
    getLocale(),
    getTranslations("nav"),
    getTranslations("adminPanel"),
  ]);
  if (!session || !hasAdminPermission(session, "topUps.view")) redirect({ href: "/admin-login", locale });

  const requests = await prisma.walletTopUp.findMany({
    where: { member: { role: "MEMBER" } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      member: { select: { memberId: true, fullName: true } },
    },
  });

  const initialRequests: AdminTopUpRequest[] = requests.map((request) => ({
    id: request.id,
    requestNumber: request.requestNumber,
    amountPaisa: request.amountPaisa.toString(),
    method: request.method,
    transactionRef: request.transactionRef,
    proofImageUrl: request.proofImageUrl,
    note: request.note,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    member: {
      memberId: requireMemberId(request.member),
      fullName: request.member.fullName,
    },
  }));

  return (
    <div className="space-y-8 animate-rise">
      <AdminPageIntro
        eyebrow={tn("admin")}
        title={ta("topUpsTitle")}
        intro={ta("topUpsIntro")}
        icon={<Wallet className="size-3.5" aria-hidden="true" />}
      />
      <AdminSection id="requests" title={ta("topUpRequestsTitle")}>
        <TopUpReview initialRequests={initialRequests} locale={locale} />
      </AdminSection>
    </div>
  );
}
