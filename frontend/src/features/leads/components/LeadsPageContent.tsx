'use client';

import { Plus, Search, X } from 'lucide-react';
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { CreateOrderForm } from '@/features/orders/components/CreateOrderForm';
import type { CreateOrderFormValues } from '@/features/orders/schemas/order.schema';
import type { OrderSummary } from '@/features/orders/types/order.types';
import {
  buildTimestampRangeQuery,
  createDefaultDateRangeFilterState,
} from '@/lib/filters/date-range';
import { toast } from '@/lib/stores/toast.store';
import {
  ALL_LEAD_CONVERSION_FILTER,
  formatLeadConversionFilterLabel,
  parseLeadConversionFilter,
  type LeadConversionFilter,
} from '../lib/leads.helpers';
import { formatCurrency } from '../lib/lead-formatters';
import { useLeadsList } from '../hooks/useLeadsList';
import type { LeadSummary } from '../types/lead.types';
import { CreateLeadForm } from './CreateLeadForm';
import { LeadsTable } from './LeadsTable';

function buildOrderInitialValues(lead: LeadSummary): Partial<CreateOrderFormValues> {
  const quoteValue = lead.quote ?? undefined;

  return {
    leadId: lead.id,
    orderDate: lead.date,
    customerName: lead.customerName,
    customerPhone: lead.customerPhone,
    partDescription: lead.partDescription,
    salePrice: quoteValue,
    total: quoteValue,
    note: lead.comments ?? '',
  };
}

export function LeadsPageContent() {
  const authUser = useAuthStore((state) => state.user);
  const [searchTerm, setSearchTerm] = useState('');
  const [convertedFilter, setConvertedFilter] =
    useState<LeadConversionFilter>(ALL_LEAD_CONVERSION_FILTER);
  const [dateFilter, setDateFilter] = useState(
    createDefaultDateRangeFilterState(),
  );
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedConversionLead, setSelectedConversionLead] =
    useState<LeadSummary | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const activeSearch = deferredSearchTerm.trim();
  const dateRangeQuery = useMemo(
    () => buildTimestampRangeQuery(dateFilter),
    [dateFilter],
  );
  const { leadsResponse, isLoading, error } = useLeadsList({
    page,
    search: activeSearch,
    converted: convertedFilter,
    createdFrom: dateRangeQuery.createdFrom,
    createdTo: dateRangeQuery.createdTo,
    refreshKey,
  });

  const convertedCount = leadsResponse.items.filter((lead) => lead.isConverted).length;
  const openCount = leadsResponse.items.length - convertedCount;
  const visibleQuoteValue = leadsResponse.items.reduce(
    (sum, lead) => sum + (lead.quote ?? 0),
    0,
  );

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    startTransition(() => setPage(1));
  };

  const handleConvertedFilterChange = (value: LeadConversionFilter) => {
    setConvertedFilter(value);
    startTransition(() => setPage(1));
  };

  const handleLeadCreated = (lead: LeadSummary) => {
    setIsCreateModalOpen(false);
    setSearchTerm('');
    setConvertedFilter(ALL_LEAD_CONVERSION_FILTER);
    startTransition(() => setPage(1));
    setRefreshKey((currentValue) => currentValue + 1);
    toast.success(
      `${lead.customerName} lead created`,
      'The leads table has been refreshed with the latest sales intake data.',
    );
  };

  const handleRetry = () => {
    setRefreshKey((currentValue) => currentValue + 1);
  };

  const handleConvert = (lead: LeadSummary) => {
    setIsCreateModalOpen(false);
    setSelectedConversionLead(lead);
  };

  const handleOrderCreated = (order: OrderSummary) => {
    const convertedLead = selectedConversionLead;
    setSelectedConversionLead(null);
    setRefreshKey((currentValue) => currentValue + 1);
    toast.success(
      `Order ${order.orderNumber} created`,
      convertedLead
        ? `${convertedLead.customerName}'s lead has been marked as converted.`
        : 'The order was created successfully.',
    );
  };

  useEffect(() => {
    if (!isCreateModalOpen && !selectedConversionLead) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCreateModalOpen, selectedConversionLead]);

  return (
    <>
      <section className="grid gap-6">
        <DateRangeFilter value={dateFilter} onChange={setDateFilter} />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total matching leads</CardDescription>
              <CardTitle className="text-2xl tabular-nums sm:text-[1.75rem]">
                {leadsResponse.meta.total}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Lead visibility follows the current sales role and active filters.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open leads on this page</CardDescription>
              <CardTitle className="text-2xl tabular-nums sm:text-[1.75rem]">
                {openCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Open leads can be converted straight into the order workspace.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Visible quoted value</CardDescription>
              <CardTitle className="text-2xl tabular-nums sm:text-[1.75rem]">
                {formatCurrency(visibleQuoteValue)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Sum of quote values for the leads currently loaded in the table.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl sm:text-[1.75rem]">Leads workspace</CardTitle>
                <CardDescription>
                  Create leads, track conversion readiness, and push qualified work into orders.
                </CardDescription>
              </div>

              <Button size="lg" onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Create lead
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  className="pl-9"
                  placeholder="Search by customer, phone, adviser, CMPT, or part"
                />
              </div>

              <Select
                value={convertedFilter}
                onChange={(event) =>
                  handleConvertedFilterChange(
                    parseLeadConversionFilter(event.target.value),
                  )
                }
              >
                <option value={ALL_LEAD_CONVERSION_FILTER}>
                  {formatLeadConversionFilterLabel(ALL_LEAD_CONVERSION_FILTER)}
                </option>
                <option value="OPEN">{formatLeadConversionFilterLabel('OPEN')}</option>
                <option value="CONVERTED">
                  {formatLeadConversionFilterLabel('CONVERTED')}
                </option>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <LeadsTable
              leads={leadsResponse.items}
              meta={leadsResponse.meta}
              isLoading={isLoading}
              error={error}
              onRetry={handleRetry}
              onPageChange={setPage}
              onConvert={handleConvert}
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
            className="w-full max-w-5xl rounded-[1.75rem] border border-border/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
              <div className="space-y-1">
                <h2 className="font-[var(--font-heading)] text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  Create lead
                </h2>
                <p className="text-sm text-muted-foreground">
                  Capture a sales conversation and keep it ready for order conversion.
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Close create lead popup"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[calc(100vh-5.5rem)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <CreateLeadForm
                adviserName={authUser?.name ?? 'Loading adviser...'}
                onCreated={handleLeadCreated}
              />
            </div>
          </div>
        </div>
      ) : null}

      {selectedConversionLead ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 py-4 backdrop-blur-sm sm:py-6"
          onClick={() => setSelectedConversionLead(null)}
        >
          <div
            className="w-full max-w-6xl rounded-[1.75rem] border border-border/70 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
              <div className="space-y-1">
                <h2 className="font-[var(--font-heading)] text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  Convert lead to order
                </h2>
                <p className="text-sm text-muted-foreground">
                  The customer, phone, part, quote, and notes from this lead are prefilled below.
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedConversionLead(null)}
                aria-label="Close convert lead popup"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[calc(100vh-5.5rem)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <CreateOrderForm
                initialValues={buildOrderInitialValues(selectedConversionLead)}
                onCreated={handleOrderCreated}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
