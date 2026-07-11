'use client';

import { useEffect, useState } from 'react';
import { useRequestTracker } from '@/lib/hooks/useRequestTracker';
import { getErrorMessage } from '@/lib/utils/error';
import { leadsApi } from '../api/leads-api';
import {
  ALL_LEAD_CONVERSION_FILTER,
  createEmptyLeadsResponse,
  LEAD_PAGE_SIZE,
  normalizeLeadsListQuery,
  type LeadConversionFilter,
  type LeadStatusFilter,
  ALL_LEAD_STATUS_FILTER,
} from '../lib/leads.helpers';
import type { LeadsListResponse } from '../types/lead.types';

type UseLeadsListOptions = {
  page: number;
  search: string;
  converted: LeadConversionFilter;
  status: LeadStatusFilter;
  createdFrom?: string;
  createdTo?: string;
  refreshKey: number;
};

type UseLeadsListResult = {
  leadsResponse: LeadsListResponse;
  isLoading: boolean;
  error: string | null;
};

export function useLeadsList({
  page,
  search,
  converted,
  status,
  createdFrom,
  createdTo,
  refreshKey,
}: UseLeadsListOptions): UseLeadsListResult {
  const [leadsResponse, setLeadsResponse] = useState<LeadsListResponse>(() =>
    createEmptyLeadsResponse(page, LEAD_PAGE_SIZE),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestTracker = useRequestTracker();

  useEffect(() => {
    const requestId = requestTracker.beginRequest();
    const normalizedQuery = normalizeLeadsListQuery({
      page: Number.isInteger(page) && page > 0 ? page : 1,
      limit: LEAD_PAGE_SIZE,
      search,
      converted:
        converted === ALL_LEAD_CONVERSION_FILTER
          ? undefined
          : converted === 'CONVERTED',
      status: status === ALL_LEAD_STATUS_FILTER ? undefined : status,
      createdFrom,
      createdTo,
    });

    const loadLeads = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await leadsApi.list(normalizedQuery);

        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setLeadsResponse(response);
      } catch (error) {
        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setLeadsResponse(
          createEmptyLeadsResponse(normalizedQuery.page, LEAD_PAGE_SIZE),
        );
        setError(
          getErrorMessage(error, 'Unable to load leads right now. Please try again.'),
        );
      } finally {
        if (requestTracker.isCurrentRequest(requestId)) {
          setIsLoading(false);
        }
      }
    };

    void loadLeads();
  }, [
    converted,
    createdFrom,
    createdTo,
    page,
    refreshKey,
    requestTracker,
    search,
    status,
  ]);

  return {
    leadsResponse,
    isLoading,
    error,
  };
}
