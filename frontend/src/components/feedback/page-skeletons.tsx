import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function MetricsGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-4/5" />
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
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-16 w-full max-w-sm rounded-2xl" />
        </div>

        {showFilters ? (
          <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-white/80">
          <div className="grid gap-3 border-b border-border/60 bg-secondary/55 px-4 py-4 md:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-20" />
            ))}
          </div>
          <div className="space-y-4 px-4 py-4">
            {Array.from({ length: rows }).map((_, index) => (
              <div key={index} className="grid gap-3 md:grid-cols-6">
                {Array.from({ length: 6 }).map((__, cellIndex) => (
                  <Skeleton
                    key={cellIndex}
                    className={cellIndex === 0 ? 'h-5 w-24' : 'h-5 w-full'}
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
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-4/5" />
          </CardHeader>
          <CardContent className="space-y-5">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export function DetailPageSkeleton() {
  return (
    <section className="grid gap-6">
      <Card>
        <CardHeader className="space-y-4">
          <Skeleton className="h-6 w-28" />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Skeleton className="h-12 w-56" />
                <Skeleton className="h-8 w-28 rounded-full" />
              </div>
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <Skeleton className="h-24 w-full max-w-xs rounded-2xl" />
          </div>
        </CardHeader>
      </Card>

      <MetricsGridSkeleton />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-4/5" />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-border/70 bg-white/80 p-4"
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-5 w-4/5" />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-4/5" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-2xl" />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

export function NotesListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-4/5" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: count }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-2xl" />
        ))}
      </CardContent>
    </Card>
  );
}

export function TimelineSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-4/5" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-28 flex-1 rounded-2xl" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
