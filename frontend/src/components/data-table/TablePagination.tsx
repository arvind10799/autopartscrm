import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PageMeta = {
  page: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export function TablePagination({
  meta,
  summary,
  onPageChange,
  disabled = false,
}: {
  meta: PageMeta;
  summary: ReactNode;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="crm-table-pagination">
      <p
        className="text-xs text-muted-foreground sm:text-sm"
        aria-live="polite"
      >
        {summary}
      </p>
      <nav className="crm-pagination-controls" aria-label="Table pagination">
        <Button
          className="crm-pagination-previous min-w-0 px-2.5 text-xs sm:text-sm"
          variant="outline"
          size="sm"
          disabled={disabled || !meta.hasPreviousPage}
          onClick={() => onPageChange(Math.max(1, meta.page - 1))}
        >
          <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
          Previous
        </Button>
        <span className="crm-pagination-page whitespace-nowrap text-center text-xs tabular-nums text-muted-foreground">
          Page {meta.totalPages === 0 ? 0 : meta.page} of {meta.totalPages}
        </span>
        <Button
          className="crm-pagination-next min-w-0 px-2.5 text-xs sm:text-sm"
          variant="outline"
          size="sm"
          disabled={disabled || !meta.hasNextPage}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        </Button>
      </nav>
    </div>
  );
}
