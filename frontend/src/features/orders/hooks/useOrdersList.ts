'use client';

import { useEffect, useState } from 'react';
import { useRequestTracker } from '@/lib/hooks/useRequestTracker';
import { getErrorMessage } from '@/lib/utils/error';
import { ordersApi } from '../api/orders-api';
import {
  ALL_SHIPMENT_STATUS_FILTER,
  createEmptyOrdersResponse,
  normalizeOrdersListQuery,
  ORDER_PAGE_SIZE,
  type ShipmentStatusFilter,
} from '../lib/orders.helpers';
import type { OrdersListResponse } from '../types/order.types';

type UseOrdersListOptions = {
  page: number;
  search: string;
  shipmentStatus?: ShipmentStatusFilter;
  hasShipment?: boolean;
  createdFrom?: string;
  createdTo?: string;
  refreshKey: number;
};

type UseOrdersListResult = {
  ordersResponse: OrdersListResponse;
  isLoading: boolean;
  error: string | null;
};

export function useOrdersList({
  page,
  search,
  shipmentStatus,
  hasShipment,
  createdFrom,
  createdTo,
  refreshKey,
}: UseOrdersListOptions): UseOrdersListResult {
  const [ordersResponse, setOrdersResponse] = useState<OrdersListResponse>(() =>
    createEmptyOrdersResponse(page, ORDER_PAGE_SIZE),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestTracker = useRequestTracker();

  useEffect(() => {
    const requestId = requestTracker.beginRequest();
    const normalizedQuery = normalizeOrdersListQuery({
      page: Number.isInteger(page) && page > 0 ? page : 1,
      limit: ORDER_PAGE_SIZE,
      search,
      shipmentStatus:
        shipmentStatus === ALL_SHIPMENT_STATUS_FILTER ? undefined : shipmentStatus,
      hasShipment,
      createdFrom,
      createdTo,
    });

    const loadOrders = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await ordersApi.list({
          ...normalizedQuery,
        });

        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setOrdersResponse(response);
      } catch (error) {
        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setOrdersResponse(
          createEmptyOrdersResponse(normalizedQuery.page, ORDER_PAGE_SIZE),
        );

        setError(
          getErrorMessage(error, 'Unable to load orders right now. Please try again.'),
        );
      } finally {
        if (requestTracker.isCurrentRequest(requestId)) {
          setIsLoading(false);
        }
      }
    };

    void loadOrders();
  }, [
    createdFrom,
    createdTo,
    hasShipment,
    page,
    refreshKey,
    requestTracker,
    search,
    shipmentStatus,
  ]);

  return {
    ordersResponse,
    isLoading,
    error,
  };
}
