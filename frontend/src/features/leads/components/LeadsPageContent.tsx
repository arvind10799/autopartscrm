'use client';

import { Download, Plus, Search, X } from 'lucide-react';
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
  CardTitle,
  CardHeader,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuthStore } from '@/features/auth/store/auth.store';
import { CreateOrderForm } from '@/features/orders/components/CreateOrderForm';
import type { CreateOrderFormValues } from '@/features/orders/schemas/order.schema';
import type { OrderSummary } from '@/features/orders/types/order.types';
import {
  buildTimestampRangeQuery,
} from '@/lib/filters/date-range';
import { parseTablePage, useTableDateRange, useTableQueryParam } from '@/lib/filters/table-view-state';
import { toast } from '@/lib/stores/toast.store';
import { getErrorMessage } from '@/lib/utils/error';
import { getPacificTodayDateInputValue } from '@/lib/utils/pacific-date';
import {
  ALL_LEAD_CONVERSION_FILTER,
  ALL_LEAD_STATUS_FILTER,
  ALL_UNTOUCHED_LEADS_FILTER,
  formatLeadConversionFilterLabel,
  formatLeadStatusLabel,
  formatUntouchedLeadsFilterLabel,
  LEAD_PAGE_SIZE,
  MAX_UNTOUCHED_LEADS_DAYS,
  parseLeadConversionFilter,
  parseLeadStatusFilter,
  parseUntouchedLeadsFilter,
  UNTOUCHED_LEADS_DAY_OPTIONS,
  type LeadConversionFilter,
  type LeadStatusFilter,
  type UntouchedLeadsFilter,
} from '../lib/leads.helpers';
import { leadsApi } from '../api/leads-api';
import { useLeadsList } from '../hooks/useLeadsList';
import type { LeadSummary, LeadUser } from '../types/lead.types';
import { LEAD_STATUSES } from '../types/lead.types';
import { CreateLeadForm } from './CreateLeadForm';
import { LeadsTable } from './LeadsTable';

const ALL_AGENTS_FILTER = 'ALL';

function formatAgentFilterLabel(agent: LeadUser) {
  return `${agent.name} (${agent.role === 'ADMIN' ? 'Admin' : 'Sales'})`;
}

function buildOrderInitialValues(lead: LeadSummary): Partial<CreateOrderFormValues> {
  const quoteValue = lead.quote ?? undefined;

  return {
    leadId: lead.id,
    orderDate: getPacificTodayDateInputValue(),
    customerName: lead.customerName,
    customerEmail: lead.customerEmail ?? undefined,
    customerPhone: lead.customerPhone,
    partDescription: lead.partDescription,
    vehicleYear: lead.vehicleYear ?? undefined,
    vehicleMake: lead.vehicleMake ?? undefined,
    vehicleModel: lead.vehicleModel ?? undefined,
    vehicleVariant: lead.vehicleVariant ?? undefined,
    basePrice: quoteValue,
    salePrice: quoteValue,
    total: quoteValue,
    currency: lead.quoteCurrency,
    status: 'CONFIRMED',
    partialPayment: undefined,
    note: lead.comments ?? '',
  };
}

