'use client';

import type { ApiEnvelope } from '@/features/auth/types/auth.types';
import { axiosBrowser } from '@/lib/api/axios-browser';
import { parseApiData } from '@/lib/api/parse-api-data';
import { salesOverviewSchema } from '../schemas/sales-overview.schema';
import type { SalesOverviewResponse } from '../types/sales-overview.types';

export const dashboardApi = {
  async getSalesOverview(month?: string | null): Promise<SalesOverviewResponse> {
    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/dashboard/sales-overview',
      month
        ? {
            params: {
              month,
            },
          }
        : undefined,
    );

    return parseApiData(response, salesOverviewSchema, {
      emptyMessage: response.data.message || 'Sales overview response was empty.',
      invalidMessage: 'Sales overview response payload was invalid.',
    });
  },
};
