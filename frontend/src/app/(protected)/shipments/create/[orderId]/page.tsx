import { ShipmentOrderWorkspacePage } from '@/features/shipments/components/CreateShipmentWorkspace';

export default async function ShipmentOrderWorkspaceRoute({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  return <ShipmentOrderWorkspacePage orderId={orderId} />;
}