'use client';

import { useEffect, useState } from 'react';
import { useRequestTracker } from '@/lib/hooks/useRequestTracker';
import { getErrorMessage } from '@/lib/utils/error';
import { replacementsApi } from '../api/replacements-api';
import {
  ALL_REPLACEMENT_STATUS_FILTER,
  createEmptyReplacementsResponse,
  normalizeReplacementsListQuery,
  REPLACEMENTS_PAGE_SIZE,
  type ReplacementStatusFilter,
} from '../lib/replacements.helpers';
import type { ReplacementsListResponse } from '../types/replacement.types';

type UseReplacementsListOptions = {
  page: number;
  search: string;
  status: ReplacementStatusFilter;
  orderId?: string;
  shipmentId?: string;
  createdFrom?: string;
  createdTo?: string;
  refreshKey: number;
};

export function useReplacementsList({
  page,
  search,
  status,
  orderId,
  shipmentId,
  createdFrom,
  createdTo,
  refreshKey,
}: UseReplacementsListOptions) {
  const [replacementsResponse, setReplacementsResponse] =
    useState<ReplacementsListResponse>(() =>
      createEmptyReplacementsResponse(page, REPLACEMENTS_PAGE_SIZE),
    );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestTracker = useRequestTracker();

  useEffect(() => {
    const requestId = requestTracker.beginRequest();
    const normalizedQuery = normalizeReplacementsListQuery({
      page,
      limit: REPLACEMENTS_PAGE_SIZE,
      search,
      status: status === ALL_REPLACEMENT_STATUS_FILTER ? undefined : status,
      orderId,
      shipmentId,
      createdFrom,
      createdTo,
    });

    const loadReplacements = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await replacementsApi.list(normalizedQuery);

        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setReplacementsResponse(response);
      } catch (caughtError) {
        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setReplacementsResponse(
          createEmptyReplacementsResponse(
            normalizedQuery.page,
            normalizedQuery.limit,
          ),
        );
        setError(
          getErrorMessage(
            caughtError,
            'Unable to load replacement orders right now.',
          ),
        );
      } finally {
        if (requestTracker.isCurrentRequest(requestId)) {
          setIsLoading(false);
        }
      }
    };

    void loadReplacements();
  }, [
    createdFrom,
    createdTo,
    orderId,
    page,
    refreshKey,
    requestTracker,
    search,
    shipmentId,
    status,
  ]);

  return {
    replacementsResponse,
    isLoading,
    error,
  };
}
