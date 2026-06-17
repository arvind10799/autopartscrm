'use client';

import { Plus, Search, X } from 'lucide-react';
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
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
import { toast } from '@/lib/stores/toast.store';
import { useOrdersList } from '../hooks/useOrdersList';
import { formatCurrency } from '../lib/order-formatters';
import {
  ALL_ORDER_STATUS_FILTER,
  formatOrderStatusOptionLabel,
  parseOrderStatusFilter,
  type OrderStatusFilter,
} from '../lib/orders.helpers';
import { ORDER_STATUSES, type OrderSummary } from '../types/order.types';
import { CreateOrderForm } from './CreateOrderForm';
import { OrdersTable } from './OrdersTable';
import { UpdateOrderForm } from './UpdateOrderForm';

export function OrdersPageContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<OrderStatusFilter>(ALL_ORDER_STATUS_FILTER);
  const [dateFilter, setDateFilter] = useState(
    createDefaultDateRangeFilterState(),
  );
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const activeSearch = deferredSearchTerm.trim();
  const dateRangeQuery = useMemo(
    () => buildTimestampRangeQuery(dateFilter),
    [dateFilter],
  );
  const { ordersResponse, isLoading, error } = useOrdersList({
    page,
    search: activeSearch,
    status: statusFilter,
    createdFrom: dateRangeQuery.createdFrom,
    createdTo: dateRangeQuery.createdTo,
    refreshKey,
  });

  const totalVisibleRevenue = ordersResponse.items.reduce(
    (sum, order) => sum + order.totalSaleAmount,
    0,
  );
  const totalVisibleQuantity = ordersResponse.items.reduce(
    (sum, order) => sum + order.quantity,
    0,
  );

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    startTransition(() => setPage(1));
  };

  const handleStatusChange = (value: OrderStatusFilter) => {
    setStatusFilter(value);
    startTransition(() => setPage(1));
  };

  const handleCreated = (order: OrderSummary) => {
    setSearchTerm('');
    setStatusFilter(ALL_ORDER_STATUS_FILTER);
    setSelectedOrderId(null);
    setIsCreateModalOpen(false);
    startTransition(() => setPage(1));
    setRefreshKey((currentValue) => currentValue + 1);
    toast.success(
      `Order ${order.orderNumber} created`,
      'The orders table has been refreshed with the latest backend data.',
    );
  };

  const handleRetry = () => {
    setRefreshKey((currentValue) => currentValue + 1);
  };

  const handleEditStart = (orderId: string) => {
    setIsCreateModalOpen(false);
    setSelectedOrderId(orderId);
  };

  const handleUpdated = (order: OrderSummary) => {
    setSelectedOrderId(null);
    setRefreshKey((currentValue) => currentValue + 1);
    toast.success(
      `Order ${order.orderNumber} updated`,
      'The latest order values and edit history have been saved.',
    );
  };

  useEffect(() => {
    if (!isCreateModalOpen && !selectedOrderId) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCreateModalOpen, selectedOrderId]);

  return (
    <>
      <section className="grid gap-6">
        <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total matching orders</CardDescription>
              <CardTitle className="text-2xl tabular-nums sm:text-[1.75rem]">
                {ordersResponse.meta.total}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Search and pagination stay aligned with backend filtering.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Visible revenue</CardDescription>
              <CardTitle className="text-2xl tabular-nums sm:text-[1.75rem]">
                {formatCurrency(totalVisibleRevenue)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Revenue total for the orders currently on this page.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Visible quantity</CardDescription>
              <CardTitle className="text-2xl tabular-nums sm:text-[1.75rem]">
                {totalVisibleQuantity}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Unit count across the current page of search results.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <CardTitle className="text-2xl sm:text-[1.75rem]">Orders table</CardTitle>

              <Button size="lg" onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Create order
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  className="pl-9"
                  placeholder="Search by order number, customer, email, or part"
                />
              </div>

              <Select
                value={statusFilter}
                onChange={(event) =>
                  handleStatusChange(parseOrderStatusFilter(event.target.value))
                }
              >
                <option value={ALL_ORDER_STATUS_FILTER}>All statuses</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatOrderStatusOptionLabel(status)}
                  </option>
                ))}
              </Select>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <OrdersTable
              orders={ordersResponse.items}
              meta={ordersResponse.meta}
              isLoading={isLoading}
              error={error}
              onRetry={handleRetry}
              onPageChange={setPage}
              onEdit={handleEditStart}
            />
          </CardContent>
        </Card>
      </section>

      {isCreateModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:py-6"
          onClick={() => setIsCreateModalOpen(false)}
        >
          <div
            className="w-full max-w-6xl rounded-[1.75rem] border border-border/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
              <div className="space-y-1">
                <h2 className="font-[var(--font-heading)] text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  Create order
                </h2>
                <p className="text-sm text-muted-foreground">
                  Add a new sales order without leaving the orders table.
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Close create order popup"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[calc(100vh-5.5rem)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <CreateOrderForm onCreated={handleCreated} />
            </div>
          </div>
        </div>
      ) : null}

      {selectedOrderId ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:py-10"
          onClick={() => setSelectedOrderId(null)}
        >
          <div
            className="w-full max-w-3xl rounded-[1.75rem] border border-border/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
              <div className="space-y-1">
                <h2 className="font-[var(--font-heading)] text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  Edit order
                </h2>
                <p className="text-sm text-muted-foreground">
                  Update notes, quantity, and customer contact details with full history.
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedOrderId(null)}
                aria-label="Close edit order popup"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-6 py-6">
              <UpdateOrderForm
                orderId={selectedOrderId}
                onUpdated={handleUpdated}
                onCancel={() => setSelectedOrderId(null)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
