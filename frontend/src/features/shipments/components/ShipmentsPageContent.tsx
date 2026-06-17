'use client';

import { Search } from 'lucide-react';
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  buildTimestampRangeQuery,
  createDefaultDateRangeFilterState,
} from '@/lib/filters/date-range';
import { useShipmentsList } from '../hooks/useShipmentsList';
import {
  ALL_SHIPMENT_STATUS_FILTER,
  formatShipmentStatusOptionLabel,
  getShipmentPageMetrics,
  parseShipmentStatusFilter,
  type ShipmentStatusFilter,
} from '../lib/shipments.helpers';
import { SHIPMENT_STATUSES } from '../types/shipment.types';
import { ShipmentMetricsCards } from './ShipmentMetricsCards';
import { ShipmentsTable } from './ShipmentsTable';

export function ShipmentsPageContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<ShipmentStatusFilter>(ALL_SHIPMENT_STATUS_FILTER);
  const [dateFilter, setDateFilter] = useState(
    createDefaultDateRangeFilterState(),
  );
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const activeSearch = deferredSearchTerm.trim();
  const dateRangeQuery = useMemo(
    () => buildTimestampRangeQuery(dateFilter),
    [dateFilter],
  );
  const { shipmentsResponse, isLoading, error } = useShipmentsList({
    page,
    search: activeSearch,
    status: statusFilter,
    createdFrom: dateRangeQuery.createdFrom,
    createdTo: dateRangeQuery.createdTo,
    refreshKey,
  });
  const { totalPages } = shipmentsResponse.meta;
  const { inTransitCount, delayedCount } = getShipmentPageMetrics(
    shipmentsResponse.items,
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (totalPages === 0 && page !== 1) {
      startTransition(() => setPage(1));
      return;
    }

    if (totalPages > 0 && page > totalPages) {
      startTransition(() => setPage(totalPages));
    }
  }, [isLoading, page, totalPages]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    startTransition(() => setPage(1));
  };

  const handleStatusChange = (value: ShipmentStatusFilter) => {
    setStatusFilter(value);
    startTransition(() => setPage(1));
  };

  const handleRetry = () => {
    setRefreshKey((currentValue) => currentValue + 1);
  };

  return (
    <section className="grid gap-6">
      <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

      <ShipmentMetricsCards
        total={shipmentsResponse.meta.total}
        inTransitCount={inTransitCount}
        delayedCount={delayedCount}
      />

      <div className="grid gap-6">
        <Card>
          <CardHeader className="space-y-4">
            <div className="space-y-2">
              <CardTitle className="text-2xl sm:text-[1.75rem]">Shipment table</CardTitle>
              <CardDescription>
                Track BOL and PRO numbers, carrier details, and shipment progress.
              </CardDescription>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  className="pl-9"
                  placeholder="Search by BOL, PRO, carrier, order, or customer"
                />
              </div>

              <Select
                value={statusFilter}
                onChange={(event) =>
                  handleStatusChange(parseShipmentStatusFilter(event.target.value))
                }
              >
                <option value={ALL_SHIPMENT_STATUS_FILTER}>All statuses</option>
                {SHIPMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatShipmentStatusOptionLabel(status)}
                  </option>
                ))}
              </Select>
            </div>
          </CardHeader>

          <CardContent>
            <ShipmentsTable
              shipments={shipmentsResponse.items}
              meta={shipmentsResponse.meta}
              isLoading={isLoading}
              error={error}
              onRetry={handleRetry}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
