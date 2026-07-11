'use client';

import { axiosBrowser } from '@/lib/api/axios-browser';
import { parseApiData } from '@/lib/api/parse-api-data';
import type { ApiEnvelope } from '@/features/auth/types/auth.types';
import { HttpError } from '@/lib/api/http-error';
import { isValidOrderId, normalizeOrdersListQuery } from '../lib/orders.helpers';
import {
  createOrderSchema,
  nextOrderNumberSchema,
  orderDetailSchema,
  ordersListSchema,
  orderSummarySchema,
  updateOrderSchema,
} from '../schemas/order.schema';
import type {
  CreateOrderInput,
  OrderDetail,
  NextOrderNumber,
  OrdersListQuery,
  OrdersListResponse,
  OrderSummary,
  UpdateOrderInput,
} from '../types/order.types';

export const ordersApi = {
  async list(params: OrdersListQuery): Promise<OrdersListResponse> {
    const normalizedParams = normalizeOrdersListQuery(params);
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>('/api/orders', {
      params: normalizedParams,
    });

    return parseApiData(response, ordersListSchema, {
      emptyMessage: response.data.message || 'Orders response was empty.',
      invalidMessage: 'Orders response payload was invalid.',
    });
  },

  async create(payload: CreateOrderInput): Promise<OrderSummary> {
    const requestPayload = createOrderSchema.parse(payload);
    const response = await axiosBrowser.post<ApiEnvelope<unknown>>(
      '/api/orders',
      requestPayload,
    );

    return parseApiData(response, orderSummarySchema, {
      emptyMessage: response.data.message || 'Create order response was empty.',
      invalidMessage: 'Create order response payload was invalid.',
    });
  },

  async getNextOrderNumber(): Promise<NextOrderNumber> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/orders/next-number',
    );

    return parseApiData(response, nextOrderNumberSchema, {
      emptyMessage: response.data.message || 'Next order number response was empty.',
      invalidMessage: 'Next order number response payload was invalid.',
    });
  },

  async getById(orderId: string): Promise<OrderDetail> {
    if (!isValidOrderId(orderId)) {
      throw new HttpError('Order identifier is invalid.', 400);
    }

    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      `/api/orders/${orderId}`,
    );

    return parseApiData(response, orderDetailSchema, {
      emptyMessage: response.data.message || 'Order details response was empty.',
      invalidMessage: 'Order details response payload was invalid.',
    });
  },

  async update(orderId: string, payload: UpdateOrderInput): Promise<OrderSummary> {
    if (!isValidOrderId(orderId)) {
      throw new HttpError('Order identifier is invalid.', 400);
    }

    const requestPayload = updateOrderSchema.parse(payload);
    const response = await axiosBrowser.patch<ApiEnvelope<unknown>>(
      `/api/orders/${orderId}`,
      requestPayload,
    );

    return parseApiData(response, orderSummarySchema, {
      emptyMessage: response.data.message || 'Update order response was empty.',
      invalidMessage: 'Update order response payload was invalid.',
    });
  },
};
