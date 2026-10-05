import { LeadDetailsView } from '@/features/leads/components/LeadDetailsView';

export default async function LeadDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <LeadDetailsView leadId={id} />;
}
