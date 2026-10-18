import { Suspense } from 'react';
import { WorkspacePageSkeleton } from '@/components/feedback/page-skeletons';
import { ReplacementOrdersPageContent } from '@/features/replacements/components/ReplacementOrdersPageContent';

export default function ReplacementOrdersPage() {
  return <Suspense fallback={<WorkspacePageSkeleton />}><ReplacementOrdersPageContent /></Suspense>;
}
