import { AdminTreasuryMembersContent } from "@/components/admin/rank-salary/treasury-members-content";

export const dynamic = "force-dynamic";

export default async function RankTreasuryMembersPage({
  params,
}: {
  params: Promise<{ rankKey: string }>;
}) {
  const { rankKey } = await params;
  return <AdminTreasuryMembersContent rankKey={rankKey} />;
}
