import { OrderDetailsView } from '@/features/orders/components/OrderDetailsView';

export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <OrderDetailsView orderId={id} />;
}
