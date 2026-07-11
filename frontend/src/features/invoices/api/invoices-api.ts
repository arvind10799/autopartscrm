'use client';

import type { ApiEnvelope } from '@/features/auth/types/auth.types';
import { createInvoiceSchema, invoiceDefaultsSchema, invoiceRecordSchema } from '@/features/invoices/schemas/invoice.schema';
import type { CreateInvoiceInput, InvoiceDefaults, InvoiceRecord } from '@/features/invoices/types/invoice.types';
import { axiosBrowser } from '@/lib/api/axios-browser';
import { HttpError } from '@/lib/api/http-error';
import { parseApiData } from '@/lib/api/parse-api-data';
import { isValidOrderId } from '@/features/orders/lib/orders.helpers';

export const invoicesApi = {
  async getDefaults(orderId: string): Promise<InvoiceDefaults> {
    this.assertOrderId(orderId);

    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      `/api/orders/${orderId}/invoice/defaults`,
    );

    return parseApiData(response, invoiceDefaultsSchema, {
      emptyMessage: response.data.message || 'Invoice defaults response was empty.',
      invalidMessage: 'Invoice defaults payload was invalid.',
    });
  },

  async getByOrderId(orderId: string): Promise<InvoiceRecord> {
    this.assertOrderId(orderId);

    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      `/api/orders/${orderId}/invoice`,
    );

    return parseApiData(response, invoiceRecordSchema, {
      emptyMessage: response.data.message || 'Invoice response was empty.',
      invalidMessage: 'Invoice payload was invalid.',
    });
  },

  async create(
    orderId: string,
    payload: CreateInvoiceInput,
  ): Promise<InvoiceRecord> {
    this.assertOrderId(orderId);
    const requestPayload = createInvoiceSchema.parse(payload);

    const response = await axiosBrowser.post<ApiEnvelope<unknown>>(
      `/api/orders/${orderId}/invoice`,
      requestPayload,
    );

    return parseApiData(response, invoiceRecordSchema, {
      emptyMessage: response.data.message || 'Create invoice response was empty.',
      invalidMessage: 'Create invoice payload was invalid.',
    });
  },

  assertOrderId(orderId: string): void {
    if (!isValidOrderId(orderId)) {
      throw new HttpError('Order identifier is invalid.', 400);
    }
  },
};
