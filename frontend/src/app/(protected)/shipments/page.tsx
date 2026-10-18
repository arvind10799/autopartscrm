import { Suspense } from 'react';
import { WorkspacePageSkeleton } from '@/components/feedback/page-skeletons';
import { ShipmentsPageContent } from '@/features/shipments/components/ShipmentsPageContent';

export default async function ShipmentsPage() {
  return <Suspense fallback={<WorkspacePageSkeleton />}><ShipmentsPageContent /></Suspense>;
}
