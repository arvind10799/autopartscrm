import { WorkspacePageSkeleton } from '@/components/feedback/page-skeletons';

export default function RootLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <WorkspacePageSkeleton />
    </main>
  );
}
