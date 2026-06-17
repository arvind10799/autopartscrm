'use client';

import { useEffect, useState } from 'react';
import { useRequestTracker } from '@/lib/hooks/useRequestTracker';
import { getErrorMessage } from '@/lib/utils/error';
import { shipmentsApi } from '../api/shipments-api';
import {
  ALL_SHIPMENT_STATUS_FILTER,
  createEmptyShipmentsResponse,
  normalizeShipmentsListQuery,
  SHIPMENT_PAGE_SIZE,
  type ShipmentStatusFilter,
} from '../lib/shipments.helpers';
import type { ShipmentsListResponse } from '../types/shipment.types';

type UseShipmentsListOptions = {
  page: number;
  search: string;
  status: ShipmentStatusFilter;
  createdFrom?: string;
  createdTo?: string;
  refreshKey: number;
};

type UseShipmentsListResult = {
  shipmentsResponse: ShipmentsListResponse;
  isLoading: boolean;
  error: string | null;
};

export function useShipmentsList({
  page,
  search,
  status,
  createdFrom,
  createdTo,
  refreshKey,
}: UseShipmentsListOptions): UseShipmentsListResult {
  const [shipmentsResponse, setShipmentsResponse] =
    useState<ShipmentsListResponse>(() =>
      createEmptyShipmentsResponse(page, SHIPMENT_PAGE_SIZE),
    );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestTracker = useRequestTracker();

  useEffect(() => {
    const requestId = requestTracker.beginRequest();
    const normalizedQuery = normalizeShipmentsListQuery({
      page,
      limit: SHIPMENT_PAGE_SIZE,
      search,
      status: status === ALL_SHIPMENT_STATUS_FILTER ? undefined : status,
      createdFrom,
      createdTo,
    });

    const loadShipments = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await shipmentsApi.list(normalizedQuery);

        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setShipmentsResponse(response);
      } catch (error) {
        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setShipmentsResponse(
          createEmptyShipmentsResponse(
            normalizedQuery.page,
            normalizedQuery.limit,
          ),
        );

        setError(
          getErrorMessage(
            error,
            'Unable to load shipments right now. Please try again.',
          ),
        );
      } finally {
        if (requestTracker.isCurrentRequest(requestId)) {
          setIsLoading(false);
        }
      }
    };

    void loadShipments();
  }, [
    createdFrom,
    createdTo,
    page,
    refreshKey,
    requestTracker,
    search,
    status,
  ]);

  return {
    shipmentsResponse,
    isLoading,
    error,
  };
}
