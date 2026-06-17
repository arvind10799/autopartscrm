'use client';

import { useEffect, useState } from 'react';
import { useRequestTracker } from '@/lib/hooks/useRequestTracker';
import { getErrorMessage } from '@/lib/utils/error';
import { ordersApi } from '../api/orders-api';
import { isValidOrderId } from '../lib/orders.helpers';
import type { OrderDetail } from '../types/order.types';

type UseOrderDetailResult = {
  order: OrderDetail | null;
  isLoading: boolean;
  error: string | null;
};

export function useOrderDetail(orderId: string): UseOrderDetailResult {
  return useOrderDetailWithRefresh(orderId, 0);
}

export function useOrderDetailWithRefresh(
  orderId: string,
  refreshKey: number,
): UseOrderDetailResult {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestTracker = useRequestTracker();

  useEffect(() => {
    const requestId = requestTracker.beginRequest();
    const normalizedOrderId = orderId.trim();

    const loadOrder = async () => {
      if (!normalizedOrderId || !isValidOrderId(normalizedOrderId)) {
        setOrder(null);
        setError('Order identifier is invalid.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await ordersApi.getById(normalizedOrderId);

        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setOrder(response);
      } catch (error) {
        if (!requestTracker.isCurrentRequest(requestId)) {
          return;
        }

        setOrder(null);

        setError(getErrorMessage(error, 'Unable to load this order right now.'));
      } finally {
        if (requestTracker.isCurrentRequest(requestId)) {
          setIsLoading(false);
        }
      }
    };

    void loadOrder();
  }, [orderId, refreshKey, requestTracker]);

  return {
    order,
    isLoading,
    error,
  };
}
