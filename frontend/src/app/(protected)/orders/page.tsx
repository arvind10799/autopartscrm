import { Suspense } from 'react';
import { WorkspacePageSkeleton } from '@/components/feedback/page-skeletons';
import { OrdersPageContent } from '@/features/orders/components/OrdersPageContent';

export default function OrdersPage() {
  return <Suspense fallback={<WorkspacePageSkeleton />}><OrdersPageContent /></Suspense>;
}
