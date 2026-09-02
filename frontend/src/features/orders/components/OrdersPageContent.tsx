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
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatUsPhoneNumber } from '@/lib/forms/phone-format';
import {
  buildTimestampRangeQuery,
  createDefaultDateRangeFilterState,
} from '@/lib/filters/date-range';
import { toast } from '@/lib/stores/toast.store';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { ordersApi } from '../api/orders-api';
import { useOrdersList } from '../hooks/useOrdersList';
import {
  ALL_ORDER_STATUS_FILTER,
  ALL_SHIPMENT_STATUS_FILTER,
  formatOrderStatusOptionLabel,
  formatShipmentStatusOptionLabel,
  parseOrderStatusFilter,
  parseShipmentStatusFilter,
  REFUNDED_SHIPMENT_STATUS_FILTER,
  type OrderStatusFilter,
  type ShipmentStatusFilter,
} from '../lib/orders.helpers';
import {
  ORDER_STATUSES,
  ORDER_SHIPMENT_STATUSES,
  type OrderSummary,
  type OrderUser,
} from '../types/order.types';
import { CreateOrderForm } from './CreateOrderForm';
import { OrdersTable } from './OrdersTable';
import { UpdateOrderForm } from './UpdateOrderForm';

const ALL_AGENTS_FILTER = 'ALL';
const PHONE_LIKE_SEARCH_PATTERN = /^[\d\s()+.-]+$/;
const ORDER_SHIPMENT_STATUS_FILTERS = [
  ...ORDER_SHIPMENT_STATUSES,
  REFUNDED_SHIPMENT_STATUS_FILTER,
] as const;

function formatAgentFilterLabel(agent: OrderUser) {
  return `${agent.name} (${agent.role === 'ADMIN' ? 'Admin' : 'Sales'})`;
}

export function OrdersPageContent() {
  const authUser = useAuthStore((state) => state.user);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] =
    useState<OrderStatusFilter>(ALL_ORDER_STATUS_FILTER);
  const [shipmentStatusFilter, setShipmentStatusFilter] =
    useState<ShipmentStatusFilter>(ALL_SHIPMENT_STATUS_FILTER);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [orderAgents, setOrderAgents] = useState<OrderUser[]>([]);
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
  const selectedAgentFilter =
    agentFilter ?? (authUser?.role === 'SALES' ? authUser.userId : ALL_AGENTS_FILTER);
  const createdById =
    selectedAgentFilter === ALL_AGENTS_FILTER ? undefined : selectedAgentFilter;
  const agentOptions = useMemo(() => {
    const agents = new Map<string, OrderUser>();

    for (const agent of orderAgents) {
      agents.set(agent.id, agent);
    }

    if (
      authUser &&
      (authUser.role === 'ADMIN' || authUser.role === 'SALES') &&
      !agents.has(authUser.userId)
    ) {
      agents.set(authUser.userId, {
        id: authUser.userId,
        name: authUser.name,
        email: authUser.email,
        role: authUser.role,
      });
    }

    return Array.from(agents.values());
  }, [authUser, orderAgents]);
  const { ordersResponse, isLoading, error } = useOrdersList({
    page,
    search: activeSearch,
    status:
      orderStatusFilter === ALL_ORDER_STATUS_FILTER ? undefined : orderStatusFilter,
    shipmentStatus: shipmentStatusFilter,
    createdFrom: dateRangeQuery.createdFrom,
    createdTo: dateRangeQuery.createdTo,
    createdById,
    refreshKey,
  });

  const handleSearchChange = (value: string) => {
    const digitCount = value.replace(/\D/g, '').length;
    const nextSearchTerm =
      digitCount === 10 && PHONE_LIKE_SEARCH_PATTERN.test(value)
        ? formatUsPhoneNumber(value)
        : value;

    setSearchTerm(nextSearchTerm);
    startTransition(() => setPage(1));
  };

  const handleShipmentStatusChange = (value: ShipmentStatusFilter) => {
    setShipmentStatusFilter(value);
    startTransition(() => setPage(1));
  };

  const handleOrderStatusChange = (value: OrderStatusFilter) => {
    setOrderStatusFilter(value);
    startTransition(() => setPage(1));
  };

  const handleAgentFilterChange = (value: string) => {
    setAgentFilter(value);
    startTransition(() => setPage(1));
  };

  const handleCreated = (order: OrderSummary) => {
    setSearchTerm('');
    setOrderStatusFilter(ALL_ORDER_STATUS_FILTER);
    setShipmentStatusFilter(ALL_SHIPMENT_STATUS_FILTER);
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

  useEffect(() => {
    if (authUser?.role !== 'ADMIN' && authUser?.role !== 'SALES') {
      return;
    }

    let isMounted = true;

    const loadOrderAgents = async () => {
      try {
        const agents = await ordersApi.listAgents();

        if (isMounted) {
          setOrderAgents(agents);
        }
      } catch {
        if (isMounted) {
          setOrderAgents([]);
        }
      }
    };

    void loadOrderAgents();

    return () => {
      isMounted = false;
    };
  }, [authUser?.role]);

  return (
    <>
      <section className="grid gap-6">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <CardTitle className="text-2xl sm:text-[1.75rem]">Orders table</CardTitle>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <DateRangeFilter
                  value={dateFilter}
                  onChange={setDateFilter}
                  variant="inline"
                />

                <label className="grid gap-2">
                  <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Agent filter
                  </span>
                  <Select
                    value={selectedAgentFilter}
                    aria-label="Agent filter"
                    className="h-11 min-w-[220px]"
                    onChange={(event) => handleAgentFilterChange(event.target.value)}
                  >
                    <option value={ALL_AGENTS_FILTER}>All agents</option>
                    {agentOptions.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {formatAgentFilterLabel(agent)}
                      </option>
                    ))}
                  </Select>
                </label>

                <Button
                  size="lg"
                  className="h-11 whitespace-nowrap"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Create order
                </Button>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[1fr_210px_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  className="pl-9"
                  placeholder="Search by order number, sales number, customer, phone, email, or part"
                />
              </div>

              <Select
                value={orderStatusFilter}
                aria-label="Order status filter"
                onChange={(event) =>
                  handleOrderStatusChange(parseOrderStatusFilter(event.target.value))
                }
              >
                <option value={ALL_ORDER_STATUS_FILTER}>All order statuses</option>
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatOrderStatusOptionLabel(status)}
                  </option>
                ))}
              </Select>

              <Select
                value={shipmentStatusFilter}
                aria-label="Shipping status filter"
                onChange={(event) =>
                  handleShipmentStatusChange(
                    parseShipmentStatusFilter(event.target.value),
                  )
                }
              >
                <option value={ALL_SHIPMENT_STATUS_FILTER}>
                  All shipping statuses
                </option>
                {ORDER_SHIPMENT_STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {formatShipmentStatusOptionLabel(status)}
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
              role={authUser?.role}
              currentUserId={authUser?.userId}
            />
          </CardContent>
        </Card>
      </section>

      {isCreateModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:py-6"
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
                  Update order details, customer contact information, and notes with full history.
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
