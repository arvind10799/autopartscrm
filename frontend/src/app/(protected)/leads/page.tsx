import { Suspense } from 'react';
import { WorkspacePageSkeleton } from '@/components/feedback/page-skeletons';
import { LeadsPageContent } from '@/features/leads/components/LeadsPageContent';

export default function LeadsPage() {
  return <Suspense fallback={<WorkspacePageSkeleton />}><LeadsPageContent /></Suspense>;
}
