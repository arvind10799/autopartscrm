import { ShipmentDetailsView } from '@/features/shipments/components/ShipmentDetailsView';

export default async function ShipmentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ShipmentDetailsView shipmentId={id} />;
}
