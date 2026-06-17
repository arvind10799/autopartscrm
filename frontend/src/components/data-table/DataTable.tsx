'use client';

import type { ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { Database, RefreshCcw } from 'lucide-react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_TABLE_SKELETON_ROWS } from '@/lib/constants/app';

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle: string;
  emptyDescription: string;
  footer?: ReactNode;
  getRowId?: (originalRow: TData, index: number, parent?: unknown) => string;
  skeletonRowCount?: number;
};

export function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle,
  emptyDescription,
  footer,
  getRowId,
  skeletonRowCount = DEFAULT_TABLE_SKELETON_ROWS,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
  });
  const columnCount = columns.length || 1;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-white shadow-sm">
      <div className="border-b border-border/70 bg-secondary/35 px-4 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:hidden">
        Swipe horizontally to view all table columns
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse">
          <thead className="bg-secondary/45">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {isLoading ? (
              Array.from({ length: skeletonRowCount }).map((_, rowIndex) => (
                <tr key={`skeleton-row-${rowIndex}`} aria-hidden="true">
                  {Array.from({ length: columnCount }).map((__, cellIndex) => (
                    <td
                      key={`skeleton-cell-${rowIndex}-${cellIndex}`}
                      className="px-4 py-3.5 align-top"
                    >
                      <Skeleton
                        className={
                          cellIndex === 0
                            ? 'h-5 w-24 rounded-lg'
                            : cellIndex === columnCount - 1
                              ? 'h-9 w-16 rounded-xl'
                              : 'h-5 w-full max-w-[12rem] rounded-lg'
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={columnCount} className="px-6 py-12 text-center">
                  <div className="mx-auto max-w-md text-sm">
                    <p className="text-foreground">{error}</p>
                    {onRetry ? (
                      <div className="mt-4">
                        <Button variant="outline" onClick={onRetry}>
                          <RefreshCcw className="h-4 w-4" />
                          Retry
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-6 py-10 text-center">
                  <EmptyState
                    icon={<Database className="h-5 w-5" />}
                    title={emptyTitle}
                    description={emptyDescription}
                    className="border-0 bg-transparent px-0 py-4"
                  />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-border/60 transition hover:bg-secondary/30"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3.5 align-top text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {footer ? (
        <div className="border-t border-border/70 bg-white px-4 py-4">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
