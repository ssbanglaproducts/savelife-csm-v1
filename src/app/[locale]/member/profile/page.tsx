import { getTranslations, setRequestLocale } from "next-intl/server";
import { UserRound } from "lucide-react";
import { auth } from "@/auth";
import { CopyableMemberId } from "@/components/ui/copyable-member-id";
import { PageHeader } from "@/components/member/page-header";
import { ProfileForm } from "@/components/member/profile-form";
import { AddressBookManager } from "@/components/member/address-book-manager";
import { NomineeManager } from "@/components/member/nominee-manager";
import { TPinResetForm } from "@/components/member/tpin-reset-form";
import { statusLabelKey } from "@/components/member/status-labels";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [session, tm, tn, ta] = await Promise.all([
    auth(),
    getTranslations("memberPanel"),
    getTranslations("nav"),
    getTranslations("auth"),
  ]);
  if (!session?.user?.id) {
    redirect({ href: "/login", locale });
    return null;
  }

  const member = await prisma.member.findUnique({
    where: { id: session.user.id },
    select: {
      fullName: true,
      email: true,
      phone: true,
      memberId: true,
      status: true,
      profileImage: true,
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          label: true,
          fullName: true,
          phone: true,
          street: true,
          thana: true,
          city: true,
          district: true,
          postalCode: true,
          isDefault: true,
        },
      },
      nominees: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fullName: true, relation: true, phone: true },
      },
    },
  });
  if (!member) {
    redirect({ href: "/login", locale });
    return null;
  }

  const address = member.addresses[0];

  return (
    <div className="space-y-8 animate-rise">
      <PageHeader
        eyebrow={tn("profile")}
        title={tm("profileTitle")}
        intro={tm("profileIntro")}
        icon={<UserRound className="size-3.5" aria-hidden="true" />}
      />

      <section className="glass min-w-0 rounded-3xl p-6 sm:p-8" aria-label={tm("personalTitle")}>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <dt className="text-xs text-muted-foreground">{tm("memberId")}</dt>
            <dd className="mt-1.5">
              <CopyableMemberId memberId={member.memberId} />
            </dd>
          </div>
          <div className="min-w-0 rounded-2xl border border-border bg-background/40 p-4">
            <dt className="text-xs text-muted-foreground">{tm("status")}</dt>
            <dd className="mt-1 font-display font-bold">
              {tm(statusLabelKey(member.status))}
            </dd>
          </div>
          <div className="min-w-0 rounded-2xl border border-border bg-background/40 p-4">
            <dt className="text-xs text-muted-foreground">{ta("email")}</dt>
            <dd className="mt-1 truncate font-display font-bold">{member.email}</dd>
          </div>
        </dl>
      </section>

      <ProfileForm
        initial={{
          fullName: member.fullName,
          email: member.email,
          phone: member.phone,
          address: address
            ? {
                street: address.street,
                thana: address.thana ?? address.city ?? "",
                district: address.district ?? "",
                postalCode: address.postalCode ?? "",
                isMain: address.isDefault,
              }
            : null,
          profileImage: member.profileImage,
        }}
      />

      <AddressBookManager
        canManage={member.status === "ACTIVE"}
        initialAddresses={member.addresses.map((item) => ({
          id: item.id,
          label: item.label,
          fullName: item.fullName,
          phone: item.phone,
          street: item.street,
          thana: item.thana ?? item.city ?? "",
          district: item.district ?? "",
          postalCode: item.postalCode,
          isMain: item.isDefault,
        }))}
      />

      <NomineeManager initialNominees={member.nominees} />

      <TPinResetForm />
    </div>
  );
}
