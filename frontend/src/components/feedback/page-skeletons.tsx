import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const premiumSkeletonClassName =
  'bg-gradient-to-r from-slate-100 via-sky-50 to-slate-100 shadow-inner';
const premiumCardClassName =
  'border-sky-100/80 bg-[radial-gradient(circle_at_top_left,#f0f9ff_0%,#ffffff_44%,#f8fafc_100%)] shadow-sm shadow-sky-950/5';

export function MetricsGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className={premiumCardClassName}>
          <CardHeader className="pb-3">
            <Skeleton className={`h-4 w-28 ${premiumSkeletonClassName}`} />
            <Skeleton className={`h-10 w-24 rounded-xl ${premiumSkeletonClassName}`} />
          </CardHeader>
          <CardContent>
            <Skeleton className={`h-4 w-4/5 ${premiumSkeletonClassName}`} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TableCardSkeleton({
  rows = 5,
  showFilters = true,
}: {
  rows?: number;
  showFilters?: boolean;
}) {
  return (
    <Card className={premiumCardClassName}>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Skeleton className={`h-8 w-52 rounded-xl ${premiumSkeletonClassName}`} />
            <Skeleton className={`h-4 w-80 max-w-full ${premiumSkeletonClassName}`} />
          </div>
          <Skeleton className={`h-16 w-full max-w-sm rounded-2xl ${premiumSkeletonClassName}`} />
        </div>

        {showFilters ? (
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <Skeleton className={`h-11 w-full rounded-xl ${premiumSkeletonClassName}`} />
            <Skeleton className={`h-11 w-full rounded-xl ${premiumSkeletonClassName}`} />
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-sky-100/80 bg-white/80 shadow-sm shadow-sky-950/5">
          <div className="grid gap-3 border-b border-border/60 bg-secondary/55 px-4 py-4 md:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton
                key={index}
                className={`h-4 w-20 ${premiumSkeletonClassName}`}
              />
            ))}
          </div>
          <div className="space-y-4 px-4 py-4">
            {Array.from({ length: rows }).map((_, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-6">
                {Array.from({ length: 6 }).map((__, cellIndex) => (
                  <Skeleton
                    key={cellIndex}
                    className={`${
                      cellIndex === 0 ? 'h-5 w-24' : 'h-5 w-full'
                    } ${premiumSkeletonClassName}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspacePageSkeleton() {
  return (
    <section className="grid gap-6">
      <MetricsGridSkeleton />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <TableCardSkeleton />
        <Card className={premiumCardClassName}>
          <CardHeader>
            <Skeleton className={`h-8 w-44 rounded-xl ${premiumSkeletonClassName}`} />
            <Skeleton className={`h-4 w-4/5 ${premiumSkeletonClassName}`} />
          </CardHeader>
          <CardContent className="space-y-5">
            <Skeleton className={`h-24 w-full rounded-2xl ${premiumSkeletonClassName}`} />
            <Skeleton className={`h-11 w-full rounded-xl ${premiumSkeletonClassName}`} />
            <Skeleton className={`h-11 w-full rounded-xl ${premiumSkeletonClassName}`} />
            <Skeleton className={`h-11 w-full rounded-xl ${premiumSkeletonClassName}`} />
            <Skeleton className={`h-11 w-full rounded-xl ${premiumSkeletonClassName}`} />
            <Skeleton className={`h-12 w-full rounded-xl ${premiumSkeletonClassName}`} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export function DetailPageSkeleton() {
  return (
    <section className="grid gap-6">
      <Card className={premiumCardClassName}>
        <CardHeader className="space-y-4">
          <Skeleton className={`h-6 w-28 ${premiumSkeletonClassName}`} />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Skeleton className={`h-12 w-56 rounded-xl ${premiumSkeletonClassName}`} />
                <Skeleton className={`h-8 w-28 rounded-full ${premiumSkeletonClassName}`} />
              </div>
              <Skeleton className={`h-4 w-80 max-w-full ${premiumSkeletonClassName}`} />
            </div>
            <Skeleton className={`h-24 w-full max-w-xs rounded-2xl ${premiumSkeletonClassName}`} />
          </div>
        </CardHeader>
      </Card>

      <MetricsGridSkeleton />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className={premiumCardClassName}>
          <CardHeader>
            <Skeleton className={`h-8 w-44 rounded-xl ${premiumSkeletonClassName}`} />
            <Skeleton className={`h-4 w-4/5 ${premiumSkeletonClassName}`} />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-border/70 bg-white/80 p-4"
              >
                <Skeleton className={`h-3 w-24 ${premiumSkeletonClassName}`} />
                <Skeleton className={`mt-3 h-5 w-4/5 ${premiumSkeletonClassName}`} />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className={premiumCardClassName}>
            <CardHeader>
              <Skeleton className={`h-7 w-40 rounded-xl ${premiumSkeletonClassName}`} />
              <Skeleton className={`h-4 w-4/5 ${premiumSkeletonClassName}`} />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className={`h-16 w-full rounded-2xl ${premiumSkeletonClassName}`}
                />
              ))}
            </CardContent>
          </Card>

          <Card className={premiumCardClassName}>
            <CardHeader>
              <Skeleton className={`h-7 w-40 rounded-xl ${premiumSkeletonClassName}`} />
              <Skeleton className={`h-4 w-3/4 ${premiumSkeletonClassName}`} />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className={`h-20 w-full rounded-2xl ${premiumSkeletonClassName}`} />
              <Skeleton className={`h-20 w-full rounded-2xl ${premiumSkeletonClassName}`} />
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

export function NotesListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Card className={premiumCardClassName}>
      <CardHeader>
        <Skeleton className={`h-8 w-36 rounded-xl ${premiumSkeletonClassName}`} />
        <Skeleton className={`h-4 w-4/5 ${premiumSkeletonClassName}`} />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: count }).map((_, index) => (
          <Skeleton
            key={index}
            className={`h-28 w-full rounded-2xl ${premiumSkeletonClassName}`}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export function TimelineSkeleton() {
  return (
    <Card className={premiumCardClassName}>
      <CardHeader>
        <Skeleton className={`h-7 w-44 rounded-xl ${premiumSkeletonClassName}`} />
        <Skeleton className={`h-4 w-4/5 ${premiumSkeletonClassName}`} />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex gap-4">
            <Skeleton className={`h-8 w-8 rounded-full ${premiumSkeletonClassName}`} />
            <Skeleton className={`h-28 flex-1 rounded-2xl ${premiumSkeletonClassName}`} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
