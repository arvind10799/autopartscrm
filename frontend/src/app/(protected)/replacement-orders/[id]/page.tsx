import { ReplacementDetailsView } from '@/features/replacements/components/ReplacementDetailsView';

export default async function ReplacementDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ReplacementDetailsView replacementId={id} />;
}