export function LeadsPageContent() {
  const authUser = useAuthStore((state) => state.user);
  const [searchTerm, setSearchTerm] = useTableQueryParam('q', '', (value) => value);
  const [convertedFilter, setConvertedFilter] =
    useTableQueryParam<LeadConversionFilter>('conversion', ALL_LEAD_CONVERSION_FILTER, parseLeadConversionFilter);
  const [statusFilter, setStatusFilter] =
    useTableQueryParam<LeadStatusFilter>('status', ALL_LEAD_STATUS_FILTER, parseLeadStatusFilter);
  const [untouchedFilter, setUntouchedFilter] =
    useTableQueryParam<UntouchedLeadsFilter>('untouched', ALL_UNTOUCHED_LEADS_FILTER, parseUntouchedLeadsFilter);
  const [untouchedMode, setUntouchedMode] = useTableQueryParam<'PRESET' | 'CUSTOM'>(
    'untouchedMode',
    'PRESET',
    (value) => value === 'CUSTOM' ? 'CUSTOM' : 'PRESET',
  );
  const isCustomUntouched = untouchedMode === 'CUSTOM' || (
    typeof untouchedFilter === 'number' &&
    !UNTOUCHED_LEADS_DAY_OPTIONS.some((days) => days === untouchedFilter)
  );
  const [customDaysDraft, setCustomDaysDraft] = useState(
    typeof untouchedFilter === 'number' ? String(untouchedFilter) : '',
  );
  const [customDaysError, setCustomDaysError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useTableDateRange();
  const [agentFilter, setAgentFilter] = useTableQueryParam<string | null>('agent', null, (value) => value || null);
  const [leadAgents, setLeadAgents] = useState<LeadUser[]>([]);
  const [page, setPage] = useTableQueryParam('page', 1, parseTablePage, false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEditLead, setSelectedEditLead] = useState<LeadSummary | null>(null);
  const [selectedConversionLead, setSelectedConversionLead] =
    useState<LeadSummary | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const activeSearch = deferredSearchTerm.trim();
  const searchPlaceholder =
    authUser?.role === 'SALES'
      ? 'Search by customer, email, phone, state, or vehicle'
      : 'Search by customer, email, phone, adviser, state, or vehicle';
  const dateRangeQuery = useMemo(
    () => buildTimestampRangeQuery(dateFilter),
    [dateFilter],
  );
  const selectedAgentFilter =
    agentFilter ?? (authUser?.role === 'SALES' ? authUser.userId : ALL_AGENTS_FILTER);
  const createdById =
    selectedAgentFilter === ALL_AGENTS_FILTER ? undefined : selectedAgentFilter;
  const agentOptions = useMemo(() => {
    const agents = new Map<string, LeadUser>();

    for (const agent of leadAgents) {
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
  }, [authUser, leadAgents]);
  const { leadsResponse, isLoading, error } = useLeadsList({
    page,
    search: activeSearch,
    converted: convertedFilter,
    status: statusFilter,
    createdFrom: dateRangeQuery.createdFrom,
    createdTo: dateRangeQuery.createdTo,
    createdById,
    untouchedDays:
      untouchedFilter === ALL_UNTOUCHED_LEADS_FILTER
        ? undefined
        : untouchedFilter,
    refreshKey,
  });

  useEffect(() => {
    if (isLoading) return;
    const lastPage = Math.max(1, leadsResponse.meta.totalPages);
    if (page > lastPage) setPage(lastPage);
  }, [isLoading, leadsResponse.meta.totalPages, page, setPage]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    startTransition(() => setPage(1));
  };

  const handleConvertedFilterChange = (value: LeadConversionFilter) => {
    setConvertedFilter(value);
    startTransition(() => setPage(1));
  };

  const handleStatusFilterChange = (value: LeadStatusFilter) => {
    setStatusFilter(value);
    startTransition(() => setPage(1));
  };

  const handleUntouchedFilterChange = (value: UntouchedLeadsFilter) => {
    setUntouchedFilter(value);
    startTransition(() => setPage(1));
  };

  const handleUntouchedSelection = (value: string) => {
    setCustomDaysError(null);

    if (value === 'CUSTOM') {
      setCustomDaysDraft(isCustomUntouched && typeof untouchedFilter === 'number'
        ? String(untouchedFilter)
        : '');
      setUntouchedMode('CUSTOM');
      handleUntouchedFilterChange(ALL_UNTOUCHED_LEADS_FILTER);
      return;
    }

    setUntouchedMode('PRESET');
    handleUntouchedFilterChange(parseUntouchedLeadsFilter(value));
  };

  const handleApplyCustomDays = () => {
    const days = parseUntouchedLeadsFilter(customDaysDraft);
    if (days === ALL_UNTOUCHED_LEADS_FILTER) {
      setCustomDaysError(`Enter a whole number from 1 to ${MAX_UNTOUCHED_LEADS_DAYS}.`);
      return;
    }

    setCustomDaysError(null);
    handleUntouchedFilterChange(days);
  };

  const handleAgentFilterChange = (value: string) => {
    setAgentFilter(value);
    startTransition(() => setPage(1));
  };

  const handleExportExcel = async () => {
    setIsExporting(true);

    try {
      await leadsApi.exportExcel({
        page: 1,
        limit: LEAD_PAGE_SIZE,
        search: activeSearch,
        converted:
          convertedFilter === 'CONVERTED'
            ? true
            : convertedFilter === 'OPEN'
              ? false
              : undefined,
        status: statusFilter === ALL_LEAD_STATUS_FILTER ? undefined : statusFilter,
        createdFrom: dateRangeQuery.createdFrom,
        createdTo: dateRangeQuery.createdTo,
        createdById,
        untouchedDays:
          untouchedFilter === ALL_UNTOUCHED_LEADS_FILTER
            ? undefined
            : untouchedFilter,
      });
      toast.success(
        'Leads export started',
        'The Excel file includes all leads matching the current filters.',
      );
    } catch (error) {
      toast.error(
        'Export failed',
        getErrorMessage(error, 'Unable to export leads right now.'),
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleLeadSaved = (lead: LeadSummary) => {
    const wasEditing = selectedEditLead !== null;
    setIsCreateModalOpen(false);
    setSelectedEditLead(null);
    setSearchTerm('');
    setConvertedFilter(ALL_LEAD_CONVERSION_FILTER);
    setStatusFilter(ALL_LEAD_STATUS_FILTER);
    setUntouchedFilter(ALL_UNTOUCHED_LEADS_FILTER);
    setUntouchedMode('PRESET');
    setCustomDaysDraft('');
    setCustomDaysError(null);
    startTransition(() => setPage(1));
    setRefreshKey((currentValue) => currentValue + 1);
    toast.success(
      `${lead.customerName} lead ${wasEditing ? 'updated' : 'created'}`,
      `The leads table has been refreshed with the ${wasEditing ? 'updated' : 'latest'} sales intake data.`,
    );
  };

  const handleRetry = () => {
    setRefreshKey((currentValue) => currentValue + 1);
  };

  const handleConvert = (lead: LeadSummary) => {
    setIsCreateModalOpen(false);
    setSelectedEditLead(null);
    setSelectedConversionLead(lead);
  };

  const handleEdit = (lead: LeadSummary) => {
    setIsCreateModalOpen(false);
    setSelectedConversionLead(null);
    setSelectedEditLead(lead);
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
    if (!isCreateModalOpen && !selectedEditLead && !selectedConversionLead) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCreateModalOpen, selectedConversionLead, selectedEditLead]);

  useEffect(() => {
    if (authUser?.role !== 'ADMIN' && authUser?.role !== 'SALES') {
      return;
    }

    let isMounted = true;

    const loadLeadAgents = async () => {
      try {
        const agents = await leadsApi.listAgents();

        if (isMounted) {
          setLeadAgents(agents);
        }
      } catch {
        if (isMounted) {
          setLeadAgents([]);
        }
      }
    };

    void loadLeadAgents();

    return () => {
      isMounted = false;
    };
  }, [authUser?.role]);

  return (
    <>
      <section className="grid gap-4">
        <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-950/80">
          <CardHeader className="space-y-3 border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <CardTitle className="text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                Leads Workspace
              </CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div
                  className={
                    dateFilter.preset === 'CUSTOM'
                      ? 'w-full xl:w-[34rem]'
                      : 'w-full sm:w-60'
                  }
                >
                  <DateRangeFilter
                    value={dateFilter}
                    onChange={setDateFilter}
                    variant="inline"
                    inlineCustomLayout="row"
                  />
                </div>

                <label className="grid w-full gap-2 sm:w-44">
                  <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Agent filter
                  </span>
                  <Select
                    value={selectedAgentFilter}
                    aria-label="Agent filter"
                    className="h-11 w-full rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
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
                  variant="outline"
                  className="h-11 w-full whitespace-nowrap rounded-xl px-5 font-semibold sm:w-auto"
                  disabled={isExporting}
                  onClick={() => void handleExportExcel()}
                >
                  <Download className="h-4 w-4" />
                  {isExporting ? 'Exporting...' : 'Export Excel'}
                </Button>

                <Button
                  size="lg"
                  className="h-11 w-full whitespace-nowrap rounded-xl bg-[#ff5a00] px-5 font-semibold text-white shadow-lg shadow-orange-600/20 hover:bg-[#e65000] sm:w-auto"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Create lead
                </Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_240px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-white pl-9 dark:border-slate-800 dark:bg-slate-900"
                  placeholder={searchPlaceholder}
                />
              </div>

              <Select
                value={convertedFilter}
                onChange={(event) =>
                  handleConvertedFilterChange(
                    parseLeadConversionFilter(event.target.value),
                  )
                }
                className="h-11 rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              >
                <option value={ALL_LEAD_CONVERSION_FILTER}>
                  {formatLeadConversionFilterLabel(ALL_LEAD_CONVERSION_FILTER)}
                </option>
                <option value="OPEN">{formatLeadConversionFilterLabel('OPEN')}</option>
                <option value="CONVERTED">
                  {formatLeadConversionFilterLabel('CONVERTED')}
                </option>
              </Select>

              <Select
                value={statusFilter}
                onChange={(event) =>
                  handleStatusFilterChange(parseLeadStatusFilter(event.target.value))
                }
                className="h-11 rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              >
                <option value={ALL_LEAD_STATUS_FILTER}>All statuses</option>
                {LEAD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {formatLeadStatusLabel(status)}
                  </option>
                ))}
              </Select>

              <div className="space-y-2">
                <Select
                  value={isCustomUntouched ? 'CUSTOM' : String(untouchedFilter)}
                  onChange={(event) => handleUntouchedSelection(event.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                  aria-label="Not touched filter"
                >
                  <option value={ALL_UNTOUCHED_LEADS_FILTER}>
                    {formatUntouchedLeadsFilterLabel(ALL_UNTOUCHED_LEADS_FILTER)}
                  </option>
                  {UNTOUCHED_LEADS_DAY_OPTIONS.map((days) => (
                    <option key={days} value={days}>
                      {formatUntouchedLeadsFilterLabel(days)}
                    </option>
                  ))}
                  <option value="CUSTOM">Custom days</option>
                </Select>
                {isCustomUntouched ? (
                  <form
                    className="space-y-1"
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleApplyCustomDays();
                    }}
                  >
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={MAX_UNTOUCHED_LEADS_DAYS}
                        step={1}
                        value={customDaysDraft}
                        onChange={(event) => {
                          setCustomDaysDraft(event.target.value);
                          setCustomDaysError(null);
                        }}
                        className="h-11 min-w-0 flex-1 rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                        placeholder="1–365 days"
                        aria-label="Custom days not touched"
                        aria-invalid={customDaysError !== null}
                      />
                      <Button type="submit" className="h-11 rounded-xl px-3">Apply</Button>
                    </div>
                    {customDaysError ? <p role="alert" className="text-xs text-destructive">{customDaysError}</p> : null}
                    {typeof untouchedFilter === 'number' ? (
                      <p className="text-xs text-muted-foreground">
                        Showing leads not touched for {untouchedFilter}+ days
                      </p>
                    ) : null}
                  </form>
                ) : null}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-3 sm:p-4">
            <LeadsTable
              leads={leadsResponse.items}
              meta={leadsResponse.meta}
              isLoading={isLoading}
              error={error}
              onRetry={handleRetry}
              onPageChange={setPage}
              onConvert={handleConvert}
              onEdit={handleEdit}
              role={authUser?.role}
              currentUserId={authUser?.userId}
              showAgentColumn={selectedAgentFilter === ALL_AGENTS_FILTER}
            />
          </CardContent>
        </Card>
      </section>

      {isCreateModalOpen || selectedEditLead ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-6"
        >
          <div
            className="w-full max-w-5xl rounded-[1.25rem] border border-slate-200 bg-white shadow-2xl sm:rounded-[1.5rem] dark:border-slate-800 dark:bg-slate-950"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5 sm:py-3.5">
              <div>
                <h2 className="font-[var(--font-heading)] text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                  {selectedEditLead ? 'Edit lead' : 'Create lead'}
                </h2>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-full px-0 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setSelectedEditLead(null);
                }}
                aria-label="Close create lead popup"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[calc(100vh-4.5rem)] overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
              <CreateLeadForm
                initialLead={selectedEditLead}
                onSaved={handleLeadSaved}
              />
            </div>
          </div>
        </div>
      ) : null}

      {selectedConversionLead ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-6"
        >
          <div
            className="w-full max-w-6xl rounded-[1.25rem] border border-border/70 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:rounded-[1.75rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/70 px-4 py-3 sm:px-6 sm:py-5">
              <div className="space-y-1">
                <h2 className="font-[var(--font-heading)] text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-2xl">
                  Convert lead to order
                </h2>
                <p className="text-sm text-muted-foreground">
                  The customer, vehicle, quote, and notes from this lead are prefilled below.
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-full px-0 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white"
                onClick={() => setSelectedConversionLead(null)}
                aria-label="Close convert lead popup"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[calc(100vh-4.5rem)] overflow-y-auto px-3 py-3 sm:max-h-[calc(100vh-5.5rem)] sm:px-6 sm:py-6">
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
