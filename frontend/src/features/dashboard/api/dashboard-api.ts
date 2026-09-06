'use client';

import type { ApiEnvelope } from '@/features/auth/types/auth.types';
import { axiosBrowser } from '@/lib/api/axios-browser';
import { parseApiData } from '@/lib/api/parse-api-data';
import {
  agentLeadsDashboardSchema,
  orderStatusDashboardSchema,
  salesOverviewSchema,
} from '../schemas/sales-overview.schema';
import type {
  AgentLeadsDashboardQuery,
  AgentLeadsDashboardResponse,
  OrderStatusDashboardQuery,
  OrderStatusDashboardResponse,
  SalesOverviewResponse,
} from '../types/sales-overview.types';

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

  async getOrderStatus(
    query: OrderStatusDashboardQuery,
  ): Promise<OrderStatusDashboardResponse> {
    const params: Record<string, string | number> = {};

    if (query.month) {
      params.month = query.month;
    }

    if (query.search?.trim()) {
      params.search = query.search.trim();
    }

    if (query.status && query.status !== 'ALL') {
      params.status = query.status;
    }

    if (query.agentId && query.agentId !== 'ALL') {
      params.agentId = query.agentId;
    }

    if (query.ageingRange && query.ageingRange !== 'ALL') {
      params.ageingRange = query.ageingRange;
    }

    if (query.overdueDays) {
      params.overdueDays = query.overdueDays;
    }

    if (query.page) {
      params.page = query.page;
    }

    if (query.limit) {
      params.limit = query.limit;
    }

    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/dashboard/order-status',
      {
        params,
      },
    );

    return parseApiData(response, orderStatusDashboardSchema, {
      emptyMessage: response.data.message || 'Order status response was empty.',
      invalidMessage: 'Order status response payload was invalid.',
    });
  },

  async getAgentLeads(
    query: AgentLeadsDashboardQuery,
  ): Promise<AgentLeadsDashboardResponse> {
    const params: Record<string, string> = {};

    if (query.month) {
      params.month = query.month;
    }

    if (query.search?.trim()) {
      params.search = query.search.trim();
    }

    if (query.status && query.status !== 'ALL') {
      params.status = query.status;
    }

    const response = await axiosBrowser.get<ApiEnvelope<unknown>>(
      '/api/dashboard/agent-leads',
      {
        params,
      },
    );

    return parseApiData(response, agentLeadsDashboardSchema, {
      emptyMessage: response.data.message || 'Agent leads response was empty.',
      invalidMessage: 'Agent leads response payload was invalid.',
    });
  },
};
