import { WebsiteLeadDetailsView } from '@/features/website-leads/WebsiteLeadDetailsView';

export default async function WebsiteLeadDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WebsiteLeadDetailsView id={id} />;
}
