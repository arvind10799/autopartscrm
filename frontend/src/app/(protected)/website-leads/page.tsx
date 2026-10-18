import { Suspense } from 'react';
import { WorkspacePageSkeleton } from '@/components/feedback/page-skeletons';
import { WebsiteLeadsPageContent } from '@/features/website-leads/WebsiteLeadsPageContent';

export default function WebsiteLeadsPage() {
  return (
    <Suspense fallback={<WorkspacePageSkeleton />}>
      <WebsiteLeadsPageContent />
    </Suspense>
  );
}
