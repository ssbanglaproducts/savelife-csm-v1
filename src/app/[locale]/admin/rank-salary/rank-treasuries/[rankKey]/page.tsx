import { AdminTreasuryDetailContent } from "@/components/admin/rank-salary/treasury-detail-content";

export const dynamic = "force-dynamic";

export default async function RankTreasuryDetailPage({
  params,
}: {
  params: Promise<{ rankKey: string }>;
}) {
  const { rankKey } = await params;
  return <AdminTreasuryDetailContent rankKey={rankKey} />;
}
